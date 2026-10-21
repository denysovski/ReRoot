/* Re:Root public site layout — nav, footer, and per-view enhancements (reveal, word fill, 3D scenes). */
(function () {
  const { $, $$, Spring, theme, auth, menu, glass, motion, clamp, fmt } = RR;

  const LINKS = [['how-it-works', 'How it works', 'how'], ['showcase', 'Showcase', 'showcase'], ['community', 'Community', 'community'], ['articles', 'Articles', 'articles'], ['about', 'About', 'about']];
  const sun = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="4.5"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>';
  const moon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/></svg>';

  function shell() {
    const user = auth.current();
    const cta = user ? `<a class="btn btn-primary btn-sm" data-press href="app">Open app</a>`
      : `<a class="login-link" href="login">Log in</a><a class="btn btn-primary btn-sm" data-press href="register">Get started</a>`;
    const col = (h, items) => `<div class="f-col"><h4>${h}</h4>${items.map(([href, t]) => `<a href="${href}">${t}</a>`).join('')}</div>`;
    return `<div class="nav-fade" aria-hidden="true"></div><header class="nav" aria-label="Main">
      <a class="logo" href="./">RE<b>:</b>ROOT</a>
      <nav class="nav-links">${LINKS.map(([h, t, id]) => `<a href="${h}" data-id="${id}">${t}</a>`).join('')}</nav>
      <div class="nav-right"><button class="icon-btn" id="theme-btn" data-press aria-label="Switch theme"></button>${cta}
        <button class="icon-btn burger" id="burger" data-press aria-label="Open menu"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 8h16M4 16h16"/></svg></button></div>
    </header>
    <div class="mnav" id="mnav" hidden>
      ${LINKS.map(([h, t, id]) => `<a href="${h}" data-id="${id}">${t}</a>`).join('')}
      <div class="actions">${user ? `<a class="btn btn-primary btn-block" href="app">Open app</a>` : `<a class="btn btn-primary btn-block" href="register">Create free account</a><a class="btn-text" href="login">I already have an account</a>`}</div>
    </div>
    <div class="nav-space"></div>
    <main id="view"></main>
    <footer class="footer"><div class="wrap">
      <div class="f-top">
        <div class="f-brand"><a class="logo" href="./">RE<b>:</b>ROOT</a>
          <p>A calm, black-and-white tracker for quitting the habits that hold you back. Check in daily, see your patterns and get help when it's hard.</p>
          <div class="actions-row">${user ? '<a class="btn btn-primary btn-sm" data-press href="app">Open app</a>' : '<a class="btn btn-primary btn-sm" data-press href="register">Get started</a><a class="btn-text" href="login">Log in</a>'}</div></div>
        ${col('Product', [['how-it-works', 'How it works'], ['showcase', 'Showcase'], ['articles', 'Articles'], ['community', 'Community']])}
        ${col('Company', [['about', 'About Re:Root'], ['faq', 'FAQ'], ['contact', 'Contact']])}
        ${col('Legal', [['terms', 'Terms & conditions'], ['privacy', 'Privacy policy'], ['terms#disclaimer', 'Medical disclaimer']])}
        ${col('Account', user ? [['app', 'Open app'], ['app/today', 'Today\'s check-in'], ['app/progress', 'Your progress']] : [['login', 'Log in'], ['register', 'Create account'], ['how-it-works', 'Getting started']])}
      </div>
      <div class="f-bottom"><span>© 2026 Re:Root · Demo project. Accounts are simulated and stored only in your browser.</span><button class="btn-text" id="to-top">Back to top</button></div>
    </div></footer>`;
  }
  function mountShell(L) {
    L.innerHTML = shell();
    const tb = $('#theme-btn');
    const paint = () => { tb.innerHTML = theme.isDark() ? sun : moon; tb.setAttribute('aria-label', theme.isDark() ? 'Switch to light mode' : 'Switch to dark mode'); };
    paint(); tb.addEventListener('click', () => { theme.toggle(); paint(); });
    const m = menu($('#burger'), $('#mnav'), { origin: '50% 0' });
    $('#mnav').addEventListener('click', e => { if (e.target.closest('a')) m.hide(); });
    $('#to-top').addEventListener('click', () => scrollTo({ top: 0, behavior: motion.reduce ? 'auto' : 'smooth' }));
    // nav zooms in when scrolling up, out when scrolling down
    if (navCtrl) navCtrl.abort(); navCtrl = new AbortController();
    const nav = $('.nav'), sc = new Spring(1, { eps: .0005 });
    sc.on(v => { nav.style.transform = `translateX(-50%) scale(${v})`; nav.classList.toggle('compact', v < .97); });
    let lastY = scrollY, acc = 0;
    addEventListener('scroll', () => {
      const y = scrollY, d = y - lastY; lastY = y;
      if (y < 40) { sc.to(1.04, { response: .45, damping: .8 }); acc = 0; return; }
      acc = (Math.sign(d) === Math.sign(acc) ? acc : 0) + d;
      if (acc > 24) sc.to(.88, { response: .5, damping: 1 });
      else if (acc < -24) sc.to(1.04, { response: .45, damping: .8 });
    }, { passive: true, signal: navCtrl.signal });
    sc.set(scrollY < 40 ? 1.04 : 1);
  }
  let navCtrl = null;
  function updateNav(id) { $$('.nav-links a, .mnav a[data-id]').forEach(a => a.dataset.id === id ? a.setAttribute('aria-current', 'page') : a.removeAttribute('aria-current')); }

  /* ---------- generic 3D scene: tilts toward the pointer, floats when idle ---------- */
  function scene(host, sc, base, signal) {
    // pointer tilt springs + an idle float whose strength (mix) eases in 1.5 s after the pointer leaves
    const rx = new Spring(0, { eps: .01 }), ry = new Spring(0, { eps: .01 }), mix = new Spring(motion.reduce ? 0 : 1, { eps: .001 });
    const t0 = performance.now(), off = Math.random() * 10; let wait = 0;
    const paint = now => {
      const t = ((now || performance.now()) - t0) / 1000 + off, k = mix.value;
      sc.style.transform = `${base} rotateX(${rx.value + Math.sin(t * .6) * 2 * k}deg) rotateY(${ry.value + Math.cos(t * .5) * 3 * k}deg)`;
    };
    rx.on(() => paint()); ry.on(() => paint()); mix.on(() => paint()); paint();
    host.addEventListener('pointermove', e => { if (e.pointerType === 'touch' || motion.reduce) return;
      clearTimeout(wait); mix.to(0, { response: .5, damping: 1 });
      const r = host.getBoundingClientRect(), x = (e.clientX - r.left) / r.width - .5, y = (e.clientY - r.top) / r.height - .5;
      rx.to(-y * 14, { response: .7, damping: 1 }); ry.to(x * 20, { response: .7, damping: 1 }); }, { signal });
    host.addEventListener('pointerleave', () => {
      rx.to(0, { response: 1.1, damping: 1 }); ry.to(0, { response: 1.1, damping: 1 });
      clearTimeout(wait); wait = setTimeout(() => mix.to(1, { response: 2.4, damping: 1 }), 1500); }, { signal });
    signal.addEventListener('abort', () => clearTimeout(wait));
    if (!motion.reduce) {
      const float = now => { if (signal.aborted || !sc.isConnected) return; if (mix.value > .001) paint(now); requestAnimationFrame(float); };
      requestAnimationFrame(float);
    }
    requestAnimationFrame(() => host.classList.add('built'));
  }

  function calendar(cal, signal) {
    const now = new Date(), y = now.getFullYear(), m = now.getMonth(), today = now.getDate();
    const lead = (new Date(y, m, 1).getDay() + 6) % 7, days = new Date(y, m + 1, 0).getDate(), slipDay = Math.max(1, today - 24);
    let cells = '';
    for (let i = 0; i < lead; i++) cells += '<i class="d e"></i>';
    for (let d = 1; d <= days; d++) cells += `<i class="d ${d > today ? 'f' : d === today ? 't' : d === slipDay ? 'x' : 'c'}" style="--i:${d}"><span>${d}</span></i>`;
    cal.innerHTML = `<div class="cal-scene">
      <div class="cal-plate back"></div>
      <div class="cal-plate glass"><div class="cal-head"><b>${fmt(now, { month: 'long' })}</b><span class="mono">${y}</span></div>
        <div class="cal-dow">${['M', 'T', 'W', 'T', 'F', 'S', 'S'].map(d => `<span>${d}</span>`).join('')}</div><div class="cal-grid">${cells}</div></div>
      <div class="cal-chip c1 glass"><span class="eyebrow">Current streak</span><b class="mono">${today - slipDay} days</b></div>
      <div class="cal-chip c2 glass"><span class="eyebrow">Today</span><b>Check in →</b></div>
      <div class="cal-chip c3 glass"><span class="eyebrow">Urge</span><b class="mono">2 / 5</b></div></div>`;
    scene(cal.closest('[data-tilt-host]') || cal, $('.cal-scene', cal), 'rotateX(24deg) rotateY(-22deg) rotateZ(4deg)', signal);
    requestAnimationFrame(() => cal.classList.add('built'));
  }

  /* a line that links a section heading to each row below it and draws itself as you scroll (desktop) */
  function thread(root, signal) {
    $$('[data-thread]', root).forEach(rows => {
      const host = rows.parentElement, head = $('.sec-head h2', host); if (!head) return;
      host.classList.add('thread-host');
      const NS = 'http://www.w3.org/2000/svg', svg = document.createElementNS(NS, 'svg'); svg.classList.add('sthread'); svg.setAttribute('aria-hidden', 'true');
      const path = document.createElementNS(NS, 'path'); svg.appendChild(path); host.appendChild(svg);
      let L = 0, marks = [], end = null, on = false;
      const build = () => {
        on = innerWidth > 900; svg.style.display = on ? '' : 'none'; if (!on) return;
        // layout offsets ignore the scroll-in transforms, so the line lands where things end up
        const off = el => { let x = 0, y = 0; for (let e = el; e; e = e.offsetParent) { x += e.offsetLeft; y += e.offsetTop; } return [x, y]; };
        const [hx, hy] = off(host), hb = { width: host.offsetWidth, height: host.offsetHeight };
        const rel = el => { const [x, y] = off(el); return { l: x - hx, t: y - hy, b: y - hy + el.offsetHeight, r: x - hx + el.offsetWidth }; };
        svg.setAttribute('width', hb.width); svg.setAttribute('height', hb.height); svg.setAttribute('viewBox', `0 0 ${hb.width} ${hb.height}`);
        const h = rel(head), heads = $$('.alt-text h3', rows).map(rel), rowsR = $$('.alt-row', rows).map(rel), G = 30;
        // starts just above the first image, then drops down beside the first heading
        const pts = [[rowsR[0].l + 4, rowsR[0].t - 34]]; let y0 = rowsR[0].t - 34;
        const anchors = [pts[0]];
        heads.forEach((hh, k) => { const x = hh.l - G, y = hh.t + (hh.b - hh.t) / 2, prev = pts[pts.length - 1];
          if (Math.abs(prev[0] - x) > 1) { pts.push([prev[0], y0], [x, y0]); } pts.push([x, y]); anchors.push([x, y]);
          y0 = k < rowsR.length - 1 ? rowsR[k].b + (rowsR[k + 1].t - rowsR[k].b) / 2 : rowsR[k].b + 40; });
        const lastX = pts[pts.length - 1][0]; pts.push([lastX, y0]); end = [lastX, y0];
        // orthogonal polyline with rounded corners
        const R = 28; let d = `M${pts[0][0]} ${pts[0][1]}`;
        for (let i = 1; i < pts.length; i++) { const [x, y] = pts[i], nx = pts[i + 1];
          if (!nx) { d += ` L${x} ${y}`; break; }
          const [px, py] = pts[i - 1], dx1 = Math.sign(x - px), dy1 = Math.sign(y - py), dx2 = Math.sign(nx[0] - x), dy2 = Math.sign(nx[1] - y);
          const r = Math.min(R, Math.abs(x - px || y - py) / 2, Math.abs(nx[0] - x || nx[1] - y) / 2);
          d += ` L${x - dx1 * r} ${y - dy1 * r} Q${x} ${y} ${x + dx2 * r} ${y + dy2 * r}`; }
        path.setAttribute('d', d); L = path.getTotalLength(); path.style.strokeDasharray = L;
        $$('circle', svg).forEach(c => c.remove());
        marks = anchors.map(([x, y]) => { const c = document.createElementNS(NS, 'circle'); c.setAttribute('cx', x); c.setAttribute('cy', y); c.setAttribute('r', 6); svg.appendChild(c); return { c, y }; });
        const e = document.createElementNS(NS, 'circle'); e.setAttribute('cx', end[0]); e.setAttribute('cy', end[1]); e.setAttribute('r', 11); e.classList.add('end'); svg.appendChild(e);
        marks.push({ c: e, y: end[1] }); draw();
      };
      const draw = () => { if (!on || !L) return;
        const target = innerHeight * .6 - host.getBoundingClientRect().top;
        let lo = 0, hi = L; if (RR.motion.reduce) lo = L; else for (let i = 0; i < 22; i++) { const m = (lo + hi) / 2; if (path.getPointAtLength(m).y <= target) lo = m; else hi = m; }
        path.style.strokeDashoffset = L - lo; marks.forEach(m => m.c.classList.toggle('on', m.y <= target + 1 || RR.motion.reduce)); };
      let raf = 0; addEventListener('scroll', () => { if (!raf) raf = requestAnimationFrame(() => { raf = 0; draw(); }); }, { passive: true, signal });
      const ro = new ResizeObserver(() => build()); ro.observe(host); signal.addEventListener('abort', () => ro.disconnect());
      setTimeout(build, 900);
    });
  }

  /* habit stack flies in and settles; the three phones turn like a carousel as you scroll past */
  function scrollScenes(root, signal) {
    const stack = $('.stack3d', root), phones = $('.phones3d', root); if (!stack && !phones) return;
    const rows = stack ? $$('.srow', stack) : [], chip = stack && $('.stack-chip', stack), ph = phones ? $$('.phone', phones) : [];
    if (phones) phones.classList.add('js-turn');
    const prog = el => { const r = el.closest('.scene-host').getBoundingClientRect(), vh = innerHeight; return clamp((vh - r.top) / (vh + r.height)); };
    const sm = t => t * t * (3 - 2 * t);
    const frame = () => {
      if (stack) { const p = motion.reduce ? 1 : clamp(prog(stack) / .5);
        stack.style.scale = (.82 + .18 * sm(p)).toFixed(4);
        rows.forEach((el, i) => { const q = 1 - sm(clamp(p * 1.7 - i * .18)); el.style.translate = `${q * 260}px ${q * 90}px ${q * 160}px`; el.style.opacity = (1 - q).toFixed(3); });
        if (chip) { const q = 1 - sm(clamp(p * 1.7 - .8)); chip.style.opacity = (1 - q).toFixed(3); chip.style.translate = `0 ${-q * 40}px 0`; } }
      if (phones) { const narrow = innerWidth < 620, R = narrow ? 105 : 205, t = motion.reduce ? 0 : sm(clamp((prog(phones) - .32) / .4));
        ph.forEach((el, k) => { const th = ((k - 1) * 120 + t * 120) * Math.PI / 180, s = Math.sin(th), c = Math.cos(th);
          el.style.transform = `translateX(${(s * R).toFixed(1)}px) translateZ(${(48 + (c - 1) * 110).toFixed(1)}px) rotateY(${(-s * 24).toFixed(2)}deg)`;
          el.style.zIndex = Math.round(c * 10) + 10; }); }
    };
    let raf = 0; const req = () => { if (!raf) raf = requestAnimationFrame(() => { raf = 0; frame(); }); };
    addEventListener('scroll', req, { passive: true, signal }); addEventListener('resize', req, { signal }); frame();
  }

  /* hero glow: a wide band of light along the bottom of the window at the very top, shrinking into a round orb as you scroll */
  function heroOrb(root, signal) {
    const o = $('.hero-orb', root); if (!o) return;
    const f = () => { const p = motion.reduce ? 1 : clamp(scrollY / 380), e = p * p * (3 - 2 * p);
      o.style.setProperty('--ow', (1 - e).toFixed(4)); };
    addEventListener('scroll', f, { passive: true, signal }); f();
  }

  /* inchworm strip: scrolling moves the cards right-to-left one at a time; the card leaving on the left squeezes into a
     sliver while a new one grows in on the right. Upcoming cards on the right are blurred until the strip reaches its end. */
  function inchworm(root, signal) {
    const sec = $('[data-inch]', root); if (!sec) return;
    const track = $('.inch-track', sec), cards = $$('.inch-card', sec), bar = $('.inch-bar i', sec), N = cards.length;
    let w = 340, g = 24, K = 4, VIS = 6, steps = 1, startX = 0, target = 0;
    const pos = new RR.Spring(0, { eps: .0005 });
    const paint = () => {
      const p = pos.value, clear = clamp(p - (steps - 1)); let x = startX;
      cards.forEach((c, i) => {
        const s = i - p; let f;
        if (s <= -1 || s >= VIS) f = 0; else if (s < 0) f = 1 + s; else if (s > VIS - 1) f = VIS - s; else f = 1;
        const cw = w * f, blur = Math.max(0, s - (K - 1.6)) * (1 - clear);
        c.style.width = cw.toFixed(2) + 'px'; c.style.transform = `translateX(${x.toFixed(2)}px)`;
        c.style.visibility = f <= .001 ? 'hidden' : '';
        c.style.filter = blur > .02 ? `blur(${(blur * 5).toFixed(1)}px)` : '';
        c.style.opacity = blur > .02 ? Math.max(.18, 1 - blur * .32).toFixed(3) : '';
        if (f > 0) x += cw + g * f;
      });
      bar.style.transform = `scaleX(${clamp(p / steps)})`;
    };
    pos.on(paint);
    const layout = () => {
      const full = track.clientWidth, narrow = full < 700, pad = narrow ? 16 : 64;
      g = narrow ? 12 : 24; K = narrow ? 1 : 4; VIS = narrow ? 3 : 6;
      w = narrow ? Math.min(300, full * .74) : Math.min(420, (full - pad * 2 - (K - 1) * g) / (K + .45));
      steps = Math.max(1, N - K);
      startX = pad;
      sec.style.setProperty('--cw', w + 'px');
      sec.style.height = `calc(100vh + ${steps * (narrow ? 50 : 62)}vh)`;
      onScroll(true);
    };
    // progress starts while the section is still sliding in and ends exactly when it un-pins, so you glide in and out
    const onScroll = (instant) => {
      const r = sec.getBoundingClientRect(), vh = innerHeight, span = (r.height - vh) + vh * .45;
      const p = span > 0 ? clamp((vh * .45 - r.top) / span) : 0, t = Math.min(steps, Math.round(p * steps));
      if (instant === true || motion.reduce) { target = t; pos.set(t); paint(); return; }
      if (t !== target) { target = t; pos.to(t, { response: .85, damping: .92 }); }
    };
    addEventListener('scroll', () => onScroll(false), { passive: true, signal });
    const ro = new ResizeObserver(layout); ro.observe(track); signal.addEventListener('abort', () => ro.disconnect());
    layout();
  }

  /* letter swap: every letter sits in its own mask; as you scroll, it slides out and its outlined twin slides in */
  function letterSwap(root, signal) {
    const sec = $('[data-swap]', root); if (!sec) return;
    const lines = $$('.sw-line', sec).map((li, k) => ({ dir: k % 2 ? 1 : -1, ls: $$('.sw-l', li).map(l => ({ a: l.firstElementChild, b: l.lastElementChild })) }));
    const sm = t => t * t * (3 - 2 * t);
    const f = () => {
      const r = sec.getBoundingClientRect(), span = Math.max(1, r.height - innerHeight * .55), p = motion.reduce ? 0 : clamp(-r.top / span);
      lines.forEach(({ dir, ls }, k) => ls.forEach((l, j) => {
        const n = ls.length, order = dir > 0 ? n - 1 - j : j, q = sm(clamp(p * 1.9 - k * .18 - order / n * .55));
        l.a.style.transform = `translateY(${(dir * -105 * q).toFixed(2)}%)`; l.b.style.transform = `translateY(${(dir * 105 * (1 - q)).toFixed(2)}%)`;
      }));
    };
    addEventListener('scroll', f, { passive: true, signal }); addEventListener('resize', f, { signal }); f();
  }

  function enhance(root, signal) {
    thread(root, signal);
    letterSwap(root, signal);
    inchworm(root, signal);
    heroOrb(root, signal);
    scrollScenes(root, signal);
    const user = auth.current();
    if (user) $$('[data-guest]', root).forEach(el => el.innerHTML = `<a class="btn btn-primary" data-press href="app">Open the app</a><a class="btn-text" href="app/today">Go to today's check-in</a>`);
    glass(root);
    /* scroll-linked 3D entrances: content slides in from the sides or rises from depth as it enters */
    const items = $$('[data-reveal]', root).map(el => {
      let mode = el.dataset.in;
      if (!mode) {
        const par = el.parentElement, sibs = [...par.children].filter(c => c.hasAttribute('data-reveal'));
        if (el.classList.contains('scene-host')) mode = 'depth';
        else if (par.matches('.split, .show-row, .member')) { const r = el.getBoundingClientRect(), pr = par.getBoundingClientRect(); mode = (r.left + r.width / 2) < (pr.left + pr.width / 2) ? 'left' : 'right'; }
        else if (par.matches('.grid-3, .rhythm, .team, .bento, .logos')) { const cols = par.matches('.logos') ? 4 : 3, k = sibs.indexOf(el) % cols; mode = cols === 4 ? ['left', 'depth', 'depth', 'right'][k] : ['left', 'depth', 'right'][k]; }
        else if (par.matches('.grid-2')) mode = sibs.indexOf(el) % 2 ? 'right' : 'left';
        else if (par.matches('.faq, .steps')) mode = sibs.indexOf(el) % 2 ? 'right' : 'left';
        else mode = 'depth';
      }
      const steps = el.parentElement.matches('.steps');
      return { el, mode, p: -1, span: +el.dataset.span || (steps ? .8 : .45), side: steps ? 300 : 0 };
    });
    const ease = t => 1 - Math.pow(1 - t, 3);
    const apply = it => {
      const r = it.el.getBoundingClientRect(), vh = innerHeight;
      const raw = motion.reduce ? 1 : clamp((vh - r.top) / (vh * it.span));
      if (Math.abs(raw - it.p) < .002) return; it.p = raw;
      const q = 1 - ease(raw), s = it.el.style;
      if (raw >= 1) { s.translate = ''; s.rotate = ''; s.scale = ''; s.opacity = ''; s.filter = ''; return; }
      const narrow = innerWidth < 700, side = narrow ? 60 : (it.side || 160);
      if (it.mode === 'left') { s.translate = `${-side * q}px ${30 * q}px 0`; s.rotate = `y ${18 * q}deg`; }
      else if (it.mode === 'right') { s.translate = `${side * q}px ${30 * q}px 0`; s.rotate = `y ${-18 * q}deg`; }
      else { s.translate = `0 ${70 * q}px ${-420 * q}px`; s.rotate = `x ${22 * q}deg`; }
      s.opacity = (.1 + .9 * ease(raw)).toFixed(3);
      s.filter = q > .02 ? `blur(${(q * 6).toFixed(1)}px)` : '';
    };
    let ticking = false;
    const onScroll = () => { if (ticking) return; ticking = true; requestAnimationFrame(() => { ticking = false; items.forEach(apply); }); };
    addEventListener('scroll', onScroll, { passive: true, signal }); addEventListener('resize', onScroll, { signal });
    items.forEach(apply);
    $$('[data-fill]', root).forEach(el => {
      el.innerHTML = el.textContent.trim().split(/\s+/).map(w => `<span>${w}</span>`).join(' ');
      const words = $$('span', el);
      const frame = () => { const r = el.getBoundingClientRect(), vh = innerHeight, p = motion.reduce ? 1 : clamp((vh * .9 - r.top) / (r.height + vh * .45));
        words.forEach((w, i) => w.style.opacity = .16 + .84 * clamp(p * words.length - i)); };
      addEventListener('scroll', frame, { passive: true, signal }); addEventListener('resize', frame, { signal }); frame();
    });
    $$('[data-scene]', root).forEach(h => scene(h, $('.scene', h), h.dataset.scene, signal));
    const cal = $('#cal3d', root); cal && calendar(cal, signal);
    $$('[data-carousel]', root).forEach(c => carousel(c, signal));
    fillIns(root, signal);
  }

  /* ---------- CTA carousel: slides move right to left, arrows + timed indicators ---------- */
  function carousel(c, signal) {
    const track = $('.car-track', c), slides = $$('.car-slide', c), dots = $('.car-dots', c), N = slides.length, DUR = 5000, C = 2 * Math.PI * 9;
    dots.innerHTML = slides.map((_, i) => `<button class="car-dot" data-i="${i}" aria-label="Show slide ${i + 1}"><span class="fill"></span></button>`).join('');
    const pos = new Spring(0, { eps: .0005 }); let idx = 0, t0 = 0, started = false, paused = false, pauseAt = 0;
    pos.on(v => { track.style.transform = `translateX(${-v * 100}%)`; slides.forEach((sl, i) => { const d = Math.abs(i - v); sl.style.opacity = Math.max(0, 1 - d * 1.2); sl.style.filter = d > .02 && !motion.reduce ? `blur(${Math.min(8, d * 10)}px)` : ''; }); });
    pos.set(0);
    const paint = p => $$('.car-dot', c).forEach((d, i) => { d.classList.toggle('on', i === idx); d.firstChild.style.transform = `scaleX(${i < idx ? 1 : i === idx ? Math.max(0, Math.min(1, p)) : 0})`; });
    const go = (i, user) => { idx = (i + N) % N; pos.to(idx, { response: .6, damping: 1 }); t0 = performance.now(); if (user) { started = true; paused = false; } paint(0); };
    c.addEventListener('click', e => { const b = e.target.closest('[data-car], .car-dot'); if (!b) return; if (b.dataset.car === 'prev') go(idx - 1, true); else if (b.dataset.car === 'next') go(idx + 1, true); else go(+b.dataset.i, true); }, { signal });
    
    c.addEventListener('pointerleave', () => { if (!paused) return; paused = false; t0 += performance.now() - pauseAt; }, { signal });
    let sx = null; c.addEventListener('pointerdown', e => { if (e.target.closest('a,button')) return; sx = e.clientX; }, { signal });
    c.addEventListener('pointerup', e => { if (sx == null) return; const dx = e.clientX - sx; sx = null; if (Math.abs(dx) > 50) go(idx + (dx < 0 ? 1 : -1)); }, { signal });
    // the timer starts the first time the carousel scrolls into view
    const io = new IntersectionObserver(es => { if (es.some(e => e.isIntersecting) && !started) { started = true; t0 = performance.now(); io.disconnect(); } }, { threshold: .45 });
    io.observe(c); signal.addEventListener('abort', () => io.disconnect());
    const tick = now => { if (signal.aborted || !c.isConnected) return;
      if (started && !paused && !motion.reduce) { const p = (now - t0) / DUR; if (p >= 1) go(idx + 1); else paint(p); }
      requestAnimationFrame(tick); };
    paint(0); requestAnimationFrame(tick);
  }

  /* ---------- About: ring and strip fill in when they come into view ---------- */
  function fillIns(root, signal) {
    // homepage streak card: squares fill in and the day count climbs
    $$('[data-streak-anim]', root).forEach(card => {
      const num = $('.rv-top b', card), cells = $$('.rv-strip i', card), bar = $('.rv-bar i', card), target = cells.filter(c => c.classList.contains('c')).length;
      cells.forEach(c => c.classList.add('pend')); if (bar) bar.style.width = '0%';
      const run = () => { cells.forEach((c, k) => { c.style.transitionDelay = (k * 70) + 'ms'; c.classList.remove('pend'); });
        new Spring(0, { eps: .0005 }).on(p => { num.textContent = Math.round(target * p); if (bar) bar.style.width = (40 * p) + '%'; }).to(1, { response: 1.4, damping: 1 }); };
      const io = new IntersectionObserver(es => { if (es.some(e => e.isIntersecting)) { run(); io.disconnect(); } }, { threshold: .5 });
      io.observe(card); signal.addEventListener('abort', () => io.disconnect());
    });
    // community: avatars slide in and the member count climbs
    $$('[data-crowd]', root).forEach(cw => {
      const n = $('[data-count-to]', cw), to = +n.dataset.countTo; cw.classList.add('go');
      new Spring(0, { eps: .0005 }).on(p => { n.textContent = Math.round(to * p) + 'k'; }).to(1, { response: .9, damping: 1 });
    });
    const els = $$('[data-ring-anim], [data-strip-anim]', root); if (!els.length) return;
    const run = el => {
      if (el.hasAttribute('data-ring-anim')) { const to = +el.dataset.ringAnim, num = +el.dataset.num, sp = $('span', el);
        new Spring(0, { eps: .0005 }).on(p => { el.style.setProperty('--p', (to * p) + '%'); sp.textContent = Math.round(num * p); }).to(1, { response: 1.6, damping: 1 }); }
      else $$('i', el).forEach((i, k) => { i.style.transitionDelay = (k * 45) + 'ms'; i.classList.add('in'); });
    };
    const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { run(e.target); io.unobserve(e.target); } }), { threshold: .5 });
    els.forEach(el => io.observe(el)); signal.addEventListener('abort', () => io.disconnect());
    $$('[data-strip-anim]', root).forEach(el => el.closest('.b').addEventListener('pointerenter', () => { $$('i', el).forEach((i, k) => { i.classList.remove('in'); i.style.transitionDelay = '0ms'; }); void el.offsetWidth; run(el); }, { signal }));
  }

  RR.site = { mountShell, updateNav, enhance };
})();
