import fs from 'fs';
import crypto from 'crypto';

const secretKey = crypto.randomBytes(64).toString('hex');
const refreshSecretKey = crypto.randomBytes(64).toString('hex');
const envFilePath = '.env';

// read current .env
let envContent = '';
if (fs.existsSync(envFilePath)) {
  envContent = fs.readFileSync(envFilePath, 'utf8');
}

// remove current SECRET_KEY
envContent = envContent.replace(/^SECRET_KEY=.*(?:\r?\n)?/gm, '');
// remove current REFRESH_SECRET_KEY
envContent = envContent.replace(/^REFRESH_SECRET_KEY=.*(?:\r?\n)?/gm, '');

// add new SECRET_KEY
envContent = envContent.trim() + `\n\nSECRET_KEY=${secretKey}\nREFRESH_SECRET_KEY=${refreshSecretKey}`;

// write back to .env
fs.writeFileSync(envFilePath, envContent);

console.log('SECRET_KEY, REFRESH_SECRET_KEY generated and saved to .env file.');
