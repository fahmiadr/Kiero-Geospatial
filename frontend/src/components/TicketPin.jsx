import { useState } from 'react';
import { AdvancedMarker, InfoWindow, useAdvancedMarkerRef, useMap } from '@vis.gl/react-google-maps';
import MapMarkerIcon from './icons/MapMarkerIcon';
import { X, Copy, CopyCheck } from 'lucide-react';
import { getStatusColorHsl } from '../utils/statusColors';
import Tooltip from './Tooltip';
import StreetViewIcon from './icons/StreetViewIcon';
import { useStreetViewAvailability } from '../hooks/useStreetViewAvailability';
import { useStreetViewMarker } from '../hooks/useStreetViewMarker';

/**
 * Komponen sederhana yang menampilkan status pemuatan di dalam InfoWindow.
 * @returns {JSX.Element}
 */
const InfoWindowLoading = () => (
    <div className="p-4 font-sans flex items-center justify-center gap-2" style={{ minWidth: '200px' }}>
        <div className="w-3 h-3 border-2 border-dashed rounded-full animate-spin border-gray-400"></div>
        <p className="text-sm text-gray-600">Memuat data tiket...</p>
    </div>
);

/**
 * Komponen penanda peta yang merepresentasikan sebuah tiket.
 * Warnanya berubah berdasarkan status tiket. Saat aktif (dipilih),
 * komponen ini menampilkan `InfoWindow` dengan detail tiket yang diambil.
 *
 * @param {object} props - Properti komponen.
 * @param {number} props.lat - Latitude dari tiket.
 * @param {number} props.lng - Longitude dari tiket.
 * @param {string} props.status - Status tiket (misalnya, 'open', 'closed').
 * @param {boolean} props.isActive - Apakah pin tiket ini sedang aktif.
 * @param {Function} props.onSelect - Fungsi callback yang dipanggil saat pin diklik.
 * @param {object|null} props.details - Objek yang berisi detail tiket untuk ditampilkan di InfoWindow.
 * @param {boolean} props.isLoadingDetails - Bendera yang menunjukkan jika detail sedang dimuat.
 * @param {Error|null} props.errorDetails - Objek error jika terjadi kesalahan saat memuat detail.
 * @returns {JSX.Element} Komponen TicketPin.
 */
