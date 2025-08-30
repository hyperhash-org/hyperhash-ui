// Hyper-Hash Quasar — legend-gated shell + axis arrowheads (max zoom = 3500)
(function(){
  const mount = document.getElementById('quasar-wrap'); if(!mount) return;

  // ---- layout ---------------------------------------------------------------
  const wrap = document.createElement('div');
  wrap.style.position = 'relative';
  wrap.style.width = '100%';
  wrap.style.height = '100%';

  const canvas = document.createElement('canvas');
  canvas.style.width = '100%';
  canvas.style.height = '100%';
  wrap.appendChild(canvas);

  // Legend toggle
  const legendBtn = document.createElement('button');
  legendBtn.textContent = 'Legend';
  Object.assign(legendBtn.style, {
    position:'absolute', left:'16px', top:'16px', zIndex:'2',
    padding:'6px 10px', borderRadius:'8px',
    border:'1px solid #2a3b4a', background:'#0f1923', color:'#cfe6fb',
    cursor:'pointer', font:'12px system-ui, -apple-system, Segoe UI, Roboto, Inter, Arial'
  });
  wrap.appendChild(legendBtn);

  // Lane legend (vertical stack)
  const laneLegend = document.createElement('div');
  Object.assign(laneLegend.style, {
    position:'absolute', left:'16px', top:'54px', zIndex:'2',
    display:'none',
    gap:'8px',
    font:'12px system-ui,-apple-system,Segoe UI,Roboto,Inter,Arial',
    flexDirection:'column',  // vertical
    width:'max-content'
  });
  const LCOL={SV1:'#66d9ef',SV1H:'#f92672',SV2:'#fd971f',SV2H:'#a6e22e'};
  function pill(txt,color){
    const el=document.createElement('span');
    el.textContent=txt;
    Object.assign(el.style,{
      display:'inline-block', padding:'2px 8px',
      border:'1px solid rgba(255,255,255,.08)', borderRadius:'999px',
      background:'rgba(10,16,22,.6)', color:color
    });
    return el;
  }
  laneLegend.appendChild(pill('SV1',LCOL.SV1));
  laneLegend.appendChild(pill('SV1 Hyper',LCOL.SV1H));
  laneLegend.appendChild(pill('SV2',LCOL.SV2));
  laneLegend.appendChild(pill('SV2 Hyper',LCOL.SV2H));
  wrap.appendChild(laneLegend);

  mount.appendChild(wrap);

  // ---- canvas ---------------------------------------------------------------
  const ctx = canvas.getContext('2d');
  let DPR = Math.min(window.devicePixelRatio||1, 2);
  function resize(){
    const r = wrap.getBoundingClientRect();
    canvas.width  = Math.floor(r.width * DPR);
    canvas.height = Math.floor(r.height* DPR);
  }
  new ResizeObserver(resize).observe(wrap); resize();

  // ---- interaction ----------------------------------------------------------
  let yaw=0, pitch=0, baseZoom=420, zoom=baseZoom;
  let dragging=false, lx=0, ly=0;

  wrap.addEventListener('wheel', e=>{
    e.preventDefault();
    const d=Math.sign(e.deltaY);
    zoom *= (1 - d*0.06);                 // finer step
    zoom = Math.max(120, Math.min(3500, zoom)); // max zoom raised to 3500
  }, {passive:false});

  canvas.addEventListener('pointerdown', e=>{dragging=true; lx=e.clientX; ly=e.clientY;});
  window.addEventListener('pointerup',   ()=>{dragging=false;});
  window.addEventListener('pointermove', e=>{
    if(!dragging) return;
    const dx=e.clientX-lx, dy=e.clientY-ly; lx=e.clientX; ly=e.clientY;
    yaw   += dx*0.003;
    pitch += dy*0.003;
    pitch = Math.max(-1.2, Math.min(1.2, pitch));
  });

  // ---- scene ----------------------------------------------------------------
  const R=2, steps=220, nlat=24, nlon=24;
  const LANES=['SV1','SV1H','SV2','SV2H'];
  let dots=[];
  function randDir(){const u=Math.random(),v=Math.random();const t=2*Math.PI*u,p=Math.acos(2*v-1);return[Math.sin(p)*Math.cos(t),Math.sin(p)*Math.sin(t),Math.cos(p)];}
  function addDot(){
    const bits=(Math.random()*32)|0;
    const r=0.05+(bits/32)*1.95;
    const dir=randDir();
    const lane=LANES[(Math.random()*4)|0];
    const col=LCOL[lane];
    const size=0.6+(bits/32)*2.0;
    dots.push({dir,r,cur:0.02,size,col});
    if(dots.length>14000) dots.shift();
  }
  for(let i=0;i<1400;i++) addDot();
  setInterval(addDot,26);

  function rotXYZ(x,y,z){
    const cy=Math.cos(yaw), sy=Math.sin(yaw);
    const cx=Math.cos(pitch), sx=Math.sin(pitch);
    let X=x*cy+z*sy;
    let Z=-x*sy+z*cy;
    let Y=y*cx-Z*sx;
    Z=y*sx+Z*cx;
    return [X,Y,Z];
  }
  function proj(x,y,z){
    const cx=canvas.width/2, cy=canvas.height/2;
    const f=zoom/(1+2*(z+2)); // perspective
    return [cx+x*f, cy-y*f, f/300];
  }

  // ---- legend/shell/axes state ---------------------------------------------
  let legendOn=false;
  let forcedLegendUntil=0; // event-driven auto-show (20s)
  const SHELL_ALPHA = 0.35;  // shared transparency for shell, axes, labels

  legendBtn.addEventListener('click', ()=>{
    legendOn = !legendOn;
    laneLegend.style.display = legendOn ? 'flex' : 'none'; // flex (vertical)
  });

  function autoShowLegendFor(ms){
    forcedLegendUntil = Date.now() + ms;
    if(!legendOn) { laneLegend.style.display='flex'; } // vertical
  }

  // ---- drawing helpers ------------------------------------------------------
  function strokeRGBA(r,g,b,a){ ctx.strokeStyle=`rgba(${r},${g},${b},${a})`; }
  function fillRGBA(r,g,b,a){ ctx.fillStyle=`rgba(${r},${g},${b},${a})`; }

  // Arrow from (x0,y0) to (x1,y1) with perspective-scaled head
  // CHANGE: tip pulled back ~10px so the head never escapes the shell.
  function drawArrow(x0,y0,x1,y1, scaleHint){
    const dx=x1-x0, dy=y1-y0;
    const len=Math.hypot(dx,dy) || 1;
    const ux=dx/len,  uy=dy/len;

    const tipBack = 10 * DPR;           // <- pullback inside shell
    const tipX = x1 - ux*tipBack;
    const tipY = y1 - uy*tipBack;

    ctx.beginPath();
    ctx.moveTo(x0,y0); ctx.lineTo(tipX,tipY); ctx.stroke();

    const L = Math.max(8, 14 * (scaleHint||1)) * DPR; // head length
    const cos= Math.cos(0.49), sin=Math.sin(0.49);     // ~28°
    const rx1 =  ux*cos +  uy*sin, ry1 = -ux*sin +  uy*cos;
    const rx2 =  ux*cos -  uy*sin, ry2 =  ux*sin +  uy*cos;

    ctx.beginPath();
    ctx.moveTo(tipX, tipY);
    ctx.lineTo(tipX - rx1*L, tipY - ry1*L);
    ctx.moveTo(tipX, tipY);
    ctx.lineTo(tipX - rx2*L, tipY - ry2*L);
    ctx.stroke();
  }

  // Axis lengths (keep X short; shorten Z so it stays inside the shell)
  const AXF = 1.02, AYF = 1.25, AZF = 1.02;  // <- Z was 1.25 before

  function drawShellAndAxes(){
    const showing = legendOn || (Date.now() < forcedLegendUntil);
    if(!showing){ laneLegend.style.display='none'; return; }
    if(legendOn) laneLegend.style.display='flex';

    // Shell grid
    ctx.lineWidth = 1*DPR;
    strokeRGBA(34,52,71, SHELL_ALPHA);
    for(let j=1;j<=nlat;j++){
      const phi=-Math.PI/2+(j*(Math.PI/(nlat+1)));
      ctx.beginPath();
      for(let i=0;i<=steps;i++){
        const t=i/steps*2*Math.PI;
        const x=R*Math.cos(phi)*Math.cos(t),
              y=R*Math.sin(phi),
              z=R*Math.cos(phi)*Math.sin(t);
        const [X,Y]=proj(...rotXYZ(x,y,z));
        if(i===0) ctx.moveTo(X,Y); else ctx.lineTo(X,Y);
      }
      ctx.stroke();
    }
    for(let j=0;j<nlon;j++){
      const t0=j/nlon*2*Math.PI;
      ctx.beginPath();
      for(let i=0;i<=steps;i++){
        const p=-Math.PI/2+i/steps*Math.PI;
        const x=R*Math.cos(p)*Math.cos(t0),
              y=R*Math.sin(p),
              z=R*Math.cos(p)*Math.sin(t0);
        const [X,Y]=proj(...rotXYZ(x,y,z));
        if(i===0) ctx.moveTo(X,Y); else ctx.lineTo(X,Y);
      }
      ctx.stroke();
    }

    // Axes (white) + arrowheads + labels — same alpha as shell
    ctx.lineWidth = 1.25*DPR;
    strokeRGBA(255,255,255, SHELL_ALPHA);

    const AX = [ R*AXF, 0, 0];   // +X (Nonce) — shorter
    const AY = [ 0, R*AYF, 0];   // +Y (Time)
    const AZ = [ 0, 0, R*AZF];   // +Z (Merkle) — shorter now

    const O  = proj(...rotXYZ(0,0,0));
    const PX = proj(...rotXYZ(...AX));
    const PY = proj(...rotXYZ(...AY));
    const PZ = proj(...rotXYZ(...AZ));

    drawArrow(O[0],O[1], PX[0],PX[1], PX[2]);
    drawArrow(O[0],O[1], PY[0],PY[1], PY[2]);
    drawArrow(O[0],O[1], PZ[0],PZ[1], PZ[2]);

    ctx.font = `${12*DPR}px system-ui, -apple-system, Segoe UI, Roboto, Inter, Arial`;
    ctx.textAlign='left'; ctx.textBaseline='middle';
    fillRGBA(255,255,255, SHELL_ALPHA);
    const pad = 8*DPR;
    ctx.fillText('Nonce',  PX[0]+pad, PX[1]);
    ctx.fillText('Time',   PY[0]+pad, PY[1]);
    ctx.fillText('Merkle', PZ[0]+pad, PZ[1]);
  }

  // ---- render loop ----------------------------------------------------------
  function render(){
    ctx.setTransform(1,0,0,1,0,0);
    ctx.clearRect(0,0,canvas.width,canvas.height);

    yaw += 0.0016;

    for(let i=0;i<dots.length;i++){ const d=dots[i]; d.cur+=(d.r-d.cur)*0.04; }
    const pts = dots.map(d=>{
      const [dx,dy,dz]=d.dir;
      const x=dx*d.cur, y=dy*d.cur, z=dz*d.cur;
      const Rw = rotXYZ(x,y,z);
      const P  = proj(...Rw);
      return { z:Rw[2], X:P[0], Y:P[1], s:P[2]*d.size*DPR, col:d.col, r:d.r };
    }).sort((a,b)=>a.z-b.z);

    ctx.globalCompositeOperation='lighter';
    for(const p of pts){
      const ob=Math.min(1,Math.max(0,(p.r-1.4)/0.6));
      ctx.globalAlpha=0.25+0.55*ob;
      ctx.beginPath();
      ctx.arc(p.X,p.Y,Math.max(0.6*DPR,p.s),0,Math.PI*2);
      ctx.fillStyle=p.col;
      ctx.fill();
    }
    ctx.globalAlpha=1;
    ctx.globalCompositeOperation='source-over';

    drawShellAndAxes();

    requestAnimationFrame(render);
  }
  requestAnimationFrame(render);

  // ---- external hook for events (20s auto-show) ----------------------------
  window.HH_QUASAR = window.HH_QUASAR || {};
  window.HH_QUASAR.blockEvent = function({poolWon=false}){
    autoShowLegendFor(20000);
  };
})();




