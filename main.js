/* ==========================================================
   Jasmine Tsai — Portfolio · interactions
   Three.js r128 · shader hero · film-burn transitions
   ========================================================== */
(() => {
  'use strict';

  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => [...c.querySelectorAll(s)];
  const mqReduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  let reduced = mqReduce.matches;
  mqReduce.addEventListener?.('change', e => { reduced = e.matches; });
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  const DPR = Math.min(window.devicePixelRatio || 1, 2);

  const hasGL = (() => {
    if (!window.THREE) return false;
    try {
      const c = document.createElement('canvas');
      return !!(c.getContext('webgl2') || c.getContext('webgl'));
    } catch (e) { return false; }
  })();

  const easeInOut = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  const easeOut = t => 1 - Math.pow(1 - t, 3);
  const easeOutQuad = t => 1 - (1 - t) * (1 - t);
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const QS = new URLSearchParams(location.search);
  const SLOW = Math.max(1, parseFloat(QS.get('slow')) || 1); // QA: ?slow=10 slows every transition
  if (QS.has('qa')) {                                         // QA: ?qa=900 → full-page capture, hero height fixed
    const s = document.createElement('style');
    s.textContent = `.reveal{opacity:1!important;transform:none!important}.hero{height:${parseInt(QS.get('qa'), 10) || 900}px!important}.grain,.cursor{display:none}`;
    document.head.appendChild(s);
  }
  const tween = (dur, fn, ease = easeInOut) => new Promise(res => {
    dur *= SLOW;
    const t0 = performance.now();
    const step = now => {
      const t = Math.min(1, (now - t0) / dur);
      fn(ease(t), t);
      t < 1 ? requestAnimationFrame(step) : res();
    };
    requestAnimationFrame(step);
  });

  /* ---------- shared GLSL ---------- */
  const NOISE = `
    float hash(vec2 p){ p = fract(p*vec2(123.34,456.21)); p += dot(p,p+45.32); return fract(p.x*p.y); }
    float noise(vec2 p){ vec2 i=floor(p), f=fract(p); vec2 u=f*f*(3.-2.*f);
      return mix(mix(hash(i),hash(i+vec2(1,0)),u.x), mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),u.x), u.y); }
    float fbm(vec2 p){ float v=0., a=.5; for(int i=0;i<5;i++){ v+=a*noise(p); p=p*2.03+vec2(1.7,9.2); a*=.5; } return v; }
  `;
  const VERT_FS = `void main(){ gl_Position = vec4(position.xy, 0., 1.); }`;
  const VERT_UV = `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0., 1.); }`;

  /* ==========================================================
     1. HERO — flowing smoke, soft light + rising dust follow pointer
     ========================================================== */
  const hero = $('.hero');
  const heroInner = $('.hero-inner');
  // light rests low-right of the title until the pointer takes over
  const mouse = { x: .64, y: .3, tx: .64, ty: .3 };

  function initHero() {
    if (!hasGL) return;
    const canvas = $('#hero-gl');
    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false, powerPreference: 'high-performance' });
    } catch (e) { return; }
    renderer.setPixelRatio(Math.min(DPR, 1.5));
    const scene = new THREE.Scene();
    const cam = new THREE.Camera();
    const uniforms = {
      uTime: { value: 0 }, uRes: { value: new THREE.Vector2() },
      uMouse: { value: new THREE.Vector2(.5, .45) }, uIntro: { value: 0 }
    };
    const mat = new THREE.ShaderMaterial({
      uniforms, vertexShader: VERT_FS,
      fragmentShader: `
        precision highp float;
        uniform float uTime, uIntro; uniform vec2 uRes, uMouse;
        ${NOISE}
        // floating light dust: sparse points per cell, rising slowly, each twinkling on its own clock
        float dust(vec2 p, float scale, float speed, float seed){
          vec2 q = p * scale + vec2(sin(uTime * .07 + seed) * .4, -uTime * speed);
          vec2 id = floor(q), f = fract(q) - .5;
          float h = hash(id + seed);
          vec2 o = (vec2(hash(id + seed + 1.7), hash(id + seed + 4.1)) - .5) * .7;
          float tw = .5 + .5 * sin(uTime * (.6 + h * 2.2) + h * 40.);
          return step(h, .32) * smoothstep(.075, 0., length(f - o)) * tw * tw;
        }
        void main(){
          vec2 p = (gl_FragCoord.xy - .5*uRes) / uRes.y;
          vec2 m = (uMouse - .5) * vec2(uRes.x/uRes.y, 1.);
          float t = uTime * .035;
          vec2 q = vec2(fbm(p*1.4 + t), fbm(p*1.4 + vec2(5.2,1.3) - t));
          vec2 r = vec2(fbm(p*1.7 + 2.2*q + vec2(1.7,9.2) + .12*m), fbm(p*1.7 + 2.2*q + vec2(8.3,2.8) - t*.6));
          float f = fbm(p*1.9 + 2.4*r);
          // warm smoke
          vec3 col = mix(vec3(.02,.017,.015), vec3(.21,.14,.07), smoothstep(.22,.92,f));
          col = mix(col, vec3(.42,.29,.15), pow(smoothstep(.55,1.05,f), 3.) * .7);
          // soft light that follows the pointer, lifting the smoke
          float d = length(p - m);
          float halo = .07 / (d*d*3.2 + .12);
          col += vec3(1., .74, .46) * halo * (.3 + .8*f) * .42;
          col += vec3(1., .88, .7) * exp(-d*7.) * .07;
          // light dust — three depths, brighter where the light reaches
          float lit = .3 + 1.7 * exp(-d * 2.4);
          float dv = dust(p, 7., .045, 1.) + dust(p, 12., .03, 7.) * .65 + dust(p, 21., .018, 13.) * .4;
          col += vec3(1., .84, .58) * dv * lit * .5;
          // vignette + grain
          col *= smoothstep(1.35, .2, length(p*vec2(.78, 1.)));
          col += (hash(gl_FragCoord.xy + fract(uTime*7.)*91.) - .5) * .045;
          gl_FragColor = vec4(col * uIntro, 1.);
        }`
    });
    scene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat));

    const resize = () => {
      const w = hero.clientWidth, h = hero.clientHeight;
      renderer.setSize(w, h, false);
      uniforms.uRes.value.set(w * renderer.getPixelRatio(), h * renderer.getPixelRatio());
    };
    resize();
    window.addEventListener('resize', resize);

    let visible = true, raf = 0;
    new IntersectionObserver(([e]) => {
      visible = e.isIntersecting;
      if (visible && !raf) loop();
    }).observe(hero);

    const t0 = performance.now();
    function loop() {
      raf = 0;
      if (!visible) return;
      const now = performance.now();
      mouse.x += (mouse.tx - mouse.x) * .06;
      mouse.y += (mouse.ty - mouse.y) * .06;
      uniforms.uMouse.value.set(mouse.x, mouse.y);
      uniforms.uTime.value = reduced ? 12 : (now - t0) / 1000;
      uniforms.uIntro.value = Math.min(1, (now - t0) / 1800);
      renderer.render(scene, cam);
      if (reduced && uniforms.uIntro.value >= 1) return; // one still frame
      raf = requestAnimationFrame(loop);
    }
    loop();
    mqReduce.addEventListener?.('change', () => { if (!raf) loop(); });
    canvas.style.opacity = 1;
  }

  window.addEventListener('pointermove', e => {
    mouse.tx = e.clientX / window.innerWidth;
    mouse.ty = 1 - e.clientY / window.innerHeight;
  }, { passive: true });

  /* hero parallax on scroll + pointer */
  function heroParallax() {
    if (reduced) { heroInner.style.transform = ''; return; }
    const y = window.scrollY, h = hero.clientHeight;
    if (y > h) return;
    const k = y / h;
    const px = (mouse.x - .5) * -14, py = (mouse.y - .5) * 10;
    heroInner.style.transform = `translate3d(${px}px, ${py + y * .35}px, 0)`;
    heroInner.style.opacity = String(1 - k * 1.3);
  }
  (function pl() { heroParallax(); requestAnimationFrame(pl); })();

  /* ==========================================================
     2. FULL-SCREEN TRANSITION — soft light blooms from the click, then clears
     ========================================================== */
  const burnCanvas = $('#burn');
  const burnFallback = $('.burn-fallback');
  let burnGL = null;

  function initBurn() {
    if (!hasGL) return;
    try {
      const renderer = new THREE.WebGLRenderer({ canvas: burnCanvas, alpha: true, premultipliedAlpha: false, antialias: false, preserveDrawingBuffer: SLOW > 1 });
      renderer.setPixelRatio(Math.min(DPR, 1.5));
      renderer.setClearColor(0x000000, 0);
      const uniforms = {
        uP: { value: 0 }, uMode: { value: 0 }, uTime: { value: 0 }, uMax: { value: 1 },
        uO: { value: new THREE.Vector2(.5, .5) }, uRes: { value: new THREE.Vector2(1, 1) }
      };
      const mat = new THREE.ShaderMaterial({
        uniforms, transparent: true, vertexShader: VERT_FS,
        fragmentShader: `
          precision highp float;
          uniform float uP, uMode, uTime, uMax; uniform vec2 uO, uRes;
          ${NOISE}
          void main(){
            vec2 uv = gl_FragCoord.xy / uRes;
            float asp = uRes.x / uRes.y;
            vec2 p = (uv - uO) * vec2(asp, 1.);
            float d = length(p);
            float n = fbm(uv * vec2(asp,1.) * 2.2 + uTime*.1) - .5;   // gentle wobble, not flames
            float feather = .3;
            float r = uP * (uMax + feather);
            float e = r - d + n * .05;
            float disc = smoothstep(-feather, 0., e);                    // soft-edged light disc
            // light: bright cream at the origin, sinking to deep ink toward the edge and over time
            float bloom = exp(-d * 2.6) * pow(1. - uP, .7);
            float ring = exp(-abs(e + feather * .45) * 6.);
            vec3 ink = vec3(.045, .037, .032);
            vec3 cream = vec3(1., .86, .64);
            vec3 col = mix(ink, cream, clamp(bloom * .85 + ring * .18, 0., 1.));
            float a;
            if (uMode < .5) {
              a = disc * mix(.55, 1., smoothstep(.35, .9, uP));          // translucent glow first, opaque at the end
            } else {
              a = 1. - disc;                                              // clear from the centre outward
              col = mix(ink, cream, ring * .22 * (1. - uP));
            }
            gl_FragColor = vec4(col, a);
          }`
      });
      const scene = new THREE.Scene();
      scene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat));
      const cam = new THREE.Camera();
      const size = () => {
        renderer.setSize(window.innerWidth, window.innerHeight, false);
        uniforms.uRes.value.set(window.innerWidth * renderer.getPixelRatio(), window.innerHeight * renderer.getPixelRatio());
      };
      size();
      window.addEventListener('resize', size);
      burnGL = { renderer, uniforms, render: () => renderer.render(scene, cam) };
      if (SLOW > 1) window.__burnDraw = (p, mode, ox, oy) => { uniforms.uP.value = p; uniforms.uMode.value = mode; uniforms.uO.value.set(ox, oy); { const asp = innerWidth / innerHeight; uniforms.uMax.value = Math.hypot(Math.max(ox, 1 - ox) * asp, Math.max(oy, 1 - oy)); } burnCanvas.classList.add('on'); renderer.render(scene, cam); return burnCanvas.toDataURL('image/png'); };
    } catch (e) { burnGL = null; }
  }

  // distance from (ox, oy) to the farthest screen corner, in aspect-corrected units
  const farCorner = (ox, oy) => { const asp = window.innerWidth / window.innerHeight; return Math.hypot(Math.max(ox, 1 - ox) * asp, Math.max(oy, 1 - oy)); };

  async function filmBurn(origin, midpoint) {
    const ox = origin.x / window.innerWidth, oy = origin.y / window.innerHeight;
    if (reduced) { midpoint(); return; }
    if (!burnGL) {
      burnFallback.style.setProperty('--x', ox * 100 + '%');
      burnFallback.style.setProperty('--y', oy * 100 + '%');
      burnFallback.classList.add('on');
      await wait(720);
      midpoint();
      await wait(80);
      burnFallback.classList.remove('on');
      await wait(700);
      return;
    }
    const { uniforms: u, render } = burnGL;
    burnCanvas.classList.add('on');
    const t0 = performance.now();
    const tick = () => { u.uTime.value = (performance.now() - t0) / 1000; render(); };
    u.uMode.value = 0; u.uO.value.set(ox, 1 - oy); u.uMax.value = farCorner(ox, oy);
    await tween(950, p => { u.uP.value = p; tick(); });
    midpoint();
    await wait(80);
    u.uMode.value = 1; u.uO.value.set(.5, .5); u.uMax.value = farCorner(.5, .5);
    await tween(1100, p => { u.uP.value = p; tick(); }, easeOut);
    burnCanvas.classList.remove('on');
  }

  /* enter the portfolio: button / scroll / swipe */
  const numbers = hero.nextElementSibling;          // first chapter after the hero
  const numbersTitle = $('h2', numbers);
  numbersTitle.setAttribute('tabindex', '-1');
  let travelling = false;

  async function enterPortfolio(origin, focus) {
    if (travelling) return;
    travelling = true;
    await filmBurn(origin, () => {
      document.documentElement.style.scrollBehavior = 'auto';
      window.scrollTo(0, numbers.offsetTop);
      document.documentElement.style.scrollBehavior = '';
      if (focus) numbersTitle.focus({ preventScroll: true });
    });
    travelling = false;
  }

  $('#enter').addEventListener('click', e => {
    const r = e.currentTarget.getBoundingClientRect();
    const kb = e.detail === 0;
    enterPortfolio(kb ? { x: r.left + r.width / 2, y: r.top + r.height / 2 } : { x: e.clientX, y: e.clientY }, kb);
  });

  const atTop = () => window.scrollY < 8;
  window.addEventListener('wheel', e => {
    if (travelling) { e.preventDefault(); return; }
    if (atTop() && e.deltaY > 4 && !reduced && !$('#lightbox').open) {
      e.preventDefault();
      enterPortfolio({ x: window.innerWidth / 2, y: window.innerHeight * .62 });
    }
  }, { passive: false });
  let touchY = null;
  window.addEventListener('touchstart', e => { touchY = e.touches[0].clientY; }, { passive: true });
  window.addEventListener('touchmove', e => {
    if (travelling) { e.preventDefault(); return; }
    if (touchY !== null && atTop() && !reduced && touchY - e.touches[0].clientY > 24) {
      e.preventDefault();
      touchY = null;
      enterPortfolio({ x: window.innerWidth / 2, y: window.innerHeight * .62 });
    }
  }, { passive: false });

  /* ==========================================================
     3. MEDIA TOGGLE — still ↔ live, soft light blooms from the click point
     ========================================================== */
  function coverFit(texW, texH, boxW, boxH, align) {
    const ta = texW / texH, ca = boxW / boxH;
    if (ta > ca) { const sx = ca / ta; return new THREE.Vector4(sx, 1, (1 - sx) / 2, 0); }
    const sy = ta / ca;
    return new THREE.Vector4(1, sy, 0, (1 - align) * (1 - sy));
  }
  const dims = el => el.tagName === 'VIDEO' ? [el.videoWidth || 720, el.videoHeight || 1280] : [el.naturalWidth || 1, el.naturalHeight || 1];

  function makeTex(el) {
    const t = el.tagName === 'VIDEO' ? new THREE.VideoTexture(el) : new THREE.Texture(el);
    t.minFilter = THREE.LinearFilter; t.magFilter = THREE.LinearFilter; t.generateMipmaps = false;
    t.needsUpdate = true;
    return t;
  }

  function shaderSwap(media, fromEl, toEl, origin, dur) {
    const rect = media.getBoundingClientRect();
    const W = rect.width, H = rect.height;
    const align = parseFloat(media.dataset.align || '.5');
    const renderer = new THREE.WebGLRenderer({ antialias: false, alpha: false, preserveDrawingBuffer: SLOW > 1 });
    renderer.setPixelRatio(DPR);
    renderer.setSize(W, H, false);
    const canvas = renderer.domElement;
    canvas.className = 'fx';
    const tA = makeTex(fromEl), tB = makeTex(toEl);
    const asp = W / H;
    const u = {
      tA: { value: tA }, tB: { value: tB },
      fitA: { value: coverFit(...dims(fromEl), W, H, align) },
      fitB: { value: coverFit(...dims(toEl), W, H, align) },
      uP: { value: 0 }, uO: { value: new THREE.Vector2(origin.x, 1 - origin.y) },
      uAsp: { value: asp }, uMax: { value: Math.hypot(Math.max(origin.x, 1 - origin.x) * asp, Math.max(origin.y, 1 - origin.y)) },
      uTime: { value: 0 }
    };
    const mat = new THREE.ShaderMaterial({
      uniforms: u, vertexShader: VERT_UV,
      fragmentShader: `
        precision highp float;
        uniform sampler2D tA, tB; uniform vec4 fitA, fitB;
        uniform float uP, uAsp, uMax, uTime; uniform vec2 uO;
        varying vec2 vUv;
        ${NOISE}
        void main(){
          vec2 p = (vUv - uO) * vec2(uAsp, 1.);
          float d = length(p);
          float n = fbm(vUv * vec2(uAsp, 1.) * 2.4 + uTime * .1) - .5;
          float feather = .32;
          float e = uP * (uMax + feather * 1.5) - d + n * .05;
          float m = smoothstep(-feather, 0., e);                                  // wide, soft edge
          vec3 a = texture2D(tA, vUv * fitA.xy + fitA.zw).rgb;
          vec3 b = texture2D(tB, vUv * fitB.xy + fitB.zw).rgb;
          vec3 col = mix(a, b, m);
          float glow = exp(-abs(e + feather * .5) * 7.) * sin(3.14159 * uP);     // light rides the edge, fades out
          col += vec3(1., .82, .58) * glow * .32;
          col *= 1. + .12 * sin(3.14159 * uP);                                    // gentle overall brightening
          gl_FragColor = vec4(col, 1.);
        }`
    });
    const scene = new THREE.Scene();
    scene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat));
    const cam = new THREE.Camera();
    renderer.render(scene, cam);
    media.appendChild(canvas);
    if (SLOW > 1) { window.__fxU = u; window.__fxDraw = p => { u.uP.value = p; renderer.render(scene, cam); return canvas.toDataURL('image/jpeg', .85); }; }
    const t0 = performance.now();
    return {
      run: () => tween(dur, p => { u.uP.value = p; u.uTime.value = (performance.now() - t0) / 1000; renderer.render(scene, cam); }, easeOutQuad),
      done: () => {
        canvas.remove();
        tA.dispose(); tB.dispose(); mat.dispose();
        renderer.dispose(); renderer.forceContextLoss();
      }
    };
  }

  const readyVideo = v => new Promise(res => {
    if (v.readyState >= 2) return res();
    const ok = () => { v.removeEventListener('loadeddata', ok); res(); };
    v.addEventListener('loadeddata', ok);
    setTimeout(res, 4000);
  });
  const readyImg = img => {
    if (img.complete && img.naturalWidth) return Promise.resolve();
    img.loading = 'eager'; // a lazy image that hasn't started would never settle
    const loaded = new Promise(res => { img.addEventListener('load', res, { once: true }); img.addEventListener('error', res, { once: true }); });
    return Promise.race([loaded, wait(4000)]);
  };

  async function toggleMedia(media, evt) {
    if (media.busy) return;
    media.busy = true;
    const still = $('.still', media), live = $('.live', media);
    const isVideo = live.tagName === 'VIDEO';
    const toLive = !media.classList.contains('is-live');
    const btn = $('.media-toggle', media);
    const rect = media.getBoundingClientRect();
    const kb = !evt || evt.detail === 0;
    const origin = kb ? { x: .5, y: .5 } : { x: (evt.clientX - rect.left) / rect.width, y: (evt.clientY - rect.top) / rect.height };

    media.classList.add('is-loading');
    if (isVideo && toLive) {
      if (live.preload === 'none') { live.preload = 'auto'; live.load(); }
      live.muted = true;
      const p = live.play(); if (p) p.catch(() => {});
      await readyVideo(live);
    }
    await readyImg(still);
    if (!isVideo) await readyImg(live);
    media.classList.remove('is-loading');

    const setState = () => {
      media.classList.toggle('is-live', toLive);
      btn.setAttribute('aria-pressed', String(toLive));
      if (isVideo) btn.dataset.cursor = toLive ? '暫停' : '播放';
      else btn.dataset.cursor = toLive ? '還原' : '顯影';
      if (cursorEl && cursorEl.classList.contains('big')) cursorLabel.textContent = btn.dataset.cursor;
    };

    if (reduced) {
      setState();
    } else if (hasGL && !media.classList.contains('fx-fallback')) {
      let fx = null;
      try { fx = shaderSwap(media, toLive ? still : live, toLive ? live : still, origin, isVideo ? 950 : 850); }
      catch (err) { fx = null; media.classList.add('fx-fallback'); }
      if (fx) {
        await fx.run();
        setState();
        await wait(16);
        fx.done();
      } else {
        await cssSwap(media, origin, setState);
      }
    } else {
      media.classList.add('fx-fallback');
      await cssSwap(media, origin, setState);
    }

    if (isVideo && !toLive) {
      live.pause();
      const s = $('.reel-sound', media);
      if (s) { live.muted = true; s.setAttribute('aria-pressed', 'false'); s.setAttribute('aria-label', '開啟聲音'); }
    }
    media.busy = false;
  }

  async function cssSwap(media, origin, setState) {
    media.style.setProperty('--x', origin.x * 100 + '%');
    media.style.setProperty('--y', origin.y * 100 + '%');
    setState();
    await wait(900);
  }

  const preload = new IntersectionObserver(entries => entries.forEach(en => {
    if (!en.isIntersecting) return;
    const live = $('.live', en.target);
    if (live && live.tagName === 'IMG') live.loading = 'eager';
    preload.unobserve(en.target);
  }), { rootMargin: '600px 0px' });

  $$('.media').forEach(media => {
    preload.observe(media);
    if (media.classList.contains('media--reel')) {
      const tri = document.createElement('span');
      tri.className = 'play-tri'; tri.setAttribute('aria-hidden', 'true');
      media.appendChild(tri);
    }
    const toggle = $('.media-toggle', media);
    if (toggle && $('.live', media)) toggle.addEventListener('click', e => toggleMedia(media, e));
  });

  /* sound buttons — one voice at a time */
  $$('.reel-sound').forEach(b => b.addEventListener('click', e => {
    e.stopPropagation();
    const v = $('video', b.closest('.media'));
    const on = v.muted;
    $$('.reel video').forEach(o => { o.muted = true; });
    $$('.reel-sound').forEach(o => { o.setAttribute('aria-pressed', 'false'); o.setAttribute('aria-label', '開啟聲音'); });
    v.muted = !on;
    b.setAttribute('aria-pressed', String(on));
    b.setAttribute('aria-label', on ? '關閉聲音' : '開啟聲音');
  }));

  /* pause live reels that leave the viewport */
  const vio = new IntersectionObserver(entries => entries.forEach(en => {
    const media = en.target, v = $('video', media);
    if (!media.classList.contains('is-live') || media.busy) return;
    if (en.isIntersecting) { const p = v.play(); if (p) p.catch(() => {}); } else v.pause();
  }), { threshold: .2 });
  $$('.media--reel').forEach(m => vio.observe(m));

  /* ==========================================================
     4. REVEALS + COUNTERS
     ========================================================== */
  $$('.stats, .work-grid, .reel-rail, .skills, .svc-grid, .process, .features, .topics, .offers, .voice-list').forEach(group => {
    $$(':scope > .reveal', group).forEach((el, i) => el.style.setProperty('--d', (i * .09).toFixed(2) + 's'));
  });

  const fmt = (v, dec) => dec ? v.toFixed(dec) : Math.round(v).toLocaleString('en-US');
  function countUp(el) {
    if (el.dataset.done) return;
    el.dataset.done = 1;
    const target = parseFloat(el.dataset.count), dec = parseInt(el.dataset.decimals || '0', 10);
    if (reduced) { el.textContent = fmt(target, dec); return; }
    tween(1800, p => { el.textContent = fmt(target * p, dec); }, easeOut);
  }

  const rio = new IntersectionObserver(entries => entries.forEach(en => {
    if (!en.isIntersecting) return;
    en.target.classList.add('in');
    $$('[data-count]', en.target).forEach(countUp);
    rio.unobserve(en.target);
  }), { threshold: .14, rootMargin: '0px 0px -6% 0px' });
  $$('.reveal').forEach(el => rio.observe(el));

  /* ==========================================================
     5. NAV — hide on scroll down, current section
     ========================================================== */
  const nav = $('#nav');
  let lastY = window.scrollY;
  window.addEventListener('scroll', () => {
    const y = window.scrollY;
    nav.classList.toggle('scrolled', y > 40);
    nav.classList.toggle('hide', y > lastY && y > window.innerHeight * .9 && !nav.matches(':focus-within'));
    lastY = y;
  }, { passive: true });

  const links = $$('.nav-links a');
  const sio = new IntersectionObserver(entries => entries.forEach(en => {
    if (!en.isIntersecting) return;
    links.forEach(a => a.setAttribute('aria-current', String(a.getAttribute('href') === '#' + en.target.id)));
  }), { rootMargin: '-45% 0px -50% 0px' });
  ['products', 'chakra', 'reels', 'work', 'services'].forEach(id => sio.observe(document.getElementById(id)));

  /* ==========================================================
     6. CURSOR + MICRO-INTERACTIONS
     ========================================================== */
  let cursorEl = null, cursorLabel = null;
  if (finePointer) {
    cursorEl = $('.cursor'); cursorLabel = $('.cursor-label');
    document.body.classList.add('has-cursor');
    const c = { x: -100, y: -100, tx: -100, ty: -100 };
    window.addEventListener('pointermove', e => {
      c.tx = e.clientX; c.ty = e.clientY;
      cursorEl.classList.add('show');
    }, { passive: true });
    document.addEventListener('pointerleave', () => cursorEl.classList.remove('show'));
    (function follow() {
      const k = reduced ? 1 : .2;
      c.x += (c.tx - c.x) * k; c.y += (c.ty - c.y) * k;
      cursorEl.style.transform = `translate3d(${c.x}px, ${c.y}px, 0)`;
      requestAnimationFrame(follow);
    })();
    document.addEventListener('pointerover', e => {
      const t = e.target.closest('[data-cursor]');
      if (t) { cursorLabel.textContent = t.dataset.cursor; cursorEl.classList.add('big'); }
      else cursorEl.classList.remove('big');
    });

    /* magnetic buttons */
    $$('.btn-enter, .btn-line, .nav-cta').forEach(b => {
      b.addEventListener('pointermove', e => {
        if (reduced) return;
        const r = b.getBoundingClientRect();
        const x = (e.clientX - r.left - r.width / 2) * .22, y = (e.clientY - r.top - r.height / 2) * .32;
        b.style.transform = `translate(${x}px, ${y}px)`;
      });
      b.addEventListener('pointerleave', () => { b.style.transform = ''; });
    });
  }

  /* spotlight on service cards */
  $$('.svc').forEach(s => s.addEventListener('pointermove', e => {
    const r = s.getBoundingClientRect();
    s.style.setProperty('--mx', (e.clientX - r.left) + 'px');
    s.style.setProperty('--my', (e.clientY - r.top) + 'px');
  }));

  /* drag-to-scroll filmstrip */
  $$('.strip').forEach(strip => {
    let down = false, sx = 0, sl = 0, moved = false;
    strip.addEventListener('pointerdown', e => {
      if (e.pointerType !== 'mouse') return;
      down = true; moved = false; sx = e.clientX; sl = strip.scrollLeft;
      strip.style.scrollSnapType = 'none';
    });
    window.addEventListener('pointermove', e => {
      if (!down) return;
      const dx = e.clientX - sx;
      if (Math.abs(dx) > 3) moved = true;
      strip.scrollLeft = sl - dx;
    });
    window.addEventListener('pointerup', () => { if (!down) return; down = false; strip.style.scrollSnapType = ''; });
    strip.addEventListener('click', e => { if (moved) e.preventDefault(); }, true);
    strip.addEventListener('dragstart', e => e.preventDefault());
  });

  /* ==========================================================
     7. LIGHTBOX
     ========================================================== */
  const galleries = {
    threads: [['assets/img/case-threads.jpg', 'Threads 爆文〈向上管理的 7 個潛規則〉：8.2 萬瀏覽・1,136 互動']],
    courses: [
      ['assets/img/course-designer.jpg', '設計師接案必修課：模組架構、對外文案、主視覺協作'],
      ['assets/img/course-data.jpg', '數據分析師入門實戰：模組規劃、文案、長條圖視覺'],
      ['assets/img/course-ga4.jpg', 'GA4 × Looker Studio：五大模組結構與視覺企劃'],
      ['assets/img/record-wine.jpg', '葡萄酒課程拍攝現場：與攝影團隊協作'],
      ['assets/img/record-studio.jpg', '線上課程拍攝：全程提詞與章節把關'],
      ['assets/img/record-workshop.jpg', '實體課程現場監製'],
      ['assets/img/record-ads.jpg', '廣告投手商模工作坊']
    ],
    brand: [
      ['assets/img/case-104-ig-1.jpg', '104 人力銀行 IG：2025 上班族工作價值觀 Top10'],
      ['assets/img/case-104-ig-2.jpg', '從數據報告提煉的「有趣小總結」'],
      ['assets/img/case-104-linkedin.jpg', '104 獵才顧問 LinkedIn：資深工作者主題策展，互動率 27.2%']
    ]
  };
  const lb = $('#lightbox'), stage = $('.lb-stage', lb), cap = $('.lb-caption', lb);
  let lbItems = [], lbIdx = 0;

  function lbShow(i) {
    lbIdx = (i + lbItems.length) % lbItems.length;
    const [src, text, type] = lbItems[lbIdx];
    stage.innerHTML = '';
    let el;
    if (type === 'video') {
      el = document.createElement('video');
      Object.assign(el, { src, controls: true, playsInline: true, autoplay: true, loop: true });
    } else {
      el = document.createElement('img');
      el.src = src; el.alt = text;
    }
    stage.appendChild(el);
    if (type === 'video') { const p = el.play(); if (p) p.catch(() => {}); }
    cap.textContent = lbItems.length > 1 ? `${lbIdx + 1} / ${lbItems.length}　${text}` : text;
  }
  function lbOpen(items, i = 0) {
    lbItems = items;
    lb.classList.toggle('single', items.length < 2);
    $$('.reel video').forEach(v => v.pause());
    if (typeof lb.showModal === 'function') lb.showModal(); else lb.setAttribute('open', '');
    lbShow(i);
    $('.lb-close', lb).focus();
  }
  function lbClose() {
    stage.innerHTML = '';
    if (lb.open) lb.close();
    $$('.media--reel.is-live video').forEach(v => { const r = v.getBoundingClientRect(); if (r.bottom > 0 && r.top < innerHeight) { const p = v.play(); if (p) p.catch(() => {}); } });
  }
  lb.addEventListener('close', () => { stage.innerHTML = ''; });
  $('.lb-close', lb).addEventListener('click', lbClose);
  $('.lb-prev', lb).addEventListener('click', () => lbShow(lbIdx - 1));
  $('.lb-next', lb).addEventListener('click', () => lbShow(lbIdx + 1));
  lb.addEventListener('click', e => { if (e.target === lb || e.target === stage) lbClose(); });
  lb.addEventListener('keydown', e => {
    if (e.key === 'ArrowLeft' && lbItems.length > 1) lbShow(lbIdx - 1);
    if (e.key === 'ArrowRight' && lbItems.length > 1) lbShow(lbIdx + 1);
  });

  $$('[data-gallery]').forEach(b => b.addEventListener('click', () => lbOpen(galleries[b.dataset.gallery], +(b.dataset.index || 0))));
  $$('[data-reel]').forEach(b => b.addEventListener('click', () => {
    const title = b.dataset.title || $('.reel-title', b.closest('.reel')).textContent;
    lbOpen([[b.dataset.reel, title, 'video']]);
  }));
  $$('.strip img').forEach((img, i, all) => {
    img.closest('li').addEventListener('click', () => lbOpen(all.map(x => [x.src, x.closest('figure').querySelector('figcaption').textContent]), i));
  });
  $('.strip').addEventListener('keydown', e => {
    if (e.key === 'Enter') { const all = $$('.strip img'); lbOpen(all.map(x => [x.src, x.closest('figure').querySelector('figcaption').textContent]), 0); }
  });

  /* ==========================================================
     8. BOOT
     ========================================================== */
  initHero();
  initBurn();
  const go = () => { document.body.classList.remove('is-loading'); document.body.classList.add('ready'); };
  (document.fonts && document.fonts.ready ? Promise.race([document.fonts.ready, wait(1200)]) : wait(0)).then(() => requestAnimationFrame(go));
})();
