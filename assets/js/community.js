/* Re:Root community page: dotted 3D globe that grows as you scroll, animated counters, and a draggable habit wheel.
   Land mask: Natural Earth 110m (public domain) via world-atlas, rasterised to a 160x80 grid. */
(function () {
  const LAND = '00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000007ff37fc000000000000000000000000000000007bf1fffff0005f000000070000000000000000204787ffffe00034000000002000000000000000f95f003fffe000000007000ffe0074000000000789efc01fffc00000000800ffff98000000020001fc6ff007ffc00001800837ffffffffe0103fffff883b1c07ff00001ff811dffffffffffffd2ffffffffe1f0ff004003fecfffffffffffffff00ffffffffb1e07c03800fbffffffffffffffffe03fffffffe0f003800003f3fffffffffffffff7c00f03ffffc03900000003f07fffffffffffff980003007fffe03f80000060e1ffffffffffffc0380010003ffffe7fc000002007ffffffffffff00700000001fffff7fe00000b3fffffffffffffff0400000000fffffffe0000027ffffffffffffffd00000000003fffffa3000003fffffffffffffffc00000000007fffffe0000001fffd7cfffffffff800000000007fffff80000001f5f879fffffffff180000000007fffff8000000f86733dffffffffc200000000007ffffc0000000f014ffcfffffff88200000000003ffffc0000000e0a0ffcfffffffc8600000000003ffffc00000007f802fffffffff89c00000000000ffff00000000ffc40fffffffffc2000000000000bffb00000000fff7ffffffffffc00000000000007f8100000001ffffffdfffffffc00000000000003f8000000007ffffefc7ffffff80000000000000078000000007fffff7fc3fffff4000000000000007884000000ffffff7fc1fe7f000000000000000078808000007fffffbfc0fc3e80000000000000000f800000007fffff9f00783f040000000000000001e0000000ffffffdc00701f040000000000000000600000007fffffe000700781000000000000000023f800003ffffffe00200100000000000000000007fc00003ffffffc00100803000000000000000003ff00000f3ffffc00000418000000000000000003ff8000000ffff800001430000000000000000007ffc000000ffff000000cf900000000000000000ffff000000fffe00000047630000000000000000ffffe000007ffc000000610df100000000000000fffff000007ff800000020207a000000000000007ffff800003ff8000000060074000000000000007ffff000003ffc000000004002000000000000003fffe000003ffc000000000390000000000000003fffe000007ffc400000000b10000000000000000fffe000007ff8c00000001fd80010000000000007ffc000003ff0c00000003ff80000000000000007ffc000003ff180000001fffc0400000000000007ff0000003ff180000001fffe0000000000000007fc0000001fc000000003ffff000000000000000ffc0000001fc000000001ffff000000000000000ffc0000000fc000000001ffff000000000000000ff80000000f8000000001f0ff000000000000000fd0000000000000000000807e000000000000001fe0000000000000000000003e000000000000001f000000000000000000000000006000000000001e00000000000000000000000c008000000000000e000000000000000000000000018000000000001c000000000000000000000000030000000000003c0000000000000000000000000000000000000018000000000000000000000000000000000000001c0000000000000000000000000000000000000006000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000040000000000000000000000000000000000000010000000000001800006601800000000000000002000000000001ffe1fffffffe000000000000000f80000003ffffffeffffffffffe00000000030807800007ffffffffffffffffffff00001ffffffffe00000ffffffffffffffffffff80003ffffffffe00003fffffffffffffffffffff800001fffffffc00781ffffffffffffffffffffe00000ffffffffff87fffffffffffffffffffffff00d803fffffffffffffffffffffffffffffffffffeffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff', GW = 160, GH = 80;
  const SPOTS = [[40.7, -74], [34, -118.2], [41.9, -87.6], [51.5, -.1], [52.5, 13.4], [48.1, 11.6], [50.1, 14.4], [52.2, 21], [48.9, 2.35], [40.4, -3.7],
    [45.5, -73.6], [43.7, -79.4], [-23.5, -46.6], [-22.9, -43.2], [19.1, 72.9], [28.6, 77.2], [12.97, 77.6], [35.7, 139.7], [-33.9, 151.2], [1.35, 103.8], [59.3, 18.1], [37.6, 127]];
  const pts = []; for (let y = 0; y < GH; y++) for (let x = 0; x < GW; x++) { const k = y * GW + x; if ((parseInt(LAND[k >> 2], 16) >> (3 - (k & 3))) & 1) pts.push([(90 - (y + .5) * 180 / GH) * Math.PI / 180, (-180 + (x + .5) * 360 / GW) * Math.PI / 180]); }

  function globe(sec, signal) {
    const { clamp, motion } = RR, cv = sec.querySelector('.globe-cv'), ctx = cv.getContext('2d');
    let W = 0, H = 0, dpr = 1, lon0 = -.4, lat0 = .38, vel = .0016, drag = null, zoom = .8, raf = 0, t0 = performance.now();
    const css = () => { const st = getComputedStyle(document.documentElement); return { fg: st.getPropertyValue('--fg').trim() || '#fff' }; };
    let col = css(); document.addEventListener('rr:theme', () => col = css(), { signal });
    const size = () => { dpr = Math.min(2, devicePixelRatio || 1); W = cv.clientWidth; H = cv.clientHeight; cv.width = W * dpr; cv.height = H * dpr; };
    const ro = new ResizeObserver(size); ro.observe(cv); size();
    const draw = now => {
      raf = requestAnimationFrame(draw); if (!W) return;
      if (!drag && !motion.reduce) lon0 += vel; else if (drag) {}
      const r = sec.getBoundingClientRect(), vh = innerHeight, p = clamp((vh - r.top) / (r.height)), z = .62 + .6 * (p < .5 ? p * 2 : 1) * 1;
      zoom += (z - zoom) * .12;
      const R = Math.min(W, H) * .4 * zoom, cx = W / 2, cy = H / 2 + R * .02;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, W, H);
      const light = document.documentElement.dataset.theme === 'light' || (!document.documentElement.dataset.theme && matchMedia('(prefers-color-scheme: light)').matches);
      // atmosphere glow
      const g = ctx.createRadialGradient(cx, cy, R * .7, cx, cy, R * 1.35);
      g.addColorStop(0, light ? 'rgba(90,80,220,.10)' : 'rgba(120,110,255,.22)'); g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, R * 1.35, 0, 7); ctx.fill();
      // sphere body
      const b = ctx.createRadialGradient(cx - R * .35, cy - R * .4, R * .1, cx, cy, R);
      b.addColorStop(0, light ? 'rgba(255,255,255,.95)' : 'rgba(60,60,72,.55)'); b.addColorStop(1, light ? 'rgba(225,225,232,.9)' : 'rgba(12,12,16,.85)');
      ctx.fillStyle = b; ctx.beginPath(); ctx.arc(cx, cy, R, 0, 7); ctx.fill();
      ctx.strokeStyle = light ? 'rgba(0,0,0,.12)' : 'rgba(255,255,255,.14)'; ctx.lineWidth = 1; ctx.stroke();
      const sl0 = Math.sin(lat0), cl0 = Math.cos(lat0), ds = Math.max(1.1, R / 210);
      ctx.fillStyle = col.fg;
      for (const [la, lo] of pts) {
        const cl = Math.cos(la), sl = Math.sin(la), d = lo - lon0, cd = Math.cos(d), cc = sl0 * sl + cl0 * cl * cd; if (cc <= 0) continue;
        const x = cx + R * cl * Math.sin(d), y = cy - R * (cl0 * sl - sl0 * cl * cd);
        ctx.globalAlpha = .18 + .72 * cc; ctx.fillRect(x - ds / 2, y - ds / 2, ds, ds);
      }
      // hotspots
      const tt = (now - t0) / 1000;
      SPOTS.forEach(([la0, lo0], k) => {
        const la = la0 * Math.PI / 180, lo = lo0 * Math.PI / 180, cl = Math.cos(la), sl = Math.sin(la), d = lo - lon0, cd = Math.cos(d), cc = sl0 * sl + cl0 * cl * cd; if (cc <= .05) return;
        const x = cx + R * cl * Math.sin(d), y = cy - R * (cl0 * sl - sl0 * cl * cd), ph = (tt * .6 + k * .37) % 1;
        ctx.globalAlpha = cc * (1 - ph) * .8; ctx.strokeStyle = k % 3 === 0 ? '#22c3ee' : k % 3 === 1 ? '#8b7cff' : '#f472b6'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(x, y, 3 + ph * 16 * zoom, 0, 7); ctx.stroke();
        ctx.globalAlpha = cc; ctx.fillStyle = ctx.strokeStyle; ctx.beginPath(); ctx.arc(x, y, 2.6, 0, 7); ctx.fill(); ctx.fillStyle = col.fg;
      });
      ctx.globalAlpha = 1;
    };
    raf = requestAnimationFrame(draw);
    cv.addEventListener('pointerdown', e => { drag = { x: e.clientX, y: e.clientY, l: lon0, a: lat0, t: performance.now() }; cv.setPointerCapture(e.pointerId); cv.classList.add('grab'); }, { signal });
    cv.addEventListener('pointermove', e => { if (!drag) return; const dx = e.clientX - drag.x, dy = e.clientY - drag.y, k = 1 / (Math.min(W, H) * .4 * zoom);
      const nl = drag.l - dx * k; vel = clamp((nl - lon0) * .5, -.04, .04); lon0 = nl; lat0 = clamp(drag.a + dy * k, -.9, .9); }, { signal });
    const up = () => { if (!drag) return; drag = null; cv.classList.remove('grab'); const fade = () => { vel += (.0016 - vel) * .04; if (Math.abs(vel - .0016) > .0002 && !drag) requestAnimationFrame(fade); }; fade(); };
    cv.addEventListener('pointerup', up, { signal }); cv.addEventListener('pointercancel', up, { signal });
    signal.addEventListener('abort', () => { cancelAnimationFrame(raf); ro.disconnect(); });
  }

  function counters(root, signal) {
    const els = [...root.querySelectorAll('[data-cnt]')];
    const fmt = (v, f) => f === 'm' ? (v >= 1e6 ? (v / 1e6).toFixed(2).replace(/\.?0+$/, '') + 'M' : Math.round(v / 1e3) + 'k') : Math.round(v).toLocaleString('en-US');
    const io = new IntersectionObserver(es => es.forEach(e => { if (!e.isIntersecting) return; io.unobserve(e.target); const el = e.target, to = +el.dataset.cnt;
      new RR.Spring(0, { eps: .0005 }).on(p => el.textContent = fmt(to * RR.clamp(p), el.dataset.fmt)).to(1, { response: 1.4, damping: 1 }); }), { threshold: .4 });
    els.forEach(el => io.observe(el)); signal.addEventListener('abort', () => io.disconnect());
  }

  function wheel(sec, signal) {
    const { clamp, motion } = RR, wh = sec.querySelector('.wheel'); let base = 0, dragA = 0, drag = null, cur = 0, raf = 0, vel = 0;
    const tick = () => {
      raf = requestAnimationFrame(tick);
      const r = sec.getBoundingClientRect(), vh = innerHeight, p = motion.reduce ? 0 : clamp((vh - r.top) / (vh + r.height));
      if (!drag) { dragA += vel; vel *= .95; }
      const target = -p * 300 + dragA; cur += (target - cur) * .1;
      wh.style.transform = 'translateZ(calc(var(--wr) * -1)) rotateY(' + cur.toFixed(2) + 'deg)';
      [...wh.children].forEach(it => { const a = ((+it.style.getPropertyValue('--a').replace('deg', '') + cur) % 360 + 540) % 360 - 180, f = Math.cos(a * Math.PI / 180);
        it.style.opacity = (.25 + .75 * Math.max(0, f)).toFixed(3); });
    };
    raf = requestAnimationFrame(tick);
    sec.addEventListener('pointerdown', e => { if (!e.target.closest('.wheel-stage')) return; drag = { x: e.clientX, a: dragA, lx: e.clientX }; vel = 0; }, { signal });
    addEventListener('pointermove', e => { if (!drag) return; dragA = drag.a + (e.clientX - drag.x) * .25; vel = (e.clientX - drag.lx) * .25; drag.lx = e.clientX; }, { signal });
    addEventListener('pointerup', () => { drag = null; }, { signal });
    signal.addEventListener('abort', () => cancelAnimationFrame(raf));
  }

  RR.communityPage = (root, signal) => {
    const g = root.querySelector('[data-globe]'); g && globe(g, signal);
    counters(root, signal);
    const w = root.querySelector('[data-wheel]'); w && wheel(w, signal);
  };
})();
