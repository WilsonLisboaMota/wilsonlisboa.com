import * as THREE from 'three';

THREE.ColorManagement.enabled = false;

const hero = document.querySelector('.hero');
const stage = document.querySelector('.stage');
const canvas = document.getElementById('gl');
const copyEl = document.getElementById('copy');
const behindEl = document.getElementById('behind');
const hintEl = document.getElementById('hint');
const labels = [...document.querySelectorAll('.force')];
const answerEl = document.getElementById('answer');
const answerText = answerEl.querySelector('.x');
const mqReduce = matchMedia('(prefers-reduced-motion: reduce)');
const mqFine = matchMedia('(hover: hover) and (pointer: fine)');
let reduced = mqReduce.matches;

// Membrane space: x across, y up, z towards the viewer. The chart row runs through y = CHART_Y.
const W = 12, H = 6.8, CHART_Y = -0.3, CHART_A = 2.3, LAMBDA = 1.7;
const SPEED = 3.8, RIPPLES = 4;

const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

function rng(seed) {
  return () => {
    seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

// Illustrative series. Not real data.
function series(n) {
  const v = [];
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    v.push(0.42 + 0.30 * t + 0.10 * Math.sin(t * 9.4 + 0.5) + 0.06 * Math.sin(t * 23.1 + 1.7) + 0.035 * Math.sin(t * 57 + 0.3));
  }
  const mn = Math.min(...v), mx = Math.max(...v);
  return v.map(y => (y - mn) / (mx - mn));
}

// Three forces behind the membrane: x, y, strength, width.
// 0 BI: broad, stable. 1 AI: fine interference. 2 Leadership: wide lift.
// (A fourth, Entrepreneurship, was dropped on 25 October 2026: one co-founded consultancy is a fact for the CV, not a force.)
const FORCE_BASE = [
  [-3.2, -0.7, 0.85, 1.7],
  [0.7, 0.95, 0.6, 1.3],
  [3.5, -0.3, 0.5, 2.3],
];

// Height of the resting membrane, so the structures can touch it from behind.
function surfaceZ(x, y) {
  const f = FORCE_BASE;
  let z = 0, dx, dy, r;
  dx = x - f[0][0]; dy = y - f[0][1]; z += f[0][2] * Math.exp(-(dx * dx + dy * dy) / (f[0][3] ** 2));
  dx = x - f[1][0]; dy = y - f[1][1]; z += 0.8 * f[1][2] * Math.exp(-(dx * dx + dy * dy) / (f[1][3] ** 2));
  dx = x - f[2][0]; dy = y - f[2][1]; r = (dx * dx + dy * dy) / (f[2][3] ** 2); z += f[2][2] * Math.exp(-r * r);
  return z;
}

let renderer = null;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
} catch (e) {
  renderer = null;
}
if (renderer) init(); else fallback();

function fallback() {
  document.documentElement.classList.add('no-gl');
  const v = series(120);
  const d = v.map((y, i) => `${i ? 'L' : 'M'}${(i / 119 * 1000).toFixed(1)} ${(380 - y * 340).toFixed(1)}`).join(' ');
  stage.insertAdjacentHTML('afterbegin', `<svg class="fallback" viewBox="0 0 1000 400" preserveAspectRatio="none" aria-hidden="true"><path d="${d}" fill="none" stroke="#E4ECE9" stroke-width="2" vector-effect="non-scaling-stroke"/></svg>`);
  hintEl.textContent = 'Static view · illustrative data';
}

