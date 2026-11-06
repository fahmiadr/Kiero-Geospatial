import { useQuery } from '@tanstack/react-query';
import { searchPrefixByPhoneNumber } from '../utils/prefixService';

// Objek data kosong sebagai default jika data 'undefined'
const EMPTY_DATA = null;

/**
 * Hook kustom untuk mencari cakupan geografis dari awalan nomor telepon.
 * Hook ini menggunakan `@tanstack/react-query` untuk menangani permintaan pencarian.
 * Query hanya akan dieksekusi jika `phoneNumber` disediakan.
 *
 * @param {string} phoneNumber - Nomor telepon atau awalan untuk dicari.
 * @returns {import('@tanstack/react-query').UseQueryResult & { data: object|null, loading: boolean }}
 *   Hasil dari `useQuery`, diperkaya dengan alias `loading` dan `data` yang dijamin `null` jika tidak ada.
 */
export const usePrefixSearch = (phoneNumber) => {
    const queryKey = ['prefixSearch', phoneNumber];

    const queryResult = useQuery({
        queryKey,
        queryFn: () => searchPrefixByPhoneNumber(phoneNumber),
        enabled: !!phoneNumber,
        staleTime: 1000 * 60 * 5, // 5 menit
        cacheTime: 1000 * 60 * 30, // 30 menit
        refetchOnWindowFocus: false,
        retry: (failureCount, error) => {
            if (error?.message?.toLowerCase().includes('not found')) {
                return false;
            }
            return failureCount < 3;
        },
        placeholderData: EMPTY_DATA,
    });

    return {
        ...queryResult,
        loading: queryResult.isLoading,
        data: queryResult.data ?? EMPTY_DATA
    };
};