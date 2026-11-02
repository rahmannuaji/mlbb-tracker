import { OVERALL, wins, winsNeeded, groupByRole, validateStat, validateData } from './logic.js';

const KEY = 'mlbb:v1';
const CONN_KEY = 'mlbb:conn';       // { url, user, token } Web App Apps Script
const PENDING_KEY = 'mlbb:pending'; // hero_id yang berubah tapi belum terkirim ke sheet

const heroes = await (await fetch('heroes.json')).json();
const byId = new Map(heroes.map((h) => [h.id, h]));
const groups = groupByRole(heroes);

const $ = (sel) => document.querySelector(sel);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const pct = (wr) => `${wr.toLocaleString('id-ID', { maximumFractionDigits: 2 })}%`;
const num = (n) => n.toLocaleString('id-ID');
const wrClass = (wr) => (wr >= 55 ? 'good' : wr >= 50 ? 'mid' : 'bad');
// "56,7" dan "56.7" sama-sama diterima; kosong → NaN (Number('') = 0)
const parseNum = (s) => (String(s).trim() === '' ? NaN : Number(String(s).trim().replace(',', '.')));
const readJSON = (key) => { try { return JSON.parse(localStorage.getItem(key)); } catch { return null; } };

let state = load();
let conn = readJSON(CONN_KEY);
const pending = new Set(readJSON(PENDING_KEY) ?? []);

function load() {
  const empty = { version: 2, stats: {} };
  let raw;
  try {
    raw = localStorage.getItem(KEY);
    if (!raw) return empty;
    const data = JSON.parse(raw);
    // Versi 1 masih punya data "Season Ini" yang akan dibuang → simpan salinan dulu
    if (data.version === 1) localStorage.setItem(`${KEY}:backup`, raw);
    return validateData(data, byId.keys());
  } catch (err) {
    // Jangan sampai data lama tertimpa diam-diam: simpan cadangan dulu
    try { if (raw) localStorage.setItem(`${KEY}:backup`, raw); } catch {}
    if (raw) alert(`Data tersimpan tidak bisa dibaca (${err.message}). Cadangan disimpan di "${KEY}:backup".`);
    return empty;
  }
}

function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
    localStorage.setItem(PENDING_KEY, JSON.stringify([...pending]));
  } catch {
    alert('Gagal menyimpan di browser ini. Pakai Export JSON supaya data tidak hilang.');
  }
}

// Setiap perubahan data lewat sini: simpan lokal dulu, lalu kirim ke sheet.
function change(ids) {
  for (const id of ids) pending.add(id);
  save();
  render();
  sync();
}

// ---------- Sinkron Google Sheets ----------

async function api(body) {
  let res;
  try {
    res = await fetch(conn.url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action: 'sync', user: conn.user, token: conn.token, ...body }),
    });
  } catch {
    throw new Error('Tidak bisa terhubung. Cek internet & URL Web App.');
  }
  const data = await res.json().catch(() => {
    throw new Error('Balasan bukan JSON. Cek URL & akses Web App "Anyone".');
  });
  if (!data.ok) throw new Error(data.error === 'unauthorized' ? 'User ID atau token salah.' : data.error);
  return data.rows;
}

let busy = false;
let again = false;

// Kirim semua yang pending, lalu ambil data terbaru dari sheet. true kalau berhasil.
async function sync() {
  if (!conn) { setStatus('Lokal'); return false; }
  if (busy) { again = true; return false; }
  busy = true;
  setStatus('Menyinkron…');
  const sent = new Map([...pending].map((id) => [id, JSON.stringify(state.stats[id] ?? null)]));
  try {
    const rows = await api({
      rows: [...sent.keys()].filter((id) => state.stats[id])
        .map((id) => ({ hero_id: id, matches: state.stats[id].matches, wr: state.stats[id].wr })),
      deletes: [...sent.keys()].filter((id) => !state.stats[id]),
    });
    // Yang diubah lagi selama request berjalan tetap pending
    for (const [id, json] of sent) if (JSON.stringify(state.stats[id] ?? null) === json) pending.delete(id);
    const fresh = {};
    for (const r of rows) {
      if (byId.has(r.hero_id) || r.hero_id === OVERALL) fresh[r.hero_id] = { matches: r.matches, wr: r.wr, updatedAt: r.updatedAt };
    }
    for (const id of pending) {
      if (state.stats[id]) fresh[id] = state.stats[id];
      else delete fresh[id];
    }
    state.stats = fresh;
    save();
    render();
    setStatus('Tersinkron', 'ok');
    return true;
  } catch (err) {
    setStatus('Gagal sinkron', 'error', err.message);
    return false;
  } finally {
    busy = false;
    if (again) { again = false; sync(); }
  }
}

