const fs = require('fs');
const crypto = require('crypto');

const secretKey = crypto.randomBytes(64).toString('hex');
const envFilePath = '.env';

// read current .env
let envContent = '';
if (fs.existsSync(envFilePath)) {
  envContent = fs.readFileSync(envFilePath, 'utf8');
}

// remove current SECRET_KEY
envContent = envContent.replace(/^SECRET_KEY=.*(?:\r?\n)?/gm, '');

// add new SECRET_KEY
envContent = envContent.trim() + `\nSECRET_KEY=${secretKey}`;

// write back to .env
fs.writeFileSync(envFilePath, envContent);

console.log('SECRET_KEY generated and saved to .env file.');
