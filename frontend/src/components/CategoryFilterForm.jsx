import { useCategoryData } from '../hooks/useCategoryData';

/**
 * Komponen dropdown pilihan generik dengan sebuah label.
 *
 * @param {object} props - Properti komponen.
 * @param {string} props.label - Label teks untuk ditampilkan di atas dropdown.
 * @param {string} props.placeholder - Teks placeholder untuk ditampilkan pada opsi default.
 * @param {boolean} [props.disabled=false] - Apakah dropdown harus dinonaktifkan.
 * @param {Array<{value: string, name: string}>} props.options - Array opsi untuk mengisi dropdown.
 * @param {string|undefined} props.value - Nilai yang saat ini dipilih.
 * @param {Function} props.onChange - Fungsi callback yang akan dieksekusi saat pilihan berubah.
 * @returns {JSX.Element} Elemen dropdown pilihan yang telah ditata.
 */
const SelectDropdown = ({ label, placeholder, disabled = false, options, value, onChange }) => {
    const selectId = `select-form-${label.replace(/\s+/g, '-')}`;
    return (
        <div className="flex-1 min-w-[200px]">
            <label htmlFor={selectId} className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
            <select
                id={selectId}
                disabled={disabled}
                value={value || ""}
                onChange={onChange}
                className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
            >
                <option value="">{placeholder}</option>
                {options.filter(item => item && item.name).sort((a, b) => a.name.localeCompare(b.name)).map((opt, index) => (
                    <option key={`${opt.value}-${index}`} value={opt.value}>
                        {opt.name}
                    </option>
                ))}
            </select>
        </div>
    );
};

/**
 * Komponen form yang memungkinkan pengguna untuk memfilter tiket berdasarkan kategori.
 * Menggunakan hook `useCategoryData` untuk mengambil daftar kategori yang tersedia
 * dan menampilkannya dalam sebuah `SelectDropdown`.
 *
 * @param {object} props - Properti komponen.
 * @param {string|undefined} props.currentSelection - `category_id` dari kategori yang saat ini dipilih.
 * @param {Function} props.onSelectionChange - Fungsi callback yang dipanggil dengan `category_id` baru saat pengguna memilih kategori yang berbeda.
 * @returns {JSX.Element} Komponen form filter kategori.
 */
const CategoryFilterForm = ({ currentSelection, onSelectionChange }) => {
    const { data: categoryData, loading: categoryLoading } = useCategoryData();

    const handleCategoryChange = (e) => {
        const categoryId = e.target.value;
        onSelectionChange(categoryId || undefined);
    };

    const categoryOptions = categoryData.map(c => ({ value: c.id, name: c.category_name }));

    return (
        <div className="w-full bg-white p-6 rounded-lg shadow-md mb-8">
            <h2 className="text-xl font-bold text-gray-800 mb-4">Filter Tiket</h2>
            <div className="flex flex-wrap gap-4">
                <SelectDropdown 
                    label="category_id" 
                    value={currentSelection} 
                    onChange={handleCategoryChange} 
                    options={categoryOptions} 
                    placeholder={categoryLoading ? "Memuat..." : "-- Pilih category_id --"} 
                    disabled={categoryLoading} 
                />
            </div>
        </div>
    );
};

export default CategoryFilterForm;
