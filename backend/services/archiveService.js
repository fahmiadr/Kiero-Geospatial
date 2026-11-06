import schedule from 'node-schedule';
import fs from 'fs/promises';
import fss from 'fs';
import path from 'path';
import archiver from 'archiver';

const logDir = path.resolve('logs');
const archiveDir = path.resolve('archives');
const stateFilePath = path.join(archiveDir, 'task_status.json');
let isTaskRunning = false;

/**
 * Membaca bulan terakhir yang berhasil diproses dari file status tugas.
 * Fungsi ini memastikan bahwa proses pengarsipan dapat dilanjutkan dari titik terakhir,
 * bahkan jika server dimulai ulang.
 * @returns {Promise<string|null>} Sebuah promise yang me-resolve ke string bulan terakhir yang diproses ("YYYY-MM") atau null jika tidak ditemukan.
 */
async function readLastProcessedMonth() {
    try {
        await fs.mkdir(archiveDir, { recursive: true });
        const data = await fs.readFile(stateFilePath, 'utf-8');
        const status = JSON.parse(data);
        return status.lastProcessedMonth || null;
    } catch (error) {
        if (error.code === 'ENOENT') {
            return null;
        }
        console.error('Error reading task status file:', error);
        return null;
    }
}

/**
 * Menulis bulan terbaru yang diproses ke file status tugas.
 * Ini adalah langkah penting untuk memastikan status tugas tersimpan secara persisten.
 * @param {string} monthString - String bulan ("YYYY-MM") yang baru saja berhasil diproses.
 * @returns {Promise<void>} Sebuah promise yang me-resolve ketika file telah ditulis.
 */
async function writeLastProcessedMonth(monthString) {
    try {
        const status = {
            lastProcessedMonth: monthString,
            updatedAt: new Date().toISOString()
        };
        await fs.writeFile(stateFilePath, JSON.stringify(status, null, 2));
    } catch (error) {
        console.error('CRITICAL: Failed to write task status file:', error);
    }
}

/**
 * Menghitung string bulan ("YYYY-MM") untuk bulan sebelum tanggal yang diberikan.
 * @param {Date} date - Tanggal referensi (biasanya tanggal saat ini).
 * @returns {string} String "YYYY-MM" yang diformat untuk bulan sebelumnya.
 */
function getPreviousMonthString(date) {
    const prevMonth = new Date(date.getFullYear(), date.getMonth() - 1, 1);
    const year = prevMonth.getFullYear();
    const month = (prevMonth.getMonth() + 1).toString().padStart(2, '0');
    return `${year}-${month}`;
}

/**
 * Menghitung string bulan berikutnya ("YYYY-MM") dari string bulan yang diberikan.
 * Ini digunakan untuk melakukan iterasi per bulan saat mengejar tugas yang terlewat.
 * @param {string} monthString - Bulan awal dalam format "YYYY-MM" (misalnya, "2025-09").
 * @returns {string} String "YYYY-MM" yang diformat untuk bulan berikutnya (misalnya, "2025-10").
 */
function getNextMonthString(monthString) {
    const [year, month] = monthString.split('-').map(Number);
    const nextMonthDate = new Date(year, month, 1);

    const nextYear = nextMonthDate.getFullYear();
    const nextMonth = (nextMonthDate.getMonth() + 1).toString().padStart(2, '0');
    return `${nextYear}-${nextMonth}`;
}

/**
 * Mengompres semua folder log harian untuk bulan tertentu ke dalam satu arsip .zip.
 * Setelah arsip berhasil dibuat, folder log harian asli akan dihapus untuk menghemat ruang.
 * @param {string} monthString - Bulan ("YYYY-MM") yang akan diarsipkan.
 * @returns {Promise<void>} Sebuah promise yang me-resolve ketika pengarsipan dan pembersihan untuk bulan itu selesai.
 */
async function archiveLogsByMonth(monthString) {
    await fs.mkdir(archiveDir, { recursive: true });
    const archiveName = `logs-${monthString}.zip`;
    const archivePath = path.join(archiveDir, archiveName);

    const output = fss.createWriteStream(archivePath);
    const archive = archiver('zip', { zlib: { level: 9 } });
    archive.pipe(output);

    const allLogFolders = await fs.readdir(logDir);
    const foldersToArchive = allLogFolders.filter(folder =>
        folder.startsWith(`backend_${monthString}`) && folder.endsWith('_logs')
    );

    if (foldersToArchive.length === 0) {
        console.log(`[Archive] No log folders found for ${monthString}. Skipping zip.`);
        return;
    }

    console.log(`[Archive] Archiving ${foldersToArchive.length} folders for ${monthString}...`);
    for (const folder of foldersToArchive) {
        const folderPath = path.join(logDir, folder);
        archive.directory(folderPath, folder);
    }

    await archive.finalize();
    console.log(`[Archive] Successfully created archive: ${archiveName}`);

    // Hapus folder harian SETELAH arsip sukses
    console.log(`[Archive] Cleaning up daily log folders for ${monthString}...`);
    for (const folder of foldersToArchive) {
        const folderPath = path.join(logDir, folder);
        await fs.rm(folderPath, { recursive: true, force: true });
    }
}

/**
 * Menghapus arsip log (.zip) yang lebih tua dari satu tahun.
 * Fungsi ini membantu mengelola ruang disk dengan menghapus data log lama yang kemungkinan tidak diperlukan.
 * @returns {Promise<void>} Sebuah promise yang me-resolve ketika pembersihan selesai.
 */
