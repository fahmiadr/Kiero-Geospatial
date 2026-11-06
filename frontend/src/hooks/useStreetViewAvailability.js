import { useQuery } from '@tanstack/react-query';

export const fetchStreetViewAvailability = async (position, radius = 100) => {
    if (!position || !position.lat || !position.lng || !window.google) {
        throw new Error('Invalid position or Google Maps not loaded');
    }

    const svService = new window.google.maps.StreetViewService();

    return new Promise((resolve, reject) => {
        svService.getPanorama({
            location: { lat: position.lat, lng: position.lng },
            radius: radius,
            source: window.google.maps.StreetViewSource.OUTDOOR
        }, (data, status) => {
            if (status === 'OK') {
                resolve({
                    available: true,
                    pano: data.location.pano,
                    latLng: data.location.latLng,
                    description: data.location.description
                });
            } else if (status === 'ZERO_RESULTS') {
                resolve({ available: false });
            } else {
                reject(new Error(`StreetViewService error: ${status}`));
            }
        });
    });
};

/**
 * Hook untuk mengecek ketersediaan Street View di lokasi tertentu dengan caching TanStack Query.
 * @param {object} position - Koordinat {lat, lng}
 * @param {number} radius - Radius pencarian dalam meter (default 100)
 * @param {boolean} enabled - Apakah query aktif atau tidak
 * @returns {object} Query result object (data, isLoading, status, etc)
 */
export function useStreetViewAvailability(position, radius = 100, enabled = true) {
    return useQuery({
        queryKey: ['streetview-availability', position?.lat, position?.lng, radius],
        queryFn: () => fetchStreetViewAvailability(position, radius),
        enabled: !!(enabled && position?.lat && position?.lng && window.google),
        staleTime: 1000 * 60 * 60, // Cache selama 1 jam
        gcTime: 1000 * 60 * 60 * 2, // Simpan di memori selama 2 jam
        retry: false
    });
}
