// The four signatures, the same structures that stand behind the wall in the hero, drawn flat as each chapter's mark.
// Each is drawn into a 320×200 SVG when it enters the view (or at once under reduced motion).
document.documentElement.classList.add('js');
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

function rng(seed) { let s = seed; return () => ((s = (s * 16807) % 2147483647) / 2147483647); }
const f = n => (+n).toFixed(1);

// Business Intelligence: three layers, source → model → report. The source arrives broken; the report is whole.
function bi() {
  const R = rng(3), layers = [{ y: 160, s: 1.25, broken: true }, { y: 104, s: 1.0 }, { y: 48, s: 0.8 }], C = 6, G = 44;
  const at = (l, c) => [160 + (c - (C - 1) / 2) * G * l.s, l.y];
  let html = '', dots = '';
  layers.forEach((l, li) => {
    const a = at(l, 0), b = at(l, C - 1);
    if (l.broken) {
      const cut = 1 + Math.floor(R() * 3), p = at(l, cut), q = at(l, cut + 1);
      html += `<path d="M${f(a[0])} ${f(a[1])}L${f(p[0])} ${f(p[1])}" style="--dl:0s"/><path d="M${f(q[0])} ${f(q[1])}L${f(b[0])} ${f(b[1])}" style="--dl:.1s"/>`;
    } else html += `<path d="M${f(a[0])} ${f(a[1])}L${f(b[0])} ${f(b[1])}" style="--dl:${f(li * 0.25)}s"/>`;
    for (let c = 0; c < C; c++) if (!(l.broken && R() < 0.25)) { const p = at(l, c); dots += `<circle cx="${f(p[0])}" cy="${f(p[1])}" r="${li === 2 ? 3 : 2.4}"/>`; }
  });
  // Lineage: a few lines climb from the source to the report.
  [[1, 1], [3, 2], [4, 4], [0, 1]].forEach(([c0, c1], i) => {
    const a = at(layers[0], c0), m = at(layers[1], c1), b = at(layers[2], c1);
    html += `<path d="M${f(a[0])} ${f(a[1])}L${f(m[0])} ${f(m[1])}L${f(b[0])} ${f(b[1])}" style="--dl:${f(0.5 + i * 0.12)}s"/>`;
  });
  return html + dots;
}

// Artificial Intelligence: many lines converge on one point, information turned into one answer.
function ai() {
  const R = rng(7), fx = 268, fy = 112;
  let html = '';
  for (let i = 0; i < 44; i++) {
    const sx = R() * 150, sy = 10 + R() * 180;
    const c1x = sx + 60 + R() * 60, c1y = sy + (R() - .5) * 60, c2x = fx - 70 - R() * 40, c2y = fy + (sy - fy) * (0.25 + R() * 0.3);
    html += `<path d="M${f(sx)} ${f(sy)}C${f(c1x)} ${f(c1y)} ${f(c2x)} ${f(c2y)} ${fx} ${fy}" style="--dl:${f(R() * 0.5)}s"/>`;
  }
  return html + `<circle cx="${fx}" cy="${fy}" r="3.5"/>`;
}

// Leadership: one deep point holds up a ring near the surface. Six nodes: one for each developer in the team.
function lead() {
  const bx = 160, by = 190, cx = 160, cy = 46, rx = 132, ry = 30;
  const nodes = [...Array(6)].map((_, i) => { const a = Math.PI / 6 + i * Math.PI / 3; return [cx + rx * Math.cos(a), cy + ry * Math.sin(a)]; });
  let html = `<path class="faint" d="M${cx - rx} ${cy}A${rx} ${ry} 0 1 0 ${cx + rx} ${cy}A${rx} ${ry} 0 1 0 ${cx - rx} ${cy}"/>`;
  nodes.forEach(([x, y], i) => { html += `<path d="M${bx} ${by}L${f(x)} ${f(y)}" style="--dl:${f(0.1 + i * 0.08)}s"/>`; });
  nodes.forEach(([x, y]) => { html += `<circle class="o" cx="${f(x)}" cy="${f(y)}" r="4"/>`; });
  return html + `<circle cx="${bx}" cy="${by}" r="4.5"/>`;
}

// Entrepreneurship: a path with side branches. Most end in an open circle; one reaches the surface.
function ent() {
  const R = rng(11);
  const W = [[22, 170], [86, 128], [128, 150], [190, 96], [236, 112], [292, 40]];
  let d = `M${W[0][0]} ${W[0][1]}`;
  for (let i = 1; i < W.length; i++) { const a = W[i - 1], b = W[i], mx = (a[0] + b[0]) / 2 + (R() - .5) * 20, my = (a[1] + b[1]) / 2 + (R() - .5) * 20; d += `Q${f(mx)} ${f(my)} ${b[0]} ${b[1]}`; }
  let html = `<path d="${d}" style="--dl:0s"/>`, dots = '';
  W.slice(0, 5).forEach(([x, y], i) => {
    const n = 1 + (R() < 0.5 ? 1 : 0);
    for (let k = 0; k < n; k++) {
      const ang = -Math.PI * (0.15 + R() * 0.7) * (k % 2 ? -1 : 1), len = 30 + R() * 36;
      const ex = x + Math.cos(ang) * len, ey = y + Math.sin(ang) * len;
      html += `<path d="M${x} ${y}Q${f(x + Math.cos(ang) * len * .5 + (R() - .5) * 14)} ${f(y + Math.sin(ang) * len * .5)} ${f(ex)} ${f(ey)}" style="--dl:${f(0.4 + i * 0.18)}s"/>`;
      dots += `<circle class="o" cx="${f(ex)}" cy="${f(ey)}" r="3.2"/>`;
    }
    dots += `<circle cx="${x}" cy="${y}" r="2.6"/>`;
  });
  return html + dots + `<circle class="c" cx="${W[5][0]}" cy="${W[5][1]}" r="4"/>`;
}

const KINDS = { bi, ai, lead, ent };

export function signature(svg, kind) {
  svg.innerHTML = KINDS[kind]();
  svg.querySelectorAll('path').forEach(p => p.style.setProperty('--len', String(Math.ceil(p.getTotalLength()))));
  if (reduced) { svg.classList.add('drawn'); return; }
  new IntersectionObserver((es, io) => es.forEach(e => { if (e.isIntersecting) { requestAnimationFrame(() => svg.classList.add('drawn')); io.disconnect(); } }), { threshold: 0.3 }).observe(svg);
}

// Every <svg class="sig" data-sig="…"> on the page.
export function signatures() {
  document.querySelectorAll('svg.sig[data-sig]').forEach(svg => signature(svg, svg.dataset.sig));
}
