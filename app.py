from flask import Flask, jsonify, request, render_template, send_from_directory, Response, send_file
from pathlib import Path
from threading import Lock, Thread
import json
import time

BASE_DIR = Path(__file__).resolve().parent
app = Flask(__name__, template_folder=str(BASE_DIR / "templates"))
lock = Lock()

state = {
    "robot1": "AMARILLO",
    "robot2": "MORADO",
    "robot1_image": "/Imagenes/R_Amarillo.png",
    "robot2_image": "/Imagenes/R_Morado.png",
    "battle_number": 1,
    "attacks1": 0,
    "attacks2": 0,
    "status": "PREPARADOS PARA LA BATALLA",
    "elapsed_seconds": 0,
    "started_at": None,
    "winner": "",
    "reason": "",
    "phase": "ready",
    "ui_action": "",
    "ui_action_id": 0,
    "ui_completed": ""
}

ROBOT_PAIRS = [
    ("/Imagenes/R_Amarillo.png", "/Imagenes/R_Morado.png", "AMARILLO", "MORADO"),
    ("/Imagenes/R_Rojo.png", "/Imagenes/R_Verde.png", "ROJO", "VERDE"),
]

def snapshot():
    data = dict(state)
    if data["phase"] == "running" and data["started_at"] is not None:
        data["elapsed_seconds"] = max(0, time.time() - data["started_at"])
    return data

def stop_clock():
    if state["phase"] == "running" and state["started_at"] is not None:
        state["elapsed_seconds"] = max(0, time.time() - state["started_at"])
    state["started_at"] = None

@app.get("/")
def home():
    return render_template("index.html")

@app.get("/management-demo")
def management_demo():
    # Versión HTML de prueba con los paneles de participantes y doble eliminación.
    return send_file(BASE_DIR / "index.html")

@app.get("/attacks/<int:robot>")
def attacks_page(robot):
    if robot not in (1, 2):
        return jsonify({"error": "Robot inválido"}), 404
    return render_template("attacks.html", robot=robot)

@app.get("/<path:filename>")
def assets(filename):
    # Las rutas del HTML usan /Imagenes/... y /Audios/... directamente.
    allowed_dirs = {"Imagenes", "Audios"}
    parts = Path(filename).parts
    if len(parts) != 2 or parts[0] not in allowed_dirs:
        return jsonify({"error": "Recurso no encontrado"}), 404
    file_path = BASE_DIR / parts[0] / parts[1]
    if not file_path.is_file():
        return jsonify({"error": "Recurso no encontrado"}), 404
    return send_from_directory(BASE_DIR / parts[0], parts[1])

@app.get("/api/state")
def get_state():
    with lock:
        return jsonify(snapshot())

@app.get("/api/stream")
def stream_state():
    def events():
        previous = None
        while True:
            with lock:
                current = snapshot()
            payload = json.dumps({"type": "state", "data": current}, ensure_ascii=False)
            if payload != previous:
                yield f"data: {payload}\n\n"
                previous = payload
            time.sleep(0.35)
    return Response(events(), mimetype="text/event-stream", headers={
        "Cache-Control": "no-cache",
        "X-Accel-Buffering": "no"
    })

@app.post("/api/attack/<int:robot>")
def add_attack(robot):
    if robot not in (1, 2):
        return jsonify({"error": "Robot inválido"}), 400
    with lock:
        if state["phase"] != "running":
            return jsonify({"error": "Solo se pueden registrar ataques durante una batalla en curso"}), 409
        key = "attacks1" if robot == 1 else "attacks2"
        state[key] += 1
        return jsonify(snapshot())

@app.post("/api/attack/<int:robot>/decrement")
def remove_attack(robot):
    if robot not in (1, 2):
        return jsonify({"error": "Robot inválido"}), 400
    with lock:
        if state["phase"] != "running":
            return jsonify({"error": "Solo se pueden corregir ataques durante una batalla en curso"}), 409
        key = "attacks1" if robot == 1 else "attacks2"
        state[key] = max(0, state[key] - 1)
        return jsonify(snapshot())

@app.post("/api/config")
def configure():
    payload = request.get_json(silent=True) or {}
    with lock:
        for key in ("robot1", "robot2"):
            if key in payload:
                name = str(payload[key]).strip()[:40]
                if name:
                    state[key] = name
        return jsonify(snapshot())

@app.post("/api/start")
def start_battle():
    with lock:
        state.update({
            "attacks1": 0, "attacks2": 0, "winner": "", "reason": "",
            "elapsed_seconds": 0, "started_at": time.time(),
            "status": "BATALLA EN CURSO", "phase": "running",
            "ui_action": "", "ui_action_id": state["ui_action_id"] + 1
        })
        return jsonify(snapshot())

@app.post("/api/pause")
def pause_battle():
    with lock:
        stop_clock()
        state["phase"] = "paused"
        state["status"] = "BATALLA PAUSADA"
        return jsonify(snapshot())

@app.post("/api/finish")
def finish_battle():
    payload = request.get_json(silent=True) or {}
    with lock:
        stop_clock()
        state["phase"] = "finished"
        state["status"] = "BATALLA FINALIZADA"
        state["winner"] = str(payload.get("winner", state["winner"])).strip()[:40]
        state["reason"] = str(payload.get("reason", state["reason"])).strip()[:80]
        return jsonify(snapshot())

@app.post("/api/next")
def next_battle():
    payload = request.get_json(silent=True) or {}
    with lock:
        next_number = state["battle_number"] + 1
        image1, image2, default1, default2 = ROBOT_PAIRS[(next_number - 1) % len(ROBOT_PAIRS)]
        state.update({
            "robot1": str(payload.get("robot1", default1)).strip()[:40] or default1,
            "robot2": str(payload.get("robot2", default2)).strip()[:40] or default2,
            "robot1_image": image1,
            "robot2_image": image2,
            "battle_number": next_number,
            "attacks1": 0, "attacks2": 0, "elapsed_seconds": 0,
            "started_at": None, "winner": "", "reason": "",
            "status": "PREPARADOS PARA LA BATALLA", "phase": "ready",
            "ui_action": "", "ui_action_id": state["ui_action_id"] + 1
        })
        return jsonify(snapshot())

@app.post("/api/ui-complete")
def ui_complete():
    payload = request.get_json(silent=True) or {}
    with lock:
        state["ui_completed"] = str(payload.get("action", ""))[:40]
        return jsonify(snapshot())

if __name__ == "__main__":
    print("MiniSumos RC disponible en http://127.0.0.1:8000")
    app.run(host="0.0.0.0", port=8000, debug=False, threaded=True)
