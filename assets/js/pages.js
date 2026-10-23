/* Re:Root per-view behaviour for the public site and auth screens. */
(function () {
  const { $, $$, esc, ls, auth, toast, glass } = RR;
  const go = p => RR.navigate(p);
  const pwToggle = (root, signal) => root.addEventListener('click', e => { const b = e.target.closest('[data-pw]'); if (!b) return;
    const i = document.getElementById(b.dataset.pw); i.type = i.type === 'password' ? 'text' : 'password'; b.textContent = i.type === 'password' ? 'Show' : 'Hide'; }, { signal });
  const showErr = (sel, msg) => { const el = $(sel); el.hidden = false; el.textContent = msg; };

  // stable pseudo-random numbers per article (demo data)
  const seed = id => [...id].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
  const helpedBase = id => 100 + seed(id) % 4400;
  const reads = id => helpedBase(id) * 3 + seed(id + 'r') % 2000;
  const liked = () => ls.get('reroot.helped', {});
  const THUMB = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M7 11v9H4v-9zM7 11l4-8a2.5 2.5 0 0 1 2.5 2.5V9h5.2a2 2 0 0 1 2 2.3l-1.2 7A2 2 0 0 1 17.5 20H7"/></svg>';
  const helpBtn = id => { const on = !!liked()[id]; return `<button class="helped ${on ? 'on' : ''}" data-helped="${id}" aria-pressed="${on}">${THUMB}<span>This helped me</span><b class="mono">${(helpedBase(id) + (on ? 1 : 0)).toLocaleString('en-US')}</b></button>`; };
  const toggleHelped = b => { const id = b.dataset.helped, all = liked(); all[id] = !all[id]; ls.set('reroot.helped', all);
    b.classList.toggle('on', all[id]); b.setAttribute('aria-pressed', all[id]); $('b', b).textContent = (helpedBase(id) + (all[id] ? 1 : 0)).toLocaleString('en-US');
    b.classList.remove('pop'); void b.offsetWidth; b.classList.add('pop'); };
  RR.helped = { helpBtn, toggleHelped };

  RR.pages = {
    showcase(root, params, signal) {
      // "This motivated me" on the stories: toggles, remembers per browser, updates both copies in the drifting rows
      const mot = () => ls.get('reroot.motivated', {});
      const paintMot = () => { const m = mot(); $$('[data-motiv]', root).forEach(b => { const on = !!m[b.dataset.motiv], n = $('b', b);
        b.classList.toggle('on', on); b.setAttribute('aria-pressed', on); n.textContent = (+n.dataset.base + (on ? 1 : 0)).toLocaleString('en-US'); }); };
      paintMot();
      root.addEventListener('click', e => { const b = e.target.closest('[data-motiv]'); if (!b) return; const m = mot(); m[b.dataset.motiv] = !m[b.dataset.motiv]; ls.set('reroot.motivated', m); paintMot();
        $$(`[data-motiv="${b.dataset.motiv}"]`, root).forEach(x => { x.classList.remove('pop'); void x.offsetWidth; x.classList.add('pop'); }); }, { signal });
      // each phone plays its screen as you scroll past it (p: 0 -> 1)
      const clamp = v => Math.max(0, Math.min(1, v)), seg = (p, a, b) => clamp((p - a) / (b - a));
      const rows = $$('[data-sc]', root).map(row => ({ row, kind: row.dataset.sc, phone: $('.phone', row), last: -1 }));
      const draw = {
        login(r, p) { const em = $('[data-type]', r.row), pw = $('[data-dots]', r.row), btn = $('.sc-btn', r.row), t = em.dataset.type;
          const ne = Math.round(t.length * seg(p, .08, .42)), np = Math.round(+pw.dataset.dots * seg(p, .46, .62));
          em.textContent = t.slice(0, ne); pw.textContent = '•'.repeat(np);
          em.classList.toggle('typing', ne > 0 && ne < t.length); pw.classList.toggle('typing', np > 0 && np < +pw.dataset.dots);
          btn.classList.toggle('pressed', p > .68 && p < .76); btn.classList.toggle('done', p >= .76); },
        notif(r, p) { $('.sc-btn', r.row).classList.toggle('pressed', p > .45 && p < .55); $('.sc-toast', r.row).classList.toggle('show', p >= .55); },
        today(r, p) {
          $$('[data-hab]', r.row).forEach((c, k) => { const on = p >= (k ? .72 : .42), base = k ? 57 : 71;
            $('.m-btns span', c).classList.toggle('on', on); $$('.m-dots i', c)[5].classList.toggle('c', on);
            $('.m-ring', c).style.setProperty('--rp', (on ? base + 14 : base) + '%'); }); },
        progress(r, p) { const q = seg(p, .1, .85); $('[data-count]', r.row).textContent = Math.round(23 * q);
          $('.sc-line', r.row).style.strokeDashoffset = 1 - q;
          $$('.sc-bars i', r.row).forEach((b, k) => b.style.transform = `scaleY(${seg(p, .05 + k * .05, .45 + k * .05)})`); },
        goals(r, p) { const q = seg(p, .1, .85), days = Math.round(23 * q);
          $('.sc-goal', r.row).style.setProperty('--rp', (76 * q) + '%'); $$('[data-days]', r.row).forEach(d => d.textContent = days);
          $$('.sc-gdots i', r.row).forEach((d, k) => d.classList.toggle('c', k < 5 && q > (k + 1) / 6)); },
        read() {}
      };
      const still = RR.motion.reduce;
      const tick = () => { const vh = innerHeight;
        rows.forEach(r => { const b = r.phone.getBoundingClientRect(); if (b.bottom < -200 || b.top > vh + 200) return;
          const c = (b.top + b.bottom) / 2, p = still ? 1 : clamp((vh * .95 - c) / (vh * .6)); if (Math.abs(p - r.last) < .002) return; r.last = p; draw[r.kind](r, p);
          // the text arrives in order: heading, description, then each point
          r.st = r.st || $$('.st', r.row); r.st.forEach((el, i) => el.classList.toggle('in', still || p >= .12 + i * .13)); }); };
      let raf = 0; const req = () => { if (!raf) raf = requestAnimationFrame(() => { raf = 0; tick(); }); };
      addEventListener('scroll', req, { passive: true, signal }); addEventListener('resize', req, { signal }); tick();
      // breathing: in 4, hold 4, out 6, with a live countdown
      const br = $('.sc-breathe', root);
      if (br) { const txt = $('.br-text', br), ph = [['Breathe in', 4, 'in'], ['Hold', 4, 'hold'], ['Breathe out', 6, 'out']]; let i = 0, left = 4;
        const show = () => { txt.textContent = `${ph[i][0]} · ${left}`; br.dataset.phase = ph[i][2]; br.style.setProperty('--dur', ph[i][1] + 's'); };
        show(); const id = setInterval(() => { if (--left <= 0) { i = (i + 1) % 3; left = ph[i][1]; } show(); }, 1000);
        signal.addEventListener('abort', () => clearInterval(id)); }
    },
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
      // first 8 guides + the writer card fill the grid; the rest appear with "Read more articles"
      const A = window.RR_ARTICLES, FIRST = 8; let tag = 'All', q = '', expanded = false;
      const tags = ['All', ...new Set(A.map(a => a.tag))];
      const card = (a, k) => `<article class="glass gcard card-in art-card" style="--k:${k}" data-glass data-href="articles/${a.id}"><span class="tag">${esc(a.tag)} · ${a.min} min read · ${reads(a.id).toLocaleString('en-US')} reads</span><h3>${esc(a.t)}</h3><p>${esc(a.d)}</p><div class="art-actions"><a class="btn btn-primary btn-sm read-more" href="articles/${a.id}">Read more</a>${helpBtn(a.id)}</div></article>`;
      const writer = k => `<div class="glass gcard write-card card-in" style="--k:${k}"><span class="pen" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/></svg></span><h3>Are you a licensed professional?</h3><p>We are looking for certified therapists, psychologists and counsellors to write evidence-based guides that help people through urges, setbacks and recovery.</p><a class="btn btn-primary btn-sm" data-press href="contact?topic=writer">Apply to write</a></div>`;
      const grid = $('#art-grid', root), grid2 = $('#art-grid2', root), more = $('#art-more', root), empty = $('#art-empty', root);
      const list = () => A.filter(a => (tag === 'All' || a.tag === tag) && (!q || (a.t + ' ' + a.d).toLowerCase().includes(q)));
      const render = () => {
        $('#filters', root).innerHTML = tags.map(t => `<button class="chip" data-press data-tag="${t}" aria-pressed="${t === tag}">${t}</button>`).join('');
        const L = list(), paged = tag === 'All' && !q;
        const shown = paged ? L.slice(0, FIRST) : L;
        grid.innerHTML = shown.map(card).join('') + (paged ? writer(FIRST) : '');
        grid2.innerHTML = paged && expanded ? L.slice(FIRST).map(card).join('') : '';
        more.hidden = !(paged && !expanded && L.length > FIRST);
        empty.hidden = L.length > 0; if (!L.length) empty.innerHTML = `No guides match "${esc(q)}". Try a different word or <button class="btn-text" data-clear>clear the search</button>.`;
        glass(root);
      };
      root.addEventListener('click', e => {
        const hb = e.target.closest('[data-helped]');
        if (hb) { e.preventDefault(); e.stopPropagation(); toggleHelped(hb); return; }
        const t = e.target.closest('[data-tag]'); if (t) { if (t.dataset.tag !== tag) { tag = t.dataset.tag; render(); } return; }
        if (e.target.closest('[data-clear]')) { q = ''; $('#art-q', root).value = ''; render(); return; }
        if (e.target.closest('#art-more-btn')) {
          // extra cards go into their own masonry block below, so the first nine never move
          expanded = true; grid2.innerHTML = list().slice(FIRST).map(card).join('');
          [...grid2.children].forEach(el => el.classList.add('card-more')); more.hidden = true; glass(root); return;
        }
        const c = e.target.closest('.art-card'); if (c && !e.target.closest('a,button')) RR.navigate(c.dataset.href);
      }, { signal });
      // keep the light orbiting while it fades out after the pointer leaves
      root.addEventListener('pointerout', e => { const b = e.target.closest('.read-more'); if (!b || b.contains(e.relatedTarget)) return; b.classList.add('fading'); clearTimeout(b._ft); b._ft = setTimeout(() => b.classList.remove('fading'), 950); }, { signal });
      $('#art-q', root).addEventListener('input', e => { q = e.target.value.trim().toLowerCase(); render(); }, { signal });
      render();
    },
    article(root, params, signal) {
      root.addEventListener('click', e => { const hb = e.target.closest('[data-helped]'); if (hb) { e.preventDefault(); toggleHelped(hb); } }, { signal });
      const A = window.RR_ARTICLES, a = A.find(x => x.id === params.id) || A[0];
      document.title = a.t + ' · Re:Root';
      $('#article', root).innerHTML = `<a class="btn btn-primary btn-sm back-btn" data-press href="articles">All articles</a><p class="eyebrow">${esc(a.tag)}</p><h1>${esc(a.t)}</h1><p class="deck">${esc(a.d)}</p><div class="meta"><span>${a.min} min read</span><span>${reads(a.id).toLocaleString('en-US')} reads</span></div><div>${helpBtn(a.id)}</div><div class="prose">${a.b}</div>
        <div class="glass cta-band"><h2>Track it, don't just read it.</h2><p>Reading helps. Logging today helps more. Check in once a day and watch the pattern change.</p><div class="actions-row">${auth.current() ? '<a class="btn btn-primary" href="app/today">Check in for today</a>' : '<a class="btn btn-primary" href="register">Create free account</a><a class="btn-text" href="login">Log in</a>'}</div></div>`;
      $('#more', root).innerHTML = A.filter(x => x.id !== a.id).slice(0, 3).map(x => `<a class="glass gcard" data-glass href="articles/${x.id}"><span class="tag">${esc(x.tag)} · ${x.min} min</span><h3>${esc(x.t)}</h3><p>${esc(x.d)}</p></a>`).join('');
      glass(root);
    },
    community(root, params, signal) { RR.communityPage && RR.communityPage(root, signal); },
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
        if (n.length > 80 || m.length > 254 || sub.length > 140 || t.length > 4000) return showErr('#c-err', 'That is a bit long. Keep the message under 4,000 characters.');
        const last = ls.get('reroot.lastMsg', 0); if (Date.now() - last < 30000) return showErr('#c-err', 'You just sent a message. Wait half a minute before sending another.');
        ls.set('reroot.lastMsg', Date.now());
        $('#c-err').hidden = true; const all = ls.get('reroot.messages', []).slice(-49); all.push({ n, m, sub, src: v('#c-source'), t, at: Date.now() }); ls.set('reroot.messages', all);
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
      const RULES = { len: v => v.length >= 6, num: v => /\d/.test(v), sym: v => /[^A-Za-z0-9\s]/.test(v) };
      const check = () => { const v = $('#r-pass').value; let ok = true; $$('#pw-rules li', root).forEach(li => { const pass = RULES[li.dataset.rule](v); li.classList.toggle('ok', pass); ok = ok && pass; }); return ok; };
      $('#r-pass', root).addEventListener('input', check);
      $('#register', root).addEventListener('submit', async e => { e.preventDefault();
        if (!check()) { showErr('#r-err', 'Your password needs at least 6 characters, one number and one special character.'); $('#r-pass').focus(); return; }
        const r = await auth.register({ email: $('#r-email').value, password: $('#r-pass').value, confirm: $('#r-pass2').value, remember: $('#r-remember').checked });
        if (r.error) { showErr('#r-err', r.error); $({ email: '#r-email', password: '#r-pass', confirm: '#r-pass2' }[r.field] || '#r-email').focus(); return; }
        go('onboarding'); });
    },
  };
})();
