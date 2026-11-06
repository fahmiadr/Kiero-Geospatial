import React from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import App from './App.jsx';
import './index.css';
import { authenticateApp } from './utils/authService.js';

const queryClient = new QueryClient();
const container = document.getElementById('root');

/**
 * Titik masuk utama (main entry point) untuk aplikasi React.
 *
 * Fungsi asinkron ini melakukan dua hal utama sebelum me-render aplikasi:
 * 1. Menjalankan autentikasi aplikasi awal (`authenticateApp`) untuk mendapatkan
 * token dan menyimpannya di sessionStorage.
 * 2. Menyiapkan dan me-render aplikasi React ke DOM setelah autentikasi siap.
 *
 * Proses render membungkus komponen `<App />` utama dengan:
 * - `<QueryClientProvider>`: Untuk menyediakan fungsionalitas React Query ke seluruh aplikasi.
 * - `<BrowserRouter>`: Untuk mengaktifkan routing sisi klien (client-side routing).
 *
 * `BrowserRouter` dikonfigurasi secara dinamis dengan `basename={import.meta.env.BASE_URL}`.
 * Ini memastikan bahwa routing aplikasi bekerja dengan benar di bawah sub-path
 * yang ditentukan dalam `vite.config.js` (misal, /mendawai-geospatial/).
 *
 * Jika inisialisasi service worker gagal, fungsi ini akan menangkap error
 * dan menampilkan pesan kesalahan di dalam container root DOM.
 * @async
 */
async function main() {
  try {
    await authenticateApp();

    if (container) {
      const root = createRoot(container);
      root.render(
        <React.StrictMode>
          <QueryClientProvider client={queryClient}>
            <BrowserRouter basename={import.meta.env.BASE_URL}>
              <App />
            </BrowserRouter>
          </QueryClientProvider>
        </React.StrictMode>
      );
    }
  } catch (error) {
    console.error("Gagal memulai aplikasi:", error);
    if (container) {
      container.innerHTML = `<div style="padding: 20px;"><h1>Gagal memuat aplikasi</h1><p>Terjadi kesalahan saat inisialisasi. Silakan coba muat ulang halaman.</p><pre>${error.message}</pre></div>`;
    }
  }
}

// Jalankan fungsi utama
main();
