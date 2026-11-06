import express from 'express';
import { Prisma } from '@prisma/client';
import prisma from '../config/prismaClient.js';
import authMiddleware from '../middleware/authMiddleware.js';

const router = express.Router();

router.use(authMiddleware);

// ============================================================================
// CACHING SYSTEM - In-memory cache untuk data geospasial statis
// ============================================================================

/**
 * Cache store dengan TTL (Time To Live).
 * Key: cache identifier (e.g., 'provinsi', 'kab-kota-62')
 * Value: { data: any, timestamp: number }
 */
const geoCache = new Map();

// Cache TTL: 1 jam (data geografis jarang berubah)
const CACHE_TTL_MS = 60 * 60 * 1000;

/**
 * Mengambil data dari cache jika masih valid.
 * @param {string} key - Cache key
 * @returns {any|null} Cached data atau null jika expired/tidak ada
 */
const getFromCache = (key) => {
  const cached = geoCache.get(key);
  if (!cached) return null;

  const isExpired = Date.now() - cached.timestamp > CACHE_TTL_MS;
  if (isExpired) {
    geoCache.delete(key);
    return null;
  }

  return cached.data;
};

/**
 * Menyimpan data ke cache.
 * @param {string} key - Cache key
 * @param {any} data - Data untuk di-cache
 */
const setToCache = (key, data) => {
  geoCache.set(key, {
    data,
    timestamp: Date.now()
  });
};

/**
 * Pre-warm cache dengan data yang sering diakses.
 * Dipanggil saat aplikasi startup untuk menghindari cold-start latency.
 * @export
 * @async
 */
export const warmCache = async () => {
  console.log('🔥 Warming geo cache...');
  try {
    const query = Prisma.sql`
      SELECT DISTINCT id, level, tipe_adm, nama, kode_prov, kode_kab, kode_kec, luas, ST_AsGeoJSON(geom) as geom_geojson 
      FROM regions 
      WHERE level = 'provinsi'`;

    const results = await prisma.$queryRaw(query);
    const features = [];
    for (const item of results) {
      let geometry = null;
      if (item.geom_geojson) {
        try {
          geometry = JSON.parse(item.geom_geojson);
        } catch (e) {
          continue;
        }
      }
      const { geom_geojson, ...properties } = item;
      features.push({ type: "Feature", properties, geometry });
    }

    const responseData = {
      message: "Data retrieved successfully",
      data: features
    };

    setToCache('geo:provinsi', responseData);
    console.log(`✅ Cache warmed: geo:provinsi (${features.length} provinces)`);
  } catch (error) {
    console.error('⚠️ Failed to warm cache:', error.message);
  }
};

// ============================================================================

/**
 * Memformat array hasil query database menjadi array GeoJSON FeatureCollection.
 * Setiap item hasil dikonversi menjadi sebuah GeoJSON Feature, dengan geometrinya di-parse
 * dari string dan propertinya dipetakan dari kolom-kolom database.
 *
 * @param {Array<object>} results - Array objek data wilayah dari query database mentah.
 * @param {string} [results[].geom_geojson] - Objek geometri GeoJSON dalam bentuk string.
 * @param {string} results[].level - Level administratif wilayah.
 * @param {string} results[].tipe_adm - Kode tipe administratif.
 * @param {string} results[].nama - Nama wilayah.
 * @param {string} results[].kode_prov - Kode provinsi.
 * @param {string} [results[].kode_kab] - Kode kabupaten/kota.
 * @param {string} [results[].kode_kec] - Kode kecamatan.
 * @param {number} [results[].luas] - Luas wilayah.
 * @returns {Array<object>} Sebuah array objek GeoJSON Feature.
 */
