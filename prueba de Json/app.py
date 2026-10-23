from __future__ import annotations

import json
import os
import sqlite3
import urllib.error
import urllib.request
from datetime import datetime
from pathlib import Path
from threading import Lock
from zoneinfo import ZoneInfo

from flask import Flask, jsonify, render_template, request

BASE_DIR = Path(__file__).resolve().parent
PROJECT_DIR = BASE_DIR.parent
DB_PATH = PROJECT_DIR / "BasesDeDatos" / "competencia.db"
HOST = os.environ.get("JSON_TEST_HOST", "127.0.0.1")
PORT = int(os.environ.get("JSON_TEST_PORT", "8001"))
SOURCE_URL = os.environ.get("MINISUMOS_SOURCE_URL", "http://127.0.0.1:8000")
RECEIVER_URL = f"http://{HOST}:{PORT}/api/receive"

app = Flask(__name__, template_folder=str(BASE_DIR / "templates"))
receive_lock = Lock()
latest_payload = None
update_number = 0


def db_tournament():
    """Lee únicamente la BD de MiniSumosRC_HTML; nunca modifica sus tablas."""
    if not DB_PATH.is_file():
        raise FileNotFoundError(f"No existe la base de datos del proyecto: {DB_PATH}")
    with sqlite3.connect(str(DB_PATH), timeout=5) as connection:
        connection.row_factory = sqlite3.Row
        tables = {row["name"] for row in connection.execute(
            "SELECT name FROM sqlite_master WHERE type='table'"
        )}
        if "torneo_debug" not in tables:
            return False, None
        row = connection.execute(
            "SELECT iniciado, estado_json FROM torneo_debug WHERE id=1"
        ).fetchone()
    if not row or not row["estado_json"]:
        return bool(row and row["iniciado"]), None
    return bool(row["iniciado"]), json.loads(row["estado_json"])


def get_json_url(url, timeout=1.2):
    try:
        req = urllib.request.Request(url, headers={"Accept": "application/json"})
        with urllib.request.urlopen(req, timeout=timeout) as response:
            return json.loads(response.read().decode("utf-8"))
    except (OSError, urllib.error.URLError, json.JSONDecodeError, TimeoutError):
        return None


def name_for(value, players):
    if value is None:
        return None
    if value == 0 or str(value) == "0":
        return None
    player = players.get(str(value))
    if isinstance(player, dict):
        return player.get("robot") or player.get("nombre") or player.get("name") or str(value)
    return str(value)


def pilot_for(value, players):
    player = players.get(str(value)) if value is not None else None
    return (player or {}).get("pilot") or (player or {}).get("nombre") or ""


def match_code(match_id, match):
    return str((match or {}).get("id") or match_id)


def transform_match(match_id, match, players):
    match = match or {}
    slots = list(match.get("slots") or [None, None])
    while len(slots) < 2:
        slots.append(None)
    winner = match.get("winner")
    loser = match.get("loser")
    done = bool(match.get("done"))
    omitted = bool(match.get("omit"))
    is_bye = 0 in slots and done
    if omitted:
        status = "no_aplica"
    elif is_bye:
        status = "bye"
    elif done:
        status = "finalizada"
    elif all(value is not None and value != 0 for value in slots):
        status = "pendiente"
    else:
        status = "esperando_clasificados"

    win_dest = match.get("winDest") or match.get("win_dest")
    lose_dest = match.get("loseDest") or match.get("lose_dest")

    def destination(dest):
        if not dest:
            return None
        target = dest.get("match") or dest.get("enfrentamiento")
        slot = dest.get("slot", dest.get("posicion"))
        if isinstance(slot, int):
            slot = slot + 1 if "slot" in dest else slot
        return {"enfrentamiento": str(target), "posicion": slot}

    battles = match.get("battles") or match.get("historial") or []
    series_wins = match.get("seriesWins") or {}
    values = list(series_wins.values())
    score1 = int(series_wins.get(str(slots[0]), 0) or 0) if slots[0] is not None else 0
    score2 = int(series_wins.get(str(slots[1]), 0) or 0) if slots[1] is not None else 0
    history = []
    for index, battle in enumerate(battles, 1):
        winner_name = name_for(battle.get("winner"), players)
        history.append({
            "numero": index,
            "ganador": winner_name,
            "robot1_ataques": battle.get("attacks1", battle.get("robot1_ataques", 0)),
            "robot2_ataques": battle.get("attacks2", battle.get("robot2_ataques", 0)),
            "tiempo_transcurrido_segundos": battle.get("elapsed_seconds", battle.get("tiempo_transcurrido_segundos", 0)),
            "estado": "finalizada"
        })

    return {
        "codigo": match_code(match_id, match),
        "estado": status,
        "robot1": name_for(slots[0], players),
        "robot2": name_for(slots[1], players),
        "ganador": name_for(winner, players),
        "perdedor": name_for(loser, players),
        "marcador_serie": {"robot1": score1, "robot2": score2},
        "historial": history,
        "destino_ganador": destination(win_dest),
        "destino_perdedor": destination(lose_dest)
    }


