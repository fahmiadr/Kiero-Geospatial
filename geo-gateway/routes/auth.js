import express from 'express';
import * as jose from 'jose';
import fs from 'fs';
import crypto from 'crypto';
import prisma from '../config/prismaClient.js';

const router = express.Router();
const ALGORITHM = 'RS256';

/**
 * Menghasilkan hash SHA-256 dari sebuah token.
 * @param {string} token - Token yang akan di-hash.
 * @returns {string} Hash dalam format hex.
 * @private
 */
const hashToken = (token) => {
  return crypto.createHash('sha256').update(token).digest('hex');
};

let gatewayPrivateKey;

/**
 * Memuat kunci privat gateway dari file PEM yang ditentukan di variabel lingkungan.
 * Kunci ini digunakan untuk menandatangani Access Token. Aplikasi akan berhenti jika kunci gagal dimuat.
 * @export
 * @async
 */
export async function loadGatewayPrivateKey() {
  if (gatewayPrivateKey) return;
  try {
    if (!process.env.GATEWAY_PRIVATE_KEY_PATH) {
      throw new Error('GATEWAY_PRIVATE_KEY_PATH environment variable is not set.');
    }
    // Bypassing Node.js fstat() to prevent Docker Windows VirtioFS EIO bugs.
    const path = process.env.GATEWAY_PRIVATE_KEY_PATH;
    const fd = fs.openSync(path, 'r');
    const buffer = Buffer.alloc(8192);
    const bytesRead = fs.readSync(fd, buffer, 0, 8192, 0);
    fs.closeSync(fd);
    const privateKeyPem = buffer.subarray(0, bytesRead).toString('utf-8');
    
    gatewayPrivateKey = await jose.importPKCS8(privateKeyPem, ALGORITHM);
    console.log('Gateway private key loaded successfully for signing.');
  } catch (error) {
    console.error('FATAL: Failed to load gateway private key.', error);
    process.exit(1);
  }
}

/**
 * @route POST /oauth/token
 * @description Endpoint token OAuth 2.0. Menangani dua alur otentikasi:
 * 1. `private_key_jwt`: Untuk klien pihak ketiga (iframe) yang menyediakan JWT Assertion.
 * 2. `client_credentials`: Untuk klien pihak pertama yang tepercaya, di mana gateway membuat assertion atas nama mereka.
 * Setelah verifikasi berhasil, endpoint ini menerbitkan Access Token dan Refresh Token.
 * @access Public
 */
