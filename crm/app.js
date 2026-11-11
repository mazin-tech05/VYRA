/* VYRA CRM — runs entirely on the phone. Contacts, notes and jobs are kept
   in this browser's IndexedDB; nothing is sent anywhere. */
'use strict';

const STATUSES = [
  ['new', 'New'], ['emailed', 'Emailed'], ['followed', 'Followed up'], ['called', 'Called'],
  ['interested', 'Interested'], ['booked', 'Scan booked'], ['scanned', 'Scanned'],
  ['client', 'Paying client'], ['notint', 'Not interested'], ['dnc', 'Do not contact'],
];
const SLABEL = Object.fromEntries(STATUSES);
const JOB_STATUSES = [['booked', 'Booked'], ['scanned', 'Scanned'], ['delivered', 'Delivered'], ['paid', 'Paid']];
const DAY = 86400000;

/* ---------- storage (IndexedDB, one key per part) ---------- */
const DB = {
  db: null,
  open() {
    return new Promise((res, rej) => {
      const r = indexedDB.open('vyra-crm', 1);
      r.onupgradeneeded = () => r.result.createObjectStore('kv');
      r.onsuccess = () => { this.db = r.result; res(); };
      r.onerror = () => rej(r.error);
    });
  },
  get(k) {
    return new Promise((res, rej) => {
      const q = this.db.transaction('kv').objectStore('kv').get(k);
      q.onsuccess = () => res(q.result); q.onerror = () => rej(q.error);
    });
  },
  set(k, v) {
    return new Promise((res, rej) => {
      const t = this.db.transaction('kv', 'readwrite');
      t.objectStore('kv').put(v, k); t.oncomplete = res; t.onerror = () => rej(t.error);
    });
  },
};

const S = {
  contacts: [],          // imported list (read-only data)
  crm: {},               // id -> {status, listing, notes, due, hist:[{t,ty,tx}]}
  jobs: [],              // [{id, cid, address, date, size, price, free, permission, status, notes}]
  settings: { name: '', phone: '', email: '', area: 'Auckland', region: '', goal: 5 },
  ui: { tab: 'today', kind: 'agent', q: '', region: '', company: '', status: '', hasEmail: false, sales: true, limit: 80 },
};
let byId = new Map();

async function load() {
  await DB.open();
  S.contacts = (await DB.get('contacts')) || [];
  S.crm = (await DB.get('crm')) || {};
  S.jobs = (await DB.get('jobs')) || [];
  Object.assign(S.settings, (await DB.get('settings')) || {});
  try { Object.assign(S.ui, JSON.parse(localStorage.getItem('vyra-ui') || '{}'), { limit: 80 }); } catch (e) {}
  if (!S.ui.region && S.settings.region) S.ui.region = S.settings.region;
  index();
  if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
}
function index() { byId = new Map(S.contacts.map(c => [c.id, c])); }
const saveCrm = () => DB.set('crm', S.crm);
const saveJobs = () => DB.set('jobs', S.jobs);
const saveSettings = () => DB.set('settings', S.settings);
function saveUi() { try { localStorage.setItem('vyra-ui', JSON.stringify({ ...S.ui, limit: undefined })); } catch (e) {} }

/* ---------- helpers ---------- */
const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const today0 = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d.getTime(); };
const ymd = t => { const d = new Date(t); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const parseYmd = s => { if (!s) return null; const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d).getTime(); };
const fmtDate = t => new Date(t).toLocaleDateString('en-NZ', { day: 'numeric', month: 'short' });
const daysAgo = t => Math.floor((today0() - new Date(t).setHours(0, 0, 0, 0)) / DAY);
const ago = t => { const n = daysAgo(t); return n <= 0 ? 'today' : n === 1 ? 'yesterday' : `${n} days ago`; };
const money = n => '$' + Number(n || 0).toLocaleString('en-NZ');
const first = n => String(n || '').trim().split(/\s+/)[0] || '';
const rec = id => S.crm[id] || (S.crm[id] = { status: 'new', hist: [] });
const status = id => (S.crm[id] && S.crm[id].status) || 'new';
const lastTouch = id => { const h = (S.crm[id] && S.crm[id].hist) || []; return h.length ? h[h.length - 1].t : 0; };
const telHref = p => 'tel:' + String(p).replace(/[^\d+]/g, '');
const isSales = c => c.kind !== 'agent' || !/rental|property manag|leasing|asset|facilit|commercial|accounts|admin|reception|marketing|support|\bNAI\b|body corporate/i.test(`${c.team} ${c.role} ${c.office}`);

function toast(msg) {
  const t = $('#toast'); t.textContent = msg; t.hidden = false;
  clearTimeout(toast.h); toast.h = setTimeout(() => (t.hidden = true), 2200);
}
function log(id, ty, tx) {
  const r = rec(id); r.hist = r.hist || [];
  r.hist.push({ t: Date.now(), ty, tx }); saveCrm();
}
function setStatus(id, st, why) {
  const r = rec(id); if (r.status === st) return;
  r.status = st; log(id, 'status', why || `Status → ${SLABEL[st]}`);
}

