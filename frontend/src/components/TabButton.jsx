import React from 'react';

/**
 * Komponen tombol tab sederhana yang digunakan di dalam sidebar.
 *
 * @param {object} props - Properti komponen.
 * @param {string} props.text - Teks yang akan ditampilkan pada tombol.
 * @param {boolean} props.isActive - Apakah tab ini sedang aktif.
 * @param {Function} props.onClick - Fungsi callback yang akan dipanggil saat tombol diklik.
 * @returns {JSX.Element} Komponen tombol tab.
 */
const TabButton = ({ text, isActive, onClick }) => (
    <button
        onClick={onClick}
        className={`
            relative px-4 py-3 text-sm font-medium transition-all duration-200
            ${isActive ? 'text-blue-600' : 'text-gray-500 hover:text-gray-800'}
        `}
    >
        {text}
        {isActive && (
            <span className="absolute bottom-0 left-0 w-full h-0.5 bg-blue-600 rounded-t-full animate-in fade-in zoom-in-x duration-200" />
        )}
    </button>
);

export default TabButton;
