/* Re:Root router — one page, clean URLs (/about, /articles/urge, /app/today), works on GitHub Pages via 404.html. */
(function () {
  const { $, auth, motion, Spring, closeAll } = RR;
  const BASE = new URL(document.baseURI).pathname;          // "/" locally, "/ReRoot/" on GitHub Pages
  const ROUTES = [
    ['', 'home', 'site'], ['how-it-works', 'how', 'site'], ['showcase', 'showcase', 'site'], ['community', 'community', 'site'],
    ['articles', 'articles', 'site'], ['articles/:id', 'article', 'site'], ['about', 'about', 'site'], ['faq', 'faq', 'site'],
    ['contact', 'contact', 'site'], ['terms', 'terms', 'site'], ['privacy', 'privacy', 'site'],
    ['login', 'login', 'site', { guest: true }], ['register', 'register', 'site', { guest: true }],
    ['onboarding', 'onboarding', 'bare', { auth: true }],
    ['app', 'app', 'app', { auth: true }], ['app/:tab', 'app', 'app', { auth: true }],
  ];
  const rel = p => (p.startsWith(BASE) ? p.slice(BASE.length) : p.replace(/^\//, '')).replace(/\/+$/, '').replace(/\.html$/, '').replace(/^index$/, '');
  function match(path) {
    const xs = path === '' ? [''] : path.split('/');
    for (const [pat, view, layout, opt = {}] of ROUTES) {
      const ps = pat === '' ? [''] : pat.split('/'); if (ps.length !== xs.length) continue;
      const params = {}; let ok = true;
      ps.forEach((s, i) => { if (s[0] === ':') params[s.slice(1)] = decodeURIComponent(xs[i]); else if (s !== xs[i]) ok = false; });
      if (ok) return { view, layout, opt, params };
    }
    return { view: '404', layout: 'site', opt: {}, params: {} };
  }

  let cur = { layout: null, ctrl: null, app: null };
  const fade = new Spring(1, { eps: .001 }); let fadeEl = null;
  fade.on(p => { if (!fadeEl) return; fadeEl.style.opacity = p; fadeEl.style.transform = p >= 1 ? '' : `translateY(${(1 - p) * 16}px)`; fadeEl.style.filter = p >= .999 || motion.reduce ? '' : `blur(${(1 - p) * 8}px)`; });
  const enter = el => { fadeEl = el; fade.set(0); fade.to(1, { response: .45, damping: 1 }); };

  function render() {
    const u = new URL(location.href), m = match(rel(u.pathname)), user = auth.current();
    if (m.opt.auth && !user) return navigate('login', { replace: true });
    if (m.opt.guest && user) return navigate(user.prefs.onboarded ? 'app/today' : 'onboarding', { replace: true });
    if (m.view === 'app' && !user.prefs.onboarded) return navigate('onboarding', { replace: true });
    const V = window.RR_VIEWS[m.view];
    document.title = V.title ? `${V.title} · Re:Root` : 'Re:Root · Take control of your habits';

    if (m.layout === 'app' && cur.layout === 'app' && cur.app) { cur.app.go(m.params.tab || 'home', { fromRouter: true }); return; }
    if (cur.ctrl) cur.ctrl.abort();
    cur.ctrl = new AbortController(); const signal = cur.ctrl.signal;
    closeAll(); document.body.style.overflow = '';
    const L = $('#layout'); document.body.dataset.layout = m.layout;

    if (m.layout === 'site') {
      if (cur.layout !== 'site' || cur.user !== (user && user.email)) RR.site.mountShell(L);
      RR.site.updateNav(m.view);
      const main = $('#view'); main.innerHTML = V.html; main.dataset.view = m.view;
      RR.site.enhance(main, signal);
      RR.pages[m.view] && RR.pages[m.view](main, m.params, signal);
      enter(main);
    } else if (m.layout === 'bare') {
      L.innerHTML = V.html; RR.mountOnboarding(L, signal); enter(L);
    } else {
      L.innerHTML = V.html; cur.app = RR.mountApp(L, signal, m.params.tab || 'home'); enter($('.app-main', L));
    }
    if (m.layout !== 'app') cur.app = null;
    cur.layout = m.layout; cur.user = user && user.email;
    const target = u.hash && document.getElementById(u.hash.slice(1));
    if (RR.lenis) { RR.lenis.resize(); RR.lenis.scrollTo(target || 0, { immediate: true, force: true }); } else target ? target.scrollIntoView() : scrollTo(0, 0);
  }

  function navigate(path, { replace = false } = {}) {
    history[replace ? 'replaceState' : 'pushState'](null, '', BASE + String(path).replace(/^\//, ''));
    render();
  }
  RR.navigate = navigate;
  RR.pushPath = path => { const url = BASE + path; if (location.pathname + location.search !== url) history.pushState(null, '', url); };
  addEventListener('popstate', render);

  // intercept internal links
  document.addEventListener('click', e => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const a = e.target.closest('a[href]'); if (!a || a.target || a.hasAttribute('download')) return;
    const url = new URL(a.href, document.baseURI);
    if (url.origin !== location.origin || !url.pathname.startsWith(BASE) || /\.[a-z0-9]+$/i.test(url.pathname) && !/\.html$/.test(url.pathname)) return;
    e.preventDefault();
    const path = rel(url.pathname) + url.search + url.hash;
    if (url.pathname === location.pathname && url.hash) { const t = document.getElementById(url.hash.slice(1)); t && (RR.lenis ? RR.lenis.scrollTo(t, { offset: -90, duration: 1.2 }) : t.scrollIntoView({ behavior: motion.reduce ? 'auto' : 'smooth' })); history.replaceState(null, '', url); return; }
    navigate(path);
  });

  // smooth, weighted scrolling (Lenis); native scrolling stays for reduced motion and touch
  if (window.Lenis && !motion.reduce) {
    const lenis = new Lenis({ lerp: .085, smoothWheel: true, wheelMultiplier: 1, touchMultiplier: 1.4 });
    RR.lenis = lenis;
    const loop = t => { lenis.raf(t); requestAnimationFrame(loop); }; requestAnimationFrame(loop);
    new ResizeObserver(() => lenis.resize()).observe(document.body);
  }

  // restore a deep link that GitHub Pages sent through 404.html
  try { const r = sessionStorage.getItem('reroot.redirect'); if (r) { sessionStorage.removeItem('reroot.redirect'); history.replaceState(null, '', r); } } catch (e) {}
  render();

  // splash once per session
  const splash = $('#splash'); let seen = false;
  try { seen = sessionStorage.getItem('reroot.splash') === '1'; sessionStorage.setItem('reroot.splash', '1'); } catch (e) {}
  if (splash && !seen && !motion.reduce) setTimeout(() => { splash.classList.add('out'); document.documentElement.classList.add('ready'); setTimeout(() => splash.remove(), 650); }, 850);
  else { splash && splash.remove(); document.documentElement.classList.add('ready'); }
})();
