import React, { useState, useCallback, useEffect, useRef } from 'react';
import { AdvancedMarker, InfoWindow, useAdvancedMarkerRef, useMapsLibrary, useMap } from '@vis.gl/react-google-maps';
import { useStreetViewAvailability } from '../hooks/useStreetViewAvailability';
import Tooltip from './Tooltip';
import MapMarkerIcon from './icons/MapMarkerIcon';
import { Trash2, Copy, CopyCheck, Check, MapPin, X, LocateFixed, Pencil } from 'lucide-react';
import StreetViewIcon from './icons/StreetViewIcon';
import { useStreetViewMarker } from '../hooks/useStreetViewMarker';

/**
 * Komponen terisolasi untuk mengedit judul.
 * Mengelola state inputnya sendiri untuk mencegah re-render pada parent.
 */
const PinTitleEditor = ({ initialTitle, onSave }) => {
    const [titleInput, setTitleInput] = useState(initialTitle);
    const inputRef = useRef(null);

    useEffect(() => {
        let timeoutId;
        if (inputRef.current) {
            timeoutId = setTimeout(() => {
                if (inputRef.current) {
                    inputRef.current.focus();
                    const length = inputRef.current.value.length;
                    inputRef.current.setSelectionRange(length, length);
                }
            }, 10); // Penundaan agar DOM InfoWindow dirender penuh
        }
        return () => clearTimeout(timeoutId);
    }, []);

    const handleSaveClick = () => {
        const trimmedTitle = titleInput.trim();
        onSave(trimmedTitle === '' ? 'Point of Interest' : trimmedTitle);
    };

    const handleKeyDown = (e) => {
        e.stopPropagation(); // Mencegah Google Maps membajak event keyboard
        if (e.key === 'Enter') {
            e.preventDefault();
            handleSaveClick();
        }
    };

    return (
        <div className="flex items-center gap-1.5 w-full min-h-[38px]">
            <input
                ref={inputRef}
                type="text"
                value={titleInput}
                onChange={(e) => setTitleInput(e.target.value)}
                onKeyDown={handleKeyDown}
                className="border border-blue-300 px-2 py-1 rounded w-full bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm min-w-0"
            />
            <Tooltip content="Simpan">
                <button
                    onClick={handleSaveClick}
                    className="p-1.5 bg-green-50 text-green-600 rounded hover:bg-green-100 hover:text-green-700 transition-colors flex-shrink-0"
                >
                    <Check size={16} />
                </button>
            </Tooltip>
        </div>
    );
};

/**
 * Komponen yang merepresentasikan pin yang dibuat pengguna di peta.
 * Komponen ini mencakup penanda peta (`AdvancedMarker`) dan jendela info (`InfoWindow`)
 * yang menampilkan detail pin dan menyediakan tindakan seperti mengedit judul, menyalin info, dan menghapus.
 * Komponen ini juga mengelola state internal untuk mode edit, status penyalinan, dan animasi.
 *
 * @param { object } props - Properti komponen.
 * @param { object } props.pin - Objek data pin yang berisi`id`, `lat`, `lng`, `title`, dan`adminInfo`.
 * @param { Function } props.onDelete - Fungsi callback untuk menghapus pin, dipanggil dengan`pin.id`.
 * @param { Function } props.onUpdateTitle - Fungsi callback untuk memperbarui judul pin, dipanggil dengan `pin.id` dan judul baru.
 * @param { Function } props.onUpdatePin - Fungsi callback untuk memperbarui properti pin lainnya (misal: address).
 * @param { boolean } props.isActive - Apakah pin ini sedang aktif(dipilih).
 * @param { Function } props.onSelect - Fungsi callback untuk menangani pemilihan / pembatalan pilihan pin.
 * @param { boolean } props.isNewlyCreated - Bendera untuk menunjukkan apakah pin ini baru saja dibuat, untuk memicu animasi masuk.
 * @param { string } [props.actionType = 'copy'] - 'copy' untuk menyalin info, 'select' untuk mengirim postMessage.
 */
