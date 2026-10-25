/* Shared behaviour for every HomeView page:
   full-screen menu, header, scroll motion, swipe sliders and carousels, lightbox, toasts,
   the enquiry relay, and the on-device analytics tracker (feature 10). */
(function () {
  'use strict';

  const MZ = window.MZ = window.MZ || {};

  // ---------- small helpers ----------
  MZ.$ = (sel, root) => (root || document).querySelector(sel);
  MZ.$$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));
  MZ.esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  MZ.fmtInt = (n) => Number(n || 0).toLocaleString('en-NZ');
  MZ.clamp = (v, a, b) => Math.min(b, Math.max(a, v));

  // localStorage can throw (private mode, blocked storage); never let that break a page.
  MZ.store = {
    get(key, fallback) {
      try { const v = localStorage.getItem(key); return v == null ? fallback : JSON.parse(v); } catch (e) { return fallback; }
    },
    set(key, value) {
      try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch (e) { return false; }
    },
    remove(key) { try { localStorage.removeItem(key); } catch (e) { /* ignore */ } }
  };

  // ---------- toast ----------
  let toastEl, toastTimer;
  MZ.toast = function (msg) {
    if (!toastEl) {
      toastEl = document.createElement('div');
      toastEl.className = 'toast';
      toastEl.setAttribute('role', 'status');
      toastEl.setAttribute('aria-live', 'polite');
      document.body.appendChild(toastEl);
    }
    toastEl.textContent = msg;
    toastEl.classList.add('on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove('on'), 2600);
  };

  MZ.copy = async function (text, label) {
    try {
      await navigator.clipboard.writeText(text);
      MZ.toast((label || 'Text') + ' copied');
    } catch (e) {
      const ta = document.createElement('textarea');
      ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); MZ.toast((label || 'Text') + ' copied'); } catch (err) { MZ.toast('Copy failed, select the text instead'); }
      ta.remove();
    }
  };

  MZ.download = function (blobOrUrl, filename) {
    const url = typeof blobOrUrl === 'string' ? blobOrUrl : URL.createObjectURL(blobOrUrl);
    const a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    if (typeof blobOrUrl !== 'string') setTimeout(() => URL.revokeObjectURL(url), 4000);
  };

  // ---------- features menu (header dropdown) ----------
  // One list, used by the header dropdown on every page.
  MZ.featureGroups = [
    { t: 'Show the home', items: [
      { t: '3D house tour', d: 'Walk every room, jump between them', href: 'listing.html#tour' },
      { t: 'Interactive floor plan', d: 'Room sizes and a tape measure', href: 'listing.html#plan' },
      { t: 'Compare homes', d: 'Side by side on size and features', href: 'compare.html' },
      { t: 'Viewing scheduler', d: 'Buyers book a time online', href: 'listing.html#book' }
    ] },
    { t: 'AI finishing', items: [
      { t: 'Photo enhancement', d: 'Light, colour and sharpness', href: 'studio.html#photo' },
      { t: 'Day to dusk', d: 'Twilight hero shot, labelled', href: 'studio.html#dusk' },
      { t: 'Privacy protection', d: 'Blur faces, photos, plates', href: 'studio.html#privacy' },
      { t: 'Edit transparency', d: 'Every change logged', href: 'studio.html#photo' }
    ] },
    { t: 'Market it', items: [
      { t: 'Marketing pack', d: 'Posts, story, video, brochure', href: 'studio.html#marketing' },
      { t: 'One-click listing page', d: 'Branded page and portal copy', href: 'studio.html#publish' }
    ] },
    { t: 'Track it', items: [
      { t: 'Buyer analytics', d: 'Views, rooms, enquiries', href: 'studio.html#analytics' },
      { t: 'Portfolio dashboard', d: 'Every listing in one place', href: 'studio.html#portfolio' }
    ] }
  ];
  function initMenus() {
    MZ.$$('[data-menu="features"]').forEach((panel) => {
      const homes = (MZ.data && MZ.data.homes) || [];
      panel.innerHTML = MZ.featureGroups.map((g) => `<div class="dd-col"><h6>${MZ.esc(g.t)}</h6>${g.items.map((it) =>
        `<a href="${it.href}"><b>${MZ.esc(it.t)}</b><small>${MZ.esc(it.d)}</small></a>`).join('')}</div>`).join('') +
        (homes.length ? `<div class="dd-col dd-homes"><h6>Sample homes</h6>${homes.map((h) =>
          `<a href="listing.html?home=${h.id}"><span class="dd-th" style="background-image:url('${h.photos[0].src.replace('.jpg', '-t.jpg')}')"></span><b>${MZ.esc(h.short)}</b><small>${MZ.esc(h.suburb)} · 3D tour</small></a>`).join('')}</div>` : '');
    });
    const fh = MZ.$('#footHomes');
    if (fh && MZ.data) fh.innerHTML = MZ.data.homes.map((h) => `<li><a href="listing.html?home=${h.id}">${MZ.esc(h.short)}</a></li>`).join('');
    const cl = MZ.$('#creditList');
    if (cl && MZ.data && MZ.data.credits) {
      cl.innerHTML = MZ.data.credits.map((c) => `<li><b>${MZ.esc(c.what)}:</b> <a href="${c.url}" target="_blank" rel="noopener">“${MZ.esc(c.title)}”</a> by ${MZ.esc(c.author)}, <a href="${c.licenseUrl}" target="_blank" rel="noopener">${MZ.esc(c.license)}</a>. ${MZ.esc(c.changes)}</li>`).join('');
    }
    MZ.$$('.dd').forEach((dd) => {
      const btn = MZ.$('.dd-btn', dd);
      if (!btn) return;
      const set = (open) => { dd.classList.toggle('open', open); btn.setAttribute('aria-expanded', String(open)); };
      btn.addEventListener('click', (e) => { e.preventDefault(); set(!dd.classList.contains('open')); });
      // hover opens on desktop pointers; keyboard and touch use the click
      if (window.matchMedia('(hover: hover) and (min-width: 1181px)').matches) {
        let t;
        dd.addEventListener('mouseenter', () => { clearTimeout(t); set(true); });
        dd.addEventListener('mouseleave', () => { t = setTimeout(() => set(false), 160); });
      }
      document.addEventListener('click', (e) => { if (!dd.contains(e.target)) set(false); });
      dd.addEventListener('keydown', (e) => { if (e.key === 'Escape') { set(false); btn.focus(); } });
      dd.addEventListener('click', (e) => { if (e.target.closest('.dd-panel a')) set(false); });
    });
  }

  // ---------- full-screen menu ----------
  // Same menu on every page, built here so the pages only carry the button.
  const MENU_LINKS = [
    ['index.html#work', 'See the difference'],
    ['index.html#how', 'How it works'],
    ['index.html#included', 'What you get'],
    ['listing.html', 'Sample listing'],
    ['compare.html', 'Compare homes'],
    ['studio.html', 'Agent studio'],
    ['index.html#quote', 'Book a free chat']
  ];
  function initMenu() {
    const btn = MZ.$('#menuBtn');
    if (!btn) return;
    const homes = (MZ.data && MZ.data.homes) || [];
    const feats = MZ.featureGroups.flatMap((g) => g.items).slice(0, 6);
    const menu = document.createElement('div');
    menu.className = 'fsm';
    menu.id = 'fsm';
    menu.setAttribute('role', 'dialog');
    menu.setAttribute('aria-modal', 'true');
    menu.setAttribute('aria-label', 'Menu');
    menu.innerHTML = `<div class="fsm-in">
      <ul class="fsm-links">${MENU_LINKS.map(([href, t], i) =>
        `<li><a href="${href}" style="--i:${i}"><small>${String(i + 1).padStart(2, '0')}</small>${MZ.esc(t)}</a></li>`).join('')}</ul>
      <div class="fsm-media"><img src="assets/img/homes/villa/exterior.jpg" alt="" loading="lazy"><span class="badge">Sample home</span></div>
      <div class="fsm-foot">
        <div><h6>Features</h6><ul>${feats.map((f) => `<li><a href="${f.href}">${MZ.esc(f.t)}</a></li>`).join('')}</ul></div>
        ${homes.length ? `<div><h6>Sample homes</h6><ul>${homes.map((h) => `<li><a href="listing.html?home=${h.id}">${MZ.esc(h.short)}</a></li>`).join('')}</ul></div>` : ''}
      </div>
    </div>`;
    document.body.appendChild(menu);

    const set = (open) => {
      document.body.classList.toggle('menu-open', open);
      btn.setAttribute('aria-expanded', String(open));
      btn.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
      if (open) setTimeout(() => { const a = MZ.$('.fsm-links a', menu); if (a) a.focus({ preventScroll: true }); }, 450);
      MZ.onHeader && MZ.onHeader();
    };
    btn.addEventListener('click', () => set(!document.body.classList.contains('menu-open')));
    menu.addEventListener('click', (e) => { if (e.target.closest('a')) set(false); });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && document.body.classList.contains('menu-open')) { set(false); btn.focus(); }
    });
  }

  // ---------- header over the hero, sticky bar on phones ----------
  // On the home page the header is see-through over the full-screen photo and
  // turns solid cream once the hero has scrolled away.
  function initHeader() {
    const header = MZ.$('header.site');
    const hero = MZ.$('.hero');
    const bar = MZ.$('.stickybar');
    if (!header) return;
    let raf = 0;
    const update = () => {
      raf = 0;
      const y = window.scrollY;
      // turn solid a little before the hero ends, so its bottom edge never sits under the logo
      const heroEnd = hero ? hero.offsetTop + hero.offsetHeight - header.offsetHeight - 140 : 0;
      header.classList.toggle('over', !!hero && y < heroEnd && !document.body.classList.contains('menu-open'));
      if (bar) bar.classList.toggle('on', hero ? y > heroEnd : y > 120);
    };
    MZ.onHeader = update;
    window.addEventListener('scroll', () => { if (!raf) raf = requestAnimationFrame(update); }, { passive: true });
    window.addEventListener('resize', update);
    update();
  }

  // ---------- rotating word in the hero headline ----------
  // <span class="ticker" data-words="buyers|viewings|enquiries">buyers</span>
  // Holds each word 1.5s, then swings the next one up (Wilsons "Text Toggle").
  function initTicker() {
    MZ.$$('.ticker[data-words]').forEach((tk) => {
      const words = tk.dataset.words.split('|');
      if (words.length < 2 || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
      tk.setAttribute('aria-label', words.join(', '));
      tk.innerHTML = `<span class="ticker-track" aria-hidden="true">${words.concat(words[0]).map((w) => `<span>${MZ.esc(w)}</span>`).join('')}</span>`;
      const track = tk.firstChild;
      const items = Array.from(track.children);
      let i = 0;
      const fit = () => { tk.style.width = items[i].offsetWidth + 'px'; };
      fit();
      if (document.fonts && document.fonts.ready) document.fonts.ready.then(fit);
      window.addEventListener('resize', fit);
      setInterval(() => {
        if (document.hidden) return;
        i++;
        track.style.transition = '';
        track.style.transform = `translateY(${-i * 100 / items.length}%)`;
        fit();
        if (i === items.length - 1) {
          // the last item repeats the first; jump back once it has landed
          setTimeout(() => {
            track.style.transition = 'none';
            track.style.transform = 'translateY(0)';
            i = 0;
          }, 650);
        }
      }, 2100);
    });
  }

  // ---------- scroll motion ----------
  // Headings slide up out of a mask; .reveal blocks slide in from the bottom and
  // .reveal-left ones from the left. Only hide-then-reveal when the page is
  // visible and IntersectionObserver exists, so content never stays invisible.
  const MASK_SEL = '.hero h1, .sec-head h2, .split h2, .quote h2, .l-head h1, .studio-head h1, [data-mask]';
  function wrapMask(el) {
    if (el.querySelector('.mask-line')) return;
    const line = document.createElement('span');
    line.className = 'mask-line';
    const text = document.createElement('span');
    text.className = 'mask-text';
    while (el.firstChild) text.appendChild(el.firstChild);
    line.appendChild(text);
    el.appendChild(line);
  }
  function initReveal() {
    const masks = MZ.$$(MASK_SEL);
    const els = MZ.$$('.reveal, .reveal-left').concat(masks);
    if (!els.length || !('IntersectionObserver' in window) || document.visibilityState !== 'visible') return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    masks.forEach(wrapMask);
    document.documentElement.classList.add('reveal-on');
    const show = (el) => {
      if (el.classList.contains('in')) return;
      el.classList.add('in');
      setTimeout(() => el.classList.add('done'), 1600);
    };
    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        if (en.isIntersecting) { show(en.target); io.unobserve(en.target); }
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
    els.forEach((el) => io.observe(el));
    // Safety net: reveal anything that is already on screen but was missed.
    setTimeout(() => els.forEach((el) => { if (el.getBoundingClientRect().top < window.innerHeight) show(el); }), 2500);
  }

  // ---------- before/after swipe slider ----------
  // <div class="compare" data-compare> <img (after)> <div class="c-before"><img></div> … </div>
  MZ.initCompare = function (el, opts) {
    if (!el || el._mzCompare) return el && el._mzCompare;
    opts = opts || {};
    let pos = opts.start == null ? 50 : opts.start;
    if (!MZ.$('.c-line', el)) {
      el.insertAdjacentHTML('beforeend', '<span class="c-line"></span><span class="c-knob" aria-hidden="true">⇆</span>');
    }
    el.tabIndex = 0;
    el.setAttribute('role', 'slider');
    el.setAttribute('aria-valuemin', '0');
    el.setAttribute('aria-valuemax', '100');
    if (!el.getAttribute('aria-label')) el.setAttribute('aria-label', 'Drag to compare before and after');

    function set(p, user) {
      pos = MZ.clamp(p, 0, 100);
      el.style.setProperty('--pos', pos + '%');
      el.setAttribute('aria-valuenow', String(Math.round(pos)));
      if (user && opts.onUser) opts.onUser(pos);
    }
    function fromEvent(e) {
      const r = el.getBoundingClientRect();
      return ((e.clientX - r.left) / r.width) * 100;
    }
    let dragging = false, startX = 0, startY = 0, decided = false;
    el.addEventListener('pointerdown', (e) => {
      dragging = true; decided = e.pointerType === 'mouse';
      startX = e.clientX; startY = e.clientY;
      if (decided) { el.setPointerCapture(e.pointerId); set(fromEvent(e), true); stopIntro(); }
    });
    el.addEventListener('pointermove', (e) => {
      if (!dragging) return;
      if (!decided) {
        // touch: only take over for mostly-horizontal swipes so the page can still scroll
        const dx = Math.abs(e.clientX - startX), dy = Math.abs(e.clientY - startY);
        if (dx < 6 && dy < 6) return;
        if (dy > dx) { dragging = false; return; }
        decided = true;
        try { el.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
        stopIntro();
      }
      set(fromEvent(e), true);
    });
    const end = () => { dragging = false; };
    el.addEventListener('pointerup', (e) => { if (dragging && !decided) set(fromEvent(e), true); end(); });
    el.addEventListener('pointercancel', end);
    el.addEventListener('keydown', (e) => {
      const step = e.shiftKey ? 10 : 3;
      if (e.key === 'ArrowLeft') { set(pos - step, true); e.preventDefault(); stopIntro(); }
      if (e.key === 'ArrowRight') { set(pos + step, true); e.preventDefault(); stopIntro(); }
      if (e.key === 'Home') { set(0, true); e.preventDefault(); }
      if (e.key === 'End') { set(100, true); e.preventDefault(); }
    });

    // Intro "swipe" so people see it's interactive, once it scrolls into view.
    let introRaf = 0, introDone = false;
    function stopIntro() { introDone = true; cancelAnimationFrame(introRaf); }
    function playIntro() {
      if (introDone || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
      const keys = [[0, 50], [700, 22], [1500, 78], [2200, 50]];
      const t0 = performance.now();
      const ease = (t) => t < .5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
      (function step(now) {
        if (introDone) return;
        const t = now - t0;
        let i = 0;
        while (i < keys.length - 1 && t > keys[i + 1][0]) i++;
        if (i >= keys.length - 1) { set(keys[keys.length - 1][1]); introDone = true; return; }
        const [ta, va] = keys[i], [tb, vb] = keys[i + 1];
        set(va + (vb - va) * ease((t - ta) / (tb - ta)));
        introRaf = requestAnimationFrame(step);
      })(t0);
    }
    if (opts.intro !== false && 'IntersectionObserver' in window) {
      const io = new IntersectionObserver((en) => {
        if (en[0].isIntersecting) { io.disconnect(); setTimeout(playIntro, 300); }
      }, { threshold: 0.5 });
      io.observe(el);
    }

    set(pos);
    el._mzCompare = { set, get: () => pos, replay: () => { introDone = false; playIntro(); } };
    return el._mzCompare;
  };

  // ---------- swipe carousel with dots ----------
  MZ.initSwipe = function (track, dotsEl, onChange) {
    if (!track) return null;
    const slides = Array.from(track.children);
    let current = 0;
    if (dotsEl) {
      dotsEl.innerHTML = slides.map((_, i) => `<button type="button" aria-label="Go to slide ${i + 1}"></button>`).join('');
      MZ.$$('button', dotsEl).forEach((b, i) => b.addEventListener('click', () => go(i)));
    }
    function mark(i) {
      if (i === current && dotsEl && dotsEl.querySelector('[aria-current="true"]')) return;
      current = i;
      if (dotsEl) MZ.$$('button', dotsEl).forEach((b, j) => b.setAttribute('aria-current', String(j === i)));
      if (onChange) onChange(i);
    }
    function go(i, smooth) {
      i = MZ.clamp(i, 0, slides.length - 1);
      track.scrollTo({ left: slides[i].offsetLeft - track.offsetLeft, behavior: smooth === false ? 'auto' : 'smooth' });
      mark(i);
    }
    let t;
    track.addEventListener('scroll', () => {
      clearTimeout(t);
      t = setTimeout(() => {
        const w = track.clientWidth || 1;
        mark(Math.round(track.scrollLeft / w));
      }, 60);
    }, { passive: true });
    mark(0);
    return { go, get index() { return current; }, count: slides.length };
  };

  // ---------- picker (tabbed demo stage) ----------
  MZ.initPicker = function (picker, onSelect) {
    if (!picker) return;
    picker.setAttribute('role', 'tablist');
    const buttons = MZ.$$('button', picker);
    buttons.forEach((b) => b.setAttribute('role', 'tab'));
    function select(b) {
      buttons.forEach((x) => x.setAttribute('aria-selected', String(x === b)));
      onSelect(b.dataset.view, b);
    }
    picker.addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (b) select(b);
    });
    picker.addEventListener('keydown', (e) => {
      const i = buttons.indexOf(document.activeElement);
      if (i < 0) return;
      if (e.key === 'ArrowRight') { buttons[(i + 1) % buttons.length].focus(); e.preventDefault(); }
      if (e.key === 'ArrowLeft') { buttons[(i - 1 + buttons.length) % buttons.length].focus(); e.preventDefault(); }
    });
    return { select: (view) => { const b = buttons.find((x) => x.dataset.view === view); if (b) select(b); } };
  };

  // ---------- modal ----------
  MZ.openModal = function (html, opts) {
    opts = opts || {};
    const prevFocus = document.activeElement;
    const wrap = document.createElement('div');
    wrap.className = 'modal' + (opts.className ? ' ' + opts.className : '');
    wrap.setAttribute('role', 'dialog');
    wrap.setAttribute('aria-modal', 'true');
    if (opts.label) wrap.setAttribute('aria-label', opts.label);
    wrap.innerHTML = opts.raw ? html : `<div class="modal-card"><button class="modal-x" type="button" aria-label="Close">✕</button>${html}</div>`;
    document.body.appendChild(wrap);
    document.body.style.overflow = 'hidden';
    function close() {
      wrap.remove();
      document.body.style.overflow = '';
      document.removeEventListener('keydown', onKey);
      if (opts.onClose) opts.onClose();
      if (prevFocus && prevFocus.focus) prevFocus.focus({ preventScroll: true });
    }
    function onKey(e) {
      if (e.key === 'Escape') close();
      if (opts.onKey) opts.onKey(e);
    }
    document.addEventListener('keydown', onKey);
    wrap.addEventListener('click', (e) => {
      if (e.target === wrap || e.target.closest('.modal-x')) close();
    });
    const first = MZ.$('.modal-x', wrap) || wrap.querySelector('button, a, input');
    if (first) first.focus({ preventScroll: true });
    return { el: wrap, close };
  };

  // ---------- lightbox (swipe through photos) ----------
  MZ.lightbox = function (items, start, onView) {
    const html = `
      <button class="modal-x" type="button" aria-label="Close">✕</button>
      <div class="swipe" id="lbTrack">${items.map((it) => `
        <figure><img src="${MZ.esc(it.src)}" alt="${MZ.esc(it.alt || '')}" loading="lazy">${it.caption ? `<figcaption>${it.caption}</figcaption>` : ''}</figure>`).join('')}
      </div>
      <div class="lb-bar">
        <button class="lb-nav" type="button" data-dir="-1" aria-label="Previous photo">←</button>
        <span id="lbCount"></span>
        <button class="lb-nav" type="button" data-dir="1" aria-label="Next photo">→</button>
      </div>`;
    let sw;
    const m = MZ.openModal(html, {
      raw: true, className: 'lightbox', label: 'Photo gallery',
      onKey: (e) => {
        if (e.key === 'ArrowRight') sw.go(sw.index + 1);
        if (e.key === 'ArrowLeft') sw.go(sw.index - 1);
      }
    });
    const count = MZ.$('#lbCount', m.el);
    sw = MZ.initSwipe(MZ.$('#lbTrack', m.el), null, (i) => {
      count.textContent = (i + 1) + ' / ' + items.length;
      if (onView) onView(i);
    });
    MZ.$$('.lb-nav', m.el).forEach((b) => b.addEventListener('click', () => sw.go(sw.index + Number(b.dataset.dir))));
    requestAnimationFrame(() => sw.go(start || 0, false));
    setTimeout(() => sw.go(start || 0, false), 30);
    return m;
  };

  // ---------- enquiry relay ----------
  // Every form on the site posts to FormSubmit, which emails Mazin. The first
  // submission sends a one-time activation email; until it's activated (or if
  // the relay fails) the visitor's email app opens with the message filled in.
  const ENQUIRY_EMAIL = ['mazinabdelmonim04', 'gmail.com'].join('@');
  MZ.ENQUIRY_EMAIL = ENQUIRY_EMAIL;
  MZ.EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  MZ.isPhone = (v) => /^[+()\d\s.-]+$/.test(v) && v.replace(/\D/g, '').length >= 7;

  MZ.mailto = function (subject, lines) {
    return 'mailto:' + ENQUIRY_EMAIL + '?subject=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(lines.join('\n'));
  };

  MZ.send = async function (fields) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 15000);
    try {
      const res = await fetch('https://formsubmit.co/ajax/' + ENQUIRY_EMAIL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify(Object.assign({ _template: 'table', _captcha: 'false' }, fields)),
        signal: ctrl.signal
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || String(data.success) !== 'true') throw new Error(data.message || ('HTTP ' + res.status));
      return { ok: true };
    } catch (err) {
      console.warn('Enquiry relay failed, falling back to email:', err && err.message);
      return { ok: false, error: err };
    } finally {
      clearTimeout(timer);
    }
  };

  // Show the email fallback in a status element and open the email app.
  MZ.fallback = function (statusEl, subject, lines) {
    const href = MZ.mailto(subject, lines);
    statusEl.hidden = false;
    statusEl.className = 'formmsg bad';
    statusEl.innerHTML = "We couldn't send that automatically, so your email app should open with it ready to send. " +
      'If it doesn\'t, <a href="' + href.replace(/"/g, '&quot;') + '">open it here</a> or email ' + MZ.esc(ENQUIRY_EMAIL) + '.';
    window.location.href = href;
  };

  // ---------- on-device analytics (feature 10) ----------
  // Records how a visitor uses a listing in this browser only. A live version
  // would send the same events to an analytics service shared by all visitors.
  const AKEY = 'mz-analytics-v1';
  MZ.analytics = {
    load() { return MZ.store.get(AKEY, { listings: {} }); },
    save(d) { MZ.store.set(AKEY, d); },
    listing(d, id) {
      d.listings[id] = d.listings[id] || { views: 0, tourOpens: 0, tourSeconds: 0, rooms: {}, photos: {}, planClicks: {}, enquiries: 0, bookings: 0, shares: 0, compares: 0, firstSeen: Date.now(), events: [] };
      return d.listings[id];
    },
    track(id, type, detail) {
      const d = this.load();
      const L = this.listing(d, id);
      switch (type) {
        case 'view': L.views++; break;
        case 'tour-open': L.tourOpens++; break;
        case 'tour-time': L.tourSeconds += detail.seconds || 0; break;
        case 'room-time': L.rooms[detail.room] = (L.rooms[detail.room] || 0) + (detail.seconds || 0); break;
        case 'photo': L.photos[detail.photo] = (L.photos[detail.photo] || 0) + 1; break;
        case 'plan-click': L.planClicks[detail.room] = (L.planClicks[detail.room] || 0) + 1; break;
        case 'enquiry': L.enquiries++; break;
        case 'booking': L.bookings++; break;
        case 'share': L.shares++; break;
        case 'compare': L.compares++; break;
      }
      if (type !== 'room-time' && type !== 'tour-time') {
        L.events.unshift({ t: Date.now(), type, detail: detail || null });
        L.events = L.events.slice(0, 60);
      }
      L.lastSeen = Date.now();
      this.save(d);
    },
    reset(id) {
      const d = this.load();
      if (id) delete d.listings[id]; else d.listings = {};
      this.save(d);
    }
  };

  document.addEventListener('DOMContentLoaded', () => {
    initMenus();
    initMenu();
    initHeader();
    initTicker();
    initReveal();
    MZ.$$('[data-compare]').forEach((el) => MZ.initCompare(el));
    if (MZ.$('.stickybar')) document.body.classList.add('has-stickybar');
  });
})();
