// Depth beyond the wall. After the crossing the visitor is on the far side, so the wall is now behind them:
// a fixed canvas under the chapters paints each band's surface and, through it, the membrane seen from behind,
// in three layers that scroll slower than the page and drift on their own. Quiet on purpose.
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

export function depth(canvas) {
  const ctx = canvas.getContext('2d', { alpha: false });
  if (!ctx) return;
  document.documentElement.classList.add('depth-on');
  const bands = [...document.querySelectorAll('.band')];
  const COL = { dark: { fill: '#021C2A', glow: '#082B3F', line: [228, 236, 233], mul: 1.5 }, light: { fill: '#F5F7F6', glow: '#FFFFFF', line: [0, 72, 111], mul: 1 } };
  // Three layers, far to near: a parallax factor (how much slower than the page), a wave, and an alpha.
  const LAYERS = [
    { par: 0.08, rows: 9, amp: 26, freq: 0.0046, alpha: 0.05, drift: 0.05 },
    { par: 0.16, rows: 7, amp: 40, freq: 0.0031, alpha: 0.07, drift: 0.08 },
    { par: 0.28, rows: 5, amp: 58, freq: 0.0022, alpha: 0.09, drift: 0.12 },
  ];
  let w = 0, h = 0, dpr = 1, t0 = performance.now(), raf = 0, lastY = -1, lastT = 0;

  function size() {
    dpr = Math.min(2, devicePixelRatio || 1);
    w = innerWidth; h = innerHeight;
    canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function draw(now) {
    raf = 0;
    const t = reduced ? 0 : (now - t0) / 1000, y = scrollY;
    ctx.fillStyle = COL.dark.fill; ctx.fillRect(0, 0, w, h);
    for (const band of bands) {
      const r = band.getBoundingClientRect();
      if (r.bottom <= 0 || r.top >= h) continue;
      const kind = band.dataset.surface === 'light' ? 'light' : 'dark', c = COL[kind];
      const top = Math.max(0, r.top), bottom = Math.min(h, r.bottom);
      ctx.save();
      ctx.beginPath(); ctx.rect(0, top, w, bottom - top); ctx.clip();
      // The surface, lit from the middle: a slow falloff that makes the band read as space, not as paint.
      const g = ctx.createRadialGradient(w * 0.55, top + (bottom - top) * 0.45, 0, w * 0.55, top + (bottom - top) * 0.45, Math.max(w, h) * 0.85);
      g.addColorStop(0, c.glow); g.addColorStop(1, c.fill);
      ctx.fillStyle = g; ctx.fillRect(0, top, w, bottom - top);
      // The wall, seen from behind: rows of lines, far layers moving less than near ones.
      ctx.lineWidth = 1;
      for (const L of LAYERS) {
        ctx.strokeStyle = `rgba(${c.line[0]},${c.line[1]},${c.line[2]},${L.alpha * c.mul})`;
        const off = -(y * L.par) % (h * 1.6);
        for (let i = -1; i <= L.rows; i++) {
          const by = off + (i / L.rows) * h * 1.6 + h * 0.3;
          ctx.beginPath();
          for (let x = -20; x <= w + 20; x += 14) {
            const yy = by + Math.sin(x * L.freq + t * L.drift + i * 1.7) * L.amp + Math.sin(x * L.freq * 2.7 - t * L.drift * 0.6 + i) * L.amp * 0.3;
            x < 0 ? ctx.moveTo(x, yy) : ctx.lineTo(x, yy);
          }
          ctx.stroke();
        }
      }
      ctx.restore();
    }
  }

  function tick(now) {
    // Redraw on scroll, on resize, and (without reduced motion) a few times a second while a band is on screen, for the drift.
    const moved = scrollY !== lastY, due = !reduced && now - lastT > 90;
    if (moved || due) { lastY = scrollY; lastT = now; draw(now); }
    raf = requestAnimationFrame(tick);
  }
  const start = () => { if (!raf) raf = requestAnimationFrame(tick); };
  const stop = () => { if (raf) { cancelAnimationFrame(raf); raf = 0; } };

  size(); draw(performance.now());
  addEventListener('resize', () => { size(); draw(performance.now()); }, { passive: true });
  document.addEventListener('visibilitychange', () => (document.hidden ? stop() : start()));
  start();
}
