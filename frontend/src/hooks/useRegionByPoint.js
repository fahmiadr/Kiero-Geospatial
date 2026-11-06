import { useQuery, useQueryClient } from '@tanstack/react-query';
import { findRegionByPoint } from '../utils/geoApiService';

/**
 * Hook to resolve region information from coordinates.
 * @param {number} lat - Latitude.
 * @param {number} lng - Longitude.
 * @param {boolean} [enabled=true] - Whether the query should run.
 * @returns {import('@tanstack/react-query').UseQueryResult}
 */
export const useRegionByPoint = (lat, lng, enabled = true) => {
    return useQuery({
        queryKey: ['regionByPoint', lat, lng],
        queryFn: () => findRegionByPoint(lat, lng),
        enabled: enabled && !!lat && !!lng,
        staleTime: 1000 * 60 * 60, // 1 hour (coordinates to region mapping rarely changes)
        cacheTime: 1000 * 60 * 120,
        refetchOnWindowFocus: false,
        retry: (failureCount, error) => {
            if (error.message.includes('404')) return false;
            return failureCount < 3;
        },
        keepPreviousData: true,
    });
};

/**
 * Hook to imperatively fetch region information from coordinates.
 * Useful for event handlers (e.g., map clicks, place selection).
 * @returns {{ fetchRegionByPoint: (lat: number, lng: number, includeGeometry?: boolean) => Promise<any> }}
 */
export const useRegionByPointFetcher = () => {
    const queryClient = useQueryClient();

    const fetchRegionByPoint = async (lat, lng, includeGeometry = false) => {
        return queryClient.fetchQuery({
            queryKey: ['regionByPoint', lat, lng, includeGeometry],
            queryFn: () => findRegionByPoint(lat, lng, includeGeometry),
            staleTime: 1000 * 60 * 60,
        });
    };

    return { fetchRegionByPoint };
};
