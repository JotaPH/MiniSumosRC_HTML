from flask import Flask, jsonify, request, render_template, send_from_directory, Response, send_file
from pathlib import Path
from threading import Lock, Thread
import json
import random
import os
import sqlite3
import subprocess
import sys
import time
import webbrowser
import urllib.error
import urllib.request
from contextlib import closing

BASE_DIR = Path(__file__).resolve().parent
# La aplicación HTML usa exclusivamente su propia base de datos.
# No consulta ni escribe en el proyecto MiniSumosRC de Python.
DB_PATH = BASE_DIR / "BasesDeDatos" / "competencia.db"

def ensure_participants_schema(connection):
    exists = connection.execute(
        "SELECT 1 FROM sqlite_master WHERE type='table' AND name='participantes'"
    ).fetchone()
    if not exists:
        raise sqlite3.OperationalError(
            f"La base de datos {DB_PATH} no contiene la tabla participantes. "
            "Verifica MINISUMOS_DB_PATH; no se creó una tabla nueva para evitar usar otra BD."
        )
    columns = {row["name"] for row in connection.execute("PRAGMA table_info(participantes)")}
    migrations = {
        "peso": "REAL DEFAULT 0",
        "cumple_dimensiones": "INTEGER DEFAULT 1",
        "tipo_rc": "INTEGER DEFAULT 1",
        "interruptor_visible": "INTEGER DEFAULT 1",
        "sin_elementos_fijacion": "INTEGER DEFAULT 1",
        "sensores_tapados": "INTEGER DEFAULT 1",
    }
    for name, definition in migrations.items():
        if name not in columns:
            connection.execute(f"ALTER TABLE participantes ADD COLUMN {name} {definition}")
    connection.execute("""
        CREATE TABLE IF NOT EXISTS torneo_debug (
            id INTEGER PRIMARY KEY CHECK (id = 1),
            iniciado INTEGER NOT NULL DEFAULT 0,
            estado_json TEXT NOT NULL DEFAULT ''
        )
    """)
    connection.execute(
        "INSERT OR IGNORE INTO torneo_debug (id, iniciado, estado_json) VALUES (1, 0, '')"
    )
    connection.commit()

def db_connect():
    if not DB_PATH.is_file():
        raise FileNotFoundError(
            f"No se encontró la base de datos: {DB_PATH}. "
            "Configura MINISUMOS_DB_PATH con la ruta exacta a competencia.db."
        )
    connection = sqlite3.connect(str(DB_PATH), timeout=10)
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA foreign_keys = ON")
    ensure_participants_schema(connection)
    return connection

def table_exists(connection, table_name):
    return connection.execute(
        "SELECT 1 FROM sqlite_master WHERE type='table' AND name=?",
        (table_name,)
    ).fetchone() is not None

def competition_has_data(connection):
    for table in ("enfrentamientos", "historial_batallas", "clasificacion",
                  "llaves", "grupo_participantes", "grupos"):
        if table_exists(connection, table):
            count = connection.execute('SELECT COUNT(*) FROM "' + table + '"').fetchone()[0]
            if count:
                return True
    return False

def clear_competition_data(connection):
    for table in ("enfrentamientos", "historial_batallas", "clasificacion",
                  "llaves", "grupo_participantes", "grupos"):
        if table_exists(connection, table):
            connection.execute('DELETE FROM "' + table + '"')
    if table_exists(connection, "sqlite_sequence"):
        connection.execute(
            "DELETE FROM sqlite_sequence WHERE name IN ('enfrentamientos', 'historial_batallas')"
        )

def authorize_participant_change(connection, payload):
    if competition_has_data(connection) and not payload.get("reset_competition"):
        return False
    if payload.get("reset_competition"):
        clear_competition_data(connection)
        connection.execute("UPDATE torneo_debug SET iniciado=0, estado_json='' WHERE id=1")
    return True

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
    # Conserva como inicio el HTML que incluye los paneles nuevos de gestión.
    return send_file(BASE_DIR / "index.html")

@app.get("/battles")
def battles_page():
    return render_template("batallas.html")

@app.get("/classic-dashboard")
def classic_dashboard():
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

