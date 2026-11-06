import * as jose from 'jose';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

// Since we are in an ES module, __dirname is not available.
// We can create it using import.meta.url.
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function generateTestAssertion() {
    try {
        console.log('Generating a test JWT Assertion...');

        // Path to the private key relative to this script
        const privateKeyPath = path.resolve(__dirname, '../gateway_private.pem');

        // Check if the key file exists
        if (!fs.existsSync(privateKeyPath)) {
            console.error(`Error: Private key not found at ${privateKeyPath}`);
            console.error('Please run "npm run generate_gateway_keys" in the geo-gateway directory first.');
            process.exit(1);
        }

        const privateKeyPem = fs.readFileSync(privateKeyPath, 'utf8');
        const privateKey = await jose.importPKCS8(privateKeyPem, 'RS256');

        // The 'sub' (subject) claim should be the Client ID of the external application.
        // For this test, we'll use the VITE_CLIENT_ID from the frontend's .env file,
        // as this is the client the gateway will recognize.
        const clientId = process.env.VITE_CLIENT_ID || 'mapp-frontend-client';
        
        // The 'aud' (audience) claim should be the URL of the token endpoint.
        const audience = process.env.GATEWAY_URL ? `${process.env.GATEWAY_URL}/oauth/token` : 'http://localhost:4000/oauth/token';

        const jwt = await new jose.SignJWT({
                // You can add other claims here if your auth server requires them
            })
            .setProtectedHeader({ alg: 'RS256' })
            .setIssuedAt()
            .setIssuer(clientId) // 'iss' claim
            .setSubject(clientId) // 'sub' claim
            .setAudience(audience) // 'aud' claim
            .setExpirationTime('2h') // Token validity
            .sign(privateKey);

        console.log('\n--- Test JWT Assertion ---');
        console.log('Use this assertion in iframe-parent-simulator.html to test the iframe authentication flow.\n');
        console.log(jwt);
        console.log('\n--------------------------\n');

    } catch (error) {
        console.error('Failed to generate JWT Assertion:', error);
        process.exit(1);
    }
}

generateTestAssertion();
