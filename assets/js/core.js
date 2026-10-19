/* Re:Root core — springs, press feedback, theme, simulated auth, menus, toast. */
(function () {
  const root = document.documentElement;
  root.classList.add('js');
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const mq = matchMedia('(prefers-reduced-motion: reduce)');
  const motion = { reduce: mq.matches };
  mq.addEventListener && mq.addEventListener('change', e => motion.reduce = e.matches);
  const ls = {
    get(k, d = null) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} },
    del(k) { try { localStorage.removeItem(k); } catch (e) {} }
  };

  /* ---------- Spring: response (s) + damping ratio, interruptible, velocity-aware ---------- */
  class Spring {
    constructor(value = 0, o = {}) { this.value = value; this.target = value; this.velocity = 0; this.eps = o.eps ?? .001; this.config(o.response ?? .4, o.damping ?? 1); this.fns = []; this.raf = 0; this.restFn = null; }
    config(r, d) { this.k = (2 * Math.PI / r) ** 2; this.c = 4 * Math.PI * d / r; return this; }
    on(f) { this.fns.push(f); return this; }
    emit() { for (const f of this.fns) f(this.value, this); }
    to(t, o = {}) {
      if (o.response) this.config(o.response, o.damping ?? 1);
      if (o.velocity != null) this.velocity = o.velocity;
      this.target = t; this.restFn = o.onRest || null;
      if (motion.reduce || o.instant) { this.stop(); this.value = t; this.velocity = 0; this.emit(); this.rest(); return this; }
      this.run(); return this;
    }
    set(v) { this.stop(); this.value = this.target = v; this.velocity = 0; this.emit(); return this; }
    stop() { cancelAnimationFrame(this.raf); this.raf = 0; }
    rest() { const f = this.restFn; this.restFn = null; f && f(); }
    run() {
      if (this.raf) return;
      let last = performance.now();
      const step = now => {
        const dt = Math.min((now - last) / 1000, 1 / 20); last = now;
        const n = Math.max(1, Math.ceil(dt * 240)), h = dt / n;
        for (let i = 0; i < n; i++) { const a = -this.k * (this.value - this.target) - this.c * this.velocity; this.velocity += a * h; this.value += this.velocity * h; }
        if (Math.abs(this.velocity) < this.eps * 10 && Math.abs(this.value - this.target) < this.eps) { this.value = this.target; this.velocity = 0; this.raf = 0; this.emit(); this.rest(); return; }
        this.emit(); this.raf = requestAnimationFrame(step);
      };
      this.raf = requestAnimationFrame(step);
    }
  }
  const tracker = () => { let s = []; return {
    add(y) { const t = performance.now(); s.push([t, y]); while (s.length > 2 && t - s[0][0] > 100) s.shift(); },
    v() { if (s.length < 2) return 0; const a = s[0], b = s[s.length - 1], dt = (b[0] - a[0]) / 1000; return dt > 0 ? (b[1] - a[1]) / dt : 0; },
    reset() { s = []; } }; };
  const project = (v, d = .998) => (v / 1000) * d / (1 - d);
  const rubber = (x, dim, c = .55) => (1 - 1 / (x * c / dim + 1)) * dim;

  /* ---------- press feedback on pointer-down ---------- */
  const pressSprings = new WeakMap(); let pressed = null, pressAt = null;
  document.addEventListener('pointerdown', e => {
    const el = e.target.closest('[data-press]'); if (!el || el.disabled) return;
    let sp = pressSprings.get(el);
    if (!sp) { sp = new Spring(1, { eps: .0005 }).on(v => el.style.transform = v === 1 ? '' : `scale(${v})`); pressSprings.set(el, sp); }
    sp.to(el.offsetWidth > 220 ? .975 : .94, { response: .18, damping: 1 });
    pressed = el; pressAt = [e.clientX, e.clientY];
  }, { passive: true });
  const release = () => { if (!pressed) return; const sp = pressSprings.get(pressed); sp && sp.to(1, { response: .42, damping: .72 }); pressed = null; };
  ['pointerup', 'pointercancel'].forEach(t => document.addEventListener(t, release, { passive: true }));
  document.addEventListener('pointermove', e => { if (pressed && Math.hypot(e.clientX - pressAt[0], e.clientY - pressAt[1]) > 10) release(); }, { passive: true });

  /* ---------- theme: light | dark | system ---------- */
  const theme = {
    get() { return ls.get('reroot.theme', 'dark'); },
    set(t) { ls.set('reroot.theme', t); this.apply(); document.dispatchEvent(new CustomEvent('rr:theme')); },
    apply() { const t = this.get(); if (t === 'light' || t === 'dark') root.dataset.theme = t; else delete root.dataset.theme; },
    isDark() { const t = this.get(); return t === 'dark' || (t === 'system' && matchMedia('(prefers-color-scheme: dark)').matches); },
    toggle() { this.set(this.isDark() ? 'light' : 'dark'); }
  };
  theme.apply();

  /* ---------- simulated accounts (everything stays in this browser) ---------- */
  async function hash(s) {
    try { const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('reroot:' + s)); return [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join(''); }
    catch (e) { let h = 0; for (const c of s) h = (h * 31 + c.charCodeAt(0)) | 0; return 'x' + h; }
  }
  const tzGuess = () => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'; } catch (e) { return 'UTC'; } };
  const auth = {
    users() { return ls.get('reroot.users', {}); },
    session() { let e = ls.get('reroot.session'); if (!e) { try { e = JSON.parse(sessionStorage.getItem('reroot.session')); } catch (x) { e = null; } } return e; },
    startSession(email, remember) { ls.del('reroot.session'); try { sessionStorage.removeItem('reroot.session'); } catch (x) {}
      if (remember) ls.set('reroot.session', email); else try { sessionStorage.setItem('reroot.session', JSON.stringify(email)); } catch (x) { ls.set('reroot.session', email); } },
    current() { const e = this.session(); return e ? this.users()[e] || null : null; },
    async register({ email, password, confirm, remember = true }) {
      email = (email || '').trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: 'Enter an email address like name@example.com.', field: 'email' };
      if ((password || '').length < 6) return { error: 'Use at least 6 characters for your password.', field: 'password' };
      if (confirm !== undefined && confirm !== password) return { error: 'The passwords don\'t match. Type the same password twice.', field: 'confirm' };
      const users = this.users();
      if (users[email]) return { error: 'An account with this email already exists. Log in instead.', field: 'email' };
      const base = email.split('@')[0].replace(/[._\-+\d]+/g, ' ').trim() || 'friend';
      const name = base.split(' ')[0].replace(/^./, c => c.toUpperCase());
      users[email] = { name, email, pass: await hash(password), created: Date.now(), prefs: { tz: tzGuess(), notif: false, reminder: '20:00', onboarded: false } };
      ls.set('reroot.users', users); this.startSession(email, remember);
      return { user: users[email] };
    },
    async login({ email, password, remember = true }) {
      email = (email || '').trim().toLowerCase();
      const u = this.users()[email];
      if (!u) return { error: 'No account uses this email. Check the spelling or create an account.', field: 'email' };
      if (u.pass !== await hash(password || '')) return { error: 'That password doesn\'t match. Try again.', field: 'password' };
      this.startSession(email, remember); return { user: u };
    },
    logout() { ls.del('reroot.session'); try { sessionStorage.removeItem('reroot.session'); } catch (x) {} },
    update(patch) { const u = this.current(); if (!u) return; const users = this.users(); users[u.email] = { ...u, ...patch, prefs: { ...u.prefs, ...(patch.prefs || {}) } }; ls.set('reroot.users', users); return users[u.email]; },
    require(next = 'login.html') { const u = this.current(); if (!u) { location.replace(next); return null; } return u; }
  };

  /* ---------- materializing menus anchored to a trigger ---------- */
  const openMenus = new Set();
  function menu(trigger, panel, { origin = 'top left', place } = {}) {
    const p = new Spring(0, { eps: .002 });
    p.on(v => {
      panel.style.opacity = v;
      panel.style.transform = v >= 1 ? '' : `translateY(${(1 - v) * -8}px) scale(${.9 + .1 * v})`;
      panel.style.filter = v >= .999 || motion.reduce ? '' : `blur(${(1 - v) * 8}px)`;
    });
    panel.style.transformOrigin = origin;
    const api = {
      open: false,
      show() { closeAll(api); place && place(panel); panel.hidden = false; api.open = true; trigger.setAttribute('aria-expanded', 'true'); p.to(1, { response: .34, damping: .82 }); openMenus.add(api);
        const f = panel.querySelector('a,button,select'); f && setTimeout(() => f.focus({ preventScroll: true }), 60); },
      hide() { if (!api.open) return; api.open = false; trigger.setAttribute('aria-expanded', 'false'); p.to(0, { response: .24, damping: 1, onRest: () => { if (!api.open) panel.hidden = true; } }); openMenus.delete(api); },
      toggle() { api.open ? api.hide() : api.show(); }
    };
    trigger.setAttribute('aria-haspopup', 'true'); trigger.setAttribute('aria-expanded', 'false');
    trigger.addEventListener('click', e => { e.stopPropagation(); api.toggle(); });
    panel.addEventListener('click', e => e.stopPropagation());
    return api;
  }
  function closeAll(except) { openMenus.forEach(m => m !== except && m.hide()); }
  document.addEventListener('click', () => closeAll());
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeAll(); });

  /* ---------- toast ---------- */
  let toastEl = null, toastT = 0;
  function toast(msg) {
    if (!toastEl) { toastEl = document.createElement('div'); toastEl.className = 'toast'; toastEl.setAttribute('role', 'status'); document.body.appendChild(toastEl); }
    toastEl.textContent = msg; clearTimeout(toastT);
    const sp = new Spring(0).on(v => { toastEl.style.opacity = v; toastEl.style.transform = `translateX(-50%) translateY(${(1 - v) * 16}px) scale(${.96 + .04 * v})`; });
    sp.to(1, { response: .35, damping: .8 });
    toastT = setTimeout(() => sp.to(0, { response: .3 }), 2600);
  }

  /* ---------- glass cards: tilt toward pointer + spotlight ---------- */
  function glass(scope = document) {
    $$('[data-glass]', scope).forEach(el => {
      if (el._glass) return; el._glass = true;
      const rx = new Spring(0, { eps: .01 }), ry = new Spring(0, { eps: .01 }), sc = new Spring(1, { eps: .0005 });
      const paint = () => { el.style.transform = (rx.value || ry.value || sc.value !== 1) ? `perspective(900px) rotateX(${rx.value}deg) rotateY(${ry.value}deg) scale(${sc.value})` : ''; };
      rx.on(paint); ry.on(paint); sc.on(paint);
      const max = +el.dataset.glass || 7;
      el.addEventListener('pointermove', e => {
        if (e.pointerType === 'touch' || motion.reduce) return;
        const r = el.getBoundingClientRect(), x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
        el.style.setProperty('--mx', x * 100 + '%'); el.style.setProperty('--my', y * 100 + '%'); el.style.setProperty('--spot', 1);
        rx.to((.5 - y) * max, { response: .5, damping: 1 }); ry.to((x - .5) * max, { response: .5, damping: 1 });
      });
      el.addEventListener('pointerleave', () => { el.style.setProperty('--spot', 0); rx.to(0, { response: .6, damping: .7 }); ry.to(0, { response: .6, damping: .7 }); sc.to(1, { response: .4, damping: .8 }); });
      el.addEventListener('pointerdown', () => sc.to(.98, { response: .2 }));
      el.addEventListener('pointerup', () => sc.to(1, { response: .45, damping: .7 }));
    });
  }

  /* ---------- dates ---------- */
  const pad = n => String(n).padStart(2, '0');
  const key = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
  const fromKey = k => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d); };
  const fmt = (d, o) => d.toLocaleDateString('en-US', o);

  /* ---------- hexagon lines light up around the pointer ---------- */
  if (matchMedia('(hover: hover) and (pointer: fine)').matches) {
    const hg = document.createElement('div'); hg.className = 'hexglow'; hg.setAttribute('aria-hidden', 'true');
    const amb = document.querySelector('.ambient'); amb ? amb.after(hg) : document.body.prepend(hg);
    let x = 0, y = 0, raf = 0;
    addEventListener('pointermove', e => { x = e.clientX; y = e.clientY; hg.classList.add('on');
      if (!raf) raf = requestAnimationFrame(() => { raf = 0; hg.style.setProperty('--hx', x + 'px'); hg.style.setProperty('--hy', y + 'px'); }); }, { passive: true });
    document.documentElement.addEventListener('pointerleave', () => hg.classList.remove('on'));
  }

  /* ---------- tooltip bubble: shows above-right of the cursor for any [data-tip] ---------- */
  const tip = document.createElement('div'); tip.className = 'tip'; tip.setAttribute('role', 'tooltip'); document.body.appendChild(tip);
  let tipEl = null;
  const placeTip = (x, y) => { const w = tip.offsetWidth, h = tip.offsetHeight; let l = x + 14, t = y - h - 22, side = 'r', vert = 'a';
    if (l + w > innerWidth - 12) { l = x - w - 14; side = 'l'; } if (t < 12) { t = y + 26; vert = 'b'; }
    tip.dataset.side = side; tip.dataset.vert = vert; tip.style.transform = `translate(${Math.round(l)}px, ${Math.round(t)}px)`; };
  document.addEventListener('pointerover', e => { const el = e.target.closest('[data-tip]'); if (!el || el === tipEl) return; tipEl = el; tip.textContent = el.dataset.tip; placeTip(e.clientX, e.clientY); tip.classList.add('on'); });
  document.addEventListener('pointermove', e => { if (tipEl) placeTip(e.clientX, e.clientY); }, { passive: true });
  document.addEventListener('pointerout', e => { if (tipEl && !tipEl.contains(e.relatedTarget)) { tipEl = null; tip.classList.remove('on'); } });
  document.addEventListener('focusin', e => { const el = e.target.closest('[data-tip]'); if (!el) return; tipEl = el; tip.textContent = el.dataset.tip; const r = el.getBoundingClientRect(); placeTip(r.right - 10, r.top + 6); tip.classList.add('on'); });
  document.addEventListener('focusout', () => { tipEl = null; tip.classList.remove('on'); });

  window.RR = { $, $$, clamp, esc, ls, motion, Spring, tracker, project, rubber, theme, auth, menu, closeAll, toast, glass, key, addDays, fromKey, fmt, tzGuess };
})();
