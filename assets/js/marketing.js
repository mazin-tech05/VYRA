/* Marketing pack (feature 5): everything is drawn in the browser from the
   listing's own photos and details, in HomeView's cream-and-gold style. */
(function () {
  'use strict';
  const MZ = window.MZ = window.MZ || {};
  const GOLD = '#d4b264', INK = '#1f1b16', DIM = '#e6dfd2', FONT = '"Satoshi", "Helvetica Neue", Arial, sans-serif';
  const M = MZ.mk = {};

  M.fontsReady = async function () {
    try { await Promise.all([document.fonts.load(`600 40px ${FONT}`), document.fonts.load(`500 40px ${FONT}`), document.fonts.load(`400 40px ${FONT}`)]); } catch (e) { /* fall back to system fonts */ }
  };

  M.listingUrl = function (L) {
    const base = location.origin + location.pathname.replace(/[^/]*$/, '');
    return MZ.data.isSample(L.id) ? base + 'listing.html?home=' + L.id : base + 'listing.html?id=' + encodeURIComponent(L.id);
  };

  M.facts = function (L) {
    const f = [];
    if (L.beds) f.push(L.beds + ' bed');
    if (L.baths) f.push(L.baths + ' bath');
    if (L.garage) f.push(L.garage + ' parking');
    if (L.land) f.push(L.land + ' m² land');
    else if (L.floor) f.push(L.floor + ' m²');
    return f;
  };

  // ---------- drawing helpers ----------
  function cover(ctx, img, x, y, w, h, zoom, panX, panY) {
    zoom = zoom || 1; panX = panX || 0; panY = panY || 0;
    const iw = img.naturalWidth || img.width, ih = img.naturalHeight || img.height;
    const s = Math.max(w / iw, h / ih) * zoom;
    const dw = iw * s, dh = ih * s;
    const dx = x + (w - dw) / 2 + panX * (dw - w) / 2;
    const dy = y + (h - dh) / 2 + panY * (dh - h) / 2;
    ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
    ctx.drawImage(img, dx, dy, dw, dh);
    ctx.restore();
  }
  function wrap(ctx, text, maxW, maxLines) {
    const words = String(text).split(/\s+/);
    const lines = [];
    let line = '';
    for (const w of words) {
      const test = line ? line + ' ' + w : w;
      if (ctx.measureText(test).width > maxW && line) { lines.push(line); line = w; } else line = test;
    }
    if (line) lines.push(line);
    if (lines.length > maxLines) {
      const keep = lines.slice(0, maxLines);
      let last = keep[maxLines - 1];
      while (ctx.measureText(last + '…').width > maxW && last.length) last = last.slice(0, -1);
      keep[maxLines - 1] = last + '…';
      return keep;
    }
    return lines;
  }
  function pill(ctx, text, x, y, opts) {
    opts = opts || {};
    const fs = opts.size || 28;
    ctx.font = `600 ${fs}px ${FONT}`;
    const padX = fs * 0.75, h = fs * 1.9;
    const w = ctx.measureText(text).width + padX * 2;
    const ax = opts.alignRight ? x - w : x;
    MZ.photo.roundRect(ctx, ax, y, w, h, h / 2);
    ctx.fillStyle = opts.fill || 'rgba(0,0,0,.72)';
    ctx.fill();
    if (opts.stroke) { ctx.lineWidth = 2; ctx.strokeStyle = opts.stroke; ctx.stroke(); }
    ctx.fillStyle = opts.color || '#fff';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, ax + padX, y + h / 2 + 1);
    return w;
  }
  async function brandMark() {
    if (!M._mark) M._mark = await MZ.photo.loadImage('assets/brand-mark.svg');
    return M._mark;
  }
  async function brand(ctx, x, y, size) {
    const mark = await brandMark();
    ctx.drawImage(mark, x, y, size, size);
    ctx.font = `600 ${size * 0.62}px ${FONT}`;
    ctx.fillStyle = '#fff';
    ctx.textBaseline = 'middle';
    ctx.fillText('HomeView', x + size * 1.25, y + size / 2);
    const w = ctx.measureText('HomeView').width;
    ctx.font = `600 ${size * 0.3}px ${FONT}`;
    ctx.fillStyle = GOLD;
    ctx.fillText('REAL ESTATE', x + size * 1.25 + w + size * 0.35, y + size / 2 + 1);
  }

  // ---------- square post 1080x1080 ----------
  M.square = async function (L, img) {
    await M.fontsReady();
    const c = document.createElement('canvas'); c.width = 1080; c.height = 1080;
    const ctx = c.getContext('2d');
    cover(ctx, img, 0, 0, 1080, 1080, 1.02);
    const g = ctx.createLinearGradient(0, 380, 0, 1080);
    g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(.55, 'rgba(0,0,0,.72)'); g.addColorStop(1, 'rgba(0,0,0,.92)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, 1080, 1080);
    const tg = ctx.createLinearGradient(0, 0, 0, 220);
    tg.addColorStop(0, 'rgba(0,0,0,.55)'); tg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = tg; ctx.fillRect(0, 0, 1080, 220);
    await brand(ctx, 64, 60, 64);
    pill(ctx, 'JUST LISTED', 1016, 66, { alignRight: true, fill: GOLD, color: INK, size: 26 });
    ctx.font = `600 76px ${FONT}`; ctx.fillStyle = '#fff'; ctx.textBaseline = 'alphabetic';
    const lines = wrap(ctx, L.title, 940, 2);
    let y = 1080 - 300 - (lines.length - 1) * 84;
    lines.forEach((ln) => { ctx.fillText(ln, 64, y); y += 84; });
    ctx.font = `400 36px ${FONT}`; ctx.fillStyle = DIM;
    ctx.fillText(L.suburb || '', 64, y + 4);
    let x = 64;
    M.facts(L).forEach((f) => { x += pill(ctx, f, x, 920, { size: 26, stroke: 'rgba(255,255,255,.3)', fill: 'rgba(0,0,0,.4)' }) + 12; });
    ctx.font = `600 30px ${FONT}`; ctx.fillStyle = GOLD; ctx.textBaseline = 'alphabetic';
    ctx.fillText(MZ.data.isSample(L.id) ? 'Walk through it in 3D →' : 'Book a viewing →', 64, 1040);
    if (L.sample) { ctx.font = `400 20px ${FONT}`; ctx.fillStyle = 'rgba(255,255,255,.55)'; ctx.textAlign = 'right'; ctx.fillText('Sample listing · demo', 1016, 1040); ctx.textAlign = 'left'; }
    return c;
  };

  // ---------- story 1080x1920 ----------
  M.story = async function (L, img, qr) {
    await M.fontsReady();
    const c = document.createElement('canvas'); c.width = 1080; c.height = 1920;
    const ctx = c.getContext('2d');
    ctx.fillStyle = INK; ctx.fillRect(0, 0, 1080, 1920);
    cover(ctx, img, 0, 0, 1080, 1180, 1.04);
    const g = ctx.createLinearGradient(0, 760, 0, 1200);
    g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,1)');
    ctx.fillStyle = g; ctx.fillRect(0, 760, 1080, 440);
    const tg = ctx.createLinearGradient(0, 0, 0, 260);
    tg.addColorStop(0, 'rgba(0,0,0,.6)'); tg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = tg; ctx.fillRect(0, 0, 1080, 260);
    await brand(ctx, 72, 96, 72);
    ctx.font = `600 30px ${FONT}`; ctx.fillStyle = GOLD; ctx.textBaseline = 'alphabetic';
    ctx.fillText('JUST LISTED', 72, 1210);
    ctx.font = `600 84px ${FONT}`; ctx.fillStyle = '#fff';
    const lines = wrap(ctx, L.title, 936, 3);
    let y = 1310;
    lines.forEach((ln) => { ctx.fillText(ln, 72, y); y += 92; });
    ctx.font = `400 40px ${FONT}`; ctx.fillStyle = DIM;
    ctx.fillText(L.suburb || '', 72, y + 6);
    let x = 72;
    M.facts(L).forEach((f) => { x += pill(ctx, f, x, y + 50, { size: 28, stroke: 'rgba(255,255,255,.3)', fill: 'rgba(255,255,255,.04)' }) + 14; });
    // CTA card with QR
    const cy = 1600;
    MZ.photo.roundRect(ctx, 72, cy, 936, 250, 36);
    ctx.fillStyle = '#1f1b16'; ctx.fill();
    ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(212,178,100,.6)'; ctx.stroke();
    ctx.font = `600 46px ${FONT}`; ctx.fillStyle = '#fff'; ctx.textBaseline = 'alphabetic';
    ctx.fillText(MZ.data.isSample(L.id) ? 'Take the 3D tour' : 'See the listing', 120, cy + 100);
    ctx.font = `400 32px ${FONT}`; ctx.fillStyle = DIM;
    ctx.fillText('Scan the code or tap the link', 120, cy + 160);
    if (qr) {
      MZ.photo.roundRect(ctx, 790, cy + 25, 200, 200, 18); ctx.fillStyle = '#fff'; ctx.fill();
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(qr, 805, cy + 40, 170, 170);
      ctx.imageSmoothingEnabled = true;
    }
    if (L.sample) { ctx.font = `400 24px ${FONT}`; ctx.fillStyle = 'rgba(255,255,255,.5)'; ctx.fillText('Sample listing · demo', 72, 1890); }
    return c;
  };

  // ---------- QR code (loads a small library on first use) ----------
  M.qr = async function (text, px) {
    if (!window.qrcode) {
      await new Promise((res, rej) => {
        const s = document.createElement('script');
        s.src = 'https://cdnjs.cloudflare.com/ajax/libs/qrcode-generator/1.4.4/qrcode.min.js';
        s.onload = res; s.onerror = () => rej(new Error('QR library failed to load'));
        document.head.appendChild(s);
      });
    }
    const q = window.qrcode(0, 'M');
    q.addData(text); q.make();
    const n = q.getModuleCount(), quiet = 2, size = px || 360;
    const cell = Math.floor(size / (n + quiet * 2));
    const c = document.createElement('canvas');
    c.width = c.height = cell * (n + quiet * 2);
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height);
    ctx.fillStyle = '#000';
    for (let r = 0; r < n; r++) for (let col = 0; col < n; col++) if (q.isDark(r, col)) ctx.fillRect((col + quiet) * cell, (r + quiet) * cell, cell, cell);
    return c;
  };

  // ---------- listing video (vertical, ~15 s) ----------
  M.videoSupported = () => typeof MediaRecorder !== 'undefined' && !!HTMLCanvasElement.prototype.captureStream;
  M.video = async function (L, imgs, onProgress) {
    await M.fontsReady();
    const W = 720, H = 1280, FPS = 30;
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const ctx = c.getContext('2d');
    const mark = await brandMark();
    const types = ['video/mp4;codecs=avc1', 'video/mp4', 'video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'];
    const mime = types.find((t) => MediaRecorder.isTypeSupported(t)) || '';
    const stream = c.captureStream(FPS);
    const rec = new MediaRecorder(stream, mime ? { mimeType: mime, videoBitsPerSecond: 4e6 } : undefined);
    const chunks = [];
    rec.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data); };

    const slides = imgs.slice(0, 5);
    const facts = M.facts(L);
    const captions = [
      { k: 'JUST LISTED', t: L.title },
      { k: 'THE HOME', t: facts.slice(0, 2).join(' · ') || L.suburb },
      { k: 'THE SPACE', t: facts.slice(2).join(' · ') || 'Room to grow' },
      { k: MZ.data.isSample(L.id) ? 'WALK THROUGH IT' : 'SEE IT FOR YOURSELF', t: MZ.data.isSample(L.id) ? 'Take the 3D tour' : 'Book a viewing' },
      { k: 'LOCATION', t: L.suburb || '' }
    ];
    const per = 2.6, fade = 0.45, endCard = 2.4;
    const total = slides.length * per + endCard;

    function frame(t) {
      ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
      const i = Math.min(slides.length - 1, Math.floor(t / per));
      const local = t - i * per;
      const draw = (k, alpha, lt) => {
        if (k < 0 || k >= slides.length) return;
        ctx.globalAlpha = alpha;
        const z = 1.04 + 0.1 * (lt / per);
        cover(ctx, slides[k], 0, 0, W, H, z, (k % 2 ? 0.5 : -0.5) * (lt / per), 0);
        ctx.globalAlpha = 1;
      };
      if (t < slides.length * per) {
        draw(i, 1, local);
        if (local > per - fade && i + 1 < slides.length) draw(i + 1, (local - (per - fade)) / fade, 0);
        const g = ctx.createLinearGradient(0, H * 0.45, 0, H);
        g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,.85)');
        ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
        ctx.drawImage(mark, 40, 52, 48, 48);
        ctx.font = `600 30px ${FONT}`; ctx.fillStyle = '#fff'; ctx.textBaseline = 'middle';
        ctx.fillText('HomeView', 100, 77);
        const cap = captions[i % captions.length];
        const a = Math.min(1, local / 0.5) * Math.min(1, (per - local) / 0.4);
        ctx.globalAlpha = Math.max(0, a);
        ctx.textBaseline = 'alphabetic';
        ctx.font = `600 24px ${FONT}`; ctx.fillStyle = GOLD;
        ctx.fillText(cap.k, 40, H - 210 + (1 - a) * 20);
        ctx.font = `600 56px ${FONT}`; ctx.fillStyle = '#fff';
        wrap(ctx, cap.t, W - 80, 2).forEach((ln, k) => ctx.fillText(ln, 40, H - 140 + k * 62 + (1 - a) * 20));
        ctx.globalAlpha = 1;
      } else {
        const e = Math.min(1, (t - slides.length * per) / 0.5);
        ctx.globalAlpha = e;
        ctx.drawImage(mark, W / 2 - 60, H / 2 - 230, 120, 120);
        ctx.textAlign = 'center';
        ctx.font = `600 48px ${FONT}`; ctx.fillStyle = '#fff';
        wrap(ctx, L.title, W - 120, 2).forEach((ln, k) => ctx.fillText(ln, W / 2, H / 2 - 30 + k * 56));
        ctx.font = `400 30px ${FONT}`; ctx.fillStyle = DIM;
        ctx.fillText(L.suburb || '', W / 2, H / 2 + 110);
        MZ.photo.roundRect(ctx, W / 2 - 170, H / 2 + 170, 340, 76, 38); ctx.fillStyle = GOLD; ctx.fill();
        ctx.font = `600 30px ${FONT}`; ctx.fillStyle = '#000'; ctx.textBaseline = 'middle';
        ctx.fillText('Book a viewing', W / 2, H / 2 + 209);
        if (L.sample) { ctx.font = `400 20px ${FONT}`; ctx.fillStyle = 'rgba(255,255,255,.5)'; ctx.fillText('Sample listing · demo', W / 2, H - 60); }
        ctx.textAlign = 'left';
        ctx.globalAlpha = 1;
      }
    }

    return new Promise((resolve, reject) => {
      rec.onstop = () => resolve({ blob: new Blob(chunks, { type: mime || 'video/webm' }), ext: (mime || '').includes('mp4') ? 'mp4' : 'webm' });
      rec.onerror = (e) => reject(e.error || new Error('Recording failed'));
      frame(0);
      rec.start(250);
      const t0 = performance.now();
      (function loop() {
        const t = (performance.now() - t0) / 1000;
        frame(Math.min(t, total));
        if (onProgress) onProgress(Math.min(1, t / total));
        if (t < total) requestAnimationFrame(loop);
        else setTimeout(() => rec.stop(), 150);
      })();
    });
  };

  // ---------- listing copy ----------
  M.copy = function (L) {
    const facts = M.facts(L).join(' · ');
    const url = M.listingUrl(L);
    const tag = (L.suburb || '').split(',')[0].replace(/[^A-Za-z]/g, '');
    const has3d = MZ.data.isSample(L.id);
    const first = (L.description || [])[0] || '';
    return {
      instagram: `Just listed in ${L.suburb || 'your area'} 🏡\n${L.title}\n\n${facts}\n\n${has3d ? 'Walk through every room in 3D. Link in bio.' : 'Link in bio to book a viewing.'}\n\n#justlisted #nzrealestate${tag ? ' #' + tag.toLowerCase() : ''} #openhome${has3d ? ' #3dtour' : ''}`,
      facebook: `JUST LISTED: ${L.title}, ${L.suburb || ''}\n\n${first}\n\n${facts}\n${L.priceLabel ? 'Price: ' + L.priceLabel + '\n' : ''}\n${has3d ? 'Take the 3D tour and book a viewing here: ' : 'See the photos and book a viewing here: '}${url}`,
      portalTitle: (L.title.length > 60 ? L.title.slice(0, 57) + '…' : L.title),
      portalBody: (L.description || []).join('\n\n') + (L.features && L.features.length ? '\n\nFeatures: ' + L.features.join(', ') + '.' : '') + (has3d ? '\n\n3D tour: ' + url : ''),
      sms: `New listing: ${L.title} in ${L.suburb || 'your area'} (${facts}). ${has3d ? '3D tour' : 'Photos'} and viewing times: ${url}`
    };
  };

  // ---------- printable brochure ----------
  M.brochureHtml = function (L, qrDataUrl, absPhotos, markUrl) {
    const esc = MZ.esc;
    const photos = absPhotos.slice(0, 4);
    const facts = M.facts(L);
    const rooms = MZ.data.isSample(L.id) ? L.plan.rooms.filter((r) => !r.outdoor && r.area > 3 && r.name !== 'Hall') : [];
    return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><title>${esc(L.title)} brochure</title>
<link rel="stylesheet" href="https://api.fontshare.com/v2/css?f[]=satoshi@400,500,700&display=swap">
<style>
@page { size: A4; margin: 0; }
* { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: "Satoshi", "Helvetica Neue", Arial, sans-serif; color: #1f1b16; background: #fff; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
.page { width: 210mm; min-height: 297mm; padding: 14mm; position: relative; }
.top { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8mm; }
.brand { display: flex; align-items: center; gap: 3mm; font-weight: 600; font-size: 14pt; }
.brand img { width: 9mm; height: 9mm; }
.brand small { color: #7d5f17; font-size: 7pt; letter-spacing: .18em; }
.tag { background: #c29b45; color: #1f1b16; font-weight: 600; font-size: 8pt; letter-spacing: .16em; padding: 2mm 4mm; border-radius: 99px; }
.hero { width: 100%; height: 95mm; object-fit: cover; border-radius: 4mm; display: block; }
.thumbs { display: grid; grid-template-columns: repeat(3, 1fr); gap: 3mm; margin-top: 3mm; }
.thumbs img { width: 100%; height: 32mm; object-fit: cover; border-radius: 3mm; }
h1 { font-size: 24pt; font-weight: 600; letter-spacing: -.02em; margin-top: 7mm; line-height: 1.1; }
.loc { color: #555; font-size: 11pt; margin-top: 1.5mm; }
.facts { display: flex; gap: 2mm; flex-wrap: wrap; margin-top: 4mm; }
.facts span { border: .3mm solid #ccc; border-radius: 99px; padding: 1.2mm 3.5mm; font-size: 9pt; }
.cols { display: grid; grid-template-columns: 1.4fr 1fr; gap: 8mm; margin-top: 6mm; }
p { font-size: 9.5pt; line-height: 1.55; color: #333; margin-bottom: 2.5mm; }
h3 { font-size: 9pt; letter-spacing: .18em; text-transform: uppercase; color: #7d5f17; margin-bottom: 2.5mm; font-weight: 600; }
table { width: 100%; border-collapse: collapse; font-size: 8.5pt; }
td { padding: 1.3mm 0; border-bottom: .2mm solid #e6e6e6; }
td:last-child { text-align: right; color: #555; }
.qr { display: flex; gap: 4mm; align-items: center; margin-top: 5mm; padding: 4mm; border: .3mm solid #c29b45; border-radius: 4mm; }
.qr img { width: 26mm; height: 26mm; image-rendering: pixelated; }
.qr b { font-size: 11pt; display: block; }
.qr small { color: #555; font-size: 8pt; }
.foot { position: absolute; left: 14mm; right: 14mm; bottom: 10mm; display: flex; justify-content: space-between; font-size: 7.5pt; color: #777; border-top: .2mm solid #ddd; padding-top: 3mm; }
.noprint { position: fixed; right: 8mm; top: 8mm; }
.noprint button { font: inherit; background: #1f1b16; color: #fff; border: 0; border-radius: 99px; padding: 3mm 6mm; cursor: pointer; }
@media print { .noprint { display: none; } }
</style></head><body>
<div class="noprint"><button onclick="window.print()">Print or save as PDF</button></div>
<div class="page">
  <div class="top"><div class="brand"><img src="${esc(markUrl)}" alt="">HomeView</div><span class="tag">${L.sample ? 'SAMPLE LISTING' : 'FOR SALE'}</span></div>
  ${photos[0] ? `<img class="hero" src="${esc(photos[0])}" alt="">` : ''}
  <div class="thumbs">${photos.slice(1).map((p) => `<img src="${esc(p)}" alt="">`).join('')}</div>
  <h1>${esc(L.title)}</h1>
  <div class="loc">${esc(L.suburb || '')}${L.priceLabel ? ' · ' + esc(L.priceLabel) : ''}</div>
  <div class="facts">${facts.map((f) => `<span>${esc(f)}</span>`).join('')}</div>
  <div class="cols">
    <div><h3>About the home</h3>${(L.description || []).slice(0, 3).map((p) => `<p>${esc(p)}</p>`).join('')}</div>
    <div>
      ${rooms.length ? `<h3>Room sizes</h3><table>${rooms.map((r) => `<tr><td>${esc(r.name)}</td><td>${r.lshape ? r.area.toFixed(1) + ' m²' : r.w.toFixed(1) + ' × ' + r.d.toFixed(1) + ' m'}</td></tr>`).join('')}</table><p style="font-size:7pt;color:#888;margin-top:1.5mm">Approximate, from the sample 3D scan.</p>` : ''}
      ${L.features && L.features.length ? `<h3 style="margin-top:4mm">Features</h3><p>${L.features.map((f) => esc(f)).join(' · ')}</p>` : ''}
      ${qrDataUrl ? `<div class="qr"><img src="${qrDataUrl}" alt="QR code"><div><b>${MZ.data.isSample(L.id) ? 'Take the 3D tour' : 'See the listing'}</b><small>Scan with your phone camera</small></div></div>` : ''}
    </div>
  </div>
  <div class="foot"><span>HomeView (concept demo)</span><span>${L.sample ? 'Sample content for illustration only.' : esc(M.listingUrl(L))}</span></div>
</div>
<script>window.addEventListener('load', function () { setTimeout(function () { window.print(); }, 400); });<\/script>
</body></html>`;
  };
})();
