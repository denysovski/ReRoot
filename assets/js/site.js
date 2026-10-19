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
    return `<header class="nav" aria-label="Main">
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
        ${col('Product', [['how-it-works', 'How it works'], ['showcase', 'Showcase'], ['articles', 'Articles'], ['community', 'Community chats']])}
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

  function enhance(root, signal) {
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
      return { el, mode, p: -1 };
    });
    const ease = t => 1 - Math.pow(1 - t, 3);
    const apply = it => {
      const r = it.el.getBoundingClientRect(), vh = innerHeight;
      const raw = motion.reduce ? 1 : clamp((vh - r.top) / (vh * .45));
      if (Math.abs(raw - it.p) < .002) return; it.p = raw;
      const q = 1 - ease(raw), s = it.el.style;
      if (raw >= 1) { s.translate = ''; s.rotate = ''; s.scale = ''; s.opacity = ''; s.filter = ''; return; }
      const narrow = innerWidth < 700, side = narrow ? 60 : 160;
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
    const track = $('.car-track', c), slides = $$('.car-slide', c), dots = $('.car-dots', c), N = slides.length, DUR = 7000, C = 2 * Math.PI * 9;
    dots.innerHTML = slides.map((_, i) => `<button class="car-dot" data-i="${i}" aria-label="Show slide ${i + 1}"><svg viewBox="0 0 24 24"><circle class="t" cx="12" cy="12" r="9"/><circle class="a" cx="12" cy="12" r="9" stroke-dasharray="${C}" stroke-dashoffset="${C}"/></svg></button>`).join('');
    const pos = new Spring(0, { eps: .0005 }); let idx = 0, t0 = 0, started = false, paused = false, pauseAt = 0;
    pos.on(v => { track.style.transform = `translateX(${-v * 100}%)`; slides.forEach((sl, i) => { const d = Math.abs(i - v); sl.style.opacity = Math.max(0, 1 - d * 1.2); sl.style.filter = d > .02 && !motion.reduce ? `blur(${Math.min(8, d * 10)}px)` : ''; }); });
    pos.set(0);
    const paint = p => $$('.car-dot', c).forEach((d, i) => { d.classList.toggle('on', i === idx); d.querySelector('.a').style.strokeDashoffset = C * (1 - (i === idx ? p : 0)); });
    const go = i => { idx = (i + N) % N; pos.to(idx, { response: .6, damping: 1 }); t0 = performance.now(); paint(0); };
    c.addEventListener('click', e => { const b = e.target.closest('[data-car], .car-dot'); if (!b) return; if (b.dataset.car === 'prev') go(idx - 1); else if (b.dataset.car === 'next') go(idx + 1); else go(+b.dataset.i); }, { signal });
    c.addEventListener('pointerenter', () => { paused = true; pauseAt = performance.now(); }, { signal });
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
