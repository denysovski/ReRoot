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
        <div class="f-brand"><a class="logo" href="./" style="font-size:20px">RE<b>:</b>ROOT</a>
          <p>A calm, black-and-white tracker for quitting the habits that hold you back. Check in daily, see your patterns and get help when it's hard.</p>
          <div class="actions-row">${user ? '<a class="btn btn-primary btn-sm" data-press href="app">Open app</a>' : '<a class="btn btn-primary btn-sm" data-press href="register">Get started</a><a class="btn-text" href="login">Log in</a>'}</div></div>
        ${col('Product', [['how-it-works', 'How it works'], ['showcase', 'Showcase'], ['articles', 'Articles'], ['community', 'Community chats']])}
        ${col('Company', [['about', 'About Re:Root'], ['faq', 'FAQ'], ['contact', 'Contact']])}
        ${col('Legal', [['terms', 'Terms & conditions'], ['privacy', 'Privacy policy'], ['terms#disclaimer', 'Medical disclaimer']])}
        ${col('Account', user ? [['app', 'Open app'], ['app/today', 'Today\'s check-in'], ['app/progress', 'Your progress']] : [['login', 'Log in'], ['register', 'Create account'], ['how-it-works', 'Getting started']])}
      </div>
      <p class="f-help">Re:Root is a self-tracking tool, not medical care. If a habit is harming your health or you can't stop despite trying, talk to a doctor or therapist. In a crisis, contact your local emergency number.</p>
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
  }
  function updateNav(id) { $$('.nav-links a, .mnav a[data-id]').forEach(a => a.dataset.id === id ? a.setAttribute('aria-current', 'page') : a.removeAttribute('aria-current')); }

  /* ---------- generic 3D scene: tilts toward the pointer, floats when idle ---------- */
  function scene(host, sc, base, signal) {
    const rx = new Spring(0, { eps: .01 }), ry = new Spring(0, { eps: .01 }); let idle = true; const t0 = performance.now();
    const paint = (ax = 0, ay = 0) => { sc.style.transform = `${base} rotateX(${rx.value + ax}deg) rotateY(${ry.value + ay}deg)`; };
    rx.on(() => paint()); ry.on(() => paint()); paint();
    host.addEventListener('pointermove', e => { if (e.pointerType === 'touch' || motion.reduce) return; idle = false;
      const r = host.getBoundingClientRect(), x = (e.clientX - r.left) / r.width - .5, y = (e.clientY - r.top) / r.height - .5;
      rx.to(-y * 14, { response: .7, damping: 1 }); ry.to(x * 20, { response: .7, damping: 1 }); }, { signal });
    host.addEventListener('pointerleave', () => { idle = true; rx.to(0, { response: .9, damping: .75 }); ry.to(0, { response: .9, damping: .75 }); }, { signal });
    if (!motion.reduce) {
      const off = Math.random() * 10;
      const float = now => { if (signal.aborted || !sc.isConnected) return;
        if (idle && !rx.raf && !ry.raf) { const t = (now - t0) / 1000 + off; paint(Math.sin(t * .6) * 2, Math.cos(t * .5) * 3); }
        requestAnimationFrame(float); };
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
    const io = 'IntersectionObserver' in window ? new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { rootMargin: '0px 0px -8% 0px' }) : null;
    $$('[data-reveal]', root).forEach(el => { el.style.transitionDelay = (+el.dataset.reveal || 0) + 's'; io ? io.observe(el) : el.classList.add('in'); });
    signal.addEventListener('abort', () => io && io.disconnect());
    $$('[data-fill]', root).forEach(el => {
      el.innerHTML = el.textContent.trim().split(/\s+/).map(w => `<span>${w}</span>`).join(' ');
      const words = $$('span', el);
      const frame = () => { const r = el.getBoundingClientRect(), vh = innerHeight, p = motion.reduce ? 1 : clamp((vh * .9 - r.top) / (r.height + vh * .45));
        words.forEach((w, i) => w.style.opacity = .16 + .84 * clamp(p * words.length - i)); };
      addEventListener('scroll', frame, { passive: true, signal }); addEventListener('resize', frame, { signal }); frame();
    });
    $$('[data-scene]', root).forEach(h => scene(h, $('.scene', h), h.dataset.scene, signal));
    const cal = $('#cal3d', root); cal && calendar(cal, signal);
  }

  RR.site = { mountShell, updateNav, enhance };
})();
