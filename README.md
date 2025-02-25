# EARNOS
https://app.earnos.com?ref=boyokeencok
- Auto check in
- Random agent
# Instruksi (membutuhkan nodejs):
1. npm install untuk memperbarui modul. Konfigurasi bot ada di file .env (baca file ini sebelum menjalankan bot)
2. nano tokens.txt menyimpan token
# instruksi untuk mendapatkan token:

✓ Akses web => F12 (klik kanan/periksa) => tab aplikasi => cookies =>

✓ Akses web => F12 (klik kanan/periksa) => masuk ke tab console => paste kode di bawah ini (jika tidak bisa paste, masukkan secara manual ketik allow pasting dulu lalu paste lagi)

- const getCookie = (name) => {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) {
    return parts.pop().split(';').shift();
  }
  return null; 
};
const earnAuthCookie = getCookie('earnos-auth.v0.0.3');
console.log(earnAuthCookie);

proxy.txt menyimpan proxy dalam format proxy: http://user:pass@ip:port (siapa pun yang menggunakan proxy dapat menambahkannya)

3. node main.js
