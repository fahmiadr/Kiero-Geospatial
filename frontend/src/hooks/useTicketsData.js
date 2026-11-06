import { useState, useEffect, useRef, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getMapDataFromWorker, getTicketDetails } from '../utils/ticketService';

const EMPTY_ARRAY = [];
const TICKETS_DATA_CACHE_DURATION_MS = 60 * 1000;

/**
 * Hook kustom untuk mengelola pengambilan data tiket peta melalui Web Worker.
 * Hook ini menginisialisasi worker, menangani komunikasi dua arah (termasuk permintaan data
 * dari worker ke main thread untuk caching), dan mengelola state data, pemuatan, dan kesalahan.
 *
 * @param {string | null} regionCode - Kode wilayah yang aktif untuk pemfilteran.
 * @param {string | null} categoryId - ID kategori sistem yang aktif untuk pemfilteran.
 * @param {string} mapViewMode - Mode tampilan peta saat ini (misalnya, 'region-only').
 * @param {string} startDate - Tanggal mulai untuk filter, format YYYY-MM-DD.
 * @param {string} endDate - Tanggal akhir untuk filter, format YYYY-MM-DD.
 * @returns {{
 *   mapData: Array<object>;
 *   isMapDataLoading: boolean;
 *   mapDataError: string | null;
 *   updateMapView: (bounds: object, zoom: number) => void;
 * }} Objek yang berisi data peta, status pemuatan, kesalahan, dan fungsi untuk memperbarui tampilan.
 */
export const useTicketsData = (regionCode, categoryId, mapViewMode, startDate, endDate) => {
  const [mapData, setMapData] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const workerRef = useRef(null);

  const cacheRef = useRef(new Map());

  useEffect(() => {
    const worker = new Worker(new URL('../workers/mapDataWorker.js', import.meta.url), {
      type: 'module',
    });
    workerRef.current = worker;

    worker.onmessage = async (event) => {
      const { type, payload, error: errorMessage } = event.data;
      switch (type) {
        case 'fetchData': {
          const apiPath = payload.apiPath;
          try {
            const cachedEntry = cacheRef.current.get(apiPath);
            const now = Date.now();

            if (cachedEntry && (now - cachedEntry.timestamp < TICKETS_DATA_CACHE_DURATION_MS)) {
              worker.postMessage({ type: 'dataFetched', payload: cachedEntry.data });
            } else {
              setIsLoading(true);
              setError(null);
              const responseJson = await getMapDataFromWorker(payload.apiPath);
              const actualMapData = responseJson.data ?? EMPTY_ARRAY;
              cacheRef.current.set(apiPath, { data: actualMapData, timestamp: Date.now() });
              worker.postMessage({ type: 'dataFetched', payload: actualMapData });
            }
          } catch (err) {
            console.error('Error saat mengambil data di main thread:', err);
            const message = err.message || 'Gagal mengambil data peta.';
            setError(message);
            setIsLoading(false);
            worker.postMessage({ type: 'fetchError', payload: { error: message } });
          }
          break;
        }
        case 'data': {
          setMapData(payload);
          setError(null);
          setIsLoading(false);
          break;
        }
        case 'error': {
          setError(errorMessage);
          setMapData(EMPTY_ARRAY);
          console.error('Error dari Map Data Worker:', errorMessage);
          setIsLoading(false);
          break;
        }
        default:
          console.warn('Tipe pesan worker tidak dikenal:', type);
      }
    };

    worker.onerror = (err) => {
      console.error('Terjadi error pada Worker:', err);
      setError('Terjadi kesalahan fatal pada worker data peta.');
      setIsLoading(false);
    };

    return () => {
      worker.terminate();
    };
  }, []);

  const updateMapView = useCallback((bounds, zoom) => {
    if (!regionCode || mapViewMode !== 'region-only' || !workerRef.current) {
      if (mapData.length > 0) {
        setMapData([]);
      }
      return;
    }

    if (!bounds || typeof bounds.west !== 'number' || typeof bounds.south !== 'number' || typeof bounds.east !== 'number' || typeof bounds.north !== 'number') {
      console.warn('updateMapView dipanggil dengan bounds tidak valid:', bounds);
      return;
    }

    workerRef.current.postMessage({
      type: 'mapChange',
      payload: {
        bounds,
        zoom,
        regionCode,
        categoryId,
        startDate,
        endDate,
      },
    });
  }, [regionCode, categoryId, mapViewMode, startDate, endDate, mapData.length]);

  return { mapData, isMapDataLoading: isLoading, mapDataError: error, updateMapView };
};

/**
 * Hook kustom untuk mengambil detail dari satu tiket tertentu berdasarkan ID-nya.
 * Menggunakan `@tanstack/react-query` untuk menangani caching dan state.
 * Query hanya aktif jika `ticketId` disediakan.
 *
 * @param {string | null} ticketId - ID tiket yang detailnya akan diambil.
 * @returns {import('@tanstack/react-query').UseQueryResult & { data: object|null, loading: boolean }}
 *   Hasil dari `useQuery`, diperkaya dengan alias `loading` dan `data` yang dijamin `null` jika tidak ada.
 */
export const useTicketDetails = (ticketId) => {
  const queryKey = ['ticketDetails', ticketId];

  const queryResult = useQuery({
    queryKey,
    queryFn: () => getTicketDetails(ticketId),
    staleTime: 1000 * 60 * 5, // 5 minutes
    cacheTime: 1000 * 60 * 30, // 30 minutes
    enabled: !!ticketId,
    refetchOnWindowFocus: false,
    retry: (failureCount, error) => {
      if (error.message.includes('404')) return false;
      return failureCount < 3;
    }
  });

  return { ...queryResult, loading: queryResult.isLoading, data: queryResult.data ?? EMPTY_ARRAY };
};