/* ---------- email templates (from the agreed drafts) ---------- */
function signature() {
  const s = S.settings;
  return [s.name || 'Mazin', 'Founder, VYRA · vyra.co.nz', [s.phone, s.email].filter(Boolean).join(' · ')].filter(Boolean).join('\n');
}
const OPTOUT = 'Not interested? Just reply "no thanks" and I won\'t contact you again.';
function template(kind, c, listing) {
  const hi = c.kind === 'agent' ? `Hi ${first(c.name)},` : 'Hi there,';
  const area = S.settings.area || 'Auckland';
  if (kind === 'first') {
    const subject = listing ? `Free 3D tour for ${listing}?` : 'Free 3D walkthrough for your next listing';
    const saw = listing ? `I saw your listing at ${listing} and thought it would make a great walk-through.\n\n` : '';
    return { subject, body:
`${hi}

I'm ${first(S.settings.name) || 'Mazin'}, founder of VYRA, a new 3D walkthrough service in ${area}. ${saw}Buyers can explore a VYRA tour room by room on their phone, with a clickable floor plan from the same visit. You can try one at vyra.co.nz. The homes there are licensed samples while I build my local portfolio.

I'm looking for my first real homes to show, so I'll scan your next listing completely free. In return, I'd just ask permission to feature it on my website.

After that, it's an introductory $150 per home (up to 4 bedrooms), with larger homes quoted.

Would you be open to trying it on an upcoming listing?

Thanks,
${signature()}

${OPTOUT}` };
  }
  if (kind === 'follow') {
    const subject = listing ? `Re: Free 3D tour for ${listing}?` : 'Re: Free 3D walkthrough for your next listing';
    return { subject, body:
`${hi}

Just following up. I'm still offering a free 3D walkthrough for your next listing, with no catch and nothing to sign up for.

I'd be happy to give you a quick call or pop into your office to show you how it works.

${first(S.settings.name) || 'Mazin'} · ${S.settings.phone || ''}

Reply "no thanks" and I won't contact you again.` };
  }
  return { subject: 'VYRA 3D walkthroughs', body: `${hi}\n\n\n\n${signature()}\n\n${OPTOUT}` };
}

/* ---------- Today: what needs doing ---------- */
function tasks() {
  const out = [], t0 = today0();
  for (const [id, r] of Object.entries(S.crm)) {
    const c = byId.get(id); if (!c) continue;
    const st = r.status, last = lastTouch(id), due = parseYmd(r.due);
    if (st === 'dnc' || st === 'notint' || st === 'client') continue;
    if (due !== null && due <= t0) { out.push({ c, why: `Your reminder (${fmtDate(due)})`, pri: 0 }); continue; }
    if (st === 'emailed' && daysAgo(last) >= 3) out.push({ c, why: `Emailed ${ago(last)}, no reply. Send the follow-up email.`, pri: 2, act: 'follow' });
    else if (st === 'followed' && daysAgo(last) >= 2) out.push({ c, why: `Followed up ${ago(last)}. Give them a call.`, pri: 2, act: 'call' });
    else if (st === 'interested') out.push({ c, why: 'Interested. Book the free scan.', pri: 1 });
  }
  for (const j of S.jobs) {
    const c = byId.get(j.cid), d = parseYmd(j.date);
    if (j.status === 'booked' && d !== null && d <= t0) out.push({ c, job: j, why: d === t0 ? `Scan today: ${j.address}` : `Scan was due ${fmtDate(d)}: ${j.address}. Mark it scanned?`, pri: 0 });
    if (j.status === 'scanned') out.push({ c, job: j, why: `Deliver the tour for ${j.address}`, pri: 1 });
    if (j.status === 'delivered' && !j.free && Number(j.price) > 0) out.push({ c, job: j, why: `Waiting on ${money(j.price)} for ${j.address}`, pri: 3 });
  }
  return out.sort((a, b) => a.pri - b.pri);
}
function emailsToday() {
  const t0 = today0(); let n = 0;
  for (const r of Object.values(S.crm)) for (const h of r.hist || []) if (h.ty === 'email' && h.t >= t0) n++;
  return n;
}

/* ---------- views ---------- */
const TITLES = { today: 'Today', contacts: 'Agents', pipeline: 'Pipeline', jobs: 'Jobs', stats: 'Stats' };
function render() {
  $('#title').textContent = TITLES[S.ui.tab];
  document.querySelectorAll('.tabs button').forEach(b => b.classList.toggle('on', b.dataset.tab === S.ui.tab));
  const v = $('#view');
  if (!S.contacts.length) { v.innerHTML = welcome(); return; }
  v.innerHTML = ({ today: viewToday, contacts: viewContacts, pipeline: viewPipeline, jobs: viewJobs, stats: viewStats })[S.ui.tab]();
}

