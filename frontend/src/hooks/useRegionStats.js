import { useQuery } from '@tanstack/react-query';
import { getRegionStats } from '../utils/regionService';
import { TICKET_STATUSES } from '../constants/ticketStatus';

const EMPTY_STATS = TICKET_STATUSES.reduce((acc, status) => {
  acc[status.key] = 0;
  return acc;
}, { total: 0 });

/**
 * Hook kustom untuk mengambil statistik tiket (total, open, pending, closed)
 * untuk wilayah tertentu dalam rentang tanggal yang ditentukan.
 *
 * @param {string} regionCode - Kode wilayah (misalnya, kode provinsi, kabupaten) untuk mengambil statistik.
 * @param {{startDate: Date, endDate: Date}} dateRange - Objek yang berisi tanggal mulai dan akhir untuk filter.
 * @param {number|null} [categoryId] - ID kategori untuk memfilter tiket.
 * @returns {import('@tanstack/react-query').UseQueryResult & { data: object, loading: boolean }}
 *   Hasil dari `useQuery`, diperkaya dengan alias `loading` dan `data` yang dijamin memiliki nilai default.
 */
export const useRegionStats = (regionCode, dateRange, categoryId) => {
  // Format dates to YYYY-MM-DD for stable query key
  const startDate = dateRange?.startDate?.toISOString().split('T')[0];
  const endDate = dateRange?.endDate?.toISOString().split('T')[0];

  const queryKey = ['regionStats', regionCode, startDate, endDate, categoryId ?? null];

  const queryResult = useQuery({
    queryKey,
    queryFn: () => getRegionStats(regionCode, startDate, endDate, categoryId),
    staleTime: 1000 * 60 * 5, // 5 minutes
    cacheTime: 1000 * 60 * 30, // 30 minutes
    enabled: !!regionCode,
    refetchOnWindowFocus: false,
    retry: (failureCount, error) => {
      if (error.message.includes('404')) return false;
      return failureCount < 3;
    }
  });

  return { ...queryResult, loading: queryResult.isLoading, data: queryResult.data ?? EMPTY_STATS };
};
