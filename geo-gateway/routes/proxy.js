import express from 'express';
import prisma from '../config/prismaClient.js';
import { corsOptionsDelegate } from '../middleware/corsMiddleware.js';
import * as jose from 'jose';
import cors from 'cors';
import { randomUUID } from 'crypto';

const router = express.Router();

const ALGORITHM = 'RS256';
const PUBLIC_GATEWAY_URL = process.env.GATEWAY_URL || 'http://localhost:3000';
const INTERNAL_PORT = process.env.PORT || 3000;
const INTERNAL_URL = `http://localhost:${INTERNAL_PORT}`;
const TOKEN_ENDPOINT = `${INTERNAL_URL}/oauth/token`;
const REFRESH_ENDPOINT = `${INTERNAL_URL}/oauth/refresh`;

router.use(cors(corsOptionsDelegate));

/**
 * Membuat JWT Assertion atas nama klien yang tepercaya (`client_credentials`).
 * @param {string} clientId - ID klien.
 * @param {string} privateKeyPem - Kunci privat klien dalam format PEM.
 * @returns {Promise<string>} JWT Assertion yang telah ditandatangani.
 * @private
 */
async function createClientAssertion(clientId, privateKeyPem) {
  const privateKey = await jose.importPKCS8(privateKeyPem, ALGORITHM);
  const assertion = await new jose.SignJWT({})
    .setProtectedHeader({ alg: ALGORITHM })
    .setIssuer(clientId)
    .setSubject(clientId)
    .setAudience(`${PUBLIC_GATEWAY_URL}/oauth/token`)
    .setJti(randomUUID())
    .setIssuedAt()
    .setExpirationTime('5m')
    .sign(privateKey);
  return assertion;
}

/**
 * @route POST /auth-proxy/proxy-token
 * @description Endpoint proksi untuk mendapatkan token. Endpoint ini aman terhadap CORS dan
 * bertindak sebagai perantara antara frontend dan endpoint `/oauth/token` internal.
 * Endpoint ini menangani pembuatan assertion untuk klien `client_credentials`.
 * @access Public (with CORS protection)
 */
router.post('/proxy-token', async (req, res) => {
  const { clientId, assertion: receivedAssertion } = req.body;
  const origin = req.get('origin');

  if (!clientId && !receivedAssertion) {
    return res.status(400).json({ error: 'invalid_request', error_description: 'Request must include either clientId or assertion.' });
  }

  let finalAssertion = receivedAssertion;

  try {
    let client;
    if (clientId) {
      client = await prisma.client.findUnique({ where: { clientId } });
      if (!client) {
        return res.status(401).json({ error: 'invalid_client', error_description: 'Client not found.' });
      }

      const allowedOrigins = client.allowedOrigins.split(',').map(o => o.trim());
      if (!allowedOrigins.includes(origin)) {
        return res.status(403).json({ error: 'access_denied', error_description: 'Origin not allowed for this client.' });
      }
      if (client.authMethod === 'client_credentials') {
        finalAssertion = await createClientAssertion(client.clientId, client.privateKey);
      }
    } else if (receivedAssertion) {
      const claims = jose.decodeJwt(receivedAssertion);
      client = await prisma.client.findUnique({ where: { clientId: claims.iss } });
      if (!client) {
        return res.status(401).json({ error: 'invalid_client', error_description: 'Client from assertion not found.' });
      }
    }

    if (!finalAssertion) {
      return res.status(400).json({ error: 'invalid_request', error_description: 'Could not obtain a valid assertion.' });
    }

    const tokenResponse = await fetch(TOKEN_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion: finalAssertion,
      }),
    });

    const tokenData = await tokenResponse.json();
    return res.status(tokenResponse.status).json(tokenData);

  } catch (error) {
    console.error('Error in /proxy-token endpoint:', error);
    res.locals.errorMessage = error.stack;
    res.status(500).json({ error: 'server_error', error_description: 'An internal server error occurred.' });
  }
});

/**
 * @route POST /auth-proxy/proxy-refresh
 * @description Endpoint proksi untuk me-refresh token. Endpoint ini aman terhadap CORS dan
 * hanya meneruskan permintaan ke endpoint `/oauth/refresh` internal.
 * @access Public (with CORS protection)
 */
router.post('/proxy-refresh', async (req, res) => {
  const { refresh_token } = req.body;
  if (!refresh_token) {
    return res.status(400).json({ error: 'invalid_request', error_description: 'refresh_token is required.' });
  }

  try {
    const response = await fetch(REFRESH_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token }),
    });

    const data = await response.json();
    return res.status(response.status).json(data);
  } catch (error) {
    console.error('Error in /proxy-refresh endpoint:', error);
    res.locals.errorMessage = error.stack;
    res.status(500).json({ error: 'server_error', error_description: 'An internal server error occurred.' });
  }
});

export default router;
