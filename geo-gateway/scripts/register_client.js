import { PrismaClient } from '@prisma/client';
import * as jose from 'jose';
import { randomUUID } from 'crypto';
import fs from 'fs';
import path from 'path';
import readline from 'readline';

const prisma = new PrismaClient();

/**
 * Mem-parsing argumen command-line sederhana.
 * Contoh: --key "value" atau --flag
 */
function parseArgs() {
  const args = process.argv.slice(2);
  const result = {};
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg.startsWith('--')) {
      const key = arg.slice(2);
      let value = args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : true;
      result[key] = value;
      if (value !== true) i++;
    }
  }
  return result;
}

/**
 * Helper untuk mode interaktif.
 */
function askQuestion(rl, question) {
  return new Promise(resolve => rl.question(question, resolve));
}

/**
 * LOGIKA VERSI 2: Mode Non-Interaktif
 * Berjalan jika argumen --clientName dan --allowedOrigins diberikan.
 */
async function runNonInteractive(args) {
  const { 
    clientName, 
    allowedOrigins, 
    authMethod = 'client_credentials', // Default ke client_credentials
    publicKeyPath 
  } = args;

  // Semua output log/status ke stderr agar tidak mengganggu stdout
  console.error('--- Client Registration (Non-Interactive) ---');
  
  const origins = allowedOrigins.split(',').map(o => o.trim()).filter(Boolean);
  if (origins.length === 0) {
    throw new Error('Anda harus menyediakan setidaknya satu origin yang valid di --allowedOrigins.');
  }

  const clientId = `client_${randomUUID()}`;
  let publicKeyPem, privateKeyPem = null;
  
  console.error(`\nRegistering client with authentication method: ${authMethod}`);

  if (authMethod === 'private_key_jwt') {
    // Klien eksternal, kita hanya menyimpan public key mereka
    if (!publicKeyPath || !fs.existsSync(publicKeyPath)) {
      throw new Error(`--publicKeyPath diperlukan untuk metode private_key_jwt dan file harus ada. Diberikan: ${publicKeyPath}`);
    }
    console.error(`🔑 Membaca public key dari: ${publicKeyPath}`);
    publicKeyPem = fs.readFileSync(path.resolve(publicKeyPath), 'utf8');
    privateKeyPem = null; // Kunci privat dipegang oleh klien

  } else { 
    // Klien internal (client_credentials), kita buatkan key pair
    console.error('\n🔄 Menghasilkan key pair RS256 untuk klien internal...');
    const { publicKey, privateKey } = await jose.generateKeyPair('RS256');
    publicKeyPem = await jose.exportSPKI(publicKey);
    privateKeyPem = await jose.exportPKCS8(privateKey);
    console.error('✅ Key pair dihasilkan dan akan disimpan secara internal.');
  }

  console.error(`🔄 Menyimpan klien '${clientName}' ke database...`);
  const client = await prisma.client.create({
    data: {
      clientName: clientName,
      clientId,
      authMethod: authMethod,
      publicKey: publicKeyPem,
      privateKey: privateKeyPem,
      allowedOrigins: origins.join(','),
    },
  });

  console.error('\n--- ✅ Registrasi Klien Berhasil! ---');
  console.error(`Client Name: ${client.clientName}`);
  console.error(`Auth Method: ${client.authMethod}`);
  console.error(`Allowed Origins: ${client.allowedOrigins}`);
  console.error("\n🔑 **Client ID (Bagikan ini dengan klien):**");
  
  // SATU-SATUNYA output ke stdout adalah client ID.
  // Ini membuatnya bisa dibaca oleh skrip lain (machine-readable).
  console.log(client.clientId);
}

/**
 * LOGIKA VERSI 1: Mode Interaktif
 * Berjalan jika TIDAK ada argumen command-line.
 */
async function runInteractive() {
  console.log('--- Client Registration (Interactive) ---');
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  try {
    const friendlyName = await askQuestion(rl, '➡️ Masukkan nama klien (misal, react-frontend-app): ');
    if (!friendlyName) throw new Error('Nama klien tidak boleh kosong.');

    const originsInput = await askQuestion(rl, '➡️ Masukkan origins yang diizinkan (pisahkan koma, misal, http://localhost:5173): ');
    if (!originsInput) throw new Error('Origins tidak boleh kosong.');
    
    const allowedOrigins = originsInput.split(',').map(o => o.trim()).filter(Boolean);
    if (allowedOrigins.length === 0) throw new Error('Anda harus menyediakan setidaknya satu origin yang valid.');

    // Mode interaktif diasumsikan untuk klien internal (client_credentials)
    // Kita akan menghasilkan dan menyimpan key pair untuknya.
    
    console.log('\n🔄 Menghasilkan key pair RS256...'); // Gunakan RS256 agar konsisten
    const { publicKey, privateKey } = await jose.generateKeyPair('RS256');
    const publicKeyPem = await jose.exportSPKI(publicKey);
    const privateKeyPem = await jose.exportPKCS8(privateKey);
    console.log('✅ Key pair dihasilkan.');

    const clientId = `client_${randomUUID()}`;

    console.log(`🔄 Menyimpan klien '${friendlyName}' ke database...`);
    const client = await prisma.client.create({
      data: {
        clientName: friendlyName,
        clientId,
        authMethod: 'client_credentials', // Default untuk klien internal/interaktif
        publicKey: publicKeyPem,
        privateKey: privateKeyPem,
        allowedOrigins: allowedOrigins.join(','),
      },
    });

    console.log('\n--- ✅ Registrasi Klien Berhasil! ---');
    console.log(`Client Name: ${friendlyName}`);
    console.log(`Auth Method: client_credentials`);
    console.log(`Allowed Origins: ${client.allowedOrigins}`);
    console.log("\n🔒 Kunci privat disimpan dengan aman di database.");
    console.log("\n🔑 **Client ID (untuk digunakan di .env frontend):**");
    console.log(`   ${client.clientId}`);
    console.log('--------------------------------------------------');

  } finally {
    rl.close(); // Pastikan readline ditutup di mode interaktif
  }
}

/**
 * Fungsi Main
 * Memutuskan mode mana yang akan dijalankan.
 */
async function main() {
  try {
    const args = parseArgs();
    
    // Logika utama: Cek jika argumen yang diperlukan ada
    if (args.clientName && args.allowedOrigins) {
      // Jika ya, jalankan mode Non-Interaktif (v2)
      await runNonInteractive(args);
    } else {
      // Jika tidak, jalankan mode Interaktif (v1)
      await runInteractive();
    }
    
  } catch (error) {
    console.error('\n❌ Terjadi kesalahan saat registrasi klien:', error.message);
    process.exit(1);
  } finally {
    // Pastikan koneksi prisma selalu ditutup
    await prisma.$disconnect();
  }
}

// Jalankan fungsi main
main();