import React from 'react';
import { InfoWindow } from '@vis.gl/react-google-maps';
import { Navigation, X } from 'lucide-react';
import { TICKET_STATUSES } from '../constants/ticketStatus';
import Tooltip from './Tooltip';

/**
 * Komponen helper untuk menampilkan statistik tiket dalam InfoWindow.
 * Menangani status pemuatan dan kasus di mana data tidak tersedia.
 *
 * @param {object} props - Properti komponen.
 * @param {object|null} props.stats - Objek yang berisi statistik tiket (open, pending, closed, total).
 * @param {boolean} props.loading - Bendera yang menunjukkan jika data sedang dimuat.
 * @returns {JSX.Element} Tampilan statistik.
 */
const StatsDisplay = ({ stats, loading }) => {
  if (loading) {
    return (
      <div className="text-sm text-gray-500 min-h-[72px] flex items-center justify-center gap-1.5">
        <span>Memuat data</span>
        <div className="flex gap-1 items-center mt-1">
          <div className="w-1 h-1 bg-gray-400 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
          <div className="w-1 h-1 bg-gray-400 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
          <div className="w-1 h-1 bg-gray-400 rounded-full animate-bounce"></div>
        </div>
      </div>
    );
  }

  const statsData = stats;

  if (!statsData) {
    return (
      <div className="text-sm text-gray-500 min-h-[72px] flex items-center justify-center">
        Data tidak tersedia.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm text-gray-600">
      {TICKET_STATUSES.map(status => (
        <React.Fragment key={status.key}>
          <span>{status.label}:</span>
          <span className="font-semibold text-right">{statsData[status.key]}</span>
        </React.Fragment>
      ))}
      <span className="font-bold border-t pt-1 mt-1">Total:</span>
      <span className="font-bold border-t pt-1 mt-1 text-right">{statsData.total}</span>
    </div>
  );
};

/**
 * Komponen InfoWindow kustom yang menampilkan pratinjau data untuk sebuah wilayah,
 * termasuk nama wilayah dan statistik tiket. Komponen ini biasanya muncul saat pengguna
 * mengarahkan kursor ke sebuah sub-wilayah pada peta.
 *
 * @param {object} props - Properti komponen.
 * @param {{lat: number, lng: number}|null} props.position - Posisi geografis untuk InfoWindow.
 * @param {string} props.regionName - Nama wilayah yang akan ditampilkan.
 * @param {object|null} props.stats - Objek statistik tiket untuk ditampilkan oleh `StatsDisplay`.
 * @param {boolean} props.loading - Bendera status pemuatan untuk diteruskan ke `StatsDisplay`.
 * @param {Function} props.onClose - Fungsi callback yang dipanggil saat pengguna menutup InfoWindow.
 * @param {Function} props.onNavigate - Fungsi callback yang dipanggil saat pengguna mengklik tombol "Lihat selengkapnya".
 * @returns {JSX.Element|null} Komponen RegionPreviewInfoWindow, atau null jika tidak ada posisi.
 */
const RegionPreviewInfoWindow = ({
  position,
  regionName,
  stats,
  loading,
  onClose,
  onNavigate,
}) => {

  if (!position) {
    return null;
  }

  return (
    <InfoWindow position={position} onCloseClick={onClose} disableAutoPan={true}>
      <div className="p-0 font-sans relative w-[260px]">
        {/* Header */}
        <div className="flex items-start justify-between p-3 pb-2">
          <div className="flex-1 pr-6">
            <h3 className="font-semibold text-gray-900 text-sm leading-tight" title={regionName}>
              {regionName}
            </h3>
            <div className="flex items-center gap-1 text-[10px] text-gray-500 mt-0.5">
              <span className="bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded font-medium">
                Wilayah
              </span>
            </div>
          </div>
          <Tooltip content="Tutup">
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 p-1 rounded-full hover:bg-gray-100 transition-colors"
            >
              <X size={16} />
            </button>
          </Tooltip>
        </div>

        {/* Body */}
        <div className="px-3 pb-3 space-y-3">
          {/* Stats Card */}
          <div className="bg-gray-50 rounded-md p-2 text-xs border border-gray-100">
            <StatsDisplay stats={stats} loading={loading} />
          </div>

          {/* Actions Footer */}
          <div className="pt-1">
            <button
              onClick={onNavigate}
              className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium bg-blue-600 text-white border border-transparent hover:bg-blue-700 shadow-sm hover:shadow transition-colors duration-200"
            >
              <Navigation size={14} />
              Lihat Detail Wilayah
            </button>
            <p className="text-[10px] text-gray-400 mt-2 text-center italic">
              atau klik area dua kali
            </p>
          </div>
        </div>
      </div>
    </InfoWindow>
  );
};

export default React.memo(RegionPreviewInfoWindow);
