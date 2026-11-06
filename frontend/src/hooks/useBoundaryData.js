import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { getProvinces, getKabKota, getKecamatan, getDesa } from '../utils/geoApiService';

const EMPTY_ARRAY = [];
/**
 * Hook kustom untuk mengambil data batas administratif (GeoJSON) dari API.
 * Hook ini menggunakan `@tanstack/react-query` untuk caching, re-fetching otomatis,
 * dan manajemen state pemuatan/kesalahan. Hook ini secara dinamis memilih fungsi
 * pengambilan data yang tepat berdasarkan `level` yang diminta.
 *
 * @param {object} params - Parameter untuk menentukan data batas mana yang akan diambil.
 * @param {'provinsi' | 'kabkota' | 'kecamatan' | 'desa'} params.level - Tingkat administratif yang akan diambil.
 * @param {string} [params.provinceCode] - Diperlukan untuk level 'kabkota' dan di bawahnya.
 * @param {string} [params.kabkotaCode] - Diperlukan untuk level 'kecamatan' dan di bawahnya.
 * @param {string} [params.kecamatanCode] - Diperlukan untuk level 'desa'.
 * @returns {import('@tanstack/react-query').UseQueryResult & { data: Array<object>, loading: boolean }}
 *   Hasil dari `useQuery`, diperkaya dengan `data` yang dijamin berupa array dan alias `loading`.
 */
export const useBoundaryData = ({
  level,
  provinceCode,
  kabkotaCode,
  kecamatanCode,
}) => {
  // Membuat queryKey yang unik untuk setiap permintaan data.
  // React Query menggunakan kunci ini untuk caching.
  const queryKey = useMemo(() =>
    ['boundary', level, provinceCode, kabkotaCode, kecamatanCode],
    [level, provinceCode, kabkotaCode, kecamatanCode]
  );

  // Menentukan fungsi fetcher mana yang akan dipanggil berdasarkan level.
  // Memoized untuk mencegah recreate setiap render
  const queryFn = useMemo(() => {
    switch (level) {
      case 'provinsi':
        return getProvinces;
      case 'kabkota':
        // Pastikan provinceCode ada sebelum memanggil fetcher.
        return () => getKabKota(provinceCode);
      case 'kecamatan':
        return () => getKecamatan(provinceCode, kabkotaCode);
      case 'desa':
        return () => getDesa(provinceCode, kabkotaCode, kecamatanCode);
      default:
        // Kembalikan fungsi yang mengembalikan null jika level tidak valid.
        return () => null;
    }
  }, [level, provinceCode, kabkotaCode, kecamatanCode]);

  // Menentukan apakah query harus dijalankan.
  // Memoized untuk mencegah recalculation setiap render
  const enabled = useMemo(() => {
    switch (level) {
      case 'provinsi':
        return true;
      case 'kabkota':
        return !!provinceCode;
      case 'kecamatan':
        return !!provinceCode && !!kabkotaCode;
      case 'desa':
        return !!provinceCode && !!kabkotaCode && !!kecamatanCode;
      default:
        return false;
    }
  }, [level, provinceCode, kabkotaCode, kecamatanCode]);

  const queryResult = useQuery({
    queryKey,
    queryFn,
    staleTime: Infinity,
    cacheTime: 1000 * 60 * 60, // 60 menit
    enabled,
    refetchOnWindowFocus: false,
    retry: (failureCount, error) => {
      if (error.message.includes('404')) return false;
      return failureCount < 3;
    }
  });

  return { ...queryResult, loading: queryResult.isLoading, data: queryResult.data ?? EMPTY_ARRAY };
};