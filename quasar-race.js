// Hyper-Hash Quasar Race Widget — v12.8
// - Shell OFF by default; "Legend" button toggles half-brightness shell.
// - Axes (white) & lane legend only visible when shell is ON (manual or event).
// - Block events: 20s green/red shell, then OFF.
// - Demo/Live via window.HH_QUASAR = { mode: 'demo'|'live', feed: 'wss://...' }
// - Score-based radius (further out = closer to target).

(function () {
  const cfg  = (window.HH_QUASAR || {});
  const mode = (cfg.mode || 'demo'); // 'demo' | 'live'
  const FEED = cfg.feed;

  const mount = document.getElementById('quasar-wrap');
  if (!mount) return;

  // wrapper
  const wrap = document.createElement('div');
  wrap.style.position = 'relative';
  wrap.style.width = '100%';
  wrap.style.height = '100%';
  mount.appendChild(wrap);

  // canvas
  const canvas = document.createElement('canvas');
  canvas.style.width = '100%';
  canvas.style.height = '100%';
  wrap.appendChild(canvas);
  const ctx = canvas.getContext('2d');
  let DPR = Math.min(window.devicePixelRatio || 1, 2);

  function resize() {
    const r = wrap.getBoundingClientRect();
    canvas.width = Math.floor(r.width * DPR);
    canvas.height = Math.floor(r.height * DPR);
  }
  new ResizeObserver(resize).observe(wrap);
  resize();

  // ---- UI overlay: "Legend" button + lane legend (hidden when shell off) ----
  const LCOL = { SV1: '#66d9ef', SV1H: '#f92672', SV2: '#fd971f', SV2H: '#a6e22e' };
  const LANES = ['SV1', 'SV1H', 'SV2', 'SV2H'];

  const panel = document.createElement('div');
  panel.style.position = 'absolute';
  panel.style.top = '12px';
  panel.style.left = '12px';
  panel.style.padding = '10px 12px';
  panel.style.border = '1px solid rgba(124, 209, 255, 0.35)';
  panel.style.borderRadius = '10px';
  panel.style.background = 'rgba(10,16,22,0.70)';
  panel.style.backdropFilter = 'blur(2px)';
  panel.style.color = '#cfe3f7';
  panel.style.font = '12px system-ui, -apple-system, Segoe UI, Roboto, sans-serif';
  panel.style.userSelect = 'none';
  wrap.appendChild(panel);

  // "Legend" button (on top)
  const legendBtn = document.createElement('button');
  legendBtn.textContent = 'Legend';
  legendBtn.style.display = 'block';
  legendBtn.style.width = '100%';
  legendBtn.style.padding = '6px 10px';
  legendBtn.style.border = '1px solid rgba(124,209,255,0.35)';
  legendBtn.style.borderRadius = '8px';
  legendBtn.style.background = 'rgba(20,28,36,0.8)';
  legendBtn.style.color = '#cfe3f7';
  legendBtn.style.cursor = 'pointer';
  legendBtn.onmouseenter = () => (legendBtn.style.background = 'rgba(26,34,44,0.9)');
  legendBtn.onmouseleave = () => (legendBtn.style.background = 'rgba(20,28,36,0.8)');
  panel.appendChild(legendBtn);

  // Legend rows container (hidden when shell is OFF)
  const legendRows = document.createElement('div');
  legendRows.style.marginTop = '10px';
  panel.appendChild(legendRows);

  LANES.forEach(key => {
    const row = document.createElement('div');
    row.style.display = 'flex';
    row.style.alignItems = 'center';
    row.style.gap = '8px';
    row.style.margin = '4px 0';
    const dot = document.createElement('span');
    dot.style.display = 'inline-block';
    dot.style.width = '10px';
    dot.style.height = '10px';
    dot.style.borderRadius = '50%';
    dot.style.background = LCOL[key];
    const label = document.createElement('span');
    label.textContent = (key === 'SV1H') ? 'SV1 Hyper' : (key === 'SV2H') ? 'SV2 Hyper' : key;
    row.appendChild(dot); row.appendChild(label);
    legendRows.appendChild(row);
  });

  // Manual toggle (shell off by default)
  let legendManualOn = false;            // user toggle controls shell/axes/legend visibility
  legendBtn.addEventListener('click', () => {
    legendManualOn = !legendManualOn;
    updatePanelActive(legendManualOn);
  });

  function updatePanelActive(active) {
    legendBtn.style.borderColor = active ? '#7cd1ff' : 'rgba(124,209,255,0.35)';
    panel.style.borderColor = active ? 'rgba(124,209,255,0.8)' : 'rgba(124,209,255,0.35)';
    panel.style.boxShadow = active ? '0 0 0 1px rgba(124,209,255,0.25) inset' : 'none';
  }
  updatePanelActive(false); // initial

  // camera & interaction
  let yaw = 0, pitch = 0, zoom = 340;
  let dragging = false, lx = 0, ly = 0;
  const ZOOM_MIN = 60, ZOOM_MAX = 1200;

  wrap.addEventListener('wheel', e => {
    e.preventDefault();
    const d = Math.sign(e.deltaY);
    const mult = e.shiftKey ? 0.16 : 0.08;
    zoom *= (1 - d * mult);
    zoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, zoom));
  }, { passive: false });

  let zoomToggleIn = true;
  wrap.addEventListener('dblclick', () => {
    zoom = zoomToggleIn ? ZOOM_MIN * 1.2 : 340;
    zoomToggleIn = !zoomToggleIn;
  });

  canvas.addEventListener('pointerdown', e => { dragging = true; lx = e.clientX; ly = e.clientY; });
  window.addEventListener('pointerup', () => (dragging = false));
  window.addEventListener('pointermove', e => {
    if (!dragging) return;
    const dx = e.clientX - lx, dy = e.clientY - ly;
    lx = e.clientX; ly = e.clientY;
    yaw += dx * 0.003;
    pitch += dy * 0.003;
    pitch = Math.max(-1.2, Math.min(1.2, pitch));
  });

  // math helpers
  function randDir() {
    const u = Math.random(), v = Math.random();
    const t = 2 * Math.PI * u, p = Math.acos(2 * v - 1);
    return [Math.sin(p) * Math.cos(t), Math.cos(p)];
  }
  function randDir() { // corrected 3D
    const u = Math.random(), v = Math.random();
    const t = 2 * Math.PI * u, p = Math.acos(2 * v - 1);
    return [Math.sin(p) * Math.cos(t), Math.sin(p) * Math.sin(t), Math.cos(p)];
  }
  function rotXYZ(x, y, z) {
    const cy = Math.cos(yaw), sy = Math.sin(yaw);
    const cx = Math.cos(pitch), sx = Math.sin(pitch);
    let X = x * cy + z * sy;
    let Z = -x * sy + z * cy;
    let Y = y * cx - Z * sx;
    Z = y * sx + Z * cx;
    return [X, Y, Z];
  }
  function proj(x, y, z) {
    const cx = canvas.width / 2, cy = canvas.height / 2;
    const f = zoom / (1 + 2 * (z + 2));
    return [cx + x * f, cy - y * f, f / 300];
  }

  // ------- score mapping (further out = better share) -------
  function scoreToRadius(score) {
    const s = Math.max(0, Math.min(1, +score || 0));
    const gamma = 0.55;
    const eased = Math.pow(s, gamma);
    return 0.05 + eased * 1.95;   // 0.05..2.0 (surface)
  }
  function ratioFromHashAndTarget(hashHex, targetHex) {
    try {
      const H = BigInt('0x' + hashHex), T = BigInt('0x' + targetHex);
      if (H <= 0n) return 1;
      let r = Number(T) / Number(H);
      if (!isFinite(r)) r = 1;
      return Math.max(0, Math.min(1, r));
    } catch { return 0; }
  }
  function normalizeShare(msg, netLeadingBitsHint) {
    if (typeof msg.ratio === 'number') return Math.max(0, Math.min(1, msg.ratio));
    if (typeof msg.leadingZeroBits === 'number') {
      const net = typeof netLeadingBitsHint === 'number' ? netLeadingBitsHint : 68;
      return Math.max(0, Math.min(1, msg.leadingZeroBits / net));
    }
    if (msg.hash && msg.target) return ratioFromHashAndTarget(msg.hash, msg.target);
    return 0;
  }

  // ------- dots -------
  let dots = [];
  function addDot(laneOpt, scoreOpt) {
    const dir = randDir();
    const lane = laneOpt || LANES[(Math.random() * 4) | 0];
    const col = LCOL[lane] || '#7cd1ff';
    const score = typeof scoreOpt === 'number' ? scoreOpt : Math.random() * 0.25;
    const r = scoreToRadius(score);
    const size = 0.6 + score * 2.0;
    dots.push({ dir, r, cur: 0.02, size, col });
    if (dots.length > 14000) dots.shift();
  }
  if (mode !== 'live') {
    for (let i = 0; i < 1400; i++) addDot();
    setInterval(addDot, 26);
  }

  // ------- shell & axes -------
  const R = 2, steps = 220, nlat = 24, nlon = 24;
  const AXIS_COLOR = 'rgba(255,255,255,0.85)'; // white axes
  const SHELL_BASE_RGBA = 'rgba(34,52,71,0.5)'; // half brightness

  function drawShell(color) {
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.2 * DPR;

    // latitude
    for (let j = 1; j <= nlat; j++) {
      const phi = -Math.PI / 2 + (j * (Math.PI / (nlat + 1)));
      ctx.beginPath();
      for (let i = 0; i <= steps; i++) {
        const t = i / steps * 2 * Math.PI;
        const x = R * Math.cos(phi) * Math.cos(t);
        const y = R * Math.sin(phi);
        const z = R * Math.cos(phi) * Math.sin(t);
        const [X, Y] = proj(...rotXYZ(x, y, z));
        if (i === 0) ctx.moveTo(X, Y); else ctx.lineTo(X, Y);
      }
      ctx.stroke();
    }
    // longitude
    for (let j = 0; j < nlon; j++) {
      const t0 = j / nlon * 2 * Math.PI;
      ctx.beginPath();
      for (let i = 0; i <= steps; i++) {
        const p = -Math.PI / 2 + i / steps * Math.PI;
        const x = R * Math.cos(p) * Math.cos(t0);
        const y = R * Math.sin(p);
        const z = R * Math.cos(p) * Math.sin(t0);
        const [X, Y] = proj(...rotXYZ(x, y, z));
        if (i === 0) ctx.moveTo(X, Y); else ctx.lineTo(X, Y);
      }
      ctx.stroke();
    }
  }

  function drawInnerAxes() {
    const [ox, oy] = proj(...rotXYZ(0, 0, 0));
    ctx.save();
    ctx.lineWidth = 1.4 * DPR;
    ctx.font = `${12 * DPR}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';

    const axes = [
      { vec: rotXYZ(2.0, 0, 0), label: 'Nonce'  },
      { vec: rotXYZ(0, 2.0, 0), label: 'Time'   },
      { vec: rotXYZ(0, 0, 2.0), label: 'Merkle' },
    ];
    axes.forEach(a => {
      const [ax, ay] = proj(...a.vec);
      ctx.strokeStyle = AXIS_COLOR;
      ctx.globalAlpha = 1;
      ctx.beginPath(); ctx.moveTo(ox, oy); ctx.lineTo(ax, ay); ctx.stroke();
      ctx.fillStyle = AXIS_COLOR;
      ctx.fillText(a.label, ax, ay - 6 * DPR);
    });
    ctx.restore();
  }

  // ------- live feed (20s event shell) -------
  let eventShellUntil = 0;
  let eventShellColor = null;
  const EVENT_MS = 20000;

  function handleEvent(msg) {
    if (!msg || typeof msg !== 'object') return;

    if (msg.type === 'share') {
      const score = normalizeShare(msg, 68);
      addDot(msg.lane, score);

    } else if (msg.type === 'burst') {
      const n = Math.max(1, Math.min(200, msg.count | 0));
      const score = normalizeShare(msg, 68);
      for (let i = 0; i < n; i++) addDot(msg.lane, score || Math.random() * 0.25);

    } else if (msg.type === 'block') {
      const ours = (msg.pool || '').toUpperCase() === 'HH';
      eventShellColor = ours ? '#15d17c' : '#ff4d4d';
      eventShellUntil = Date.now() + EVENT_MS;
      // celebratory burst
      for (let i = 0; i < 120; i++) addDot(msg.lane, 1);
    }
  }

  if (mode === 'live' && typeof WebSocket !== 'undefined' && FEED) {
    try {
      const ws = new WebSocket(FEED);
      ws.onmessage = (e) => { try { handleEvent(JSON.parse(e.data)); } catch {} };
      ws.onerror = () => {};
      ws.onclose = () => {};
    } catch {}
  }

  // legend visibility state
  let lastLegendShown = null;
  function setLegendVisible(v) {
    if (v === lastLegendShown) return;
    legendRows.style.display = v ? 'block' : 'none';
    panel.style.borderColor = v ? 'rgba(124,209,255,0.8)' : 'rgba(124,209,255,0.35)';
    panel.style.boxShadow = v ? '0 0 0 1px rgba(124,209,255,0.25) inset' : 'none';
    lastLegendShown = v;
  }
  setLegendVisible(false);

  // ------- render loop -------
  function render(time) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    yaw += 0.0016;

    // Shell state: event → ON, else manual → ON, else OFF
    const now = Date.now();
    let shellToDraw = null;
    if (now < eventShellUntil && eventShellColor) {
      shellToDraw = eventShellColor;       // forced ON during 20s event window
    } else if (legendManualOn) {
      shellToDraw = SHELL_BASE_RGBA;       // half-brightness if user toggled
    }

    // draw shell & axes only when active
    if (shellToDraw) {
      drawShell(shellToDraw);
      drawInnerAxes();
      setLegendVisible(true);
    } else {
      setLegendVisible(false);
    }

    // dots animation
    for (let i = 0; i < dots.length; i++) {
      const d = dots[i];
      d.cur += (d.r - d.cur) * 0.04;
    }

    // depth sort & draw dots
    const pts = dots.map(d => {
      const [dx, dy, dz] = d.dir;
      const x = dx * d.cur, y = dy * d.cur, z = dz * d.cur;
      const Rv = rotXYZ(x, y, z);
      const P = proj(...Rv);
      return { z: Rv[2], X: P[0], Y: P[1], s: P[2] * d.size * DPR, col: d.col, r: d.r };
    }).sort((a, b) => a.z - b.z);

    ctx.globalCompositeOperation = 'lighter';
    for (const p of pts) {
      const ob = Math.min(1, Math.max(0, (p.r - 1.4) / 0.6));
      ctx.globalAlpha = 0.25 + 0.55 * ob;
      ctx.beginPath();
      ctx.arc(p.X, p.Y, Math.max(0.6 * DPR, p.s), 0, Math.PI * 2);
      ctx.fillStyle = p.col;
      ctx.fill();
    }

    requestAnimationFrame(render);
  }
  requestAnimationFrame(render);

  // tiny manual API for testing
  window.HHQuasar = {
    add: (lane, score) => addDot(lane || 'SV1', typeof score === 'number' ? score : undefined),
    share: (lane, ratio) => handleEvent({ type: 'share', lane: lane || 'SV1', ratio: +ratio || 0 }),
    block: (lane, ours=true) => handleEvent({ type: 'block', lane: lane || 'SV1', pool: ours ? 'HH' : 'OTHER' })
  };
})();

