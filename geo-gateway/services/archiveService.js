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
 * @private
 * @returns {Promise<string|null>} String bulan ("YYYY-MM") atau null.
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
 * Menulis bulan yang baru saja selesai diproses ke file status.
 * @private
 * @param {string} monthString - String bulan ("YYYY-MM").
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
 * Menghitung string "YYYY-MM" untuk bulan sebelumnya.
 * @private
 * @param {Date} date - Tanggal referensi.
 * @returns {string} String bulan yang diformat.
 */
function getPreviousMonthString(date) {
    const prevMonth = new Date(date.getFullYear(), date.getMonth() - 1, 1);
    const year = prevMonth.getFullYear();
    const month = (prevMonth.getMonth() + 1).toString().padStart(2, '0');
    return `${year}-${month}`;
}

/**
 * Menghitung string "YYYY-MM" untuk bulan berikutnya.
 * @private
 * @param {string} monthString - String bulan saat ini.
 * @returns {string} String bulan berikutnya yang diformat.
 */
function getNextMonthString(monthString) {
    const [year, month] = monthString.split('-').map(Number);
    const nextMonthDate = new Date(year, month, 1);

    const nextYear = nextMonthDate.getFullYear();
    const nextMonth = (nextMonthDate.getMonth() + 1).toString().padStart(2, '0');
    return `${nextYear}-${nextMonth}`;
}

/**
 * Mengarsipkan semua folder log harian untuk bulan tertentu ke dalam satu file zip,
 * lalu menghapus folder-folder asli.
 * @private
 * @param {string} monthString - Bulan ("YYYY-MM") yang akan diarsipkan.
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
        folder.startsWith(`geo_gateway_${monthString}`) && folder.endsWith('_logs')
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
 * Menghapus arsip log (.zip) yang usianya lebih dari satu tahun.
 * @private
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
 * Memindai direktori log untuk menemukan bulan tertua yang memiliki data log.
 * @private
 * @returns {Promise<string|null>} String bulan ("YYYY-MM") tertua atau null.
 */
async function findOldestLogMonth() {
  const logFolderRegex = /geo_gateway_(\d{4}-\d{2})-\d{2}_logs/;
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
 * Fungsi inti yang menjalankan tugas pengarsipan. Fungsi ini idempoten.
 * Akan mengejar semua tugas bulanan yang terlewat sejak eksekusi terakhir.
 * @export
 * @async
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
      
      await archiveLogsByMonth(currentMonthToProcess);
      
      await cleanupOldArchives();

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
 * Memulai penjadwal cron yang menjalankan tugas pengarsipan log.
 * Tugas ini berjalan pada pukul 02:00 pagi pada hari pertama setiap bulan.
 * @export
 */
export function startArchiveScheduler() {
    // '0 2 1 * *' = "Jam 2:00 pagi, pada hari pertama (1) setiap bulan (*)"
    schedule.scheduleJob('0 2 1 * *', runMissedTasks);

    console.log('[Archive] Scheduler started. Will run at 2:00 AM on the 1st of every month.');

    setTimeout(runMissedTasks, 10000);
}