function welcome() {
  return `<div class="card" style="margin-top:10px">
    <p class="name" style="font-size:18px;margin:0 0 6px">Welcome to your VYRA CRM</p>
    <p class="note" style="margin:0 0 12px">Load your agent list to start. The file is <b>vyra-crm-data.json</b> in the VYRA-Outreach folder on your Mac. AirDrop it to your phone (it lands in Files), then pick it here.</p>
    <label class="btn gold" style="width:100%">Load agent list<input type="file" accept=".json,application/json" id="importFile" hidden></label>
    <p class="note" style="margin:12px 0 0">Everything stays on this phone. Nothing is uploaded.</p></div>`;
}

function row(c, extra = '') {
  const st = status(c.id);
  return `<button class="item" data-open="${c.id}"><div class="row"><div class="grow">
    <div class="name">${esc(c.name)}</div>
    <div class="sub">${esc([c.role && c.kind === 'agent' ? c.role : '', c.office || c.company, c.suburb].filter(Boolean).join(' · '))}</div>${extra}
  </div><span class="pill ${st}">${esc(SLABEL[st])}</span></div></button>`;
}

function viewToday() {
  const T = tasks(), sent = emailsToday(), goal = Number(S.settings.goal) || 5;
  let h = `<div class="card"><div class="row between"><div><div class="name">Emails sent today: ${sent} of ${goal}</div>
    <div class="sub">Personalise each one with a real listing of theirs.</div></div></div>
    <div class="goal">${Array.from({ length: goal }, (_, i) => `<i class="${i < sent ? 'on' : ''}"></i>`).join('')}</div></div>`;
  h += `<h2>To do (${T.length})</h2>`;
  h += T.length ? T.map(t => t.c ? row(t.c, `<div class="task-why">${esc(t.why)}</div>`) : `<div class="card"><div class="task-why">${esc(t.why)}</div></div>`).join('')
    : `<div class="empty">Nothing due. Nice.</div>`;
  if (sent < goal) {
    const reg = S.settings.region || S.ui.region;
    const fresh = S.contacts.filter(c => c.kind === 'agent' && c.email && status(c.id) === 'new' && isSales(c) && (!reg || c.region === reg));
    const pick = shuffleDay(fresh).slice(0, Math.max(0, goal - sent));
    if (pick.length) h += `<h2>Suggested to email${reg ? ` in ${esc(reg)}` : ''}</h2>
      <p class="note" style="margin:-2px 0 8px">Sales agents with a published email you haven't contacted yet. Look up one of their current listings before you send.</p>` + pick.map(c => row(c)).join('');
  }
  return h;
}
function shuffleDay(a) { // stable "random" order that changes each day
  const seed = today0() / DAY;
  return a.map(c => [hash(c.id + seed), c]).sort((x, y) => x[0] - y[0]).map(x => x[1]);
}
function hash(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }

function filtered() {
  const u = S.ui, q = u.q.trim().toLowerCase();
  return S.contacts.filter(c => c.kind === u.kind
    && (!u.region || c.region === u.region) && (!u.company || c.company === u.company)
    && (!u.status || status(c.id) === u.status) && (!u.hasEmail || c.email)
    && (!u.sales || u.kind !== 'agent' || isSales(c))
    && (!q || `${c.name} ${c.office} ${c.suburb} ${c.company} ${c.role}`.toLowerCase().includes(q)));
}
function opts(list, cur, all) {
  return `<option value="">${all}</option>` + list.map(x => `<option ${x === cur ? 'selected' : ''}>${esc(x)}</option>`).join('');
}
function viewContacts() {
  const u = S.ui, pool = S.contacts.filter(c => c.kind === u.kind);
  const regions = [...new Set(pool.map(c => c.region))].sort(), companies = [...new Set(pool.map(c => c.company))].sort();
  const list = filtered().sort((a, b) => a.name.localeCompare(b.name));
  return `<div class="seg">${[['agent', 'People'], ['office', 'Offices'], ['manager', 'Managers']].map(([k, l]) => `<button data-kind="${k}" class="${u.kind === k ? 'on' : ''}">${l}</button>`).join('')}</div>
  <input type="search" id="q" placeholder="Search name, office, suburb" value="${esc(u.q)}" autocomplete="off">
  <div class="filters">
    <select data-f="region">${opts(regions, u.region, 'All regions')}</select>
    <select data-f="company">${opts(companies, u.company, 'All companies')}</select>
    <select data-f="status"><option value="">Any status</option>${STATUSES.map(([k, l]) => `<option value="${k}" ${u.status === k ? 'selected' : ''}>${l}</option>`).join('')}</select>
    ${u.kind === 'agent' ? `<button class="chip ${u.sales ? 'on' : ''}" data-toggle="sales">Sales only</button>` : ''}
    <button class="chip ${u.hasEmail ? 'on' : ''}" data-toggle="hasEmail">Has email</button>
  </div>
  <p class="note" style="margin:4px 2px 8px">${list.length.toLocaleString()} shown</p>
  ${list.slice(0, u.limit).map(c => row(c)).join('') || '<div class="empty">No matches.</div>'}
  ${list.length > u.limit ? `<button class="btn more" id="more">Show more</button>` : ''}`;
}

