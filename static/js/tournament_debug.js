(() => {
  "use strict";
  const $ = id => document.getElementById(id);
  const esc = v => String(v == null ? "" : v).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  let participants = [], tournament = null, autoTimer = null;

  const css = document.createElement("style");
  css.textContent = `
    #bracketsView>.mgmt-stats,#bracketsView>.mgmt-brackets,#bracketsView>.mgmt-grid,#bracketsView>.mgmt-panel{display:none!important}
    #tournamentDebug{margin:16px 0 22px;color:#e2e8f0;font-family:Arial,Helvetica,sans-serif}
    #tournamentDebug .td-panel{background:#0f172a;border:1px solid #334155;border-radius:14px;padding:16px;margin-bottom:14px}
    #tournamentDebug .td-head{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-bottom:12px}
    #tournamentDebug h2,#tournamentDebug h3{margin:0;color:#7dd3fc}
    #tournamentDebug .td-muted{color:#94a3b8;font-size:13px}
    #tournamentDebug .td-toolbar{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
    #tournamentDebug input{width:75px;padding:10px;border-radius:8px;border:1px solid #475569;background:#020617;color:#fff}
    #tournamentDebug button{border:0;border-radius:8px;padding:10px 14px;background:#334155;color:#fff;font-weight:800;cursor:pointer}
    #tournamentDebug button.primary{background:#2563eb}#tournamentDebug button.good{background:#15803d}#tournamentDebug button:disabled{opacity:.4;cursor:not-allowed}
    #tournamentDebug .td-actions{display:flex;gap:8px;justify-content:center;flex-wrap:wrap;margin-top:12px}
    #tournamentDebug .td-status{padding:8px 11px;border-radius:8px;background:#1e293b;color:#cbd5e1;font-size:13px}
    #tournamentDebug .td-scroll{overflow:auto;background:#020617;border:1px solid #334155;border-radius:10px;min-height:360px}
    #tournamentDebug svg{display:block;min-width:100%;background:#0f172a}
    #tournamentDebug .td-legend{display:flex;gap:14px;flex-wrap:wrap;color:#94a3b8;font-size:12px;margin-top:10px}
    #tournamentDebug .td-dot{display:inline-block;width:9px;height:9px;border-radius:3px;margin-right:5px;background:#334155}
    #tournamentDebug .td-dot.active{background:#f59e0b}#tournamentDebug .td-dot.winner{background:#166534}
    #tournamentDebug .td-bottom{display:grid;grid-template-columns:1fr 1fr;gap:14px}
    #tournamentDebug .td-list{display:grid;gap:6px}
    #tournamentDebug .td-row{display:flex;justify-content:space-between;gap:10px;padding:9px 11px;border-radius:7px;background:#1e293b;overflow-wrap:anywhere}
    #tournamentDebug .td-row strong{color:#86efac}
    @media(max-width:650px){#tournamentDebug .td-bottom{grid-template-columns:1fr}#tournamentDebug .td-panel{padding:11px}}
  `;
  document.head.appendChild(css);

  function valid(p){return Number(p.weight)>0&&Number(p.weight)<=500&&Array.isArray(p.checks)&&p.checks.every(Boolean);}
  function name(id){if(id===0)return "BYE";if(id==null)return "Por definir";const p=tournament.players.find(x=>x.id===id);return p?p.robot:"Por definir";}
  function pilot(id){const p=tournament.players.find(x=>x.id===id);return p?p.pilot:"";}
  function power2(n){return 2**Math.ceil(Math.log2(n));}
  function extremes(m){const a=[];let l=0,r=m-1;while(l<=r){a.push(l);if(l!==r)a.push(r);l++;r--;}return a;}
  function firstRound(n){
    const size=power2(n), count=size/2, order=extremes(count), matches=Array.from({length:count},()=>[0,0]), players=Array.from({length:n},(_,i)=>i+1);
    order.forEach((match,pos)=>{if(pos<players.length)matches[match][0]=players[pos];});
    players.slice(count).forEach((id,pos)=>{matches[order[pos]][1]=id;});
    return {size,matches};
  }
  function generate(){
    stopAuto();
    const input=$("tdParticipantCount"), n=Number(input.value);
    if(!Number.isInteger(n)||n<2||n>64){$("tdStatus").textContent="Ingresa un número entre 2 y 64.";return;}
    const seeded=participants.slice(0,n);
    while(seeded.length<n)seeded.push({id:-(seeded.length+1),robot:"Robot "+(seeded.length+1),pilot:"Participante "+(seeded.length+1)});
    tournament={n,players:seeded.map((p,i)=>({...p,index:i+1})),size:power2(n),matches:[],current:null,champion:null,history:[],message:"Llave generada. Los byes avanzan automáticamente."};
    const first=firstRound(n);
    const G=[], P=[];
    const k=Math.log2(first.size);
    for(let r=0;r<k;r++)G.push(Array.from({length:first.size/2**(r+1)},(_,i)=>makeMatch("G"+(r+1)+"-"+(i+1),"G",r,i)));
    for(let r=0;r<Math.max(0,2*(k-1));r++)P.push(Array.from({length:first.size/2**(Math.floor((r+2)/2)+1)},(_,i)=>makeMatch("P"+(r+1)+"-"+(i+1),"P",r,i)));
    const final=makeMatch("FINAL","F",0,0), reset=makeMatch("RESET","F",1,0);
    const all=[...G.flat(),...P.flat(),final,reset];
    tournament.G=G;tournament.P=P;tournament.final=final;tournament.reset=reset;tournament.all=all;
    // Connect each winner/loser to the correct destination in the double-elimination model.
    G.forEach((round,r)=>round.forEach((m,i)=>{
      m.winDest=r<k-1?[G[r+1][Math.floor(i/2)],i%2]:[final,0];
    }));
    if(k===1)G[0][0].loseDest=[final,1];
    else {
      G[0].forEach((m,i)=>m.loseDest=[P[0][Math.floor(i/2)],i%2]);
      for(let j=2;j<=k;j++){const round=P[2*j-3],mCount=G[j-1].length;G[j-1].forEach((m,i)=>m.loseDest=[round[mCount-1-i],1]);}
    }
    P.forEach((round,r)=>round.forEach((m,i)=>{m.winDest=r===P.length-1?[final,1]:r%2===0?[P[r+1][i],0]:[P[r+1][Math.floor(i/2)],i%2];}));
    final.winDest=null;reset.winDest=null;
    first.matches.forEach((pair,i)=>{const m=G[0][i];m.slots=pair.map(v=>v===0?0:(tournament.players[v-1]?.id??null));});
    all.forEach(autoBye);
    tournament.calendar=[G[0]];if(k>=2){tournament.calendar.push(P[0]);for(let j=2;j<=k;j++){tournament.calendar.push(G[j-1],P[2*j-3]);if(2*j-2<P.length)tournament.calendar.push(P[2*j-2]);}}tournament.calendar.push([final],[reset]);
    render();
  }
  function makeMatch(code,type,round,index){return {code,type,round,index,slots:[null,null],winner:null,loser:null,done:false,omit:false,winDest:null,loseDest:null};}
  function place(match,slot,value){match.slots[slot]=value;autoBye(match);}
  function autoBye(m){if(m.done||m.slots.some(v=>v===null))return;if(m.slots.includes(0)){const winner=m.slots[0]===0?m.slots[1]:m.slots[0];closeMatch(m,winner,0);}}
  function closeMatch(m,winner,loser){
    if(m.done)return;m.done=true;m.winner=winner;m.loser=loser;
    if(m.type==="F"){
      if(m===tournament.final){if(winner===m.slots[0]){tournament.reset.done=true;tournament.reset.omit=true;tournament.reset.slots=m.slots.slice();tournament.champion=winner;}else{place(tournament.reset,0,m.slots[0]);place(tournament.reset,1,m.slots[1]);}}
      else tournament.champion=winner;
    }else{
      if(m.winDest)place(m.winDest[0],m.winDest[1],winner);
      if(m.loseDest)place(m.loseDest[0],m.loseDest[1],loser);
    }
  }
  function nextMatch(){for(const round of tournament.calendar)for(const i of extremes(round.length)){const m=round[i];if(!m.done&&m.slots.every(v=>v!==null&&v!==0))return m;}return null;}
  function play(side){
    if(!tournament)return;const m=nextMatch();if(!m){render();return;}
    const picked=side==null?Math.floor(Math.random()*2):side;const winner=m.slots[picked],loser=m.slots[1-picked];
    closeMatch(m,winner,loser);tournament.history.push({code:m.code,a:winner===m.slots[0]?name(m.slots[0]):name(m.slots[0]),b:name(m.slots[1]),winner:name(winner),loser:name(loser)});
    tournament.message=m.code+": "+name(m.slots[0])+" vs "+name(m.slots[1])+" → gana "+name(winner);render();
  }
  function stopAuto(){if(autoTimer){clearInterval(autoTimer);autoTimer=null;}const b=$("tdAuto");if(b)b.textContent="⏩ Auto";}
  function toggleAuto(){if(autoTimer){stopAuto();return;}if(!nextMatch())return;$("tdAuto").textContent="⏸ Pausar auto";autoTimer=setInterval(()=>{if(!nextMatch()||!tournament){stopAuto();render();return;}play(null);},650);}
  function matchAt(x,y,m,active){
    const w=150,h=48;const pending=m.slots.some(v=>v===null),bye=m.slots.includes(0);
    const fill=active?"#78350f":m.done?"#14532d":"#1e293b",stroke=active?"#f59e0b":m.done?"#22c55e":"#475569";
    let s='<g><rect x="'+x+'" y="'+y+'" width="'+w+'" height="'+h+'" rx="7" fill="'+fill+'" stroke="'+stroke+'" stroke-width="'+(active?2:1)+'"/>';
    s+='<text x="'+(x+7)+'" y="'+(y+13)+'" font-size="9" fill="#94a3b8">'+esc(m.code)+'</text>';
    for(let j=0;j<2;j++){const id=m.slots[j],isWin=m.done&&m.winner===id&&id!==0,txt=id===null?"Por definir":id===0?"BYE":name(id);s+='<text x="'+(x+8)+'" y="'+(y+27+j*16)+'" font-size="11" font-weight="'+(isWin?800:500)+'" fill="'+(isWin?"#86efac":id===null?"#64748b":"#f1f5f9")+'">'+esc(txt.length>19?txt.slice(0,18)+"…":txt)+'</text>';}
    s+='</g>';return s;
  }
  function drawBracket(){
    const rounds=[...tournament.G,...tournament.P,[tournament.final,tournament.reset].filter(m=>!m.omit)];
    const maxCount=Math.max(...rounds.map(r=>r.length),1),h=64,gap=38,colW=188,left=22,top=28;
    const width=left*2+rounds.length*colW,height=top*2+maxCount*(h+gap);
    let svg='<svg viewBox="0 0 '+width+' '+height+'" width="'+width+'" height="'+height+'" role="img" aria-label="Llaves interactivas de doble eliminación">';
    rounds.forEach((round,r)=>{const x=left+r*colW;let title;if(r<tournament.G.length)title="GANADORES · R"+(r+1);else if(r<tournament.G.length+tournament.P.length)title="PERDEDORES · R"+(r-tournament.G.length+1);else title=round.length===2?"FINAL":"GRAN FINAL";
      svg+='<text x="'+(x+75)+'" y="16" text-anchor="middle" font-size="11" font-weight="800" fill="#7dd3fc">'+title+'</text>';
      const span=height/(round.length+1);
      round.forEach((m,i)=>{const y=Math.max(top+i*span,top);const active=nextMatch()===m;
        if(r>0){const prev=rounds[r-1];const p=prev[Math.min(prev.length-1,Math.floor(i*prev.length/round.length))];if(p){const py=Math.max(top+prev.indexOf(p)*(height/(prev.length+1)),top)+h/2;svg+='<path d="M '+(x-13)+' '+py+' H '+(x-7)+' V '+(y+h/2)+' H '+x+'" fill="none" stroke="'+(p.done?"#22c55e":"#475569")+'" stroke-width="1.5"/>';}}
        svg+=matchAt(x,y,m,active);
      });
    });
    svg+='</svg>';return svg;
  }
  function render(){
    if(!tournament)return;const m=nextMatch();
    $("tdStatus").textContent=tournament.champion?"TORNEO FINALIZADO":m?"SIGUIENTE: "+m.code:"TODOS LOS COMBATES COMPLETADOS";
    $("tdProgress").textContent=tournament.history.length+" combates registrados · "+tournament.n+" participantes";
    $("tdCurrent").innerHTML=m?'<div class="td-head"><h3>ENFRENTAMIENTO ACTUAL · '+esc(m.code)+'</h3><span class="td-status">Selecciona quién gana</span></div><div class="td-actions"><button class="good" id="tdTop">▲ Gana arriba · '+esc(name(m.slots[0]))+'</button><button class="good" id="tdBottom">▼ Gana abajo · '+esc(name(m.slots[1]))+'</button></div>':tournament.champion?'<h3>🏆 Campeón: '+esc(name(tournament.champion))+'</h3>':'<h3>Llave completada</h3>';
    $("tdTop")?.addEventListener("click",()=>play(0));$("tdBottom")?.addEventListener("click",()=>play(1));
    $("tdBracket").innerHTML=drawBracket();
    $("tdWinners").innerHTML=tournament.G.flat().filter(x=>x.done&&!x.slots.includes(0)).map(x=>'<div class="td-row"><span>'+esc(x.code)+' · '+esc(name(x.slots[0]))+' vs '+esc(name(x.slots[1]))+'</span><strong>'+esc(name(x.winner))+'</strong></div>').join("")||'<span class="td-muted">Aún no hay resultados.</span>';
    $("tdLosers").innerHTML=tournament.P.flat().filter(x=>x.done&&!x.slots.includes(0)).map(x=>'<div class="td-row"><span>'+esc(x.code)+' · '+esc(name(x.slots[0]))+' vs '+esc(name(x.slots[1]))+'</span><strong>'+esc(name(x.winner))+'</strong></div>').join("")||'<span class="td-muted">Aún no hay resultados.</span>';
    $("tdMessage").textContent=tournament.message;
    $("tdPlayRandom").disabled=!m;$("tdAuto").disabled=!m;
    if(!m)stopAuto();
  }
  function ensurePanel(){
    const view=$("bracketsView");if(!view||$("tournamentDebug"))return;
    const panel=document.createElement("section");panel.id="tournamentDebug";
    panel.innerHTML='<div class="td-panel"><div class="td-head"><div><h2>Llaves de doble eliminación</h2><div class="td-muted">Participantes reales del registro · avance interactivo por rondas</div></div><span class="td-status" id="tdStatus">Cargando participantes…</span></div><div class="td-toolbar"><label for="tdParticipantCount">Número de participantes</label><input id="tdParticipantCount" type="number" min="2" max="64" value="5"><button id="tdGenerate" class="primary">Generar llave</button><button id="tdPlayRandom" class="good" disabled>▶ Siguiente (azar)</button><button id="tdAuto" disabled>⏩ Auto</button><button id="tdReset">Reiniciar</button><span id="tdProgress" class="td-muted"></span></div><p id="tdMessage" class="td-muted"></p></div><div class="td-panel"><div id="tdCurrent"></div><div class="td-scroll" id="tdBracket"></div><div class="td-legend"><span><i class="td-dot active"></i>Combate siguiente</span><span><i class="td-dot winner"></i>Combate resuelto</span><span>BYE: avance automático</span></div></div><div class="td-bottom"><div class="td-panel"><div class="td-head"><h3>Resultados · Ganadores</h3></div><div id="tdWinners" class="td-list"></div></div><div class="td-panel"><div class="td-head"><h3>Resultados · Perdedores</h3></div><div id="tdLosers" class="td-list"></div></div></div>';
    const desc=view.querySelector(".mgmt-description");if(desc)desc.insertAdjacentElement("afterend",panel);else view.prepend(panel);
    $("tdGenerate").addEventListener("click",generate);$("tdPlayRandom").addEventListener("click",()=>play(null));$("tdAuto").addEventListener("click",toggleAuto);$("tdReset").addEventListener("click",()=>{stopAuto();if(tournament)generate();});
  }
  async function init(){
    ensurePanel();
    try{const r=await fetch("/api/participants");if(!r.ok)throw new Error("No se pudieron consultar los participantes.");participants=(await r.json()).filter(valid).sort((a,b)=>a.id-b.id);
      $("tdParticipantCount").value=Math.max(2,Math.min(64,participants.length||5));
      if(participants.length<2)$("tdStatus").textContent="Registra al menos dos participantes válidos para usar sus nombres; puedes probar con nombres de ejemplo.";
      generate();
    }catch(e){$("tdStatus").textContent=e.message;}
  }
  window.refreshTournamentAfterParticipantChange=async()=>{stopAuto();participants=[];await init();};
  document.addEventListener("DOMContentLoaded",init);if(document.readyState!=="loading")init();
})();