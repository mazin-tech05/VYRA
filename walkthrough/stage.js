// VYRA virtual staging: places CC0 furniture (glb) into the 3D scan.
// Loaded only with ?stage. The page that embeds the tour drives it through
// window.vyraStage (same origin), and hears back through 'vyra-stage' messages.
import { Entity, Vec2, Vec3, Color, BoundingBox, StandardMaterial, Texture, BLEND_NORMAL } from './index.js?v=8';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const items = [];          // { id, name, root, model, floorY, aabbLocal }
let viewer = null, app = null, camEnt = null, collision = null;
let selected = null, drag = null, shown = true, shadowMat = null;

const post = (type, data = {}) => parent.postMessage(Object.assign({ source: 'vyra-stage', type }, data), location.origin);
const redraw = () => { if (viewer) viewer.forceRenderNextFrame = true; if (app) app.renderNextFrame = true; };

// ---------- helpers ----------
function camPos() { return camEnt.getPosition(); }
function forwardFlat() {
  const f = camEnt.forward.clone(); f.y = 0;
  if (f.lengthSq() < 1e-6) f.set(0, 0, -1);
  return f.normalize();
}
function ray(ox, oy, oz, dx, dy, dz, max) {
  return collision ? collision.queryRay(ox, oy, oz, dx, dy, dz, max) : null;
}
// Floor under a point: cast straight down through the scan's collision voxels.
function floorBelow(x, y, z) {
  const hit = ray(x, y, z, 0, -1, 0, 6);
  return hit ? hit.y : y - 1.5;
}
function pointerRay(clientX, clientY) {
  const r = app.graphicsDevice.canvas.getBoundingClientRect();
  const x = clientX - r.left, y = clientY - r.top;
  const cam = camEnt.camera;
  const near = cam.screenToWorld(x, y, cam.nearClip, new Vec3());
  const far = cam.screenToWorld(x, y, cam.farClip, new Vec3());
  return { o: near, d: far.sub(near).normalize() };
}
function worldAabb(it) {
  const box = new BoundingBox(); let first = true;
  it.model.findComponents('render').forEach((rc) => rc.meshInstances.forEach((mi) => {
    if (first) { box.copy(mi.aabb); first = false; } else box.add(mi.aabb);
  }));
  return box;
}

// A soft dark ellipse under each piece so it sits on the floor instead of floating.
function getShadowMat() {
  if (shadowMat) return shadowMat;
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(64, 64, 4, 64, 64, 62);
  grad.addColorStop(0, 'rgba(0,0,0,.55)'); grad.addColorStop(.6, 'rgba(0,0,0,.25)'); grad.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grad; g.fillRect(0, 0, 128, 128);
  const tex = new Texture(app.graphicsDevice, { width: 128, height: 128, mipmaps: true });
  tex.setSource(c);
  const m = new StandardMaterial();
  m.diffuse = new Color(0, 0, 0); m.useLighting = false; m.emissive = new Color(0, 0, 0);
  m.opacityMap = tex; m.opacityMapChannel = 'a'; m.blendType = BLEND_NORMAL; m.depthWrite = false;
  srgbOut(m);
  return (shadowMat = m);
}

// The viewer renders meshes into a linear target with no gamma step at the end (the splats
// are already display colours), so furniture came out dark and contrasty. Give our own
// materials the sRGB output curve so they match the scan.
const GAMMA_GLSL = `#include "decodePS"
float gammaCorrectInput(float color) { return color; }
vec3 gammaCorrectInput(vec3 color) { return color; }
vec4 gammaCorrectInput(vec4 color) { return color; }
vec3 gammaCorrectOutput(vec3 color) { return pow(color + 0.0000001, vec3(1.0 / 2.2)); }
`;
const GAMMA_WGSL = `#include "decodePS"
fn gammaCorrectInput(color: f32) -> f32 { return color; }
fn gammaCorrectInputVec3(color: vec3f) -> vec3f { return color; }
fn gammaCorrectInputVec4(color: vec4f) -> vec4f { return color; }
fn gammaCorrectOutput(color: vec3f) -> vec3f { return pow(color + 0.0000001, vec3f(1.0 / 2.2)); }
`;
function srgbOut(m) {
  if (!m || m._vyraSrgb) return m;
  m.shaderChunks.glsl.set('gammaPS', GAMMA_GLSL);
  m.shaderChunks.wgsl.set('gammaPS', GAMMA_WGSL);
  m._vyraSrgb = true;
  m.update();
  return m;
}

// ---------- placing ----------
function loadGlb(url) {
  return new Promise((resolve, reject) => {
    app.assets.loadFromUrl(url, 'container', (err, asset) => err ? reject(err) : resolve(asset));
  });
}