function viewPipeline() {
  const groups = {};
  for (const [id, r] of Object.entries(S.crm)) if (r.status && r.status !== 'new' && byId.has(id)) (groups[r.status] = groups[r.status] || []).push(byId.get(id));
  const keys = STATUSES.map(s => s[0]).filter(k => groups[k]);
  if (!keys.length) return `<div class="empty">No one contacted yet. Start from Today or Agents.</div>`;
  return keys.map(k => `<h2>${SLABEL[k]} (${groups[k].length})</h2>` + groups[k].sort((a, b) => lastTouch(b.id) - lastTouch(a.id)).map(c => row(c, `<div class="sub">Last: ${ago(lastTouch(c.id))}</div>`)).join('')).join('');
}

function viewJobs() {
  const J = [...S.jobs].sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  return `<button class="btn gold" style="width:100%;margin-bottom:12px" data-newjob="">+ New job</button>` +
    (J.length ? J.map(j => {
      const c = byId.get(j.cid);
      return `<button class="item" data-job="${j.id}"><div class="row"><div class="grow"><div class="name">${esc(j.address || 'No address')}</div>
      <div class="sub">${esc([j.date ? fmtDate(parseYmd(j.date)) : 'No date', c ? c.name : '', j.free ? 'Free' : money(j.price)].filter(Boolean).join(' · '))}</div>
      ${j.permission ? '' : '<div class="task-why">Written permission not recorded yet</div>'}</div>
      <span class="pill ${j.status === 'paid' ? 'client' : j.status === 'booked' ? 'booked' : 'scanned'}">${esc(Object.fromEntries(JOB_STATUSES)[j.status])}</span></div></button>`;
    }).join('') : `<div class="empty">No jobs yet. Your first free scan goes here.</div>`);
}

function viewStats() {
  const counts = Object.fromEntries(STATUSES.map(s => [s[0], 0]));
  let emails = 0, calls = 0, week = 0; const w0 = today0() - 6 * DAY;
  for (const r of Object.values(S.crm)) {
    counts[r.status || 'new']++;
    for (const h of r.hist || []) { if (h.ty === 'email') { emails++; if (h.t >= w0) week++; } if (h.ty === 'call') calls++; }
  }
  const contacted = Object.values(S.crm).filter(r => r.status && r.status !== 'new').length;
  const positive = counts.interested + counts.booked + counts.scanned + counts.client;
  const paid = S.jobs.filter(j => j.status === 'paid').reduce((s, j) => s + (j.free ? 0 : Number(j.price) || 0), 0);
  const owed = S.jobs.filter(j => j.status === 'delivered' && !j.free).reduce((s, j) => s + (Number(j.price) || 0), 0);
  const scans = S.jobs.filter(j => j.status !== 'booked').length;
  const fun = [['Contacted', contacted], ['Interested+', positive], ['Scan booked+', counts.booked + counts.scanned + counts.client], ['Scanned+', counts.scanned + counts.client], ['Paying', counts.client]];
  const mx = Math.max(1, contacted);
  return `<div class="kpis">
    <div class="kpi"><div class="v">${emails}</div><div class="l">Emails sent (${week} this week)</div></div>
    <div class="kpi"><div class="v">${calls}</div><div class="l">Calls logged</div></div>
    <div class="kpi"><div class="v">${contacted ? Math.round(positive / contacted * 100) : 0}%</div><div class="l">Interested rate</div></div>
    <div class="kpi"><div class="v">${scans}</div><div class="l">Homes scanned</div></div>
    <div class="kpi"><div class="v">${money(paid)}</div><div class="l">Paid</div></div>
    <div class="kpi"><div class="v">${money(owed)}</div><div class="l">Waiting on payment</div></div>
  </div>
  <h2>Funnel</h2><div class="card funnel">${fun.map(([l, n]) => `<div class="row"><span class="lab">${l}</span><div class="grow bar"><i style="width:${n / mx * 100}%"></i></div><span class="n">${n}</span></div>`).join('')}</div>
  <p class="note">Not interested: ${counts.notint} · Do not contact: ${counts.dnc}</p>`;
}

/* ---------- contact sheet ---------- */
function openSheet(html) { delete $('#sheetBody').dataset.cid; $('#sheetBody').innerHTML = html; $('#sheet').hidden = false; $('#sheet .sheet-card').scrollTop = 0; }
function closeSheet() { $('#sheet').hidden = true; $('#sheetBody').innerHTML = ''; delete $('#sheetBody').dataset.cid; render(); }

