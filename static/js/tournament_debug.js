(() => {
"use strict";
const $=id=>document.getElementById(id), esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
let participants=[],tournament=null,loading=false;
const css=document.createElement("style");
css.textContent='#bracketsView>.mgmt-stats,#bracketsView>.mgmt-brackets,#bracketsView>.mgmt-grid,#bracketsView>.mgmt-panel{display:none!important}#tournamentLive{color:#e2e8f0;font-family:Arial,sans-serif;margin:14px 0}#tournamentLive .tl-panel{background:linear-gradient(145deg,#0b1728,#07111f);border:1px solid #29445f;border-radius:15px;padding:clamp(12px,2vw,20px);margin-bottom:14px}#tournamentLive h2,#tournamentLive h3{margin:0 0 10px;color:#7deaff}#tournamentLive .tl-head{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap}#tournamentLive .tl-muted{color:#91a9bf;font-size:12px;line-height:1.5}#tournamentLive .tl-status{padding:8px 11px;border-radius:999px;background:#102b40;border:1px solid #31536f;font-size:11px;font-weight:900}#tournamentLive .tl-scroll{overflow:auto;border:1px solid #243d55;border-radius:11px;background:#030b16;margin-top:10px}#tournamentLive svg{display:block;background:#07111f}#tournamentLive button{border:1px solid #31536f;border-radius:8px;padding:10px 13px;background:#102b40;color:#f5fbff;font-weight:900;cursor:pointer}#tournamentLive .tl-history{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}#tournamentLive .tl-result{display:flex;justify-content:space-between;gap:10px;padding:8px 10px;background:#101f31;border-radius:7px;margin-top:6px;font-size:12px;overflow-wrap:anywhere}#tournamentLive .tl-result strong{color:#86efac}@media(max-width:650px){#tournamentLive .tl-history{grid-template-columns:1fr}}';
document.head.appendChild(css);
const power2=n=>2**Math.ceil(Math.log2(n));
function extremes(n){const a=[];let l=0,r=n-1;while(l<=r){a.push(l);if(l!==r)a.push(r);l++;r--;}return a;}
function valid(p){return Number(p.weight)>0&&Number(p.weight)<=500&&Array.isArray(p.checks)&&p.checks.every(Boolean);}
function player(id){return tournament?.players.find(p=>String(p.id)===String(id));}
function name(id){return id===0?"BYE":id==null?"Por definir":player(id)?.robot||"Por definir";}
function make(id,b,r,i){return{id,bracket:b,round:r,index:i,slots:[null,null],winner:null,loser:null,done:false,omit:false,seriesWins:{},battles:[],winDest:null,loseDest:null};}
function put(id,s,v){const m=tournament.matches[id];if(!m||m.done)return;m.slots[s]=v;auto(m);}
function auto(m){if(m.done||m.slots.some(v=>v===null)||!m.slots.includes(0))return;close(m,m.slots[0]===0?m.slots[1]:m.slots[0],0);}
function close(m,w,l){if(m.done)return;m.done=true;m.winner=w;m.loser=l;if(m.bracket==="F"){if(m.id==="FINAL"){if(w===m.slots[0]){tournament.matches.RESET.done=true;tournament.matches.RESET.omit=true;tournament.champion=w;}else tournament.matches.RESET.slots=m.slots.slice();}else tournament.champion=w;return;}if(m.winDest)put(m.winDest.match,m.winDest.slot,w);if(m.loseDest&&l!==0&&l!=null)put(m.loseDest.match,m.loseDest.slot,l);}
function generate(){
 if(loading)return;if(participants.length<2){tournament=null;renderEmpty("Se necesitan al menos dos participantes válidos.");return;}
 const ps=participants.slice();for(let i=ps.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[ps[i],ps[j]]=[ps[j],ps[i]];}
 const n=ps.length,size=power2(n),k=Math.log2(size),m=size/2,order=extremes(m),first=Array.from({length:m},()=>[0,0]),ids=ps.map(p=>p.id);
 order.forEach((idx,pos)=>{if(pos<ids.length)first[idx][0]=ids[pos];});ids.slice(m).forEach((id,pos)=>{first[order[pos]][1]=id;});
 tournament={version:2,n,size,players:ps,matches:{},G:[],P:[],calendar:[],champion:null,history:[]};
 for(let r=0;r<k;r++){const rr=[];for(let i=0;i<size/2**(r+1);i++){const id="G"+(r+1)+"-"+(i+1);rr.push(id);tournament.matches[id]=make(id,"G",r,i);}tournament.G.push(rr);}
 for(let r=0;r<2*(k-1);r++){const count=size/2**(Math.floor((r+2)/2)+1),rr=[];for(let i=0;i<count;i++){const id="P"+(r+1)+"-"+(i+1);rr.push(id);tournament.matches[id]=make(id,"P",r,i);}tournament.P.push(rr);}
 tournament.matches.FINAL=make("FINAL","F",0,0);tournament.matches.RESET=make("RESET","F",1,0);
 tournament.G.forEach((rr,r)=>rr.forEach((id,i)=>tournament.matches[id].winDest=r<k-1?{match:tournament.G[r+1][Math.floor(i/2)],slot:i%2}:{match:"FINAL",slot:0}));
 if(k===1)tournament.matches[tournament.G[0][0]].loseDest={match:"FINAL",slot:1};else{tournament.G[0].forEach((id,i)=>tournament.matches[id].loseDest={match:tournament.P[0][Math.floor(i/2)],slot:i%2});for(let j=2;j<=k;j++){const rr=tournament.P[2*j-3],cnt=tournament.G[j-1].length;tournament.G[j-1].forEach((id,i)=>tournament.matches[id].loseDest={match:rr[cnt-1-i],slot:1});}}
 tournament.P.forEach((rr,r)=>rr.forEach((id,i)=>tournament.matches[id].winDest=r===tournament.P.length-1?{match:"FINAL",slot:1}:r%2===0?{match:tournament.P[r+1][i],slot:0}:{match:tournament.P[r+1][Math.floor(i/2)],slot:i%2}));
 first.forEach((s,i)=>tournament.matches[tournament.G[0][i]].slots=s.slice());tournament.G.forEach(rr=>rr.forEach(id=>auto(tournament.matches[id])));
 tournament.calendar=[tournament.G[0]];if(k>=2){tournament.calendar.push(tournament.P[0]);for(let j=2;j<=k;j++){tournament.calendar.push(tournament.G[j-1],tournament.P[2*j-3]);if(2*j-2<tournament.P.length)tournament.calendar.push(tournament.P[2*j-2]);}}tournament.calendar.push(["FINAL"],["RESET"]);
 save().then(render);
}
function next(){if(!tournament)return null;for(const rr of tournament.calendar)for(const i of extremes(rr.length)){const m=tournament.matches[rr[i]];if(m&&!m.done&&!m.omit&&m.slots.every(v=>v!==null&&v!==0))return m;}return null;}
async function save(){if(!tournament)return;try{const r=await fetch("/api/tournament/debug-state",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({state:{...tournament,started:!tournament.champion}})});if(!r.ok)throw Error("No se pudo guardar la llave en SQLite.");}catch(e){const s=$("tlStatus");if(s)s.textContent=e.message;}}
function renderEmpty(msg){const root=$("tournamentLive");if(root)root.innerHTML='<div class="tl-panel"><h2>Llaves de doble eliminación</h2><p class="tl-muted">'+esc(msg)+'</p></div>';}
function draw(rounds,title){
 if(!rounds.length)return "";const max=Math.max(...rounds.map(r=>r.length),1),step=72,cw=194,left=20,top=36,h=Math.max(120,top*2+max*step),w=left*2+rounds.length*cw;let s='<div class="tl-scroll"><svg width="'+w+'" height="'+h+'" viewBox="0 0 '+w+' '+h+'"><text x="18" y="20" fill="#7deaff" font-size="13" font-weight="900">'+title+'</text>';const pos={};
 rounds.forEach((rr,r)=>rr.forEach((id,i)=>pos[id]={x:left+r*cw,y:top+i*(h-top*2)/(rr.length+1)}));
 rounds.forEach(rr=>rr.forEach(id=>{const m=tournament.matches[id],a=pos[id];if(m.winDest&&pos[m.winDest.match]){const b=pos[m.winDest.match],x1=a.x+164,y1=a.y+25,x2=b.x,y2=b.y+25+(m.winDest.slot===0?-10:10),mid=(x1+x2)/2;s+='<path d="M '+x1+' '+y1+' H '+mid+' V '+y2+' H '+x2+'" fill="none" stroke="'+(m.done?"#22c55e":"#344b62")+'" stroke-width="1.5"/>';}}));
 rounds.forEach(rr=>rr.forEach(id=>{const m=tournament.matches[id],p=pos[id],active=next()===m,fill=active?"#4a2c0a":m.done?"#123b2b":"#132438",stroke=active?"#f59e0b":m.done?"#22c55e":"#3b536b";s+='<g><rect x="'+p.x+'" y="'+p.y+'" width="164" height="52" rx="8" fill="'+fill+'" stroke="'+stroke+'" stroke-width="'+(active?2.5:1)+'"/><text x="'+(p.x+8)+'" y="'+(p.y+12)+'" font-size="9" fill="#8faac0">'+esc(id)+'</text>';for(let j=0;j<2;j++){const idp=m.slots[j],win=m.done&&String(m.winner)===String(idp)&&idp!==0,txt=name(idp);s+='<text x="'+(p.x+8)+'" y="'+(p.y+29+j*16)+'" font-size="11" font-weight="'+(win?800:500)+'" fill="'+(win?"#86efac":idp==null?"#6c8297":"#f1f5f9")+'">'+esc(txt.length>22?txt.slice(0,21)+"…":txt)+'</text>';}s+='</g>';}));return s+'</svg></div>';
}
function drawWholeBracket(){
 // Traslado fiel del algoritmo de posiciones y dibujo de doble_eliminacion_gui.py.
 // Solo se adaptan los nombres de datos y el lienzo Tkinter a SVG/HTML.
 const BW=124,BH=40,VG=16,COLW=176,MX=64,MY=70;
 const G=tournament.G,P=tournament.P,matches=tournament.matches,pos={};
 const center=id=>pos[id]?.y;
 const place=(id,x,y)=>{pos[id]={x,y};};

 // Misma distribución vertical de ganadores: cada ronda se centra
 // entre los dos partidos de la ronda anterior.
 G.forEach((round,r)=>round.forEach((id,i)=>{
   const y=r===0
     ? MY+i*(BH+VG)+BH/2
     : (center(G[r-1][2*i])+center(G[r-1][2*i+1]))/2;
   place(id,MX+r*COLW,y);
 }));

 // Misma distribución de perdedores: una ronda conserva la altura;
 // la siguiente agrupa de dos en dos.
 const lbTop=MY+G[0].length*(BH+VG)+60;
 P.forEach((round,r)=>round.forEach((id,i)=>{
   let y;
   if(r===0)y=lbTop+i*(BH+VG)+BH/2;
   else if(r%2===1)y=center(P[r-1][i]);
   else{
     const a=P[r-1][2*i],b=P[r-1][2*i+1];
     y=(center(a)+center(b))/2;
   }
   place(id,MX+r*COLW,y);
 }));

 const k=Math.log2(tournament.size);
 const finalCol=Math.max(k,P.length);
 const yg=center(G[G.length-1][0]);
 const yf=P.length?(yg+center(P[P.length-1][0]))/2:yg;
 place("FINAL",MX+finalCol*COLW,yf);
 place("RESET",MX+finalCol*COLW,yf+BH+60);

 const all=[...G.flat(),...P.flat()];
 const W=MX*2+(finalCol+1)*COLW;
 const H=Math.max(...Object.values(pos).map(p=>p.y))+BH/2+80;
 const nextMatch=next();
 let svg='<div class="tl-scroll"><svg width="'+W+'" height="'+H+'" viewBox="0 0 '+W+' '+H+'" role="img" aria-label="Llaves de doble eliminación">';
 const text=(x,y,txt,color,size=9,weight=500)=>'<text x="'+x+'" y="'+y+'" fill="'+color+'" font-size="'+size+'" font-weight="'+weight+'">'+esc(txt)+'</text>';

 // Títulos y nombres de rondas como en la GUI original.
 svg+=text(MX,14,"LLAVE DE GANADORES","#e2e8f0",12,700);
 G.forEach((round,r)=>{
   const label=round.length===1?"Final":round.length===2?"Semifinal":round.length===4?"Cuartos":"Ronda "+(r+1);
   svg+=text(MX+r*COLW,MY-24,"G-R"+(r+1)+" · "+label,"#64748b");
 });
 if(P.length){
   svg+=text(MX,lbTop-52,"LLAVE DE PERDEDORES","#e2e8f0",12,700);
   P.forEach((round,r)=>svg+=text(MX+r*COLW,lbTop-24,"P-R"+(r+1)+" · "+round.length+" partido(s)","#64748b"));
 }
 svg+=text(pos.FINAL.x,pos.FINAL.y-BH/2-26,"GRAN FINAL","#e2e8f0",12,700);

 // Igual que la referencia: las conexiones principales solo siguen el avance
 // de ganadores; se dibujan antes que las cajas para que no las atraviesen.
 const connector=(id,dest)=>{
   if(!dest||!pos[dest.match])return;
   const a=pos[id],b=pos[dest.match];
   const x1=a.x+BW,y1=a.y,x2=b.x;
   const y2=b.y+(dest.slot===0?-BH/4:BH/4),xm=(x1+x2)/2;
   const m=matches[id],used=m.done&&m.winner!=null&&m.winner!==0;
   svg+='<path d="M '+x1+' '+y1+' H '+xm+' V '+y2+' H '+x2+'" fill="none" stroke="'+(used?"#22c55e":"#475569")+'" stroke-width="'+(used?2:1)+'" stroke-linejoin="round"/>';
 };
 all.forEach(id=>connector(id,matches[id].winDest));
 if(k===1)connector(G[0][0],matches[G[0][0]].loseDest);

 // En la GUI original, la caída desde ganadores se identifica con etiquetas
 // rojas en la ronda de perdedores en vez de dibujar líneas que crucen cajas.
 if(k>=2){
   G.flat().forEach(id=>{
     const dest=matches[id].loseDest;
     if(!dest||!pos[dest.match])return;
     const p=pos[dest.match],y=p.y+(dest.slot===0?-BH/4:BH/4);
     svg+=text(p.x-5,y,"↓"+id,"#f87171",7);
   });
 }

 // Cajas divididas en dos mitades, con el siguiente combate resaltado.
 const drawMatch=id=>{
   const m=matches[id],p=pos[id];
   if(!p||m?.omit)return;
   const active=m===nextMatch;
   svg+=text(p.x,p.y-BH/2-3,id,active?"#f59e0b":"#64748b",7);
   for(let s=0;s<2;s++){
     const v=m.slots[s],yy=p.y-BH/2+s*BH/2;
     let fill="#1e293b",color="#e2e8f0",label=name(v);
     if(v==null){fill="#1e293b";color="#64748b";label="—";}
     else if(v===0){fill="#111827";color="#374151";label="BYE";}
     else if(m.done&&String(v)===String(m.winner)){fill="#166534";}
     else if(m.done&&String(v)===String(m.loser)){fill="#3f1d1d";color="#9ca3af";}
     svg+='<rect x="'+p.x+'" y="'+yy+'" width="'+BW+'" height="'+(BH/2)+'" fill="'+fill+'" stroke="#475569" stroke-width="1"/>';
     svg+=text(p.x+8,yy+BH/4+4,label,color,9,700);
   }
   svg+='<rect x="'+p.x+'" y="'+(p.y-BH/2)+'" width="'+BW+'" height="'+BH+'" fill="none" stroke="'+(active?"#f59e0b":"#475569")+'" stroke-width="'+(active?3:1)+'"/>';
 };
 all.forEach(drawMatch);
 drawMatch("FINAL");drawMatch("RESET");
 if(tournament.champion!=null){
   const p=pos.RESET;
   svg+=text(p.x,p.y+BH/2+30,"🏆 Campeón: "+name(tournament.champion),"#f59e0b",14,700);
 }
 svg+='</svg></div><div class="tl-muted" style="margin-top:8px">Línea verde: avance resuelto · etiquetas rojas: caída a perdedores · borde amarillo: siguiente enfrentamiento.</div>';
 return svg;
}
function render(){
 const root=$("tournamentLive");if(!root)return;if(!tournament){renderEmpty("Generando la llave…");return;}const cur=next(),resolved=Object.values(tournament.matches).filter(m=>m.done&&!m.omit&&m.bracket!=="F").length;
 let h='<div class="tl-panel"><div class="tl-head"><div><h2>Llaves de doble eliminación</h2><div class="tl-muted">Participantes válidos · resultados guardados en SQLite · avance automático</div></div><span class="tl-status" id="tlStatus">'+(tournament.champion?"TORNEO FINALIZADO":cur?"SIGUIENTE: "+cur.id:"TODOS LOS COMBATES COMPLETADOS")+'</span></div><p class="tl-muted">'+tournament.n+' participantes · '+resolved+' enfrentamientos resueltos <button id="tlRefresh">Actualizar participantes</button></p></div>';
 h+='<div class="tl-panel"><h3>LLAVES · CAMINOS DE GANADORES Y PERDEDORES</h3><div class="tl-muted">Ganadores arriba y perdedores debajo, con conectores de avance y caída.</div>'+drawWholeBracket()+(tournament.champion?'<p class="tl-status">🏆 Campeón: '+esc(name(tournament.champion))+'</p>':'')+'</div>';
 h+='<div class="tl-history"><div class="tl-panel"><h3>Resultados · Ganadores</h3>'+tournament.G.flat().map(id=>tournament.matches[id]).filter(m=>m.done&&m.slots.every(v=>v!==0)).map(m=>'<div class="tl-result"><span>'+esc(m.id)+' · '+esc(name(m.slots[0]))+' vs '+esc(name(m.slots[1]))+'</span><strong>'+esc(name(m.winner))+'</strong></div>').join("")+'</div><div class="tl-panel"><h3>Resultados · Perdedores</h3>'+tournament.P.flat().map(id=>tournament.matches[id]).filter(m=>m.done&&m.slots.every(v=>v!==0)).map(m=>'<div class="tl-result"><span>'+esc(m.id)+' · '+esc(name(m.slots[0]))+' vs '+esc(name(m.slots[1]))+'</span><strong>'+esc(name(m.winner))+'</strong></div>').join("")+'</div></div>';
 root.innerHTML=h;$("tlRefresh")?.addEventListener("click",init);
}
async function init(){if(loading)return;loading=true;try{const view=$("bracketsView");if(view&&!$("tournamentLive")){const panel=document.createElement("section");panel.id="tournamentLive";const desc=view.querySelector(".mgmt-description");if(desc)desc.insertAdjacentElement("afterend",panel);else view.prepend(panel);}const r=await fetch("/api/participants");if(!r.ok)throw Error("No se pudieron consultar los participantes.");participants=(await r.json()).filter(valid).sort((a,b)=>a.id-b.id);const saved=await fetch("/api/tournament/debug-state").then(r=>r.ok?r.json():null).catch(()=>null),old=saved?.state,signature=arr=>JSON.stringify(arr.map(p=>[p.id,p.robot,p.pilot,Number(p.weight)||0,(p.checks||[]).map(Boolean)]).sort((a,b)=>Number(a[0])-Number(b[0]))),sameParticipants=signature(participants)===signature(old?.players||[]);if(old?.version===2&&sameParticipants&&old.matches&&old.calendar){tournament=old;render();}else{tournament=null;loading=false;generate();return;}if(participants.length<2)renderEmpty("Se necesitan dos participantes válidos como mínimo.");}catch(e){renderEmpty(e.message);}finally{loading=false;}}
window.refreshTournamentAfterParticipantChange=async()=>{tournament=null;await init();};
document.addEventListener("DOMContentLoaded",init);if(document.readyState!=="loading")init();
})();