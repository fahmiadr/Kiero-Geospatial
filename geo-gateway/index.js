import dotenv from 'dotenv';
import express from 'express';
import authRouter, { loadGatewayPrivateKey } from './routes/auth.js';
import gatewayRouter from './routes/gateway.js';
import proxyRouter from './routes/proxy.js';
import aiRouter from './routes/ai.js';
import loggingMiddleware from './middleware/logging.js';
import { loadGatewayPublicKey } from './middleware/authMiddleware.js';
import { startArchiveScheduler } from './services/archiveService.js';

/**
 * Menginisialisasi dan memulai server Express untuk Geo Gateway.
 * Fungsi ini melakukan langkah-langkah berikut:
 * 1. Memuat variabel lingkungan dari file `.env`.
 * 2. Memuat kunci kriptografi (private dan public) yang diperlukan untuk operasi JWT.
 * 3. Menginisialisasi aplikasi Express dengan middleware yang diperlukan (JSON, logging).
 * 4. Mendaftarkan rute-rute utama untuk otentikasi, proksi, dan gateway API.
 * 5. Menyiapkan penanganan error global.
 * 6. Menjalankan server pada port yang ditentukan dan memulai penjadwal pengarsipan log.
 * @async
 */
const startServer = async () => {
  dotenv.config();

  try {
    await loadGatewayPrivateKey();
    await loadGatewayPublicKey();
  } catch (error) {
    console.error("FATAL: Could not load cryptographic keys. Server cannot start.", error);
    process.exit(1);
  }

  const app = express();
  const port = process.env.PORT || 3000;

  // Middleware
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Terapkan middleware logging terlebih dahulu
  app.use((req, res, next) => {
    const originalSend = res.send;
    res.send = function (body) {
      res.body = body;
      originalSend.call(this, body);
    };
    next();
  });
  app.use(loggingMiddleware);

  app.get('/health', (req, res) => {
    res.status(200).json({
      status: 'UP',
      timestamp: new Date().toISOString(),
      uptime: process.uptime()
    });
  });

  // Rute Publik: Otorisasi Klien (digunakan secara internal oleh proksi)
  // URL: http://localhost:3000/oauth/token
  app.use('/oauth', authRouter);

  // Rute Aman Baru: Proksi untuk Frontend Mendapatkan Token
  // URL: http://localhost:3000/auth-proxy/proxy-token
  app.use('/auth-proxy', proxyRouter);

  // Rute AI: Proksi ke AI Service
  // URL: http://localhost:3000/ai/ask
  app.use('/ai', aiRouter);

  // Rute Terproteksi: Proksi ke Resource Server Internal
  // URL: http://localhost:3000/api/*
  app.use('/api', gatewayRouter);

  // Penanganan rute tidak ditemukan
  app.use((req, res) => {
    res.status(404).json({ error: "Not Found", message: `The requested URL ${req.originalUrl} was not found on this gateway.` });
  });

  // Penanganan error global
  app.use((err, req, res, next) => {
    console.error('[Gateway Error]', err.stack);
    res.status(500).json({ error: 'Internal Server Error', message: 'Something broke on the gateway!' });
  });

  app.listen(port, () => {
    console.log(`🌍 Geo Gateway is running on ${process.env.GATEWAY_URL || `http://localhost:${port}`}`);
    startArchiveScheduler();
  });
};

startServer();

