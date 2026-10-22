(() => {
  const $ = id => document.getElementById(id);
  const esc = value => String(value == null ? "" : value).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const fmt = value => Number(value).toFixed(3).replace(".", ",");
  let participants = [];
  let tournament = null;
  let busy = false;
  let initialized = false;

  const css = document.createElement("style");
  css.textContent = [
    "#bracketsView > .mgmt-stats,#bracketsView > .mgmt-brackets,#bracketsView > .mgmt-grid,#bracketsView > .mgmt-panel{display:none!important}",
    "#tournamentDebug{margin:16px 0 22px;color:#eaf4ff;font-family:Arial,Helvetica,sans-serif}",
    "#tournamentDebug .td-panel{background:#071323ed;border:1px solid #31516c;border-radius:14px;padding:16px;margin-bottom:14px;box-shadow:0 8px 26px #0004}",
    "#tournamentDebug .td-head{display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:12px}",
    "#tournamentDebug h2,#tournamentDebug h3{margin:0;color:#70eaff;letter-spacing:.5px}",
    "#tournamentDebug .td-muted{color:#a8bbcf;font-size:13px}",
    "#tournamentDebug .td-stats{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin-bottom:14px}",
    "#tournamentDebug .td-stat{background:#0c2035;border:1px solid #294862;border-radius:10px;padding:12px}",
    "#tournamentDebug .td-stat small{display:block;color:#a8bbcf;margin-bottom:5px}",
    "#tournamentDebug .td-stat strong{font-size:24px;color:#fff}",
    "#tournamentDebug .td-current{display:grid;grid-template-columns:1fr auto 1fr;gap:12px;align-items:center;text-align:center}",
    "#tournamentDebug .td-robot{background:#0a1b2d;border:1px solid #31516c;border-radius:12px;padding:15px 8px;min-width:0}",
    "#tournamentDebug .td-robot strong{display:block;font-size:clamp(18px,2.2vw,28px);overflow-wrap:anywhere}",
    "#tournamentDebug .td-robot small{display:block;color:#a8bbcf;margin-top:6px}",
    "#tournamentDebug .td-vs{font-weight:900;color:#ffe66d;font-size:20px}",
    "#tournamentDebug .td-actions{display:flex;gap:10px;justify-content:center;flex-wrap:wrap;margin-top:14px}",
    "#tournamentDebug button{border:0;border-radius:8px;padding:11px 18px;font-weight:800;cursor:pointer}",
    "#tournamentDebug button:disabled{opacity:.45;cursor:not-allowed}",
    "#tdWin1{background:#16854f;color:#fff}#tdWin2{background:#2469bc;color:#fff}#tdStart{background:#ffe66d;color:#18202a}#tdReset{background:#25394d;color:#fff;border:1px solid #526c82}",
    "#tournamentDebug .td-tables{display:grid;grid-template-columns:1fr 1fr;gap:14px}",
    "#tournamentDebug .td-table h3{margin-bottom:10px}",
    "#tournamentDebug .td-entry{display:flex;align-items:center;gap:10px;padding:9px 10px;border-radius:8px;background:#0a1b2d;margin:6px 0}",
    "#tournamentDebug .td-index{min-width:68px;font:700 13px ui-monospace,monospace;color:#ffe66d}",
    "#tournamentDebug .td-entry strong{flex:1;overflow-wrap:anywhere}",
    "#tournamentDebug .td-empty{color:#92a7bb;padding:12px 0}",
    "#tournamentDebug .td-history{max-height:220px;overflow:auto}",
    "#tournamentDebug .td-history-row{display:grid;grid-template-columns:44px 1fr auto;gap:10px;border-bottom:1px solid #20384d;padding:8px 0;font-size:13px}",
    "#tournamentDebug .td-note{color:#a8bbcf;font-size:13px;line-height:1.45;margin:10px 0 0}",
    "#tournamentDebug .td-badge{display:inline-block;border-radius:99px;padding:5px 9px;background:#17344b;color:#70eaff;font-size:12px;font-weight:800}",
    "#tournamentDebug .td-console{background:#03080d;border:1px solid #263b4c;border-radius:10px;padding:12px;max-height:340px;overflow:auto;color:#b7f7c5;font:12px/1.55 ui-monospace,SFMono-Regular,Consolas,monospace;white-space:pre-wrap;overflow-wrap:anywhere}#tournamentDebug .td-console-line{min-height:1em}#tournamentDebug .td-console-line.system{color:#70eaff}#tournamentDebug .td-console-line.error{color:#ff8e8e}",
    "@media(max-width:700px){#tournamentDebug .td-stats{grid-template-columns:repeat(2,minmax(0,1fr))}#tournamentDebug .td-tables{grid-template-columns:1fr}#tournamentDebug .td-current{gap:5px}#tournamentDebug .td-robot{padding:12px 4px}#tournamentDebug .td-actions button{width:100%}}"
  ].join("\n");
  document.head.appendChild(css);

  function ensurePanel() {
    const view = $("bracketsView");
    if (!view || $("tournamentDebug")) return;
    const panel = document.createElement("section");
    panel.id = "tournamentDebug";
    panel.innerHTML =
      '<div class="td-panel"><div class="td-head"><div><h2>PRUEBA DE TORNEO · DOBLE ELIMINACIÓN</h2><div class="td-muted">Rutina Python: los resultados avanzan por ID de robot y número de batalla.</div></div><span class="td-badge" id="tdStatus">SIN INICIAR</span></div>' +
      '<div class="td-stats"><div class="td-stat"><small>Ronda actual</small><strong id="tdRound">—</strong></div><div class="td-stat"><small>Combates acumulados</small><strong id="tdCount">0</strong></div><div class="td-stat"><small>Participantes válidos</small><strong id="tdValid">0</strong></div><div class="td-stat"><small>Byes de esta ronda</small><strong id="tdBye">—</strong></div></div>' +
      '<div class="td-panel"><div class="td-head"><h3>ENFRENTAMIENTO ACTUAL</h3><span class="td-muted" id="tdDirection">Esperando inicio</span></div><div id="tdMatch"><div class="td-empty">Pulsa “Iniciar torneo” para preparar la primera ronda.</div></div><div class="td-actions"><button id="tdWin1" disabled>Gana R1</button><button id="tdWin2" disabled>Gana R2</button></div></div>' +
      '<div class="td-tables"><div class="td-panel td-table"><div class="td-head"><h3>WINNERS</h3><span class="td-badge" id="tdWCount">0</span></div><div id="tdWinners"></div></div><div class="td-panel td-table"><div class="td-head"><h3>LOSSERS</h3><span class="td-badge" id="tdLCount">0</span></div><div id="tdLosers"></div></div></div>' +
      '<div class="td-panel"><div class="td-head"><h3>REGISTRO DE PRUEBA</h3><span class="td-muted">Historial de resultados</span></div><div id="tdHistory" class="td-history"><div class="td-empty">Todavía no hay combates registrados.</div></div><div class="td-actions"><button id="tdStart">Iniciar torneo</button><button id="tdReset">Reiniciar prueba</button></div><p class="td-note">Al iniciar se activa la bandera de torneo iniciado. Agregar, editar o eliminar participantes deberá pedir confirmación para reiniciar la competencia. Estos botones registran el ganador de cada combate en la rutina Python; no inician el ESP32.</p></div>' +
      '<div class="td-panel"><div class="td-head"><h3>CONSOLA DE SIMULACIÓN</h3><span class="td-muted">Mensajes de etapas, cruces y resultados</span></div><div id="tdConsole" class="td-console" role="log" aria-live="polite"><div class="td-console-line system">La salida de la simulación aparecerá aquí.</div></div></div></div>';
    const description = view.querySelector(".mgmt-description");
    if (description) description.insertAdjacentElement("afterend", panel);
    else view.prepend(panel);
    $("tdStart").addEventListener("click", startTournament);
    $("tdReset").addEventListener("click", resetTournament);
    $("tdWin1").addEventListener("click", () => recordWinner(1));
    $("tdWin2").addEventListener("click", () => recordWinner(2));
  }

  function valid(p) {
    return Number(p.weight) > 0 && Number(p.weight) <= 500 && Array.isArray(p.checks) && p.checks.every(Boolean);
  }
  function player(id) { return tournament && (tournament.players || []).find(p => Number(p.id) === Number(id)); }
  function slot(id) { return tournament && tournament.slots ? tournament.slots[id] : null; }
  function slotPlayer(id) { const s = slot(id); return s ? player(s.robot_id) : null; }
  function fmtIndex(n) { return n == null || !Number.isFinite(Number(n)) ? "—" : String(n); }
  function syncManagementState() {
    try {
      if (typeof mgmt !== "undefined") {
        mgmt.started = !!(tournament && tournament.started && tournament.phase !== "finished");
        mgmt.history = tournament ? tournament.history : [];
        mgmt.current = tournament && tournament.current ? {a:slotPlayer(tournament.current.a)?.id,b:slotPlayer(tournament.current.b)?.id} : null;
      }
    } catch (_) {}
  }

  function logLine(message, kind = "") {
    if (!tournament) return;
    if (!Array.isArray(tournament.logs)) tournament.logs = [];
    tournament.logs.push({message:String(message),kind});
  }
  function separator(title) {
    logLine("=".repeat(55), "system");
    logLine(title, "system");
    logLine("=".repeat(55), "system");
  }
  function logTables() {
    logLine("");
    logLine("WINNERS");
    logLine("-".repeat(55));
    const ws = tournament.winners.map(player).filter(Boolean).sort((a,b)=>a.index-b.index);
    if (!ws.length) logLine("Vacío");
    ws.forEach(p=>logLine(fmtIndex(p.index) + " | " + p.robot + " | " + p.pilot));
    logLine("");
    logLine("LOSSERS");
    logLine("-".repeat(55));
    const ls = tournament.losers.map(player).filter(Boolean).sort((a,b)=>a.index-b.index);
    if (!ls.length) logLine("Vacío");
    ls.forEach(p=>logLine(fmtIndex(p.index) + " | " + p.robot + " | " + p.pilot));
    logLine("-".repeat(55));
    logLine("Combates acumulados del torneo: " + tournament.matches, "system");
  }
  function render() {
    ensurePanel();
    if (!tournament || !$("tournamentDebug")) return;
    syncManagementState();
    const round = tournament.round, current = tournament.current;
    $("tdStatus").textContent = tournament.phase === "finished" ? "TORNEO FINALIZADO" : tournament.started ? "TORNEO INICIADO" : "SIN INICIAR";
    const stage = tournament.stage || "ready";
    const labels = {
      initialW1:"Winners · Ronda inicial 1", initialW2:"Winners · Ronda inicial 2",
      initialL1:"Lossers · Ronda inicial 1", initialL2:"Lossers · Ronda inicial 2",
      mainW:"Winners", internalL:"Lossers · etapa interna", final:"Gran final",
      finalReset:"Revancha final", done:"Finalizado", ready:"—", main:"Preparando siguiente etapa"
    };
    $("tdRound").textContent = labels[stage] || stage;
    $("tdCount").textContent = tournament.matches || 0;
    $("tdValid").textContent = (tournament.players || []).length;
    $("tdBye").textContent = round && round.byeIds && round.byeIds.length
      ? round.byeIds.map(id => slot(id)?.label || id).join(", ") : "—";
    $("tdDirection").textContent = "Rutina ejecutada en Python · sin promedios";
    const aSlot = current && slot(current.a), bSlot = current && slot(current.b);
    const a = current && slotPlayer(current.a), b = current && slotPlayer(current.b);
    if (a && b) {
      $("tdMatch").innerHTML = '<div class="td-current"><div class="td-robot"><strong>R1 · ' + esc(a.robot) +
        '</strong><small>' + esc(a.pilot) + ' · casilla ' + esc(aSlot.label) +
        '</small></div><div class="td-vs">VS</div><div class="td-robot"><strong>R2 · ' + esc(b.robot) +
        '</strong><small>' + esc(b.pilot) + ' · casilla ' + esc(bSlot.label) + '</small></div></div>';
    } else if (tournament.champion) {
      const champ = player(tournament.champion);
      $("tdMatch").innerHTML = '<div class="td-empty">🏆 Campeón: <strong>' + esc(champ ? champ.robot : "—") + '</strong></div>';
    } else if (tournament.phase === "ready") {
      $("tdMatch").innerHTML = '<div class="td-empty">Pulsa “Iniciar torneo” para cargar los participantes y comenzar la rutina Python.</div>';
    } else {
      $("tdMatch").innerHTML = '<div class="td-empty">No hay enfrentamiento preparado.</div>';
    }
    $("tdWin1").textContent = a ? "Gana " + a.robot : "Gana R1";
    $("tdWin2").textContent = b ? "Gana " + b.robot : "Gana R2";
    $("tdWin1").disabled = !tournament.started || !current || busy || tournament.phase === "finished";
    $("tdWin2").disabled = !tournament.started || !current || busy || tournament.phase === "finished";
    $("tdStart").textContent = tournament.started ? "Torneo iniciado" : "Iniciar torneo";
    $("tdStart").disabled = !!tournament.started && tournament.phase !== "finished";
    const renderList = ids => (ids || []).map(slot).filter(Boolean).map(s => {
      const p = player(s.robot_id);
      return '<div class="td-entry"><span class="td-index">' + esc(s.label) + '</span><strong>' +
        esc(p ? p.robot : "—") + '</strong><span class="td-muted">' + esc(p ? p.pilot : "") + '</span></div>';
    }).join("") || '<div class="td-empty">Vacío</div>';
    $("tdWCount").textContent = (tournament.winners || []).length;
    $("tdLCount").textContent = (tournament.losers || []).length;
    $("tdWinners").innerHTML = renderList(tournament.winners);
    $("tdLosers").innerHTML = renderList(tournament.losers);
    $("tdHistory").innerHTML = (tournament.history || []).slice().reverse().map((h,i) =>
      '<div class="td-history-row"><strong>' + esc(h.total) + '</strong><span>' + esc(h.round) + ' · ' +
      esc(h.a) + ' vs ' + esc(h.b) + '<br><span class="td-muted">Ganó ' + esc(h.winner) +
      '</span></span><strong>' + esc(h.total) + '</strong></div>'
    ).join("") || '<div class="td-empty">Todavía no hay combates registrados.</div>';
    const consoleBox = $("tdConsole");
    if (consoleBox) {
      const lines = (tournament.logs || []).slice(-500);
      consoleBox.innerHTML = lines.map(line => '<div class="td-console-line ' + esc(line.kind || "") + '">' +
        esc(line.message) + '</div>').join("") || '<div class="td-console-line system">La salida de la rutina Python aparecerá aquí.</div>';
      consoleBox.scrollTop = consoleBox.scrollHeight;
    }
  }

  async function refreshParticipants() {
    const response = await fetch("/api/participants");
    if (!response.ok) throw new Error("No se pudieron consultar los participantes.");
    participants = (await response.json()).filter(valid).sort((a,b)=>a.id-b.id);
  }

  function freshState() {
    return {
      engineVersion:1, started:false, phase:"ready", players:participants.map(p=>({
        id:p.id,pilot:p.pilot,robot:p.robot,index:null
      })), slots:{}, winners:[], losers:[], eliminated:[], round:null,current:null,
      wRound:0,lRound:0,stage:"ready",queue:[],matches:0,history:[],logs:[],
      champion:null,finalNo:0
    };
  }

  async function loadState() {
    const response = await fetch("/api/tournament/debug-state");
    if (!response.ok) throw new Error("No se pudo consultar el estado del torneo.");
    const data = await response.json();
    tournament = data.state;
    if (!tournament || tournament.engineVersion !== 1) {
      await fetch("/api/tournament/debug-state", {
        method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({reset:true})
      });
      await refreshParticipants();
      tournament = freshState();
      tournament.logs = [{message:"La rutina anterior fue descartada. Inicia una prueba nueva para usar combates.py.",kind:"system"}];
    }
    render();
  }

  async function startTournament() {
    if (busy || (tournament && tournament.started && tournament.phase !== "finished")) return;
    busy = true;
    try {
      const response = await fetch("/api/tournament/engine/start", {method:"POST"});
      const data = await response.json().catch(()=>({}));
      if (!response.ok) throw new Error(data.error || "No se pudo iniciar la rutina Python.");
      tournament = data.state;
      render();
    } catch (error) { alert(error.message); }
    finally { busy = false; render(); }
  }

  window.refreshTournamentAfterParticipantChange = async function () {
    try {
      const response = await fetch("/api/tournament/debug-state", {
        method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({reset:true})
      });
      if (!response.ok) throw new Error("No se pudo reiniciar el estado de las tablas del torneo.");
      await refreshParticipants();
      tournament = freshState();
      tournament.logs = [{message:"Tablas reiniciadas automáticamente por un cambio en participantes.",kind:"system"}];
      syncManagementState();
      render();
    } catch (error) {
      console.error(error);
    }
  };

  async function resetTournament() {
    if (busy) return;
    if (tournament && tournament.started && !confirm("¿Reiniciar la prueba? Se borrarán los resultados y se desactivará la bandera de torneo iniciado.")) return;
    busy = true;
    try {
      const response = await fetch("/api/tournament/debug-state", {
        method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({reset:true})
      });
      const data = await response.json().catch(()=>({}));
      if (!response.ok) throw new Error(data.error || "No se pudo reiniciar la prueba.");
      await refreshParticipants();
      tournament = freshState();
      tournament.logs = [{message:"Prueba reiniciada. Esperando inicio de combates.py.",kind:"system"}];
      syncManagementState();
      render();
    } catch (error) { alert(error.message); }
    finally { busy = false; render(); }
  }

  async function recordWinner(side) {
    if (busy || !tournament || !tournament.current) return;
    busy = true;
    try {
      const winnerSlotId = side === 1 ? tournament.current.a : tournament.current.b;
      const response = await fetch("/api/tournament/engine/result", {
        method:"POST", headers:{"Content-Type":"application/json"},
        body:JSON.stringify({winner_slot_id:winnerSlotId})
      });
      const data = await response.json().catch(()=>({}));
      if (!response.ok) throw new Error(data.error || "No se pudo registrar el ganador en combates.py.");
      tournament = data.state;
      render();
    } catch (error) { alert(error.message); }
    finally { busy = false; render(); }
  }

    async function init() {
    if (initialized) return;
    initialized = true;
    ensurePanel();
    try { await refreshParticipants(); await loadState(); }
    catch (error) { if ($("tdMatch")) $("tdMatch").textContent = error.message; }
  }
  document.addEventListener("DOMContentLoaded", init);
  if (document.readyState !== "loading") init();
  window.setInterval(async () => {
    if (!tournament || !tournament.started) return;
    try {
      const response = await fetch("/api/tournament/debug-state");
      if (!response.ok) return;
      const data = await response.json();
      if ((!data.state || data.state.engineVersion !== 1) && tournament.started) {
        await refreshParticipants();
        tournament = freshState();
        tournament.logs = [{message:"El torneo se reinició por un cambio en los participantes.",kind:"system"}];
        syncManagementState();
        render();
      }
    } catch (_) {}
  }, 1500);
})();