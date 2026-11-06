import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { DateRangePicker as ReactDateRangePicker } from 'react-date-range';
import 'react-date-range/dist/styles.css';
import 'react-date-range/dist/theme/default.css';
import { id } from 'date-fns/locale';
import { format, subDays, subMonths, subYears, startOfDay, endOfDay } from 'date-fns';

/**
 * Fungsi bantuan untuk menambah definisi rentang statis untuk `react-date-range`.
 * Fungsi ini menambahkan metode `isSelected` kustom ke setiap rentang, yang memungkinkan pustaka
 * untuk menyorot tombol rentang statis yang aktif dengan benar.
 *
 * @param {Array<object>} ranges - Array objek rentang statis.
 * @returns {Array<object>} Array rentang statis yang telah ditambah.
 */
const createStaticRanges = (ranges) => {
    return ranges.map(range => ({
        ...range,
        isSelected(dateRange) {
            const definedRange = this.range();
            return (
                startOfDay(definedRange.startDate).getTime() === startOfDay(dateRange.startDate).getTime() &&
                endOfDay(definedRange.endDate).getTime() === endOfDay(dateRange.endDate).getTime()
            );
        }
    }));
};

const staticRanges = createStaticRanges([
    { label: '1 Minggu Terakhir', range: () => ({ startDate: subDays(new Date(), 6), endDate: new Date() }) },
    { label: '2 Minggu Terakhir', range: () => ({ startDate: subDays(new Date(), 13), endDate: new Date() }) },
    { label: '3 Minggu Terakhir', range: () => ({ startDate: subDays(new Date(), 20), endDate: new Date() }) },
    { label: '1 Bulan Terakhir', range: () => ({ startDate: subMonths(new Date(), 1), endDate: new Date() }) },
    { label: '3 Bulan Terakhir', range: () => ({ startDate: subMonths(new Date(), 3), endDate: new Date() }) },
    { label: '6 Bulan Terakhir', range: () => ({ startDate: subMonths(new Date(), 6), endDate: new Date() }) },
    { label: '1 Tahun Terakhir', range: () => ({ startDate: subYears(new Date(), 1), endDate: new Date() }) },
    { label: '3 Tahun Terakhir', range: () => ({ startDate: subYears(new Date(), 3), endDate: new Date() }) },
    { label: '5 Tahun Terakhir', range: () => ({ startDate: subYears(new Date(), 5), endDate: new Date() }) },
]);

/**
 * Komponen pembungkus di sekitar pustaka `react-date-range` yang menyediakan antarmuka pengguna
 * pemilihan rentang tanggal yang lengkap. Komponen ini mencakup tombol yang menampilkan rentang yang
 * saat ini dipilih dan membuka popup kalender saat diklik. Popup di-render dalam React Portal
 * untuk menghindari terpotong oleh kontainer induk dengan `overflow: hidden`.
 *
 * @param {object} props - Properti komponen.
 * @param {{startDate: Date, endDate: Date, key: string}} props.dateRange - Objek state rentang tanggal saat ini.
 * @param {Function} props.onDateRangeChange - Fungsi callback yang dipanggil dengan objek rentang tanggal baru saat pengguna membuat pilihan.
 * @returns {JSX.Element} Komponen DateRangePicker.
 */
const DateRangePicker = ({ dateRange, onDateRangeChange, isMobile }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [popupPosition, setPopupPosition] = useState({ top: 0, left: 0 });
    const buttonRef = useRef(null);
    const popupRef = useRef(null);

    const formatRange = (start, end) => {
        if (!start || !end) return "";
        const startYear = start.getFullYear();
        const endYear = end.getFullYear();
        const startMonth = start.getMonth();
        const endMonth = end.getMonth();

        if (startYear === endYear && startMonth === endMonth) {
            return `${format(start, "d", { locale: id })} - ${format(end, "d MMM yyyy", { locale: id })}`;
        } else if (startYear === endYear) {
            return `${format(start, "d MMM", { locale: id })} - ${format(end, "d MMM yyyy", { locale: id })}`;
        }
        return `${format(start, "d MMM yyyy", { locale: id })} - ${format(end, "d MMM yyyy", { locale: id })}`;
    };

    const formattedDate = formatRange(dateRange.startDate, dateRange.endDate);

    const handleToggle = () => {
        if (!isOpen && buttonRef.current) {
            const rect = buttonRef.current.getBoundingClientRect();
            let left = rect.left + window.scrollX;

            // Check for overflow (assuming approx 600px width for 2 months + sidebar, or 350px for 1 month)
            const calendarWidth = isMobile ? 350 : 600;
            const viewportWidth = window.innerWidth;

            if (left + calendarWidth > viewportWidth) {
                // Shift left just enough to fit in the viewport with a small buffer
                left = viewportWidth - calendarWidth - 20;
            }

            // Ensure it doesn't go off-screen to the left
            if (left < 10) left = 10;

            setPopupPosition({
                top: rect.bottom + window.scrollY,
                left: left,
            });
        }
        setIsOpen(!isOpen);
    };

    useEffect(() => {
        function handleClickOutside(event) {
            if (
                isOpen &&
                popupRef.current && !popupRef.current.contains(event.target) &&
                buttonRef.current && !buttonRef.current.contains(event.target)
            ) {
                setIsOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, [isOpen]);

    const handleOnChange = (ranges) => {
        const { selection } = ranges;
        onDateRangeChange(selection);
    };

    const renderPopup = () => {
        if (!isOpen) return null;
        return createPortal(
            <div
                ref={popupRef}
                className={`fixed z-50 mt-1 w-auto bg-white shadow-lg rounded-md border border-gray-200 ${isMobile ? 'mobile-date-picker' : ''}`}
                style={{ top: `${popupPosition.top}px`, left: `${popupPosition.left}px` }}
            >
                {isMobile && (
                    <style>{`
                        .mobile-date-picker .rdrDefinedRangesWrapper {
                            display: none;
                        }
                    `}</style>
                )}
                <ReactDateRangePicker
                    editableDateInputs={true}
                    onChange={handleOnChange}
                    moveRangeOnFirstSelection={false}
                    ranges={[dateRange]}
                    locale={id}
                    months={isMobile ? 1 : 2}
                    direction="vertical"
                    staticRanges={isMobile ? [] : staticRanges}
                    inputRanges={isMobile ? [] : undefined}
                />
            </div>,
            document.body
        );
    };

    return (
        <div>
            <button
                ref={buttonRef}
                type="button"
                onClick={handleToggle}
                className={`
                    w-full pl-2.5 pr-8 py-1.5 text-left bg-white border border-gray-200 rounded-lg shadow-sm 
                    cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500 
                    text-xs text-gray-700 hover:border-blue-400 transition-all duration-200
                `}
            >
                <span className="truncate font-medium">{formattedDate}</span>
            </button>
            {renderPopup()}
        </div>
    );
};

export default DateRangePicker;
