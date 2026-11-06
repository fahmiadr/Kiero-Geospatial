import axios from 'axios';
import { getAccessToken, getRefreshToken, storeTokens, clearTokens } from './tokenService';

const GATEWAY_URL = import.meta.env.VITE_GATEWAY_URL || 'http://localhost:3000';
const API_BASE_URL = GATEWAY_URL;
const REFRESH_TOKEN_ENDPOINT = `${GATEWAY_URL}/auth-proxy/proxy-refresh`;

let isRefreshing = false;
let failedQueue = [];

// Proteksi anti-spam error dialog saat terjadi retry berulang-ulang
let lastErrorDispatchTime = 0;
let lastErrorMessage = '';
const ERROR_DISPATCH_COOLDOWN_MS = 10000; // Cooldown 10 detik

// ============================================================================
// BroadcastChannel untuk sinkronisasi token antar tabs
// ============================================================================
const AUTH_CHANNEL_NAME = 'auth_channel';
let authChannel = null;

/**
 * Inisialisasi BroadcastChannel untuk sinkronisasi token antar tabs browser.
 * Jika satu tab berhasil refresh token, tab lain akan menerima notifikasi.
 */
const initAuthChannel = () => {
  if (typeof BroadcastChannel === 'undefined') {
    console.warn('BroadcastChannel not supported in this browser');
    return;
  }

  authChannel = new BroadcastChannel(AUTH_CHANNEL_NAME);

  authChannel.onmessage = (event) => {
    const { type, access_token, refresh_token } = event.data;

    if (type === 'TOKEN_REFRESHED' && access_token && refresh_token) {
      // Tab lain berhasil refresh token, simpan tokens baru
      storeTokens(access_token, refresh_token);
    } else if (type === 'TOKENS_CLEARED') {
      // Tab lain menghapus tokens (logout atau refresh gagal)
      clearTokens();
    }
  };
};

// Inisialisasi channel saat module dimuat
initAuthChannel();

/**
 * Broadcast token baru ke semua tabs lain.
 * @param {string} accessToken - Access token baru
 * @param {string} refreshToken - Refresh token baru
 */
const broadcastTokenRefresh = (accessToken, refreshToken) => {
  if (authChannel) {
    authChannel.postMessage({
      type: 'TOKEN_REFRESHED',
      access_token: accessToken,
      refresh_token: refreshToken
    });
  }
};

/**
 * Broadcast bahwa tokens telah dihapus ke semua tabs lain.
 */
const broadcastTokensClear = () => {
  if (authChannel) {
    authChannel.postMessage({ type: 'TOKENS_CLEARED' });
  }
};

// ============================================================================

/**
 * Memproses semua permintaan yang mengantri.
 * Jika sukses (ada token baru), coba lagi permintaannya.
 * Jika gagal, tolak semua permintaan di antrian.
 * @param {Error|null} error - Error jika refresh gagal
 * @param {string|null} token - Access token baru jika refresh sukses
 */
const processQueue = (error, token = null) => {
  failedQueue.forEach(prom => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};
const apiClient = axios.create({
  baseURL: API_BASE_URL,
});

apiClient.interceptors.request.use(
  (config) => {
    const token = getAccessToken(); // Ambil token dari sessionStorage
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

const MAX_SERVER_RETRIES = 2; // Total 3 percobaan: 1 kali awal + 2 kali retry

apiClient.interceptors.response.use(
  (response) => {
    return response;
  },
  async (error) => {
    const originalRequest = error.config;
    const refreshToken = getRefreshToken();

    // 1. Tangani 401 (Refresh Token Flow)
    if (error.response?.status === 401 && refreshToken && originalRequest && !originalRequest._retry) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            originalRequest.headers['Authorization'] = `Bearer ${token}`;
            return axios(originalRequest);
          })
          .catch((err) => {
            return Promise.reject(err);
          });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const refreshApiClient = axios.create();
        const response = await refreshApiClient.post(REFRESH_TOKEN_ENDPOINT, {
          refresh_token: refreshToken,
        });

        const { access_token, refresh_token } = response.data;
        storeTokens(access_token, refresh_token);

        // Broadcast ke tabs lain bahwa token telah di-refresh
        broadcastTokenRefresh(access_token, refresh_token);

        originalRequest.headers['Authorization'] = `Bearer ${access_token}`;

        processQueue(null, access_token);

        return apiClient(originalRequest);
      } catch (refreshError) {
        console.error('Gagal me-refresh token:', refreshError);
        clearTokens();

        // Broadcast ke tabs lain bahwa tokens telah dihapus
        broadcastTokensClear();

        processQueue(refreshError, null);

        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    // 2. Tangani Retry Otomatis untuk 5xx dan Network Error (Termasuk non-React Query & Web Worker calls)
    const isCanceled = axios.isCancel(error) || error.code === 'ERR_CANCELED';
    const isServerErrorOrNetwork = !isCanceled && (
      (error.response && error.response.status >= 500) ||
      (!error.response && (error.code === 'ECONNABORTED' || error.code === 'ERR_NETWORK' || error.message?.includes('Network Error')))
    );

    if (isServerErrorOrNetwork && originalRequest && !originalRequest._isRetryExhausted) {
      originalRequest._serverRetryCount = (originalRequest._serverRetryCount || 0) + 1;

      // Lakukan silent retry di background jika kuota retry belum habis
      if (originalRequest._serverRetryCount <= MAX_SERVER_RETRIES) {
        const delayMs = Math.min(1000 * Math.pow(2, originalRequest._serverRetryCount - 1), 4000);
        console.warn(`[apiClient] Permintaan gagal (${error.response?.status || error.message}). Mencoba ulang secara otomatis (${originalRequest._serverRetryCount}/${MAX_SERVER_RETRIES}) dalam ${delayMs}ms...`);

        await new Promise((resolve) => setTimeout(resolve, delayMs));
        return apiClient(originalRequest);
      }

      // Tandai bahwa seluruh percobaan retry telah gagal total
      originalRequest._isRetryExhausted = true;

      // HANYA dipancarkan saat SEMUA percobaan retry telah habis dan gagal total
      const message = error.response?.data?.message || 'Terjadi kesalahan pada server setelah beberapa percobaan. Silakan coba lagi nanti.';
      const now = Date.now();
      if (now - lastErrorDispatchTime > ERROR_DISPATCH_COOLDOWN_MS || message !== lastErrorMessage) {
        lastErrorDispatchTime = now;
        lastErrorMessage = message;
        window.dispatchEvent(new CustomEvent('AXIOS_ERROR', { detail: message }));
      }
    }

    return Promise.reject(error);
  }
);

export default apiClient;