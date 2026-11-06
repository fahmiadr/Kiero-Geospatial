import React, { useRef, useEffect, useCallback } from 'react';
import AiResponseTable from '../AiResponseTable';
import AiMarkdownRenderer from '../AiMarkdownRenderer';
import { useGeoAi } from '../../hooks/useGeoAi';
import { ThumbsUp, ThumbsDown, CheckCircle2, MessageSquare, History, PlusSquare, Send, Trash2 } from 'lucide-react';
import Tooltip from '../Tooltip';
import { cleanRegionName } from '../../utils/mapUtils';

const AiMessageFeedback = ({ messageId, requestId, hasFeedback, savedRating, onSubmit }) => {
    const [selectedRating, setSelectedRating] = React.useState(null);
    const [comment, setComment] = React.useState("");
    const [isSubmitted, setIsSubmitted] = React.useState(false);
    const [showThanksToast, setShowThanksToast] = React.useState(false);

    // If the message already has feedback from store, set submitted state
    React.useEffect(() => {
        if (hasFeedback) {
            setIsSubmitted(true);
        }
    }, [hasFeedback]);

    const handleFeedbackSubmit = () => {
        onSubmit(messageId, requestId, selectedRating, comment);

        // Show local state as submitted to lock UI immediately, hide popover
        setIsSubmitted(true);
        setSelectedRating(null);

        // Trigger thanks toast
        setShowThanksToast(true);
        setTimeout(() => {
            setShowThanksToast(false);
        }, 3000); // Auto-dismiss after 3 secs
    };

    // --- State: Locked/Completed UI ---
    if (isSubmitted) {
        // Use saved rating if available, otherwise fallback to local selectedRating
        const currentRating = savedRating !== undefined ? savedRating : selectedRating;

        return (
            <div className="relative flex items-center mt-2 ml-1">
                {/* Visual indicator of completion. Highlights the chosen rating. */}
                <div className="flex items-center gap-1 cursor-not-allowed">
                    <div className={`p-1.5 transition-all ${currentRating === 1 ? 'text-blue-600 bg-blue-50 ring-1 ring-blue-100 rounded-md shadow-sm opacity-90' : 'text-gray-500 opacity-50'}`}>
                        <ThumbsUp className={`w-4 h-4 ${currentRating === 1 ? 'fill-blue-100/50' : ''}`} />
                    </div>
                    <div className={`p-1.5 transition-all ${currentRating === -1 ? 'text-red-700 bg-red-50 ring-1 ring-red-100 rounded-md shadow-sm opacity-90' : 'text-gray-500 opacity-50'}`}>
                        <ThumbsDown className={`w-4 h-4 ${currentRating === -1 ? 'fill-red-100/50' : ''}`} />
                    </div>
                </div>

                {/* Auto-dismissing Toast */}
                {showThanksToast && (
                    <div className="absolute left-full ml-3 flex items-center gap-1.5 text-[11px] text-green-700 font-medium bg-green-50/90 border border-green-200/50 px-2.5 py-1.5 rounded-full whitespace-nowrap animate-fade-in-up shadow-sm">
                        <CheckCircle2 className="w-3.5 h-3.5 text-green-600" />
                        Terima kasih atas tanggapan Anda
                    </div>
                )}
            </div>
        );
    }

    // --- State: Comment Popover ---
    if (selectedRating !== null) {
        return (
            <div className="mt-2 ml-1 p-3 bg-white border border-gray-200 shadow-sm rounded-xl text-sm min-w-[280px] max-w-sm animate-fade-in">
                <div className="flex items-center justify-between mb-2">
                    <p className="text-gray-800 font-medium text-xs flex items-center gap-1.5">
                        {selectedRating === 1 ? (
                            <span className="flex items-center gap-1.5 text-blue-700 font-semibold bg-blue-50 px-2 py-0.5 rounded-md">
                                <ThumbsUp className="w-4 h-4" />
                                Membantu
                            </span>
                        ) : (
                            <span className="flex items-center gap-1.5 text-red-700 font-semibold bg-red-50 px-2 py-0.5 rounded-md">
                                <ThumbsDown className="w-4 h-4" />
                                Tidak Membantu
                            </span>
                        )}
                        <span className="text-gray-500 font-normal ml-1 border-l pl-2 border-gray-200">Komentar (Opsional)</span>
                    </p>
                </div>
                <textarea
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    placeholder="Beri tahu kami apa yang bisa kami tingkatkan..."
                    className="w-full text-xs p-2.5 bg-gray-50 border border-gray-200 rounded-lg mb-2 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all custom-scrollbar"
                    rows={2}
                    autoFocus
                />
                <div className="flex gap-2 justify-end">
                    <button
                        onClick={() => setSelectedRating(null)}
                        className="px-3 py-1.5 text-xs font-medium text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-md transition-colors"
                    >
                        Batal
                    </button>
                    <button
                        onClick={handleFeedbackSubmit}
                        className="px-3 py-1.5 text-xs font-medium bg-blue-600 text-white rounded-md hover:bg-blue-700 shadow-sm transition-colors flex items-center gap-1"
                    >
                        <Send className="w-3.5 h-3.5" />
                        Kirim
                    </button>
                </div>
            </div>
        );
    }

    // --- State: Standby (Initial) ---
    return (
        <div className="flex items-center gap-1 mt-2 ml-1 opacity-70 hover:opacity-100 transition-opacity duration-200">
            <Tooltip content="Membantu">
                <button
                    onClick={() => setSelectedRating(1)}
                    className="p-1.5 text-gray-500 hover:text-blue-700 hover:bg-blue-100/80 hover:border-blue-200 rounded-md border border-transparent transition-all shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                >
                    <ThumbsUp className="w-4 h-4" />
                </button>
            </Tooltip>
            <Tooltip content="Tidak membantu">
                <button
                    onClick={() => setSelectedRating(-1)}
                    className="p-1.5 text-gray-500 hover:text-red-700 hover:bg-red-100/80 hover:border-red-200 rounded-md border border-transparent transition-all shadow-sm focus:outline-none focus:ring-2 focus:ring-red-500/30"
                >
                    <ThumbsDown className="w-4 h-4" />
                </button>
            </Tooltip>
        </div>
    );
};