async function cleanupOldArchives() {
    console.log('[Archive] Cleaning up old archives...');
    const cutoffDate = new Date();
    cutoffDate.setFullYear(cutoffDate.getFullYear() - 1); // 1 tahun lalu

    try {
        const archiveFiles = await fs.readdir(archiveDir);
        for (const file of archiveFiles) {
            if (!file.startsWith('logs-') || !file.endsWith('.zip')) continue;

            const filePath = path.join(archiveDir, file);
            try {
                const stats = await fs.stat(filePath);
                if (stats.mtime < cutoffDate) {
                    await fs.rm(filePath);
                    console.log(`[Archive] Deleted old archive: ${file}`);
                }
            } catch (err) {
                console.error(`[Archive] Could not process archive file ${file}: ${err.message}`);
            }
        }
    } catch (error) {
        if (error.code !== 'ENOENT') {
            console.error('[Archive] Could not read archive directory:', error);
        }
    }
}

/**
 * Memindai direktori log untuk menemukan bulan tertua ("YYYY-MM") di mana folder log ada.
 * Ini digunakan pada saat layanan pengarsipan berjalan pertama kali untuk menentukan titik awal proses catch-up.
 * @returns {Promise<string|null>} Sebuah promise yang me-resolve ke string bulan tertua yang ditemukan, atau null jika tidak ada folder log.
 */
async function findOldestLogMonth() {
  const logFolderRegex = /backend_(\d{4}-\d{2})-\d{2}_logs/;
  let oldestMonth = null;

  try {
    const allFiles = await fs.readdir(logDir);
    const months = new Set();

    for (const file of allFiles) {
      const match = file.match(logFolderRegex);
      if (match && match[1]) {
        months.add(match[1]); // Menambahkan "YYYY-MM"
      }
    }

    if (months.size === 0) {
      return null; // Tidak ada folder log yang ditemukan
    }

    // Ubah Set menjadi array, urutkan, dan ambil yang pertama (terlama)
    oldestMonth = Array.from(months).sort()[0];
    return oldestMonth;

  } catch (error) {
    if (error.code === 'ENOENT') {
      console.log('[Archive] Log directory does not exist yet. Nothing to process.');
      return null;
    }
    console.error('[Archive] Error finding oldest log month:', error);
    return null;
  }
}

/**
 * Pelaksana tugas pengarsipan inti. Fungsi ini idempoten dan aman untuk dipanggil berkali-kali.
 * Fungsi ini memeriksa tugas-tugas pengarsipan yang terlewat (misalnya, karena server mati) dan memprosesnya secara berurutan.
 * Untuk eksekusi pertama kali, fungsi ini menemukan log tertua yang tersedia dan memproses semua bulan hingga bulan sebelumnya.
 * Untuk eksekusi berikutnya, fungsi ini memproses bulan secara bertahap.
 * @export
 * @async
 * @returns {Promise<void>} Sebuah promise yang me-resolve ketika semua tugas yang terlewat selesai.
 */
export async function runMissedTasks() {
  if (isTaskRunning) {
    console.log('[Archive] Task is already running. Skipping this run.');
    return;
  }
  
  isTaskRunning = true;
  console.log('[Archive] Checking for missed archival tasks...');

  try {
    let lastProcessedMonth = await readLastProcessedMonth(); // Misal: null
    const monthThatShouldBeDone = getPreviousMonthString(new Date()); // Misal: "2025-09"

    let firstMonthToProcess;

    if (lastProcessedMonth) {
      // KASUS NORMAL: Server sudah berjalan. Proses bulan berikutnya.
      firstMonthToProcess = getNextMonthString(lastProcessedMonth);
    } else {
      // KASUS FIRST RUN: Server baru saja diinstal.
      console.log('[Archive] First run detected. Finding oldest log month...');
      firstMonthToProcess = await findOldestLogMonth(); // Misal: "2025-08"

      if (!firstMonthToProcess) {
        console.log('[Archive] No log folders found. Nothing to process.');
        isTaskRunning = false;
        return;
      }
      console.log(`[Archive] Found oldest logs from: ${firstMonthToProcess}`);
    }

    let currentMonthToProcess = firstMonthToProcess; // Misal: "2025-08"

    while (currentMonthToProcess <= monthThatShouldBeDone) {
      console.log(`[Archive] Processing task for month: ${currentMonthToProcess}`);
      
      // 1. Arsipkan log bulan itu
      await archiveLogsByMonth(currentMonthToProcess);
      
      // 2. Bersihkan arsip TAHUNAN
      await cleanupOldArchives();

      // 3. PENTING: Perbarui status HANYA SETELAH sukses
      await writeLastProcessedMonth(currentMonthToProcess);
      
      console.log(`[Archive] Successfully processed task for ${currentMonthToProcess}.`);
      
      // Lanjut ke bulan berikutnya
      currentMonthToProcess = getNextMonthString(currentMonthToProcess);
    }

    console.log('[Archive] All tasks are up to date.');

  } catch (error) {
    console.error('[Archive] CRITICAL ERROR during task run:', error);
  } finally {
    isTaskRunning = false; // Selalu buka kunci
  }
}

/**
 * Menginisialisasi dan memulai tugas cron untuk layanan pengarsipan log.
 * Tugas dijadwalkan untuk berjalan pada pukul 02:00 pagi pada hari pertama setiap bulan.
 * Fungsi ini juga memicu eksekusi awal sesaat setelah server dimulai untuk mengejar tugas yang mungkin terlewat.
 * @export
 */
export function startArchiveScheduler() {
    // '0 2 1 * *' = "Jam 2:00 pagi, pada hari pertama (1) setiap bulan (*)"
    schedule.scheduleJob('0 2 1 * *', runMissedTasks);

    console.log('[Archive] Scheduler started. Will run at 2:00 AM on the 1st of every month.');

    setTimeout(runMissedTasks, 10000);
}