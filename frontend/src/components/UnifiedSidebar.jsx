import { useState, useRef, useEffect, useCallback } from 'react';
import { useBoundaryData } from '../hooks/useBoundaryData';
import { REGION_INFO_SIDEBAR_WIDTH } from '../constants/layout';
import SidebarToggleButton from './SidebarToggleButton';
import SidebarAdmin from './sidebar/SidebarAdmin';
import SidebarRegionInfo from './sidebar/SidebarRegionInfo';
import SidebarHistory from './sidebar/SidebarHistory';
import SidebarGeoAi from './sidebar/SidebarGeoAi';

/**
 * Komponen sidebar terpadu yang dapat menampilkan beberapa tampilan konten yang berbeda
 * (`admin`, `regionInfo`, `history`) tergantung pada prop `activeView`.
 * Komponen ini mengelola state internal untuk setiap tampilan dan menangani logika rendering.
 *
 * @param {object} props - Properti komponen.
 * @param {boolean} props.isOpen - Apakah sidebar harus ditampilkan (dikontrol oleh `ActionSidebar`).
 * @param {boolean} props.isHidden - Apakah sidebar disembunyikan (dikontrol oleh `SidebarToggleButton`).
 * @param {Function} props.onToggleVisibility - Fungsi callback untuk mengubah visibilitas (sembunyi/tampil).
 * @param {'admin'|'regionInfo'|'history'|null} props.activeView - Tampilan konten yang akan di-render di dalam sidebar.
 * @param {object} props.currentSelection - Objek seleksi wilayah saat ini untuk tampilan 'admin'.
 * @param {Function} props.onSelectionChange - Fungsi callback untuk perubahan seleksi wilayah dari tampilan 'admin'.
 * @param {object} props.regionData - Data untuk wilayah yang ditampilkan di tampilan 'regionInfo'.
 * @param {object} props.dateRange - Rentang tanggal saat ini, diteruskan ke tampilan 'regionInfo'.
 * @param {Array<object>} props.pins - Array objek pin yang disimpan untuk ditampilkan di tampilan 'history'.
 * @param {Function} props.onGoToPin - Fungsi callback untuk menavigasi ke pin yang dipilih dari tampilan 'history'.
 * @param {Function} props.onDeletePin - Fungsi callback untuk menghapus pin dari tampilan 'history'.
 * @returns {JSX.Element|null} Komponen UnifiedSidebar, atau `null` jika tidak terbuka.
 */
