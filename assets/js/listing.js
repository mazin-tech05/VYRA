/* Listing page: gallery + lightbox (with edit transparency), 3D tour with
   room jumps and a live mini-map, interactive floor plan + tape measure,
   share, enquiries and on-device analytics. */
(function () {
  'use strict';
  const MZ = window.MZ;
  const { $, $$, esc } = MZ;
  const D = MZ.data;
  const plan = D.current.plan;

  // A listing published from the agent studio opens as listing.html?id=…
  const params = new URLSearchParams(location.search);
  const pubId = params.get('id');
  let L = D.current;
  let isDemo = true;
  if (pubId && !D.isSample(pubId)) {
    const found = (MZ.store.get('mz-portfolio', []) || []).find((x) => x.id === pubId);
    if (found) { L = found; isDemo = false; }
  }
  const LID = L.id;
  const track = (type, detail) => MZ.analytics.track(LID, type, detail);

  // ---------- header / facts ----------
  function renderHead() {
    document.title = `${L.title} | Example listing page | VYRA`;
    $('#lTitle').textContent = L.title;
    $('#lLoc').textContent = isDemo ? `${L.suburb} · licensed sample scan, not for sale` : (L.suburb || '');
    $('#lEyebrow').textContent = isDemo ? 'Sample listing' : 'Published from the agent studio';
    $('#lPrice').textContent = L.priceLabel || 'By negotiation';
    const facts = [['beds', 'Bedrooms'], ['baths', 'Bathrooms'], ['living', 'Living'], ['garage', 'Garage']]
      .filter(([k]) => L[k]).map(([k, n]) => `<li><b>${esc(L[k])}</b>${n}</li>`);
    if (L.land) facts.push(`<li><b>${esc(L.land)} m²</b>Land</li>`);
    if (L.floor) facts.push(`<li><b>${esc(L.floor)} m²</b>Floor${isDemo && L.floorNote ? ` <small>(${esc(L.floorNote)})</small>` : ''}</li>`);
    $('#lFacts').innerHTML = facts.join('');
    $('#lTagline').textContent = L.tagline || 'About this home';
    $('#lDesc').innerHTML = (L.description || []).map((p) => `<p>${esc(p)}</p>`).join('');
    $('#lFeatures').innerHTML = (L.features || []).map((f) => `<span class="chip">${esc(f)}</span>`).join('');
    const hs = $('#homeSwitch');
    if (hs && isDemo) {
      hs.innerHTML = '<span class="small muted">Sample homes:</span>' + D.homes.map((h) => `<a class="chip" href="listing.html?home=${h.id}" aria-current="${h.id === L.id ? 'page' : 'false'}">${esc(h.short)}</a>`).join('');
    }
    if (isDemo) {
      const tp = $('#tourPoster img'); if (tp) tp.src = L.tour.poster;
      const ts = $('#tourSize'); if (ts) ts.textContent = 'A light version loads first and full detail streams in as you move.';
    }
    $('#lChattels').innerHTML = (L.chattels || []).map((f) => `<span class="chip">${esc(f)}</span>`).join('') || '<span class="muted small">None listed.</span>';
    if (!isDemo) {
      $('#demoText').textContent = 'Listing page published from the agent studio on this device (demo).';
      // Published drafts don't have a scan: hide the tour and plan.
      ['#tour', '#plan'].forEach((s) => { const el = $(s); if (el) el.hidden = true; });
      $$('#subnav a').forEach((a) => { if (a.getAttribute('href') === '#tour' || a.getAttribute('href') === '#plan') a.hidden = true; });
    }
  }

  // ---------- gallery (feature 12: edits are labelled) ----------
  const photos = (L.photos || []).map((p) => Object.assign({}, p));
  let enhanceInfo = null; // { url, changes } for the enhanced photo

  async function prepareEnhanced() {
    const p = photos.find((x) => x.enhanced);
    if (!p || !MZ.photo) return;
    try {
      const img = await MZ.photo.loadImage(p.src);
      const src = MZ.photo.toCanvas(img, 1800);
      const params = MZ.photo.autoParams(src);
      const out = MZ.photo.apply(src, params);
      const blob = await MZ.photo.toBlob(out, 'image/jpeg', 0.88);
      p.original = p.src;
      p.src = URL.createObjectURL(blob);
      enhanceInfo = { changes: MZ.photo.describe(params) };
      p.changes = enhanceInfo.changes;
      $$(`img[data-photo="${photos.indexOf(p)}"]`).forEach((im) => { im.src = p.src; });
      $$(`[data-badge="${photos.indexOf(p)}"]`).forEach((b) => { b.hidden = false; });
    } catch (e) { console.warn('Enhance failed', e); }
  }

  function badge(i) {
    return photos[i].enhanced ? `<span class="badge" data-badge="${i}" hidden>Enhanced · see edits</span>` : '';
  }

  function renderGallery() {
    const g = $('#gallery');
    const hasTour = isDemo;
    const main = photos[0];
    const side = photos.slice(1, hasTour ? 2 : 3);
    let html = `<button class="g-item g-main" type="button" data-open="0" aria-label="Open photo 1 of ${photos.length}"><img data-photo="0" src="${esc(main.src)}" alt="${esc(main.alt || '')}">${badge(0)}</button>`;
    if (hasTour) {
      html += `<div class="g-item g-tourcard" role="button" tabindex="0" id="galleryTour" aria-label="Open the 3D tour">
        <img src="${esc(L.tour.poster)}" alt="">
        <span class="mini-play" aria-hidden="true">▶</span>
        <span class="tc-ov"><span class="badge plain" style="align-self:flex-start;margin-bottom:.5rem">Live 3D scan</span><b>3D walkthrough</b><small>${plan.rooms.filter((r) => r.cam).length} rooms · floor plan · works on phones</small></span>
      </div>`;
    }
    side.forEach((p, k) => {
      const i = k + 1;
      const last = k === side.length - 1;
      html += `<button class="g-item" type="button" data-open="${i}" aria-label="Open photo ${i + 1} of ${photos.length}"><img data-photo="${i}" src="${esc(p.src)}" alt="${esc(p.alt || '')}" loading="lazy">${badge(i)}${last ? `<span class="badge plain g-more">All ${photos.length} photos</span>` : ''}</button>`;
    });
    g.innerHTML = html;
    if (!hasTour) g.style.gridTemplateRows = 'repeat(2, 1fr)';

    // phone: swipe carousel
    const sm = $('#gallerySm');
    sm.innerHTML = photos.map((p, i) => `<button type="button" data-open="${i}" aria-label="Open photo ${i + 1}"><img data-photo="${i}" src="${esc(p.src)}" alt="${esc(p.alt || '')}" ${i ? 'loading="lazy"' : ''}>${badge(i)}<span class="badge plain count">${i + 1} / ${photos.length}</span></button>`).join('');
    MZ.initSwipe(sm, $('#galleryDots'), (i) => { if (i > 0) track('photo', { photo: photos[i].caption || ('Photo ' + (i + 1)) }); });

    $$('[data-open]').forEach((b) => b.addEventListener('click', () => openLightbox(Number(b.dataset.open))));
    const gt = $('#galleryTour');
    if (gt) {
      const go = () => { document.getElementById('tour').scrollIntoView({ behavior: 'smooth' }); startTour(); };
      gt.addEventListener('click', go);
      gt.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } });
    }
  }

  function captionFor(p) {
    let html = esc(p.caption || '');
    if (p.changes) {
      html += `<br><span class="small">Finished by VYRA: ${p.changes.map((c) => esc(c.k + ' ' + c.v)).join(' · ')}. Nothing added or removed.</span>
        <br><button class="btn btn-ghost btn-xs mt1" type="button" data-toggle-orig>Show original</button>`;
    }
    return html;
  }

  function openLightbox(start) {
    const items = photos.map((p) => ({ src: p.src, alt: p.alt, caption: captionFor(p) }));
    const m = MZ.lightbox(items, start, (i) => track('photo', { photo: photos[i].caption || ('Photo ' + (i + 1)) }));
    m.el.addEventListener('click', (e) => {
      const b = e.target.closest('[data-toggle-orig]');
      if (!b) return;
      const fig = b.closest('figure');
      const img = $('img', fig);
      const p = photos.find((x) => x.src === img.getAttribute('src') || x.original === img.getAttribute('src'));
      if (!p || !p.original) return;
      const showingOrig = img.getAttribute('src') === p.original;
      img.src = showingOrig ? p.src : p.original;
      b.textContent = showingOrig ? 'Show original' : 'Show enhanced';
    });
  }

  // ---------- 3D tour ----------
  const shell = $('#tourShell'), frame = $('#tourFrame'), poster = $('#tourPoster');
  const ui = $('#tourUi'), loading = $('#tourLoading'), roomsBar = $('#tourRooms');
  const camRooms = plan.rooms.filter((r) => r.cam);
  let tourActive = false, ready = false, mini = null, pollTimer = null, tourStartAt = 0;
  let lastRoom = null, roomSince = 0;
  // Room viewpoints often stand just outside the room they frame (the kitchen
  // shot is taken from the living area), so after a jump the jumped-to room
  // stays current until the visitor actually walks away from that spot.
  let jumped = null;

  function viewer() {
    try { const w = frame.contentWindow; return w && typeof w.setCameraState === 'function' ? w : null; } catch (e) { return null; }
  }

  function buildTourUi() {
    roomsBar.innerHTML = camRooms.map((r) => `<button type="button" data-room="${r.id}" disabled aria-pressed="false">${esc(r.short || r.name)}</button>`).join('');
    $$('button', roomsBar).forEach((b) => b.addEventListener('click', () => jumpTo(b.dataset.room)));
    mini = MZ.floorplan.mount($('#miniPlan'), { plan, compact: true, onRoom: (r) => { if (r.cam) jumpTo(r.id); } });
    $('#fov').addEventListener('input', (e) => { const w = viewer(); if (w && w.setFov) w.setFov(Number(e.target.value)); });
    $('#tourFs').addEventListener('click', () => setFullscreen(!shell.classList.contains('fs')));
    $('#tourClose').addEventListener('click', closeTour);
    ['pointerdown', 'touchstart', 'wheel'].forEach((ev) => ui.addEventListener(ev, (e) => { if (e.target === ui) e.stopPropagation(); }, { passive: true }));
  }

  function startTour(roomId) {
    if (!isDemo) return;
    if (!frame.src) {
      frame.src = L.tour.src;
      frame.addEventListener('load', () => {
        try {
          frame.contentWindow.addEventListener('keydown', (e) => { if (e.key === 'Escape') onEscape(); }, true);
        } catch (err) { /* cross-origin: Esc still works from this page */ }
      });
    }
    frame.hidden = false;
    poster.hidden = true;
    ui.hidden = false;
    if (!ready) loading.hidden = false;
    if (!tourActive) {
      tourActive = true;
      tourStartAt = Date.now();
      track('tour-open');
    }
    if (window.matchMedia('(max-width: 760px)').matches) setFullscreen(true);
    waitReady(roomId);
    startPolling();
  }

  function waitReady(roomId) {
    if (ready) { if (roomId) jumpTo(roomId); return; }
    let tries = 0;
    const t = setInterval(() => {
      const w = viewer();
      if (w) {
        clearInterval(t);
        ready = true;
        loading.hidden = true;
        $$('button', roomsBar).forEach((b) => { b.disabled = false; });
        if (w.setFov) w.setFov(Number($('#fov').value));
        if (roomId) jumpTo(roomId);
      } else if (++tries > 900) { clearInterval(t); }
    }, 200);
  }

  function jumpTo(id) {
    const r = plan.rooms.find((x) => x.id === id);
    if (!r || !r.cam) return;
    if (!tourActive) { startTour(id); return; }
    const w = viewer();
    if (!w) { waitReady(id); return; }
    shell.animate ? shell.animate([{ filter: 'brightness(1)' }, { filter: 'brightness(.15)' }, { filter: 'brightness(1)' }], { duration: 420 }) : null;
    setTimeout(() => {
      try {
        w.setCameraState({ position: r.cam.position.slice(), angles: r.cam.angles.slice(), distance: 1, fov: Number($('#fov').value), mode: 'walk' });
        jumped = { id: r.id, x: r.cam.position[0], z: r.cam.position[2] };
      } catch (e) { console.warn('Room jump failed', e); }
      try { frame.focus({ preventScroll: true }); } catch (e) { /* ignore */ }
    }, 170);
  }

  // Live position: drives the mini-map marker, the highlighted room button,
  // and how long visitors spend in each room (feature 10).
  function startPolling() {
    if (pollTimer) return;
    pollTimer = setInterval(() => {
      if (!tourActive || document.hidden) return;
      const w = viewer();
      if (!w || typeof w.getCameraState !== 'function') return;
      let s;
      try { s = w.getCameraState(); } catch (e) { return; }
      const [x, , z] = s.position;
      mini.setMarker(x, z, s.angles[1]);
      if (jumped && Math.hypot(x - jumped.x, z - jumped.z) > 0.6) jumped = null;
      const room = jumped ? plan.rooms.find((rr) => rr.id === jumped.id) : plan.roomAt(x, z);
      const id = room ? room.id : null;
      $$('button', roomsBar).forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.room === id)));
      if (mini) mini.select(id);
      const now = Date.now();
      if (id !== lastRoom) {
        flushRoom(now);
        lastRoom = id; roomSince = now;
      } else if (now - roomSince >= 5000) {
        flushRoom(now);
      }
    }, 500);
  }

  function flushRoom(now) {
    if (lastRoom) {
      const secs = Math.round((now - roomSince) / 1000);
      if (secs > 0) track('room-time', { room: lastRoom, seconds: secs });
    }
    roomSince = now;
  }

  function flushTourTime() {
    if (tourActive) flushRoom(Date.now());
    if (tourActive && tourStartAt) {
      const secs = Math.round((Date.now() - tourStartAt) / 1000);
      if (secs > 0) track('tour-time', { seconds: secs });
      tourStartAt = Date.now();
    }
  }

  function setFullscreen(on) {
    shell.classList.toggle('fs', on);
    document.body.classList.toggle('tour-fs', on);
    $('#tourFs').textContent = on ? '⤡' : '⤢';
    $('#tourFs').setAttribute('aria-label', on ? 'Exit full screen' : 'Full screen');
  }

  function closeTour() {
    if (shell.classList.contains('fs')) setFullscreen(false);
    flushTourTime();
    tourActive = false;
    lastRoom = null;
    frame.hidden = true;
    ui.hidden = true;
    loading.hidden = true;
    poster.hidden = false;
    mini && mini.setMarker(null);
    poster.focus({ preventScroll: true });
  }

  function onEscape() {
    if (!tourActive) return;
    if (shell.classList.contains('fs') && !window.matchMedia('(max-width: 760px)').matches) setFullscreen(false);
    else closeTour();
  }

  // ---------- floor plan section ----------
  let units = 'm', big = null;
  function renderRoomPanel(r) {
    const p = $('#roomPanel');
    const dims = r.lshape
      ? `<div><small>Size</small><b>L-shaped</b></div><div><small>Longest</small><b>${MZ.fmtLen(Math.max(r.w, r.d), units)}</b></div>`
      : `<div><small>Width</small><b>${MZ.fmtLen(r.w, units)}</b></div><div><small>Depth</small><b>${MZ.fmtLen(r.d, units)}</b></div>`;
    p.innerHTML = `
      <div class="rp-img">${r.thumb ? `<img src="${r.thumb}" alt="${esc(r.name)} in the 3D scan">` : '<div class="empty" style="position:absolute;inset:1rem;display:grid;place-items:center">Hallway: walk through it in the 3D tour.</div>'}<span class="badge">From the 3D scan</span></div>
      <div class="rp-body">
        <span class="eyebrow">${r.outdoor ? 'Outdoor' : 'Room'}</span>
        <h3>${esc(r.name)}</h3>
        <div class="rp-dims">${dims}<div><small>Area</small><b>${MZ.fmtArea(r.area, units)}</b></div></div>
        <p>${esc(r.note || '')}</p>
        <div class="btn-row" style="margin-top:1.2rem">${r.cam ? `<button class="btn btn-gold btn-sm" type="button" data-go3d="${r.id}">View in 3D →</button>` : ''}<button class="btn btn-ghost btn-sm" type="button" data-measure-room>Measure in this room</button></div>
      </div>`;
    const go = $('[data-go3d]', p);
    if (go) go.addEventListener('click', () => { document.getElementById('tour').scrollIntoView({ behavior: 'smooth' }); setTimeout(() => jumpTo(r.id), 350); });
    $('[data-measure-room]', p).addEventListener('click', () => setMeasure(true));
    $$('#roomList button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.room === r.id)));
  }

  function setMeasure(on) {
    $('#measureBtn').setAttribute('aria-pressed', String(on));
    big.setMeasuring(on);
    $('#measureOut').innerHTML = on ? 'Click two points on the plan to measure the distance between them.' : 'Plan traced from the 3D scan. Sizes are approximate.';
  }

  function renderPlan() {
    big = MZ.floorplan.mount($('#bigPlan'), {
      plan,
      units: () => units,
      onRoom: (r) => { renderRoomPanel(r); track('plan-click', { room: r.id }); },
      onMeasure: (d) => {
        if (d == null) { if ($('#measureBtn').getAttribute('aria-pressed') === 'true') $('#measureOut').innerHTML = 'Click a second point to finish. Click again to start over.'; return; }
        $('#measureOut').innerHTML = `Distance: <b>${MZ.fmtLen(d, units)}</b> (${MZ.fmtLen(d, units === 'm' ? 'ft' : 'm')}). Click again to start a new measurement.`;
      }
    });
    $('#roomList').innerHTML = plan.rooms.map((r) => `<button type="button" data-room="${r.id}" aria-pressed="false">${esc(r.name)}<small>${MZ.fmtArea(r.area, units)}</small></button>`).join('');
    $$('#roomList button').forEach((b) => b.addEventListener('click', () => {
      const r = plan.rooms.find((x) => x.id === b.dataset.room);
      big.select(r.id); renderRoomPanel(r); track('plan-click', { room: r.id });
    }));
    $('#measureBtn').addEventListener('click', () => setMeasure($('#measureBtn').getAttribute('aria-pressed') !== 'true'));
    $('#scanBtn').addEventListener('click', () => {
      const on = $('#scanBtn').getAttribute('aria-pressed') !== 'true';
      $('#scanBtn').setAttribute('aria-pressed', String(on));
      big.showImage(on);
    });
    $$('.seg [data-u]').forEach((b) => b.addEventListener('click', () => {
      units = b.dataset.u;
      $$('.seg [data-u]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
      big.refreshDims(units);
      const cur = plan.rooms.find((x) => x.id === big.selected) || plan.rooms[0];
      renderRoomPanel(cur);
      $$('#roomList button').forEach((x) => { const r = plan.rooms.find((y) => y.id === x.dataset.room); x.querySelector('small').textContent = MZ.fmtArea(r.area, units); });
    }));
    const first = plan.rooms.find((r) => r.id === params.get('room')) || plan.rooms[0];
    big.select(first.id);
    renderRoomPanel(first);
  }

  // ---------- ask a question ----------
  function openAsk() {
    const m = MZ.openModal(`
      <span class="eyebrow">Ask a question</span>
      <h3 style="font-size:1.5rem">Request a callback</h3>
      <form class="mz" id="askForm" novalidate>
        <div class="field"><label for="aName">Name</label><input class="in" id="aName" autocomplete="name" maxlength="100"><span class="field-error" hidden>Please add your name.</span></div>
        <div class="field"><label for="aContact">Phone or email</label><input class="in" id="aContact" autocomplete="email" maxlength="120"><span class="field-error" hidden>Please add a phone number or an email address.</span></div>
        <div class="field"><label for="aMsg">Question (optional)</label><textarea class="in" id="aMsg" maxlength="2000" placeholder="For example: is the granny flat consented?"></textarea></div>
        <input type="text" name="_honey" class="hp" tabindex="-1" autocomplete="off" aria-hidden="true">
        <div><button class="btn btn-gold" type="submit" id="aSubmit">Send</button></div>
        <p class="formnote">We'll only use your details to reply to this question.</p>
        <div class="formmsg" id="aBox" role="status" aria-live="polite" hidden></div>
      </form>`, { label: 'Ask a question' });
    const form = $('#askForm', m.el);
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const n = $('#aName', m.el), c = $('#aContact', m.el);
      const nm = n.value.trim(), ct = c.value.trim();
      const eN = !nm, eC = !(MZ.EMAIL_RE.test(ct) || MZ.isPhone(ct));
      n.setAttribute('aria-invalid', String(eN)); n.parentElement.querySelector('.field-error').hidden = !eN;
      c.setAttribute('aria-invalid', String(eC)); c.parentElement.querySelector('.field-error').hidden = !eC;
      if (eN) { n.focus(); return; }
      if (eC) { c.focus(); return; }
      if (form.elements._honey.value) return;
      // Example page: nothing is sent. On a live listing this goes straight to the agent.
      track('enquiry');
      const box = $('#aBox', m.el);
      box.hidden = false; box.className = 'formmsg ok';
      box.textContent = `Thanks ${nm.split(' ')[0]}. This is an example page, so nothing was sent. On a live listing your question goes straight to the agent.`;
      form.reset();
    });
  }

  // ---------- share ----------
  function initShare() {
    $('#btnShare').addEventListener('click', async () => {
      track('share');
      const data = { title: L.title, text: `${L.title} in ${L.suburb}, with a 3D tour`, url: location.href };
      if (navigator.share) { try { await navigator.share(data); return; } catch (e) { if (e.name === 'AbortError') return; } }
      MZ.copy(location.href, 'Link');
    });
  }

  // ---------- section highlight in the sub-nav ----------
  function initSubnav() {
    const links = $$('#subnav a');
    if (!('IntersectionObserver' in window)) return;
    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        if (en.isIntersecting) links.forEach((a) => a.classList.toggle('on', a.getAttribute('href') === '#' + en.target.id));
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    ['tour', 'plan', 'details'].forEach((id) => { const s = document.getElementById(id); if (s && !s.hidden) io.observe(s); });
  }

  document.addEventListener('DOMContentLoaded', () => {
    renderHead();
    renderGallery();
    if (isDemo) {
      buildTourUi();
      poster.addEventListener('click', () => startTour());
      renderPlan();
      const idle = window.requestIdleCallback || ((fn) => setTimeout(fn, 1200));
      idle(prepareEnhanced);
    }
    initShare(); initSubnav();
    $('#btnAsk').addEventListener('click', openAsk);
    $('#btnAsk2').addEventListener('click', openAsk);
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !document.querySelector('.modal')) onEscape(); });
    document.addEventListener('visibilitychange', () => { if (document.hidden) flushTourTime(); });
    window.addEventListener('pagehide', flushTourTime);
    if (location.hash === '#tour' && isDemo) setTimeout(() => startTour(), 300);
    track('view');
  });
})();