def normalize_rounds(state, bracket, players):
    key = "G" if bracket == "ganadores" else "P"
    ids_by_round = state.get(key)
    matches = state.get("matches") or {}
    if not isinstance(ids_by_round, list):
        grouped = {}
        wanted = "G" if bracket == "ganadores" else "P"
        for mid, match in matches.items():
            if match.get("bracket") == wanted:
                grouped.setdefault(int(match.get("round", 0)), []).append(mid)
        ids_by_round = [grouped[k] for k in sorted(grouped)]
    rounds = []
    for index, round_ids in enumerate(ids_by_round or [], 1):
        encounters = []
        for mid in round_ids:
            match = matches.get(str(mid))
            if match is not None:
                encounters.append(transform_match(mid, match, players))
        rounds.append({
            "codigo": f"{'G' if bracket == 'ganadores' else 'P'}{index}",
            "nombre": f"Ronda {index}",
            "enfrentamientos": encounters
        })
    return rounds


def build_payload():
    global update_number
    started, state = db_tournament()
    if not state:
        raise ValueError("No hay una llave guardada en la base de datos. Genera primero la llave en MiniSumosRC_HTML > Tablas.")

    players = {
        str(p.get("id")): p
        for p in state.get("players", [])
        if isinstance(p, dict) and p.get("id") is not None
    }
    matches = state.get("matches") or {}
    calendar = state.get("calendar") or []
    next_match = None
    for round_ids in calendar:
        for mid in round_ids:
            match = matches.get(str(mid))
            if not match or match.get("done") or match.get("omit"):
                continue
            slots = match.get("slots") or []
            if len(slots) == 2 and all(v is not None and v != 0 for v in slots):
                next_match = (str(mid), match)
                break
        if next_match:
            break

    live = get_json_url(f"{SOURCE_URL}/api/state") or {}
    current = get_json_url(f"{SOURCE_URL}/api/tournament/current") or {}
    active_match = next_match
    if current.get("match"):
        current_id = str(current["match"].get("id", ""))
        if current_id in matches:
            active_match = (current_id, matches[current_id])

    def current_robot(slot, fallback_name):
        val = current.get(f"robot{slot}")
        return val or fallback_name

    current_record = None
    if active_match:
        mid, m = active_match
        slots = list(m.get("slots") or [None, None])
        while len(slots) < 2:
            slots.append(None)
        current_record = {
            "codigo": match_code(mid, m),
            "estado": {
                "running": "en_curso", "paused": "en_pausa", "finished": "finalizada",
                "ready": "pendiente"
            }.get(live.get("phase"), "pendiente"),
            "fase": {"G": "ganadores", "P": "perdedores", "F": "gran_final"}.get(m.get("bracket"), "torneo"),
            "robot1": {
                "nombre": current_robot(1, name_for(slots[0], players)),
                "piloto": current.get("pilot1") or pilot_for(slots[0], players),
                "ataques": int(live.get("attacks1") or 0)
            },
            "robot2": {
                "nombre": current_robot(2, name_for(slots[1], players)),
                "piloto": current.get("pilot2") or pilot_for(slots[1], players),
                "ataques": int(live.get("attacks2") or 0)
            },
            "serie": {
                "modalidad": "mejor_de_3",
                "victorias_necesarias": 2,
                "marcador": {
                    "robot1": int((m.get("seriesWins") or {}).get(str(slots[0]), 0) or 0),
                    "robot2": int((m.get("seriesWins") or {}).get(str(slots[1]), 0) or 0)
                },
                "combate_actual": len(m.get("battles") or []) + 1,
                "historial": transform_match(mid, m, players)["historial"]
            }
        }

    elapsed = float(live.get("elapsed_seconds") or 0)
    clock_state = live.get("phase", "ready")
    clock_status = {"running": "corriendo", "paused": "pausado", "finished": "finalizado"}.get(clock_state, "detenido")
    with receive_lock:
        update_number += 1
        number = update_number

    next_record = None
    if next_match:
        mid, m = next_match
        slots = list(m.get("slots") or [None, None])
        next_record = {
            "disponible": True,
            "codigo": match_code(mid, m),
            "fase": {"G": "ganadores", "P": "perdedores", "F": "gran_final"}.get(m.get("bracket"), "torneo"),
            "robot1": name_for(slots[0], players),
            "robot2": name_for(slots[1], players),
            "estado": "pendiente"
        }

    final_match = matches.get("FINAL", {})
    reset_match = matches.get("RESET", {})
    final_status = "finalizada" if final_match.get("done") else "pendiente"
    champion = name_for(state.get("champion"), players)
    final_slots = final_match.get("slots") or [None, None]
    payload = {
        "version_formato": 1,
        "evento": "actualizacion_torneo",
        "actualizacion": {
            "numero": number,
            "generada_en": datetime.now(ZoneInfo("America/Bogota")).isoformat(timespec="milliseconds")
        },
        "torneo": {
            "categoria": state.get("category") or state.get("categoria") or "Sin categoría",
            "estado": "finalizado" if champion else ("en_curso" if started or state.get("started") else "preparado")
        },
        "batalla_actual": current_record,
        "cronometro": {
            "estado": clock_status,
            "tiempo_limite_segundos": 120,
            "tiempo_transcurrido_segundos": round(elapsed, 2),
            "tiempo_restante_segundos": round(max(0, 120 - elapsed), 2),
            "cuenta_regresiva": {"activa": bool(live.get("countdown_active")), "segundos_restantes": int(live.get("countdown_seconds") or 0)}
        },
        "proxima_batalla": next_record or {"disponible": False, "codigo": None, "fase": None, "robot1": None, "robot2": None, "estado": "no_disponible"},
        "llaves": {
            "ganadores": {"rondas": normalize_rounds(state, "ganadores", players)},
            "perdedores": {"rondas": normalize_rounds(state, "perdedores", players)},
            "gran_final": {
                "estado": final_status,
                "robot_ganadores": name_for(final_slots[0], players),
                "robot_perdedores": name_for(final_slots[1], players),
                "requiere_segunda_final": bool(reset_match and not reset_match.get("omit") and reset_match.get("slots") == final_match.get("slots") and final_match.get("done")),
                "segunda_final": {
                    "estado": "finalizada" if reset_match.get("done") else ("pendiente" if not reset_match.get("omit") else "no_aplica"),
                    "ganador": name_for(reset_match.get("winner"), players)
                },
                "campeon": champion
            }
        }
    }
    return payload


