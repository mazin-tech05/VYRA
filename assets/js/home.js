/* Landing page: hero slideshow, the "See the difference" stage (three sample
   homes x four live demos), and the chat form. */
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

  function initStage() {
    initHomePick();
    $('#tourStart').addEventListener('click', () => startTour());
    picker = MZ.initPicker($('#picker'), (v) => showView(v));
    showView('tour');
    // warm up the photo demos when the browser is idle
    const idle = window.requestIdleCallback || ((fn) => setTimeout(fn, 1500));
    idle(() => {
      D.homes.forEach((h) => { /* preload posters */ const i = new Image(); i.src = h.tour.poster; });
    });
  }

  // ---------- chat form ----------
  const tickItems = [
    ['Free sample', 'Try it on one of your listings'],
    ['3D tour', 'A walk-through for each listing'],
    ['Photo finishing', 'AI light and colour, labelled'],
    ['Day to dusk', 'Twilight hero shot'],
    ['Floor plan', 'Clickable, with room sizes'],
    ['Listing page', 'Branded page with the tour'],
    ['Marketing pack', 'Posts, brochure, video, copy'],
    ['Viewing bookings', 'Buyers book a time online'],
    ['AI for my agency', 'Calls, enquiries, reminders']
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
        _subject: 'Real estate enquiry from ' + nm + ' (HomeView demo)',
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
    initQuote();
  });
})();
