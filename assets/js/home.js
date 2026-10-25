/* Landing page: hero slideshow, the "Our work" stage (three sample homes x
   five live demos), the launch pack made live in the browser, and the chat form. */
(function () {
  'use strict';
  const MZ = window.MZ;
  const { $, $$, esc } = MZ;
  const D = MZ.data;

  // ---------- hero: crossfading Ken Burns stills ----------
  function initHero() {
    const imgs = $$('#heroMedia img');
    if (imgs.length < 2 || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let i = 0;
    setInterval(() => {
      if (document.hidden) return;
      const next = imgs[(i + 1) % imgs.length];
      if (next.dataset.src) { next.src = next.dataset.src; next.removeAttribute('data-src'); }
      const show = () => {
        imgs[i].classList.remove('on');
        next.classList.remove('on'); void next.offsetWidth; next.classList.add('on');
        i = (i + 1) % imgs.length;
      };
      if (next.complete && next.naturalWidth) show(); else next.addEventListener('load', show, { once: true });
    }, 6500);
  }

  // ---------- "See the difference" ----------
  const views = {
    tour: {
      title: 'Walk through it before the open home',
      lede: 'Buyers explore every room in 3D on their phone or laptop, and jump straight to the kitchen, the terrace or the main bedroom.',
      note: (h) => `Live 3D scan, streamed in your browser. ${h.scanNote || ''} Licensed sample scan; credits at the bottom of the page.`
    },
    photo: {
      title: 'Photos finished, nothing invented',
      lede: 'Light, colour and sharpness are corrected so every room looks its best, on a grey day or a sunny one.',
      note: () => 'Drag the handle. Only light and colour change, worked out live in your browser. Every edit is logged and labelled.'
    },
    dusk: {
      title: 'A twilight hero shot, without a second shoot',
      lede: 'The day photo becomes an evening one: a sunset sky with the original clouds relit, a cooler evening grade, and warm light in the windows.',
      note: () => 'Simulated twilight, made live in your browser. Exterior is a public-domain photo of a similar house. Every export is labelled "Simulated twilight".'
    },
    plan: {
      title: 'A floor plan buyers can click',
      lede: 'Tap a room to see its size, then step straight into it in the 3D tour.',
      note: () => 'Plan traced from the 3D scan. Sizes are approximate.'
    },
    privacy: {
      title: 'Personal things stay personal',
      lede: 'Before anything goes public we blur family photos, faces, mail and number plates. Your vendors will notice.',
      note: () => 'Example from the family room of Sample home 2. Drag across the photo to blur anything else.'
    }
  };
  let home = D.homes[0];
  let view = 'tour';
  const cache = {};               // per home + view: rendered canvases and change logs
  let tour = { frame: null, ready: false, poll: null };
  let picker = null;

  function initHomePick() {
    const host = $('#homePick');
    host.innerHTML = D.homes.map((h, i) => `
      <button type="button" role="radio" aria-checked="${i === 0}" data-home="${h.id}">
        <span class="hp-th" style="background-image:url('${h.photos[0].src.replace('.jpg', '-t.jpg')}')"></span>
        <span class="hp-tx"><b>${esc(h.short)}</b><small>${esc(h.suburb)} · ${h.plan.rooms.filter((r) => r.cam).length} rooms in 3D</small></span>
      </button>`).join('');
    $$('button', host).forEach((b) => b.addEventListener('click', () => setHome(b.dataset.home)));
  }

  function setHome(id) {
    if (home.id === id) return;
    home = D.home(id);
    $$('#homePick button').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.home === id)));
    $('#openListing').href = 'listing.html?home=' + id;
    stopTour();
    showView(view);
    if (launch.shown) renderLaunch();
  }

  function showView(v) {
    view = v;
    $$('#stage > .view').forEach((el) => el.classList.toggle('on', el.dataset.view === v));
    const meta = views[v];
    $('#work-title').textContent = meta.title;
    $('#work-lede').textContent = meta.lede;
    $('#work-note').textContent = meta.note(home);
    $('#tourRoomsHome').hidden = v !== 'tour';
    if (v === 'tour') renderTourPoster();
    if (v === 'photo') renderPhoto();
    if (v === 'dusk') renderDusk();
    if (v === 'plan') renderPlan();
    if (v === 'privacy') renderPrivacy();
  }

  function side(html) { $('#stageSide').innerHTML = html; }
  function changeList(title, rows, foot) {
    side(`<h4>${esc(title)}</h4><ul class="chg">${rows.map((r) => `<li><span>${esc(r.k)}</span><b>${esc(r.v)}</b>${r.d ? `<small>${esc(r.d)}</small>` : ''}</li>`).join('')}</ul>${foot ? `<p class="small muted mt1">${foot}</p>` : ''}`);
  }

  // ---- 3D tour, embedded ----
  function renderTourPoster() {
    $('#tourPosterImg').src = home.tour.poster;
    const rooms = home.plan.rooms.filter((r) => r.cam);
    $('#tourRoomsHome').innerHTML = rooms.map((r) => `<button type="button" data-room="${r.id}">${esc(r.short || r.name)}</button>`).join('');
    $$('#tourRoomsHome button').forEach((b) => b.addEventListener('click', () => jump(b.dataset.room)));
    const facts = [home.beds && `${home.beds} bedrooms`, home.living && `${home.living} living area${home.living > 1 ? 's' : ''}`, `${home.floor} m² ${home.floorNote}`].filter(Boolean);
    side(`<h4>${esc(home.title)}</h4><p class="small muted">${esc(home.suburb)} · licensed sample scan</p>
      <ul class="chg">${facts.map((f) => `<li><b>${esc(f)}</b></li>`).join('')}</ul>
      <h5 class="mt1">Jump to a room</h5>
      <div class="side-rooms">${rooms.map((r) => `<button type="button" data-room="${r.id}"><img src="${r.thumb}" alt="" loading="lazy"><span>${esc(r.name)}</span></button>`).join('')}</div>`);
    $$('#stageSide [data-room]').forEach((b) => b.addEventListener('click', () => jump(b.dataset.room)));
  }

  function viewer() {
    try { const w = tour.frame && tour.frame.contentWindow; return w && typeof w.setCameraState === 'function' ? w : null; } catch (e) { return null; }
  }
  function startTour(roomId) {
    const frame = $('#tourFrameHome');
    tour.frame = frame;
    if (!frame.src || frame.dataset.home !== home.id) {
      tour.ready = false;
      frame.dataset.home = home.id;
      frame.src = home.tour.src;
    }
    frame.hidden = false;
    $('#tourStart').hidden = true;
    $('#tourPosterImg').hidden = true;
    if (!tour.ready) $('#tourLoadingHome').hidden = false;
    clearInterval(tour.poll);
    let tries = 0;
    tour.poll = setInterval(() => {
      const w = viewer();
      if (w) {
        clearInterval(tour.poll);
        tour.ready = true;
        $('#tourLoadingHome').hidden = true;
        jump(roomId || (home.tour.start || null));
      } else if (++tries > 600) clearInterval(tour.poll);
    }, 200);
    MZ.analytics.track(home.id, 'tour-open');
  }
  function stopTour() {
    clearInterval(tour.poll);
    const frame = $('#tourFrameHome');
    if (frame) { frame.hidden = true; frame.removeAttribute('src'); frame.dataset.home = ''; }
    tour.ready = false;
    $('#tourStart').hidden = false;
    $('#tourPosterImg').hidden = false;
    $('#tourLoadingHome').hidden = true;
  }
  function jump(id) {
    if (!id) return;
    if (view !== 'tour') picker.select('tour');
    if (!tour.ready) { startTour(id); return; }
    const r = home.plan.rooms.find((x) => x.id === id);
    const w = viewer();
    if (!r || !r.cam || !w) return;
    try { w.setCameraState({ position: r.cam.position.slice(), angles: r.cam.angles.slice(), distance: 1, fov: 75, mode: 'walk' }); } catch (e) { console.warn(e); }
    $$('#tourRoomsHome button, #stageSide [data-room]').forEach((b) => b.classList.toggle('on', b.dataset.room === id));
    try { tour.frame.focus({ preventScroll: true }); } catch (e) { /* ignore */ }
  }

  // ---- photo finishing ----
  async function renderPhoto() {
    const key = home.id + ':photo';
    const shot = home.photos.find((p) => p.room === home.enhanceDemo) || home.photos[0];
    const src = home.enhanceSrc || shot.src;
    $('#photoBefore').src = src;
    if (!cache[key]) {
      cache[key] = (async () => {
        const img = await MZ.photo.loadImage(src);
        const c = MZ.photo.toCanvas(img, 1600);
        const params = MZ.photo.autoParams(c);
        return { canvas: MZ.photo.apply(c, params), changes: MZ.photo.describe(params) };
      })();
    }
    try {
      const res = await cache[key];
      if (home.id + ':photo' !== key || view !== 'photo') return;
      const out = $('#photoAfter');
      out.width = res.canvas.width; out.height = res.canvas.height;
      out.getContext('2d').drawImage(res.canvas, 0, 0);
      const cmp = MZ.initCompare($('#photoCompare'));
      if (cmp && cmp.replay) cmp.replay();
      changeList('What changed', res.changes.length ? res.changes : [{ k: 'Nothing', v: 'already well exposed' }], `${esc(shot.caption)} · the original stays one tap away on the listing.`);
    } catch (e) { console.warn(e); }
  }

  // ---- day to dusk ----
  async function renderDusk() {
    const key = home.id + ':dusk';
    $('#duskBefore').src = home.exterior.src;
    if (!cache[key]) {
      cache[key] = (async () => {
        const img = await MZ.photo.loadImage(home.exterior.src);
        const c = MZ.photo.toCanvas(img, 1600);
        return MZ.photo.dusk(c, home.dusk);
      })();
    }
    try {
      const res = await cache[key];
      if (view !== 'dusk' || home.id + ':dusk' !== key) return;
      const out = $('#duskAfter');
      out.width = res.canvas.width; out.height = res.canvas.height;
      out.getContext('2d').drawImage(res.canvas, 0, 0);
      const cmp = MZ.initCompare($('#duskCompare'));
      if (cmp && cmp.replay) cmp.replay();
      changeList('What changed', res.changes.filter((c) => c.v !== 'none'), 'Nothing in the photo is moved, added or removed.');
    } catch (e) { console.warn(e); }
  }

  // ---- floor plan ----
  function renderPlan() {
    const fp = MZ.floorplan.mount($('#planDemo'), {
      plan: home.plan,
      onRoom: (room) => {
        sideRoom(room);
      }
    });
    fp.showImage(true, 0.55);
    const rooms = home.plan.rooms.filter((r) => r.name !== 'Hall');
    side(`<h4>Rooms</h4><p class="small muted">Tap a room on the plan or below.</p><ul class="chg rooms">${rooms.map((r) =>
      `<li><button type="button" data-plan-room="${r.id}"><span>${esc(r.name)}</span><b>${r.w.toFixed(1)} × ${r.d.toFixed(1)} m</b></button></li>`).join('')}</ul>`);
    $$('#stageSide [data-plan-room]').forEach((b) => b.addEventListener('click', () => { fp.select(b.dataset.planRoom); sideRoom(home.plan.rooms.find((r) => r.id === b.dataset.planRoom)); }));
  }
  function sideRoom(r) {
    side(`<h4>${esc(r.name)}</h4>${r.thumb ? `<img class="side-img" src="${r.thumb}" alt="">` : ''}
      <ul class="chg"><li><span>Size</span><b>${r.w.toFixed(1)} × ${r.d.toFixed(1)} m</b></li><li><span>Area</span><b>${r.area.toFixed(1)} m²</b></li></ul>
      <p class="small dim mt1">${esc(r.note || '')}</p>
      ${r.cam ? `<button class="btn btn-gold btn-sm mt1" type="button" id="sideJump">Step into it in 3D</button>` : ''}
      <button class="btn btn-ghost btn-sm mt1" type="button" id="sideBack">All rooms</button>`);
    const j = $('#sideJump'); if (j) j.addEventListener('click', () => jump(r.id));
    $('#sideBack').addEventListener('click', renderPlan);
  }

  // ---- privacy check ----
  // Personal items in the sample family room, as fractions of the photo.
  const PRIVACY = {
    src: 'assets/img/homes/ranch/family.jpg',
    marks: [
      { x: 0.316, y: 0.280, w: 0.032, h: 0.056, kind: 'Family photo' },
      { x: 0.651, y: 0.262, w: 0.026, h: 0.110, kind: 'Family photos' },
      { x: 0.703, y: 0.376, w: 0.033, h: 0.057, kind: 'Framed photo' },
      { x: 0.762, y: 0.461, w: 0.029, h: 0.057, kind: 'Framed photo' },
      { x: 0.779, y: 0.231, w: 0.034, h: 0.128, kind: 'Personal photos' }
    ]
  };
  const pv = { src: null, boxes: PRIVACY.marks.slice(), blur: true, wired: false };
  function fitPrivacy() {
    const wrap = $('#pvWrap'), st = $('#pvStage');
    if (!pv.src || !wrap.clientWidth) return;
    const r = pv.src.width / pv.src.height;
    let w = wrap.clientWidth, h = w / r;
    if (h > wrap.clientHeight) { h = wrap.clientHeight; w = h * r; }
    st.style.width = w + 'px'; st.style.height = h + 'px';
  }
  function placeBox(el, b) { Object.assign(el.style, { left: b.x * 100 + '%', top: b.y * 100 + '%', width: b.w * 100 + '%', height: b.h * 100 + '%' }); }
  function wirePrivacy() {
    if (pv.wired) return;
    pv.wired = true;
    const st = $('#pvStage');
    let drag = null;
    const rel = (e) => { const r = st.getBoundingClientRect(); return { x: MZ.clamp((e.clientX - r.left) / r.width, 0, 1), y: MZ.clamp((e.clientY - r.top) / r.height, 0, 1) }; };
    st.addEventListener('pointerdown', (e) => {
      if (e.target.closest('.pbox button')) return;
      try { st.setPointerCapture(e.pointerId); } catch (err) { /* pointer already gone */ }
      const p = rel(e);
      drag = { x0: p.x, y0: p.y, el: document.createElement('div') };
      drag.el.className = 'pbox';
      st.appendChild(drag.el);
      placeBox(drag.el, { x: p.x, y: p.y, w: 0, h: 0 });
    });
    st.addEventListener('pointermove', (e) => {
      if (!drag) return;
      const p = rel(e);
      placeBox(drag.el, { x: Math.min(drag.x0, p.x), y: Math.min(drag.y0, p.y), w: Math.abs(p.x - drag.x0), h: Math.abs(p.y - drag.y0) });
    });
    st.addEventListener('pointerup', (e) => {
      if (!drag) return;
      const p = rel(e);
      const b = { x: Math.min(drag.x0, p.x), y: Math.min(drag.y0, p.y), w: Math.abs(p.x - drag.x0), h: Math.abs(p.y - drag.y0), kind: 'Marked by you' };
      drag.el.remove(); drag = null;
      if (b.w > 0.015 && b.h > 0.015) { pv.boxes.push(b); paintPrivacy(); }
    });
    st.addEventListener('pointercancel', () => { if (drag) { drag.el.remove(); drag = null; } });
    if ('ResizeObserver' in window) new ResizeObserver(fitPrivacy).observe($('#pvWrap'));
  }
  async function renderPrivacy() {
    wirePrivacy();
    if (!pv.src) {
      try { pv.src = MZ.photo.toCanvas(await MZ.photo.loadImage(PRIVACY.src), 1600); } catch (e) { console.warn(e); return; }
    }
    if (view !== 'privacy') return;
    fitPrivacy();
    paintPrivacy();
  }
  function paintPrivacy() {
    const c = $('#pvCanvas');
    c.width = pv.src.width; c.height = pv.src.height;
    c.getContext('2d').drawImage(pv.src, 0, 0);
    if (pv.blur) pv.boxes.forEach((b) => MZ.photo.blurRect(c, { x: b.x * c.width, y: b.y * c.height, w: b.w * c.width, h: b.h * c.height }));
    $$('#pvStage .pbox').forEach((el) => el.remove());
    pv.boxes.forEach((b, i) => {
      const el = document.createElement('div');
      el.className = 'pbox';
      el.innerHTML = `<button type="button" aria-label="Remove the ${esc(b.kind.toLowerCase())} box">✕</button>`;
      placeBox(el, b);
      $('button', el).addEventListener('click', (e) => { e.stopPropagation(); pv.boxes.splice(i, 1); paintPrivacy(); });
      $('#pvStage').appendChild(el);
    });
    side(`<h4>Blurred before publishing</h4><p class="small muted">Family room, Sample home 2</p>
      <ul class="chg">${pv.boxes.length ? pv.boxes.map((b) => `<li><span>${esc(b.kind)}</span><b>blurred</b></li>`).join('') : '<li><span>Nothing marked</span><b>—</b></li>'}</ul>
      <label class="check mt1"><input type="checkbox" id="pvShow" ${pv.blur ? 'checked' : ''}> Show the blur</label>
      <button class="btn btn-ghost btn-sm mt1" type="button" id="pvReset">Reset the example</button>`);
    $('#pvShow').addEventListener('change', (e) => { pv.blur = e.target.checked; paintPrivacy(); });
    $('#pvReset').addEventListener('click', () => { pv.boxes = PRIVACY.marks.slice(); pv.blur = true; paintPrivacy(); });
  }

  // ---------- launch pack: made live from the selected home ----------
  const launch = { shown: false, run: 0 };
  function initLaunch() {
    const sec = $('#launch');
    if (!sec) return;
    const go = () => { if (!launch.shown) { launch.shown = true; renderLaunch(); } };
    if ('IntersectionObserver' in window) {
      const io = new IntersectionObserver((en) => { if (en[0].isIntersecting) { io.disconnect(); go(); } }, { rootMargin: '400px 0px' });
      io.observe(sec);
    } else go();
  }
  async function renderLaunch() {
    const run = ++launch.run;
    const L = home;
    const photos = L.photos.map((p) => p.src);
    const copy = MZ.mk.copy(L);
    const url = MZ.mk.listingUrl(L);
    $('#launchHome').textContent = L.short.toLowerCase();
    $('#launchGrid').innerHTML = `
      <div class="mk-card reveal-in"><div class="mk-prev" id="lpSq"><span class="spinner"></span></div><div class="mk-body"><h3>Square post</h3><p>1080 × 1080 for Instagram and Facebook feeds.</p><div class="row"><button class="btn btn-gold btn-xs" type="button" id="lpSqDl" disabled>Download</button></div></div></div>
      <div class="mk-card reveal-in"><div class="mk-prev" id="lpSt"><span class="spinner"></span></div><div class="mk-body"><h3>Story</h3><p>1080 × 1920 with a QR code to the listing.</p><div class="row"><button class="btn btn-gold btn-xs" type="button" id="lpStDl" disabled>Download</button></div></div></div>
      <div class="mk-card reveal-in"><div class="mk-prev" id="lpVid"><button class="btn btn-pill btn-sm" type="button" id="lpVidGo">▶ Make the video</button></div><div class="mk-body"><h3>Listing video</h3><p>About 15 seconds, vertical, with captions. Recorded live in your browser.</p><div class="row"><button class="btn btn-gold btn-xs" type="button" id="lpVidDl" hidden>Download</button><span class="muted small" id="lpVidNote"></span></div></div></div>
      <div class="mk-card reveal-in"><div class="mk-prev"><div class="bro-mini"><div style="background-image:url('${esc(photos[0])}')"></div><i></i><i></i><i></i><i></i><i></i><b></b></div></div><div class="mk-body"><h3>Printable brochure</h3><p>A4, with photos, room sizes and a QR code. Save it as a PDF from the print window.</p><div class="row"><button class="btn btn-gold btn-xs" type="button" id="lpBro">Open brochure</button></div></div></div>
      <div class="mk-card reveal-in"><div class="mk-prev" id="lpQr"><span class="spinner"></span></div><div class="mk-body"><h3>QR code</h3><p>For window cards, signboards and flyers. Scan it to open the example listing.</p><div class="row"><button class="btn btn-gold btn-xs" type="button" id="lpQrDl" disabled>Download</button></div></div></div>
      <div class="mk-card reveal-in mk-copy"><div class="mk-body"><h3>Listing copy</h3><p>Ready to paste into the portals and your socials.</p>
        ${[['Portal headline', copy.portalTitle], ['Instagram caption', copy.instagram], ['Text to your buyer list', copy.sms]].map(([k, v], i) => `<div class="mt1"><div class="row between" style="margin-bottom:.35rem"><b class="small">${esc(k)}</b><button class="btn btn-ghost btn-xs" type="button" data-copy="${i}">Copy</button></div><div class="copybox">${esc(v)}</div></div>`).join('')}
      </div></div>`;
    requestAnimationFrame(() => $$('#launchGrid .reveal-in').forEach((el, i) => setTimeout(() => el.classList.add('in'), i * 90)));
    const copies = [copy.portalTitle, copy.instagram, copy.sms];
    $$('#launchGrid [data-copy]').forEach((b) => b.addEventListener('click', () => MZ.copy(copies[Number(b.dataset.copy)], 'Copy')));

    const imgs = await Promise.all(photos.slice(0, 5).map((p) => MZ.photo.loadImage(p).catch(() => null))).then((a) => a.filter(Boolean));
    if (run !== launch.run || !imgs.length) return;
    let qr = null;
    try { qr = await MZ.mk.qr(url, 360); } catch (e) { $('#lpQr').innerHTML = '<p class="muted small">The QR code could not load. Check your connection.</p>'; }
    if (run !== launch.run) return;
    if (qr) {
      const qc = MZ.photo.clone(qr); qc.style.maxHeight = '180px'; qc.style.imageRendering = 'pixelated';
      $('#lpQr').innerHTML = ''; $('#lpQr').appendChild(qc);
      $('#lpQrDl').disabled = false;
      $('#lpQrDl').addEventListener('click', async () => MZ.download(await MZ.photo.toBlob(qr, 'image/png'), 'listing-qr.png'));
    }
    const sq = await MZ.mk.square(L, imgs[0]);
    if (run !== launch.run) return;
    $('#lpSq').innerHTML = ''; $('#lpSq').appendChild(sq);
    $('#lpSqDl').disabled = false;
    $('#lpSqDl').addEventListener('click', async () => MZ.download(await MZ.photo.toBlob(sq, 'image/png'), 'post-square.png'));
    const st = await MZ.mk.story(L, imgs[1] || imgs[0], qr);
    if (run !== launch.run) return;
    $('#lpSt').innerHTML = ''; $('#lpSt').appendChild(st);
    $('#lpStDl').disabled = false;
    $('#lpStDl').addEventListener('click', async () => MZ.download(await MZ.photo.toBlob(st, 'image/png'), 'post-story.png'));

    $('#lpVidGo').addEventListener('click', async () => {
      if (!MZ.mk.videoSupported()) { $('#lpVidNote').textContent = 'This browser cannot record video. Try Chrome, Edge, Firefox or Safari 17+.'; return; }
      const box = $('#lpVid');
      box.innerHTML = '<div style="width:70%"><div class="hbar" style="grid-template-columns:1fr"><span class="tr"><i id="lpVidBar" style="width:0;transition:none"></i></span></div><p class="muted small mt1" style="text-align:center">Recording… keep this tab open</p></div>';
      try {
        const res = await MZ.mk.video(L, imgs, (p) => { const bar = $('#lpVidBar'); if (bar) bar.style.width = Math.round(p * 100) + '%'; });
        const v = document.createElement('video');
        v.src = URL.createObjectURL(res.blob); v.controls = true; v.loop = true; v.muted = true; v.playsInline = true; v.autoplay = true;
        box.innerHTML = ''; box.appendChild(v);
        $('#lpVidDl').hidden = false;
        $('#lpVidDl').onclick = () => MZ.download(res.blob, 'listing-video.' + res.ext);
      } catch (e) {
        box.innerHTML = '<p class="muted small">Recording failed in this browser.</p>';
        console.warn(e);
      }
    });
    $('#lpBro').addEventListener('click', () => {
      const abs = (p) => new URL(p, location.href).href;
      const html = MZ.mk.brochureHtml(L, qr ? qr.toDataURL('image/png') : null, photos.map(abs), abs('assets/brand-mark.svg'));
      const w = window.open('', '_blank');
      if (!w) { MZ.download(new Blob([html], { type: 'text/html' }), 'brochure.html'); MZ.toast('Pop-up blocked, so the brochure was downloaded instead'); return; }
      w.document.open(); w.document.write(html); w.document.close();
    });
  }

  // Service links (menu, services grid) open the matching demo tab.
  function initViewLinks() {
    document.addEventListener('click', (e) => {
      const a = e.target.closest('[data-show-view]');
      if (!a || !picker) return;
      e.preventDefault();
      picker.select(a.dataset.showView);
      document.getElementById('work').scrollIntoView({ behavior: 'smooth' });
    });
    const v = new URLSearchParams(location.search).get('view');
    if (v && views[v]) picker.select(v);
  }

  function initStage() {
    initHomePick();
    $('#tourStart').addEventListener('click', () => startTour());
    picker = MZ.initPicker($('#picker'), (v) => showView(v));
    showView('tour');
    initViewLinks();
    // warm up the photo demos when the browser is idle
    const idle = window.requestIdleCallback || ((fn) => setTimeout(fn, 1500));
    idle(() => {
      D.homes.forEach((h) => { /* preload posters */ const i = new Image(); i.src = h.tour.poster; });
    });
  }

  // ---------- chat form ----------
  const tickItems = [
    ['Free sample', 'Try it on one of your listings'],
    ['3D walkthrough', 'Every room, on any phone'],
    ['Photo finishing', 'Light and colour, labelled'],
    ['Day to dusk', 'Twilight hero shot'],
    ['Floor plan', 'Clickable, with room sizes'],
    ['Privacy check', 'Personal items blurred'],
    ['Virtual staging', 'Empty rooms furnished'],
    ['Drone photos', 'Aerial shots'],
    ['Listing page', 'Your brand, with the tour'],
    ['Launch pack', 'Posts, video, brochure, QR, copy'],
    ['Viewing bookings', 'Buyers book a time online'],
    ['AI assistant', 'After-hours replies'],
    ['Vendor report', 'Views, rooms and bookings']
  ];
  function initQuote() {
    const form = $('#quoteForm');
    if (!form) return;
    $('#ticks').innerHTML = tickItems.map(([v, s], i) => `
      <label class="tile"><input type="checkbox" class="tick" value="${v}" id="tk${i}"><span class="tbox"><span class="tchk"></span><b>${v}</b><small>${s}</small></span></label>`).join('');
    const ticks = $$('.tick', form);
    const sum = $('#tsum');
    const sync = () => {
      const on = ticks.filter((t) => t.checked).map((t) => t.value);
      sum.innerHTML = on.length ? `<b>${on.length} ticked:</b> ${MZ.esc(on.join(', '))}` : 'Nothing ticked yet.';
      return on;
    };
    ticks.forEach((t) => t.addEventListener('change', sync));

    const name = $('#qName'), email = $('#qEmail'), phone = $('#qPhone');
    const box = $('#qMsgBox'), btn = $('#qSubmit');
    const showErr = (input, on) => {
      input.setAttribute('aria-invalid', String(on));
      const err = input.parentElement.querySelector('.field-error');
      if (err) err.hidden = !on;
    };
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const on = sync();
      const nm = name.value.trim(), em = email.value.trim(), ph = phone.value.trim();
      const nameBad = !nm;
      const contactBad = !(MZ.EMAIL_RE.test(em) || MZ.isPhone(ph));
      showErr(name, nameBad);
      showErr(email, contactBad);
      if (nameBad) { name.focus(); return; }
      if (contactBad) { (em ? email : phone).focus(); return; }
      if (form.elements._honey.value) { box.hidden = false; box.className = 'formmsg ok'; box.textContent = 'Thanks, that has come through.'; return; }

      const fields = {
        _subject: 'VYRA enquiry from ' + nm,
        name: nm, agency: $('#qAgency').value.trim(), phone: ph, email: em,
        listings_per_month: $('#qListings').value, area: $('#qArea').value.trim(),
        interested_in: on.length ? on.join(', ') : 'Nothing ticked',
        message: $('#qMsg').value.trim()
      };
      if (MZ.EMAIL_RE.test(em)) fields._replyto = em;
      const original = btn.textContent;
      btn.textContent = 'Sending…'; btn.disabled = true;
      const res = await MZ.send(fields);
      btn.textContent = original; btn.disabled = false;
      if (res.ok) {
        box.hidden = false; box.className = 'formmsg ok';
        box.textContent = 'Thanks ' + nm.split(' ')[0] + ', that has come through. We will be in touch to find a time for a chat.';
        form.reset(); sync();
      } else {
        MZ.fallback(box, fields._subject, Object.entries(fields).filter(([k]) => !k.startsWith('_')).map(([k, v]) => k.replace(/_/g, ' ') + ': ' + v));
      }
    });
  }

  document.addEventListener('DOMContentLoaded', () => {
    initHero();
    initStage();
    initLaunch();
    initQuote();
  });
})();
