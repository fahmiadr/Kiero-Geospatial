import { useEffect } from 'react';

/**
 * Hook kustom untuk menyinkronkan state aplikasi (seleksi wilayah, pin aktif, kategori, tanggal)
 * dengan parameter query URL. Hook ini menggunakan `history.replaceState` untuk memperbarui URL
 * tanpa menambahkan entri baru ke riwayat browser, memungkinkan state untuk dibagikan dan
 * dipulihkan melalui URL.
 *
 * @param {object} selection - Objek seleksi wilayah administratif saat ini (misalnya, { provinceName, kabkotaName }).
 * @param {string|null} activePinId - ID dari pin yang sedang aktif, atau null.
 * @param {string|null} categorySelection - Kategori yang dipilih saat ini, atau null.
 * @param {boolean} isEnabled - Bendera untuk mengaktifkan atau menonaktifkan eksekusi hook, mencegah pembaruan URL yang tidak perlu saat startup.
 * @param {object} dateParams - Objek yang berisi parameter terkait tanggal.
 */
export const useUrlSync = (selection, activePinId, categorySelection, isEnabled, dateParams) => {
  useEffect(() => {
    // Do not run the effect until the initial load/parsing is complete.
    if (!isEnabled) {
      return;
    }

    const params = new URLSearchParams(window.location.search);

    // Set name-based parameters
    if (selection.provinceName) params.set('provinsi', selection.provinceName);
    else params.delete('provinsi');

    if (selection.kabkotaName) params.set('kabkota', selection.kabkotaName);
    else params.delete('kabkota');

    if (selection.kecamatanName) params.set('kecamatan', selection.kecamatanName);
    else params.delete('kecamatan');

    if (selection.desaName) {
        params.set('desakel', selection.desaName);
    } else {
        params.delete('desakel');
    }

    // Keep active pin ID functionality
    if (activePinId) {
      params.set('active_pin_id', activePinId);
    } else {
      params.delete('active_pin_id');
    }

    // Handle category parameter
    if (categorySelection) {
      params.set('category', categorySelection);
    } else {
      params.delete('category');
    }

    // Handle date parameters
    if (dateParams) {
        if (dateParams.dateRange) {
            params.set('dateRange', dateParams.dateRange);
        } else {
            params.delete('dateRange');
        }

        if (dateParams.startDate) {
            params.set('startDate', dateParams.startDate);
        } else {
            params.delete('startDate');
        }

        if (dateParams.endDate) {
            params.set('endDate', dateParams.endDate);
        } else {
            params.delete('endDate');
        }
    }

    const newSearch = params.toString();
    const newUrl = newSearch ? `${window.location.pathname}?${newSearch}` : window.location.pathname;

    // Only update if the URL has actually changed
    if (newUrl !== `${window.location.pathname}${window.location.search}`) {
      window.history.replaceState({ ...window.history.state, ...selection, activePinId, categorySelection, ...dateParams }, '', newUrl);
    }
  }, [selection, activePinId, categorySelection, isEnabled, dateParams]);
};