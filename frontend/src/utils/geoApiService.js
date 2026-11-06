import { fetchAuthenticated } from './authService.js';

/**
 * Mengambil data GeoJSON untuk semua provinsi.
 * @async
 * @returns {Promise<Array<object>>} Promise yang me-resolve ke array fitur GeoJSON provinsi.
 * @throws {Error} Jika permintaan API gagal.
 */
export async function getProvinces() {
    const response = await fetchAuthenticated('/api/v1/geo/provinsi');
    if (!response.ok) {
        throw new Error('Gagal mengambil data provinsi');
    }
    const result = await response.json();
    return result.data;
}

/**
 * Mengambil data GeoJSON kabupaten/kota untuk provinsi tertentu.
 * @async
 * @param {string} provinceCode - Kode provinsi.
 * @returns {Promise<Array<object>>} Promise yang me-resolve ke array fitur GeoJSON kabupaten/kota.
 * @throws {Error} Jika permintaan API gagal.
 */
export async function getKabKota(provinceCode) {
    const response = await fetchAuthenticated(`/api/v1/geo/kab-kota/${provinceCode}`);
    if (!response.ok) {
        throw new Error(`Gagal mengambil data kab/kota untuk provinsi ${provinceCode}`);
    }
    const result = await response.json();
    return result.data;
}

/**
 * Mengambil data GeoJSON kecamatan untuk kabupaten/kota tertentu.
 * @async
 * @param {string} provinceCode - Kode provinsi.
 * @param {string} kabkotaCode - Kode kabupaten/kota.
 * @returns {Promise<Array<object>>} Promise yang me-resolve ke array fitur GeoJSON kecamatan.
 * @throws {Error} Jika permintaan API gagal.
 */
export async function getKecamatan(provinceCode, kabkotaCode) {
    const response = await fetchAuthenticated(`/api/v1/geo/kecamatan/${provinceCode}/${kabkotaCode}`);
    if (!response.ok) {
        throw new Error(`Gagal mengambil data kecamatan untuk kab/kota ${kabkotaCode}`);
    }
    const result = await response.json();
    return result.data;
}

/**
 * Mengambil data GeoJSON desa untuk kecamatan tertentu.
 * @async
 * @param {string} provinceCode - Kode provinsi.
 * @param {string} kabkotaCode - Kode kabupaten/kota.
 * @param {string} kecamatanCode - Kode kecamatan.
 * @returns {Promise<Array<object>>} Promise yang me-resolve ke array fitur GeoJSON desa.
 * @throws {Error} Jika permintaan API gagal.
 */
export async function getDesa(provinceCode, kabkotaCode, kecamatanCode) {
    const response = await fetchAuthenticated(`/api/v1/geo/desa/${provinceCode}/${kabkotaCode}/${kecamatanCode}`);
    if (!response.ok) {
        throw new Error(`Gagal mengambil data desa untuk kecamatan ${kecamatanCode}`);
    }
    const result = await response.json();
    return result.data;
}

/**
 * Mencari satu wilayah berdasarkan nama dan level, dengan filter opsional. Mengembalikan hasil pertama yang cocok.
 * @async
 * @param {object} params - Parameter pencarian.
 * @param {string} params.level - Level administratif (misalnya, 'provinsi').
 * @param {string} params.name - Nama wilayah yang dicari.
 * @param {string} [params.provinceCode] - Kode provinsi untuk memfilter.
 * @param {string} [params.kabkotaCode] - Kode kab/kota untuk memfilter.
 * @param {string} [params.kecamatanCode] - Kode kecamatan untuk memfilter.
 * @param {boolean} [params.includeGeometry] - Apakah menyertakan geometri.
 * @returns {Promise<object|null>} Promise yang me-resolve ke fitur GeoJSON wilayah yang ditemukan, atau null jika tidak ada yang cocok.
 * @throws {Error} Jika permintaan API gagal.
 */
export const searchRegionByName = async ({ level, name, provinceCode, kabkotaCode, kecamatanCode, includeGeometry }) => {
    const query = new URLSearchParams({ level, name });
    if (provinceCode) query.append('provinceCode', provinceCode);
    if (kabkotaCode) query.append('kabkotaCode', kabkotaCode);
    if (kecamatanCode) query.append('kecamatanCode', kecamatanCode);
    if (includeGeometry !== undefined) query.append('includeGeometry', includeGeometry);

    if (includeGeometry !== undefined) query.append('includeGeometry', includeGeometry);

    const response = await fetchAuthenticated(`/api/v1/geo/search?${query.toString()}`);
    if (!response.ok) {
        throw new Error('Gagal mencari data wilayah');
    }
    const result = await response.json();
    const features = result.data;
    return features?.[0] || null;
};

/**
 * Mencari informasi hierarki wilayah administratif berdasarkan titik koordinat geografis.
 * @async
 * @param {number} lat - Latitude.
 * @param {number} lng - Longitude.
 * @param {boolean} [includeGeometry=false] - Whether to include GeoJSON geometry in the response.
 * @returns {Promise<object>} Promise yang me-resolve ke objek yang berisi informasi administrasi wilayah.
 * @throws {Error} Jika permintaan API gagal atau terjadi kesalahan lain.
 */
export const findRegionByPoint = async (lat, lng, includeGeometry = false) => {
    try {
        const response = await fetchAuthenticated('/api/v1/geo/find-by-point', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ lat, lng, includeGeometry }),
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(`API Error: ${errorData.message || response.statusText}`);
        }

        const jsonResponse = await response.json();
        return jsonResponse.data;
    } catch (error) {
        console.error('Gagal mengambil data dari /find-by-point:', error);
        throw error;
    }
};

/**
 * Melakukan pencarian umum untuk SearchBar.
 * @async
 * @param {string} query - Kata kunci pencarian.
 * @returns {Promise<Array<object>>} Promise yang me-resolve ke array hasil pencarian.
 */
export const searchRegions = async (query) => {
    const response = await fetchAuthenticated(`/api/v1/geo/search?name=${encodeURIComponent(query)}&includeGeometry=false`);
    if (!response.ok) {
        throw new Error('Gagal melakukan pencarian wilayah');
    }
    const result = await response.json();
    return result.data || [];
};