function setStatus(label, kind = '', detail = '') {
  const b = $('#sync');
  b.textContent = label;
  b.dataset.kind = kind;
  b.title = detail;
  $('#conn-error').textContent = kind === 'error' ? detail : '';
}

// ---------- Render ----------

function render() {
  renderSummary();
  renderGrid();
}

function renderSummary() {
  const s = state.stats[OVERALL];
  const played = Object.keys(state.stats).filter((id) => id !== OVERALL).length;
  $('#summary').innerHTML = `
    <div><span class="stat-label">Total match</span><span class="stat-value">${s ? num(s.matches) : '—'}</span></div>
    <div><span class="stat-label">Win rate</span><span class="stat-value ${s ? wrClass(s.wr) : ''}">${s ? pct(s.wr) : '—'}</span></div>
    <div><span class="stat-label">Hero dicatat</span><span class="stat-value">${played}</span></div>
    <span class="summary-hint">${s ? 'Ringkasan akun · ketuk untuk ubah' : 'Ketuk untuk isi total match & WR dari profil'}</span>`;
}

function renderGrid() {
  const q = $('#search').value.trim().toLowerCase();
  let shown = 0;
  $('#groups').innerHTML = groups.map(([role, list]) => {
    const visible = list.filter((h) => h.name.toLowerCase().includes(q));
    if (!visible.length) return '';
    shown += visible.length;
    const played = list.filter((h) => state.stats[h.id]).length;
    return `<section class="role">
      <h2>${esc(role)} <small>${played}/${list.length} dimainkan</small></h2>
      <div class="grid">${visible.map(heroTile).join('')}</div>
    </section>`;
  }).join('');
  $('#empty').hidden = shown > 0;
}

function heroTile(h) {
  const s = state.stats[h.id];
  return `<button class="hero ${s ? '' : 'unplayed'}" data-id="${esc(h.id)}" aria-label="${esc(h.name)}${s ? `, WR ${pct(s.wr)}` : ', belum ada data'}">
    <img src="${esc(h.img)}" alt="" loading="lazy" referrerpolicy="no-referrer" width="100" height="100">
    ${s ? `<span class="badge ${wrClass(s.wr)}">${Math.round(s.wr)}%</span>` : ''}
    <span class="hero-name">${esc(h.name)}</span>
  </button>`;
}

function openDetail(id) {
  renderDetail(id);
  if (!$('#detail').open) $('#detail').showModal();
}

function renderDetail(id) {
  const hero = byId.get(id);
  const s = state.stats[id];
  const title = hero ? hero.name : 'Ringkasan Akun';
  const sub = hero ? [hero.roles.join('/'), hero.lanes.join('/')].filter(Boolean).join(' · ') : 'Total semua hero';

  $('#detail-body').innerHTML = `
    <div class="detail-head">
      ${hero ? `<img src="${esc(hero.img)}" alt="" referrerpolicy="no-referrer">` : ''}
      <div><h2 id="detail-name">${esc(title)}</h2><p>${esc(sub)}</p></div>
    </div>
    ${s ? `
      <div class="stats">
        <div><span class="stat-label">Match</span><span class="stat-value">${num(s.matches)}</span></div>
        <div><span class="stat-label">WR</span><span class="stat-value ${wrClass(s.wr)}">${pct(s.wr)}</span></div>
        <div><span class="stat-label">Menang</span><span class="stat-value">${num(wins(s.matches, s.wr))}</span></div>
      </div>
      <div class="target">
        <label>Target WR <input id="target" class="num" inputmode="decimal" value="${Math.min(100, (Math.floor(s.wr / 5) + 1) * 5)}"> %</label>
        <p id="target-result" class="target-result" aria-live="polite"></p>
      </div>` : '<p class="muted">Belum ada data. Isi dari profil in-game.</p>'}
    <form id="edit">
      <div class="fields">
        <label class="field"><span>Jumlah match</span><input name="matches" class="num" inputmode="numeric" value="${s ? s.matches : ''}" required></label>
        <label class="field"><span>WR (%)</span><input name="wr" class="num" inputmode="decimal" value="${s ? s.wr : ''}" required></label>
      </div>
      <p class="form-error" aria-live="polite"></p>
      <div class="form-actions">
        ${s ? '<button type="button" class="btn danger" id="delete">Hapus data</button>' : '<span></span>'}
        <button class="btn primary">Simpan</button>
      </div>
    </form>`;

  if (s) {
    const update = () => { $('#target-result').innerHTML = targetText(s, parseNum($('#target').value)); };
    $('#target').addEventListener('input', update);
    update();
    $('#delete').addEventListener('click', () => {
      if (!confirm(`Hapus data ${title}?`)) return;
      delete state.stats[id];
      change([id]);
      $('#detail').close();
    });
  }

  $('#edit').addEventListener('submit', (e) => {
    e.preventDefault();
    const form = e.target;
    const matches = parseNum(form.matches.value);
    const wr = parseNum(form.wr.value);
    const err = validateStat(matches, wr);
    if (err) { form.querySelector('.form-error').textContent = err; return; }
    state.stats[id] = { matches, wr, updatedAt: new Date().toISOString() };
    change([id]);
    renderDetail(id);
  });
}

