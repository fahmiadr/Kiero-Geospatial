import { useEffect, useRef, useState } from 'react';
import { useMap, useMapsLibrary } from '@vis.gl/react-google-maps';

/**
 * Konversi warna HSL ke HEX karena SVG Data URI sering gagal merender hsl()
 * @param {string} hslStr 
 * @returns {string} Hex color
 */
function hslToHex(hslStr) {
    if (!hslStr || !hslStr.startsWith('hsl')) return hslStr;
    const match = hslStr.match(/hsl\((\d+),\s*(\d+)%,\s*(\d+)%\)/);
    if (!match) return hslStr;
    
    let h = parseInt(match[1], 10);
    let s = parseInt(match[2], 10) / 100;
    let l = parseInt(match[3], 10) / 100;
    
    let c = (1 - Math.abs(2 * l - 1)) * s;
    let x = c * (1 - Math.abs((h / 60) % 2 - 1));
    let m = l - c/2;
    let r = 0, g = 0, b = 0;
    
    if (0 <= h && h < 60) { r = c; g = x; b = 0; }
    else if (60 <= h && h < 120) { r = x; g = c; b = 0; }
    else if (120 <= h && h < 180) { r = 0; g = c; b = x; }
    else if (180 <= h && h < 240) { r = 0; g = x; b = c; }
    else if (240 <= h && h < 300) { r = x; g = 0; b = c; }
    else if (300 <= h && h < 360) { r = c; g = 0; b = x; }
    
    r = Math.round((r + m) * 255).toString(16).padStart(2, '0');
    g = Math.round((g + m) * 255).toString(16).padStart(2, '0');
    b = Math.round((b + m) * 255).toString(16).padStart(2, '0');
    
    return `#${r}${g}${b}`;
}

/**
 * Hook untuk merender Marker klasik khusus di Street View.
 * Ini melengkapi AdvancedMarkerElement yang secara native tidak muncul di Street View.
 * @param {object} props 
 * @param {object} props.position - Koordinat {lat, lng}
 * @param {string} props.color - Warna marker (hex atau string rgba/hsl)
 * @param {Function} props.onClick - Callback saat marker diklik
 */
export function useStreetViewMarker({ position, title, color = '#ef4444', onClick }) {
    const map = useMap();
    const markerLib = useMapsLibrary('marker');
    const markerRef = useRef(null);
    const [isSvVisible, setIsSvVisible] = useState(false);
    
    // Gunakan ref untuk onClick agar tidak memicu re-render / re-create listener terus menerus
    const onClickRef = useRef(onClick);
    useEffect(() => {
        onClickRef.current = onClick;
    }, [onClick]);

    // Effect 1: Inisialisasi Marker (Hanya dipanggil sekali atau ketika posisi berubah secara dramatis)
    useEffect(() => {
        if (!map || !markerLib || !position || position.lat === undefined || position.lng === undefined) return;

        const streetView = map.getStreetView();
        
        // Setup ikon awal agar tidak muncul pin default bawaan Google Maps
        const safeColor = hslToHex(color);
        const svgString = `<svg viewBox="0 0 24 24" width="40" height="40" fill="${safeColor}" xmlns="http://www.w3.org/2000/svg"><path d="M12 22C12 22 4 14.2203 4 10C4 5.58172 7.58172 2 12 2C16.4183 2 20 5.58172 20 10C20 14.2203 12 22 12 22Z"/><circle cx="12" cy="10" r="3" fill="white"/></svg>`;
        const iconUrl = `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svgString)}`;

        // Buat marker dengan konfigurasi penuh di awal
        const marker = new markerLib.Marker({
            position: { lat: Number(position.lat), lng: Number(position.lng) },
            title: title || '',
            icon: {
                url: iconUrl,
                scaledSize: new window.google.maps.Size(40, 40),
                anchor: new window.google.maps.Point(20, 40)
            }
        });
        markerRef.current = marker;

        const updateVisibility = () => {
            const visible = streetView.getVisible();
            setIsSvVisible(visible);
            if (visible) {
                marker.setMap(streetView);
            } else {
                marker.setMap(null);
            }
        };

        // Inisialisasi awal
        updateVisibility();

        // Pantau perubahan visibilitas Street View
        const listener = streetView.addListener('visible_changed', updateVisibility);

        // Pantau klik (meneruskan ke onClickRef yang selalu terbaru)
        const clickListener = marker.addListener('click', (e) => {
            if (onClickRef.current) onClickRef.current(e);
        });

        return () => {
            listener.remove();
            clickListener.remove();
            marker.setMap(null);
            markerRef.current = null;
        };
    }, [map, markerLib, position?.lat, position?.lng]); // Dependensi minimal agar marker tidak dihancurkan saat properties lain berubah

    // Effect 2: Update Properti Marker (judul dan ikon) secara dinamis
    useEffect(() => {
        if (!markerRef.current) return;

        markerRef.current.setTitle(title || '');

        const safeColor = hslToHex(color);
        const svgString = `<svg viewBox="0 0 24 24" width="40" height="40" fill="${safeColor}" xmlns="http://www.w3.org/2000/svg"><path d="M12 22C12 22 4 14.2203 4 10C4 5.58172 7.58172 2 12 2C16.4183 2 20 5.58172 20 10C20 14.2203 12 22 12 22Z"/><circle cx="12" cy="10" r="3" fill="white"/></svg>`;
        const iconUrl = `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svgString)}`;

        markerRef.current.setIcon({
            url: iconUrl,
            scaledSize: new window.google.maps.Size(40, 40),
            anchor: new window.google.maps.Point(20, 40)
        });
    }, [title, color]); // Update saat properti visual ini berubah

    return { marker: markerRef.current, isVisible: isSvVisible };
}
