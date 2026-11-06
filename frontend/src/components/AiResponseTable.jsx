import React, { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import AiMarkdownRenderer from './AiMarkdownRenderer';
import { Search, ArrowUpDown, X, Expand, FileQuestion, Table, SearchX } from 'lucide-react';

import Fuse from 'fuse.js';

// --- Highlight Component ---
const HighlightedText = ({ text, highlight }) => {
    if (!highlight || !text) return <>{text}</>;

    const tokens = highlight.split(/\s+/).filter(token => token.length > 1);
    if (tokens.length === 0) return <>{text}</>;

    const safeTokens = tokens.map(t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    const regex = new RegExp(`(${safeTokens.join('|')})`, 'gi');
    const parts = text.toString().split(regex);

    return (
        <span className="break-words">
            {parts.map((part, i) =>
                regex.test(part) ? (
                    <mark key={i} className="bg-yellow-200/80 text-yellow-900 rounded-[3px] px-0.5 box-decoration-clone">{part}</mark>
                ) : (
                    <span key={i}>{part}</span>
                )
            )}
        </span>
    );
};

const AiDataTableModal = ({ isOpen, onClose, data, columns, formatHeader, cleanStr }) => {
    const [inputValue, setInputValue] = useState('');
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        const timer = setTimeout(() => {
            setSearchTerm(inputValue.trim());
        }, 300);
        return () => clearTimeout(timer);
    }, [inputValue]);

    // Handle Escape key to close modal
    useEffect(() => {
        const handleEsc = (e) => {
            if (e.key === 'Escape') onClose();
        };
        if (isOpen) {
            window.addEventListener('keydown', handleEsc);
        }
        return () => window.removeEventListener('keydown', handleEsc);
    }, [isOpen, onClose]);

    const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });

    // Handle sort
    const handleSort = (key) => {
        let direction = 'asc';
        if (sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
    };

    // Filter and sort data
    const processedData = useMemo(() => {
        let result = [...data];

        // Search Filter (Industry Standard with Fuse.js)
        if (searchTerm) {
            // Ekstrak dan bersihkan data untuk diindex Fuse.js
            const fuseData = result.map(item => {
                const searchObj = {};
                columns.forEach(col => {
                    searchObj[col] = cleanStr(item[col]);
                });
                return { original: item, searchable: searchObj };
            });

            const fuse = new Fuse(fuseData, {
                keys: columns.map(col => `searchable.${col}`),
                threshold: 0.35, // 0.0 - 1.0 (0.35 sangat ideal untuk kompromi typo)
                ignoreLocation: true, // mengabaikan posisi huruf (bisa muncul dimana saja)
                minMatchCharLength: 2,
                includeScore: true
            });

            const searchResults = fuse.search(searchTerm);
            result = searchResults.map(res => res.item.original);
        }

        // Sort
        if (sortConfig.key) {
            result.sort((a, b) => {
                const valA = cleanStr(a[sortConfig.key]);
                const valB = cleanStr(b[sortConfig.key]);

                // Try numeric sort first
                const numA = Number(valA);
                const numB = Number(valB);

                if (!isNaN(numA) && !isNaN(numB)) {
                    return sortConfig.direction === 'asc' ? numA - numB : numB - numA;
                }

                // String sort
                if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
                if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
                return 0;
            });
        }

        return result;
    }, [data, columns, searchTerm, sortConfig]);

    if (!isOpen) return null;

    return createPortal(
        <div
            className="fixed inset-0 z-[99999] bg-gray-900/40 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6 animate-fade-in text-gray-800"
            onClick={(e) => {
                if (e.target === e.currentTarget) onClose();
            }}
        >
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-6xl h-[70vh] flex flex-col overflow-hidden animate-slide-up-sm border border-gray-200">
                {/* Header Modal */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gray-50/50">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-100 rounded-lg">
                            <Table className="w-5 h-5 text-blue-700" />
                        </div>
                        <div>
                            <h3 className="font-semibold text-gray-800 text-base">Detail Tabel Data</h3>
                            <p className="text-xs text-gray-500">Menampilkan {processedData.length} dari {data.length} total data</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-4">
                        {/* Search Input */}
                        <div className="relative group hidden sm:block">
                            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 group-focus-within:text-blue-500 transition-colors" />
                            <input
                                type="text"
                                placeholder="Cari data..."
                                value={inputValue}
                                onChange={(e) => setInputValue(e.target.value)}
                                className="pl-9 pr-8 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-white shadow-sm w-48 lg:w-72 transition-all placeholder:text-gray-400"
                            />
                            {inputValue && (
                                <button onClick={() => setInputValue('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors">
                                    <SearchX className="w-3.5 h-3.5" />
                                </button>
                            )}
                        </div>
                        <button
                            onClick={onClose}
                            className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* Mobile Search input (visible only on small screens) */}
                <div className="p-4 border-b border-gray-100 bg-white sm:hidden">
                    <div className="relative group">
                        <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 group-focus-within:text-blue-500 transition-colors" />
                        <input
                            type="text"
                            placeholder="Cari data..."
                            value={inputValue}
                            onChange={(e) => setInputValue(e.target.value)}
                            className="pl-9 pr-8 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-white shadow-sm w-full transition-all"
                        />
                        {inputValue && (
                            <button onClick={() => setInputValue('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors">
                                <SearchX className="w-3.5 h-3.5" />
                            </button>
                        )}
                    </div>
                </div>

                {/* Table Content */}
                <div className="flex-1 overflow-auto custom-scrollbar p-0 bg-white">
                    <table className="w-auto min-w-full text-sm text-left text-gray-600 border-separate border-spacing-0">
                        <thead className="sticky top-0 z-20 bg-gray-50 shadow-[0_1px_2px_rgba(0,0,0,0.05)]">
                            <tr>
                                <th className="px-5 py-3.5 font-bold text-gray-500 uppercase text-[11px] tracking-wider border-b border-gray-200 bg-gray-50/95 backdrop-blur w-10 text-center">No</th>
                                {columns.map((key) => (
                                    <th
                                        key={key}
                                        onClick={() => handleSort(key)}
                                        className="px-5 py-3.5 font-bold text-gray-600 uppercase text-[11px] tracking-wider whitespace-nowrap bg-gray-50/95 backdrop-blur border-b border-gray-200 cursor-pointer hover:bg-gray-100 transition-colors select-none group"
                                    >
                                        <div className="flex items-center gap-2">
                                            {formatHeader(key)}
                                            <ArrowUpDown className={`w-3.5 h-3.5 transition-colors ${sortConfig.key === key ? 'text-blue-600' : 'text-gray-300 group-hover:text-gray-500'}`} />
                                        </div>
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {processedData.length === 0 ? (
                                <tr>
                                    <td colSpan={columns.length + 1} className="px-6 py-16 text-center">
                                        <div className="flex flex-col items-center justify-center gap-3">
                                            <div className="p-3 bg-gray-50 rounded-full">
                                                <FileQuestion className="w-6 h-6 text-gray-400" />
                                            </div>
                                            <p className="text-gray-500 text-sm font-medium">Data "{searchTerm}" tidak ditemukan.</p>
                                            <p className="text-gray-400 text-xs">Coba gunakan kata kunci yang berbeda.</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                processedData.map((item, index) => (
                                    <tr key={index} className="bg-white even:bg-gray-50/50 hover:bg-blue-50/50 transition-colors group">
                                        <td className="px-5 py-3.5 whitespace-nowrap border-b border-gray-50 group-last:border-b-0 text-center text-gray-400 font-medium text-xs align-top pt-4">
                                            {index + 1}
                                        </td>
                                        {columns.map((key) => {
                                            let content = cleanStr(item[key]);
                                            if (key.toLowerCase() === 'complaint' && content.includes('|')) {
                                                content = content.split('|')[1] || content;
                                            }

                                            // Truncate logic > 100 characters
                                            const displayContent = content && content.length > 100
                                                ? content.substring(0, 100) + '...'
                                                : content;

                                            return (
                                                <td key={key} className="px-5 py-3.5 border-b border-gray-50 group-last:border-b-0 align-top">
                                                    <div className="w-max max-w-[300px] whitespace-normal break-words font-medium text-gray-700 leading-relaxed" title={content.length > 100 ? content : undefined}>
                                                        <HighlightedText text={displayContent || '-'} highlight={searchTerm} />
                                                    </div>
                                                </td>
                                            );
                                        })}
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>,
        document.body
    );
};
const AiResponseTable = ({ analysis_summary, data }) => {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const hasTableData = data && data.length > 0;

    const cleanStr = (str) => {
        if (str === null || str === undefined) return '';
        return String(str).replace(/\{\{|}}/g, '');
    };

    const formatHeader = (key) => {
        return key.replace(/_/g, ' ').toUpperCase();
    };

    const columns = hasTableData ? Object.keys(data[0]) : [];

    // Default mode shows max 5 rows
    const MAX_PREVIEW_ROWS = 5;
    const isLargeData = hasTableData && data.length > MAX_PREVIEW_ROWS;
    const isExpandable = hasTableData; // Always true as long as there is data
    const previewData = hasTableData ? data.slice(0, MAX_PREVIEW_ROWS) : [];

    return (
        <div className="flex flex-col gap-3 w-full min-w-0">
            {analysis_summary && (
                <div className="bg-gradient-to-br from-blue-50/50 to-indigo-50/30 border border-blue-100/50 rounded-xl p-3.5 shadow-sm">
                    <AiMarkdownRenderer
                        content={analysis_summary}
                        className="text-gray-800 text-[13px] leading-relaxed"
                    />
                </div>
            )}

            {hasTableData && (
                <div className="space-y-2">
                    <div className="overflow-x-auto max-w-full overflow-y-auto max-h-[350px] border border-gray-200 rounded-xl shadow-sm bg-white custom-scrollbar relative">
                        <table className="w-auto min-w-full text-[13px] text-left text-gray-600 border-separate border-spacing-0">
                            <thead className="sticky top-0 z-10 shadow-sm">
                                <tr>
                                    {columns.map((key) => (
                                        <th
                                            key={key}
                                            scope="col"
                                            className="px-4 py-3 font-bold text-gray-500 uppercase text-[10px] tracking-wider whitespace-nowrap bg-gray-100 border-b border-gray-200"
                                        >
                                            {formatHeader(key)}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {previewData.map((item, index) => (
                                    <tr key={index} className="bg-white even:bg-gray-50/60 hover:bg-blue-50/30 transition-colors group">
                                        {columns.map((key) => {
                                            let content = cleanStr(item[key]);
                                            if (key.toLowerCase() === 'complaint' && content.includes('|')) {
                                                content = content.split('|')[1] || content;
                                            }
                                            return (
                                                <td key={key} className="px-4 py-3 border-b border-transparent group-last:border-b-0 max-w-[150px] truncate">
                                                    <span className="font-medium text-gray-800" title={content}>
                                                        {content || '-'}
                                                    </span>
                                                </td>
                                            );
                                        })}
                                    </tr>
                                ))}
                            </tbody>
                        </table>

                        {/* Masking & Overlay Button Modern */}
                        {isExpandable && (
                            <div className="sticky bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-white via-white/95 to-transparent flex items-end justify-center pb-5 pointer-events-none">
                                <button
                                    onClick={() => setIsModalOpen(true)}
                                    className="pointer-events-auto group flex items-center gap-2 px-5 py-2.5 bg-white border border-gray-200/80 shadow-[0_8px_20px_-4px_rgba(0,0,0,0.1)] hover:shadow-[0_8px_25px_-4px_rgba(0,0,0,0.15)] rounded-full text-[12px] font-bold text-gray-700 transition-all hover:-translate-y-0.5 active:translate-y-0 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                                    type="button"
                                >
                                    <Expand className="w-3.5 h-3.5 text-blue-600 group-hover:scale-110 transition-transform" />
                                    Lihat Seluruh Data
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Dinamis Footer */}
                    <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-100/60">
                        <div className="px-1 text-[11px] text-gray-400 flex items-center gap-1.5 whitespace-nowrap">
                            <Table size={14} className="opacity-70" />
                            <span>
                                {isLargeData
                                    ? `Cuplikan sebagian data (Total ${data.length} baris)`
                                    : `Total ${data.length} baris`}
                            </span>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal - Dipisahkan jika diperlukan state tersendiri */}
            <AiDataTableModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                data={data}
                columns={columns}
                formatHeader={formatHeader}
                cleanStr={cleanStr}
            />
        </div>
    );
};

export default React.memo(AiResponseTable);
