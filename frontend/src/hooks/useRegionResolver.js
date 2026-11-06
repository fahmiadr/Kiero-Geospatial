import { useQuery } from '@tanstack/react-query';
import { searchRegionByName } from '../utils/geoApiService';

/**
 * Hook to resolve region names to codes.
 * @param {object} nameParams - Object containing region names (provinsi, kabkota, kecamatan, desakel).
 * @param {boolean} [enabled=true] - Whether the query should run.
 * @returns {import('@tanstack/react-query').UseQueryResult}
 */
export const useRegionResolver = (nameParams, enabled = true) => {
    return useQuery({
        queryKey: ['regionResolver', nameParams],
        queryFn: async () => {
            const selection = {};

            if (!nameParams.provinsi) return selection;

            // 1. Resolve Province
            const provFeature = await searchRegionByName({ level: 'provinsi', name: nameParams.provinsi });
            if (!provFeature?.properties?.kode_prov) {
                throw new Error(`Provinsi "${nameParams.provinsi}" tidak ditemukan.`);
            }
            selection.provinceCode = provFeature.properties.kode_prov;
            selection.provinceName = provFeature.properties.nama;

            // 2. Resolve Kab/Kota
            if (nameParams.kabkota) {
                const kabFeature = await searchRegionByName({
                    level: 'kab_kota',
                    name: nameParams.kabkota,
                    provinceCode: selection.provinceCode
                });
                if (!kabFeature?.properties?.kode_kab) {
                    throw new Error(`Kabupaten/Kota "${nameParams.kabkota}" tidak ditemukan di ${selection.provinceName}.`);
                }
                selection.kabkotaCode = kabFeature.properties.kode_kab;
                selection.kabkotaName = kabFeature.properties.nama;
            }

            // 3. Resolve Kecamatan
            if (nameParams.kecamatan && selection.kabkotaCode) {
                const kecFeature = await searchRegionByName({
                    level: 'kecamatan',
                    name: nameParams.kecamatan,
                    provinceCode: selection.provinceCode,
                    kabkotaCode: selection.kabkotaCode
                });
                if (!kecFeature?.properties?.kode_kec) {
                    throw new Error(`Kecamatan "${nameParams.kecamatan}" tidak ditemukan di ${selection.kabkotaName}.`);
                }
                selection.kecamatanCode = kecFeature.properties.kode_kec;
                selection.kecamatanName = kecFeature.properties.nama;
            }

            // 4. Resolve Desa/Kelurahan
            if (nameParams.desakel && selection.kecamatanCode) {
                const desaFeature = await searchRegionByName({
                    level: 'desa',
                    name: nameParams.desakel,
                    provinceCode: selection.provinceCode,
                    kabkotaCode: selection.kabkotaCode,
                    kecamatanCode: selection.kecamatanCode
                });
                if (!desaFeature?.properties?.nama) {
                    throw new Error(`Desa/Kelurahan "${nameParams.desakel}" tidak ditemukan di Kec. ${selection.kecamatanName}.`);
                }
                selection.desaName = desaFeature.properties.nama;
            }

            return selection;
        },
        enabled: enabled && !!nameParams.provinsi,
        staleTime: Infinity, // Resolution shouldn't change often
        refetchOnWindowFocus: false,
        retry: (failureCount, error) => {
            if (error.message.includes('404')) return false;
            return failureCount < 3;
        }
    });
};
