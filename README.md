# KriptoWijaya - Encrypted Mail Demo

Proyek ini mencontohkan alur kirim/terima pesan terenkripsi (AES + RSA + tanda tangan SHA-256) dengan autentikasi JWT.

## Persiapan
1) Salin folder proyek ke `XAMPP/htdocs`.
2) Jalankan Apache & MySQL dari XAMPP.
3) Instal dependency PHP:
   ```bash
   composer install
   ```
4) Buat database dan tabel:
   - Import `db_setup.txt` (atau `database.sql`) via phpMyAdmin / mysql CLI untuk membuat DB `kriptowijaya` beserta tabel `users` & `mails`.
5) Buat file `.env` di root:
   - Isi `APP_KEY=<isi key HS256>`, gunakan generator https://www.strongdm.com/tools/api-key-generator, lalu copy string ke APP_KEY.

Contoh `.env`:
```
APP_KEY="your_generated_key_here"
```

## Struktur & Halaman
- Backend PHP: autentikasi (`backend/login.php`), registrasi (`backend/register.php`), pengambilan public key, kirim pesan terenkripsi, inbox & detail pesan.
- Frontend HTML (sb-admin theme):
  - `login.html` / `register.html` untuk masuk/daftar (generate keypair pada register, simpan privateKey di localStorage).
  - `send.html` untuk kirim pesan (AES encrypt + RSA encrypt session key + signature).
  - `index.html` untuk inbox user login.
  - `message.html` untuk detail pesan (verifikasi signature & dekripsi dengan private key lokal).

## Alur Singkat
1) Registrasi di `register.html` → private key tersimpan di browser (localStorage), public key terkirim ke server.
2) Login di `login.html` → token JWT tersimpan.
3) Kirim pesan di `send.html`: pilih penerima (auto-complete username), pesan dienkripsi & ditandatangani lalu disimpan di DB.
4) Buka `index.html` untuk lihat inbox; klik pesan menuju `message.html` untuk verifikasi signature dan dekripsi.

Catatan: Jika private key di browser hilang, pesan yang sudah ada tidak bisa didekripsi; kirim ulang dengan keypair baru jika diperlukan.
