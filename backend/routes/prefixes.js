import express from 'express';
import { searchPrefixes } from '../services/prefixService.js';
import authMiddleware from '../middleware/authMiddleware.js';

const router = express.Router();
router.use(authMiddleware);

/**
 * @route GET /v1/prefixes/search
 * @description Mencari wilayah cakupan geografis dari awalan nomor telepon yang diberikan.
 * Endpoint ini menggunakan layanan `searchPrefixes` untuk menemukan awalan terpanjang yang cocok di database
 * dan mengembalikan nama wilayah yang sesuai serta geometri GeoJSON gabungan.
 * @access Private
 * @param {import('express').Request} req - Objek request Express.
 * @param {string} req.query.number - Nomor telepon atau awalan yang akan dicari.
 * @param {import('express').Response} res - Objek response Express.
 * @param {import('express').NextFunction} next - Fungsi middleware next Express.
 * @returns {Promise<void>}
 */
router.get('/search', async (req, res, next) => {
  try {
    const { number } = req.query;
    if (!number) {
      return res.status(400).json({ message: 'Phone number is required' });
    }
    const result = await searchPrefixes(number);
    res.json({
      "matchedPrefix": result.matchedPrefix,
      "coverage": {
        "regions": result.regions,
        "geoJson": result.geoJson
      }
    });
  } catch (error) {
    console.error('Error finding region by prefixes:', error);
    res.locals.errorMessage = error.stack;
    res.status(500).json({ message: 'Internal server error' });
  }
});

export default router;
