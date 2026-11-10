// Below the hero: small behaviours only. Every one of them adds or removes a class or an attribute;
// none draws, measures a layout to place things, or runs on every frame. With this script missing the page still reads
// in full: every "behind" panel is open and every answer is written out.
const root = document.documentElement;
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const $$ = (s, el = document) => [...el.querySelectorAll(s)];

// ---------- "Go behind": each button opens its own panel; the dock's switch opens or closes them all ----------
const pairs = $$('#work .go-b').map(btn => ({ btn, panel: document.getElementById(btn.getAttribute('aria-controls')) })).filter(p => p.panel);
const rules = $$('#work details.rule');
const depth = document.getElementById('depth');
const isOpen = p => p.btn.getAttribute('aria-expanded') === 'true';
const setOpen = (p, open) => { p.btn.setAttribute('aria-expanded', String(open)); p.panel.classList.toggle('open', open); };
const sync = () => { if (depth) depth.setAttribute('aria-pressed', String(pairs.every(isOpen) && rules.every(d => d.open))); };

pairs.forEach(p => p.btn.addEventListener('click', () => { setOpen(p, !isOpen(p)); sync(); }));
rules.forEach(d => d.addEventListener('toggle', sync));

if (depth) depth.addEventListener('click', () => {
  const on = depth.getAttribute('aria-pressed') !== 'true';
  // Opening everything at once moves the page under the reader. Hold on to what they were looking at:
  // switch with no transition, then put that element back where it was.
  const mark = $$('#work [data-sec]').find(s => { const r = s.getBoundingClientRect(); return r.bottom > 80; });
  const before = mark ? mark.getBoundingClientRect().top : 0;
  root.classList.add('snap');
  pairs.forEach(p => setOpen(p, on));
  rules.forEach(d => { d.open = on; });
  depth.setAttribute('aria-pressed', String(on));
  if (mark) scrollBy(0, mark.getBoundingClientRect().top - before);
  setTimeout(() => root.classList.remove('snap'), 60);
});

// A link can open the page already behind: wilsonlisboa.com/?behind
if (depth && new URLSearchParams(location.search).has('behind')) depth.click();

// ---------- things that start when they are seen ----------
if ('IntersectionObserver' in window) {
  root.classList.add('io');

  // The flood only runs while its exhibit is on screen.
  const live = new IntersectionObserver(es => es.forEach(e => e.target.classList.toggle('live', e.isIntersecting)), { rootMargin: '80px 0px' });
  $$('#work .ex').forEach(el => live.observe(el));

  // Each answer is typed once, the first time it is seen. The full text is in the page from the start.
  const type = el => {
    const full = el.dataset.text;
    if (reduced || !full) return;
    let i = 0;
    el.textContent = '';
    const t = setInterval(() => { el.textContent = full.slice(0, ++i); if (i >= full.length) clearInterval(t); }, 42);
  };
  const once = new IntersectionObserver((es, io) => es.forEach(e => {
    if (!e.isIntersecting) return;
    io.unobserve(e.target);
    if (e.target.classList.contains('sig')) e.target.classList.add('drawn');
    else type(e.target);
  }), { threshold: 0.6 });
  $$('#work .ty, #work .sig').forEach(el => once.observe(el));

  // The dock shows which section is in front.
  const links = new Map($$('#work .dock-nav a').map(a => [a.getAttribute('href').slice(1), a]));
  const nav = document.querySelector('#work .dock-nav');
  const where = new IntersectionObserver(es => es.forEach(e => {
    const a = links.get(e.target.id);
    if (!a || !e.isIntersecting) return;
    links.forEach(x => x.classList.toggle('on', x === a));
    if (nav && nav.scrollWidth > nav.clientWidth) nav.scrollTo({ left: Math.max(0, a.offsetLeft - 24), behavior: reduced ? 'auto' : 'smooth' });
  }), { rootMargin: '-45% 0px -50% 0px' });
  links.forEach((_, id) => { const s = document.getElementById(id); if (s) where.observe(s); });
}

// Lengths for the drawings that draw themselves.
$$('#work .sig path').forEach(p => p.style.setProperty('--len', String(Math.ceil(p.getTotalLength()))));

// ---------- the trajectory: pick a role or a tool, and the rest filters, as a Power BI report does ----------
const tj = document.getElementById('trajectory');
if (tj) {
  const all = $$('[data-role],[data-tool],[data-uses]', tj);
  const panels = $$('.tj-p', tj);
  // At rest everything is in full colour and the current role is shown. A click filters; the same click again clears.
  let picked = tj.dataset.pick || '', filtered = false;
  const keyOf = el => el.dataset.role ? `role:${el.dataset.role}` : `tool:${el.dataset.tool}`;

  const show = (key, dim) => {
    const [kind, id] = key.split(':');
    tj.classList.toggle('has', dim);
    all.forEach(el => {
      const mine = kind === 'role' ? el.dataset.role === id : el.dataset.tool === id;
      // What relates to the pick: a role's tool spans and tool names, or the roles a tool was used in.
      const uses = (el.dataset.uses || '').split(' ');
      const rel = (kind === 'role' && el.dataset.by === id) || uses.includes(id);
      el.classList.toggle('pick', mine && !el.classList.contains('tj-seg'));
      el.classList.toggle('on', mine || rel);
      if (el.matches('button')) el.setAttribute('aria-pressed', String(mine && dim));
    });
    panels.forEach(p => p.classList.toggle('on', p.dataset.for === key));
  };

  tj.addEventListener('click', e => {
    const el = e.target.closest('button[data-role],button[data-tool]');
    if (!el) return;
    const key = keyOf(el);
    filtered = !(filtered && key === picked);
    picked = key;
    show(picked, filtered);
  });
  // With a mouse, pointing previews the filter; leaving returns to where it was.
  if (matchMedia('(hover: hover) and (pointer: fine)').matches) {
    tj.addEventListener('pointerover', e => {
      const el = e.target.closest('button[data-role],button[data-tool]');
      if (el) show(keyOf(el), true);
    });
    tj.addEventListener('pointerleave', () => show(picked, filtered));
  }
  show(picked, filtered);
}
