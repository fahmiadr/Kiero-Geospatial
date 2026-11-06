import { runMissedTasks } from '../services/archiveService.js';
import fs from 'fs/promises';
import path from 'path';

// --- Konfigurasi Tes ---
// berpura-pura log dari Agt & Sep 2025 terlewat.
const MONTH_TO_PROCESS_1 = '2025-08';
const MONTH_TO_PROCESS_2 = '2025-09';
// Bulan terakhir yang HARUSNYA selesai (Sept 2025)
const FINAL_STATUS_MONTH = MONTH_TO_PROCESS_2; 

const logDir = path.resolve('logs');
const archiveDir = path.resolve('archives');
// -------------------------

/**
 * Helper untuk membuat folder log harian palsu
 */
async function createFakeLog(monthString, day) {
  const folderName = `geo_gateway_${monthString}-${day}_logs`;
  const fileName = `geo_gateway_${monthString}-${day}-info.log`;
  const folderPath = path.join(logDir, folderName);
  const filePath = path.join(folderPath, fileName);

  try {
    await fs.mkdir(folderPath, { recursive: true });
    await fs.writeFile(filePath, `[${new Date().toISOString()}] INFO: Ini adalah log palsu untuk ${monthString}-${day}`);
    return folderName;
  } catch (err) {
    console.error(`Gagal membuat log palsu untuk ${monthString}-${day}`, err);
  }
}

/**
 * 1. Membersihkan lingkungan tes
 */
async function setupTestEnvironment() {
  console.log('Membersihkan lingkungan tes...');
  try {
    // Hapus folder arsip lama dan status untuk tes yang bersih
    await fs.rm(archiveDir, { recursive: true, force: true });
  } catch (err) {
  }
  
  await fs.mkdir(logDir, { recursive: true });
  await fs.mkdir(archiveDir, { recursive: true });

  console.log('Membuat log harian palsu...');
  // Buat 2 log untuk bulan pertama
  await createFakeLog(MONTH_TO_PROCESS_1, '05');
  await createFakeLog(MONTH_TO_PROCESS_1, '20');
  
  // Buat 2 log untuk bulan kedua
  await createFakeLog(MONTH_TO_PROCESS_2, '10');
  await createFakeLog(MONTH_TO_PROCESS_2, '25');
  
  console.log('Setup selesai. Folder log palsu telah dibuat di "logs/".');
}

/**
 * 3. Memverifikasi hasil
 */
async function verifyResults() {
  console.log('Memverifikasi hasil...');
  let hasErrors = false;

  const archive1 = path.join(archiveDir, `logs-${MONTH_TO_PROCESS_1}.zip`);
  const archive2 = path.join(archiveDir, `logs-${MONTH_TO_PROCESS_2}.zip`);
  const statusFile = path.join(archiveDir, 'task_status.json');
  
  // Verifikasi 1: File Zip ada
  try {
    await fs.stat(archive1);
    console.log(`✅ SUKSES: File arsip "${archive1}" telah dibuat.`);
  } catch (e) {
    console.error(`❌ GAGAL: File arsip "${archive1}" TIDAK ditemukan.`);
    hasErrors = true;
  }
  try {
    await fs.stat(archive2);
    console.log(`✅ SUKSES: File arsip "${archive2}" telah dibuat.`);
  } catch (e) {
    console.error(`❌ GAGAL: File arsip "${archive2}" TIDAK ditemukan.`);
    hasErrors = true;
  }

  // Verifikasi 2: File status JSON
  try {
    const statusData = await fs.readFile(statusFile, 'utf-8');
    const status = JSON.parse(statusData);
    if (status.lastProcessedMonth === FINAL_STATUS_MONTH) {
      console.log(`✅ SUKSES: File status "task_status.json" benar ("${status.lastProcessedMonth}").`);
    } else {
      console.error(`❌ GAGAL: File status "task_status.json" salah. Isi:`, statusData);
      hasErrors = true;
    }
  } catch (e) {
    console.error(`❌ GAGAL: File status "task_status.json" TIDAK ditemukan.`);
    hasErrors = true;
  }
  
  // Verifikasi 3: Folder log asli telah dihapus
  try {
    const logFolder1 = path.join(logDir, `geo_gateway_${MONTH_TO_PROCESS_1}-05_logs`);
    await fs.stat(logFolder1);
    // Jika 'stat' berhasil, berarti folder itu MASIH ADA (gagal)
    console.error(`❌ GAGAL: Folder log lama "${logFolder1}" TIDAK dihapus.`);
    hasErrors = true;
  } catch (e) {
    if (e.code === 'ENOENT') {
      console.log(`✅ SUKSES: Folder log lama untuk ${MONTH_TO_PROCESS_1} telah dihapus.`);
    }
  }

  return hasErrors;
}

/**
 * Fungsi utama untuk menjalankan tes
 */
async function runTest() {
  try {
    console.log('--- [MULAI TES PENGARSIPAN] ---');
    
    // 1. Setup
    await setupTestEnvironment();
    
    console.log('\nTekan Enter untuk melanjutkan dan menjalankan tugas arsip...');
    await new Promise(resolve => process.stdin.once('data', resolve));
    
    // 2. Eksekusi
    console.log('\n--- [MENJALANKAN runMissedTasks()] ---');
    await runMissedTasks();
    console.log('--- [TUGAS SELESAI] ---');
    
    // 3. Verifikasi
    console.log('\n--- [MEMVERIFIKASI HASIL] ---');
    const errors = await verifyResults();
    
    if (errors) {
      console.log('\n--- [HASIL TES: GAGAL] ---');
      console.log('Beberapa verifikasi gagal. Periksa log di atas.');
    } else {
      console.log('\n--- [HASIL TES: SUKSES] ---');
      console.log('Semua arsip dibuat dan dibersihkan dengan benar.');
    }
    
  } catch (error) {
    console.error('\n--- [TES GAGAL FATAL] ---');
    console.error(error);
  }
}

runTest();