async function add(item) {
  await ready;
  post('busy', { id: item.id, busy: true });
  let asset;
  try { asset = await loadGlb(item.url); }
  catch (e) { post('error', { message: 'That piece could not load. Check your connection.' }); post('busy', { id: item.id, busy: false }); return; }

  const root = new Entity('stage-' + item.id);
  const model = asset.resource.instantiateRenderEntity();
  model.findComponents('render').forEach((rc) => rc.meshInstances.forEach((mi) => srgbOut(mi.material)));
  root.addChild(model);
  app.root.addChild(root);

  // Measure at the origin, then shift the model so its base centre is the root's origin.
  const box = new BoundingBox(); let first = true;
  model.findComponents('render').forEach((rc) => rc.meshInstances.forEach((mi) => {
    if (first) { box.copy(mi.aabb); first = false; } else box.add(mi.aabb);
  }));
  const min = box.getMin(), max = box.getMax();
  model.setLocalPosition(-box.center.x, -min.y, -box.center.z);
  const size = { x: max.x - min.x, y: max.y - min.y, z: max.z - min.z };

  const shadow = new Entity('shadow');
  shadow.addComponent('render', { type: 'plane', material: getShadowMat(), castShadows: false });
  shadow.setLocalScale(size.x * 1.25 + .2, 1, size.z * 1.25 + .2);
  shadow.setLocalPosition(0, .006, 0);
  root.addChild(shadow);

  // Drop it on the floor in front of the camera, stopping short of any wall.
  const p = camPos(), f = forwardFlat();
  const want = 2.4 + Math.max(size.x, size.z) / 2;
  const wall = ray(p.x, p.y - .3, p.z, f.x, 0, f.z, want + 2);
  let dist = want;
  if (wall) dist = Math.max(.6, Math.hypot(wall.x - p.x, wall.z - p.z) - Math.max(size.x, size.z) / 2 - .15);
  // Step sideways (right, left, further right...) until it does not overlap a piece already placed.
  const rad = Math.max(size.x, size.z) / 2;
  const rx = -f.z, rz = f.x;
  let x = p.x + f.x * dist, z = p.z + f.z * dist;
  for (const k of [0, 1, -1, 2, -2, 3, -3]) {
    const cx = p.x + f.x * dist + rx * k * (rad + .5), cz = p.z + f.z * dist + rz * k * (rad + .5);
    const clash = items.some((o) => { const q = o.root.getPosition(); return Math.hypot(q.x - cx, q.z - cz) < rad + Math.max(o.size.x, o.size.z) / 2 + .1; });
    if (!clash) { x = cx; z = cz; break; }
  }
  const floorY = floorBelow(x, p.y, z);
  root.setPosition(x, floorY, z);
  // Face the camera.
  root.setEulerAngles(0, Math.atan2(p.x - x, p.z - z) * 180 / Math.PI, 0);
  root.enabled = shown;

  const it = { id: item.id, name: item.name, root, model, floorY, size, uid: Math.random().toString(36).slice(2, 8) };
  items.push(it);
  select(it);
  post('busy', { id: item.id, busy: false });
  emit();
  redraw();
}

function emit() {
  post('items', {
    items: items.map((it) => ({ uid: it.uid, id: it.id, name: it.name })), selected: selected && selected.uid, shown,
    eraseMode, removed: found.filter((f) => f.removed).length, found: found.length
  });
}
function select(it) {
  selected = it || null;
  emit();
}
function rotate(deg) {
  if (!selected) return;
  // getEulerAngles can flip x/z to 180 for some yaws; read yaw from the forward vector instead.
  const fw = selected.root.forward;
  const yaw = Math.atan2(-fw.x, -fw.z) * 180 / Math.PI;
  selected.root.setEulerAngles(0, yaw + deg, 0);
  redraw();
}
function remove(uid) {
  const it = uid ? items.find((x) => x.uid === uid) : selected;
  if (!it) return;
  it.root.destroy();
  items.splice(items.indexOf(it), 1);
  if (selected === it) selected = null;
  emit(); redraw();
}
function clear() {
  items.splice(0).forEach((it) => it.root.destroy());
  selected = null; emit(); redraw();
}
function setShown(on) {
  shown = !!on;
  items.forEach((it) => { it.root.enabled = shown; });
  if (!shown) { selected = null; eraseMode = false; }
  applyErase();
  emit(); redraw();
}

// ---------- removing the furniture that was in the scan ----------
// The scan is one cloud of splats, not separate objects, so we find furniture in the
// collision voxels: inside a room, anything that rises 10 cm to 1.35 m off the floor is a
// piece (walls are taller, rugs are flatter). Each connected patch becomes a box; splats
// inside a removed box are hidden on the GPU, and a floor patch in the sampled floor colour
// covers the gap the piece left (the floor under it was never captured).
const found = [];          // { uid, room, min:[x,y,z], max:[x,y,z], floorY, removed, patch, color }
let detected = false, eraseMode = false, patchTex = null;
const roomInfo = {};      // id -> { poly, sample: { x, z, half, y }, tex }
const SKIP_ROOMS = /kitchen|bath|ensuite|pool|hall|terrace/;

