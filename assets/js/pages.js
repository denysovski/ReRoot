/* Re:Root per-view behaviour for the public site and auth screens. */
(function () {
  const { $, $$, esc, ls, auth, toast, glass } = RR;
  const go = p => RR.navigate(p);
  const pwToggle = (root, signal) => root.addEventListener('click', e => { const b = e.target.closest('[data-pw]'); if (!b) return;
    const i = document.getElementById(b.dataset.pw); i.type = i.type === 'password' ? 'text' : 'password'; b.textContent = i.type === 'password' ? 'Show' : 'Hide'; }, { signal });
  const showErr = (sel, msg) => { const el = $(sel); el.hidden = false; el.textContent = msg; };

  RR.pages = {
    articles(root, params, signal) {
      const A = window.RR_ARTICLES; let tag = 'All'; const tags = ['All', ...new Set(A.map(a => a.tag))];
      const render = () => {
        $('#filters', root).innerHTML = tags.map(t => `<button class="chip" data-press data-tag="${t}" aria-pressed="${t === tag}">${t}</button>`).join('');
        $('#art-grid', root).innerHTML = A.filter(a => tag === 'All' || a.tag === tag).map(a => `<a class="glass gcard" data-glass href="articles/${a.id}"><span class="tag">${esc(a.tag)} · ${a.min} min read</span><h3>${esc(a.t)}</h3><p>${esc(a.d)}</p><span class="read">Read the guide →</span></a>`).join('');
        glass(root);
      };
      root.addEventListener('click', e => { const b = e.target.closest('[data-tag]'); if (b) { tag = b.dataset.tag; render(); } }, { signal });
      render();
    },
    article(root, params) {
      const A = window.RR_ARTICLES, a = A.find(x => x.id === params.id) || A[0];
      document.title = a.t + ' · Re:Root';
      $('#article', root).innerHTML = `<a class="btn-text" href="articles">← All articles</a><p class="eyebrow">${esc(a.tag)}</p><h1>${esc(a.t)}</h1><p class="deck">${esc(a.d)}</p><div class="meta"><span>${a.min} min read</span><span>Re:Root guides</span></div><div class="prose">${a.b}</div>
        <div class="glass cta-band" style="margin-top:30px;justify-items:start;text-align:left;padding:32px"><h2 style="font-size:28px">Track it, don't just read it.</h2><div class="actions-row">${auth.current() ? '<a class="btn btn-primary btn-sm" href="app/today">Check in for today</a>' : '<a class="btn btn-primary btn-sm" href="register">Create free account</a><a class="btn-text" href="login">Log in</a>'}</div></div>`;
      $('#more', root).innerHTML = A.filter(x => x.id !== a.id).slice(0, 3).map(x => `<a class="glass gcard" data-glass href="articles/${x.id}"><span class="tag">${esc(x.tag)} · ${x.min} min</span><h3>${esc(x.t)}</h3><p>${esc(x.d)}</p></a>`).join('');
      glass(root);
    },
    community(root, params, signal) {
      const me = auth.current();
      const ROOMS = { general: ['General', 'Introduce yourself'], nails: ['Nail biting', 'Hands, fidgets, routines'], nofap: ['Porn & masturbation', 'Late nights and triggers'], smoke: ['Smoking & vaping', 'Cravings and swaps'], night: ['Late nights', 'The hardest hour'], wins: ['Wins', 'Share a milestone'] };
      const SEED = {
        general: [['Mara', 'Day 4 here. Mostly checking in so I have to be honest with myself.', '09:12'], ['Tomek', 'Welcome! The first week is the loudest. It gets quieter.', '09:20']],
        nails: [['Jo', 'Plaster on my thumb has been the single best trick for me.', '18:02'], ['Lev', 'I keep a smooth stone in my pocket. Hands need a job.', '18:40']],
        nofap: [['anon_17', 'Phone out of the bedroom changed everything. Boring advice, but it works.', '22:10'], ['K.', 'Slipped yesterday after a bad day. Logged it, back at day 1, still up from last month.', '22:31']],
        smoke: [['Rita', 'Swapped the after-coffee cigarette for a 5 minute walk. Week 2.', '07:45']],
        night: [['Sam', 'Anyone else find 23:00 to 01:00 the worst? I set my reminder for 22:30 now.', '23:02'], ['Ola', 'Same. Shower and a paper book is my reset.', '23:15']],
        wins: [['Daan', '30 days of no nail biting. First time I needed nail clippers in years.', '12:00'], ['Mara', 'One full week!', '20:14']] };
      let room = 'general';
      const mine = () => ls.get('reroot.chat', {});
      const ini = n => n.replace(/[^A-Za-z]/g, '').slice(0, 2).toUpperCase() || '?';
      const render = () => {
        $('#rooms', root).innerHTML = Object.entries(ROOMS).map(([id, [n, s]]) => `<button class="room" data-press data-room="${id}" aria-pressed="${id === room}"><b>${n}</b><span>${s}</span></button>`).join('');
        $('#room-name', root).textContent = ROOMS[room][0];
        const list = [...SEED[room].map(m => ({ who: m[0], text: m[1], at: m[2] })), ...(mine()[room] || [])];
        const box = $('#msgs', root);
        box.innerHTML = list.map(m => `<div class="msg ${m.me ? 'me' : ''}"><span class="av">${esc(ini(m.who))}</span><div><div class="who">${esc(m.who)}<span>${esc(m.at)}</span></div><p>${esc(m.text)}</p></div></div>`).join('');
        box.scrollTop = 1e6;
      };
      root.addEventListener('click', e => { const r = e.target.closest('[data-room]'); if (r) { room = r.dataset.room; render(); } }, { signal });
      $('#compose', root).addEventListener('submit', e => { e.preventDefault(); const v = $('#msg-in').value.trim(); if (!v) return;
        const all = mine(); (all[room] = all[room] || []).push({ who: me ? me.name : 'Guest', text: v, at: new Date().toTimeString().slice(0, 5), me: true }); ls.set('reroot.chat', all);
        $('#msg-in').value = ''; render(); });
      render();
    },
    contact(root) {
      $('#cform', root).addEventListener('submit', e => { e.preventDefault();
        const n = $('#c-name').value.trim(), m = $('#c-email').value.trim(), t = $('#c-msg').value.trim();
        if (!n || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(m) || !t) { showErr('#c-err', 'Fill in your name, a valid email and a message.'); return; }
        $('#c-err').hidden = true; const all = ls.get('reroot.messages', []); all.push({ n, m, t, at: Date.now() }); ls.set('reroot.messages', all);
        e.target.reset(); toast('Message saved. This demo doesn\'t send email.'); });
    },
    login(root, params, signal) {
      pwToggle(root, signal);
      $('#login', root).addEventListener('submit', async e => { e.preventDefault();
        const r = await auth.login({ email: $('#l-email').value, password: $('#l-pass').value });
        if (r.error) { showErr('#l-err', r.error); $(r.field === 'password' ? '#l-pass' : '#l-email').focus(); return; }
        go(r.user.prefs.onboarded ? 'app/today' : 'onboarding'); });
    },
    register(root, params, signal) {
      pwToggle(root, signal);
      $('#r-pass', root).addEventListener('input', e => { const v = e.target.value; let s = 0; if (v.length >= 6) s++; if (v.length >= 10) s++; if (/[A-Z]/.test(v) && /[a-z]/.test(v)) s++; if (/[\d\W]/.test(v)) s++; $('#r-str').style.width = (s / 4 * 100) + '%'; });
      $('#register', root).addEventListener('submit', async e => { e.preventDefault();
        if (!$('#r-terms').checked) { showErr('#r-err', 'Agree to the terms to create an account.'); return; }
        const r = await auth.register({ name: $('#r-name').value, email: $('#r-email').value, password: $('#r-pass').value });
        if (r.error) { showErr('#r-err', r.error); $({ name: '#r-name', email: '#r-email', password: '#r-pass' }[r.field] || '#r-name').focus(); return; }
        go('onboarding'); });
    },
  };
})();
