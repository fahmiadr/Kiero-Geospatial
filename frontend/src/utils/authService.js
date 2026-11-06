import axios from 'axios';
import apiClient from './apiClient';
import { storeTokens, clearTokens as clearStoredTokens } from './tokenService';

const GATEWAY_URL = import.meta.env.VITE_GATEWAY_URL || 'http://localhost:3000';
const PROXY_TOKEN_ENDPOINT = `${GATEWAY_URL}/auth-proxy/proxy-token`;
const CLIENT_ID = import.meta.env.VITE_CLIENT_ID;


/**
 * Menjalankan alur otentikasi awal (client credentials) untuk mendapatkan token
 * saat aplikasi pertama kali dimuat.
 * @async
 * @returns {Promise<void>} Promise yang me-resolve setelah autentikasi selesai.
 * @throws {Error} Jika otentikasi gagal.
 */
export async function authenticateApp() {
    if (!CLIENT_ID) {
        throw new Error('VITE_CLIENT_ID tidak ditemukan di variabel lingkungan frontend.');
    }
    try {
        const response = await axios.post(PROXY_TOKEN_ENDPOINT, {
            clientId: CLIENT_ID
        });

        if (response.status !== 200) {
            const errorData = response.data;
            throw new Error(`Gagal mendapatkan token awal: ${errorData.error_description || response.statusText}`);
        }

        const tokenData = response.data;
        storeTokens(tokenData.access_token, tokenData.refresh_token);

    } catch (error) {
        console.error('Error selama autentikasi awal:', error);
        clearStoredTokens();
        throw error;
    }
}


/**
 * Menjalankan alur otentikasi untuk konteks iframe, menggunakan JWT Assertion
 * yang diterima dari jendela induk (`parent window`).
 * @export
 * @async
 * @param {string} assertion - JWT Assertion yang ditandatangani oleh aplikasi pihak ketiga.
 * @returns {Promise<Response>} Promise yang me-resolve dengan respons dari server token.
 * @throws {Error} Jika assertion tidak ada atau otentikasi gagal.
 */
export async function authenticateWithAssertion(assertion) {
    if (!assertion) {
        throw new Error('JWT Assertion is required for iframe authentication.');
    }
    try {
        const response = await axios.post(PROXY_TOKEN_ENDPOINT, {
            assertion
        });

        if (response.status !== 200) {
            const errorData = response.data;
            throw new Error(`Gagal mendapatkan token dengan assertion: ${errorData.error_description || response.statusText}`);
        }

        const tokenData = response.data;
        storeTokens(tokenData.access_token, tokenData.refresh_token);
    } catch (error) {
        console.error('Error selama autentikasi assertion:', error);
        clearStoredTokens();
        throw error;
    }
}

/**
 * Sebuah wrapper di sekitar apiClient (axios) yang meniru perilaku 'fetch'.
 * Fungsi ini sekarang mendelegasikan semua logika token dan refresh ke interceptor apiClient.
 *
 * @export
 * @async
 * @param {string} endpoint - Path API (misalnya, /'api/v1/geo/provinsi').
 * @param {object} [options={}] - Opsi yang kompatibel dengan fetch (method, body, dll.).
 * @returns {Promise<Response>} Promise yang me-resolve dengan objek yang mirip `Response` dari `fetch`.
 */
export async function fetchAuthenticated(endpoint, options = {}) {
    const config = {
        method: options.method || 'GET',
        url: endpoint,
        data: options.body,
        headers: options.headers,
    };

    try {
        // Gunakan apiClient yang sudah memiliki interceptor
        const response = await apiClient(config);

        // Kembalikan objek yang meniru (mock) respons 'fetch'
        // agar sisa aplikasi tidak perlu diubah
        return {
            data: response.data,
            ok: response.status >= 200 && response.status < 300,
            status: response.status,
            // Fungsi .json() palsu untuk menjaga kompatibilitas
            async json() {
                return this.data;
            }
        };
    } catch (error) {
        // Jika interceptor gagal me-refresh, error akan dilempar ke sini
        console.error(`Permintaan API gagal setelah retry: ${endpoint}`, error);

        // Kembalikan struktur error yang mirip 'fetch'
        return {
            ok: false,
            status: error.response?.status || 500,
            async json() {
                return error.response?.data || { message: 'Network Error', error: 'Network Error' };
            }
        };
    }
}
