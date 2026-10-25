# Aplikasi Android Catatduitku

Catatduitku sudah berupa PWA. Ada dua jalur untuk memakainya sebagai aplikasi di HP.

## Jalur 1: Instal langsung (tanpa APK, 1 menit)

Android (Chrome): buka https://catatduitku-lilac.vercel.app, ketuk menu ⋮, pilih
"Instal aplikasi" atau "Tambahkan ke layar utama".
iPhone (Safari): ketuk Bagikan, lalu "Tambah ke Layar Utama".

Hasilnya tampil layar penuh dengan ikon sendiri, dan suara serta kamera berfungsi normal.

## Jalur 2: File APK (untuk dibagikan atau diunggah ke Play Store)

Pakai PWABuilder, tidak perlu Android Studio.

1. Buka https://www.pwabuilder.com dan masukkan `https://catatduitku-lilac.vercel.app`.
2. Tunggu skor PWA muncul, lalu klik **Package for stores**, pilih **Android**.
3. Pilih jenis paket **Trusted Web Activity** (bawaan). Isi:
   - Package ID: misalnya `app.vercel.catatduitku` (ubah jika ingin domain sendiri)
   - App name: Catatduitku
   - Biarkan opsi signing key di "Create new".
4. Unduh zip. Di dalamnya ada `.apk` (untuk dites/dibagikan) dan `.aab` (untuk Play Store),
   plus `assetlinks.json` dan file keystore.
5. **Simpan keystore dan passwordnya dengan aman.** Tanpa itu, update aplikasi tidak bisa dirilis.

### Menghilangkan bar alamat di dalam aplikasi

Aplikasi TWA menampilkan bar alamat Chrome sampai domain terverifikasi.
Salin isi `assetlinks.json` dari zip PWABuilder ke file
`public/.well-known/assetlinks.json` di proyek ini, lalu deploy ulang. Setelah itu bar alamat hilang.

### Catatan

- Aplikasi memuat situs yang sudah dideploy, jadi setiap update web otomatis ikut tanpa
  rilis APK baru.
- TWA memakai Chrome, sehingga input suara (Web Speech) dan kamera struk berjalan sama seperti di Chrome.
  Bungkus WebView biasa (misalnya Capacitor tanpa plugin) tidak mendukung input suara.
- Untuk menerbitkan di Play Store dibutuhkan akun Google Play Developer (biaya sekali bayar).
