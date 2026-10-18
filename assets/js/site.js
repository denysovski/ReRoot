/* Re:Root public site — nav, footer, mobile menu, reveal, word fill, 3D calendar, splash. */
(function () {
  const { $, $$, Spring, theme, auth, menu, glass, motion, clamp, addDays, key, fmt } = RR;
  const page = document.body.dataset.page || '';
  const user = auth.current();

  const LINKS = [
    ['how-it-works.html', 'How it works', 'how'],
    ['showcase.html', 'Showcase', 'showcase'],
    ['community.html', 'Community', 'community'],
    ['articles.html', 'Articles', 'articles'],
    ['about.html', 'About', 'about'],
  ];
  const sun = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="4.5"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>';
  const moon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/></svg>';
  const cta = user
    ? `<a class="btn btn-primary btn-sm" data-press href="app.html">Open app</a>`
    : `<a class="login-link" href="login.html">Log in</a><a class="btn btn-primary btn-sm" data-press href="register.html">Get started</a>`;

  /* ---------- nav ---------- */
  const nav = $('#nav');
  if (nav) {
    nav.outerHTML = `<header class="nav" aria-label="Main">
      <a class="logo" href="index.html">RE<b>:</b>ROOT</a>
      <nav class="nav-links">${LINKS.map(([h, t, id]) => `<a href="${h}" ${page === id ? 'aria-current="page"' : ''}>${t}</a>`).join('')}</nav>
      <div class="nav-right">
        <button class="icon-btn" id="theme-btn" data-press aria-label="Switch theme"></button>
        ${cta}
        <button class="icon-btn burger" id="burger" data-press aria-label="Open menu"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 8h16M4 16h16"/></svg></button>
      </div>
    </header>
    <div class="mnav" id="mnav" hidden>
      ${LINKS.map(([h, t, id]) => `<a href="${h}" ${page === id ? 'aria-current="page"' : ''}>${t}</a>`).join('')}
      <div class="actions">${user ? `<a class="btn btn-primary btn-block" href="app.html">Open app</a>` : `<a class="btn btn-primary btn-block" href="register.html">Create free account</a><a class="btn-text" href="login.html">I already have an account</a>`}</div>
    </div>
    <div class="nav-space"></div>`;
    const tb = $('#theme-btn');
    const paint = () => { tb.innerHTML = theme.isDark() ? sun : moon; tb.setAttribute('aria-label', theme.isDark() ? 'Switch to light mode' : 'Switch to dark mode'); };
    paint(); tb.addEventListener('click', () => { theme.toggle(); paint(); });
    document.addEventListener('rr:theme', paint);
    menu($('#burger'), $('#mnav'), { origin: '50% 0' });
  }

  /* ---------- footer ---------- */
  const foot = $('#footer');
  if (foot) {
    const col = (h, items) => `<div class="f-col"><h4>${h}</h4>${items.map(([href, t]) => `<a href="${href}">${t}</a>`).join('')}</div>`;
    foot.outerHTML = `<footer class="footer"><div class="wrap">
      <div class="f-top">
        <div class="f-brand"><a class="logo" href="index.html" style="font-size:20px">RE<b>:</b>ROOT</a>
          <p>A calm, black-and-white tracker for quitting the habits that hold you back. Check in daily, see your patterns and get help when it's hard.</p>
          <div class="actions-row">${user ? '<a class="btn btn-primary btn-sm" data-press href="app.html">Open app</a>' : '<a class="btn btn-primary btn-sm" data-press href="register.html">Get started</a><a class="btn-text" href="login.html">Log in</a>'}</div>
        </div>
        ${col('Product', [['how-it-works.html', 'How it works'], ['showcase.html', 'Showcase'], ['articles.html', 'Articles'], ['community.html', 'Community chats']])}
        ${col('Company', [['about.html', 'About Re:Root'], ['faq.html', 'FAQ'], ['contact.html', 'Contact']])}
        ${col('Legal', [['terms.html', 'Terms & conditions'], ['privacy.html', 'Privacy policy'], ['terms.html#disclaimer', 'Medical disclaimer']])}
        ${col('Account', user ? [['app.html', 'Open app'], ['app.html#today', 'Today\'s check-in'], ['app.html#progress', 'Your progress']] : [['login.html', 'Log in'], ['register.html', 'Create account'], ['how-it-works.html#start', 'Getting started']])}
      </div>
      <p class="f-help">Re:Root is a self-tracking tool, not medical care. If a habit is harming your health or you can't stop despite trying, talk to a doctor or therapist. In a crisis, contact your local emergency number.</p>
      <div class="f-word" aria-hidden="true">RE:ROOT</div>
      <div class="f-bottom"><span>© 2026 Re:Root · Demo project. Accounts are simulated and stored only in your browser.</span><a class="btn-text" href="#top" onclick="window.scrollTo({top:0,behavior:'smooth'});return false">Back to top</a></div>
    </div></footer>`;
  }

  /* ---------- ambient light ---------- */
  if (!$('.ambient')) document.body.insertAdjacentHTML('afterbegin', '<div class="ambient" aria-hidden="true"><i></i><i></i><i></i></div>');
  glass();

  /* ---------- reveal on scroll (starts visible-but-dim, never hidden) ---------- */
  const io = 'IntersectionObserver' in window ? new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { rootMargin: '0px 0px -8% 0px' }) : null;
  $$('[data-reveal]').forEach((el, i) => { el.style.transitionDelay = (+el.dataset.reveal || 0) + 's'; io ? io.observe(el) : el.classList.add('in'); });

  /* ---------- word fill (no pinning — fills as it passes through the viewport) ---------- */
  $$('[data-fill]').forEach(el => {
    el.innerHTML = el.textContent.trim().split(/\s+/).map(w => `<span>${w}</span>`).join(' ');
    const words = $$('span', el);
    const frame = () => {
      const r = el.getBoundingClientRect(), vh = innerHeight;
      const p = motion.reduce ? 1 : clamp((vh * .9 - r.top) / (r.height + vh * .45));
      const n = words.length; words.forEach((w, i) => w.style.opacity = .16 + .84 * clamp(p * n - i));
    };
    addEventListener('scroll', frame, { passive: true }); addEventListener('resize', frame); frame();
  });

  /* ---------- 3D calendar ---------- */
  const cal = $('#cal3d');
  if (cal) {
    const now = new Date(), y = now.getFullYear(), m = now.getMonth(), today = now.getDate();
    const first = new Date(y, m, 1), lead = (first.getDay() + 6) % 7, days = new Date(y, m + 1, 0).getDate();
    const slipDay = Math.max(1, today - 24);
    let cells = '';
    for (let i = 0; i < lead; i++) cells += '<i class="d e"></i>';
    for (let d = 1; d <= days; d++) {
      const cls = d > today ? 'f' : d === today ? 't' : d === slipDay ? 'x' : 'c';
      cells += `<i class="d ${cls}" style="--i:${d}"><span>${d}</span></i>`;
    }
    const streak = today - slipDay;
    cal.innerHTML = `<div class="cal-scene" id="cal-scene">
      <div class="cal-plate back"></div>
      <div class="cal-plate glass">
        <div class="cal-head"><b>${fmt(now, { month: 'long' })}</b><span class="mono">${y}</span></div>
        <div class="cal-dow">${['M', 'T', 'W', 'T', 'F', 'S', 'S'].map(d => `<span>${d}</span>`).join('')}</div>
        <div class="cal-grid">${cells}</div>
      </div>
      <div class="cal-chip c1 glass"><span class="eyebrow">Current streak</span><b class="mono">${streak} days</b></div>
      <div class="cal-chip c2 glass"><span class="eyebrow">Today</span><b>Check in →</b></div>
      <div class="cal-chip c3 glass"><span class="eyebrow">Urge</span><b class="mono">2 / 5</b></div>
    </div>`;
    const scene = $('#cal-scene'), host = cal.closest('[data-tilt-host]') || cal;
    const rx = new Spring(0, { eps: .01 }), ry = new Spring(0, { eps: .01 });
    let t0 = performance.now(), idle = true;
    const paint = () => { scene.style.transform = `rotateX(${24 + rx.value}deg) rotateY(${-22 + ry.value}deg) rotateZ(4deg)`; };
    rx.on(paint); ry.on(paint); paint();
    host.addEventListener('pointermove', e => { if (e.pointerType === 'touch' || motion.reduce) return; idle = false;
      const r = host.getBoundingClientRect(), x = (e.clientX - r.left) / r.width - .5, yy = (e.clientY - r.top) / r.height - .5;
      rx.to(-yy * 16, { response: .7, damping: 1 }); ry.to(x * 22, { response: .7, damping: 1 }); });
    host.addEventListener('pointerleave', () => { idle = true; rx.to(0, { response: .9, damping: .75 }); ry.to(0, { response: .9, damping: .75 }); });
    // gentle idle float
    if (!motion.reduce) { const float = now => { if (idle && !rx.raf && !ry.raf) { const t = (now - t0) / 1000; scene.style.transform = `rotateX(${24 + Math.sin(t * .6) * 2.2}deg) rotateY(${-22 + Math.cos(t * .5) * 3}deg) rotateZ(4deg)`; } requestAnimationFrame(float); }; requestAnimationFrame(float); }
    requestAnimationFrame(() => cal.classList.add('built'));
  }

  /* ---------- splash once per session ---------- */
  const splash = $('#splash');
  let seen = false; try { seen = sessionStorage.getItem('reroot.splash') === '1'; sessionStorage.setItem('reroot.splash', '1'); } catch (e) {}
  if (splash && !seen && !motion.reduce) setTimeout(() => { splash.classList.add('out'); document.documentElement.classList.add('ready'); setTimeout(() => splash.remove(), 650); }, 900);
  else { splash && splash.remove(); document.documentElement.classList.add('ready'); }
})();
