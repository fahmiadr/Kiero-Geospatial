/**
 * @file mapDataWorker.js
 * Web Worker yang bertanggung jawab untuk memproses perubahan pada viewport peta (batas dan zoom)
 * dan filter, lalu membangun URL API yang sesuai. Worker ini menggunakan debounce untuk
 * mencegah permintaan berlebihan saat pengguna menggeser peta.
 *
 * Komunikasi:
 * - Menerima: Pesan 'mapChange' dari thread utama dengan detail viewport dan filter.
 * - Mengirim: Pesan 'fetchData' ke thread utama, memintanya untuk mengambil data dari URL API yang telah dibangun.
 * - Menerima: Pesan 'dataFetched' atau 'fetchError' kembali dari thread utama.
 * - Mengirim: Pesan 'data' atau 'error' kembali ke thread utama untuk memperbarui state UI.
 */

let debounceTimeout;

self.onmessage = (event) => {
  const { type, payload } = event.data;

  switch (type) {
    case 'mapChange': {
      const { bounds, zoom, regionCode, categoryId, startDate, endDate } = payload;

      if (debounceTimeout) {
        clearTimeout(debounceTimeout);
      }

      debounceTimeout = setTimeout(() => {
        if (!bounds || zoom === undefined) {
          console.error("Worker: bounds atau zoom tidak ada.");
          return;
        }
        const params = new URLSearchParams({
          minLng: bounds.west,
          minLat: bounds.south,
          maxLng: bounds.east,
          maxLat: bounds.north,
          zoom: zoom,
        });

        if (regionCode) {
          params.append('regionCode', regionCode);
        }
        if (categoryId) {
          params.append('category', categoryId);
        }

        if (startDate) {
          params.append('startDate', startDate);
        }

        if (endDate) {
          params.append('endDate', endDate);
        }

        const apiPath = `/api/v1/tickets/view?${params.toString()}`;
        self.postMessage({ type: 'fetchData', payload: { apiPath } });

      }, 200);
      break;
    }

    case 'dataFetched': {
      self.postMessage({ type: 'data', payload: payload });
      break;
    }

    case 'fetchError': {
      console.error('Terjadi kesalahan di dalam Map Data Worker (diterima dari main thread):', payload.error);
      self.postMessage({ type: 'error', error: payload.error });
      break;
    }
  }
};
