# MLBB Tracker

Catat match & win rate (WR) hero Mobile Legends, lalu lihat **berapa kemenangan beruntun yang dibutuhkan** untuk mencapai target WR.

**Website:** <https://mlbbrtrackerwr.netlify.app>

Data diisi manual dari profil in-game. Tanpa setup apa pun, data tersimpan di browser saja.
Supaya data aman dan sama di HP & laptop, sambungkan ke Google Sheets (sekali, ±10 menit) — lihat bagian 2.

---

## 1. Cara pakai website

1. Buka <https://mlbbrtrackerwr.netlify.app>.
2. **Ringkasan akun** — ketuk kotak paling atas, isi total match & WR dari profil MLBB → **Simpan**.
3. **Data hero** — cari hero (kolom pencarian) atau ketuk gambarnya di grup role-nya.
   Isi **jumlah match** dan **WR (%)** persis seperti di game → **Simpan**.
   Hero yang sudah diisi tampil terang dengan badge WR (hijau ≥ 55%, kuning 50–55%, merah < 50%).
4. **Target WR** — ketuk hero yang sudah diisi, ubah angka *Target WR*.
   Website menghitung: *"Butuh **N** kemenangan beruntun lagi"*.
5. Perbarui angka kapan saja: ketuk hero → ganti → **Simpan**. Hapus: ketuk hero → **Hapus data**.

Tips:
- **Pasang di layar utama HP:** Chrome → ⋮ → *Add to Home screen*. Safari → Share → *Add to Home Screen*.
- **Cadangan:** tombol **Export JSON** di bawah halaman menyimpan semua data ke file; **Import JSON** untuk memulihkan.
- WR boleh ditulis `56,7` atau `56.7`.

---

## 2. Setup Google Sheets (sekali saja)

Hasil akhirnya: **URL Web App** + **User ID** + **Token** yang dimasukkan ke website.

### 2.1 Buat spreadsheet & script

1. Buka <https://sheets.new> → beri nama, mis. **MLBB Tracker DB**.
2. Di spreadsheet itu: menu **Extensions → Apps Script**.
   > Harus dari dalam spreadsheet. Script yang dibuat langsung dari script.google.com tidak terhubung ke sheet.
3. Hapus semua isi editor → tempel seluruh isi file [`backend/Code.gs`](backend/Code.gs) → **Save** (💾).

### 2.2 Jalankan `setup` → dapat User ID & Token

1. Di toolbar atas editor, pastikan dropdown fungsi menampilkan **`setup`** → klik **Run**.
2. Pertama kali, Google minta izin: **Review permissions** → pilih akunmu → **Advanced** → **Go to … (unsafe)** → **Allow**.
   (Peringatan ini muncul karena script buatanmu sendiri belum diverifikasi Google — aman.)
3. Lihat **Execution log** di bawah editor:
   ```
   Selesai. User & token ada di tab "users": ["me","3f9a8c…"]
   ```
4. Di spreadsheet (kiri bawah) sekarang ada tab **`stats`** dan **`users`**. Tab `users`:

   | user_id | token |
   |---|---|
   | me | 3f9a8c… (64 karakter) |

   → **User ID** = `me`, **Token** = teks panjang di kolom B.

### 2.3 Deploy → dapat URL Web App

1. Di editor Apps Script: **Deploy** (tombol biru kanan atas) → **New deployment**.
2. Ikon gerigi ⚙️ di sebelah *Select type* → **Web app**.
3. Isi:
   - **Execute as:** Me
   - **Who has access:** Anyone
4. **Deploy** → salin **Web app URL**, bentuknya:
   ```
   https://script.google.com/macros/s/AKfycb…/exec
   ```
   Lupa URL-nya? **Deploy → Manage deployments**.

### 2.4 Sambungkan website

1. Buka <https://mlbbrtrackerwr.netlify.app> → ketuk tombol **Lokal** di pojok kanan atas.
2. Isi **URL Web App**, **User ID** (`me`), **Token** → **Simpan & sinkron**.
3. Tombol berubah jadi **Tersinkron** = berhasil. Data yang sudah ada di browser ikut terkirim ke sheet.

