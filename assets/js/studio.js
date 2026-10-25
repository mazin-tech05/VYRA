/* Agent studio: portfolio (20), buyer analytics (10), photo enhance with an
   edit log (1, 12), day to dusk (13), privacy blur (11), marketing pack (5)
   and listing publishing (15). Everything is stored on this device only. */
(function () {
  'use strict';
  const MZ = window.MZ;
  const { $, $$, esc } = MZ;
  const D = MZ.data;
  const STATUSES = ['Active', 'Viewings', 'Under offer', 'Sold', 'Draft'];

  // ---------- data ----------
  const own = () => MZ.store.get('mz-portfolio', []) || [];
  const saveOwn = (list) => MZ.store.set('mz-portfolio', list);
  const statusOverrides = () => MZ.store.get('mz-status', {}) || {};
  function allListings() {
    const st = statusOverrides();
    return D.homes.map((h) => Object.assign({ kind: 'sample' }, h))
      .concat(own().map((o) => Object.assign({ kind: 'yours' }, o)))
      .map((l) => Object.assign({}, l, { status: st[l.id] || l.status || 'Active' }));
  }
  const findListing = (id) => allListings().find((l) => l.id === id);
  const stats = (id) => (MZ.analytics.load().listings[id]) || null;
  const thumbOf = (l) => l.photos && l.photos[0] ? (l.photos[0].src || l.photos[0]) : null;
  const pillFor = (s) => ({ Active: 'ok', Viewings: 'warn', 'Under offer': 'busy', Sold: 'sold', Draft: 'off' }[s] || 'off');

  // ---------- tabs ----------
  const inited = {};
  const inits = {
    portfolio: initPortfolio, analytics: initAnalytics, photo: initPhoto, dusk: initDusk,
    privacy: initPrivacy, marketing: initMarketing, publish: initPublish
  };
  let picker;
  function show(view) {
    $$('[data-panel]').forEach((p) => { p.hidden = p.dataset.panel !== view; });
    if (!inited[view]) { inited[view] = true; inits[view](); }
    else if (view === 'portfolio') renderPortfolio();
    else if (view === 'analytics') renderAnalytics();
    else if (view === 'marketing') fillListingSelect($('#mkListing'), mkListingId);
    history.replaceState(null, '', '#' + view);
  }
  function goto(view, opts) {
    if (opts && opts.listing) {
      if (view === 'analytics') anListingId = opts.listing;
      if (view === 'marketing') mkListingId = opts.listing;
    }
    picker.select(view);
    window.scrollTo({ top: $('.studio-tabs').offsetTop - 70, behavior: 'smooth' });
  }

  function fillListingSelect(sel, current, filter) {
    const list = allListings().filter(filter || ((l) => l.kind !== 'made-up'));
    sel.innerHTML = list.map((l) => `<option value="${esc(l.id)}" ${l.id === current ? 'selected' : ''}>${esc(l.title)}${l.kind === 'sample' ? ' (sample)' : ''}</option>`).join('');
  }

  // ---------- portfolio (20) ----------
  let pfFilter = 'All';
  function initPortfolio() {
    $('#pfFilter').innerHTML = ['All'].concat(STATUSES).map((s) => `<button type="button" class="chip" data-f="${s}" aria-pressed="${s === pfFilter}">${s}</button>`).join('');
    $$('#pfFilter .chip').forEach((b) => b.addEventListener('click', () => {
      pfFilter = b.dataset.f;
      $$('#pfFilter .chip').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
      renderPortfolio();
    }));
    renderPortfolio();
  }
  function renderPortfolio() {
    const list = allListings();
    const an = MZ.analytics.load().listings;
    const sum = (k) => Object.values(an).reduce((a, x) => a + (x[k] || 0), 0);
    const bookings = (MZ.store.get('mz-bookings', []) || []).length;
    $('#pfKpis').innerHTML = [
      ['Active listings', list.filter((l) => l.status === 'Active' || l.status === 'Viewings').length, 'of ' + list.length + ' in your portfolio'],
      ['3D tour opens', sum('tourOpens'), 'on this device'],
      ['Enquiries', sum('enquiries'), 'questions and callbacks'],
      ['Viewings booked', bookings, 'through the scheduler']
    ].map(([k, v, s]) => `<div class="kpi"><small>${k}</small><b>${MZ.fmtInt(v)}</b><span>${s}</span></div>`).join('');

    const rows = list.filter((l) => pfFilter === 'All' || l.status === pfFilter);
    const num = (l, k) => l.kind === 'made-up' ? '—' : MZ.fmtInt((an[l.id] || {})[k] || 0);
    const bookingsFor = (id) => (MZ.store.get('mz-bookings', []) || []).filter((b) => b.listing === id).length;
    $('#pfTable').innerHTML = `<thead><tr><th>Listing</th><th>Status</th><th>Views</th><th>Tour opens</th><th>Enquiries</th><th>Viewings</th><th><span class="sr-only">Actions</span></th></tr></thead><tbody>${rows.map((l) => {
      const th = thumbOf(l);
      const href = l.kind === 'sample' ? 'listing.html' : l.kind === 'yours' ? 'listing.html?id=' + encodeURIComponent(l.id) : null;
      return `<tr>
        <td><div class="row" style="flex-wrap:nowrap"><span class="port-th ${th ? '' : 'art'}" ${th ? `style="background-image:url('${esc(th)}')"` : ''}></span><span class="t-title"><b>${esc(l.title)}</b><small>${esc(l.suburb || '')} · ${l.kind === 'sample' ? 'sample listing' : l.kind === 'made-up' ? 'made-up example' : 'published by you'}</small></span></div></td>
        <td><select class="in" data-status="${esc(l.id)}" aria-label="Status of ${esc(l.title)}">${STATUSES.map((s) => `<option ${s === l.status ? 'selected' : ''}>${s}</option>`).join('')}</select></td>
        <td>${num(l, 'views')}</td><td>${num(l, 'tourOpens')}</td><td>${num(l, 'enquiries')}</td><td>${l.kind === 'made-up' ? '—' : bookingsFor(l.id)}</td>
        <td><div class="row" style="flex-wrap:nowrap;gap:.35rem;justify-content:flex-end">
          ${href ? `<a class="btn btn-ghost btn-xs" href="${href}">Open</a>` : ''}
          ${l.kind !== 'made-up' ? `<button class="btn btn-ghost btn-xs" type="button" data-an="${esc(l.id)}">Analytics</button><button class="btn btn-ghost btn-xs" type="button" data-mk="${esc(l.id)}">Marketing</button>` : ''}
          ${l.kind === 'yours' ? `<button class="icon-btn" type="button" data-del="${esc(l.id)}" aria-label="Delete ${esc(l.title)}">✕</button>` : ''}
        </div></td></tr>`;
    }).join('') || '<tr><td colspan="7" class="muted">No listings with this status.</td></tr>'}</tbody>`;
    $$('[data-status]').forEach((s) => s.addEventListener('change', () => {
      const st = statusOverrides(); st[s.dataset.status] = s.value; MZ.store.set('mz-status', st);
      MZ.toast('Status updated'); renderPortfolio();
    }));
    $$('[data-an]').forEach((b) => b.addEventListener('click', () => goto('analytics', { listing: b.dataset.an })));
    $$('[data-mk]').forEach((b) => b.addEventListener('click', () => goto('marketing', { listing: b.dataset.mk })));
    $$('[data-del]').forEach((b) => b.addEventListener('click', () => {
      if (!confirm('Delete this listing from your portfolio on this device?')) return;
      saveOwn(own().filter((o) => o.id !== b.dataset.del));
      MZ.analytics.reset(b.dataset.del);
      renderPortfolio();
    }));
  }

  // ---------- analytics (10) ----------
  let anListingId = D.homes[0].id;
  const ROOM_NAMES = Object.fromEntries(D.homes.map((h) => [h.id, Object.fromEntries(h.plan.rooms.map((r) => [r.id, r.name]))]));
  let ROOM_NAME = ROOM_NAMES[anListingId];
  function initAnalytics() {
    $('#anListing').addEventListener('change', (e) => { anListingId = e.target.value; renderAnalytics(); });
    $('#anReset').addEventListener('click', () => {
      if (!confirm('Clear the analytics recorded on this device for this listing?')) return;
      MZ.analytics.reset(anListingId); renderAnalytics();
    });
    renderAnalytics();
  }
  const fmtSecs = (s) => s >= 60 ? `${Math.floor(s / 60)}m ${String(Math.round(s % 60)).padStart(2, '0')}s` : `${Math.round(s)}s`;
  function bars(entries, fmt) {
    if (!entries.length) return '<div class="empty">Nothing recorded yet.</div>';
    const max = Math.max(...entries.map((e) => e[1]));
    const total = entries.reduce((a, e) => a + e[1], 0);
    return `<div class="hbars">${entries.map(([k, v]) => `<div class="hbar"><span>${esc(k)}</span><span class="tr"><i style="width:${(v / max * 100).toFixed(1)}%"></i></span><em>${fmt ? fmt(v) : MZ.fmtInt(v)}${fmt ? '' : ''}<br><small class="muted">${Math.round(v / total * 100)}%</small></em></div>`).join('')}</div>`;
  }
  function renderAnalytics() {
    fillListingSelect($('#anListing'), anListingId);
    const s = stats(anListingId);
    const L = findListing(anListingId) || D.homes[0];
    ROOM_NAME = ROOM_NAMES[anListingId] || {};
    const body = $('#anBody');
    if (!s || (!s.views && !s.tourOpens)) {
      body.innerHTML = `<div class="empty" style="padding:2.4rem">No visits recorded for <b>${esc(L.title)}</b> on this device yet.<br><br>
        <a href="${D.isSample(L.id) ? 'listing.html?home=' + L.id : 'listing.html?id=' + encodeURIComponent(L.id)}">Open the listing</a>, look through the photos, take the 3D tour and book a viewing, then come back here.</div>`;
      return;
    }
    const roomEntries = Object.entries(s.rooms || {}).sort((a, b) => b[1] - a[1]).map(([k, v]) => [ROOM_NAME[k] || k, v]);
    const photoEntries = Object.entries(s.photos || {}).sort((a, b) => b[1] - a[1]).slice(0, 6);
    const planEntries = Object.entries(s.planClicks || {}).sort((a, b) => b[1] - a[1]).map(([k, v]) => [ROOM_NAME[k] || k, v]);
    const avgTour = s.tourOpens ? s.tourSeconds / s.tourOpens : 0;
    const acted = s.enquiries + s.bookings;
    const pct = (v) => s.views ? Math.min(100, Math.round(v / s.views * 100)) : 0;
    const evName = { view: 'Viewed the listing', 'tour-open': 'Opened the 3D tour', photo: 'Looked at a photo', 'plan-click': 'Clicked a room on the plan', enquiry: 'Sent a question', booking: 'Booked a viewing', share: 'Shared the listing', compare: 'Added to compare' };
    body.innerHTML = `
      <div class="kpis">
        <div class="kpi"><small>Listing views</small><b>${MZ.fmtInt(s.views)}</b><span>page loads</span></div>
        <div class="kpi"><small>3D tour opens</small><b>${MZ.fmtInt(s.tourOpens)}</b><span>${pct(s.tourOpens)}% of views</span></div>
        <div class="kpi"><small>Time in tour</small><b>${fmtSecs(avgTour)}</b><span>average per open</span></div>
        <div class="kpi"><small>Enquiries</small><b>${MZ.fmtInt(s.enquiries)}</b><span>questions and callbacks</span></div>
        <div class="kpi"><small>Viewings booked</small><b>${MZ.fmtInt(s.bookings)}</b><span>through the scheduler</span></div>
        <div class="kpi"><small>Shares + compares</small><b>${MZ.fmtInt(s.shares + s.compares)}</b><span>shortlist signals</span></div>
      </div>
      <div class="an-grid mt2">
        <div class="box"><h4>Where buyers spend time in the tour</h4>${roomEntries.length ? `<div id="anHeat" style="aspect-ratio:1.45;margin-bottom:1rem"></div>` : ''}${bars(roomEntries, fmtSecs)}</div>
        <div class="stack">
          <div class="box"><h4>From view to action</h4><div class="funnel">
            <div style="--w:100%"><span>Viewed the listing</span><b>${MZ.fmtInt(s.views)}</b></div>
            <div style="--w:${pct(s.tourOpens)}%"><span>Opened the 3D tour</span><b>${MZ.fmtInt(s.tourOpens)}</b></div>
            <div style="--w:${pct(acted)}%"><span>Enquired or booked</span><b>${MZ.fmtInt(acted)}</b></div>
          </div></div>
          <div class="box"><h4>Most-viewed photos</h4>${bars(photoEntries)}</div>
          <div class="box"><h4>Rooms clicked on the floor plan</h4>${bars(planEntries)}</div>
        </div>
      </div>
      <div class="box mt1"><h4>Recent activity</h4><ul class="evlog">${(s.events || []).slice(0, 25).map((e) => `<li><time>${new Date(e.t).toLocaleTimeString('en-NZ', { hour: 'numeric', minute: '2-digit' })}</time><span>${esc(evName[e.type] || e.type)}${e.detail && (e.detail.room || e.detail.photo || e.detail.when) ? ' · ' + esc(ROOM_NAME[e.detail.room] || e.detail.photo || e.detail.when) : ''}</span></li>`).join('')}</ul></div>
      <p class="note">Recorded in this browser only, so you can see how tracking works. A live version would gather these numbers from every visitor.</p>`;
    if (roomEntries.length && D.isSample(anListingId)) {
      const fp = MZ.floorplan.mount($('#anHeat'), { plan: D.home(anListingId).plan, compact: true, interactive: false });
      fp.setHeat(s.rooms);
    } else if ($('#anHeat')) $('#anHeat').remove();
    requestAnimationFrame(() => $$('#anBody .hbar .tr i').forEach((i) => { const w = i.style.width; i.style.width = '0'; requestAnimationFrame(() => { i.style.width = w; }); }));
  }

  // ---------- shared photo picker ----------
  const listingPhotos = D.homes.flatMap((h) => h.photos.slice(0, 4).map((p) => ({ src: p.src, label: `${h.short}: ${p.caption}` })))
    .concat(D.homes.map((h) => ({ src: h.exterior.src, label: `${h.short}: exterior` })));
  function thumbs(host, sources, onPick, current) {
    host.innerHTML = sources.map((s, i) => `<button type="button" data-i="${i}" aria-pressed="${i === current}" aria-label="${esc(s.label)}" style="background-image:url('${esc(s.src)}')"></button>`).join('') +
      `<label class="up">＋ Your<br>photo<input type="file" accept="image/*"></label>`;
    $$('button', host).forEach((b) => b.addEventListener('click', () => {
      $$('button', host).forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
      onPick(sources[Number(b.dataset.i)].src);
    }));
    $('input[type=file]', host).addEventListener('change', (e) => {
      const f = e.target.files && e.target.files[0];
      if (!f) return;
      $$('button', host).forEach((x) => x.setAttribute('aria-pressed', 'false'));
      onPick(URL.createObjectURL(f));
      MZ.toast('Photo loaded on your device. It is not uploaded anywhere.');
    });
  }
  const debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
  function paint(canvas, src) { canvas.width = src.width; canvas.height = src.height; canvas.getContext('2d').drawImage(src, 0, 0); }

  // ---------- photo enhance (1 + 12) ----------
  const SLIDERS = [
    ['exposure', 'Brightness', -50, 50], ['contrast', 'Contrast', -30, 40], ['shadows', 'Shadows', 0, 40], ['highlights', 'Highlights', -40, 0],
    ['warmth', 'Warmth', -20, 20], ['vibrance', 'Vibrance', 0, 40], ['saturation', 'Saturation', -30, 30], ['sharpen', 'Sharpen', 0, 80]
  ];
  let ph = { src: null, params: null };
  function initPhoto() {
    $('#phSliders').innerHTML = SLIDERS.map(([k, n, a, b]) => `<label>${n}<input class="rng" type="range" data-k="${k}" min="${a}" max="${b}" value="0"><output data-o="${k}">0</output></label>`).join('');
    const update = debounce(renderPhoto, 60);
    $$('#phSliders input').forEach((inp) => inp.addEventListener('input', () => {
      ph.params[inp.dataset.k] = Number(inp.value);
      $(`[data-o="${inp.dataset.k}"]`).textContent = inp.value;
      update();
    }));
    $('#phAuto').addEventListener('click', () => { ph.params = MZ.photo.autoParams(ph.src); syncSliders(); renderPhoto(); MZ.toast('Auto adjustments applied'); });
    $('#phResetBtn').addEventListener('click', () => { ph.params = MZ.photo.neutral(); syncSliders(); renderPhoto(); });
    $('#phExport').addEventListener('click', async () => {
      const out = MZ.photo.apply(ph.src, ph.params);
      if ($('#phLabel').checked) MZ.photo.label(out, 'Edited · light & colour only');
      MZ.download(await MZ.photo.toBlob(out, 'image/jpeg', 0.92), 'photo-edited.jpg');
    });
    // the darker, overcast ranch exterior shows the auto fixes best
    const first = Math.max(0, listingPhotos.findIndex((p) => p.src.includes('ranch/exterior')));
    thumbs($('#phThumbs'), listingPhotos, loadPhoto, first);
    MZ.initCompare($('#phCompare'), { intro: false });
    loadPhoto(listingPhotos[first].src);
  }
  async function loadPhoto(src) {
    const img = await MZ.photo.loadImage(src);
    ph.src = MZ.photo.toCanvas(img, 1600);
    paint($('#phBefore'), ph.src);
    ph.params = MZ.photo.autoParams(ph.src);
    syncSliders(); renderPhoto();
    $('#phCompare')._mzCompare.replay();
  }
  function syncSliders() {
    $$('#phSliders input').forEach((inp) => { inp.value = ph.params[inp.dataset.k]; $(`[data-o="${inp.dataset.k}"]`).textContent = inp.value; });
  }
  function renderPhoto() {
    paint($('#phAfter'), MZ.photo.apply(ph.src, ph.params));
    const log = MZ.photo.describe(ph.params);
    $('#phLog').innerHTML = (log.length ? log.map((c) => `<li><b>${esc(c.k)}</b><em>${esc(c.v)}</em><small>${esc(c.d)}</small></li>`).join('') : '<li><b>No changes</b><small>The photo is shown as taken.</small></li>') +
      '<li class="keep"><b>Not changed</b><em>✓</em><small>Nothing added, moved or removed. Walls, furniture, views and sky stay as photographed.</small></li>';
  }

  // ---------- day to dusk (13) ----------
  // The sample exteriors come with their windows marked; for your own photo,
  // drag boxes over the windows (and any outdoor lights) to light them.
  let du = { src: null, windows: [], lights: [] };
  const duskSources = D.homes.map((h) => ({ src: h.exterior.src, label: `${h.short}: exterior`, dusk: h.dusk }));
  let duLast = null, duMode = null;
  function initDusk() {
    const rerender = debounce(renderDusk, 140);
    [['duStrength', 'duStrengthO'], ['duGlow', 'duGlowO'], ['duSky', 'duSkyO']].forEach(([i, o]) => $('#' + i).addEventListener('input', (e) => { $('#' + o).textContent = e.target.value; rerender(); }));
    $('#duExport').addEventListener('click', async () => {
      const out = MZ.photo.clone(duLast.canvas);
      MZ.photo.label(out, 'Simulated twilight');
      MZ.download(await MZ.photo.toBlob(out, 'image/jpeg', 0.92), 'photo-simulated-twilight.jpg');
    });
    thumbs($('#duThumbs'), duskSources, (src) => {
      const known = duskSources.find((d) => d.src === src);
      loadDusk(src, known ? known.dusk : null);
    }, 0);
    MZ.initCompare($('#duCompare'), { intro: false });
    $('#duMarkBtn').addEventListener('click', () => setMarkMode(duMode === 'window' ? null : 'window'));
    $('#duLightBtn').addEventListener('click', () => setMarkMode(duMode === 'light' ? null : 'light'));
    $('#duMarkClear').addEventListener('click', () => { du.windows = []; du.lights = []; drawMarks(); renderDusk(); });
    initMarking();
    loadDusk(duskSources[0].src, duskSources[0].dusk);
  }
  async function loadDusk(src, preset) {
    const img = await MZ.photo.loadImage(src);
    du.src = MZ.photo.toCanvas(img, 1600);
    du.windows = preset ? preset.windows.map((p) => p.map((q) => q.slice())) : [];
    du.lights = preset ? preset.lights.map((l) => Object.assign({}, l)) : [];
    paint($('#duBefore'), du.src);
    setMarkMode(preset ? null : 'window');
    renderDusk();
    $('#duCompare')._mzCompare.replay();
  }
  function setMarkMode(mode) {
    duMode = mode;
    $('#duMarkBtn').setAttribute('aria-pressed', String(mode === 'window'));
    $('#duLightBtn').setAttribute('aria-pressed', String(mode === 'light'));
    $('#duMarkBtn').textContent = mode === 'window' ? 'Done' : 'Mark windows';
    $('#duLightBtn').textContent = mode === 'light' ? 'Done' : 'Mark a light';
    $('#duCompare').hidden = !!mode;
    $('#duMark').hidden = !mode;
    if (mode) { paint($('#duMarkCanvas'), du.src); drawMarks(); } else renderDusk();
  }
  function initMarking() {
    const stage = $('#duMark');
    let drag = null;
    const rel = (e) => { const r = stage.getBoundingClientRect(); return { x: MZ.clamp((e.clientX - r.left) / r.width, 0, 1), y: MZ.clamp((e.clientY - r.top) / r.height, 0, 1) }; };
    stage.addEventListener('pointerdown', (e) => {
      if (e.target.closest('.pbox button')) return;
      const p = rel(e);
      if (duMode === 'light') { du.lights.push({ x: p.x, y: p.y, r: 0.012 }); drawMarks(); return; }
      try { stage.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
      drag = { x0: p.x, y0: p.y, el: document.createElement('div') };
      drag.el.className = 'pbox';
      stage.appendChild(drag.el);
    });
    stage.addEventListener('pointermove', (e) => {
      if (!drag) return;
      const p = rel(e);
      placeBox(drag.el, Math.min(drag.x0, p.x), Math.min(drag.y0, p.y), Math.abs(p.x - drag.x0), Math.abs(p.y - drag.y0));
    });
    stage.addEventListener('pointerup', (e) => {
      if (!drag) return;
      const p = rel(e);
      const x0 = Math.min(drag.x0, p.x), y0 = Math.min(drag.y0, p.y), x1 = Math.max(drag.x0, p.x), y1 = Math.max(drag.y0, p.y);
      drag.el.remove(); drag = null;
      if (x1 - x0 > 0.008 && y1 - y0 > 0.008) { du.windows.push([[x0, y0], [x1, y0], [x1, y1], [x0, y1]]); drawMarks(); }
    });
  }
  function placeBox(el, x, y, w, h) { Object.assign(el.style, { left: x * 100 + '%', top: y * 100 + '%', width: w * 100 + '%', height: h * 100 + '%' }); }
  function drawMarks() {
    const stage = $('#duMark');
    $$('.pbox, .plight', stage).forEach((n) => n.remove());
    du.windows.forEach((poly, i) => {
      const xs = poly.map((p) => p[0]), ys = poly.map((p) => p[1]);
      const el = document.createElement('div');
      el.className = 'pbox';
      el.innerHTML = `<button type="button" aria-label="Remove window">✕</button>`;
      placeBox(el, Math.min(...xs), Math.min(...ys), Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys));
      $('button', el).addEventListener('click', () => { du.windows.splice(i, 1); drawMarks(); });
      stage.appendChild(el);
    });
    du.lights.forEach((l, i) => {
      const el = document.createElement('button');
      el.type = 'button'; el.className = 'plight'; el.setAttribute('aria-label', 'Remove light');
      Object.assign(el.style, { left: l.x * 100 + '%', top: l.y * 100 + '%' });
      el.addEventListener('pointerdown', (e) => e.stopPropagation());
      el.addEventListener('click', () => { du.lights.splice(i, 1); drawMarks(); });
      stage.appendChild(el);
    });
    $('#duMarkInfo').textContent = `${du.windows.length} window${du.windows.length === 1 ? '' : 's'} and ${du.lights.length} light${du.lights.length === 1 ? '' : 's'} marked.`;
  }
  function renderDusk() {
    if (!du.src) return;
    duLast = MZ.photo.dusk(du.src, {
      strength: Number($('#duStrength').value) / 100, glow: Number($('#duGlow').value) / 100, sky: Number($('#duSky').value) / 100,
      windows: du.windows, lights: du.lights
    });
    paint($('#duAfter'), duLast.canvas);
    $('#duLog').innerHTML = duLast.changes.map((c) => `<li><b>${esc(c.k)}</b><em>${esc(c.v)}</em><small>${esc(c.d)}</small></li>`).join('') +
      '<li class="keep"><b>Label</b><em>always on</em><small>Exports say "Simulated twilight" so buyers know it is not a real evening photo.</small></li>';
  }

  // ---------- privacy blur (11) ----------
  let pv = { src: null, boxes: [] };
  const pvSources = listingPhotos;
  function initPrivacy() {
    const stage = $('#pvStage');
    let drag = null;
    const rel = (e) => { const r = stage.getBoundingClientRect(); return { x: MZ.clamp((e.clientX - r.left) / r.width, 0, 1), y: MZ.clamp((e.clientY - r.top) / r.height, 0, 1) }; };
    stage.addEventListener('pointerdown', (e) => {
      if (e.target.closest('.pbox button')) return;
      try { stage.setPointerCapture(e.pointerId); } catch (err) { /* pointer already gone */ }
      const p = rel(e);
      drag = { x0: p.x, y0: p.y, el: document.createElement('div') };
      drag.el.className = 'pbox';
      stage.appendChild(drag.el);
      place(drag.el, p.x, p.y, 0, 0);
    });
    stage.addEventListener('pointermove', (e) => {
      if (!drag) return;
      const p = rel(e);
      place(drag.el, Math.min(drag.x0, p.x), Math.min(drag.y0, p.y), Math.abs(p.x - drag.x0), Math.abs(p.y - drag.y0));
    });
    const end = (e) => {
      if (!drag) return;
      const p = rel(e);
      const box = { x: Math.min(drag.x0, p.x), y: Math.min(drag.y0, p.y), w: Math.abs(p.x - drag.x0), h: Math.abs(p.y - drag.y0), kind: $('#pvKind').value };
      drag.el.remove(); drag = null;
      if (box.w > 0.015 && box.h > 0.015) { pv.boxes.push(box); renderPrivacy(); }
    };
    stage.addEventListener('pointerup', end);
    stage.addEventListener('pointercancel', () => { if (drag) { drag.el.remove(); drag = null; } });
    $('#pvClear').addEventListener('click', () => { pv.boxes = []; renderPrivacy(); });
    $('#pvPreview').addEventListener('change', renderPrivacy);
    $('#pvDetect').addEventListener('click', async () => {
      const note = $('#pvDetectNote');
      if (!MZ.photo.faceDetectorAvailable()) {
        note.textContent = 'This browser has no built-in face detection, so draw boxes by hand. Automatic detection works in browsers that support it (for example Chrome on Android) and would run on our servers in a live version.';
        return;
      }
      note.textContent = 'Looking for faces…';
      const faces = await MZ.photo.detectFaces(pv.src);
      if (!faces) { note.textContent = 'Face detection failed in this browser. Draw boxes by hand.'; return; }
      faces.forEach((f) => pv.boxes.push({ x: f.x / pv.src.width, y: f.y / pv.src.height, w: f.w / pv.src.width, h: f.h / pv.src.height, kind: 'Face (found automatically)' }));
      note.textContent = faces.length ? `Found ${faces.length} face${faces.length > 1 ? 's' : ''}. Check the photo for anything else.` : 'No faces found. Check for photos, documents and plates by hand.';
      renderPrivacy();
    });
    $('#pvExport').addEventListener('click', async () => {
      const out = MZ.photo.clone(pv.src);
      pv.boxes.forEach((b) => MZ.photo.blurRect(out, { x: b.x * out.width, y: b.y * out.height, w: b.w * out.width, h: b.h * out.height }));
      MZ.download(await MZ.photo.toBlob(out, 'image/jpeg', 0.92), 'photo-privacy-checked.jpg');
    });
    thumbs($('#pvThumbs'), pvSources, loadPrivacy, 0);
    loadPrivacy(pvSources[0].src);
  }
  function place(el, x, y, w, h) { el.style.left = x * 100 + '%'; el.style.top = y * 100 + '%'; el.style.width = w * 100 + '%'; el.style.height = h * 100 + '%'; }
  async function loadPrivacy(src) {
    const img = await MZ.photo.loadImage(src);
    pv.src = MZ.photo.toCanvas(img, 1600);
    pv.boxes = [];
    $('#pvStage').style.aspectRatio = pv.src.width + ' / ' + pv.src.height;
    renderPrivacy();
  }
  function renderPrivacy() {
    const c = $('#pvCanvas');
    paint(c, pv.src);
    if ($('#pvPreview').checked) pv.boxes.forEach((b) => MZ.photo.blurRect(c, { x: b.x * c.width, y: b.y * c.height, w: b.w * c.width, h: b.h * c.height }));
    $$('#pvStage .pbox').forEach((el) => el.remove());
    pv.boxes.forEach((b, i) => {
      const el = document.createElement('div');
      el.className = 'pbox';
      el.innerHTML = `<span>${esc(b.kind)}</span><button type="button" aria-label="Remove ${esc(b.kind)} box">✕</button>`;
      place(el, b.x, b.y, b.w, b.h);
      $('button', el).addEventListener('click', (e) => { e.stopPropagation(); pv.boxes.splice(i, 1); renderPrivacy(); });
      $('#pvStage').appendChild(el);
    });
    $('#pvLog').innerHTML = pv.boxes.length ? pv.boxes.map((b) => `<li><b>${esc(b.kind)}</b><em>blurred</em></li>`).join('') : '<li><b>Nothing marked yet</b><small>Drag a box over anything personal: faces, family photos, mail, number plates or house numbers.</small></li>';
  }

  // ---------- marketing pack (5) ----------
  let mkListingId = D.listing.id;
  function initMarketing() {
    fillListingSelect($('#mkListing'), mkListingId);
    $('#mkListing').addEventListener('change', (e) => { mkListingId = e.target.value; renderMarketing(); });
    renderMarketing();
  }
  async function renderMarketing() {
    fillListingSelect($('#mkListing'), mkListingId);
    const L = findListing(mkListingId) || D.listing;
    const photos = (L.photos || []).map((p) => p.src || p);
    const copy = MZ.mk.copy(L);
    const url = MZ.mk.listingUrl(L);
    const grid = $('#mkGrid');
    grid.innerHTML = `
      <div class="mk-card"><div class="mk-prev" id="mkSq"><span class="spinner"></span></div><div class="mk-body"><h3>Square post</h3><p>1080 × 1080 for Instagram and Facebook feeds.</p><div class="row"><button class="btn btn-gold btn-xs" type="button" id="mkSqDl" disabled>Download PNG</button></div></div></div>
      <div class="mk-card"><div class="mk-prev" id="mkSt"><span class="spinner"></span></div><div class="mk-body"><h3>Story</h3><p>1080 × 1920 with a QR code to the listing.</p><div class="row"><button class="btn btn-gold btn-xs" type="button" id="mkStDl" disabled>Download PNG</button></div></div></div>
      <div class="mk-card"><div class="mk-prev" id="mkVid"><button class="btn btn-pill btn-sm" type="button" id="mkVidGo">▶ Make the video</button></div><div class="mk-body"><h3>Listing video</h3><p>About 15 seconds, vertical, with captions. Recorded in your browser in real time.</p><div class="row"><button class="btn btn-gold btn-xs" type="button" id="mkVidDl" hidden>Download video</button><span class="muted small" id="mkVidNote"></span></div></div></div>
      <div class="mk-card"><div class="mk-prev"><div style="width:150px;aspect-ratio:210/297;background:#fff;border-radius:6px;padding:10px;display:grid;gap:6px;align-content:start"><div style="height:62px;border-radius:4px;background:url('${esc(photos[0] || '')}') center/cover"></div><div style="height:7px;width:80%;background:#111;border-radius:3px"></div><div style="height:5px;width:55%;background:#bbb;border-radius:3px"></div><div style="height:4px;background:#ddd;border-radius:3px"></div><div style="height:4px;background:#ddd;border-radius:3px"></div><div style="height:4px;width:70%;background:#ddd;border-radius:3px"></div><div style="height:22px;border:1px solid #c29b45;border-radius:4px"></div></div></div><div class="mk-body"><h3>Printable brochure</h3><p>A4, with photos, room sizes and a QR code. Save it as a PDF from the print window.</p><div class="row"><button class="btn btn-gold btn-xs" type="button" id="mkBro">Open brochure</button></div></div></div>
      <div class="mk-card"><div class="mk-prev" id="mkQr"><span class="spinner"></span></div><div class="mk-body"><h3>QR code</h3><p>For window cards, signboards and flyers.</p><p class="small" style="word-break:break-all">${esc(url)}</p><div class="row"><button class="btn btn-gold btn-xs" type="button" id="mkQrDl" disabled>Download PNG</button></div></div></div>
      <div class="mk-card" style="grid-column:1/-1"><div class="mk-body"><h3>Listing copy</h3><p>Ready to paste. Edit to suit your voice.</p>
        <div class="grid2 mt1">
          ${[['Instagram caption', copy.instagram], ['Facebook post', copy.facebook], ['Portal headline (Trade Me, realestate.co.nz)', copy.portalTitle], ['Portal description', copy.portalBody], ['Text or email to your buyer list', copy.sms]].map(([k, v], i) => `<div><div class="row between" style="margin-bottom:.4rem"><b class="small">${esc(k)}</b><button class="btn btn-ghost btn-xs" type="button" data-copy="${i}">Copy</button></div><div class="copybox">${esc(v)}</div></div>`).join('')}
        </div></div></div>`;
    const copies = [copy.instagram, copy.facebook, copy.portalTitle, copy.portalBody, copy.sms];
    $$('[data-copy]').forEach((b) => b.addEventListener('click', () => MZ.copy(copies[Number(b.dataset.copy)], 'Copy')));

    const imgs = await Promise.all(photos.slice(0, 5).map((p) => MZ.photo.loadImage(p).catch(() => null))).then((a) => a.filter(Boolean));
    if (!imgs.length) return;
    let qr = null;
    try { qr = await MZ.mk.qr(url, 360); } catch (e) { $('#mkQr').innerHTML = '<p class="muted small">QR library could not load. Check your connection.</p>'; }
    if (qr) {
      const qc = MZ.photo.clone(qr); qc.style.maxHeight = '200px'; qc.style.imageRendering = 'pixelated';
      $('#mkQr').innerHTML = ''; $('#mkQr').appendChild(qc);
      $('#mkQrDl').disabled = false;
      $('#mkQrDl').addEventListener('click', async () => MZ.download(await MZ.photo.toBlob(qr, 'image/png'), 'listing-qr.png'));
    }
    const sq = await MZ.mk.square(L, imgs[0]);
    $('#mkSq').innerHTML = ''; $('#mkSq').appendChild(sq);
    $('#mkSqDl').disabled = false;
    $('#mkSqDl').addEventListener('click', async () => MZ.download(await MZ.photo.toBlob(sq, 'image/png'), 'post-square.png'));
    const st = await MZ.mk.story(L, imgs[1] || imgs[0], qr);
    $('#mkSt').innerHTML = ''; $('#mkSt').appendChild(st);
    $('#mkStDl').disabled = false;
    $('#mkStDl').addEventListener('click', async () => MZ.download(await MZ.photo.toBlob(st, 'image/png'), 'post-story.png'));

    $('#mkVidGo').addEventListener('click', async () => {
      if (!MZ.mk.videoSupported()) { $('#mkVidNote').textContent = 'This browser cannot record video. Try Chrome, Edge, Firefox or Safari 17+.'; return; }
      const box = $('#mkVid');
      box.innerHTML = '<div style="width:70%"><div class="hbar" style="grid-template-columns:1fr"><span class="tr"><i id="mkVidBar" style="width:0;transition:none"></i></span></div><p class="muted small mt1" style="text-align:center">Recording… keep this tab open</p></div>';
      try {
        const res = await MZ.mk.video(L, imgs, (p) => { const bar = $('#mkVidBar'); if (bar) bar.style.width = Math.round(p * 100) + '%'; });
        const v = document.createElement('video');
        v.src = URL.createObjectURL(res.blob); v.controls = true; v.loop = true; v.muted = true; v.playsInline = true; v.autoplay = true;
        box.innerHTML = ''; box.appendChild(v);
        $('#mkVidDl').hidden = false;
        $('#mkVidDl').onclick = () => MZ.download(res.blob, 'listing-video.' + res.ext);
        $('#mkVidNote').textContent = (res.blob.size / 1e6).toFixed(1) + ' MB · ' + res.ext.toUpperCase();
      } catch (e) {
        box.innerHTML = '<p class="muted small">Recording failed in this browser.</p>';
        console.warn(e);
      }
    });

    $('#mkBro').addEventListener('click', () => {
      const abs = (p) => new URL(p, location.href).href;
      const html = MZ.mk.brochureHtml(L, qr ? qr.toDataURL('image/png') : null, photos.map(abs), abs('assets/brand-mark.svg'));
      const w = window.open('', '_blank');
      if (!w) { MZ.download(new Blob([html], { type: 'text/html' }), 'brochure.html'); MZ.toast('Pop-up blocked, so the brochure was downloaded instead'); return; }
      w.document.open(); w.document.write(html); w.document.close();
    });
  }

  // ---------- publish (15) ----------
  let pubPhotos = [];
  function readListingForm() {
    const v = (id) => $('#' + id).value.trim();
    const n = (id) => { const x = parseInt($('#' + id).value, 10); return isNaN(x) ? null : x; };
    const price = v('pPrice');
    const digits = price.replace(/[^\d]/g, '');
    return {
      title: v('pTitle') || 'Your headline',
      suburb: v('pSuburb'),
      priceLabel: price || 'By negotiation',
      priceValue: digits.length >= 5 ? Number(digits) : null,
      beds: n('pBeds'), baths: n('pBaths'), living: n('pLiving'), garage: n('pGarage'), land: n('pLand'), floor: n('pFloor'),
      description: v('pDesc') ? v('pDesc').split(/\n\s*\n/).map((s) => s.trim()).filter(Boolean) : [],
      features: v('pFeat') ? v('pFeat').split(',').map((s) => s.trim()).filter(Boolean) : [],
      photos: pubPhotos.length ? pubPhotos.map((src, i) => ({ src, alt: 'Photo ' + (i + 1), caption: 'Photo ' + (i + 1) })) : D.listing.photos.map((p) => ({ src: p.src, alt: p.alt, caption: p.caption }))
    };
  }
  function renderPreview() {
    const L = readListingForm();
    $('#pubPreview').innerHTML = `<div class="pv-img" style="background-image:url('${esc(L.photos[0].src)}')"><span class="badge">Preview</span></div>
      <div class="pv-body"><span class="eyebrow">${esc(L.priceLabel)}</span><h3>${esc(L.title)}</h3><p class="dim mt1">${esc(L.suburb || 'Suburb, city')}</p>
      <div class="l-facts" style="margin-top:.8rem">${MZ.mk.facts(L).map((f) => `<span class="chip">${esc(f)}</span>`).join('')}</div>
      <p class="muted small mt1">${esc((L.description[0] || 'Your description appears on the listing page.').slice(0, 180))}</p></div>`;
  }
  async function shrink(file) {
    const url = URL.createObjectURL(file);
    try {
      const img = await MZ.photo.loadImage(url);
      const c = MZ.photo.toCanvas(img, 1200);
      return c.toDataURL('image/jpeg', 0.76);
    } finally { URL.revokeObjectURL(url); }
  }
  function initPublish() {
    $$('#pubForm input, #pubForm textarea').forEach((i) => i.addEventListener('input', debounce(renderPreview, 120)));
    $('#pPhotos').addEventListener('change', async (e) => {
      const files = Array.from(e.target.files || []).slice(0, 6);
      $('#pubNote').textContent = files.length ? 'Resizing photos…' : '';
      pubPhotos = [];
      for (const f of files) { try { pubPhotos.push(await shrink(f)); } catch (err) { /* skip unreadable */ } }
      $('#pubNote').textContent = pubPhotos.length ? `${pubPhotos.length} photo${pubPhotos.length > 1 ? 's' : ''} ready (kept on this device)` : '';
      renderPreview();
    });
    $('#pubForm').addEventListener('submit', (e) => {
      e.preventDefault();
      const t = $('#pTitle');
      const bad = !t.value.trim();
      t.setAttribute('aria-invalid', String(bad)); t.parentElement.querySelector('.field-error').hidden = !bad;
      if (bad) { t.focus(); return; }
      const L = Object.assign(readListingForm(), {
        id: 'own-' + Date.now().toString(36), status: 'Active', published: true, sample: false,
        tagline: 'Just listed', createdAt: Date.now(), chattels: [], viewings: D.listing.viewings
      });
      const list = own();
      list.unshift(L);
      if (!saveOwn(list)) {
        $('#pubNote').textContent = 'This device is out of storage for demo listings. Delete one in the portfolio or use fewer photos.';
        return;
      }
      showPublished(L);
      MZ.toast('Listing published');
    });
    renderPreview();
  }
  function standaloneHtml(L) {
    const abs = (p) => p.startsWith('data:') ? p : new URL(p, location.href).href;
    return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${esc(L.title)}</title>
<link rel="stylesheet" href="https://api.fontshare.com/v2/css?f[]=satoshi@400,500,700&display=swap">
<style>body{margin:0;background:#f7f2e8;color:#1f1b16;font-family:"Satoshi","Helvetica Neue",Arial,sans-serif;line-height:1.55}.w{max-width:960px;margin:0 auto;padding:24px}img{width:100%;border-radius:14px;display:block}.g{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:10px;margin-top:10px}.g img{height:180px;object-fit:cover}h1{font-weight:500;font-size:2.2rem;margin:24px 0 4px}.m{color:#4d463c}.f{display:flex;flex-wrap:wrap;gap:8px;margin:16px 0}.f span{border:1px solid rgba(31,27,22,.18);background:#fff;border-radius:99px;padding:6px 14px;font-size:.9rem}.p{color:#7d5f17;font-weight:700}p{color:#4d463c}.b{display:inline-block;background:#c29b45;color:#1f1b16;padding:12px 22px;border-radius:99px;font-weight:600;text-decoration:none;margin-top:12px}footer{color:#6e6558;font-size:.8rem;margin-top:40px;border-top:1px solid rgba(31,27,22,.14);padding-top:14px}</style></head>
<body><div class="w"><img src="${esc(abs(L.photos[0].src))}" alt=""><div class="g">${L.photos.slice(1, 4).map((p) => `<img src="${esc(abs(p.src))}" alt="">`).join('')}</div>
<h1>${esc(L.title)}</h1><div class="m">${esc(L.suburb || '')}</div><div class="p">${esc(L.priceLabel)}</div>
<div class="f">${MZ.mk.facts(L).map((f) => `<span>${esc(f)}</span>`).join('')}</div>
${L.description.map((p) => `<p>${esc(p)}</p>`).join('')}${L.features.length ? `<p>Features: ${L.features.map(esc).join(', ')}</p>` : ''}
<a class="b" href="${esc(MZ.mk.listingUrl(L))}">Book a viewing</a>
<footer>HomeView · published from the agent studio (demo)</footer></div></body></html>`;
  }
  function showPublished(L) {
    const url = MZ.mk.listingUrl(L);
    const embed = `<iframe src="${url}" title="${L.title.replace(/"/g, '&quot;')}" style="width:100%;height:900px;border:0;border-radius:16px" loading="lazy"></iframe>`;
    const copy = MZ.mk.copy(L);
    const enc = encodeURIComponent;
    const box = $('#pubResult');
    box.hidden = false;
    box.innerHTML = `<h4>Published</h4>
      <div class="channels">
        <div class="channel"><span><b>Your listing page</b><small>Branded page with photos, details and bookings</small></span><a class="btn btn-gold btn-xs" href="listing.html?id=${enc(L.id)}" target="_blank" rel="noopener">Open</a></div>
        <div class="channel"><span><b>Agency website</b><small>Embed the page on your own site</small></span><button class="btn btn-ghost btn-xs" type="button" data-pc="embed">Copy embed</button></div>
        <div class="channel"><span><b>Trade Me / realestate.co.nz</b><small>Headline and description ready to paste. Direct upload needs your portal account access.</small></span><button class="btn btn-ghost btn-xs" type="button" data-pc="portal">Copy text</button></div>
        <div class="channel"><span><b>Social</b><small>Share the listing link</small></span><span class="row" style="gap:.3rem"><a class="btn btn-ghost btn-xs" target="_blank" rel="noopener" href="https://www.facebook.com/sharer/sharer.php?u=${enc(url)}">Facebook</a><a class="btn btn-ghost btn-xs" target="_blank" rel="noopener" href="https://www.linkedin.com/sharing/share-offsite/?url=${enc(url)}">LinkedIn</a><a class="btn btn-ghost btn-xs" target="_blank" rel="noopener" href="https://wa.me/?text=${enc(L.title + ' ' + url)}">WhatsApp</a></span></div>
        <div class="channel"><span><b>Single-file web page</b><small>Download the page to host anywhere</small></span><button class="btn btn-ghost btn-xs" type="button" data-pc="html">Download</button></div>
        <div class="channel"><span><b>Marketing pack</b><small>Posts, video, brochure and QR for this listing</small></span><button class="btn btn-ghost btn-xs" type="button" data-pc="mk">Make it</button></div>
      </div>
      <p class="formnote mt1">Saved on this device only (demo). Share links point to this site's address once it's deployed.</p>`;
    $('[data-pc=embed]', box).addEventListener('click', () => MZ.copy(embed, 'Embed code'));
    $('[data-pc=portal]', box).addEventListener('click', () => MZ.copy(copy.portalTitle + '\n\n' + copy.portalBody, 'Portal text'));
    $('[data-pc=html]', box).addEventListener('click', () => MZ.download(new Blob([standaloneHtml(L)], { type: 'text/html' }), (L.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40) || 'listing') + '.html'));
    $('[data-pc=mk]', box).addEventListener('click', () => goto('marketing', { listing: L.id }));
    box.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  // ---------- boot ----------
  document.addEventListener('DOMContentLoaded', () => {
    picker = MZ.initPicker($('#tabs'), show);
    $$('[data-goto]').forEach((b) => b.addEventListener('click', () => goto(b.dataset.goto)));
    const start = (location.hash || '').slice(1);
    const valid = Object.keys(inits);
    picker.select(valid.includes(start) ? start : 'portfolio');
    window.addEventListener('hashchange', () => { const h = location.hash.slice(1); if (valid.includes(h)) picker.select(h); });
  });
})();
