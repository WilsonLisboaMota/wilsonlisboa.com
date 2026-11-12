// Below the hero: small behaviours only. Every one of them adds or removes a class or an attribute, sets a custom
// property when the pointer moves, or opens a native dialog; none draws, or runs on every frame. With this script
// missing the page still reads: the path is open, every card shows its few words, and each card with a page is a link.
const root = document.documentElement;
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const fine = matchMedia('(hover: hover) and (pointer: fine)').matches;
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

// ---------- panels that open (the path) ----------
const pairs = $$('#work .go-b').map(btn => ({ btn, panel: document.getElementById(btn.getAttribute('aria-controls')) })).filter(p => p.panel);
const setOpen = (p, open) => {
  p.btn.setAttribute('aria-expanded', String(open));
  p.panel.classList.toggle('open', open);
  // What opened is brought into view, so that pressing the button is seen to do something.
  if (open) setTimeout(() => p.panel.scrollIntoView({ block: 'nearest', behavior: reduced ? 'auto' : 'smooth' }), 460);
};
pairs.forEach(p => p.btn.addEventListener('click', () => setOpen(p, p.btn.getAttribute('aria-expanded') !== 'true')));
// Any link to the trajectory opens the path on arrival.
const pathPair = pairs.find(p => p.panel.id === 'bh-path');
const openPath = () => { if (pathPair && location.hash === '#trajectory') setOpen(pathPair, true); };
addEventListener('hashchange', openPath);
$$('a[href="#trajectory"]').forEach(a => a.addEventListener('click', () => pathPair && setOpen(pathPair, true)));
openPath();

// ---------- the path: pick a step, see that role ----------
$$('#work .path').forEach(path => {
  const steps = $$('.step', path), panels = $$('.role-p', path);
  const show = id => {
    steps.forEach(s => { const on = s.dataset.role === id; s.classList.toggle('on', on); s.setAttribute('aria-selected', String(on)); });
    panels.forEach(p => p.classList.toggle('on', p.dataset.for === id));
  };
  path.addEventListener('click', e => { const s = e.target.closest('.step'); if (s) show(s.dataset.role); });
});

// ---------- cards: a sheet behind each, and a tilt under a mouse ----------
$$('#work [data-sheet]').forEach(card => {
  const sheet = document.getElementById(card.dataset.sheet);
  if (!sheet || !sheet.showModal) return;
  card.addEventListener('click', () => sheet.showModal());
  // A click on the dimmed page around the sheet closes it.
  sheet.addEventListener('click', e => { if (e.target === sheet) sheet.close(); });
});
if (!reduced && fine) {
  $$('#work [data-tilt]').forEach(card => {
    card.addEventListener('pointermove', e => {
      const r = card.getBoundingClientRect(), x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
      card.classList.add('tilting');
      card.style.setProperty('--ry', `${((x - 0.5) * 9).toFixed(2)}deg`);
      card.style.setProperty('--rx', `${((0.5 - y) * 7).toFixed(2)}deg`);
      card.style.setProperty('--mx', `${(x * 100).toFixed(1)}%`);
      card.style.setProperty('--my', `${(y * 100).toFixed(1)}%`);
    });
    card.addEventListener('pointerleave', () => { card.classList.remove('tilting'); card.style.setProperty('--rx', '0deg'); card.style.setProperty('--ry', '0deg'); });
  });
}

// ---------- the wall behind the page: it shows where the visitor points ----------
// Each section carries the hero's fine lines behind its content, hidden. A mouse lights them round itself; a finger
// lights them where it lands, for a moment. Only the place of the light is set here; the rest is CSS.
if (!reduced) {
  let lit = null, out = 0;
  const light = (sec, e) => {
    const r = sec.getBoundingClientRect();
    sec.style.setProperty('--lx', `${Math.round(e.clientX - r.left)}px`);
    sec.style.setProperty('--ly', `${Math.round(e.clientY - r.top)}px`);
    if (lit !== sec) { if (lit) lit.classList.remove('lit'); lit = sec; sec.classList.add('lit'); }
  };
  const dark = () => { if (lit) lit.classList.remove('lit'); lit = null; };
  $$('#work [data-glow]').forEach(sec => {
    sec.addEventListener('pointermove', e => { if (e.pointerType !== 'touch') light(sec, e); });
    sec.addEventListener('pointerleave', e => { if (e.pointerType !== 'touch') dark(); });
    sec.addEventListener('pointerdown', e => { if (e.pointerType === 'touch') { light(sec, e); clearTimeout(out); out = setTimeout(dark, 1800); } });
  });
}

