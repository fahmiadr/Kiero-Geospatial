import { fetchAuthenticated } from './authService';

/**
 * Mencari awalan nomor telepon dan mengembalikan data cakupan wilayahnya dari API.
 * @async
 * @param {string} phoneNumber - Nomor telepon atau awalan yang akan dicari.
 * @returns {Promise<object>} Sebuah promise yang me-resolve ke respons API, berisi awalan yang cocok dan data GeoJSON.
 * @throws {Error} Jika `phoneNumber` tidak disediakan atau jika permintaan API gagal.
 */
export const searchPrefixByPhoneNumber = async (phoneNumber) => {
    if (!phoneNumber) {
        throw new Error('Phone number is required');
    }
    const response = await fetchAuthenticated(`/api/v1/prefixes/search?number=${phoneNumber}`);
    if (!response.ok) {
        const errorBody = await response.json().catch(() => ({ message: 'API request failed with no valid JSON response.' }));
        throw new Error(errorBody.message || `API request failed with status ${response.status}`);
    }
    const responseData = await response.json();
    return responseData;
};