function contactSheet(id) {
  const c = byId.get(id); if (!c) return;
  const r = S.crm[id] || { status: 'new', hist: [] }, st = r.status || 'new', dnc = st === 'dnc';
  const myJobs = S.jobs.filter(j => j.cid === id);
  openSheet(`<h3>${esc(c.name)}</h3>
  <div class="sub" style="white-space:normal">${esc([c.kind === 'agent' ? c.role : '', c.office || c.company, c.suburb, c.region].filter(Boolean).join(' · '))}</div>
  ${c.address ? `<div class="note" style="margin-top:4px">${esc(c.address)}</div>` : ''}
  ${c.phones && c.phones.includes(';') ? `<div class="note">${esc(c.phones)}</div>` : ''}
  ${dnc ? `<div class="warn" style="margin-top:12px">Marked <b>Do not contact</b>. Contact buttons are hidden. Under the spam law you must not email them again.</div>` : `
  <div class="actions">
    ${c.phone ? `<a class="btn" href="${telHref(c.phone)}" data-call="${id}"><b>✆</b>Call</a>` : c.link ? `<a class="btn" href="${esc(c.link)}" target="_blank" rel="noopener"><b>✆</b>Number</a>` : `<button class="btn" disabled><b>✆</b>Call</button>`}
    ${c.email ? `<button class="btn gold" data-email="${id}"><b>✉</b>Email</button>` : `<button class="btn" disabled title="No published email"><b>✉</b>Email</button>`}
    ${c.phone && /^(\+?64\s?2|02)/.test(c.phone.replace(/\s/g, '')) ? `<a class="btn" href="sms:${c.phone.replace(/[^\d+]/g, '')}" data-sms="${id}"><b>✎</b>Text</a>` : `<button class="btn" disabled><b>✎</b>Text</button>`}
    ${c.link ? `<a class="btn" href="${esc(c.link)}" target="_blank" rel="noopener"><b>↗</b>Profile</a>` : `<button class="btn" disabled><b>↗</b>Profile</button>`}
  </div>
  ${!c.email && c.company === 'Barfoot & Thompson' && c.kind === 'agent' ? `<p class="note" style="margin-top:-4px">Barfoot doesn't publish agent emails. Tap Number to see their mobile on the profile, or email the branch office.</p>` : ''}
  ${c.phone ? `<div class="note">${esc(c.phone)}${c.email ? ' · ' + esc(c.email) : ''}</div>` : c.email ? `<div class="note">${esc(c.email)}</div>` : ''}`}
  <label class="f">Status</label>
  <div class="statuses">${STATUSES.map(([k, l]) => `<button data-st="${k}" class="${st === k ? 'on' : ''}">${l}</button>`).join('')}</div>
  <label class="f" for="listing">Their listing to mention (address)</label>
  <input type="text" id="listing" value="${esc(r.listing || '')}" placeholder="e.g. 12 Example Street, Mt Eden">
  <label class="f" for="due">Remind me on</label>
  <input type="date" id="due" value="${esc(r.due || '')}">
  <label class="f" for="notes">Notes</label>
  <textarea id="notes" placeholder="What they said, best time to call…">${esc(r.notes || '')}</textarea>
  <div class="row" style="margin-top:12px;gap:8px"><button class="btn small" data-newjob="${id}">+ Add job</button><button class="btn small" data-addnote="${id}">+ Log a note</button></div>
  ${myJobs.length ? `<h2>Jobs</h2>` + myJobs.map(j => `<button class="item" data-job="${j.id}"><div class="name">${esc(j.address || 'No address')}</div><div class="sub">${esc(Object.fromEntries(JOB_STATUSES)[j.status])} · ${j.free ? 'Free' : money(j.price)}</div></button>`).join('') : ''}
  <h2>History</h2>
  ${(r.hist || []).slice().reverse().map(h => `<div class="hist"><b>${esc(new Date(h.t).toLocaleString('en-NZ', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }))}</b> · ${esc(h.tx)}</div>`).join('') || '<div class="note">Nothing yet.</div>'}`);
  $('#sheetBody').dataset.cid = id;
}

