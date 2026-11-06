import { Prisma } from '@prisma/client';

/**
 * Membuat objek filter tanggal yang kompatibel dengan Prisma dari string startDate dan endDate opsional.
 * Utilitas ini memusatkan logika untuk pemfilteran rentang tanggal. Jika `startDate` tidak disediakan,
 * defaultnya adalah 30 hari yang lalu. Jika `endDate` tidak disediakan, defaultnya adalah waktu saat ini.
 * Fungsi ini memastikan bahwa seluruh hari termasuk dalam rentang tersebut.
 *
 * @param {string} [startDate] - Tanggal mulai dalam format "YYYY-MM-DD".
 * @param {string} [endDate] - Tanggal akhir dalam format "YYYY-MM-DD".
 * @returns {{ gte: Date, lte: Date }} Sebuah objek dengan properti `gte` (lebih besar dari atau sama dengan) dan `lte` (kurang dari atau sama dengan),
 *   cocok untuk klausa `where` Prisma pada field DateTime.
 */
export const getDateRangeFilter = (startDate, endDate) => {
  let gte;
  let lte;

  if (startDate) {
    gte = new Date(`${startDate}T00:00:00.000Z`);
  } else {
    gte = new Date();
    gte.setDate(gte.getDate() - 30);
    gte.setUTCHours(0, 0, 0, 0);
  }

  if (endDate) {
    lte = new Date(`${endDate}T23:59:59.999Z`);
  } else {
    lte = new Date();
    lte.setUTCHours(23, 59, 59, 999);
  }

  return { gte, lte };
};

/**
 * Menghasilkan kondisi filter Prisma untuk kode wilayah hierarkis.
 * Fungsi ini menangani berbagai tingkat batas administratif (provinsi, kabupaten, kecamatan, desa)
 * dan dapat menghasilkan objek filter yang cocok untuk Prisma ORM (`'ORM'`) dan query SQL mentah (`'RAW'`).
 * Fungsi ini memusatkan logika untuk mem-parsing dan menginterpretasikan kode wilayah.
 *
 * @param {string} regionCode - Kode wilayah hierarkis. Bisa berupa kode provinsi ('31'), kode kabupaten ('31.71'),
 *   kode kecamatan ('31.71.01'), atau pengidentifikasi desa ('31.71.01-SomeDesa').
 * @param {'ORM' | 'RAW'} [queryType='ORM'] - Menentukan format output yang diinginkan untuk filter.
 *   'ORM' mengembalikan objek JavaScript untuk klausa `where` Prisma.
 *   'RAW' mengembalikan template literal `Prisma.sql` untuk digunakan di `$queryRaw`.
 * @returns {object | Prisma.Sql} Kondisi filter Prisma yang dihasilkan.
 * @throws {Error} Melemparkan error jika format `regionCode` tidak dikenali.
 */
export const getRegionFilter = (regionCode, queryType = 'ORM') => {
  if (regionCode.includes('-')) {
    const [kecCode, ...desaNameParts] = regionCode.split('-');
    const desaName = desaNameParts.join(' ');
    if (queryType === 'RAW') {
      return Prisma.sql`r.kode_kec = ${kecCode} AND r.nama = ${desaName}`;
    }
    return { kode_kec: kecCode, nama: desaName };
  }

  const codeLength = regionCode.length;
  if (codeLength === 2) { // Provinsi
    if (queryType === 'RAW') {
      return Prisma.sql`r.kode_prov LIKE ${regionCode + '%'}`;
    }
    return { kode_prov: { startsWith: regionCode } };
  }
  if (codeLength === 5) { // Kab/Kota
    if (queryType === 'RAW') {
      return Prisma.sql`r.kode_kab LIKE ${regionCode + '%'}`;
    }
    return { kode_kab: { startsWith: regionCode } };
  }
  if (codeLength === 8) { // Kecamatan
    if (queryType === 'RAW') {
      return Prisma.sql`r.kode_kec LIKE ${regionCode + '%'}`;
    }
    return { kode_kec: { startsWith: regionCode } };
  }

  throw new Error('Invalid regionCode format');
};