@app.get("/api/database-status")
def database_status():
    try:
        with closing(db_connect()) as connection:
            tables = {row["name"] for row in connection.execute(
                "SELECT name FROM sqlite_master WHERE type='table'"
            )}
        return jsonify({"connected": True, "database": str(DB_PATH), "tables": sorted(tables)})
    except (OSError, sqlite3.Error) as error:
        return jsonify({"connected": False, "database": str(DB_PATH), "error": str(error)}), 503

@app.get("/api/participants")
def list_participants():
    try:
        with closing(db_connect()) as connection:
            rows = connection.execute("""
                SELECT id, nombre, robot, peso, cumple_dimensiones, tipo_rc,
                       interruptor_visible, sin_elementos_fijacion, sensores_tapados
                FROM participantes ORDER BY id
            """).fetchall()
        return jsonify([{
            "id": row["id"], "pilot": row["nombre"], "robot": row["robot"],
            "weight": row["peso"] or 0,
            "checks": [bool(row[key]) for key in (
                "cumple_dimensiones", "tipo_rc", "interruptor_visible",
                "sin_elementos_fijacion", "sensores_tapados")]
        } for row in rows])
    except (OSError, sqlite3.Error) as error:
        return jsonify({"error": f"No se pudieron consultar los participantes: {error}"}), 503

def validate_participant(payload):
    pilot = str(payload.get("pilot", payload.get("nombre", ""))).strip()[:70]
    robot = str(payload.get("robot", "")).strip()[:40]
    try:
        weight = float(payload.get("weight", payload.get("peso", 0)))
    except (TypeError, ValueError):
        weight = 0
    checks = payload.get("checks", [])
    if not isinstance(checks, list):
        checks = []
    checks = [int(i < len(checks) and bool(checks[i])) for i in range(5)]
    if not pilot or not robot or not (weight > 0):
        return None, "Ingresa nombre, robot y un peso mayor que 0 g."
    return (pilot, robot, weight, checks), None

@app.post("/api/participants")
def create_participant():
    payload = request.get_json(silent=True) or {}
    data, error = validate_participant(payload)
    if error:
        return jsonify({"error": error}), 400
    try:
        with closing(db_connect()) as connection, connection:
            if not authorize_participant_change(connection, payload):
                return jsonify({
                    "error": "Hay datos de una competencia anterior. ¿Deseas limpiar el calendario y sus resultados para modificar participantes?",
                    "requires_confirmation": True
                }), 409
            duplicate = connection.execute(
                "SELECT 1 FROM participantes WHERE lower(robot)=lower(?)", (data[1],)
            ).fetchone()
            if duplicate:
                return jsonify({"error": "Ya existe un robot con ese nombre."}), 409
            connection.execute("""
                INSERT INTO participantes
                (nombre, robot, peso, cumple_dimensiones, tipo_rc, interruptor_visible,
                 sin_elementos_fijacion, sensores_tapados)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """, (data[0], data[1], data[2], *data[3]))
            row = connection.execute("SELECT last_insert_rowid() AS id").fetchone()
            connection.execute("UPDATE torneo_debug SET iniciado=0, estado_json='' WHERE id=1")
        return jsonify({"id": row["id"], "message": "Participante guardado en SQLite.", "competitionReset": True}), 201
    except (OSError, sqlite3.Error) as error:
        return jsonify({"error": f"No se pudo guardar el participante: {error}"}), 503

@app.put("/api/participants/<int:participant_id>")
def update_participant(participant_id):
    payload = request.get_json(silent=True) or {}
    data, error = validate_participant(payload)
    if error:
        return jsonify({"error": error}), 400
    try:
        with closing(db_connect()) as connection, connection:
            if not authorize_participant_change(connection, payload):
                return jsonify({
                    "error": "Hay datos de una competencia anterior. ¿Deseas limpiar el calendario y sus resultados para modificar participantes?",
                    "requires_confirmation": True
                }), 409
            duplicate = connection.execute(
                "SELECT 1 FROM participantes WHERE lower(robot)=lower(?) AND id<>?",
                (data[1], participant_id)
            ).fetchone()
            if duplicate:
                return jsonify({"error": "Ya existe un robot con ese nombre."}), 409
            cursor = connection.execute("""
                UPDATE participantes SET nombre=?, robot=?, peso=?, cumple_dimensiones=?,
                    tipo_rc=?, interruptor_visible=?, sin_elementos_fijacion=?, sensores_tapados=?
                WHERE id=?
            """, (data[0], data[1], data[2], *data[3], participant_id))
            if cursor.rowcount == 0:
                return jsonify({"error": "El participante ya no existe."}), 404
            connection.execute("UPDATE torneo_debug SET iniciado=0, estado_json='' WHERE id=1")
        return jsonify({"message": "Participante actualizado en SQLite.", "competitionReset": True})
    except (OSError, sqlite3.Error) as error:
        return jsonify({"error": f"No se pudo actualizar el participante: {error}"}), 503