function emailSheet(id, kindHint) {
  const c = byId.get(id), r = rec(id), st = r.status;
  const kind = kindHint || (st === 'emailed' ? 'follow' : 'first');
  const listing = r.listing || '';
  const t = template(kind, c, listing);
  openSheet(`<h3>Email ${esc(first(c.name) || c.name)}</h3><div class="sub">${esc(c.email)}</div>
  <div class="seg" style="margin-top:12px">${[['first', 'First email'], ['follow', 'Follow-up'], ['blank', 'Blank']].map(([k, l]) => `<button data-tpl="${k}" class="${k === kind ? 'on' : ''}">${l}</button>`).join('')}</div>
  <label class="f" for="elisting">Their listing (makes it personal)</label>
  <input type="text" id="elisting" value="${esc(listing)}" placeholder="e.g. 12 Example Street, Mt Eden">
  ${!listing && kind === 'first' ? `<p class="note" style="margin:6px 0 0">Tip: personalised emails get far more replies. Find one of their current listings first.</p>` : ''}
  ${!S.settings.phone || !S.settings.name ? `<div class="warn" style="margin-top:10px">Add your full name and phone in Settings (⚙︎) so your signature is complete.</div>` : ''}
  <label class="f">Preview</label>
  <div class="preview"><b>${esc(t.subject)}</b>\n\n${esc(t.body)}</div>
  <a class="btn gold" style="width:100%;margin-top:12px" id="sendMail" data-tplkind="${kind}" href="mailto:${encodeURIComponent(c.email)}?subject=${encodeURIComponent(t.subject)}&body=${encodeURIComponent(t.body)}">Open in Mail</a>
  <p class="note" style="margin-top:8px">Opens your mail app with this filled in. Check it, then press send there. We'll log it here.</p>`);
  $('#sheetBody').dataset.cid = id;
}

function callLogSheet(id) {
  const c = byId.get(id);
  openSheet(`<h3>How did the call go?</h3><div class="sub">${esc(c.name)}</div>
  <div style="display:grid;gap:8px;margin-top:14px">
    ${[['noanswer', 'No answer'], ['voicemail', 'Left a voicemail'], ['callback', 'Call back later (remind me in 2 days)'], ['interested', 'Interested 🎉'], ['notint', 'Not interested'], ['dnc', 'Asked not to be contacted']].map(([k, l]) => `<button class="btn" data-outcome="${k}">${l}</button>`).join('')}
    <button class="btn" data-outcome="skip" style="color:var(--muted)">Didn't call</button>
  </div>`);
  $('#sheetBody').dataset.cid = id;
}

function jobSheet(jobId, cid) {
  let j = S.jobs.find(x => x.id === jobId);
  const isNew = !j;
  if (!j) j = { id: 'j' + Date.now().toString(36), cid: cid || '', address: '', date: '', size: 'regular', price: 150, free: !S.jobs.some(x => x.cid === cid) && !!cid, permission: false, status: 'booked', notes: '' };
  const c = byId.get(j.cid);
  openSheet(`<h3>${isNew ? 'New job' : 'Job'}</h3><div class="sub">${c ? esc(c.name + ' · ' + (c.office || c.company)) : 'Not linked to an agent'}</div>
  <form id="jobForm" data-id="${j.id}" data-new="${isNew ? 1 : ''}" data-cid="${esc(j.cid)}">
  <label class="f">Property address</label><input type="text" name="address" value="${esc(j.address)}" required>
  <label class="f">Scan date</label><input type="date" name="date" value="${esc(j.date)}">
  <label class="f">Home size</label><select class="full" name="size"><option value="regular" ${j.size === 'regular' ? 'selected' : ''}>Regular (up to 4 bedrooms)</option><option value="large" ${j.size === 'large' ? 'selected' : ''}>Large (quoted)</option></select>
  <label class="f"><input type="checkbox" name="free" ${j.free ? 'checked' : ''}> Free founding scan</label>
  <label class="f">Price (NZD)</label><input type="number" name="price" inputmode="decimal" value="${esc(j.price)}">
  <label class="f"><input type="checkbox" name="permission" ${j.permission ? 'checked' : ''}> Written permission from agent <b>and</b> vendor to show it on vyra.co.nz</label>
  <label class="f">Status</label><select class="full" name="status">${JOB_STATUSES.map(([k, l]) => `<option value="${k}" ${j.status === k ? 'selected' : ''}>${l}</option>`).join('')}</select>
  <label class="f">Notes</label><textarea name="notes">${esc(j.notes)}</textarea>
  <button class="btn gold" style="width:100%;margin-top:14px">Save job</button>
  ${isNew ? '' : `<button type="button" class="btn danger" style="width:100%;margin-top:8px" data-deljob="${j.id}">Delete job</button>`}
  </form>`);
}

