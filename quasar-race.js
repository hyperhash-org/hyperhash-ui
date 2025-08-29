// Hyper-Hash Quasar Race Widget — v12.3 (legend + axes)
(function () {
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

  let yaw = 0, pitch = 0, zoom = 340;
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

  function drawSphere(time) {
    const a = 0.22 + 0.28 * Math.sin(time * 0.0016);
    ctx.strokeStyle = `rgba(34,52,71,${Math.min(0.8, a)})`;
    ctx.lineWidth = 1 * DPR;

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

  // --- overlays ---
  function drawLegend() {
    const pad = 10 * DPR, lh = 16 * DPR, sw = 10 * DPR, gap = 8 * DPR;
    const x = 12 * DPR, y = 12 * DPR;

    // background panel
    const entries = ['SV1', 'SV1 Hyper', 'SV2', 'SV2 Hyper'];
    const w = 150 * DPR, h = (entries.length * (lh + 4 * DPR)) + pad * 2 - 4 * DPR;
    ctx.save();
    ctx.globalAlpha = 0.9;
    ctx.fillStyle = 'rgba(10,16,22,0.8)';
    ctx.strokeStyle = 'rgba(20,32,44,0.9)';
    ctx.lineWidth = 1 * DPR;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 8 * DPR);
    ctx.fill();
    ctx.stroke();

    // rows
    ctx.font = `${12 * DPR}px system-ui, -apple-system, Segoe UI, Roboto`;
    ctx.textBaseline = 'middle';
    ctx.globalAlpha = 1;

    const rows = [
      ['SV1', LCOL.SV1],
      ['SV1 Hyper', LCOL.SV1H],
      ['SV2', LCOL.SV2],
      ['SV2 Hyper', LCOL.SV2H],
    ];
    let yy = y + pad + lh / 2;
    for (const [label, col] of rows) {
      // color swatch
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.arc(x + pad + sw / 2, yy, sw / 2, 0, Math.PI * 2);
      ctx.fill();

      // label
      ctx.fillStyle = '#cfe3f7';
      ctx.fillText(label, x + pad + sw + gap, yy);
      yy += lh + 4 * DPR;
    }
    ctx.restore();
  }

  function drawAxes() {
    // axis vectors in model space
    const axisLen = 1.2;
    const origin = proj(...rotXYZ(0, 0, 0));
    const X = proj(...rotXYZ(axisLen, 0, 0));
    const Y = proj(...rotXYZ(0, axisLen, 0));
    const Z = proj(...rotXYZ(0, 0, axisLen));

    const o = { x: origin[0], y: origin[1] };
    const axes = [
      { to: { x: X[0], y: X[1] }, col: '#9bb8ff', label: 'X' },
      { to: { x: Y[0], y: Y[1] }, col: '#9af2b8', label: 'Y' },
      { to: { x: Z[0], y: Z[1] }, col: '#ffd38a', label: 'Z' },
    ];

    ctx.save();
    ctx.lineWidth = 1.5 * DPR;
    ctx.lineCap = 'round';
    ctx.font = `${11 * DPR}px system-ui, -apple-system, Segoe UI, Roboto`;
    ctx.textBaseline = 'middle';

    // move axes to lower-right corner slightly inset
    const inset = 80 * DPR;
    const base = { x: canvas.width - inset, y: canvas.height - inset };
    const centerShift = { x: base.x - o.x, y: base.y - o.y };

    axes.forEach(a => {
      const tx = a.to.x + centerShift.x;
      const ty = a.to.y + centerShift.y;

      // line
      ctx.strokeStyle = a.col;
      ctx.globalAlpha = 0.9;
      ctx.beginPath();
      ctx.moveTo(base.x, base.y);
      ctx.lineTo(tx, ty);
      ctx.stroke();

      // arrow head
      const vx = tx - base.x, vy = ty - base.y;
      const vlen = Math.max(0.0001, Math.hypot(vx, vy));
      const ux = vx / vlen, uy = vy / vlen;
      const head = 6 * DPR, side = 4 * DPR;
      ctx.beginPath();
      ctx.moveTo(tx, ty);
      ctx.lineTo(tx - ux * head + -uy * side, ty - uy * head + ux * side);
      ctx.lineTo(tx - ux * head + uy * side, ty - uy * head + -ux * side);
      ctx.closePath();
      ctx.fillStyle = a.col;
      ctx.fill();

      // label
      ctx.fillStyle = '#cfe3f7';
      ctx.globalAlpha = 0.9;
      ctx.fillText(a.label, tx + 6 * DPR, ty);
    });

    ctx.restore();
  }

  function render(time) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // sphere + dots
    yaw += 0.0016;
    drawSphere(time || 0);
    for (let i = 0; i < dots.length; i++) {
      const d = dots[i];
      d.cur += (d.r - d.cur) * 0.04;
    }
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

    // overlays last
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    drawLegend();
    drawAxes();

    requestAnimationFrame(render);
  }

  requestAnimationFrame(render);
})();

