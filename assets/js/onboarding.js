/* Re:Root onboarding — one decision per screen; white button = yes, underlined text = skip. */
RR.mountOnboarding = function (layoutRoot, signal) {
  const { $, $$, esc, Spring, auth, theme, motion, key, glass } = RR;
  const user = auth.current(); if (!user) return;
  const ICON = {
    leaf: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M17 18a5 5 0 0 0-10 0"/><path d="M12 2v7M4.2 10.2l1.4 1.4M1 18h2M21 18h2M18.4 11.6l1.4-1.4M23 22H1M8 6l4-4 4 4"/></svg>',
    target: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.3" fill="currentColor"/></svg>',
    bell: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9a6 6 0 1 1 12 0c0 6 2.5 7.5 2.5 7.5h-17S6 15 6 9M10 20a2 2 0 0 0 4 0"/></svg>',
    check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
  };
  const PRESETS = ['Nail biting', 'Masturbation', 'Porn', 'Smoking', 'Vaping', 'Alcohol', 'Sugar', 'Doomscrolling', 'Phone in bed', 'Gaming', 'Skin picking', 'Caffeine'];
  const st = { step: 0, habits: [], goal: 30, notif: false, reminder: user.prefs.reminder || '20:00', theme: theme.get(), permMsg: '' };
  const TIMES = []; for (let h = 6; h < 24; h++) for (const m of ['00', '30']) TIMES.push(String(h).padStart(2, '0') + ':' + m);
  const STEPS = ['welcome', 'habits', 'goal', 'notif', 'theme', 'done'];
  const stage = $('#stage'), back = $('#ob-back');
  $('#dots').innerHTML = STEPS.map(() => '<i></i>').join('');

  const T = {
    welcome: () => `<div class="ob-art glass">${ICON.leaf}</div>
      <h1>Welcome, ${esc(user.name)}.</h1><p class="sub">Let's set up Re:Root in five quick steps. You can change everything later.</p>
      <div class="actions"><button class="btn btn-primary" data-press data-go="next">Let's set it up</button><button class="btn-text" data-go="finish">Skip setup and open the app</button></div>`,
    habits: () => `<h1>What do you want to quit?</h1><p class="sub">Pick one or more. Each habit gets its own streak and goal.</p>
      <div class="ob-choices">${[...new Set([...PRESETS, ...st.habits])].map(h => `<button class="chip" data-press data-habit="${esc(h)}" aria-pressed="${st.habits.includes(h)}">${esc(h)}</button>`).join('')}</div>
      <form class="ob-custom" id="custom"><input class="input" id="custom-in" maxlength="40" placeholder="Something else…" aria-label="Add your own habit"><button class="btn btn-glass btn-sm" data-press type="submit">Add</button></form>
      <div class="actions"><button class="btn btn-primary" data-press data-go="next" ${st.habits.length ? '' : 'disabled'}>Continue</button><button class="btn-text" data-go="skip">Skip this step</button></div>`,
    goal: () => `<div class="ob-art glass">${ICON.target}</div><h1>Set your first goal.</h1><p class="sub">How many clean days in a row are you aiming for? Shorter goals are easier to reach and restart.</p>
      <div class="ob-goals">${[[7, 'one week'], [14, 'two weeks'], [30, 'a month'], [60, 'two months'], [90, 'three months']].map(([g, l]) => `<button class="glass ob-goal" data-press data-goal="${g}" aria-pressed="${st.goal === g}"><b>${g}</b><span>${l}</span></button>`).join('')}</div>
      <div class="actions"><button class="btn btn-primary" data-press data-go="next"><span class="fade-t">Set a ${st.goal}-day goal</span></button><button class="btn-text" data-go="skip">Skip this step</button></div>`,
    notif: () => `<div class="ob-art glass">${ICON.bell}</div><h1>Do you want to get notifications?</h1><p class="sub">A gentle daily reminder to check in, at a time you choose.</p>
      <div class="ob-time"><span id="rem-l">Remind me at</span><div class="tsel" id="tsel"><button type="button" class="tsel-btn" aria-haspopup="listbox" aria-expanded="false" aria-labelledby="rem-l"><b class="mono">${esc(st.reminder)}</b><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg></button>
        <ul class="tsel-list" role="listbox" tabindex="-1">${TIMES.map(t => `<li role="option" data-time="${t}" aria-selected="${t === st.reminder}">${t}</li>`).join('')}</ul></div></div>
      <p class="perm" id="perm">${esc(st.permMsg)}</p>
      <div class="actions">${st.notif || st.asked ? `<button class="btn btn-primary" data-press data-go="next">Continue</button>` : `<button class="btn btn-primary" data-press data-act="notif-yes">Yes, I want notifications</button>`}<button class="btn-text" data-go="skip">${st.notif ? 'Turn them off again' : 'Skip this step'}</button></div>`,
    theme: () => `<h1>Light, dark or automatic?</h1><p class="sub">Re:Root is black and white either way. Pick what's easiest on your eyes.</p>
      <div class="ob-themes">${[['light', 'Light', 'l'], ['dark', 'Dark', 'd'], ['system', 'Automatic', 's']].map(([v, l, c]) => `<button class="glass ob-theme" data-press data-theme="${v}" aria-pressed="${st.theme === v}"><span class="pv ${c}"><i></i><i></i><i></i></span>${l}</button>`).join('')}</div>
      <div class="actions"><button class="btn btn-primary" data-press data-go="next">Continue</button><button class="btn-text" data-go="skip">Skip this step</button></div>`,
    done: () => `<div class="ob-art glass">${ICON.check}</div><h1>You're all set.</h1><p class="sub">Your first check-in is waiting. Come back every day, even the hard ones.</p>
      <div class="ob-done-list">
        <div class="glass">${ICON.check}${st.habits.length ? `Tracking ${esc(st.habits.join(', '))}` : 'No habits yet, add them in the app'}</div>
        <div class="glass">${ICON.check}Goal: ${st.goal} days in a row</div>
        <div class="glass">${ICON.check}${st.notif ? `Daily reminder at ${esc(st.reminder)}` : 'No reminders'}</div>
        <div class="glass">${ICON.check}${{ light: 'Light', dark: 'Dark', system: 'Automatic' }[st.theme]} theme</div>
      </div>
      <div class="actions"><button class="btn btn-primary" data-press data-go="finish">Open Re:Root</button>${st.habits.length ? '<button class="btn-text" data-go="example">Fill it with example history first</button>' : ''}</div>`,
  };

  const p = new Spring(1, { eps: .001 }); let dir = 1, cur = null;
  p.on(v => { if (!cur) return; cur.style.opacity = v; cur.style.transform = v >= 1 ? '' : `translateX(${(1 - v) * 48 * dir}px) scale(${.97 + .03 * v})`; cur.style.filter = v >= .999 || motion.reduce ? '' : `blur(${(1 - v) * 10}px)`; });
  function render(animate = true) {
    stage.innerHTML = `<div class="ob-step">${T[STEPS[st.step]]()}</div>`;
    cur = stage.firstElementChild;
    $$('#dots i').forEach((d, i) => d.classList.toggle('on', i === st.step));
    back.style.visibility = st.step > 0 && st.step < STEPS.length ? 'visible' : 'hidden';
    if (animate) { p.set(0); p.to(1, { response: .45, damping: .9 }); } else p.set(1);
    const f = stage.querySelector('.btn-primary:not([disabled])'); f && f.focus({ preventScroll: true });
    glass(stage);
  }
  function go(n) { dir = n > st.step ? 1 : -1; st.step = Math.max(0, Math.min(STEPS.length - 1, n)); render(); }
  back.addEventListener('click', () => go(st.step - 1));

  function finish(example) {
    const S = example ? RRStore.seed(st.habits.map(name => ({ name, goal: st.goal }))) : RRStore.blank();
    if (!example) { const today = key(new Date()); st.habits.forEach(name => S.habits.push({ id: RRStore.uid(), name, goal: st.goal, start: today })); S.sel = S.habits[0] && S.habits[0].id; }
    const existing = RRStore.load(user.email);
    if (existing.habits.length && !example) { existing.habits.push(...S.habits.filter(h => !existing.habits.some(e => e.name === h.name))); RRStore.save(user.email, existing); }
    else RRStore.save(user.email, S);
    auth.update({ prefs: { onboarded: true, notif: st.notif, reminder: st.reminder } });
    RR.navigate('app/today');
  }

  document.addEventListener('click', e => {
    if (!stage.isConnected) return;
    const g = e.target.closest('[data-go]');
    if (g) {
      const a = g.dataset.go;
      if (a === 'next') go(st.step + 1);
      else if (a === 'skip') { if (STEPS[st.step] === 'notif') st.notif = false; if (STEPS[st.step] === 'habits') st.habits = []; go(st.step + 1); }
      else if (a === 'finish') finish(false);
      else if (a === 'example') finish(true);
      return;
    }
    const h = e.target.closest('[data-habit]');
    if (h) { const n = h.dataset.habit; st.habits = st.habits.includes(n) ? st.habits.filter(x => x !== n) : [...st.habits, n]; h.setAttribute('aria-pressed', st.habits.includes(n)); refreshPrimary(); return; }
    const gl = e.target.closest('[data-goal]');
    if (gl) { st.goal = +gl.dataset.goal; $$('[data-goal]').forEach(b => b.setAttribute('aria-pressed', +b.dataset.goal === st.goal)); const ft = $('.btn-primary .fade-t', stage); if (ft) { ft.classList.add('swap'); clearTimeout(ft._t); ft._t = setTimeout(() => { ft.textContent = `Set a ${st.goal}-day goal`; ft.classList.remove('swap'); }, 180); } return; }
    const th = e.target.closest('.ob-theme[data-theme]');
    if (th) { st.theme = th.dataset.theme; theme.set(st.theme); $$('.ob-theme[data-theme]').forEach(b => b.setAttribute('aria-pressed', b.dataset.theme === st.theme)); return; }
    if (e.target.closest('[data-act="notif-yes"]')) { askNotif(); return; }
    // custom time dropdown
    const ts = $('#tsel'); if (!ts) return;
    const opt = e.target.closest('[data-time]');
    if (opt) { st.reminder = opt.dataset.time; $('.tsel-btn b', ts).textContent = st.reminder; $$('[data-time]', ts).forEach(o => o.setAttribute('aria-selected', o === opt)); openT(false);
      if (st.notif) { st.permMsg = `Notifications are on. We'll remind you at ${st.reminder}.`; $('#perm').textContent = st.permMsg; } return; }
    if (e.target.closest('.tsel-btn')) { openT(!ts.classList.contains('open')); return; }
    openT(false);
  }, { signal });
  function openT(on) { const ts = $('#tsel'); if (!ts) return; ts.classList.toggle('open', on); $('.tsel-btn', ts).setAttribute('aria-expanded', on);
    if (on) { const sel = $('[aria-selected="true"]', ts); sel && sel.scrollIntoView({ block: 'center' }); } }
  document.addEventListener('keydown', e => { if (e.key === 'Escape') openT(false); }, { signal });
  function refreshPrimary() {
    const b = $('[data-go="next"]', stage); const n = st.habits.length;
    b.disabled = !n;
  }
  document.addEventListener('submit', e => {
    if (e.target.id !== 'custom') return; e.preventDefault();
    const v = $('#custom-in').value.trim(); if (!v) return;
    if (!st.habits.includes(v)) st.habits.push(v); render(false);
  }, { signal });

  async function askNotif() {
    // whatever the browser answers, the user can always continue
    let res = 'unsupported';
    if ('Notification' in window) {
      res = Notification.permission;
      if (res === 'default') {
        try {
          res = await Promise.race([
            new Promise(ok => { const r = Notification.requestPermission(ok); if (r && r.then) r.then(ok, () => ok('denied')); }),
            new Promise(ok => setTimeout(() => ok(Notification.permission), 8000))
          ]);
        } catch (err) { res = Notification.permission; }
      }
    }
    st.notif = res === 'granted';
    if (st.notif) {
      st.permMsg = `Notifications are on. We'll remind you at ${st.reminder}.`;
      try { new Notification('Re:Root reminders are on', { body: `We'll nudge you at ${st.reminder} to check in.`, icon: 'assets/img/icon.svg' }); } catch (err) {}
    } else st.permMsg = res === 'unsupported' ? 'This browser doesn\'t support notifications. You can continue without them.' : 'Notifications are blocked in this browser. You can allow them later in site settings, or continue without them.';
    st.asked = true; render(false);
  }
  render(false);
};
