// Charts for the AI case studies: certainty bars and the growth / fall-from-peak chart.
document.documentElement.classList.add('js');
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const onEnter = (el, fn, threshold = 0.3) => {
  if (reduced) return fn();
  new IntersectionObserver((es, io) => es.forEach(e => { if (e.isIntersecting) { requestAnimationFrame(fn); io.disconnect(); } }), { threshold }).observe(el);
};

// "How sure can we be the advantage is real?": bars filled to their value, against the bar set in advance.
export function certainty(host) {
  const fills = [...host.querySelectorAll('.fill')];
  const show = () => fills.forEach(f => { f.style.width = f.dataset.v + '%'; });
  if (reduced) show(); else onEnter(host, show);
}

// Growth of $1 (log scale) and the fall from the previous peak, strategy vs buy & hold.
export function growth(host, tip, D, labels) {
  const pts = D.pts.map(([d, bh, h6, ddb, ddh]) => ({ t: Date.parse(d + 'T00:00:00Z'), d, bh, h6, ddb, ddh }));
  const fmtX = v => '×' + (v >= 100 ? Math.round(v).toLocaleString('en-US') : v >= 10 ? v.toFixed(0) : v.toFixed(1));
  const fmtDate = d => new Date(d + 'T00:00:00Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
  let geo = null;
  function draw() {
    const W = Math.max(300, host.clientWidth), narrow = W < 640;
    const padL = 46, padR = narrow ? 8 : 132, padT = 40, H1 = Math.round(Math.max(220, Math.min(400, W * 0.44))), gap = 22, H2 = Math.round(H1 * 0.42), axB = 26;
    const H = padT + H1 + gap + H2 + axB;
    const t0 = pts[0].t, t1 = pts[pts.length - 1].t;
    const x = t => padL + (t - t0) / (t1 - t0) * (W - padL - padR);
    const lmax = 4.3, y1 = v => padT + (1 - Math.log10(v) / lmax) * H1;
    const top2 = padT + H1 + gap, y2 = v => top2 + (-v / 90) * H2;
    const path = (k, yf) => pts.map((p, i) => (i ? 'L' : 'M') + x(p.t).toFixed(1) + ' ' + yf(p[k]).toFixed(1)).join('');
    const band = (a, b, name, years, op) => { const xa = x(Date.parse(a)), xb = x(Math.min(Date.parse(b), t1)); return `<rect x="${xa}" y="${padT}" width="${xb - xa}" height="${H1 + gap + H2}" fill="rgba(228,236,233,${op})"/><line x1="${xa}" x2="${xa}" y1="${padT - 34}" y2="${padT}" stroke="rgba(228,236,233,.18)"/><text class="band-l" x="${xa + 6}" y="${padT - 22}">${name}</text><text class="ax" x="${xa + 6}" y="${padT - 8}">${years}</text>`; };
    let s = `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" aria-hidden="true">`;
    s += band('2013-01-01', '2019-01-01', narrow ? 'Built' : 'Built on', '2013–18', 0) + band('2019-01-01', '2022-01-01', narrow ? 'Check' : 'Checked on', '2019–21', .035) + band('2022-01-01', '2026-12-31', narrow ? 'Test' : 'Final test', '2022–26', .06);
    [1, 10, 100, 1000, 10000].forEach(v => { const yy = y1(v); s += `<line x1="${padL}" x2="${W - padR}" y1="${yy}" y2="${yy}" stroke="rgba(228,236,233,.08)"/><text class="ax" x="${padL - 8}" y="${yy + 4}" text-anchor="end">${v >= 1000 ? v / 1000 + 'K' : v}</text>`; });
    [0, -30, -60, -90].forEach(v => { const yy = y2(v); s += `<line x1="${padL}" x2="${W - padR}" y1="${yy}" y2="${yy}" stroke="rgba(228,236,233,.08)"/><text class="ax" x="${padL - 8}" y="${yy + 4}" text-anchor="end">${v}%</text>`; });
    for (let yr = 2014; yr <= 2026; yr += narrow ? 4 : 2) { const xx = x(Date.parse(yr + '-01-01')); s += `<text class="ax" x="${xx}" y="${H - 6}" text-anchor="middle">${yr}</text>`; }
    const area = k => path(k, y2) + `L${x(t1)} ${y2(0)}L${x(t0)} ${y2(0)}Z`;
    s += `<path d="${area('ddb')}" fill="rgba(95,111,117,.16)"/><path d="${area('ddh')}" fill="rgba(26,154,228,.10)"/>`;
    s += `<path class="draw" d="${path('ddb', y2)}" fill="none" stroke="var(--bench)" stroke-width="1.5" stroke-linejoin="round"/>`;
    s += `<path class="draw" d="${path('ddh', y2)}" fill="none" stroke="var(--cyan)" stroke-width="1.5" stroke-linejoin="round"/>`;
    s += `<path class="draw" d="${path('bh', y1)}" fill="none" stroke="var(--bench)" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>`;
    s += `<path class="draw" d="${path('h6', y1)}" fill="none" stroke="var(--cyan)" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>`;
    const last = pts[pts.length - 1];
    [['bh', 'var(--bench)', labels.bh, '×6,300'], ['h6', 'var(--cyan)', labels.h6, '×1,900']].forEach(([k, c, n, v]) => {
      const yy = y1(last[k]);
      s += `<circle cx="${x(last.t)}" cy="${yy}" r="4" fill="${c}" stroke="var(--deep)" stroke-width="2"/>`;
      if (!narrow) s += `<text class="end" x="${x(last.t) + 12}" y="${yy - 2}">${v}</text><text class="end2" x="${x(last.t) + 12}" y="${yy + 14}">${n}</text>`;
    });
    const minOf = k => pts.reduce((m, p) => (p[k] < m[k] ? p : m), pts[0]);
    [['ddb', 'var(--bench)', '−85%'], ['ddh', 'var(--cyan)', '−54%']].forEach(([k, c, lab]) => { const p = minOf(k); s += `<circle cx="${x(p.t)}" cy="${y2(p[k])}" r="4" fill="${c}" stroke="var(--deep)" stroke-width="2"/><text class="end" x="${x(p.t) + 9}" y="${y2(p[k]) + 4}">${lab}</text>`; });
    s += `<line id="xh" x1="0" x2="0" y1="${padT}" y2="${padT + H1 + gap + H2}" stroke="rgba(228,236,233,.35)" opacity="0"/>`;
    s += `<circle id="d1" r="4" fill="var(--cyan)" stroke="var(--deep)" stroke-width="2" opacity="0"/><circle id="d2" r="4" fill="var(--bench)" stroke="var(--deep)" stroke-width="2" opacity="0"/></svg>`;
    host.innerHTML = s;
    host.querySelectorAll('.draw').forEach(p => p.style.setProperty('--len', Math.ceil(p.getTotalLength())));
    geo = { x, y1 };
  }
  function show(clientX) {
    const r = host.getBoundingClientRect(), mx = clientX - r.left;
    let best = 0, bd = Infinity;
    pts.forEach((p, i) => { const dx = Math.abs(geo.x(p.t) - mx); if (dx < bd) { bd = dx; best = i; } });
    const p = pts[best], xx = geo.x(p.t);
    const xh = host.querySelector('#xh'), d1 = host.querySelector('#d1'), d2 = host.querySelector('#d2');
    xh.setAttribute('x1', xx); xh.setAttribute('x2', xx); xh.setAttribute('opacity', 1);
    d1.setAttribute('cx', xx); d1.setAttribute('cy', geo.y1(p.h6)); d1.setAttribute('opacity', 1);
    d2.setAttribute('cx', xx); d2.setAttribute('cy', geo.y1(p.bh)); d2.setAttribute('opacity', 1);
    tip.innerHTML = `<b>${fmtDate(p.d)}</b>
      <div class="row"><span class="k"><i style="background:var(--cyan)"></i>${labels.h6}</span><b>${fmtX(p.h6)}</b></div>
      <div class="row"><span class="k"><i style="background:var(--bench)"></i>${labels.bh}</span><b>${fmtX(p.bh)}</b></div>
      <div class="row"><span>Down from the peak</span><span>${p.ddh}% · ${p.ddb}%</span></div>`;
    tip.classList.add('on');
    const fig = tip.offsetParent.getBoundingClientRect(), tw = tip.offsetWidth;
    let left = r.left - fig.left + xx + 14; if (left + tw > fig.width) left = r.left - fig.left + xx - tw - 14;
    tip.style.left = Math.max(0, left) + 'px'; tip.style.top = (r.top - fig.top + 30) + 'px';
  }
  const hide = () => { tip.classList.remove('on'); ['#xh', '#d1', '#d2'].forEach(q => host.querySelector(q)?.setAttribute('opacity', 0)); };
  draw();
  host.addEventListener('pointermove', e => show(e.clientX));
  host.addEventListener('pointerdown', e => show(e.clientX));
  host.addEventListener('pointerleave', hide);
  let rw = host.clientWidth;
  new ResizeObserver(() => { if (Math.abs(host.clientWidth - rw) > 2) { rw = host.clientWidth; draw(); host.classList.add('drawn'); } }).observe(host);
  onEnter(host, () => host.classList.add('drawn'), 0.25);
}

