import { useState } from 'react';
import { AdvancedMarker, InfoWindow, useAdvancedMarkerRef, useMap } from '@vis.gl/react-google-maps';
import MapMarkerIcon from './icons/MapMarkerIcon';
import { X, Copy, CopyCheck, Layers, ChevronRight, ArrowLeft } from 'lucide-react';
import { getStatusColorHsl } from '../utils/statusColors';
import Tooltip from './Tooltip';
import StreetViewIcon from './icons/StreetViewIcon';
import { useStreetViewAvailability } from '../hooks/useStreetViewAvailability';
import { useStreetViewMarker } from '../hooks/useStreetViewMarker';

/**
 * Komponen sederhana yang menampilkan status pemuatan di dalam InfoWindow.
 */
const InfoWindowLoading = () => (
    <div className="p-4 font-sans flex items-center justify-center gap-2" style={{ minWidth: '220px' }}>
        <div className="w-3 h-3 border-2 border-dashed rounded-full animate-spin border-gray-400"></div>
        <p className="text-sm text-gray-600">Memuat data tiket...</p>
    </div>
);

/**
 * Komponen penanda peta untuk menangani beberapa tiket yang berada pada koordinat presisi yang persis sama.
 * Menampilkan penanda di titik presisi dengan badge jumlah tiket, dan menyediakan menu popup/daftar
 * interaktif saat diklik agar seluruh tiket pada koordinat tersebut dapat dipilih.
 */
