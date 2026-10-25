/* Listing page: gallery + lightbox (with edit transparency), 3D tour with
   room jumps and a live mini-map, interactive floor plan + tape measure,
   viewing scheduler, share, enquiries and on-device analytics. */
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

  // ---------- viewing scheduler (feature 17) ----------
  const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  let selDay = null, selSlot = null, weekOffset = 0;

  function slotsFor(date) {
    const v = L.viewings || D.current.viewings;
    const dow = date.getDay();
    const out = [];
    v.openHomes.filter((o) => o.dow === dow).forEach((o) => out.push({ kind: 'Open home', start: o.start, end: o.end, note: 'Come any time in this window' }));
    const weekend = dow === 0 || dow === 6;
    (weekend ? v.privateTimes.weekend : v.privateTimes.weekday).forEach((t) => {
      const [h, m] = t.split(':').map(Number);
      const end = new Date(2000, 0, 1, h, m + 30);
      out.push({ kind: 'Private viewing', start: t, end: `${String(end.getHours()).padStart(2, '0')}:${String(end.getMinutes()).padStart(2, '0')}`, note: '30 minutes with the agent' });
    });
    return out.sort((a, b) => a.start.localeCompare(b.start));
  }
  const fmtTime = (t) => { const [h, m] = t.split(':').map(Number); return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${h < 12 ? 'am' : 'pm'}`; };
  const fmtDate = (d) => `${DOW[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}`;
  // Local calendar date as YYYY-MM-DD (toISOString would shift it to UTC).
  const dayKey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

  function renderCal() {
    const v = L.viewings || D.current.viewings;
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const first = new Date(today); first.setDate(today.getDate() + 1);
    const last = new Date(today); last.setDate(today.getDate() + v.days);
    // three weeks starting Monday of the current week (+ offset)
    const start = new Date(today);
    start.setDate(today.getDate() - ((today.getDay() + 6) % 7) + weekOffset * 21);
    let html = `<div class="cal-head"><button type="button" id="calPrev" aria-label="Earlier dates" ${weekOffset === 0 ? 'disabled' : ''}>‹</button><b>${MONTHS[start.getMonth()]} ${start.getFullYear()}</b><button type="button" id="calNext" aria-label="Later dates" ${weekOffset >= 1 ? 'disabled' : ''}>›</button></div><div class="cal-grid">`;
    html += ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => `<span class="dow">${d}</span>`).join('');
    for (let i = 0; i < 21; i++) {
      const d = new Date(start); d.setDate(start.getDate() + i);
      const inRange = d >= first && d <= last;
      const slots = inRange ? slotsFor(d) : [];
      const hasOpen = slots.some((s) => s.kind === 'Open home');
      const key = dayKey(d);
      const sel = selDay && dayKey(selDay) === key;
      html += `<button type="button" class="${slots.length ? 'av' : ''} ${hasOpen ? 'oh' : ''}" ${slots.length ? '' : 'disabled'} data-day="${key}" aria-pressed="${sel}" aria-label="${fmtDate(d)}${slots.length ? `, ${slots.length} times available` : ', not available'}">${d.getDate()}</button>`;
    }
    html += `</div><div class="cal-legend"><span><i></i>Open home</span><span>Other days: private viewings</span></div>`;
    $('#cal').innerHTML = html;
    $('#calPrev').addEventListener('click', () => { weekOffset = Math.max(0, weekOffset - 1); renderCal(); });
    $('#calNext').addEventListener('click', () => { weekOffset = Math.min(1, weekOffset + 1); renderCal(); });
    $$('#cal [data-day]').forEach((b) => b.addEventListener('click', () => {
      const [y, m, dd] = b.dataset.day.split('-').map(Number);
      selDay = new Date(y, m - 1, dd);
      selSlot = null;
      renderCal(); renderSlots();
    }));
  }

  function renderSlots() {
    const pane = $('#slotPane');
    if (!selDay) {
      pane.innerHTML = `<h3 style="font-weight:500">Choose a day</h3><p class="dim mt1">Days with a gold dot have an open home. Every other highlighted day has private viewings with the agent.</p>`;
      return;
    }
    const slots = slotsFor(selDay);
    pane.innerHTML = `<h3 style="font-weight:500">${fmtDate(selDay)}</h3><p class="muted small">Times are New Zealand time.</p><div class="slots mt1">${slots.map((s, i) => `
      <button type="button" data-slot="${i}" aria-pressed="${selSlot === i}"><span><b>${s.kind}</b><small>${s.note}</small></span><b>${fmtTime(s.start)}</b></button>`).join('')}</div>
      <form class="mz" id="bookForm" novalidate ${selSlot == null ? 'hidden' : ''} style="margin-top:1.2rem">
        <div class="f2">
          <div class="field"><label for="bName">Name</label><input class="in" id="bName" autocomplete="name" required maxlength="100"><span class="field-error" hidden>Please add your name.</span></div>
          <div class="field"><label for="bEmail">Email</label><input class="in" id="bEmail" type="email" autocomplete="email" required maxlength="120"><span class="field-error" hidden>We need an email to send the details.</span></div>
        </div>
        <div class="field"><label for="bPhone">Phone (optional)</label><input class="in" id="bPhone" type="tel" autocomplete="tel" maxlength="40"></div>
        <label class="check"><input type="checkbox" id="bUpdates" checked> Email me if this time changes</label>
        <input type="text" name="_honey" class="hp" tabindex="-1" autocomplete="off" aria-hidden="true">
        <div><button class="btn btn-gold" type="submit" id="bSubmit">Confirm booking</button></div>
        <p class="formnote">We only use your details for this viewing.</p>
        <div class="formmsg" id="bMsg" role="status" aria-live="polite" hidden></div>
      </form>`;
    $$('[data-slot]', pane).forEach((b) => b.addEventListener('click', () => {
      selSlot = Number(b.dataset.slot);
      $$('[data-slot]', pane).forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
      $('#bookForm').hidden = false;
      $('#bName').focus({ preventScroll: true });
    }));
    $('#bookForm').addEventListener('submit', submitBooking);
  }

  function icsFor(slot, day, who) {
    const [h, m] = slot.start.split(':').map(Number);
    const [eh, em] = slot.end.split(':').map(Number);
    const pad = (n) => String(n).padStart(2, '0');
    const stamp = (d, hh, mm) => `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}T${pad(hh)}${pad(mm)}00`;
    const now = new Date();
    const uid = 'mz-' + now.getTime() + '@vyra-example';
    return [
      'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//VYRA//Example//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
      'BEGIN:VEVENT', 'UID:' + uid,
      'DTSTAMP:' + now.toISOString().replace(/[-:]/g, '').slice(0, 15) + 'Z',
      'DTSTART;TZID=Pacific/Auckland:' + stamp(day, h, m),
      'DTEND;TZID=Pacific/Auckland:' + stamp(day, eh, em),
      'SUMMARY:' + slot.kind + ': ' + L.title + ' (sample listing)',
      'DESCRIPTION:Example booking by ' + who + ' on a VYRA example listing page. Nothing was sent to an agent.',
      'BEGIN:VALARM', 'TRIGGER:-P1D', 'ACTION:DISPLAY', 'DESCRIPTION:Viewing tomorrow', 'END:VALARM',
      'BEGIN:VALARM', 'TRIGGER:-PT1H', 'ACTION:DISPLAY', 'DESCRIPTION:Viewing in one hour', 'END:VALARM',
      'END:VEVENT', 'END:VCALENDAR'
    ].join('\r\n');
  }

  async function submitBooking(e) {
    e.preventDefault();
    const name = $('#bName'), email = $('#bEmail');
    const nm = name.value.trim(), em = email.value.trim();
    const errName = !nm, errEmail = !MZ.EMAIL_RE.test(em);
    name.setAttribute('aria-invalid', String(errName)); name.parentElement.querySelector('.field-error').hidden = !errName;
    email.setAttribute('aria-invalid', String(errEmail)); email.parentElement.querySelector('.field-error').hidden = !errEmail;
    if (errName) { name.focus(); return; }
    if (errEmail) { email.focus(); return; }
    const slot = slotsFor(selDay)[selSlot];
    const when = `${fmtDate(selDay)}, ${fmtTime(slot.start)}–${fmtTime(slot.end)}`;
    // Example page: nothing is sent. On a live listing this goes to the agent
    // and the buyer gets a confirmation email.
    if (document.querySelector('#bookForm [name=_honey]').value) return;
    const bookings = MZ.store.get('mz-bookings', []);
    bookings.unshift({ id: Date.now(), listing: LID, title: L.title, kind: slot.kind, when, name: nm, sent: false });
    MZ.store.set('mz-bookings', bookings.slice(0, 50));
    track('booking', { kind: slot.kind, when });
    const ics = icsFor(slot, selDay, nm);
    const gStart = new Date(selDay); const [h, m] = slot.start.split(':').map(Number); gStart.setHours(h, m);
    const gEnd = new Date(gStart.getTime() + (slot.kind === 'Open home' ? 45 : 30) * 60000);
    const gfmt = (d) => d.toISOString().replace(/[-:]/g, '').slice(0, 15) + 'Z';
    const gcal = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(slot.kind + ': ' + L.title)}&dates=${gfmt(gStart)}/${gfmt(gEnd)}&details=${encodeURIComponent('Example booking on a VYRA example listing page.')}`;
    $('#slotPane').innerHTML = `<div class="booked">
      <div class="tickmark">✓</div>
      <h3 style="font-weight:500">This is how booking works</h3>
      <p class="dim mt1">${esc(slot.kind)} · ${esc(when)}</p>
      <p class="muted small mt1">This is an example page, so nothing was sent. On a live listing the agent gets the booking straight away and ${esc(em)} gets a confirmation email.</p>
      <div class="btn-row" style="justify-content:center"><button class="btn btn-gold btn-sm" type="button" id="icsBtn">Add to calendar (.ics)</button><a class="btn btn-ghost btn-sm" href="${gcal}" target="_blank" rel="noopener">Google Calendar</a></div>
      <p class="muted small mt1">Reminders are set for the day before and one hour before.</p>
      <button class="btn btn-ghost btn-xs mt2" type="button" id="bookAnother">Book another time</button>
      <div class="formmsg" id="bMsg2" hidden></div>
    </div>`;
    $('#icsBtn').addEventListener('click', () => MZ.download(new Blob([ics], { type: 'text/calendar' }), 'viewing.ics'));
    $('#bookAnother').addEventListener('click', () => { selSlot = null; renderSlots(); });
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
    ['tour', 'plan', 'details', 'book'].forEach((id) => { const s = document.getElementById(id); if (s && !s.hidden) io.observe(s); });
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
    renderCal(); renderSlots();
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