router.post('/token', async (req, res) => {
    try {
        const { clientId, assertion } = req.body;
        
        // Determine client and assertion based on what's provided
        let client;
        let finalAssertion = assertion;

        if (assertion) {
            // Flow for private_key_jwt (third-party iframe)
            const claims = jose.decodeJwt(assertion);
            if (!claims || !claims.iss) {
                return res.status(400).json({ error: 'invalid_grant', error_description: 'Invalid assertion format.' });
            }
            client = await prisma.client.findUnique({ where: { clientId: claims.iss } });

        } else if (clientId) {
            // Flow for client_credentials (first-party app)
            client = await prisma.client.findUnique({ where: { clientId } });
            if (client && client.authMethod === 'client_credentials') {
                console.log(`Generating assertion for trusted client: ${clientId}`);
                // Gateway generates the assertion on behalf of the trusted client
                finalAssertion = await new jose.SignJWT({})
                    .setProtectedHeader({ alg: ALGORITHM })
                    .setIssuedAt()
                    .setIssuer(client.clientId)
                    .setSubject(client.clientId)
                    .setAudience(`${process.env.GATEWAY_URL}/oauth/token`)
                    .setExpirationTime('5m')
                    .sign(await jose.importPKCS8(client.privateKey, ALGORITHM));
            }
        } else {
             return res.status(400).json({ error: 'invalid_request', error_description: 'Request must include either a clientId or a JWT assertion.' });
        }

        if (!client) {
            return res.status(401).json({ error: 'invalid_client', error_description: 'Client not found or could not be identified.' });
        }

        // --- Assertion Verification ---
        // This block now verifies assertions from both flows
        const clientPublicKey = await jose.importSPKI(client.publicKey, ALGORITHM);
        await jose.jwtVerify(finalAssertion, clientPublicKey, {
            issuer: client.clientId,
            audience: `${process.env.GATEWAY_URL}/oauth/token`,
            algorithms: [ALGORITHM],
        });

        // --- Token Issuance (remains the same) ---
        const accessToken = await new jose.SignJWT({ clientId: client.clientId })
            .setProtectedHeader({ alg: ALGORITHM })
            .setIssuer(process.env.GATEWAY_URL)
            .setSubject(client.id)
            .setIssuedAt()
            .setExpirationTime('15m')
            .setJti(crypto.randomUUID())
            .sign(gatewayPrivateKey);

        const refreshToken = crypto.randomBytes(40).toString('hex');
        const hashedRefreshToken = hashToken(refreshToken);
        const refreshTokenExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

        await prisma.refresh_token.create({
            data: {
                hashedToken: hashedRefreshToken,
                clientId: client.id,
                expiresAt: refreshTokenExpiry,
            },
        });

        res.json({
            access_token: accessToken,
            token_type: 'Bearer',
            expires_in: 900,
            refresh_token: refreshToken,
        });

    } catch (error) {
        console.error("Error in /oauth/token:", error);
        res.locals.errorMessage = error.stack;
        if (error instanceof jose.errors.JWTExpired || error instanceof jose.errors.JWSSignatureVerificationFailed) {
            return res.status(401).json({ error: 'invalid_grant', error_description: `Assertion verification failed: ${error.message}` });
        }
        res.status(500).json({ error: 'server_error', error_description: 'An internal server error occurred' });
    }
});

/**
 * @route POST /oauth/refresh
 * @description Endpoint refresh token OAuth 2.0. Memvalidasi Refresh Token yang ada,
 * mencabutnya, dan menerbitkan pasangan Access Token dan Refresh Token yang baru.
 * @access Public
 */
router.post('/refresh', async (req, res) => {
  const { refresh_token } = req.body;

  if (!refresh_token) {
    return res.status(400).json({ error: 'invalid_request', error_description: 'Refresh token is missing.' });
  }

  const hashedToken = hashToken(refresh_token);

  try {
    const storedToken = await prisma.refresh_token.findUnique({
      where: { hashedToken },
      include: { client: true },
    });

    if (!storedToken || storedToken.revoked || new Date() > storedToken.expiresAt) {
      return res.status(401).json({ error: 'invalid_grant', error_description: 'Refresh token is invalid, revoked, or expired.' });
    }

    await prisma.refresh_token.update({
      where: { id: storedToken.id },
      data: { revoked: true },
    });

    const newAccessToken = await new jose.SignJWT({ clientId: storedToken.client.clientId })
      .setProtectedHeader({ alg: ALGORITHM })
      .setIssuer(process.env.GATEWAY_URL)
      .setSubject(storedToken.client.id)
      .setIssuedAt()
      .setExpirationTime('15m')
      .setJti(crypto.randomUUID())
      .sign(gatewayPrivateKey);

    const newRefreshToken = crypto.randomBytes(40).toString('hex');
    const newHashedRefreshToken = hashToken(newRefreshToken);
    const newRefreshTokenExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await prisma.refresh_token.create({
      data: {
        hashedToken: newHashedRefreshToken,
        clientId: storedToken.client.id,
        expiresAt: newRefreshTokenExpiry,
      },
    });

    res.json({
      access_token: newAccessToken,
      token_type: 'Bearer',
      expires_in: 900,
      refresh_token: newRefreshToken,
    });

  } catch (error) {
    console.error("Error in /oauth/refresh:", error);
    res.locals.errorMessage = error.stack;
    res.status(500).json({ error: 'server_error', error_description: 'An internal server error occurred.' });
  }
});

export default router;
