import { Prisma } from '@prisma/client';
import { getDateRangeFilter } from '../utils/queryUtils.js';

/**
 * Mengambil data tiket yang diagregasi (kluster) dari database berdasarkan batas peta dan tingkat zoom.
 * Fungsi ini secara dinamis menyesuaikan presisi pengklasteran berdasarkan tingkat zoom untuk memberikan
 * ringkasan data yang optimal. Fungsi ini membangun query SQL dinamis untuk memfilter tiket berdasarkan lokasi,
 * wilayah, kategori, dan tanggal, kemudian mengelompokkannya ke dalam kluster.
 *
 * @async
 * @param {Prisma.TransactionClient} tx - Klien transaksi Prisma untuk memastikan operasi atomik.
 * @param {object} bounds - Batas geografis dari tampilan peta.
 * @param {number} bounds.minLng - Longitude minimum.
 * @param {number} bounds.minLat - Latitude minimum.
 * @param {number} bounds.maxLng - Longitude maksimum.
 * @param {number} bounds.maxLat - Latitude maksimum.
 * @param {number} zoom - Tingkat zoom peta saat ini, digunakan untuk menentukan presisi pengklasteran.
 * @param {string} [regionCode] - Kode wilayah hierarkis opsional untuk memfilter tiket.
 * @param {string|number} [category_id] - ID kategori sistem opsional untuk memfilter tiket.
 * @param {string} [startDate] - Tanggal mulai opsional (YYYY-MM-DD) untuk pemfilteran.
 * @param {string} [endDate] - Tanggal akhir opsional (YYYY-MM-DD) untuk pemfilteran.
 * @returns {Promise<Array<{count: number, lat: number, lng: number}>>} Sebuah promise yang me-resolve ke array objek kluster, masing-masing dengan jumlah dan koordinat centroid.
 */
async function getAggregatedTickets(tx, bounds, zoom, regionCode, category_id, startDate, endDate) {
  const { minLng, minLat, maxLng, maxLat } = bounds;

  const whereConditions = [];

  // Bangun kondisi WHERE dinamis
  whereConditions.push(Prisma.sql`t.coordinates IS NOT NULL`);
  whereConditions.push(
    Prisma.sql`t.coordinates && ST_MakeEnvelope(${minLng}, ${minLat}, ${maxLng}, ${maxLat}, 4326)`
  );

  if (regionCode) {
    if (regionCode.includes('-')) {
      const [kecCode, ...desaNameParts] = regionCode.split('-');
      const desaName = desaNameParts.join(' ');
      whereConditions.push(Prisma.sql`r.kode_kec = ${kecCode} AND r.nama = ${desaName}`);
    } else {
      const codeLength = regionCode.length;
      if (codeLength === 2) { // Provinsi
        whereConditions.push(Prisma.sql`r.kode_prov LIKE ${regionCode + '%'}`);
      } else if (codeLength === 5) { // Kab/Kota
        whereConditions.push(Prisma.sql`r.kode_kab LIKE ${regionCode + '%'}`);
      } else if (codeLength === 8) { // Kecamatan
        whereConditions.push(Prisma.sql`r.kode_kec LIKE ${regionCode + '%'}`);
      }
    }
  }

  if (category_id !== undefined && !isNaN(category_id)) {
    whereConditions.push(Prisma.sql`t.category_id = ${category_id}`);
  }

  // Tambahkan filter rentang tanggal jika disediakan
  if (startDate || endDate) {
    const dateFilter = getDateRangeFilter(startDate, endDate);
    whereConditions.push(Prisma.sql`t.created_at BETWEEN ${dateFilter.gte} AND ${dateFilter.lte}`);
  }

  let precision;
  if (zoom <= 5) {
    precision = 20.0;
  } else if (zoom == 6) {
    precision = 15.0;
  } else if (zoom == 7) {
    precision = 3.0;
  } else if (zoom == 8) {
    precision = 1.5;
  } else if (zoom == 9) {
    precision = 1.0;
  } else if (zoom == 10) {
    precision = 0.5;
  } else if (zoom == 11) {
    precision = 0.2;
  } else if (zoom == 12) {
    precision = 0.1;
  } else if (zoom == 13) {
    precision = 0.06;
  } else {
    precision = 0.03;
  }

  // Kueri SQL mentah untuk melakukan agregasi geospasial.
  // 1. ST_MakeEnvelope: Membuat poligon persegi panjang dari batas peta.
  // 2. ST_Within: Memfilter tiket yang berada di dalam poligon tersebut (menggunakan spatial index).
  // 3. GROUP BY: Mengelompokkan titik berdasarkan sel grid "tak terlihat" yang ukurannya ditentukan oleh 'precision'.
  // 4. COUNT(*): Menghitung jumlah tiket dalam setiap grup (kluster).
  // 5. ST_AsText(AVG(coordinates)): Menghitung titik pusat (centroid) dari setiap kluster.
  const clusters = await tx.$queryRaw`
    SELECT
      COUNT(*) as count,
      AVG(ST_X(t.coordinates)) as lng,
      AVG(ST_Y(t.coordinates)) as lat
    FROM
      tickets t
    JOIN
      regions r ON t.region_id = r.id
    WHERE
      ${Prisma.join(whereConditions, ' AND ')}
    GROUP BY
      ST_SnapToGrid(t.coordinates, ${precision})
  `;

  return clusters.map(cluster => ({
    count: Number(cluster.count),
    lng: Number(cluster.lng),
    lat: Number(cluster.lat),
  }));
}

export { getAggregatedTickets };
