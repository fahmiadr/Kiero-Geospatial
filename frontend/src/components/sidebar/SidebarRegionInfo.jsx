import React, { useState, useRef } from 'react';
import TabButton from '../TabButton';
import Statistics from '../Statistics';
import Tooltip from '../Tooltip';
import { Share2, Check, AlertCircle } from 'lucide-react';
import { stringToHslColor } from '../../utils/mapUtils';



const SidebarRegionInfo = ({
    isMobile,
    regionData,
    activeRegionInfoTab,
    setActiveRegionInfoTab,
    dateRange,
    categoryId
}) => {
    const [isCopied, setIsCopied] = useState(false);
    const [copyError, setCopyError] = useState(false);
    const copyTimeoutRef = useRef(null);

    const headerColor = regionData?.properties?.nama ? stringToHslColor(regionData.properties.nama) : 'white';

    const getRegionCodeForStats = () => {
        if (!regionData) return null;
        const { properties, level } = regionData;
        switch (level) {
            case 'provinsi': return properties.kode_prov;
            case 'kabkota': return properties.kode_kab;
            case 'kecamatan': return properties.kode_kec;
            case 'desa': return `${properties.kode_kec}-${properties.nama}`;
            default: return null;
        }
    };

    const getTipeAdmin = (tipe_adm) => ({ '1': 'Desa', '2': 'Kelurahan', '4': 'Kabupaten', '5': 'Kota' }[String(tipe_adm)] || 'Lainnya');
    const formatArea = (area) => !area || isNaN(Number(area)) ? 'N/A' : `${Number(area).toFixed(2)} Ha`;

    const resetCopyStatus = () => {
        setIsCopied(false);
        setCopyError(false);
        if (copyTimeoutRef.current) {
            clearTimeout(copyTimeoutRef.current);
            copyTimeoutRef.current = null;
        }
    };

    const handleShare = () => {
        resetCopyStatus();
        const url = window.location.href;
        try {
            const tempInput = document.createElement('textarea');
            tempInput.value = url;
            tempInput.style.position = 'absolute';
            tempInput.style.left = '-9999px';
            document.body.appendChild(tempInput);
            tempInput.select();
            document.execCommand('copy');
            document.body.removeChild(tempInput);
            setIsCopied(true);
            copyTimeoutRef.current = setTimeout(resetCopyStatus, 2000);
        } catch {
            setCopyError(true);
            copyTimeoutRef.current = setTimeout(resetCopyStatus, 2000);
        }
    };

    if (!regionData) return null;

    const { properties, level } = regionData;
    let title, subTitle;
    const rows = [];

    switch (level) {
        case 'negara': title = properties.name; subTitle = 'Negara'; break;
        case 'provinsi':
            title = properties.nama; subTitle = 'Provinsi';
            rows.push({ label: 'Kode Provinsi', value: properties.kode_prov });
            rows.push({ label: 'Jumlah Kab/Kota', value: properties.jumlahKabKota });
            break;
        case 'kabkota':
            title = properties.nama; subTitle = getTipeAdmin(properties.tipe_adm);
            rows.push({ label: 'Provinsi', value: properties.provinsi });
            rows.push({ label: 'Kode Kab/Kota', value: properties.kode_kab });
            rows.push({ label: 'Jumlah Kecamatan', value: properties.jumlahKecamatan });
            rows.push({ label: 'Luas', value: formatArea(properties.luas) });
            break;
        case 'kecamatan':
            title = properties.nama; subTitle = 'Kecamatan';
            rows.push({ label: 'Kab/Kota', value: properties.kabkota });
            rows.push({ label: 'Provinsi', value: properties.provinsi });
            rows.push({ label: 'Kode Kecamatan', value: properties.kode_kec });
            rows.push({ label: 'Jumlah Desa', value: properties.jumlahDesa });
            break;
        case 'desa':
            title = properties.nama; subTitle = getTipeAdmin(properties.tipe_adm);
            rows.push({ label: 'Kecamatan', value: properties.kecamatan });
            rows.push({ label: 'Kab/Kota', value: properties.kabkota });
            rows.push({ label: 'Provinsi', value: properties.provinsi });
            rows.push({ label: 'Luas', value: formatArea(properties.luas) });
            break;
    }

    return (
        <>
            <div style={{ backgroundColor: headerColor }} className="p-4 text-white relative">
                <div className={isMobile ? "mt-2" : "mt-4 pt-36"}>
                    <h3 className="text-2xl font-bold truncate">{title}</h3>
                    <p className="text-lg opacity-90">{subTitle}</p>
                </div>
            </div>

            {/* Tabs */}
            <div className="border-b border-gray-200 bg-white">
                <div className="flex">
                    <TabButton text="Statistik Ticket" isActive={activeRegionInfoTab === 'stats'} onClick={() => setActiveRegionInfoTab('stats')} />
                    <TabButton text="Informasi Region" isActive={activeRegionInfoTab === 'info'} onClick={() => setActiveRegionInfoTab('info')} />
                </div>
            </div>

            <div className="bg-white p-4 overflow-y-auto custom-scrollbar flex-grow">
                {activeRegionInfoTab === 'stats' && (
                    <Statistics regionCode={getRegionCodeForStats()} dateRange={dateRange} categoryId={categoryId} />
                )}
                {activeRegionInfoTab === 'info' && (
                    <ul className="divide-y divide-gray-200">
                        {rows.map(row => (
                            <li key={row.label} className="py-2 flex justify-between items-center text-sm">
                                <span className="text-gray-600">{row.label}</span>
                                <strong className="text-gray-800 text-right">{row.value ?? 'N/A'}</strong>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
            <div className="p-2 border-t border-gray-200 bg-gray-50">
                <div className="flex items-center justify-end gap-1">
                    <Tooltip content="Salin URL Peta">
                        <button
                            onClick={handleShare}
                            className={`p-2 rounded-md focus:outline-none active:bg-gray-300 transition-all duration-200 ${isCopied
                                ? 'bg-green-100 text-green-700 hover:bg-green-200'
                                : copyError
                                    ? 'bg-red-100 text-red-700 hover:bg-red-200'
                                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200 hover:text-gray-900'
                                }`}
                            aria-label="Bagikan"
                        >
                            {isCopied ? <Check size={20} /> : copyError ? <AlertCircle size={20} /> : <Share2 size={20} />}
                        </button>
                    </Tooltip>
                </div>
            </div>
        </>
    );
};

export default SidebarRegionInfo;
