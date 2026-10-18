/* Re:Root per-user data store (local only). */
window.RRStore = (() => {
  const { ls, key, addDays } = RR;
  const k = email => 'reroot.data.' + email;
  const blank = () => ({ habits: [], logs: {}, notes: {}, sel: null, example: false });
  const uid = () => 'h' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  function load(email) { const s = ls.get(k(email)); return s && Array.isArray(s.habits) ? s : blank(); }
  function save(email, S) { ls.set(k(email), S); }
  function rng(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  // Fill realistic example history for a list of {name, goal}
  function seed(defs, today = new Date()) {
    const S = blank(), r = rng(defs.length * 97 + 11), streaks = [12, 23, 5, 31, 8, 17];
    defs.forEach((d, n) => {
      const id = uid() + n, back = 70, streak = streaks[n % streaks.length], p = .3 + r() * .25;
      for (let i = back; i >= 1; i--) {
        const kk = key(addDays(today, -i)); S.logs[kk] = S.logs[kk] || {};
        const s = i <= streak ? 'c' : i === streak + 1 ? 'x' : (r() < p * (i / back) + .05 ? 'x' : 'c');
        const u = s === 'x' ? 4 + Math.round(r()) : Math.max(0, Math.round(1 + r() * 3 * (i / back) + r() * 1.3 - (i <= streak ? .6 : 0)));
        S.logs[kk][id] = { s, u: Math.min(5, u) };
      }
      S.habits.push({ id, name: d.name, goal: d.goal || 30, start: key(addDays(today, -back)) });
    });
    S.sel = S.habits[0] && S.habits[0].id; S.example = true;
    return S;
  }
  return { load, save, seed, blank, uid };
})();