// ---------- leadership: the formation follows the pointer ----------
// The one in front flies just ahead of the pointer; the others keep their places behind it, turned the same way, and
// each takes a little longer to get there than the one before (the timing is in the CSS). Left alone, they go home.
const aro = document.querySelector('#work .aro');
if (aro && !reduced) {
  const sec = aro.closest('section'), birds = $$('.arw', aro);
  const at = birds.map(b => [parseFloat(b.style.getPropertyValue('--hx')), parseFloat(b.style.getPropertyValue('--hy'))]);
  let hd = 0, from = null, stamp = -1e9, rest = 0;
  const follow = e => {
    if (!aro.classList.contains('drawn') || e.timeStamp - stamp < 40) return;
    stamp = e.timeStamp;
    const box = aro.getBoundingClientRect(), s = sec.getBoundingClientRect();
    const x = clamp(e.clientX, s.left + 24, s.right - 24), y = clamp(e.clientY, s.top + 24, s.bottom - 24);
    if (!from) from = [x, y];
    const dx = x - from[0], dy = y - from[1];
    // The heading turns the short way round, and only once the pointer has really moved.
    if (dx * dx + dy * dy > 196) { hd += (((Math.atan2(dy, dx) * 180 / Math.PI + 90 - hd) % 360) + 540) % 360 - 180; from = [x, y]; }
    const r = hd * Math.PI / 180, c = Math.cos(r), n = Math.sin(r);
    const lx = x - box.left + n * 34, ly = y - box.top - c * 34;
    birds.forEach((b, i) => {
      const ox = at[i][0] - at[0][0], oy = at[i][1] - at[0][1];
      b.style.setProperty('--px', `${(lx + ox * c - oy * n).toFixed(1)}px`);
      b.style.setProperty('--py', `${(ly + ox * n + oy * c).toFixed(1)}px`);
      b.style.setProperty('--pr', `${hd.toFixed(1)}deg`);
    });
    aro.classList.add('chase');
  };
  const goHome = () => {
    from = null;
    hd = Math.round(hd / 360) * 360;
    birds.forEach(b => { b.style.removeProperty('--px'); b.style.removeProperty('--py'); b.style.setProperty('--pr', `${hd}deg`); });
    clearTimeout(rest);
    rest = setTimeout(() => aro.classList.remove('chase'), 1500);
  };
  sec.addEventListener('pointermove', e => { if (e.pointerType !== 'touch') { clearTimeout(rest); follow(e); } });
  sec.addEventListener('pointerleave', e => { if (e.pointerType !== 'touch') goHome(); });
  sec.addEventListener('pointerdown', e => { if (e.pointerType === 'touch') { stamp = -1e9; follow(e); clearTimeout(rest); rest = setTimeout(goHome, 2600); } });
}

// ---------- things that start when they are seen ----------
const countUp = el => {
  const to = +el.dataset.count;
  if (reduced || !to) return;
  let n = 0;
  el.textContent = '0';
  const t = setInterval(() => { n += 1; el.textContent = String(n); if (n >= to) clearInterval(t); }, Math.max(40, 560 / to));
};
if ('IntersectionObserver' in window) {
  root.classList.add('io');

  // Drawings only move while they are on screen.
  const live = new IntersectionObserver(es => es.forEach(e => e.target.classList.toggle('live', e.isIntersecting)), { rootMargin: '60px 0px' });
  $$('#work .card, #work [data-live], #work .ct, #work .sig, #work .aro').forEach(el => live.observe(el));

  // Once, the first time each is seen: drawings draw themselves, numbers count up, groups come in one after another.
  const once = new IntersectionObserver((es, io) => es.forEach(e => {
    if (!e.isIntersecting) return;
    const el = e.target;
    io.unobserve(el);
    if (el.matches('.sig, .aro')) el.classList.add('drawn');
    else if (el.dataset.count) countUp(el);
    // Not at the first sight of it, at the very bottom of the screen, but once it is well inside: an entrance is to be seen.
  }), { threshold: 0.6, rootMargin: '0px 0px -16% 0px' });
  $$('#work .sig, #work .aro, #work [data-count]').forEach(el => once.observe(el));
  const seq = new IntersectionObserver((es, io) => es.forEach(e => {
    if (!e.isIntersecting) return;
    const el = e.target;
    io.unobserve(el);
    el.classList.add('seen');
    // Once everything is in, the entrance steps aside, so that it never plays again when another animation ends.
    setTimeout(() => el.classList.add('sat'), 1600);
  }));
  $$('#work [data-seq]').forEach(el => seq.observe(el));

  // Without a mouse nothing can be pointed at: whatever is in the middle of the screen plays instead.
  if (!fine && !reduced) {
    const mid = new IntersectionObserver(es => es.forEach(e => e.target.classList.toggle('play', e.isIntersecting)), { rootMargin: '-36% 0px -36% 0px' });
    $$('#work [data-play]').forEach(el => mid.observe(el));
  }

  // The dock shows which section is in front.
  const links = new Map($$('#work .dock-nav a').map(a => [a.getAttribute('href').slice(1), a]));
  const nav = document.querySelector('#work .dock-nav');
  const where = new IntersectionObserver(es => es.forEach(e => {
    const a = links.get(e.target.id);
    if (!e.isIntersecting) return;
    links.forEach(x => x.classList.toggle('on', x === a));
    if (a && nav && nav.scrollWidth > nav.clientWidth) nav.scrollTo({ left: Math.max(0, a.offsetLeft - 24), behavior: reduced ? 'auto' : 'smooth' });
  }), { rootMargin: '-45% 0px -50% 0px' });
  $$('#work [data-sec]').forEach(s => where.observe(s));
} else {
  // No observer: let the drawings run and stay drawn.
  $$('#work .card, #work [data-live], #work .ct, #work .sig, #work .aro').forEach(el => el.classList.add('live'));
  $$('#work .sig, #work .aro').forEach(el => el.classList.add('drawn'));
}

// Lengths for the drawings that draw themselves.
$$('#work .sig path').forEach(p => p.style.setProperty('--len', String(Math.ceil(p.getTotalLength()))));