@app.delete("/api/participants/<int:participant_id>")
def delete_participant(participant_id):
    payload = request.get_json(silent=True) or {}
    try:
        with closing(db_connect()) as connection, connection:
            if not authorize_participant_change(connection, payload):
                return jsonify({
                    "error": "Hay datos de una competencia anterior. ¿Deseas limpiar el calendario y sus resultados para modificar participantes?",
                    "requires_confirmation": True
                }), 409
            cursor = connection.execute("DELETE FROM participantes WHERE id=?", (participant_id,))
            if cursor.rowcount == 0:
                return jsonify({"error": "El participante ya no existe."}), 404
            connection.execute("UPDATE torneo_debug SET iniciado=0, estado_json='' WHERE id=1")
        return jsonify({"message": "Participante eliminado de SQLite.", "competitionReset": True})
    except (OSError, sqlite3.Error) as error:
        return jsonify({"error": f"No se pudo eliminar el participante: {error}"}), 503

@app.post("/api/tournament/engine/start")
def start_tournament_engine():
    try:
        with closing(db_connect()) as connection:
            rows = connection.execute("""
                SELECT id, nombre, robot, peso, cumple_dimensiones, tipo_rc,
                       interruptor_visible, sin_elementos_fijacion, sensores_tapados
                FROM participantes
            """).fetchall()
        participants = []
        for row in rows:
            checks = [row[key] for key in (
                "cumple_dimensiones", "tipo_rc", "interruptor_visible",
                "sin_elementos_fijacion", "sensores_tapados"
            )]
            if (float(row["peso"] or 0) > 0 and float(row["peso"] or 0) <= 500
                    and all(bool(value) for value in checks)):
                participants.append({"id": row["id"], "pilot": row["nombre"], "robot": row["robot"]})
        if len(participants) < 2:
            return jsonify({"error": "Se necesitan al menos dos participantes válidos (peso hasta 500 g y requisitos completos)."}), 400
        random.shuffle(participants)
        state_data = tournament_engine.start_tournament(participants)
        encoded = json.dumps(state_data, ensure_ascii=False, separators=(",", ":"))
        with closing(db_connect()) as connection, connection:
            connection.execute(
                "UPDATE torneo_debug SET iniciado=1, estado_json=? WHERE id=1",
                (encoded,)
            )
        return jsonify({"started": True, "state": state_data})
    except (OSError, sqlite3.Error, ValueError) as error:
        return jsonify({"error": f"No se pudo iniciar la rutina Python del torneo: {error}"}), 503


@app.post("/api/tournament/engine/result")
def record_tournament_engine_result():
    payload = request.get_json(silent=True) or {}
    winner_slot_id = payload.get("winner_slot_id")
    if not isinstance(winner_slot_id, str) or not winner_slot_id:
        return jsonify({"error": "Falta el identificador del ganador seleccionado."}), 400
    try:
        with closing(db_connect()) as connection:
            row = connection.execute(
                "SELECT iniciado, estado_json FROM torneo_debug WHERE id=1"
            ).fetchone()
        if not row or not row["iniciado"] or not row["estado_json"]:
            return jsonify({"error": "No hay un torneo Python iniciado."}), 409
        state_data = json.loads(row["estado_json"])
        if state_data.get("engineVersion") != 1:
            return jsonify({"error": "El torneo guardado pertenece a la rutina anterior. Reinicia la prueba para usar combates.py."}), 409
        state_data = tournament_engine.record_winner(state_data, winner_slot_id)
        encoded = json.dumps(state_data, ensure_ascii=False, separators=(",", ":"))
        with closing(db_connect()) as connection, connection:
            connection.execute(
                "UPDATE torneo_debug SET iniciado=?, estado_json=? WHERE id=1",
                (1 if state_data.get("started") and state_data.get("phase") != "finished" else 0, encoded)
            )
        return jsonify({"started": bool(state_data.get("started")), "state": state_data})
    except (OSError, sqlite3.Error, json.JSONDecodeError, ValueError, KeyError) as error:
        return jsonify({"error": f"No se pudo registrar el resultado en combates.py: {error}"}), 400


