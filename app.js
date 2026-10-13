/* The Quiet Grove: forest scene, trunks, leaves, breeze and runes.
 * Needs spirits.js to be loaded first. */

(() => {
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  function rng(seed) {
    return () => {
      seed = (seed + 0x6D2B79F5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /* ---------- Background forest ---------- */
  function buildTrees(svg, o) {
    const r = rng(o.seed);
    let out = '';
    for (let i = 0; i < o.count; i++) {
      const x = (i + 0.2 + r() * 0.6) / o.count * 1000;
      const h = o.minH + r() * (o.maxH - o.minH);
      const w = o.w * (0.7 + r() * 0.6);
      const top = 600 - h;
      out += `<path d="M${x - w},600 C${x - w * .55},${600 - h * .4} ${x - w * .35},${600 - h * .75} ${x - w * .25},${top} L${x + w * .25},${top} C${x + w * .35},${600 - h * .75} ${x + w * .55},${600 - h * .4} ${x + w},600Z" fill="${o.trunk}"/>`;
      let c = '';
      const n = 4 + Math.floor(r() * 3);
      for (let k = 0; k < n; k++) {
        c += `<circle cx="${(x + (r() - .5) * w * 9).toFixed(1)}" cy="${(top + (r() - .3) * w * 3).toFixed(1)}" r="${(w * 2 + r() * w * 2.5).toFixed(1)}" fill="${o.leaves[Math.floor(r() * o.leaves.length)]}"/>`;
      }
      out += `<g class="foliage">${c}</g>`;
    }
    svg.innerHTML = out;
  }
  buildTrees(document.getElementById('farTrees'), { count: 20, seed: 7, minH: 320, maxH: 560, w: 8, trunk: '#2d5541', leaves: ['#2f5d45', '#356650', '#2a5340'] });
  buildTrees(document.getElementById('midTrees'), { count: 10, seed: 21, minH: 400, maxH: 600, w: 16, trunk: '#1a3325', leaves: ['#1d3b2a', '#22442f', '#193424'] });

  (function buildCanopy() {
    const r = rng(3);
    let out = '';
    for (let i = 0; i < 13; i++) {
      let c = '';
      for (let k = 0; k < 5; k++) {
        const shade = ['#0c1a12', '#10221a', '#0e1e15', '#132a1c'][Math.floor(r() * 4)];
        c += `<circle cx="${(i * 80 + r() * 50).toFixed(1)}" cy="${(r() * 60 - 10).toFixed(1)}" r="${(40 + r() * 40).toFixed(1)}" fill="${shade}"/>`;
      }
      out += `<g class="foliage">${c}</g>`;
    }
    for (let v = 0; v < 9; v++) {
      const x = 60 + v * 110 + r() * 40;
      const len = 60 + r() * 110;
      let lv = '';
      for (let y = 60; y < 60 + len; y += 15) {
        const side = Math.round(y / 15) % 2 ? 1 : -1;
        lv += `<ellipse cx="${x + side * 5}" cy="${y}" rx="6" ry="3" fill="#2f5a36" transform="rotate(${side * 30} ${x + side * 5} ${y})"/>`;
      }
      out += `<g class="vine foliage" style="animation-delay:${(-r() * 7).toFixed(2)}s"><path d="M${x},50 Q${x + 8},${50 + len / 2} ${x},${60 + len}" stroke="#1f3d26" stroke-width="2.5" fill="none"/>${lv}</g>`;
    }
    document.getElementById('canopy').innerHTML = out;
  })();

  (function buildGround() {
    const r = rng(11);
    let out = `<path d="M0,300 L0,190 C150,150 300,215 500,180 C700,150 850,205 1000,170 L1000,300Z" fill="#0f2016"/>`;
    for (let i = 0; i < 16; i++) {
      const x = i * 66 + r() * 30, base = 200 + r() * 40;
      let f = '';
      for (let k = 0; k < 6; k++) {
        const dx = (k - 2.5) * 12 + (r() - .5) * 8, hh = 40 + r() * 45;
        f += `<path d="M${x},${base} Q${x + dx * .4},${base - hh * .7} ${x + dx},${base - hh}" stroke="${['#1f4029', '#27502f', '#1a3522'][k % 3]}" stroke-width="4" fill="none" stroke-linecap="round"/>`;
      }
      out += `<g class="foliage">${f}</g>`;
    }
    document.getElementById('ground').innerHTML = out;
  })();

  document.getElementById('trunkSvgRight').innerHTML = document.getElementById('trunkSvg').innerHTML;

  /* ---------- Sunlight shafts ---------- */
  function buildRays(el, seed, count) {
    const r = rng(seed);
    let out = '';
    for (let i = 0; i < count; i++) {
      const left = 8 + i * (100 / count) + r() * 8;
      const width = r() < 0.35 ? 6 + r() * 14 : 24 + r() * 80;
      const o = (0.22 + r() * 0.4).toFixed(2);
      out += `<div class="ray" style="left:${left.toFixed(1)}%; width:${width.toFixed(0)}px; --o:${o}; --dur:${(8 + r() * 8).toFixed(1)}s; --delay:${(-r() * 10).toFixed(1)}s"></div>`;
    }
    el.innerHTML = out;
  }
  buildRays(document.getElementById('sunBack'), 17, 11);
  buildRays(document.getElementById('sunFront'), 29, 5);

  /* ---------- Spirits ---------- */

  // spiritSVG(sleepy, outfit) comes from spirits.js, which loads first.

  const VARIANTS = ['', 'staff', 'dark', 'dark staff'];
  function mountSpirit(el, sleepy) {
    el.innerHTML = `<div class="hop"><div class="lean">${spiritSVG(sleepy, el.dataset.variant)}</div></div>`;
  }

  function floorSVG(seed) {
    const r = rng(seed);
    let ferns = '';
    [22, 58, 92, 168, 204, 240].forEach(x => {
      x += (r() - .5) * 14;
      let f = '';
      const n = 4 + Math.floor(r() * 3);
      for (let k = 0; k < n; k++) {
        const dx = (k - n / 2) * 7 + (r() - .5) * 5, hh = 16 + r() * 26;
        f += `<path d="M${x.toFixed(1)},46 Q${(x + dx * .4).toFixed(1)},${(46 - hh * .7).toFixed(1)} ${(x + dx).toFixed(1)},${(46 - hh).toFixed(1)}" stroke="${['#2c5a30', '#3b6b36', '#244a28'][k % 3]}" stroke-width="3" fill="none" stroke-linecap="round"/>`;
      }
      ferns += `<g class="foliage">${f}</g>`;
    });
    return `<svg viewBox="0 0 260 60" preserveAspectRatio="none" aria-hidden="true">
      <path d="M0,60 C22,40 70,30 130,29 C190,30 238,40 260,60Z" fill="#1f3a1f" opacity=".9"/>
      <path d="M34,50 C60,36 96,33 130,33 C164,33 200,36 226,50 C190,44 70,44 34,50Z" fill="#3f6a2c"/>
      ${ferns}
    </svg>`;
  }

  function markRows() {
    const cards = [...document.querySelectorAll('.app-card')];
    if (!cards.length) return;
    const firstTop = cards[0].offsetTop;
    // Apps in the same grid column share one trunk:
    //   top-row   = top of the trunk (rises into the canopy, carries the runes)
    //   on-ground = nothing below it (roots flare out, stands on moss)
    //   has-above = continues a trunk from the app above
    cards.forEach(c => {
      const sameCol = o => o !== c && Math.abs(o.offsetLeft - c.offsetLeft) < 5;
      const top = Math.abs(c.offsetTop - firstTop) < 5;
      const ground = !cards.some(o => sameCol(o) && o.offsetTop > c.offsetTop + 5);
      const above = cards.some(o => sameCol(o) && o.offsetTop < c.offsetTop - 5);
      c.classList.toggle('top-row', top);
      c.classList.toggle('on-ground', ground);
      c.classList.toggle('has-above', above);
    });

    // If a column is shorter than the others, its lowest trunk grows
    // down to the same forest floor instead of ending in mid-air.
    const gridBottom = Math.max(...cards.map(c => c.offsetTop + c.offsetHeight));
    cards.forEach(c => {
      const dropPx = c.classList.contains('on-ground') ? Math.max(0, gridBottom - (c.offsetTop + c.offsetHeight)) : 0;
      c.style.setProperty('--drop', dropPx + 'px');
    });
  }

  const treeSpirits = [];
  document.querySelectorAll('.app-card').forEach((card, i) => {
    const disabled = card.classList.contains('disabled');

    const hollow = document.createElement('span');
    hollow.className = 'hollow';
    hollow.setAttribute('aria-hidden', 'true');
    hollow.innerHTML = `<span class="peek">${spiritSVG(disabled, card.dataset.spirit || VARIANTS[(i + 2) % VARIANTS.length])}</span>`;

    card.insertBefore(hollow, card.querySelector('.app-card-content'));
    const floor = document.createElement('span');
    floor.className = 'floor';
    floor.innerHTML = floorSVG(40 + i * 13);
    card.appendChild(floor);

    const runes = document.createElement('div');
    runes.className = 'tree-runes';
    card.appendChild(runes);

    // Every other tree gets a spirit sitting on its roots
    if (i % 2 === 0 && !disabled) {
      const s = document.createElement('div');
      s.className = 'spirit root-spirit ' + (i % 4 === 0 ? 'left' : 'right');
      s.style.setProperty('--delay', (-i * 0.8) + 's');
      s.dataset.variant = VARIANTS[(i + 1) % VARIANTS.length];
      mountSpirit(s);
      card.appendChild(s);
      treeSpirits.push(s);
      card.addEventListener('pointerenter', () => hop(s, performance.now()));
    }
  });

  document.querySelectorAll('.spirit-layer .spirit').forEach(s => mountSpirit(s));
  /* ---------- One continuous trunk per grid column ---------- */
  function columnTrunkSVG(w, H, topLen, seed) {
    const r = rng(seed);
    const cx = w / 2, half = w * 0.27;
    const flareH = Math.min(90, H * 0.2);
    const ph1 = r() * 6, ph2 = r() * 6;
    const wob = y => 2.2 * Math.sin(y / 110 + ph1) + 1.2 * Math.sin(y / 47 + ph2);
    const hw = y => half * (0.93 + 0.07 * y / H);
    const flare = y => { const t = Math.max(0, (y - (H - flareH)) / flareH); return t * t * (w * 0.5 - hw(y)); };
    const L = y => cx - hw(y) - flare(y) + wob(y);
    const R = y => cx + hw(y) + flare(y) + wob(y) * 0.7;
    const f = n => n.toFixed(1);

    // outline
    let d = `M${f(L(0))},0`;
    for (let y = 10; y <= H; y += 10) d += ` L${f(L(y))},${y}`;
    d += ` L${f(L(H))},${H} L${f(R(H))},${H}`;
    for (let y = Math.floor(H / 10) * 10; y >= 0; y -= 10) d += ` L${f(R(y))},${y}`;
    d += 'Z';

    // wavy bark grain, broken into lengths like real bark
    let grain = '', light = '';
    for (let k = 0; k < 6; k++) {
      const fx = -0.78 + k * 0.31 + (r() - 0.5) * 0.08;
      const amp = 2.5 + r() * 4, lam = 30 + r() * 40, ph = r() * 6;
      const amp2 = 1 + r() * 2, lam2 = 11 + r() * 10;
      const xAt = yy => cx + fx * hw(yy) + amp * Math.sin(yy / lam + ph) + amp2 * Math.sin(yy / lam2 + ph * 2) + wob(yy) + flare(yy) * fx;
      let y = r() * 40;
      while (y < H) {
        const end = Math.min(H - 4, y + 60 + r() * 260);
        let seg = `M${f(xAt(y))},${f(y)}`;
        for (let yy = y + 6; yy <= end; yy += 6) seg += ` L${f(xAt(yy))},${f(yy)}`;
        grain += `<path d="${seg}"/>`;
        if (r() < 0.5) light += `<path d="${seg}" transform="translate(-2 0)"/>`;
        y = end + 14 + r() * 50;
      }
    }

    // knots and moss
    let knots = '', moss = '';
    for (let y = topLen * 0.5 + r() * 120; y < H - flareH; y += 220 + r() * 160) {
      const x = cx + (r() - 0.5) * hw(y) * 1.1 + wob(y);
      const rx = 3 + r() * 2.5, ry = 6 + r() * 4;
      knots += `<ellipse cx="${f(x)}" cy="${f(y)}" rx="${f(rx + 3)}" ry="${f(ry + 4)}" fill="none" stroke="#1a110a" stroke-width="1.5" opacity=".6"/><ellipse cx="${f(x)}" cy="${f(y)}" rx="${f(rx)}" ry="${f(ry)}" fill="#1c130c"/>`;
    }
    for (let y = topLen * 0.4 + r() * 80; y < H - 30; y += 110 + r() * 140) {
      const left = r() < 0.5;
      const x = left ? L(y) + 3 : R(y) - 3;
      moss += `<ellipse cx="${f(x)}" cy="${f(y)}" rx="${f(4 + r() * 3)}" ry="${f(12 + r() * 14)}" fill="${r() < 0.5 ? '#56803a' : '#6f9a4a'}" opacity=".75"/>`;
    }

    // two branches high up, fading into the canopy
    const b1 = topLen * (0.42 + (r() - 0.5) * 0.2);   // 32–52% of the way down to the first hollow
    const b2 = topLen * (0.62 + (r() - 0.5) * 0.2);   // 52–72%
    const branches = `
      <path d="M${f(L(b2) + 4)},${f(b2)} C${f(L(b2) - w * .1)},${f(b2 - 10)} ${f(L(b2) - w * .2)},${f(b2 - 16)} ${f(L(b2) - w * .3)},${f(b2 - 18)}" stroke="#2a1c11" stroke-width="7" fill="none" stroke-linecap="round"/>
      <g class="foliage"><circle cx="${f(L(b2) - w * .3)}" cy="${f(b2 - 24)}" r="14" fill="#1f3d2a"/><circle cx="${f(L(b2) - w * .23)}" cy="${f(b2 - 30)}" r="11" fill="#27492f"/><circle cx="${f(L(b2) - w * .36)}" cy="${f(b2 - 14)}" r="9" fill="#1b3524"/></g>
      <path d="M${f(R(b1) - 4)},${f(b1)} C${f(R(b1) + w * .1)},${f(b1 - 10)} ${f(R(b1) + w * .18)},${f(b1 - 14)} ${f(R(b1) + w * .27)},${f(b1 - 16)}" stroke="#2a1c11" stroke-width="6" fill="none" stroke-linecap="round"/>
      <g class="foliage"><circle cx="${f(R(b1) + w * .27)}" cy="${f(b1 - 22)}" r="13" fill="#23452f"/><circle cx="${f(R(b1) + w * .2)}" cy="${f(b1 - 26)}" r="10" fill="#2f5a36"/><circle cx="${f(R(b1) + w * .32)}" cy="${f(b1 - 10)}" r="8" fill="#1d3b2a"/></g>`;

    const yF = H - flareH;
    const roots = `<path d="M${f(L(yF) + 6)},${f(yF)} C${f(L(yF))},${f(yF + flareH * .5)} ${f(w * .12)},${f(H - 8)} 3,${H - 2} M${f(R(yF) - 6)},${f(yF)} C${f(R(yF))},${f(yF + flareH * .5)} ${f(w * .88)},${f(H - 8)} ${f(w - 3)},${H - 2}"/>`;

    const gid = 'colbark' + seed;
    return `<svg class="col-trunk-svg" width="${w}" height="${H}" viewBox="0 0 ${w} ${H}" style="overflow:visible;display:block">
      <defs><linearGradient id="${gid}" gradientUnits="userSpaceOnUse" x1="${f(cx - half)}" x2="${f(cx + half)}" y1="0" y2="0">
        <stop offset="0" stop-color="#1a120c"/><stop offset=".4" stop-color="#2e2016"/><stop offset=".74" stop-color="#4a3522"/><stop offset=".9" stop-color="#34251a"/><stop offset="1" stop-color="#1a120c"/>
      </linearGradient></defs>
      ${branches}
      <path d="${d}" fill="url(#${gid})"/>
      <g stroke="#120c07" stroke-width="2.4" fill="none" opacity=".5" stroke-linecap="round">${grain}${roots}</g>
      <g stroke="#6a4c30" stroke-width="1" fill="none" opacity=".35" stroke-linecap="round">${light}</g>
      ${knots}${moss}
    </svg>`;
  }

  function buildColumnTrunks() {
    const grid = document.querySelector('.app-grid');
    let wrap = grid.querySelector('.col-trunks');
    if (!wrap) {
      wrap = document.createElement('div');
      wrap.className = 'col-trunks';
      wrap.setAttribute('aria-hidden', 'true');
      grid.prepend(wrap);
    }
    const cards = [...grid.querySelectorAll('.app-card')];
    if (!cards.length) return;
    const gridTopPage = grid.getBoundingClientRect().top + scrollY;
    const bottom = Math.max(...cards.map(c => c.offsetTop + c.offsetHeight));
    const cols = new Map();
    cards.forEach(c => {
      const key = Math.round(c.offsetLeft);
      if (!cols.has(key)) cols.set(key, []);
      cols.get(key).push(c);
    });
    let html = '', ci = 0;
    cols.forEach((list, left) => {
      list.sort((a, b) => a.offsetTop - b.offsetTop);
      const first = list[0];
      const w = first.offsetWidth;
      const top = -gridTopPage - 20;           // reach up past the top of the page
      const H = Math.round(bottom - top + 4);
      const topLen = first.offsetTop - top;
      const mask = `linear-gradient(to bottom, transparent 0px, rgba(0,0,0,.6) ${Math.round(topLen * .2)}px, #000 ${Math.round(topLen * .55)}px)`;
      html += `<div class="col-trunk" style="left:${left}px; top:${Math.round(top)}px; width:${w}px; height:${H}px; -webkit-mask-image:${mask}; mask-image:${mask}">${columnTrunkSVG(w, H, topLen, 101 + ci * 17)}</div>`;
      ci++;
    });
    wrap.innerHTML = html;
  }

  // Everything that can rustle, and the spirits that are currently shown.
  // Kept in lists so the breeze doesn't have to search the page on every mouse move.
  let foliageEls = [], visibleSpirits = [];
  function refreshLists() {
    foliageEls = [...document.querySelectorAll('.foliage')];
    visibleSpirits = [...document.querySelectorAll('.spirit')].filter(s => s.offsetParent !== null);
    visibleSpirits.forEach(s => { s._look = s.querySelector('.look'); });
  }
  function layout() {
    markRows();
    buildColumnTrunks();
    refreshLists();
  }

  layout();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(layout);
  // Mobile browsers fire 'resize' whenever the address bar shows or hides while
  // scrolling. The grid only changes when the *width* changes, so ignore the rest.
  let layoutW = innerWidth, layoutQueued = false;
  addEventListener('resize', () => {
    if (innerWidth === layoutW || layoutQueued) return;
    // rebuild on the very next frame (no delay), at most once per frame
    layoutQueued = true;
    requestAnimationFrame(() => {
      layoutQueued = false;
      layoutW = innerWidth;
      layout();
    });
  });

  function hop(s, now) {
    if (reduceMotion || (s._hop && now - s._hop < 800)) return;
    s._hop = now;
    s.querySelector('.hop').animate([
      { transform: 'translateY(0)' }, { transform: 'translateY(-12px)' }, { transform: 'translateY(0)' }
    ], { duration: 460, easing: 'cubic-bezier(.3,.7,.4,1)' });
  }

  /* ---------- Breeze input ---------- */
  let px = -9999, py = -9999, pvx = 0, pvy = 0, lastX = null, lastY = null;
  let pointerActive = false, needsReact = false, mx = 0.5, spawnAcc = 0;

  function onMove(x, y) {
    if (lastX !== null) {
      pvx += (clamp(x - lastX, -40, 40) - pvx) * 0.35;
      pvy += (clamp(y - lastY, -40, 40) - pvy) * 0.35;
      spawnAcc += Math.hypot(x - lastX, y - lastY);
    }
    lastX = x; lastY = y; px = x; py = y;
    mx = x / innerWidth;
    pointerActive = true;
    needsReact = true;
  }
  addEventListener('pointermove', e => { if (e.pointerType === 'mouse') onMove(e.clientX, e.clientY); }, { passive: true });
  addEventListener('touchstart', e => { const t = e.touches[0]; lastX = t.clientX; lastY = t.clientY; px = lastX; py = lastY; }, { passive: true });
  addEventListener('touchmove', e => { const t = e.touches[0]; onMove(t.clientX, t.clientY); }, { passive: true });
  addEventListener('touchend', () => { lastX = null; pointerActive = false; }, { passive: true });
  document.documentElement.addEventListener('mouseleave', () => { lastX = null; pointerActive = false; });

  /* ---------- Rustling + spirit reactions ---------- */
  const sunFront = document.getElementById('sunFront');

  function react(now) {
    const speed = Math.hypot(pvx, pvy);

    if (speed > 3 && !reduceMotion) {
      for (const el of foliageEls) {
        if (el._t && now - el._t < 900) continue;
        const b = el.getBoundingClientRect();
        if (b.bottom < 0 || b.top > innerHeight) continue;
        const cx = clamp(px, b.left, b.right), cy = clamp(py, b.top, b.bottom);
        if (Math.hypot(px - cx, py - cy) < 40) {
          el._t = now;
          const amt = (pvx >= 0 ? 1 : -1) * (1.5 + Math.min(speed, 30) / 8);
          el.animate([
            { transform: 'rotate(0deg)' }, { transform: `rotate(${amt}deg)` },
            { transform: `rotate(${-amt * 0.55}deg)` }, { transform: `rotate(${amt * 0.25}deg)` },
            { transform: 'rotate(0deg)' }
          ], { duration: 900, easing: 'ease-out' });
        }
      }
    }

    for (const s of visibleSpirits) {
      const b = s.getBoundingClientRect();
      if (b.bottom < -50 || b.top > innerHeight + 50) continue;
      const cx = b.left + b.width / 2, cy = b.top + b.height / 2;
      const dx = px - cx, dy = py - cy, d = Math.hypot(dx, dy) || 1;
      const eyes = s._look;
      if (eyes) {
        const k = d < 600 ? 1.8 : 0;
        eyes.setAttribute('transform', `translate(${(dx / d * k).toFixed(2)} ${(dy / d * k).toFixed(2)})`);
      }
      if (d < 140 && speed > 4) {
        s.style.setProperty('--lean', clamp(pvx * 1.3, -28, 28) + 'deg');
        s.classList.add('blown');
        clearTimeout(s._to);
        s._to = setTimeout(() => { s.style.setProperty('--lean', '0deg'); s.classList.remove('blown'); }, 650);
        if (speed > 18 && d < 100) hop(s, now);
      }
    }
  }

  /* ---------- Falling leaves ---------- */
  const cv = document.getElementById('breeze');
  const ctx = cv.getContext('2d');
  let W = 0, H = 0, baseCount = 0;
  const LEAF_COLORS = ['#6f9a4a', '#86ad55', '#4f7a3a', '#a5b85c', '#b98a3e', '#5d8a47', '#7fa453', '#c49a45'];
  let leaves = [];
  let extraLeaves = 0;
  const MAX_EXTRA = reduceMotion ? 0 : 90;

  function makeLeaf(anyY, x, y, vx, vy) {
    return {
      x: x ?? Math.random() * W,
      y: y ?? (anyY ? Math.random() * H : -20 - Math.random() * 60),
      vx: vx ?? 0,
      vy: vy ?? 0.3 + Math.random() * 0.4,
      a: Math.random() * 6.28, va: (Math.random() - 0.5) * 0.05,
      s: 4.5 + Math.random() * 6,
      c: LEAF_COLORS[Math.floor(Math.random() * LEAF_COLORS.length)],
      ph: Math.random() * 6.28, flip: Math.random() * 6.28,
      extra: x !== undefined
    };
  }

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const newW = innerWidth, newH = Math.max(cv.clientHeight, innerHeight);
    if (newW === W && newH === H) return;   // address bar moved: nothing to do
    W = newW; H = newH;
    cv.width = W * dpr; cv.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    baseCount = W < 700 ? 36 : 70;
    if (reduceMotion) baseCount = Math.round(baseCount / 4);
    let base = leaves.filter(l => !l.extra);
    const extras = leaves.filter(l => l.extra);
    while (base.length < baseCount) base.push(makeLeaf(true));
    base.length = baseCount;
    leaves = base.concat(extras);
  }
  addEventListener('resize', resize);
  resize();

  function drawLeaf(l) {
    ctx.save();
    ctx.translate(l.x, l.y);
    ctx.rotate(l.a);
    ctx.scale(Math.max(0.2, Math.abs(Math.cos(l.flip))), 1);
    ctx.fillStyle = l.c;
    ctx.beginPath();
    ctx.moveTo(0, -l.s);
    ctx.quadraticCurveTo(l.s * 0.75, 0, 0, l.s);
    ctx.quadraticCurveTo(-l.s * 0.75, 0, 0, -l.s);
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,.25)';
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(0, -l.s * 0.9);
    ctx.lineTo(0, l.s * 1.2);
    ctx.stroke();
    ctx.restore();
  }

  /* ---------- Click anywhere (except on an app) for a little pop of leaves ---------- */
  const pops = [];
  addEventListener('click', e => {
    if (e.target.closest('a, button, [role="button"], input, textarea, select')) return;
    const n = reduceMotion ? 6 : 16;
    for (let j = 0; j < n; j++) {
      const ang = Math.random() * Math.PI * 2;
      const sp = 1.4 + Math.random() * 2.4;
      const leaf = makeLeaf(false, e.clientX, e.clientY, Math.cos(ang) * sp, Math.sin(ang) * sp - 0.8);
      leaf.burst = 45 + Math.random() * 20;
      leaf.va = (Math.random() - 0.5) * 0.25;
      leaves.push(leaf);
      extraLeaves++;
    }
    if (!reduceMotion) pops.push({ x: e.clientX, y: e.clientY, t: 0 });
  });
  /* ---------- Tree Runes Animation ---------- */
  const runeChars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const pausedRunes = [];
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) pausedRunes.splice(0).forEach(fn => fn());
  });
  document.querySelectorAll('.tree-runes').forEach(el => {
    const updateRunes = () => {
      if (document.hidden) { pausedRunes.push(updateRunes); return; }   // resume when the tab is visible again
      let str = '';
      const length = 5 + Math.floor(Math.random() * 5); // 4 to 8 characters tall
      for (let j = 0; j < length; j++) {
        str += runeChars.charAt(Math.floor(Math.random() * runeChars.length));
      }
      el.textContent = str;
      setTimeout(updateRunes, 1200 + Math.random() * 4000); 
    };
    updateRunes();
  });

  /* ---------- Main loop ---------- */
  const layers = [...document.querySelectorAll('[data-sway]')];
  let lastT = performance.now(), lastScroll = scrollY, sunDim = 0;

  function tick(now) {
    const k = Math.min(3, (now - lastT) / 16.67);
    lastT = now;
    const scrollV = clamp(scrollY - lastScroll, -60, 60);
    lastScroll = scrollY;

    // Trees sway gently toward the cursor
    if (!reduceMotion) {
      for (const l of layers) {
        const t = `translate3d(${((mx - 0.5) * -l.dataset.sway).toFixed(1)}px,0,0)`;
        if (t !== l._t) { l._t = t; l.style.transform = t; }
      }
    }

    if (needsReact) { react(now); needsReact = false; }

    // A strong breeze makes the light flicker through the moving leaves
    const speed = Math.hypot(pvx, pvy);
    sunDim += (Math.min(speed / 40, 1) * 0.35 - sunDim) * 0.1;
    const sunO = (0.55 - sunDim).toFixed(3);
    if (sunO !== sunFront._o) { sunFront._o = sunO; sunFront.style.opacity = sunO; }

    // Moving the cursor shakes loose extra leaves
    if (pointerActive && !reduceMotion) {
      let n = 0;
      while (spawnAcc > 24 && extraLeaves < MAX_EXTRA && n < 3) {
        spawnAcc -= 24; n++; extraLeaves++;
        leaves.push(makeLeaf(false,
          px + (Math.random() - 0.5) * 30,
          py + (Math.random() - 0.5) * 30,
          pvx * 0.03 + (Math.random() - 0.5) * 0.4,
          pvy * 0.03 - Math.random() * 0.3));
      }
    }
    spawnAcc = Math.min(spawnAcc, 60);

    ctx.clearRect(0, 0, W, H);
    const R = 170;
    for (let i = leaves.length - 1; i >= 0; i--) {
      const l = leaves[i];
      l.ph += 0.02 * k;
      l.vx += Math.sin(l.ph) * 0.012 * k;
      l.vy += (0.55 - l.vy) * 0.02 * k;
      l.vy -= scrollV * 0.004;
      if (pointerActive) {
        const dx = l.x - px, dy = l.y - py, d = Math.hypot(dx, dy);
        if (d < R) {
          const f = 1 - d / R;
          l.vx += (pvx * 0.01 + dx / (d || 1) * 0.02) * f * k;
          l.vy += (pvy * 0.008 + dy / (d || 1) * 0.015) * f * k;
          l.va += pvx * 0.0003 * f;
        }
      }
      if (l.burst > 0) {
        // freshly popped leaves slow down smoothly before joining the drift
        l.burst -= k;
        l.vx *= Math.pow(0.93, k);
        l.vy = l.vy * Math.pow(0.93, k) + 0.02 * k;
        l.va *= 0.97;
      } else {
        l.vx *= Math.pow(0.98, k);
        l.vx = clamp(l.vx, -2, 2);
        l.vy = clamp(l.vy, -1.2, 1.8);
        l.va = clamp(l.va * 0.99, -0.06, 0.06);
      }
      l.x += l.vx * k; l.y += l.vy * k;
      l.a += (l.va + l.vx * 0.01) * k;
      l.flip += 0.03 * k;

      if (l.extra) {
        if (l.y > H + 30 || l.y < -100 || l.x < -60 || l.x > W + 60) {
          leaves.splice(i, 1); extraLeaves--; continue;
        }
      } else {
        if (l.y > H + 30) Object.assign(l, makeLeaf(false));
        if (l.y < -80) { l.y = H + 20; l.x = Math.random() * W; }
        if (l.x < -40) l.x = W + 30; else if (l.x > W + 40) l.x = -30;
      }
      ctx.globalAlpha = 0.9;
      drawLeaf(l);
    }
    for (let i = pops.length - 1; i >= 0; i--) {
      const p = pops[i];
      p.t += k / 22;
      if (p.t >= 1) { pops.splice(i, 1); continue; }
      ctx.globalAlpha = (1 - p.t) * 0.6;
      ctx.strokeStyle = '#d6f28f';
      ctx.lineWidth = 2 * (1 - p.t) + 0.5;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 6 + p.t * 26, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    pvx *= 0.9; pvy *= 0.9;
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
})();