function init() {
  renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
  renderer.setClearColor(0x021C2A, 1);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 1, 0.05, 200);
  const D = 16;
  const group = new THREE.Group();
  scene.add(group);

  const uniforms = {
    uTime: { value: 0 },
    uIntro: { value: reduced ? 2 : 0 },
    uReduced: { value: reduced ? 1 : 0 },
    uF: { value: FORCE_BASE.map(f => new THREE.Vector4(...f)) },
    uROff: { value: FORCE_BASE.map(() => new THREE.Vector2()) },
    uCursor: { value: new THREE.Vector3(0, 0, 0) },
    uRip: { value: Array.from({ length: RIPPLES }, () => new THREE.Vector4(0, 0, -99, 0)) },
    uRipSeed: { value: new Array(RIPPLES).fill(0) },
    uYield: { value: new THREE.Vector4(0, 0, 99, 0) },
    uBehind: { value: 0 },
    uHot: { value: -1 },
    uHotAmt: { value: 0 },
    // Per force (BI, AI, Leadership): how gold it is, how bright its own point glows.
    uGoldAmt: { value: new THREE.Vector3() },
    uGlow: { value: new THREE.Vector3() },
    uHeat: { value: new Array(64).fill(0) },
    uCi0: { value: 999 },
    uStep: { value: 0 },
    uLit: { value: new Array(6).fill(-1) },
    uLitAmt: { value: new Array(6).fill(0) },
    uSpeed: { value: SPEED },
    uSize: { value: new THREE.Vector3(W, H, 0) },
    uNearest: { value: -1 },
    uDpr: { value: 1 },
    uBlue: { value: new THREE.Color(0x00486F) },
    uMist: { value: new THREE.Color(0xE4ECE9) },
    uSignal: { value: new THREE.Color(0xE0952F) },
    uGold: { value: new THREE.Color(0xF0C778) },
    uGlyphs: { value: null },
    uCell: { value: new THREE.Vector2(0.085, 0.13) },
  };

  const FIELD = /* glsl */`
    uniform float uTime, uSpeed, uReduced, uIntro, uBehind, uHot, uHotAmt;
    uniform vec4 uF[3];
    uniform vec2 uROff[3];
    uniform vec3 uCursor;
    uniform vec4 uRip[${RIPPLES}];
    uniform float uRipSeed[${RIPPLES}];
    uniform vec4 uYield;
    uniform vec3 uSize;

    float gWave, gGlyph;
    vec2 gOff;

    // z: how far the membrane is pushed towards the viewer. ring: where it is momentarily see-through.
    // wave: crest energy. glyph: the disturbance band where the code shows. off: in-plane pull.
    float fields(vec2 p, out float ring, out float wave, out float glyph, out vec2 off) {
      float z = 0.0;
      wave = 0.0;
      glyph = 0.0;
      off = vec2(0.0);
      vec2 d = p - uF[0].xy;
      z += uF[0].z * exp(-dot(d, d) / (uF[0].w * uF[0].w));
      d = p - uF[1].xy;
      float e = exp(-dot(d, d) / (uF[1].w * uF[1].w));
      z += uF[1].z * e * (0.8 + 0.2 * sin(length(d - vec2(0.32, 0.1)) * 10.0 - uTime * 1.3) * sin(length(d + vec2(0.3, -0.12)) * 8.5 - uTime * 0.9));
      d = p - uF[2].xy;
      float r = dot(d, d) / (uF[2].w * uF[2].w);
      z += uF[2].z * exp(-r * r);

      float zf = z;

      d = p - uCursor.xy;
      float press = uCursor.z * exp(-dot(d, d) / 0.55);
      z -= 0.42 * press;
      off -= d * 0.3 * press;

      ring = 0.0;

      // The membrane yields around the visitor crossing it, and heals once they have passed.
      if (uYield.w > 0.001) {
        vec2 dl = p - uYield.xy;
        float rl = length(dl);
        float Rl = 0.5 + 2.4 * uYield.w;
        float el = exp(-rl * rl / (Rl * Rl));
        off += dl / (rl + 1e-3) * Rl * 0.9 * el * uYield.w;
        z -= 0.9 * uYield.w * el;
        ring += uYield.w * el;
        float rim = (rl - Rl * 1.15) / (0.3 * Rl);
        glyph += 0.8 * uYield.w * exp(-rim * rim);
      }

      for (int i = 0; i < ${RIPPLES}; i++) {
        vec4 rp = uRip[i];
        float t = uTime - rp.z;
        if (rp.w <= 0.0 || t < 0.0 || t > 6.0) continue;
        vec2 dp = p - rp.xy;
        float dist = length(dp);
        if (uReduced > 0.5) {
          float disc = exp(-t * 1.6) * exp(-dist * dist / 2.5);
          ring += disc;
          glyph += 0.6 * disc * smoothstep(0.9, 1.7, dist);
          continue;
        }
        float s = uRipSeed[i];
        float th = atan(dp.y, dp.x);
        // An irregular front: a few angular harmonics with phases from this click's seed,
        // growing as it travels, so no two pulses are alike.
        float grow = min(1.0, t * 1.2);
        float wob = 0.16 * sin(2.0 * th + s * 1.3) + 0.11 * sin(3.0 * th + s * 2.7)
                  + 0.07 * sin(5.0 * th + s * 4.1) + 0.04 * sin(8.0 * th + s * 5.9 + t * 1.5);
        // The medium is not uniform: where the forces push the membrane, the pulse slows down.
        float slow = 1.0 - 0.3 * clamp(zf / 0.9, 0.0, 1.0);
        float f = dist - t * uSpeed * slow * (1.0 + wob * grow);
        // Some arcs carry the pulse, others almost vanish.
        float arcs = 0.3 + 0.7 * smoothstep(-0.3, 0.5, sin(3.0 * th + s * 3.3) + 0.6 * sin(5.0 * th + s * 1.9));
        // A single pulse with a small rebound: the membrane barely moves.
        float env = rp.w * exp(-t * 0.9) / (1.0 + dist * 0.45);
        float fr = f + 0.7;
        float h = env * arcs * (exp(-f * f * 2.5) - 0.3 * exp(-fr * fr * 2.5));
        z += h;
        off += normalize(dp + 1e-4) * h * 0.1;
        float fade = exp(-t * 0.55) * min(1.0, t * 4.0) * arcs;
        wave += fade * exp(-f * f * 3.5);
        // The code shows only in the disturbance itself, once the pulse has left the point of contact.
        float away = smoothstep(1.1, 2.3, dist) * smoothstep(0.3, 0.65, t);
        glyph += fade * away * (f > 0.0 ? exp(-f * f * 10.0) : exp(-f * f * 6.0));
        // The see-through band trails just behind the crest.
        float fb = f + 0.95;
        ring += exp(-t * 0.75) * exp(-fb * fb * 1.3) * min(1.0, t * 3.0) * (0.5 + 0.5 * arcs);
      }
      return z;
    }

    vec3 surface(vec2 p, out float ring, out vec3 n) {
      float r1, w1, g1; vec2 o1;
      float z = fields(p, ring, gWave, gGlyph, gOff);
      float zx = fields(p + vec2(0.05, 0.0), r1, w1, g1, o1);
      float zy = fields(p + vec2(0.0, 0.05), r1, w1, g1, o1);
      n = normalize(vec3(-(zx - z) / 0.05, -(zy - z) / 0.05, 1.0));
      return vec3(p + gOff, z);
    }

    float cursorNear(vec2 p, float r) {
      vec2 d = p - uCursor.xy;
      return uCursor.z * exp(-dot(d, d) / r);
    }

    float introAt(float x) {
      return smoothstep(0.0, 0.35, uIntro * 1.5 - (x / uSize.x + 0.5));
    }

    // Anything right in front of the camera fades, so the crossing never fills the screen with a smear.
    float nearCam(vec3 wp) {
      return smoothstep(0.3, 1.7, distance(wp, cameraPosition));
    }

    vec2 regOff(float r) {
      if (r < 0.5) return uROff[0];
      if (r < 1.5) return uROff[1];
      if (r < 2.5) return uROff[2];
      return vec2(0.0);
    }

    uniform vec3 uGoldAmt, uGlow;
    uniform float uStep;
    float perForce(vec3 v, float r) { return r < 0.5 ? v.x : r < 1.5 ? v.y : r < 2.5 ? v.z : 0.0; }
    // The formation's step forward: up the wall and into it.
    vec3 stepOff(float r) { return r > 1.5 && r < 2.5 ? vec3(0.0, 0.26, 0.1) * uStep : vec3(0.0); }
  `;

  const LIGHT = 'normalize(vec3(-0.45, 0.55, 0.7))';
  const additive = { transparent: true, depthTest: false, depthWrite: false, blending: THREE.AdditiveBlending };

  // ---------- membrane lines ----------
  const linesMat = new THREE.ShaderMaterial({
    uniforms, ...additive,
    vertexShader: FIELD + /* glsl */`
      attribute float aRow;
      uniform vec3 uBlue, uMist;
      varying float vA;
      varying vec3 vCol;
      void main() {
        float ring; vec3 n;
        vec3 pos = surface(position.xy, ring, n);
        vec4 wp = modelMatrix * vec4(pos, 1.0);
        vec3 N = normalize(mat3(modelMatrix) * n);
        vec3 V = normalize(cameraPosition - wp.xyz);
        vec3 L = ${LIGHT};
        float diff = clamp(dot(N, L), 0.0, 1.0);
        float spec = pow(max(dot(reflect(-L, N), V), 0.0), 22.0);
        float edge = smoothstep(0.5, 0.34, abs(position.x) / uSize.x) * smoothstep(0.5, 0.28, abs(position.y - uSize.z) / uSize.y);
        float energy = pow(0.5 + 0.5 * sin(position.x * 0.9 - uTime * 0.5 + aRow * 7.3), 16.0) * (1.0 - uReduced);
        float cur = cursorNear(position.xy, 0.9);
        float crest = clamp(gWave, 0.0, 1.0);
        vA = edge * (0.14 + 0.2 * diff + 0.75 * spec + 0.12 * energy + 0.3 * crest) * (1.0 - 0.88 * clamp(ring + 0.5 * crest, 0.0, 1.0)) * (1.0 - 0.5 * cur) * introAt(position.x);
        vA *= nearCam(wp.xyz) * mix(1.0, 0.72, uBehind);
        vCol = mix(uBlue + vec3(0.06, 0.16, 0.22), uMist, clamp(0.45 * spec + 0.08 * diff + 0.25 * crest, 0.0, 1.0));
        gl_Position = projectionMatrix * viewMatrix * wp;
      }`,
    fragmentShader: /* glsl */`
      varying float vA;
      varying vec3 vCol;
      void main() { gl_FragColor = vec4(vCol, vA); }`,
  });

  // ---------- translucent fill: catches light where the membrane folds ----------
  const fillMat = new THREE.ShaderMaterial({
    uniforms, ...additive, side: THREE.DoubleSide,
    vertexShader: FIELD + /* glsl */`
      varying float vF;
      varying float vEdge;
      varying float vRing;
      void main() {
        float ring; vec3 n;
        vec3 pos = surface(position.xy, ring, n);
        vec4 wp = modelMatrix * vec4(pos, 1.0);
        vec3 N = normalize(mat3(modelMatrix) * n);
        vec3 V = normalize(cameraPosition - wp.xyz);
        vF = pow(1.0 - abs(dot(N, V)), 2.0);
        vEdge = smoothstep(0.5, 0.3, abs(position.x) / uSize.x) * smoothstep(0.5, 0.24, abs(position.y - uSize.z) / uSize.y) * introAt(position.x) * nearCam(wp.xyz) * mix(1.0, 0.3, uBehind);
        vRing = clamp(ring, 0.0, 1.0);
        gl_Position = projectionMatrix * viewMatrix * wp;
      }`,
    fragmentShader: /* glsl */`
      uniform vec3 uBlue;
      varying float vF;
      varying float vEdge;
      varying float vRing;
      void main() {
        float a = (0.035 + 0.5 * vF) * vEdge * (1.0 - 0.9 * vRing);
        gl_FragColor = vec4(uBlue + vec3(0.02, 0.07, 0.1), a);
      }`,
  });

  // ---------- the chart: one row drawn as a ribbon, with its data points ----------
  const ribbonMat = new THREE.ShaderMaterial({
    uniforms, ...additive, side: THREE.DoubleSide,
    vertexShader: FIELD + /* glsl */`
      attribute vec2 aCenter;
      varying float vA;
      void main() {
        float ring; vec3 n;
        vec3 c = surface(aCenter, ring, n);
        // The line keeps a fine stroke even when the camera is right up against it.
        float wf = clamp(distance((modelMatrix * vec4(c, 1.0)).xyz, cameraPosition) / 9.0, 0.3, 1.0);
        vec3 pos = vec3(aCenter + (position.xy - aCenter) * wf + gOff, c.z);
        vec4 wp = modelMatrix * vec4(pos, 1.0);
        float edge = smoothstep(0.5, 0.42, abs(aCenter.x) / uSize.x);
        vA = 0.92 * edge * (1.0 - 0.6 * clamp(ring, 0.0, 1.0)) * introAt(aCenter.x) * nearCam(wp.xyz) * mix(1.0, 0.8, uBehind) * (1.0 - 0.75 * uYield.w);
        gl_Position = projectionMatrix * viewMatrix * wp;
      }`,
    fragmentShader: /* glsl */`
      uniform vec3 uMist;
      varying float vA;
      void main() { gl_FragColor = vec4(uMist, vA); }`,
  });

  const dotsMat = new THREE.ShaderMaterial({
    uniforms, ...additive,
    vertexShader: FIELD + /* glsl */`
      attribute float aIdx;
      uniform float uNearest, uDpr;
      uniform float uLit[6], uLitAmt[6];
      varying float vNear, vLit;
      varying float vA;
      void main() {
        float ring; vec3 n;
        vec3 pos = surface(position.xy, ring, n);
        vec4 wp = modelMatrix * vec4(pos, 1.0);
        float near = cursorNear(position.xy, 0.35);
        vNear = 1.0 - step(0.5, abs(aIdx - uNearest));
        // A point the BI's lineage has just fed lights up.
        float lit = 0.0;
        for (int i = 0; i < 6; i++) lit += uLitAmt[i] * (1.0 - step(0.5, abs(aIdx - uLit[i])));
        vLit = clamp(lit, 0.0, 1.0);
        float edge = smoothstep(0.5, 0.42, abs(position.x) / uSize.x);
        vA = edge * mix(0.55, 1.0, max(max(near, vNear), vLit)) * introAt(position.x) * nearCam(wp.xyz);
        gl_PointSize = mix(mix(2.6, 7.0, max(near, vNear)), 9.0, vLit) * uDpr;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }`,
    fragmentShader: /* glsl */`
      uniform vec3 uMist, uSignal, uGold;
      varying float vNear, vLit;
      varying float vA;
      void main() {
        vec2 c = gl_PointCoord - 0.5;
        float d = length(c);
        if (d > 0.5) discard;
        float a = smoothstep(0.5, 0.36, d) * vA;
        gl_FragColor = vec4(mix(mix(uMist, uSignal, vNear), uGold, vLit), a);
      }`,
  });

  // ---------- what lies behind: four structures, one system ----------
  // From the front only glimpses get through. After the crossing it is all there.
  const structMat = new THREE.ShaderMaterial({
    uniforms, ...additive,
    vertexShader: FIELD + /* glsl */`
      attribute float aReg, aT, aFlow, aSeed, aCi;
      attribute vec2 aLink;
      uniform vec3 uMist, uGold;
      uniform float uHeat[64], uCi0;
      varying float vA;
      varying vec3 vCol;
      void main() {
        vec3 p = position;
        p.xy += mix(regOff(aLink.x), regOff(aLink.y), aT);
        p += mix(stepOff(aLink.x), stepOff(aLink.y), aT);
        float ring, w, g; vec2 o;
        fields(p.xy, ring, w, g, o);
        float glimpse = (0.03 + 0.85 * clamp(ring, 0.0, 1.0) + 0.22 * cursorNear(p.xy, 1.1)) * smoothstep(1.0, 1.8, uIntro);
        glimpse *= 1.0 - 0.75 * smoothstep(-1.4, 0.4, p.z);
        float link = step(3.5, aReg);
        float base = aReg < 0.5 ? 0.3 : aReg < 1.5 ? 0.16 : aReg < 2.5 ? 0.6 : aReg < 3.5 ? 0.34 : 0.13;
        float dash = mix(1.0, step(0.5, fract(aT * 28.0)), link);
        // Signals travel along the structures: data towards the report, information towards one point, support outwards.
        // In gold they run brighter.
        float gold = perForce(uGoldAmt, aReg);
        float flow = aFlow > 0.0 ? pow(fract(aT * 2.0 - uTime * 0.2 * aFlow * (1.0 + gold) + aSeed * 7.0), 12.0) * (1.0 - uReduced) : 0.0;
        // An AI line glows a little while it carries the word in. The lines through the word are fainter than the rest
        // until they do: there are many of them, side by side.
        float heat = aCi >= 0.0 ? uHeat[int(aCi)] : 0.0;
        float thr = step(uCi0 - 0.5, aCi);
        base = mix(base, 0.06, thr);
        flow *= 1.0 - 0.6 * thr;
        float isHot = 1.0 - step(0.5, abs(aReg - uHot));
        float hot = isHot * uHotAmt;
        float dim = 1.0 - 0.6 * uHotAmt * (1.0 - isHot);
        float seen = (base * dash + (0.8 + 1.2 * gold) * flow + 0.35 * heat) * dim * (1.0 + 0.9 * hot);
        // The Leadership trails fade behind each point: brightest at the point (aT = 1), gone at the tail.
        float trail = mix(1.0, smoothstep(0.0, 1.0, aT), step(1.5, aReg) * step(aReg, 2.5));
        vec4 wp = modelMatrix * vec4(p, 1.0);
        vA = mix(glimpse, seen, uBehind) * trail * nearCam(wp.xyz);
        vCol = mix(uMist, uGold, gold * uBehind);
        gl_Position = projectionMatrix * viewMatrix * wp;
      }`,
    fragmentShader: /* glsl */`
      varying float vA;
      varying vec3 vCol;
      void main() { gl_FragColor = vec4(vCol, vA); }`,
  });

  const nodeMat = new THREE.ShaderMaterial({
    uniforms, ...additive,
    vertexShader: FIELD + /* glsl */`
      attribute float aReg, aSize, aOpen, aKey;
      uniform float uDpr;
      uniform vec3 uMist, uGold;
      varying float vA, vOpen;
      varying vec3 vCol;
      void main() {
        vec3 p = position;
        p.xy += regOff(aReg);
        p += stepOff(aReg);
        float ring, w, g; vec2 o;
        fields(p.xy, ring, w, g, o);
        float glimpse = (0.02 + 0.7 * clamp(ring, 0.0, 1.0)) * smoothstep(1.0, 1.8, uIntro) * (1.0 - 0.75 * smoothstep(-1.4, 0.4, p.z));
        float isHot = 1.0 - step(0.5, abs(aReg - uHot));
        float dim = 1.0 - 0.6 * uHotAmt * (1.0 - isHot);
        // A force's own point (the AI's one point, the formation's lead) glows when its moment comes.
        float glow = aKey * perForce(uGlow, aReg) * uBehind;
        vec4 wp = modelMatrix * vec4(p, 1.0);
        float dc = distance(wp.xyz, cameraPosition);
        vA = min(1.0, mix(glimpse, 0.85 * dim, uBehind) + glow) * nearCam(wp.xyz);
        vOpen = aOpen;
        vCol = mix(mix(uMist, uGold, perForce(uGoldAmt, aReg) * uBehind), vec3(1.0, 0.95, 0.85), glow);
        gl_PointSize = clamp(aSize * 52.0 / dc, 1.6, 9.0) * (1.0 + 1.4 * glow) * uDpr;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }`,
    fragmentShader: /* glsl */`
      varying float vA, vOpen;
      varying vec3 vCol;
      void main() {
        float d = length(gl_PointCoord - 0.5);
        if (d > 0.5) discard;
        float a = smoothstep(0.5, 0.38, d);
        if (vOpen > 0.5) a *= smoothstep(0.2, 0.3, d);
        gl_FragColor = vec4(vCol, a * vA);
      }`,
  });

  // ---------- the river of characters: what goes into the AI ----------
  // Single characters from the hero's own alphabet travel along the AI's lines towards the one point, large and loose
  // where a line starts, small and tight near the point, each one changing at its own pace. Flow stops under reduced motion.
  // When the AI turns gold the river steps back, as in the sketch.
  const riverMat = new THREE.ShaderMaterial({
    uniforms, ...additive,
    vertexShader: FIELD + /* glsl */`
      attribute vec3 aC1, aC2, aP3;
      attribute float aT0, aSeed;
      uniform float uDpr;
      uniform vec3 uMist;
      varying float vA, vG;
      varying vec3 vCol;
      float hash1(float x) { return fract(sin(x * 127.1) * 43758.5453); }
      void main() {
        float h = hash1(aSeed);
        float t = uReduced > 0.5 ? aT0 : fract(aT0 + uTime * (0.03 + 0.025 * h));
        float u = 1.0 - t;
        vec3 p = u * u * u * position + 3.0 * u * u * t * aC1 + 3.0 * u * t * t * aC2 + t * t * t * aP3;
        p.xy += regOff(1.0);
        float ring, w, g; vec2 o;
        fields(p.xy, ring, w, g, o);
        // From the front, only a hint: the characters show where a ripple passes, and barely otherwise.
        float glimpse = (0.006 + 0.5 * clamp(ring, 0.0, 1.0) + 0.06 * cursorNear(p.xy, 1.1)) * smoothstep(1.0, 1.8, uIntro) * (1.0 - 0.75 * smoothstep(-1.4, 0.4, p.z));
        float isHot = 1.0 - step(0.5, abs(1.0 - uHot));
        float dim = 1.0 - 0.6 * uHotAmt * (1.0 - isHot);
        float ends = smoothstep(0.0, 0.08, t) * smoothstep(0.97, 0.9, t);
        float seen = (0.34 + 0.4 * t) * ends * dim * (1.0 - 0.7 * uGoldAmt.y);
        vec4 wp = modelMatrix * vec4(p, 1.0);
        float dc = distance(wp.xyz, cameraPosition);
        vA = mix(glimpse, seen, uBehind) * nearCam(wp.xyz);
        vCol = uMist;
        // The character changes now and then, each at its own pace.
        float tick = uReduced > 0.5 ? 0.0 : floor(uTime * (1.2 + h * 2.2) + h * 40.0);
        vG = floor(hash1(aSeed + tick * 0.137) * 64.0);
        gl_PointSize = clamp((1.5 - t) * 150.0 / dc, 4.0, 22.0) * uDpr;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }`,
    fragmentShader: /* glsl */`
      uniform sampler2D uGlyphs;
      varying float vA, vG;
      varying vec3 vCol;
      void main() {
        if (vA < 0.01) discard;
        vec2 cell = vec2(mod(vG, 8.0), 7.0 - floor(vG / 8.0));
        vec2 uv = (cell + vec2(gl_PointCoord.x, 1.0 - gl_PointCoord.y)) / 8.0;
        float g = texture2D(uGlyphs, uv).r;
        gl_FragColor = vec4(vCol, g * vA);
      }`,
  });

  // ---------- the code under the surface: glyphs that show only where the pulse passes ----------
  const GLYPHS = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz0123456789#%&$+=';
  const atlas = document.createElement('canvas');
  const TILE = 64, GRID = 8;
  atlas.width = atlas.height = TILE * GRID;
  function drawAtlas() {
    const g = atlas.getContext('2d');
    g.fillStyle = '#000';
    g.fillRect(0, 0, atlas.width, atlas.height);
    g.fillStyle = '#fff';
    g.font = '500 36px "Martian Mono", ui-monospace, Menlo, monospace';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    for (let i = 0; i < GRID * GRID; i++) g.fillText(GLYPHS[i], (i % GRID) * TILE + TILE / 2, Math.floor(i / GRID) * TILE + TILE / 2 + 2);
  }
  drawAtlas();
  const glyphTex = new THREE.CanvasTexture(atlas);
  glyphTex.minFilter = THREE.LinearMipmapLinearFilter;
  glyphTex.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  uniforms.uGlyphs.value = glyphTex;
  document.fonts.load('500 36px "Martian Mono"').then(() => { drawAtlas(); glyphTex.needsUpdate = true; kick(); }).catch(() => {});

  const glyphMat = new THREE.ShaderMaterial({
    uniforms, ...additive, side: THREE.DoubleSide,
    vertexShader: FIELD + /* glsl */`
      varying vec2 vP;
      varying float vMask;
      varying float vEdge;
      void main() {
        float ring; vec3 n;
        vec3 pos = surface(position.xy, ring, n);
        vec4 wp = modelMatrix * vec4(pos, 1.0);
        vP = position.xy;
        vMask = clamp(gGlyph * 1.3, 0.0, 1.0);
        vEdge = smoothstep(0.5, 0.36, abs(position.x) / uSize.x) * smoothstep(0.5, 0.3, abs(position.y - uSize.z) / uSize.y) * nearCam(wp.xyz);
        gl_Position = projectionMatrix * viewMatrix * wp;
      }`,
    fragmentShader: /* glsl */`
      uniform sampler2D uGlyphs;
      uniform vec2 uCell;
      uniform float uTime, uReduced;
      uniform vec3 uBlue, uMist;
      varying vec2 vP;
      varying float vMask;
      varying float vEdge;
      float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      void main() {
        if (vMask * vEdge < 0.004) discard;
        vec2 q = vP / uCell;
        vec2 cell = floor(q);
        vec2 f = fract(q);
        float h = hash(cell);
        // Each cell scrambles at its own pace, so the band reads as code being decoded.
        float tick = uReduced > 0.5 ? 0.0 : floor(uTime * (5.0 + h * 9.0) + h * 40.0);
        float gi = floor(hash(cell + tick * 0.137) * 64.0);
        vec2 uv = (vec2(mod(gi, 8.0), 7.0 - floor(gi / 8.0)) + f) / 8.0;
        float g = texture2D(uGlyphs, uv).r;
        // About 28% of cells carry a glyph: sparse, so it stays a hint.
        float lit = step(0.72, hash(cell + 7.3));
        float b = min(1.0, vMask * 1.7) * mix(0.35, 1.0, hash(cell + 3.1)) * lit;
        float hot = smoothstep(0.55, 1.0, vMask) * step(0.75, hash(cell + 9.7));
        vec3 col = mix(uBlue + vec3(0.1, 0.32, 0.46), uMist, hot);
        gl_FragColor = vec4(col, g * b * vEdge);
      }`,
  });

  // ---------- the words on the far side: one particle each, moved by the CPU (see the words section below) ----------
  // Shape 0 is a character from the hero's alphabet, 1 a table cell, 2 a point. aBlue is the glitch's offset ghost.
  const wordMat = new THREE.ShaderMaterial({
    uniforms, ...additive,
    vertexShader: /* glsl */`
      attribute float aA, aS, aG, aShape, aBlue;
      uniform float uDpr, uBehind;
      varying float vA, vG, vShape, vBlue;
      void main() {
        vA = aA * uBehind; vG = aG; vShape = aShape; vBlue = aBlue;
        gl_PointSize = aS * uDpr;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: /* glsl */`
      uniform sampler2D uGlyphs;
      uniform vec3 uMist;
      varying float vA, vG, vShape, vBlue;
      void main() {
        if (vA < 0.01) discard;
        vec2 pc = gl_PointCoord;
        float a;
        if (vShape < 0.5) {
          vec2 cell = vec2(mod(vG, 8.0), 7.0 - floor(vG / 8.0));
          a = texture2D(uGlyphs, (cell + vec2(pc.x, 1.0 - pc.y)) / 8.0).r;
        } else if (vShape < 1.5) {
          // A cell: a fine square outline with a faint fill.
          vec2 d = abs(pc - 0.5);
          float m = max(d.x, d.y);
          a = smoothstep(0.5, 0.44, m) * (0.25 + 0.75 * smoothstep(0.32, 0.4, m));
        } else {
          a = smoothstep(0.5, 0.15, length(pc - 0.5));
        }
        gl_FragColor = vec4(mix(uMist, vec3(0.25, 0.71, 1.0), vBlue), a * vA);
      }`,
  });

  // The gold word: drawn once into a texture, laid over the scene on a plane that faces the visitor, revealed by a sweep.
  const goldMat = () => new THREE.ShaderMaterial({
    ...additive,
    uniforms: { uTex: { value: null }, uAmt: { value: 0 }, uSweep: { value: 1 }, uTime: uniforms.uTime, uReduced: uniforms.uReduced, uBehind: uniforms.uBehind },
    vertexShader: /* glsl */`
      varying vec2 vUv;
      void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */`
      uniform sampler2D uTex;
      uniform float uAmt, uSweep, uTime, uReduced, uBehind;
      varying vec2 vUv;
      void main() {
        if (uAmt < 0.003 || vUv.x > uSweep) discard;
        vec3 c = texture2D(uTex, vUv).rgb;
        float breathe = uReduced > 0.5 ? 1.0 : 0.92 + 0.08 * sin(uTime / 1.1);
        float edge = smoothstep(uSweep - 0.05, uSweep, vUv.x) * 0.35 * (1.0 - smoothstep(0.9, 1.04, uSweep));
        gl_FragColor = vec4((c * breathe + vec3(1.0, 0.886, 0.647) * edge) * uAmt * uBehind, 1.0);
      }`,
  });

  // ---------- geometry ----------
  let built = null, STRUCT = null;
  const dotPos = [];

  function build(mobile) {
    if (built) built.forEach(o => { group.remove(o); o.geometry.dispose(); });
    built = [];
    dotPos.length = 0;
    const ROWS = mobile ? 46 : 64, COLS = mobile ? 160 : 240, DOT_STEP = mobile ? 6 : 8;
    const sp = H / (ROWS - 1), ic = Math.floor(ROWS * 0.47);
    const midY = CHART_Y + ((ROWS - 1) / 2 - ic) * sp;
    uniforms.uSize.value.set(W, H, midY);
    const v = series(COLS);
    const xs = [], dy = [];
    for (let j = 0; j < COLS; j++) { xs.push(-W / 2 + j * W / (COLS - 1)); dy.push(CHART_A * (v[j] - 0.5)); }

    // Rows bend around the chart: the closer to it, the more they follow it.
    const pos = [], row = [], idx = [];
    for (let i = 0; i < ROWS; i++) {
      const y0 = CHART_Y + (i - ic) * sp;
      const g = Math.exp(-Math.pow((y0 - CHART_Y) / LAMBDA, 2));
      for (let j = 0; j < COLS; j++) {
        pos.push(xs[j], y0 + dy[j] * g, 0);
        row.push(i);
        if (j < COLS - 1) idx.push(i * COLS + j, i * COLS + j + 1);
      }
    }
    const lg = new THREE.BufferGeometry();
    lg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    lg.setAttribute('aRow', new THREE.Float32BufferAttribute(row, 1));
    lg.setIndex(idx);
    const membrane = new THREE.LineSegments(lg, linesMat);

    const fg = new THREE.PlaneGeometry(W, H * 1.04, mobile ? 110 : 160, mobile ? 60 : 84);
    fg.translate(0, midY, 0);
    const fill = new THREE.Mesh(fg, fillMat);

    const rp = [], rc = [], ri = [], hw = 0.02;
    for (let j = 0; j < COLS; j++) {
      const y = CHART_Y + dy[j];
      rp.push(xs[j], y - hw, 0, xs[j], y + hw, 0);
      rc.push(xs[j], y, xs[j], y);
      if (j < COLS - 1) { const k = j * 2; ri.push(k, k + 1, k + 2, k + 1, k + 3, k + 2); }
    }
    const rg = new THREE.BufferGeometry();
    rg.setAttribute('position', new THREE.Float32BufferAttribute(rp, 3));
    rg.setAttribute('aCenter', new THREE.Float32BufferAttribute(rc, 2));
    rg.setIndex(ri);
    const ribbon = new THREE.Mesh(rg, ribbonMat);

    const dp = [], di = [];
    for (let j = DOT_STEP / 2, k = 0; j < COLS; j += DOT_STEP, k++) {
      dp.push(xs[j], CHART_Y + dy[j], 0);
      di.push(k);
      dotPos.push([xs[j], CHART_Y + dy[j]]);
    }
    const dg = new THREE.BufferGeometry();
    dg.setAttribute('position', new THREE.Float32BufferAttribute(dp, 3));
    dg.setAttribute('aIdx', new THREE.Float32BufferAttribute(di, 1));
    const dots = new THREE.Points(dg, dotsMat);

    STRUCT = buildStructure(mobile);
    const structLines = new THREE.LineSegments(STRUCT.lines, structMat);
    const structNodes = new THREE.Points(STRUCT.nodes, nodeMat);
    const river = new THREE.Points(STRUCT.river, riverMat);

    const gg = new THREE.PlaneGeometry(W, H * 1.04, mobile ? 110 : 160, mobile ? 60 : 84);
    gg.translate(0, midY, 0);
    const glyphs = new THREE.Mesh(gg, glyphMat);
    uniforms.uCell.value.set(mobile ? 0.15 : 0.105, mobile ? 0.22 : 0.16);

    [[fill, 0], [membrane, 1], [glyphs, 2], [ribbon, 3], [dots, 4], [structLines, -1], [structNodes, -1], [river, -1]].forEach(([o, order]) => {
      o.frustumCulled = false;
      o.renderOrder = order;
      group.add(o);
      built.push(o);
    });
  }

  // BI: tables behind the wall, with lineage lines rising into the chart's own data points.
  // AI: many inputs converging onto a single point, carrying a river of characters.
  // Leadership: a formation, one point in front at the wall and six behind it in two wings.
  // A few dashed links make it one system.
  function buildStructure(mobile) {
    const R = rng(23);
    const LP = [], LR = [], LT = [], LF = [], LS = [], LL = [], LC = [];
    const NP = [], NR = [], NS = [], NO = [], NK = [];
    const picks = [[], [], []];
    const d3 = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
    const mix3 = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
    const line = (a, b, n = 12) => Array.from({ length: n + 1 }, (_, i) => mix3(a, b, i / n));
    const quad = (a, c, b, n = 24) => Array.from({ length: n + 1 }, (_, i) => {
      const t = i / n, u = 1 - t;
      return [0, 1, 2].map(k => u * u * a[k] + 2 * u * t * c[k] + t * t * b[k]);
    });
    const cubic = (a, b, c, d, n = 28) => Array.from({ length: n + 1 }, (_, i) => {
      const t = i / n, u = 1 - t;
      return [0, 1, 2].map(k => u * u * u * a[k] + 3 * u * u * t * b[k] + 3 * u * t * t * c[k] + t * t * t * d[k]);
    });
    const touch = (x, y) => [x, y, surfaceZ(x, y) - 0.05];

    function path(pts, reg, flow = 0, la = reg, lb = reg, ci = -1) {
      const seed = R(), len = [0];
      for (let i = 1; i < pts.length; i++) len.push(len[i - 1] + d3(pts[i - 1], pts[i]));
      const total = len[len.length - 1] || 1;
      for (let i = 0; i < pts.length - 1; i++) {
        for (const j of [i, i + 1]) {
          LP.push(...pts[j]); LR.push(reg); LT.push(len[j] / total); LF.push(flow); LS.push(seed); LL.push(la, lb); LC.push(ci);
        }
      }
      return { pts, cum: len.map(l => l / total) };
    }
    function node(p, reg, size = 1, open = 0, key = 0) {
      NP.push(...p); NR.push(reg); NS.push(size); NO.push(open); NK.push(key);
      picks[reg].push(p);
    }

    // ----- BI: what feeds the chart -----
    // Tables behind the wall: one at the top, a wider one below, three separate sources at the bottom. Lineage lines
    // rise from the sources, through the others, into the chart's own data points on the membrane.
    const [bx, by] = FORCE_BASE[0];
    const TB = [
      { cx: bx, cy: by - 0.85, z: -1.3, w: 1.9, h: 0.56, cols: 3, rows: 3 },
      { cx: bx, cy: by - 1.75, z: -2.6, w: 2.9, h: 0.7, cols: 5, rows: 4 },
      { cx: bx - 1.45, cy: by - 2.7, z: -3.9, w: 1.0, h: 0.62, cols: 2, rows: 3 },
      { cx: bx, cy: by - 2.7, z: -3.9, w: 1.0, h: 0.62, cols: 2, rows: 3 },
      { cx: bx + 1.45, cy: by - 2.7, z: -3.9, w: 1.0, h: 0.62, cols: 2, rows: 3 },
    ];
    const cell = (t, c, r) => [t.cx - t.w / 2 + (c + 0.5) * t.w / t.cols, t.cy + t.h / 2 - 0.1 - (r + 0.5) * (t.h - 0.1) / t.rows, t.z];
    TB.forEach(t => {
      const x0 = t.cx - t.w / 2, x1 = t.cx + t.w / 2, y0 = t.cy - t.h / 2, y1 = t.cy + t.h / 2, hy = y1 - 0.1;
      [[x0, y0], [x1, y0], [x1, y1], [x0, y1]].forEach(([x, y], i, c) => { const [nx, ny] = c[(i + 1) % 4]; path(line([x, y, t.z], [nx, ny, t.z], 8), 0); });
      // The header: a second line close to the top edge.
      path(line([x0, hy, t.z], [x1, hy, t.z], 8), 0);
      path(line([x0, hy - 0.025, t.z], [x1, hy - 0.025, t.z], 8), 0);
      for (let r = 1; r < t.rows; r++) { const y = hy - r * (t.h - 0.1) / t.rows; path(line([x0, y, t.z], [x1, y, t.z], 6), 0); }
      for (let c = 1; c < t.cols; c++) { const x = x0 + c * t.w / t.cols; path(line([x, hy, t.z], [x, y0, t.z], 4), 0); }
    });
    // Lineage: six lines, each from a source cell, through the two tables above, to its own point on the chart.
    const chartDots = dotPos.filter(p => Math.abs(p[0] - bx) < 1.7).sort((a, b) => a[0] - b[0]);
    const srcCells = [[2, 0, 1], [2, 1, 2], [3, 0, 0], [3, 1, 2], [4, 0, 1], [4, 1, 0]];
    const lineage = [];
    srcCells.forEach(([ti, c, r], i) => {
      const a = cell(TB[ti], c, r), m = cell(TB[1], Math.min(4, i), 1 + (i % 3)), tp = cell(TB[0], Math.min(2, Math.floor(i / 2)), i % 3);
      const d = chartDots[Math.min(chartDots.length - 1, Math.round(i * (chartDots.length - 1) / 5))] || [bx, by];
      const end = touch(d[0], d[1]);
      const pl = path(line(a, m, 8).concat(line(m, tp, 8).slice(1), line(tp, end, 10).slice(1)), 0, 0.7 + R() * 0.5);
      // Which point of the chart this line feeds, so the BI's word can light it.
      lineage.push({ ...pl, dot: dotPos.indexOf(d), end });
      node(a, 0, 0.8); node(m, 0, 0.8); node(tp, 0, 0.9);
    });
    node(touch(bx, by), 0, 1.2);

    // ----- AI -----
    const [ax, ay] = FORCE_BASE[1];
    const apexA = touch(ax, ay);
    const NC = mobile ? 30 : 44, PER = mobile ? 6 : 8;
    const RP = [], RC1 = [], RC2 = [], RP3 = [], RT = [], RS = [];
    const curves = [];
    for (let i = 0; i < NC; i++) {
      const ang = i * 2.39996, rad = 0.9 + 1.5 * Math.sqrt((i + 0.5) / NC);
      const s = [ax + Math.cos(ang) * rad, ay + Math.sin(ang) * rad * 0.82, -4.4 - R() * 1.4];
      const c1 = [ax + Math.cos(ang) * rad * 0.95, ay + Math.sin(ang) * rad * 0.78, -3.0];
      const c2 = [ax + Math.cos(ang) * 0.2, ay + Math.sin(ang) * 0.17, -1.4];
      path(cubic(s, c1, c2, apexA, 30), 1, 0.5 + R() * 0.7, 1, 1, i);
      curves.push([s, c1, c2, apexA]);
      node(s, 1, 0.6 + R() * 0.5);
      // The river: a few characters on each line, spaced along it, each moving at its own pace (see riverMat).
      for (let k = 0; k < PER; k++) {
        RP.push(...s); RC1.push(...c1); RC2.push(...c2); RP3.push(...apexA);
        RT.push((k + R() * 0.6) / PER); RS.push(R() * 100);
      }
    }
    node(apexA, 1, 1.6, 0, 1);
    const river = new THREE.BufferGeometry();
    river.setAttribute('position', new THREE.Float32BufferAttribute(RP, 3));
    river.setAttribute('aC1', new THREE.Float32BufferAttribute(RC1, 3));
    river.setAttribute('aC2', new THREE.Float32BufferAttribute(RC2, 3));
    river.setAttribute('aP3', new THREE.Float32BufferAttribute(RP3, 3));
    river.setAttribute('aT0', new THREE.Float32BufferAttribute(RT, 1));
    river.setAttribute('aSeed', new THREE.Float32BufferAttribute(RS, 1));

    // ----- Leadership: a formation -----
    // One point in front, at the wall; six behind in two wings, each with a trail that fades behind it (see structMat).
    // No lines join them: the formation is in where they are.
    const [lx, ly] = FORCE_BASE[2];
    const lead = touch(lx, ly), form = [lead];
    // The V lies against the wall: the lead at its point, the wings below it and a little behind it in depth,
    // so that from behind the camera sees the formation flat, as it is.
    for (let k = 1; k <= 3; k++) { form.push([lx + 0.66 * k, ly - 0.55 * k, lead[2] - 0.3 - 0.35 * k]); form.push([lx - 0.66 * k, ly - 0.55 * k, lead[2] - 0.3 - 0.35 * k]); }
    form.forEach((p, i) => {
      const len = i === 0 ? 1.8 : 1.0 + R() * 0.5, ph = R() * 6, pts = [];
      // The trail runs straight behind the point with a slight waver, from the tail (aT = 0) to the point (aT = 1).
      for (let s = 0; s <= 14; s++) { const a = s / 14, back = (1 - a) * len; pts.push([p[0] + 0.08 * Math.sin(ph + back * 2.0) * (1 - a), p[1] - back, p[2] - back * 0.25]); }
      path(pts, 2, i === 0 ? 0.9 : 0.55);
      node(p, 2, i === 0 ? 2.0 : 1.35, 0, i === 0 ? 1 : 0);
    });

    // ----- links -----
    const link = (a, b, la, lb) => {
      const m = mix3(a, b, 0.5);
      path(quad(a, [m[0], m[1] + 0.9, m[2] - 1.5], b, 40), 4, 0, la, lb);
    };
    link([bx, by - 2.3, -3.7], [ax, ay, -4.9], 0, 1);
    link(form[6], [bx, by - 1.5, -2.5], 2, 0);
    link(form[5], [ax + 0.8, ay, -4.8], 2, 1);

    const lines = new THREE.BufferGeometry();
    lines.setAttribute('position', new THREE.Float32BufferAttribute(LP, 3));
    lines.setAttribute('aReg', new THREE.Float32BufferAttribute(LR, 1));
    lines.setAttribute('aT', new THREE.Float32BufferAttribute(LT, 1));
    lines.setAttribute('aFlow', new THREE.Float32BufferAttribute(LF, 1));
    lines.setAttribute('aSeed', new THREE.Float32BufferAttribute(LS, 1));
    lines.setAttribute('aLink', new THREE.Float32BufferAttribute(LL, 2));
    lines.setAttribute('aCi', new THREE.Float32BufferAttribute(LC, 1));
    const nodes = new THREE.BufferGeometry();
    nodes.setAttribute('position', new THREE.Float32BufferAttribute(NP, 3));
    nodes.setAttribute('aReg', new THREE.Float32BufferAttribute(NR, 1));
    nodes.setAttribute('aSize', new THREE.Float32BufferAttribute(NS, 1));
    nodes.setAttribute('aOpen', new THREE.Float32BufferAttribute(NO, 1));
    nodes.setAttribute('aKey', new THREE.Float32BufferAttribute(NK, 1));

    // Where each label attaches to its structure.
    const anchors = [
      [bx - 2.2, by - 2.5, -3.9],
      [ax - 2.3, ay + 0.3, -5.0],
      [lx + 2.6, ly - 0.9, -1.2],
    ];
    // Each force's own point, which its word is placed from: the middle table, the one point, the lead.
    const keys = [[TB[1].cx, TB[1].cy, TB[1].z], apexA, lead];
    return { lines, nodes, river, picks, anchors, keys, curves, lineage, form };
  }

  // ---------- the crossing: a camera path through the membrane, then round to look back at it ----------
  const C = new THREE.Vector3(0.3, -0.6, -3.0);      // centre of what lies behind
  const PASS = new THREE.Vector3(1.5, -1.5, -0.9);   // just past the membrane, through a gap between the forces
  const EYE0 = new THREE.Vector3(0, 0, D), TGT0 = new THREE.Vector3(0, 0, 0);
  const A_END = 0.5, PHI_END = 0.72 * Math.PI, LIFT_END = 0.24;
  const camPos = new THREE.Vector3(), camTgt = new THREE.Vector3(), v0 = new THREE.Vector3(), dir = new THREE.Vector3();
  v0.subVectors(PASS, C);
  const R0 = v0.length();
  v0.normalize();

  function rig(u) {
    if (u <= A_END) {
      const a = u / A_END;
      // Quick from far away, slower at the surface: the crossing is the moment.
      const ea = 0.75 * (1 - (1 - a) ** 2) + 0.25 * a;
      camPos.lerpVectors(EYE0, PASS, ea);
      camTgt.lerpVectors(TGT0, C, smooth(0, 1, a));
    } else {
      const b = (u - A_END) / (1 - A_END);
      const rr = 0.7 * smooth(0, 1, b) + 0.3 * b;
      const ph = PHI_END * smooth(0.06, 1, b);
      const c = Math.cos(ph), s = Math.sin(ph);
      dir.set(v0.x * c + v0.z * s, lerp(v0.y, LIFT_END, smooth(0, 1, b)), -v0.x * s + v0.z * c).normalize();
      camPos.copy(C).addScaledVector(dir, lerp(R0, L.rEnd, rr));
      camTgt.copy(C);
    }
  }

  // ---------- the words: each force says its name in its own material, then hands it to the force ----------
  // AI (the sketch of 25 October, "the singularity"): characters glitch in, hold, and are swallowed along the lines into
  // the one point; an answer comes out of it. BI: cells fill in row by row, like a table loading, then rise along the
  // lineage and light the chart's own points. Leadership: points fly in with trails to write the word, then join the
  // formation, which steps forward while its lead glows. Pointing at a force (or the first tap) shows its word composed,
  // in gold, and plays its moment. One word at a time; with reduced motion the words stand still.
  const ANSWERS = ['no edge yet.', '62% sure. Bar: 95%.', 'a payment lapsed.'];
  const MF = 200, WORD_FONT = `800 ${MF}px "Mona Sans", "Arial Black", Arial, sans-serif`;
  const WORDS = [
    { text: 'BI', shape: 1, rows: [9, 14], inT: 0.95, holdT: 0.9 },
    { text: 'AI', shape: 0, rows: [15, 26], inT: 0.7, holdT: 1.0 },
    { text: 'LEAD', shape: 2, rows: [8, 12], inT: 1.2, holdT: 0.8 },
  ].map((w, k) => ({ ...w, k, pts: [], ph: 'idle', t0: 0, bands: [], bandT: 0, moment: false, fed: [], gold: 0, goldOn: false, goldT: 0, mesh: null, tex: null }));
  // Where each word sits on the far side, as seen from there: its centre, in units of its own height, from the force's
  // own point; and its height, as a share of the screen's shorter side. Tall screens use the space above and below.
  const PLACE = {
    wide: [{ dx: -2.45, dy: 0.58, h: 0.11 }, { dx: -1.9, dy: -0.42, h: 0.16 }, { dx: 0.5, dy: 2.45, h: 0.066 }],
    tall: [{ dx: 0.2, dy: 2.3, h: 0.12 }, { dx: -0.92, dy: -1.4, h: 0.15 }, { dx: 0.5, dy: 4.4, h: 0.078 }],
  };

  function drawMasks() {
    WORDS.forEach(w => {
      const c = document.createElement('canvas');
      let g = c.getContext('2d');
      g.font = WORD_FONT;
      c.width = Math.ceil(g.measureText(w.text).width) + 40;
      c.height = Math.round(MF * 0.9);
      g = c.getContext('2d');
      g.font = WORD_FONT;
      g.fillStyle = '#fff';
      g.fillText(w.text, 20, Math.round(MF * 0.8));
      const d = g.getImageData(0, 0, c.width, c.height).data, m = new Uint8Array(c.width * c.height);
      let x0 = 1e9, x1 = -1, y0 = 1e9, y1 = -1;
      for (let i = 0; i < m.length; i++) {
        if (d[i * 4 + 3] < 128) continue;
        m[i] = 1;
        const px = i % c.width, py = (i - px) / c.width;
        x0 = Math.min(x0, px); x1 = Math.max(x1, px); y0 = Math.min(y0, py); y1 = Math.max(y1, py);
      }
      Object.assign(w, { mask: m, mw: c.width, mh: c.height, x0, x1, y0, y1, cx: (x0 + x1) / 2, cy: (y0 + y1) / 2, lw: 0 });
    });
  }
  const onMask = (w, x, y) => { x |= 0; y |= 0; return x >= 0 && y >= 0 && x < w.mw && y < w.mh && w.mask[y * w.mw + x] === 1; };

  // The gold word, as in the sketch: a glowing outline, a fine mesh inside, a loose constellation around, a few stars;
  // only the AI comes apart, in shards off the side that faces its point. lw thickens the strokes when the word is small.
  function drawGold(w, lw) {
    const R = rng(29 + w.k), S2 = 3, MG = 60, on = (x, y) => onMask(w, x, y);
    const ox = w.x0 - MG, oy = w.y0 - MG;
    const c = document.createElement('canvas');
    c.width = Math.round((w.x1 - w.x0 + 2 * MG) * S2);
    c.height = Math.round((w.y1 - w.y0 + 2 * MG) * S2);
    const g = c.getContext('2d');
    g.fillStyle = '#000';
    g.fillRect(0, 0, c.width, c.height);
    g.setTransform(S2, 0, 0, S2, -ox * S2, -oy * S2);
    g.globalCompositeOperation = 'lighter';
    g.lineCap = g.lineJoin = 'round';
    const col = a => `rgba(240,199,120,${a})`;
    const pts = [];
    for (let y = w.y0; y <= w.y1; y++) for (let x = w.x0; x <= w.x1; x++) {
      if (on(x, y) && (!on(x - 1, y) || !on(x + 1, y) || !on(x, y - 1) || !on(x, y + 1)) && R() < 0.42) pts.push({ x, y, t: 'edge' });
    }
    for (let n = 0, tries = 0; n < 700 * w.text.length && tries < 2e5; tries++) {
      const x = w.x0 + R() * (w.x1 - w.x0), y = w.y0 + R() * (w.y1 - w.y0);
      if (on(x, y)) { pts.push({ x, y, t: 'in' }); n++; }
    }
    if (w.k === 1) for (let n = 0, tries = 0; n < 240 && tries < 6e4; tries++) {
      const x = w.x0 + R() * (w.x1 - w.x0 + 70), y = w.y0 + R() * (w.y1 - w.y0);
      if (on(x, y)) continue;
      let dl = 0;
      while (dl < 70 && !on(x - dl, y)) dl++;
      if (dl >= 2 && dl < 70 && R() < Math.exp(-dl / 16)) { pts.push({ x, y, t: 'frag' }); n++; }
    }
    const amb = [];
    for (let n = 0; n < 45 * w.text.length;) {
      const x = w.x0 - 50 + R() * (w.x1 - w.x0 + 100), y = w.y0 - 45 + R() * (w.y1 - w.y0 + 90);
      if (!on(x, y)) { amb.push({ x, y, t: 'amb' }); n++; }
    }
    const link = (P, r, maxN) => {
      const grid = new Map(), key = (i, j) => i + ',' + j, out = [], seen = new Set();
      P.forEach((p, i) => { const k = key(Math.floor(p.x / r), Math.floor(p.y / r)); (grid.get(k) || grid.set(k, []).get(k)).push(i); });
      P.forEach((p, i) => {
        const gx = Math.floor(p.x / r), gy = Math.floor(p.y / r), cand = [];
        for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) (grid.get(key(gx + a, gy + b)) || []).forEach(j => {
          if (j !== i) { const d = Math.hypot(P[j].x - p.x, P[j].y - p.y); if (d < r) cand.push([d, j]); }
        });
        cand.sort((u, v) => u[0] - v[0]).slice(0, maxN).forEach(([, j]) => {
          const s = i < j ? i + '-' + j : j + '-' + i;
          if (!seen.has(s)) { seen.add(s); out.push([p, P[j]]); }
        });
      });
      return out;
    };
    const stroke = (ls, width, a) => { g.lineWidth = width * lw; g.strokeStyle = col(a); g.beginPath(); ls.forEach(([p, q]) => { g.moveTo(p.x, p.y); g.lineTo(q.x, q.y); }); g.stroke(); };
    const dot = (x, y, r) => { g.beginPath(); g.arc(x, y, r, 0, 6.2832); g.fill(); };
    stroke(link(amb, 48, 2), 0.5, 0.07);
    g.fillStyle = col(0.35);
    amb.forEach(p => dot(p.x, p.y, 0.8 * lw));
    g.font = WORD_FONT;
    g.fillStyle = col(0.05);
    g.fillText(w.text, 20, Math.round(MF * 0.8));
    const groups = { in: [], edge: [], frag: [] };
    link(pts, 12, 4).forEach(l => groups[l[0].t === 'frag' || l[1].t === 'frag' ? 'frag' : l[0].t === 'edge' && l[1].t === 'edge' ? 'edge' : 'in'].push(l));
    stroke(groups.in, 0.45, 0.2); stroke(groups.frag, 0.5, 0.3); stroke(groups.edge, 0.7, 0.55);
    pts.filter(p => p.t === 'frag' && R() < 0.3).forEach(p => {
      const s = 2.5 + R() * 5, a = R() * 6.28, b = a + 2 + R();
      g.beginPath(); g.moveTo(p.x, p.y); g.lineTo(p.x + s * Math.cos(a), p.y + s * Math.sin(a)); g.lineTo(p.x + s * Math.cos(b), p.y + s * Math.sin(b)); g.closePath();
      g.fillStyle = col(0.1); g.fill(); g.lineWidth = 0.5 * lw; g.strokeStyle = col(0.35); g.stroke();
    });
    g.shadowColor = 'rgba(240,190,100,.9)';
    g.shadowBlur = 7 * S2 * lw;
    g.lineWidth = 1.1 * lw;
    g.strokeStyle = 'rgba(255,226,165,.85)';
    g.strokeText(w.text, 20, Math.round(MF * 0.8));
    g.shadowBlur = 0;
    g.lineWidth = 0.6 * lw;
    g.strokeStyle = 'rgba(255,240,205,.8)';
    g.strokeText(w.text, 20, Math.round(MF * 0.8));
    // Inside, a deeper gold and less of it: added up over hundreds of points, a pale gold turns white.
    pts.forEach(p => { g.fillStyle = p.t === 'in' ? 'rgba(240,186,96,.38)' : 'rgba(252,222,155,.85)'; dot(p.x, p.y, (p.t === 'edge' ? 0.75 : p.t === 'frag' ? 0.7 : 0.55) * lw); });
    pts.filter(p => R() < (p.t === 'edge' ? 0.03 : p.t === 'frag' ? 0.05 : 0.006)).forEach(p => {
      const hg = g.createRadialGradient(p.x, p.y, 0, p.x, p.y, 6 * lw);
      hg.addColorStop(0, 'rgba(255,232,180,.55)'); hg.addColorStop(1, 'rgba(255,232,180,0)');
      g.fillStyle = hg; dot(p.x, p.y, 6 * lw);
      g.fillStyle = '#FFF4DC'; dot(p.x, p.y, 1.2 * lw);
    });
    return c;
  }

  // Placing the words needs the view from the far side, where they are read: a second camera, set as the real one ends.
  const endCam = new THREE.PerspectiveCamera(30, 1, 0.05, 200);
  const wv = new THREE.Vector3(), wr = new THREE.Vector3(), wu = new THREE.Vector3(), wf = new THREE.Vector3();
  const bez3 = (c, t) => { const u = 1 - t; return [0, 1, 2].map(i => u * u * u * c[0][i] + 3 * u * u * t * c[1][i] + 3 * u * t * t * c[2][i] + t * t * t * c[3][i]); };
  const alongPath = (pl, t) => {
    let i = 1;
    while (i < pl.cum.length - 1 && pl.cum[i] < t) i++;
    const a = pl.pts[i - 1], b = pl.pts[i], f = clamp((t - pl.cum[i - 1]) / ((pl.cum[i] - pl.cum[i - 1]) || 1), 0, 1);
    return [lerp(a[0], b[0], f), lerp(a[1], b[1], f), lerp(a[2], b[2], f)];
  };
  let wordPts = null, throughObj = null, aiCurves = [];

  // As in the sketch, most of the lines into the AI's point cross its word on the way: they start beside it, run
  // through it and on to the point, and they are the ones that carry it in. They depend on where the word sits.
  function throughLines(w, toPx, depth) {
    const R = rng(41), f = w.frame, NT = L.mobile ? 10 : 16, hc = f.hh * 2, ap = toPx(STRUCT.keys[1]);
    wv.set(...STRUCT.keys[1]).sub(endCam.position);
    const apDepth = wv.dot(wf);
    const at = (x, y, d) => {
      wv.set(x / L.w * 2 - 1, -y / L.h * 2 + 1, 0.5).unproject(endCam).sub(endCam.position).normalize();
      return endCam.position.clone().addScaledVector(wv, d / wv.dot(wf)).toArray();
    };
    const through = [];
    for (let i = 0; i < NT; i++) {
      const y = f.sy - f.hh + (i + 0.5) / NT * 2 * f.hh + (R() - 0.5) * 0.1 * hc;
      through.push([
        at(f.sx - f.hw * (1.5 + R() * 0.6), y + (R() - 0.5) * 0.3 * hc, depth - 0.6),
        at(f.sx - f.hw + (0.35 + R() * 0.6) * 2 * f.hw, y + (R() - 0.5) * 0.15 * hc, depth),
        at(ap[0] - (0.67 + R() * 0.33) * hc, ap[1] + (y - ap[1]) * (0.22 + R() * 0.3), apDepth - 1.4),
        STRUCT.keys[1],
      ]);
    }
    aiCurves = STRUCT.curves.concat(through);
    uniforms.uCi0.value = STRUCT.curves.length;
    const P = [], T = [], F = [], SD = [], CI = [];
    through.forEach((c, i) => {
      const fl = 0.5 + R() * 0.7, sd = R();
      for (let j = 0; j < 30; j++) for (const jj of [j, j + 1]) { P.push(...bez3(c, jj / 30)); T.push(jj / 30); F.push(fl); SD.push(sd); CI.push(STRUCT.curves.length + i); }
    });
    if (throughObj) { group.remove(throughObj); throughObj.geometry.dispose(); }
    const n = P.length / 3, g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
    g.setAttribute('aReg', new THREE.Float32BufferAttribute(new Float32Array(n).fill(1), 1));
    g.setAttribute('aT', new THREE.Float32BufferAttribute(T, 1));
    g.setAttribute('aFlow', new THREE.Float32BufferAttribute(F, 1));
    g.setAttribute('aSeed', new THREE.Float32BufferAttribute(SD, 1));
    g.setAttribute('aLink', new THREE.Float32BufferAttribute(new Float32Array(n * 2).fill(1), 2));
    g.setAttribute('aCi', new THREE.Float32BufferAttribute(CI, 1));
    throughObj = new THREE.LineSegments(g, structMat);
    throughObj.frustumCulled = false;
    throughObj.renderOrder = -1;
    group.add(throughObj);
  }

  function placeWords() {
    if (!STRUCT || !WORDS[0].mask) return;
    // The particles are made anew, so a word caught mid-way (a phone turned, a window resized) stops, and the next
    // one comes in a moment.
    WORDS.forEach(w => { if (w.ph !== 'idle') { w.ph = 'idle'; if (WQ.cur === w.k) { WQ.cur = -1; WQ.next = S.time + 1; } } });
    rig(1);
    endCam.aspect = L.w / L.h;
    endCam.fov = L.fovEnd;
    endCam.position.copy(camPos);
    endCam.lookAt(camTgt);
    endCam.setViewOffset(L.w, L.h, -(L.ex - L.w / 2), -(L.ey - L.h / 2), L.w, L.h);
    endCam.updateProjectionMatrix();
    endCam.updateMatrixWorld();
    wr.setFromMatrixColumn(endCam.matrixWorld, 0).normalize();
    wu.setFromMatrixColumn(endCam.matrixWorld, 1).normalize();
    endCam.getWorldDirection(wf);
    const toPx = p => { wv.set(p[0], p[1], p[2]).project(endCam); return [(wv.x * 0.5 + 0.5) * L.w, (-wv.y * 0.5 + 0.5) * L.h]; };
    const t = smooth(0.7, 1.55, L.w / L.h), short = Math.min(L.w, L.h);
    // What each word's material can carry it along, as seen from the far side.
    const linPx = STRUCT.lineage.map(pl => pl.pts.map(p => toPx(p)));
    const formX = STRUCT.form.map((p, i) => [toPx(p)[0], i]).sort((a, b) => a[0] - b[0]);
    STRUCT.lineage.forEach((pl, i) => { uniforms.uLit.value[i] = pl.dot; });

    WORDS.forEach((w, k) => {
      const pw = PLACE.wide[k], pt = PLACE.tall[k];
      const hc = lerp(pt.h, pw.h, t) * short;
      const key = toPx(STRUCT.keys[k]);
      const sx = key[0] + lerp(pt.dx, pw.dx, t) * hc, sy = key[1] + lerp(pt.dy, pw.dy, t) * hc;
      // The word lies on a plane through that point of the screen, at the depth of its force, facing the visitor.
      // The AI's sits nearer, where its lines start, so that they can carry it in to the point on the wall.
      wv.set(...STRUCT.keys[k]).sub(endCam.position);
      const depth = wv.dot(wf) - (k === 1 ? 4.5 : 0);
      wv.set(sx / L.w * 2 - 1, -sy / L.h * 2 + 1, 0.5).unproject(endCam).sub(endCam.position).normalize();
      const centre = endCam.position.clone().addScaledVector(wv, depth / wv.dot(wf));
      const ppm = hc / (w.y1 - w.y0), kw = ppm * 2 * depth * Math.tan(THREE.MathUtils.degToRad(L.fovEnd) / 2) / L.h;
      w.frame = { centre, r: wr.clone(), u: wu.clone(), sx, sy, ppm, kw, hw: (w.x1 - w.x0) * ppm / 2, hh: (w.y1 - w.y0) * ppm / 2 };
      w.lift = hc * kw / ppm;
      if (k === 1) throughLines(w, toPx, depth);
      const curvePx = k === 1 ? aiCurves.map(c => Array.from({ length: 45 }, (_, j) => toPx(bez3(c, j / 64)))) : [];

      // The particles: a grid over the letters; the edge is brighter. Cells keep a strict grid, like a table.
      const rows = Math.round(lerp(w.rows[0], w.rows[1], t)), s = (w.y1 - w.y0) / rows, R = rng(7 + k);
      const size = s * ppm * (w.shape === 0 ? 1.3 : w.shape === 1 ? 0.86 : 0.55);
      w.pts = [];
      for (let r = 0, my = w.y0 + s / 2; my < w.y1; my += s, r++) for (let c = 0, mx = w.x0 + s / 2; mx < w.x1; mx += s, c++) {
        if (!onMask(w, mx, my)) continue;
        const j = w.shape === 1 ? 0 : s * 0.15, x = mx + (R() - 0.5) * 2 * j, y = my + (R() - 0.5) * 2 * j;
        const edge = !(onMask(w, mx - s, my) && onMask(w, mx + s, my) && onMask(w, mx, my - s) && onMask(w, mx, my + s));
        const lx = (x - w.cx) * kw, ly = -(y - w.cy) * kw;
        w.pts.push({
          mx: x, my: y, row: r, col: c, edge, R: R(), ch: (R() * 64) | 0,
          b: [centre.x + wr.x * lx + wu.x * ly, centre.y + wr.y * lx + wu.y * ly, centre.z + wr.z * lx + wu.z * ly],
          px: [sx + (x - w.cx) * ppm, sy + (y - w.cy) * ppm],
          a: w.shape === 0 ? (edge ? 0.88 + R() * 0.12 : 0.42 + R() * 0.3) : w.shape === 1 ? (edge ? 0.85 : 0.5) : 0.9,
          size: Math.max(w.shape === 2 ? 2.2 : 3.2, size),
        });
      }
      w.nRows = rows;
      w.nCols = Math.ceil((w.x1 - w.x0) / s);
      // Where each particle goes when the word is handed over. BI's cells share themselves out over the six lineage
      // lines, a column of the word to each, so that every point the lineage feeds lights up.
      if (k === 0) {
        const order = w.pts.map((p, i) => [p.px[0], i]).sort((a, b) => a[0] - b[0]);
        const lines = linPx.map((ls, li) => [ls[0][0], li]).sort((a, b) => a[0] - b[0]);
        order.forEach(([, i], rank) => { w.pts[i].li = lines[Math.min(lines.length - 1, Math.floor(rank / order.length * lines.length))][1]; });
      }
      w.pts.forEach(p => {
        let best = 1e18;
        if (k === 1) curvePx.forEach((cs, ci) => cs.forEach((q, jj) => { const d = (q[0] - p.px[0]) ** 2 + (q[1] - p.px[1]) ** 2; if (d < best) { best = d; p.ci = ci; p.ts = jj / 64; } }));
        if (k === 0) linPx[p.li].forEach((q, jj) => {
          if (STRUCT.lineage[p.li].cum[jj] > 0.66) return;
          const d = (q[0] - p.px[0]) ** 2 + (q[1] - p.px[1]) ** 2;
          if (d < best) { best = d; p.ls = STRUCT.lineage[p.li].cum[jj]; }
        });
        p.hop = Math.sqrt(best);
      });
      if (k === 1) {
        const ap = toPx(STRUCT.keys[1]), far = Math.max(...w.pts.map(p => Math.hypot(p.px[0] - ap[0], p.px[1] - ap[1])));
        w.pts.forEach(p => { p.near = 1 - Math.hypot(p.px[0] - ap[0], p.px[1] - ap[1]) / far; });
      }
      if (k === 0) { const mh = Math.max(...w.pts.map(p => p.hop)); w.pts.forEach(p => { p.near = 1 - p.hop / (mh || 1); }); }
      if (k === 2) {
        const order = w.pts.map((p, i) => [p.px[0], i]).sort((a, b) => a[0] - b[0]);
        order.forEach(([, i], rank) => { const p = w.pts[i]; p.xr = rank / order.length; p.fi = formX[Math.min(6, Math.floor(p.xr * 7))][1]; });
      }

      // The gold word on its plane, a little larger than the letters for the constellation around them.
      if (!w.mesh) {
        w.mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), goldMat());
        w.mesh.matrixAutoUpdate = false;
        w.mesh.frustumCulled = false;
        w.mesh.renderOrder = 6;
        group.add(w.mesh);
      }
      const lw = clamp(Math.round(2 * 0.9 / ppm) / 2, 1, 3);
      if (lw !== w.lw) {
        if (w.tex) w.tex.dispose();
        w.tex = new THREE.CanvasTexture(drawGold(w, lw));
        w.tex.minFilter = THREE.LinearMipmapLinearFilter;
        w.tex.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());
        w.mesh.material.uniforms.uTex.value = w.tex;
        w.lw = lw;
      }
      const gw = (w.x1 - w.x0 + 120) * kw, gh = (w.y1 - w.y0 + 120) * kw;
      w.mesh.matrix.makeBasis(wr.clone().multiplyScalar(gw), wu.clone().multiplyScalar(gh), wf.clone().negate()).setPosition(centre);
      w.mesh.matrixWorldNeedsUpdate = true;
    });

    // One buffer for all three: the AI's characters each have a ghost for the glitch, the Leadership's points two trail marks.
    let n = 0;
    WORDS.forEach(w => { w.off = n; w.mult = w.k === 1 ? 2 : w.k === 2 ? 3 : 1; n += w.pts.length * w.mult; });
    if (wordPts) { group.remove(wordPts); wordPts.geometry.dispose(); }
    const geo = new THREE.BufferGeometry();
    const attr = sz => new THREE.BufferAttribute(new Float32Array(n * sz), sz).setUsage(THREE.DynamicDrawUsage);
    ['position', 'aA', 'aS', 'aG', 'aBlue'].forEach(a => geo.setAttribute(a, attr(a === 'position' ? 3 : 1)));
    const shape = new Float32Array(n);
    WORDS.forEach(w => shape.fill(w.shape, w.off, w.off + w.pts.length * w.mult));
    geo.setAttribute('aShape', new THREE.BufferAttribute(shape, 1));
    wordPts = new THREE.Points(geo, wordMat);
    wordPts.frustumCulled = false;
    wordPts.renderOrder = 5;
    group.add(wordPts);
    if (wordsReady) wordsWrite(S.time, 0);
  }

  // The schedule: the AI first, under a second after arriving, then BI, then Leadership; after that one word every
  // 6 to 10 seconds, in turn. Nothing new starts while a force is pointed at.
  const ORDER = [1, 0, 2];
  const WQ = { i: 0, next: -1, cur: -1, round: 0 };
  const FX = { stepAt: -1, glow: [0, 0, 0], litQ: [] };
  const ans = { i: -1, ph: 'off', t: 0, n: 0, shown: '' };
  let wordsReady = false, wordsShown = false;
  const ripple = (p, k, amp) => { const o = uniforms.uROff.value[k]; addRipple(p[0] + o.x, p[1] + o.y, amp); };

  function startAnswer(now) { ans.i = (ans.i + 1) % ANSWERS.length; ans.ph = 'type'; ans.t = now; ans.n = 0; }
  // A force's moment: the AI answers; BI's lineage lights the chart's points in turn; the formation steps forward.
  function moment(k, now, hover) {
    if (k === 1) { if (hover || !WORDS[1].goldOn) startAnswer(now); FX.glow[1] = 1; if (!hover) ripple(STRUCT.keys[1], 1, 0.22); }
    if (k === 0 && hover) STRUCT.lineage.forEach((pl, li) => FX.litQ.push({ li, at: now + li * 0.12 }));
    if (k === 2) { FX.stepAt = now; FX.glow[2] = 1; ripple(STRUCT.keys[2], 2, 0.22); }
  }
  function startWord(w, now) {
    w.ph = 'in'; w.t0 = now; w.moment = false; w.fed = [];
    w.bands = []; w.bandT = 0;
    w.pts.forEach(p => {
      p.ch = (Math.random() * 64) | 0;
      // BI fills in like a table loading; the Leadership's points arrive from below, left to right.
      if (w.k === 0) p.tIn = 0.75 * p.row / w.nRows + 0.15 * p.col / w.nCols;
      if (w.k === 2) { p.tIn = 0.55 * p.xr + p.R * 0.15; p.from = [(Math.random() - 0.5) * 0.4, -(1.6 + Math.random() * 0.8)]; }
    });
  }
  function handOver(w, now) {
    w.ph = 'out'; w.t0 = now;
    w.pts.forEach(p => {
      const r = Math.random();
      if (w.k === 1) { p.d0 = now + (1 - p.near) * 0.9 + r * 0.45; p.hopT = 0.18 + Math.min(p.hop, 140) * 0.006; p.ride = 0.65 + (1 - p.ts) * 1.3 + Math.random() * 0.3; }
      if (w.k === 0) { p.d0 = now + (1 - p.near) * 0.7 + r * 0.25; p.hopT = 0.15 + Math.min(p.hop, 160) * 0.004; p.ride = 0.8 + (1 - p.ls) * 0.9 + Math.random() * 0.25; }
      if (w.k === 2) { p.d0 = now + p.xr * 0.35 + r * 0.2; p.ride = 0.75 + Math.random() * 0.2; }
    });
  }
  function wordDone(w, now) {
    w.ph = 'idle';
    WQ.cur = -1;
    WQ.round++;
    WQ.i = (WQ.i + 1) % ORDER.length;
    WQ.next = now + (WQ.round < ORDER.length ? 1.4 : 6 + Math.random() * 4);
  }

  function wordsStep(dt, u) {
    const now = S.time;
    if (u > 0.9 && S.arrivedAt < 0) { S.arrivedAt = now; WQ.i = 0; WQ.round = 0; WQ.cur = -1; WQ.next = now + 0.9; }
    if (u < 0.5 && S.arrivedAt >= 0) { S.arrivedAt = -1; WQ.cur = -1; WORDS.forEach(w => { w.ph = 'idle'; }); ans.ph = 'off'; FX.litQ.length = 0; }
    WORDS.forEach((w, k) => {
      const on = S.hot === k;
      if (on && !w.goldOn) { w.goldT = now; if (!reduced) moment(k, now, true); }
      if (!on && w.goldOn && k === 1 && ans.ph === 'wait') ans.ph = 'off';
      w.goldOn = on;
      w.gold = reduced ? (on ? 1 : 0) : clamp(w.gold + (on ? 1 : -1) * dt / 0.45, 0, 1);
      const m = w.mesh && w.mesh.material.uniforms;
      if (m) { m.uAmt.value = w.gold; m.uSweep.value = reduced || !on ? 1.06 : lerp(-0.06, 1.06, smooth(0, 0.75, now - w.goldT)); }
    });
    uniforms.uGoldAmt.value.set(WORDS[0].gold, WORDS[1].gold, WORDS[2].gold);

    if (reduced) {
      uniforms.uGlow.value.set(0, S.hot === 1 ? 1 : 0, S.hot === 2 ? 1 : 0);
      uniforms.uLitAmt.value.fill(S.hot === 0 ? 1 : 0);
      uniforms.uStep.value = 0;
    } else {
      if (S.arrivedAt >= 0 && WQ.cur < 0 && S.hot < 0 && now >= WQ.next) { WQ.cur = ORDER[WQ.i]; startWord(WORDS[WQ.cur], now); }
      WORDS.forEach(w => {
        if (w.ph === 'in' && now - w.t0 > w.inT) { w.ph = 'hold'; w.t0 = now; }
        else if (w.ph === 'hold' && now - w.t0 > w.holdT) handOver(w, now);
      });
      // The answer types out of the point, stays, and erases; while the AI is gold, the next one follows.
      const e = now - ans.t, len = ans.i >= 0 ? ANSWERS[ans.i].length : 0;
      if (ans.ph === 'wait' && e > 0.9) startAnswer(now);
      else if (ans.ph === 'type') { ans.n = Math.min(len, Math.floor(e / 0.062)); if (ans.n === len) { ans.ph = 'hold'; ans.t = now; } }
      else if (ans.ph === 'hold' && e > 2.8) { ans.ph = 'erase'; ans.t = now; }
      else if (ans.ph === 'erase') { ans.n = Math.max(0, len - Math.floor(e / 0.024)); if (!ans.n) { ans.t = now; ans.ph = WORDS[1].goldOn ? 'wait' : 'off'; } }

      const heat = uniforms.uHeat.value, lit = uniforms.uLitAmt.value;
      for (let i = 0; i < heat.length; i++) heat[i] *= Math.exp(-dt * 2.75);
      for (let i = 0; i < lit.length; i++) lit[i] *= Math.exp(-dt * 0.9);
      FX.litQ = FX.litQ.filter(q => { if (now < q.at) return true; lit[q.li] = 1; return false; });
      FX.glow[1] *= Math.exp(-dt * 1.3);
      FX.glow[2] *= Math.exp(-dt * 1.0);
      uniforms.uGlow.value.set(0, FX.glow[1], FX.glow[2]);
      let st = 0;
      if (FX.stepAt >= 0) {
        const se = now - FX.stepAt;
        st = se < 0.3 ? 1 - (1 - se / 0.3) ** 2 : se < 0.7 ? 1 : 1 - smooth(0.7, 2.3, se);
        if (se > 2.3) FX.stepAt = -1;
      }
      uniforms.uStep.value = st;
    }
    wordsWrite(now, dt);
  }

  // Every particle's place, brightness, size and character for this frame.
  function wordsWrite(now, dt) {
    if (!wordPts) return;
    const ga = wordPts.geometry.attributes;
    const P = ga.position.array, A = ga.aA.array, SZ = ga.aS.array, G = ga.aG.array, B = ga.aBlue.array;
    const show = S.arrivedAt >= 0 || (reduced && S.u > 0.5);
    if (!show && !wordsShown) return;
    wordsShown = show;
    A.fill(0);
    if (show) WORDS.forEach(w => {
      // A word fades as its gold appears, and steps back while another force is pointed at.
      const fade = (1 - w.gold) * (1 - 0.6 * S.hotAmt * (S.hot >= 0 && S.hot !== w.k ? 1 : 0)), f = w.frame, o = uniforms.uROff.value[w.k], N = w.pts.length;
      const put = (i, x, y, z, a, s, g, blue) => { P[i * 3] = x; P[i * 3 + 1] = y; P[i * 3 + 2] = z; A[i] = a; SZ[i] = s; G[i] = g; B[i] = blue; };
      const at = (i, p, dx, dy, a, s, g, blue) => put(i, p.b[0] + f.r.x * dx + f.u.x * dy, p.b[1] + f.r.y * dx + f.u.y * dy, p.b[2] + f.r.z * dx + f.u.z * dy, a, s, g, blue);
      if (reduced) { w.pts.forEach((p, j) => at(w.off + j, p, 0, 0, p.a * 0.7 * fade, p.size, p.ch, 0)); return; }
      if (w.ph === 'idle' || fade < 0.01) return;

      if (w.k === 1) {
        // The glitch: bands of the word slip sideways and scramble, with a blue ghost; during the hold, now and then.
        if (w.ph === 'in' || w.ph === 'hold') {
          const every = w.ph === 'in' ? 0.07 : 0.9 + Math.random() * 0.9;
          if (now - w.bandT > every) {
            w.bandT = now;
            w.bands = [];
            const nb = w.ph === 'in' ? 2 + ((Math.random() * 3) | 0) : Math.random() < 0.55 ? 1 : 0;
            for (let b = 0; b < nb; b++) w.bands.push({ y0: w.y0 + Math.random() * (w.y1 - w.y0), h: 6 + Math.random() * 26, dx: (Math.random() < 0.5 ? -1 : 1) * (5 + Math.random() * 20), until: now + (w.ph === 'in' ? 0.07 : 0.12 + Math.random() * 0.14) });
          }
          w.bands = w.bands.filter(b => now < b.until);
          const v = w.ph === 'in' ? clamp((now - w.t0) / w.inT * 1.25, 0, 1) : 1;
          const jit = w.ph === 'in' ? (Math.random() - 0.5) * 8 * (1 - v) : 0;
          w.pts.forEach((p, j) => {
            if (Math.random() < 0.9 * dt) p.ch = (Math.random() * 64) | 0;
            if (w.ph === 'in' && Math.random() > v) return;
            let b = null;
            for (const q of w.bands) if (p.my >= q.y0 && p.my <= q.y0 + q.h) { b = q; break; }
            at(w.off + j, p, (jit + (b ? b.dx : 0)) * f.kw, 0, p.a * fade, p.size, b ? (Math.random() * 64) | 0 : p.ch, 0);
            if (b) at(w.off + N + j, p, (b.dx * 1.4 + 3) * f.kw, 0, 0.55 * fade, p.size, p.ch, 1);
          });
        } else {
          // Swallowed: each character steps onto its nearest line, the ones nearest the point first, and rides it in.
          let left = 0, gone = 0;
          w.pts.forEach((p, j) => {
            const e = now - p.d0;
            if (e < 0) { left++; at(w.off + j, p, (Math.random() - 0.5) * 1.2 * f.kw, 0, p.a * fade, p.size, p.ch, 0); return; }
            const cv = aiCurves[p.ci];
            if (e < p.hopT) {
              left++;
              const k3 = 1 - (1 - e / p.hopT) ** 3, q = bez3(cv, p.ts);
              put(w.off + j, lerp(p.b[0], q[0] + o.x, k3), lerp(p.b[1], q[1] + o.y, k3), lerp(p.b[2], q[2], k3), (p.a + 0.2 * k3) * fade, p.size, p.ch, 0);
              return;
            }
            const uu = (e - p.hopT) / p.ride;
            if (uu >= 1) { gone++; return; }
            left++;
            const tt = p.ts + (1 - p.ts) * uu ** 1.8, q = bez3(cv, tt), sh = (tt - p.ts) / (1 - p.ts);
            uniforms.uHeat.value[p.ci] = Math.min(1, uniforms.uHeat.value[p.ci] + 2.1 * dt);
            put(w.off + j, q[0] + o.x, q[1] + o.y, q[2], (p.a + 0.25) * (1 - uu ** 6) * fade, p.size * (1 - 0.79 * sh), p.ch, 0);
          });
          if (!w.moment && gone > 0.75 * N) { w.moment = true; moment(1, now, false); }
          if (!left) wordDone(w, now);
        }
      }

      if (w.k === 0) {
        if (w.ph === 'in' || w.ph === 'hold') {
          // A table loading: row by row; during the hold, one bright row runs down it, like a query.
          const e = now - w.t0, hr = w.ph === 'hold' ? e / w.holdT * (w.nRows + 2) - 1 : -9;
          w.pts.forEach((p, j) => {
            const v = w.ph === 'in' ? clamp((e - p.tIn) / 0.12, 0, 1) : 1;
            if (v <= 0) return;
            at(w.off + j, p, 0, 0, (p.a * v + 0.6 * Math.exp(-((p.row - hr) ** 2) / 1.5)) * fade, p.size, 0, 0);
          });
        } else {
          // Handed over: each cell steps onto the nearest lineage line and rises along it into the chart.
          let left = 0;
          w.pts.forEach((p, j) => {
            const e = now - p.d0;
            if (e < 0) { left++; at(w.off + j, p, 0, 0, p.a * fade, p.size, 0, 0); return; }
            const pl = STRUCT.lineage[p.li];
            if (e < p.hopT) {
              left++;
              const k3 = 1 - (1 - e / p.hopT) ** 3, q = alongPath(pl, p.ls);
              put(w.off + j, lerp(p.b[0], q[0] + o.x, k3), lerp(p.b[1], q[1] + o.y, k3), lerp(p.b[2], q[2], k3), (p.a + 0.2 * k3) * fade, p.size, 0, 0);
              return;
            }
            const uu = (e - p.hopT) / p.ride;
            if (uu >= 1) {
              if (!w.fed[p.li]) { w.fed[p.li] = true; uniforms.uLitAmt.value[p.li] = 1; if (!w.moment) { w.moment = true; ripple(pl.end, 0, 0.14); } }
              return;
            }
            left++;
            const q = alongPath(pl, p.ls + (1 - p.ls) * uu ** 1.4);
            put(w.off + j, q[0] + o.x, q[1] + o.y, q[2], (p.a + 0.2) * (1 - uu ** 8) * fade, p.size * (1 - 0.55 * uu), 0, 0);
          });
          if (!left) wordDone(w, now);
        }
      }

      if (w.k === 2) {
        // Each point with two marks behind it, where it was a moment ago: its trail.
        const trail = (j, pos, a, s) => {
          [[0.07, 0.45, 0.8], [0.14, 0.2, 0.62]].forEach(([back, ta, ts], m) => {
            const q = pos(back);
            if (q) put(w.off + N * (m + 1) + j, q[0], q[1], q[2], a * ta, s * ts, 0, 0);
          });
        };
        if (w.ph === 'in' || w.ph === 'hold') {
          const e = now - w.t0;
          w.pts.forEach((p, j) => {
            if (w.ph === 'hold') { at(w.off + j, p, 0, 0, p.a * fade, p.size, 0, 0); return; }
            const fly = back => {
              const v = (e - back - p.tIn) / 0.5;
              if (v < 0) return null;
              const k3 = 1 - (1 - Math.min(1, v)) ** 3, dx = p.from[0] * w.lift * (1 - k3), dy = p.from[1] * w.lift * (1 - k3);
              return [p.b[0] + f.r.x * dx + f.u.x * dy, p.b[1] + f.r.y * dx + f.u.y * dy, p.b[2] + f.r.z * dx + f.u.z * dy];
            };
            const q = fly(0);
            if (!q) return;
            put(w.off + j, q[0], q[1], q[2], p.a * fade, p.size, 0, 0);
            if (e - p.tIn < 0.6) trail(j, fly, p.a * fade, p.size);
          });
        } else {
          // Handed over: the points fly to the formation, each to the one above its part of the word, and are taken in.
          let left = 0, gone = 0;
          const so = uniforms.uStep.value;
          w.pts.forEach((p, j) => {
            const e = now - p.d0;
            if (e < 0) { left++; at(w.off + j, p, 0, 0, p.a * fade, p.size, 0, 0); return; }
            const tg = STRUCT.form[p.fi];
            const fly = back => {
              const v = clamp((e - back) / p.ride, 0, 1), k3 = v * v * (3 - 2 * v);
              const ex = tg[0] + o.x, ey = tg[1] + o.y + 0.26 * so, ez = tg[2] + 0.1 * so;
              const cx = (p.b[0] + ex) / 2, cy = Math.min(p.b[1], ey) - 0.35, cz = (p.b[2] + ez) / 2, u1 = 1 - k3;
              return [u1 * u1 * p.b[0] + 2 * u1 * k3 * cx + k3 * k3 * ex, u1 * u1 * p.b[1] + 2 * u1 * k3 * cy + k3 * k3 * ey, u1 * u1 * p.b[2] + 2 * u1 * k3 * cz + k3 * k3 * ez];
            };
            if (e >= p.ride) { gone++; return; }
            left++;
            const v = e / p.ride, a = (p.a + 0.1) * (1 - smooth(0.82, 1, v)) * fade, q = fly(0);
            put(w.off + j, q[0], q[1], q[2], a, p.size, 0, 0);
            trail(j, fly, a, p.size);
          });
          if (!w.moment && gone > 0.75 * N) { w.moment = true; moment(2, now, false); }
          if (!left) wordDone(w, now);
        }
      }
    });
    ['position', 'aA', 'aS', 'aG', 'aBlue'].forEach(a => { ga[a].needsUpdate = true; });
  }

  // The words need the site's own typeface: drawn as soon as it is there, and again if it arrives late.
  function wordsInit() { drawMasks(); WORDS.forEach(w => { w.lw = 0; }); wordsReady = true; placeWords(); kick(); }
  document.fonts.load(WORD_FONT).then(wordsInit, wordsInit);

  // ---------- state ----------
  const S = {
    time: 0, intro: reduced ? 2 : 0,
    cursor: { x: 0, y: 0, s: 0 }, cursorT: { x: 0, y: 0, s: 0 },
    tilt: { x: 0, y: 0, vx: 0, vy: 0 }, tiltT: { x: 0, y: 0 },
    nextRipple: 0, autoRipple: !reduced, autoAt: 1.7,
    scrollP: 0, u: 0, uv: 0,
    hotPointer: -1, hotLabel: -1, hotTouch: -1, hot: -1, hotAmt: 0,
    arrivedAt: -1,
  };
  const L = { w: 1, h: 1, mobile: null, cx: 0, cy: 0, ex: 0, ey: 0, fov: 30, fovMid: 50, fovEnd: 40, rEnd: 13 };
  const BASE_RY = -0.3, BASE_RX = 0.06;

  function layout() {
    const w = stage.clientWidth, h = stage.clientHeight;
    const mobile = w < 760;
    L.w = w; L.h = h;
    const dpr = Math.min(window.devicePixelRatio || 1, mobile ? 1.5 : 2);
    renderer.setPixelRatio(dpr);
    renderer.setSize(w, h, false);
    uniforms.uDpr.value = dpr;
    camera.aspect = w / h;
    const fit = (dist, ww, hh, fw, fh) => 2 * Math.atan(Math.max(hh / fh, ww / fw / camera.aspect) / 2 / dist) * 180 / Math.PI;
    // Framing follows the shape of the screen, not just its width: 0 on tall phones, 1 on wide desktops,
    // with folding phones and tablets (close to square) in between.
    const t = smooth(0.7, 1.55, w / h);
    // On a tall phone the membrane is framed wider than the screen (its sides cut off), so it fills about half the
    // height instead of a third, and sits closer to the title.
    L.fov = fit(D, W * Math.cos(BASE_RY), H, lerp(1.65, 0.7, t), lerp(0.5, 0.82, t));
    L.rEnd = lerp(17, 13, t);
    L.fovEnd = fit(L.rEnd, 11, 7.5, lerp(0.98, 0.66, t), lerp(0.5, 0.8, t));
    L.fovMid = Math.max(L.fov, 52);
    L.cx = lerp(0.5, 0.6, t) * w;
    L.cy = lerp(0.33, 0.42, t) * h;
    L.ex = lerp(0.5, 0.6, t) * w;
    L.ey = lerp(0.45, 0.47, t) * h;
    labels.forEach(el => { el._w = 0; });
    answerEl._full = null;
    if (L.mobile !== mobile) {
      L.mobile = mobile;
      build(mobile);
      lastSide = null;
    }
    placeWords();
  }

  function addRipple(x, y, amp = 0.32, seed = Math.random() * 100) {
    const r = uniforms.uRip.value[S.nextRipple];
    r.set(x, y, S.time, amp);
    uniforms.uRipSeed.value[S.nextRipple] = seed;
    S.nextRipple = (S.nextRipple + 1) % RIPPLES;
  }

  const camL = new THREE.Vector3(), tmpV = new THREE.Vector3();
  function project(p, k) {
    const o = uniforms.uROff.value[k];
    tmpV.set(p[0] + o.x, p[1] + o.y, p[2]);
    group.localToWorld(tmpV);
    tmpV.project(camera);
    return [(tmpV.x * 0.5 + 0.5) * L.w, (-tmpV.y * 0.5 + 0.5) * L.h, tmpV.z];
  }

  function step(dt) {
    S.time += dt;
    if (S.intro < 2) S.intro = Math.min(2, S.intro + dt);
    const t = reduced ? 0 : S.time;
    uniforms.uTime.value = t;
    uniforms.uIntro.value = S.intro;

    uniforms.uF.value.forEach((f, k) => {
      const b = FORCE_BASE[k];
      f.set(b[0] + 0.28 * Math.sin(t * 0.05 + k * 1.7), b[1] + 0.2 * Math.sin(t * 0.037 + k * 2.3), b[2] * (1 + 0.08 * Math.sin(t * 0.21 + k)), b[3]);
      uniforms.uROff.value[k].set(f.x - b[0], f.y - b[1]);
    });

    // Crossing progress follows the scroll, with a little inertia.
    // The crossing spans the whole pinned scroll, so the far side settles exactly as the hero releases: no dead scroll.
    const target = reduced ? (S.scrollP > 0.45 ? 1 : 0) : clamp(S.scrollP, 0, 1);
    if (reduced) { S.u = target; S.uv = 0; }
    else {
      const kk = 30, c = 2 * Math.sqrt(kk);
      S.uv += (kk * (target - S.u) - c * S.uv) * dt;
      S.u += S.uv * dt;
      if (Math.abs(target - S.u) < 1e-4 && Math.abs(S.uv) < 1e-4) { S.u = target; S.uv = 0; }
    }
    const u = clamp(S.u, 0, 1);
    const front = u < 0.04;

    if (S.autoRipple && S.time >= S.autoAt) {
      S.autoRipple = false;
      if (front) { const last = dotPos[dotPos.length - 1]; addRipple(last[0], last[1], 0.26); }
    }

    if (!front) S.cursorT.s = 0;
    const k = 1 - Math.exp(-dt * 9);
    S.cursor.x = lerp(S.cursor.x, S.cursorT.x, k);
    S.cursor.y = lerp(S.cursor.y, S.cursorT.y, k);
    S.cursor.s = lerp(S.cursor.s, S.cursorT.s, 1 - Math.exp(-dt * 5));
    uniforms.uCursor.value.set(S.cursor.x, S.cursor.y, reduced ? S.cursor.s * 0.3 : S.cursor.s);

    // Subtle parallax tilt from the pointer, with a soft spring. The membrane turns to face the visitor as they approach.
    if (!reduced) {
      const kk = 40, c = 2 * Math.sqrt(kk) * 0.8;
      S.tilt.vx += (kk * (S.tiltT.x - S.tilt.x) - c * S.tilt.vx) * dt; S.tilt.x += S.tilt.vx * dt;
      S.tilt.vy += (kk * (S.tiltT.y - S.tilt.y) - c * S.tilt.vy) * dt; S.tilt.y += S.tilt.vy * dt;
    }
    const face = smooth(0, 0.3, u);
    group.rotation.set(lerp(BASE_RX - S.tilt.y * 0.035, 0, face), lerp(BASE_RY + S.tilt.x * 0.06, 0, face), 0);
    group.updateMatrixWorld();

    rig(u);
    camera.position.copy(camPos);
    camera.lookAt(camTgt);
    camera.fov = u <= A_END ? lerp(L.fov, L.fovMid, smooth(0.15, 0.48, u)) : lerp(L.fovMid, L.fovEnd, smooth(0.5, 0.9, u));
    const cx = u <= A_END ? lerp(L.cx, L.w / 2, smooth(0, 0.35, u)) : lerp(L.w / 2, L.ex, smooth(0.55, 0.95, u));
    const cy = u <= A_END ? lerp(L.cy, L.h / 2, smooth(0, 0.35, u)) : lerp(L.h / 2, L.ey, smooth(0.55, 0.95, u));
    camera.setViewOffset(L.w, L.h, -(cx - L.w / 2), -(cy - L.h / 2), L.w, L.h);
    camera.updateMatrixWorld();

    camL.copy(camPos);
    group.worldToLocal(camL);
    uniforms.uYield.value.set(camL.x, camL.y, camL.z, smooth(4.0, 0.5, Math.abs(camL.z)) * (u > 0.02 ? 1 : 0));
    uniforms.uBehind.value = smooth(0.36, 0.62, u);

    // Nearest data point to the cursor.
    let best = -1, bd = 0.36;
    if (S.cursor.s > 0.2) dotPos.forEach((p, i) => { const d = (p[0] - S.cursor.x) ** 2 + (p[1] - S.cursor.y) ** 2; if (d < bd) { bd = d; best = i; } });
    uniforms.uNearest.value = best;

    if (u <= 0.85) S.hotTouch = -1;
    S.hot = u > 0.85 ? (S.hotLabel >= 0 ? S.hotLabel : S.hotPointer >= 0 ? S.hotPointer : S.hotTouch) : -1;
    if (S.hot >= 0) uniforms.uHot.value = S.hot;
    S.hotAmt = lerp(S.hotAmt, S.hot >= 0 ? 1 : 0, 1 - Math.exp(-dt * 10));
    uniforms.uHotAmt.value = S.hotAmt;

    wordsStep(dt, u);
    updateDom(u);
    renderer.render(scene, camera);
  }

  // ---------- DOM synced to the scene ----------
  let lastSide = null, lastHot = -2, lastHint = '';
  function updateDom(u) {
    const out = smooth(0, 0.16, u);
    copyEl.style.opacity = (1 - out).toFixed(3);
    copyEl.style.visibility = out > 0.99 ? 'hidden' : '';
    copyEl.style.transform = reduced ? '' : `translate3d(0,${(-28 * out).toFixed(1)}px,0)`;
    const bo = smooth(0.82, 0.96, u);
    // Only faded, never hidden: screen readers get this sentence whether or not the visitor has crossed.
    behindEl.style.opacity = bo.toFixed(3);
    hintEl.style.opacity = smooth(0.84, 0.96, u).toFixed(3);

    const lo = smooth(0.84, 0.96, u);
    if (lo < 0.01) {
      labels.forEach(el => { if (el._on) { el.style.opacity = '0'; el.style.visibility = 'hidden'; el._on = false; } });
    } else {
      // Keep every label inside the frame, clear of the header and the text at the bottom, and clear of each other.
      const gut = L.mobile ? 16 : 48, top = L.mobile ? 76 : 96, bottom = L.h - (L.mobile ? 300 : 260);
      const boxes = labels.map((el, k) => {
        if (!el._w) { el._w = el.offsetWidth; el._h = el.offsetHeight; }
        const s = project(STRUCT.anchors[k], k);
        return { el, w: el._w, h: el._h, x: clamp(s[0], gut, L.w - gut - el._w), y: clamp(s[1], top, bottom) };
      });
      boxes.slice().sort((a, b) => a.y - b.y).forEach((b, i, arr) => {
        for (let j = 0; j < i; j++) {
          const o = arr[j];
          if (b.x < o.x + o.w + 8 && o.x < b.x + b.w + 8 && b.y < o.y + o.h + 4) b.y = o.y + o.h + 4;
        }
      });
      boxes.forEach(b => {
        b.el.style.transform = `translate3d(${b.x.toFixed(1)}px,${b.y.toFixed(1)}px,0)`;
        b.el.style.opacity = lo.toFixed(3);
        b.el.style.visibility = 'visible';
        b.el._on = true;
      });
    }
    if (S.hot !== lastHot) {
      labels.forEach((el, k) => { el.classList.toggle('hot', S.hot === k); el._w = 0; });
      lastHot = S.hot;
    }

    // The AI's answer comes out of its point. With reduced motion it simply stands there, whole.
    const ansOn = lo > 0.01 && (reduced || ans.ph === 'type' || ans.ph === 'hold' || ans.ph === 'erase');
    if (ansOn) {
      const full = reduced ? ANSWERS[0] : ANSWERS[ans.i], txt = reduced ? full : full.slice(0, ans.n);
      // Measured whole once, so the line can stay inside the frame while it types.
      if (answerEl._full !== full) { answerText.textContent = full; answerEl._w = answerText.offsetWidth + 16; answerEl._full = full; ans.shown = null; }
      if (txt !== ans.shown) { answerText.textContent = txt; ans.shown = txt; }
      const s = project(STRUCT.keys[1], 1), gut = L.mobile ? 16 : 48;
      const shift = Math.min(-6, L.w - gut - answerEl._w - s[0]);
      answerEl.style.transform = `translate3d(${s[0].toFixed(1)}px,${s[1].toFixed(1)}px,0)`;
      answerEl.style.setProperty('--shift', `${shift.toFixed(1)}px`);
      answerEl.style.opacity = lo.toFixed(3);
      answerEl.classList.toggle('blink', !reduced && ans.ph === 'hold');
      answerEl.classList.toggle('gold', S.hot === 1);
    }
    if (ansOn !== answerEl._on) { answerEl._on = ansOn; answerEl.style.visibility = ansOn ? 'visible' : 'hidden'; if (!ansOn) answerEl.style.opacity = '0'; }

    // The front needs no instructions: the surface shows it reacts. Only the far side gets a hint.
    const side = u > 0.5;
    if (side !== lastSide) { lastSide = side; hintEl.hidden = !side; }
    const hint = mqFine.matches ? 'Point at a force' : S.hotTouch >= 0 ? 'Tap again to open' : 'Tap a force';
    if (hint !== lastHint) { hintEl.textContent = hint; lastHint = hint; }
  }

  // Living: it keeps breathing while visible. With reduced motion it renders only on change.
  let running = false, last = 0, visible = true, lastPoke = 0;
  function frame(now) {
    const dt = Math.min(0.05, Math.max(0.001, (now - last) / 1000)); last = now;
    step(dt);
    if (visible && (!reduced || S.intro < 2 || Math.abs(S.cursor.s - S.cursorT.s) > 0.002 || Math.abs(S.hotAmt - (S.hot >= 0 ? 1 : 0)) > 0.002 || S.time - lastPoke < 2)) requestAnimationFrame(frame);
    else running = false;
  }
  function kick() { lastPoke = S.time; if (!running && visible) { running = true; last = performance.now(); requestAnimationFrame(frame); } }

  // ---------- input ----------
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), plane = new THREE.Plane(), hit = new THREE.Vector3(), nrm = new THREE.Vector3();
  function toMembrane(cx, cy) {
    const r = canvas.getBoundingClientRect();
    ndc.set((cx - r.left) / r.width * 2 - 1, -(cy - r.top) / r.height * 2 + 1);
    ray.setFromCamera(ndc, camera);
    nrm.set(0, 0, 1).applyQuaternion(group.quaternion);
    plane.setFromNormalAndCoplanarPoint(nrm, group.position);
    if (!ray.ray.intersectPlane(plane, hit)) return null;
    const p = group.worldToLocal(hit.clone());
    const inside = Math.abs(p.x) < W * 0.48 && Math.abs(p.y - uniforms.uSize.value.z) < H * 0.46;
    return { x: p.x, y: p.y, inside };
  }
  function pickForce(cx, cy) {
    const r = canvas.getBoundingClientRect(), x = cx - r.left, y = cy - r.top;
    // Pointing at a force's word counts as pointing at the force.
    for (const w of WORDS) { const f = w.frame; if (f && Math.abs(x - f.sx) < f.hw + 8 && Math.abs(y - f.sy) < f.hh + 8) return w.k; }
    let best = -1, bd = (L.mobile ? 44 : 60) ** 2;
    STRUCT.picks.forEach((pts, k) => pts.forEach(p => {
      const s = project(p, k), d = (s[0] - x) ** 2 + (s[1] - y) ** 2;
      if (d < bd) { bd = d; best = k; }
    }));
    return best;
  }

  addEventListener('pointermove', e => {
    if (S.u < 0.04) {
      if (e.pointerType === 'mouse') {
        S.tiltT.x = (e.clientX / innerWidth) * 2 - 1;
        S.tiltT.y = (e.clientY / innerHeight) * 2 - 1;
      }
      if (e.pointerType === 'mouse' || dragging) {
        const p = toMembrane(e.clientX, e.clientY);
        if (p && p.inside) { S.cursorT.x = p.x; S.cursorT.y = p.y; S.cursorT.s = 1; }
        else S.cursorT.s = 0;
      }
    } else {
      S.tiltT.x = S.tiltT.y = 0;
      if (S.u > 0.85 && e.pointerType === 'mouse' && e.target === canvas) {
        S.hotPointer = pickForce(e.clientX, e.clientY);
        canvas.style.cursor = S.hotPointer >= 0 ? 'pointer' : 'default';
      } else if (e.target === canvas) { S.hotPointer = -1; canvas.style.cursor = 'default'; }
    }
    kick();
  }, { passive: true });
  document.addEventListener('mouseleave', () => { S.cursorT.s = 0; S.tiltT.x = S.tiltT.y = 0; S.hotPointer = -1; kick(); });

  let dragging = false;
  canvas.addEventListener('pointerdown', e => {
    if (S.u < 0.04) {
      const p = toMembrane(e.clientX, e.clientY);
      if (!p || !p.inside) return;
      S.autoRipple = false;
      addRipple(p.x, p.y);
      if (e.pointerType !== 'mouse') { dragging = true; S.cursorT.x = p.x; S.cursorT.y = p.y; S.cursorT.s = 1; S.cursor.x = p.x; S.cursor.y = p.y; }
    } else if (S.u > 0.85) {
      if (e.pointerType === 'mouse') {
        const k = pickForce(e.clientX, e.clientY);
        if (k >= 0) openForce(k);
      } else {
        // On touch nothing happens on contact: only a deliberate tap counts, never the start of a scroll.
        tapStart = { id: e.pointerId, x: e.clientX, y: e.clientY, t: performance.now() };
      }
    }
    kick();
  });
  const release = () => { if (dragging) { dragging = false; S.cursorT.s = 0; kick(); } };
  addEventListener('pointerup', release);
  addEventListener('pointercancel', release);

  // Touch mirrors the mouse in two taps: the first lights a force up (as hovering does), the second opens it.
  let tapStart = null;
  canvas.addEventListener('pointerup', e => {
    const t = tapStart;
    tapStart = null;
    if (!t || t.id !== e.pointerId || S.u <= 0.85) return;
    if (Math.hypot(e.clientX - t.x, e.clientY - t.y) > 10 || performance.now() - t.t > 450) return;
    const k = pickForce(e.clientX, e.clientY);
    if (k < 0) S.hotTouch = -1;
    else if (k === S.hotTouch) openForce(k);
    else S.hotTouch = k;
    kick();
  });
  canvas.addEventListener('pointercancel', () => { tapStart = null; });

  // Opening a force glides to its section instead of jumping there.
  function openForce(k) {
    S.hotTouch = -1;
    const target = document.querySelector(labels[k].getAttribute('href'));
    if (!target) return;
    const toY = () => target.getBoundingClientRect().top + scrollY - 24;
    if (reduced) { stopJourney(); scrollTo(0, toY()); }
    else travel([{ to: toY, ms: d => clamp(d * 0.7, 700, 1600), ease: cubicInOut }]);
    kick();
  }

  let labelPointer = 'mouse';
  labels.forEach((el, k) => {
    el.addEventListener('mouseenter', () => { S.hotLabel = k; kick(); });
    el.addEventListener('mouseleave', () => { S.hotLabel = -1; kick(); });
    el.addEventListener('focus', () => { if (labelPointer === 'mouse') S.hotLabel = k; kick(); });
    el.addEventListener('blur', () => { S.hotLabel = -1; kick(); });
    el.addEventListener('pointerdown', e => { labelPointer = e.pointerType || 'mouse'; });
    el.addEventListener('click', e => {
      e.preventDefault();
      const touch = labelPointer !== 'mouse';
      labelPointer = 'mouse';
      if (touch && S.hotTouch !== k) { S.hotTouch = k; kick(); return; }
      openForce(k);
    });
  });

  // ---------- guided journeys: a calm, scripted scroll that the visitor can interrupt at any moment ----------
  let journey = null;
  const sine = t => 0.5 - 0.5 * Math.cos(Math.PI * t);
  const cubicInOut = t => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  const heroTop = () => hero.getBoundingClientRect().top + scrollY;
  const behindY = () => heroTop() + (hero.offsetHeight - innerHeight) * 0.985;
  const workY = () => document.getElementById('work').getBoundingClientRect().top + scrollY;

  function stopJourney() {
    if (!journey) return;
    cancelAnimationFrame(journey.raf);
    clearTimeout(journey.timer);
    journey = null;
  }
  function travel(legs) {
    stopJourney();
    const j = { legs: legs.slice(), raf: 0, timer: 0 };
    journey = j;
    const next = () => {
      if (journey !== j) return;
      const leg = j.legs.shift();
      if (!leg) { journey = null; return; }
      if (leg.pause) { j.timer = setTimeout(next, leg.pause); return; }
      const from = scrollY, to = leg.to(), t0 = performance.now();
      const ms = leg.ms(Math.abs(to - from));
      const tick = now => {
        if (journey !== j) return;
        const t = Math.min(1, (now - t0) / ms);
        scrollTo(0, from + (to - from) * leg.ease(t));
        if (t < 1) j.raf = requestAnimationFrame(tick); else next();
      };
      j.raf = requestAnimationFrame(tick);
    };
    next();
  }
  // Any input of their own hands control back to the visitor.
  ['wheel', 'touchstart', 'keydown', 'pointerdown'].forEach(type => addEventListener(type, stopJourney, { passive: true, capture: true }));

  // The crossing takes its time: about five seconds from the front to the far side.
  const toBehind = { to: behindY, ms: d => clamp(d / (hero.offsetHeight - innerHeight) * 5400, 1200, 5400), ease: sine };

  document.querySelector('.cta').addEventListener('click', e => {
    e.preventDefault();
    if (reduced) { scrollTo(0, workY()); return; }
    // Through the wall, a moment on the other side, then down to the work.
    travel([toBehind, { pause: 1700 }, { to: workY, ms: () => 1500, ease: cubicInOut }]);
  });

  function onScroll() {
    const range = hero.offsetHeight - innerHeight;
    S.scrollP = range > 0 ? clamp(-hero.getBoundingClientRect().top / range, 0, 1) : 0;
    kick();
  }
  addEventListener('scroll', onScroll, { passive: true });

  new IntersectionObserver(([en]) => { visible = en.isIntersecting; if (visible) kick(); }).observe(stage);
  new ResizeObserver(() => { layout(); onScroll(); }).observe(stage);
  mqReduce.addEventListener('change', e => {
    reduced = e.matches;
    uniforms.uReduced.value = reduced ? 1 : 0;
    if (reduced) S.intro = 2;
    onScroll();
  });
  canvas.addEventListener('webglcontextlost', e => { e.preventDefault(); running = false; });
  canvas.addEventListener('webglcontextrestored', () => kick());

  layout();
  onScroll();
  kick();
}
