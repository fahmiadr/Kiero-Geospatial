import React, { useState, useEffect } from 'react';
import { useMap } from '@vis.gl/react-google-maps';
import { Layers, Road } from 'lucide-react';

const MapLayerControl = ({ mapLayer, onMapLayerChange, isStreetViewVisible, onStreetViewVisibilityChange, style, isMobile }) => {
    const map = useMap();
    const [isHovered, setIsHovered] = useState(false);
    const [mapPreviewUrl, setMapPreviewUrl] = useState('');

    // Update preview image when map moves
    useEffect(() => {
        if (!map) return;

        const updatePreview = () => {
            const center = map.getCenter();
            const zoom = map.getZoom();
            if (center && zoom) {
                const lat = center.lat();
                const lng = center.lng();
                const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
                // Use the CURRENT map layer for the preview as requested ("representasi dari map yang terlihat sekarang")
                const type = mapLayer === 'default' ? 'roadmap' : 'satellite';
                // Add style to hide labels (clean map)
                const style = '&style=feature:all|element:labels|visibility:off';
                const url = `https://maps.googleapis.com/maps/api/staticmap?center=${lat},${lng}&zoom=${zoom}&size=1000x1000&maptype=${type}${style}&key=${apiKey}`;
                setMapPreviewUrl(url);
            }
        };

        // Initial update
        updatePreview();

        // Listen for map moves (debounce could be added if needed, but 'idle' is good)
        const listener = map.addListener('idle', updatePreview);

        return () => {
            if (listener) listener.remove();
        };
    }, [map, mapLayer]);

    const [showMobileMenu, setShowMobileMenu] = useState(false);

    // Close mobile menu when clicking outside
    useEffect(() => {
        if (!showMobileMenu) return;
        const handleClickOutside = () => setShowMobileMenu(false);
        document.addEventListener('click', handleClickOutside);
        return () => document.removeEventListener('click', handleClickOutside);
    }, [showMobileMenu]);

    const handleToggleMap = (e) => {
        if (isMobile) {
            e.stopPropagation();
            setShowMobileMenu(!showMobileMenu);
        } else {
            onMapLayerChange(mapLayer === 'default' ? 'satellite' : 'default');
        }
    };

    const handleToggleStreetView = (e) => {
        e.stopPropagation();
        onStreetViewVisibilityChange(!isStreetViewVisible);
    };

    const handleMobileMapTypeChange = (type) => {
        onMapLayerChange(type);
    };

    const hoverTimeoutRef = React.useRef(null);

    const handleMouseEnter = () => {
        if (isMobile) return;
        if (hoverTimeoutRef.current) {
            clearTimeout(hoverTimeoutRef.current);
            hoverTimeoutRef.current = null;
        }
        setIsHovered(true);
    };

    const handleMouseLeave = () => {
        if (isMobile) return;
        hoverTimeoutRef.current = setTimeout(() => {
            setIsHovered(false);
        }, 300); // 300ms delay to make it stable
    };

    return (
        <div
            className={`absolute z-10 pointer-events-none flex items-end transition-all duration-300 ease-in-out ${isMobile ? 'left-4' : 'bottom-4'} ${(isMobile ? showMobileMenu : isHovered) ? 'gap-2' : 'gap-0'}`}
            style={isMobile ? { bottom: 'calc(var(--mobile-drawer-height, 80px) + 16px)', transition: 'var(--drawer-transition, bottom 0.3s ease-in-out)' } : style}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
            onClick={(e) => e.stopPropagation()} // Prevent closing when clicking inside container
        >
            {/* Main Toggle Button */}
            <button
                onClick={handleToggleMap}
                className={`
                    relative w-20 h-20 rounded-xl shadow-md border-2 border-white overflow-hidden transition-all duration-300
                    hover:shadow-lg focus:outline-none ring-0 group pointer-events-auto
                `}
                title={isMobile ? "Pilih Lapisan Peta" : (mapLayer === 'default' ? "Ganti ke Satelit" : "Ganti ke Peta")}
            >
                {/* Background Preview (Shows current active map type) */}
                <div className="absolute inset-0 transition-opacity duration-300">
                    {mapPreviewUrl && (
                        <img
                            src={mapPreviewUrl}
                            alt="Map Preview"
                            className="w-full h-full object-cover"
                        />
                    )}
                </div>

                {/* Content Overlay */}
                <div className="absolute inset-0 z-10">
                    {/* Normal State: Icon + "Lapisan" at bottom */}
                    <div className={`absolute bottom-1 left-0 right-0 flex items-center justify-center gap-1 transition-opacity duration-200 ${isHovered ? 'opacity-0' : 'opacity-100'}`}>
                        <div className="p-0.5">
                            {/* Reduced icon size to w-2.5 h-2.5 */}
                            <Layers size={16} className={mapLayer === 'satellite' ? 'text-white' : 'text-gray-900'} />
                        </div>
                        {/* Text color logic: Map -> Black, Satellite -> White */}
                        <span className={`text-[10px] font-medium ${mapLayer === 'default' ? 'text-gray-900 drop-shadow-sm' : 'text-white drop-shadow-md'}`}>
                            Lapisan
                        </span>
                    </div>

                    {/* Hover State: Active Map Name (Desktop Only) */}
                    {!isMobile && (
                        <div className={`absolute inset-0 flex items-center justify-center bg-black/10 backdrop-blur-[1px] transition-opacity duration-200 ${isHovered ? 'opacity-100' : 'opacity-0'}`}>
                            <span className={`text-xs font-semibold ${mapLayer === 'default' ? 'text-gray-900' : 'text-white'} drop-shadow-md`}>
                                {mapLayer === 'default' ? 'Peta' : 'Satelit'}
                            </span>
                        </div>
                    )}
                </div>
            </button>

            {/* Side Panel (Desktop Hover) or Popover (Mobile Click) */}
            <div
                className={`
                    bg-white rounded-lg shadow-xl overflow-hidden
                    transition-all duration-300 origin-bottom-left
                    ${(isMobile ? showMobileMenu : isHovered)
                        ? 'max-w-[300px] opacity-100 translate-x-0 scale-100 pointer-events-auto border border-gray-100'
                        : 'max-w-0 opacity-0 -translate-x-4 scale-95 pointer-events-none border-0'}
                `}
            >
                <div className="flex flex-col gap-1 w-48 p-2">
                    {isMobile && <span className="text-xs font-semibold text-gray-500 px-2 mb-1">Jenis Peta</span>}

                    {/* Mobile: Map Type Selection */}
                    {isMobile && (
                        <div className="flex flex-col gap-1 mb-2">
                            <button
                                onClick={() => handleMobileMapTypeChange('default')}
                                className={`
                                    flex items-center gap-2 p-2 rounded-md text-sm font-medium transition-colors w-full text-left
                                    ${mapLayer === 'default' ? 'bg-blue-50 text-blue-700 ring-1 ring-blue-200' : 'text-gray-700 hover:bg-gray-50'}
                                `}
                            >
                                <span className="w-4 h-4 border border-gray-300 rounded-full flex items-center justify-center">
                                    {mapLayer === 'default' && <span className="w-2 h-2 bg-blue-600 rounded-full" />}
                                </span>
                                Default
                            </button>
                            <button
                                onClick={() => handleMobileMapTypeChange('satellite')}
                                className={`
                                    flex items-center gap-2 p-2 rounded-md text-sm font-medium transition-colors w-full text-left
                                    ${mapLayer === 'satellite' ? 'bg-blue-50 text-blue-700 ring-1 ring-blue-200' : 'text-gray-700 hover:bg-gray-50'}
                                `}
                            >
                                <span className="w-4 h-4 border border-gray-300 rounded-full flex items-center justify-center">
                                    {mapLayer === 'satellite' && <span className="w-2 h-2 bg-blue-600 rounded-full" />}
                                </span>
                                Satelit
                            </button>
                        </div>
                    )}

                    <span className="text-xs font-semibold text-gray-500 px-2 mb-1">Detail Peta</span>
                    <button
                        onClick={handleToggleStreetView}
                        className={`
                            flex items-center gap-3 p-2 rounded-md text-sm font-medium transition-colors w-full text-left
                            ${isStreetViewVisible ? 'bg-blue-50 text-blue-700 ring-1 ring-blue-200' : 'text-gray-700 hover:bg-gray-50'}
                        `}
                    >
                        <Road size={20} />
                        Street View
                    </button>
                </div>
            </div>
        </div>
    );
};

export default MapLayerControl;
