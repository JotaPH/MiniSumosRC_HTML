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
    "#tournamentDebug .td-bracket-divider{height:1px;background:#31516c;margin:16px 0}",
    "#tournamentDebug .td-bracket{display:flex;align-items:stretch;gap:22px;overflow-x:auto;padding:12px 4px 18px;min-height:170px}",
    "#tournamentDebug .td-bracket-round{display:flex;flex-direction:column;justify-content:space-around;gap:18px;min-width:145px;flex:1;position:relative}",
    "#tournamentDebug .td-bracket-round:not(:last-child) .td-bracket-match:after{content:'';position:absolute;left:100%;top:50%;width:23px;border-top:1px solid #6c8aa5}",
    "#tournamentDebug .td-bracket-round:not(:first-child) .td-bracket-match:before{content:'';position:absolute;right:100%;top:0;height:100%;width:10px;border-left:1px solid #6c8aa5}",
    "#tournamentDebug .td-bracket-round-title{text-align:center;color:#70eaff;font-size:12px;font-weight:800;letter-spacing:.6px;margin-bottom:3px}",
    "#tournamentDebug .td-bracket-match{position:relative;background:#0a1b2d;border:1px solid #31516c;border-radius:8px;padding:6px 7px 6px 25px;min-width:0}",
    "#tournamentDebug .td-bracket-match-id{position:absolute;left:6px;top:50%;font-size:10px;color:#ffe66d;font-weight:800;transform:translateY(-50%)}",
    "#tournamentDebug .td-bracket-slot{font-size:12px;line-height:1.35;padding:7px 4px;color:#8fa4b8;overflow-wrap:anywhere;border-bottom:1px solid #20384d;min-height:27px}",
    "#tournamentDebug .td-bracket-slot:last-child{border-bottom:0}",
    "#tournamentDebug .td-bracket-slot.filled{color:#fff;font-weight:700}",
    "#tournamentDebug .td-bracket-winner{color:#8ff0ae!important;background:#123b31;font-weight:900;border-radius:4px;padding-left:7px;",
    "#tournamentDebug .td-bracket-empty{color:#92a7bb;text-align:center;padding:28px 10px;font-size:13px}",
    "#tournamentDebug .td-bracket-grid{display:grid;grid-auto-flow:column;grid-auto-columns:minmax(105px,1fr);gap:0;overflow-x:auto;padding:12px 4px 18px;align-items:stretch;min-width:0}",
    "#tournamentDebug .td-grid-round{display:grid;position:relative;min-width:105px}",
    "#tournamentDebug .td-grid-title{grid-row:1;position:sticky;top:0;text-align:center;color:#70eaff;font-size:12px;font-weight:800;padding:5px 0 10px;background:#071323;z-index:2}",
    "#tournamentDebug .td-grid-match{align-self:center;display:flex;flex-direction:column;justify-content:center;position:relative;margin:0 5px;min-width:0;border:1px solid #31516c;border-radius:5px;background:#0a1b2d;z-index:1}",
    "#tournamentDebug .td-grid-match:after{content:'';position:absolute;left:100%;top:50%;width:6px;border-top:1px solid #6c8aa5}",
    "#tournamentDebug .td-grid-slot{font-size:11px;line-height:1.25;padding:5px 3px;min-height:22px;overflow-wrap:anywhere;border-bottom:1px solid #20384d;color:#8fa4b8}",
    "#tournamentDebug .td-grid-slot:last-child{border-bottom:0}",
    "#tournamentDebug .td-grid-slot.filled{color:#fff;font-weight:700}",
    "#tournamentDebug .td-grid-winner{background:#123b31;color:#8ff0ae!important;font-weight:900}",
    "#tournamentDebug .td-bracket-sheet-wrap{width:100%;overflow-x:auto;padding:12px 4px 18px;background:#050e19;border:1px solid #31516c;border-radius:10px}",
    "#tournamentDebug table.td-bracket-sheet{border-collapse:separate;border-spacing:0;table-layout:fixed;width:100%;min-width:700px;background:#081727;border:1px solid #42627e}",
    "#tournamentDebug .td-bracket-sheet th{height:38px;text-align:center;color:#70eaff;font-size:13px;font-weight:900;border:1px solid #42627e;background:#102940;position:sticky;top:0}",
    "#tournamentDebug .td-bracket-sheet td{height:36px;min-width:120px;width:1%;padding:4px;border:1px solid #29465f;vertical-align:middle}",
    "#tournamentDebug .td-bracket-sheet td:empty{background:#081727}",
    "#tournamentDebug .td-sheet-match{border:2px solid #547894;border-radius:7px;background:#0b2034;box-shadow:0 2px 5px #0006;overflow:hidden;min-width:0;width:100%}",
    "#tournamentDebug .td-sheet-match .td-grid-slot{min-height:29px;padding:6px 7px;font-size:12px;border-bottom:1px solid #36536c;white-space:normal}",
    "#tournamentDebug .td-sheet-match .td-grid-slot:last-child{border-bottom:0}#tournamentDebug .td-bracket-sheet .td-grid-slot.empty{color:#617c94;background:#091827}#tournamentDebug .td-bracket-sheet .td-grid-slot.td-grid-winner{background:#124832;color:#9bffc0!important;border-left:4px solid #35d477;padding-left:5px}"
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
      '<div class="td-tables"><div class="td-panel td-table"><div class="td-head"><h3>GANADORES</h3><span class="td-badge" id="tdWCount">0</span></div><div class="td-entry td-entry-header"><strong>ID BATALLA</strong><strong>ROBOT / PILOTO</strong></div><div id="tdWinners"></div><div class="td-bracket-divider"></div><div class="td-head"><h3>LLAVE DE GANADORES</h3></div><div id="tdWinnersBracket"></div></div><div class="td-panel td-table"><div class="td-head"><h3>PERDEDORES</h3><span class="td-badge" id="tdLCount">0</span></div><div class="td-entry td-entry-header"><strong>ID BATALLA</strong><strong>ROBOT / PILOTO</strong></div><div id="tdLosers"></div><div class="td-bracket-divider"></div><div class="td-head"><h3>LLAVE DE PERDEDORES</h3></div><div id="tdLosersBracket"></div></div></div>' +
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
  function bracketRound(title, matches, roundNo, isFirstRound) {
    return '<div class="td-bracket-round"><div class="td-bracket-round-title">' + esc(title) + '</div>' +
      (matches.length ? matches.map((m, i) =>
        '<div class="td-bracket-match ' + (isFirstRound ? 'td-bracket-first' : '') + '">' +
        '<div class="td-bracket-match-id">' + (i + 1) + '</div>' +
        '<div class="td-bracket-slot ' + (m[0] ? 'filled' : 'empty') + '">' + (m[0] ? esc(m[0]) : '&nbsp;') + '</div>' +
        '<div class="td-bracket-slot ' + (m[1] ? 'filled' : 'empty') + '">' + (m[1] ? esc(m[1]) : '&nbsp;') + '</div></div>'
      ).join('') : '<div class="td-empty">Sin combates previstos</div>') + '</div>';
  }

  function bracketMarkup(branch) {
    const players = (tournament && tournament.players || []).slice().sort((a,b)=>a.index-b.index);
    if (!tournament || players.length < 2) {
      return '<div class="td-bracket-empty">Se necesitan al menos dos participantes válidos.</div>';
    }
    if (branch !== 'W') {
      // La llave de Perdedores se deja intacta en esta corrección.
      const n = players.length;
      const capacity = 2 ** Math.ceil(Math.log2(n));
      const byes = capacity - n;
      const firstWCount = (n - byes) / 2;
      const totalInitialW = firstWCount + (byes > 0 ? Math.floor((n - firstWCount) / 2) : 0);
      const loserCount = totalInitialW;
      const lCapacity = 2 ** Math.ceil(Math.log2(Math.max(1, loserCount)));
      const lByes = lCapacity - loserCount;
      const lFirstCount = (loserCount - lByes) / 2;
      const rounds = [];
      let advancing = loserCount;
      let roundNo = 1;
      while (advancing > 1) {
        let matches;
        if (roundNo === 1) matches = lFirstCount;
        else if (roundNo === 2 && byes > 0) matches = Math.floor((loserCount - lFirstCount) / 2);
        else matches = Math.floor(advancing / 2);
        rounds.push(bracketRound('RONDA ' + roundNo, Array.from({length:matches},()=>['','']), roundNo, roundNo === 1));
        advancing = matches + (advancing % 2);
        roundNo++;
      }
      return '<div class="td-bracket" aria-label="Llave de perdedores">' + rounds.join('') + '</div>';
    }

    const n = players.length;
    const capacity = 2 ** Math.ceil(Math.log2(n));
    const roundCount = Math.log2(capacity);
    const rows = capacity * 2 - 1;
    const firstWCount = (n - (capacity - n)) / 2;
    const stages = [];
    const node = (name, winner = false, extra = '') =>
      '<div class="td-grid-slot ' + (name ? 'filled ' : 'empty ') + (winner ? 'td-grid-winner ' : '') + extra + '">' +
      (name ? esc(name) + (winner ? ' ✓' : '') : '&nbsp;') + '</div>';
    const getName = id => {
      const sl = slot(id);
      const p = sl && player(sl.robot_id);
      return p ? p.robot : '';
    };
    const historyFor = stage => (tournament.history || []).filter(h => h.round === stage);
    const matchFor = (aId, bId, history, used) => {
      const a = getName(aId), b = getName(bId);
      const idx = history.findIndex((h, i) => !used.has(i) &&
        ((h.a === a && h.b === b) || (h.a === b && h.b === a)));
      if (idx >= 0) used.add(idx);
      const hit = idx >= 0 ? history[idx] : null;
      return {a, b, winner:hit ? hit.winner : ''};
    };
    const extremePairsForPreview = (count, amount) => {
      const out=[]; let left=0,right=count-1;
      while(out.length<amount && left<right) {
        out.push([left,left+1,'izquierda']); left+=2;
        if(out.length>=amount || left>=right) break;
        out.push([right-1,right,'derecha']); right-=2;
      }
      return out;
    };
    const firstPairs = extremePairsForPreview(n, firstWCount);
    const initialW1History = historyFor('initialW1');
    const r1 = Array.from({length:capacity/2},()=>({a:'',b:'',winner:''}));
    const usedR1 = new Set();
    firstPairs.forEach((pair,i) => {
      const a = players[pair[0]].robot, b = players[pair[1]].robot;
      const idx = initialW1History.findIndex((h,j) => !usedR1.has(j) &&
        ((h.a === a && h.b === b) || (h.a === b && h.b === a)));
      if(idx>=0) usedR1.add(idx);
      const hit = idx>=0 ? initialW1History[idx] : null;
      const target = pair[2] === 'derecha' ? capacity/2 - 1 - Math.floor(i/2) : Math.floor(i/2);
      r1[Math.max(0,Math.min(r1.length-1,target))] = {a,b,winner:hit ? hit.winner : ''};
    });
    stages.push({title:'R1',matches:r1});

    // Las rondas futuras no deben listar el arreglo winners como si fueran combates.
    // Solo mostramos participantes de enfrentamientos reales ya programados o jugados.
    const hasByes = capacity - n > 0;
    const scheduledPairs = stage => {
      const done = historyFor(stage).map(h => ({a:h.a || '', b:h.b || '', winner:h.winner || ''}));
      const pending = [];
      if (tournament.current && tournament.current.stage === stage) pending.push(tournament.current);
      (tournament.queue || []).forEach(m => {
        if (m.stage === stage && !pending.some(q => q.a === m.a && q.b === m.b)) pending.push(m);
      });
      return done.concat(pending.map(m => ({
        a: getName(m.a), b: getName(m.b), winner: ''
      })));
    };
    const slotRobotId = id => {
      const sl = slot(id);
      return sl ? sl.robot_id : null;
    };
    const robotName = id => {
      const sl = slot(id);
      const p = sl && player(sl.robot_id);
      return p ? p.robot : '';
    };
    const currentStage = tournament.stage || '';
    const r2Count = capacity / 4;
    const r2 = Array.from({length:r2Count},()=>({a:'',b:'',winner:''}));
    const r2Stage = hasByes ? 'initialW2' : 'mainW';
    const liveR2 = scheduledPairs(r2Stage);
    liveR2.slice(0,r2Count).forEach((m,i)=>{r2[i]=m;});
    // Mientras R1 siga en curso, los huecos de R2 permanecen vacíos;
    // no se dibujan los participantes iniciales como si ya fueran cruces confirmados.
    stages.push({title:'R2',matches:r2});

    let stageNo=3;
    let matchesInRound=capacity/8;
    let mainOffset=0;
    while(matchesInRound>=1 && stageNo<=roundCount) {
      const live = scheduledPairs('mainW');
      const roundRows=Array.from({length:matchesInRound},(_,i)=>{
        const h=live[mainOffset+i];
        return h ? h : {a:'',b:'',winner:''};
      });
      stages.push({title:'R'+stageNo,matches:roundRows});
      mainOffset+=matchesInRound;
      matchesInRound=Math.floor(matchesInRound/2);
      stageNo++;
    }

    // Tabla literal: columnas por ronda y filas fijas, como una hoja de cálculo.
    const tableRows = Array.from({length:capacity * 2 - 1},()=>Array(stages.length).fill(''));
    stages.forEach((stage, r) => {
      const block = 2 ** (r + 1);
      stage.matches.forEach((m, i) => {
        const startRow = i * block + Math.floor(block / 2);
        const winnerA = !!m.winner && m.winner === m.a;
        const winnerB = !!m.winner && m.winner === m.b;
        const cell = '<div class="td-sheet-match">' +
          node(m.a, winnerA) + node(m.b, winnerB) + '</div>';
        if (startRow >= 0 && startRow < tableRows.length) tableRows[startRow][r] = cell;
      });
    });
    const head = '<thead><tr>' + stages.map(stage =>
      '<th scope="col">' + stage.title + '</th>').join('') + '</tr></thead>';
    const body = '<tbody>' + tableRows.map(row =>
      '<tr>' + row.map(cell => '<td>' + (cell || '&nbsp;') + '</td>').join('') + '</tr>'
    ).join('') + '</tbody>';
    return '<div class="td-bracket-sheet-wrap"><table class="td-bracket-sheet" aria-label="Llave de ganadores">' + head + body + '</table></div>';
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
    const renderList = ids => (ids || []).map(slot).filter(Boolean).map(s => {
      const p = player(s.robot_id);
      return '<div class="td-entry"><span class="td-index">' + esc(s.label) + '</span><strong>' +
        esc(p ? p.robot : "—") + '</strong><span class="td-muted">' + esc(p ? p.pilot : "") + '</span></div>';
    }).join("") || '<div class="td-empty">Vacío</div>';
    $("tdWCount").textContent = (tournament.winners || []).length;
    $("tdLCount").textContent = (tournament.losers || []).length;
    $("tdWinners").innerHTML = renderList(tournament.winners);
    $("tdLosers").innerHTML = renderList(tournament.losers);
    $("tdWinnersBracket").innerHTML = bracketMarkup("W");
    $("tdLosersBracket").innerHTML = bracketMarkup("L");
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
      if (!data.state || data.state.engineVersion !== 1) {
        if (tournament.started) {
          await refreshParticipants();
          tournament = freshState();
          tournament.logs = [{message:"El torneo se reinició por un cambio en los participantes.",kind:"system"}];
          syncManagementState();
          render();
        }
        return;
      }
      if (JSON.stringify(data.state) !== JSON.stringify(tournament)) {
        tournament = data.state;
        render();
      }
    } catch (_) {}
  }, 1500);
})();