const MultiTicketPin = ({
    lat,
    lng,
    tickets = [],
    activeTicketId,
    onActiveTicketChange,
    details,
    isLoadingDetails,
    errorDetails,
    onStreetViewVisibilityChange,
    onStreetViewUpdate
}) => {
    const [markerRef, marker] = useAdvancedMarkerRef();
    const [isCopySuccess, setIsCopySuccess] = useState(false);
    const [showList, setShowList] = useState(false);
    const map = useMap();
    const [isEnteringSv, setIsEnteringSv] = useState(false);

    // Cek apakah salah satu tiket di kelompok ini sedang aktif
    const activeTicketInGroup = tickets.find(t => t.id === activeTicketId);
    const isActive = !!activeTicketInGroup || showList;

    // Ambil status paling dominan untuk warna pin (atau default status tiket pertama)
    const primaryStatus = activeTicketInGroup ? activeTicketInGroup.status : (tickets[0]?.status || 'open');
    const pinColorHsl = getStatusColorHsl(primaryStatus, isActive);

    const ticketDetails = details?.data;

    // Street view check
    const { data: svAvailability, isLoading: isSvChecking } = useStreetViewAvailability(
        { lat, lng },
        50,
        isActive
    );
    const isSvAvailable = svAvailability?.available;

    const handleMarkerClick = () => {
        if (isActive) {
            // Jika sudah aktif, toggle tutup
            onActiveTicketChange(null);
            setShowList(false);
        } else {
            // Jika belum aktif, tampilkan daftar tiket di koordinat ini
            setShowList(true);
        }
    };

    const handleSelectTicketFromList = (ticketId) => {
        setShowList(false);
        onActiveTicketChange(ticketId);
    };

    const handleBackToList = () => {
        setShowList(true);
    };

    const handleEnterStreetView = () => {
        if (!map || !window.google || isSvAvailable === false || isEnteringSv) return;

        setIsEnteringSv(true);
        const sv = map.getStreetView();

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

    const { marker: svMarker, isVisible: isSvVisible } = useStreetViewMarker({
        position: { lat, lng },
        title: `${tickets.length} Tiket`,
        color: pinColorHsl,
        onClick: handleMarkerClick
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
                onClick={handleMarkerClick}
            >
                <div className="flex flex-col items-center relative cursor-pointer group">
                    {/* Badge Tumpukan Jumlah Tiket */}
                    <div className="absolute -top-2 -right-2 z-10 bg-indigo-600 text-white font-bold text-[11px] px-1.5 py-0.5 rounded-full shadow-md border-2 border-white flex items-center gap-0.5">
                        <Layers size={10} />
                        {tickets.length}
                    </div>

                    <MapMarkerIcon
                        className={`transition-transform duration-200 ${isActive ? 'scale-110 drop-shadow-xl' : 'group-hover:scale-105 drop-shadow-md'}`}
                        style={{ color: pinColorHsl }}
                    />
                    <div className={`w-4 h-1.5 bg-black/25 rounded-[100%] blur-[1px] -mt-1 transition-all duration-200 ${isActive ? 'scale-150 bg-black/30' : 'scale-100'}`}></div>
                </div>
            </AdvancedMarker>

            {isActive && (
                <InfoWindow
                    anchor={isSvVisible && svMarker ? svMarker : marker}
                    onCloseClick={() => {
                        onActiveTicketChange(null);
                        setShowList(false);
                    }}
                    disableAutoPan={true}
                >
                    <div className="p-0 font-sans relative w-[280px] overflow-hidden transform-gpu" style={{ transform: 'translateZ(0)' }}>
                        {/* MODE A: Tampilkan Daftar Pilihan Tiket di Lokasi Ini */}
                        {(showList || !activeTicketInGroup) && (
                            <div className="p-3">
                                <div className="flex items-center justify-between border-b pb-2 mb-2">
                                    <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-800">
                                        <Layers size={14} className="text-indigo-600" />
                                        <span>{tickets.length} Tiket di Lokasi Ini</span>
                                    </div>
                                    <button
                                        onClick={() => {
                                            onActiveTicketChange(null);
                                            setShowList(false);
                                        }}
                                        className="text-gray-400 hover:text-gray-600 p-0.5 rounded-full"
                                    >
                                        <X size={14} />
                                    </button>
                                </div>
                                <p className="text-[11px] text-gray-500 mb-2">
                                    Pilih tiket yang ingin Anda lihat detailnya:
                                </p>
                                <div className="space-y-1.5 max-h-[220px] overflow-y-auto pr-1">
                                    {tickets.map((t) => (
                                        <button
                                            key={t.id}
                                            onClick={() => handleSelectTicketFromList(t.id)}
                                            className={`w-full text-left p-2 rounded-md border transition-all flex items-center justify-between ${
                                                t.id === activeTicketId
                                                    ? 'bg-indigo-50 border-indigo-300 text-indigo-900 font-medium'
                                                    : 'bg-white hover:bg-gray-50 border-gray-200 text-gray-700'
                                            }`}
                                        >
                                            <div className="min-w-0 flex-1 pr-2">
                                                <div className="text-xs font-semibold truncate">
                                                    {t.ticket_number || `Tiket #${t.id}`}
                                                </div>
                                                <div className="flex items-center gap-1 mt-0.5">
                                                    <span
                                                        className="text-[9px] px-1 py-0.2 rounded font-medium border"
                                                        style={{
                                                            color: getStatusColorHsl(t.status, true),
                                                            borderColor: getStatusColorHsl(t.status, false),
                                                            backgroundColor: 'white'
                                                        }}
                                                    >
                                                        {t.status}
                                                    </span>
                                                </div>
                                            </div>
                                            <ChevronRight size={14} className="text-gray-400 flex-shrink-0" />
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* MODE B: Tampilkan Detail Tiket yang Dipilih dengan Tombol Navigasi Kembali */}
                        {!showList && activeTicketInGroup && (
                            <>
                                {/* Bar Navigasi Kelompok Tiket */}
                                <div className="bg-indigo-50 border-b border-indigo-100 px-3 py-1.5 flex items-center justify-between text-xs">
                                    <button
                                        onClick={handleBackToList}
                                        className="flex items-center gap-1 text-indigo-700 hover:text-indigo-900 font-medium transition-colors"
                                    >
                                        <ArrowLeft size={12} />
                                        <span>Daftar Tiket ({tickets.length})</span>
                                    </button>
                                    <span className="text-[10px] text-indigo-600 font-medium">
                                        Pilihan {tickets.findIndex(t => t.id === activeTicketId) + 1} dari {tickets.length}
                                    </span>
                                </div>

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
                                                    onClick={() => {
                                                        onActiveTicketChange(null);
                                                        setShowList(false);
                                                    }}
                                                    className="text-gray-400 hover:text-gray-600 p-1 rounded-full hover:bg-gray-100 transition-colors"
                                                >
                                                    <X size={16} />
                                                </button>
                                            </Tooltip>
                                        </div>

                                        <div className="px-3 pb-3 space-y-3">
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
                            </>
                        )}
                    </div>
                </InfoWindow>
            )}
        </>
    );
};

export default MultiTicketPin;
