/* The three sample homes. Every 3D scan is a published Creative Commons
   (CC BY 4.0) capture, cropped, cleaned and re-streamed by us; every listing
   photo is rendered from that scan; exteriors are public-domain (CC0) photos
   of DIFFERENT houses, used for the day-to-dusk demo. Credits: MZ.data.credits.
   Prices, suburbs and owners are deliberately absent: these are not listings. */
(function () {
  'use strict';
  const MZ = window.MZ = window.MZ || {};

  // ---------- floor plans (metres, in each scan's own space) ----------
  // Rooms were traced over a top-down render of each scan (plan.jpg covers
  // `bounds` exactly). cam = the room's viewpoint in the 3D tour.
  const PLANS = {
    "ranch": {"bounds": [-10.5, -16, 18.5, 3.5], "rooms": [{"id": "entry", "name": "Entry", "poly": [[-1.3, -3.2], [0.9, -3.2], [0.9, 2.2], [-1.3, 2.2]], "note": "Front door opening onto a wide hallway, with the main living rooms straight ahead.", "cam": {"position": [0.0, 1.5, 1.0], "angles": [-4.6, -3.4, 0]}}, {"id": "living", "name": "Living room", "short": "Living", "poly": [[0.9, -4.4], [10.2, -4.4], [10.2, 0.9], [0.9, 0.9]], "note": "A big, bright lounge with room for two seating areas and a fireplace corner.", "cam": {"position": [8.47, 1.5, 0.03], "angles": [-3.0, 58.6, 0]}}, {"id": "kitchen", "name": "Kitchen", "poly": [[5.2, -9.5], [10.2, -9.5], [10.2, -4.4], [5.2, -4.4]], "note": "L-shaped kitchen with a long breakfast bar and plenty of bench space.", "cam": {"position": [4.99, 1.5, -4.12], "angles": [-9.1, -45.6, 0]}}, {"id": "dining", "name": "Dining", "poly": [[-0.2, -9.5], [5.2, -9.5], [5.2, -4.4], [-0.2, -4.4]], "note": "Round table for six, open to the kitchen and the family room.", "cam": {"position": [6.7, 1.55, -4.9], "angles": [-7.7, 57.7, 0]}}, {"id": "family", "name": "Family room", "short": "Family", "poly": [[-0.2, -15.1], [6.2, -15.1], [6.2, -9.5], [-0.2, -9.5]], "note": "A second lounge at the back of the house, away from the front rooms.", "cam": {"position": [-0.05, 1.55, -8.62], "angles": [-8.8, -43.1, 0]}}, {"id": "ensuite", "name": "Ensuite", "poly": [[6.2, -15.1], [10.2, -15.1], [10.2, -10.4], [6.2, -10.4]], "note": "Freestanding bath, double vanity and a separate shower.", "cam": {"position": [7.79, 1.5, -9.2], "angles": [-10.6, -24.6, 0]}}, {"id": "master", "name": "Main bedroom", "short": "Main bed", "poly": [[11.2, -15.6], [17.3, -15.6], [17.3, -9.0], [11.2, -9.0]], "note": "King-size main bedroom with its own ensuite.", "cam": {"position": [12.3, 1.54, -8.73], "angles": [-9.7, -31.0, 0]}}, {"id": "bathroom", "name": "Bathroom", "poly": [[-3.6, -9.3], [-0.2, -9.3], [-0.2, -4.4], [-3.6, -4.4]], "note": "Family bathroom between the bedrooms and the living areas.", "cam": {"position": [-1.7, 1.55, -4.9], "angles": [-11.5, 11.1, 0]}}, {"id": "office", "name": "Office", "poly": [[-5.0, -2.6], [-1.3, -2.6], [-1.3, 1.6], [-5.0, 1.6]], "note": "A quiet study at the front of the house.", "cam": {"position": [-4.75, 1.55, -1.69], "angles": [-7.4, -125.4, 0]}}, {"id": "bed2", "name": "Bedroom 2", "short": "Bed 2", "poly": [[-9.5, -9.3], [-3.6, -9.3], [-3.6, -4.3], [-9.5, -4.3]], "note": "Double bedroom in the children's wing.", "cam": {"position": [-9.18, 1.6, -8.71], "angles": [-14.1, -139.8, 0]}}, {"id": "bed3", "name": "Bedroom 3", "short": "Bed 3", "poly": [[-9.5, -3.6], [-5.0, -3.6], [-5.0, 1.3], [-9.5, 1.3]], "note": "Double bedroom next to the office.", "cam": {"position": [-8.55, 1.6, 1.19], "angles": [-13.6, -42.9, 0]}}, {"id": "hall", "name": "Hall", "poly": [[-5.0, -4.4], [-0.2, -4.4], [-0.2, -2.6], [-5.0, -2.6]], "note": "Hallway to the bedrooms and the bathroom."}, {"id": "hall2", "name": "Hall", "poly": [[6.2, -10.4], [11.2, -10.4], [11.2, -9.0], [6.2, -9.0]], "note": "Hallway to the main bedroom."}]},
    "villa": {"bounds": [-12, -17.5, 6.5, 13.5], "rooms": [{"id": "living", "name": "Living room", "short": "Living", "poly": [[-5.8, -11.0], [5.0, -11.0], [5.0, -4.5], [-5.8, -4.5]], "note": "Double-height lounge with a chandelier and sliding doors to the terrace and pool.", "cam": {"position": [3.5, -0.3, -5.5], "angles": [-2.3, 58.4, 0]}}, {"id": "kitchen", "name": "Kitchen", "poly": [[1.0, -4.5], [5.0, -4.5], [5.0, 1.6], [1.0, 1.6]], "note": "Island kitchen with seating for three and integrated ovens.", "cam": {"position": [-3.0, -0.3, -3.8], "angles": [-2.8, -121.6, 0]}}, {"id": "dining", "name": "Dining", "poly": [[-3.8, -4.5], [1.0, -4.5], [1.0, 1.6], [-3.8, 1.6]], "note": "Formal dining for eight between the kitchen and the lounge.", "cam": {"position": [-0.5, -0.3, -6.5], "angles": [-6.2, 159.0, 0]}}, {"id": "terrace", "name": "Covered terrace", "short": "Terrace", "outdoor": true, "poly": [[-10.2, -11.0], [-5.8, -11.0], [-5.8, 1.5], [-10.2, 1.5]], "note": "Long covered terrace for outdoor dining, opening onto the lawn.", "cam": {"position": [-6.5, -0.3, 0.5], "angles": [-3.0, 9.0, 0]}}, {"id": "pool", "name": "Indoor pool", "short": "Pool", "poly": [[-8.5, -17.0], [5.5, -17.0], [5.5, -11.0], [-8.5, -11.0]], "note": "Indoor pool room with a spa, opening off the living room.", "cam": {"position": [-9.5, -0.3, -12.3], "angles": [-5.4, -79.2, 0]}}, {"id": "master", "name": "Main bedroom", "short": "Main bed", "poly": [[-5.6, 2.0], [-1.6, 2.0], [-1.6, 6.6], [-5.6, 6.6]], "note": "Main bedroom with garden doors.", "cam": {"position": [-2.2, -0.3, 6.0], "angles": [-9.0, 37.5, 0]}}, {"id": "bed2", "name": "Bedroom 2", "short": "Bed 2", "poly": [[-6.2, 8.2], [-1.4, 8.2], [-1.4, 13.0], [-6.2, 13.0]], "note": "Light-filled double bedroom with a wall of windows.", "cam": {"position": [-2.0, -0.3, 8.8], "angles": [-8.5, 132.0, 0]}}, {"id": "bed3", "name": "Bedroom 3", "short": "Bed 3", "poly": [[1.5, 9.0], [6.0, 9.0], [6.0, 12.8], [1.5, 12.8]], "note": "Guest bedroom opening to the garden.", "cam": {"position": [2.0, -0.3, 9.5], "angles": [-8.7, -129.8, 0]}}, {"id": "hall", "name": "Hall", "poly": [[-1.4, 1.6], [1.5, 1.6], [1.5, 13.0], [-1.4, 13.0]], "note": "Hallway to the bedroom wing."}]},
    "townhouse": {"bounds": [-4.02, -2.3, 4.02, 3.45], "rooms": [{"id": "living", "name": "Living room", "short": "Living", "poly": [[-1.035, -1.897], [3.047, -1.897], [3.047, 2.3], [-1.035, 2.3]], "note": "Corner lounge with a modular sofa, feature wall and full-height windows.", "cam": {"position": [-1.44, 1.5, -1.44], "angles": [-10.8, -127.6, 0]}}, {"id": "kitchen", "name": "Kitchen and dining", "short": "Kitchen", "poly": [[-4.025, -1.897], [-1.035, -1.897], [-1.035, 1.15], [-4.025, 1.15]], "note": "Galley kitchen with a built-in oven, tiled splashback and a dining table for four.", "cam": {"position": [1.3, 1.4, -0.6], "angles": [-4.7, 112.3, 0]}}]}}

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
  const viewings = {
    openHomes: [{ dow: 6, start: '11:00', end: '11:45' }, { dow: 0, start: '13:00', end: '13:45' }],
    privateTimes: { weekday: ['17:30', '18:15'], weekend: ['10:00', '14:30', '15:15'] },
    days: 21
  };

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
      status: 'Viewings',
      exterior: { src: 'assets/img/homes/villa/exterior.jpg', caption: 'Garden view of a similar home (sample photo, different house)' },
      dusk: {
        windows: [[[0.3564,0.3982],[0.4463,0.3982],[0.4463,0.4627],[0.3564,0.4627]], [[0.5527,0.4480],[0.5859,0.4480],[0.5859,0.4978],[0.5527,0.4978]], [[0.6885,0.4261],[0.75,0.4261],[0.75,0.4832],[0.6885,0.4832]], [[0.3066,0.5373],[0.3955,0.5373],[0.3955,0.5974],[0.3066,0.5974]], [[0.4307,0.5373],[0.4951,0.5373],[0.4951,0.5871],[0.4307,0.5871]], [[0.5430,0.5549],[0.6172,0.5549],[0.6172,0.6398],[0.5430,0.6398]], [[0.6543,0.5476],[0.7861,0.5476],[0.7861,0.6442],[0.6543,0.6442]], [[0.0371,0.5813],[0.0703,0.5813],[0.0703,0.6208],[0.0371,0.6208]], [[0.1270,0.5608],[0.1416,0.5608],[0.1416,0.6149],[0.1270,0.6149]], [[0.1494,0.5608],[0.1660,0.5608],[0.1660,0.6223],[0.1494,0.6223]], [[0.1738,0.5534],[0.1914,0.5534],[0.1914,0.6149],[0.1738,0.6149]]],
        lights: [{ x: 0.5811, y: 0.5447, r: 0.012 }]
      },
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
      viewings,
      credit: 'scan-villa'
    },
    {
      id: 'ranch',
      sample: true,
      title: 'Single-level family home',
      short: 'Family home',
      suburb: 'Sample home 2',
      priceLabel: 'Sample listing',
      priceValue: null,
      beds: 3, baths: 2, living: 3, garage: null, land: null,
      tagline: 'Three bedrooms, three living areas, all on one level',
      status: 'Active',
      exterior: { src: 'assets/img/homes/ranch/exterior.jpg', caption: 'Front of a similar home (sample photo, different house)' },
      dusk: {
        windows: [[[0.0742,0.555],[0.1074,0.555],[0.1074,0.7016],[0.0742,0.7016]], [[0.2305,0.5515],[0.2656,0.5515],[0.2656,0.6981],[0.2305,0.6981]], [[0.3809,0.5620],[0.4023,0.5271],[0.4238,0.5201],[0.4453,0.5271],[0.4668,0.5620],[0.4668,0.6736],[0.3809,0.6736]], [[0.5205,0.5759],[0.5498,0.5759],[0.5498,0.6894],[0.5205,0.6894]], [[0.6309,0.5585],[0.7109,0.5585],[0.7109,0.6492],[0.6309,0.6492]]],
        lights: [{ x: 0.5, y: 0.5934, r: 0.01 }, { x: 0.5664, y: 0.5934, r: 0.01 }]
      },
      photos: [
        photo('ranch', 'living', 'Living room'),
        photo('ranch', 'kitchen', 'Kitchen'),
        photo('ranch', 'dining', 'Dining'),
        photo('ranch', 'family', 'Family room'),
        photo('ranch', 'master', 'Main bedroom'),
        photo('ranch', 'ensuite', 'Ensuite'),
        photo('ranch', 'bathroom', 'Bathroom')
      ],
      enhanceDemo: 'kitchen',
      description: [
        'A generous single-level home laid out around a central kitchen and dining room, with a formal living room at the front and a family room at the back.',
        'The main bedroom sits in its own wing with a full ensuite: freestanding bath, double vanity and shower. Two more bedrooms, a family bathroom and a home office are on the other side of the house.',
        'Every room in this example was captured in one visit and joined into a single walk-through, so buyers can move from the front door to the back bedroom without a break.'
      ],
      features: ['Single level', 'Ensuite', 'Home office', 'Three living areas', 'Breakfast bar', 'Freestanding bath'],
      chattels: ['Light fittings', 'Floor coverings', 'Blinds', 'Rangehood', 'Dishwasher'],
      tour: tour('ranch', { start: 'living' }),
      viewings,
      credit: 'scan-ranch'
    },
    {
      id: 'townhouse',
      sample: true,
      title: 'Modern home, open-plan living',
      short: 'Modern home',
      suburb: 'Sample home 3',
      priceLabel: 'Sample listing',
      priceValue: null,
      beds: null, baths: null, living: 1, garage: null, land: null,
      tagline: 'Kitchen, dining and lounge in one light-filled room',
      status: 'Active',
      scanNote: 'Only the ground-floor living space was scanned.',
      exterior: { src: 'assets/img/homes/townhouse/exterior.jpg', caption: 'Street view of a similar home (sample photo, different house)' },
      dusk: {
        windows: [[[0.2822,0.2489],[0.6055,0.1640],[0.6055,0.2343],[0.2822,0.3045]], [[0.3252,0.4290],[0.4072,0.4290],[0.4072,0.6193],[0.3252,0.6193]], [[0.0732,0.4685],[0.1592,0.4685],[0.1592,0.5490],[0.0732,0.5490]]],
        lights: []
      },
      photos: [
        photo('townhouse', 'living', 'Living room'),
        photo('townhouse', 'kitchen', 'Kitchen and dining'),
        photo('townhouse', 'overview', 'Open-plan living'),
        photo('townhouse', 'lounge', 'Lounge')
      ],
      enhanceDemo: 'living',
      description: [
        'One open room holds the kitchen, dining table and lounge, with herringbone timber floors and full-height windows on two sides.',
        'The galley kitchen has a built-in oven, tiled splashback and generous storage. A dining table for four sits between the kitchen and the corner sofa.',
        'This example shows how a smaller space reads in 3D: buyers can judge the size of the lounge and the flow to the kitchen before they visit.'
      ],
      features: ['Open-plan living', 'Herringbone floors', 'Feature wall', 'Built-in oven', 'Full-height windows'],
      chattels: ['Light fittings', 'Curtains', 'Oven', 'Cooktop'],
      tour: tour('townhouse', { start: 'living' }),
      viewings,
      credit: 'scan-townhouse'
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
    { id: 'scan-ranch', what: '3D scan, Sample home 2', title: 'Home Scan (Creation process in description)', author: 'luxury_scans', url: 'https://superspl.at/scene/3f89bbd3', license: 'CC BY 4.0', licenseUrl: 'https://creativecommons.org/licenses/by/4.0/', changes: 'Cropped, cleaned, reduced to 80% detail and re-streamed; photos and floor plan rendered from it.' },
    { id: 'scan-villa', what: '3D scan, Sample home 1', title: 'Luxury_Villa_Interior', author: 'havuzsalim', url: 'https://superspl.at/scene/e47d3c98', license: 'CC BY 4.0', licenseUrl: 'https://creativecommons.org/licenses/by/4.0/', changes: 'Rotated, cropped, cleaned and re-streamed; photos and floor plan rendered from it.' },
    { id: 'scan-townhouse', what: '3D scan, Sample home 3', title: 'Living Room and Kitchen', author: 'ethan3111', url: 'https://superspl.at/scene/9917211a', license: 'CC BY 4.0', licenseUrl: 'https://creativecommons.org/licenses/by/4.0/', changes: 'Scaled to metres, cropped and re-streamed; photos and floor plan rendered from it.' },
    { id: 'photo-ranch', what: 'Exterior photo, Sample home 2', title: 'Traditional American house', author: 'rawpixel (public domain)', url: 'https://www.rawpixel.com/image/6036248', license: 'CC0 1.0', licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/', changes: 'Upscaled; dusk version generated by our tool.' },
    { id: 'photo-villa', what: 'Exterior photo, Sample home 1', title: 'Simple home exterior design photo', author: 'rawpixel (public domain)', url: 'https://www.rawpixel.com/image/5907033', license: 'CC0 1.0', licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/', changes: 'Upscaled; dusk version generated by our tool.' },
    { id: 'photo-townhouse', what: 'Exterior photo, Sample home 3', title: 'Modern house, real estate', author: 'rawpixel (public domain)', url: 'https://www.rawpixel.com/image/6043057', license: 'CC0 1.0', licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/', changes: 'Upscaled; dusk version generated by our tool.' },
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
