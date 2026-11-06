import jwt from 'jsonwebtoken';
import fs from 'fs';

let gatewayPublicKey;

/**
 * Secara asinkron memuat dan menyimpan cache public key milik gateway dari sistem file.
 * Fungsi ini krusial untuk urutan startup backend. Fungsi ini membaca public key
 * yang ditentukan oleh variabel lingkungan `GATEWAY_PUBLIC_KEY_PATH`, yang kemudian digunakan
 * oleh middleware otentikasi untuk memverifikasi JWT.
 * Jika kunci tidak dapat dibaca, aplikasi akan keluar dengan kesalahan fatal.
 * Fungsi ini harus dipanggil sekali saat aplikasi dimulai.
 * @async
 * @function loadBackendDependencies
 * @returns {Promise<void>} Sebuah promise yang me-resolve ketika kunci berhasil dimuat.
 * @throws {Error} Akan menyebabkan proses keluar jika file public key tidak dapat dibaca.
 */
export async function loadBackendDependencies() {
  try {
    const path = process.env.GATEWAY_PUBLIC_KEY_PATH;
    // Bypassing Node.js fstat() to prevent Docker Windows VirtioFS EIO bugs.
    const fd = fs.openSync(path, 'r');
    const buffer = Buffer.alloc(8192);
    const bytesRead = fs.readSync(fd, buffer, 0, 8192, 0);
    fs.closeSync(fd);
    gatewayPublicKey = buffer.subarray(0, bytesRead);
    console.log("Backend successfully loaded the gateway public key.");
  } catch (error) {
    console.error("FATAL ERROR: Could not read gateway public key. Make sure GATEWAY_PUBLIC_KEY_PATH in .env is correct.", error);
    process.exit(1); // Hentikan aplikasi jika kunci tidak ditemukan.
  }
}

/**
 * Middleware Express untuk mengotentikasi permintaan menggunakan token JWT Bearer.
 * Middleware ini memeriksa header `Authorization`, mengekstrak token, dan memverifikasinya
 * menggunakan public key milik gateway. Verifikasi ini memeriksa tanda tangan, algoritma (`RS256`),
 * dan issuer untuk memastikan token valid dan dikeluarkan oleh gateway yang terpercaya.
 * Jika token valid, informasi klien akan dilampirkan ke objek `req`.
 * Jika token tidak ada, salah format, atau tidak valid, middleware akan mengirimkan respons 401 Unauthorized.
 *
 * @param {import('express').Request} req - Objek request Express.
 * @param {import('express').Response} res - Objek response Express.
 * @param {import('express').NextFunction} next - Fungsi middleware next Express.
 * @returns {void}
 */
const authMiddleware = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Unauthorized: No token provided or malformed header' });
  }

  const token = authHeader.split(' ')[1];

  try {
    // Verifikasi token menggunakan public key gateway dan algoritma ES256
    const decoded = jwt.verify(token, gatewayPublicKey, {
      algorithms: ['RS256'],
      // Pastikan token benar-benar dikeluarkan oleh gateway
      issuer: process.env.GATEWAY_ISSUER_URL
    });

    req.client = {
      clientId: decoded.clientId,
    };

    next();
  } catch (error) {
    console.error("Token verification failed on Resource Server:", error.message);
    return res.status(401).json({ message: `Unauthorized: Invalid token. ${error.message}` });
  }
};

export default authMiddleware;

