import { fetchAuthenticated } from './authService';

/**
 * Mengambil data peta (kluster tiket atau titik individual) dari endpoint API `/api/v1/tickets/view`.
 * Fungsi ini dimaksudkan untuk dipanggil dari main thread atas nama web worker,
 * yang bertanggung jawab untuk membangun path API yang benar.
 * @async
 * @param {string} apiPath - Path API lengkap dengan semua parameter query yang diperlukan (bounds, zoom, filter, dll.).
 * @returns {Promise<object>} Sebuah promise yang me-resolve ke data respons API.
 * @throws {Error} Jika `apiPath` tidak disediakan atau jika permintaan API gagal.
 */
export const getMapDataFromWorker = async (apiPath) => {
    if (!apiPath) {
        throw new Error('apiPath is required for getMapDataFromWorker');
    }
    const response = await fetchAuthenticated(apiPath);
    if (!response.ok) {
        throw new Error(`Gagal mengambil data peta: ${response.status}`);
    }
    const data = await response.json();
    return data;
};

/**
 * Mengambil informasi detail untuk satu tiket berdasarkan ID-nya.
 * @async
 * @param {string|null} ticketId - ID dari tiket yang akan diambil. Jika null, fungsi akan mengembalikan null.
 * @returns {Promise<object|null>} Sebuah promise yang me-resolve ke data detail tiket, atau null jika tidak ada `ticketId`.
 * @throws {Error} Jika permintaan API gagal.
 */
export const getTicketDetails = async (ticketId) => {
    if (!ticketId) {
        return null;
    }

    const response = await fetchAuthenticated(`/api/v1/tickets/${ticketId}`);
    if (!response.ok) {
        throw new Error(`Gagal mengambil detail tiket: ${response.status}`);
    }
    const data = await response.json();
    return data;
};