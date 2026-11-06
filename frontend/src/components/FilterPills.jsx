import { useState } from 'react';
import {
    useFloating,
    useClick,
    useDismiss,
    useInteractions,
    FloatingPortal,
    offset
} from '@floating-ui/react';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import CustomSelectDropdown from './CustomSelectDropdown';
import DateRangePicker from './DateRangePicker';
import { CalendarRange, LayoutGrid } from 'lucide-react';

/**
 * Komponen yang me-render satu set "pil" filter (tombol) untuk kategori dan rentang tanggal.
 * Mengklik sebuah pil akan membuka popover (`FloatingPortal`) yang berisi kontrol filter yang sesuai
 * (`CustomSelectDropdown` untuk kategori, `DateRangePicker` untuk tanggal). State untuk popover
 * dikelola menggunakan pustaka `@floating-ui/react`.
 *
 * @param {object} props - Properti komponen.
 * @param {string|undefined} props.selectedCategory - ID kategori (`id`) yang saat ini dipilih.
 * @param {Function} props.onCategoryChange - Fungsi callback yang dipanggil saat pilihan kategori berubah.
 * @param {{startDate: Date, endDate: Date, key: string}} props.dateRange - Objek rentang tanggal saat ini.
 * @param {Function} props.onDateRangeChange - Fungsi callback yang dipanggil saat pilihan rentang tanggal berubah.
 * @returns {JSX.Element} Kumpulan pil filter.
 */
const FilterPills = ({
    selectedCategory,
    onCategoryChange,
    dateRange,
    onDateRangeChange,
    categoriesData,
    categoriesLoading,
    isMobile
}) => {
    const [isCategoryOpen, setIsCategoryOpen] = useState(false);
    const {
        refs: categoryRefs,
        floatingStyles: categoryFloatingStyles,
        context: categoryContext,
    } = useFloating({
        open: isCategoryOpen,
        onOpenChange: setIsCategoryOpen,
        middleware: [offset(5)],
        placement: 'bottom-start',
    });
    const categoryClick = useClick(categoryContext);
    const categoryDismiss = useDismiss(categoryContext);
    const {
        getReferenceProps: getCategoryReferenceProps,
        getFloatingProps: getCategoryFloatingProps,
    } = useInteractions([categoryClick, categoryDismiss]);

    const [isDateOpen, setIsDateOpen] = useState(false);
    const {
        refs: dateRefs,
        floatingStyles: dateFloatingStyles,
        context: dateContext,
    } = useFloating({
        open: isDateOpen,
        onOpenChange: setIsDateOpen,
        middleware: [offset(5)],
        placement: 'bottom-start',
    });
    const dateClick = useClick(dateContext);
    const dateDismiss = useDismiss(dateContext);
    const {
        getReferenceProps: getDateReferenceProps,
        getFloatingProps: getDateFloatingProps,
    } = useInteractions([dateClick, dateDismiss]);

    const categories = categoriesData || [];
    const loading = categoriesLoading;

    const categoryOptions = categories ? categories.map(cat => ({
        value: cat.id,
        name: `${cat.category_name}`
    })) : [];

    const handleCategoryChange = (e) => {
        onCategoryChange(e.target.value);
        setIsCategoryOpen(false);
    };

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

    const formattedDateRange = formatRange(dateRange.startDate, dateRange.endDate);
    const isDateDefault = !dateRange.startDate || !dateRange.endDate || (new Date().toDateString() === dateRange.endDate.toDateString() && new Date(new Date().setDate(new Date().getDate() - 30)).toDateString() === dateRange.startDate.toDateString());

    return (
        <div className="flex gap-2">
            {/* Category Filter */}
            <>
                <button
                    ref={categoryRefs.setReference}
                    {...getCategoryReferenceProps()}
                    className={`
                        flex items-center gap-1.5 px-3 py-1.5 rounded-full shadow-sm border text-xs font-medium transition-all duration-200
                        ${selectedCategory
                            ? 'bg-blue-600 text-white border-blue-600 hover:bg-blue-700 shadow-md'
                            : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50 hover:border-gray-300'
                        }
                    `}
                >
                    <LayoutGrid size={14} />
                    <span>{selectedCategory ? (categories.find(c => c.id === selectedCategory)?.category_name || 'Kategori Terpilih') : 'Semua Kategori'}</span>
                </button>
                <FloatingPortal>
                    {isCategoryOpen && (
                        <div
                            ref={categoryRefs.setFloating}
                            style={categoryFloatingStyles}
                            {...getCategoryFloatingProps()}
                            className="z-[100]"
                        >
                            <div className="p-2 bg-white rounded-xl shadow-xl border border-gray-100 animate-in fade-in zoom-in-95 duration-200">
                                <CustomSelectDropdown
                                    label="Kategori"
                                    value={selectedCategory}
                                    onChange={handleCategoryChange}
                                    options={categoryOptions}
                                    placeholder={loading ? "Memuat..." : "-- Pilih Kategori --"}
                                    disabled={loading}
                                    className="min-w-[200px] max-w-[200px]"
                                />
                            </div>
                        </div>
                    )}
                </FloatingPortal>
            </>

            {/* Date Range Filter */}
            <>
                <button
                    ref={dateRefs.setReference}
                    {...getDateReferenceProps()}
                    className={`
                        flex items-center gap-1.5 px-3 py-1.5 rounded-full shadow-sm border text-xs font-medium transition-all duration-200
                        ${!isDateDefault
                            ? 'bg-blue-600 text-white border-blue-600 hover:bg-blue-700 shadow-md'
                            : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50 hover:border-gray-300'
                        }
                     `}
                >
                    <CalendarRange size={14} />
                    <span>{isDateDefault ? '30 Hari Terakhir' : formattedDateRange}</span>
                </button>
                <FloatingPortal>
                    {isDateOpen && (
                        <div
                            ref={dateRefs.setFloating}
                            style={dateFloatingStyles}
                            {...getDateFloatingProps()}
                            className="z-[100]"
                        >
                            <DateRangePicker
                                dateRange={dateRange}
                                onDateRangeChange={onDateRangeChange}
                                isMobile={isMobile}
                            />
                        </div>
                    )}
                </FloatingPortal>
            </>
        </div>
    );
};

export default FilterPills;