@app.get("/api/tournament/debug-state")
def get_tournament_debug_state():
    try:
        with closing(db_connect()) as connection:
            row = connection.execute(
                "SELECT iniciado, estado_json FROM torneo_debug WHERE id=1"
            ).fetchone()
        state_data = json.loads(row["estado_json"]) if row and row["estado_json"] else None
        return jsonify({"started": bool(row and row["iniciado"]), "state": state_data})
    except (OSError, sqlite3.Error, json.JSONDecodeError) as error:
        return jsonify({"error": f"No se pudo consultar el estado del torneo: {error}"}), 503


@app.post("/api/tournament/debug-state")
def save_tournament_debug_state():
    payload = request.get_json(silent=True) or {}
    try:
        with closing(db_connect()) as connection, connection:
            if payload.get("reset"):
                connection.execute(
                    "UPDATE torneo_debug SET iniciado=0, estado_json='' WHERE id=1"
                )
                return jsonify({"started": False, "state": None})
            state_data = payload.get("state")
            if not isinstance(state_data, dict):
                return jsonify({"error": "El estado del torneo no es válido."}), 400
            encoded = json.dumps(state_data, ensure_ascii=False, separators=(",", ":"))
            started = 1 if state_data.get("started") else 0
            connection.execute(
                "UPDATE torneo_debug SET iniciado=?, estado_json=? WHERE id=1",
                (started, encoded)
            )
        return jsonify({"started": bool(started), "state": state_data})
    except (OSError, sqlite3.Error) as error:
        return jsonify({"error": f"No se pudo guardar el estado del torneo: {error}"}), 503


@app.get("/api/matches")
def list_matches():
    try:
        with closing(db_connect()) as connection, connection:
            rows = connection.execute("""
                SELECT e.id, e.etapa, COALESCE(g.nombre, '') AS grupo, e.ronda,
                       p1.nombre AS piloto1, p1.robot AS robot1, p2.nombre AS piloto2, p2.robot AS robot2,
                       e.estado, COALESCE(e.tiempo, '0:00:00') AS tiempo,
                       COALESCE(e.ataques1, 0) AS ataques1, COALESCE(e.ataques2, 0) AS ataques2,
                       e.ganador, COALESCE(e.criterio_ganador, '') AS motivo
                FROM enfrentamientos e LEFT JOIN grupos g ON g.id=e.grupo_id
                LEFT JOIN participantes p1 ON p1.id=e.participante1 LEFT JOIN participantes p2 ON p2.id=e.participante2
                ORDER BY e.id
            """).fetchall()
        return jsonify([dict(row) for row in rows])
    except (OSError, sqlite3.Error) as error:
        return jsonify({"error": f"No se pudieron consultar las batallas: {error}"}), 503


def load_tournament_state():
    with closing(db_connect()) as connection:
        row = connection.execute(
            "SELECT iniciado, estado_json FROM torneo_debug WHERE id=1"
        ).fetchone()
    data = json.loads(row["estado_json"]) if row and row["estado_json"] else None
    return bool(row and row["iniciado"]), data

def save_tournament_state(data, started=True):
    encoded = json.dumps(data, ensure_ascii=False, separators=(",", ":"))
    with closing(db_connect()) as connection, connection:
        connection.execute(
            "UPDATE torneo_debug SET iniciado=?, estado_json=? WHERE id=1",
            (1 if started else 0, encoded)
        )

def tournament_next_match(data):
    if not isinstance(data, dict):
        return None
    matches = data.get("matches", {})
    for round_ids in data.get("calendar", []):
        for match_id in round_ids:
            match = matches.get(match_id)
            if not match or match.get("done") or match.get("omit"):
                continue
            slots = match.get("slots", [])
            if len(slots) == 2 and all(v is not None and v != 0 for v in slots):
                return match
    return None

def tournament_place(data, match_id, slot, value):
    matches = data.get("matches", {})
    match = matches.get(match_id)
    if not match or match.get("done"):
        return
    match["slots"][slot] = value
    tournament_auto_bye(data, match)