@app.get("/")
def home():
    return render_template("index.html", receiver_url=RECEIVER_URL, source_url=SOURCE_URL, db_path=str(DB_PATH))


@app.get("/visor")
def viewer():
    return render_template("index.html", viewer_mode=True, receiver_url=RECEIVER_URL, source_url=SOURCE_URL, db_path=str(DB_PATH))


@app.get("/api/payload")
def payload_preview():
    try:
        return jsonify(build_payload())
    except Exception as error:
        app.logger.exception("No se pudo construir la vista previa del JSON")
        return jsonify({"error": f"{type(error).__name__}: {error}"}), 503


@app.post("/api/send")
def send_payload():
    try:
        payload = build_payload()
        data = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        req = urllib.request.Request(
            RECEIVER_URL, data=data,
            headers={"Content-Type": "application/json; charset=utf-8"},
            method="POST"
        )
        with urllib.request.urlopen(req, timeout=4) as response:
            response_body = response.read().decode("utf-8")
            received = json.loads(response_body)
        return jsonify({"sent": True, "receiver": received, "payload": payload})
    except urllib.error.HTTPError as error:
        detail = error.read().decode("utf-8", errors="replace")[:1000]
        app.logger.exception("El receptor rechazó el POST")
        return jsonify({"sent": False, "error": f"El receptor respondió HTTP {error.code}: {detail}"}), 502
    except Exception as error:
        app.logger.exception("Falló el envío del JSON")
        return jsonify({"sent": False, "error": f"{type(error).__name__}: {error}"}), 503


@app.post("/api/receive")
def receive_payload():
    global latest_payload
    payload = request.get_json(silent=True)
    if not isinstance(payload, dict):
        return jsonify({"received": False, "error": "El cuerpo recibido no es un objeto JSON válido."}), 400
    with receive_lock:
        latest_payload = payload
    return jsonify({
        "received": True,
        "numero_actualizacion": payload.get("actualizacion", {}).get("numero"),
        "keys": list(payload.keys())
    })


@app.get("/api/received")
def received_payload():
    with receive_lock:
        payload = latest_payload
    if payload is None:
        return jsonify({"received": False, "message": "Aún no se ha recibido ningún JSON."}), 404
    return jsonify({"received": True, "payload": payload})


if __name__ == "__main__":
    print("Prueba JSON MiniSumosRC_HTML")
    print(f"Base de datos: {DB_PATH}")
    print(f"Emisor: http://{HOST}:{PORT}/")
    print(f"Visor/deserializador: http://{HOST}:{PORT}/visor")
    app.run(host="0.0.0.0", port=PORT, debug=False, threaded=True)
