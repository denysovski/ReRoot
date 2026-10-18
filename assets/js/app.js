/* Re:Root app — logged-in experience. */
(function () {
  const { $, $$, esc, clamp, Spring, tracker, project, rubber, theme, auth, menu, toast, glass, motion, key, addDays, fromKey, fmt, tzGuess, closeAll } = RR;
  let user = auth.require('login.html'); if (!user) return;
  if (!user.prefs.onboarded) { location.replace('onboarding.html'); return; }
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
      new Spring(0, { eps: .0005 }).on(p => { arc.style.strokeDashoffset = RC * (1 - (from.f + (to - from.f) * p)); b.textContent = Math.round(from.n + (n - from.n) * p); }).to(1, { response: .7, damping: 1 });
      prevRing[id] = { f: to, n };
    });
  }
  const countUp = (el, to) => new Spring(0, { eps: .001 }).on(p => el.textContent = Math.round(to * p)).to(1, { response: 1, damping: 1 });

  /* ---------- corner menus ---------- */
  menu($('#brand-btn'), $('#brand-menu'), { origin: 'top left' });
  const acct = menu($('#acct-btn'), $('#acct-menu'), { origin: 'top right' });
  function paintAcct() {
    user = auth.current();
    $('#m-name').textContent = user.name; $('#m-email').textContent = user.email;
    $$('#m-theme button').forEach(b => b.setAttribute('aria-pressed', b.dataset.t === theme.get()));
    $('#m-notif').setAttribute('aria-checked', !!user.prefs.notif); $('#m-time').value = user.prefs.reminder || '20:00';
  }
  const zones = (() => { try { return Intl.supportedValuesOf('timeZone'); } catch (e) { return ['UTC', 'Europe/London', 'Europe/Prague', 'Europe/Berlin', 'America/New_York', 'America/Los_Angeles', 'Asia/Tokyo', 'Australia/Sydney']; } })();
  if (!zones.includes(tz())) zones.unshift(tz());
  $('#m-tz').innerHTML = zones.map(z => `<option value="${z}" ${z === tz() ? 'selected' : ''}>${z.replace(/_/g, ' ')}</option>`).join('');
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
  $('#m-replay').addEventListener('click', () => { auth.update({ prefs: { onboarded: false } }); location.href = 'onboarding.html'; });
  $('#m-reset').addEventListener('click', () => { $('#m-reset-confirm').hidden = false; $('#m-reset').hidden = true; });
  $('#m-reset-no').addEventListener('click', () => { $('#m-reset-confirm').hidden = true; $('#m-reset').hidden = false; });
  $('#m-reset-yes').addEventListener('click', () => { S = RRStore.blank(); save(); for (const k in prevRing) delete prevRing[k]; $('#m-reset-confirm').hidden = true; $('#m-reset').hidden = false; acct.hide(); RENDER[view](); toast('All check-ins deleted'); });
  $('#m-logout').addEventListener('click', () => { auth.logout(); location.href = 'index.html'; });
  paintAcct();

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
  viewP.on(p => { if (!incoming) return; incoming.style.opacity = p; incoming.style.transform = p >= 1 ? '' : `translateY(${(1 - p) * 14}px) scale(${.985 + .015 * p})`; incoming.style.filter = p >= .999 || motion.reduce ? '' : `blur(${(1 - p) * 8}px)`; });
  const RENDER = { home: renderHome, today: renderToday, progress: renderProgress, goals: renderGoals, read: renderRead };
  function go(v, { instant } = {}) {
    if (!VIEWS.includes(v)) v = 'home';
    const changed = v !== view; view = v;
    $$('.tab').forEach(t => t.removeAttribute('aria-current')); $(`.tab[data-nav="${v}"]`).setAttribute('aria-current', 'page');
    requestAnimationFrame(() => placeInd(instant));
    $$('.view').forEach(s => s.hidden = s.dataset.view !== v);
    incoming = $(`.view[data-view="${v}"]`); RENDER[v]();
    if (changed) { window.scrollTo(0, 0); if (instant) viewP.set(1); else { viewP.set(0); viewP.to(1, { response: .42, damping: 1 }); } }
    try { history.replaceState(null, '', '#' + v); } catch (e) {}
  }
  document.addEventListener('click', e => { const n = e.target.closest('[data-nav]'); if (n) { e.preventDefault(); go(n.dataset.nav); } });
  addEventListener('resize', () => placeInd(true));

  const exampleBanner = () => S.example ? `<div class="glass banner"><span>You're looking at example history so the charts have something to show.</span><button class="btn-text" data-act="clear-examples">Clear examples and start fresh</button></div>` : '';
  const emptyState = () => `<div class="glass empty"><h3>What do you want to quit?</h3><p>Add a habit like nail biting, late-night scrolling or anything else you want to stop. Then check in once a day.</p><div class="actions-row"><button class="btn btn-primary" data-press data-act="add">Add your first habit</button><a class="btn-text" href="how-it-works.html">How Re:Root works</a></div></div>`;
  const greet = () => { const h = now().getHours(); return h < 5 ? 'Still up' : h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening'; };

  /* ---------- HOME ---------- */
  function renderHome() {
    const r = $('#home-root'), tk = todayKey();
    let best = null, bn = -1; S.habits.forEach(h => { const n = currentStreak(h); if (n > bn) { bn = n; best = h; } });
    const done = S.habits.filter(h => (getLog(h.id, tk) || {}).s).length;
    const strip = best ? Array.from({ length: 30 }, (_, i) => { const l = getLog(best.id, key(addDays(now(), i - 29))); return `<i class="${l && l.s ? l.s : ''}"></i>`; }).join('') : '';
    const A = window.RR_ARTICLES, tip = A[now().getDate() % A.length];
    r.innerHTML = `<header class="vhead"><p class="eyebrow">${fmt(now(), { weekday: 'long', month: 'long', day: 'numeric' })} · ${now().toTimeString().slice(0, 5)}</p><h1 class="vtitle">${greet()}, ${esc(user.name)}.</h1></header>
      ${exampleBanner()}
      ${S.habits.length ? `<div class="dash">
        <section class="glass dash-hero" data-glass="4"><div><p class="eyebrow">Longest current run</p><div class="big-n" style="margin-top:14px"><b id="home-n">0</b><span>days</span></div><p class="vsub" style="margin-top:10px">clean from ${esc(best.name.toLowerCase())} · goal ${best.goal} days</p></div>
          <div style="display:grid;gap:14px"><div class="strip" aria-label="Last 30 days">${strip}</div>
          <div class="actions-row"><button class="btn btn-primary" data-press data-nav="today">${done === S.habits.length ? 'Review today' : 'Check in for today'}</button><button class="btn-text" data-nav="progress">See your progress</button></div></div></section>
        <div class="dash-side">
          <section class="glass card"><div class="chart-h"><h3 style="font-size:17px">Today</h3><small>${done} of ${S.habits.length} checked in</small></div><div class="status-list">${S.habits.map(h => { const l = getLog(h.id, tk) || {}; return `<div class="status"><span>${esc(h.name)}</span><em class="${l.s === 'c' ? 'c' : ''}">${l.s === 'c' ? 'Clean' : l.s === 'x' ? 'Slipped' : 'Not yet'}</em></div>`; }).join('')}</div></section>
          <button class="glass card link-card" data-glass data-act="article" data-a="${tip.id}" style="text-align:left"><span class="eyebrow">Today's read · ${tip.min} min</span><h3>${esc(tip.t)}</h3><p>${esc(tip.d)}</p></button>
          <a class="glass card link-card" data-glass href="community.html"><span class="eyebrow">Community</span><h3>Talk to people quitting the same thing</h3><p>Rooms for nail biting, porn and masturbation, smoking, late nights and wins.</p></a>
        </div></div>` : emptyState()}`;
    const hn = $('#home-n'); hn && countUp(hn, bn);
    glass(r);
  }

  /* ---------- TODAY ---------- */
  function habitCard(h) {
    const tk = todayKey(), l = getLog(h.id, tk) || {}, n = currentStreak(h), nm = nextMile(n);
    const week = Array.from({ length: 7 }, (_, i) => addDays(now(), i - 6)).map(d => { const k = key(d), g = getLog(h.id, k), cls = g && g.s ? g.s : '', before = k < h.start;
      return `<div class="wd"><button class="dot ${cls} ${k === tk ? 'today' : ''}" data-press data-act="cycle" data-h="${h.id}" data-k="${k}" ${before ? 'disabled style="opacity:.3"' : ''} aria-label="${fmt(d, { weekday: 'long', month: 'short', day: 'numeric' })}: ${cls === 'c' ? 'clean' : cls === 'x' ? 'slipped' : 'not logged'}"></button>${fmt(d, { weekday: 'narrow' })}</div>`; }).join('');
    return `<article class="glass card hc">
      <div class="hc-top"><div style="min-width:0"><div class="hc-name">${esc(h.name)}</div><div class="hc-meta">${n} of ${h.goal} days${nm ? ` · next milestone ${nm}` : ''}</div></div>${ringSVG(h.id, clamp(n / h.goal), n)}</div>
      <div class="week">${week}</div>
      <div class="choice"><button data-press data-act="clean" data-h="${h.id}" aria-pressed="${l.s === 'c'}">Stayed clean</button><button data-press data-act="slip" data-h="${h.id}" aria-pressed="${l.s === 'x'}">Slipped</button></div>
      <div class="urge"><div class="urge-lab"><span>Urge strength today</span><span>0 none · 5 intense</span></div><div class="seg" role="group" aria-label="Urge strength">${[0, 1, 2, 3, 4, 5].map(u => `<button data-press data-act="urge" data-h="${h.id}" data-u="${u}" aria-pressed="${l.u === u}">${u}</button>`).join('')}</div></div>
      ${l.s === 'x' ? `<p class="slipnote">A slip is information, not a verdict. Your earlier clean days still count. <button data-act="article" data-a="slip">What to do next</button></p>` : ''}
    </article>`;
  }
  function renderToday() {
    const r = $('#today-root'), tk = todayKey(), done = S.habits.filter(h => (getLog(h.id, tk) || {}).s).length;
    const remind = !user.prefs.notif ? `<div class="glass reminder-bar"><span class="muted">Want a daily nudge to check in?</span><button class="btn btn-primary btn-sm" data-press data-act="enable-notif">Yes, remind me</button></div>` : '';
    r.innerHTML = `<header class="vhead"><p class="eyebrow">${fmt(now(), { weekday: 'long', month: 'long', day: 'numeric' })}</p><h1 class="vtitle">Today</h1>
      <p class="vsub">${S.habits.length ? `${done} of ${S.habits.length} checked in. Tap a day in the week row to fix a missed check-in.` : 'Nothing tracked yet.'}</p></header>
      ${exampleBanner()}${S.habits.length ? remind : ''}
      ${S.habits.length ? `<div class="cards">${S.habits.map(habitCard).join('')}<button class="addcard" data-press data-act="add">+ Add a habit</button></div>
      <section class="glass card note"><label for="note-today" style="font-weight:600">What helped today?</label><textarea id="note-today" placeholder="A walk after dinner, texting a friend, leaving the phone in the kitchen…">${esc(S.notes[tk] || '')}</textarea><small>Saved automatically in this browser.</small></section>` : emptyState()}`;
    animateRings(r);
    const ta = $('#note-today'); ta && ta.addEventListener('input', () => { S.notes[tk] = ta.value; save(); });
  }

  /* ---------- PROGRESS ---------- */
  function lineChart(h) {
    const data = daySeries(h, 30), W = 640, H = 230, L = 34, R = 44, T = 14, B = 28;
    const mx = Math.max(...data.map(d => d.v), 1), top = mx <= 5 ? 5 : mx <= 10 ? 10 : Math.ceil(mx / 10) * 10;
    const x = i => L + i * (W - L - R) / (data.length - 1), y = v => T + (1 - v / top) * (H - T - B);
    const pts = data.map((d, i) => `${x(i).toFixed(1)},${y(d.v).toFixed(1)}`), last = data[data.length - 1];
    return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Streak length over the last 30 days, now ${last.v} days">
      <defs><linearGradient id="ag" x1="0" y1="0" x2="0" y2="1"><stop offset="0" style="stop-color:var(--fg);stop-opacity:.16"/><stop offset="1" style="stop-color:var(--fg);stop-opacity:0"/></linearGradient></defs>
      ${[0, top / 2, top].map(t => `<line class="grid" x1="${L}" x2="${W - R}" y1="${y(t)}" y2="${y(t)}"/><text x="${L - 8}" y="${y(t) + 4}" text-anchor="end">${t % 1 ? t.toFixed(1) : t}</text>`).join('')}
      ${[0, 15, 29].map(i => `<text x="${x(i)}" y="${H - 6}" text-anchor="${i === 0 ? 'start' : i === 29 ? 'end' : 'middle'}">${i === 29 ? 'Today' : fmt(fromKey(data[i].k), { month: 'short', day: 'numeric' })}</text>`).join('')}
      <path class="anim-area" d="M${pts.join('L')}L${x(29)},${y(0)}L${x(0)},${y(0)}Z" fill="url(#ag)" opacity="0"/>
      <path class="anim-line" d="M${pts.join('L')}" fill="none" style="stroke:var(--fg)" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round" pathLength="1" stroke-dasharray="1" stroke-dashoffset="1"/>
      <circle class="anim-end" cx="${x(29)}" cy="${y(last.v)}" r="5" style="fill:var(--fg);stroke:var(--surface)" stroke-width="3" opacity="0"/>
      <text class="anim-end" x="${x(29) + 10}" y="${y(last.v) + 4}" style="fill:var(--fg);font-weight:600" opacity="0">${last.v}</text></svg>`;
  }
  function urgeChart(h) {
    const days = Array.from({ length: 14 }, (_, i) => addDays(now(), i - 13)), W = 360, H = 230, L = 22, R = 6, T = 14, B = 28, band = (W - L - R) / 14, bw = band * .56;
    const y = v => T + (1 - v / 5) * (H - T - B);
    return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Urge strength, last 14 days">
      ${[0, 1, 2, 3, 4, 5].map(t => `<line class="grid" x1="${L}" x2="${W - R}" y1="${y(t)}" y2="${y(t)}" ${t % 5 ? 'stroke-dasharray="2 4"' : ''}/>`).join('')}
      <text x="${L - 6}" y="${y(5) + 4}" text-anchor="end">5</text><text x="${L - 6}" y="${y(0) + 4}" text-anchor="end">0</text>
      ${days.map((d, i) => { const l = getLog(h.id, key(d)), cx = L + band * i + band / 2;
        const bar = l && l.u != null ? (l.u === 0 ? `<line x1="${cx - bw / 2}" x2="${cx + bw / 2}" y1="${y(0) - 1}" y2="${y(0) - 1}" style="stroke:var(--fg)" stroke-width="2"/>`
          : `<rect class="anim-bar" x="${cx - bw / 2}" y="${y(l.u)}" width="${bw}" height="${y(0) - y(l.u)}" rx="3" style="fill:var(--fg);opacity:${l.s === 'x' ? 1 : .55};transform-origin:${cx}px ${y(0)}px"/>`) : '';
        return `${bar}<text x="${cx}" y="${H - 8}" text-anchor="middle" ${i === 13 ? 'style="fill:var(--fg)"' : ''}>${fmt(d, { weekday: 'narrow' })}</text>`; }).join('')}</svg>`;
  }
  function heatmap(h) {
    const today = now(), tk = todayKey(), dow = (today.getDay() + 6) % 7, start = addDays(today, -dow - 77), c = 15, g = 4, L = 22, T = 18;
    const W = L + 12 * (c + g), H = T + 7 * (c + g); let cells = '', months = '', lastM = -1, lastW = -9;
    for (let w = 0; w < 12; w++) {
      const wd = addDays(start, w * 7);
      if (wd.getMonth() !== lastM) { lastM = wd.getMonth(); if (w < 11 && w - lastW >= 3 && (lastW = w) >= 0) months += `<text x="${L + w * (c + g)}" y="11">${fmt(wd, { month: 'short' })}</text>`; }
      for (let d = 0; d < 7; d++) {
        const day = addDays(start, w * 7 + d), k = key(day); if (k > tk) continue;
        const l = getLog(h.id, k), X = L + w * (c + g), Y = T + d * (c + g), before = k < h.start;
        const st = l && l.s === 'c' ? 'fill:var(--fg)' : l && l.s === 'x' ? 'fill:var(--surface);stroke:var(--fg);stroke-width:1.5' : 'fill:var(--faint)';
        cells += `<rect class="anim-cell" data-o="${before && !(l && l.s) ? .35 : 1}" x="${X}" y="${Y}" width="${c}" height="${c}" rx="3.5" style="${st}"${k === tk ? ' stroke-dasharray="2 2"' : ''}><title>${fmt(day, { month: 'short', day: 'numeric' })}: ${l && l.s === 'c' ? 'clean' : l && l.s === 'x' ? 'slipped' : 'not logged'}</title></rect>`;
        if (l && l.s === 'x') cells += `<line class="anim-cell" data-o="1" x1="${X + 4}" y1="${Y + c - 4}" x2="${X + c - 4}" y2="${Y + 4}" style="stroke:var(--fg)" stroke-width="1.5"/>`;
      }
    }
    const dl = ['M', '', 'W', '', 'F', '', ''].map((t, d) => t ? `<text x="0" y="${T + d * (c + g) + 11}">${t}</text>` : '').join('');
    return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Calendar of the last 12 weeks" style="max-width:${W * 1.7}px">${months}${dl}${cells}</svg>`;
  }
  function renderProgress() {
    const r = $('#progress-root');
    if (!S.habits.length) { r.innerHTML = `<header class="vhead"><h1 class="vtitle">Progress</h1></header>${emptyState()}`; return; }
    if (!S.habits.find(h => h.id === S.sel)) S.sel = S.habits[0].id;
    const h = S.habits.find(x => x.id === S.sel), cur = currentStreak(h), lng = longest(h), rt = rate(h, 30), au = avgUrge(h, 14);
    r.innerHTML = `<header class="vhead"><p class="eyebrow">Last 30 days</p><h1 class="vtitle">Progress</h1></header>
      <div class="chips" role="group" aria-label="Habit">${S.habits.map(x => `<button class="chip" data-press data-act="pick" data-h="${x.id}" aria-pressed="${x.id === h.id}">${esc(x.name)}</button>`).join('')}</div>
      <div class="stats">
        <div class="glass card stat"><b data-count="${cur}">0</b><span>Current streak, days</span></div>
        <div class="glass card stat"><b data-count="${lng}">0</b><span>Longest streak, days</span></div>
        <div class="glass card stat"><b><span data-count="${rt}">0</span>%</b><span>Clean days, last 30</span></div>
        <div class="glass card stat"><b>${au == null ? '–' : au.toFixed(1)}</b><span>Average urge, 0–5, last 14</span></div></div>
      <div class="charts">
        <section class="glass card chart"><div class="chart-h"><h3>Streak length</h3><small>days in a row, as of each day</small></div>${lineChart(h)}</section>
        <section class="glass card chart"><div class="chart-h"><h3>Urge strength</h3><small>last 14 days</small></div>${urgeChart(h)}<div class="legend"><span>Darker bar: slipped that day</span></div></section>
        <section class="glass card chart span2"><div class="chart-h"><h3>12-week calendar</h3><small>Monday to Sunday, newest on the right</small></div><div style="overflow-x:auto">${heatmap(h)}</div>
          <div class="legend"><span><i class="c"></i>Clean</span><span><i class="x"></i>Slipped</span><span><i></i>Not logged</span></div></section></div>`;
    $$('[data-count]', r).forEach(el => countUp(el, +el.dataset.count));
    const line = $('.anim-line', r), area = $('.anim-area', r), ends = $$('.anim-end', r), bars = $$('.anim-bar', r), cells = $$('.anim-cell', r);
    new Spring(0, { eps: .0005 }).on(p => {
      line.setAttribute('stroke-dashoffset', 1 - p); area.setAttribute('opacity', clamp(p * 1.4 - .3));
      ends.forEach(e => e.setAttribute('opacity', clamp(p * 4 - 3)));
      bars.forEach((b, i) => b.style.transform = `scaleY(${clamp(p * 1.6 - i / bars.length * .6)})`);
      cells.forEach((c, i) => c.style.opacity = (+c.dataset.o || 1) * clamp(p * 1.8 - i / cells.length * .8));
    }).to(1, { response: 1.1, damping: 1 });
  }

  /* ---------- GOALS ---------- */
  let confirmDel = null;
  function renderGoals() {
    const r = $('#goals-root');
    r.innerHTML = `<header class="vhead"><p class="eyebrow">Targets and milestones</p><h1 class="vtitle">Goals</h1><p class="vsub">Milestones unlock as your current streak grows.</p></header>
    ${S.habits.length ? `<div class="cards">${S.habits.map(h => { const n = currentStreak(h), nm = nextMile(n), left = Math.max(0, h.goal - n);
      return `<article class="glass card gc">
        <div class="gc-top">${ringSVG(h.id, clamp(n / h.goal), n, 'lg')}<div style="min-width:0"><h3>${esc(h.name)}</h3>
          <p>${left ? `${left} day${left === 1 ? '' : 's'} to your ${h.goal}-day goal` : `Goal reached. ${n} days and counting.`}</p>
          <p>${nm ? `Next milestone: day ${nm}` : 'Every milestone collected.'} · since ${fmt(fromKey(h.start), { month: 'short', day: 'numeric' })}</p></div></div>
        <div class="miles">${MILES.map(m => `<span class="mile ${n >= m ? 'on' : ''}">${m}d</span>`).join('')}</div>
        <div class="row"><span class="lab">Goal</span>${[7, 14, 30, 60, 90, 365].map(g => `<button class="chip" data-press data-act="goal" data-h="${h.id}" data-g="${g}" aria-pressed="${h.goal === g}">${g}</button>`).join('')}</div>
        ${confirmDel === h.id ? `<div class="confirm"><span>Delete ${esc(h.name)} and all its check-ins?</span><button class="btn btn-primary btn-sm" data-press data-act="del-yes" data-h="${h.id}">Delete habit</button><button class="btn-text" data-act="del-no">Keep it</button></div>`
          : `<div><button class="btn-text" data-act="del" data-h="${h.id}">Delete habit</button></div>`}
      </article>`; }).join('')}<button class="addcard" data-press data-act="add">+ Add a habit</button></div>` : emptyState()}`;
    animateRings(r);
  }

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
  function openSheet(title, html) {
    closeAll(); lastFocus = document.activeElement;
    $('#sheet-title').textContent = title; $('#sheet-body').innerHTML = html; $('#sheet-body').scrollTop = 0;
    const was = sheet.hidden; sheet.hidden = false; scrim.hidden = false; sheetH = sheet.offsetHeight + 30;
    if (was) sheetY.set(sheetH);
    sheetY.to(0, { response: .32, damping: .86 }); document.body.style.overflow = 'hidden';
    setTimeout(() => { const f = $('#sheet-body input'); (f || $('.close-x', sheet)).focus({ preventScroll: true }); }, motion.reduce ? 0 : 280);
  }
  function closeSheet(v = 0) {
    sheetY.to(sheetH, { response: .3, damping: 1, velocity: v, onRest: () => { sheet.hidden = true; scrim.hidden = true; } });
    document.body.style.overflow = ''; lastFocus && lastFocus.focus && lastFocus.focus({ preventScroll: true });
  }
  scrim.addEventListener('click', () => closeSheet());
  addEventListener('keydown', e => { if (e.key === 'Escape' && !sheet.hidden) closeSheet(); });
  (() => {
    let drag = null; const vt = tracker();
    const down = e => { if (e.target.closest('button')) return; sheetY.stop(); drag = { id: e.pointerId, y0: e.clientY, s0: sheetY.value }; vt.reset(); vt.add(sheetY.value); e.currentTarget.setPointerCapture(e.pointerId); };
    const move = e => { if (!drag || e.pointerId !== drag.id) return; let y = drag.s0 + (e.clientY - drag.y0); if (y < 0) y = -rubber(-y, sheetH); sheetY.value = sheetY.target = y; sheetY.emit(); vt.add(y); };
    const up = e => { if (!drag || e.pointerId !== drag.id) return; drag = null; const v = vt.v(), y = sheetY.value;
      if (y + project(v) > sheetH * .45 && y > 0) closeSheet(v); else sheetY.to(0, { response: .32, damping: Math.abs(v) > 300 ? .8 : 1, velocity: v }); };
    [$('#grab'), $('#sheet-head')].forEach(el => { el.addEventListener('pointerdown', down); el.addEventListener('pointermove', move); el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up); });
  })();
  let newGoal = 30;
  const addForm = () => `<form id="habit-form" novalidate>
    <div class="field"><label for="f-name">Habit you want to quit</label><input class="input" id="f-name" maxlength="40" placeholder="e.g. Nail biting" autocomplete="off"></div>
    <div class="field"><label>Goal streak, in days</label><div class="row" id="goal-row">${[7, 14, 30, 60, 90, 365].map(g => `<button type="button" class="chip" data-press data-act="pick-goal" data-g="${g}" aria-pressed="${g === newGoal}">${g}</button>`).join('')}</div></div>
    <div class="field"><label for="f-start">Tracking starts</label><input class="input" id="f-start" type="date" value="${todayKey()}" max="${todayKey()}"></div>
    <div class="actions"><button class="btn btn-primary btn-block" type="submit" data-press>Add habit</button><button type="button" class="btn-text" data-act="close-sheet">Cancel</button></div></form>`;
  document.addEventListener('submit', e => {
    if (e.target.id !== 'habit-form') return; e.preventDefault();
    const name = $('#f-name').value.trim(), start = $('#f-start').value || todayKey();
    if (!name) { const f = $('#f-name').closest('.field'); if (!$('.err', f)) f.insertAdjacentHTML('beforeend', '<p class="err">Give the habit a name, for example "Nail biting".</p>'); $('#f-name').focus(); return; }
    const h = { id: RRStore.uid(), name, goal: newGoal, start: start > todayKey() ? todayKey() : start };
    S.habits.push(h); S.sel = h.id; save(); closeSheet(); buzz(); toast(`Added ${name}`);
    if (view === 'home') go('today'); else RENDER[view]();
  });

  /* ---------- actions ---------- */
  document.addEventListener('click', async e => {
    const b = e.target.closest('[data-act]'); if (!b) return;
    const a = b.dataset.act, id = b.dataset.h, tk = todayKey();
    switch (a) {
      case 'clean': case 'slip': { const s = a === 'clean' ? 'c' : 'x', cur = getLog(id, tk) || {}; setLog(id, tk, { s: cur.s === s ? undefined : s }); buzz(); renderToday(); if (s === 'c' && cur.s !== 'c') toast('Logged. One more clean day.'); break; }
      case 'urge': { const u = +b.dataset.u, cur = getLog(id, tk) || {}; setLog(id, tk, { u: cur.u === u ? undefined : u }); renderToday(); break; }
      case 'cycle': { const k = b.dataset.k, cur = (getLog(id, k) || {}).s; setLog(id, k, { s: cur === 'c' ? 'x' : cur === 'x' ? undefined : 'c' }); buzz(); renderToday(); break; }
      case 'add': newGoal = 30; openSheet('New habit', addForm()); break;
      case 'pick-goal': newGoal = +b.dataset.g; $$('#goal-row .chip').forEach(c => c.setAttribute('aria-pressed', +c.dataset.g === newGoal)); break;
      case 'close-sheet': closeSheet(); break;
      case 'pick': S.sel = id; save(); renderProgress(); break;
      case 'goal': S.habits.find(h => h.id === id).goal = +b.dataset.g; save(); renderGoals(); break;
      case 'del': confirmDel = id; renderGoals(); break;
      case 'del-no': confirmDel = null; renderGoals(); break;
      case 'del-yes': S.habits = S.habits.filter(h => h.id !== id); for (const k in S.logs) delete S.logs[k][id]; confirmDel = null; save(); renderGoals(); toast('Habit deleted'); break;
      case 'clear-examples': { const names = S.habits.map(h => ({ name: h.name, goal: h.goal })); S = RRStore.blank(); names.forEach(n => S.habits.push({ id: RRStore.uid(), name: n.name, goal: n.goal, start: tk })); S.sel = S.habits[0] && S.habits[0].id; save(); for (const k in prevRing) delete prevRing[k]; RENDER[view](); toast('Examples cleared. Your habits start today.'); break; }
      case 'article': { const ar = window.RR_ARTICLES.find(x => x.id === b.dataset.a); openSheet(ar.t, `<p class="eyebrow" style="margin-bottom:10px">${esc(ar.tag)} · ${ar.min} min read</p><div class="prose">${ar.b}</div><div class="actions" style="margin-top:26px"><button class="btn btn-primary" data-press data-act="close-sheet">Done reading</button><a class="btn-text" href="article.html?id=${ar.id}">Open as a full page</a></div>`); break; }
      case 'breathe': breath.on ? stopBreath() : startBreath(); break;
      case 'enable-notif': $('#m-notif').click(); setTimeout(() => RENDER[view](), 600); break;
    }
  });

  const initial = location.hash.slice(1);
  go(VIEWS.includes(initial) ? initial : 'home', { instant: true });
  document.fonts && document.fonts.ready.then(() => placeInd(true));
  document.documentElement.classList.add('ready');
})();
