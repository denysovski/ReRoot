/* Re:Root per-view behaviour for the public site and auth screens. */
(function () {
  const { $, $$, esc, ls, auth, toast, glass } = RR;
  const go = p => RR.navigate(p);
  const pwToggle = (root, signal) => root.addEventListener('click', e => { const b = e.target.closest('[data-pw]'); if (!b) return;
    const i = document.getElementById(b.dataset.pw); i.type = i.type === 'password' ? 'text' : 'password'; b.textContent = i.type === 'password' ? 'Show' : 'Hide'; }, { signal });
  const showErr = (sel, msg) => { const el = $(sel); el.hidden = false; el.textContent = msg; };

  RR.pages = {
    faq(root, params, signal) {
      $$('.faq details', root).forEach(d => {
        const sum = $('summary', d), ans = $('.ans', d), wrap = document.createElement('div'); wrap.className = 'ans-wrap'; ans.before(wrap); wrap.appendChild(ans);
        let anim = null;
        d._toggle = () => sum.click();
        sum.addEventListener('click', e => {
          e.preventDefault(); if (anim) anim.cancel();
          if (!d.open || d.dataset.closing === '1') $$('.faq details[open]', root).forEach(o => { if (o !== d && o.dataset.closing !== '1') o._toggle(); });
          const reduce = RR.motion.reduce, opening = !d.open || d.dataset.closing === '1';
          if (opening) { d.dataset.closing = ''; d.open = true; const h = wrap.scrollHeight;
            if (reduce) return; anim = wrap.animate([{ height: '0px', opacity: 0 }, { height: h + 'px', opacity: 1 }], { duration: 520, easing: 'cubic-bezier(.2,.8,.2,1)' });
            anim.onfinish = () => { anim = null; }; }
          else { const h = wrap.offsetHeight; d.dataset.closing = '1';
            if (reduce) { d.open = false; d.dataset.closing = ''; return; }
            anim = wrap.animate([{ height: h + 'px', opacity: 1 }, { height: '0px', opacity: 0 }], { duration: 420, easing: 'cubic-bezier(.4,0,.2,1)' });
            anim.onfinish = () => { d.open = false; d.dataset.closing = ''; anim = null; }; }
        }, { signal });
      });
    },
    articles(root, params, signal) {
      const A = window.RR_ARTICLES; let tag = 'All'; const tags = ['All', ...new Set(A.map(a => a.tag))];
      const render = () => {
        $('#filters', root).innerHTML = tags.map(t => `<button class="chip" data-press data-tag="${t}" aria-pressed="${t === tag}">${t}</button>`).join('');
        $('#art-grid', root).innerHTML = A.filter(a => tag === 'All' || a.tag === tag).map((a, i) => `<a class="glass gcard card-in" style="--k:${i}" data-glass href="articles/${a.id}"><span class="tag">${esc(a.tag)} · ${a.min} min read</span><h3>${esc(a.t)}</h3><p>${esc(a.d)}</p><span class="read">Read the guide →</span></a>`).join('');
        if (tag === 'All') $('#art-grid', root).insertAdjacentHTML('beforeend', `<div class="glass gcard write-card card-in" style="--k:${A.length}"><span class="tag">Write for Re:Root</span><h3>Are you a licensed professional?</h3><p>We are looking for certified therapists, psychologists and counsellors to write evidence-based guides that help people through urges, setbacks and recovery.</p><a class="btn btn-primary btn-sm" data-press href="contact?topic=writer">Apply to write</a></div>`);
        glass(root);
      };
      root.addEventListener('click', e => { const b = e.target.closest('[data-tag]'); if (b && b.dataset.tag !== tag) { tag = b.dataset.tag; render(); } }, { signal });
      render();
    },
    article(root, params) {
      const A = window.RR_ARTICLES, a = A.find(x => x.id === params.id) || A[0];
      document.title = a.t + ' · Re:Root';
      $('#article', root).innerHTML = `<a class="btn-text" href="articles">← All articles</a><p class="eyebrow">${esc(a.tag)}</p><h1>${esc(a.t)}</h1><p class="deck">${esc(a.d)}</p><div class="meta"><span>${a.min} min read</span><span>Re:Root guides</span></div><div class="prose">${a.b}</div>
        <div class="glass cta-band"><h2>Track it, don't just read it.</h2><p>Reading helps. Logging today helps more. Check in once a day and watch the pattern change.</p><div class="actions-row">${auth.current() ? '<a class="btn btn-primary" href="app/today">Check in for today</a>' : '<a class="btn btn-primary" href="register">Create free account</a><a class="btn-text" href="login">Log in</a>'}</div></div>`;
      $('#more', root).innerHTML = A.filter(x => x.id !== a.id).slice(0, 3).map(x => `<a class="glass gcard" data-glass href="articles/${x.id}"><span class="tag">${esc(x.tag)} · ${x.min} min</span><h3>${esc(x.t)}</h3><p>${esc(x.d)}</p></a>`).join('');
      glass(root);
    },
    community(root, params, signal) {
      // Each browser session gets its own guest name; messages live 10 minutes, then disappear.
      const me = auth.current(), TTL = 10 * 60 * 1000;
      let guest = null; try { guest = sessionStorage.getItem('reroot.guest'); } catch (e) {}
      if (!guest) { guest = 'Guest ' + String(Math.floor(1000 + Math.random() * 9000)); try { sessionStorage.setItem('reroot.guest', guest); } catch (e) {} }
      const myName = me ? me.name : guest;
      const ROOMS = { general: ['General', 'Introduce yourself'], nails: ['Nail biting', 'Hands, fidgets, routines'], nofap: ['Porn & masturbation', 'Late nights and triggers'], smoke: ['Smoking & vaping', 'Cravings and swaps'], night: ['Late nights', 'The hardest hour'], wins: ['Wins', 'Share a milestone'] };
      const SEED = {
        general: [['Mara', 'Day 4 here. Mostly checking in so I have to be honest with myself.'], ['Tomek', 'Welcome! The first week is the loudest. It gets quieter.']],
        nails: [['Jo', 'Plaster on my thumb has been the single best trick for me.'], ['Lev', 'I keep a smooth stone in my pocket. Hands need a job.']],
        nofap: [['anon_17', 'Phone out of the bedroom changed everything. Boring advice, but it works.'], ['K.', 'Slipped yesterday after a bad day. Logged it, back at day 1, still up from last month.']],
        smoke: [['Rita', 'Swapped the after-coffee cigarette for a 5 minute walk. Week 2.']],
        night: [['Sam', 'Anyone else find 23:00 to 01:00 the worst? I set my reminder for 22:30 now.'], ['Ola', 'Same. Shower and a paper book is my reset.']],
        wins: [['Daan', '30 days of no nail biting. First time I needed nail clippers in years.'], ['Mara', 'One full week!']] };
      let room = 'general';
      const load = () => { const all = ls.get('reroot.chat2', {}), now = Date.now(); let changed = false;
        for (const r in all) { const keep = all[r].filter(m => now - m.at < TTL); if (keep.length !== all[r].length) { all[r] = keep; changed = true; } }
        if (changed) ls.set('reroot.chat2', all); return all; };
      const ini = n => n.replace(/[^A-Za-z0-9]/g, '').slice(0, 2).toUpperCase() || '?';
      const left = at => { const ms = Math.max(0, TTL - (Date.now() - at)), m = Math.floor(ms / 60000), s2 = Math.floor(ms / 1000) % 60; return `${m}:${String(s2).padStart(2, '0')}`; };
      let lastCount = -1;
      const render = (scroll = true) => {
        $('#rooms', root).innerHTML = Object.entries(ROOMS).map(([id, [n, s]]) => `<button class="room" data-press data-room="${id}" aria-pressed="${id === room}"><b>${n}</b><span>${s}</span></button>`).join('');
        $('#room-name', root).textContent = ROOMS[room][0];
        const mine = load()[room] || [];
        const box = $('#msgs', root);
        box.innerHTML = SEED[room].map(m => `<div class="msg"><span class="av">${esc(ini(m[0]))}</span><div><div class="who">${esc(m[0])}<span>pinned example</span></div><p>${esc(m[1])}</p></div></div>`).join('')
          + mine.map(m => `<div class="msg ${m.who === myName ? 'me' : ''}"><span class="av">${esc(ini(m.who))}</span><div><div class="who">${esc(m.who)}<span>${new Date(m.at).toTimeString().slice(0, 5)}</span><span class="ttl" data-at="${m.at}">disappears in ${left(m.at)}</span></div><p>${esc(m.text)}</p></div></div>`).join('');
        if (scroll || mine.length !== lastCount) box.scrollTop = 1e6; lastCount = mine.length;
      };
      root.addEventListener('click', e => { const r = e.target.closest('[data-room]'); if (r && r.dataset.room !== room) { room = r.dataset.room; lastCount = -1; render(); const box = $('#msgs', root), hd = $('#room-name', root); [box, hd].forEach(x => { x.classList.remove('swap'); void x.offsetWidth; x.classList.add('swap'); }); } }, { signal });
      $('#compose', root).addEventListener('submit', e => { e.preventDefault(); const v = $('#msg-in').value.trim(); if (!v) return;
        const all = load(); (all[room] = all[room] || []).push({ who: myName, text: v, at: Date.now() }); ls.set('reroot.chat2', all);
        $('#msg-in').value = ''; render(); });
      const tick = setInterval(() => { const before = (ls.get('reroot.chat2', {})[room] || []).length, now = load()[room] || [];
        if (now.length !== before) render(false); else $$('.ttl', root).forEach(t => t.textContent = 'disappears in ' + left(+t.dataset.at)); }, 1000);
      signal.addEventListener('abort', () => clearInterval(tick));
      addEventListener('storage', e => { if (e.key === 'reroot.chat2') render(false); }, { signal });
      const h = location.hash.slice(1); if (ROOMS[h]) room = h; render();
    },
    contact(root) {
      const topic = new URLSearchParams(location.search).get('topic');
      if (topic === 'partner') $('#c-subject', root).value = 'Partnership enquiry';
      if (topic === 'writer') $('#c-subject', root).value = 'Writing guides for Re:Root';
      $('#cform', root).addEventListener('submit', e => { e.preventDefault();
        const v = id => $(id).value.trim(), n = v('#c-name'), m = v('#c-email'), sub = v('#c-subject'), t = v('#c-msg');
        if (!n) return showErr('#c-err', 'Enter your name.');
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(m)) return showErr('#c-err', 'Enter a valid email address, like name@example.com.');
        if (!sub) return showErr('#c-err', 'Add a subject so we know what this is about.');
        if (!t) return showErr('#c-err', 'Write a message before sending.');
        $('#c-err').hidden = true; const all = ls.get('reroot.messages', []); all.push({ n, m, sub, src: v('#c-source'), t, at: Date.now() }); ls.set('reroot.messages', all);
        e.target.reset(); toast('Thanks, your message was saved. This demo does not send email.'); });
    },
    login(root, params, signal) {
      pwToggle(root, signal);
      $('#login', root).addEventListener('submit', async e => { e.preventDefault();
        const r = await auth.login({ email: $('#l-email').value, password: $('#l-pass').value, remember: $('#l-remember').checked });
        if (r.error) { showErr('#l-err', r.error); $(r.field === 'password' ? '#l-pass' : '#l-email').focus(); return; }
        go(r.user.prefs.onboarded ? 'app/today' : 'onboarding'); });
    },
    register(root, params, signal) {
      pwToggle(root, signal);
      $('#r-pass', root).addEventListener('input', e => { const v = e.target.value; let s = 0; if (v.length >= 6) s++; if (v.length >= 10) s++; if (/[A-Z]/.test(v) && /[a-z]/.test(v)) s++; if (/[\d\W]/.test(v)) s++; $('#r-str').style.width = (s / 4 * 100) + '%'; });
      $('#register', root).addEventListener('submit', async e => { e.preventDefault();
        const r = await auth.register({ email: $('#r-email').value, password: $('#r-pass').value, confirm: $('#r-pass2').value, remember: $('#r-remember').checked });
        if (r.error) { showErr('#r-err', r.error); $({ email: '#r-email', password: '#r-pass', confirm: '#r-pass2' }[r.field] || '#r-email').focus(); return; }
        go('onboarding'); });
    },
  };
})();
