import { useQuery } from '@tanstack/react-query';
import { getCategories } from '../utils/categoryService';

const EMPTY_ARRAY = [];

/**
 * Hook kustom untuk mengambil daftar kategori tiket dari API.
 * Hook ini memanfaatkan `@tanstack/react-query` untuk menangani pengambilan data,
 * caching, dan status pemuatan/kesalahan. Data kategori dianggap cukup statis,
 * sehingga di-cache untuk waktu yang relatif lama.
 *
 * @returns {import('@tanstack/react-query').UseQueryResult & { data: Array<{id: string, category_name: string}>, loading: boolean }}
 *   Hasil dari `useQuery`, diperkaya dengan `data` yang dijamin berupa array dan alias `loading`.
 */
export const useCategoryData = () => {
  const queryKey = ['categories'];

  const queryResult = useQuery({
    queryKey,
    queryFn: getCategories,
    staleTime: 1000 * 60 * 5, // 5 menit
    cacheTime: 1000 * 60 * 30, // 30 menit
    refetchOnWindowFocus: false,
    retry: (failureCount, error) => {
      if (error.message.includes('404')) return false;
      return failureCount < 3;
    }
  });

  return { ...queryResult, loading: queryResult.isLoading, data: queryResult.data ?? EMPTY_ARRAY };
};