Di HP / browser lain: ulangi langkah 2.4 saja.

**Jangan bagikan token.** Siapa pun yang punya URL + token bisa mengubah datamu.

---

## 3. Isi spreadsheet

Spreadsheet adalah database-nya — boleh dilihat, sebaiknya **jangan diedit tangan** (edit lewat website).

**Tab `stats`** — satu baris per hero:

| user_id | hero_id | matches | wr | updated_at |
|---|---|---|---|---|
| me | miya | 120 | 56.7 | 2026-11-02T10:00:00.000Z |
| me | _overall | 2450 | 52.1 | … |

- `hero_id` = nama hero huruf kecil (mis. `yi-sun-shin`, `x-borg`). `_overall` = ringkasan akun.
- `wr` dalam persen. Jumlah menang tidak disimpan, dihitung dari `matches × wr`.

**Tab `users`** — daftar orang yang boleh menyimpan data + token masing-masing.

---

## 4. Menambah teman

1. Editor Apps Script → dropdown fungsi pilih **`newToken`** → **Run** → salin token dari Execution log.
2. Tambah baris di tab `users`: `user_id` (mis. `andi`, huruf kecil tanpa spasi) | token tadi.
3. Kirim ke teman lewat chat pribadi: link website + URL Web App + user_id + token.

Mencabut akses: hapus baris orang itu di tab `users`.
Setiap orang hanya bisa membaca & mengubah datanya sendiri, tapi **pemilik spreadsheet bisa melihat data semua orang**.

---

## 5. Kalau `Code.gs` diubah

Tempel kode baru di editor → Save → **Deploy → Manage deployments → ✏️ (edit) → Version: New version → Deploy**.
URL tetap sama. Tanpa langkah ini, perubahan tidak aktif.

---

## 6. Masalah umum

| Gejala | Penyebab & solusi |
|---|---|
| Klik **Run** tapi tidak ada perubahan | Fungsi yang dipilih bukan `setup`. Pilih **`setup`** di dropdown, lalu Run lagi. |
| Log: *Script tidak terhubung ke spreadsheet* | Script dibuat di luar spreadsheet. Ulangi 2.1 lewat **Extensions → Apps Script**. |
| Tab `users` tidak muncul | `setup` belum berhasil — cek Execution log. Refresh halaman spreadsheet. |
| Website: *User ID atau token salah* | Tidak cocok dengan tab `users`. Cek huruf besar/kecil & spasi di awal/akhir. |
| Website: *Balasan bukan JSON* | URL salah (harus berakhiran `/exec`), atau *Who has access* bukan **Anyone**. |
| Website: *Tidak bisa terhubung* | Offline. Data tetap aman di browser, dikirim otomatis saat online lagi. |

---

## Untuk developer

Tanpa framework & tanpa dependency npm. Butuh Node 20 (tes & script) dan Python (server lokal).

```bash
python -m http.server 5175      # jalankan lokal → http://localhost:5175
node logic.test.js              # tes rumus & validasi
node backend/Code.test.js       # tes Code.gs dengan Sheets tiruan
node scripts/fetch-heroes.js    # perbarui heroes.json saat ada hero baru
```

| File | Isi |
|---|---|
| `index.html`, `style.css`, `app.js` | Tampilan & sinkron ke Apps Script |
| `logic.js` | Rumus WR, kelompok role, validasi (fungsi murni) |
| `heroes.json` | Daftar hero (hasil `fetch-heroes.js`, jangan edit tangan) |
| `backend/Code.gs` | Backend Google Apps Script |

**Deploy:** seret folder `mlbb-tracker` ke situs Netlify (Deploys → *Drag and drop*) untuk memperbarui <https://mlbbrtrackerwr.netlify.app>.

Data hero: [Mobile Legends Wiki (Fandom)](https://mobile-legends.fandom.com/wiki/List_of_heroes), CC BY-SA. Mobile Legends: Bang Bang © Moonton. Proyek pribadi non-komersial.
