/* Photo tools that run entirely in the browser (nothing is uploaded):
   - auto enhance + manual adjustments (feature 1)
   - an exact log of every change (feature 12)
   - privacy blur boxes (feature 11)
   These are classic image-processing steps, not generative AI: they adjust
   light and colour but never add, move or remove anything in the photo. */
(function () {
  'use strict';
  const MZ = window.MZ = window.MZ || {};
  const clamp01 = (v) => v < 0 ? 0 : v > 1 ? 1 : v;
  const lumOf = (r, g, b) => 0.2126 * r + 0.7152 * g + 0.0722 * b;

  const P = MZ.photo = {};

  P.loadImage = function (src) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.decoding = 'async';
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('Could not load image ' + src));
      img.src = src;
    });
  };

  // Draw an image (or canvas) into a new canvas no wider than maxW.
  P.toCanvas = function (img, maxW) {
    const w0 = img.naturalWidth || img.width, h0 = img.naturalHeight || img.height;
    const s = maxW && w0 > maxW ? maxW / w0 : 1;
    const c = document.createElement('canvas');
    c.width = Math.round(w0 * s); c.height = Math.round(h0 * s);
    const ctx = c.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(img, 0, 0, c.width, c.height);
    return c;
  };

  P.clone = function (canvas) {
    const c = document.createElement('canvas');
    c.width = canvas.width; c.height = canvas.height;
    c.getContext('2d', { willReadFrequently: true }).drawImage(canvas, 0, 0);
    return c;
  };

  // ---------- analysis ----------
  P.analyze = function (canvas) {
    const small = P.toCanvas(canvas, 360);
    const d = small.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, small.width, small.height).data;
    const hist = new Uint32Array(256);
    let n = 0, sr = 0, sg = 0, sb = 0, mid = 0, sumL = 0, satSum = 0;
    for (let i = 0; i < d.length; i += 4) {
      const r = d[i] / 255, g = d[i + 1] / 255, b = d[i + 2] / 255;
      const L = lumOf(r, g, b);
      hist[Math.min(255, Math.round(L * 255))]++;
      sumL += L; n++;
      const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
      satSum += mx > 0 ? (mx - mn) / mx : 0;
      if (L > 0.2 && L < 0.85) { sr += r; sg += g; sb += b; mid++; }
    }
    const pct = (p) => {
      const target = n * p; let acc = 0;
      for (let i = 0; i < 256; i++) { acc += hist[i]; if (acc >= target) return i / 255; }
      return 1;
    };
    return {
      mean: sumL / n, low: pct(0.005), high: pct(0.995), p10: pct(0.1), p90: pct(0.9),
      sat: satSum / n,
      avg: mid ? [sr / mid, sg / mid, sb / mid] : [0.5, 0.5, 0.5]
    };
  };

  // ---------- parameters ----------
  // All values are in "slider" units so the same object drives the UI and the log.
  P.neutral = () => ({ exposure: 0, contrast: 0, shadows: 0, highlights: 0, warmth: 0, tint: 0, vibrance: 0, saturation: 0, sharpen: 0, black: 0, white: 100 });

  // Tuned for property photos, which should look bright and airy: brighten
  // dull shots, only tame genuinely over-bright ones, open up shadows, hold
  // back blown windows, and correct colour casts only when they are strong.
  P.autoParams = function (canvas) {
    const s = P.analyze(canvas);
    const p = P.neutral();
    const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
    // Levels: stretch only when the histogram leaves headroom at either end.
    if (s.low > 0.02) p.black = Math.round(Math.min(6, s.low * 100 * 0.8));
    if (s.high < 0.97) p.white = Math.round(Math.max(88, s.high * 100 + 1));
    const range = (p.white - p.black) / 100;
    const m = clamp01((s.mean - p.black / 100) / (range || 1));
    // Dusk and night shots are dark on purpose (wide range, bright highlights).
    const dusk = s.mean < 0.42 && s.p90 > 0.78;
    if (m < 0.58) p.exposure = Math.round(Math.min(dusk ? 8 : 25, (0.6 - m) * 110));
    else if (m > 0.8) p.exposure = -Math.round(Math.min(15, (m - 0.75) * 120));
    if (s.p10 < 0.3) p.shadows = Math.round(Math.min(20, (0.3 - s.p10) * 90));
    if (s.p90 > 0.9) p.highlights = -Math.round(Math.min(20, (s.p90 - 0.9) * 300));
    // Colour balance: partial grey-world correction, only for a clear cast.
    const [ar, , ab] = s.avg;
    const bias = (ab - ar) / ((ar + ab) / 2 || 1); // > 0 means the photo is cool
    if (Math.abs(bias) > 0.04 && !dusk) p.warmth = Math.round(clamp(bias * 50, -8, 8));
    // Vibrance: more for flat images, none for already colourful ones.
    p.vibrance = Math.round(clamp((0.32 - s.sat) * 70 + 6, 0, 18));
    p.contrast = s.p90 - s.p10 < 0.5 ? 8 : 0;
    p.sharpen = 35;
    return p;
  };

  // Plain-language log of what a parameter set changes (feature 12).
  P.describe = function (p) {
    const out = [];
    const signed = (v, unit) => (v > 0 ? '+' : '') + v + (unit || '');
    if (p.exposure) out.push({ k: 'Brightness', v: signed(p.exposure, '%'), d: p.exposure > 0 ? 'Mid-tones lifted' : 'Mid-tones lowered' });
    if (p.black || p.white !== 100) out.push({ k: 'Levels', v: `black ${p.black}%, white ${p.white}%`, d: 'Tonal range stretched to fill the histogram' });
    if (p.contrast) out.push({ k: 'Contrast', v: signed(p.contrast), d: 'S-curve on the tones' });
    if (p.shadows) out.push({ k: 'Shadows', v: signed(p.shadows), d: 'Dark areas opened up' });
    if (p.highlights) out.push({ k: 'Highlights', v: signed(p.highlights), d: 'Bright areas held back' });
    if (p.warmth) out.push({ k: 'Colour balance', v: signed(p.warmth), d: p.warmth > 0 ? 'Slightly warmer (cast removed)' : 'Slightly cooler (cast removed)' });
    if (p.tint) out.push({ k: 'Tint', v: signed(p.tint), d: p.tint > 0 ? 'Toward magenta' : 'Toward green' });
    if (p.vibrance) out.push({ k: 'Vibrance', v: signed(p.vibrance), d: 'Muted colours made richer' });
    if (p.saturation) out.push({ k: 'Saturation', v: signed(p.saturation), d: 'All colours' });
    if (p.sharpen) out.push({ k: 'Sharpening', v: String(p.sharpen), d: 'Edge detail (unsharp mask)' });
    return out;
  };

  // ---------- apply ----------
  P.apply = function (src, p) {
    const out = P.clone(src);
    const ctx = out.getContext('2d', { willReadFrequently: true });
    const img = ctx.getImageData(0, 0, out.width, out.height);
    const d = img.data;

    // Tone curve LUT shared by all channels.
    const lut = new Float32Array(256);
    const b0 = p.black / 100, w0 = p.white / 100;
    const gamma = 1 - p.exposure / 100;           // exposure as mid-tone gamma
    const k = p.contrast / 100;
    for (let i = 0; i < 256; i++) {
      let v = clamp01((i / 255 - b0) / ((w0 - b0) || 1));
      v = Math.pow(v, Math.max(0.4, gamma));
      if (p.shadows) v = v + (p.shadows / 100) * 0.5 * (1 - v) * Math.pow(1 - v, 3);
      if (p.highlights) v = v + (p.highlights / 100) * 0.5 * v * Math.pow(v, 3);
      if (k) v = v + k * (v - 0.5) * (1 - Math.abs(2 * v - 1)) * 1.2;
      lut[i] = clamp01(v);
    }
    const wr = 1 + p.warmth / 300, wb = 1 - p.warmth / 300, tg = 1 - p.tint / 400;
    const vib = p.vibrance / 100, sat = p.saturation / 100;

    for (let i = 0; i < d.length; i += 4) {
      let r = lut[d[i]] * wr, g = lut[d[i + 1]] * tg, b = lut[d[i + 2]] * wb;
      if (vib || sat) {
        const L = lumOf(r, g, b);
        const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
        const s0 = mx > 0 ? (mx - mn) / mx : 0;
        const f = 1 + sat + vib * (1 - s0) * 1.4;
        r = L + (r - L) * f; g = L + (g - L) * f; b = L + (b - L) * f;
      }
      d[i] = clamp01(r) * 255; d[i + 1] = clamp01(g) * 255; d[i + 2] = clamp01(b) * 255;
    }
    if (p.sharpen) sharpen(d, out.width, out.height, p.sharpen / 100);
    ctx.putImageData(img, 0, 0);
    return out;
  };

  // Unsharp mask on luminance with a 3x3 box blur.
  function sharpen(d, w, h, amount) {
    const L = new Float32Array(w * h);
    for (let i = 0, j = 0; i < d.length; i += 4, j++) L[j] = lumOf(d[i], d[i + 1], d[i + 2]);
    const a = amount * 0.9;
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        const j = y * w + x;
        const blur = (L[j - w - 1] + L[j - w] + L[j - w + 1] + L[j - 1] + L[j] + L[j + 1] + L[j + w - 1] + L[j + w] + L[j + w + 1]) / 9;
        const delta = (L[j] - blur) * a;
        if (delta === 0) continue;
        const i = j * 4;
        d[i] = Math.min(255, Math.max(0, d[i] + delta));
        d[i + 1] = Math.min(255, Math.max(0, d[i + 1] + delta));
        d[i + 2] = Math.min(255, Math.max(0, d[i + 2] + delta));
      }
    }
  }


  // ---------- privacy blur (feature 11) ----------
  // Heavy blur inside a rectangle: downscale then upscale (works in every browser).
  P.blurRect = function (canvas, rect) {
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    const x = Math.max(0, Math.round(rect.x)), y = Math.max(0, Math.round(rect.y));
    const w = Math.min(canvas.width - x, Math.round(rect.w)), h = Math.min(canvas.height - y, Math.round(rect.h));
    if (w < 2 || h < 2) return;
    const scale = Math.max(4, Math.round(Math.max(w, h) / 10));
    const tiny = document.createElement('canvas');
    tiny.width = Math.max(1, Math.round(w / scale)); tiny.height = Math.max(1, Math.round(h / scale));
    const tctx = tiny.getContext('2d');
    tctx.drawImage(canvas, x, y, w, h, 0, 0, tiny.width, tiny.height);
    ctx.save();
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(tiny, 0, 0, tiny.width, tiny.height, x, y, w, h);
    ctx.restore();
  };

  P.faceDetectorAvailable = () => typeof window.FaceDetector === 'function';
  P.detectFaces = async function (canvas) {
    if (!P.faceDetectorAvailable()) return null;
    try {
      const fd = new window.FaceDetector({ fastMode: true, maxDetectedFaces: 20 });
      const faces = await fd.detect(canvas);
      return faces.map((f) => {
        const b = f.boundingBox;
        const pad = b.width * 0.25;
        return { x: b.x - pad, y: b.y - pad, w: b.width + pad * 2, h: b.height + pad * 2, kind: 'Face' };
      });
    } catch (e) {
      return null;
    }
  };

  // ---------- labelling ----------
  // Burn a small, readable label into the corner of an exported image.
  P.label = function (canvas, text) {
    const ctx = canvas.getContext('2d');
    const fs = Math.max(14, Math.round(canvas.width / 70));
    ctx.save();
    ctx.font = `600 ${fs}px "Satoshi", "Helvetica Neue", Arial, sans-serif`;
    const pad = fs * 0.7;
    const tw = ctx.measureText(text).width;
    const bw = tw + pad * 2, bh = fs + pad * 1.2;
    const x = canvas.width - bw - fs, y = canvas.height - bh - fs;
    ctx.fillStyle = 'rgba(0,0,0,0.72)';
    roundRect(ctx, x, y, bw, bh, bh / 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(217,184,113,0.85)';
    ctx.lineWidth = Math.max(1, fs / 12);
    ctx.stroke();
    ctx.fillStyle = '#d9b871';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, x + pad, y + bh / 2 + 1);
    ctx.restore();
    return canvas;
  };

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }
  P.roundRect = roundRect;

  P.toBlob = function (canvas, type, q) {
    return new Promise((res) => canvas.toBlob(res, type || 'image/jpeg', q || 0.9));
  };
})();
