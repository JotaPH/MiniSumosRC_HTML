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
    "#tournamentDebug .td-entry{display:grid;grid-template-columns:88px minmax(0,1fr);align-items:center;gap:3px 10px;padding:10px;border-radius:8px;background:#0a1b2d;margin:6px 0;text-align:center}",
    "#tournamentDebug .td-index{grid-column:1;grid-row:1 / span 2;min-width:0;text-align:center;font:700 13px ui-monospace,monospace;color:#ffe66d}",
    "#tournamentDebug .td-entry strong{grid-column:2;display:block;font-size:20px;line-height:1.2;overflow-wrap:anywhere;text-align:center}",
    "#tournamentDebug .td-entry .td-muted{grid-column:2;display:block;text-align:center;font-size:13px}",
    "#tournamentDebug .td-entry-header{background:transparent;border-bottom:1px solid #31516c;border-radius:0;padding:5px 10px 9px;margin-top:0}",
    "#tournamentDebug .td-entry-header strong:first-child{grid-column:1;grid-row:1;font-size:12px;color:#a8bbcf;text-align:center}",
    "#tournamentDebug .td-entry-header strong:last-child{grid-column:2;grid-row:1;font-size:12px;color:#a8bbcf;text-align:center}",
    "#tournamentDebug .td-bracket{display:flex;align-items:stretch;gap:16px;overflow-x:auto;padding:10px 2px 16px;min-height:170px}",
    "#tournamentDebug .td-bracket-round{display:flex;flex-direction:column;justify-content:space-around;gap:12px;min-width:178px;flex:1;position:relative}",
    "#tournamentDebug .td-bracket-round:not(:last-child):after{content:'';position:absolute;right:-9px;top:28px;bottom:28px;border-right:1px solid #31516c}",
    "#tournamentDebug .td-bracket-round-title{text-align:center;color:#70eaff;font-size:12px;font-weight:800;letter-spacing:.6px;margin-bottom:3px}",
    "#tournamentDebug .td-bracket-match{position:relative;background:#0a1b2d;border:1px solid #31516c;border-radius:9px;padding:7px 8px 7px 28px;min-width:0}",
    "#tournamentDebug .td-bracket-match-id{position:absolute;left:7px;top:50%;font-size:10px;color:#ffe66d;font-weight:800;writing-mode:vertical-rl;transform:translateY(-50%) rotate(180deg)}",
    "#tournamentDebug .td-bracket-slot{font-size:12px;line-height:1.35;padding:6px 5px;color:#8fa4b8;overflow-wrap:anywhere;border-bottom:1px solid #20384d;min-height:28px}",
    "#tournamentDebug .td-bracket-slot:last-child{border-bottom:0}",
    "#tournamentDebug .td-bracket-slot.filled{color:#fff;font-weight:700}",
    "#tournamentDebug .td-bracket-empty{color:#92a7bb;text-align:center;padding:28px 10px;font-size:13px}",
    "#tournamentDebug .td-empty{color:#92a7bb;padding:12px 0}",
    "#tournamentDebug .td-history{max-height:320px;overflow:auto}",
    "#tournamentDebug .td-history-row{display:grid;grid-template-columns:44px minmax(0,1fr) auto;align-items:center;gap:10px;border-bottom:1px solid #20384d;padding:10px 0;font-size:15px}",
    "#tournamentDebug .td-history-number{color:#a8bbcf;text-align:center;font-size:15px}",
    "#tournamentDebug .td-history-round{color:#70eaff;font-size:14px;font-weight:800;margin-bottom:3px}",
    "#tournamentDebug .td-history-robots{font-size:17px;font-weight:800;overflow-wrap:anywhere}",
    "#tournamentDebug .td-history-robots span{color:#a8bbcf;font-size:13px;font-weight:500}",
    "#tournamentDebug .td-history-winner{font-size:15px;margin-top:4px}",
    "#tournamentDebug .td-history-winner strong{font-size:17px;color:#ffe66d}",
    "#tournamentDebug .td-history-score{font-size:17px;white-space:nowrap;color:#fff}",
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
      '<div class="td-panel"><div class="td-head"><div><h2>Estado del torneo</h2></div><span class="td-badge" id="tdStatus">SIN INICIAR</span></div>' +
      '<div class="td-stats"><div class="td-stat"><small>Ronda actual</small><strong id="tdRound">—</strong></div><div class="td-stat"><small>Combates acumulados</small><strong id="tdCount">0</strong></div><div class="td-stat"><small>Participantes válidos</small><strong id="tdValid">0</strong></div><div class="td-stat"><small>Byes de esta ronda</small><strong id="tdBye">—</strong></div></div>' +
      '<div class="td-panel"><div class="td-head"><h3>ENFRENTAMIENTO ACTUAL</h3></div><div id="tdMatch"><div class="td-empty"></div></div><div class="td-actions"><button id="tdWin1" disabled>Gana R1</button><button id="tdWin2" disabled>Gana R2</button></div></div>' +
      '<div class="td-tables"><div class="td-panel td-table"><div class="td-head"><h3>GANADORES</h3><span class="td-badge" id="tdWCount">0</span></div><div class="td-entry td-entry-header"><strong>ID BATALLA</strong><strong>ROBOT / PILOTO</strong></div><div id="tdWinners"></div></div><div class="td-panel td-table"><div class="td-head"><h3>PERDEDORES</h3><span class="td-badge" id="tdLCount">0</span></div><div class="td-entry td-entry-header"><strong>ID BATALLA</strong><strong>ROBOT / PILOTO</strong></div><div id="tdLosers"></div></div></div>' +
      '<div class="td-panel"><div class="td-head"><h3>HISTORIAL DE SERIES</h3></div><div id="tdHistory" class="td-history"><div class="td-empty">Todavía no hay combates registrados.</div></div><div class="td-actions"><button id="tdStart">Iniciar torneo</button><button id="tdReset">Reiniciar prueba</button></div></div></div>';
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
  function bracketRound(title, matches) {
    return '<div class="td-bracket-round"><div class="td-bracket-round-title">' + esc(title) + '</div>' +
      (matches.length ? matches.map((m, i) =>
        '<div class="td-bracket-match"><div class="td-bracket-match-id">B' + (i + 1) + '</div>' +
        '<div class="td-bracket-slot ' + (m[0] ? 'filled' : '') + '">' + esc(m[0] || 'Por definir') + '</div>' +
        '<div class="td-bracket-slot ' + (m[1] ? 'filled' : '') + '">' + esc(m[1] || 'Por definir') + '</div></div>'
      ).join('') : '<div class="td-empty">Sin combates en esta ronda</div>') + '</div>';
  }

  function bracketMarkup(branch) {
    const players = (tournament && tournament.players || []).slice().sort((a,b)=>a.index-b.index);
    if (!tournament || !tournament.started || players.length < 2) {
      return '<div class="td-bracket-empty">Inicia el torneo para calcular las llaves.</div>';
    }
    const n = players.length;
    let capacity = 1;
    while (capacity < n) capacity *= 2;
    const byes = capacity - n;
    const fights = (n - byes) / 2;
    const pairs = [];
    let left = 0, right = n - 1;
    while (pairs.length < fights && left < right) {
      pairs.push([left, left + 1]);
      left += 2;
      if (pairs.length >= fights || left >= right) break;
      pairs.push([right - 1, right]);
      right -= 2;
    }
    const paired = new Set(pairs.flat());
    const names = players.map(p => p.robot);
    const isW = branch === 'W';
    const rounds = [];
    if (isW) {
      rounds.push(bracketRound('RONDA 1', pairs.map(p=>[names[p[0]], names[p[1]]])));
      const afterR1 = [];
      pairs.forEach((p, i) => afterR1.push('Ganador B' + (i + 1)));
      names.forEach((name, i) => { if (!paired.has(i)) afterR1.push(name); });
      if (byes > 0) {
        const r2Pairs = [];
        for (let i=0;i+1<afterR1.length;i+=2) r2Pairs.push([afterR1[i], afterR1[i+1]]);
        rounds.push(bracketRound('RONDA 2', r2Pairs));
      }
      let count = byes > 0 ? Math.ceil(afterR1.length / 2) : fights;
      let roundNo = byes > 0 ? 3 : 2;
      while (count > 1) {
        count = Math.ceil(count / 2);
        rounds.push(bracketRound('RONDA ' + roundNo, Array.from({length:count},()=>['Ganador anterior','Ganador anterior'])));
        roundNo++;
      }
    } else {
      const l1Count = Math.floor(fights / 2);
      const l1Capacity = fights - l1Count;
      const l1Pairs = [];
      let li = 0, ri = fights - 1;
      while (l1Pairs.length < l1Count && li < ri) {
        l1Pairs.push(['Perdedor B' + (l1Pairs.length + 1), 'Perdedor B' + (fights - l1Pairs.length)]);
        li += 2; ri -= 2;
      }
      rounds.push(bracketRound('RONDA 1', l1Pairs));
      let remaining = fights - l1Pairs.length + (byes > 0 ? Math.floor((n - byes) / 2) : 0);
      let roundNo = 2;
      if (byes > 0 && remaining > 1) {
        const l2Matches = Math.floor(remaining / 2);
        rounds.push(bracketRound('RONDA 2', Array.from({length:l2Matches},(_,i)=>['Ganador R1', 'Perdedor W-R2 ' + (i+1)])));
        remaining = remaining - l2Matches;
        roundNo = 3;
      }
      while (remaining > 1) {
        const next = Math.floor(remaining / 2);
        rounds.push(bracketRound('RONDA ' + roundNo, Array.from({length:next},()=>['Ganador anterior','Perdedor de ganadores'])));
        remaining -= next;
        roundNo++;
      }
    }
    return '<div class="td-bracket" aria-label="Llave de ' + (isW ? 'ganadores' : 'perdedores') + '">' + rounds.join('') + '</div>';
  }

  function render() {
    ensurePanel();
    if (!tournament || !$("tournamentDebug")) return;
    syncManagementState();
    const round = tournament.round, current = tournament.current;
    $("tdStatus").textContent = tournament.phase === "finished" ? "TORNEO FINALIZADO" : tournament.started ? "TORNEO INICIADO" : "SIN INICIAR";
    const stage = tournament.stage || "ready";
    const labels = {
      initialW1:"Ganadores · Ronda 1", initialW2:"Ganadores · Ronda 2",
      initialL1:"Perdedores · Ronda 1", initialL2:"Perdedores · Ronda 2",
      mainW:"Ganadores", internalL:"Perdedores · etapa interna", final:"Gran final",
      finalReset:"Revancha final", done:"Finalizado", ready:"—", main:"Preparando siguiente etapa"
    };
    $("tdRound").textContent = labels[stage] || stage;
    $("tdCount").textContent = tournament.matches || 0;
    $("tdValid").textContent = (tournament.players || []).length;
    $("tdBye").textContent = round && round.byeIds && round.byeIds.length
      ? round.byeIds.map(id => slot(id)?.label || id).join(", ") : "—";
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
      $("tdMatch").innerHTML = '<div class="td-empty"></div>';
    } else {
      $("tdMatch").innerHTML = '<div class="td-empty"></div>';
    }
    $("tdWin1").textContent = a ? "Gana " + a.robot : "Gana R1";
    $("tdWin2").textContent = b ? "Gana " + b.robot : "Gana R2";
    $("tdWin1").disabled = !tournament.started || !current || busy || tournament.phase === "finished";
    $("tdWin2").disabled = !tournament.started || !current || busy || tournament.phase === "finished";
    $("tdStart").textContent = tournament.started ? "Torneo iniciado" : "Iniciar torneo";
    $("tdStart").disabled = !!tournament.started && tournament.phase !== "finished";
    $("tdWCount").textContent = (tournament.winners || []).length;
    $("tdLCount").textContent = (tournament.losers || []).length;
    $("tdWinners").innerHTML = bracketMarkup("W");
    $("tdLosers").innerHTML = bracketMarkup("L");
    const historyRows = [];
    let lastStage = null, winnersRound = 0, losersRound = 0;
    (tournament.history || []).forEach(h => {
      const stage = String(h.round || "");
      if (stage !== lastStage) {
        if (["initialW1","initialW2","mainW"].includes(stage)) winnersRound++;
        if (["initialL1","initialL2","internalL","main"].includes(stage)) losersRound++;
        lastStage = stage;
      }
      let roundLabel = stage;
      if (stage === "initialW1") roundLabel = "Ganadores - R1";
      else if (stage === "initialW2") roundLabel = "Ganadores - R2";
      else if (stage === "initialL1") roundLabel = "Perdedores - R1 (Ganadores R1)";
      else if (stage === "initialL2") roundLabel = "Perdedores - R2 (Ganadores R2)";
      else if (stage === "mainW") roundLabel = "Ganadores - R" + Math.max(2, winnersRound);
      else if (stage === "internalL" || stage === "main") roundLabel = "Perdedores - R" + Math.max(1, losersRound);
      else if (stage === "final") roundLabel = "Gran final";
      else if (stage === "finalReset") roundLabel = "Revancha final";
      historyRows.push({h,roundLabel});
    });
    $("tdHistory").innerHTML = historyRows.slice().reverse().map(({h,roundLabel}) =>
      '<div class="td-history-row"><span class="td-history-number">' + esc(h.total) +
      '</span><div class="td-history-details"><div class="td-history-round">' + esc(roundLabel) +
      '</div><div class="td-history-robots">' + esc(h.a) + ' <span>vs</span> ' + esc(h.b) +
      '</div><div class="td-history-winner">Ganó <strong>' + esc(h.winner) +
      '</strong></div></div><strong class="td-history-score">' + esc(h.score || "—") + '</strong></div>'
    ).join("") || '<div class="td-empty">Todavía no hay series registradas.</div>';
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