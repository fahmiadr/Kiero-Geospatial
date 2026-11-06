import IndicatorIcon from './icons/MarkerIndicatorIcon';

/**
 * Komponen yang menampilkan indikator di tepi layar, menunjuk ke arah
 * penanda peta atau kluster penanda yang berada di luar layar. Komponen ini diposisikan
 * secara absolut dan dirotasi untuk menunjuk ke arah yang benar.
 *
 * @param {object} props - Properti komponen.
 * @param {number|null} props.top - Posisi atas (dalam piksel) untuk indikator.
 * @param {number|null} props.left - Posisi kiri (dalam piksel) untuk indikator.
 * @param {number} props.rotation - Sudut rotasi (dalam derajat) untuk menunjuk ke target di luar layar.
 * @param {number} props.count - Jumlah penanda yang diwakili oleh indikator ini; jika lebih dari 1, jumlahnya akan ditampilkan.
 * @param {Function} props.onClick - Fungsi callback yang akan dieksekusi saat indikator diklik.
 * @returns {JSX.Element|null} Elemen indikator di luar layar, atau null jika posisi tidak ditentukan.
 */
const OffscreenIndicator = ({ top, left, rotation, count, onClick }) => {
    if (top === null || left === null) {
        return null;
    }

    const containerStyle = {
        position: 'absolute',
        top: `${top}px`,
        left: `${left}px`,
        transform: 'translate(-50%, -50%)',
        zIndex: 15,
        cursor: 'pointer',
    };

    const groupRotationStyle = {
        transform: `rotate(${rotation}deg)`,
    };

    return (
        <div
            style={containerStyle}
            onClick={onClick}
            data-testid="offscreen-indicator"
        >
            <div className="relative w-9 h-9">
                <div style={groupRotationStyle} className="w-full h-full">
                    <IndicatorIcon />
                    {count > 1 && (
                        <span
                            className="absolute top-[37.5%] left-1/2 text-white text-xs font-bold"
                            style={{
                                transform: `translate(-50%, -50%) rotate(-${rotation}deg)`,
                                pointerEvents: 'none',
                            }}
                        >
                            {count}
                        </span>
                    )}
                </div>
            </div>
        </div>
    );
};

export default OffscreenIndicator;