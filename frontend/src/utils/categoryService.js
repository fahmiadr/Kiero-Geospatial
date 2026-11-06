import { fetchAuthenticated } from './authService.js';

/**
 * Mengambil daftar lengkap kategori tiket dari endpoint API.
 * Fungsi ini menggunakan `fetchAuthenticated` untuk memastikan permintaan diautentikasi.
 * @async
 * @export
 * @returns {Promise<Array<object>>} Sebuah promise yang me-resolve ke array objek kategori.
 * @throws {Error} Jika permintaan API gagal.
 */
export async function getCategories() {
    const response = await fetchAuthenticated('/api/v1/categories');
    if (!response.ok) {
        throw new Error('Gagal mengambil data kategori');
    }
    const result = await response.json();
    return result.data;
}