const formatResultsToGeoJSON = (results) => {
  const features = [];
  for (const item of results) {
    let geometry = null;
    if (item.geom_geojson) {
      try {
        geometry = JSON.parse(item.geom_geojson);
      } catch (e) {
        console.error('Gagal mem-parsing GeoJSON untuk item:', item.nama, e);
        continue;
      }
    }

    // Pisahkan geom_geojson dari properti lainnya
    const { geom_geojson, ...properties } = item;

    features.push({
      type: "Feature",
      properties: properties,
      geometry: geometry,
    });
  }
  return features;
};

/**
 * Mengeksekusi query geospasial mentah menggunakan Prisma, memformat hasilnya ke GeoJSON,
 * dan mengirimkan respons. Mendukung caching opsional untuk data statis.
 *
 * @async
 * @param {import('express').Response} res - Objek response Express.
 * @param {Prisma.Sql} queryTemplate - Template query SQL mentah untuk dieksekusi.
 * @param {string} [cacheKey] - Opsional. Jika disediakan, hasil akan di-cache.
 * @returns {Promise<void>} Sebuah promise yang me-resolve ketika respons telah dikirim.
 */
const executeAndFormatGeoQuery = async (res, queryTemplate, cacheKey = null) => {
  try {
    // Cek cache terlebih dahulu jika cacheKey disediakan
    if (cacheKey) {
      const cachedData = getFromCache(cacheKey);
      if (cachedData) {
        res.set('X-Cache', 'HIT');
        return res.json(cachedData);
      }
    }

    const results = await prisma.$queryRaw(queryTemplate);
    const features = formatResultsToGeoJSON(results);
    const responseData = {
      message: "Data retrieved successfully",
      data: features
    };

    // Simpan ke cache jika cacheKey disediakan
    if (cacheKey) {
      setToCache(cacheKey, responseData);
      res.set('X-Cache', 'MISS');
    }

    res.json(responseData);
  } catch (error) {
    console.error('Geo query error:', error);
    res.locals.errorMessage = error.stack;
    res.status(500).json({ message: 'Internal server error' });
  }
};

/**
 * @route GET /v1/geo/provinsi
 * @description Mengambil data GeoJSON untuk semua provinsi.
 * Endpoint ini melakukan query ke database untuk semua wilayah di level 'provinsi'
 * dan mengembalikan detail serta geometri mereka sebagai GeoJSON FeatureCollection.
 * @access Private
 * @param {import('express').Request} req - Objek request Express.
 * @param {import('express').Response} res - Objek response Express.
 * @returns {Promise<void>}
 */
router.get('/provinsi', async (req, res) => {
  const query = Prisma.sql`
    SELECT DISTINCT id, level, tipe_adm, nama, kode_prov, kode_kab, kode_kec, luas, ST_AsGeoJSON(geom) as geom_geojson 
    FROM regions 
    WHERE level = 'provinsi'`;
  // Cache provinsi data (jarang berubah)
  await executeAndFormatGeoQuery(res, query, 'geo:provinsi');
});

/**
 * @route GET /v1/geo/kab-kota/:provinceCode
 * @description Mengambil data GeoJSON untuk semua kabupaten/kota dalam provinsi tertentu.
 * Menggunakan parameter URL `provinceCode` untuk memfilter hasil.
 * @access Private
 * @param {import('express').Request} req - Objek request Express, berisi parameter `provinceCode`.
 * @param {import('express').Response} res - Objek response Express.
 * @returns {Promise<void>}
 */
router.get('/kab-kota/:provinceCode', async (req, res) => {
  const { provinceCode } = req.params;
  const query = Prisma.sql`
    SELECT DISTINCT id, level, tipe_adm, nama, kode_prov, kode_kab, kode_kec, luas, ST_AsGeoJSON(geom) as geom_geojson 
    FROM regions 
    WHERE level = 'kab_kota' AND kode_prov = ${provinceCode}`;
  // Cache per provinsi
  await executeAndFormatGeoQuery(res, query, `geo:kab-kota:${provinceCode}`);
});

