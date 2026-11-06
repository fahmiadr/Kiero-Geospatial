import { useState } from 'react';
import { useRegionStats } from '../hooks/useRegionStats';
import { getStatusColorHsl } from '../utils/statusColors';
import { Table } from 'lucide-react';
import StatisticsCanvas from './StatisticsCanvas';

/**
 * Komponen yang menampilkan ringkasan statistik tiket untuk wilayah dan rentang tanggal tertentu.
 * Komponen ini mengambil data menggunakan hook `useRegionStats` dan menampilkan total tiket
 * serta jumlah berdasarkan status (open, pending, closed). Juga terdapat tombol untuk
 * menampilkan atau menyembunyikan komponen `StatisticsCanvas` yang lebih detail.
 *
 * @param {object} props - Properti komponen.
 * @param {string} props.regionCode - Kode hierarkis wilayah yang statistiknya akan ditampilkan.
 * @param {{startDate: Date, endDate: Date}} props.dateRange - Rentang tanggal untuk memfilter statistik.
 * @param {number|null} [props.categoryId] - ID kategori untuk memfilter tiket.
 * @returns {JSX.Element|null} Komponen statistik, atau null jika tidak ada data.
 */
const Statistics = ({ regionCode, dateRange, categoryId }) => {
    const [isDetailsVisible, setIsDetailsVisible] = useState(false);
    const { data: stats, isLoading, isError } = useRegionStats(regionCode, dateRange, categoryId);

    if (isLoading) {
        return (
            <div className="p-4 border-t border-gray-200">
                <div className="h-6 bg-gray-200 rounded w-1/3 mb-4"></div>
                <div className="h-24 bg-gray-200 rounded"></div>
                <div className="h-10 bg-gray-200 rounded w-full mt-4"></div>
            </div>
        );
    }

    if (isError) return <div className="text-center p-4 text-red-500">Error loading statistics.</div>;
    if (!stats) return null;

    const { total, ...statusCounts } = stats;
    const statusKeys = Object.keys(statusCounts).filter(key => typeof statusCounts[key] === 'number');

    return (
        <>
            <h4 className="text-sm font-bold uppercase tracking-wider text-gray-500 mb-3">Ringkasan Tiket</h4>

            <div className="mb-4 text-center p-4 bg-white rounded-xl shadow-sm border border-gray-100">
                <p className="text-4xl font-bold text-gray-800">{total}</p>
                <p className="text-xs font-medium text-gray-500 mt-1 uppercase tracking-wide">Total Tiket</p>
            </div>

            <div className="grid grid-cols-3 gap-3 text-center">
                {statusKeys.map((statusName) => (
                    <div key={statusName} className="p-3 bg-white rounded-xl shadow-sm border border-gray-100 flex flex-col items-center justify-center">
                        <p className="text-xl font-bold" style={{ color: getStatusColorHsl(statusName) }}>
                            {statusCounts[statusName]}
                        </p>
                        <p className="text-[10px] font-semibold text-gray-400 uppercase mt-1">{statusName}</p>
                    </div>
                ))}
            </div>

            <div className="mt-4">
                <button
                    onClick={() => setIsDetailsVisible(prev => !prev)}
                    className={`w-full flex items-center justify-center gap-2 px-4 py-2 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-offset-2 transition-colors
                            ${isDetailsVisible
                            ? 'bg-gray-500 hover:bg-gray-600 focus:ring-gray-500'
                            : 'bg-teal-500 hover:bg-teal-600 focus:ring-teal-500'}
                        `}
                >
                    <Table size={20} />
                    <span>{isDetailsVisible ? 'Sembunyikan Detail Visual' : 'Lihat Detail Visual'}</span>
                </button>
            </div>

            <StatisticsCanvas
                isEnabled={isDetailsVisible}
                regionCode={regionCode}
                dateRange={dateRange}
                categoryId={categoryId}
            />
        </>
    );
};

export default Statistics;
