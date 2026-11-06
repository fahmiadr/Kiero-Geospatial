import * as jose from 'jose';
import fs from 'fs';

const ALGORITHM = 'RS256';
let gatewayPublicKey;

/**
 * Memuat kunci publik gateway dari file PEM. Kunci ini digunakan untuk memverifikasi
 * Access Token yang masuk. Aplikasi akan berhenti jika kunci gagal dimuat.
 * @export
 * @async
 */
export async function loadGatewayPublicKey() {
    try {
        const path = process.env.GATEWAY_PUBLIC_KEY_PATH;
        // Bypassing Node.js fstat() to prevent Docker Windows VirtioFS EIO bugs.
        const fd = fs.openSync(path, 'r');
        const buffer = Buffer.alloc(8192);
        const bytesRead = fs.readSync(fd, buffer, 0, 8192, 0);
        fs.closeSync(fd);
        const publicKeyPem = buffer.subarray(0, bytesRead).toString('utf-8');
        
        gatewayPublicKey = await jose.importSPKI(publicKeyPem, ALGORITHM);
        console.log("Gateway public key loaded successfully.");
    } catch (error) {
        console.error("FATAL: Failed to load gateway public key.", error);
        process.exit(1);
    }
}

/**
 * Middleware untuk memvalidasi Access Token JWT (Bearer Token).
 * Memeriksa keberadaan, format, tanda tangan, dan klaim (issuer, expiration) dari token.
 * @export
 * @async
 */
export const tokenValidationMiddleware = async (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ message: 'Unauthorized: No token provided or malformed header' });
    }
    const token = authHeader.split(' ')[1];
    try {
        await jose.jwtVerify(token, gatewayPublicKey, {
            issuer: process.env.GATEWAY_URL,
            algorithms: [ALGORITHM],
        });
        next();
    } catch (error) {
        if (error instanceof jose.errors.JWTExpired) {
            return res.status(401).json({ message: 'Unauthorized: Token has expired.', code: 'TOKEN_EXPIRED' });
        }
        return res.status(401).json({ message: `Unauthorized: Invalid token. ${error.message}` });
    }
};
