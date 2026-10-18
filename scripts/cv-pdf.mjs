// Prints the CV PDFs from the /cv page with headless Chrome, so the PDF never drifts from the web CV.
//
//   npm run cv:pdf     (builds the site first)
//
// - Public PDF: public/cv/wilson-lisboa-mota-cv.pdf. It is committed and linked from /cv, with no phone or address.
// - Private PDF: only when ../content/private/cv-private.json exists and has a phone or an address.
//   It is written next to that file, outside this public repository, and is never published.
//   The private details are added in the browser just before printing; they never enter the site's files.
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { existsSync, mkdtempSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const publicPdf = join(root, 'public/cv/wilson-lisboa-mota-cv.pdf');
// CV_PRIVATE_JSON points elsewhere, for a test run with dummy details.
const privateJson = process.env.CV_PRIVATE_JSON || resolve(root, '../content/private/cv-private.json');
const privatePdf = join(dirname(privateJson), 'Wilson-Lisboa-Mota-CV.pdf');
const chromePath = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const PORT = 4329, CDP = 9400 + Math.floor(Math.random() * 400);
const url = `http://127.0.0.1:${PORT}/cv/`;
const sleep = ms => new Promise(r => setTimeout(r, ms));

// A tiny static server for dist/ (astro preview allows only one instance per project, which may already be running).
const dist = join(root, 'dist');
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.pdf': 'application/pdf', '.json': 'application/json', '.woff2': 'font/woff2' };
const preview = createServer((req, res) => {
  let p = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname)).replace(/^([/\\])+/, '');
  let file = join(dist, p);
  if (!file.startsWith(dist)) { res.writeHead(403).end(); return; }
  if (existsSync(file) && statSync(file).isDirectory()) file = join(file, 'index.html');
  if (!existsSync(file)) { res.writeHead(404).end(); return; }
  res.writeHead(200, { 'Content-Type': TYPES[extname(file)] || 'application/octet-stream' }).end(readFileSync(file));
}).listen(PORT, '127.0.0.1');
const chrome = spawn(chromePath, [
  '--headless=new', `--remote-debugging-port=${CDP}`, `--user-data-dir=${mkdtempSync(join(tmpdir(), 'cvpdf-'))}`,
  '--no-first-run', '--hide-scrollbars', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', 'about:blank',
], { stdio: 'ignore' });
const stop = code => { try { preview.close(); } catch {} try { chrome.kill(); } catch {} process.exit(code); };

async function waitFor(fn, what, tries = 100) {
  for (let i = 0; i < tries; i++) { try { const v = await fn(); if (v) return v; } catch {} await sleep(200); }
  console.error(`timed out waiting for ${what}`); stop(1);
}
await waitFor(async () => (await fetch(url)).ok, 'the local server');
const target = await waitFor(async () => (await (await fetch(`http://127.0.0.1:${CDP}/json/list`)).json()).find(t => t.type === 'page'), 'Chrome');

const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise(r => ws.addEventListener('open', r, { once: true }));
let id = 0; const pending = new Map(); const waiters = [];
ws.addEventListener('message', ev => {
  const m = JSON.parse(ev.data);
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
  if (m.method) waiters.filter(x => x.method === m.method).forEach(x => x.resolve(m));
});
const send = (method, params = {}) => new Promise(r => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
const evaluate = async expression => (await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })).result?.result?.value;
const print = async file => {
  const r = await send('Page.printToPDF', { printBackground: true, preferCSSPageSize: true, pageRanges: '1', marginTop: 0, marginBottom: 0, marginLeft: 0, marginRight: 0 });
  if (!r.result?.data) { console.error('printing failed', JSON.stringify(r.error || r)); stop(1); }
  writeFileSync(file, Buffer.from(r.result.data, 'base64'));
  console.log('saved', file);
};

await send('Page.enable');
// The final state, without the entry animations or the first-visit hologram.
await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
await send('Page.addScriptToEvaluateOnNewDocument', { source: "try{sessionStorage.setItem('cv-holo-a','1')}catch(e){}" });
const loaded = new Promise(resolve => waiters.push({ method: 'Page.loadEventFired', resolve }));
await send('Page.navigate', { url });
await loaded;
await evaluate('document.fonts.ready.then(() => true)');
await sleep(1200);
await print(publicPdf);

const data = existsSync(privateJson) ? JSON.parse(readFileSync(privateJson, 'utf8')) : null;
if (data && (data.phone || data.address)) {
  const ok = await evaluate(`(${injectPrivate})(${JSON.stringify(data)})`);
  if (!ok) { console.error('could not add the private details'); stop(1); }
  await sleep(300);
  await print(privatePdf);
} else {
  console.log(`private PDF skipped: fill in phone or address in ${privateJson}`);
}
ws.close();
stop(0);

// Runs in the page: adds the phone line, the full address and the subtitle, then re-spaces the contact pills.
function injectPrivate(d) {
  const q = s => document.querySelector(s);
  const lis = [...document.querySelectorAll('.ct-li')];
  if (lis.length !== 4) return false;
  const [mail, loc] = lis;
  if (d.subtitle) q('.t.sub').textContent = d.subtitle;
  if (d.email) { const a = mail.querySelector('a'); a.textContent = d.email; a.href = 'mailto:' + d.email; }
  if (d.address) loc.querySelector('.ct').textContent = d.address;
  if (d.phone) {
    const ph = mail.cloneNode(true);
    ph.querySelector('svg.ico').innerHTML = '<path fill="#fff" d="M6.6 10.8a15.1 15.1 0 0 0 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1A17 17 0 0 1 3 4c0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.3 0 .7-.2 1z"/>';
    ph.querySelector('.ct').textContent = d.phone;
    mail.after(ph);
  }
  // One more line: the column starts one step higher, so the last pill keeps its place.
  const items = [...document.querySelectorAll('.ct-li')], step = 31.3, last = 527.8;
  items.forEach((li, i) => {
    const b = (last - (items.length - 1 - i) * step).toFixed(1);
    li.querySelectorAll('[style*="--b"]').forEach(el => el.style.setProperty('--b', b));
  });
  // A long address or email shrinks to fit its pill.
  items.forEach(li => {
    const t = li.querySelector('.ct'), pill = li.querySelector('.pill-c').getBoundingClientRect(), r = t.getBoundingClientRect();
    const room = pill.right - r.left - 6;
    if (r.width > room) t.style.fontSize = (parseFloat(getComputedStyle(t).fontSize) * room / r.width).toFixed(2) + 'px';
  });
  return true;
}