def tournament_auto_bye(data, match):
    if match.get("done") or any(v is None for v in match.get("slots", [])):
        return
    slots = match["slots"]
    if 0 not in slots:
        return
    winner = slots[1] if slots[0] == 0 else slots[0]
    tournament_close_match(data, match, winner, 0)

def tournament_close_match(data, match, winner, loser):
    if match.get("done"):
        return
    match["done"] = True
    match["winner"] = winner
    match["loser"] = loser
    if match.get("bracket") == "F":
        if match.get("id") == "FINAL":
            if winner == match["slots"][0]:
                data["matches"]["RESET"]["done"] = True
                data["matches"]["RESET"]["omit"] = True
                data["champion"] = winner
            else:
                reset = data["matches"]["RESET"]
                reset["slots"] = list(match["slots"])
        else:
            data["champion"] = winner
    else:
        win_dest = match.get("winDest")
        lose_dest = match.get("loseDest")
        if win_dest:
            tournament_place(data, win_dest["match"], win_dest["slot"], winner)
        if lose_dest and loser not in (None, 0):
            tournament_place(data, lose_dest["match"], lose_dest["slot"], loser)

@app.get("/api/tournament/current")
def get_current_tournament_match():
    try:
        started, data = load_tournament_state()
        if not started or not data:
            return jsonify({"started": False, "match": None, "error": "Todavía no hay una llave generada."})
        match = tournament_next_match(data)
        players = {str(p["id"]): p for p in data.get("players", [])}
        if match:
            slots = match.get("slots", [])
            return jsonify({
                "started": True, "match": match,
                "robot1": players.get(str(slots[0]), {}).get("robot", ""),
                "pilot1": players.get(str(slots[0]), {}).get("pilot", ""),
                "robot2": players.get(str(slots[1]), {}).get("robot", ""),
                "pilot2": players.get(str(slots[1]), {}).get("pilot", ""),
                "players": data.get("players", [])
            })
        return jsonify({"started": True, "match": None, "champion": data.get("champion"),
                        "players": data.get("players", [])})
    except (OSError, sqlite3.Error, json.JSONDecodeError) as error:
        return jsonify({"error": f"No se pudo leer la llave de competencia: {error}"}), 503

@app.post("/api/tournament/record-battle")
def record_tournament_battle():
    payload = request.get_json(silent=True) or {}
    winner_id = payload.get("winner_id")
    match_id = payload.get("match_id")
    try:
        started, data = load_tournament_state()
        if not started or not data:
            return jsonify({"error": "No hay una competencia activa."}), 409
        match = tournament_next_match(data)
        if not match or match.get("id") != match_id:
            return jsonify({"error": "El combate ya no corresponde al enfrentamiento actual. Actualiza la pantalla."}), 409
        if winner_id not in match.get("slots", []):
            return jsonify({"error": "El ganador debe ser uno de los dos robots del combate."}), 400
        loser_id = match["slots"][1] if match["slots"][0] == winner_id else match["slots"][0]
        wins = match.setdefault("seriesWins", {})
        key = str(winner_id)
        wins[key] = int(wins.get(key, 0)) + 1
        match.setdefault("battles", []).append({
            "winner": winner_id, "loser": loser_id,
            "reason": str(payload.get("reason", ""))[:80],
            "attacks1": max(0, int(payload.get("attacks1", 0))),
            "attacks2": max(0, int(payload.get("attacks2", 0))),
            "elapsed_seconds": max(0, float(payload.get("elapsed_seconds", 0)))
        })
        if wins[key] >= 2:
            tournament_close_match(data, match, winner_id, loser_id)
        save_tournament_state(data, started=not bool(data.get("champion")))
        with lock:
            state["winner"] = ""
            state["reason"] = ""
        return jsonify({"saved": True, "seriesWins": wins, "matchFinished": bool(match.get("done")),
                        "state": data, "next": tournament_next_match(data)})
    except (OSError, sqlite3.Error, json.JSONDecodeError, TypeError, ValueError, KeyError) as error:
        return jsonify({"error": f"No se pudo guardar el resultado de la batalla: {error}"}), 400

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

