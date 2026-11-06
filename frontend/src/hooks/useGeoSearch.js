import { useQuery } from '@tanstack/react-query';
import { searchRegions } from '../utils/geoApiService';

/**
 * Hook to search for regions by name.
 * @param {string} query - The search query string.
 * @param {boolean} [enabled=true] - Whether the query should run.
 * @returns {import('@tanstack/react-query').UseQueryResult}
 */
export const useGeoSearch = (query, enabled = true) => {
    return useQuery({
        queryKey: ['geoSearch', query],
        queryFn: () => searchRegions(query),
        enabled: enabled && !!query && query.length > 2,
        staleTime: 1000 * 60 * 5, // 5 minutes
        cacheTime: 1000 * 60 * 30, // 30 menit
        refetchOnWindowFocus: false,
        retry: (failureCount, error) => {
            if (error.message.includes('404')) return false;
            return failureCount < 3;
        },
        keepPreviousData: true,
    });
};
