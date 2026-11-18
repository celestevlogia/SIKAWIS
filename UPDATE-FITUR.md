# Pembaruan SIKAWIS

1. Semua label tampilan menggunakan istilah Faculty Day.
2. SPT dapat dibuat, diunduh sebagai PDF, dan salinan PDF disimpan di server untuk dilihat admin.
3. Rekomendasi toga menggunakan input lingkar badan, lebar bahu, panjang lengan, dan panjang toga. Pilihan dibatasi tabel ukuran S, M, L, XL yang disediakan. Gemini API memilih dan menjelaskan rekomendasi; jika API belum diatur/gagal, backend memakai perhitungan kecocokan sebagai fallback.
4. Token login disimpan di sessionStorage agar sesi mahasiswa dan admin terpisah per tab.
5. Admin dapat melihat pratinjau gambar dan membuka PDF dokumen yang diunggah.
6. Tombol keluar meminta konfirmasi.
7. Data akademik memuat nama lengkap, NIM, program studi, jumlah SKS, dan mata kuliah semester berjalan.
8. Saat tab kembali aktif, data diperbarui dari backend sehingga perubahan antar akun terlihat.

## Catatan
- Gunakan tabel ukuran sebagai panduan yang diberikan pemilik sistem. Rekomendasi bukan pengganti fitting fisik.
- Prototype masih memakai JSON sebagai penyimpanan lokal. Jangan digunakan untuk produksi kampus sebelum migrasi ke database relasional, pengamanan file, audit log, dan pengujian.
