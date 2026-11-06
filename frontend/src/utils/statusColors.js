/**
 * Fungsi hash sederhana untuk string. Menghasilkan integer yang konsisten
 * untuk string yang sama, digunakan untuk menghasilkan warna yang deterministik.
 * @private
 * @param {string} str String input.
 * @returns {number} Nilai hash integer.
 */
const simpleHash = (str) => {
  let hash = 0;
  if (!str || str.length === 0) return hash;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return Math.abs(hash);
};

/**
 * Menghasilkan string warna HSL CSS yang konsisten untuk status tiket.
 * Warna untuk status umum (open, closed, pending) telah ditentukan sebelumnya,
 * sementara status lain akan menghasilkan warna yang unik dan deterministik
 * berdasarkan hash dari nama status.
 * @param {string} status - Nama status tiket (tidak peka huruf besar/kecil).
 * @param {boolean} [isActive=false] - Apakah status harus dirender dalam keadaan "aktif" (warna sedikit lebih gelap).
 * @returns {string} String warna CSS dalam format HSL (misalnya, 'hsl(120, 75%, 45%)').
 */
export const getStatusColorHsl = (status, isActive = false) => {
  const normalizedStatus = status ? status.toLowerCase().trim() : 'unknown';
  const baseLightness = isActive ? 40 : 50;
  const highSaturation = 75;

  if (normalizedStatus === 'open') return `hsl(210, ${highSaturation}%, ${baseLightness}%)`; // Biru
  if (normalizedStatus === 'closed') return `hsl(145, ${highSaturation}%, ${baseLightness}%)`; // Hijau
  if (normalizedStatus === 'pending') return `hsl(45, ${highSaturation}%, ${baseLightness}%)`; // Kuning

  const hash = simpleHash(normalizedStatus);
  const hue = (hash % 300) + 60;

  const saturation = 70;
  const lightness = isActive ? 40 : 50;

  return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
};