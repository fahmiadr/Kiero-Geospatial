import express from 'express';
import prisma from '../config/prismaClient.js';
import authMiddleware from '../middleware/authMiddleware.js';

const router = express.Router();

router.use(authMiddleware);

const serializeBigInt = (data) => {
  return JSON.parse(
    JSON.stringify(data, (key, value) => {
      if (typeof value === 'bigint') {
        return value.toString();
      }
      return value;
    })
  )
}

/**
 * @route GET /v1/categories
 * @description Mengambil daftar semua kategori tiket yang tersedia.
 * Endpoint ini dilindungi dan memerlukan token otentikasi yang valid.
 * Endpoint ini mengambil ID kode sistem (`category_id`) dan deskripsi bahasa Inggris (`description_eng`)
 * untuk setiap kategori dari database, diurutkan berdasarkan ID-nya.
 * @access Private
 * @param {import('express').Request} req - Objek request Express.
 * @param {import('express').Response} res - Objek response Express.
 * @returns {void}
 */
router.get('/', async (req, res) => {
  try {
    const categories = await prisma.categories.findMany({
      select: {
        id: true,
        category_name: true,
      },
      orderBy: {
        sort_order: 'asc'
      }
    });

    res.json({
      message: "Categories retrieved successfully",
      data: serializeBigInt(categories)
    });
  } catch (error) {
    console.error('Error fetching categories:', error);
    res.locals.errorMessage = error.stack;
    res.status(500).json({ message: 'Internal server error' });
  }
});

export default router;