const Pin = ({ pin, onDelete, onUpdateTitle, onUpdatePin, isActive, onSelect, isNewlyCreated, actionType = 'copy', onStreetViewVisibilityChange, onStreetViewUpdate }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [isActionSuccess, setIsActionSuccess] = useState(false);
    const [markerRef, marker] = useAdvancedMarkerRef();
    const [animationClass, setAnimationClass] = useState('');
    const [isInfoWindowVisible, setIsInfoWindowVisible] = useState(false);
    const [address, setAddress] = useState(pin.address || null);
    const [isLoadingAddress, setIsLoadingAddress] = useState(false);
    const geocodingLib = useMapsLibrary('geocoding');
    const hasSentCreatedMessage = useRef(false);
    const map = useMap();
    const [isEnteringSv, setIsEnteringSv] = useState(false);

    // Cek ketersediaan Street View dengan TanStack Query
    const { data: svAvailability, isLoading: isSvChecking } = useStreetViewAvailability(
        { lat: pin.lat, lng: pin.lng },
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
                    address: svAvailability.description || 'Lokasi Terpilih',
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

        // Fallback jika tidak ada pano di cache (harusnya jarang terjadi karena hook sudah memvalidasi)
        const svService = new google.maps.StreetViewService();
        svService.getPanorama({
            location: { lat: pin.lat, lng: pin.lng },
            radius: 50,
            source: google.maps.StreetViewSource.OUTDOOR
        }, (data, status) => {
            if (status === 'OK') {
                if (onStreetViewUpdate) {
                    onStreetViewUpdate({
                        address: data.location.description || 'Lokasi Terpilih',
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
        position: { lat: pin.lat, lng: pin.lng },
        title: pin.title,
        color: isActive ? '#dc2626' : '#ef4444',
        onClick: onSelect
    });

    // Efek untuk animasi masuk saat pin baru dibuat
    useEffect(() => {
        if (isNewlyCreated) {
            setAnimationClass('animate-bounce-in');
            const timer = setTimeout(() => setAnimationClass(''), 1000);
            return () => clearTimeout(timer);
        }
    }, [isNewlyCreated]);

    // Efek untuk menampilkan InfoWindow saat pin aktif
    useEffect(() => {
        if (isActive) {
            setIsInfoWindowVisible(true);
        } else {
            setIsInfoWindowVisible(false);
            setIsEditing(false); // Reset mode edit saat ditutup
        }
    }, [isActive]);

    // Efek untuk mengambil alamat saat pin aktif
    useEffect(() => {
        if (!geocodingLib || !isActive || address) return;

        setIsLoadingAddress(true);
        const geocoder = new geocodingLib.Geocoder();
        geocoder.geocode({ location: { lat: pin.lat, lng: pin.lng } }, (results, status) => {
            if (status === 'OK' && results[0]) {
                const preferredResult = results.find(r =>
                    r.types.includes('street_address') ||
                    r.types.includes('route') ||
                    r.types.includes('premise')
                ) || results[0];

                const newAddress = preferredResult.formatted_address;
                setAddress(newAddress);
                if (onUpdatePin) {
                    onUpdatePin(pin.id, { address: newAddress });
                }
            } else {
                setAddress('Alamat tidak ditemukan');
            }
            setIsLoadingAddress(false);
        });
    }, [geocodingLib, isActive, pin.lat, pin.lng, address, onUpdatePin, pin.id]);

    // Efek untuk mengirim pesan pinCreated (hanya sekali per pin instance)
    useEffect(() => {
        // Pastikan address sudah ada DAN adminInfo sudah selesai dimuat (isLoadingAdminInfo === false)
        if (isNewlyCreated && address && pin.isLoadingAdminInfo === false && !hasSentCreatedMessage.current) {
            const pinWithAddress = { ...pin, address };
            window.parent.postMessage({
                source: 'mapIframeApp',
                type: 'pinCreated',
                payload: pinWithAddress
            }, '*');
            hasSentCreatedMessage.current = true;
        }
    }, [isNewlyCreated, address, pin, pin.isLoadingAdminInfo]);


    const handleDelete = useCallback(() => onDelete(pin.id), [pin.id, onDelete]);

    const handlePrimaryAction = useCallback(() => {
        if (actionType === "select") {
            if (address) {
                pin.address = address;
            }

            window.parent.postMessage({
                source: 'mapIframeApp',
                type: 'pinSelected', // Menggunakan tipe spesifik agar parent bisa membedakan
                payload: pin
            }, '*');

            setIsActionSuccess(true);
            setTimeout(() => setIsActionSuccess(false), 2000);

        } else {
            const params = new URLSearchParams();
            params.set('share_lat', pin.lat.toString());
            params.set('share_lng', pin.lng.toString());
            params.set('share_title', pin.title);
            const shareUrl = `${window.location.origin}${window.location.pathname}?${params.toString()}`;

            const textParts = [pin.title];

            if (pin.adminInfo && pin.adminInfo.provinsi) {
                const adminParts = [
                    pin.adminInfo.provinsi.nama,
                    pin.adminInfo.kab_kota.nama,
                    pin.adminInfo.kecamatan.nama,
                    pin.adminInfo.desa.nama,
                ].filter(Boolean);

                if (adminParts.length > 0) {
                    textParts.push(`Wilayah: ${adminParts.join(', ')}`);
                }
            }

            if (address) {
                textParts.push(`Alamat: ${address}`);
            }

            textParts.push(
                `Latitude: ${pin.lat.toFixed(9)}`,
                `Longitude: ${pin.lng.toFixed(9)}`,
                '',
                `Tautan Berbagi: ${shareUrl}`
            );

            const textToCopy = textParts.join('\n');

            navigator.clipboard.writeText(textToCopy).then(() => {
                setIsActionSuccess(true);
                setTimeout(() => setIsActionSuccess(false), 2000);
            });
        }
    }, [pin, actionType, address]);

    const handleSaveTitle = useCallback((newTitle) => {
        onUpdateTitle(pin.id, newTitle);
        setIsEditing(false);
    }, [pin.id, onUpdateTitle]);

    return (
        <>
            <AdvancedMarker
                ref={markerRef}
                position={{ lat: pin.lat, lng: pin.lng }}
                onClick={onSelect}
            >
                <div className={`${animationClass} flex flex-col items-center`}>
                    <MapMarkerIcon className={`transition-transform duration-200 ${isActive ? 'text-red-600 scale-110 drop-shadow-xl' : 'text-red-500 hover:scale-105 drop-shadow-md'}`} />
                    {/* Ground Shadow */}
                    <div className={`w-4 h-1.5 bg-black/25 rounded-[100%] blur-[1px] -mt-1 transition-all duration-200 ${isActive ? 'scale-150 bg-black/30' : 'scale-100'}`}></div>
                </div>
            </AdvancedMarker>
            {isInfoWindowVisible && (
                <InfoWindow
                    anchor={isSvVisible && svMarker ? svMarker : marker}
                    onCloseClick={onSelect}
                    disableAutoPan={true}
                >
                    <div className="p-0 font-sans relative w-[260px] overflow-hidden transform-gpu" style={{ transform: 'translateZ(0)' }}>
                        {/* Header with Title and Close Button */}
                        <div className="flex items-start justify-between p-3 pb-2 gap-2 w-full">
                            <div className="flex-1 min-w-0">
                                {isEditing ? (
                                    <PinTitleEditor
                                        initialTitle={pin.title}
                                        onSave={handleSaveTitle}
                                    />
                                ) : (
                                    <div className="group relative flex items-start min-h-[38px]">
                                        <h3 className="font-semibold text-gray-900 text-sm leading-tight pr-6 line-clamp-2 break-words w-full" title={pin.title}>
                                            {pin.title}
                                        </h3>
                                        <button
                                            onClick={() => setIsEditing(true)}
                                            className="absolute right-0 opacity-0 group-hover:opacity-100 p-0.5 text-gray-400 hover:text-blue-600 bg-white rounded"
                                            title="Edit"
                                        >
                                            <Pencil size={14} />
                                        </button>
                                    </div>
                                )}
                                {/* Compact Coordinates */}
                                <div className="flex items-center gap-1 text-[10px] text-gray-500 mt-0.5">
                                    <LocateFixed size={12} className="opacity-60" />
                                    <span>{pin.lat.toFixed(6)}, {pin.lng.toFixed(6)}</span>
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

                        {/* Content Body */}
                        <div className="px-3 pb-3 space-y-3">

                            {/* Admin Info - Compact Card Style */}
                            {pin.isLoadingAdminInfo ? (
                                <div className="flex items-center gap-2 text-xs text-gray-500 py-2">
                                    <span>Mencari wilayah</span>
                                    <div className="flex gap-1 h-3 items-center">
                                        <div className="w-1 h-1 bg-gray-400 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                                        <div className="w-1 h-1 bg-gray-400 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                                        <div className="w-1 h-1 bg-gray-400 rounded-full animate-bounce"></div>
                                    </div>
                                </div>
                            ) : pin.adminInfo && pin.adminInfo.provinsi ? (
                                <div className="bg-gray-50 rounded-md p-2 text-xs border border-gray-100">
                                    {(() => {
                                        const desa = pin.adminInfo.desa;
                                        const kec = pin.adminInfo.kecamatan;
                                        const kab = pin.adminInfo.kab_kota;
                                        const prov = pin.adminInfo.provinsi;

                                        const desaType = desa?.tipe === '1' ? 'Desa' : 'Kel.';
                                        const kabType = kab?.tipe === '4' ? 'Kab.' : 'Kota';

                                        return (
                                            <div className="flex flex-col gap-0.5">
                                                {desa && kec && (
                                                    <div className="font-medium text-gray-800">
                                                        {desaType} {desa.nama}, Kec. {kec.nama}
                                                    </div>
                                                )}
                                                {kab && prov && (
                                                    <div className="text-gray-500">
                                                        {kabType} {kab.nama}, {prov.nama}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })()}
                                </div>
                            ) : (
                                <div className="text-xs italic text-gray-400 py-1">
                                    Di luar batas administrasi
                                </div>
                            )}

                            {/* Address Section */}
                            {isLoadingAddress ? (
                                <div className="flex items-center gap-2 text-xs text-gray-500">
                                    <span>Mencari alamat</span>
                                    <div className="flex gap-1 h-3 items-center">
                                        <div className="w-1 h-1 bg-gray-400 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                                        <div className="w-1 h-1 bg-gray-400 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                                        <div className="w-1 h-1 bg-gray-400 rounded-full animate-bounce"></div>
                                    </div>
                                </div>
                            ) : address && (
                                <div className="flex gap-2 items-start text-xs text-gray-600">
                                    <MapPin size={14} className="mt-0.5 text-gray-400 flex-shrink-0" />
                                    <span className="break-words leading-relaxed">{address}</span>
                                </div>
                            )}

                            {/* Actions Footer */}
                            <div className="flex gap-2 pt-2 mt-1">
                                <button
                                    onClick={handlePrimaryAction}
                                    disabled={isActionSuccess}
                                    className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition ${isActionSuccess
                                        ? 'bg-green-50 text-green-700 border border-green-200'
                                        : 'bg-blue-600 text-white border border-transparent hover:bg-blue-700 shadow-sm hover:shadow'
                                        }`}
                                >
                                    {isActionSuccess ? (
                                        <>
                                            {actionType === 'select' ? <Check size={12} /> : <CopyCheck size={12} />}
                                            {actionType === 'select' ? 'Terpilih' : 'Tersalin'}
                                        </>
                                    ) : (
                                        <>
                                            {actionType === 'select' ? (
                                                <Check size={12} />
                                            ) : (
                                                <Copy size={12} />
                                            )}
                                            {actionType === 'select' ? 'Pilih' : 'Salin'}
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

                                <Tooltip content="Hapus Pin">
                                    <button
                                        onClick={handleDelete}
                                        className="flex items-center justify-center px-3 py-1.5 rounded text-xs font-medium text-red-600 bg-red-50 hover:bg-red-100 border border-red-100 transition-colors h-full"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </Tooltip>
                            </div>
                        </div>
                    </div >
                </InfoWindow >
            )}
        </>
    );
};

export default React.memo(Pin);