function targetText(s, target) {
  if (!Number.isFinite(target) || target < 0 || target > 100) return 'Isi target antara 0 dan 100.';
  const n = winsNeeded(s.matches, s.wr, target);
  if (n === null) return 'Tidak mungkin: sudah pernah kalah, WR tidak bisa 100%.';
  if (n === 0) return 'Target sudah tercapai.';
  return `Butuh <strong>${num(n)}</strong> kemenangan beruntun lagi<br><span class="muted small">jadi ${num(s.matches + n)} match total</span>`;
}

// ---------- Event ----------

$('#search').addEventListener('input', renderGrid);
$('#summary').addEventListener('click', () => openDetail(OVERALL));
$('#groups').addEventListener('click', (e) => {
  const tile = e.target.closest('.hero');
  if (tile) openDetail(tile.dataset.id);
});

$('#sync').addEventListener('click', () => {
  const f = $('#conn-form');
  f.url.value = conn?.url ?? '';
  f.user.value = conn?.user ?? '';
  f.token.value = conn?.token ?? '';
  $('#disconnect').hidden = !conn;
  $('#settings').showModal();
});
$('#conn-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const f = e.target;
  const next = { url: f.url.value.trim(), user: f.user.value.trim(), token: f.token.value.trim() };
  if (!/^https:\/\/script\.google\.com\/.+\/exec$/.test(next.url)) {
    $('#conn-error').textContent = 'URL harus berbentuk https://script.google.com/macros/s/…/exec';
    return;
  }
  // Pertama kali tersambung: semua data lokal ikut dikirim ke sheet
  if (!conn) for (const id of Object.keys(state.stats)) pending.add(id);
  conn = next;
  localStorage.setItem(CONN_KEY, JSON.stringify(conn));
  save();
  if (await sync()) $('#settings').close();
});
$('#disconnect').addEventListener('click', () => {
  if (!confirm('Putuskan dari Google Sheets? Data di browser ini tetap ada.')) return;
  conn = null;
  localStorage.removeItem(CONN_KEY);
  pending.clear();
  save();
  setStatus('Lokal');
  $('#settings').close();
});
window.addEventListener('online', sync);

$('#export').addEventListener('click', () => {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
  const a = Object.assign(document.createElement('a'), {
    href: URL.createObjectURL(blob),
    download: `mlbb-tracker-${new Date().toISOString().slice(0, 10)}.json`,
  });
  a.click();
  URL.revokeObjectURL(a.href);
});
$('#import').addEventListener('click', () => $('#import-file').click());
$('#import-file').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  e.target.value = '';
  if (!file) return;
  try {
    const data = validateData(JSON.parse(await file.text()), byId.keys());
    if (!confirm('Import akan mengganti semua data sekarang. Lanjut?')) return;
    const ids = [...Object.keys(state.stats), ...Object.keys(data.stats)];
    state = data;
    change(ids);
  } catch (err) {
    alert(`Import gagal: ${err.message}`);
  }
});

render();
sync();
