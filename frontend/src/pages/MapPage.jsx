import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { APIProvider, InfoWindow } from '@vis.gl/react-google-maps';
import screenfull from 'screenfull';
import MapComponent from '../components/MapComponent';
import MapControls from '../components/MapControls';
import SearchBar from '../components/SearchBar';
import FilterPills from '../components/FilterPills';
import UnifiedSidebar from '../components/UnifiedSidebar';
import ActionSidebar from '../components/ActionSidebar';
import RegionPreviewInfoWindow from '../components/RegionPreviewInfoWindow';
import FloatingActionButtons from '../components/FloatingActionButtons';
import MapLayerControl from '../components/MapLayerControl';
import LoadingOverlay from '../components/LoadingOverlay';
import ErrorModal from '../components/ErrorModal';
import OffscreenIndicatorsLayer from '../components/OffscreenIndicatorsLayer';
import { MapPinPlus, Reply } from 'lucide-react';
import Tooltip from '../components/Tooltip';
import { useBoundaryData } from '../hooks/useBoundaryData';
import { useTicketsData, useTicketDetails } from '../hooks/useTicketsData';
import { useRegionStats } from '../hooks/useRegionStats';
import { useUrlSync } from '../hooks/useUrlSync';
import { useRegionResolver } from '../hooks/useRegionResolver';
import { useRegionByPointFetcher } from '../hooks/useRegionByPoint';
import { addPinToHistory, getPinHistory, removePinFromHistory, updatePinInHistory, generatePinId } from '../utils/pin-history';
import { ACTION_SIDEBAR_WIDTH, REGION_INFO_SIDEBAR_WIDTH } from '../constants/layout';
import { getInitialDateRange, toSlug } from '../utils/mapUtils'
import { useCategoryData } from '../hooks/useCategoryData';

const MAP_LIBRARIES = ['places', 'geometry', 'geocoding'];

/**
 * Komponen halaman utama aplikasi peta.
 * Bertindak sebagai orkestrator utama, mengelola state untuk seluruh aplikasi,
 * termasuk seleksi wilayah, filter, pin, status UI (misalnya, sidebar mana yang terbuka),
 * dan data peta. Komponen ini menyatukan semua komponen UI utama seperti
 * `MapComponent`, `UnifiedSidebar`, `SearchBar`, dll.
 * @returns {JSX.Element} Halaman aplikasi peta lengkap.
 */
