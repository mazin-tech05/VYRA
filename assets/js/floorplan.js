/* Interactive floor plan (features 3 and 7): clickable rooms with sizes,
   a live "you are here" marker for the 3D tour, a heatmap overlay for
   analytics, and a tape measure. Drawn as SVG in metres. */
(function () {
  'use strict';
  const MZ = window.MZ = window.MZ || {};
  const NS = 'http://www.w3.org/2000/svg';
  const FT = 3.28084;

  function el(tag, attrs, parent) {
    const n = document.createElementNS(NS, tag);
    for (const k in attrs) n.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(n);
    return n;
  }
  const pts = (poly) => poly.map((p) => p[0].toFixed(2) + ',' + p[1].toFixed(2)).join(' ');

  MZ.fmtLen = (m, units) => units === 'ft' ? (m * FT).toFixed(1) + ' ft' : m.toFixed(1) + ' m';
  MZ.fmtArea = (m2, units) => units === 'ft' ? Math.round(m2 * FT * FT) + ' ft²' : m2.toFixed(1) + ' m²';

  MZ.floorplan = {
    mount(host, opts) {
      opts = opts || {};
      const plan = opts.plan || MZ.data.plan;
      const rooms = plan.rooms;
      const pad = 0.5;
      const xs = rooms.flatMap((r) => r.poly.map((p) => p[0])), zs = rooms.flatMap((r) => r.poly.map((p) => p[1]));
      const vb = { x: Math.min(...xs) - pad, z: Math.min(...zs) - pad, w: Math.max(...xs) - Math.min(...xs) + pad * 2, h: Math.max(...zs) - Math.min(...zs) + pad * 2 };

      const wrap = document.createElement('div');
      wrap.className = 'fp' + (opts.compact ? ' compact' : '');
      host.innerHTML = '';
      host.appendChild(wrap);
      const svg = el('svg', { viewBox: `${vb.x} ${vb.z} ${vb.w} ${vb.h}`, role: 'group', 'aria-label': 'Floor plan of the sample 3D scan', preserveAspectRatio: 'xMidYMid meet' }, wrap);

      // optional photo-real top-down render of the scan underneath
      const b = plan.bounds;
      const img = el('image', { href: plan.image, x: b.x0, y: b.z0, width: b.x1 - b.x0, height: b.z1 - b.z0, preserveAspectRatio: 'none', opacity: '0' }, svg);
      img.style.transition = 'opacity .4s';

      const gRooms = el('g', {}, svg);
      const gHeat = el('g', {}, svg);
      const gLabels = el('g', {}, svg);
      const nodes = {};
      rooms.forEach((r) => {
        const poly = el('polygon', { points: pts(r.poly), class: 'fp-room' + (r.outdoor ? ' outdoor' : ''), tabindex: opts.interactive === false ? '-1' : '0', role: 'button', 'data-room': r.id, 'aria-label': `${r.name}, about ${r.w.toFixed(1)} by ${r.d.toFixed(1)} metres` }, gRooms);
        const title = el('title', {}, poly); title.textContent = r.name;
        const heat = el('polygon', { points: pts(r.poly), class: 'fp-heat', fill: '#c29b45', 'fill-opacity': '0' }, gHeat);
        const small = r.w < 2.6 || r.d < 1.6;
        const label = el('text', { x: r.cx, y: r.cz - (opts.compact ? 0 : 0.08), class: 'fp-label' }, gLabels);
        label.textContent = opts.compact || small ? (r.short || r.name) : r.name;
        if (small) label.setAttribute('font-size', '.32');
        let dim = null;
        if (!opts.compact && !small) {
          dim = el('text', { x: r.cx, y: r.cz + 0.42, class: 'fp-dim' }, gLabels);
          dim.textContent = r.lshape ? MZ.fmtArea(r.area) : `${r.w.toFixed(1)} × ${r.d.toFixed(1)} m`;
        }
        nodes[r.id] = { poly, heat, label, dim, room: r };
      });

      // scale bar + north-ish marker
      if (!opts.compact) {
        const g = el('g', { class: 'fp-scale' }, svg);
        const sx = vb.x + 0.4, sz = vb.z + vb.h - 0.35;
        el('line', { x1: sx, y1: sz, x2: sx + 2, y2: sz }, g);
        el('line', { x1: sx, y1: sz - 0.12, x2: sx, y2: sz + 0.12 }, g);
        el('line', { x1: sx + 2, y1: sz - 0.12, x2: sx + 2, y2: sz + 0.12 }, g);
        const t = el('text', { x: sx + 1, y: sz - 0.2, 'text-anchor': 'middle' }, g); t.textContent = '2 m';
      }

      // "you are here" marker
      const me = el('g', { class: 'fp-me', visibility: 'hidden' }, svg);
      const cone = el('path', { d: 'M0,0 L1.6,-0.75 A1.75,1.75 0 0 1 1.6,0.75 Z' }, me);
      el('circle', { class: 'ring', r: '0.28' }, me);
      el('circle', { class: 'dot', r: '0.22' }, me);

      // measure layer
      const gMeasure = el('g', { class: 'fp-measure' }, svg);

      let selected = null;
      function select(id, fire) {
        if (selected && nodes[selected]) nodes[selected].poly.classList.remove('sel');
        selected = id;
        if (id && nodes[id]) nodes[id].poly.classList.add('sel');
        if (fire && opts.onRoom && id) opts.onRoom(nodes[id].room);
      }

      // ---- measuring ----
      let measuring = false, mA = null;
      function svgPoint(e) {
        const p = svg.createSVGPoint();
        p.x = e.clientX; p.y = e.clientY;
        const q = p.matrixTransform(svg.getScreenCTM().inverse());
        return [q.x, q.y];
      }
      function drawMeasure(a, bpt) {
        gMeasure.innerHTML = '';
        if (!a) return;
        el('circle', { cx: a[0], cy: a[1], r: '0.12' }, gMeasure);
        if (!bpt) return;
        el('line', { x1: a[0], y1: a[1], x2: bpt[0], y2: bpt[1] }, gMeasure);
        el('circle', { cx: bpt[0], cy: bpt[1], r: '0.12' }, gMeasure);
        const d = Math.hypot(bpt[0] - a[0], bpt[1] - a[1]);
        const mx = (a[0] + bpt[0]) / 2, mz = (a[1] + bpt[1]) / 2;
        const txt = MZ.fmtLen(d, opts.units ? opts.units() : 'm');
        const w = 0.22 * txt.length + 0.3;
        el('rect', { x: mx - w / 2, y: mz - 0.28, width: w, height: 0.5, rx: 0.25 }, gMeasure);
        const t = el('text', { x: mx, y: mz + 0.08 }, gMeasure);
        t.textContent = txt;
        if (opts.onMeasure) opts.onMeasure(d);
      }
      svg.addEventListener('click', (e) => {
        if (measuring) {
          const p = svgPoint(e);
          if (!mA || mA.done) { mA = { p, done: false }; drawMeasure(p); if (opts.onMeasure) opts.onMeasure(null); }
          else { drawMeasure(mA.p, p); mA.done = true; }
          return;
        }
        const target = e.target.closest('[data-room]');
        if (target && opts.interactive !== false) select(target.dataset.room, true);
      });
      svg.addEventListener('pointermove', (e) => {
        if (measuring && mA && !mA.done) drawMeasure(mA.p, svgPoint(e));
      });
      svg.addEventListener('keydown', (e) => {
        const target = e.target.closest && e.target.closest('[data-room]');
        if (target && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); select(target.dataset.room, true); }
      });

      return {
        el: wrap,
        select: (id) => select(id, false),
        get selected() { return selected; },
        setMarker(x, z, yawDeg) {
          if (x == null) { me.setAttribute('visibility', 'hidden'); return; }
          const yaw = (yawDeg || 0) * Math.PI / 180;
          const dx = -Math.sin(yaw), dz = -Math.cos(yaw);
          const ang = Math.atan2(dz, dx) * 180 / Math.PI;
          me.setAttribute('visibility', 'visible');
          me.setAttribute('transform', `translate(${x.toFixed(2)} ${z.toFixed(2)})`);
          cone.setAttribute('transform', `rotate(${ang.toFixed(1)})`);
        },
        setHeat(values) {
          const max = Math.max(1e-6, ...Object.values(values || {}));
          rooms.forEach((r) => {
            const v = values && values[r.id] ? values[r.id] / max : 0;
            nodes[r.id].heat.setAttribute('fill-opacity', (v * 0.62).toFixed(3));
          });
        },
        showImage(on, opacity) { img.setAttribute('opacity', on ? String(opacity || 0.85) : '0'); wrap.classList.toggle('with-scan', !!on); },
        setMeasuring(on) {
          measuring = !!on; mA = null; drawMeasure(null);
          wrap.classList.toggle('measuring', measuring);
          if (opts.onMeasure) opts.onMeasure(null);
        },
        refreshDims(units) {
          rooms.forEach((r) => {
            const n = nodes[r.id];
            if (n.dim) n.dim.textContent = r.lshape ? MZ.fmtArea(r.area, units) : units === 'ft' ? `${(r.w * FT).toFixed(0)} × ${(r.d * FT).toFixed(0)} ft` : `${r.w.toFixed(1)} × ${r.d.toFixed(1)} m`;
          });
        }
      };
    }
  };
})();
