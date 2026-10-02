(() => {
  'use strict';

  // ---------------------------------------------------------------------------
  // Settings. Tweak these to change the feel of the piece.
  // ---------------------------------------------------------------------------
  const CONFIG = {
    maxBlobs: 7,          // hard limit (must match MAX_BLOBS in the shader)
    minBlobs: 2,
    grainPx: 3,           // size of one grain in CSS pixels (higher = coarser)
    grainFps: 0,          // how often the grain pattern re-rolls (0 = still)
    grainAmount: 0.11,    // strength of the noise grain
    levels: 10,           // colour levels per channel after dithering (lower = more lo-fi)
    idleDelay: 3000,      // ms without movement before the gradient drifts on its own
    followEase: 3.2,      // how quickly the main blob catches the cursor
    idleEase: 0.9,        // how quickly it settles into the drift path
    trailEase: 1.6,       // how loosely the other blobs trail behind
    spread: 0.06,         // how much the colours blend into each other (higher = more mixing)
    softness: 0.7,        // 0 = tight, defined edges; 1 = soft, hazy falloff
    wobble: 0.2,          // how much the blob outlines warp and ripple (0 = perfectly round)
  };

  // Ranges for the settings dialog. Values typed outside a range snap to the
  // nearest limit; whole-number settings are rounded.
  // Settings shown in the panel. Each one becomes a fader channel in its bank.
  // To add a control later, add a CONFIG default and a line here (new bank
  // names create new banks). Values typed outside a range snap to the nearest
  // limit; whole-number settings are rounded.
  const SETTINGS = [
    { key: 'grainPx',     bank: 'Grain',  name: 'Size',     unit: 'px',  label: 'Grain size',            min: 1,   max: 30,     step: 1,   int: true },
    { key: 'grainAmount', bank: 'Grain',  name: 'Strength', unit: '',    label: 'Grain strength',        min: 0,   max: 0.8,   step: 0.01 },
    { key: 'grainFps',    bank: 'Grain',  name: 'Flicker',  unit: 'fps', label: 'Grain flicker',         min: 0,   max: 60,    step: 1,   int: true },
    { key: 'levels',      bank: 'Grain',  name: 'Levels',   unit: '',    label: 'Colour levels',         min: 2,   max: 32,    step: 1,   int: true },
    { key: 'idleDelay',   bank: 'Motion', name: 'Delay',    unit: 'ms',  label: 'Drift after idle',      min: 500, max: 10000, step: 100, int: true },
    { key: 'followEase',  bank: 'Motion', name: 'Follow',   unit: '',    label: 'Cursor follow speed',   min: 0.2, max: 10,    step: 0.1 },
    { key: 'idleEase',    bank: 'Motion', name: 'Settle',   unit: '',    label: 'Drift settle speed',    min: 0.1, max: 5,     step: 0.1 },
    { key: 'trailEase',   bank: 'Motion', name: 'Trail',    unit: '',    label: 'Trail tightness',       min: 0.2, max: 6,     step: 0.1 },
    { key: 'spread',      bank: 'Shape',  name: 'Blend',    unit: '',    label: 'Colour blend',         min: 0.01, max: 1,    step: 0.01 },
    { key: 'softness',    bank: 'Shape',  name: 'Softness', unit: '',    label: 'Edge softness',         min: 0,   max: 1,     step: 0.01 },
    { key: 'wobble',      bank: 'Shape',  name: 'Wobble',   unit: '',    label: 'Wobble',                min: 0,   max: 1,     step: 0.01 },
  ];
  const CONFIG_DEFAULTS = { ...CONFIG };

  const DEFAULT_COLOURS = ['#f23c8a', '#e89c2d', '#1c3c6a'];
  const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));

  const canvas = document.getElementById('field');
  const list = document.getElementById('swatches');
  const rail = document.getElementById('rail');
  const addBtn = document.getElementById('add-blob');
  const settingsBtn = document.getElementById('open-settings');
  const dialog = document.getElementById('settings');
  const settingsBody = document.getElementById('settings-body');
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

  const X_ICON = `
    <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor"
         stroke-width="3" stroke-linecap="round"><path d="M7 7l10 10M17 7L7 17"/></svg>`;

  function buildSwatch(i) {
    const li = document.createElement('li');
    li.className = 'swatch';
    li.innerHTML = `
      <button class="lock" type="button" aria-pressed="false">${LOCK_ICON}</button>
      <div class="chip-wrap">
        <button class="chip" type="button"><span class="hex"></span></button>
        <button class="remove" type="button">${X_ICON}</button>
      </div>`;

    li.querySelector('.lock').addEventListener('click', () => {
      const blob = state.blobs[i];
      blob.locked = !blob.locked;
      syncSwatches();
      announce(`${blob.hex} ${blob.locked ? 'locked' : 'unlocked'}`);
    });

    li.querySelector('.chip').addEventListener('click', () => copyHex(i, li));

    li.querySelector('.remove').addEventListener('click', () => {
      const hex = state.blobs[i].hex;
      if (!removeBlob(i)) return;
      announce(`Removed ${hex}`);
      const next = list.children[Math.min(i, list.children.length - 1)];
      next.querySelector('.chip').focus();
    });
    return li;
  }

  let onColoursChanged = () => {}; // set up by the settings panel

  function syncSwatches() {
    if (list.children.length !== state.blobs.length) {
      list.replaceChildren(...state.blobs.map((_, i) => buildSwatch(i)));
      rail.style.setProperty('--count', state.blobs.length + 1);
    }
    const canRemove = state.blobs.length > CONFIG.minBlobs;
    addBtn.hidden = state.blobs.length >= CONFIG.maxBlobs;
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
      const remove = li.querySelector('.remove');
      remove.hidden = !canRemove;
      remove.setAttribute('aria-label', `Remove ${blob.hex}`);
      li.classList.toggle('is-locked', blob.locked);
    });
    onColoursChanged();
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

  addBtn.addEventListener('click', () => {
    if (!addBlob()) return;
    const hex = state.blobs[state.blobs.length - 1].hex;
    announce(`Added ${hex}`);
    if (addBtn.hidden) list.lastElementChild.querySelector('.chip').focus();
  });

  // ---------------------------------------------------------------------------
  // Settings dialog
  // ---------------------------------------------------------------------------
  const decimals = (n) => (String(n).split('.')[1] || '').length;

  function clampSetting(def, raw) {
    let v = Number(raw);
    if (!Number.isFinite(v)) return CONFIG[def.key];
    v = Math.min(def.max, Math.max(def.min, v));
    return def.int ? Math.round(v) : Math.round(v * 1000) / 1000;
  }

  const formatSetting = (def, v) =>
    def.int ? String(v) : String(Number(v.toFixed(Math.max(3, decimals(def.step)))));

  // Keep only digits and a single decimal point (none at all for whole numbers).
  function sanitise(text, allowDot) {
    let out = text.replace(allowDot ? /[^0-9.]/g : /[^0-9]/g, '');
    const dot = out.indexOf('.');
    if (dot !== -1) out = out.slice(0, dot + 1) + out.slice(dot + 1).replace(/\./g, '');
    return out;
  }

  const controls = {};
  let resizeCanvas = () => {}; // set once WebGL is ready

  function applySetting(def, value) {
    CONFIG[def.key] = value;
    const c = controls[def.key];
    c.range.value = value;
    c.text.value = formatSetting(def, value);
    c.strip.style.setProperty('--pct', `${((value - def.min) / (def.max - def.min)) * 100}%`);
    if (def.key === 'grainPx') resizeCanvas();
  }

  function buildChannel(def) {
    const id = `set-${def.key}`;
    const strip = document.createElement('div');
    strip.className = 'channel';
    strip.innerHTML = `
      <input class="readout" type="text" inputmode="${def.int ? 'numeric' : 'decimal'}"
             autocomplete="off" spellcheck="false"
             aria-label="${def.label} value, ${def.min} to ${def.max}">
      <span class="unit" aria-hidden="true">${def.unit || '&nbsp;'}</span>
      <div class="fader-wrap">
        <span class="slot" aria-hidden="true"><span class="fill"></span></span>
        <input class="fader" type="range" id="${id}" min="${def.min}" max="${def.max}"
               step="${def.step}" aria-label="${def.label}">
      </div>
      <label class="channel-name" for="${id}">${def.name}</label>`;

    const range = strip.querySelector('.fader');
    const text = strip.querySelector('.readout');
    controls[def.key] = { range, text, strip };

    range.addEventListener('input', () => applySetting(def, clampSetting(def, range.value)));

    text.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); text.blur(); return; }
      const allowed = def.int ? /^[0-9]$/ : /^[0-9.]$/;
      if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !allowed.test(e.key)) e.preventDefault();
    });

    text.addEventListener('input', () => {
      const clean = sanitise(text.value, !def.int);
      if (clean !== text.value) {
        const pos = Math.max(0, text.selectionStart - (text.value.length - clean.length));
        text.value = clean;
        text.setSelectionRange(pos, pos);
      }
    });

    text.addEventListener('focus', () => text.select());

    text.addEventListener('change', () => {
      const v = text.value.trim();
      applySetting(def, v === '' || v === '.' ? CONFIG[def.key] : clampSetting(def, v));
    });

    return strip;
  }

  // Group settings into banks in the order they first appear.
  const banks = new Map();
  SETTINGS.forEach((def) => {
    if (!banks.has(def.bank)) {
      const bank = document.createElement('section');
      bank.className = 'bank';
      const headingId = `bank-${def.bank.toLowerCase().replace(/\W+/g, '-')}`;
      bank.setAttribute('aria-labelledby', headingId);
      bank.innerHTML = `<h3 class="bank-name" id="${headingId}">${def.bank}</h3><div class="channels"></div>`;
      settingsBody.appendChild(bank);
      banks.set(def.bank, bank.querySelector('.channels'));
    }
    banks.get(def.bank).appendChild(buildChannel(def));
    applySetting(def, CONFIG[def.key]);
  });

  // ----- Tint the panel from the live colours -----
  function oklabToHex([L, a, b]) {
    const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
    const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
    const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
    const lin = [
      4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
      -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
      -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
    ];
    if (lin.some((c) => c < -0.0005 || c > 1.0005)) return null;
    return '#' + lin.map((c) => {
      c = Math.min(1, Math.max(0, c));
      const v = c <= 0.0031308 ? c * 12.92 : 1.055 * c ** (1 / 2.4) - 0.055;
      return Math.round(v * 255).toString(16).padStart(2, '0');
    }).join('');
  }

  // Push a colour to a fixed light or dark lightness so text on it always
  // reads, keeping as much of its hue and colourfulness as fits in sRGB.
  function chassisFrom(hex) {
    const [L, a, b] = hexToOklab(hex);
    const dark = L < 0.6;
    const targetL = dark ? 0.3 : 0.86;
    const h = Math.atan2(b, a);
    let C = Math.min(Math.hypot(a, b), dark ? 0.16 : 0.13);
    let out = null;
    while (!(out = oklabToHex([targetL, C * Math.cos(h), C * Math.sin(h)])) && C > 0) C -= 0.005;
    return { panel: out || (dark ? '#2a2630' : '#e9e4ee'), dark };
  }

  function themePanel() {
    const { panel, dark } = chassisFrom(state.blobs[0].hex);
    dialog.style.setProperty('--panel', panel);
    dialog.style.setProperty('--panel-ink', dark ? '#fbf7ff' : '#141019');
    // The chassis takes the cursor colour, so the faders cycle through the rest.
    const capColours = state.blobs.slice(1);
    let i = 0;
    for (const { strip } of Object.values(controls)) {
      const hex = capColours[i % capColours.length].hex;
      strip.style.setProperty('--cap', hex);
      strip.style.setProperty('--cap-ink', inkFor(hex));
      i++;
    }
  }
  onColoursChanged = themePanel;
  themePanel();

  // ----- Open, close, drag -----
  const MARGIN = 12;
  let placed = false;
  const panelPos = { x: 0, y: 0 };

  function placePanel(x, y) {
    const w = dialog.offsetWidth;
    const h = dialog.offsetHeight;
    panelPos.x = Math.min(Math.max(MARGIN, x), Math.max(MARGIN, window.innerWidth - w - MARGIN));
    panelPos.y = Math.min(Math.max(MARGIN, y), Math.max(MARGIN, window.innerHeight - h - MARGIN));
    dialog.style.left = `${panelPos.x}px`;
    dialog.style.top = `${panelPos.y}px`;
  }

  // Default spot: bottom right, tucked beside the swatch column if there's room.
  function dockPanel() {
    const w = dialog.offsetWidth;
    const railLeft = rail.getBoundingClientRect().left;
    const besideRail = railLeft - w - 16;
    const x = besideRail >= MARGIN ? besideRail : window.innerWidth - w - MARGIN;
    placePanel(x, window.innerHeight - dialog.offsetHeight - 24);
  }

  // ----- Resizing -----
  // Width decides how the banks wrap; height is turned into fader length so
  // the controls themselves grow and shrink rather than the panel scrolling.
  const FADER_MIN = 100;
  const FADER_MAX = 360;
  let panelSize = null; // { w, h } once the person has resized

  function bankRows() {
    return new Set([...settingsBody.querySelectorAll('.bank')].map((b) => b.offsetTop)).size;
  }

  function minPanelWidth() {
    const cs = getComputedStyle(dialog);
    const chrome = parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight) +
      parseFloat(cs.borderLeftWidth) + parseFloat(cs.borderRightWidth);
    const widestBank = Math.max(...[...settingsBody.querySelectorAll('.bank')].map((b) => b.offsetWidth));
    return Math.ceil(widestBank + chrome);
  }

  function sizePanel(w, h) {
    const maxW = window.innerWidth - panelPos.x - MARGIN;
    const width = Math.max(Math.min(w, maxW), Math.min(minPanelWidth(), window.innerWidth - 2 * MARGIN));
    dialog.style.width = `${width}px`;

    // Measure everything that isn't fader, then share the rest between rows.
    const probe = 100;
    dialog.style.setProperty('--fader-h', `${probe}px`);
    const rows = bankRows();
    const other = dialog.scrollHeight - rows * probe;
    const maxH = window.innerHeight - panelPos.y - MARGIN;
    const fader = Math.min(FADER_MAX, Math.max(FADER_MIN, (Math.min(h, maxH) - other) / rows));
    dialog.style.setProperty('--fader-h', `${Math.floor(fader)}px`);
    panelSize = { w: width, h: Math.min(h, maxH) };
  }

  const resizer = document.getElementById('settings-resize');
  let sizing = null;
  resizer.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    sizing = { id: e.pointerId, x: e.clientX, y: e.clientY, w: dialog.offsetWidth, h: dialog.offsetHeight };
    resizer.setPointerCapture(e.pointerId);
    dialog.classList.add('is-resizing');
    e.preventDefault();
  });
  resizer.addEventListener('pointermove', (e) => {
    if (!sizing || sizing.id !== e.pointerId) return;
    sizePanel(sizing.w + e.clientX - sizing.x, sizing.h + e.clientY - sizing.y);
  });
  const endSize = (e) => {
    if (!sizing || sizing.id !== e.pointerId) return;
    sizing = null;
    dialog.classList.remove('is-resizing');
  };
  resizer.addEventListener('pointerup', endSize);
  resizer.addEventListener('pointercancel', endSize);
  resizer.addEventListener('keydown', (e) => {
    const step = e.shiftKey ? 40 : 10;
    const moves = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
    if (!moves[e.key]) return;
    e.preventDefault();
    sizePanel(dialog.offsetWidth + moves[e.key][0], dialog.offsetHeight + moves[e.key][1]);
  });

  function openPanel() {
    dialog.show(); // non-modal: the gradient stays clickable behind it
    if (!placed) { dockPanel(); placed = true; } else placePanel(panelPos.x, panelPos.y);
    if (panelSize) { sizePanel(panelSize.w, panelSize.h); placePanel(panelPos.x, panelPos.y); }
    settingsBtn.setAttribute('aria-expanded', 'true');
    dialog.querySelector('.fader').focus({ preventScroll: true });
  }

  function closePanel() {
    if (!dialog.open) return;
    const hadFocus = dialog.contains(document.activeElement);
    dialog.close();
    settingsBtn.setAttribute('aria-expanded', 'false');
    if (hadFocus) settingsBtn.focus();
  }

  settingsBtn.addEventListener('click', () => (dialog.open ? closePanel() : openPanel()));
  document.getElementById('close-settings').addEventListener('click', closePanel);
  document.getElementById('reset-settings').addEventListener('click', () => {
    SETTINGS.forEach((def) => applySetting(def, CONFIG_DEFAULTS[def.key]));
    announce('Settings reset to defaults');
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && dialog.open) closePanel();
  });
  window.addEventListener('resize', () => {
    if (!dialog.open) return;
    placePanel(panelPos.x, panelPos.y);
    if (panelSize) { sizePanel(panelSize.w, panelSize.h); placePanel(panelPos.x, panelPos.y); }
  });

  const grip = document.getElementById('settings-grip');
  let drag = null;
  grip.addEventListener('pointerdown', (e) => {
    if (e.target.closest('button') || e.button !== 0) return;
    drag = { id: e.pointerId, dx: e.clientX - panelPos.x, dy: e.clientY - panelPos.y };
    grip.setPointerCapture(e.pointerId);
    dialog.classList.add('is-dragging');
    e.preventDefault();
  });
  grip.addEventListener('pointermove', (e) => {
    if (!drag || drag.id !== e.pointerId) return;
    placePanel(e.clientX - drag.dx, e.clientY - drag.dy);
  });
  const endDrag = (e) => {
    if (!drag || drag.id !== e.pointerId) return;
    drag = null;
    dialog.classList.remove('is-dragging');
  };
  grip.addEventListener('pointerup', endDrag);
  grip.addEventListener('pointercancel', endDrag);

  // Keyboard users can nudge the panel with the arrow keys while the grip has focus.
  grip.tabIndex = 0;
  grip.setAttribute('aria-label', 'Move settings panel with arrow keys');
  grip.addEventListener('keydown', (e) => {
    const step = e.shiftKey ? 40 : 10;
    const moves = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
    if (!moves[e.key] || e.target !== grip) return;
    e.preventDefault();
    placePanel(panelPos.x + moves[e.key][0], panelPos.y + moves[e.key][1]);
  });

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
    if ((e.key === ' ' || e.key === 'Enter') && !e.target.closest('button, input, dialog, [tabindex]')) {
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
    uniform float uSpread;
    uniform float uSharp;
    uniform float uWobble;
    uniform float uTime;

    // Dave Hoskins' hash without sine: stable on mobile GPUs.
    float hash(vec2 p) {
      vec3 p3 = fract(vec3(p.xyx) * 0.1031);
      p3 += dot(p3, p3.yzx + 33.33);
      return fract((p3.x + p3.y) * p3.z);
    }

    // Smooth value noise, used to warp the blob outlines.
    float vnoise(vec2 p) {
      vec2 i = floor(p);
      vec2 f = fract(p);
      vec2 u = f * f * (3.0 - 2.0 * f);
      return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
                 mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
    }

    vec2 warp(vec2 q, float t) {
      vec2 a = vec2(vnoise(q * 1.8 + vec2(t * 0.16, 3.1)),
                    vnoise(q * 1.8 + vec2(7.3, t * 0.14))) - 0.5;
      vec2 b = vec2(vnoise(q * 4.1 + vec2(1.7, t * 0.27)),
                    vnoise(q * 4.1 + vec2(t * 0.23, 9.2))) - 0.5;
      return a + b * 0.45;
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
      if (uWobble > 0.0) q += warp(q, uTime) * uWobble * 0.7;

      vec3 lab = vec3(0.0);
      float total = 0.0;
      for (int i = 0; i < MAX_BLOBS; i++) {
        if (i >= uCount) break;
        vec2 b = vec2(uPos[i].x * uAspect, uPos[i].y);
        vec2 d = q - b;
        float k = dot(d, d) / (uRad[i] * uRad[i]);
        float w = uWeight[i] / pow(k + uSpread, uSharp);
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
  ['uRes', 'uAspect', 'uCount', 'uPos[0]', 'uLab[0]', 'uRad[0]', 'uWeight[0]', 'uFrame', 'uGrain', 'uLevels', 'uSpread', 'uSharp', 'uWobble', 'uTime']
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
  resizeCanvas = resize;
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
        const pk = ease(12, dt);
        b.x += (state.anchor.x - b.x) * pk;
        b.y += (state.anchor.y - b.y) * pk;
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

    const grainFrame = reducedMotion || CONFIG.grainFps <= 0
      ? 0
      : Math.floor((now / 1000) * CONFIG.grainFps) % 97;

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
    gl.uniform1f(u.uSpread, CONFIG.spread);
    gl.uniform1f(u.uSharp, 4 - CONFIG.softness * 3.4); // softness 0..1 -> falloff 4..0.6
    gl.uniform1f(u.uWobble, CONFIG.wobble);
    gl.uniform1f(u.uTime, state.simTime % 3600);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    requestAnimationFrame(frame);
  }

  requestAnimationFrame(frame);
})();
