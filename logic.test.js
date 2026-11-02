// node logic.test.js
import assert from 'node:assert/strict';
import { wins, winsNeeded, groupByRole, validateStat, validateData } from './logic.js';

// wins
assert.equal(wins(120, 56.7), 68);
assert.equal(wins(0, 0), 0);

// winsNeeded — cek hasil benar-benar mencapai target dan x-1 belum
const reaches = (m, w, t, x) => (w + x) * 100 >= t * (m + x);
for (const [m, wr, t] of [[100, 50, 60], [200, 50, 55.5], [37, 45.9, 50], [1000, 49.9, 50], [3, 66.67, 75]]) {
  const x = winsNeeded(m, wr, t);
  const w = wins(m, wr);
  assert.ok(reaches(m, w, t, x), `${m}/${wr}→${t}: ${x} belum cukup`);
  assert.ok(x === 0 || !reaches(m, w, t, x - 1), `${m}/${wr}→${t}: ${x} kebanyakan`);
}
assert.equal(winsNeeded(100, 50, 60), 25);   // 75/125 = 60%
assert.equal(winsNeeded(100, 60, 55), 0);    // sudah tercapai
assert.equal(winsNeeded(100, 60, 100), null); // sudah pernah kalah
assert.equal(winsNeeded(10, 100, 100), 0);
assert.equal(winsNeeded(0, 0, 70), 1);
assert.equal(winsNeeded(50, 40, 0), 0);

// groupByRole
const g = groupByRole([
  { id: 'b', name: 'Balmond', roles: ['Fighter'] },
  { id: 'a', name: 'Alucard', roles: ['Fighter', 'Assassin'] },
  { id: 't', name: 'Tigreal', roles: ['Tank'] },
  { id: 'x', name: 'Xyz', roles: [] },
]);
assert.deepEqual(g.map(([r, l]) => [r, l.map((h) => h.id)]), [
  ['Tank', ['t']], ['Fighter', ['a', 'b']], ['Assassin', ['a']], ['Lainnya', ['x']],
]);

// validateStat
assert.equal(validateStat(10, 50), null);
assert.ok(validateStat(-1, 50));
assert.ok(validateStat(1.5, 50));
assert.ok(validateStat(10, 101));
assert.ok(validateStat(10, NaN));
assert.ok(validateStat(0, 50));

// validateData
const ok = validateData({ version: 2, stats: { miya: { matches: 5, wr: 60 } } }, ['miya']);
assert.deepEqual(ok, { version: 2, stats: { miya: { matches: 5, wr: 60 } } });
// versi 1 → ambil "Semua Season", buang "Season Ini"
const v1 = validateData({ version: 1, scope: 'season', stats: { season: { miya: { matches: 1, wr: 0 } }, all: { miya: { matches: 5, wr: 60 } } } }, ['miya']);
assert.deepEqual(v1, { version: 2, stats: { miya: { matches: 5, wr: 60 } } });
assert.throws(() => validateData({ version: 3, stats: {} }, []));
assert.throws(() => validateData({ version: 2, stats: { zzz: { matches: 1, wr: 0 } } }, ['miya']));
assert.throws(() => validateData({ version: 2, stats: { miya: { matches: 1, wr: 200 } } }, ['miya']));

console.log('logic.test.js: semua lolos');
