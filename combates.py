"""Motor de doble eliminación para el dashboard. Sin promedios ni reordenación por índices."""
from copy import deepcopy


def calcular_llave(n):
    capacidad = 1
    while capacidad < n:
        capacidad *= 2
    byes = capacidad - n
    return capacidad.bit_length() - 1, byes, (n - byes) // 2


def cruces_extremos(n, cantidad):
    cruces, izquierda, derecha = [], 1, n
    while len(cruces) < cantidad and izquierda < derecha:
        cruces.append((izquierda, izquierda + 1, "izquierda"))
        izquierda += 2
        if len(cruces) >= cantidad or izquierda >= derecha:
            break
        cruces.append((derecha - 1, derecha, "derecha"))
        derecha -= 2
    return cruces


def programar_ronda_2(tabla):
    prioritarios, restantes = [], []
    for i in range(0, len(tabla) - 1, 2):
        a, b = tabla[i], tabla[i + 1]
        item = (a["id"], b["id"], "izquierda")
        (prioritarios if not a.get("ha_combatido") and not b.get("ha_combatido") else restantes).append(item)
    return prioritarios + restantes


def insertar_lossers_patron(lossers, nuevo, numero):
    if numero == 1:
        lossers.insert(0, nuevo)
    elif numero == 2:
        lossers.append(nuevo)
    else:
        lossers.insert((numero - 1) // 2, nuevo)


def orden_rivales_lossers(lossers, cantidad):
    orden, izquierda, derecha = [], 0, len(lossers) - 1
    while izquierda <= derecha and len(orden) < cantidad:
        orden.append(lossers[derecha])
        if len(orden) >= cantidad:
            break
        if izquierda != derecha:
            orden.append(lossers[izquierda])
        izquierda += 1
        derecha -= 1
    return orden[:cantidad]


def _replace_pair(order, a_id, b_id, new_id, keep_side):
    ia, ib = order.index(a_id), order.index(b_id)
    keep_id = a_id if keep_side == "izquierda" else b_id
    keep_index = order.index(keep_id)
    remove_index = ib if keep_index == ia else ia
    order[keep_index] = new_id
    order.pop(remove_index)


def _make_slot(state, number, branch, robot_id, fought=True, status="pendiente"):
    slot_id = f"{branch}:{number}"
    state["slots"][slot_id] = {
        "id": slot_id, "label": f"#{number}", "robot_id": robot_id,
        "ha_combatido": fought, "estado_lossers": status, "battle_number": number,
    }
    return slot_id


def _slot(state, slot_id):
    return state["slots"][slot_id]


def _prepare_stage(state, stage, pairs, bye_ids=None):
    state["stage"] = stage
    state["queue"] = [{"a": a, "b": b, "keep_side": side, "stage": stage} for a, b, side in pairs]
    state["round"] = {
        "type": "W" if stage in ("initialW1", "initialW2", "mainW") else "L",
        "number": state["wRound"] if stage in ("initialW1", "initialW2", "mainW") else state["lRound"],
        "pairs": [[m["a"], m["b"]] for m in state["queue"]],
        "position": 0, "byeIds": bye_ids or [],
        "initial": stage in ("initialW1", "initialW2", "initialL1", "initialL2"),
    }
    state["current"] = deepcopy(state["queue"][0]) if state["queue"] else None
    if state["current"] is None:
        _resolve_next(state)


def _extreme_pairs(ids):
    _, _, count = calcular_llave(len(ids))
    snapshot = list(ids)
    return [(snapshot[a - 1], snapshot[b - 1], side) for a, b, side in cruces_extremos(len(snapshot), count)]


def _unpaired_ids(ids, pairs):
    paired = {sid for a, b, _ in pairs for sid in (a, b)}
    return [sid for sid in ids if sid not in paired]


def _begin_winners1(state):
    state["wRound"] = 1
    state["initialByeCount"] = calcular_llave(len(state["winners"]))[1]
    pairs = _extreme_pairs(state["winners"])
    _prepare_stage(state, "initialW1", pairs, _unpaired_ids(state["winners"], pairs))


def _begin_winners2(state):
    state["wRound"] = 2
    pairs = programar_ronda_2([_slot(state, sid) for sid in state["winners"]])
    _prepare_stage(state, "initialW2", pairs)


def _begin_losers1(state):
    state["lRound"] = 1
    for sid in state["losers"]:
        _slot(state, sid)["ha_combatido"] = False
    pairs = _extreme_pairs(state["losers"])
    _prepare_stage(state, "initialL1", pairs, _unpaired_ids(state["losers"], pairs))


def _begin_losers2(state):
    state["lRound"] = 2
    pairs = programar_ronda_2([_slot(state, sid) for sid in state["losers"]])
    _prepare_stage(state, "initialL2", pairs)


def _begin_winners_round(state):
    state["wRound"] += 1
    snapshot = list(state["winners"])
    pairs = [(snapshot[i], snapshot[i + 1], "izquierda") for i in range(0, len(snapshot) - 1, 2)]
    state["rivals"] = orden_rivales_lossers(state["losers"], len(pairs))
    state["stageResults"] = []
    _prepare_stage(state, "mainW", pairs)


def _begin_internal_losers(state):
    state["lRound"] += 1
    pairs = _extreme_pairs(state["losers"])
    _prepare_stage(state, "internalL", pairs, _unpaired_ids(state["losers"], pairs))


def _begin_final(state):
    if len(state["winners"]) == 1 and len(state["losers"]) == 1:
        state["phase"], state["finalNo"], state["stage"] = "final", 1, "final"
        state["current"] = {"a": state["winners"][0], "b": state["losers"][0], "stage": "final", "keep_side": "izquierda"}
        state["queue"] = []
    elif len(state["winners"]) == 1:
        state["champion"] = _slot(state, state["winners"][0])["robot_id"]
        state["phase"], state["stage"], state["current"] = "finished", "done", None
    else:
        _resolve_next(state)


def _resolve_next(state):
    if state.get("phase") == "finished":
        return
    if state["queue"]:
        state["current"] = deepcopy(state["queue"][0])
        return
    stage = state["stage"]
    if stage == "initialW1":
        _begin_winners2(state) if state["initialByeCount"] > 0 else _begin_losers1(state)
    elif stage == "initialW2":
        _begin_losers1(state)
    elif stage == "initialL1":
        if state["initialByeCount"] > 0:
            _begin_losers2(state)
        else:
            for sid in state["losers"]:
                _slot(state, sid)["estado_lossers"] = "pendiente"
            state["stage"] = "main"
            _resolve_next(state)
    elif stage == "initialL2":
        for sid in state["losers"]:
            _slot(state, sid)["estado_lossers"] = "pendiente"
        state["stage"] = "main"
        _resolve_next(state)
    elif stage in ("mainW", "internalL", "main"):
        if len(state["winners"]) > 1:
            if len(state["losers"]) > len(state["winners"]) // 2:
                _begin_internal_losers(state)
            else:
                _begin_winners_round(state)
        elif len(state["losers"]) > 1:
            _begin_internal_losers(state)
        else:
            _begin_final(state)


def start_tournament(participants):
    if len(participants) < 2:
        raise ValueError("Se necesitan al menos dos participantes válidos.")
    players, slots, winners = [], {}, []
    for index, participant in enumerate(participants, 1):
        pid = int(participant["id"])
        players.append({"id": pid, "pilot": participant["pilot"], "robot": participant["robot"], "index": index})
        slot_id = f"P:{pid}"
        slots[slot_id] = {"id": slot_id, "label": str(index), "robot_id": pid, "ha_combatido": False, "estado_lossers": "pendiente", "battle_number": None}
        winners.append(slot_id)
    state = {
        "engineVersion": 1, "started": True, "phase": "running", "players": players, "slots": slots,
        "winners": winners, "losers": [], "eliminated": [], "stage": "ready", "queue": [],
        "current": None, "round": None, "wRound": 0, "lRound": 0, "initialByeCount": 0,
        "rivals": [], "matches": 0, "history": [], "logs": [], "champion": None, "finalNo": 0,
    }
    _, byes, fights = calcular_llave(len(players))
    state["logs"] += [
        {"message": "Orden aleatorio fijado al inicio; índices enteros 1..n. Sin promedios.", "kind": "system"},
        {"message": f"Participantes: {len(players)} · Byes iniciales: {byes} · Combates iniciales: {fights}", "kind": "system"},
    ]
    _begin_winners1(state)
    return state


def record_winner(state, winner_slot_id):
    if not state or not state.get("started") or not state.get("current"):
        raise ValueError("No hay un combate pendiente.")
    current = state["current"]
    a_id, b_id = current["a"], current["b"]
    if winner_slot_id not in (a_id, b_id):
        raise ValueError("El ganador seleccionado no pertenece al combate actual.")
    a, b = _slot(state, a_id), _slot(state, b_id)
    winner, loser = (a, b) if winner_slot_id == a_id else (b, a)
    stage = current["stage"]
    number = state["matches"] + 1
    robot = lambda rid: next(p["robot"] for p in state["players"] if p["id"] == rid)
    state["matches"] = number
    state["history"].append({"round": "Gran final" if stage in ("final", "finalReset") else stage,
        "a": robot(a["robot_id"]), "b": robot(b["robot_id"]), "winner": robot(winner["robot_id"]), "total": number})
    state["logs"].append({"message": f"Batalla #{number}: {robot(a['robot_id'])} vs {robot(b['robot_id'])} · Ganó {robot(winner['robot_id'])}", "kind": "system"})

    if stage in ("final", "finalReset"):
        if stage == "final" and winner["robot_id"] == _slot(state, state["winners"][0])["robot_id"]:
            state["champion"] = winner["robot_id"]
            state["winners"], state["losers"] = [state["winners"][0]], []
            state["eliminated"].append(loser["robot_id"])
            state["phase"], state["stage"], state["current"] = "finished", "done", None
            state["logs"].append({"message": "Campeón: " + robot(winner["robot_id"]), "kind": "system"})
            return state
        if stage == "final":
            state["phase"], state["finalNo"], state["stage"] = "final", 2, "finalReset"
            state["winners"] = []
            state["losers"] = [current["b"], current["a"]]
            state["current"] = {"a": current["b"], "b": current["a"], "stage": "finalReset", "keep_side": "izquierda"}
            state["logs"].append({"message": "Gana Lossers la primera final; se jugará la revancha.", "kind": "system"})
            return state
        state["champion"] = winner["robot_id"]
        state["eliminated"].append(loser["robot_id"])
        final_slot = _make_slot(state, number, "L", winner["robot_id"], True)
        state["winners"], state["losers"] = [], [final_slot]
        state["phase"], state["stage"], state["current"] = "finished", "done", None
        state["logs"].append({"message": "Campeón definitivo: " + robot(winner["robot_id"]), "kind": "system"})
        return state

    if stage in ("initialW1", "initialW2", "mainW"):
        wslot = _make_slot(state, number, "W", winner["robot_id"], True)
        lslot = _make_slot(state, number, "L", loser["robot_id"], True, "caido" if stage == "mainW" else "pendiente")
        _replace_pair(state["winners"], a_id, b_id, wslot, current.get("keep_side", "izquierda"))
        if stage in ("initialW1", "initialW2"):
            insertar_lossers_patron(state["losers"], lslot, number)
        else:
            rivals = state.get("rivals", [])
            idx = len(state.get("stageResults", []))
            rival_id = rivals[idx] if idx < len(rivals) else None
            if rival_id in state["losers"]:
                state["losers"].insert(state["losers"].index(rival_id) + 1, lslot)
            else:
                state["losers"].append(lslot)
            state.setdefault("stageResults", []).append(number)
    elif stage in ("initialL1", "initialL2", "internalL"):
        lslot = _make_slot(state, number, "L", winner["robot_id"], True)
        _replace_pair(state["losers"], a_id, b_id, lslot, current.get("keep_side", "izquierda"))
        state["eliminated"].append(loser["robot_id"])
        if stage in ("initialL1", "initialL2"):
            a["ha_combatido"] = b["ha_combatido"] = True
    else:
        raise ValueError("Etapa desconocida: " + str(stage))

    if stage in ("initialW1", "initialW2"):
        a["ha_combatido"] = b["ha_combatido"] = True
    state["queue"].pop(0)
    if state.get("round"):
        state["round"]["position"] += 1
    state["current"] = deepcopy(state["queue"][0]) if state["queue"] else None
    if state["current"] is None:
        if stage == "mainW":
            state.pop("stageResults", None)
        _resolve_next(state)
    return state


def reset_tournament():
    return {"started": False, "phase": "ready", "players": [], "slots": {}, "winners": [], "losers": [],
        "eliminated": [], "stage": "ready", "queue": [], "current": None, "round": None,
        "wRound": 0, "lRound": 0, "matches": 0, "history": [], "logs": [], "champion": None, "finalNo": 0}
