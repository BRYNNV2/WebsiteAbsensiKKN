# Website Absensi KKN

Sistem Informasi Absensi Kegiatan Kuliah Kerja Nyata (KKN) Berbasis QR Code & Manajemen Peran (Dosen & Mahasiswa).

## Fitur Utama

- **Otentikasi Multirole**:
  - Dosen Pembimbing Lapangan (DPL)
  - Mahasiswa KKN
- **Login Mahasiswa via NIM**: Login praktis menggunakan NIM & password bawaan NIM.
- **Konfirmasi Email Kampus**: Modal konfirmasi email kampus resmi saat mahasiswa pertama kali masuk.
- **Sesi Absensi QR Code**:
  - Dosen membuat sesi absensi dengan durasi dinamis.
  - Mahasiswa melakukan pemindaian QR code via kamera atau upload foto QR.
- **Rekap Kehadiran Realtime**:
  - Matrix kehadiran seluruh mahasiswa per sesi.
  - Status kehadiran lengkap: **Hadir**, **Terlambat**, **Izin**, **Sakit**, **Alpha**.
  - Pengisian & pengubahan status absensi manual oleh Dosen.
  - Ekspor rekapitulasi kehadiran ke format **CSV**.
- **Manajemen Mahasiswa (CRUD)**:
  - Pendaftaran mahasiswa oleh Dosen.
  - Detail akun & reset password mahasiswa.
  - Hapus akun mahasiswa secara permanen.

## Teknologi

- **Frontend**: React + TypeScript + Vite + Tailwind CSS + Lucide Icons + Shadcn UI
- **Backend / Database**: Supabase (PostgreSQL, GoTrue Auth, Row Level Security, RPC Functions)

## Jalankan Secara Lokal

```bash
npm install
npm run dev
```