const TicketPin = ({
    lat,
    lng,
    status,
    isActive,
    onSelect,
    details,
    isLoadingDetails,
    errorDetails,
    onStreetViewVisibilityChange,
    onStreetViewUpdate
}) => {
    const [markerRef, marker] = useAdvancedMarkerRef();
    const [isCopySuccess, setIsCopySuccess] = useState(false);
    const map = useMap();
    const [isEnteringSv, setIsEnteringSv] = useState(false);

    const ticketDetails = details?.data;
    const pinColorHsl = getStatusColorHsl(status, isActive);

    // Cek ketersediaan Street View dengan TanStack Query
    const { data: svAvailability, isLoading: isSvChecking } = useStreetViewAvailability(
        { lat, lng },
        50,
        isActive
    );

    const isSvAvailable = svAvailability?.available;

    const handleEnterStreetView = () => {
        if (!map || !window.google || isSvAvailable === false || isEnteringSv) return;

        setIsEnteringSv(true);
        const sv = map.getStreetView();

        // Gunakan data dari cache jika tersedia
        if (svAvailability?.pano) {
            if (onStreetViewUpdate) {
                onStreetViewUpdate({
                    address: svAvailability.description || ticketDetails?.address || 'Lokasi Tiket',
                    position: { lat: svAvailability.latLng.lat(), lng: svAvailability.latLng.lng() }
                });
            }
            sv.setPano(svAvailability.pano);
            sv.setVisible(true);
            if (onStreetViewVisibilityChange) {
                onStreetViewVisibilityChange(true);
            }
            setTimeout(() => setIsEnteringSv(false), 500);
            return;
        }

        // Fallback jika tidak ada pano di cache
        const svService = new google.maps.StreetViewService();
        svService.getPanorama({
            location: { lat, lng },
            radius: 50,
            source: google.maps.StreetViewSource.OUTDOOR
        }, (data, status) => {
            if (status === 'OK') {
                if (onStreetViewUpdate) {
                    onStreetViewUpdate({
                        address: data.location.description || ticketDetails?.address || 'Lokasi Tiket',
                        position: { lat: data.location.latLng.lat(), lng: data.location.latLng.lng() }
                    });
                }
                sv.setPano(data.location.pano);
                sv.setVisible(true);
                if (onStreetViewVisibilityChange) {
                    onStreetViewVisibilityChange(true);
                }
                setTimeout(() => setIsEnteringSv(false), 500);
            } else {
                setIsEnteringSv(false);
            }
        });
    };

    // Render Pin di Street View
    const { marker: svMarker, isVisible: isSvVisible } = useStreetViewMarker({
        position: { lat, lng },
        title: ticketDetails?.ticket_number || 'Tiket',
        color: pinColorHsl,
        onClick: onSelect
    });

    const handleCopy = () => {
        if (!ticketDetails) return;

        const textToCopy = [
            `Ticket Number: ${ticketDetails.ticket_number}`,
            `Category: ${ticketDetails.category}`,
            `Status: ${ticketDetails.status}`,
            `Source: ${ticketDetails.channel_source || '-'}`,
            `Phone Number: ${ticketDetails.account_id || '-'}`,
            `Complaint: ${ticketDetails.complaint_detail || '-'}`
        ].join('\n');

        navigator.clipboard.writeText(textToCopy).then(() => {
            setIsCopySuccess(true);
            setTimeout(() => setIsCopySuccess(false), 2000);
        });
    };

    return (
        <>
            <AdvancedMarker
                ref={markerRef}
                position={{ lat, lng }}
                onClick={onSelect}
            >
                <div className="flex flex-col items-center">
                    <MapMarkerIcon
                        className={`transition-transform duration-200 ${isActive ? 'scale-110 drop-shadow-xl' : 'hover:scale-105 drop-shadow-md'}`}
                        style={{ color: pinColorHsl }}
                    />
                    {/* Ground Shadow */}
                    <div className={`w-4 h-1.5 bg-black/25 rounded-[100%] blur-[1px] -mt-1 transition-all duration-200 ${isActive ? 'scale-150 bg-black/30' : 'scale-100'}`}></div>
                </div>
            </AdvancedMarker>
            {isActive && (
                <InfoWindow
                    anchor={isSvVisible && svMarker ? svMarker : marker}
                    onCloseClick={onSelect}
                    disableAutoPan={true}
                >
                    <div className="p-0 font-sans relative w-[260px] overflow-hidden transform-gpu" style={{ transform: 'translateZ(0)' }}>
                        {/* Loading State */}
                        {isLoadingDetails && <InfoWindowLoading />}

                        {/* Error State */}
                        {errorDetails && (
                            <div className="p-4 text-center">
                                <p className="text-xs text-red-500">
                                    {typeof errorDetails === 'string' ? errorDetails : errorDetails.message || 'Gagal memuat detail'}
                                </p>
                            </div>
                        )}

                        {/* Content State */}
                        {!isLoadingDetails && !errorDetails && ticketDetails && (
                            <>
                                {/* Header */}
                                <div className="flex items-start justify-between p-3 pb-2 gap-2 w-full">
                                    <div className="flex-1 min-w-0 pr-2">
                                        <h3 className="font-semibold text-gray-900 text-sm leading-tight truncate" title={ticketDetails.ticket_number}>
                                            {ticketDetails.ticket_number}
                                        </h3>
                                        <div className="flex items-center gap-1 text-[10px] text-gray-500 mt-0.5">
                                            <span className="font-medium text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">
                                                {ticketDetails.category}
                                            </span>
                                        </div>
                                    </div>
                                    <Tooltip content="Tutup">
                                        <button
                                            onClick={onSelect}
                                            className="text-gray-400 hover:text-gray-600 p-1 rounded-full hover:bg-gray-100 transition-colors"
                                        >
                                            <X size={16} />
                                        </button>
                                    </Tooltip>
                                </div>

                                {/* Body */}
                                <div className="px-3 pb-3 space-y-3">
                                    {/* Status & Source Card */}
                                    <div className="bg-gray-50 rounded-md p-2 text-xs border border-gray-100 space-y-1">
                                        <div className="flex justify-between items-center">
                                            <span className="text-gray-500">Status:</span>
                                            <span
                                                className="font-medium px-1.5 py-0.5 rounded border"
                                                style={{
                                                    color: getStatusColorHsl(ticketDetails.status, true),
                                                    borderColor: getStatusColorHsl(ticketDetails.status, false),
                                                    backgroundColor: 'white'
                                                }}
                                            >
                                                {ticketDetails.status}
                                            </span>
                                        </div>
                                        <div className="flex justify-between items-center">
                                            <span className="text-gray-500">Source:</span>
                                            <span className="font-medium text-gray-700">{ticketDetails.channel_source || '-'}</span>
                                        </div>
                                    </div>

                                    {/* Details List */}
                                    <div className="space-y-2 text-xs text-gray-600">
                                        <div>
                                            <span className="block text-[10px] uppercase tracking-wide text-gray-400 font-medium mb-0.5">Phone Number</span>
                                            <div className="font-medium text-gray-800">{ticketDetails.account_id || '-'}</div>
                                        </div>
                                        <div>
                                            <span className="block text-[10px] uppercase tracking-wide text-gray-400 font-medium mb-0.5">Complaint</span>
                                            <div className="leading-relaxed text-gray-700 line-clamp-3" title={ticketDetails.complaint_detail}>
                                                {ticketDetails.complaint_detail || '-'}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Footer Actions */}
                                    <div className="pt-1 flex gap-2 items-stretch h-9">
                                        <button
                                            onClick={handleCopy}
                                            disabled={isCopySuccess}
                                            className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition ${isCopySuccess
                                                ? 'bg-green-50 text-green-700 border border-green-200'
                                                : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50 hover:text-gray-900'
                                                }`}
                                        >
                                            {isCopySuccess ? (
                                                <>
                                                    <CopyCheck size={12} />
                                                    Tersalin
                                                </>
                                            ) : (
                                                <>
                                                    <Copy size={12} />
                                                    Salin Detail
                                                </>
                                            )}
                                        </button>

                                        {!isSvVisible && (
                                            <Tooltip content={isSvAvailable === false ? "Street View Tidak Tersedia" : isSvChecking ? "Mengecek Street View..." : "Masuk Street View"}>
                                                <button
                                                    onClick={handleEnterStreetView}
                                                    disabled={isSvAvailable === false || isSvChecking || isEnteringSv}
                                                    className={`flex items-center justify-center px-3 py-1.5 rounded text-xs font-medium transition-colors h-full ${isSvAvailable === false
                                                        ? 'text-gray-400 bg-gray-50 border border-gray-200 cursor-not-allowed'
                                                        : isSvChecking || isEnteringSv
                                                            ? 'text-gray-400 bg-gray-50 border border-gray-100 cursor-wait'
                                                            : 'text-green-600 bg-green-50 hover:bg-green-100 border border-green-100'
                                                        }`}
                                                >
                                                    {isEnteringSv ? (
                                                        <div className="w-5 h-5 border-2 border-green-600 border-t-transparent rounded-full animate-spin"></div>
                                                    ) : isSvChecking ? (
                                                        <div className="flex gap-1 items-center justify-center w-5 h-5">
                                                            <div className="w-1 h-1 bg-gray-400 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                                                            <div className="w-1 h-1 bg-gray-400 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                                                            <div className="w-1 h-1 bg-gray-400 rounded-full animate-bounce"></div>
                                                        </div>
                                                    ) : (
                                                        <StreetViewIcon className="w-5 h-5" disabled={isSvAvailable === false} />
                                                    )}
                                                </button>
                                            </Tooltip>
                                        )}
                                    </div>
                                </div>
                            </>
                        )}
                    </div>
                </InfoWindow>
            )}
        </>
    );
};

export default TicketPin;
