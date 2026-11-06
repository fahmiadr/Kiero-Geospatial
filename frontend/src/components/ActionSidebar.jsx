import { MapPinned, Map, Sparkles } from 'lucide-react';
import Tooltip from './Tooltip';
import { ACTION_SIDEBAR_WIDTH } from '../constants/layout';



/**
 * Komponen tombol yang dapat digunakan kembali untuk ActionSidebar.
 * Menampilkan ikon dan teks (di mobile) atau tooltip (di desktop).
 *
 * @param {object} props - Properti komponen.
 * @param {JSX.Element} props.icon - Elemen ikon SVG untuk ditampilkan.
 * @param {string} [props.text] - Label teks untuk ditampilkan (mobile) atau tooltip (desktop).
 * @param {Function} props.onClick - Fungsi yang akan dipanggil saat tombol diklik.
 * @param {boolean} props.isActive - Apakah tombol harus ditampilkan dalam keadaan aktif.
 * @param {boolean} props.isMobile - Apakah tampilan mobile.
 * @returns {JSX.Element} Elemen tombol untuk sidebar aksi.
 */
const ActionSidebarButton = ({ icon, text, onClick, isActive, isMobile }) => {
    const buttonContent = (
        <button
            onClick={onClick}
            className={`
                w-full flex flex-col items-center justify-center p-3 rounded-xl transition-all duration-200 group
                ${isActive
                    ? 'bg-blue-50 text-blue-600 shadow-sm'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                }
            `}
        >
            <div className={`transition-transform duration-200 ${isActive ? 'scale-110' : 'group-hover:scale-105'}`}>
                {icon}
            </div>
            {isMobile && text && <span className="text-[10px] font-semibold mt-1.5">{text}</span>}
        </button>
    );

    // Di desktop, bungkus dengan Tooltip
    if (!isMobile && text) {
        return (
            <Tooltip content={text} placement="right">
                {buttonContent}
            </Tooltip>
        );
    }

    return buttonContent;
};

/**
 * Sidebar vertikal tetap di sisi kiri layar yang berisi tombol-tombol aksi utama.
 * Tombol-tombol ini digunakan untuk mengubah visibilitas dan konten dari `UnifiedSidebar` utama.
 *
 * @param {object} props - Properti komponen.
 * @param {Function} props.onButtonClick - Fungsi callback yang dieksekusi saat tombol aksi diklik. Menerima nama sidebar yang akan dibuka (misalnya, 'wilayah', 'history').
 * @param {string|null} props.activeSidebar - Nama tampilan sidebar yang sedang aktif, digunakan untuk menyorot tombol yang sesuai.
 * @returns {JSX.Element} Komponen ActionSidebar.
 */
const ActionSidebar = ({ onButtonClick, activeSidebar, isMobile }) => {
    return (
        <div
            className={`
                bg-white shadow-sm flex items-center pointer-events-auto
                ${isMobile
                    ? 'fixed bottom-0 left-0 right-0 h-auto flex-row justify-around border-t border-gray-200 py-2 px-4 z-[70]'
                    : 'h-full flex-col gap-3 border-r border-gray-200 p-3 z-20'
                }
            `}
            style={!isMobile ? { width: ACTION_SIDEBAR_WIDTH } : {}}
        >
            <ActionSidebarButton
                icon={<Map size={24} />}
                text="Wilayah"
                onClick={() => onButtonClick('wilayah')}
                isActive={activeSidebar === 'wilayah'}
                isMobile={isMobile}
            />
            <ActionSidebarButton
                icon={<MapPinned size={24} />}
                text="Riwayat Pin"
                onClick={() => onButtonClick('history')}
                isActive={activeSidebar === 'history'}
                isMobile={isMobile}
            />
            <ActionSidebarButton
                icon={<Sparkles size={24} />}
                text="Geo AI"
                onClick={() => onButtonClick('geoAi')}
                isActive={activeSidebar === 'geoAi'}
                isMobile={isMobile}
            />
        </div>
    );
};

export default ActionSidebar;