const SidebarGeoAi = ({ isMobile, onRegionAutoSelect }) => {
    const handleAiResponse = useCallback((data) => {
        if (data.region && onRegionAutoSelect) {
            const cleanedRegion = cleanRegionName(data.region);
            if (cleanedRegion) {
                onRegionAutoSelect(cleanedRegion);
            }
        }
    }, [onRegionAutoSelect]);

    const {
        aiInput,
        setAiInput,
        aiMessages,
        isAiLoading,
        handleAiSubmitContinue,
        handleAiSubmitNew,
        sessions,
        currentSessionId,
        createNewSession,
        switchSession,
        deleteSession,
        handleFeedback
    } = useGeoAi({ onResponse: handleAiResponse });

    const handleFormSubmit = (e) => {
        if (e) e.preventDefault();
        if (showHistory) {
            handleAiSubmitNew(e);
        } else {
            handleAiSubmitContinue(e);
        }
    };

    const [showHistory, setShowHistory] = React.useState(false);
    const messagesEndRef = useRef(null);
    const textareaRef = useRef(null);

    // Auto-scroll to bottom when messages change
    useEffect(() => {
        if (!showHistory && messagesEndRef.current) {
            messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [aiMessages, isAiLoading, showHistory]);

    // Kembalikan tinggi textarea ke default saat input dibersihkan (setelah dikirim)
    useEffect(() => {
        if (aiInput === '' && textareaRef.current) {
            textareaRef.current.style.height = 'auto';
        }
    }, [aiInput]);

    // Format date helper
    const formatDate = (timestamp) => {
        return new Date(timestamp).toLocaleDateString('id-ID', {
            day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
        });
    };

    return (
        <>
            {/* Header - Centered Horizontal with Actions */}
            <div className={`p-4 border-b bg-gradient-to-r from-blue-600 to-purple-600 text-white shrink-0`}>
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
                            <MessageSquare className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold">Geo AI Assistant</h2>
                            <p className="text-xs text-white/90 font-medium tracking-wide">
                                {showHistory ? "Riwayat Percakapan" : "Tanya tentang wilayah"}
                            </p>
                        </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center gap-1.5">
                        <Tooltip content="Riwayat Chat">
                            <button
                                onClick={() => setShowHistory(!showHistory)}
                                className={`p-2 rounded-full transition-all ${showHistory ? 'bg-white text-blue-600 shadow-sm' : 'bg-white/10 hover:bg-white/20 text-white'}`}
                            >
                                <History className="w-4 h-4" />
                            </button>
                        </Tooltip>
                        <Tooltip content="Chat Baru">
                            <button
                                onClick={() => {
                                    if (aiMessages.length > 0) {
                                        createNewSession();
                                        setShowHistory(false);
                                    }
                                }}
                                disabled={aiMessages.length === 0}
                                className={`p-2 rounded-full transition-all ${aiMessages.length === 0
                                    ? 'bg-white/5 text-white/30 cursor-not-allowed'
                                    : 'bg-white/10 hover:bg-white/20 text-white shadow-sm'
                                    }`}
                            >
                                <PlusSquare className="w-4 h-4" />
                            </button>
                        </Tooltip>
                    </div>
                </div>
            </div>

            {/* Content Area */}
            {showHistory ? (
                /* History List */
                <div className="flex-grow overflow-y-auto custom-scrollbar p-4 space-y-3 bg-gray-50/50">
                    {sessions.length === 0 ? (
                        <div className="text-center py-10 text-gray-500">
                            Belum ada riwayat percakapan.
                        </div>
                    ) : (
                        sessions.map((session) => (
                            <div
                                key={session.id}
                                onClick={() => {
                                    switchSession(session.id);
                                    setShowHistory(false);
                                }}
                                className={`p-3 rounded-lg border cursor-pointer transition-all hover:shadow-md ${currentSessionId === session.id
                                    ? 'bg-blue-50 border-blue-200 ring-1 ring-blue-300'
                                    : 'bg-white border-gray-200 hover:border-blue-200'
                                    }`}
                            >
                                <div className="flex justify-between items-start mb-1">
                                    <div className="flex items-center gap-2">
                                        <h3 className={`font-medium text-sm line-clamp-1 ${currentSessionId === session.id ? 'text-blue-700' : 'text-gray-800'
                                            }`}>
                                            {session.title || 'Percakapan Baru'}
                                        </h3>
                                        {/* Unread Message Indicator (Tampil ketika ada respons AI background yang belum dilihat) */}
                                        {session.hasUnread && (
                                            <span className="flex h-2.5 w-2.5">
                                                <span className="animate-ping absolute inline-flex h-2 w-2 rounded-full bg-blue-400 opacity-75"></span>
                                                <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
                                            </span>
                                        )}
                                    </div>
                                    <Tooltip content="Hapus chat">
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                deleteSession(session.id);
                                            }}
                                            className="text-gray-400 hover:text-red-500 p-1 -mt-1 -mr-1 rounded-full hover:bg-red-50 transition-colors"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </Tooltip>
                                </div>
                                <p className="text-xs text-gray-500">
                                    {formatDate(session.updatedAt)} • {session.messages.length} pesan
                                </p>
                            </div>
                        ))
                    )}
                </div>
            ) : (
                /* Chat Messages Area */
                <div className="flex-grow overflow-y-auto custom-scrollbar p-4 space-y-4 bg-gray-50/50">
                    {aiMessages.length === 0 ? (
                        <div className="text-center py-8">
                            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-blue-100 flex items-center justify-center shadow-inner">
                                <MessageSquare className="w-8 h-8 text-blue-600" />
                            </div>
                            <h3 className="text-gray-800 font-semibold mb-2">Halo! Saya Geo AI</h3>
                            <p className="text-sm text-gray-500 max-w-xs mx-auto">
                                Tanya apa saja tentang data wilayah.
                            </p>
                        </div>
                    ) : (
                        aiMessages.map((msg, idx) => {
                            // 1. Cek Status Error (Support struktur nested 'answer' maupun root)
                            const isErrorState =
                                msg.status === 'error' ||
                                msg?.answer?.status === 'error' ||
                                msg.isError;

                            // 2. Tentukan Pesan yang Ditampilkan
                            // PENTING: Jika error, kita PAKSA ambil pesan errornya, abaikan msg.content lama.
                            let displayContent = msg.content;

                            if (isErrorState) {
                                displayContent = msg?.answer?.message || msg.message || "Terjadi kesalahan pada data.";
                            }

                            return (
                                <div
                                    key={idx}
                                    className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} group mb-1 min-w-0`}
                                >
                                    <div className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'} max-w-[95%] sm:max-w-[90%] min-w-0`}>
                                        <div
                                            className={`rounded-2xl px-4 py-3 w-full overflow-hidden ${msg.role === 'user'
                                                ? 'bg-blue-600 text-white rounded-br-md shadow-sm'
                                                : isErrorState
                                                    ? 'bg-red-50 text-red-700 border border-red-200 rounded-bl-md' // Style Merah jika Error
                                                    : 'bg-white text-gray-800 border border-gray-200 shadow-sm rounded-bl-md'
                                                }`}
                                        >
                                            {/* 3. Logic Render Konten */}
                                            {/* Tampilkan Tabel HANYA jika BUKAN error dan ada data */}
                                            {!isErrorState && msg.tableData && msg.tableData.length > 0 ? (
                                                <AiResponseTable
                                                    analysis_summary={displayContent}
                                                    data={msg.tableData}
                                                />
                                            ) : (
                                                // Jika Error atau tidak ada tabel, render dengan markdown renderer
                                                msg.role === 'user' ? (
                                                    <p className="text-sm whitespace-pre-wrap">{displayContent}</p>
                                                ) : (
                                                    <AiMarkdownRenderer
                                                        content={displayContent}
                                                        className="text-sm"
                                                    />
                                                )
                                            )}
                                        </div>

                                        {/* Feedback UI */}
                                        {msg.role === 'assistant' && !isErrorState && msg.request_id && (
                                            <AiMessageFeedback
                                                messageId={msg.id}
                                                requestId={msg.request_id}
                                                hasFeedback={msg.hasFeedback}
                                                savedRating={msg.feedback?.rating}
                                                onSubmit={handleFeedback}
                                            />
                                        )}
                                    </div>
                                </div>
                            );
                        })
                    )}
                    {isAiLoading && (
                        <div className="flex justify-start">
                            <div className="bg-white border border-gray-200 rounded-2xl rounded-bl-md px-4 py-3 shadow-sm">
                                <div className="flex items-center gap-2">
                                    <div className="flex space-x-1">
                                        <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                                        <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                                        <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
                                    </div>
                                    <span className="text-xs text-gray-500">Geo AI sedang berpikir...</span>
                                </div>
                            </div>
                        </div>
                    )}
                    <div ref={messagesEndRef} />
                </div>
            )}

            {/* Input Area */}
            <div className="flex-shrink-0 border-t border-gray-200 bg-white p-4">
                <form onSubmit={handleFormSubmit} className="max-w-lg mx-auto">
                    <div className="flex items-center gap-2 bg-gray-100 rounded-2xl p-1.5 pl-4 border border-gray-200 focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-transparent transition-all">
                        <textarea
                            ref={textareaRef}
                            value={aiInput}
                            onChange={(e) => {
                                setAiInput(e.target.value);
                                // Auto-resize
                                e.target.style.height = 'auto';
                                e.target.style.height = `${Math.min(e.target.scrollHeight, 80)}px`;
                            }}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && !e.shiftKey) {
                                    e.preventDefault();
                                    handleFormSubmit(e);
                                }
                            }}
                            placeholder="Tanyakan sesuatu tentang wilayah..."
                            className="flex-1 bg-transparent text-sm resize-none focus:outline-none py-2 custom-scrollbar placeholder-gray-500"
                            rows={1}
                            style={{ maxHeight: '80px', minHeight: '24px' }}
                        />
                        <Tooltip content="Kirim pertanyaan">
                            <button
                                type="submit"
                                disabled={!aiInput.trim() || (!showHistory && isAiLoading)} // Hanya lock jika user ada di session yang sama dengan yang sedang loading. Jika di tab history, bebas submit.
                                className={`flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center transition-all duration-200 ${aiInput.trim() && (!(!showHistory && isAiLoading))
                                    ? 'bg-blue-600 text-white hover:bg-blue-700 shadow-md hover:shadow-lg hover:-translate-y-0.5'
                                    : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                                    }`}
                            >
                                <Send className="w-4 h-4 ml-0.5" />
                            </button>
                        </Tooltip>
                    </div>
                </form>
            </div>
        </>
    );
};

export default SidebarGeoAi;
