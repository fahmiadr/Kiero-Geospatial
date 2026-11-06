import { searchRegionByName } from './geoApiService';

/**
 * Mengonversi objek parameter nama (misalnya dari URL) menjadi objek `selection` yang berisi kode dan nama wilayah.
 * Fungsi ini melakukan pencarian hierarkis, memanggil API secara berurutan untuk setiap tingkat
 * administrasi (provinsi, kab/kota, dst.) untuk mendapatkan kode yang sesuai.
 *
 * @param {object} nameParams - Objek yang berisi nama-nama wilayah.
 * @param {string} [nameParams.provinsi] - Nama provinsi.
 * @param {string} [nameParams.kabkota] - Nama kabupaten/kota.
 * @param {string} [nameParams.kecamatan] - Nama kecamatan.
 * @param {string} [nameParams.desakel] - Nama desa/kelurahan.
 * @returns {Promise<object>} Sebuah promise yang me-resolve ke objek `selection` yang lengkap.
 * @throws {Error} Jika ada nama wilayah pada tingkat tertentu yang tidak dapat ditemukan.
 */
export const getSelectionFromNames = async (nameParams) => {
    const selection = {};

    if (!nameParams.provinsi) return selection;

    const provFeature = await searchRegionByName({ level: 'provinsi', name: nameParams.provinsi });
    if (!provFeature?.properties?.kode_prov) {
        throw new Error(`Provinsi "${nameParams.provinsi}" tidak ditemukan.`);
    }
    selection.provinceCode = provFeature.properties.kode_prov;
    selection.provinceName = provFeature.properties.nama;
    if (!nameParams.kabkota) return selection;

    const kabkotaFeature = await searchRegionByName({
        level: 'kab_kota',
        name: nameParams.kabkota,
        provinceCode: selection.provinceCode,
    });
    if (!kabkotaFeature?.properties?.kode_kab) {
        throw new Error(`Kabupaten/Kota "${nameParams.kabkota}" tidak ditemukan di ${selection.provinceName}.`);
    }
    selection.kabkotaCode = kabkotaFeature.properties.kode_kab;
    selection.kabkotaName = kabkotaFeature.properties.nama;
    if (!nameParams.kecamatan) return selection;

    const kecamatanFeature = await searchRegionByName({
        level: 'kecamatan',
        name: nameParams.kecamatan,
        provinceCode: selection.provinceCode,
        kabkotaCode: selection.kabkotaCode,
    });
    if (!kecamatanFeature?.properties?.kode_kec) {
        throw new Error(`Kecamatan "${nameParams.kecamatan}" tidak ditemukan di ${selection.kabkotaName}.`);
    }
    selection.kecamatanCode = kecamatanFeature.properties.kode_kec;
    selection.kecamatanName = kecamatanFeature.properties.nama;
    if (!nameParams.desakel) return selection;

    const desaFeature = await searchRegionByName({
        level: 'desa',
        name: nameParams.desakel,
        provinceCode: selection.provinceCode,
        kabkotaCode: selection.kabkotaCode,
        kecamatanCode: selection.kecamatanCode,
    });
    if (!desaFeature?.properties?.nama) {
        throw new Error(`Desa/Kelurahan "${nameParams.desakel}" tidak ditemukan di Kec. ${selection.kecamatanName}.`);
    }
    selection.desaName = desaFeature.properties.nama;

    return selection;
};