function settingsSheet() {
  const s = S.settings, regions = [...new Set(S.contacts.map(c => c.region))].sort();
  const n = Object.values(S.crm).filter(r => r.status && r.status !== 'new').length;
  openSheet(`<h3>Settings</h3>
  <form id="setForm">
  <label class="f">Your full name (for the email signature)</label><input type="text" name="name" value="${esc(s.name)}" placeholder="Mazin …">
  <label class="f">Your phone</label><input type="tel" name="phone" value="${esc(s.phone)}">
  <label class="f">Your email</label><input type="email" name="email" value="${esc(s.email)}" placeholder="mazin@vyra.co.nz">
  <label class="f">Area you cover (used in the email)</label><input type="text" name="area" value="${esc(s.area)}">
  <label class="f">Home region (Today suggests agents here)</label><select class="full" name="region">${opts(regions, s.region, 'All of Auckland')}</select>
  <label class="f">Daily email goal</label><input type="number" name="goal" min="1" max="30" value="${esc(s.goal)}">
  <button class="btn gold" style="width:100%;margin-top:14px">Save</button></form>
  <h2>Data</h2>
  <p class="note">${S.contacts.length.toLocaleString()} contacts loaded · ${n} contacted · ${S.jobs.length} jobs. Everything is stored only on this phone.</p>
  <div style="display:grid;gap:8px">
    <button class="btn" id="backupBtn">Save a backup file</button>
    <label class="btn">Restore a backup / load a new agent list<input type="file" accept=".json,application/json" id="importFile" hidden></label>
  </div>
  <p class="note" style="margin-top:8px">Make a backup every week or so (save it to Files or iCloud Drive). Loading a new agent list keeps your notes, statuses and jobs.</p>`);
}

