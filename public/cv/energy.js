/* The wall's energy, shared by the two CV sketches.
   Same alphabet and the same rule as the hero: when something is charged, the code shows in a thin,
   irregular band around it, never on top of the text, and each glyph scrambles at its own pace. */
(() => {
  const GLYPHS = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz0123456789#%&$+=';
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fine = matchMedia('(hover: hover) and (pointer: fine)').matches;
  const rnd = (a, b) => a + Math.random() * (b - a);
  const glyph = () => GLYPHS[(Math.random() * GLYPHS.length) | 0];
  const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

  /* ---------- shared styles: tooltip, decode letters, sketch controls ---------- */
  const css = document.createElement('style');
  css.textContent = `
    .e-w{white-space:nowrap}
    .e-c{display:inline-block;text-align:center}
    .e-c.e-g{font-family:'Martian Mono',ui-monospace,monospace;font-size:.82em;font-weight:500;color:rgb(var(--e-main,26,154,228))}
    .e-tip{position:absolute;z-index:70;max-width:min(340px,calc(100vw - 16px));padding:14px 16px 15px;background:rgba(2,28,42,.96);color:#E4ECE9;
      font:400 14px/1.45 'Mona Sans','Helvetica Neue',Arial,sans-serif;border-top:1px solid rgba(26,154,228,.7);box-shadow:0 18px 40px rgba(0,0,0,.4);
      pointer-events:auto;-webkit-font-smoothing:antialiased}
    .e-tip[hidden]{display:none}
    .e-tip.in{animation:e-tip .32s cubic-bezier(.2,.7,.2,1)}
    .e-tip .e-tip-h{display:block;margin:0 0 6px;font:500 10.5px/1.4 'Martian Mono',ui-monospace,monospace;letter-spacing:.08em;text-transform:uppercase;color:rgba(228,236,233,.62)}
    .e-tip p{margin:0}
    .e-tip p + p{margin-top:8px}
    .e-tip q{quotes:'“' '”' '‘' '’';font-size:15.5px;line-height:1.45}
    .e-tip .src{color:rgba(228,236,233,.6);font-size:12.5px}
    .e-tip a{color:#E4ECE9}
    @keyframes e-tip{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:none}}
    .e-ctl{position:fixed;right:12px;bottom:12px;z-index:80;display:grid;gap:8px;padding:12px 14px;background:rgba(2,28,42,.94);color:#E4ECE9;
      border:1px solid rgba(228,236,233,.16);font:450 10.5px/1.3 'Martian Mono',ui-monospace,monospace;letter-spacing:.06em;text-transform:uppercase}
    .e-ctl summary{cursor:pointer;color:rgba(228,236,233,.75);list-style:none}
    .e-ctl summary::-webkit-details-marker{display:none}
    .e-ctl summary::after{content:' +'}
    .e-ctl[open] summary::after{content:' −'}
    .e-ctl:not([open]){padding:9px 12px}
    .e-ctl div{display:flex;align-items:center;gap:6px;flex-wrap:wrap}
    .e-ctl button,.e-ctl a{font:inherit;letter-spacing:inherit;text-transform:inherit;color:inherit;background:none;border:1px solid rgba(228,236,233,.3);padding:7px 9px;cursor:pointer;text-decoration:none}
    @media (max-width:600px){.e-ctl{position:static;margin:0 16px 32px}}
    .e-ctl button[aria-pressed="true"]{border-color:#E0952F;color:#E0952F}
    .e-ctl button:hover,.e-ctl a:hover{border-color:#E4ECE9}
    @media (prefers-reduced-motion:reduce){.e-tip.in{animation:none}}
    /* The hologram: projected from the photo, the CV appears inside a growing, soft-edged circle. */
    .e-holo{-webkit-mask-image:radial-gradient(circle at var(--hx) var(--hy),#000 calc(var(--hr,0px) - 110px),rgba(0,0,0,.45) calc(var(--hr,0px) - 40px),transparent var(--hr,0px));
      mask-image:radial-gradient(circle at var(--hx) var(--hy),#000 calc(var(--hr,0px) - 110px),rgba(0,0,0,.45) calc(var(--hr,0px) - 40px),transparent var(--hr,0px))}
    .e-holo-settle{animation:e-holo-settle .7s steps(1,end)}
    @keyframes e-holo-settle{0%{opacity:1}18%{opacity:.88}30%{opacity:1}52%{opacity:.94}64%{opacity:1}}
    /* Words the energy can act on: each one an inline block, so it can lose its shape without moving the line. */
    .e-wd{display:inline-block;text-decoration:inherit}
  `;
  document.head.append(css);

  /* ---------- the overlay where the code is drawn ---------- */
  const cv = document.createElement('canvas');
  cv.setAttribute('aria-hidden', 'true');
  cv.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:60';
  const ctx = cv.getContext('2d');
  let dpr = 1, W = 0, H = 0, raf = 0;
  const size = () => { dpr = Math.min(2, devicePixelRatio || 1); W = innerWidth; H = innerHeight; cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); };

  const fields = [], sparks = [], decodes = [];
  const held = new Map();

  // Each surface (dark site, blue sidebar, white paper) gives its own light through CSS variables.
  function palette(el) {
    const cs = getComputedStyle(el);
    const v = (n, d) => cs.getPropertyValue(n).trim() || d;
    return { main: v('--e-main', '26,154,228'), hot: v('--e-hot', '228,236,233'), blend: v('--e-blend', 'lighter'), gain: +v('--e-gain', '1') };
  }

  // The line boxes of an element's text, merged per line, relative to the element itself.
  function lines(el) {
    const box = el.getBoundingClientRect();
    const range = document.createRange();
    range.selectNodeContents(el);
    const rows = [];
    [...range.getClientRects()].forEach(q => {
      if (q.width < 1 || q.height < 1) return;
      const row = rows.find(r => Math.abs(r.t - q.top) < q.height * 0.5);
      if (row) { row.l = Math.min(row.l, q.left); row.r = Math.max(row.r, q.right); row.b = Math.max(row.b, q.bottom); }
      else rows.push({ l: q.left, r: q.right, t: q.top, b: q.bottom });
    });
    if (!rows.length) rows.push({ l: box.left, r: box.right, t: box.top, b: box.bottom });
    return rows.map(r => ({ x: r.l - box.left, y: r.t - box.top, w: r.r - r.l, h: r.b - r.t }));
  }

  /* A pulse around the text: an irregular front leaves the line, and glyphs show only in its band. */
  function burst(el, o = {}) {
    if (reduced) return;
    const pal = palette(el);
    const rects = lines(el);
    const cell = o.cell || Math.max(7, Math.min(10, rects[0].h * 0.55));
    const reach = o.reach || cell * 3.4;
    const minX = Math.min(...rects.map(r => r.x)) - reach, maxX = Math.max(...rects.map(r => r.x + r.w)) + reach;
    const minY = Math.min(...rects.map(r => r.y)) - reach, maxY = Math.max(...rects.map(r => r.y + r.h)) + reach;
    const cells = [];
    for (let x = minX; x < maxX; x += cell) for (let y = minY; y < maxY; y += cell) {
      let d = Infinity;
      for (const r of rects) {
        const dx = Math.max(r.x - x, 0, x - r.x - r.w), dy = Math.max(r.y - y, 0, y - r.y - r.h);
        d = Math.min(d, Math.hypot(dx, dy));
      }
      // Never on the text itself: the code lives in the disturbance around it.
      if (d < cell * 0.5 || d > reach || Math.random() > (o.density || 0.34)) continue;
      cells.push({ x, y, d, h: Math.random(), ch: glyph(), next: 0, rate: rnd(70, 190) });
    }
    fields.push({ el, pal, cells, cell, born: performance.now(), dur: o.dur || 1.5, speed: reach / 0.8, s: [rnd(0, 9), rnd(0, 9), rnd(0, 9)], gain: (o.gain || 1) * pal.gain });
    kick();
  }

  function drawField(f, now) {
    const t = (now - f.born) / 1000;
    if (t > f.dur) return false;
    const b = f.el.getBoundingClientRect();
    if (b.bottom < -80 || b.top > H + 80) return true;
    const front = t * f.speed, sigma = f.cell * 0.85;
    const fade = Math.exp(-t * 1.6) * Math.min(1, t * 9);
    ctx.globalCompositeOperation = f.pal.blend;
    ctx.font = `500 ${f.cell * 0.95}px "Martian Mono", ui-monospace, monospace`;
    for (const c of f.cells) {
      const p = c.x / 60;
      // No two pulses alike: the front wobbles along the line and some arcs almost vanish.
      const wob = 1 + 0.25 * Math.sin(p + f.s[0]) + 0.12 * Math.sin(2.3 * p + f.s[1]);
      const arcs = 0.3 + 0.7 * smooth(-0.3, 0.5, Math.sin(0.8 * p + f.s[2]) + 0.6 * Math.sin(1.7 * p + f.s[0]));
      const k = c.d - front * wob;
      const a = Math.exp(-k * k / (2 * sigma * sigma)) * fade * arcs * (0.35 + 0.65 * c.h) * f.gain;
      if (a < 0.03) continue;
      if (now > c.next) { c.ch = glyph(); c.next = now + c.rate; }
      ctx.fillStyle = `rgba(${c.h > 0.86 ? f.pal.hot : f.pal.main},${Math.min(1, a).toFixed(3)})`;
      ctx.fillText(c.ch, b.left + c.x, b.top + c.y);
    }
    return true;
  }

  /* A single glyph that flickers into life and fades: the ambient breath of anything charged. */
  function spark(el, x, y, o = {}) {
    if (reduced) return;
    sparks.push({ el, x, y, pal: o.pal || palette(el), born: performance.now(), life: o.life || rnd(450, 900), size: o.size || 8,
      ch: glyph(), next: 0, gain: o.gain || 1, hot: Math.random() > 0.82, rise: o.rise ?? 4 });
    kick();
  }
  function drawSpark(s, now) {
    const t = (now - s.born) / s.life;
    if (t > 1) return false;
    const b = s.el.getBoundingClientRect();
    const a = Math.sin(Math.PI * t) * 0.85 * s.gain * s.pal.gain;
    if (now > s.next) { s.ch = glyph(); s.next = now + rnd(60, 140); }
    ctx.globalCompositeOperation = s.pal.blend;
    ctx.font = `500 ${s.size}px "Martian Mono", ui-monospace, monospace`;
    ctx.fillStyle = `rgba(${s.hot ? s.pal.hot : s.pal.main},${a.toFixed(3)})`;
    ctx.fillText(s.ch, b.left + s.x, b.top + s.y - t * s.rise);
    return true;
  }

  // While something stays charged, it keeps giving off a little of that energy around its edges.
  function tickHeld(now) {
    held.forEach((h, el) => {
      if (now < h.next) return;
      h.next = now + rnd(150, 360);
      const r = h.rects[(Math.random() * h.rects.length) | 0];
      const side = Math.random(), off = rnd(4, 11);
      let x, y;
      if (side < 0.42) { x = r.x + Math.random() * r.w; y = r.y - off; }
      else if (side < 0.84) { x = r.x + Math.random() * r.w; y = r.y + r.h + off; }
      else if (side < 0.92) { x = r.x - off; y = r.y + Math.random() * r.h; }
      else { x = r.x + r.w + off; y = r.y + Math.random() * r.h; }
      spark(el, x, y, { pal: h.pal, size: h.size, gain: 0.7 });
    });
  }

  /* Variant: the letters themselves pass through the code, left to right, and settle back. */
  function prepDecode(el) {
    if (el._chars) return el._chars;
    const chars = [];
    const walk = node => [...node.childNodes].forEach(n => {
      if (n.nodeType === 3) {
        const frag = document.createDocumentFragment();
        n.textContent.split(/(\s+)/).forEach(part => {
          if (!part) return;
          if (/^\s+$/.test(part)) { frag.append(part); return; }
          const w = document.createElement('span'); w.className = 'e-w';
          [...part].forEach(ch => { const s = document.createElement('span'); s.className = 'e-c'; s.textContent = ch; s.dataset.c = ch; w.append(s); chars.push(s); });
          frag.append(w);
        });
        n.replaceWith(frag);
      } else if (n.nodeType === 1) walk(n);
    });
    walk(el);
    return (el._chars = chars);
  }
  // mode 'pass': a band of code crosses the text; 'in': the text resolves out of the code; 'out': it dissolves into it.
  function decode(el, dur = 0.9, mode = 'pass') {
    if (reduced) return;
    const chars = prepDecode(el);
    // Fix each letter's width while it scrambles, so the line never moves; release it afterwards.
    chars.forEach(s => { if (!s.classList.contains('e-g')) s.style.width = s.getBoundingClientRect().width + 'px'; });
    const d = { chars, born: performance.now(), dur, mode };
    decodes.push(d);
    drawDecode(d, d.born);
    kick();
  }
  function drawDecode(d, now) {
    const t = Math.min(1, (now - d.born) / 1000 / d.dur);
    const n = d.chars.length;
    d.chars.forEach((s, i) => {
      const u = i / Math.max(1, n - 1);
      let on;
      if (d.mode === 'in') on = t < 1 && u > t * 1.15 - 0.15;
      else if (d.mode === 'out') on = u < t * 1.15;
      else on = t < 1 && Math.abs(u - (t * 1.3 - 0.15)) < 0.13;
      on = on && s.dataset.c.trim();
      if (on) { if (!s.classList.contains('e-g') || Math.random() < 0.4) { s.textContent = glyph(); s.classList.add('e-g'); } }
      else if (s.classList.contains('e-g')) { s.textContent = s.dataset.c; s.classList.remove('e-g'); }
    });
    if (t >= 1 && d.mode !== 'out') d.chars.forEach(s => { s.style.width = ''; });
    return t < 1;
  }

  /* A pulse across a whole surface from one point: the hero's click, on the CV.
     Irregular front, arcs that come and go, and no code at the point of contact. */
  const pulses = [];
  function pulse(area, ox, oy, o = {}) {
    if (reduced) return 0;
    const b = area.getBoundingClientRect();
    const cell = o.cell || 10, speed = o.speed || 820;
    const cells = [];
    const maxD = Math.hypot(Math.max(ox, b.width - ox), Math.max(oy, b.height - oy));
    for (let x = cell / 2; x < b.width; x += cell) for (let y = cell / 2; y < b.height; y += cell) {
      if (Math.random() > (o.density || 0.2)) continue;
      const d = Math.hypot(x - ox, y - oy);
      if (d < (o.clear || 44)) continue;
      cells.push({ x, y, d, th: Math.atan2(y - oy, x - ox), h: Math.random(), ch: glyph(), next: 0, rate: rnd(70, 190), pal: o.colorAt ? o.colorAt(x, y) : palette(area) });
    }
    const edges = (o.edges || []).map(el => {
      const pts = outline(el, b);
      if (!pts) return null;
      const r = el.getBoundingClientRect();
      return { pts, pal: o.colorAt ? o.colorAt(r.left + r.width / 2 - b.left, r.top + r.height / 2 - b.top) : palette(el) };
    }).filter(Boolean);
    pulses.push({ area, cells, edges, ox, oy, cell, speed, gain: o.gain || 1, born: performance.now(), dur: maxD / speed + 0.9, s: Array.from({ length: 5 }, () => rnd(0, 9)) });
    kick();
    return speed;
  }
  // The outline of a box (rounded corners included) as points every few pixels, relative to the area.
  function outline(el, b) {
    const r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) return null;
    const x = r.left - b.left, y = r.top - b.top, w = r.width, h = r.height;
    const raw = getComputedStyle(el).borderTopLeftRadius;
    const br = Math.min(raw.endsWith('%') ? parseFloat(raw) / 100 * Math.min(w, h) : parseFloat(raw) || 0, w / 2, h / 2);
    const pts = [], step = 5;
    const line = (x0, y0, x1, y1) => { const n = Math.max(1, Math.round(Math.hypot(x1 - x0, y1 - y0) / step)); for (let i = 0; i < n; i++) pts.push([x0 + (x1 - x0) * i / n, y0 + (y1 - y0) * i / n]); };
    const arc = (cx, cy, a0, a1) => { const n = Math.max(2, Math.round(br * Math.abs(a1 - a0) / step)); for (let i = 0; i < n; i++) { const a = a0 + (a1 - a0) * i / n; pts.push([cx + br * Math.cos(a), cy + br * Math.sin(a)]); } };
    line(x + br, y, x + w - br, y); if (br) arc(x + w - br, y + br, -Math.PI / 2, 0);
    line(x + w, y + br, x + w, y + h - br); if (br) arc(x + w - br, y + h - br, 0, Math.PI / 2);
    line(x + w - br, y + h, x + br, y + h); if (br) arc(x + br, y + h - br, Math.PI / 2, Math.PI);
    line(x, y + h - br, x, y + br); if (br) arc(x + br, y + br, Math.PI, Math.PI * 1.5);
    pts.push(pts[0]);
    return pts;
  }

  /* The projection: the CV is cast from one point (the photo) and appears behind a front of code.
     Resolves when the whole surface is lit. */
  function project(area, ox, oy, o = {}) {
    if (reduced) return Promise.resolve();
    const b = area.getBoundingClientRect();
    const soft = 110, dur = o.dur || 1350;
    const maxD = Math.hypot(Math.max(ox, b.width - ox), Math.max(oy, b.height - oy)) + soft;
    // Pace it on what the visitor can see; once that is lit, the rest of a tall page follows quickly.
    const vt = Math.max(0, -b.top), vb = Math.min(b.height, innerHeight - b.top);
    const seen = Math.hypot(Math.max(ox, b.width - ox), Math.max(Math.abs(oy - vt), Math.abs(vb - oy))) + soft;
    const speed = Math.min(seen, maxD) / (dur / 1000);
    area.style.setProperty('--hx', ox + 'px');
    area.style.setProperty('--hy', oy + 'px');
    area.style.setProperty('--hr', (o.start || 60) + 'px');
    area.classList.add('e-holo');
    pulse(area, ox, oy, { speed, clear: o.clear || 36, density: o.density || 0.42, gain: o.gain || 1.45, colorAt: o.colorAt, cell: o.cell, edges: o.edges });
    return new Promise(res => {
      const t0 = performance.now();
      const step = now => {
        const t = (now - t0) / 1000, tSeen = seen / speed;
        const r = Math.max(o.start || 60, t < tSeen ? t * speed : seen + (t - tSeen) * speed * 4);
        area.style.setProperty('--hr', r + 'px');
        if (r < maxD) return requestAnimationFrame(step);
        area.classList.remove('e-holo');
        area.style.removeProperty('--hr');
        // The projection settles with a couple of faint flickers, then holds steady.
        area.classList.add('e-holo-settle');
        setTimeout(() => area.classList.remove('e-holo-settle'), 750);
        res();
      };
      requestAnimationFrame(step);
    });
  }

  /* Words: the CV's text, split once into words, so the energy can act on the text itself. */
  function wordify(root, skip = 'script,style,template,svg,.e-tip,.e-ctl,.e-w,[data-no-wd]') {
    const nodes = [], out = [];
    const tw = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode: n => (!n.textContent.trim() || n.parentElement.closest(skip) || n.parentElement.closest('.e-wd')) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT
    });
    while (tw.nextNode()) nodes.push(tw.currentNode);
    nodes.forEach(n => {
      // One wrapper per text node, so a flex or grid parent still sees a single item.
      const wrap = document.createElement('span');
      n.textContent.split(/(\s+)/).forEach(part => {
        if (!part) return;
        if (/^\s+$/.test(part)) { wrap.append(part); return; }
        const w = document.createElement('span');
        w.className = 'e-wd';
        w.textContent = part;
        wrap.append(w);
        out.push(w);
      });
      n.replaceWith(wrap);
    });
    return out;
  }

  /* The membrane: invisible. Touch the CV where there is nothing to touch and its energy falters there, once:
     the words and elements nearby lose a little of their shape and their colour and come back, and the touch
     leaves two or three loose characters behind. No layer on top: it is the elements themselves that waver. */
  function disturb(words, extras, cx, cy, o = {}) {
    if (reduced) return;
    const R = o.radius || (fine ? 130 : 100);
    const hits = [];
    // Read everything first, then write, so the page is laid out once.
    for (const [el, isWord] of [...words.map(w => [w, true]), ...extras.map(e => [e, false])]) {
      const r = el.getBoundingClientRect();
      if (!r.width || r.bottom < 0 || r.top > innerHeight) continue;
      const d = Math.hypot(r.left + r.width / 2 - cx, r.top + r.height / 2 - cy);
      if (d < R) hits.push({ el, d, w: r.width, fw: isWord && o.variable ? parseFloat(getComputedStyle(el).fontWeight) || 400 : 0 });
    }
    const kf = [[0, 0, 'cubic-bezier(.3,.7,.4,1)'], [0.28, 1, 'cubic-bezier(.35,0,.25,1)'], [1, 0]];
    hits.forEach(({ el, d, w, fw }) => {
      const k = Math.pow(1 - d / R, 1.3) * (o.strength || 1);
      const jx = rnd(-1.8, 1.8) * k, jy = rnd(-1.4, 1.4) * k, sk = rnd(-8, 8) * k;
      // A variable font can really thin out; the word keeps its width so the line never moves.
      if (fw) el.style.width = w + 'px';
      const frames = kf.map(([offset, a, easing]) => {
        const f = {
          offset,
          easing: easing || 'linear',
          transform: `translate(${(jx * a).toFixed(2)}px,${(jy * a).toFixed(2)}px) skewX(${(sk * a).toFixed(2)}deg) scale(${(1 - 0.08 * k * a).toFixed(3)},${(1 - 0.28 * k * a).toFixed(3)})`,
          opacity: (1 - 0.62 * Math.min(1, k * 1.3) * a).toFixed(3)
        };
        if (fw) f.fontWeight = Math.round(fw - (fw - 150) * 0.75 * k * a);
        return f;
      });
      // Out and back in well under a second, the whole touch included.
      const an = el.animate(frames, { duration: rnd(540, 620), delay: (d / R) * 60 + rnd(0, 15) });
      if (fw) { const done = () => { el.style.width = ''; }; an.finished.then(done, done); }
    });
    const host = o.host || document.body, hr = host.getBoundingClientRect();
    const pal = palette(document.elementFromPoint(cx, cy) || host);
    for (let i = 0, n = Math.random() < 0.5 ? 2 : 3; i < n; i++) {
      const a = rnd(0, Math.PI * 2), r = rnd(12, 34);
      spark(host, cx - hr.left + Math.cos(a) * r, cy - hr.top + Math.sin(a) * r, { pal, size: rnd(9, 12), life: rnd(900, 1400), gain: 1, rise: rnd(-3, 3) });
    }
  }
  // A mouse click (not a drag, not a selection) or the start of a touch, away from anything interactive.
  function membrane(area, o = {}) {
    if (reduced) return;
    const interactive = 'a,button,input,select,textarea,label,summary,details,[tabindex],[data-skill],[data-tip],[role=tab],.e-tip,.e-ctl';
    const fire = (x, y) => disturb(o.words || [], typeof o.extras === 'function' ? o.extras() : (o.extras || []), x, y, { ...o, host: area });
    let down = null;
    area.addEventListener('pointerdown', e => {
      if (e.button > 0 || e.target.closest(interactive)) return;
      if (e.pointerType === 'mouse') { down = { x: e.clientX, y: e.clientY }; return; }
      // On touch, even the touch that starts a scroll makes the energy falter.
      fire(e.clientX, e.clientY);
    }, { passive: true });
    area.addEventListener('pointerup', e => {
      if (!down || e.pointerType !== 'mouse') return;
      const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y);
      down = null;
      const sel = getSelection();
      if (moved > 5 || (sel && !sel.isCollapsed)) return;
      fire(e.clientX, e.clientY);
    });
  }

  /* The name, unsettled by presence: the letters under the pointer turn into code, and stay code
     while the pointer rests on them. Pointer only; there is no hover on touch. */
  function unsettle(trigger, targets, o = {}) {
    if (reduced || !fine) return;
    const chars = targets.flatMap(t => prepDecode(t)).filter(c => c.dataset.c.trim());
    const live = new Map();
    const R = o.radius || 24, hold = o.hold || 260;
    let ptr = null, loop = 0;
    const touch = now => {
      if (!ptr) return;
      chars.forEach(c => {
        const r = c.getBoundingClientRect();
        const dx = Math.max(r.left - ptr.x, 0, ptr.x - r.right), dy = Math.max(r.top - ptr.y, 0, ptr.y - r.bottom);
        if (Math.hypot(dx, dy) > R) return;
        if (!live.has(c)) { c.style.width = r.width + 'px'; c.classList.add('e-g'); c.textContent = glyph(); c._n = now + rnd(60, 140); }
        live.set(c, now);
      });
    };
    const tick = now => {
      loop = 0;
      touch(now);
      live.forEach((t, c) => {
        if (now - t > hold) { c.textContent = c.dataset.c; c.classList.remove('e-g'); c.style.width = ''; live.delete(c); return; }
        if (now > c._n) { c.textContent = glyph(); c._n = now + rnd(70, 160); }
      });
      if (live.size || ptr) loop = requestAnimationFrame(tick);
    };
    trigger.addEventListener('pointermove', e => {
      ptr = { x: e.clientX, y: e.clientY };
      if (!loop) loop = requestAnimationFrame(tick);
    });
    trigger.addEventListener('pointerleave', () => { ptr = null; });
  }

  function drawPulse(p, now) {
    const t = (now - p.born) / 1000;
    if (t > p.dur) return false;
    const b = p.area.getBoundingClientRect();
    const grow = Math.min(1, t * 1.2), sigma = p.cell * 1.5, s = p.s;
    const fade = Math.exp(-t * 0.7) * Math.min(1, t * 6);
    ctx.font = `500 ${p.cell * 0.95}px "Martian Mono", ui-monospace, monospace`;
    let blend = '';
    for (const c of p.cells) {
      const Y = b.top + c.y;
      if (Y < -20 || Y > H + 20) continue;
      const th = c.th;
      const wob = 0.16 * Math.sin(2 * th + s[0]) + 0.11 * Math.sin(3 * th + s[1]) + 0.07 * Math.sin(5 * th + s[2]);
      const k = c.d - t * p.speed * (1 + wob * grow);
      if (k > 3 * sigma || k < -5 * sigma) continue;
      const arcs = 0.3 + 0.7 * smooth(-0.3, 0.5, Math.sin(3 * th + s[3]) + 0.6 * Math.sin(5 * th + s[4]));
      const band = Math.exp(-k * k / (2 * (k > 0 ? sigma : sigma * 1.7) ** 2));
      const a = band * fade * arcs * (0.35 + 0.65 * c.h) * c.pal.gain * p.gain;
      if (a < 0.03) continue;
      if (now > c.next) { c.ch = glyph(); c.next = now + c.rate; }
      if (c.pal.blend !== blend) { blend = c.pal.blend; ctx.globalCompositeOperation = blend; }
      ctx.fillStyle = `rgba(${c.h > 0.86 ? c.pal.hot : c.pal.main},${Math.min(1, a).toFixed(3)})`;
      ctx.fillText(c.ch, b.left + c.x, Y);
    }
    // The wave finds the CV's structure: the edges of the boxes light up only where the front crosses them.
    const se = 9;
    ctx.lineCap = 'round';
    for (const e of p.edges) {
      ctx.globalCompositeOperation = e.pal.blend;
      const core = e.pal.blend === 'lighter' ? e.pal.hot : e.pal.main;
      const pts = e.pts;
      for (let i = 0; i < pts.length - 1; i++) {
        const [x0, y0] = pts[i], [x1, y1] = pts[i + 1];
        const mx = (x0 + x1) / 2 - p.ox, my = (y0 + y1) / 2 - p.oy;
        const th = Math.atan2(my, mx);
        const wob = 0.16 * Math.sin(2 * th + s[0]) + 0.11 * Math.sin(3 * th + s[1]) + 0.07 * Math.sin(5 * th + s[2]);
        const k = Math.hypot(mx, my) - t * p.speed * (1 + wob * grow);
        if (k > 3 * se || k < -4 * se) continue;
        const a = Math.exp(-k * k / (2 * se * se)) * fade * e.pal.gain * p.gain;
        if (a < 0.04) continue;
        const Y0 = b.top + y0, Y1 = b.top + y1;
        if ((Y0 < -10 && Y1 < -10) || (Y0 > H + 10 && Y1 > H + 10)) continue;
        ctx.beginPath(); ctx.moveTo(b.left + x0, Y0); ctx.lineTo(b.left + x1, Y1);
        ctx.strokeStyle = `rgba(${e.pal.main},${Math.min(1, a * 0.32).toFixed(3)})`; ctx.lineWidth = 6; ctx.stroke();
        ctx.strokeStyle = `rgba(${core},${Math.min(1, a).toFixed(3)})`; ctx.lineWidth = 1.6; ctx.stroke();
      }
    }
    return true;
  }

  let variant = 'band';
  /* Charge: the surge (CSS), the pulse of code around it, then a steady, slightly brighter state while held. */
  function charge(el, on, o = {}) {
    if (on) {
      el.classList.add('e-held');
      el.classList.remove('e-surge'); void el.offsetWidth; el.classList.add('e-surge');
      if (variant === 'decode') decode(el); else burst(el, o);
      if (!reduced) held.set(el, { pal: palette(el), rects: lines(el), next: performance.now() + 750, size: o.cell || 8 });
    } else {
      el.classList.remove('e-held', 'e-surge');
      held.delete(el);
    }
    kick();
  }

  function frame(now) {
    raf = 0;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    tickHeld(now);
    for (let i = fields.length - 1; i >= 0; i--) if (!drawField(fields[i], now)) fields.splice(i, 1);
    for (let i = sparks.length - 1; i >= 0; i--) if (!drawSpark(sparks[i], now)) sparks.splice(i, 1);
    for (let i = decodes.length - 1; i >= 0; i--) if (!drawDecode(decodes[i], now)) decodes.splice(i, 1);
    for (let i = pulses.length - 1; i >= 0; i--) if (!drawPulse(pulses[i], now)) pulses.splice(i, 1);
    ctx.globalCompositeOperation = 'source-over';
    if (fields.length || sparks.length || decodes.length || pulses.length || held.size) raf = requestAnimationFrame(frame);
  }
  function kick() { if (!raf && !reduced) raf = requestAnimationFrame(frame); }

  /* ---------- timing helpers ---------- */
  const seen = new WeakMap();
  const watch = 'IntersectionObserver' in window ? new IntersectionObserver(es => es.forEach(e => seen.set(e.target, e.isIntersecting))) : null;
  // Ambient life: fire at irregular intervals, only while on screen and the page is visible.
  function every(el, fn, min, max) {
    if (reduced) return;
    watch && watch.observe(el);
    const loop = () => setTimeout(() => { if (!document.hidden && (!watch || seen.get(el))) fn(); loop(); }, rnd(min, max));
    loop();
  }
  // Once, as it enters the viewport.
  function onEnter(el, fn, margin = '-12%') {
    if (!('IntersectionObserver' in window)) return fn();
    const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { io.disconnect(); fn(); } }), { rootMargin: `0px 0px ${margin} 0px` });
    io.observe(el);
  }
  function tween(dur, step, done) {
    if (reduced) { step(1); done && done(); return; }
    const t0 = performance.now();
    const f = now => { const t = Math.min(1, (now - t0) / dur); step(t); if (t < 1) requestAnimationFrame(f); else done && done(); };
    requestAnimationFrame(f);
  }

  /* ---------- tooltip: hover on a pointer, tap to open and tap again to close on touch ---------- */
  const tip = document.createElement('div');
  tip.className = 'e-tip'; tip.id = 'e-tip'; tip.setAttribute('role', 'tooltip'); tip.hidden = true;
  let tipFor = null, hideT = 0;
  function decodeText(el, ms) {
    const text = el.textContent, t0 = performance.now();
    const step = now => {
      const k = Math.min(1, (now - t0) / ms), n = Math.floor(text.length * k);
      el.textContent = text.slice(0, n) + [...text.slice(n)].map(c => (c === ' ' ? ' ' : glyph())).join('');
      if (k < 1) requestAnimationFrame(step); else el.textContent = text;
    };
    requestAnimationFrame(step);
  }
  function place(t) {
    const r = t.getBoundingClientRect(), tw = tip.offsetWidth, th = tip.offsetHeight;
    let x = Math.max(8, Math.min(innerWidth - tw - 8, r.left + r.width / 2 - tw / 2));
    let y = r.top - th - 10;
    if (y < 8) y = r.bottom + 10;
    // Some triggers prefer the side, so the tooltip does not cover what it talks about.
    if (t.dataset.tipPlace === 'right' && r.right + tw + 24 < innerWidth) { x = r.right + 14; y = Math.max(8, r.top + r.height / 2 - th / 2); }
    tip.style.left = x + scrollX + 'px';
    tip.style.top = y + scrollY + 'px';
  }
  function showTip(t) {
    clearTimeout(hideT);
    if (tipFor === t && !tip.hidden) return;
    if (tipFor) hideTip(true);
    tip.replaceChildren(document.getElementById(t.dataset.tip).content.cloneNode(true));
    tip.hidden = false;
    tipFor = t;
    t.setAttribute('aria-describedby', 'e-tip');
    t.classList.add('e-tipped');
    place(t);
    const head = tip.querySelector('.e-tip-h');
    if (head && !reduced) decodeText(head, 360);
    tip.classList.remove('in'); void tip.offsetWidth; tip.classList.add('in');
    t.dispatchEvent(new CustomEvent('tipshow'));
  }
  function hideTip(now) {
    const go = () => {
      if (!tipFor) return;
      tip.hidden = true;
      tipFor.removeAttribute('aria-describedby');
      tipFor.classList.remove('e-tipped');
      tipFor.dispatchEvent(new CustomEvent('tiphide'));
      tipFor = null;
    };
    clearTimeout(hideT);
    if (now) go(); else hideT = setTimeout(go, 160);
  }

  /* ---------- wiring ---------- */
  function bind({ targets, onSkill, delay = 0 } = {}) {
    // Skills: a pointer charges every line where the skill was applied; on touch, a tap charges and a second tap releases.
    // `delay` lets the energy travel to its targets before they light up.
    let active = null;
    const set = (btn, on) => {
      const list = targets(btn.dataset.skill);
      document.documentElement.classList.toggle('e-dim', on && list.length > 0);
      btn.classList.toggle('e-on', on);
      btn.setAttribute('aria-pressed', on ? 'true' : 'false');
      clearTimeout(btn._charge);
      if (on) btn._charge = setTimeout(() => list.forEach(el => charge(el, true)), reduced ? 0 : delay);
      else list.forEach(el => charge(el, false));
      if (onSkill) onSkill(btn, on, list);
    };
    const activate = btn => { if (active === btn) return; if (active) set(active, false); active = btn; set(btn, true); };
    const release = btn => { if (active !== btn) return; set(btn, false); active = null; };
    document.querySelectorAll('[data-skill]').forEach(btn => {
      btn.setAttribute('aria-pressed', 'false');
      if (fine) {
        let t;
        btn.addEventListener('pointerenter', () => { t = setTimeout(() => activate(btn), 60); });
        btn.addEventListener('pointerleave', () => { clearTimeout(t); release(btn); });
      } else {
        btn.addEventListener('click', () => (active === btn ? release(btn) : activate(btn)));
      }
      btn.addEventListener('focus', () => { if (btn.matches(':focus-visible')) activate(btn); });
      btn.addEventListener('blur', () => release(btn));
    });

    document.querySelectorAll('[data-tip]').forEach(t => {
      if (fine) {
        t.addEventListener('pointerenter', () => showTip(t));
        t.addEventListener('pointerleave', () => hideTip());
      } else {
        t.addEventListener('click', e => { e.stopPropagation(); tipFor === t ? hideTip(true) : showTip(t); });
      }
      t.addEventListener('focus', () => { if (t.matches(':focus-visible')) showTip(t); });
      t.addEventListener('blur', e => { if (!tip.contains(e.relatedTarget)) hideTip(); });
    });
    tip.addEventListener('pointerenter', () => clearTimeout(hideT));
    tip.addEventListener('pointerleave', () => hideTip());
    document.addEventListener('click', e => { if (!fine && tipFor && !tip.contains(e.target)) hideTip(true); });
    addEventListener('keydown', e => { if (e.key === 'Escape') { hideTip(true); if (active) { set(active, false); active = null; } } });
    addEventListener('scroll', () => { if (fine && tipFor) hideTip(true); }, { passive: true });
  }

  /* Sketch controls: compare the two burst styles and replay the entry. Not part of the design. */
  function controls({ title, other, onReplay }) {
    // Collapsed by default, so it never covers the CV.
    const p = document.createElement('details');
    p.className = 'e-ctl';
    p.innerHTML = `<summary>${title}</summary>
      <div><span>Burst</span><button type="button" data-v="band" aria-pressed="true">Band</button><button type="button" data-v="decode" aria-pressed="false">Decode</button></div>
      <div><button type="button" data-replay>Replay entry</button><a href="${other.href}">${other.label}</a></div>`;
    p.querySelectorAll('[data-v]').forEach(b => b.addEventListener('click', () => {
      variant = b.dataset.v;
      p.querySelectorAll('[data-v]').forEach(x => x.setAttribute('aria-pressed', x === b ? 'true' : 'false'));
    }));
    p.querySelector('[data-replay]').addEventListener('click', onReplay);
    document.body.append(p);
  }

  addEventListener('resize', size);
  size();
  document.addEventListener('DOMContentLoaded', () => document.body.append(cv, tip));
  if (document.readyState !== 'loading') document.body.append(cv, tip);

  // The projection plays once per visit; the sketch controls can replay it.
  const firstVisit = key => { try { if (sessionStorage.getItem(key)) return false; sessionStorage.setItem(key, '1'); } catch {} return true; };

  window.Energy = { burst, spark, charge, decode, pulse, project, wordify, disturb, membrane, unsettle, firstVisit, every, onEnter, tween, bind, controls, lines, palette, glyph, rnd, reduced, fine, kick, showTip, hideTip };
})();
