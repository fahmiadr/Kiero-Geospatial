import { ChevronLeft, ChevronRight } from 'lucide-react';
import Tooltip from './Tooltip';

/**
 * Komponen tombol yang digunakan untuk menyembunyikan atau menampilkan sidebar.
 * Tombol ini diposisikan secara absolut relatif terhadap kontainer sidebar
 * dan menampilkan ikon chevron yang berputar untuk menunjukkan keadaan terbuka/tertutup.
 *
 * @param {object} props - Properti komponen.
 * @param {boolean} props.isOpen - Apakah sidebar saat ini terbuka.
 * @param {Function} props.onClick - Fungsi callback yang akan dieksekusi saat tombol diklik.
 * @param {'left' | 'right'} [props.position='left'] - Menentukan di sisi mana dari sidebar tombol akan muncul.
 * @returns {JSX.Element} Komponen tombol toggle sidebar.
 */
const SidebarToggleButton = ({ isOpen, onClick, position = 'left' }) => {
    const tooltipContent = isOpen ? 'Sembunyikan' : 'Tampilkan';
    const positionClasses = {
        left: 'left-full',
        right: 'right-full',
    };
    const roundedClasses = {
        left: 'rounded-tr-xl rounded-br-xl',
        right: 'rounded-tl-xl rounded-bl-xl',
    };
    const borderClasses = {
        left: 'border-y border-r border-l-0',
        right: 'border-y border-l border-r-0',
    };

    return (
        <div
            className={`absolute top-1/2 -translate-y-1/2 ${positionClasses[position]} z-40`}
        >
            <Tooltip content={tooltipContent}>
                <div
                    onClick={onClick}
                    className={`
                        w-8 h-16 bg-white 
                        ${roundedClasses[position]} 
                        ${borderClasses[position]}
                        border-gray-100
                        shadow-md hover:shadow-lg
                        flex items-center justify-center cursor-pointer pointer-events-auto 
                        text-gray-400 hover:text-blue-600 transition-all duration-200
                    `}
                >
                    {position === 'left' ? (
                        isOpen ? <ChevronLeft size={20} /> : <ChevronRight size={20} />
                    ) : (
                        isOpen ? <ChevronRight size={20} /> : <ChevronLeft size={20} />
                    )}
                </div>
            </Tooltip>
        </div>
    );
};

export default SidebarToggleButton;
