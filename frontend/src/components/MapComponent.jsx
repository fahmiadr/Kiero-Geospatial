import React, { useEffect, useRef, useState, useMemo } from 'react';
import { X } from 'lucide-react';
import { Map, useMap } from '@vis.gl/react-google-maps';
import { useQueryClient } from '@tanstack/react-query';
import { fetchStreetViewAvailability } from '../hooks/useStreetViewAvailability';
import { useBoundaryData } from '../hooks/useBoundaryData';
import { stringToHslColor } from '../utils/mapUtils';
import MapLabel from './MapLabel';
import Pin from './Pin';
import TicketPin from './TicketPin';
import ClusterPin from './ClusterPin';
import MultiTicketPin from './MultiTicketPin';
import { ACTION_SIDEBAR_WIDTH, REGION_INFO_SIDEBAR_WIDTH } from '../constants/layout';

/**
 * Komponen rendering peta utama untuk aplikasi.
 * Bertanggung jawab untuk menampilkan Google Map, me-render batas GeoJSON,
 * menangani interaksi pengguna (klik, hover), dan menampilkan berbagai penanda peta
 * seperti pin, tiket, dan kluster. Menerima sejumlah besar properti untuk mengelola
 * state-nya yang kompleks, yang dikendalikan oleh komponen induk `MapPage`.
 *
 * @param {object} props - Properti komponen.
 * @param {boolean} props.isRegionSidebarOpen - Bendera yang menunjukkan jika sidebar info wilayah terbuka, digunakan untuk menghitung padding peta.
 * @param {boolean} props.isTouchDevice - Bendera yang menunjukkan jika pengguna menggunakan perangkat layar sentuh.
 * @param {object} props.selection - Objek yang merepresentasikan wilayah administratif yang saat ini dipilih.
 * @param {boolean} props.isNavigating - Bendera untuk menonaktifkan interaksi sementara selama pergerakan peta terprogram.
 * @param {Function} [props.onInfoChange] - Callback untuk meneruskan informasi tentang wilayah yang ditampilkan saat ini ke induk.
 * @param {Function} [props.onSelectionChange] - Callback untuk memperbarui wilayah yang dipilih.
 * @param {string} props.mapViewMode - Mode tampilan peta saat ini ('drill-down' atau 'region-only').
 * @param {Function} [props.onSubRegionClick] - Callback untuk saat sub-wilayah diklik dalam mode 'drill-down'.
 * @param {Function} [props.onRegionClick] - Callback untuk saat wilayah utama diklik dalam mode 'region-only'.
 * @param {boolean} props.isPinningMode - Bendera yang menunjukkan jika pengguna sedang dalam proses menambahkan pin baru.
 * @param {Function} [props.onAddPin] - Callback untuk menambahkan pin baru ke peta.
 * @param {Array<object>} [props.pins] - Array objek pin buatan pengguna untuk ditampilkan.
 * @param {Function} [props.onDeletePin] - Callback untuk menghapus pin.
 * @param {Function} [props.onUpdatePinTitle] - Callback untuk memperbarui judul pin.
 * @param {string|null} props.activePinId - ID pin yang saat ini aktif (dipilih).
 * @param {Function} [props.onActivePinChange] - Callback untuk mengubah pin aktif.
 * @param {string|null} props.newlyCreatedPinId - ID pin yang baru saja dibuat, digunakan untuk memicu animasi.
 * @param {Function} [props.onMapClick] - Callback umum untuk setiap klik pada kanvas peta atau fitur GeoJSON.
 * @param {Function} [props.onMapLoad] - Callback yang meneruskan instance `google.maps.Map` ke induk setelah tersedia.
 * @param {boolean} props.isBoundaryTransparent - Bendera untuk mengontrol opasitas batas GeoJSON.
 * @param {Array<object>} [props.tickets] - Array objek tiket atau kluster untuk ditampilkan di peta.
 * @param {string|null} props.activeTicketId - ID tiket yang saat ini aktif (dipilih).
 * @param {Function} [props.onActiveTicketChange] - Callback untuk mengubah tiket aktif.
 * @param {object|null} props.activeTicketDetails - Informasi detail untuk tiket aktif.
 * @param {boolean} props.isTicketDetailLoading - Bendera yang menunjukkan jika detail tiket aktif sedang dimuat.
 * @param {Error|null} props.ticketDetailError - Objek error jika pengambilan detail tiket gagal.
 * @returns {JSX.Element} Komponen MapComponent.
 */
