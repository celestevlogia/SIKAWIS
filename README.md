# SIKAWIS — Sistem Informasi Kelulusan dan Wisuda

Prototype full-stack untuk administrasi kelulusan dan wisuda mahasiswa.

## Teknologi
- Frontend: Vite + React + JavaScript
- Backend: Node.js + Express
- Penyimpanan demo: file JSON (`server/data/db.json`)
- Login: JWT + bcrypt
- Upload dokumen: Multer
- AI chatbot: Google Gemini API (opsional; tersedia fallback FAQ lokal)

## Persyaratan
Node.js 20 atau lebih baru dan npm.

## Instalasi
1. Ekstrak ZIP.
2. Buka folder `sikawis` di VS Code.
3. Jalankan `npm install` pada terminal root.
4. Jalankan `npm run install:all`.
5. Salin `server/.env.example` menjadi `server/.env`.
6. Jalankan `npm run dev`.
7. Buka URL Vite yang muncul, biasanya http://localhost:5173.

Backend berjalan di http://localhost:4000.

## Akun demo
- Mahasiswa: `mahasiswa` / `mahasiswa123`
- Admin: `admin` / `admin123`

Ganti password dan secret sebelum penggunaan nyata.

## Gemini API (opsional)
Isi `GEMINI_API_KEY` di `server/.env`. Dapatkan API key dari Google AI Studio.
Jika API key tidak diisi, chatbot tetap dapat menjawab FAQ dasar secara lokal.

## Catatan penting
Ini adalah prototype akademik, bukan sistem produksi. Data JSON cocok untuk demonstrasi lokal dengan sedikit pengguna, bukan akses serentak skala kampus. Sebelum dipakai sungguhan, migrasikan ke PostgreSQL/MySQL, gunakan HTTPS, validasi dokumen di server, backup, audit log, pembatasan akses, dan proses verifikasi resmi. Data status yudisium/BO dalam prototype diubah oleh admin demo; bukan integrasi ke sistem kampus.

## Pembaruan fitur
- Sesi login menggunakan `sessionStorage` per tab browser. Buka `http://localhost:5173` pada tab terpisah untuk login mahasiswa dan admin secara bersamaan.
- SPT dapat diunduh sebagai PDF dan salinan PDF diunggah ke server agar admin dapat membukanya.
- Rekomendasi toga menyimpan empat ukuran tubuh dan hasil rekomendasi pada profil mahasiswa. Gemini menjelaskan hasil perhitungan yang dibatasi oleh tabel ukuran S–XL yang disediakan.
- Admin dapat melihat pratinjau gambar bukti dan membuka file PDF.
- Tombol keluar meminta konfirmasi.

## Tabel ukuran toga yang digunakan
| Ukuran | Panjang toga | Lingkar badan | Lebar bahu | Panjang lengan |
|---|---:|---:|---:|---:|
| S | 102 | 104 | 45 | 57 |
| M | 104 | 108 | 46 | 58 |
| L | 108 | 112 | 47 | 59 |
| XL | 110 | 116 | 48 | 59 |

Rekomendasi adalah bantuan awal berdasarkan kedekatan empat pengukuran terhadap tabel. Lakukan fitting/konfirmasi fisik sebelum ukuran final ditetapkan.

## Catatan saat memperbarui project lama
- Jika folder `server/data/db.json` sudah ada dari percobaan sebelumnya, backend mempertahankannya dan tidak menimpa data secara otomatis.
- Untuk login dua peran bersamaan, buka tab browser baru secara manual, ketik kembali `http://localhost:5173`, lalu login dengan akun peran yang berbeda. Jangan gunakan tombol logout untuk berpindah akun.
- Saat kembali berpindah tab, halaman akan mengambil ulang data dari backend agar status terbaru terlihat.

## Perbaikan lanjutan
- Konsultasi Kaprodi memiliki tombol dengan label tindakan yang jelas, status `Menunggu pemeriksaan Kaprodi`, dan petunjuk untuk memantau hasilnya. Status ini juga menjadi opsi yang dikenali admin.
- Tanggal pada PDF SPT menggunakan tanggal lokal perangkat/browser saat PDF dibuat.
- SPT tidak lagi ditampilkan sebagai item upload di checklist. Menu SPT baru muncul setelah empat sertifikat Faculty Day, PKKMB, dan Skripsi 2 selesai diunggah. Publikasi/Hak Cipta tetap opsional. Backend juga memblokir pembuatan SPT jika dokumen wajib belum lengkap.
- Pengembalian toga terkunci sampai mahasiswa menekan `Konfirmasi Ukuran Toga`. Backend juga memvalidasi syarat ini, jadi tidak hanya mengandalkan tombol frontend.
- Admin hanya melihat status/ukuran toga, bukan uraian alasan rekomendasi AI.
- Chatbot hanya ditampilkan untuk akun mahasiswa.