/**
 * @route GET /v1/geo/kecamatan/:provinceCode/:kabkotaCode
 * @description Mengambil data GeoJSON untuk semua kecamatan dalam kabupaten/kota tertentu.
 * Menggunakan parameter URL `provinceCode` dan `kabkotaCode` untuk memfilter hasil.
 * @access Private
 * @param {import('express').Request} req - Objek request Express, berisi parameter `provinceCode` dan `kabkotaCode`.
 * @param {import('express').Response} res - Objek response Express.
 * @returns {Promise<void>}
 */
router.get('/kecamatan/:provinceCode/:kabkotaCode', async (req, res) => {
  const { provinceCode, kabkotaCode } = req.params;
  const query = Prisma.sql`
      SELECT DISTINCT id, level, tipe_adm, nama, kode_prov, kode_kab, kode_kec, luas, ST_AsGeoJSON(geom) as geom_geojson 
      FROM regions 
      WHERE level = 'kecamatan' AND kode_prov = ${provinceCode} AND kode_kab = ${kabkotaCode}`;
  await executeAndFormatGeoQuery(res, query);
});

/**
 * @route GET /v1/geo/desa/:provinceCode/:kabkotaCode/:kecamatanCode
 * @description Mengambil data GeoJSON untuk semua desa/kelurahan dalam kecamatan tertentu.
 * Menggunakan parameter URL `provinceCode`, `kabkotaCode`, dan `kecamatanCode` untuk pemfilteran yang presisi.
 * @access Private
 * @param {import('express').Request} req - Objek request Express, berisi parameter kode wilayah.
 * @param {import('express').Response} res - Objek response Express.
 * @returns {Promise<void>}
 */
router.get('/desa/:provinceCode/:kabkotaCode/:kecamatanCode', async (req, res) => {
  const { provinceCode, kabkotaCode, kecamatanCode } = req.params;
  const query = Prisma.sql`
      SELECT DISTINCT id, level, tipe_adm, nama, kode_prov, kode_kab, kode_kec, luas, ST_AsGeoJSON(geom) as geom_geojson 
      FROM regions 
      WHERE level = 'desa' AND kode_prov = ${provinceCode} AND kode_kab = ${kabkotaCode} AND kode_kec = ${kecamatanCode}`;
  await executeAndFormatGeoQuery(res, query);
});

/**
 * @route GET /v1/geo/search
 * @description Mencari wilayah berdasarkan nama dengan fuzzy search (pg_trgm).
 * @access Private
 */
router.get('/search', async (req, res) => {
  try {
    const { name, provinceCode, kabkotaCode, kecamatanCode } = req.query;

    if (!name) {
      return res.status(400).json({ message: 'Search term is required' });
    }

    const searchTerm = name.trim();
    const searchName = '%' + searchTerm.replace(/\s+/g, '') + '%';

    // Dynamic filters
    let provFilter = Prisma.sql``;
    if (provinceCode) {
      provFilter = Prisma.sql`AND r.kode_prov = ${provinceCode}`;
    }

    let kabFilter = Prisma.sql``;
    if (kabkotaCode) {
      kabFilter = Prisma.sql`AND r.kode_kab = ${kabkotaCode}`;
    }

    let kecFilter = Prisma.sql``;
    if (kecamatanCode) {
      kecFilter = Prisma.sql`AND r.kode_kec = ${kecamatanCode}`;
    }

    const query = Prisma.sql`
      SELECT r.id, r.level, r.tipe_adm, r.nama, r.kode_prov, r.kode_kab, r.kode_kec, r.luas,
             p.nama as nama_prov, k.nama as nama_kab, k.tipe_adm as tipe_adm_kab, c.nama as nama_kec,
             word_similarity(r.nama, ${searchTerm}) as sim_score
      FROM regions r
      LEFT JOIN regions p ON r.kode_prov = p.kode_prov AND p.level = 'provinsi'
      LEFT JOIN regions k ON r.kode_prov = k.kode_prov AND r.kode_kab = k.kode_kab AND k.level = 'kab_kota'
      LEFT JOIN regions c ON r.kode_prov = c.kode_prov AND r.kode_kab = c.kode_kab AND r.kode_kec = c.kode_kec AND c.level = 'kecamatan'
      WHERE 1=1
      ${provFilter}
      ${kabFilter}
      ${kecFilter}
      AND (word_similarity(r.nama, ${searchTerm}) > 0.1 OR r.nama ILIKE ${searchName})
      ORDER BY r.nama <-> ${searchTerm} ASC
      LIMIT 5
    `;

    const results = await prisma.$queryRaw(query);
    const features = formatResultsToGeoJSON(results);
    res.json({ data: features });

  } catch (error) {
    console.error('Search error:', error);
    res.locals.errorMessage = error.stack;
    res.status(500).json({ message: 'Internal server error' });
  }
});