const UnifiedSidebar = ({
    isOpen,
    isHidden,
    onToggleVisibility,
    activeView, // 'admin', 'regionInfo', or 'history'
    // Props for Admin view
    currentSelection,
    onSelectionChange,
    // Props for Region Info view
    regionData,
    dateRange,
    categoryId,
    // Props for History view
    pins,
    onGoToPin,
    onDeletePin,
    isMobile,
    onRegionAutoSelect,
}) => {
    const [activeAdminTab, setActiveAdminTab] = useState('admin');
    const [activeRegionInfoTab, setActiveRegionInfoTab] = useState('stats');
    const [isFullHeight, setIsFullHeight] = useState(false);
    const [dragOffset, setDragOffset] = useState(0);
    const [isDragging, setIsDragging] = useState(false);

    const { data: provinsiData, loading: provinsiLoading } = useBoundaryData({ level: 'provinsi' });
    const { data: kabkotaData, loading: kabkotaLoading } = useBoundaryData({ level: 'kabkota', provinceCode: currentSelection.provinceCode });
    const { data: kecamatanData, loading: kecamatanLoading } = useBoundaryData({ level: 'kecamatan', provinceCode: currentSelection.provinceCode, kabkotaCode: currentSelection.kabkotaCode });
    const { data: desaData, loading: desaLoading } = useBoundaryData({ level: 'desa', provinceCode: currentSelection.provinceCode, kabkotaCode: currentSelection.kabkotaCode, kecamatanCode: currentSelection.kecamatanCode });

    const provinceOptions = provinsiData.map(p => ({ value: p.properties.kode_prov, name: p.properties.nama }));
    const kabkotaOptions = currentSelection.provinceCode ? kabkotaData.filter(k => k.properties.kode_prov === currentSelection.provinceCode).map(k => ({ value: k.properties.kode_kab, name: k.properties.nama })) : [];
    const kecamatanOptions = currentSelection.kabkotaCode ? kecamatanData.filter(k => k.properties.kode_kab === currentSelection.kabkotaCode).map(k => ({ value: k.properties.kode_kec, name: k.properties.nama })) : [];
    const desaOptions = currentSelection.kecamatanCode ? desaData.filter(d => d.properties.kode_kec === currentSelection.kecamatanCode).map(d => ({ value: d.properties.nama, name: d.properties.nama })) : [];

    const startY = useRef(0);
    const currentY = useRef(0);
    const startTime = useRef(0);
    const hasDragged = useRef(false);

    // Reset CSS variable when closed or unmounted, and set it when open
    useEffect(() => {
        if (isMobile) {
            if (isOpen) {
                let baseHeight;
                if (isHidden) baseHeight = `${PEEK_HEIGHT}px`;
                else if (isFullHeight) baseHeight = `${FULL_HEIGHT_VH}vh`;
                else baseHeight = `${HALF_HEIGHT_VH}vh`;

                const currentH = parseFloat(baseHeight.includes('vh')
                    ? (parseFloat(baseHeight) * window.innerHeight / 100)
                    : parseFloat(baseHeight));

                const clampLimit = window.innerHeight * 0.5;
                const clampedH = Math.min(currentH, clampLimit);

                document.documentElement.style.setProperty('--mobile-drawer-height', `${clampedH}px`);
                document.documentElement.style.setProperty('--drawer-transition', 'bottom 0.3s ease-in-out');
            } else {
                // Animate to 80px (ActionSidebar height) when closed
                document.documentElement.style.setProperty('--mobile-drawer-height', '80px');
                document.documentElement.style.setProperty('--drawer-transition', 'bottom 0.3s ease-in-out');
            }
        } else {
            document.documentElement.style.removeProperty('--mobile-drawer-height');
            document.documentElement.style.removeProperty('--drawer-transition');
        }

        return () => {
            document.documentElement.style.removeProperty('--mobile-drawer-height');
            document.documentElement.style.removeProperty('--drawer-transition');
        };
    }, [isOpen, isMobile, isHidden, isFullHeight]);

    const lastActiveView = useRef(activeView);

    useEffect(() => {
        if (activeView) {
            lastActiveView.current = activeView;
        }
    }, [activeView]);

    const renderContent = () => {
        const viewToRender = isOpen ? activeView : lastActiveView.current;
        switch (viewToRender) {
            case 'admin':
                return (
                    <SidebarAdmin
                        isMobile={isMobile}
                        activeAdminTab={activeAdminTab}
                        setActiveAdminTab={setActiveAdminTab}
                        currentSelection={currentSelection}
                        onSelectionChange={onSelectionChange}
                        provinceOptions={provinceOptions}
                        kabkotaOptions={kabkotaOptions}
                        kecamatanOptions={kecamatanOptions}
                        desaOptions={desaOptions}
                        loadingStates={{
                            provinsi: provinsiLoading,
                            kabkota: kabkotaLoading,
                            kecamatan: kecamatanLoading,
                            desa: desaLoading
                        }}
                    />
                );
            case 'regionInfo':
                return (
                    <SidebarRegionInfo
                        isMobile={isMobile}
                        regionData={regionData}
                        activeRegionInfoTab={activeRegionInfoTab}
                        setActiveRegionInfoTab={setActiveRegionInfoTab}
                        dateRange={dateRange}
                        categoryId={categoryId}
                    />
                );
            case 'history':
                return (
                    <SidebarHistory
                        isMobile={isMobile}
                        pins={pins}
                        onGoToPin={onGoToPin}
                        onDeletePin={onDeletePin}
                    />
                );
            case 'geoAi':
                return <SidebarGeoAi isMobile={isMobile} onRegionAutoSelect={onRegionAutoSelect} />;
            default:
                return null;
        }
    };

    const PEEK_HEIGHT = 170;
    const HALF_HEIGHT_VH = 50;
    const FULL_HEIGHT_VH = 99;

    const processDragEnd = useCallback(() => {
        const deltaY = currentY.current - startY.current;
        const deltaTime = Date.now() - startTime.current;
        const velocity = Math.abs(deltaY) / deltaTime;
        const isFlick = velocity > 0.5;

        // Calculate current height state
        const isPeek = isHidden;
        const isHalf = !isHidden && !isFullHeight;
        const isFull = !isHidden && isFullHeight;

        if (isFlick) {
            if (deltaY < 0) { // Flick Up
                if (isPeek) onToggleVisibility(); // Peek -> Half
                else if (isHalf) setIsFullHeight(true); // Half -> Full
            } else { // Flick Down
                if (isFull) setIsFullHeight(false); // Full -> Half
                else if (isHalf) onToggleVisibility(); // Half -> Peek
            }
        } else {
            // Drag logic based on threshold (e.g., 100px)
            const threshold = 100;
            if (deltaY < -threshold) { // Drag Up
                if (isPeek) onToggleVisibility();
                else if (isHalf) setIsFullHeight(true);
            } else if (deltaY > threshold) { // Drag Down
                if (isFull) setIsFullHeight(false);
                else if (isHalf) onToggleVisibility();
            }
        }
    }, [isHidden, isFullHeight, onToggleVisibility]);

    const handleTouchStart = (e) => {
        if (!isMobile) return;
        hasDragged.current = false;
        startY.current = e.touches[0].clientY;
        currentY.current = startY.current;
        startTime.current = Date.now();
        setIsDragging(true);
    };

    const handleTouchMove = (e) => {
        if (!isDragging || !isMobile) return;
        const touchY = e.touches[0].clientY;
        const deltaY = touchY - startY.current;
        if (Math.abs(deltaY) > 5) hasDragged.current = true;
        currentY.current = touchY;
        setDragOffset(deltaY);
    };

    const handleTouchEnd = () => {
        if (!isDragging || !isMobile) return;
        setIsDragging(false);
        setDragOffset(0);
        processDragEnd();
    };

    // Mouse handlers for desktop drag
    const handleMouseDown = (e) => {
        if (!isMobile) return;
        e.preventDefault();
        hasDragged.current = false;
        startY.current = e.clientY;
        currentY.current = startY.current;
        startTime.current = Date.now();
        setIsDragging(true);
    };

    useEffect(() => {
        if (!isDragging) return;

        const handleMouseMove = (e) => {
            const clientY = e.clientY;
            const deltaY = clientY - startY.current;
            if (Math.abs(deltaY) > 5) hasDragged.current = true;
            currentY.current = clientY;
            setDragOffset(deltaY);
        };

        const handleMouseUp = () => {
            setIsDragging(false);
            setDragOffset(0);
            processDragEnd();
        };

        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);

        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isDragging, processDragEnd]);

    const handleMobileToggle = (e) => {
        if (hasDragged.current) {
            if (e) {
                e.preventDefault();
                e.stopPropagation();
            }
            return;
        }

        if (isHidden) {
            // Peek -> Half
            onToggleVisibility();
        } else if (!isFullHeight) {
            // Half -> Full
            setIsFullHeight(true);
        } else {
            // Full -> Half
            setIsFullHeight(false);
        }
    };

    const getHeightStyle = () => {
        if (isMobile) {
            let baseHeight;
            if (isHidden) baseHeight = `${PEEK_HEIGHT}px`;
            else if (isFullHeight) baseHeight = `${FULL_HEIGHT_VH}vh`;
            else baseHeight = `${HALF_HEIGHT_VH}vh`;

            if (isDragging) {
                const currentH = parseFloat(baseHeight.includes('vh')
                    ? (parseFloat(baseHeight) * window.innerHeight / 100)
                    : parseFloat(baseHeight));
                const dragH = currentH - dragOffset;

                // Update CSS variable for other components (clamped at 50vh)
                const clampLimit = window.innerHeight * 0.5;
                const clampedH = Math.min(dragH, clampLimit);
                document.documentElement.style.setProperty('--mobile-drawer-height', `${clampedH}px`);
                document.documentElement.style.setProperty('--drawer-transition', 'none');

                return {
                    height: `calc(${baseHeight} - ${dragOffset}px)`,
                    transition: 'none',
                    transform: 'none'
                };
            }

            // Update CSS variable for static states
            const currentH = parseFloat(baseHeight.includes('vh')
                ? (parseFloat(baseHeight) * window.innerHeight / 100)
                : parseFloat(baseHeight));
            const clampLimit = window.innerHeight * 0.5;
            const clampedH = Math.min(currentH, clampLimit);

            if (isOpen) {
                document.documentElement.style.setProperty('--mobile-drawer-height', `${clampedH}px`);
                document.documentElement.style.setProperty('--drawer-transition', 'bottom 0.3s ease-in-out');
            }

            return {
                height: baseHeight,
                transition: 'height 0.3s ease-in-out, transform 0.3s ease-in-out'
            };
        }
        return { width: REGION_INFO_SIDEBAR_WIDTH };
    };

    return (
        <div
            className={`
                absolute shadow-xl bg-white flex flex-col pointer-events-auto
                ${isMobile
                    ? `bottom-0 left-0 w-full rounded-t-2xl border-t border-gray-200 z-[60] overflow-hidden pb-[90px] transition-transform duration-300 ease-in-out ${isOpen ? 'translate-y-0' : 'translate-y-full pointer-events-none'}`
                    : `top-0 left-0 h-full border-r border-gray-100 transition-all duration-300 ease-in-out ${isOpen && !isHidden ? 'translate-x-0' : '-translate-x-full pointer-events-none'}`
                }
            `}
            style={getHeightStyle()}
        >
            {isMobile && (
                <div
                    className="w-full flex justify-center pt-3 pb-1 cursor-grab active:cursor-grabbing flex-shrink-0 touch-none"
                    onTouchStart={handleTouchStart}
                    onTouchMove={handleTouchMove}
                    onTouchEnd={handleTouchEnd}
                    onMouseDown={handleMouseDown}
                    onClick={handleMobileToggle}
                >
                    <div className="w-12 h-1.5 bg-gray-300 rounded-full"></div>
                </div>
            )}
            {renderContent()}
            {!isMobile && isOpen && (
                <SidebarToggleButton
                    isOpen={!isHidden}
                    onClick={onToggleVisibility}
                    position="left"
                />
            )}
        </div>
    );
};

export default UnifiedSidebar;