function inPoly(x, z, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, zi] = poly[i], [xj, zj] = poly[j];
    if ((zi > z) !== (zj > z) && x < (xj - xi) * (z - zi) / (zj - zi) + xi) inside = !inside;
  }
  return inside;
}
function detect(rooms) {
  if (detected || !collision) return;
  detected = true;
  const STEP = .1, WIN = 8;   // 10 cm cells; local floor from a 1.7 m window
  rooms.filter((r) => r.cam && !SKIP_ROOMS.test(r.id)).forEach((room) => {
    const [cx, cy, cz] = room.cam.position;
    const start = floorBelow(cx, cy, cz) + 1.5;
    const xs = room.poly.map((q) => q[0]), zs = room.poly.map((q) => q[1]);
    const x0 = Math.min(...xs), z0 = Math.min(...zs);
    const nx = Math.ceil((Math.max(...xs) - x0) / STEP), nz = Math.ceil((Math.max(...zs) - z0) / STEP);
    const N = nx * nz, top = new Float32Array(N).fill(NaN), tall = new Uint8Array(N);
    for (let i = 0; i < nx; i++) for (let k = 0; k < nz; k++) {
      const x = x0 + (i + .5) * STEP, z = z0 + (k + .5) * STEP;
      if (!inPoly(x, z, room.poly)) continue;
      const hit = ray(x, start, z, 0, -1, 0, 3);
      if (!hit) continue;
      if (hit.y > start - .06) tall[i * nz + k] = 1; else top[i * nz + k] = hit.y;
    }
    // The scanned floor is not flat (it drifts by 20 cm or more), so measure each cell
    // against the low end of its neighbourhood rather than one floor height.
    const floor = new Float32Array(N).fill(NaN);
    for (let i = 0; i < nx; i++) for (let k = 0; k < nz; k++) {
      const c = i * nz + k; if (isNaN(top[c])) continue;
      const vals = [];
      for (let a = Math.max(0, i - WIN); a <= Math.min(nx - 1, i + WIN); a++)
        for (let b = Math.max(0, k - WIN); b <= Math.min(nz - 1, k + WIN); b++) { const v = top[a * nz + b]; if (!isNaN(v)) vals.push(v); }
      vals.sort((u, v) => u - v);
      // 25th percentile: skips holes and the pool edge, lands on the floor even under a big sofa
      floor[c] = vals[Math.floor(vals.length * .25)];
    }
    const h = new Float32Array(N);
    for (let c = 0; c < N; c++) { const d = top[c] - floor[c]; if (d > .1 && d < 1.35) h[c] = d; }
    // A clean 1.2 m square of bare floor in this room (no furniture, no wall, no step):
    // we copy it to fill the floor that furniture hid. Prefer one near the middle.
    const W = 10, info = { poly: room.poly, squares: [] };
    for (let i = 0; i + W <= nx; i += 2) for (let k = 0; k + W <= nz; k += 2) {
      let ok = true, sum = 0, n = 0;
      for (let a = i; a < i + W && ok; a++) for (let b = k; b < k + W; b++) {
        const c = a * nz + b;
        if (isNaN(top[c]) || tall[c] || h[c] || Math.abs(top[c] - floor[c]) > .09) { ok = false; break; }
        sum += top[c]; n++;
      }
      if (!ok) continue;
      info.squares.push({ x: x0 + (i + W / 2) * STEP, z: z0 + (k + W / 2) * STEP, half: W * STEP / 2, y: sum / n });
    }
    roomInfo[room.id] = info;
    const seen = new Uint8Array(N);
    for (let s0 = 0; s0 < N; s0++) {
      if (!h[s0] || seen[s0]) continue;
      const stack = [s0]; seen[s0] = 1;
      let n = 0, hi = -1e9, lo = 1e9, i0 = 1e9, i1 = -1, k0 = 1e9, k1 = -1;
      const cells = [];
      while (stack.length) {
        const c = stack.pop(), i = Math.floor(c / nz), k = c % nz;
        n++; cells.push(c); hi = Math.max(hi, top[c]); lo = Math.min(lo, floor[c]);
        i0 = Math.min(i0, i); i1 = Math.max(i1, i); k0 = Math.min(k0, k); k1 = Math.max(k1, k);
        [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([di, dk]) => {
          const a = i + di, b = k + dk;
          if (a < 0 || b < 0 || a >= nx || b >= nz) return;
          const q = a * nz + b;
          if (h[q] && !seen[q]) { seen[q] = 1; stack.push(q); }
        });
      }
      if (n < 6) continue;   // under 0.06 m²: noise, a bin, a toy
      // Pad each side by 6 cm, but pull back 6 cm on any side that touches a wall,
      // so the wall behind a sofa or a console stays in the scan.
      const near = (side) => cells.some((c) => {
        const i = Math.floor(c / nz), k = c % nz;
        const [a, b] = side === 'x0' ? [i - 1, k] : side === 'x1' ? [i + 1, k] : side === 'z0' ? [i, k - 1] : [i, k + 1];
        if ((side[0] === 'x' && (side === 'x0' ? i !== i0 : i !== i1)) || (side[0] === 'z' && (side === 'z0' ? k !== k0 : k !== k1))) return false;
        return a >= 0 && b >= 0 && a < nx && b < nz && tall[a * nz + b];
      });
      const pad = (side) => near(side) ? -.05 : .2;
      found.push({
        uid: 'f' + found.length, room: room.id, floorY: lo, removed: false,
        min: [x0 + i0 * STEP - pad('x0'), lo - .3, z0 + k0 * STEP - pad('z0')],
        max: [x0 + (i1 + 1) * STEP + pad('x1'), Math.min(hi + .55, lo + 1.8), z0 + (k1 + 1) * STEP + pad('z1')]
      });
    }
  });
}