const MapComponent = ({
    isRegionSidebarOpen,
    isTouchDevice,
    isMobile,
    selection,
    isNavigating,
    onInfoChange = () => { },
    onSelectionChange = () => { },
    mapViewMode,
    onSubRegionClick = () => { },
    onRegionClick = () => { },
    isPinningMode,
    onAddPin = () => { },
    pins = [],
    onDeletePin = () => { },

    onUpdatePinTitle = () => { },
    onUpdatePin = () => { },
    activePinId,
    onActivePinChange = () => { },
    pinActionType,
    newlyCreatedPinId,
    onMapClick = () => { },
    onMapLoad = () => { },
    isBoundaryTransparent,
    tickets = [],
    activeTicketId,
    onActiveTicketChange = () => { },
    activeTicketDetails,
    isTicketDetailLoading,
    ticketDetailError,
    forcedZoom = null,
    mapLayer = 'default',
    onStreetViewVisibilityChange = () => { },
    isStreetViewLayerActive = false,
    onStreetViewUpdate = () => { },
    triggerFitBounds = 0,
    onMapMove = () => { },
    children
}) => {
    const map = useMap();
    const queryClient = useQueryClient();
    const [labels, setLabels] = useState([]);
    const [hoveredRegionId, setHoveredRegionId] = useState(null);
    const [previewPano, setPreviewPano] = useState(null);

    useEffect(() => {
        if (map && onMapLoad) {
            onMapLoad(map);
        }
    }, [map, onMapLoad]);

    const { data: provinsiData } = useBoundaryData({ level: 'provinsi' });
    const { data: kabkotaData } = useBoundaryData({ level: 'kabkota', provinceCode: selection.provinceCode });
    const { data: kecamatanData } = useBoundaryData({ level: 'kecamatan', provinceCode: selection.provinceCode, kabkotaCode: selection.kabkotaCode });
    const { data: desaData } = useBoundaryData({ level: 'desa', provinceCode: selection.provinceCode, kabkotaCode: selection.kabkotaCode, kecamatanCode: selection.kecamatanCode });
    const hoveredFeatureRef = useRef(null);


    useEffect(() => {
        if (!map || isNavigating) return;
        const gestureHandling = isTouchDevice ? 'cooperative' : 'greedy';
        map.setOptions({ gestureHandling });
    }, [map, isTouchDevice, isNavigating]);


    useEffect(() => {
        if (!map || !provinsiData.length) return;

        map.data.forEach(feature => map.data.remove(feature));
        const newLabels = [];
        const masterBounds = new google.maps.LatLngBounds();

        const renderFeature = (featureData, styleOptions, labelProperty) => {
            const finalStyle = { ...styleOptions, clickable: !isPinningMode };
            const addedFeatures = map.data.addGeoJson(featureData, { idPropertyName: 'id' });
            if (addedFeatures && addedFeatures.length > 0) {
                const feature = addedFeatures[0];
                feature.setProperty('originalStyle', styleOptions);
                map.data.overrideStyle(feature, finalStyle);

                const bounds = new google.maps.LatLngBounds();
                const geometry = feature.getGeometry();
                if (geometry) {
                    geometry.forEachLatLng(latLng => bounds.extend(latLng));
                    masterBounds.union(bounds);

                    if (labelProperty && featureData.properties?.[labelProperty]) {
                        // Ensure ID matches what map.data uses (feature.getId())
                        const featureId = feature.getId();
                        const uniqueKey = String(featureId || featureData.properties.id || `${labelProperty}-${Math.random()}`);

                        newLabels.push({
                            id: uniqueKey,
                            position: bounds.getCenter(),
                            text: String(featureData.properties[labelProperty]),
                            color: String(styleOptions.strokeColor || styleOptions.fillColor || '#1f2937')
                        });
                    }
                }
            }
        };

        let mainFeature = null;
        let subFeatures = [];
        let mainFeatureLevel = null;

        if (selection.desaName && selection.kecamatanCode) {
            mainFeature = desaData.find(f => f.properties.kode_kec === selection.kecamatanCode && f.properties.nama === selection.desaName);
            mainFeatureLevel = 'desa';
        } else if (selection.kecamatanCode) {
            mainFeature = kecamatanData.find(f => f.properties.kode_kec === selection.kecamatanCode);
            mainFeatureLevel = 'kecamatan';
            subFeatures = desaData.filter(f => f.properties.kode_kec === selection.kecamatanCode);
        } else if (selection.kabkotaCode) {
            mainFeature = kabkotaData.find(f => f.properties.kode_kab === selection.kabkotaCode);
            mainFeatureLevel = 'kabkota';
            subFeatures = kecamatanData.filter(f => f.properties.kode_kab === selection.kabkotaCode);
        } else if (selection.provinceCode) {
            mainFeature = provinsiData.find(f => f.properties.kode_prov === selection.provinceCode);
            mainFeatureLevel = 'provinsi';
            subFeatures = kabkotaData.filter(f => f.properties.kode_prov === selection.provinceCode);
        } else {
            subFeatures = provinsiData;
            mainFeatureLevel = 'negara';
        }

        if (mapViewMode === 'region-only' && mainFeature) {
            renderFeature(mainFeature, { strokeColor: '#14B8A6', fillColor: '#14B8A6', fillOpacity: 0.2, strokeWeight: 2.5, zIndex: 1 }, 'nama');
        } else {
            subFeatures.forEach(sub => {
                const color = stringToHslColor(sub.properties.nama);
                const style = mainFeatureLevel === 'negara'
                    ? { fillColor: color, fillOpacity: 0.6, strokeWeight: 0, zIndex: 1 }
                    : { strokeColor: color, fillColor: color, fillOpacity: 0.25, strokeWeight: 1.5, zIndex: 2 };
                renderFeature(sub, style, 'nama');
            });
        }

        if (mainFeature) {
            onInfoChange({ properties: mainFeature.properties, level: mainFeatureLevel });
        } else {
            onInfoChange({ properties: { name: 'Indonesia', jumlahProvinsi: provinsiData.length }, level: 'negara' });
        }

        if (!masterBounds.isEmpty()) {
            if (forcedZoom) {
                // JIKA ada parameter zoom, gunakan Center + Zoom manual
                map.setCenter(masterBounds.getCenter());
                map.setZoom(forcedZoom);
            } else {
                const padding = isMobile ? {
                    left: 20,
                    right: 20,
                    top: 75, // Account for SearchBar + FilterPills
                    bottom: 250 // Account for BottomSheet peek
                } : {
                    left: ACTION_SIDEBAR_WIDTH + (isRegionSidebarOpen ? REGION_INFO_SIDEBAR_WIDTH : 0) + 20,
                    right: 20,
                    top: 20,
                    bottom: 20
                };
                map.fitBounds(masterBounds, padding);
            }
        }
        setLabels(newLabels);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [map, selection, provinsiData, kabkotaData, kecamatanData, desaData, onInfoChange, forcedZoom, triggerFitBounds]);

    useEffect(() => {
        if (!map) return;
        const listeners = [
            map.addListener('dragstart', onMapMove),
            map.addListener('zoom_changed', () => {
                // Only trigger if not during fitBounds
                if (!isNavigating) onMapMove();
            })
        ];
        return () => {
            listeners.forEach(l => google.maps.event.removeListener(l));
        };
    }, [map, onMapMove, isNavigating]);


    useEffect(() => {
        if (!map) return;
        map.setOptions({ draggableCursor: isPinningMode ? 'crosshair' : null });
        map.data.forEach((feature) => {
            const originalStyle = feature.getProperty('originalStyle');
            if (originalStyle) {
                const isStreetView = mapLayer === 'streetview' || isStreetViewLayerActive;
                const isInteractive = !isPinningMode && !isBoundaryTransparent && !isStreetView;
                const newOpacity = (isBoundaryTransparent || isStreetView) ? 0.1 : originalStyle.fillOpacity;
                map.data.overrideStyle(feature, { ...originalStyle, clickable: isInteractive, fillOpacity: newOpacity, });
            }
        });
    }, [map, isPinningMode, isBoundaryTransparent, mapLayer, isStreetViewLayerActive]);

    useEffect(() => {
        if (!map) return;
        let coverageLayer = null;
        let clickListener = null;
        let dragListener = null;
        let zoomListener = null;
        const streetView = map.getStreetView();
        const svService = new google.maps.StreetViewService();

        // Disable specific native controls (Address and Close Button) but keep Compass/Zoom
        streetView.setOptions({
            disableDefaultUI: false,
            addressControl: false,
            enableCloseButton: false
        });

        const handleVisibilityChange = () => {
            const isVisible = streetView.getVisible();
            if (onStreetViewVisibilityChange) {
                onStreetViewVisibilityChange(isVisible);
            }
            // Close preview when entering Street View
            if (isVisible || isPinningMode) {
                setPreviewPano(null);
            }
        };

        // Also close preview if pinning mode changes to true
        if (isPinningMode) {
            setPreviewPano(null);
        }

        const handlePositionChange = () => {
            const pos = streetView.getPosition();
            if (pos) {
                svService.getPanorama({ location: pos, radius: 50 }, (data, status) => {
                    if (status === 'OK' && onStreetViewUpdate) {
                        onStreetViewUpdate({
                            address: data.location.description || 'Lokasi Tidak Diketahui',
                            position: { lat: data.location.latLng.lat(), lng: data.location.latLng.lng() }
                        });
                    }
                });
            }
        };

        const listener = streetView.addListener('visible_changed', handleVisibilityChange);
        const posListener = streetView.addListener('position_changed', handlePositionChange);

        if (mapLayer === 'streetview' || isStreetViewLayerActive) {
            // Enable Street View Control and Position it
            map.setOptions({
                streetViewControl: true,
                streetViewControlOptions: {
                    position: isMobile ? window.google.maps.ControlPosition.RIGHT_TOP : window.google.maps.ControlPosition.RIGHT_BOTTOM
                }
            });

            // Add Coverage Layer
            if (window.google && window.google.maps && window.google.maps.StreetViewCoverageLayer) {
                coverageLayer = new window.google.maps.StreetViewCoverageLayer();
                coverageLayer.setMap(map);
            }

            // Add Click Listener for Preview
            clickListener = map.addListener('click', (e) => {
                const clickedLatLng = e.latLng;
                let pixel = e.pixel;

                // Fallback if pixel is missing (e.g. POI click)
                if (!pixel && e.domEvent) {
                    const mapDiv = map.getDiv();
                    const rect = mapDiv.getBoundingClientRect();
                    pixel = {
                        x: e.domEvent.clientX - rect.left,
                        y: e.domEvent.clientY - rect.top
                    };
                }

                if (!pixel) return; // Safety check to prevent crash

                // Check if we clicked on a Street View available location (using TanStack Query cache)
                queryClient.fetchQuery({
                    queryKey: ['streetview-availability', clickedLatLng.lat(), clickedLatLng.lng(), 50],
                    queryFn: () => fetchStreetViewAvailability({ lat: clickedLatLng.lat(), lng: clickedLatLng.lng() }, 50),
                    staleTime: 1000 * 60 * 60
                }).then((data) => {
                    if (data.available) {
                        setPreviewPano({
                            address: data.description || 'Jalan Tidak Diketahui',
                            position: data.latLng,
                            pixel: pixel,
                            panoId: data.pano
                        });
                    } else {
                        setPreviewPano(null);
                    }
                }).catch(() => {
                    setPreviewPano(null);
                });
            });

            // Close preview on map interaction (drag or zoom)
            dragListener = map.addListener('dragstart', () => {
                setPreviewPano(null);
            });
            zoomListener = map.addListener('zoom_changed', () => {
                setPreviewPano(null);
            });

            // Cleanup function for streetview mode
            return () => {
                if (coverageLayer) coverageLayer.setMap(null);
                if (clickListener) google.maps.event.removeListener(clickListener);
                if (dragListener) google.maps.event.removeListener(dragListener);
                if (zoomListener) google.maps.event.removeListener(zoomListener);
                map.setOptions({ streetViewControl: false });
                listener.remove();
                posListener.remove();
            };

        } else {
            // Disable Street View Control
            map.setOptions({ streetViewControl: false });
            setPreviewPano(null); // Ensure popup is closed if we switch layers

            // Cleanup function for non-streetview mode
            return () => {
                listener.remove();
                posListener.remove();
            };
        }
    }, [map, mapLayer, isStreetViewLayerActive, onStreetViewVisibilityChange]);


    useEffect(() => {
        if (!map) return;
        const mouseoverListener = map.data.addListener('mouseover', (e) => {
            if (mapViewMode === 'region-only' || hoveredFeatureRef.current) return;
            const originalStyle = e.feature.getProperty('originalStyle');
            map.data.overrideStyle(e.feature, { ...originalStyle, fillOpacity: 0.8, zIndex: 100 });
            hoveredFeatureRef.current = e.feature;

            const featureId = e.feature.getId() || e.feature.getProperty('id');
            setHoveredRegionId(String(featureId));
        });
        const mouseoutListener = map.data.addListener('mouseout', () => {
            if (hoveredFeatureRef.current) {
                map.data.overrideStyle(hoveredFeatureRef.current, hoveredFeatureRef.current.getProperty('originalStyle'));
                hoveredFeatureRef.current = null;
                setHoveredRegionId(null);
            }
        });
        const clickListener = map.data.addListener('click', (e) => {
            onMapClick?.();
            if (isPinningMode) return;
            if (mapViewMode === 'region-only') { onRegionClick(e); return; }
            if (mapViewMode === 'drill-down') {
                const props = {};
                e.feature.forEachProperty((value, property) => { props[property] = value; });
                onSubRegionClick(props, e.latLng);
            }
        });
        const mapClickListener = map.addListener('click', (e) => {
            onMapClick?.();
            if (isPinningMode) { onAddPin(e); }
        });
        return () => {
            google.maps.event.removeListener(mouseoverListener);
            google.maps.event.removeListener(mouseoutListener);
            google.maps.event.removeListener(clickListener);
            google.maps.event.removeListener(mapClickListener);
        };
    }, [map, selection, onSelectionChange, isPinningMode, onAddPin, onMapClick, mapViewMode, onSubRegionClick, onRegionClick]);

    const processedTickets = useMemo(() => {
        if (!Array.isArray(tickets) || tickets.length === 0) return [];

        const clusters = [];
        const pointGroups = new window.Map();

        tickets.forEach((item) => {
            if (item.type === 'cluster') {
                clusters.push(item);
            } else if (item.type === 'point' && item.coordinates && typeof item.coordinates.lat === 'number' && typeof item.coordinates.lng === 'number') {
                const key = `${item.coordinates.lat.toFixed(5)},${item.coordinates.lng.toFixed(5)}`;
                if (!pointGroups.has(key)) {
                    pointGroups.set(key, []);
                }
                pointGroups.get(key).push(item);
            }
        });

        const points = [];
        pointGroups.forEach((groupTickets) => {
            if (groupTickets.length === 1) {
                points.push(groupTickets[0]);
            } else {
                points.push({
                    type: 'point',
                    isMulti: true,
                    lat: groupTickets[0].coordinates.lat,
                    lng: groupTickets[0].coordinates.lng,
                    tickets: groupTickets,
                });
            }
        });

        return [...clusters, ...points];
    }, [tickets]);


    return (
        <div style={{ position: 'relative', width: '100%', height: '100%' }}>
            <Map
                defaultCenter={{ lat: -2.548926, lng: 118.0148634 }}
                defaultZoom={5}
                mapId={import.meta.env.VITE_GOOGLE_MAPS_MAP_ID || "e9f5b765b262e391"}
                mapTypeControl={false}
                streetViewControl={mapLayer === 'streetview' || isStreetViewLayerActive}
                mapTypeId={mapLayer === 'satellite' ? 'hybrid' : 'roadmap'}
                fullscreenControl={false}
                zoomControl={false}
                className="h-full w-full"
            />
            {labels.map(label => (
                <MapLabel
                    key={label.id}
                    position={label.position}
                    text={label.text}
                    color={label.color}
                    isHovered={label.id === hoveredRegionId}
                />
            ))}
            {pins.map(pin => {
                const isActive = pin.id === activePinId;
                const handleSelect = () => onActivePinChange(isActive ? null : pin.id);
                return (
                    <Pin
                        key={pin.id}
                        pin={pin}
                        onDelete={onDeletePin}
                        onUpdateTitle={onUpdatePinTitle}
                        onUpdatePin={onUpdatePin}
                        actionType={pinActionType}
                        isActive={isActive}
                        onSelect={handleSelect}
                        isNewlyCreated={pin.id === newlyCreatedPinId}
                        onStreetViewVisibilityChange={onStreetViewVisibilityChange}
                        onStreetViewUpdate={onStreetViewUpdate}
                    />
                );
            })}

            {mapViewMode === 'region-only' && processedTickets.map(item => {
                // Jika tipe adalah 'cluster', render komponen ClusterPin
                if (item.type === 'cluster') {
                    return (
                        <ClusterPin
                            key={`cluster-${item.lat}-${item.lng}`}
                            count={item.count}
                            lat={item.lat}
                            lng={item.lng}
                        />
                    );
                }
                // Jika tipe adalah 'point'
                if (item.type === 'point') {
                    // Jika terdapat beberapa tiket pada koordinat presisi yang sama
                    if (item.isMulti) {
                        return (
                            <MultiTicketPin
                                key={`multi-${item.lat}-${item.lng}`}
                                lat={item.lat}
                                lng={item.lng}
                                tickets={item.tickets}
                                activeTicketId={activeTicketId}
                                onActiveTicketChange={onActiveTicketChange}
                                details={activeTicketDetails}
                                isLoadingDetails={isTicketDetailLoading}
                                errorDetails={ticketDetailError}
                                onStreetViewVisibilityChange={onStreetViewVisibilityChange}
                                onStreetViewUpdate={onStreetViewUpdate}
                            />
                        );
                    }
                    // Jika hanya satu tiket pada koordinat tersebut
                    if (!item.coordinates) return null;
                    const isActive = item.id === activeTicketId;
                    const handleSelect = () => onActiveTicketChange(isActive ? null : item.id);
                    return (
                        <TicketPin
                            key={item.id}
                            lat={item.coordinates.lat}
                            lng={item.coordinates.lng}
                            status={item.status}
                            isActive={isActive}
                            onSelect={handleSelect}
                            details={isActive ? activeTicketDetails : null}
                            isLoadingDetails={isActive && isTicketDetailLoading}
                            errorDetails={isActive ? ticketDetailError : null}
                            onStreetViewVisibilityChange={onStreetViewVisibilityChange}
                            onStreetViewUpdate={onStreetViewUpdate}
                        />
                    );
                }
                return null;
            })}

            {/* Render children passed from parent (e.g. InfoWindows) */}
            {children}

            {/* Street View Click Preview */}
            {previewPano && (
                <div
                    style={{
                        position: 'absolute',
                        left: previewPano.pixel.x,
                        top: previewPano.pixel.y,
                        transform: 'translate(-50%, -100%) translateY(-15px)',
                        zIndex: 1000,
                        cursor: 'pointer',
                    }}
                    onClick={() => {
                        const streetView = map.getStreetView();
                        streetView.setPosition(previewPano.position);
                        streetView.setVisible(true);
                        setPreviewPano(null);
                    }}
                >
                    <div className="bg-white p-1 rounded shadow-lg border border-gray-200 flex flex-col items-center relative group hover:bg-gray-50 transition-colors">
                        {/* Close Button */}
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                setPreviewPano(null);
                            }}
                            className="absolute -top-2 -right-2 bg-white rounded-full p-1 shadow-md border border-gray-200 hover:bg-gray-100 z-10"
                        >
                            <X size={12} className="text-gray-500" />
                        </button>

                        {/* Image */}
                        <div className="w-48 h-32 bg-gray-200 overflow-hidden rounded-sm mb-1 relative">
                            <img
                                src={`https://maps.googleapis.com/maps/api/streetview?size=200x150&location=${previewPano.position.lat()},${previewPano.position.lng()}&fov=90&heading=0&pitch=0&key=${import.meta.env.VITE_GOOGLE_MAPS_API_KEY}`}
                                alt="Street View Preview"
                                className="w-full h-full object-cover"
                            />
                            <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-0 group-hover:bg-opacity-10 transition-all">
                                <span className="text-white font-semibold opacity-0 group-hover:opacity-100 drop-shadow-md text-sm">Klik untuk Masuk</span>
                            </div>
                        </div>
                        {/* Street Name */}
                        <div className="text-xs font-semibold text-gray-800 text-center px-1 max-w-[180px] truncate">
                            {previewPano.address}
                        </div>
                        {/* Triangle Pointer */}
                        <div
                            style={{
                                position: 'absolute',
                                bottom: '-6px',
                                left: '50%',
                                transform: 'translateX(-50%)',
                                width: 0,
                                height: 0,
                                borderLeft: '6px solid transparent',
                                borderRight: '6px solid transparent',
                                borderTop: '6px solid white',
                                filter: 'drop-shadow(0 2px 1px rgba(0,0,0,0.1))'
                            }}
                        />
                    </div>
                </div>
            )}

            {/* Mobile CSS Override for Pegman Position */}
            {isMobile && (
                <style>
                    {`
                        .gm-svpc {
                            margin-top: 110px !important;
                            margin-left: -5px !important; /* Adjust as needed */
                        }
                    `}
                </style>
            )}
        </div>
    );
};
export default React.memo(MapComponent);
