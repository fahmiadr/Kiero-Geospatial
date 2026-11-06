# Kiero-Geospatial
Geo spatial for Mendawai System - Proyek Peta Geospasial

Aplikasi web pemetaan geospasial interaktif yang memungkinkan pengguna untuk mencari dan memvisualisasikan data berdasarkan nomor telepon dan wilayah administratif. Pengguna dapat mencari awalan nomor telepon untuk melihat cakupan geografisnya di peta, menjelajahi batas-batas wilayah administratif (provinsi hingga desa), dan melihat statistik tiket yang terkait dengan wilayah tersebut.

Aplikasi ini dirancang untuk dapat disematkan (embed) sebagai `iframe` di situs pihak ketiga, dengan alur otentikasi yang aman menggunakan OAuth 2.0 JWT Bearer Grant.

## Arsitektur

Proyek ini dibangun dengan arsitektur monorepo yang terdiri dari tiga layanan utama yang independen:

-   **`frontend`**: Aplikasi React (dibangun dengan Vite) yang menyediakan antarmuka pengguna utama. Bertanggung jawab untuk semua rendering sisi klien, manajemen state, dan interaksi pengguna dengan peta.

-   **`backend`**: Aplikasi Node.js/Express yang berfungsi sebagai *Resource Server*. Layanan ini menangani semua logika bisnis inti, seperti:
    -   Mengakses basis data PostgreSQL/PostGIS.
    -   Menjalankan kueri geospasial untuk data wilayah.
    -   Melakukan agregasi data tiket.
    -   Menyediakan data untuk pencarian awalan nomor telepon.

-   **`geo-gateway`**: Aplikasi Node.js/Express yang bertindak sebagai *API Gateway* dan *Authorization Server*. Semua permintaan dari `frontend` harus melewati gateway ini. Tanggung jawab utamanya adalah:
    -   Mengautentikasi klien (baik aplikasi utama maupun pihak ketiga).
    -   Menerbitkan *Access Token* (JWT).
    -   Memvalidasi *Access Token* pada setiap permintaan API.
    -   Meneruskan (proxy) permintaan yang valid ke layanan `backend`.
    -   Menangani Cross-Origin Resource Sharing (CORS) secara aman.

## Struktur Teknologi

-   **Frontend**: React, Vite, Google Maps API, TanStack Query, Tailwind CSS
-   **Backend & Geo-gateway**: Node.js, Express.js, Prisma (ORM), `jose` (untuk JWT)
-   **Database**: PostgreSQL dengan ekstensi PostGIS
-   **Testing**: Jest (untuk `backend`)

## Pengaturan dan Instalasi Lingkungan Lokal

Panduan ini akan membantu Anda menyiapkan dan menjalankan ketiga layanan di lingkungan pengembangan lokal.

### Prasyarat

-   Node.js (versi 18 atau lebih tinggi direkomendasikan)
-   `npm` (biasanya terinstal bersama Node.js)
-   PostgreSQL (versi 14 atau lebih tinggi direkomendasikan)
-   Ekstensi PostGIS untuk PostgreSQL. Pastikan sudah diaktifkan pada database Anda.

### 1. Kloning Repositori

```bash
git clone <URL_REPOSITORI>
cd <NAMA_DIREKTORI>
```

### 2. Pengaturan Database

Buat sebuah database PostgreSQL baru dan aktifkan ekstensi PostGIS di dalamnya.

```sql
-- Contoh perintah SQL
CREATE DATABASE geo_map_db;
\c geo_map_db;
CREATE EXTENSION postgis;
```

### 3. Pengaturan Layanan `geo-gateway`

Gateway harus dijalankan terlebih dahulu karena layanan lain bergantung padanya.

1.  **Pindah ke direktori:**
    ```bash
    cd geo-gateway
    ```

2.  **Instal dependensi:**
    ```bash
    npm install
    ```

3.  **Konfigurasi Lingkungan:**
    Salin file contoh `.env` dan sesuaikan nilainya.
    ```bash
    cp .env\ example .env
    ```
    -   `DATABASE_URL`: Isi dengan URL koneksi ke database PostgreSQL Anda. Format: `postgresql://USER:PASSWORD@HOST:PORT/DATABASE`
    -   `GATEWAY_URL`: Alamat lengkap tempat gateway akan berjalan (default: `http://localhost:4000`).
    -   `RESOURCE_SERVER_URL`: Alamat tempat layanan `backend` akan berjalan (default: `http://localhost:3000/v1`).

4.  **Buat Kunci Kriptografis:**
    Jalankan skrip ini untuk menghasilkan `gateway_private.pem` dan `gateway_public.pem`.
    ```bash
    npm run generate_gateway_keys
    ```

5.  **Jalankan Server Gateway:**
    ```bash
    npm run dev
    ```
    Server gateway akan berjalan di `http://localhost:4000`.

### 4. Pengaturan Layanan `backend`

1.  **Pindah ke direktori:**
    ```bash
    cd backend
    ```

2.  **Instal dependensi:**
    ```bash
    npm install
    ```

3.  **Konfigurasi Lingkungan:**
    Salin file contoh `.env` dan sesuaikan nilainya.
    ```bash
    cp .env\ example .env
    ```
    -   `DATABASE_URL`: Isi dengan URL koneksi yang **sama** seperti pada `geo-gateway`.
    -   `GATEWAY_PUBLIC_KEY_PATH`: Path harus menunjuk ke file `gateway_public.pem` yang dihasilkan di dalam direktori `geo-gateway`. Contoh: `../geo-gateway/gateway_public.pem`.

4.  **Migrasi dan Seeding Database:**
    Jalankan perintah ini untuk membuat skema tabel dan mengisi data awal.
    ```bash
    npx prisma migrate dev
    npm run seed
    ```

5.  **Jalankan Server Backend:**
    ```bash
    npm run dev
    ```
    Server backend akan berjalan di `http://localhost:3000`.

### 5. Pengaturan Layanan `frontend`

1.  **Pindah ke direktori:**
    ```bash
    cd frontend
    ```

2.  **Instal dependensi:**
    ```bash
    npm install
    ```

3.  **Konfigurasi Lingkungan:**
    Salin file contoh `.env` dan buat file `.env` baru.
    ```bash
    cp .env\ example .env
    ```
    -   `VITE_GOOGLE_MAPS_API_KEY`: Isi dengan kunci API Google Maps Anda.
    -   `VITE_CLIENT_ID`: Harus diisi dengan `FIRST_PARTY_CLIENT_ID` yang ada di file `prisma/seed.js` pada layanan `backend`.
    -   `VITE_GATEWAY_URL`: Alamat tempat `geo-gateway` berjalan (default: `http://localhost:4000`).
    -   `VITE_CLIENT_PRIVATE_KEY`: Harus diisi dengan `FIRST_PARTY_CLIENT_PRIVATE_KEY` dari file `prisma/seed.js` yang sama.

4.  **Jalankan Server Pengembangan:**
    ```bash
    npm run dev
    ```
    Aplikasi frontend sekarang dapat diakses di `http://localhost:5173`.

## Menjalankan Pengujian

Layanan `backend` dilengkapi dengan suite pengujian menggunakan Jest. Untuk menjalankannya:

```bash
# Dari root direktori proyek
npm test --prefix backend
```

## Integrasi Pihak Ketiga

Untuk panduan tentang cara menyematkan peta ini sebagai `iframe` di aplikasi Anda sendiri, silakan merujuk ke dokumen [THIRD_PARTY_INTEGRATION.md](THIRD_PARTY_INTEGRATION.md).

