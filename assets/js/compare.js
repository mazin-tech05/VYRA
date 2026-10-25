/* Side-by-side comparison (feature 8): the three sample homes plus anything
   published from the agent studio on this device. */
(function () {
  'use strict';
  const MZ = window.MZ;
  const { $, $$, esc } = MZ;
  const D = MZ.data;

  const art = {
    town: '<svg viewBox="0 0 64 48" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M8 44V18l12-10 12 10v26M32 44V22l12-10 12 10v22M4 44h56"/><path d="M16 44v-9h8v9M40 44v-9h8v9"/></svg>',
    villa: '<svg viewBox="0 0 64 48" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M6 22 32 6l26 16M10 20v24h44V20M4 44h56"/><path d="M27 44V32h10v12M15 28h7v6h-7zM42 28h7v6h-7z"/><path d="M10 26h44"/></svg>',
    apt: '<svg viewBox="0 0 64 48" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M16 44V6h32v38M4 44h56"/><path d="M22 12h6v5h-6zM36 12h6v5h-6zM22 22h6v5h-6zM36 22h6v5h-6zM22 32h6v5h-6zM36 32h6v5h-6z"/></svg>'
  };

  function allHomes() {
    const published = (MZ.store.get('mz-portfolio', []) || []).filter((x) => x.published);
    return D.homes.concat(published);
  }

  const homes = allHomes();
  const byId = (id) => homes.find((h) => h.id === id);
  const url = new URLSearchParams(location.search);
  let selected = (url.get('ids') ? url.get('ids').split(',') : (MZ.store.get('mz-compare', []) || []))
    .filter((id) => byId(id));
  if (selected.length < 2) {
    selected = D.homes.map((h) => h.id);
  }

  const rows = [
    { k: 'Bedrooms', v: (h) => h.beds ?? '—', best: 'max', num: (h) => h.beds },
    { k: 'Bathrooms', v: (h) => h.baths ?? '—', best: 'max', num: (h) => h.baths },
    { k: 'Living areas', v: (h) => h.living ?? '—', best: 'max', num: (h) => h.living },
    { k: 'Parking', v: (h) => h.garage ?? '—', best: 'max', num: (h) => h.garage },
    { k: 'Land', v: (h) => h.land ? h.land + ' m²' : '—', best: 'max', num: (h) => h.land },
    { k: 'Floor area', v: (h) => h.floor ? h.floor + ' m²' : '—', best: 'max', num: (h) => h.floor },
    { k: 'Rooms in 3D', v: (h) => h.plan ? h.plan.rooms.filter((r) => r.cam).length : '—', best: 'max', num: (h) => h.plan ? h.plan.rooms.filter((r) => r.cam).length : null },
    { k: 'Largest room', v: (h) => { const r = largest(h); return r ? `${r.name}, ${r.area.toFixed(0)} m²` : '—'; }, best: 'max', num: (h) => { const r = largest(h); return r ? r.area : null; } },
    { k: 'Outdoor areas', v: (h) => h.plan ? (h.plan.rooms.filter((r) => r.outdoor).map((r) => r.name).join(', ') || 'None scanned') : '—' },
    { k: '3D tour', v: (h) => tourOf(h) ? '<span class="yes">✓ Yes</span>' : '<span class="no">No</span>', html: true },
    { k: 'Floor plan', v: (h) => planOf(h) ? '<span class="yes">✓ Yes</span>' : '<span class="no">No</span>', html: true },
    { k: 'Features', v: (h) => (h.features || []).slice(0, 5).map((f) => esc(f)).join('<br>') || '—', html: true },
    { k: 'Status', v: (h) => h.status || 'Active' }
  ];
  const tourOf = (h) => !!(h.tour && h.tour.src);
  const planOf = (h) => !!h.plan;
  function largest(h) {
    if (!h.plan) return null;
    return h.plan.rooms.filter((r) => !r.outdoor && r.name !== 'Hall').sort((a, b) => b.area - a.area)[0] || null;
  }

  function renderPick() {
    $('#cmpPick').innerHTML = homes.map((h) => `<button type="button" class="chip" data-id="${esc(h.id)}" aria-pressed="${selected.includes(h.id)}">${esc(h.short || h.title)}${D.isSample(h.id) ? '' : ' (yours)'}</button>`).join('');
    $$('#cmpPick .chip').forEach((b) => b.addEventListener('click', () => toggle(b.dataset.id)));
  }

  function toggle(id) {
    if (selected.includes(id)) {
      if (selected.length <= 1) { MZ.toast('Keep at least one home'); return; }
      selected = selected.filter((x) => x !== id);
    } else {
      if (selected.length >= 4) { MZ.toast('Compare up to four homes at a time'); return; }
      selected.push(id);
    }
    MZ.store.set('mz-compare', selected);
    renderPick(); renderTable();
  }

  function head(h) {
    const img = h.photos && h.photos[0] ? `<div class="ph" style="background-image:url('${esc(h.photos[0].src || h.photos[0])}')"></div>` : `<div class="ph art">${art[h.art] || art.villa}</div>`;
    const href = D.isSample(h.id) ? 'listing.html?home=' + h.id : (h.published ? 'listing.html?id=' + encodeURIComponent(h.id) : null);
    return `<div class="cmp-card">${img}<b>${esc(h.title)}</b><small>${esc(h.suburb || '')}</small>
      <div class="row">${href ? `<a class="btn btn-ghost btn-xs" href="${href}">View</a>` : '<span class="pill off">Made-up example</span>'}<button class="icon-btn" type="button" data-remove="${esc(h.id)}" aria-label="Remove ${esc(h.title)} from compare">✕</button></div></div>`;
  }

  function renderTable() {
    const list = selected.map(byId).filter(Boolean);
    const bestIdx = (row) => {
      if (!row.best) return -1;
      const vals = list.map((h) => row.num(h));
      const ok = vals.filter((v) => v != null && !isNaN(v));
      if (ok.length < 2) return -1;
      const target = row.best === 'max' ? Math.max(...ok) : Math.min(...ok);
      if (ok.filter((v) => v === target).length > 1) return -1; // no single winner
      return vals.indexOf(target);
    };
    let html = `<table class="cmp-table"><thead><tr><th scope="col"><span class="sr-only">Detail</span></th>${list.map((h) => `<th scope="col">${head(h)}</th>`).join('')}</tr></thead><tbody>`;
    rows.forEach((row) => {
      const bi = bestIdx(row);
      html += `<tr><th scope="row">${row.k}</th>${list.map((h, i) => `<td class="${i === bi ? 'best' : ''}">${row.html ? row.v(h) : esc(row.v(h))}</td>`).join('')}</tr>`;
    });
    html += '</tbody></table>';
    $('#cmpScroll').innerHTML = html;
    $$('[data-remove]').forEach((b) => b.addEventListener('click', () => toggle(b.dataset.remove)));
  }

  document.addEventListener('DOMContentLoaded', () => {
    renderPick();
    renderTable();
    $('#cmpShare').addEventListener('click', () => {
      const link = location.origin + location.pathname + '?ids=' + selected.map(encodeURIComponent).join(',');
      MZ.copy(link, 'Compare link');
    });
  });
})();