/* ---------- import / backup ---------- */
async function importFile(file) {
  let data;
  try { data = JSON.parse(await file.text()); } catch (e) { toast('That file is not a VYRA data file'); return; }
  if (data.format === 'vyra-crm-seed' && Array.isArray(data.contacts)) {
    S.contacts = data.contacts; await DB.set('contacts', S.contacts); index();
    toast(`Loaded ${S.contacts.length.toLocaleString()} contacts`);
  } else if (data.format === 'vyra-crm-backup') {
    if (!confirm('Restore this backup? It replaces the statuses, notes and jobs on this phone.')) return;
    if (Array.isArray(data.contacts) && data.contacts.length) { S.contacts = data.contacts; await DB.set('contacts', S.contacts); index(); }
    S.crm = data.crm || {}; S.jobs = data.jobs || []; Object.assign(S.settings, data.settings || {});
    await Promise.all([saveCrm(), saveJobs(), saveSettings()]);
    toast('Backup restored');
  } else { toast('That file is not a VYRA data file'); return; }
  closeSheet();
}
function backup() {
  const blob = new Blob([JSON.stringify({ format: 'vyra-crm-backup', version: 1, saved: new Date().toISOString(), contacts: S.contacts, crm: S.crm, jobs: S.jobs, settings: S.settings })], { type: 'application/json' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `vyra-crm-backup-${ymd(Date.now())}.json`;
  document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  localStorage.setItem('vyra-last-backup', String(Date.now()));
}

/* ---------- events ---------- */
document.addEventListener('click', e => {
  const t = e.target.closest('button, a, label'); if (!t) return;
  const d = t.dataset, cid = $('#sheetBody').dataset.cid;
  if (d.tab) { S.ui.tab = d.tab; saveUi(); render(); window.scrollTo(0, 0); return; }
  if (d.open) { contactSheet(d.open); return; }
  if (d.kind) { S.ui.kind = d.kind; S.ui.limit = 80; S.ui.status = ''; S.ui.company = ''; saveUi(); render(); return; }
  if (d.toggle) { S.ui[d.toggle] = !S.ui[d.toggle]; S.ui.limit = 80; saveUi(); render(); return; }
  if (t.id === 'more') { S.ui.limit += 120; render(); return; }
  if (t.id === 'settingsBtn') { settingsSheet(); return; }
  if (t.id === 'sheetClose') { closeSheet(); return; }
  if (t.id === 'backupBtn') { backup(); return; }
  if (d.st && cid) {
    if (d.st === 'dnc' && !confirm('Mark as Do not contact? Their email and call buttons will be hidden.')) return;
    setStatus(cid, d.st); contactSheet(cid); return;
  }
  if (d.email) { emailSheet(d.email); return; }
  if (d.tpl && cid) { const l = $('#elisting'); if (l) rec(cid).listing = l.value.trim(); saveCrm(); emailSheet(cid, d.tpl); return; }
  if (t.id === 'sendMail' && cid) {
    const kind = d.tplkind, r = rec(cid);
    log(cid, 'email', kind === 'follow' ? 'Sent follow-up email' : kind === 'first' ? `Sent first email${r.listing ? ' (mentioned ' + r.listing + ')' : ''}` : 'Sent an email');
    if (kind === 'first' && ['new', 'notint'].includes(r.status || 'new')) setStatus(cid, 'emailed');
    if (kind === 'follow' && r.status === 'emailed') setStatus(cid, 'followed');
    setTimeout(() => { contactSheet(cid); toast('Logged. Follow-up reminder set.'); }, 400);
    return; // let the mailto link open
  }
  if (d.call) { const id = d.call; setTimeout(() => callLogSheet(id), 600); return; }
  if (d.sms) { log(d.sms, 'text', 'Sent a text'); return; }
  if (d.outcome && cid) {
    const o = d.outcome, r = rec(cid);
    if (o === 'skip') { contactSheet(cid); return; }
    const txt = { noanswer: 'Called, no answer', voicemail: 'Called, left a voicemail', callback: 'Called, they asked me to call back', interested: 'Called, interested', notint: 'Called, not interested', dnc: 'Called, asked not to be contacted' }[o];
    log(cid, 'call', txt);
    if (o === 'interested') setStatus(cid, 'interested');
    else if (o === 'notint') setStatus(cid, 'notint');
    else if (o === 'dnc') setStatus(cid, 'dnc');
    else { if (['new', 'emailed', 'followed'].includes(r.status || 'new')) setStatus(cid, 'called'); if (o === 'callback' || o === 'voicemail') { r.due = ymd(today0() + 2 * DAY); saveCrm(); } }
    contactSheet(cid); toast('Call logged'); return;
  }
  if (d.addnote && cid) { const tx = prompt('Note'); if (tx) { log(cid, 'note', tx); contactSheet(cid); } return; }
  if (d.newjob !== undefined) { jobSheet(null, d.newjob || cid || ''); return; }
  if (d.job) { jobSheet(d.job); return; }
  if (d.deljob) { if (confirm('Delete this job?')) { S.jobs = S.jobs.filter(j => j.id !== d.deljob); saveJobs(); closeSheet(); } return; }
});

document.addEventListener('change', e => {
  const t = e.target, cid = $('#sheetBody').dataset.cid;
  if (t.id === 'importFile' && t.files[0]) { importFile(t.files[0]); return; }
  if (t.dataset.f) { S.ui[t.dataset.f] = t.value; S.ui.limit = 80; saveUi(); render(); return; }
  if (cid && ['listing', 'due', 'notes'].includes(t.id)) {
    const r = rec(cid), v = t.value.trim();
    if (t.id === 'due') { r.due = v; if (v) log(cid, 'note', `Reminder set for ${fmtDate(parseYmd(v))}`); } else r[t.id] = v;
    saveCrm(); if (t.id === 'due') contactSheet(cid); return;
  }
  if (t.id === 'elisting' && cid) { rec(cid).listing = t.value.trim(); saveCrm(); const kind = $('#sendMail').dataset.tplkind; emailSheet(cid, kind); }
});

let qTimer;
document.addEventListener('input', e => {
  if (e.target.id === 'q') {
    clearTimeout(qTimer); const v = e.target.value;
    qTimer = setTimeout(() => { S.ui.q = v; S.ui.limit = 80; saveUi(); render(); const q = $('#q'); q.focus(); q.setSelectionRange(v.length, v.length); }, 200);
  }
});

document.addEventListener('submit', e => {
  e.preventDefault(); const f = e.target, fd = Object.fromEntries(new FormData(f));
  if (f.id === 'setForm') {
    Object.assign(S.settings, { name: fd.name.trim(), phone: fd.phone.trim(), email: fd.email.trim(), area: fd.area.trim() || 'Auckland', region: fd.region, goal: Math.max(1, Math.min(30, Number(fd.goal) || 5)) });
    saveSettings(); S.ui.region = S.settings.region; saveUi(); toast('Saved'); closeSheet(); return;
  }
  if (f.id === 'jobForm') {
    const j = { id: f.dataset.id, cid: f.dataset.cid, address: fd.address.trim(), date: fd.date, size: fd.size, free: !!fd.free, price: fd.free ? 0 : Number(fd.price) || 0, permission: !!fd.permission, status: fd.status, notes: fd.notes };
    const i = S.jobs.findIndex(x => x.id === j.id), prev = S.jobs[i];
    if (i >= 0) S.jobs[i] = j; else S.jobs.push(j);
    saveJobs();
    if (j.cid) {
      if (!prev) log(j.cid, 'job', `Job added: ${j.address}${j.date ? ' on ' + fmtDate(parseYmd(j.date)) : ''}`);
      else if (prev.status !== j.status) log(j.cid, 'job', `${j.address}: ${Object.fromEntries(JOB_STATUSES)[j.status]}`);
      const st = status(j.cid);
      if (j.status === 'booked' && !['scanned', 'client'].includes(st)) setStatus(j.cid, 'booked');
      if (['scanned', 'delivered'].includes(j.status) && st !== 'client') setStatus(j.cid, 'scanned');
      if (j.status === 'paid' && !j.free) setStatus(j.cid, 'client');
    }
    toast('Job saved'); closeSheet();
  }
});

$('#sheet').addEventListener('click', e => { if (e.target.id === 'sheet') closeSheet(); });

/* ---------- start ---------- */
load().then(() => {
  render();
  const lb = Number(localStorage.getItem('vyra-last-backup') || 0);
  if (Object.keys(S.crm).length > 5 && Date.now() - lb > 7 * DAY) setTimeout(() => toast('Tip: save a backup in Settings'), 1500);
}).catch(err => { $('#view').innerHTML = `<div class="warn">Could not open storage on this device: ${esc(err && err.message)}</div>`; });
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