function boxCode(boxes) {
  if (!boxes.length) return null;
  const v = (a) => a.map((n) => n.toFixed(3)).join(', ');
  const glslIn = boxes.map((b) => `all(greaterThan(p, vec3(${v(b.min)}))) && all(lessThan(p, vec3(${v(b.max)})))`).join(' || ');
  const wgslIn = boxes.map((b) => `all(p > vec3f(${v(b.min)})) && all(p < vec3f(${v(b.max)}))`).join(' || ');
  // Around each box: the soft dark blobs a piece leaves on the floor just outside its box. Only
  // broad splats count (middle axis over 2.5 cm); grout lines and tile edges are thin, and stay.
  const ring = (b) => [[b.min[0] - .7, b.floorY - .3, b.min[2] - .7], [b.max[0] + .7, b.floorY + .7, b.max[2] + .7]];
  // ...but only splats clearly darker than that floor, so dark timber floors keep their boards
  const dark = (b) => { const c = b.color || [200, 200, 200]; return ((c[0] * .3 + c[1] * .59 + c[2] * .11) / 255 * .8).toFixed(3); };
  const glslRing = boxes.map((b) => { const [lo, hi] = ring(b); return `(l < ${dark(b)} && all(greaterThan(p, vec3(${v(lo)}))) && all(lessThan(p, vec3(${v(hi)}))))`; }).join(' || ');
  const wgslRing = boxes.map((b) => { const [lo, hi] = ring(b); return `(l < ${dark(b)} && all(p > vec3f(${v(lo)})) && all(p < vec3f(${v(hi)})))`; }).join(' || ');
  return {
    glsl: `bool vyraGone(vec3 p) { return ${glslIn}; }
float vyraBroad = 0.0;
void modifySplatCenter(inout vec3 center) {}
void modifySplatRotationScale(vec3 originalCenter, vec3 modifiedCenter, inout vec4 rotation, inout vec3 scale) { vyraBroad = scale.x + scale.y + scale.z - max(scale.x, max(scale.y, scale.z)) - min(scale.x, min(scale.y, scale.z)); ${window.__vyraDebug ? '' : 'if (vyraGone(originalCenter)) scale = vec3(0.0);'} }
bool vyraShade(vec3 p, vec4 c) { float l = dot(c.rgb, vec3(.3, .59, .11)); return vyraBroad > .025 && (${glslRing}); }
void modifySplatColor(vec3 center, inout vec4 color) { ${window.__vyraDebug ? 'if (vyraGone(center)) color = vec4(0.0, 1.0, 0.0, color.a); else if (vyraShade(center, color)) color = vec4(1.0, 0.0, 0.0, color.a);' : 'if (vyraGone(center) || vyraShade(center, color)) color.a = 0.0;'} }`,
    wgsl: `fn vyraGone(p: vec3f) -> bool { return ${wgslIn}; }
var<private> vyraBroad: f32 = 0.0;
fn modifySplatCenter(center: ptr<function, vec3f>) {}
fn modifySplatRotationScale(originalCenter: vec3f, modifiedCenter: vec3f, rotation: ptr<function, vec4f>, scale: ptr<function, vec3f>) { let q = *scale; vyraBroad = q.x + q.y + q.z - max(q.x, max(q.y, q.z)) - min(q.x, min(q.y, q.z)); if (vyraGone(originalCenter)) { *scale = vec3f(0.0); } }
fn vyraShade(p: vec3f, c: vec4f) -> bool { let l = dot(c.rgb, vec3f(.3, .59, .11)); return vyraBroad > .025 && (${wgslRing}); }
fn modifySplatColor(center: vec3f, color: ptr<function, vec4f>) { if (vyraGone(center) || vyraShade(center, *color)) { (*color).a = 0.0; } }`
  };
}
function applyErase() {
  const on = shown ? found.filter((f) => f.removed) : [];
  app.root.findComponents('gsplat').forEach((gs) => {
    gs.setWorkBufferModifier(boxCode(on));
    gs.workBufferUpdate = 1;   // WORKBUFFER_UPDATE_ONCE: rebuild with the new boxes
  });
  found.forEach((f) => { if (f.patch) f.patch.enabled = shown && f.removed; });
  redraw();
}