const MapPage = () => {
    const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
    const { fetchRegionByPoint } = useRegionByPointFetcher();

    const [mapInstance, setMapInstance] = useState(null);
    const [isFullscreen, setIsFullscreen] = useState(screenfull.isFullscreen);
    const mainContainerRef = useRef(null);
    const [currentSelection, setCurrentSelection] = useState({});
    const [mapViewMode, setMapViewMode] = useState(() => {
        const params = new URLSearchParams(window.location.search);
        const urlViewMode = params.get('view_mode') || 'region-only';
        if (!params.get('provinsi') && !currentSelection.provinceCode) {
            return 'drill-down';
        }
        return urlViewMode;
    });
    const [activeSidebar, setActiveSidebar] = useState(null); // Can be 'wilayah', 'regionInfo', 'history', or null
    const [isSidebarHidden, setIsSidebarHidden] = useState(false);
    const [isTouchDevice, setIsTouchDevice] = useState(false);
    const [categorySelection, setCategorySelection] = useState(null);
    const [dateRange, setDateRange] = useState(getInitialDateRange);
    const [isLoading, setIsLoading] = useState(true);
    const [urlError, setUrlError] = useState(null);
    const [searchError, setSearchError] = useState(null);
    const [isInitialLoadComplete, setIsInitialLoadComplete] = useState(false);
    const [isNavigating, setIsNavigating] = useState(false);
    const [loadingText, setLoadingText] = useState('Memuat data peta...');
    const navigationHistory = useRef([{ selection: {}, viewMode: 'drill-down' }]);
    const [isPinningMode, setIsPinningMode] = useState(false);
    const [locateTrigger, setLocateTrigger] = useState(0);
    const [isViewCentered, setIsViewCentered] = useState(true);
    const [isBoundaryTransparent, setIsBoundaryTransparent] = useState(false);
    const [pins, setPins] = useState(getPinHistory);
    const [activePinId, setActivePinId] = useState(() => {
        const params = new URLSearchParams(window.location.search);
        return params.get('active_pin_id');
    });
    const [newlyCreatedPinId, setNewlyCreatedPinId] = useState(null);
    const [rawInfoData, setRawInfoData] = useState(null);
    const [augmentedInfoData, setAugmentedInfoData] = useState(null);

    const [panToTarget, setPanToTarget] = useState(null);
    const [mapData, setMapData] = useState([]);
    const [activeTicketId, setActiveTicketId] = useState(null);
    const [previewInfo, setPreviewInfo] = useState(null);
    const [fabPosition, setFabPosition] = useState(null);
    const mapContainerRef = useRef(null);
    const pannedTicketId = useRef(null);
    const pannedPinId = useRef(null);
    const [mapViewport, setMapViewport] = useState(null);
    const [urlZoom] = useState(() => {
        const params = new URLSearchParams(window.location.search);
        const z = params.get('zoom');
        return z ? parseInt(z, 10) : null;
    });
    const [mapLayer, setMapLayer] = useState('default');
    const [isStreetViewLayerActive, setIsStreetViewLayerActive] = useState(false);
    const [isStreetViewVisible, setIsStreetViewVisible] = useState(false);
    const [streetViewData, setStreetViewData] = useState(null);

    const handlePinStreetViewLocation = () => {
        if (streetViewData && streetViewData.position) {
            // Create mock event for handleAddPin
            const mockEvent = {
                latLng: {
                    lat: () => streetViewData.position.lat,
                    lng: () => streetViewData.position.lng
                }
            };

            // Exit Street View and focus on the new pin
            if (mapInstance) {
                mapInstance.getStreetView().setVisible(false);
                mapInstance.setCenter(streetViewData.position);
                mapInstance.setZoom(18);
            }

            // Directly add the pin with a slight delay to allow map to become visible
            setTimeout(() => {
                handleAddPin(mockEvent);
            }, 500);

            // Ensure we are not in "waiting for click" mode
            setIsPinningMode(false);
        }
    };

    const { data: categories, loading: categoriesLoading } = useCategoryData();

    const handleToggleFullscreen = () => {
        if (screenfull.isEnabled) {
            screenfull.toggle();
        }
    };

    useEffect(() => {
        if (screenfull.isEnabled) {
            const handleFullscreenChange = () => {
                setIsFullscreen(screenfull.isFullscreen);
            };

            screenfull.on('change', handleFullscreenChange);

            return () => {
                screenfull.off('change', handleFullscreenChange);
            };
        }
    }, []);

    useEffect(() => {
        setTimeout(() => window.dispatchEvent(new Event('resize')), 300);
    }, [isFullscreen]);

    // Listener for map movement
    useEffect(() => {
        if (!mapInstance) return;

        const handleIdle = () => {
            const bounds = mapInstance.getBounds();
            const center = mapInstance.getCenter();
            const zoom = mapInstance.getZoom();

            if (bounds && center && zoom) {
                setMapViewport({
                    bounds: bounds.toJSON(),
                    center: center.toJSON(),
                    zoom: zoom,
                });
            }
        };

        const idleListener = mapInstance.addListener('idle', handleIdle);
        handleIdle(); // Initial trigger

        return () => {
            idleListener.remove();
        };
    }, [mapInstance]);

    useEffect(() => {
        if (!mapInstance) return;

        const handleDragStart = () => {
            setPreviewInfo(null);
            setFabPosition(null);
        };

        const dragStartListener = mapInstance.addListener('dragstart', handleDragStart);

        return () => {
            dragStartListener.remove();
        };
    }, [mapInstance]);

    const syncViewMode = useCallback((newViewMode) => {
        setMapViewMode(newViewMode);
        const newParams = new URLSearchParams(window.location.search);
        newParams.set('view_mode', newViewMode);
        window.history.replaceState({}, '', `${window.location.pathname}?${newParams.toString()}`);
    }, []);

    const { data: regionStats, loading: statsLoading } = useRegionStats(previewInfo?.code, dateRange, categorySelection);

    const selectedCategoryObj = categories?.find(c => c.id === categorySelection);
    const categoryUrlValue = selectedCategoryObj ? toSlug(selectedCategoryObj.category_name) : null;

    useUrlSync(currentSelection, activePinId, categoryUrlValue, isInitialLoadComplete, {
        startDate: dateRange.startDate.toISOString().split('T')[0],
        endDate: dateRange.endDate.toISOString().split('T')[0]
    });

    const getRegionCodeForFilter = () => {
        if (currentSelection.desaName && currentSelection.kecamatanCode) {
            return `${currentSelection.kecamatanCode}-${currentSelection.desaName}`;
        }
        if (currentSelection.kecamatanCode) return currentSelection.kecamatanCode;
        if (currentSelection.kabkotaCode) return currentSelection.kabkotaCode;
        if (currentSelection.provinceCode) return currentSelection.provinceCode;
        return null;
    };

    const activeRegionCode = getRegionCodeForFilter();
    const { mapData: workerMapData, updateMapView } = useTicketsData(
        activeRegionCode,
        categorySelection,
        mapViewMode,
        dateRange.startDate.toISOString().split('T')[0],
        dateRange.endDate.toISOString().split('T')[0]
    );
    const { data: activeTicketDetails, isLoading: isTicketDetailLoading, error: ticketDetailError } = useTicketDetails(activeTicketId);

    useEffect(() => {
        if (mapViewport && updateMapView) {
            updateMapView(mapViewport.bounds, mapViewport.zoom);
        }
    }, [mapViewport, activeRegionCode, categorySelection, mapViewMode, dateRange, updateMapView]);


    useEffect(() => {
        setMapData(workerMapData);
    }, [workerMapData]);


    useEffect(() => {
        if (activeTicketId && activeTicketId !== pannedTicketId.current) {
            const activeTicket = mapData.find(t => t.id === activeTicketId);
            if (activeTicket) {
                setPanToTarget({
                    lat: activeTicket.coordinates.lat,
                    lng: activeTicket.coordinates.lng,
                    zoom: 15,
                    verticalOffset: 150
                });
                pannedTicketId.current = activeTicketId;
            }
        } else if (!activeTicketId) {
            pannedTicketId.current = null;
        }
    }, [activeTicketId, mapData]);

    useEffect(() => {
        if (activePinId && activePinId !== pannedPinId.current) {
            const activePin = pins.find(p => p.id === activePinId);
            if (activePin) {
                setPanToTarget({
                    lat: activePin.lat,
                    lng: activePin.lng,
                    verticalOffset: 150
                });
                pannedPinId.current = activePinId;
            }
        } else if (!activePinId) {
            pannedPinId.current = null;
        }
    }, [activePinId, pins]);

    const handleActivePinChange = useCallback((pinId) => {
        setActivePinId(pinId);
        if (pinId) {
            setActiveTicketId(null);
            setFabPosition(null);
        }
    }, []);

    const handleActiveTicketChange = useCallback((ticketId) => {
        setActiveTicketId(ticketId);
        if (ticketId) {
            setActivePinId(null);
            setFabPosition(null);
        }
    }, []);

    const params = new URLSearchParams(window.location.search);
    const nameParams = useMemo(() => ({
        provinsi: params.get('provinsi') || undefined,
        kabkota: params.get('kabkota') || undefined,
        kecamatan: params.get('kecamatan') || undefined,
        desakel: params.get('desakel') || undefined,
    }), []); // Run once on mount

    const { data: resolvedSelection, isLoading: isResolving, error: resolveError } = useRegionResolver(nameParams);

    useEffect(() => {
        if (isResolving) {
            setIsLoading(true);
            setLoadingText('Mencari wilayah dari tautan...');
        }
    }, [isResolving]);

    useEffect(() => {
        if (!nameParams.provinsi) {
            setIsInitialLoadComplete(true);
            return;
        }

        if (resolvedSelection) {
            setCurrentSelection(resolvedSelection);
            setActiveSidebar('regionInfo');
            navigationHistory.current = [{ selection: resolvedSelection, viewMode: 'region-only' }];

            const params = new URLSearchParams(window.location.search);
            ['provinsi', 'kabkota', 'kecamatan', 'desakel'].forEach(p => params.delete(p));
            const newUrl = `${window.location.pathname}?${params.toString()}`;
            window.history.replaceState({}, '', newUrl);

            setIsLoading(false);
            setIsInitialLoadComplete(true);
        } else if (resolveError) {
            setUrlError(resolveError.message);
            setIsLoading(false);
            setIsInitialLoadComplete(true);
        }
    }, [resolvedSelection, resolveError, nameParams]);

    const { data: provinsiData, loading: provinsiLoading } = useBoundaryData({ level: 'provinsi' });
    const { data: kabkotaData, loading: kabkotaLoading } = useBoundaryData({ level: 'kabkota', provinceCode: currentSelection.provinceCode });
    const { data: kecamatanData, loading: kecamatanLoading } = useBoundaryData({ level: 'kecamatan', provinceCode: currentSelection.provinceCode, kabkotaCode: currentSelection.kabkotaCode });
    const { data: desaData, loading: desaLoading } = useBoundaryData({ level: 'desa', provinceCode: currentSelection.provinceCode, kabkotaCode: currentSelection.kabkotaCode, kecamatanCode: currentSelection.kecamatanCode });

    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const shareLat = params.get('share_lat');
        const shareLng = params.get('share_lng');

        if (shareLat && shareLng) {
            const isTemporary = params.get('is_temporary') === 'true';
            const newPinData = {
                lat: parseFloat(shareLat),
                lng: parseFloat(shareLng),
                title: params.get('share_title') || 'Pin dari Tautan',
            };

            const existingPin = pins.find(p => p.lat === newPinData.lat && p.lng === newPinData.lng && p.title === newPinData.title);

            let targetPin;
            if (existingPin) {
                targetPin = existingPin;
            } else {
                if (isTemporary) {
                    targetPin = { ...newPinData, id: generatePinId() };
                    setPins(prevPins => [...prevPins, targetPin]);
                } else {
                    targetPin = addPinToHistory(newPinData);
                    setPins(prevPins => [...prevPins, targetPin].slice(-5));
                }
            }

            setActivePinId(targetPin.id);
            setPanToTarget({
                lat: targetPin.lat,
                lng: targetPin.lng,
                zoom: 15,
                verticalOffset: 150
            });

            params.delete('share_lat');
            params.delete('share_lng');
            params.delete('share_title');
            params.delete('is_temporary');

            const newUrl = `${window.location.pathname}?${params.toString()}`;
            window.history.replaceState({}, '', newUrl);
        }
    }, []);

    const findAdminInfoForPoint = useCallback(async (lat, lng) => {
        try {
            return await fetchRegionByPoint(lat, lng);
        } catch (error) {
            console.error("Gagal mencari info wilayah berdasarkan titik:", error);
            return null;
        }
    }, [fetchRegionByPoint]);

    useEffect(() => {
        const fetchAdminInfoForPins = async () => {
            const pinsToUpdate = pins.filter(p => p.adminInfo === undefined && !p.isLoadingAdminInfo);
            if (pinsToUpdate.length === 0) return;

            setPins(currentPins =>
                currentPins.map(p =>
                    pinsToUpdate.some(ptu => ptu.id === p.id) ? { ...p, isLoadingAdminInfo: true } : p
                )
            );

            const updatedPinsData = await Promise.all(
                pinsToUpdate.map(async (pin) => {
                    const adminInfo = await findAdminInfoForPoint(pin.lat, pin.lng);
                    return { ...pin, adminInfo, isLoadingAdminInfo: false };
                })
            );

            setPins(currentPins => {
                const newPins = currentPins.map(p => {
                    const updatedVersion = updatedPinsData.find(up => up.id === p.id);
                    return updatedVersion || p;
                });
                updatedPinsData.forEach(updatePinInHistory);
                return newPins;
            });
        };

        if (mapInstance) {
            fetchAdminInfoForPins();
        }
    }, [pins, mapInstance, findAdminInfoForPoint, newlyCreatedPinId]);

    useEffect(() => {
        if (!rawInfoData) {
            setAugmentedInfoData(null);
            return;
        }

        const { properties, level } = rawInfoData;
        const augmentedProperties = { ...properties };

        if (level === 'kabkota' || level === 'kecamatan' || level === 'desa') {
            augmentedProperties.provinsi = currentSelection.provinceName;
        }
        if (level === 'kecamatan' || level === 'desa') {
            augmentedProperties.kabkota = currentSelection.kabkotaName;
        }
        if (level === 'desa') {
            augmentedProperties.kecamatan = currentSelection.kecamatanName;
        }

        switch (level) {
            case 'provinsi':
                augmentedProperties.jumlahKabKota = kabkotaData.filter(k => k.properties.kode_prov === properties.kode_prov).length;
                break;
            case 'kabkota':
                augmentedProperties.jumlahKecamatan = kecamatanData.filter(k => k.properties.kode_kab === properties.kode_kab).length;
                break;
            case 'kecamatan':
                augmentedProperties.jumlahDesa = desaData.filter(d => d.properties.kode_kec === properties.kode_kec).length;
                break;
        }

        setAugmentedInfoData({ properties: augmentedProperties, level });
    }, [rawInfoData, currentSelection, kabkotaData, kecamatanData, desaData]);

    const panToWithOffset = useCallback((target, zoom, verticalOffsetPx = 0) => {
        if (!mapInstance) return;

        const isSidebarVisible = (activeSidebar === 'wilayah' || activeSidebar === 'regionInfo' || activeSidebar === 'history' || activeSidebar === 'geoAi') && !isSidebarHidden;
        const totalHorizontalOffset = (ACTION_SIDEBAR_WIDTH + (isSidebarVisible ? REGION_INFO_SIDEBAR_WIDTH : 0)) / 2;

        const projection = mapInstance.getProjection();
        if (!projection) {
            setTimeout(() => panToWithOffset(target, zoom, verticalOffsetPx), 100);
            return;
        }

        const targetPoint = projection.fromLatLngToPoint(new window.google.maps.LatLng(target.lat, target.lng));
        const currentZoom = mapInstance.getZoom();
        const finalZoom = zoom && currentZoom < zoom ? zoom : currentZoom;
        const scale = Math.pow(2, finalZoom);

        const newCenterPoint = new window.google.maps.Point(
            targetPoint.x - (totalHorizontalOffset / scale),
            targetPoint.y - (verticalOffsetPx / scale)
        );
        const newCenterLatLng = projection.fromPointToLatLng(newCenterPoint);

        mapInstance.panTo(newCenterLatLng);
        if (zoom && currentZoom < zoom) {
            mapInstance.setZoom(zoom);
        }
    }, [mapInstance, activeSidebar, isSidebarHidden]);

    useEffect(() => {
        if (panToTarget && mapInstance) {
            panToWithOffset(panToTarget, panToTarget.zoom, panToTarget.verticalOffset || 0);
            setPanToTarget(null);
        }
    }, [panToTarget, mapInstance, panToWithOffset]);

    useEffect(() => {
        if (isNavigating) {
            const { provinceCode, kabkotaCode, kecamatanCode } = currentSelection;
            let isDataReady = false;
            if (provinceCode && !kabkotaCode) { isDataReady = !kabkotaLoading; }
            else if (kabkotaCode && !kecamatanCode) { isDataReady = !kecamatanLoading; }
            else if (kecamatanCode) { isDataReady = !desaLoading; }
            else { isDataReady = true; }
            if (isDataReady) { setIsNavigating(false); }
        }
    }, [isNavigating, currentSelection, kabkotaLoading, kecamatanLoading, desaLoading]);

    const [isMobile, setIsMobile] = useState(window.innerWidth < 900);

    useEffect(() => {
        const handleResize = () => {
            setIsMobile(window.innerWidth < 900);
        };
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    useEffect(() => {
        const checkDevice = () => {
            setIsTouchDevice(window.matchMedia("(pointer: coarse)").matches);
        };
        checkDevice();
        window.addEventListener('resize', checkDevice);
        return () => window.removeEventListener('resize', checkDevice);
    }, []);

    useEffect(() => {
        setIsLoading(provinsiLoading);
        setLoadingText(provinsiLoading ? 'Memuat data wilayah dasar...' : '');
    }, [provinsiLoading]);

    const handleSelectionChange = useCallback((selection) => {
        const newSelection = { ...selection };

        if (newSelection.provinceCode && !newSelection.provinceName) {
            const prov = provinsiData.find(p => p.properties.kode_prov === newSelection.provinceCode);
            if (prov) newSelection.provinceName = prov.properties.nama;
        }
        if (newSelection.kabkotaCode && !newSelection.kabkotaName) {
            const kab = kabkotaData.find(k => k.properties.kode_kab === newSelection.kabkotaCode);
            if (kab) newSelection.kabkotaName = kab.properties.nama;
        }
        if (newSelection.kecamatanCode && !newSelection.kecamatanName) {
            const kec = kecamatanData.find(k => k.properties.kode_kec === newSelection.kecamatanCode);
            if (kec) newSelection.kecamatanName = kec.properties.nama;
        }

        let isLoadingNext = false;
        if (newSelection.provinceCode && !newSelection.kabkotaCode) { isLoadingNext = kabkotaLoading; }
        else if (newSelection.kabkotaCode && !newSelection.kecamatanCode) { isLoadingNext = kecamatanLoading; }
        else if (newSelection.kecamatanCode && !newSelection.desaName) { isLoadingNext = desaLoading; }

        if (isLoadingNext) {
            setIsNavigating(true);
            setLoadingText('Memuat data sub-wilayah...');
        }

        setCurrentSelection(newSelection);
        setIsViewCentered(true);
        setFabPosition(null);
    }, [provinsiData, kabkotaData, kecamatanData, kabkotaLoading, kecamatanLoading, desaLoading]);

    const handleAdminSelectionChange = useCallback((selection, level) => {
        handleSelectionChange(selection);
        const newViewMode = selection.provinceCode ? 'region-only' : 'drill-down';
        syncViewMode(newViewMode);
        navigationHistory.current.push({ selection, viewMode: newViewMode });

        // Only switch to region info view if a desa is selected
        if (level === 'desa' && selection.desaName) {
            setActiveSidebar('regionInfo');
            setIsSidebarHidden(false);
        }
    }, [handleSelectionChange, syncViewMode]);

    const handleNavigateToRegion = useCallback((featureProps) => {
        const props = featureProps || previewInfo?.featureProps;
        if (!props) return;

        const { kode_prov, kode_kab, kode_kec, nama } = props;
        let newSelection = {};

        if (currentSelection.kecamatanCode) {
            newSelection = { provinceCode: kode_prov, kabkotaCode: kode_kab, kecamatanCode: kode_kec, desaName: nama };
        } else if (currentSelection.kabkotaCode) {
            newSelection = { provinceCode: kode_prov, kabkotaCode: kode_kab, kecamatanCode: kode_kec };
        } else if (currentSelection.provinceCode) {
            newSelection = { provinceCode: kode_prov, kabkotaCode: kode_kab };
        } else {
            newSelection = { provinceCode: kode_prov };
        }

        if (Object.keys(newSelection).length > 0) {
            handleSelectionChange(newSelection);
            syncViewMode('region-only');
            navigationHistory.current.push({ selection: newSelection, viewMode: 'region-only' });
            setPreviewInfo(null);
            setActiveSidebar('regionInfo');
            setIsSidebarHidden(false);
        }
    }, [previewInfo, handleSelectionChange, syncViewMode, currentSelection.kecamatanCode, currentSelection.kabkotaCode, currentSelection.provinceCode]);

    const handleSubRegionClick = useCallback((featureProps, latLng) => {
        const { kode_prov, kode_kab, kode_kec, nama } = featureProps;
        const code = currentSelection.kecamatanCode ? `${kode_kec}-${nama}` : (kode_kec || kode_kab || kode_prov);

        if (previewInfo && previewInfo.code === code) {
            handleNavigateToRegion(featureProps);
            return;
        }

        setPreviewInfo({
            position: { lat: latLng.lat(), lng: latLng.lng() },
            name: nama,
            code: code,
            featureProps: featureProps
        });
        setFabPosition(null);
        setActivePinId(null);
        setActiveTicketId(null);
    }, [previewInfo, handleNavigateToRegion, currentSelection.kecamatanCode]);

    const handleRegionClick = useCallback((e) => {
        setFabPosition({
            lat: e.latLng.lat(),
            lng: e.latLng.lng(),
        });
        setPreviewInfo(null);
        setActivePinId(null);
        setActiveTicketId(null);
    }, []);

    const handlePlaceSelect = useCallback(async (placeOrFeature) => {
        if (!placeOrFeature) {
            setSearchError("Hasil pencarian tidak valid. Silakan coba lagi.");
            return;
        }
        setIsLoading(true);
        setLoadingText('Menganalisis lokasi...');

        try {
            // CASE 1: Local Region Selection (GeoJSON Feature)
            if (placeOrFeature.type === 'Feature') {
                const { properties, geometry } = placeOrFeature;
                const { level, kode_prov, kode_kab, kode_kec, nama } = properties;

                // Construct selection based on level
                let newSelection = {};
                if (level === 'provinsi') {
                    newSelection = { provinceCode: kode_prov };
                } else if (level === 'kabkota' || level === 'kab_kota') {
                    newSelection = { provinceCode: kode_prov, kabkotaCode: kode_kab };
                } else if (level === 'kecamatan') {
                    newSelection = { provinceCode: kode_prov, kabkotaCode: kode_kab, kecamatanCode: kode_kec };
                } else if (level === 'desa') {
                    newSelection = { provinceCode: kode_prov, kabkotaCode: kode_kab, kecamatanCode: kode_kec, desaName: nama };
                }

                if (Object.keys(newSelection).length > 0) {
                    handleSelectionChange(newSelection);
                    syncViewMode('region-only');
                    navigationHistory.current.push({ selection: newSelection, viewMode: 'region-only' });

                    // If it's a desa, open the sidebar
                    if (level === 'desa') {
                        setActiveSidebar('regionInfo');
                        setIsSidebarHidden(false);
                    }

                    // Use geometry to fit bounds if available
                    if (geometry && mapInstance) {
                        const bounds = new window.google.maps.LatLngBounds();
                        const processCoords = (coords) => {
                            if (Array.isArray(coords) && coords.length === 2 && typeof coords[0] === 'number') {
                                bounds.extend({ lat: coords[1], lng: coords[0] });
                            } else if (Array.isArray(coords)) {
                                coords.forEach(processCoords);
                            }
                        };

                        if (geometry.type === 'Polygon' || geometry.type === 'MultiPolygon') {
                            processCoords(geometry.coordinates);
                        }

                        if (!bounds.isEmpty()) {
                            mapInstance.fitBounds(bounds);
                            // Optional: Adjust zoom slightly if needed, or let fitBounds handle it
                        }
                    }
                }
                return;
            }

            // CASE 2: Google Place Selection (POI)
            const place = placeOrFeature;
            let lat, lng;
            if (place.geometry && place.geometry.location) {
                if (typeof place.geometry.location.lat === 'function') {
                    lat = place.geometry.location.lat();
                    lng = place.geometry.location.lng();
                } else {
                    // Fallback if it's already a plain object
                    lat = place.geometry.location.lat;
                    lng = place.geometry.location.lng;
                }
            } else {
                throw new Error("Lokasi tidak ditemukan untuk tempat ini.");
            }

            const adminInfo = await fetchRegionByPoint(lat, lng, true);

            if (adminInfo && adminInfo.geom_geojson) {
                const newSelection = {
                    provinceCode: adminInfo.kode_prov || null,
                    kabkotaCode: adminInfo.kode_kab || null,
                    kecamatanCode: adminInfo.kode_kec || null,
                    desaName: adminInfo.desa?.nama || null,
                    provinceName: adminInfo.provinsi?.nama || null,
                    kabkotaName: adminInfo.kab_kota?.nama || null,
                    kecamatanName: adminInfo.kecamatan?.nama || null,
                };

                handleSelectionChange(newSelection);
                syncViewMode('region-only');
                navigationHistory.current.push({ selection: newSelection, viewMode: 'region-only' });

                if (adminInfo.desa?.nama) {
                    setActiveSidebar('regionInfo');
                    setIsSidebarHidden(false);
                }

            } else {
                // No region found (e.g. outside Indonesia or data missing), just fly to point
                setPanToTarget({ lat, lng, zoom: 15, verticalOffset: 150 });
                // Optionally add a marker or temporary pin
                setSearchError("Lokasi berada di luar wilayah administratif yang terdata.");
            }

        } catch (error) {
            console.error("Gagal memproses hasil pencarian:", error);
            setSearchError(error.message || "Terjadi kesalahan saat memproses lokasi.");
        } finally {
            setIsLoading(false);
        }
    }, [handleSelectionChange, syncViewMode]);

    const toggleBoundaryTransparency = () => setIsBoundaryTransparent(prev => !prev);

    const handleBack = () => {
        if (navigationHistory.current.length > 1) {
            navigationHistory.current.pop();
            const previousState = navigationHistory.current[navigationHistory.current.length - 1];
            setCurrentSelection(previousState.selection);
            syncViewMode(previousState.viewMode);
            if (previousState.viewMode === 'region-only' && previousState.selection.provinceCode) {
                setActiveSidebar('regionInfo');
                setIsSidebarHidden(false);
            } else {
                setActiveSidebar(null);
            }
        }
    };

    useEffect(() => {
        if (newlyCreatedPinId) {
            const timer = setTimeout(() => setNewlyCreatedPinId(null), 500);
            return () => clearTimeout(timer);
        }
    }, [newlyCreatedPinId]);

    const handleAddPin = useCallback((e) => {
        if (!e.latLng) return;
        const newPinData = { lat: e.latLng.lat(), lng: e.latLng.lng(), title: 'Point of Interest' };
        const newPinWithId = addPinToHistory(newPinData);
        setPins(prevPins => [...prevPins, newPinWithId].slice(-5));
        setActivePinId(newPinWithId.id);
        setNewlyCreatedPinId(newPinWithId.id);
        setPanToTarget({
            lat: newPinWithId.lat,
            lng: newPinWithId.lng,
            zoom: 15,
            verticalOffset: 150
        });
    }, []);

    const handleUpdatePin = useCallback((id, updates) => {
        setPins(currentPins => {
            const updatedPins = currentPins.map(pin =>
                pin.id === id ? { ...pin, ...updates } : pin
            );
            const updatedPin = updatedPins.find(p => p.id === id);
            if (updatedPin) {
                updatePinInHistory(updatedPin);
            }
            return updatedPins;
        });
    }, []);

    const handleDeletePin = useCallback((id) => {
        removePinFromHistory(id);
        setPins(prevPins => prevPins.filter(p => p.id !== id));
        setActivePinId(currentId => currentId === id ? null : currentId);
    }, []);

    const handleUpdatePinTitle = useCallback((id, newTitle) => {
        handleUpdatePin(id, { title: newTitle });
    }, [handleUpdatePin]);

    const handleGoToPin = (pin) => {
        setActivePinId(pin.id);
        setPanToTarget({
            lat: pin.lat,
            lng: pin.lng,
            zoom: 15,
            verticalOffset: 150
        });
        setActiveSidebar(null); // Close history sidebar
    };

    const handleIndicatorClick = (indicator) => {
        if (!mapInstance) return;
        if (indicator.count === 1) {
            const pin = indicator.pins[0];
            setActivePinId(pin.id);
            setPanToTarget({
                lat: pin.lat,
                lng: pin.lng,
                zoom: 15,
                verticalOffset: 150
            });
        } else {
            const bounds = new window.google.maps.LatLngBounds();
            indicator.pins.forEach(pin => bounds.extend(new window.google.maps.LatLng(pin.lat, pin.lng)));
            mapInstance.fitBounds(bounds, 100);
        }
    };

    const handleMapClick = useCallback(() => {
        setActivePinId(current => current ? null : current);
        setActiveTicketId(current => current ? null : current);
        setPreviewInfo(null);
        setFabPosition(null);
    }, []);

    const handleSidebarButtonClick = (sidebarName) => {
        if (activeSidebar === sidebarName) {
            // If clicking the same button, close the sidebar completely
            setActiveSidebar(null);
        } else {
            // If switching to a new sidebar or opening one
            setActiveSidebar(sidebarName);
            setIsSidebarHidden(false); // Always show the sidebar when its button is clicked
        }
    };

    const handleAiRegionSelect = useCallback((regionName) => {
        if (!regionName || !provinsiData) return;

        // Cari provinsi yang cocok (case insensitive)
        const matchedProv = provinsiData.find(p =>
            p.properties.nama.toLowerCase() === regionName.toLowerCase()
        );

        if (matchedProv) {
            const newSelection = {
                provinceCode: matchedProv.properties.kode_prov,
                provinceName: matchedProv.properties.nama
            };

            handleSelectionChange(newSelection);

            // Update view mode and history
            syncViewMode('region-only');
            navigationHistory.current.push({ selection: newSelection, viewMode: 'region-only' });

            // Switch to Admin tab to show selection if needed, or just stay on GeoAI
            if (!activeSidebar) {
                setActiveSidebar('geoAi'); // Keep focus on AI results
                setIsSidebarHidden(false);
            }
        }
    }, [provinsiData, handleSelectionChange, syncViewMode, activeSidebar]);

    const handleToggleUnifiedSidebar = () => {
        setIsSidebarHidden(prev => !prev);
    };

    const handleLocate = useCallback(() => {
        setLocateTrigger(prev => prev + 1);
        setIsViewCentered(true);
    }, []);


    const isUnifiedSidebarOpen = activeSidebar === 'wilayah' || activeSidebar === 'regionInfo' || activeSidebar === 'history' || activeSidebar === 'layers' || activeSidebar === 'geoAi';
    const layerButtonOffset = isUnifiedSidebarOpen && !isSidebarHidden ? REGION_INFO_SIDEBAR_WIDTH : 0;

    const getSidebarView = () => {
        switch (activeSidebar) {
            case 'wilayah':
                return 'admin';
            case 'regionInfo':
                return 'regionInfo';
            case 'history':
                return 'history';
            case 'layers':
                return 'layers';
            case 'geoAi':
                return 'geoAi';
            default:
                return 'admin'; // Default view
        }
    };

    const handleClosePreview = useCallback(() => setPreviewInfo(null), []);

    const handleNavigateFromPreview = useCallback(() => {
        if (previewInfo?.featureProps) {
            handleNavigateToRegion(previewInfo.featureProps);
        }
    }, [previewInfo, handleNavigateToRegion]);

    const handleCloseFab = useCallback(() => setFabPosition(null), []);

    const handleShowInfoFab = useCallback(() => {
        setActiveSidebar('regionInfo');
        setIsSidebarHidden(false);
        setFabPosition(null);
    }, []);

    const handleShowSubRegionsFab = useCallback(() => {
        syncViewMode('drill-down');
        const newSelection = { ...currentSelection };
        setCurrentSelection(newSelection);
        navigationHistory.current.push({ selection: newSelection, viewMode: 'drill-down' });
        setFabPosition(null);
        setActiveSidebar(null);
    }, [syncViewMode, currentSelection]);

    const mapChildren = useMemo(() => (
        <>
            {previewInfo && (
                <RegionPreviewInfoWindow
                    position={previewInfo.position}
                    regionName={previewInfo.name}
                    stats={regionStats}
                    loading={statsLoading}
                    onClose={handleClosePreview}
                    onNavigate={handleNavigateFromPreview}
                />
            )}
            {fabPosition && (
                <InfoWindow position={fabPosition} onCloseClick={handleCloseFab} disableAutoPan={true}>
                    <FloatingActionButtons
                        onShowInfo={handleShowInfoFab}
                        onShowSubRegions={handleShowSubRegionsFab}
                        canDrillDown={!currentSelection.desaName}
                    />
                </InfoWindow>
            )}
        </>
    ), [
        previewInfo,
        regionStats,
        statsLoading,
        handleClosePreview,
        handleNavigateFromPreview,
        fabPosition,
        handleCloseFab,
        handleShowInfoFab,
        handleShowSubRegionsFab,
        currentSelection.desaName
    ]);

    if (!apiKey) {
        return <div className="w-screen h-screen flex items-center justify-center">API Key untuk Google Maps tidak ditemukan.</div>;
    }

    return (
        <APIProvider apiKey={apiKey} libraries={MAP_LIBRARIES} language="id">
            {urlError && <ErrorModal message={urlError} onClose={() => setUrlError(null)} />}
            {searchError && <ErrorModal message={searchError} onClose={() => setSearchError(null)} />}
            <main ref={mainContainerRef} className="relative w-screen h-screen bg-gray-100 flex">
                <div className="relative w-screen h-screen">
                    {(isLoading || isNavigating) && <LoadingOverlay text={loadingText} />}
                    <div ref={mapContainerRef} className="w-full h-full" style={{ contentVisibility: 'visible' }}>
                        <MapComponent
                            isRegionSidebarOpen={isUnifiedSidebarOpen}
                            isTouchDevice={isTouchDevice}
                            isMobile={isMobile}
                            selection={currentSelection}
                            isNavigating={isNavigating}
                            onInfoChange={setRawInfoData}
                            onSelectionChange={handleSelectionChange}
                            mapViewMode={mapViewMode}
                            onSubRegionClick={handleSubRegionClick}
                            onRegionClick={handleRegionClick}
                            isPinningMode={isPinningMode}
                            isBoundaryTransparent={isBoundaryTransparent}
                            onAddPin={handleAddPin}
                            pins={pins}
                            onDeletePin={handleDeletePin}
                            onUpdatePinTitle={handleUpdatePinTitle}
                            onUpdatePin={handleUpdatePin}
                            activePinId={activePinId}
                            onActivePinChange={handleActivePinChange}
                            newlyCreatedPinId={newlyCreatedPinId}
                            onMapClick={handleMapClick}
                            onMapLoad={setMapInstance}
                            tickets={mapData}
                            activeTicketId={activeTicketId}
                            onActiveTicketChange={handleActiveTicketChange}
                            activeTicketDetails={activeTicketDetails}
                            isTicketDetailLoading={isTicketDetailLoading}
                            ticketDetailError={ticketDetailError}
                            forcedZoom={urlZoom}
                            mapLayer={mapLayer}
                            onStreetViewVisibilityChange={setIsStreetViewVisible}
                            isStreetViewLayerActive={isStreetViewLayerActive}
                            onStreetViewUpdate={setStreetViewData}
                            triggerFitBounds={locateTrigger}
                            onMapMove={() => setIsViewCentered(false)}
                        >
                            {mapChildren}
                        </MapComponent>
                        <OffscreenIndicatorsLayer
                            mapInstance={mapInstance}
                            pins={pins}
                            mapContainerRef={mapContainerRef}
                            onIndicatorClick={handleIndicatorClick}
                            isStreetViewVisible={isStreetViewVisible}
                        />
                    </div>

                    <div
                        className={`absolute inset-0 z-10 pointer-events-none transition-all duration-300 ${isStreetViewVisible ? 'opacity-0 invisible delay-0' : 'opacity-100 visible delay-0'}`}
                        style={{ transitionProperty: 'opacity, visibility', transitionDelay: isStreetViewVisible ? '0ms, 300ms' : '0ms, 0ms' }}
                    >
                        <div className="relative w-full h-full">
                            {/* Responsive Search and Filter Layout */}
                            {isMobile ? (
                                // Mobile Layout
                                <div className="absolute top-4 left-4 right-4 z-30 flex flex-col gap-3 pointer-events-none">
                                    <div className="pointer-events-auto w-full shadow-sm rounded-full">
                                        <SearchBar onPlaceSelect={handlePlaceSelect} />
                                    </div>
                                    <div className="pointer-events-auto w-full overflow-x-auto pb-2 no-scrollbar">
                                        <div className="min-w-max">
                                            <FilterPills
                                                selectedCategory={categorySelection}
                                                onCategoryChange={setCategorySelection}
                                                categoriesData={categories}
                                                categoriesLoading={categoriesLoading}
                                                dateRange={dateRange}
                                                onDateRangeChange={setDateRange}
                                                isMobile={isMobile}
                                            />
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                // Desktop Layout (Original)
                                <>
                                    <div className="absolute top-4 pointer-events-auto z-30 transition-all duration-300 ease-in-out" style={{
                                        left: `calc(${ACTION_SIDEBAR_WIDTH}px + ${activeSidebar === 'geoAi' && !isSidebarHidden ? `${REGION_INFO_SIDEBAR_WIDTH}px + ` : ''}1rem)`,
                                        width: `calc(${REGION_INFO_SIDEBAR_WIDTH}px - 2rem)`
                                    }}>
                                        <SearchBar onPlaceSelect={handlePlaceSelect} />
                                    </div>
                                    <div className="absolute top-4 pointer-events-auto z-30 transition-all duration-300 ease-in-out" style={{
                                        left: `calc(${ACTION_SIDEBAR_WIDTH}px + ${REGION_INFO_SIDEBAR_WIDTH}px + ${activeSidebar === 'geoAi' && !isSidebarHidden ? `${REGION_INFO_SIDEBAR_WIDTH}px + ` : ''}2rem)`
                                    }}>
                                        <FilterPills
                                            selectedCategory={categorySelection}
                                            onCategoryChange={setCategorySelection}
                                            categoriesData={categories}
                                            categoriesLoading={categoriesLoading}
                                            dateRange={dateRange}
                                            onDateRangeChange={setDateRange}
                                            isMobile={isMobile}
                                        />
                                    </div>
                                </>
                            )}
                            <div className={`absolute top-0 left-0 h-full flex ${isMobile ? 'z-[60] w-full pointer-events-none' : 'z-20 pointer-events-auto'}`}>
                                <ActionSidebar onButtonClick={handleSidebarButtonClick} activeSidebar={activeSidebar} isMobile={isMobile} />
                                <div className={`relative h-full ${isMobile ? 'w-full' : ''}`}>
                                    <UnifiedSidebar
                                        isOpen={isUnifiedSidebarOpen}
                                        isHidden={isSidebarHidden}
                                        onToggleVisibility={handleToggleUnifiedSidebar}
                                        activeView={getSidebarView()}
                                        onRegionAutoSelect={handleAiRegionSelect}
                                        // Admin Props
                                        currentSelection={currentSelection}
                                        onSelectionChange={handleAdminSelectionChange}
                                        // Region Info Props
                                        regionData={augmentedInfoData}
                                        dateRange={dateRange}
                                        categoryId={categorySelection}
                                        // History Props
                                        pins={pins}
                                        onGoToPin={handleGoToPin}
                                        onDeletePin={handleDeletePin}
                                        mapLayer={mapLayer}
                                        onMapLayerChange={setMapLayer}
                                        isMobile={isMobile}
                                    />
                                </div>
                            </div>

                            <MapControls isFullscreen={isFullscreen} onToggleFullscreen={handleToggleFullscreen} onBack={handleBack} isBackDisabled={navigationHistory.current.length <= 1} isPinningMode={isPinningMode} onTogglePinMode={() => setIsPinningMode(!isPinningMode)} onLocate={handleLocate} isLocateActive={isViewCentered} isMobile={isMobile} />
                            <>
                                <MapLayerControl
                                    mapLayer={mapLayer}
                                    onMapLayerChange={setMapLayer}
                                    isStreetViewVisible={isStreetViewLayerActive}
                                    onStreetViewVisibilityChange={setIsStreetViewLayerActive}
                                    style={{ left: `calc(${ACTION_SIDEBAR_WIDTH}px + ${layerButtonOffset}px + 1rem)` }}
                                    isMobile={isMobile}
                                />
                            </>
                        </div>
                    </div>

                    {/* Custom Street View Control (Back + Address + Pin) */}
                    <div className={`absolute top-4 left-4 z-50 transition-opacity duration-300 flex items-center gap-2 ${isStreetViewVisible ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}>
                        <div className="bg-gray-900/80 backdrop-blur-sm text-white rounded-lg shadow-lg flex items-center p-1 pr-4 gap-3 max-w-md">
                            <Tooltip content="Kembali">
                                <button
                                    onClick={() => {
                                        // Do NOT reset mapLayer to default, keep it as streetview
                                        if (mapInstance) {
                                            const sv = mapInstance.getStreetView();
                                            if (sv) sv.setVisible(false);
                                        }
                                    }}
                                    className="p-2 hover:bg-white/10 rounded-full transition-colors"
                                >
                                    <Reply className="h-5 w-5" />
                                </button>
                            </Tooltip>
                            <div className="flex flex-col min-w-0">
                                <span className="text-sm font-medium truncate">{streetViewData?.address || 'Memuat lokasi...'}</span>
                                <span className="text-xs text-gray-300">Street View</span>
                            </div>
                            <div className="w-px h-8 bg-gray-600 mx-1"></div>
                            <Tooltip content="Pin Lokasi Ini">
                                <button
                                    onClick={handlePinStreetViewLocation}
                                    className="p-2 hover:bg-white/10 rounded-full transition-colors text-blue-400 hover:text-blue-300"
                                >
                                    <MapPinPlus className="h-5 w-5" />
                                </button>
                            </Tooltip>
                        </div>
                    </div>
                </div>
            </main>
        </APIProvider>
    );
};

export default MapPage;
