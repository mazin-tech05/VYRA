// VYRA virtual staging: places CC0 furniture (glb) into the 3D scan.
// Loaded only with ?stage. The page that embeds the tour drives it through
// window.vyraStage (same origin), and hears back through 'vyra-stage' messages.
import { Entity, Vec3, Color, BoundingBox, StandardMaterial, Texture, BLEND_NORMAL } from './index.js?v=5';

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
  m.update();
  return (shadowMat = m);
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
  post('items', { items: items.map((it) => ({ uid: it.uid, id: it.id, name: it.name })), selected: selected && selected.uid, shown });
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
  if (!shown) selected = null;
  emit(); redraw();
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
    app.scene.ambientLight.set(.78, .76, .74);
    const sun = app.root.findByName('light');
    if (sun && sun.light) { sun.light.intensity = 1.25; sun.setEulerAngles(55, 30, 0); }
    readyResolve();
    post('ready');
    return;
  }
  setTimeout(wait, 150);
})();

window.vyraStage = { add, rotate, remove, clear, setShown, select: (uid) => select(items.find((x) => x.uid === uid)), list: () => items.map((it) => it.uid) };
