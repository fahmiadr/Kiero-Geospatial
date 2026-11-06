import { isOriginAllowed } from '../utils/corsWhitelistCache.js';

/**
 * Delegasi CORS dinamis yang memeriksa origin permintaan terhadap daftar putih yang di-cache.
 * Digunakan oleh middleware `cors`.
 * 
 * @param {import('express').Request} req - Objek request.
 * @param {Function} callback - Callback untuk meneruskan opsi CORS.
 */
export const corsOptionsDelegate = async (req, callback) => {
    const origin = req.header('Origin');
    let corsOptions = { origin: false }; // Tolak secara default

    try {
        if (isOriginAllowed(origin)) {
            corsOptions = { origin: true };
        } else {
            if (origin) {
                console.warn(`CORS: Origin '${origin}' denied.`);
            }
        }
        callback(null, corsOptions);
    } catch (err) {
        callback(err);
    }
};
