// MLBB Tracker — backend Google Apps Script (terikat ke spreadsheet).
// Setup: lihat README.md bagian 2. Jalankan setup() sekali, lalu Deploy → Web app.
//
// Satu aksi saja: POST {action:"sync", user, token, rows:[{hero_id, matches, wr}], deletes:[hero_id]}
// → tulis rows (upsert) + hapus deletes milik user itu, lalu balas semua baris user itu.
// Body dikirim sebagai text/plain supaya browser tidak mengirim preflight (Apps Script tidak menjawab OPTIONS).

const STATS = 'stats';
const USERS = 'users';
const ID_RE = /^(_overall|[a-z0-9-]{1,40})$/;

// Jalankan sekali dari editor: buat tab + user pertama "me" dengan token acak.
// Sengaja paling atas supaya jadi fungsi yang terpilih di dropdown Run.
function setup() {
  const ss = SpreadsheetApp.getActive();
  if (!ss) throw new Error('Script tidak terhubung ke spreadsheet. Buka spreadsheet → Extensions → Apps Script, tempel kode di sana.');
  ensureSheet(ss, STATS, ['user_id', 'hero_id', 'matches', 'wr', 'updated_at']);
  const users = ensureSheet(ss, USERS, ['user_id', 'token']);
  if (users.getLastRow() === 1) users.appendRow(['me', newToken()]);
  Logger.log('Selesai. User & token ada di tab "users": ' + JSON.stringify(users.getRange(2, 1, 1, 2).getValues()[0]));
}

// Untuk menambah teman: jalankan, salin token dari log ke baris baru di tab "users".
function newToken() {
  const token = Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, '');
  Logger.log(token);
  return token;
}

function ensureSheet(ss, name, header) {
  const sheet = ss.getSheetByName(name) || ss.insertSheet(name);
  if (sheet.getLastRow() === 0) sheet.appendRow(header);
  sheet.getRange('A:B').setNumberFormat('@'); // user_id & hero_id selalu teks
  return sheet;
}

function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);
    if (body.action !== 'sync') throw new Error('Aksi tidak dikenal');
    const ss = SpreadsheetApp.getActive();
    authorize(ss, body.user, body.token);
    const rows = (body.rows || []).map(validRow);
    const deletes = (body.deletes || []).map(validId);

    const lock = LockService.getScriptLock();
    lock.waitLock(10000);
    try {
      const sheet = ss.getSheetByName(STATS);
      write(sheet, body.user, rows, deletes);
      return json({ ok: true, rows: read(sheet, body.user) });
    } finally {
      lock.releaseLock();
    }
  } catch (err) {
    return json({ ok: false, error: String(err && err.message || err) });
  }
}

function doGet() {
  return json({ ok: true, app: 'mlbb-tracker' });
}

function authorize(ss, user, token) {
  const ok = typeof user === 'string' && typeof token === 'string' && token.length >= 20 &&
    ss.getSheetByName(USERS).getDataRange().getValues().slice(1)
      .some((r) => String(r[0]) === user && String(r[1]) === token);
  if (!ok) throw new Error('unauthorized');
}

function validId(id) {
  if (typeof id !== 'string' || !ID_RE.test(id)) throw new Error('hero_id tidak valid: ' + id);
  return id;
}

// Aturan sama dengan validateStat() di logic.js
function validRow(r) {
  const id = validId(r && r.hero_id);
  const { matches, wr } = r;
  if (!Number.isInteger(matches) || matches < 0) throw new Error(id + ': match harus bilangan bulat ≥ 0');
  if (typeof wr !== 'number' || !isFinite(wr) || wr < 0 || wr > 100) throw new Error(id + ': WR harus 0–100');
  if (matches === 0 && wr !== 0) throw new Error(id + ': belum ada match, WR harus 0');
  return { hero_id: id, matches, wr };
}

function write(sheet, user, rows, deletes) {
  const index = new Map(); // hero_id → nomor baris (1-based)
  sheet.getDataRange().getValues().forEach((r, i) => {
    if (i > 0 && String(r[0]) === user) index.set(String(r[1]), i + 1);
  });
  const now = new Date().toISOString();
  for (const r of rows) {
    const values = [user, r.hero_id, r.matches, r.wr, now];
    const at = index.get(r.hero_id);
    if (at) sheet.getRange(at, 1, 1, 5).setValues([values]);
    else { sheet.appendRow(values); index.set(r.hero_id, sheet.getLastRow()); }
  }
  // Hapus dari bawah supaya nomor baris di atasnya tidak bergeser
  deletes.map((id) => index.get(id)).filter(Boolean).sort((a, b) => b - a)
    .forEach((at) => sheet.deleteRow(at));
}

function read(sheet, user) {
  return sheet.getDataRange().getValues().slice(1)
    .filter((r) => String(r[0]) === user)
    .map((r) => ({
      hero_id: String(r[1]),
      matches: Number(r[2]),
      wr: Number(r[3]),
      updatedAt: r[4] instanceof Date ? r[4].toISOString() : String(r[4]),
    }));
}

function json(data) {
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
}
