import { fetchAuthenticated } from './authService';

/**
 * Mengambil data statistik tiket ringkas (total, open, dll.) untuk wilayah tertentu.
 * @async
 * @param {string} regionCode - Kode wilayah yang akan diambil statistiknya.
 * @param {string} [startDate] - Tanggal mulai dalam format 'YYYY-MM-DD'.
 * @param {string} [endDate] - Tanggal akhir dalam format 'YYYY-MM-DD'.
 * @param {number|null} [categoryId] - ID kategori untuk memfilter tiket.
 * @returns {Promise<object>} Sebuah promise yang me-resolve ke objek data statistik.
 * @throws {Error} Jika `regionCode` tidak disediakan atau permintaan API gagal.
 */
export const getRegionStats = async (regionCode, startDate, endDate, categoryId) => {
  if (!regionCode) {
    throw new Error('regionCode is required');
  }
  const params = new URLSearchParams();
  if (startDate) params.append('startDate', startDate);
  if (endDate) params.append('endDate', endDate);
  if (categoryId) params.append('category', categoryId);

  const queryString = params.toString();
  const url = `/api/v1/regions/${regionCode}/stats${queryString ? `?${queryString}` : ''}`;

  const response = await fetchAuthenticated(url);
  if (!response.ok) {
    throw new Error(`Gagal mengambil statistik: ${response.status}`);
  }
  const result = await response.json();
  return result.data;
};

/**
 * Mengambil rincian statistik tiket berdasarkan kategori untuk wilayah dan status tertentu.
 * @async
 * @param {string} regionCode - Kode wilayah yang akan diambil statistiknya.
 * @param {string} [startDate] - Tanggal mulai dalam format 'YYYY-MM-DD'.
 * @param {string} [endDate] - Tanggal akhir dalam format 'YYYY-MM-DD'.
 * @param {string} status - Status tiket untuk memfilter rincian (misalnya, 'open').
 * @param {number|null} [categoryId] - ID kategori untuk memfilter tiket.
 * @returns {Promise<Array<object>>} Sebuah promise yang me-resolve ke array objek rincian statistik.
 * @throws {Error} Jika `regionCode` atau `status` tidak disediakan atau permintaan API gagal.
 */
export const getRegionStatsDetails = async (regionCode, startDate, endDate, status, categoryId) => {
  if (!regionCode) {
    throw new Error('regionCode is required');
  }

  if (!status) {
    throw new Error('status is required');
  }

  const params = new URLSearchParams();
  params.append('status', status);
  if (startDate) params.append('startDate', startDate);
  if (endDate) params.append('endDate', endDate);
  if (categoryId) params.append('category', categoryId);

  const queryString = params.toString();
  const url = `/api/v1/regions/${regionCode}/stats/details${queryString ? `?${queryString}` : ''}`;

  const response = await fetchAuthenticated(url);
  if (!response.ok) {
    throw new Error(`Gagal mengambil statistik: ${response.status}`);
  }
  const result = await response.json();
  return result.data;
};