@app.post("/api/continue")
def continue_battle():
    with lock:
        if state["phase"] != "paused":
            return jsonify({"error": "Solo se puede continuar una batalla pausada"}), 409
        state["started_at"] = time.time() - max(0, float(state["elapsed_seconds"]))
        state["phase"] = "running"
        state["status"] = "BATALLA EN CURSO"
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

def configure_hotspot_firewall():
    """Configura el acceso del hotspot desde el EXE portátil, elevando solo el auxiliar."""
    if not getattr(sys, "frozen", False):
        return

    helper = Path(getattr(sys, "_MEIPASS", BASE_DIR)) / "permitir_hotspot_exe.ps1"
    if not helper.is_file():
        print("AVISO: no se encontró el auxiliar de firewall; el dashboard local seguirá disponible.")
        return

    exe_path = Path(sys.executable).resolve()
    helper_args = [
        "-NoProfile", "-ExecutionPolicy", "Bypass",
        "-File", str(helper), "-ExePath", str(exe_path)
    ]

    def run_helper(check_only=False):
        args = ["powershell.exe", *helper_args]
        if check_only:
            args.append("-CheckOnly")
        return subprocess.run(args, capture_output=True, text=True, timeout=45)

    try:
        # Si el permiso ya existe y no hay reglas de bloqueo, no se pide UAC.
        check = run_helper(check_only=True)
        if check.returncode == 0:
            print("Acceso del hotspot ya configurado.")
            return

        print("Se necesita configurar el acceso del hotspot.")
        print("Acepta la solicitud de Windows para permitir conexiones desde los celulares.")

        # Si el EXE ya se abrió como administrador, ejecuta el auxiliar directamente.
        # De lo contrario, solicita elevación únicamente para configurar el firewall.
        is_admin = False
        try:
            identity_check = subprocess.run(
                ["powershell.exe", "-NoProfile", "-Command",
                 "$p=New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent()); "
                 "if($p.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)){exit 0}else{exit 1}"],
                capture_output=True, timeout=15
            )
            is_admin = identity_check.returncode == 0
        except (OSError, subprocess.SubprocessError):
            pass

        if is_admin:
            result = run_helper()
        else:
            # Pasar los argumentos como una sola cadena con rutas entre comillas.
            helper_ps = str(helper).replace("'", "''")
            exe_ps = str(exe_path).replace("'", "''")
            ps_command = (
                f"$script = '{helper_ps}'; "
                f"$exe = '{exe_ps}'; "
                "$arg = '-NoProfile -ExecutionPolicy Bypass -File \"' + $script + '\" -ExePath \"' + $exe + '\"'; "
                "$p = Start-Process -FilePath 'powershell.exe' -Verb RunAs -Wait -PassThru -ArgumentList $arg; "
                "exit $p.ExitCode"
            )
            result = subprocess.run(
                ["powershell.exe", "-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", ps_command],
                capture_output=True, text=True, timeout=180
            )

        # Verificar de nuevo desde el proceso normal: evita asumir que UAC funcionó.
        verify = run_helper(check_only=True)
        if verify.returncode == 0:
            print("Acceso del hotspot configurado correctamente.")
        else:
            print("AVISO: Windows no confirmó la configuración del firewall.")
            print("El dashboard local seguirá iniciando, pero el celular podría no conectarse.")
            for output in (result.stdout, result.stderr, verify.stdout, verify.stderr):
                if output and output.strip():
                    print(output.strip())
    except (OSError, subprocess.SubprocessError) as error:
        print(f"AVISO: no se pudo comprobar/configurar el firewall: {error}")
        print("El dashboard local seguirá iniciando.")

def is_running_as_admin():
    if os.name != "nt":
        return True
    try:
        check = subprocess.run(
            ["powershell.exe", "-NoProfile", "-Command",
             "$p=New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent()); "
             "if($p.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)){exit 0}else{exit 1}"],
            capture_output=True, timeout=15
        )
        return check.returncode == 0
    except (OSError, subprocess.SubprocessError):
        return False


def relaunch_as_admin_if_needed():
    """Relanza el EXE elevado; el proceso original termina para evitar dos servidores."""
    if not getattr(sys, "frozen", False) or os.name != "nt" or is_running_as_admin():
        return
    import ctypes
    result = ctypes.windll.shell32.ShellExecuteW(
        None, "runas", str(Path(sys.executable).resolve()), None,
        str(Path(sys.executable).resolve().parent), 1
    )
    if result <= 32:
        print("No se concedieron permisos de administrador. MiniSumos RC no se iniciará.")
        input("Presiona Enter para cerrar...")
        raise SystemExit(1)
    raise SystemExit(0)


