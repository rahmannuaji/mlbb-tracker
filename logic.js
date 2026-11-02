// Fungsi murni: hitungan WR, kelompok role, validasi data. Tanpa DOM.

export const ROLES = ['Tank', 'Fighter', 'Assassin', 'Mage', 'Marksman', 'Support'];
export const OVERALL = '_overall';

export const wins = (matches, wr) => Math.round((matches * wr) / 100);

// Kemenangan beruntun yang dibutuhkan supaya WR ≥ target (persen).
// null = tidak mungkin (target 100% tapi sudah pernah kalah).
export function winsNeeded(matches, wr, target) {
  if (target <= 0) return 0;
  if (matches === 0) return 1;
  const w = wins(matches, wr);
  if (w * 100 >= target * matches) return 0;
  if (target >= 100) return null;
  // -1e-9: target desimal (mis. 55.5) bisa memberi 25.0000000001 → jangan dibulatkan jadi 26
  return Math.ceil((target * matches - 100 * w) / (100 - target) - 1e-9);
}

// Hero dengan 2 role masuk ke 2 grup. Urutan grup mengikuti ROLES, hero urut nama.
export function groupByRole(heroes) {
  const groups = new Map([...ROLES, 'Lainnya'].map((r) => [r, []]));
  for (const h of heroes) {
    const roles = h.roles.filter((r) => groups.has(r) && r !== 'Lainnya');
    for (const r of roles.length ? roles : ['Lainnya']) groups.get(r).push(h);
  }
  for (const list of groups.values()) list.sort((a, b) => a.name.localeCompare(b.name));
  return [...groups].filter(([, list]) => list.length);
}

// null kalau valid, selain itu pesan error untuk ditampilkan.
export function validateStat(matches, wr) {
  if (!Number.isInteger(matches) || matches < 0) return 'Jumlah match harus bilangan bulat ≥ 0';
  if (!Number.isFinite(wr) || wr < 0 || wr > 100) return 'WR harus antara 0 dan 100';
  if (matches === 0 && wr !== 0) return 'Belum ada match, WR harus 0';
  return null;
}

// Validasi file import / isi localStorage. Lempar Error kalau rusak.
// Versi 1 (masih ada Season Ini / Semua Season) → diambil data "Semua Season" saja.
export function validateData(data, heroIds) {
  if (data?.version === 1 && data.stats) data = { version: 2, stats: data.stats.all ?? {} };
  if (!data || data.version !== 2 || !data.stats) throw new Error('Format file tidak dikenal');
  const known = new Set([...heroIds, OVERALL]);
  for (const [id, s] of Object.entries(data.stats)) {
    if (!known.has(id)) throw new Error(`Hero tidak dikenal: ${id}`);
    const err = validateStat(s?.matches, s?.wr);
    if (err) throw new Error(`${id}: ${err}`);
  }
  return { version: 2, stats: data.stats };
}
