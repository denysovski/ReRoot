/* Re:Root app — logged-in experience. */
RR.mountApp = function (layoutRoot, signal, initialTab) {
  const { $, $$, esc, clamp, Spring, tracker, project, rubber, theme, auth, menu, toast, motion, key, addDays, fromKey, fmt, tzGuess, closeAll } = RR;
  const glass = () => {}; // no hover tilt or spotlight inside the app
  let user = auth.current(); if (!user) return;
  // animated plasma behind the dashboard (dark and light variants follow the theme)
  const pbg = document.createElement('div'); pbg.className = 'plasma-bg'; pbg.setAttribute('aria-hidden', 'true'); layoutRoot.prepend(pbg);
  const plasma = RR.plasma ? RR.plasma(pbg, { lightMode: !theme.isDark(), opacity: .85, quality: .6 }) : null;
  const plasmaTheme = () => { if (!plasma) return; plasma.cfg.lightMode = !theme.isDark(); plasma.update(); };
  document.addEventListener('rr:theme', plasmaTheme, { signal });
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', plasmaTheme, { signal });
  signal.addEventListener('abort', () => { plasma && plasma.destroy(); pbg.remove(); });
  let S = RRStore.load(user.email);
  const save = () => RRStore.save(user.email, S);
  const tz = () => user.prefs.tz || tzGuess();
  const now = () => { try { return new Date(new Date().toLocaleString('en-US', { timeZone: tz() })); } catch (e) { return new Date(); } };
  const todayKey = () => key(now());
  const MILES = [1, 3, 7, 14, 30, 60, 90, 180, 365];
  const buzz = () => { try { navigator.vibrate && navigator.vibrate(8); } catch (e) {} };

  /* ---------- data helpers ---------- */
  const getLog = (id, k) => (S.logs[k] || {})[id];
  function setLog(id, k, patch) { S.logs[k] = S.logs[k] || {}; const n = { ...(S.logs[k][id] || {}), ...patch }; if (!n.s) delete n.s; if (n.u == null) delete n.u; if (!n.s && n.u == null) delete S.logs[k][id]; else S.logs[k][id] = n; save(); }
  function currentStreak(h) {
    let d = now(), n = 0; const t = getLog(h.id, key(d));
    if (t && t.s === 'x') return 0; if (t && t.s === 'c') n = 1;
    d = addDays(d, -1);
    for (;;) { const k = key(d); if (k < h.start) break; const l = getLog(h.id, k); if (l && l.s === 'c') { n++; d = addDays(d, -1); } else break; }
    return n;
  }
  function daySeries(h, days) {
    const tk = todayKey(), startShow = key(addDays(now(), -(days - 1))), map = {}; let run = 0, d = fromKey(h.start);
    while (key(d) <= tk) { const k = key(d), l = getLog(h.id, k);
      if (l && l.s === 'c') run++; else if (l && l.s === 'x') run = 0; else if (k !== tk) run = 0;
      map[k] = run; d = addDays(d, 1); }
    return Array.from({ length: days }, (_, i) => { const k = key(addDays(fromKey(startShow), i)); return { k, v: map[k] || 0 }; });
  }
  function longest(h) { let best = 0, run = 0, d = fromKey(h.start); const tk = todayKey();
    while (key(d) <= tk) { const l = getLog(h.id, key(d)); if (l && l.s === 'c') { run++; best = Math.max(best, run); } else if (key(d) !== tk) run = 0; d = addDays(d, 1); } return best; }
  function rate(h, days) { let c = 0, n = 0; for (let i = 0; i < days; i++) { const k = key(addDays(now(), -i)); if (k < h.start) break; const l = getLog(h.id, k); if (l && l.s) { n++; if (l.s === 'c') c++; } } return n ? Math.round(c / n * 100) : 0; }
  function avgUrge(h, days) { let s = 0, n = 0; for (let i = 0; i < days; i++) { const l = getLog(h.id, key(addDays(now(), -i))); if (l && l.u != null) { s += l.u; n++; } } return n ? s / n : null; }
  const nextMile = n => MILES.find(m => m > n) || null;

  /* ---------- rings & count-up ---------- */
  const RC = 2 * Math.PI * 26, prevRing = {};
  const ringSVG = (id, frac, n, size = 'sm') => `<div class="ring" data-ring="${id}-${size}" data-to="${frac}" data-n="${n}"><svg viewBox="0 0 64 64"><circle class="trk" cx="32" cy="32" r="26" fill="none" stroke-width="6"/><circle class="arc" cx="32" cy="32" r="26" fill="none" stroke-width="6" stroke-dasharray="${RC}" stroke-dashoffset="${RC}"/></svg><b>0</b></div>`;
  function animateRings(root) {
    $$('[data-ring]', root).forEach(el => {
      const id = el.dataset.ring, to = +el.dataset.to, n = +el.dataset.n, from = prevRing[id] || { f: 0, n: 0 }, arc = $('.arc', el), b = $('b', el);
      new Spring(0, { eps: .0005 }).on(q => { const p = clamp(q, 0, 1.05); arc.style.strokeDashoffset = RC * (1 - (from.f + (to - from.f) * p)); b.textContent = Math.round(from.n + (n - from.n) * Math.min(p, 1)); }).to(1, { response: .7, damping: 1 });
      prevRing[id] = { f: to, n };
    });
  }
  const countUp = (el, to) => new Spring(0, { eps: .001 }).on(p => el.textContent = Math.round(to * clamp(p, 0, 1))).to(1, { response: 1, damping: 1 });

  /* ---------- corner menus ---------- */
  const acct = menu($('#acct-btn'), $('#acct-menu'), { origin: 'top right' });
  function paintAcct() {
    user = auth.current();
    $('#m-name').textContent = user.name; $('#m-email').textContent = user.email;
    $$('#m-theme button').forEach(b => b.setAttribute('aria-pressed', b.dataset.t === theme.get()));
    $('#m-notif').setAttribute('aria-checked', !!user.prefs.notif);
  }
  const zones = (() => { try { return Intl.supportedValuesOf('timeZone'); } catch (e) { return ['UTC', 'Europe/London', 'Europe/Prague', 'Europe/Berlin', 'America/New_York', 'America/Los_Angeles', 'Asia/Tokyo', 'Australia/Sydney']; } })();
  if (!zones.includes(tz())) zones.unshift(tz());
  /* ---------- custom dropdowns: a list (with optional search) or an hour : minute picker ---------- */
  const CHEV = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>';
  function ddHTML(id, val, opts, o = {}) {
    const cur = opts.find(x => x[0] === val) || opts[0];
    return `<div class="dd" data-dd><button type="button" class="dd-btn" aria-haspopup="listbox" aria-expanded="false"><span class="dd-v">${esc(cur[1])}</span>${CHEV}</button>
      <div class="dd-pop"><div class="dd-in">${o.search ? `<input class="dd-q" type="search" placeholder="${o.search}" autocomplete="off" aria-label="${o.search}">` : ''}
      <ul class="dd-list" role="listbox" data-lenis-prevent>${opts.map(([v, l]) => `<li role="option" data-v="${esc(v)}" aria-selected="${v === cur[0]}">${esc(l)}</li>`).join('')}</ul></div></div>
      <input type="hidden" id="${id}" value="${esc(cur[0])}"></div>`;
  }
  function timeDD(id, val) {
    const [hh, mm] = (val || '20:00').split(':'), two = n => String(n).padStart(2, '0');
    const col = (c, list, sel) => `<ul class="dd-list" data-col="${c}" role="listbox" aria-label="${c === 'h' ? 'Hour' : 'Minute'}" data-lenis-prevent>${list.map(v => `<li role="option" data-v="${v}" aria-selected="${v === sel}">${v}</li>`).join('')}</ul>`;
    return `<div class="dd dd-time" data-dd><button type="button" class="dd-btn" aria-haspopup="listbox" aria-expanded="false"><span class="dd-v mono">${hh}:${mm}</span>${CHEV}</button>
      <div class="dd-pop"><div class="dd-in"><div class="dd-cols">${col('h', Array.from({ length: 24 }, (_, i) => two(i)), hh)}<span class="dd-colon">:</span>${col('m', Array.from({ length: 12 }, (_, i) => two(i * 5)), mm)}</div></div></div>
      <input type="hidden" id="${id}" value="${hh}:${mm}"></div>`;
  }
  function openDD(dd, on) {
    dd.classList.toggle('open', on); $('.dd-btn', dd).setAttribute('aria-expanded', on); if (!on) return;
    requestAnimationFrame(() => $$('li[aria-selected="true"]', dd).forEach(li => { const ul = li.parentElement; ul.scrollTop = li.offsetTop - ul.clientHeight / 2 + li.offsetHeight / 2; }));
    const q = $('.dd-q', dd); if (q) { q.value = ''; $$('li', dd).forEach(li => li.hidden = false); setTimeout(() => q.focus({ preventScroll: true }), 250); }
  }
  document.addEventListener('click', e => {
    const dd = e.target.closest('[data-dd]'); $$('.dd.open').forEach(d => d !== dd && openDD(d, false)); if (!dd) return;
    if (e.target.closest('.dd-btn')) { openDD(dd, !dd.classList.contains('open')); return; }
    const li = e.target.closest('li[data-v]'); if (!li) return;
    const inp = $('input[type="hidden"]', dd), ul = li.parentElement;
    $$('li', ul).forEach(x => x.setAttribute('aria-selected', x === li));
    if (dd.classList.contains('dd-time')) { const h = $('[data-col="h"] [aria-selected="true"]', dd), m = $('[data-col="m"] [aria-selected="true"]', dd);
      inp.value = `${h ? h.dataset.v : '20'}:${m ? m.dataset.v : '00'}`; if (ul.dataset.col === 'm') openDD(dd, false); }
    else { inp.value = li.dataset.v; openDD(dd, false); }
    $('.dd-v', dd).textContent = dd.classList.contains('dd-time') ? inp.value : li.textContent;
    inp.dispatchEvent(new Event('change'));
  }, { signal, capture: true });
  document.addEventListener('input', e => { if (!e.target.matches('.dd-q')) return; const q = e.target.value.trim().toLowerCase(); $$('li', e.target.closest('.dd')).forEach(li => li.hidden = !!q && !li.textContent.toLowerCase().includes(q)); }, { signal });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') $$('.dd.open').forEach(d => openDD(d, false)); }, { signal });
  $('#tz-dd').innerHTML = ddHTML('m-tz', tz(), zones.map(z => [z, z.replace(/_/g, ' ')]), { search: 'Search city or region' });
  $('#time-dd').innerHTML = timeDD('m-time', user.prefs.reminder || '20:00');
  $('#m-tz').addEventListener('change', e => { user = auth.update({ prefs: { tz: e.target.value } }); toast(`Timezone set to ${e.target.value.replace(/_/g, ' ')}`); RENDER[view](); scheduleReminder(); });
  $('#m-theme').addEventListener('click', e => { const b = e.target.closest('[data-t]'); if (!b) return; theme.set(b.dataset.t); paintAcct(); RENDER[view](); });
  $('#m-notif').addEventListener('click', async () => {
    const on = !user.prefs.notif;
    if (on) {
      if (!('Notification' in window)) { toast('This browser doesn\'t support notifications.'); return; }
      let p = Notification.permission; try { if (p === 'default') p = await Notification.requestPermission(); } catch (e) { p = 'denied'; }
      if (p !== 'granted') { toast('Notifications are blocked in your browser settings.'); return; }
      try { new Notification('Re:Root reminders are on', { body: `We'll nudge you at ${user.prefs.reminder || '20:00'}.`, icon: 'assets/img/icon.svg' }); } catch (e) {}
    }
    user = auth.update({ prefs: { notif: on } }); paintAcct(); scheduleReminder(); toast(on ? 'Daily reminder on' : 'Daily reminder off');
  });
  $('#m-time').addEventListener('change', e => { user = auth.update({ prefs: { reminder: e.target.value || '20:00' } }); scheduleReminder(); toast(`Reminder set for ${e.target.value}`); });
  // test data: keeps your habits (or adds three) and fills months of random history before today
  $('#m-random').addEventListener('click', () => {
    if (!S.habits.length) [['Nail biting', 90], ['Phone in bed', 30], ['Sugar', 60]].forEach(([name, goal]) => S.habits.push({ id: RRStore.uid(), name, goal, start: todayKey() }));
    S.habits.forEach(h => {
      const back = 180 + Math.floor(Math.random() * 240), streak = 3 + Math.floor(Math.random() * 40), p = .18 + Math.random() * .25;
      for (const k in S.logs) delete S.logs[k][h.id];
      for (let i = back; i >= 1; i--) {
        const k = key(addDays(now(), -i)); if (Math.random() < .04 && i > streak) continue;
        const s = i <= streak ? 'c' : i === streak + 1 ? 'x' : Math.random() < p * Math.min(1, i / back + .25) ? 'x' : 'c';
        const u = s === 'x' ? 3 + Math.round(Math.random() * 2) : Math.max(0, Math.round(Math.random() * 3 * (i / back) + Math.random() * 1.4 - (i <= streak ? .5 : 0)));
        (S.logs[k] = S.logs[k] || {})[h.id] = { s, u: Math.min(5, u) };
      }
      h.start = key(addDays(now(), -back));
    });
    S.example = false; S.sel = S.habits[0].id; save(); for (const k in prevRing) delete prevRing[k]; acct.hide(); RENDER[view](); toast('Random history added');
  });
  $('#m-reset').addEventListener('click', () => { $('#m-reset-confirm').hidden = false; $('#m-reset').hidden = true; });
  $('#m-reset-no').addEventListener('click', () => { $('#m-reset-confirm').hidden = true; $('#m-reset').hidden = false; });
  $('#m-reset-yes').addEventListener('click', () => { S = RRStore.blank(); save(); for (const k in prevRing) delete prevRing[k]; $('#m-reset-confirm').hidden = true; $('#m-reset').hidden = false; acct.hide(); RENDER[view](); toast('All check-ins deleted'); });
  $('#m-logout').addEventListener('click', () => { auth.logout(); RR.navigate(''); });
  paintAcct();
  $$('.mtoggle').forEach(t => t.addEventListener('click', () => { const sub = $('#' + t.dataset.mt), on = !sub.classList.contains('open'); sub.classList.toggle('open', on); t.setAttribute('aria-expanded', on); }));

  /* ---------- reminder while the app is open (simulated scheduling) ---------- */
  let remT = 0;
  function scheduleReminder() {
    clearTimeout(remT); if (!user.prefs.notif || !('Notification' in window) || Notification.permission !== 'granted') return;
    const [hh, mm] = (user.prefs.reminder || '20:00').split(':').map(Number), n = now(), at = new Date(n); at.setHours(hh, mm, 0, 0);
    let ms = at - n; if (ms < 0) ms += 864e5;
    remT = setTimeout(() => {
      const left = S.habits.filter(h => !(getLog(h.id, todayKey()) || {}).s).length;
      if (left) try { new Notification('Time to check in', { body: `${left} habit${left > 1 ? 's' : ''} waiting for today's check-in.`, icon: 'assets/img/icon.svg' }); } catch (e) {}
      scheduleReminder();
    }, Math.min(ms, 2147483000));
  }
  scheduleReminder();

  /* ---------- navigation ---------- */
  const VIEWS = ['home', 'today', 'progress', 'goals', 'read'];
  let view = null;
  const indX = new Spring(0, { eps: .05 }), indW = new Spring(0, { eps: .05 }), ind = $('#tab-ind');
  const paintInd = () => { ind.style.transform = `translateX(${indX.value}px)`; ind.style.width = indW.value + 'px'; };
  indX.on(paintInd); indW.on(paintInd);
  function placeInd(instant) { const b = $(`.tab[data-nav="${view}"]`); if (!b) return; indX.to(b.offsetLeft, { response: .38, damping: .86, instant }); indW.to(b.offsetWidth, { response: .38, damping: 1, instant }); }
  const viewP = new Spring(1, { eps: .001 }); let incoming = null;
  // tabs slide like pages: the old view leaves to one side while the new one comes in from the other
  let outgoing = null, slideDir = 1;
  const resetOut = () => { if (!outgoing) return; outgoing.hidden = true; Object.assign(outgoing.style, { position: '', top: '', left: '', right: '', transform: '' }); outgoing = null; };
  // time-based slide with a long, soft ease-out so it settles without a jolt at the end
  let slideRaf = 0;
  const easeOut = t => 1 - Math.pow(1 - t, 5);
  function paintSlide(p) {
    const W = innerWidth * .9;
    if (incoming) incoming.style.transform = p >= 1 ? '' : `translate3d(${(slideDir * (1 - p) * W).toFixed(2)}px,0,0)`;
    if (outgoing) { if (p >= 1) resetOut(); else outgoing.style.transform = `translate3d(${(-slideDir * p * W).toFixed(2)}px,0,0)`; }
  }
  function runSlide() {
    cancelAnimationFrame(slideRaf); const t0 = performance.now(), D = 820;
    const step = n => { const t = Math.min(1, Math.max(0, (n - t0) / D)); paintSlide(t >= 1 ? 1 : easeOut(t)); if (t < 1) slideRaf = requestAnimationFrame(step); };
    paintSlide(0); slideRaf = requestAnimationFrame(step);
  }
  const RENDER = { home: renderHome, today: renderToday, progress: renderProgress, goals: renderGoals, read: renderRead };
  function go(v, { instant, fromRouter } = {}) {
    if (!VIEWS.includes(v)) v = 'home';
    const changed = v !== view; view = v;
    $$('.tab').forEach(t => t.removeAttribute('aria-current')); $(`.tab[data-nav="${v}"]`).setAttribute('aria-current', 'page');
    requestAnimationFrame(() => placeInd(instant));
    const prevEl = incoming, slide = changed && !instant && !motion.reduce && prevEl && !prevEl.hidden;
    cancelAnimationFrame(slideRaf); resetOut(); if (incoming) incoming.style.transform = '';
    const scr = prevEl ? prevEl.getBoundingClientRect().top : 0;
    if (slide) slideDir = VIEWS.indexOf(v) > VIEWS.indexOf(prevEl.dataset.view) ? 1 : -1;
    $$('.view').forEach(s => s.hidden = s.dataset.view !== v && !(slide && s === prevEl));
    incoming = $(`.view[data-view="${v}"]`); RENDER[v]();
    if (changed) {
      RR.lenis ? RR.lenis.scrollTo(0, { immediate: true, force: true }) : window.scrollTo(0, 0);
      if (slide) { const main = $('.app-main'); outgoing = prevEl;
        Object.assign(outgoing.style, { position: 'absolute', left: '0', right: '0', top: (scr - main.getBoundingClientRect().top) + 'px' });
        runSlide(); }
      else { cancelAnimationFrame(slideRaf); paintSlide(1); }
    }
    if (!fromRouter) RR.pushPath(v === 'home' ? 'app' : 'app/' + v);
    document.title = (v === 'home' ? 'Home' : v[0].toUpperCase() + v.slice(1)) + ' · Re:Root';
  }
  document.addEventListener('click', e => { const n = e.target.closest('[data-nav]'); if (n) { e.preventDefault(); go(n.dataset.nav); } }, { signal });
  addEventListener('resize', () => placeInd(true), { signal });

  const exampleBanner = () => S.example ? `<div class="glass banner"><span>You're looking at example history so the charts have something to show.</span><button class="btn-text" data-act="clear-examples">Clear examples and start fresh</button></div>` : '';
  const emptyState = () => `<div class="glass empty"><h3>What do you want to quit?</h3><p>Add a habit like nail biting, late-night scrolling or anything else you want to stop. Then check in once a day.</p><div class="actions-row"><button class="btn btn-primary" data-press data-act="add">Add your first habit</button><a class="btn-text" href="how-it-works">How Re:Root works</a></div></div>`;
  const greet = () => { const h = now().getHours(); return h < 5 ? 'Still up' : h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening'; };

  /* ---------- HOME: overview, filtered by habit and time range ---------- */
  let homeHabit = 'all', homeRange = 30, clockT = 0;
  const RANGES = [[7, '7 days'], [30, '1 month'], [90, '3 months'], [180, '6 months'], [270, '9 months'], [365, '1 year'], ['all', 'All time']];
  const ord = n => n + (n % 100 > 10 && n % 100 < 14 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] || 'th');
  const CHECK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';
  const rangeSeg = (act, cur) => `<div class="seg rng" role="group" aria-label="Time range"><span class="thumb" aria-hidden="true"></span>${RANGES.map(([v, l]) => `<button data-act="${act}" data-r="${v}" aria-pressed="${v === cur}">${l}</button>`).join('')}</div>`;
  // the white thumb slides to the chosen range
  function placeThumb(seg, anim) {
    const b = $('[aria-pressed="true"]', seg), t = $('.thumb', seg); if (!b || !t) return;
    if (!b.offsetWidth) { (anim || 0) < 30 && requestAnimationFrame(() => placeThumb(seg, false)); return; }
    t.style.transition = anim && !motion.reduce ? '' : 'none';
    Object.assign(t.style, { width: b.offsetWidth + 'px', height: b.offsetHeight + 'px', transform: `translate(${b.offsetLeft}px, ${b.offsetTop}px)` });
  }
  const daysSince = start => Math.max(1, Math.round((fromKey(todayKey()) - fromKey(start)) / 864e5) + 1);
  addEventListener('resize', () => $$('.app-main .seg.rng').forEach(sg => placeThumb(sg, false)), { signal });
  function pressIn(group, btn) { $$('[aria-pressed]', group).forEach(x => x.setAttribute('aria-pressed', x === btn)); const seg = btn.closest('.seg.rng'); seg && placeThumb(seg, true); }
  function renderHome(soft) {
    const r = $('#home-root'), tk = todayKey(), ALL = S.habits, n0 = now();
    if (!ALL.length) { r.innerHTML = `<header class="vhead"><h1 class="vtitle">${greet()}, ${esc(user.name)}.</h1></header>${exampleBanner()}${emptyState()}`; return; }
    if (homeHabit !== 'all' && !ALL.find(h => h.id === homeHabit)) homeHabit = 'all';
    if (!soft || !$('#home-dyn', r)) {
      r.innerHTML = `<header class="vhead"><h1 class="vtitle">${greet()}, ${esc(user.name)}.</h1>
        <p class="hdate">${fmt(n0, { weekday: 'long' })}, ${fmt(n0, { month: 'long' })} ${ord(n0.getDate())}</p>
        <p class="hclock"><span class="mono" id="home-clock" data-tip="Timezone: ${esc(tz().replace(/_/g, ' '))}" tabindex="0">${n0.toTimeString().slice(0, 5)}</span></p></header>${exampleBanner()}
        <div class="hfilters">
          <div class="chips" role="group" aria-label="Habit"><button class="chip" data-act="hpick" data-h="all" aria-pressed="${homeHabit === 'all'}">All habits</button>${ALL.map(h => `<button class="chip" data-act="hpick" data-h="${h.id}" aria-pressed="${homeHabit === h.id}">${esc(h.name)}</button>`).join('')}</div>
          ${rangeSeg('hrange', homeRange)}
        </div><div id="home-dyn"></div>`;
      requestAnimationFrame(() => placeThumb($('.seg.rng', r), false));
      clearInterval(clockT); clockT = setInterval(() => { const c = $('#home-clock'); c && (c.textContent = now().toTimeString().slice(0, 5)); }, 15000);
    }
    const H = homeHabit === 'all' ? ALL : ALL.filter(h => h.id === homeHabit);
    let best = null, bn = -1; H.forEach(h => { const n = currentStreak(h); if (n > bn) { bn = n; best = h; } });
    const earliest = H.reduce((m, h) => h.start < m ? h.start : m, tk);
    const n = homeRange === 'all' ? daysSince(earliest) : homeRange;
    const days = Array.from({ length: n }, (_, i) => { const d = addDays(n0, i - (n - 1)), k = key(d); let c = 0, x = 0, m = 0;
      H.forEach(h => { if (k < h.start) return; m++; const l = getLog(h.id, k); if (l && l.s === 'c') c++; else if (l && l.s === 'x') x++; }); return { d, k, c, x, m }; });
    const clean = days.reduce((a, d) => a + d.c, 0), slips = days.reduce((a, d) => a + d.x, 0), possible = days.reduce((a, d) => a + (d.k < tk ? d.m : (d.c + d.x)), 0);
    const rt = clean + slips ? Math.round(clean / (clean + slips) * 100) : 0;
    const wd = [0, 0, 0, 0, 0, 0, 0], WD = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']; days.forEach(o => { wd[(o.d.getDay() + 6) % 7] += o.x; });
    const wmax = Math.max(1, ...wd), hard = wd.indexOf(Math.max(...wd));
    const size = Math.ceil(n / 60), groups = []; for (let i = 0; i < n; i += size) { const g = days.slice(i, i + size); groups.push({ c: g.reduce((a, o) => a + o.c, 0), m: g.reduce((a, o) => a + o.m, 0), x: g.reduce((a, o) => a + o.x, 0) }); }
    const W = 300, Hh = 110, bw = W / Math.max(groups.length, 1);
    const bars = groups.map((g, i) => { const f = g.m ? g.c / g.m : 0, hgt = Math.max(2, f * (Hh - 10)); return `<rect class="anim-bar ${g.x ? 'sl' : ''}" x="${i * bw + Math.min(1.5, bw * .15)}" y="${Hh - hgt}" width="${Math.max(1, bw - Math.min(3, bw * .3))}" height="${hgt}" rx="2"/>`; }).join('');
    const wbars = wd.map((v, i) => `<div class="wdb ${i === hard && v ? 'hard' : ''}"><i class="anim-wd" style="--h:${v / wmax * 100}%"></i><span>${WD[i]}</span></div>`).join('');
    const strip = Array.from({ length: 30 }, (_, i) => { const l = getLog(best.id, key(addDays(n0, i - 29))); return `<i class="${l && l.s ? l.s : ''}"></i>`; }).join('');
    const done = ALL.filter(h => (getLog(h.id, tk) || {}).s).length, gp = clamp(bn / best.goal), GC = 2 * Math.PI * 44;
    $('#home-dyn', r).innerHTML = `
      <div class="dash">
        <section class="glass dash-hero">
          <div class="goal-ring" aria-label="${bn} of ${best.goal} days toward the goal"><svg viewBox="0 0 100 100"><circle class="trk" cx="50" cy="50" r="44"/><circle class="arc" cx="50" cy="50" r="44" stroke-dasharray="${GC}" stroke-dashoffset="${GC}" data-to="${GC * (1 - gp)}"/></svg><span><b>${best.goal}</b>days</span></div>
          <div><p class="eyebrow">${homeHabit === 'all' ? 'Longest current run' : 'Current run'}</p><div class="big-n" style="margin-top:14px"><b id="home-n">0</b><span>days</span></div><p class="hero-from">clean from ${esc(best.name.toLowerCase())}</p></div>
          <div class="hero-bottom"><div class="strip" aria-label="Last 30 days">${strip}</div>
          <div class="actions-row"><button class="btn btn-primary" data-press data-nav="today">${done === ALL.length ? 'Review habits' : 'Check in for today'}</button><button class="btn-text" data-act="toprog" data-h="${best.id}">See your progress</button></div></div></section>
        <section class="glass card"><div class="chart-h"><h3>Today</h3><small>${done} of ${ALL.length} checked in</small></div><div class="status-list">${ALL.map(h => { const l = getLog(h.id, tk) || {};
          return `<div class="status"><span>${esc(h.name)}</span>${l.s ? `<button class="ci-done" data-nav="today" data-tip="${l.s === 'c' ? 'You stayed clean today' : 'You logged a slip today'}">${CHECK}Checked in</button>` : `<button class="btn btn-primary btn-sm" data-press data-nav="today">Check in</button>`}</div>`; }).join('')}</div></section>
      </div>
      <div class="stats" style="margin-top:14px">
        <div class="glass card stat"><b data-count="${ALL.length}">0</b><span>Habits you're quitting</span></div>
        <div class="glass card stat"><b><span data-count="${clean}">0</span><small> / ${possible}</small></b><span>Clean days</span></div>
        <div class="glass card stat"><b><span data-count="${rt}">0</span>%</b><span>Clean rate</span></div>
        <div class="glass card stat"><b data-count="${slips}">0</b><span>Slips</span></div></div>
      <div class="charts">
        <section class="glass card chart"><div class="chart-h"><h3>${homeHabit === 'all' ? 'Every day, all habits' : 'Every day'}</h3></div>
          <svg class="dash-bars" viewBox="0 0 ${W} ${Hh}" preserveAspectRatio="none" role="img" aria-label="Daily clean share">${bars}</svg>
          <div class="legend"><span><i class="c"></i>Clean share</span><span><i class="sl"></i>With a slip</span></div></section>
        <section class="glass card chart"><div class="chart-h"><h3>When slips happen</h3></div>
          <div class="wdbars">${wbars}</div><p class="vsub" style="margin-top:12px">${Math.max(...wd) ? `Your hardest day is <b>${['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'][hard]}</b>. Plan something for it.` : 'No slips in this period.'}</p></section>
      </div>`;
    const hn = $('#home-n'); hn && countUp(hn, bn);
    $$('[data-count]', r).forEach(el => countUp(el, +el.dataset.count));
    const arc = $('.goal-ring .arc', r); requestAnimationFrame(() => requestAnimationFrame(() => arc && (arc.style.strokeDashoffset = arc.dataset.to)));
    const bs = $$('.anim-bar', r), ws = $$('.anim-wd', r);
    new Spring(0, { eps: .0005 }).on(p => { bs.forEach((b, i) => b.style.transform = `scaleY(${clamp(p * 1.6 - i / bs.length * .6)})`); ws.forEach(w => w.style.transform = `scaleY(${clamp(p)})`); }).to(1, { response: 1, damping: 1 });
  }

  /* ---------- TODAY ---------- */
  function habitCard(h) {
    const tk = todayKey(), l = getLog(h.id, tk) || {}, n = currentStreak(h), nm = nextMile(n);
    const week = Array.from({ length: 7 }, (_, i) => addDays(now(), i - 6)).map(d => { const k = key(d), g = getLog(h.id, k), cls = g && g.s ? g.s : '', before = k < h.start;
      return `<div class="wd"><button class="dot ${cls} ${k === tk ? 'today' : ''} ${dayPop && dayPop.h === h.id && dayPop.k === k ? 'sel' : ''}" data-press data-act="daypick" data-h="${h.id}" data-k="${k}" ${before ? 'disabled style="opacity:.3"' : ''} aria-label="${fmt(d, { weekday: 'long', month: 'short', day: 'numeric' })}: ${cls === 'c' ? 'clean' : cls === 'x' ? 'slipped' : 'not logged'}"></button>${fmt(d, { weekday: 'narrow' })}</div>`; }).join('');
    return `<article class="glass card hc">
      <div class="hc-top"><div style="min-width:0"><button class="hc-name" data-act="toprog" data-h="${h.id}" title="Open progress">${esc(h.name)}<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6l6 6-6 6"/></svg></button><div class="hc-meta">${n} of ${h.goal} days${nm ? ` · next milestone ${nm}` : ''}</div></div>${ringSVG(h.id, clamp(n / h.goal), n)}</div>
      <div class="week">${week}</div>
      ${dayPop && dayPop.h === h.id ? (() => { const g = getLog(h.id, dayPop.k) || {}; return `<div class="dpwrap ${dpAnim === h.id ? '' : 'open'}" data-dp="${h.id}"><div><div class="daypop"><span>${fmt(fromKey(dayPop.k), { weekday: 'long', month: 'short', day: 'numeric' })}</span><div class="dp-btns"><button data-act="setday" data-h="${h.id}" data-k="${dayPop.k}" data-s="c" aria-pressed="${g.s === 'c'}">Stayed clean</button><button data-act="setday" data-h="${h.id}" data-k="${dayPop.k}" data-s="x" aria-pressed="${g.s === 'x'}">Slipped</button><button data-act="setday" data-h="${h.id}" data-k="${dayPop.k}" data-s="" class="dp-clear">Clear</button></div></div></div></div>`; })() : ''}
      <div class="choice"><button data-press data-act="clean" data-h="${h.id}" aria-pressed="${l.s === 'c'}">Stayed clean</button><button data-press data-act="slip" data-h="${h.id}" aria-pressed="${l.s === 'x'}">Slipped</button></div>
      <div class="urge"><div class="urge-lab"><span>Urge strength today</span><span>0 none · 5 intense</span></div><div class="seg" role="group" aria-label="Urge strength">${[0, 1, 2, 3, 4, 5].map(u => `<button data-press data-act="urge" data-h="${h.id}" data-u="${u}" aria-pressed="${l.u === u}">${u}</button>`).join('')}</div></div>
      <div class="slipwrap ${l.s === 'x' && slipAnim !== h.id ? 'open' : ''}" data-slip="${h.id}"><div><p class="slipnote">A slip is information, not a verdict. Your earlier clean days still count. <button data-act="article" data-a="slip">What to do next</button></p></div></div>
    </article>`;
  }
  let slipAnim = null, dayPop = null, justKey = null, dpAnim = null, dpT = 0;
  // close the past-day panel with the same soft collapse it opened with, then redraw
  function closeDayPop(after) { clearTimeout(dpT); const w = dayPop && $(`[data-dp="${dayPop.h}"]`); if (!w || motion.reduce) { dayPop = null; after && after(); renderToday(); return; }
    w.classList.remove('open'); dpT = setTimeout(() => { dayPop = null; after && after(); renderToday(); }, 430); }
  function renderToday() {
    const r = $('#today-root'), tk = todayKey(), done = S.habits.filter(h => (getLog(h.id, tk) || {}).s).length;
    r.innerHTML = `<header class="vhead"><p class="eyebrow">${fmt(now(), { weekday: 'long', month: 'long', day: 'numeric' })}</p><h1 class="vtitle">Today</h1>
      <p class="vsub">${S.habits.length ? `<span class="ci-pill ${done === S.habits.length ? 'all' : ''}"><b>${done}</b> of ${S.habits.length} checked in</span> Tap a day in the week row to log the last 7 days.` : 'Nothing tracked yet.'}</p></header>
      ${exampleBanner()}
      ${S.habits.length ? `<div class="cards">${S.habits.map(habitCard).join('')}<button class="addcard" data-press data-act="add">+ Add a habit</button></div>
      <section class="glass card note"><label for="note-today" style="font-weight:600">What helped today?</label><textarea id="note-today" placeholder="A walk after dinner, texting a friend, leaving the phone in the kitchen…">${esc(S.notes[tk] || '')}</textarea><small>Saved automatically in this browser.</small></section>` : emptyState()}`;
    animateRings(r);
    if (justKey) { const el = $(justKey, r); justKey = null; el && el.classList.add('just'); }
    if (dpAnim) { const w = $(`[data-dp="${dpAnim}"]`, r); dpAnim = null; w && requestAnimationFrame(() => requestAnimationFrame(() => w.classList.add('open'))); }
    if (slipAnim) { const w = $(`[data-slip="${slipAnim}"]`, r); slipAnim = null; w && requestAnimationFrame(() => requestAnimationFrame(() => w.classList.add('open'))); }
    const ta = $('#note-today'); ta && ta.addEventListener('input', () => { S.notes[tk] = ta.value; save(); });
  }

  /* ---------- PROGRESS ---------- */
  function lineChart(h, n = 30) {
    const data = daySeries(h, n), E = n - 1, M = Math.floor(n / 2), W = 640, H = 230, L = 34, R = 44, T = 14, B = 28;
    const mx = Math.max(...data.map(d => d.v), 1), top = mx <= 5 ? 5 : mx <= 10 ? 10 : Math.ceil(mx / 10) * 10;
    const x = i => L + i * (W - L - R) / (data.length - 1), y = v => T + (1 - v / top) * (H - T - B);
    const pts = data.map((d, i) => `${x(i).toFixed(1)},${y(d.v).toFixed(1)}`), last = data[data.length - 1];
    return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Streak length over the last ${n} days, now ${last.v} days">
      <defs><linearGradient id="ag" x1="0" y1="0" x2="0" y2="1"><stop offset="0" style="stop-color:var(--fg);stop-opacity:.16"/><stop offset="1" style="stop-color:var(--fg);stop-opacity:0"/></linearGradient></defs>
      ${[0, top / 2, top].map(t => `<line class="grid" x1="${L}" x2="${W - R}" y1="${y(t)}" y2="${y(t)}"/><text x="${L - 8}" y="${y(t) + 4}" text-anchor="end">${t % 1 ? t.toFixed(1) : t}</text>`).join('')}
      ${[0, M, E].map(i => `<text x="${x(i)}" y="${H - 6}" text-anchor="${i === 0 ? 'start' : i === E ? 'end' : 'middle'}">${i === E ? 'Today' : fmt(fromKey(data[i].k), { month: 'short', day: 'numeric' })}</text>`).join('')}
      <path class="anim-area" d="M${pts.join('L')}L${x(E)},${y(0)}L${x(0)},${y(0)}Z" fill="url(#ag)" opacity="0"/>
      <path class="anim-line" d="M${pts.join('L')}" fill="none" style="stroke:var(--fg)" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round" pathLength="1" stroke-dasharray="1" stroke-dashoffset="1"/>
      <circle class="anim-end" cx="${x(E)}" cy="${y(last.v)}" r="5" style="fill:var(--fg);stroke:var(--surface)" stroke-width="3" opacity="0"/>
      <text class="anim-end" x="${x(E) + 10}" y="${y(last.v) + 4}" style="fill:var(--fg);font-weight:600" opacity="0">${last.v}</text></svg>`;
  }
  function urgeChart(h, n = 14) {
    const size = Math.ceil(n / 31), cols = Math.ceil(n / size), W = 360, H = 230, L = 22, R = 6, T = 14, B = 28, band = (W - L - R) / cols, bw = band * .56;
    const y = v => T + (1 - v / 5) * (H - T - B);
    const groups = Array.from({ length: cols }, (_, c) => { let s = 0, k = 0, slip = false; const ds = [];
      for (let j = 0; j < size; j++) { const d = addDays(now(), -(n - 1) + c * size + j); if (key(d) > todayKey()) continue; ds.push(d); const l = getLog(h.id, key(d)); if (l && l.u != null) { s += l.u; k++; } if (l && l.s === 'x') slip = true; }
      return { d: ds[0] || now(), u: k ? s / k : null, slip }; });
    const labs = cols <= 14 ? groups.map((g, i) => i) : [0, Math.floor(cols / 2), cols - 1];
    return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Urge strength">
      ${[0, 1, 2, 3, 4, 5].map(t => `<line class="grid" x1="${L}" x2="${W - R}" y1="${y(t)}" y2="${y(t)}" ${t % 5 ? 'stroke-dasharray="2 4"' : ''}/>`).join('')}
      <text x="${L - 6}" y="${y(5) + 4}" text-anchor="end">5</text><text x="${L - 6}" y="${y(0) + 4}" text-anchor="end">0</text>
      ${groups.map((g, i) => { const cx = L + band * i + band / 2;
        const bar = g.u == null ? '' : g.u === 0 ? `<line x1="${cx - bw / 2}" x2="${cx + bw / 2}" y1="${y(0) - 1}" y2="${y(0) - 1}" style="stroke:var(--fg)" stroke-width="2"/>`
          : `<rect class="anim-bar" x="${cx - bw / 2}" y="${y(g.u)}" width="${bw}" height="${y(0) - y(g.u)}" rx="${Math.min(3, bw / 2)}" style="fill:var(--fg);opacity:${g.slip ? 1 : .55};transform-origin:${cx}px ${y(0)}px"/>`;
        const lab = labs.includes(i) ? `<text x="${cx}" y="${H - 8}" text-anchor="${cols > 14 ? (i === 0 ? 'start' : i === cols - 1 ? 'end' : 'middle') : 'middle'}" ${i === cols - 1 ? 'style="fill:var(--fg)"' : ''}>${cols <= 14 ? fmt(g.d, { weekday: 'narrow' }) : i === cols - 1 ? 'Today' : fmt(g.d, { month: 'short', day: 'numeric' })}</text>` : '';
        return bar + lab; }).join('')}</svg>`;
  }
  // the whole calendar year: every day gets a square; days still ahead are empty outlines
  function heatmap(h) {
    const today = now(), tk = todayKey(), y0 = new Date(today.getFullYear(), 0, 1), lead = (y0.getDay() + 6) % 7, start = addDays(y0, -lead);
    const yEnd = key(new Date(today.getFullYear(), 11, 31)), c = 13, g = 3, L = 22, T = 18, weeks = 53;
    const W = L + weeks * (c + g), H = T + 7 * (c + g); let cells = '', months = '', lastM = -1;
    for (let w = 0; w < weeks; w++) {
      for (let d = 0; d < 7; d++) {
        const day = addDays(start, w * 7 + d), k = key(day); if (day.getFullYear() !== today.getFullYear() || k > yEnd) continue;
        if (day.getDate() === 1 && day.getMonth() !== lastM) { lastM = day.getMonth(); months += `<text x="${L + w * (c + g)}" y="11">${fmt(day, { month: 'short' })}</text>`; }
        const X = L + w * (c + g), Y = T + d * (c + g);
        if (k > tk) { cells += `<rect class="anim-cell fut" data-o="1" x="${X + .5}" y="${Y + .5}" width="${c - 1}" height="${c - 1}" rx="3"><title>${fmt(day, { month: 'short', day: 'numeric' })}: still ahead</title></rect>`; continue; }
        const l = getLog(h.id, k), before = k < h.start;
        const st = l && l.s === 'c' ? 'fill:var(--fg)' : l && l.s === 'x' ? 'fill:var(--surface);stroke:var(--fg);stroke-width:1.5' : 'fill:var(--faint)';
        cells += `<rect class="anim-cell" data-o="${before && !(l && l.s) ? .4 : 1}" x="${X}" y="${Y}" width="${c}" height="${c}" rx="3" style="${st}"${k === tk ? ' stroke-dasharray="2 2"' : ''}><title>${fmt(day, { month: 'short', day: 'numeric' })}: ${l && l.s === 'c' ? 'clean' : l && l.s === 'x' ? 'slipped' : 'not logged'}</title></rect>`;
        if (l && l.s === 'x') cells += `<line class="anim-cell" data-o="1" x1="${X + 3.5}" y1="${Y + c - 3.5}" x2="${X + c - 3.5}" y2="${Y + 3.5}" style="stroke:var(--fg)" stroke-width="1.5"/>`;
      }
    }
    const dl = ['M', '', 'W', '', 'F', '', ''].map((t, d) => t ? `<text x="0" y="${T + d * (c + g) + 10}">${t}</text>` : '').join('');
    return `<svg class="year" viewBox="0 0 ${W} ${H}" role="img" aria-label="Calendar for ${today.getFullYear()}">${months}${dl}${cells}</svg>`;
  }
  const yearLegend = () => `<div class="legend"><span><i class="c"></i>Clean</span><span><i class="x"></i>Slipped</span><span><i></i>Not logged</span><span><i class="fut"></i>Still ahead</span></div>`;
  function animCharts(r) {
    const line = $('.anim-line', r), area = $('.anim-area', r), ends = $$('.anim-end', r), bars = $$('.anim-bar', r), cells = $$('.anim-cell', r);
    new Spring(0, { eps: .0005 }).on(p => {
      line && line.setAttribute('stroke-dashoffset', 1 - p); area && area.setAttribute('opacity', clamp(p * 1.4 - .3));
      ends.forEach(e => e.setAttribute('opacity', clamp(p * 4 - 3)));
      bars.forEach((b, i) => b.style.transform = `scaleY(${clamp(p * 1.6 - i / bars.length * .6)})`);
      cells.forEach((c, i) => c.style.opacity = (+c.dataset.o || 1) * clamp(p * 1.8 - i / cells.length * .8));
    }).to(1, { response: 1.1, damping: 1 });
  }
  let progRange = 30;
  function renderProgress(soft) {
    const r = $('#progress-root');
    if (!S.habits.length) { r.innerHTML = `<header class="vhead"><h1 class="vtitle">Progress</h1></header>${emptyState()}`; return; }
    if (!S.habits.find(h => h.id === S.sel)) S.sel = S.habits[0].id;
    const h = S.habits.find(x => x.id === S.sel), cur = currentStreak(h), lng = longest(h);
    const PR = progRange === 'all' ? daysSince(h.start) : progRange, rt = rate(h, PR), au = avgUrge(h, PR);
    const slipsList = []; for (let i = 0; i < PR; i++) { const d = addDays(now(), -i), k = key(d); if (k < h.start) break; const l = getLog(h.id, k); if (l && l.s === 'x') slipsList.push({ d, u: l.u }); }
    if (!soft || !$('#prog-dyn', r)) {
      r.innerHTML = `<header class="vhead"><h1 class="vtitle">Progress</h1></header>
      <div class="hfilters"><div class="chips" role="group" aria-label="Habit">${S.habits.map(x => `<button class="chip" data-act="pick" data-h="${x.id}" aria-pressed="${x.id === h.id}">${esc(x.name)}</button>`).join('')}</div>
      ${rangeSeg('prange', progRange)}</div><div id="prog-dyn"></div>`;
      requestAnimationFrame(() => placeThumb($('.seg.rng', r), false));
    }
    $('#prog-dyn', r).innerHTML = `
      <div class="stats">
        <div class="glass card stat"><b data-count="${cur}">0</b><span>Current streak, days</span></div>
        <div class="glass card stat"><b data-count="${lng}">0</b><span>Longest streak, days</span></div>
        <div class="glass card stat"><b><span data-count="${rt}">0</span>%</b><span>Clean days</span></div>
        <div class="glass card stat has-tip" data-tip="Your average urge strength in the chosen period. 0 means no urge at all, 5 is the strongest urge."><b>${au == null ? '–' : au.toFixed(1)}</b><span>Average urge, 0–5</span></div></div>
      <div class="charts">
        <section class="glass card chart"><div class="chart-h"><h3>Streak length</h3></div>${lineChart(h, Math.max(PR, 7))}</section>
        <section class="glass card chart"><div class="chart-h"><h3>Urge strength</h3></div>${urgeChart(h, Math.max(PR, 7))}<div class="legend"><span>Darker bar: slipped that day</span></div></section>
        <section class="glass card chart span2"><div class="chart-h"><h3>${now().getFullYear()}</h3><small>every day of the year, Monday to Sunday</small></div><div class="year-wrap">${heatmap(h)}</div>${yearLegend()}</section></div>
      <section class="glass card" style="margin-top:14px"><div class="chart-h"><h3>Days you slipped</h3><small>${slipsList.length} ${slipsList.length === 1 ? 'slip' : 'slips'}</small></div>
        ${slipsList.length ? `<table class="slips"><thead><tr><th>Date</th><th>Weekday</th><th>Urge</th></tr></thead><tbody>${slipsList.map(o => `<tr><td>${fmt(o.d, { month: 'short', day: 'numeric', year: 'numeric' })}</td><td>${fmt(o.d, { weekday: 'long' })}</td><td>${o.u == null ? '–' : o.u + ' / 5'}</td></tr>`).join('')}</tbody></table>` : '<p class="vsub">No slips in this period. Keep going.</p>'}</section>`;
    $$('[data-count]', $('#prog-dyn', r)).forEach(el => countUp(el, +el.dataset.count));
    animCharts(r);
  }

  /* ---------- habit detail ---------- */
  let dRange = 90;
  function detailHTML(h) {
    const n = dRange, from = key(addDays(now(), -(n - 1))); let c = 0, x = 0, us = 0, un = 0; const slips = [];
    for (let i = 0; i < n; i++) { const d = addDays(now(), -i), k = key(d); if (k < h.start) break; const l = getLog(h.id, k); if (!l) continue;
      if (l.s === 'c') c++; if (l.s === 'x') { x++; slips.push({ d, u: l.u }); } if (l.u != null) { us += l.u; un++; } }
    const rt = c + x ? Math.round(c / (c + x) * 100) : 0;
    return `<div class="det">
      <div class="chips" role="group" aria-label="Range">${[[30, 'Last 30 days'], [90, 'Last 90 days'], [365, 'Last 365 days']].map(([v, l]) => `<button class="chip" data-press data-act="drange" data-h="${h.id}" data-r="${v}" aria-pressed="${v === n}">${l}</button>`).join('')}</div>
      <div class="stats">
        <div class="glass card stat"><b>${currentStreak(h)}</b><span>Current streak, days</span></div>
        <div class="glass card stat"><b>${longest(h)}</b><span>Longest streak, days</span></div>
        <div class="glass card stat"><b>${rt}%</b><span>Clean days, last ${n} days</span></div>
        <div class="glass card stat has-tip" data-tip="0 means no urge at all, 5 is the strongest urge."><b>${un ? (us / un).toFixed(1) : '–'}</b><span>Average urge, 0–5, last ${n} days</span></div></div>
      <section class="glass card chart"><div class="chart-h"><h3>Streak length</h3><small>last ${n} days</small></div>${lineChart(h, n)}</section>
      <section class="glass card chart"><div class="chart-h"><h3>${now().getFullYear()}</h3><small>every day of the year</small></div><div class="year-wrap">${heatmap(h)}</div>${yearLegend()}</section>
      <section class="glass card"><div class="chart-h"><h3>Days you slipped</h3><small>${x} in the last ${n} days</small></div>
        ${slips.length ? `<table class="slips"><thead><tr><th>Date</th><th>Weekday</th><th>Urge</th></tr></thead><tbody>${slips.map(o => `<tr><td>${fmt(o.d, { month: 'short', day: 'numeric', year: 'numeric' })}</td><td>${fmt(o.d, { weekday: 'long' })}</td><td>${o.u == null ? '–' : o.u + ' / 5'}</td></tr>`).join('')}</tbody></table>` : '<p class="vsub">No slips in this period. Keep going.</p>'}</section>
      ${h.instead || h.why ? `<section class="glass card">${h.why ? `<p class="eyebrow">Why you're quitting</p><p style="margin:6px 0 14px">${esc(h.why)}</p>` : ''}${h.instead ? `<p class="eyebrow">What you do instead</p><p style="margin-top:6px">${esc(h.instead)}</p>` : ''}</section>` : ''}
    </div>`;
  }
  function openDetail(id) { const h = S.habits.find(x => x.id === id); if (!h) return; openSheet(h.name, detailHTML(h), 'wide'); animCharts($('#sheet-body')); }

  /* ---------- GOALS ---------- */
  let confirmDel = null;
  const GEAR = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>';
  const remindText = h => [h.time ? `check-in reminder at ${h.time}` : '', h.nudges ? `${h.nudges} nudge${h.nudges > 1 ? 's' : ''} a day` : ''].filter(Boolean).join(' · ');
  function renderGoals() {
    const r = $('#goals-root');
    r.innerHTML = `<header class="vhead"><p class="eyebrow">Targets and milestones</p><h1 class="vtitle">Goals</h1><p class="vsub">Milestones unlock as your current streak grows. To change a goal, open the settings of that habit.</p></header>
    ${S.habits.length ? `<div class="glist">${S.habits.map(h => { const n = currentStreak(h), nm = nextMile(n), left = Math.max(0, h.goal - n), rm = remindText(h);
      return `<article class="glass card gc">
        <div class="gear-wrap"><button class="gear" data-act="gear" aria-label="Settings for ${esc(h.name)}" aria-haspopup="menu">${GEAR}</button>
          <div class="gmenu" role="menu">
            <button class="mi" data-act="toprog" data-h="${h.id}" role="menuitem"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3v18h18"/><path d="M7 14l4-4 3 3 5-6"/></svg>View details</button>
            <button class="mi" data-act="edit" data-h="${h.id}" role="menuitem"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>Edit habit and goal</button>
            <button class="mi" data-act="share" data-h="${h.id}" role="menuitem"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4"/></svg>Share progress</button>
            <hr>${confirmDel === h.id ? `<div class="gconfirm"><span>Delete ${esc(h.name)} and every check-in? This can't be undone.</span><button class="btn btn-primary btn-sm" data-press data-act="del-yes" data-h="${h.id}">Delete forever</button><button class="btn-text" data-act="del-no">Keep it</button></div>`
            : `<button class="mi danger" data-act="del" data-h="${h.id}" role="menuitem"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14"/></svg>Delete forever</button>`}
          </div></div>
        <div class="gc-top">${ringSVG(h.id, clamp(n / h.goal), n, 'lg')}<div style="min-width:0"><h3>${esc(h.name)}</h3>
          <p class="gc-goal">Goal: <b>${h.goal} days</b></p>
          <p>${left ? `${left} day${left === 1 ? '' : 's'} to your goal` : `Goal reached. ${n} days and counting.`} · ${nm ? `next milestone: day ${nm}` : 'every milestone collected'} · since ${fmt(fromKey(h.start), { month: 'short', day: 'numeric' })}</p>
          ${rm ? `<p>${rm}</p>` : ''}</div></div>
      </article>`; }).join('')}<button class="addcard" data-press data-act="add">+ Add a habit</button></div>` : emptyState()}`;
    animateRings(r);
    if (gearOpen) { const g = $(`.gmenu [data-h="${gearOpen}"]`, r); g && g.closest('.gear-wrap').classList.add('open'); }
  }
  let gearOpen = null;

  /* ---------- READ ---------- */
  let breath = { on: false, raf: 0 };
  function renderRead() {
    const r = $('#read-root');
    r.innerHTML = `<header class="vhead"><p class="eyebrow">For hard moments</p><h1 class="vtitle">Read</h1><p class="vsub">Short, practical guides. Open one when an urge hits.</p></header>
      <section class="glass breathe"><div class="orb-wrap"><div class="orb" id="orb"></div><span class="orb-lab" id="orb-lab">Ready</span></div>
        <div><p class="eyebrow">Ride the urge</p><h3>Breathe 4 · 4 · 6</h3><p>Breathe in for 4 seconds, hold for 4, breathe out for 6. Three rounds take under a minute and slow your body down while the urge passes.</p>
        <div class="actions-row"><button class="btn btn-primary" data-press data-act="breathe" id="breathe-btn">Start breathing</button><span class="mono lab" id="breathe-count">0 rounds</span></div></div></section>
      <div class="articles">${window.RR_ARTICLES.map(a => `<button class="glass art" data-glass data-act="article" data-a="${a.id}"><span class="tag">${esc(a.tag)}</span><h3>${esc(a.t)}</h3><p>${esc(a.d)}</p></button>`).join('')}</div>`;
    breath.on && stopBreath(); glass(r);
  }
  const PH = [['Breathe in', 4, .55, 1], ['Hold', 4, 1, 1], ['Breathe out', 6, 1, .55]];
  function stopBreath() { breath.on = false; cancelAnimationFrame(breath.raf); const o = $('#orb'); o && (o.style.transform = 'scale(.55)'); const l = $('#orb-lab'); l && (l.textContent = 'Ready'); const b = $('#breathe-btn'); b && (b.textContent = 'Start breathing'); }
  function startBreath() {
    breath = { on: true, t0: performance.now(), rounds: 0, raf: 0 }; $('#breathe-btn').textContent = 'Stop';
    const tick = n => { if (!breath.on || !$('#orb')) return;
      let t = ((n - breath.t0) / 1000) % 14, i = 0; const total = Math.floor((n - breath.t0) / 14000);
      while (t > PH[i][1]) { t -= PH[i][1]; i++; }
      const [lab, dur, a, b] = PH[i], e = .5 - Math.cos(Math.PI * t / dur) / 2;
      if (!motion.reduce) $('#orb').style.transform = `scale(${a + (b - a) * e})`;
      $('#orb-lab').textContent = `${lab} ${Math.ceil(dur - t)}`;
      if (total !== breath.rounds) { breath.rounds = total; $('#breathe-count').textContent = `${total} round${total === 1 ? '' : 's'}`; }
      breath.raf = requestAnimationFrame(tick); };
    breath.raf = requestAnimationFrame(tick);
  }

  /* ---------- sheet: drag, rubber-band, velocity handoff, momentum projection ---------- */
  const sheet = $('#sheet'), scrim = $('#scrim'); let sheetH = 600, lastFocus = null;
  const sheetY = new Spring(0, { eps: .3 });
  sheetY.on(y => { sheet.style.transform = `translate(-50%, ${y}px)`; scrim.style.opacity = clamp(1 - y / sheetH); });
  function openSheet(title, html, mode = '') {
    closeAll(); lastFocus = document.activeElement; sheet.classList.toggle('wide', mode === 'wide');
    $('#sheet-title').textContent = title; $('#sheet-body').innerHTML = html; $('#sheet-body').scrollTop = 0;
    const was = sheet.hidden; sheet.hidden = false; scrim.hidden = false; sheetH = sheet.offsetHeight + 30;
    if (was) sheetY.set(sheetH);
    sheetY.to(0, { response: .32, damping: .86 }); document.body.style.overflow = 'hidden'; RR.lenis && RR.lenis.stop();
    setTimeout(() => { const f = $('#sheet-body input'); (f || $('.close-x', sheet)).focus({ preventScroll: true }); }, motion.reduce ? 0 : 280);
  }
  function closeSheet(v = 0) {
    sheetY.to(sheetH, { response: .3, damping: 1, velocity: v, onRest: () => { sheet.hidden = true; scrim.hidden = true; } });
    document.body.style.overflow = ''; RR.lenis && RR.lenis.start(); lastFocus && lastFocus.focus && lastFocus.focus({ preventScroll: true });
  }
  scrim.addEventListener('click', () => closeSheet());
  addEventListener('keydown', e => { if (e.key === 'Escape' && !sheet.hidden) closeSheet(); }, { signal });
  (() => {
    let drag = null; const vt = tracker();
    const down = e => { if (e.target.closest('button')) return; sheetY.stop(); drag = { id: e.pointerId, y0: e.clientY, s0: sheetY.value }; vt.reset(); vt.add(sheetY.value); e.currentTarget.setPointerCapture(e.pointerId); };
    const move = e => { if (!drag || e.pointerId !== drag.id) return; let y = drag.s0 + (e.clientY - drag.y0); if (y < 0) y = -rubber(-y, sheetH); sheetY.value = sheetY.target = y; sheetY.emit(); vt.add(y); };
    const up = e => { if (!drag || e.pointerId !== drag.id) return; drag = null; const v = vt.v(), y = sheetY.value;
      if (y + project(v) > sheetH * .45 && y > 0) closeSheet(v); else sheetY.to(0, { response: .32, damping: Math.abs(v) > 300 ? .8 : 1, velocity: v }); };
    [$('#grab'), $('#sheet-head')].forEach(el => { el.addEventListener('pointerdown', down); el.addEventListener('pointermove', move); el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up); });
  })();
  let newGoal = 30, editId = null;
  const TIMES = ['', ...Array.from({ length: 36 }, (_, i) => { const m = 360 + i * 30; return String(Math.floor(m / 60)).padStart(2, '0') + ':' + (m % 60 ? '30' : '00'); })];
  const habitForm = (h = null) => `<form id="habit-form" novalidate>
    <div class="field"><label for="f-name">Habit you want to quit</label><input class="input" id="f-name" maxlength="40" placeholder="e.g. Nail biting" autocomplete="off" value="${h ? esc(h.name) : ''}"></div>
    <div class="field"><label>Goal streak, in days</label><div class="row" id="goal-row">${[7, 14, 30, 60, 90, 365].map(g => `<button type="button" class="chip" data-press data-act="pick-goal" data-g="${g}" aria-pressed="${g === newGoal}">${g}</button>`).join('')}</div>
      <small class="hint">Pick it once. You can only change it again from this settings screen, so it stays steady day to day.</small></div>
    ${h ? '' : `<div class="field"><label for="f-start">Tracking starts</label><input class="input" id="f-start" type="date" value="${todayKey()}" max="${todayKey()}"></div>`}
    <div class="fgrid">
      <div class="field"><label>Daily check-in reminder</label>${ddHTML('f-time', h ? h.time || '' : '', TIMES.map(t => [t, t || 'Off']))}</div>
      <div class="field"><label>Reminders during the day</label>${ddHTML('f-nudges', String(h ? h.nudges || 0 : 0), [0, 1, 2, 3, 4, 5, 6, 8].map(v => [String(v), v ? `${v} time${v > 1 ? 's' : ''} a day` : 'Off']))}</div>
    </div>
    <div class="field"><label for="f-instead">What will you do instead?</label><input class="input" id="f-instead" maxlength="80" placeholder="e.g. Go for a 5-minute walk" value="${h ? esc(h.instead || '') : ''}"></div>
    <div class="field"><label for="f-why">Why do you want to quit? <span class="opt">optional</span></label><input class="input" id="f-why" maxlength="120" placeholder="e.g. I want healthy nails by summer" value="${h ? esc(h.why || '') : ''}"></div>
    <div class="actions"><button class="btn btn-primary btn-block" type="submit" data-press>${h ? 'Save changes' : 'Add habit'}</button><button type="button" class="btn-text" data-act="close-sheet">Cancel</button></div></form>`;
  document.addEventListener('submit', async e => {
    if (e.target.id !== 'habit-form') return; e.preventDefault();
    const name = $('#f-name').value.trim();
    if (!name) { const f = $('#f-name').closest('.field'); if (!$('.err', f)) f.insertAdjacentHTML('beforeend', '<p class="err">Give the habit a name, for example "Nail biting".</p>'); $('#f-name').focus(); return; }
    const extra = { name, goal: newGoal, time: $('#f-time').value || '', nudges: +$('#f-nudges').value || 0, instead: $('#f-instead').value.trim(), why: $('#f-why').value.trim() };
    if (editId) { Object.assign(S.habits.find(x => x.id === editId), extra); save(); closeSheet(); toast(`Saved ${name}`); }
    else { const start = ($('#f-start') && $('#f-start').value) || todayKey(); const h = { id: RRStore.uid(), start: start > todayKey() ? todayKey() : start, ...extra };
      S.habits.push(h); S.sel = h.id; save(); closeSheet(); buzz(); toast(`Added ${name}`); }
    unlockSound();
    if ((extra.time || extra.nudges) && 'Notification' in window && Notification.permission === 'default') { try { await Notification.requestPermission(); } catch (err) {} }
    if ((extra.time || extra.nudges) && (!('Notification' in window) || Notification.permission !== 'granted')) toast('Reminders will show inside Re:Root. Allow notifications to get them as pop-ups.');
    editId = null; if (view === 'home') go('today'); else RENDER[view]();
  }, { signal });

  /* ---------- per-habit reminders: real notifications + sound while the tab is open ---------- */
  let actx = null;
  function unlockSound() { try { actx = actx || new (window.AudioContext || window.webkitAudioContext)(); actx.state === 'suspended' && actx.resume(); } catch (e) {} }
  addEventListener('pointerdown', unlockSound, { once: true, signal });
  function chime() { if (!actx) return; try { const t = actx.currentTime;
    [[880, 0], [1320, .16]].forEach(([f, d]) => { const o = actx.createOscillator(), g = actx.createGain(); o.type = 'sine'; o.frequency.value = f;
      g.gain.setValueAtTime(0, t + d); g.gain.linearRampToValueAtTime(.18, t + d + .02); g.gain.exponentialRampToValueAtTime(.0001, t + d + .7);
      o.connect(g).connect(actx.destination); o.start(t + d); o.stop(t + d + .75); }); } catch (e) {} }
  function bubble(title, body) {
    let b = $('#rr-bubble'); if (!b) { b = document.createElement('div'); b.id = 'rr-bubble'; b.className = 'rr-bubble'; b.setAttribute('role', 'status'); document.body.appendChild(b); }
    b.innerHTML = `<span class="rb-ic">${'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9a6 6 0 1 1 12 0c0 6 2.5 7.5 2.5 7.5h-17S6 15 6 9M10 20a2 2 0 0 0 4 0"/></svg>'}</span><div><b>${esc(title)}</b><span>${esc(body)}</span></div><button class="btn btn-primary btn-sm" data-press data-nav="today">Log it</button><button class="rb-x" aria-label="Dismiss">×</button>`;
    b.classList.remove('show'); void b.offsetWidth; b.classList.add('show');
    $('.rb-x', b).onclick = () => b.classList.remove('show'); $('[data-nav]', b).addEventListener('click', () => b.classList.remove('show'));
    clearTimeout(b._t); b._t = setTimeout(() => b.classList.remove('show'), 20000);
  }
  function notify(title, body, tag) {
    chime(); bubble(title, body);
    if ('Notification' in window && Notification.permission === 'granted') try { const n = new Notification(title, { body, tag, icon: 'assets/img/icon.svg' }); n.onclick = () => { focus(); go('today'); n.close(); }; } catch (e) {}
  }
  const nudgeTimes = n => n <= 0 ? [] : n === 1 ? ['12:00'] : Array.from({ length: n }, (_, i) => { const m = 540 + Math.round(i * 720 / (n - 1)); return String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0'); });
  function reminderTick() {
    const d = now(), hm = d.toTimeString().slice(0, 5), tk = todayKey(), fired = RR.ls.get('reroot.fired', {});
    if (fired.day !== tk) { fired.day = tk; fired.keys = []; }
    S.habits.forEach(h => {
      const logged = (getLog(h.id, tk) || {}).s;
      if (h.time === hm && !logged && !fired.keys.includes(h.id + 't' + hm)) { fired.keys.push(h.id + 't' + hm); notify(`Time to log ${h.name}`, 'How did today go? Tap to check in.', 'rr-' + h.id); }
      if (nudgeTimes(h.nudges || 0).includes(hm) && logged !== 'x' && !fired.keys.includes(h.id + 'n' + hm)) { fired.keys.push(h.id + 'n' + hm);
        notify(`Stay strong: ${h.name}`, h.instead ? `If the urge shows up, try this instead: ${h.instead}.` : 'Notice the urge, breathe, and let it pass.', 'rr-n-' + h.id); }
    });
    RR.ls.set('reroot.fired', fired);
  }
  const remI = setInterval(reminderTick, 15000); reminderTick();
  signal.addEventListener('abort', () => clearInterval(remI));

  /* ---------- actions ---------- */
  document.addEventListener('click', async e => {
    if (!e.target.closest('.gear-wrap') && gearOpen) { $$('.gear-wrap.open').forEach(x => x.classList.remove('open')); gearOpen = null; confirmDel = null; }
    const b = e.target.closest('[data-act]'); if (!b) return;
    const a = b.dataset.act, id = b.dataset.h, tk = todayKey();
    switch (a) {
      case 'clean': case 'slip': { const s = a === 'clean' ? 'c' : 'x', cur = getLog(id, tk) || {}, next = cur.s === s ? undefined : s; setLog(id, tk, { s: next }); buzz();
        if (next === 'x') slipAnim = id; if (next) justKey = `.choice [data-act="${a}"][data-h="${id}"]`;
        const w = $(`[data-slip="${id}"].open`);
        if (cur.s === 'x' && next !== 'x' && w && !motion.reduce) { w.classList.remove('open'); $$(`.choice [data-h="${id}"]`).forEach(x => x.setAttribute('aria-pressed', x.dataset.act === 'clean' && next === 'c')); setTimeout(renderToday, 420); }
        else renderToday();
        if (s === 'c' && cur.s !== 'c') toast('Logged. One more clean day.'); break; }
      case 'urge': { const u = +b.dataset.u, cur = getLog(id, tk) || {}; setLog(id, tk, { u: cur.u === u ? undefined : u }); if (cur.u !== u) justKey = `.seg [data-h="${id}"][data-u="${u}"]`; renderToday(); break; }
      case 'daypick': { const k = b.dataset.k; clearTimeout(dpT);
        if (dayPop && dayPop.h === id && dayPop.k === k) { closeDayPop(); break; }
        if (!dayPop || dayPop.h !== id) dpAnim = id; dayPop = { h: id, k }; renderToday(); break; }
      case 'setday': { const k = b.dataset.k, sv = b.dataset.s; setLog(id, k, { s: sv || undefined }); buzz(); renderToday(); setTimeout(() => closeDayPop(), 260); if (sv === 'c') toast('Logged as clean'); break; }
      case 'toprog': S.sel = id; save(); gearOpen = null; $$('.gear-wrap.open').forEach(w => w.classList.remove('open')); go('progress'); break;
      case 'hpick': homeHabit = id; pressIn(b.parentElement, b); renderHome(true); break;
      case 'hrange': homeRange = b.dataset.r === 'all' ? 'all' : +b.dataset.r; pressIn(b.parentElement, b); renderHome(true); break;
      case 'cycle': { const k = b.dataset.k, cur = (getLog(id, k) || {}).s; setLog(id, k, { s: cur === 'c' ? 'x' : cur === 'x' ? undefined : 'c' }); buzz(); renderToday(); break; }
      case 'add': newGoal = 30; editId = null; openSheet('New habit', habitForm()); break;
      case 'edit': { const h = S.habits.find(x => x.id === id); gearOpen = null; $$('.gear-wrap.open').forEach(w => w.classList.remove('open')); newGoal = h.goal; editId = id; openSheet(`Edit ${h.name}`, habitForm(h)); break; }
      case 'detail': gearOpen = null; $$('.gear-wrap.open').forEach(w => w.classList.remove('open')); openDetail(id); break;
      case 'drange': dRange = +b.dataset.r; $('#sheet-body').innerHTML = detailHTML(S.habits.find(x => x.id === id)); animCharts($('#sheet-body')); break;
      case 'gear': { const w = b.closest('.gear-wrap'), on = !w.classList.contains('open'); $$('.gear-wrap.open').forEach(x => x.classList.remove('open')); w.classList.toggle('open', on); gearOpen = on ? $('[data-h]', w).dataset.h : null; if (!on) confirmDel = null; break; }
      case 'share': { const h = S.habits.find(x => x.id === id), n = currentStreak(h), txt = `${n} day${n === 1 ? '' : 's'} clean from ${h.name.toLowerCase()}, aiming for ${h.goal}. Tracking it with Re:Root.`;
        $$('.gear-wrap.open').forEach(x => x.classList.remove('open')); gearOpen = null;
        if (navigator.share) navigator.share({ title: 'My progress', text: txt }).catch(() => {}); else if (navigator.clipboard) navigator.clipboard.writeText(txt).then(() => toast('Progress copied to share'), () => toast(txt)); else toast(txt); break; }
      case 'pick-goal': newGoal = +b.dataset.g; $$('#goal-row .chip').forEach(c => c.setAttribute('aria-pressed', +c.dataset.g === newGoal)); break;
      case 'close-sheet': closeSheet(); break;
      case 'pick': S.sel = id; save(); pressIn(b.parentElement, b); renderProgress(true); break;
      case 'prange': progRange = b.dataset.r === 'all' ? 'all' : +b.dataset.r; pressIn(b.parentElement, b); renderProgress(true); break;
      case 'del': confirmDel = id; renderGoals(); break;
      case 'del-no': confirmDel = null; renderGoals(); break;
      case 'del-yes': S.habits = S.habits.filter(h => h.id !== id); for (const k in S.logs) delete S.logs[k][id]; confirmDel = null; gearOpen = null; save(); renderGoals(); toast('Habit deleted forever'); break;
      case 'clear-examples': { const names = S.habits.map(h => ({ name: h.name, goal: h.goal })); S = RRStore.blank(); names.forEach(n => S.habits.push({ id: RRStore.uid(), name: n.name, goal: n.goal, start: tk })); S.sel = S.habits[0] && S.habits[0].id; save(); for (const k in prevRing) delete prevRing[k]; RENDER[view](); toast('Examples cleared. Your habits start today.'); break; }
      case 'article': { const ar = window.RR_ARTICLES.find(x => x.id === b.dataset.a); openSheet(ar.t, `<p class="eyebrow" style="margin-bottom:10px">${esc(ar.tag)} · ${ar.min} min read</p><div class="prose">${ar.b}</div><div class="actions" style="margin-top:26px"><button class="btn btn-primary" data-press data-act="close-sheet">Done reading</button><a class="btn-text" href="articles/${ar.id}">Open as a full page</a></div>`); break; }
      case 'invite': { const url = new URL('register', document.baseURI).href;
        const share = () => navigator.share ? navigator.share({ title: 'Re:Root', text: 'I use Re:Root to quit habits I keep going back to. Join me:', url }).catch(() => {}) : toast(url);
        if (navigator.clipboard) navigator.clipboard.writeText(url).then(() => { toast('Invite link copied'); b.textContent = 'Link copied'; }, share); else share(); break; }
      case 'breathe': breath.on ? stopBreath() : startBreath(); break;
      case 'enable-notif': $('#m-notif').click(); setTimeout(() => RENDER[view](), 600); break;
    }
  }, { signal });;

  go(VIEWS.includes(initialTab) ? initialTab : 'home', { instant: true, fromRouter: true });
  signal.addEventListener('abort', () => { clearTimeout(remT); breath.on && stopBreath(); document.body.style.overflow = ''; });
  document.fonts && document.fonts.ready.then(() => placeInd(true));
  document.documentElement.classList.add('ready');
  return { go: (v, o) => go(v, o) };
};
