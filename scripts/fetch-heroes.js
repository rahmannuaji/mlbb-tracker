// Ambil daftar hero dari Mobile Legends Wiki (Fandom) → heroes.json
// Jalankan: node scripts/fetch-heroes.js
import { writeFileSync } from 'node:fs';

const API = 'https://mobile-legends.fandom.com/api.php?action=parse&page=List_of_heroes&prop=text&format=json&formatversion=2';
const OUT = new URL('../heroes.json', import.meta.url);

const res = await fetch(API, { headers: { 'User-Agent': 'mlbb-tracker/1.0 (personal win-rate tracker)' } });
if (!res.ok) throw new Error(`HTTP ${res.status}`);
const html = (await res.json()).parse.text;

const text = (s) => s.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&#39;/g, "'").trim();
const splitList = (s) => text(s).split('/').map((x) => x.trim()).filter(Boolean);

const heroes = [];
for (const row of html.split('<tr').slice(1)) {
  const cells = [...row.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map((m) => m[1]);
  // kolom: checkbox · ikon · nama · no · role · specialty · lane · region · harga · tahun
  if (cells.length < 7) continue;
  const href = cells[1].match(/href="\/wiki\/([^"]+)"/);
  const img = cells[1].match(/data-src="([^"]+)"/) || cells[1].match(/src="(https:[^"]+)"/);
  const name = cells[2].match(/<b>([^<]+?),?<\/b>/);
  if (!href || !img || !name) continue;
  heroes.push({
    id: decodeURIComponent(href[1]).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
    name: name[1].replace(/,$/, '').trim(),
    roles: splitList(cells[4]),
    lanes: splitList(cells[6]),
    img: img[1].replace(/\/scale-to-width-down\/\d+/, '/scale-to-width-down/100'),
  });
}

// Struktur wiki berubah → jangan timpa heroes.json yang lama
if (heroes.length < 100) {
  console.error(`Hanya ${heroes.length} hero terbaca — struktur wiki berubah? heroes.json tidak diubah.`);
  process.exit(1);
}
const ids = new Set(heroes.map((h) => h.id));
if (ids.size !== heroes.length) {
  console.error('Ada id hero duplikat. heroes.json tidak diubah.');
  process.exit(1);
}

writeFileSync(OUT, JSON.stringify(heroes, null, 1) + '\n');
console.log(`${heroes.length} hero → heroes.json`);
