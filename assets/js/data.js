/* The three sample homes. Every 3D scan is a published Creative Commons
   (CC BY 4.0) capture, cropped, cleaned and re-streamed by us; every listing
   photo is rendered from that scan. Credits: MZ.data.credits.
   Prices, suburbs and owners are deliberately absent: these are not listings. */
(function () {
  'use strict';
  const MZ = window.MZ = window.MZ || {};

  // ---------- floor plans (metres, in each scan's own space) ----------
  // Rooms were traced over a top-down render of each scan (plan.jpg covers
  // `bounds` exactly). cam = the room's viewpoint in the 3D tour.
  const PLANS = {
    "villa": {"bounds": [-12, -17.5, 6.5, 13.5], "rooms": [{"id": "living", "name": "Living room", "short": "Living", "poly": [[-5.8, -11.0], [5.0, -11.0], [5.0, -4.5], [-5.8, -4.5]], "note": "Double-height lounge with a chandelier and sliding doors to the terrace and pool.", "cam": {"position": [3.5, -0.3, -5.5], "angles": [-2.3, 58.4, 0]}}, {"id": "kitchen", "name": "Kitchen", "poly": [[1.0, -4.5], [5.0, -4.5], [5.0, 1.6], [1.0, 1.6]], "note": "Island kitchen with seating for three and integrated ovens.", "cam": {"position": [-3.0, -0.3, -3.8], "angles": [-2.8, -121.6, 0]}}, {"id": "dining", "name": "Dining", "poly": [[-3.8, -4.5], [1.0, -4.5], [1.0, 1.6], [-3.8, 1.6]], "note": "Formal dining for eight between the kitchen and the lounge.", "cam": {"position": [-0.5, -0.3, -6.5], "angles": [-6.2, 159.0, 0]}}, {"id": "terrace", "name": "Covered terrace", "short": "Terrace", "outdoor": true, "poly": [[-10.2, -11.0], [-5.8, -11.0], [-5.8, 1.5], [-10.2, 1.5]], "note": "Long covered terrace for outdoor dining, opening onto the lawn.", "cam": {"position": [-6.5, -0.3, 0.5], "angles": [-3.0, 9.0, 0]}}, {"id": "pool", "name": "Indoor pool", "short": "Pool", "poly": [[-8.5, -17.0], [5.5, -17.0], [5.5, -11.0], [-8.5, -11.0]], "note": "Indoor pool room with a spa, opening off the living room.", "cam": {"position": [-9.5, -0.3, -12.3], "angles": [-5.4, -79.2, 0]}}, {"id": "master", "name": "Main bedroom", "short": "Main bed", "poly": [[-5.6, 2.0], [-1.6, 2.0], [-1.6, 6.6], [-5.6, 6.6]], "note": "Main bedroom with garden doors.", "cam": {"position": [-2.2, -0.3, 6.0], "angles": [-9.0, 37.5, 0]}}, {"id": "bed2", "name": "Bedroom 2", "short": "Bed 2", "poly": [[-6.2, 8.2], [-1.4, 8.2], [-1.4, 13.0], [-6.2, 13.0]], "note": "Light-filled double bedroom with a wall of windows.", "cam": {"position": [-2.0, -0.3, 8.8], "angles": [-8.5, 132.0, 0]}}, {"id": "bed3", "name": "Bedroom 3", "short": "Bed 3", "poly": [[1.5, 9.0], [6.0, 9.0], [6.0, 12.8], [1.5, 12.8]], "note": "Guest bedroom opening to the garden.", "cam": {"position": [2.0, -0.3, 9.5], "angles": [-8.7, -129.8, 0]}}, {"id": "hall", "name": "Hall", "poly": [[-1.4, 1.6], [1.5, 1.6], [1.5, 13.0], [-1.4, 13.0]], "note": "Hallway to the bedroom wing."}]},
    "apartment": {"bounds": [-6.1, -4.3, 4.9, 6.7], "rooms": [{"id": "living", "name": "Living room", "short": "Living", "poly": [[-5.3, -1.4], [-0.7, -1.4], [-0.7, 2.0], [-5.3, 2.0]], "note": "Corner sofa, wall TV and two windows.", "cam": {"position": [-1.2, 1.5, 0.3], "angles": [-4, 90, 0]}}, {"id": "kitchen", "name": "Kitchen", "poly": [[-0.8, -3.2], [1.0, -3.2], [1.0, -1.1], [-0.8, -1.1]], "note": "Galley layout with granite benchtops.", "cam": {"position": [0.1, 1.5, -2.0], "angles": [-6, 0, 0]}}, {"id": "hall", "name": "Hall and study nook", "short": "Hall", "poly": [[-0.7, -1.2], [3.2, -1.2], [3.2, 2.1], [-0.7, 2.1]], "note": "Links every room, with a desk against the wall.", "cam": {"position": [2.9, 1.5, -0.7], "angles": [-5, 80, 0]}}, {"id": "bathroom", "name": "Bathroom", "poly": [[1.9, -3.2], [4.0, -3.2], [4.0, -1.3], [1.9, -1.3]], "note": "Double vanity and shower over bath.", "cam": {"position": [2.5, 1.5, -1.7], "angles": [-6, 0, 0]}}, {"id": "bedroom", "name": "Bedroom", "poly": [[0.1, 2.1], [4.2, 2.1], [4.2, 4.8], [0.1, 4.8]], "note": "Room for a queen bed and side lamps.", "cam": {"position": [0.8, 1.5, 2.5], "angles": [-6, -90, 0]}}, {"id": "patio", "name": "Patio", "outdoor": true, "poly": [[-5.4, 2.2], [0.0, 2.2], [0.0, 5.8], [-5.4, 5.8]], "note": "Not part of the walkthrough."}]},
    "penthouse": {"bounds": [-5.8, -7.9, 5.1, 3.0], "rooms": [{"id": "dining", "name": "Dining", "poly": [[-2.9, -5.9], [1.4, -5.9], [1.4, -2.5], [-2.9, -2.5]], "note": "Glass table for six by the terrace doors.", "cam": {"position": [-1.2, 1.5, -2.2], "angles": [-4, 0, 0]}}, {"id": "living", "name": "Living room", "short": "Living", "poly": [[-3.4, -2.5], [1.9, -2.5], [1.9, 1.0], [-3.4, 1.0]], "note": "Sofa and armchairs facing the south terrace.", "cam": {"position": [0.6, 1.5, -2.4], "angles": [-6, 170, 0]}}, {"id": "kitchen", "name": "Kitchen", "poly": [[1.4, -5.9], [3.0, -5.9], [3.0, -2.8], [1.4, -2.8]], "note": "Timber cabinets and stone benchtops.", "cam": {"position": [2.5, 1.5, -5.4], "angles": [-6, 180, 0]}}, {"id": "terrace-n", "name": "North terrace", "outdoor": true, "poly": [[-3.0, -7.6], [3.9, -7.6], [3.9, -6.0], [-3.0, -6.0]], "note": "Seen through the doors. Not part of the walkthrough."}, {"id": "terrace-s", "name": "South terrace", "outdoor": true, "poly": [[-4.7, 1.3], [3.0, 1.3], [3.0, 2.7], [-4.7, 2.7]], "note": "Seen through the doors. Not part of the walkthrough."}]}
  };

  function buildPlan(id) {
    const src = PLANS[id];
    const [x0, z0, x1, z1] = src.bounds;
    const plan = { bounds: { x0, z0, x1, z1 }, image: `assets/img/homes/${id}/plan.jpg`, rooms: src.rooms.map((r) => Object.assign({}, r)) };
    plan.rooms.forEach((r) => {
      const xs = r.poly.map((p) => p[0]), zs = r.poly.map((p) => p[1]);
      r.w = Math.max(...xs) - Math.min(...xs);
      r.d = Math.max(...zs) - Math.min(...zs);
      let a = 0;
      for (let i = 0; i < r.poly.length; i++) {
        const [ax, az] = r.poly[i], [bx, bz] = r.poly[(i + 1) % r.poly.length];
        a += ax * bz - bx * az;
      }
      r.area = Math.abs(a) / 2;
      r.lshape = r.poly.length > 4;
      r.cx = (Math.min(...xs) + Math.max(...xs)) / 2;
      r.cz = (Math.min(...zs) + Math.max(...zs)) / 2;
      if (r.cam) r.thumb = `assets/img/homes/${id}/${r.id}-t.jpg`;
    });
    plan.roomAt = function (x, z) {
      for (const r of plan.rooms) if (pointIn(r.poly, x, z)) return r;
      return null;
    };
    plan.indoorArea = plan.rooms.filter((r) => !r.outdoor).reduce((s, r) => s + r.area, 0);
    return plan;
  }
  function pointIn(poly, x, z) {
    let inside = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const [xi, zi] = poly[i], [xj, zj] = poly[j];
      if (((zi > z) !== (zj > z)) && (x < (xj - xi) * (z - zi) / ((zj - zi) || 1e-9) + xi)) inside = !inside;
    }
    return inside;
  }

  const photo = (home, room, caption) => ({ src: `assets/img/homes/${home}/${room}.jpg`, alt: caption, caption, room });
  const tour = (id, extra) => Object.assign({
    src: `walkthrough/index.html?content=homes/${id}/lod/lod-meta.json&settings=homes/${id}/settings.json&collision=homes/${id}/scene.voxel.json&roomnav`,
    poster: `assets/img/homes/${id}/poster.jpg`,
    sample: true
  }, extra);
  // ---------- the homes ----------
  const homes = [
    {
      id: 'villa',
      sample: true,
      title: 'Villa with pool and covered terrace',
      short: 'Villa with pool',
      suburb: 'Sample home 1',
      priceLabel: 'Sample listing',
      priceValue: null,
      beds: 3, baths: null, living: 2, garage: null, land: null,
      tagline: 'Indoor-outdoor living, with a pool you can use all year',
      photos: [
        photo('villa', 'living', 'Living room'),
        photo('villa', 'kitchen', 'Kitchen'),
        photo('villa', 'terrace', 'Covered terrace'),
        photo('villa', 'pool', 'Indoor pool'),
        photo('villa', 'dining', 'Dining'),
        photo('villa', 'master', 'Main bedroom'),
        photo('villa', 'bed2', 'Bedroom 2'),
        photo('villa', 'bed3', 'Bedroom 3')
      ],
      enhanceDemo: 'living',
      description: [
        'A bright single-level villa built for indoor-outdoor living. The double-height lounge opens through sliding doors to a long covered terrace on one side and an indoor pool room on the other.',
        'An island kitchen and formal dining area sit between the lounge and the bedroom wing, so the whole living space works as one room when the doors are open.',
        'Three bedrooms run along the garden side of the house, each with doors or full-height windows onto the lawn.'
      ],
      features: ['Indoor pool', 'Spa', 'Covered terrace', 'Island kitchen', 'Double-height lounge', 'Garden access from every bedroom'],
      chattels: ['Light fittings', 'Chandelier', 'Curtains', 'Rangehood', 'Oven', 'Pool equipment'],
      tour: tour('villa', { start: 'living' }),
      credit: 'scan-villa'
    },
    {
      id: 'apartment',
      sample: true,
      title: 'One-bedroom apartment with open living',
      short: 'Apartment',
      suburb: 'Sample home 2',
      priceLabel: 'Sample listing',
      priceValue: null,
      beds: 1, baths: 1, living: 1, garage: null, land: null,
      tagline: 'A lounge, kitchen, bedroom and bathroom, all off one central hall',
      scanNote: 'The patio is not part of the walkthrough.',
      photos: [
        photo('apartment', 'living', 'Living room'),
        photo('apartment', 'kitchen', 'Kitchen'),
        photo('apartment', 'bedroom', 'Bedroom'),
        photo('apartment', 'bathroom', 'Bathroom'),
        photo('apartment', 'hall', 'Hall')
      ],
      enhanceDemo: 'living',
      description: [
        'A carpeted one-bedroom apartment arranged around a central hall, with the lounge at one end and the bedroom at the other.',
        'The kitchen has granite benchtops and white cabinets, and the bathroom has a double vanity with a shower over the bath.',
        'This example shows how an everyday home reads in 3D: buyers can judge the size of each room and how they connect before they visit.'
      ],
      features: ['Central hall', 'Granite benchtops', 'Double vanity', 'Carpeted living areas', 'Study nook'],
      chattels: ['Light fittings', 'Blinds', 'Oven', 'Rangehood', 'Dishwasher'],
      tour: tour('apartment', { start: 'living' }),
      credit: 'scan-apartment'
    },
    {
      id: 'penthouse',
      sample: true,
      title: 'Top-floor apartment between two terraces',
      short: 'Terrace apartment',
      suburb: 'Sample home 3',
      priceLabel: 'Sample listing',
      priceValue: null,
      beds: null, baths: null, living: 1, garage: null, land: null,
      tagline: 'Kitchen, dining and lounge in one room, with terrace doors at both ends',
      scanNote: 'The walkthrough covers the main living space. The terraces are seen through the doors.',
      photos: [
        photo('penthouse', 'living', 'Living room'),
        photo('penthouse', 'dining', 'Dining'),
        photo('penthouse', 'kitchen', 'Kitchen'),
        photo('penthouse', 'overview', 'Open-plan living')
      ],
      enhanceDemo: 'living',
      description: [
        'One open room holds the kitchen, dining table and lounge, with tiled floors and timber-framed glass doors along both long sides.',
        'The kitchen has timber cabinets and stone benchtops, and a long servery separates it from the dining table.',
        'This example shows how a lived-in home reads in 3D: buyers can see the light and the flow through to the terraces before they visit.'
      ],
      features: ['Open-plan living', 'Tiled floors', 'Terrace doors on two sides', 'Stone benchtops'],
      chattels: ['Light fittings', 'Oven', 'Cooktop', 'Rangehood'],
      tour: tour('penthouse', { start: 'living' }),
      credit: 'scan-penthouse'
    }
  ];

  homes.forEach((h) => {
    h.photos.forEach((p) => { if (p.room === h.enhanceDemo) p.enhanced = true; });
    h.plan = buildPlan(h.id);
    h.floor = Math.round(h.plan.indoorArea / 5) * 5;
    h.floorNote = h.scanNote ? 'scanned area' : 'approx., from the scan';
  });

  // ---------- credits (CC BY 4.0 requires these) ----------
  const credits = [
    { id: 'scan-apartment', what: '3D scan, Sample home 2', title: 'Apartment', author: 'AK (arku)', url: 'https://superspl.at/scene/14b75b49', license: 'CC BY 4.0', licenseUrl: 'https://creativecommons.org/licenses/by/4.0/', changes: 'Straightened, scaled to metres, cropped, personal photos painted out and re-streamed; photos and floor plan rendered from it.' },
    { id: 'scan-villa', what: '3D scan, Sample home 1', title: 'Luxury_Villa_Interior', author: 'havuzsalim', url: 'https://superspl.at/scene/e47d3c98', license: 'CC BY 4.0', licenseUrl: 'https://creativecommons.org/licenses/by/4.0/', changes: 'Rotated, cropped, cleaned and re-streamed; photos and floor plan rendered from it.' },
    { id: 'scan-penthouse', what: '3D scan, Sample home 3', title: 'V1KL_Penthouse', author: 'SJM TECH - 3D TECHNOLOGIES', url: 'https://superspl.at/scene/49565227', license: 'CC BY 4.0', licenseUrl: 'https://creativecommons.org/licenses/by/4.0/', changes: 'Scaled to metres, cropped and re-streamed; photos and floor plan rendered from it.' },
    { id: 'drone', what: 'Hero drone footage', title: 'Addison, VT Home (aerial drone footage)', author: 'Herrick Spencer', url: 'https://commons.wikimedia.org/wiki/File:Addison,_VT_Home_(aerial_drone_footage).webm', license: 'CC BY 3.0', licenseUrl: 'https://creativecommons.org/licenses/by/3.0/', changes: 'Cut into three 16-second clips, resized and re-encoded without sound.' },
    { id: 'drone-2', what: 'Hero drone footage', title: 'Gelli Gynan, Llanarmon-yn-Iâl', author: 'Drons dy Dad', url: 'https://commons.wikimedia.org/wiki/File:Gelli_Gynan,_Llanarmon-yn-I%C3%A2l_adeilad_rhestredig_Gradd_II.webm', license: 'CC BY 3.0', licenseUrl: 'https://creativecommons.org/licenses/by/3.0/', changes: 'One 15-second clip, resized and re-encoded without sound.' },
    { id: 'drone-3', what: 'Hero drone footage', title: 'Plas yn Iâl, home of Elihu Yale', author: 'Robin Owain', url: 'https://commons.wikimedia.org/wiki/File:Plas_yn_I%C3%A2l,_home_of_Elihu_Yale_1649_1721.webm', license: 'CC BY 3.0', licenseUrl: 'https://creativecommons.org/licenses/by/3.0/', changes: 'One 16-second clip, resized and re-encoded without sound.' },
    { id: 'drone-4', what: 'Hero drone footage', title: 'Hergest Court, Herefordshire', author: 'Drones Over Wales', url: 'https://commons.wikimedia.org/wiki/File:Hergest_Court,_Swydd_Henffordd_-_Herefordshire,_England.webm', license: 'CC BY 3.0', licenseUrl: 'https://creativecommons.org/licenses/by/3.0/', changes: 'One 14-second clip, resized and re-encoded without sound.' },
    { id: 'furniture', what: 'Staging furniture', title: '3D models (81 pieces)', author: 'Poly Haven artists', url: 'https://polyhaven.com/models', license: 'CC0 1.0', licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/', changes: 'Textures resized to 512 px and packed as .glb. No credit is required; listed for transparency.' },
    { id: 'viewer', what: '3D viewer', title: 'SuperSplat Viewer', author: 'PlayCanvas', url: 'https://github.com/playcanvas/supersplat-viewer', license: 'MIT', licenseUrl: 'https://github.com/playcanvas/supersplat-viewer/blob/main/LICENSE', changes: 'Self-hosted with our own settings.' }
  ];

  const byId = Object.fromEntries(homes.map((h) => [h.id, h]));
  // Which home a page shows: ?home=villa, else the first.
  const param = new URLSearchParams(location.search).get('home');
  const current = byId[param] || homes[0];

  MZ.data = {
    homes,
    home: (id) => byId[id] || null,
    isSample: (id) => !!byId[id],
    current,
    // older code paths: "the" listing and plan are the current home's
    listing: current,
    plan: current.plan,
    credits
  };
})();