router.post('/find-by-point', async (req, res) => {
  try {
    const { lat, lng, includeGeometry } = req.body;

    // Strict numeric validation to prevent injection
    const parsedLat = parseFloat(lat);
    const parsedLng = parseFloat(lng);

    if (isNaN(parsedLat) || isNaN(parsedLng)) {
      return res.status(400).json({ message: 'Latitude and Longitude must be valid numbers' });
    }

    // Validate coordinate ranges
    if (parsedLat < -90 || parsedLat > 90 || parsedLng < -180 || parsedLng > 180) {
      return res.status(400).json({ message: 'Coordinates out of valid range' });
    }

    const pointWKT = `POINT(${parsedLng} ${parsedLat})`;

    // Optimized single query with JOINs to fetch all hierarchy at once
    // This replaces 4 separate queries (N+1 problem)
    const geomSelect = includeGeometry ? Prisma.sql`ST_AsGeoJSON(d.geom) as geom_geojson,` : Prisma.sql``;

    const foundDesa = await prisma.$queryRaw`
      SELECT 
        d.id, d.level, d.tipe_adm, d.nama, d.kode_prov, d.kode_kab, d.kode_kec, d.luas,
        ${geomSelect}
        p.nama as prov_nama, p.kode_prov as prov_kode,
        k.nama as kab_nama, k.kode_kab as kab_kode, k.tipe_adm as kab_tipe,
        c.nama as kec_nama, c.kode_kec as kec_kode
      FROM regions d
      LEFT JOIN regions p ON d.kode_prov = p.kode_prov AND p.level = 'provinsi'
      LEFT JOIN regions k ON d.kode_prov = k.kode_prov AND d.kode_kab = k.kode_kab AND k.level = 'kab_kota'
      LEFT JOIN regions c ON d.kode_prov = c.kode_prov AND d.kode_kab = c.kode_kab AND d.kode_kec = c.kode_kec AND c.level = 'kecamatan'
      WHERE d.level = 'desa' 
        AND ST_Contains(d.geom, ST_GeomFromText(${pointWKT}, 4326))
      LIMIT 1
    `;

    if (foundDesa.length > 0) {
      const row = foundDesa[0];
      return res.json({
        data: {
          provinsi: { nama: row.prov_nama, kode: row.prov_kode },
          kab_kota: { nama: row.kab_nama, kode: row.kab_kode, tipe: row.kab_tipe },
          kecamatan: { nama: row.kec_nama, kode: row.kec_kode },
          desa: { nama: row.nama, kode: null },
          kode_prov: row.prov_kode,
          kode_kab: row.kab_kode,
          kode_kec: row.kec_kode,
          geom_geojson: row.geom_geojson ? JSON.parse(row.geom_geojson) : null
        }
      });
    }

    // 2. Try Kecamatan with JOINs
    const geomSelectKec = includeGeometry ? Prisma.sql`ST_AsGeoJSON(c.geom) as geom_geojson,` : Prisma.sql``;

    const foundKecamatan = await prisma.$queryRaw`
      SELECT 
        c.id, c.level, c.tipe_adm, c.nama, c.kode_prov, c.kode_kab, c.kode_kec, c.luas,
        ${geomSelectKec}
        p.nama as prov_nama, p.kode_prov as prov_kode,
        k.nama as kab_nama, k.kode_kab as kab_kode, k.tipe_adm as kab_tipe
      FROM regions c
      LEFT JOIN regions p ON c.kode_prov = p.kode_prov AND p.level = 'provinsi'
      LEFT JOIN regions k ON c.kode_prov = k.kode_prov AND c.kode_kab = k.kode_kab AND k.level = 'kab_kota'
      WHERE c.level = 'kecamatan' 
        AND ST_Contains(c.geom, ST_GeomFromText(${pointWKT}, 4326))
      LIMIT 1
    `;

    if (foundKecamatan.length > 0) {
      const row = foundKecamatan[0];
      return res.json({
        data: {
          provinsi: { nama: row.prov_nama, kode: row.prov_kode },
          kab_kota: { nama: row.kab_nama, kode: row.kab_kode, tipe: row.kab_tipe },
          kecamatan: { nama: row.nama, kode: row.kode_kec },
          desa: null,
          kode_prov: row.prov_kode,
          kode_kab: row.kab_kode,
          kode_kec: row.kode_kec,
          geom_geojson: row.geom_geojson ? JSON.parse(row.geom_geojson) : null
        }
      });
    }

    // 3. Try Kab/Kota with JOIN
    const geomSelectKab = includeGeometry ? Prisma.sql`ST_AsGeoJSON(k.geom) as geom_geojson,` : Prisma.sql``;

    const foundKabKota = await prisma.$queryRaw`
      SELECT 
        k.id, k.level, k.tipe_adm, k.nama, k.kode_prov, k.kode_kab, k.luas,
        ${geomSelectKab}
        p.nama as prov_nama, p.kode_prov as prov_kode
      FROM regions k
      LEFT JOIN regions p ON k.kode_prov = p.kode_prov AND p.level = 'provinsi'
      WHERE k.level = 'kab_kota' 
        AND ST_Contains(k.geom, ST_GeomFromText(${pointWKT}, 4326))
      LIMIT 1
    `;

    if (foundKabKota.length > 0) {
      const row = foundKabKota[0];
      return res.json({
        data: {
          provinsi: { nama: row.prov_nama, kode: row.prov_kode },
          kab_kota: { nama: row.nama, kode: row.kode_kab, tipe: row.tipe_adm },
          kecamatan: null,
          desa: null,
          kode_prov: row.prov_kode,
          kode_kab: row.kode_kab,
          geom_geojson: row.geom_geojson ? JSON.parse(row.geom_geojson) : null
        }
      });
    }

    // 4. Try Provinsi (no JOIN needed)
    const geomSelectProv = includeGeometry ? Prisma.sql`ST_AsGeoJSON(geom) as geom_geojson,` : Prisma.sql``;

    const foundProvinsi = await prisma.$queryRaw`
      SELECT id, level, tipe_adm, nama, kode_prov,
        ${geomSelectProv}
        luas
      FROM regions 
      WHERE level = 'provinsi' 
        AND ST_Contains(geom, ST_GeomFromText(${pointWKT}, 4326))
      LIMIT 1
    `;

    if (foundProvinsi.length > 0) {
      const prov = foundProvinsi[0];
      return res.json({
        data: {
          provinsi: { nama: prov.nama, kode: prov.kode_prov },
          kab_kota: null,
          kecamatan: null,
          desa: null,
          kode_prov: prov.kode_prov,
          geom_geojson: prov.geom_geojson ? JSON.parse(prov.geom_geojson) : null
        }
      });
    }

    // Nothing found
    res.json({ data: null });

  } catch (error) {
    console.error('Error finding region by point:', error);
    res.locals.errorMessage = error.stack;
    res.status(500).json({ message: 'Internal server error' });
  }
});

export default router;