const ACCESS_TOKEN_KEY = 'accessToken';
const REFRESH_TOKEN_KEY = 'refreshToken';

/**
 * Menyimpan kedua token ke sessionStorage.
 * akan otomatis terhapus saat tab browser ditutup,
 * memberikan lapisan keamanan tambahan.
 * @param {string} accessToken
 * @param {string} refreshToken
 */
export const storeTokens = (accessToken, refreshToken) => {
  try {
    sessionStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
    sessionStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
  } catch (error) {
    console.error("Gagal menyimpan token ke sessionStorage:", error);
  }
};

/**
 * Mengambil Access Token dari sessionStorage.
 * @returns {string|null}
 */
export const getAccessToken = () => {
  try {
    return sessionStorage.getItem(ACCESS_TOKEN_KEY);
  } catch (error) {
    console.error("Gagal mengambil accessToken:", error);
    return null;
  }
};

/**
 * Mengambil Refresh Token dari sessionStorage.
 * @returns {string|null}
 */
export const getRefreshToken = () => {
  try {
    return sessionStorage.getItem(REFRESH_TOKEN_KEY);
  } catch (error) {
    console.error("Gagal mengambil refreshToken:", error);
    return null;
  }
};

/**
 * Menghapus semua token dari sessionStorage.
 * Ini digunakan saat logout atau saat refresh token gagal.
 */
export const clearTokens = () => {
  try {
    sessionStorage.removeItem(ACCESS_TOKEN_KEY);
    sessionStorage.removeItem(REFRESH_TOKEN_KEY);
  } catch (error) {
    console.error("Gagal menghapus token:", error);
  }
};