(() => {
  'use strict';

  // ---------------------------------------------------------------------------
  // Settings. Tweak these to change the feel of the piece.
  // ---------------------------------------------------------------------------
  const CONFIG = {
    maxBlobs: 6,          // hard limit (must match MAX_BLOBS in the shader)
    minBlobs: 1,
    grainPx: 6,           // size of one grain in CSS pixels (higher = coarser)
    grainFps: 4,         // how often the grain pattern re-rolls
    grainAmount: 0.1,    // strength of the noise grain
    levels: 15,           // colour levels per channel after dithering (lower = more lo-fi)
    idleDelay: 1600,      // ms without movement before the gradient drifts on its own
    followEase: 4,      // how quickly the main blob catches the cursor
    idleEase: 0.9,        // how quickly it settles into the drift path
    trailEase: 1.9,       // how loosely the other blobs trail behind
  };

  const DEFAULT_COLOURS = ['#f23c8a', '#e89c2d', '#1c3c6a'];
  const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));

  const canvas = document.getElementById('field');
  const list = document.getElementById('swatches');
  const hint = document.getElementById('hint');
  const fallback = document.getElementById('fallback');
  const announcer = document.getElementById('announcer');

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const coarsePointer = window.matchMedia('(pointer: coarse)').matches;
  if (coarsePointer) hint.textContent = 'Tap anywhere for new colours';

  // ---------------------------------------------------------------------------
  // Colour helpers
  // ---------------------------------------------------------------------------
  const randomHex = () =>
    '#' + Math.floor(Math.random() * 0x1000000).toString(16).padStart(6, '0');

  const hexToRgb = (hex) => {
    const n = parseInt(hex.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => v / 255);
  };

  const toLinear = (c) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));

  // Blending happens in OKLab so mixes between any two colours stay vivid
  // instead of going muddy in the middle.
  const hexToOklab = (hex) => {
    const [r, g, b] = hexToRgb(hex).map(toLinear);
    const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
    const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
    const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
    return [
      0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
      1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
      0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
    ];
  };

  const luminance = (hex) => {
    const [r, g, b] = hexToRgb(hex).map(toLinear);
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };

  // Pick black or white text, whichever contrasts more with the swatch.
  const inkFor = (hex) => {
    const L = luminance(hex);
    return (L + 0.05) / 0.05 > 1.05 / (L + 0.05) ? '#141019' : '#fbf7ff';
  };

  // ---------------------------------------------------------------------------
  // Blobs
  // ---------------------------------------------------------------------------
  const state = {
    blobs: [],
    pointer: { x: 0.5, y: 0.5, seen: false, last: -Infinity },
    anchor: { x: 0.5, y: 0.5 },
    simTime: 0,
    hasRandomised: false,
  };

  function makeBlob(hex, index) {
    return {
      hex,
      lab: hexToOklab(hex),
      locked: false,
      x: state.anchor.x,
      y: state.anchor.y,
      theta: index * GOLDEN_ANGLE * 2.1,
      speed: 0.1 + Math.random() * 0.08,
      orbit: 0.22 + Math.random() * 0.14,
      phase: Math.random() * Math.PI * 2,
      radius: 0.32 + Math.random() * 0.1,
    };
  }

  function setColour(blob, hex) {
    blob.hex = hex;
    blob.lab = hexToOklab(hex);
  }

  function randomise() {
    let changed = 0;
    for (const blob of state.blobs) {
      if (!blob.locked) {
        setColour(blob, randomHex());
        changed++;
      }
    }
    syncSwatches();
    if (changed) announce(`New colours: ${state.blobs.map((b) => b.hex).join(', ')}`);
    else announce('All colours are locked. Unlock one to change it.');

    if (!state.hasRandomised) {
      state.hasRandomised = true;
      hint.classList.remove('is-visible');
      hint.classList.add('is-gone');
    }
  }

  function addBlob(hex) {
    if (state.blobs.length >= CONFIG.maxBlobs) return false;
    state.blobs.push(makeBlob(hex || randomHex(), state.blobs.length));
    syncSwatches();
    return true;
  }

  function removeBlob(index = state.blobs.length - 1) {
    if (state.blobs.length <= CONFIG.minBlobs) return false;
    if (index < 0 || index >= state.blobs.length) return false;
    state.blobs.splice(index, 1);
    syncSwatches();
    return true;
  }

  DEFAULT_COLOURS.forEach((hex, i) => state.blobs.push(makeBlob(hex, i)));

  // ---------------------------------------------------------------------------
  // Swatches
  // ---------------------------------------------------------------------------
  const LOCK_ICON = `
    <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor"
         stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
      <path class="shackle" d="M8 11V8a4 4 0 0 1 8 0v3"/>
      <rect x="5" y="11" width="14" height="10" rx="2.5" fill="currentColor" stroke="none"/>
    </svg>`;

  function buildSwatch(i) {
    const li = document.createElement('li');
    li.className = 'swatch';
    li.innerHTML = `
      <button class="lock" type="button" aria-pressed="false">${LOCK_ICON}</button>
      <button class="chip" type="button"><span class="hex"></span></button>`;

    li.querySelector('.lock').addEventListener('click', () => {
      const blob = state.blobs[i];
      blob.locked = !blob.locked;
      syncSwatches();
      announce(`${blob.hex} ${blob.locked ? 'locked' : 'unlocked'}`);
    });

    li.querySelector('.chip').addEventListener('click', () => copyHex(i, li));
    return li;
  }

  function syncSwatches() {
    if (list.children.length !== state.blobs.length) {
      list.replaceChildren(...state.blobs.map((_, i) => buildSwatch(i)));
      list.style.setProperty('--count', state.blobs.length);
    }
    state.blobs.forEach((blob, i) => {
      const li = list.children[i];
      const chip = li.querySelector('.chip');
      const lock = li.querySelector('.lock');
      const label = chip.querySelector('.hex');
      chip.style.setProperty('--c', blob.hex);
      chip.style.setProperty('--on-c', inkFor(blob.hex));
      if (!li.dataset.copying) label.textContent = blob.hex;
      chip.setAttribute('aria-label', `Copy ${blob.hex}`);
      lock.setAttribute('aria-pressed', String(blob.locked));
      lock.setAttribute('aria-label', `${blob.locked ? 'Unlock' : 'Lock'} ${blob.hex}`);
      li.classList.toggle('is-locked', blob.locked);
    });
  }

  async function copyHex(i, li) {
    const hex = state.blobs[i].hex;
    let ok = false;
    try {
      await navigator.clipboard.writeText(hex);
      ok = true;
    } catch {
      const ta = document.createElement('textarea');
      ta.value = hex;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      try { ok = document.execCommand('copy'); } catch { ok = false; }
      ta.remove();
    }

    const label = li.querySelector('.hex');
    li.dataset.copying = '1';
    label.textContent = ok ? 'copied' : 'failed';
    announce(ok ? `Copied ${hex}` : `Couldn't copy ${hex}. Select it manually.`);
    clearTimeout(li._copyTimer);
    li._copyTimer = setTimeout(() => {
      delete li.dataset.copying;
      syncSwatches();
    }, 1100);
  }

  function announce(msg) {
    announcer.textContent = '';
    requestAnimationFrame(() => { announcer.textContent = msg; });
  }

  syncSwatches();

  // ---------------------------------------------------------------------------
  // Input
  // ---------------------------------------------------------------------------
  const toUv = (e) => ({
    x: e.clientX / window.innerWidth,
    y: 1 - e.clientY / window.innerHeight,
  });

  function notePointer(e) {
    const uv = toUv(e);
    state.pointer.x = uv.x;
    state.pointer.y = uv.y;
    state.pointer.seen = true;
    state.pointer.last = performance.now();
  }

  window.addEventListener('pointermove', notePointer, { passive: true });

  // A tap or click (little movement) randomises; a drag only steers.
  let down = null;
  canvas.addEventListener('pointerdown', (e) => {
    notePointer(e);
    down = { x: e.clientX, y: e.clientY, id: e.pointerId };
  });
  canvas.addEventListener('pointerup', (e) => {
    if (!down || down.id !== e.pointerId) return;
    const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y);
    down = null;
    if (moved < 10) randomise();
  });
  canvas.addEventListener('pointercancel', () => { down = null; });

  // Keyboard: Space or Enter anywhere outside the buttons also randomises.
  document.addEventListener('keydown', (e) => {
    if ((e.key === ' ' || e.key === 'Enter') && !e.target.closest('button')) {
      e.preventDefault();
      randomise();
    }
  });

  setTimeout(() => {
    if (!state.hasRandomised) hint.classList.add('is-visible');
  }, 700);

  // Public hooks for adding and removing blobs (e.g. from future UI or the console):
  //   grainGradient.addBlob()            -> adds a random colour
  //   grainGradient.addBlob('#00ff88')   -> adds a specific colour
  //   grainGradient.removeBlob()         -> removes the last blob
  //   grainGradient.removeBlob(1)        -> removes the blob at index 1
  window.grainGradient = {
    addBlob,
    removeBlob,
    randomise,
    get blobs() { return state.blobs.map(({ hex, locked }) => ({ hex, locked })); },
    config: CONFIG,
  };

  // ---------------------------------------------------------------------------
  // WebGL
  // ---------------------------------------------------------------------------
  const gl = canvas.getContext('webgl', { antialias: false, alpha: false, preserveDrawingBuffer: false });
  if (!gl) {
    fallback.hidden = false;
    canvas.hidden = true;
    return;
  }

  const VERT = `
    attribute vec2 aPos;
    void main() { gl_Position = vec4(aPos, 0.0, 1.0); }
  `;

  const FRAG = `
    #ifdef GL_FRAGMENT_PRECISION_HIGH
      precision highp float;
    #else
      precision mediump float;
    #endif

    #define MAX_BLOBS ${CONFIG.maxBlobs}

    uniform vec2  uRes;
    uniform float uAspect;
    uniform int   uCount;
    uniform vec2  uPos[MAX_BLOBS];
    uniform vec3  uLab[MAX_BLOBS];
    uniform float uRad[MAX_BLOBS];
    uniform float uWeight[MAX_BLOBS];
    uniform float uFrame;
    uniform float uGrain;
    uniform float uLevels;

    // Dave Hoskins' hash without sine: stable on mobile GPUs.
    float hash(vec2 p) {
      vec3 p3 = fract(vec3(p.xyx) * 0.1031);
      p3 += dot(p3, p3.yzx + 33.33);
      return fract((p3.x + p3.y) * p3.z);
    }

    vec3 oklabToLinear(vec3 c) {
      float l_ = c.x + 0.3963377774 * c.y + 0.2158037573 * c.z;
      float m_ = c.x - 0.1055613458 * c.y - 0.0638541728 * c.z;
      float s_ = c.x - 0.0894841775 * c.y - 1.2914855480 * c.z;
      float l = l_ * l_ * l_;
      float m = m_ * m_ * m_;
      float s = s_ * s_ * s_;
      return vec3(
         4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
        -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
        -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s
      );
    }

    vec3 linearToSrgb(vec3 c) {
      c = clamp(c, 0.0, 1.0);
      vec3 lo = c * 12.92;
      vec3 hi = 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055;
      return mix(lo, hi, step(vec3(0.0031308), c));
    }

    void main() {
      vec2 uv = gl_FragCoord.xy / uRes;
      vec2 q = vec2(uv.x * uAspect, uv.y);

      vec3 lab = vec3(0.0);
      float total = 0.0;
      for (int i = 0; i < MAX_BLOBS; i++) {
        if (i >= uCount) break;
        vec2 b = vec2(uPos[i].x * uAspect, uPos[i].y);
        vec2 d = q - b;
        float k = dot(d, d) / (uRad[i] * uRad[i]);
        float w = uWeight[i] / pow(k + 0.06, 1.6);
        lab += w * uLab[i];
        total += w;
      }
      lab /= max(total, 1e-6);

      vec3 col = linearToSrgb(oklabToLinear(lab));

      // Coarse noise grain, then quantise with random thresholds.
      // The random threshold keeps the average colour true while
      // breaking smooth bands into speckled, lo-fi steps.
      vec2 cell = floor(gl_FragCoord.xy);
      float n  = hash(cell + vec2(uFrame * 13.1, uFrame * 7.7));
      float n2 = hash(cell * 1.37 + vec2(uFrame * 3.3, uFrame * 11.9) + 19.0);
      col += (n - 0.5) * uGrain;
      col = floor(col * uLevels + n2) / uLevels;

      gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
    }
  `;

  function compile(type, src) {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      throw new Error(gl.getShaderInfoLog(s));
    }
    return s;
  }

  let program;
  try {
    program = gl.createProgram();
    gl.attachShader(program, compile(gl.VERTEX_SHADER, VERT));
    gl.attachShader(program, compile(gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program));
  } catch (err) {
    console.error(err);
    fallback.hidden = false;
    canvas.hidden = true;
    return;
  }
  gl.useProgram(program);

  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const aPos = gl.getAttribLocation(program, 'aPos');
  gl.enableVertexAttribArray(aPos);
  gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

  const u = {};
  ['uRes', 'uAspect', 'uCount', 'uPos[0]', 'uLab[0]', 'uRad[0]', 'uWeight[0]', 'uFrame', 'uGrain', 'uLevels']
    .forEach((name) => { u[name] = gl.getUniformLocation(program, name); });

  const posArr = new Float32Array(CONFIG.maxBlobs * 2);
  const labArr = new Float32Array(CONFIG.maxBlobs * 3);
  const radArr = new Float32Array(CONFIG.maxBlobs);
  const wArr = new Float32Array(CONFIG.maxBlobs);

  function resize() {
    const w = Math.max(1, Math.ceil(window.innerWidth / CONFIG.grainPx));
    const h = Math.max(1, Math.ceil(window.innerHeight / CONFIG.grainPx));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
      gl.viewport(0, 0, w, h);
    }
  }
  window.addEventListener('resize', resize);
  resize();

  // ---------------------------------------------------------------------------
  // Motion
  // ---------------------------------------------------------------------------
  const ease = (rate, dt) => 1 - Math.exp(-rate * dt);

  // Slow, looping drift path used when the cursor is idle.
  function wander(s) {
    return {
      x: 0.5 + 0.3 * Math.sin(s * 0.21) + 0.08 * Math.sin(s * 0.53 + 1.3),
      y: 0.5 + 0.26 * Math.sin(s * 0.17 + 0.7) + 0.07 * Math.cos(s * 0.47),
    };
  }

  let lastT = performance.now();

  function frame(now) {
    const dt = Math.min(0.05, (now - lastT) / 1000);
    lastT = now;
    const motion = reducedMotion ? 0.15 : 1;
    state.simTime += dt * motion;
    const s = state.simTime;

    const idle = !state.pointer.seen || now - state.pointer.last > CONFIG.idleDelay;
    const target = idle ? wander(s) : state.pointer;
    const k = ease(idle ? CONFIG.idleEase * motion : CONFIG.followEase, dt);
    state.anchor.x += (target.x - state.anchor.x) * k;
    state.anchor.y += (target.y - state.anchor.y) * k;

    const aspect = window.innerWidth / window.innerHeight;
    const trail = ease(CONFIG.trailEase * (reducedMotion ? 0.5 : 1), dt);

    state.blobs.forEach((b, i) => {
      if (i === 0) {
        b.x = state.anchor.x;
        b.y = state.anchor.y;
      } else {
        b.theta += dt * motion * b.speed * (idle ? 1.6 : 1) * Math.PI * 2 * 0.35;
        const r = b.orbit * (1 + 0.28 * Math.sin(s * 0.31 + b.phase));
        const tx = state.anchor.x + (Math.cos(b.theta) * r) / aspect;
        const ty = state.anchor.y + Math.sin(b.theta) * r;
        b.x += (tx - b.x) * trail;
        b.y += (ty - b.y) * trail;
      }
      posArr[i * 2] = b.x;
      posArr[i * 2 + 1] = b.y;
      labArr.set(b.lab, i * 3);
      radArr[i] = i === 0 ? 0.3 : b.radius;
      wArr[i] = i === 0 ? 1.5 : 1;
    });

    const grainFrame = reducedMotion ? 0 : Math.floor((now / 1000) * CONFIG.grainFps) % 97;

    gl.uniform2f(u.uRes, canvas.width, canvas.height);
    gl.uniform1f(u.uAspect, aspect);
    gl.uniform1i(u.uCount, state.blobs.length);
    gl.uniform2fv(u['uPos[0]'], posArr);
    gl.uniform3fv(u['uLab[0]'], labArr);
    gl.uniform1fv(u['uRad[0]'], radArr);
    gl.uniform1fv(u['uWeight[0]'], wArr);
    gl.uniform1f(u.uFrame, grainFrame);
    gl.uniform1f(u.uGrain, CONFIG.grainAmount);
    gl.uniform1f(u.uLevels, CONFIG.levels);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    requestAnimationFrame(frame);
  }

  requestAnimationFrame(frame);
})();
