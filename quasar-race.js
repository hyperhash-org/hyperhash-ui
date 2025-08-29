// Hyper-Hash Quasar Race Widget — v12.2 bugfix
(function () {
  const mount = document.getElementById('quasar-wrap');
  if (!mount) return;

  // create wrapper and append it to mount
  const wrap = document.createElement('div');
  wrap.style.position = 'relative';
  wrap.style.width = '100%';
  wrap.style.height = '100%';
  mount.appendChild(wrap);

  // create canvas
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

  let yaw = 0, pitch = 0, zoom = 340, baseZoom = 340;
  let dragging = false, lx = 0, ly = 0;

  wrap.addEventListener('wheel', e => {
    e.preventDefault();
    const d = Math.sign(e.deltaY);
    zoom *= (1 - d * 0.08);
    zoom = Math.max(180, Math.min(900, zoom));
  }, { passive: false });

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

  const LCOL = { SV1: '#66d9ef', SV1H: '#f92672', SV2: '#fd971f', SV2H: '#a6e22e' };
  const LANES = ['SV1', 'SV1H', 'SV2', 'SV2H'];
  let dots = [];

  function randDir() {
    const u = Math.random(), v = Math.random();
    const t = 2 * Math.PI * u, p = Math.acos(2 * v - 1);
    return [Math.sin(p) * Math.cos(t), Math.sin(p) * Math.sin(t), Math.cos(p)];
  }

  function addDot() {
    const bits = (Math.random() * 32) | 0;
    const r = 0.05 + (bits / 32) * 1.95;
    const dir = randDir();
    const lane = LANES[(Math.random() * 4) | 0];
    const col = LCOL[lane];
    const size = 0.6 + (bits / 32) * 2.0;
    dots.push({ dir, r, cur: 0.02, size, col });
    if (dots.length > 14000) dots.shift();
  }

  for (let i = 0; i < 1400; i++) addDot();
  setInterval(addDot, 26);

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

  const R = 2, steps = 220, nlat = 24, nlon = 24;
  let eventGlowColor = null, eventGlowUntil = 0, eventPulse = 0;

  function drawSphere(time) {
    const now = Date.now();
    const glowing = eventGlowColor && now < eventGlowUntil;
    if (glowing) {
      ctx.strokeStyle = eventGlowColor;
      ctx.lineWidth = 2 * DPR;
    } else {
      const a = 0.22 + 0.28 * Math.sin(time * 0.0016) + eventPulse * 0.4;
      ctx.strokeStyle = `rgba(34,52,71,${Math.min(0.8, a)})`;
      ctx.lineWidth = 1 * DPR;
    }

    for (let j = 1; j <= nlat; j++) {
      const phi = -Math.PI / 2 + (j * (Math.PI / (nlat + 1)));
      ctx.beginPath();
      for (let i = 0; i <= steps; i++) {
        const t = i / steps * 2 * Math.PI;
        const x = R * Math.cos(phi) * Math.cos(t);
        const y = R * Math.sin(phi);
        const z = R * Math.cos(phi) * Math.sin(t);
        const [X, Y] = proj(...rotXYZ(x, y, z));
        if (i === 0) ctx.moveTo(X, Y);
        else ctx.lineTo(X, Y);
      }
      ctx.stroke();
    }

    for (let j = 0; j < nlon; j++) {
      const t0 = j / nlon * 2 * Math.PI;
      ctx.beginPath();
      for (let i = 0; i <= steps; i++) {
        const p = -Math.PI / 2 + i / steps * Math.PI;
        const x = R * Math.cos(p) * Math.cos(t0);
        const y = R * Math.sin(p);
        const z = R * Math.cos(p) * Math.sin(t0);
        const [X, Y] = proj(...rotXYZ(x, y, z));
        if (i === 0) ctx.moveTo(X, Y);
        else ctx.lineTo(X, Y);
      }
      ctx.stroke();
    }
  }

  function render(time) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    yaw += 0.0016;
    drawSphere(time || 0);

    for (let i = 0; i < dots.length; i++) {
      const d = dots[i];
      d.cur += (d.r - d.cur) * 0.04;
    }

    const pts = dots.map(d => {
      const [dx, dy, dz] = d.dir;
      const x = dx * d.cur, y = dy * d.cur, z = dz * d.cur;
      const R = rotXYZ(x, y, z);
      const P = proj(...R);
      return { z: R[2], X: P[0], Y: P[1], s: P[2] * d.size * DPR, col: d.col, r: d.r };
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
})();
