/* Photo tools that run entirely in the browser (nothing is uploaded):
   - auto enhance + manual adjustments (feature 1)
   - an exact log of every change (feature 12)
   - simulated dusk / twilight (feature 13)
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

  // ---------- simulated dusk (feature 13) ----------
  // A twilight version of a daytime exterior, built in five passes:
  //  1. sky mask: sky-like pixels grown from the top edge (region growing),
  //     so trees and roofs keep crisp silhouettes;
  //  2. a layered sunset sky (indigo overhead, violet, then amber at the
  //     horizon) that keeps the original clouds, lit pink from below;
  //  3. the house and garden graded for evening: about 1.5 stops darker,
  //     cool shadows, quieter greens;
  //  4. warm interior light in the windows (marked by hand for the samples,
  //     or drawn by the agent in the studio) with light spilling onto the
  //     walls and ground nearby, plus optional porch lights;
  //  5. a soft bloom and vignette.
  // It never moves or adds objects, and every export is labelled.
  // opts: strength 0..1, glow 0..1 (window light), sky 0..1 (sunset warmth),
  //       windows: [[[x,y],...], ...] polygons in 0..1 image coordinates,
  //       lights: [{ x, y, r }] porch lights in 0..1 coordinates (r = radius share of width).
  P.dusk = function (src, opts) {
    opts = Object.assign({ strength: 1, glow: 0.8, sky: 0.8, windows: null, lights: null }, opts);
    const out = P.clone(src);
    const w = out.width, h = out.height, N = w * h;
    const ctx = out.getContext('2d', { willReadFrequently: true });
    const img = ctx.getImageData(0, 0, w, h);
    const d = img.data;
    const st = opts.strength;

    // ---- 1. sky mask ----
    const L = new Float32Array(N), skyish = new Uint8Array(N);
    for (let j = 0, i = 0; j < N; j++, i += 4) {
      const r = d[i] / 255, g = d[i + 1] / 255, b = d[i + 2] / 255;
      const l = lumOf(r, g, b);
      L[j] = l;
      const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
      const blue = b - Math.max(r * 0.95, g * 0.9);
      // blue sky, or white/grey cloud and overcast (bright, low saturation)
      skyish[j] = (l > 0.38 && blue > 0.015 && b > 0.45) || (l > 0.62 && (mx - mn) < 0.16) ? 1 : 0;
    }
    // sky is smooth: reject textured surfaces (brick, render, foliage) using
    // the local gradient, averaged over a few pixels
    const grad = new Float32Array(N);
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        const j = y * w + x;
        grad[j] = Math.abs(L[j + 1] - L[j - 1]) + Math.abs(L[j + w] - L[j - w]);
      }
    }
    boxBlur(grad, w, h, Math.max(2, Math.round(w / 400)));
    const gMax = 0.06 * (1400 / Math.max(700, w));
    for (let j = 0, i = 0; j < N; j++, i += 4) {
      if (!skyish[j]) continue;
      const blue = d[i + 2] - Math.max(d[i], d[i + 1]);
      if (blue < 12 && grad[j] > gMax) skyish[j] = 0;   // white/grey and textured: a wall, not cloud
    }
    // grow from the top edge through sky-like pixels with smooth colour steps
    const mask = new Float32Array(N);
    const seen = new Uint8Array(N);
    const stack = new Int32Array(N);
    let sp = 0;
    for (let x = 0; x < w; x++) if (skyish[x]) { stack[sp++] = x; seen[x] = 1; }
    const tol = 0.06, maxY = Math.round(h * 0.82);
    while (sp > 0) {
      const j = stack[--sp];
      mask[j] = 1;
      const x = j % w, y = (j / w) | 0;
      const l0 = L[j];
      // 4-neighbours
      if (x > 0) tryPush(j - 1);
      if (x < w - 1) tryPush(j + 1);
      if (y > 0) tryPush(j - w);
      if (y < maxY) tryPush(j + w);
      function tryPush(k) {
        if (seen[k] || !skyish[k]) return;
        if (Math.abs(L[k] - l0) > tol) return;
        seen[k] = 1; stack[sp++] = k;
      }
    }
    // Clouds and gaps the growth skipped: anything above the horizon that
    // can't be reached from the bottom edge without crossing sky is
    // enclosed by sky, so it is sky too (cloud islands, birds, haze).
    {
      const reach = new Uint8Array(N);
      sp = 0;
      for (let x = 0; x < w; x++) { const j = (h - 1) * w + x; if (!mask[j]) { reach[j] = 1; stack[sp++] = j; } }
      while (sp > 0) {
        const j = stack[--sp];
        const x = j % w, y = (j / w) | 0;
        const nb = [x > 0 ? j - 1 : -1, x < w - 1 ? j + 1 : -1, y > 0 ? j - w : -1, y < h - 1 ? j + w : -1];
        for (let q = 0; q < 4; q++) {
          const k = nb[q];
          if (k >= 0 && !reach[k] && !mask[k]) { reach[k] = 1; stack[sp++] = k; }
        }
      }
      for (let j = 0; j < N; j++) if (!reach[j]) mask[j] = 1;
    }
    // sky seen through foliage: sky-coloured pixels mostly surrounded by sky
    const soft = Float32Array.from(mask);
    boxBlur(soft, w, h, Math.max(2, Math.round(w / 320)));
    for (let j = 0; j < N; j++) if (!mask[j] && skyish[j] && soft[j] > 0.5) mask[j] = 1;
    // grow ~1.5 px over the bright fringe where old sky bleeds into edges, then feather
    const grow = Float32Array.from(mask);
    boxBlur(grow, w, h, 1);
    for (let j = 0; j < N; j++) mask[j] = grow[j] > 0.2 ? 1 : 0;
    boxBlur(mask, w, h, 1);

    // horizon: where the sky ends, smoothed (used to place the warm band)
    let hz = 0, hzn = 0;
    for (let x = 0; x < w; x += 2) {
      let last = -1;
      for (let y = 0; y < h; y++) if (mask[y * w + x] > 0.5) last = y;
      if (last > 0) { hz += last; hzn++; }
    }
    const horizon = hzn ? Math.max(h * 0.18, hz / hzn) : h * 0.4;
    // the sun has just set slightly off-centre, behind the subject
    const sunX = w * 0.62, sunY = horizon * 1.08;

    // ---- 4a. window light mask ----
    const win = new Float32Array(N);
    if (opts.windows && opts.windows.length) {
      const mc = document.createElement('canvas');
      mc.width = w; mc.height = h;
      const m = mc.getContext('2d', { willReadFrequently: true });
      m.fillStyle = '#fff';
      opts.windows.forEach((poly) => {
        m.beginPath();
        poly.forEach(([px, py], k) => k ? m.lineTo(px * w, py * h) : m.moveTo(px * w, py * h));
        m.closePath(); m.fill();
      });
      const md = m.getImageData(0, 0, w, h).data;
      for (let j = 0; j < N; j++) win[j] = md[j * 4] / 255;
    }
    // glass glows, bright frames and mullions stay mostly frame-coloured
    const glass = new Float32Array(N);
    for (let j = 0; j < N; j++) if (win[j] > 0) glass[j] = win[j] * (1 - 0.65 * smooth(0.72, 0.95, L[j]));
    // light spill: a wide blur of the glowing glass, biased downward
    const spill = Float32Array.from(glass);
    const sr = Math.max(6, Math.round(w / 45));
    boxBlur(spill, w, h, sr); boxBlur(spill, w, h, sr); boxBlur(spill, w, h, Math.round(sr * 1.6));
    let smax = 1e-6;
    for (let j = 0; j < N; j++) if (spill[j] > smax) smax = spill[j];
    for (let j = 0; j < N; j++) spill[j] = Math.min(1, spill[j] / smax * 1.4);

    const lights = (opts.lights || []).map((p) => ({ x: p.x * w, y: p.y * h, r: (p.r || 0.05) * w }));

    // ---- 2 + 3 + 4. compose ----
    const warmSky = opts.sky;
    for (let y = 0; y < h; y++) {
      const ty = Math.min(1, y / horizon);                 // 0 at top, 1 at horizon
      // sky gradient stops: indigo -> violet -> rose -> amber
      const g1 = smooth(0.0, 0.6, ty), g2 = smooth(0.55, 0.9, ty), g3 = smooth(0.82, 1.05, ty);
      let skR = lerp(0.05, 0.16, g1), skG = lerp(0.09, 0.24, g1), skB = lerp(0.26, 0.52, g1);
      skR = lerp(skR, lerp(0.42, 0.62, warmSky), g2); skG = lerp(skG, lerp(0.38, 0.40, warmSky), g2); skB = lerp(skB, lerp(0.62, 0.55, warmSky), g2);
      skR = lerp(skR, 0.98, g3 * warmSky); skG = lerp(skG, 0.66, g3 * warmSky); skB = lerp(skB, 0.42, g3 * warmSky);
      for (let x = 0; x < w; x++) {
        const j = y * w + x, i = j * 4;
        const r0 = d[i] / 255, g0 = d[i + 1] / 255, b0 = d[i + 2] / 255;
        const l = L[j];

        // sky with lit clouds: cloud = how white/grey the original sky was
        const cloud = clamp01((l - 0.55) * 2.2) * clamp01(1 - (b0 - Math.max(r0, g0)) * 6);
        const sun = Math.exp(-(((x - sunX) / (w * 0.42)) ** 2 + ((y - sunY) / (horizon * 0.65)) ** 2));
        let sR = skR + sun * 0.30 * warmSky, sG = skG + sun * 0.17 * warmSky, sB = skB + sun * 0.04;
        // clouds catch the last light: pink-orange underside, darker tops
        const cR = lerp(0.42, 1.0, ty) * (0.75 + 0.35 * warmSky), cG = lerp(0.30, 0.62, ty), cB = lerp(0.42, 0.55, 1 - ty);
        const cl = cloud * 0.85;
        sR = lerp(sR, cR * (0.6 + l * 0.5), cl); sG = lerp(sG, cG * (0.6 + l * 0.5), cl); sB = lerp(sB, cB * (0.6 + l * 0.5), cl);

        // evening grade for everything else
        const lin = (v) => v * v;                          // rough gamma-to-linear
        let fr = lin(r0), fg = lin(g0), fb = lin(b0);
        const sat = Math.max(r0, g0, b0) - Math.min(r0, g0, b0);
        const green = g0 > r0 && g0 > b0 ? sat : 0;       // foliage and lawn
        const ex = 0.36;                                   // about -1.5 stops
        fr *= ex * 0.88; fg *= ex * (0.92 - green * 0.25); fb *= ex * 1.18;
        // sky light fills the shadows with blue, the horizon adds a faint warm rim
        fr += 0.004 + 0.010 * warmSky * (1 - ty); fg += 0.006; fb += 0.020;
        let Rr = Math.sqrt(fr), Gg = Math.sqrt(fg), Bb = Math.sqrt(fb);

        // window glow: warm interior light, brighter near the bottom of each pane
        const gl = glass[j] * opts.glow;
        if (gl > 0) {
          const lamp = 0.55 + 0.75 * l;
          Rr = lerp(Rr, 1.00 * lamp, gl * 0.92); Gg = lerp(Gg, 0.74 * lamp, gl * 0.92); Bb = lerp(Bb, 0.42 * lamp, gl * 0.92);
        }
        // spill onto nearby walls and ground (additive, scaled by surface brightness)
        const spv = spill[j] * opts.glow * (1 - glass[j]) * (0.35 + l * 0.9);
        if (spv > 0) { Rr += spv * 0.36; Gg += spv * 0.22; Bb += spv * 0.08; }
        // porch lights
        for (let k = 0; k < lights.length; k++) {
          const p = lights[k];
          const q = ((x - p.x) ** 2 + (y - p.y) ** 2) / (p.r * p.r);
          if (q < 9) {
            const e = Math.exp(-q) * opts.glow;
            Rr += e * 0.85; Gg += e * 0.58; Bb += e * 0.26;
          }
        }

        const m = mask[j];
        const R = lerp(Rr, sR, m), G = lerp(Gg, sG, m), B = lerp(Bb, sB, m);
        d[i] = clamp01(lerp(r0, R, st)) * 255;
        d[i + 1] = clamp01(lerp(g0, G, st)) * 255;
        d[i + 2] = clamp01(lerp(b0, B, st)) * 255;
      }
    }
    ctx.putImageData(img, 0, 0);

    // ---- 5. bloom on the warm lights + vignette ----
    if (opts.glow > 0 && (opts.windows || lights.length)) {
      const bc = document.createElement('canvas');
      const bw = Math.max(1, Math.round(w / 4)), bh = Math.max(1, Math.round(h / 4));
      bc.width = bw; bc.height = bh;
      const b = bc.getContext('2d', { willReadFrequently: true });
      b.drawImage(out, 0, 0, bw, bh);
      const bd = b.getImageData(0, 0, bw, bh);
      for (let i = 0; i < bd.data.length; i += 4) {
        const r = bd.data[i], g = bd.data[i + 1], bl = bd.data[i + 2];
        const hot = r > 200 && r - bl > 60 ? 1 : 0;   // warm highlights only
        bd.data[i] *= hot; bd.data[i + 1] *= hot; bd.data[i + 2] *= hot;
      }
      b.putImageData(bd, 0, 0);
      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      ctx.globalAlpha = 0.55 * opts.glow * st;
      ctx.filter = `blur(${Math.max(4, Math.round(w / 90))}px)`;
      ctx.drawImage(bc, 0, 0, w, h);
      ctx.restore();
    }
    const vg = ctx.createRadialGradient(w / 2, h * 0.55, Math.min(w, h) * 0.35, w / 2, h * 0.55, Math.max(w, h) * 0.8);
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(1, `rgba(4,4,18,${0.38 * st})`);
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, w, h);

    let skyShare = 0, winShare = 0;
    for (let j = 0; j < N; j += 7) { skyShare += mask[j]; winShare += glass[j]; }
    skyShare /= N / 7; winShare /= N / 7;
    return {
      canvas: out,
      skyShare,
      changes: [
        { k: 'Sky', v: skyShare > 0.02 ? Math.round(skyShare * 100) + '% of frame' : 'none found', d: skyShare > 0.02 ? 'Replaced with a sunset sky; original clouds kept and relit' : 'No open sky found at the top of the photo' },
        { k: 'Exposure', v: '−1.5 stops (approx.)', d: 'Scene darkened for evening light' },
        { k: 'White balance', v: 'cooler', d: 'Blue evening shadows, quieter greens' },
        { k: 'Window light', v: winShare > 0.001 ? Math.round(opts.glow * 100) + '%' : 'none marked', d: winShare > 0.001 ? 'Warm light added inside marked windows, with spill nearby' : 'Mark windows to add interior light' },
        { k: 'Porch lights', v: lights.length ? String(lights.length) : 'none', d: lights.length ? 'Soft warm glow at marked lights' : 'No lights marked' },
        { k: 'Vignette', v: 'light', d: 'Edges darkened' }
      ]
    };
  };

  function smooth(a, b, v) { const t = clamp01((v - a) / (b - a)); return t * t * (3 - 2 * t); }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function boxBlur(a, w, h, r) {
    const tmp = new Float32Array(a.length);
    for (let y = 0; y < h; y++) {
      let acc = 0, row = y * w;
      for (let x = -r; x <= r; x++) acc += a[row + Math.min(w - 1, Math.max(0, x))];
      for (let x = 0; x < w; x++) {
        tmp[row + x] = acc / (2 * r + 1);
        acc += a[row + Math.min(w - 1, x + r + 1)] - a[row + Math.max(0, x - r)];
      }
    }
    for (let x = 0; x < w; x++) {
      let acc = 0;
      for (let y = -r; y <= r; y++) acc += tmp[Math.min(h - 1, Math.max(0, y)) * w + x];
      for (let y = 0; y < h; y++) {
        a[y * w + x] = acc / (2 * r + 1);
        acc += tmp[Math.min(h - 1, y + r + 1) * w + x] - tmp[Math.max(0, y - r) * w + x];
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
    ctx.strokeStyle = 'rgba(194,155,69,0.85)';
    ctx.lineWidth = Math.max(1, fs / 12);
    ctx.stroke();
    ctx.fillStyle = '#c29b45';
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
