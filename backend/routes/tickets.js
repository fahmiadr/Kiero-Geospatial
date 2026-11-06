import express from 'express';
import { Prisma } from '@prisma/client';
import prisma from '../config/prismaClient.js';
import authMiddleware from '../middleware/authMiddleware.js';
import { getAggregatedTickets } from '../services/aggregationService.js';
import { getDateRangeFilter, getRegionFilter } from '../utils/queryUtils.js';

const router = express.Router();

router.use(authMiddleware);

// Ambang batas level zoom. Di atas atau sama dengan nilai ini, tampilkan pin individual.
// Di bawah nilai ini, tampilkan kluster.
const ZOOM_LEVEL_THRESHOLD = 15;
// Batas maksimum jumlah tiket individu yang akan dikembalikan dalam satu permintaan.
const MAX_INDIVIDUAL_TICKETS = 1000;

/**
 * @route GET /v1/tickets/view
 * @description Endpoint cerdas yang mengembalikan kluster tiket teragregasi atau titik tiket individual
 * berdasarkan tingkat zoom dan kotak pembatas (bounding box) peta. Responsnya beradaptasi untuk memberikan
 * visualisasi yang paling sesuai untuk tampilan peta saat ini.
 * @access Private
 * @param {import('express').Request} req - Objek request Express.
 * @param {number} req.query.minLng - Longitude minimum dari bounding box peta.
 * @param {number} req.query.minLat - Latitude minimum dari bounding box peta.
 * @param {number} req.query.maxLng - Longitude maksimum dari bounding box peta.
 * @param {number} req.query.maxLat - Latitude maksimum dari bounding box peta.
 * @param {number} req.query.zoom - Tingkat zoom peta saat ini.
 * @param {string} [req.query.regionCode] - Kode hierarkis untuk wilayah yang akan difilter.
 * @param {string} [req.query.category_id] - ID kode sistem untuk kategori tiket yang akan difilter.
 * @param {string} [req.query.startDate] - Tanggal mulai untuk memfilter tiket (YYYY-MM-DD).
 * @param {string} [req.query.endDate] - Tanggal akhir untuk memfilter tiket (YYYY-MM-DD).
 * @param {import('express').Response} res - Objek response Express.
 * @returns {Promise<void>}
 */
router.get('/view', async (req, res) => {
  let { minLng, minLat, maxLng, maxLat, zoom, regionCode, category, startDate, endDate } = req.query;

  if (!minLng || !minLat || !maxLng || !maxLat || !zoom) {
    return res.status(400).json({
      message: 'Parameter minLng, minLat, maxLng, maxLat, dan zoom diperlukan.',
    });
  }

  const bounds = {
    minLng: parseFloat(minLng),
    minLat: parseFloat(minLat),
    maxLng: parseFloat(maxLng),
    maxLat: parseFloat(maxLat),
  };

  const parsedCategory = category ? parseInt(category, 10) : undefined;
  const category_id = !isNaN(parsedCategory) ? parsedCategory : undefined;

  const zoomLevel = parseInt(zoom, 10);

  try {
    const data = await prisma.$transaction(async (tx) => {
      if (!regionCode) {
        return [];
      }

      // Hasilkan klausa WHERE untuk regionCode dari utilitas
      const regionWhereClause = getRegionFilter(regionCode, 'RAW');

      // Filter tanggal hanya jika startDate atau endDate disediakan
      let dateWhereClause = Prisma.empty;
      if (startDate || endDate) {
        const dateFilter = getDateRangeFilter(startDate, endDate);
        dateWhereClause = Prisma.sql`AND t.created_at BETWEEN ${dateFilter.gte} AND ${dateFilter.lte}`;
      }

      // Jika pengguna melakukan zoom-in cukup dekat (di atas ambang batas)
      if (zoomLevel >= ZOOM_LEVEL_THRESHOLD) {
        // Tambahkan filter category_id jika ada
        const scaidWhereClause = category_id !== undefined ? Prisma.sql`AND t.category_id = ${category_id}` : Prisma.empty;

        // Ambil titik-titik tiket individual
        const tickets = await tx.$queryRaw`
          SELECT
            t.id,
            t.ticket_number,
            t.status,
            ST_X(t.coordinates) AS lng,
            ST_Y(t.coordinates) AS lat
          FROM
            tickets t
          LEFT JOIN regions r ON t.region_id = r.id
          WHERE
            t.coordinates IS NOT NULL
            AND ST_Within(t.coordinates, ST_MakeEnvelope(${bounds.minLng}, ${bounds.minLat}, ${bounds.maxLng}, ${bounds.maxLat}, 4326))
            AND ${regionWhereClause}
            ${scaidWhereClause}
            ${dateWhereClause}
          LIMIT ${MAX_INDIVIDUAL_TICKETS};
        `;
        return tickets.map(ticket => ({
          id: ticket.id.toString(),
          ticket_number: ticket.ticket_number,
          status: ticket.status,
          type: 'point',
          coordinates: {
            lat: Number(ticket.lat),
            lng: Number(ticket.lng),
          }
        }));
      } else {
        // Jika pengguna melakukan zoom-out, ambil data kluster yang diagregasi
        const clusters = await getAggregatedTickets(tx, bounds, zoomLevel, regionCode, category_id, startDate, endDate);
        return clusters.map(cluster => ({
          ...cluster,
          count: Number(cluster.count),
          type: 'cluster',
        }));
      }
    }, {
      isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
      timeout: 20000,
    });

    res.json({
      message: 'Data peta berhasil diambil',
      data: data,
    });

  } catch (error) {
    if (error.message.includes('Invalid regionCode format')) {
      return res.status(400).json({ message: error.message });
    }
    console.error('Gagal mengambil data peta:', error);
    res.locals.errorMessage = error.stack;
    res.status(500).json({ message: 'Terjadi kesalahan internal pada server' });
  }
});

/**
 * @route GET /v1/tickets/:id
 * @description Mengambil informasi detail untuk satu tiket berdasarkan ID-nya.
 * Endpoint ini melakukan join dengan tabel kategori untuk menyertakan deskripsi kategori yang dapat dibaca manusia.
 * @access Private
 * @param {import('express').Request} req - Objek request Express.
 * @param {string} req.params.id - Pengidentifikasi unik tiket.
 * @param {import('express').Response} res - Objek response Express.
 * @returns {Promise<void>}
 */
router.get('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const ticket = await prisma.tickets.findFirst({
      where: { id: id },
      select: {
        id: true,
        ticket_number: true,
        channel_source: true,
        account_id: true,
        complaint_detail: true,
        category_id: true,
        status: true,
        categories: {
          select: {
            category_name: true
          }
        }
      }
    });

    if (!ticket) {
      return res.status(404).json({ message: 'Tiket tidak ditemukan' });
    }

    const formattedTicket = {
      id: ticket.id,
      status: ticket.status,
      ticket_number: ticket.ticket_number,
      complaint_detail: ticket.complaint_detail,
      channel_source: ticket.channel_source,
      account_id: ticket.account_id,
      category: `${ticket.categories?.category_name || 'No Description'}`,
    };

    res.json({
      message: 'Detail tiket berhasil diambil',
      data: formattedTicket
    });

  } catch (error) {
    console.error(`Gagal mengambil tiket ${id}:`, error);
    res.locals.errorMessage = error.stack;
    res.status(500).json({ message: 'Terjadi kesalahan internal pada server' });
  }
});

export default router;