// Grain for the floor patch, so it reads as floor rather than flat paint.
function getPatchTex() {
  if (patchTex) return patchTex;
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d'); const img = g.createImageData(64, 64);
  for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) {
    const o = (y * 64 + x) * 4;
    const n = 238 + Math.random() * 17;
    img.data[o] = img.data[o + 1] = img.data[o + 2] = n; img.data[o + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  patchTex = new Texture(app.graphicsDevice, { width: 64, height: 64, mipmaps: true });
  patchTex.setSource(c);
  return patchTex;
}
// Read the rendered floor colour just outside each box, from the current view, all in one frame.
function sampleFloors(list) {
  return new Promise((resolve) => {
    redraw();
    app.once('frameend', () => resolve(list.map(sampleNow)));
  });
}
function sampleNow(f) {
      const gl = app.graphicsDevice.gl, canvas = app.graphicsDevice.canvas;
      const out = [];
      if (gl) {
        const sx = canvas.width / canvas.clientWidth, sy = canvas.height / canvas.clientHeight;
        const prev = gl.getParameter(gl.FRAMEBUFFER_BINDING);
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        const px = new Uint8Array(4), y = f.floorY + .01;
        const m = .3;
        const ring = [];
        for (let t = 0; t <= 1; t += .125) {
          ring.push([f.min[0] - m + (f.max[0] - f.min[0] + 2 * m) * t, f.min[2] - m], [f.min[0] - m + (f.max[0] - f.min[0] + 2 * m) * t, f.max[2] + m]);
          ring.push([f.min[0] - m, f.min[2] - m + (f.max[2] - f.min[2] + 2 * m) * t], [f.max[0] + m, f.min[2] - m + (f.max[2] - f.min[2] + 2 * m) * t]);
        }
        ring.forEach(([x, z]) => {
          const sp = camEnt.camera.worldToScreen(new Vec3(x, y, z), new Vec3());
          if (sp.z <= 0 || sp.x < 0 || sp.y < 0 || sp.x >= canvas.clientWidth || sp.y >= canvas.clientHeight) return;
          gl.readPixels(Math.floor(sp.x * sx), Math.floor(canvas.height - sp.y * sy), 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
          out.push([px[0], px[1], px[2]]);
        });
        gl.bindFramebuffer(gl.FRAMEBUFFER, prev);
      }
      if (!out.length) return [186, 178, 166];
      // median per channel: robust to the odd wall or skirting board in the ring
      const med = (k) => out.map((c) => c[k]).sort((a, b) => a - b)[out.length >> 1];
      return [med(0), med(1), med(2)];
}
function roomOf(f) {
  if (f.room && roomInfo[f.room]) return roomInfo[f.room];
  const cx = (f.min[0] + f.max[0]) / 2, cz = (f.min[2] + f.max[2]) / 2;
  return Object.values(roomInfo).find((r) => inPoly(cx, cz, r.poly)) || null;
}
// Copy real floor into a texture without moving the camera: pick a clean 1 m square of this
// room's floor that is on screen (the closest one, for the most detail), and un-project it
// texel by texel from the frame just drawn. Mirrored tiling hides the seams.
function floorFromFrame(info) {
  if (!info || !info.squares || !info.squares.length) return null;
  const gl = app.graphicsDevice.gl, canvas = app.graphicsDevice.canvas;
  if (!gl) return null;
  const cw = canvas.clientWidth, ch = canvas.clientHeight, W = canvas.width, H = canvas.height;
  const sx = W / cw, sy = H / ch, cam = camEnt.camera, v = new Vec3(), p = camPos();
  const onScreen = (q) => [[-1, -1], [1, -1], [1, 1], [-1, 1]].every(([a, b]) => {
    cam.worldToScreen(new Vec3(q.x + a * q.half, q.y, q.z + b * q.half), v);
    return v.z > .3 && v.x > 2 && v.y > 2 && v.x < cw - 2 && v.y < ch - 2;
  });
  const near = info.squares.filter((q) => Math.hypot(q.x - p.x, q.z - p.z) > 1).filter(onScreen)
    .sort((a, b) => Math.hypot(a.x - p.x, a.z - p.z) - Math.hypot(b.x - p.x, b.z - p.z)).slice(0, 12);
  if (!near.length) return null;
  const frame = new Uint8Array(W * H * 4);
  const prev = gl.getParameter(gl.FRAMEBUFFER_BINDING);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, frame);
  gl.bindFramebuffer(gl.FRAMEBUFFER, prev);
  const at = (q, a, b, n) => {   // frame pixel for texel (a, b) of an n×n copy of square q
    w.set(q.x - q.half + (a + .5) / n * 2 * q.half, q.y, q.z - q.half + (b + .5) / n * 2 * q.half);
    cam.worldToScreen(w, v);
    const px = Math.min(W - 1, Math.max(0, Math.floor(v.x * sx))), py = Math.min(H - 1, Math.max(0, H - 1 - Math.floor(v.y * sy)));
    return (py * W + px) * 4;
  };
  const w = new Vec3();
  // Of the nearby squares, take the most even one: a rug, a toy or a shadow in the square
  // shows up as spread in brightness, and would repeat across every patch.
  let sq = null, bestSpread = Infinity;
  near.forEach((q) => {
    const L = [];
    for (let b = 0; b < 24; b++) for (let a = 0; a < 24; a++) { const o = at(q, a, b, 24); L.push(frame[o] * .3 + frame[o + 1] * .59 + frame[o + 2] * .11); }
    L.sort((x, y) => x - y);
    const spread = L[Math.floor(L.length * .9)] - L[Math.floor(L.length * .1)];
    const d = Math.hypot(q.x - p.x, q.z - p.z);
    const score = spread + d * 2;   // nearer gives more detail, but evenness matters more
    if (score < bestSpread) { bestSpread = score; sq = q; }
  });
  const N = 256, c = document.createElement('canvas'); c.width = c.height = N;
  const g = c.getContext('2d'), img = g.createImageData(N, N);
  for (let b = 0; b < N; b++) for (let a = 0; a < N; a++) {
    const o = at(sq, a, b, N), t = (b * N + a) * 4;
    img.data[t] = frame[o]; img.data[t + 1] = frame[o + 1]; img.data[t + 2] = frame[o + 2]; img.data[t + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  const mean = [0, 1, 2].map((k) => { let t = 0; for (let i = k; i < img.data.length; i += 4) t += img.data[i]; return t / (N * N); });
  const tex = new Texture(app.graphicsDevice, { width: N, height: N, mipmaps: true, addressU: 2, addressV: 2 });
  tex.setSource(c);
  info.canvas = c;
  return { tex, size: sq.half * 2, mean };
}
// Plain colour, unlit, matching how the scan renders.
function flatMat(rgb, map, tiling) {
  const m = new StandardMaterial();
  m.useLighting = false; m.diffuse = new Color(0, 0, 0);
  m.emissive = new Color(rgb[0] / 255, rgb[1] / 255, rgb[2] / 255);
  if (map) { m.emissiveMap = map; if (tiling) { m.emissiveMapTiling = tiling; } }
  m.cull = 0;
  srgbOut(m);
  return m;
}
function makePatch(f, rgb, floorTex) {
  f.color = rgb;
  const w0 = f.max[0] - f.min[0] + .06, d0 = f.max[2] - f.min[2] + .06;
  if (floorTex) {
    // real floor, copied from a clean square of this room and tiled at its true size
    const sz = floorTex.size;
    // match the floor right next to this piece: light falls differently across a room
    const tint = floorTex.mean.map((mv, k) => Math.max(.8, Math.min(1.15, rgb[k] / Math.max(1, mv))) * 255);
    const m = flatMat(tint.map((t) => Math.min(255, t)), floorTex.tex, new Vec2(w0 / sz, d0 / sz));
    const e = new Entity('patch-' + f.uid);
    e.addComponent('render', { type: 'plane', material: m, castShadows: false });
    e.setLocalScale(w0, 1, d0);
    e.setPosition((f.min[0] + f.max[0]) / 2, f.floorY + .006, (f.min[2] + f.max[2]) / 2);
    app.root.addChild(e);
    f.patch = e;
    return;
  }
  const m = new StandardMaterial();
  // The scan is unlit colour, so the patch is too.
  m.useLighting = false; m.diffuse = new Color(0, 0, 0);
  m.emissive = new Color(rgb[0] / 255, rgb[1] / 255, rgb[2] / 255);
  m.emissiveMap = getPatchTex();
  // Opaque and depth-writing: it hides the stray splats under the floor that showed through
  // the gap, while the real floor splats around it (a touch higher) still blend over its edges.
  srgbOut(m);
  const e = new Entity('patch-' + f.uid);
  e.addComponent('render', { type: 'plane', material: m, castShadows: false });
  const w = f.max[0] - f.min[0] + .06, d = f.max[2] - f.min[2] + .06;
  e.setLocalScale(w, 1, d);
  e.setPosition((f.min[0] + f.max[0]) / 2, f.floorY + .006, (f.min[2] + f.max[2]) / 2);
  app.root.addChild(e);
  f.patch = e;
}
async function setRemoved(list, on) {
  const need = on ? list.filter((f) => !f.patch) : [];
  if (need.length) {
    post('working', { on: true });
    try {
      // everything comes from the frame on screen, while the pieces are still there
      const res = await new Promise((resolve) => {
        redraw();
        app.once('frameend', () => {
          const byRoom = new Map();
          resolve(need.map((f) => {
            const info = roomOf(f);
            if (info && !byRoom.has(info)) byRoom.set(info, info.floor || (info.floor = floorFromFrame(info)));
            return { floor: sampleNow(f), tex: info ? byRoom.get(info) : null };
          }));
        });
      });
      need.forEach((f, i) => makePatch(f, res[i].floor, res[i].tex));
    } finally { post('working', { on: false }); }
  }
  list.forEach((f) => { f.removed = on; });
  if (on && !shown) shown = true, items.forEach((it) => { it.root.enabled = true; });
  applyErase(); emit();
}
function emptyRoom(rooms, roomId) {
  detect(rooms);
  const list = found.filter((f) => !roomId || f.room === roomId);
  return setRemoved(list, true);
}
function restoreAll() { return setRemoved(found, false); }
function setEraseMode(on, rooms) {
  if (on) detect(rooms);
  eraseMode = !!on;
  if (eraseMode) selected = null;
  emit();
}
// Detection misses pieces the scan has fused into a wall. A tap on one makes a box
// around the spot instead: 80 cm square, from the floor to just above where it was tapped.
function manualBox(clientX, clientY) {
  const { o, d } = pointerRay(clientX, clientY);
  const hit = ray(o.x, o.y, o.z, d.x, d.y, d.z, 30);
  if (!hit) return null;
  const c = camPos(), floorY = floorBelow(c.x, c.y, c.z);
  if (hit.y < floorY + .08 || hit.y > floorY + 1.6) return null;   // floor, ceiling or high on a wall
  // nudge the box back toward the camera so it does not bite into the wall behind
  const back = Math.hypot(d.x, d.z) > 1e-3 ? .15 : 0, bx = hit.x - d.x / Math.hypot(d.x, d.z) * back, bz = hit.z - d.z / Math.hypot(d.x, d.z) * back;
  const f = { uid: 'm' + found.length, room: null, floorY: floorY - .12, removed: false,
    min: [bx - .4, floorY - .16, bz - .4], max: [bx + .4, hit.y + .35, bz + .4] };
  found.push(f);
  return f;
}
function foundAt(clientX, clientY) {
  const { o, d } = pointerRay(clientX, clientY);
  const hit = ray(o.x, o.y, o.z, d.x, d.y, d.z, 30);
  if (!hit) return null;
  const t = .12;
  return found.find((f) => hit.x > f.min[0] - t && hit.x < f.max[0] + t && hit.z > f.min[2] - t && hit.z < f.max[2] + t && hit.y < f.max[1] + t && hit.y > f.floorY + .04) || null;
}

// ---------- four still photos of the staged room ----------
// Shot 1 is the view on screen. The other three walk around the staged pieces, picking
// open directions (the scan's collision tells us where the walls are) spread as far apart
// as the room allows, at eye height, looking slightly down at the furniture.
function grab(type) {
  return new Promise((resolve) => {
    redraw();
    app.once('frameend', () => {
      // read in the same task as the draw, before the browser clears the buffer
      try { resolve(app.graphicsDevice.canvas.toDataURL(type || 'image/jpeg', .92)); } catch (e) { resolve(null); }
    });
  });
}
function lookAngles(from, to) {
  const dx = to[0] - from[0], dy = to[1] - from[1], dz = to[2] - from[2];
  return [Math.atan2(dy, Math.hypot(dx, dz)) * 180 / Math.PI, Math.atan2(-dx, -dz) * 180 / Math.PI, 0];
}
function shotPlan() {
  const p = camPos();
  const live = items.filter((it) => it.root.enabled);
  let tx, tz, floorY;
  if (live.length) {
    tx = live.reduce((a, it) => a + it.root.getPosition().x, 0) / live.length;
    tz = live.reduce((a, it) => a + it.root.getPosition().z, 0) / live.length;
    floorY = live.reduce((a, it) => a + it.floorY, 0) / live.length;
  } else {
    const f = forwardFlat();
    tx = p.x + f.x * 2.5; tz = p.z + f.z * 2.5; floorY = floorBelow(tx, p.y, tz);
  }
  const target = [tx, floorY + .5, tz];
  const eye = floorY + 1.45;
  // how far we can back away from the target in each direction before meeting a wall
  const cands = [];
  for (let a = 0; a < 360; a += 15) {
    const r = a * Math.PI / 180, dx = Math.sin(r), dz = Math.cos(r);
    const hit = ray(tx, floorY + 1.2, tz, dx, 0, dz, 6);
    const room = hit ? Math.hypot(hit.x - tx, hit.z - tz) - .75 : 4;
    const dist = Math.min(room, 3.4);
    if (dist < 1.5) continue;
    const pos = [tx + dx * dist, eye, tz + dz * dist];
    // keep clear of door frames and wall edges beside the lens...
    const side = [[-dz, dx], [dz, -dx]].every(([sx, sz]) => !ray(pos[0], eye - .3, pos[2], sx, 0, sz, .45));
    // ...and make sure nothing in the scan stands between the lens and the furniture
    const lx = tx - pos[0], ly = target[1] - eye, lz = tz - pos[2], len = Math.hypot(lx, ly, lz);
    const block = ray(pos[0], eye, pos[2], lx / len, ly / len, lz / len, len - .6);
    if (side && !block) cands.push({ a, dist, pos });
  }
  const here = (Math.atan2(p.x - tx, p.z - tz) * 180 / Math.PI + 360) % 360;
  const gap = (u, v) => { const d = Math.abs(u - v) % 360; return d > 180 ? 360 - d : d; };
  const picked = [here];
  const shots = [];
  for (const minGap of [80, 55, 35, 15]) {
    cands.slice().sort((u, v) => v.dist - u.dist).forEach((c) => {
      if (shots.length < 3 && picked.every((a) => gap(a, c.a) >= minGap)) { picked.push(c.a); shots.push(c); }
    });
    if (shots.length >= 3) break;
  }
  return { target, shots };
}
let shooting = false;
async function photos() {
  await ready;
  if (shooting) return [];
  shooting = true;
  const keep = window.getCameraState ? window.getCameraState() : null;
  const wasSel = selected; selected = null; emit();
  const out = [];
  try {
    post('shoot', { step: 1, of: 4 });
    out.push(await grab());
    const { target, shots } = shotPlan();
    for (let i = 0; i < shots.length; i++) {
      post('shoot', { step: i + 2, of: 4 });
      window.setCameraState({ position: shots[i].pos, angles: lookAngles(shots[i].pos, target), distance: 1, fov: 70, mode: 'walk' });
      redraw();
      await sleep(1600);   // let the streamed detail for the new view arrive
      out.push(await grab());
    }
  } finally {
    if (keep) window.setCameraState(keep);
    selected = wasSel; emit(); redraw();
    shooting = false;
    post('shoot', { done: true });
  }
  return out.filter(Boolean);
}

// ---------- pointer: grab a piece and slide it across the floor ----------
function hitItem(clientX, clientY) {
  const { o, d } = pointerRay(clientX, clientY);
  let best = null, bestT = Infinity;
  items.forEach((it) => {
    if (!it.root.enabled) return;
    const box = worldAabb(it);
    const pt = new Vec3();
    if (box.intersectsRay({ origin: o, direction: d }, pt)) {
      const t = pt.distance(o);
      if (t < bestT) { bestT = t; best = it; }
    }
  });
  return best;
}
function onFloor(clientX, clientY, y) {
  const { o, d } = pointerRay(clientX, clientY);
  if (Math.abs(d.y) < 1e-4) return null;
  const t = (y - o.y) / d.y;
  if (t <= 0 || t > 40) return null;
  return new Vec3(o.x + d.x * t, y, o.z + d.z * t);
}
function block(e) { e.stopImmediatePropagation(); e.preventDefault(); }

function onDown(e) {
  if (!app || !shown || e.target !== app.graphicsDevice.canvas) return;
  if (eraseMode) {
    const f = foundAt(e.clientX, e.clientY) || manualBox(e.clientX, e.clientY);
    if (f) { block(e); setRemoved([f], !f.removed); }
    else post('hint', { message: 'Tap right on a piece of furniture to remove it.' });
    return;
  }
  const it = hitItem(e.clientX, e.clientY);
  if (!it) { if (selected) { selected = null; emit(); } return; }
  block(e);
  select(it);
  const at = onFloor(e.clientX, e.clientY, it.floorY);
  const pos = it.root.getPosition();
  drag = { it, id: e.pointerId, dx: at ? pos.x - at.x : 0, dz: at ? pos.z - at.z : 0 };
  try { app.graphicsDevice.canvas.setPointerCapture(e.pointerId); } catch (_) {}
}
function onMove(e) {
  if (!drag || e.pointerId !== drag.id) return;
  block(e);
  const at = onFloor(e.clientX, e.clientY, drag.it.floorY);
  if (!at) return;
  const x = at.x + drag.dx, z = at.z + drag.dz;
  const y = floorBelow(x, drag.it.floorY + 1.2, z);
  // keep it on the same floor (ignore tables, steps and the like it passes over)
  drag.it.root.setPosition(x, Math.abs(y - drag.it.floorY) < .25 ? y : drag.it.floorY, z);
  redraw();
}
function onUp(e) {
  if (!drag || e.pointerId !== drag.id) return;
  block(e);
  drag = null;
}
['pointerdown'].forEach((t) => window.addEventListener(t, onDown, true));
window.addEventListener('pointermove', onMove, true);
window.addEventListener('pointerup', onUp, true);
window.addEventListener('pointercancel', onUp, true);
window.addEventListener('keydown', (e) => {
  if (!selected) return;
  if (e.key === 'q' || e.key === 'Q') rotate(15);
  else if (e.key === 'e' || e.key === 'E') rotate(-15);
  else if (e.key === 'Delete' || e.key === 'Backspace') remove();
});

// ---------- boot ----------
let readyResolve;
const ready = new Promise((r) => { readyResolve = r; });
(function wait() {
  const v = window.vyraViewer;
  if (v && v.global && v.global.app) {
    viewer = v; app = v.global.app; camEnt = v.global.camera;
    collision = v.inputController && v.inputController.collision;
    // the collision voxels arrive a moment after the viewer; pick them up when they do
    const grab = setInterval(() => { if (!collision && v.inputController) collision = v.inputController.collision; if (collision) clearInterval(grab); }, 300);
    // The scans are bright, evenly lit rooms; lift the light on the furniture to match.
    // (Splats are unlit, so this only touches the staged pieces.)
    app.scene.ambientLight.set(.62, .6, .58);
    const sun = app.root.findByName('light');
    if (sun && sun.light) { sun.light.intensity = 1.05; sun.setEulerAngles(55, 30, 0); }
    readyResolve();
    post('ready');
    return;
  }
  setTimeout(wait, 150);
})();

window.vyraStage = { _rooms: roomInfo, photos, _found: found, _ray: (...a) => ray(...a), _floor: (...a) => floorBelow(...a), add, rotate, remove, clear, setShown, emptyRoom, restoreAll, setEraseMode, select: (uid) => select(items.find((x) => x.uid === uid)), list: () => items.map((it) => it.uid) };
