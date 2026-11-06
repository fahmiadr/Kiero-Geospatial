import express from 'express';
import { Prisma } from '@prisma/client';
import prisma from '../config/prismaClient.js';
import authMiddleware from '../middleware/authMiddleware.js';
import { getDateRangeFilter, getRegionFilter } from '../utils/queryUtils.js';

const router = express.Router();

router.use(authMiddleware);

/**
 * Cek apakah fitur debug koordinat diizinkan:
 * Hanya aktif jika NODE_ENV bukan 'production' DAN ENABLE_COORDINATE_DEBUG='true' pada .env
 */
const isCoordinateDebugEnabled = () => {
  return process.env.NODE_ENV !== 'production' && process.env.ENABLE_COORDINATE_DEBUG === 'true';
};

/**
 * @route GET /v1/regions/:regionCode/stats
 * @description Mengambil statistik tiket (open, pending, closed, total) untuk wilayah tertentu.
 * Wilayah ditentukan oleh `regionCode`, yang dapat merepresentasikan provinsi, kabupaten, kecamatan, atau desa.
 * Hasilnya dapat difilter berdasarkan rentang tanggal dan kategori menggunakan parameter query.
 * @access Private
 * @param {import('express').Request} req - Objek request Express.
 * @param {string} req.params.regionCode - Kode hierarkis untuk wilayah target.
 * @param {string} [req.query.startDate] - Tanggal mulai untuk filter (YYYY-MM-DD).
 * @param {string} [req.query.endDate] - Tanggal akhir untuk filter (YYYY-MM-DD).
 * @param {string} [req.query.category] - ID kategori untuk memfilter tiket.
 * @param {import('express').Response} res - Objek response Express.
 * @returns {Promise<void>}
 */
router.get('/:regionCode/stats', async (req, res) => {
  const { regionCode } = req.params;
  const { startDate, endDate, category } = req.query;

  if (!regionCode) {
    return res.status(400).json({ message: 'regionCode parameter is required' });
  }

  try {
    const regionFilter = getRegionFilter(regionCode, 'ORM');

    // Bangun where clause secara dinamis
    const whereClause = {
      regions: regionFilter,
    };

    // Filter tanggal hanya jika disediakan (konsisten dengan /view)
    if (startDate || endDate) {
      whereClause.created_at = getDateRangeFilter(startDate, endDate);
    }

    // Filter kategori jika disediakan
    const parsedCategory = category ? parseInt(category, 10) : undefined;
    if (parsedCategory && !isNaN(parsedCategory)) {
      whereClause.category_id = parsedCategory;
    }

    const stats = await prisma.tickets.groupBy({
      by: ['status'],
      where: whereClause,
      _count: {
        _all: true,
      },
    });

    const formattedStats = {
      open: 0,
      pending: 0,
      closed: 0,
      total: 0,
    };

    let total = 0;
    stats.forEach(stat => {
      const status = stat.status.toLowerCase();
      const count = Number(stat._count._all);
      if (formattedStats.hasOwnProperty(status)) {
        formattedStats[status] = count;
      }
      total += count;
    });
    formattedStats.total = total;

    // Log debug hanya jika diizinkan di environment non-production dan toggle aktif
    if (isCoordinateDebugEnabled()) {
      try {
        const regionRawWhere = getRegionFilter(regionCode, 'RAW');
        let dateRawWhere = Prisma.empty;
        if (startDate || endDate) {
          const dateFilter = getDateRangeFilter(startDate, endDate);
          dateRawWhere = Prisma.sql`AND t.created_at BETWEEN ${dateFilter.gte} AND ${dateFilter.lte}`;
        }
        const categoryRawWhere = (parsedCategory && !isNaN(parsedCategory))
          ? Prisma.sql`AND t.category_id = ${parsedCategory}`
          : Prisma.empty;

        const coordSummary = await prisma.$queryRaw`
          SELECT
            COUNT(*)::int AS total_tickets,
            COUNT(CASE WHEN t.coordinates IS NULL THEN 1 END)::int AS null_coordinates,
            COUNT(CASE WHEN t.coordinates IS NOT NULL AND (ST_X(t.coordinates) = 0 AND ST_Y(t.coordinates) = 0) THEN 1 END)::int AS zero_coordinates,
            COUNT(CASE WHEN t.coordinates IS NOT NULL AND (ST_X(t.coordinates) != 0 OR ST_Y(t.coordinates) != 0) THEN 1 END)::int AS valid_coordinates
          FROM tickets t
          LEFT JOIN regions r ON t.region_id = r.id
          WHERE ${regionRawWhere}
            ${dateRawWhere}
            ${categoryRawWhere};
        `;

        if (coordSummary && coordSummary[0]) {
          console.log(`[DEBUG COORD] Region ${regionCode}: Total=${coordSummary[0].total_tickets}, Valid=${coordSummary[0].valid_coordinates}, NULL=${coordSummary[0].null_coordinates}, Zero(0,0)=${coordSummary[0].zero_coordinates}`);
        }
      } catch (coordErr) {
        console.warn('[DEBUG COORD] Failed to check coordinate validity:', coordErr.message);
      }
    }

    res.json({
      message: 'Region ticket stats retrieved successfully',
      data: formattedStats,
    });
  } catch (error) {
    if (error.message.includes('Invalid regionCode format')) {
      return res.status(400).json({ message: error.message });
    }
    console.error('Error fetching region stats:', error);
    res.locals.errorMessage = error.stack;
    res.status(500).json({ message: 'Internal server error' });
  }
});