def run_startup_helper():
    """Ejecuta el BAT en modo de configuración, espera a que termine y luego continúa."""
    if not getattr(sys, "frozen", False):
        return
    exe_dir = Path(sys.executable).resolve().parent
    launcher = exe_dir / "iniciar_ejecutable.bat"
    if not launcher.is_file():
        print("AVISO: no se encontró iniciar_ejecutable.bat; se continuará sin ese paso.")
        return
    print("Preparando acceso del hotspot...")
    try:
        result = subprocess.run(
            ["cmd.exe", "/d", "/c", str(launcher), "--config-only"],
            cwd=str(exe_dir), timeout=180
        )
        if result.returncode == 0:
            print("Configuración inicial finalizada.")
        else:
            print(f"AVISO: el auxiliar terminó con código {result.returncode}.")
            print("Se intentará iniciar el dashboard de todas formas.")
    except (OSError, subprocess.SubprocessError) as error:
        print(f"AVISO: no se pudo ejecutar iniciar_ejecutable.bat: {error}")


def windows_firewall_allows_exe():
    """Comprueba si Windows ya tiene una regla Allow de entrada para este EXE."""
    if os.name != "nt" or not getattr(sys, "frozen", False):
        return True

    exe_path = str(Path(sys.executable).resolve()).replace("'", "''")
    command = (
        f"$exe = '{exe_path}'; "
        "$rules = Get-NetFirewallRule -PolicyStore ActiveStore -Direction Inbound "
        "-Enabled True -Action Allow -ErrorAction SilentlyContinue; "
        "foreach ($rule in $rules) { "
        "$app = $rule | Get-NetFirewallApplicationFilter -ErrorAction SilentlyContinue; "
        "if ($app.Program -and $app.Program -ieq $exe) { exit 0 } "
        "}; exit 1"
    )
    try:
        check = subprocess.run(
            ["powershell.exe", "-NoProfile", "-ExecutionPolicy", "Bypass",
             "-Command", command],
            capture_output=True, timeout=8
        )
        return check.returncode == 0
    except (OSError, subprocess.SubprocessError):
        return False


def open_local_dashboard_when_ready():
    """Espera a Flask y, en Windows, al permiso de firewall antes de abrir Chrome."""
    url = "http://127.0.0.1:8000/api/state"
    deadline = time.monotonic() + 60
    while time.monotonic() < deadline:
        try:
            with urllib.request.urlopen(url, timeout=1.5) as response:
                if response.status == 200:
                    break
        except (OSError, urllib.error.URLError):
            time.sleep(0.4)
    else:
        print("El servidor no respondió en 60 segundos; abre manualmente http://127.0.0.1:8000")
        return

    # Windows no expone una señal directa al pulsar «Permitir acceso».
    # La regla Allow creada por ese diálogo sirve como confirmación indirecta.
    if os.name == "nt" and getattr(sys, "frozen", False):
        print("Esperando a que Windows registre el permiso de acceso a redes...")
        firewall_deadline = time.monotonic() + 300
        while time.monotonic() < firewall_deadline:
            if windows_firewall_allows_exe():
                webbrowser.open("http://127.0.0.1:8000")
                return
            time.sleep(1.0)
        print("No se detectó el permiso de firewall. Cuando lo autorices, abre http://127.0.0.1:8000 manualmente.")
        return

    webbrowser.open("http://127.0.0.1:8000")


if __name__ == "__main__":
    # El EXE solicita elevación antes de tocar el firewall o iniciar el servidor.
    relaunch_as_admin_if_needed()
    # Ejecuta el lanzador auxiliar y espera a que se cierre antes de continuar.
    run_startup_helper()
    print("MiniSumos RC local:     http://127.0.0.1:8000")
    print("MiniSumos RC hotspot:   consulta la IP de la interfaz hotspot en Windows.")
    if getattr(sys, "frozen", False):
        Thread(target=open_local_dashboard_when_ready, daemon=True).start()
    app.run(host="0.0.0.0", port=8000, debug=False, threaded=True)
