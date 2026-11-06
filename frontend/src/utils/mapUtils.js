/* eslint-disable no-useless-escape */
/**
 * Menghasilkan warna HSL (Hue, Saturation, Lightness) yang deterministik dari sebuah string input.
 * Fungsi ini menggunakan algoritma hash sederhana untuk mengubah string menjadi nilai hue,
 * memastikan bahwa string yang sama akan selalu menghasilkan warna yang sama.
 * Ini berguna untuk memberikan warna yang konsisten pada wilayah peta berdasarkan namanya.
 *
 * @param {string} str - String input, misalnya nama provinsi atau kabupaten.
 * @returns {string} String warna dalam format HSL, contoh: 'hsl(120, 70%, 60%)'.
 */
export function stringToHslColor(str) {
  if (!str) return '#CCCCCC';
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = hash % 360;
  return `hsl(${hue}, 70%, 60%)`;
}

export const getInitialDateRange = () => {
  const params = new URLSearchParams(window.location.search);
  const startParam = params.get('startDate');
  const endParam = params.get('endDate');

  if (startParam && endParam) {
    const startDate = new Date(startParam);
    const endDate = new Date(endParam);
    if (!isNaN(startDate.getTime()) && !isNaN(endDate.getTime())) {
      return { startDate, endDate, key: 'selection' };
    }
  }
  return {
    startDate: new Date(new Date().setDate(new Date().getDate() - 30)),
    endDate: new Date(),
    key: 'selection'
  };
};

export const toSlug = (text) => {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')     // Ganti spasi dengan -
    .replace(/[^\w\-]+/g, '') // Hapus karakter non-word
    .replace(/\-\-+/g, '-');  // Ganti multiple - dengan single -
};

/**
 * Membersihkan nama region dari karakter yang tidak diinginkan seperti tanda kutip berlebih.
 * Contoh: "'DKI Jakarta'" -> "DKI Jakarta"
 * @param {string} regionName 
 * @returns {string} Cleaned region name
 */
export const cleanRegionName = (regionName) => {
  if (!regionName) return null;

  // Split by comma if multiple regions are provided
  const parts = regionName.split(',');

  // Clean and find the LAST valid part
  for (let i = parts.length - 1; i >= 0; i--) {
    const cleaned = parts[i].trim().replace(/^['"]+|['"]+$/g, '').trim();
    if (cleaned) return cleaned;
  }

  return null;
};