/**
 * @route GET /v1/regions/:regionCode/stats/details
 * @description Mengambil rincian jumlah tiket berdasarkan kategori untuk status dan wilayah tertentu.
 * Endpoint ini menyediakan tampilan yang lebih granular daripada endpoint statistik utama.
 * Endpoint ini memerlukan parameter query `status` dan dapat difilter berdasarkan rentang tanggal dan kategori.
 * @access Private
 * @param {import('express').Request} req - Objek request Express.
 * @param {string} req.params.regionCode - Kode hierarkis untuk wilayah target.
 * @param {string} req.query.status - Status tiket untuk difilter (misalnya, 'open', 'pending', 'closed').
 * @param {string} [req.query.startDate] - Tanggal mulai untuk filter (YYYY-MM-DD).
 * @param {string} [req.query.endDate] - Tanggal akhir untuk filter (YYYY-MM-DD).
 * @param {string} [req.query.category] - ID kategori untuk memfilter tiket.
 * @param {import('express').Response} res - Objek response Express.
 * @returns {Promise<void>}
 */
router.get('/:regionCode/stats/details', async (req, res) => {
  const { regionCode } = req.params;
  const { startDate, endDate, status, category } = req.query;

  if (!regionCode) {
    return res.status(400).json({ message: 'regionCode parameter is required' });
  }
  if (!status) {
    return res.status(400).json({ message: 'status parameter is required' });
  }

  try {
    const regionFilter = getRegionFilter(regionCode, 'ORM');

    // Bangun where clause secara dinamis
    const whereClause = {
      status: {
        equals: status,
        mode: 'insensitive',
      },
      regions: regionFilter,
    };

    // Filter tanggal hanya jika disediakan (konsisten dengan /view)
    if (startDate || endDate) {
      whereClause.created_at = getDateRangeFilter(startDate, endDate);
    }

    // Filter kategori jika disediakan
    const parsedCategory = category ? parseInt(category, 10) : undefined;
    if (parsedCategory && !isNaN(parsedCategory)) {
      whereClause.category_id = parsedCategory;
    }

    const stats = await prisma.tickets.groupBy({
      by: ['category_id'],
      where: whereClause,
      _count: {
        _all: true,
      },
      orderBy: {
        _count: {
          category_id: 'desc',
        },
      },
    });

    if (stats.length === 0) {
      return res.json({
        message: 'Region ticket category stats retrieved successfully',
        data: [],
      });
    }

    const scaids = stats.map(s => s.category_id);

    const categories = await prisma.categories.findMany({
      where: {
        id: { in: scaids }
      },
      select: {
        id: true,
        category_name: true
      }
    });

    const categoryMap = new Map(categories.map(c => [c.id, c.category_name]));

    const formattedResults = stats.map(stat => ({
      category_name: categoryMap.get(stat.category_id) || 'Unknown Category',
      count: Number(stat._count._all)
    }));

    res.json({
      message: 'Region ticket category stats retrieved successfully',
      data: formattedResults,
    });

  } catch (error) {
    if (error.message.includes('Invalid regionCode format')) {
      return res.status(400).json({ message: error.message });
    }
    console.error('Error fetching region category stats:', error);
    res.locals.errorMessage = error.stack;
    res.status(500).json({ message: 'Internal server error' });
  }
});

