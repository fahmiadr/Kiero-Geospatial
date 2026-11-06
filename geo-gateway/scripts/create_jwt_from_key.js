import * as jose from 'jose';
import * as fs from 'fs';
import * as path from 'path';

function parseArgs() {
    const args = process.argv.slice(2);
    const result = {};
    for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        if (arg.startsWith('--')) {
            const key = arg.slice(2);
            const value = args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : true;
            result[key] = value;
            if (value !== true) i++;
        }
    }
    return result;
}

async function createJwtFromKey() {
    try {
        const args = parseArgs();
        const { clientId, privateKeyPath } = args;

        if (!clientId || !privateKeyPath) {
            throw new Error('Usage: node create_jwt_from_key.js --clientId <clientId> --privateKeyPath <path/to/private_key.pem>');
        }
        
        if (!fs.existsSync(privateKeyPath)) {
            throw new Error(`Private key file not found at: ${privateKeyPath}`);
        }

        const privateKeyPem = fs.readFileSync(path.resolve(privateKeyPath), 'utf8');
        const privateKey = await jose.importPKCS8(privateKeyPem, 'RS256');

        const audience = process.env.GATEWAY_URL ? `${process.env.GATEWAY_URL}/oauth/token` : 'http://localhost:4000/oauth/token';

        const jwt = await new jose.SignJWT({})
            .setProtectedHeader({ alg: 'RS256' })
            .setIssuedAt()
            .setIssuer(clientId)
            .setSubject(clientId)
            .setAudience(audience)
            .setExpirationTime('1h')
            .sign(privateKey);

        // Output the JWT to stdout so it can be captured by the shell script
        console.log(jwt);

    } catch (error) {
        console.error('Failed to create JWT from key:', error.message);
        process.exit(1);
    }
}

createJwtFromKey();
