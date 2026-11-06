import prisma from '../config/prismaClient.js';

/**
 * Menemukan awalan nomor telepon terpanjang yang cocok di database untuk nomor telepon yang diberikan.
 * Fungsi ini secara iteratif memperpendek nomor telepon dari belakang dan melakukan query ke database
 * hingga awalan yang cocok ditemukan.
 * @async
 * @param {string} phoneNumber - Nomor telepon lengkap untuk dicari.
 * @returns {Promise<import('@prisma/client').phone_prefixes | null>} Sebuah promise yang me-resolve ke objek phone_prefixes Prisma yang cocok atau null jika tidak ada yang cocok.
 */
async function findLongestPrefix(phoneNumber) {
  let longestPrefix = null;
  for (let i = phoneNumber.length; i > 0; i--) {
    const currentPrefix = phoneNumber.substring(0, i);
    const prefix = await prisma.phone_prefixes.findUnique({
      where: { prefix: currentPrefix },
    });
    if (prefix) {
      longestPrefix = prefix;
      break;
    }
  }
  return longestPrefix;
}

/**
 * Mencari awalan nomor telepon dan mengembalikan cakupan geografisnya.
 * Fungsi ini pertama-tama menemukan awalan terpanjang yang cocok, kemudian mengambil semua wilayah
 * yang terkait. Fungsi ini menggabungkan geometri dari wilayah-wilayah tersebut menjadi satu
 * GeoJSON FeatureCollection yang merepresentasikan total area cakupan.
 * @export
 * @async
 * @param {string} phoneNumber - Nomor telepon atau awalan yang akan dicari.
 * @returns {Promise<{matchedPrefix: string|null, regions: Array<{name: string, code: string, level: string}>, geoJson: object}>} Sebuah promise yang me-resolve ke objek yang berisi awalan yang cocok, daftar wilayah yang dicakup, dan geometri GeoJSON gabungan.
 */
export async function searchPrefixes(phoneNumber) {
  const matchedPrefix = await findLongestPrefix(phoneNumber);

  if (!matchedPrefix) {
    return {
      matchedPrefix: null,
      regions: [],
      geoJson: {
        "type": "FeatureCollection",
        "features": []
      }
    };
  }

  const prefixRegions = await prisma.phone_prefix_regions.findMany({
    where: { phone_prefix_id: matchedPrefix.id },
    include: {
      regions: true,
    },
  });

  const regionIds = prefixRegions.map(pr => pr.region_id);
  const regions = prefixRegions.map(pr => ({
    name: pr.regions.nama,
    code: pr.regions.kode_kab || pr.regions.kode_prov,
    level: pr.regions.level,
  }));

  if (regionIds.length === 0) {
    return {
      matchedPrefix: matchedPrefix.prefix,
      regions: [],
      geoJson: { type: 'FeatureCollection', features: [] },
    };
  }

  const geoJsonResult = await prisma.$queryRaw`
    SELECT json_build_object(
      'type', 'FeatureCollection',
      'features', json_agg(
        json_build_object(
          'type', 'Feature',
          'geometry', ST_AsGeoJSON(sub.unioned_geom)::json,
          'properties', json_build_object('name', ${`Cakupan Prefix ${matchedPrefix.prefix}`})
        )
      )
    ) as "geoJson"
    FROM (
      SELECT ST_Union(ST_MakeValid(geom)) as unioned_geom
      FROM regions
      WHERE id = ANY(${regionIds})
    ) AS sub
    WHERE sub.unioned_geom IS NOT NULL
  `;

  return {
    matchedPrefix: matchedPrefix.prefix,
    regions: regions,
    geoJson: geoJsonResult[0].geoJson,
  };
}