/**
 * @route GET /v1/regions/:regionCode/debug-coordinates
 * @description [DEBUG SEMENTARA] Memeriksa secara detail tiket-tiket dengan koordinat NULL, 0,0, atau invalid pada region tertentu.
 * @access Private
 */
router.get('/:regionCode/debug-coordinates', async (req, res) => {
  if (!isCoordinateDebugEnabled()) {
    return res.status(403).json({
      message: 'Endpoint debug koordinat tidak diaktifkan. Pastikan NODE_ENV bukan production dan set ENABLE_COORDINATE_DEBUG=true pada .env.'
    });
  }

  const { regionCode } = req.params;
  const { startDate, endDate, category } = req.query;

  if (!regionCode) {
    return res.status(400).json({ message: 'regionCode parameter is required' });
  }

  try {
    const regionWhereClause = getRegionFilter(regionCode, 'RAW');

    let dateWhereClause = Prisma.empty;
    if (startDate || endDate) {
      const dateFilter = getDateRangeFilter(startDate, endDate);
      dateWhereClause = Prisma.sql`AND t.created_at BETWEEN ${dateFilter.gte} AND ${dateFilter.lte}`;
    }

    const parsedCategory = category ? parseInt(category, 10) : undefined;
    const categoryWhereClause = (parsedCategory && !isNaN(parsedCategory))
      ? Prisma.sql`AND t.category_id = ${parsedCategory}`
      : Prisma.empty;

    const summary = await prisma.$queryRaw`
      SELECT
        COUNT(*)::int AS total_tickets,
        COUNT(CASE WHEN t.coordinates IS NULL THEN 1 END)::int AS null_coordinates,
        COUNT(CASE WHEN t.coordinates IS NOT NULL AND (ST_X(t.coordinates) = 0 AND ST_Y(t.coordinates) = 0) THEN 1 END)::int AS zero_coordinates,
        COUNT(CASE WHEN t.coordinates IS NOT NULL AND (ST_X(t.coordinates) != 0 OR ST_Y(t.coordinates) != 0) THEN 1 END)::int AS valid_coordinates
      FROM tickets t
      LEFT JOIN regions r ON t.region_id = r.id
      WHERE ${regionWhereClause}
        ${dateWhereClause}
        ${categoryWhereClause};
    `;

    const invalidTickets = await prisma.$queryRaw`
      SELECT
        t.id,
        t.ticket_number,
        t.status,
        t.category_id,
        t.created_at,
        CASE 
          WHEN t.coordinates IS NULL THEN 'NULL_COORDINATES'
          WHEN ST_X(t.coordinates) = 0 AND ST_Y(t.coordinates) = 0 THEN 'ZERO_COORDINATES'
          ELSE 'INVALID_COORDINATES'
        END AS issue_reason,
        CASE 
          WHEN t.coordinates IS NOT NULL THEN ST_AsText(t.coordinates)
          ELSE NULL
        END AS raw_geometry
      FROM tickets t
      LEFT JOIN regions r ON t.region_id = r.id
      WHERE ${regionWhereClause}
        ${dateWhereClause}
        ${categoryWhereClause}
        AND (t.coordinates IS NULL OR (ST_X(t.coordinates) = 0 AND ST_Y(t.coordinates) = 0))
      ORDER BY t.id DESC
      LIMIT 100;
    `;

    res.json({
      message: 'Debug coordinate inspection completed',
      regionCode,
      summary: summary[0] || {},
      invalid_samples: invalidTickets
    });
  } catch (error) {
    console.error('Error debugging coordinates:', error);
    res.status(500).json({ message: error.message });
  }
});

export default router;
