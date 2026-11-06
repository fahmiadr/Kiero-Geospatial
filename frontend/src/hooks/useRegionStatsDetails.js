import { useQuery } from '@tanstack/react-query';
import { getRegionStatsDetails } from '../utils/regionService';

const EMPTY_ARRAY = [];

/**
 * Hook kustom untuk mengambil rincian statistik tiket berdasarkan kategori untuk wilayah,
 * rentang tanggal, dan status tertentu. Hook ini dirancang untuk diaktifkan atau dinonaktifkan
 * secara kondisional.
 *
 * @param {string} regionCode - Kode wilayah untuk mengambil data.
 * @param {{startDate: Date, endDate: Date}} dateRange - Rentang tanggal untuk filter.
 * @param {string} status - Status tiket spesifik untuk mengambil rincian (misalnya, 'open').
 * @param {boolean} isEnabled - Bendera untuk mengontrol apakah query harus dijalankan.
 * @param {number|null} [categoryId] - ID kategori untuk memfilter tiket.
 * @returns {import('@tanstack/react-query').UseQueryResult & { data: Array<object>, loading: boolean }}
 *   Hasil dari `useQuery`, diperkaya dengan alias `loading` dan `data` yang dijamin berupa array.
 */
export const useRegionStatsDetails = (regionCode, dateRange, status, isEnabled, categoryId) => {
    const startDate = dateRange?.startDate?.toISOString().split('T')[0];
    const endDate = dateRange?.endDate?.toISOString().split('T')[0];

    const queryKey = ['regionStatsDetails', regionCode, startDate, endDate, status, categoryId ?? null];

    const queryResult = useQuery({
        queryKey,
        queryFn: () => getRegionStatsDetails(regionCode, startDate, endDate, status, categoryId),
        enabled: !!regionCode && !!status && isEnabled,
        staleTime: 1000 * 60 * 5, // 5 minutes
        cacheTime: 1000 * 60 * 30, // 30 minutes
        refetchOnWindowFocus: false,
        retry: (failureCount, error) => {
            if (error.message.includes('404')) return false;
            return failureCount < 3;
        }
    });

    return { ...queryResult, loading: queryResult.isLoading, data: queryResult.data ?? EMPTY_ARRAY };
};
