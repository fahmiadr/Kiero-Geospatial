import * as jose from 'jose';
import fs from 'fs';
import path from 'path'; 
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function generateKeys() {
  console.log('Generating RSA keys (RS256) for the gateway...');

  try {
    // Menggunakan RSA-SHA256
    const { privateKey, publicKey } = await jose.generateKeyPair('RS256');
    const privateKeyPem = await jose.exportPKCS8(privateKey);
    const publicKeyPem = await jose.exportSPKI(publicKey);

    const privateKeyPath = path.join(__dirname, '..', 'gateway_private.pem');
    const publicKeyPath = path.join(__dirname, '..', 'gateway_public.pem');

    fs.writeFileSync(privateKeyPath, privateKeyPem);
    fs.writeFileSync(publicKeyPath, publicKeyPem);

    console.log('✅ Gateway RSA keys generated successfully!');
    console.log(`   - Private Key saved to: ${privateKeyPath}`);
    console.log(`   - Public Key saved to: ${publicKeyPath}`);
    console.log('\n🔒 IMPORTANT: Secure the gateway_private.pem file. Do not commit it to version control.');

  } catch (error) {
    console.error('❌ Failed to generate keys:', error);
  }
}

generateKeys();
