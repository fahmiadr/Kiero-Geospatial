import { useState, useEffect, useRef } from 'react';
import ErrorModal from './ErrorModal';

const SUPPRESSION_DURATION_MS = 15000; // 15 detik cooldown setelah pengguna menutup dialog

/**
 * Komponen global untuk menangani error dari Axios (terutama 5xx).
 * Mendengarkan event 'AXIOS_ERROR' yang dikirim dari apiClient.js.
 * Dilengkapi proteksi anti-spam agar tidak muncul berkali-kali saat terjadi retry.
 */
const GlobalErrorHandler = () => {
    const [error, setError] = useState(null);
    const dismissedAtRef = useRef(0);
    const lastDismissedMessageRef = useRef('');

    useEffect(() => {
        const handleAxiosError = (event) => {
            const message = event.detail;
            const now = Date.now();

            // Jika popup error yang sama baru saja ditutup oleh pengguna dalam durasi cooldown, abaikan retry berikutnya
            if (
                message === lastDismissedMessageRef.current &&
                now - dismissedAtRef.current < SUPPRESSION_DURATION_MS
            ) {
                return;
            }

            // Jika modal sedang terbuka, jangan timpa/flicker
            setError((prev) => prev || message);
        };

        window.addEventListener('AXIOS_ERROR', handleAxiosError);
        return () => window.removeEventListener('AXIOS_ERROR', handleAxiosError);
    }, []);

    const handleClose = () => {
        dismissedAtRef.current = Date.now();
        lastDismissedMessageRef.current = error || '';
        setError(null);
    };

    if (!error) return null;

    return (
        <ErrorModal
            message={error}
            onClose={handleClose}
        />
    );
};

export default GlobalErrorHandler;
