// Hyper-Hash Quasar Race Widget — v12.6
// - Axes + legend use the SAME color as the shell (incl. green/red block glow)
// - Axes + legend only visible during pulse (fade with the pulse factor)
// - Pulse slowed (about half the previous rate)
// - Deeper zoom + dblclick toggle

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

  // camera & interaction
  let yaw = 0, pitch = 0, zoom = 340;
  let dragging = false, lx = 0, ly = 0;

  const ZOOM_MIN = 60;   // deeper than before (was ~180)
  const ZOOM_MAX = 1200; // let people step back more too

  wrap.addEventListener('wheel', e => {
    e.preventDefault();
    const d = Math.sign(e.deltaY);
    const mult = e.shiftKey ? 0.16 : 0.08; // Shift for faster zoom
    zoom *= (1 - d * mult);
    zoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, zoom));
  }, { passive: false });

  // double-click to toggle zoom in/out
  let zoomToggleIn = true;
  wrap.addEventListener('dblclick', () => {
    zoom = zoomToggleIn ? ZOOM_MIN * 1.2 : 340;
    zoomToggleIn = !zoomToggleIn;
  });

  canvas.addEventListener('pointerdown', e => { dragging = true; lx = e.clientX; ly = e.clientY; });
  window.addEventListener('pointerup', () => dragging = false);
  window.addEventListener('pointermove', e => {
    if (!dragging) return;
    const dx = e.clientX - lx, dy = e.clientY - ly;
    lx = e.clientX; ly = e.clientY;
    yaw += dx * 0.003;
    pitch += dy * 0.003;
    pitch = Math.max(-1.2, Math.min(1.2, pitch));
  });

  // lanes & colors
  const LCOL = { SV1: '#66d9ef', SV1H: '#f92672', SV2: '#fd971f', SV2H: '#a6e22e' };
  const LANES = ['SV1', 'SV1H', 'SV2', 'SV2H'];

  // dots pool
  let dots = [];

  // math helpers
  function randDir() {
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
    const gamma = 0.55;             // perceptual boost near the shell
    const eased = Math.pow(s, gamma);
    return 0.05 + eased * 1.95;     // 0.05..2.0 (surface)
  }

  function hexToLeadingZeroBits(hex) {
    if (!hex) return 0;
    let bits = 0;
    for (let i = 0; i < hex.length; i++) {
      const nib = parseInt(hex[i], 16);
      if (nib === 0) { bits += 4; continue; }
      if (nib < 2) bits += 3;
      else if (nib < 4) bits += 2;
      else if (nib < 8) bits += 1;
      return bits;
    }
    return bits;
  }

  function ratioFromHashAndTarget(hashHex, targetHex) {
    try {
      const H = BigInt('0x' + hashHex);
      const T = BigInt('0x' + targetHex);
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

  // initial fill in demo mode
  if (mode !== 'live') {
    for (let i = 0; i < 1400; i++) addDot();
    setInterval(addDot, 26);
  }

  // ------- sphere & pulse -------
  const R = 2, steps = 220, nlat = 24, nlon = 24;

  // Event pulse (green if we win, red if not), lasts 20s
  let glowColor = null, glowUntil = 0;
  let axisPulseUntil = 0;
  const PULSE_MS = 20000; // 20s

  // Base breathing pulse — slower than before (~half rate)
  const BASE_COLOR = [34, 52, 71];            // rgb for normal shell
  const PULSE_FREQ = 0.0008;                  // was ~0.0016
  let lastShellRGBA = `rgba(${BASE_COLOR.join(',')},0.5)`;
  let pulseAlpha = 0;                         // 0..1 visibility for overlays

  function drawSphere(time) {
    const now = Date.now();
    const isGlowing = glowColor && now < glowUntil;

    if (isGlowing) {
      ctx.strokeStyle = glowColor;
      ctx.lineWidth = 2 * DPR;
      lastShellRGBA = glowColor;
      pulseAlpha = 1; // max visibility during event
    } else {
      // base breathing
      const s = (Math.sin(time * PULSE_FREQ) + 1) / 2; // 0..1
      // visibility curve (keep low part mostly hidden)
      const vis = Math.max(0, Math.pow(s, 1.8) - 0.2) / 0.8; // ~0 when s small, to 1 near peaks
      pulseAlpha = Math.max(0, Math.min(1, vis));

      // stroke alpha tracks s softly
      const a = 0.18 + 0.52 * s; // 0.18..0.70
      ctx.strokeStyle = `rgba(${BASE_COLOR.join(',')},${a})`;
      ctx.lineWidth = (a > 0.5 ? 1.4 : 1.0) * DPR;
      lastShellRGBA = `rgba(${BASE_COLOR.join(',')},${Math.max(0.4, a)})`;
    }

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

  // ------- inner axes (Nonce / Time / Merkle) tied to pulse -------
  function drawInnerAxes() {
    // Hide when pulse is very low
    if (pulseAlpha < 0.2) return;

    const axisLen = 2.0; // up to shell
    const origin = rotXYZ(0, 0, 0);

    const axes = [
      { vec: rotXYZ(axisLen, 0, 0), label: 'Nonce'  },
      { vec: rotXYZ(0, axisLen, 0), label: 'Time'   },
      { vec: rotXYZ(0, 0, axisLen), label: 'Merkle' },
    ];

    ctx.save();
    ctx.lineWidth = (1.2 + 0.6 * pulseAlpha) * DPR;
    ctx.font = `${12 * DPR}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';

    const stroke = lastShellRGBA;
    const fill   = lastShellRGBA.replace('rgba', 'rgba'); // same color string

    const [ox, oy] = proj(...origin);

    axes.forEach(axis => {
      const [ax, ay] = proj(...axis.vec);

      // line
      ctx.strokeStyle = stroke;
      ctx.globalAlpha = 0.35 + 0.65 * pulseAlpha;
      ctx.beginPath();
      ctx.moveTo(ox, oy);
      ctx.lineTo(ax, ay);
      ctx.stroke();

      // label
      ctx.fillStyle = fill;
      ctx.globalAlpha = 0.45 + 0.55 * pulseAlpha;
      ctx.fillText(axis.label, ax, ay - 6 * DPR);
    });

    ctx.restore();
  }

  // ------- lane legend tied to pulse -------
  function drawLegend() {
    if (pulseAlpha < 0.2) return; // hidden when pulse low

    const pad = 10 * DPR, lh = 16 * DPR, sw = 10 * DPR, gap = 8 * DPR;
    const x = 12 * DPR, y = 12 * DPR;
    const entries = ['SV1', 'SV1 Hyper', 'SV2', 'SV2 Hyper'];
    const w = 150 * DPR, h = (entries.length * (lh + 4 * DPR)) + pad * 2 - 4 * DPR;

    ctx.save();
    // panel uses shell color but translucent
    ctx.globalAlpha = 0.25 + 0.55 * pulseAlpha;
    // parse lastShellRGBA alpha out? we can just use it as stroke/fill
    ctx.fillStyle = 'rgba(10,16,22,0.6)';
    ctx.strokeStyle = lastShellRGBA;
    ctx.lineWidth = 1 * DPR;
    (ctx.roundRect ? ctx.roundRect(x, y, w, h, 8 * DPR) : ctx.rect(x, y, w, h));
    ctx.fill(); ctx.stroke();

    ctx.font = `${12 * DPR}px system-ui, -apple-system, Segoe UI, Roboto`;
    ctx.textBaseline = 'middle';
    ctx.globalAlpha = 0.55 + 0.45 * pulseAlpha;

    const rows = [
      ['SV1', LCOL.SV1],
      ['SV1 Hyper', LCOL.SV1H],
      ['SV2', LCOL.SV2],
      ['SV2 Hyper', LCOL.SV2H],
    ];
    let yy = y + pad + lh / 2;
    for (const [label, col] of rows) {
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.arc(x + pad + sw / 2, yy, sw / 2, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#cfe3f7';
      ctx.fillText(label, x + pad + sw + gap, yy);
      yy += lh + 4 * DPR;
    }
    ctx.restore();
  }

  // ------- live feed -------
  function handleEvent(msg) {
    if (!msg || typeof msg !== 'object') return;

    if (msg.type === 'share') {
      const score = normalizeShare(msg, /*netLeadingBitsHint=*/68);
      addDot(msg.lane, score);

    } else if (msg.type === 'burst') {
      const n = Math.max(1, Math.min(200, msg.count | 0));
      const score = normalizeShare(msg, 68);
      for (let i = 0; i < n; i++) addDot(msg.lane, score || Math.random() * 0.25);

    } else if (msg.type === 'block') {
      const ours = (msg.pool || '').toUpperCase() === 'HH';
      glowColor = ours ? '#15d17c' /* green */ : '#ff4d4d' /* red */;
      const until = Date.now() + PULSE_MS; // 20s
      glowUntil = until;
      axisPulseUntil = until;

      // celebratory burst at shell
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

  // ------- render loop -------
  function render(time) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    yaw += 0.0016;
    drawSphere(time || 0);

    // animate dots toward target radius
    for (let i = 0; i < dots.length; i++) {
      const d = dots[i];
      d.cur += (d.r - d.cur) * 0.04;
    }

    // depth sort and draw
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

    // overlays (tied to pulse)
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    drawInnerAxes();
    drawLegend();

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

