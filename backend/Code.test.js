// Cek Code.gs tanpa Google: SpreadsheetApp dkk diganti tiruan sederhana.
// node backend/Code.test.js
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import vm from 'node:vm';

function fakeSheet() {
  const data = [];
  return {
    data,
    getDataRange: () => ({ getValues: () => data.map((r) => [...r]) }),
    getRange: (row, col, nr, nc) => ({
      setValues: (v) => { data[row - 1].splice(col - 1, nc, ...v[0]); },
      getValues: () => [data[row - 1].slice(col - 1, col - 1 + nc)],
      setNumberFormat: () => {},
    }),
    appendRow: (r) => data.push([...r]),
    getLastRow: () => data.length,
    deleteRow: (n) => data.splice(n - 1, 1),
  };
}

const sheets = {};
const ctx = {
  SpreadsheetApp: { getActive: () => ({ getSheetByName: (n) => sheets[n], insertSheet: (n) => (sheets[n] = fakeSheet()) }) },
  LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
  ContentService: { MimeType: { JSON: 'json' }, createTextOutput: (s) => ({ setMimeType: () => JSON.parse(s) }) },
  Utilities: { getUuid: randomUUID },
  Logger: { log() {} },
};
vm.createContext(ctx);
vm.runInContext(readFileSync(new URL('./Code.gs', import.meta.url), 'utf8'), ctx);

ctx.setup();
ctx.setup(); // aman dijalankan ulang
assert.equal(sheets.users.data.length, 2);
const [, [user, token]] = sheets.users.data;
assert.equal(user, 'me');

const post = (body) => ctx.doPost({ postData: { contents: JSON.stringify({ action: 'sync', user, token, ...body }) } });

// auth
assert.deepEqual(post({ token: 'x'.repeat(32) }), { ok: false, error: 'unauthorized' });
assert.deepEqual(post({ user: 'other' }), { ok: false, error: 'unauthorized' });

// list kosong
assert.deepEqual(post({}), { ok: true, rows: [] });

// upsert
let r = post({ rows: [{ hero_id: 'miya', matches: 100, wr: 50 }, { hero_id: '_overall', matches: 500, wr: 52.5 }] });
assert.equal(r.ok, true);
assert.deepEqual(r.rows.map((x) => [x.hero_id, x.matches, x.wr]), [['miya', 100, 50], ['_overall', 500, 52.5]]);

// update baris yang sama, tidak menambah baris
r = post({ rows: [{ hero_id: 'miya', matches: 110, wr: 52 }] });
assert.equal(sheets.stats.data.length, 3);
assert.deepEqual(r.rows.find((x) => x.hero_id === 'miya').matches, 110);

// baris user lain tidak terbaca & tidak terhapus
sheets.stats.appendRow(['andi', 'miya', 5, 40, '']);
r = post({ rows: [{ hero_id: 'layla', matches: 3, wr: 33.3 }], deletes: ['miya', '_overall'] });
assert.deepEqual(r.rows.map((x) => x.hero_id), ['layla']);
assert.deepEqual(sheets.stats.data.map((x) => x[0] + ':' + x[1]), ['user_id:hero_id', 'andi:miya', 'me:layla']);

// validasi: satu baris salah → tidak ada yang ditulis
const before = JSON.stringify(sheets.stats.data);
for (const bad of [
  { rows: [{ hero_id: 'ok', matches: 1, wr: 0 }, { hero_id: 'zz', matches: -1, wr: 0 }] },
  { rows: [{ hero_id: 'zz', matches: 1.5, wr: 0 }] },
  { rows: [{ hero_id: 'zz', matches: 1, wr: 101 }] },
  { rows: [{ hero_id: 'zz', matches: 0, wr: 50 }] },
  { rows: [{ hero_id: '=HYPERLINK("x")', matches: 1, wr: 0 }] },
  { deletes: [123] },
]) assert.equal(post(bad).ok, false, JSON.stringify(bad));
assert.equal(JSON.stringify(sheets.stats.data), before);

assert.equal(ctx.doPost({ postData: { contents: 'bukan json' } }).ok, false);
assert.equal(post({ action: 'drop' }).ok, false);

console.log('Code.test.js: semua lolos');
