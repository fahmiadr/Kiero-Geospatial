import React from 'react';
import Tooltip from '../Tooltip';
import { Trash2, Locate } from 'lucide-react';

const SidebarHistory = ({
    isMobile,
    pins,
    onGoToPin,
    onDeletePin
}) => {
    return (
        <>
            <div className={`p-4 border-b flex justify-between items-center ${isMobile ? 'pt-4' : 'pt-20'}`}>
                <h2 className="text-lg font-bold text-gray-800">Riwayat 5 pin terakhir</h2>
            </div>
            <div className="flex-grow p-2.5 overflow-y-auto custom-scrollbar space-y-2.5 bg-gray-50/50">
                {pins.length === 0 ? (
                    <p className="text-sm mt-2 mb-2 text-gray-500 italic text-center">
                        Belum ada pin yang disimpan.
                    </p>
                ) : (
                    [...pins].reverse().map((pin) => (
                        <div
                            key={pin.id}
                            className="bg-white border border-gray-200/80 rounded-lg p-3 shadow-sm flex flex-col gap-2 transition-shadow hover:shadow-md"
                        >
                            <Tooltip content={pin.title} >
                                <span className="font-semibold text-gray-800 text-sm truncate">
                                    {pin.title}
                                </span>
                            </Tooltip>
                            <div className="flex items-center justify-between mt-1">
                                <button
                                    onClick={() => onGoToPin(pin)}
                                    className="text-xs inline-flex items-center gap-1.5 px-3 py-1 bg-blue-50 text-blue-700 font-medium rounded-md hover:bg-blue-100"
                                >
                                    <Locate size={14} />
                                    Lihat di Peta
                                </button>
                                <Tooltip content='Hapus Pin' >
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onDeletePin(pin.id);
                                        }}
                                        className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-full"
                                        aria-label={`Hapus ${pin.title}`}
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </Tooltip>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </>
    );
};

export default SidebarHistory;
