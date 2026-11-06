import React from 'react';
import { Info, Proportions } from 'lucide-react';
import Tooltip from './Tooltip';

/**
 * Komponen yang menampilkan satu set tombol aksi mengambang (floating action buttons),
 * biasanya ditampilkan di peta saat sebuah wilayah dipilih. Komponen ini mencakup tombol
 * untuk menampilkan info wilayah dan, secara opsional, untuk menelusuri sub-wilayah.
 *
 * @param {object} props - Properti komponen.
 * @param {Function} props.onShowInfo - Fungsi callback yang dieksekusi saat tombol "Tampilkan Info" diklik.
 * @param {Function} props.onShowSubRegions - Fungsi callback yang dieksekusi saat tombol "Tampilkan Sub-wilayah" diklik.
 * @param {boolean} props.canDrillDown - Menentukan apakah tombol "Tampilkan Sub-wilayah" terlihat.
 * @returns {JSX.Element} Sebuah div yang berisi tombol-tombol aksi mengambang.
 */
const FloatingActionButtons = ({ onShowInfo, onShowSubRegions, canDrillDown }) => {
  return (
    <div className="flex gap-2 p-1.5 bg-white rounded-full shadow-xl border border-gray-100">
      <Tooltip content="Tampilkan Info Wilayah">
        <button
          onClick={onShowInfo}
          className="bg-gray-50 p-2.5 rounded-full hover:bg-blue-50 hover:text-blue-600 transition-colors duration-200 flex items-center justify-center text-gray-600"
        >
          <Info size={20} />
        </button>
      </Tooltip>
      {canDrillDown && (
        <Tooltip content="Tampilkan Sub-wilayah">
          <button
            onClick={onShowSubRegions}
            className="bg-gray-50 p-2.5 rounded-full hover:bg-blue-50 hover:text-blue-600 transition-colors duration-200 flex items-center justify-center text-gray-600"
          >
            <Proportions size={20} />
          </button>
        </Tooltip>
      )}
    </div>
  );
};

export default React.memo(FloatingActionButtons);
