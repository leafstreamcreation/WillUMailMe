import dotenv from 'dotenv';
dotenv.config();
import http from 'http';
import { webcrypto } from 'crypto';
const { subtle } = webcrypto;

const args = process.argv.slice(2);
const port = args[0] ? parseInt(args[0]) : 3000;

// Environment variables validation
const requiredEnvVars = [
  'API_KEY_SECRET',
  'API_KEY_CIPHER',
  'GCM_TAG_LENGTH',
  'PBKDF2_ITERATIONS',
  'API_KEY_IV_LENGTH',
  'API_KEY_SALT_LENGTH'
];

const missingEnvVars = requiredEnvVars.filter(varName => !process.env[varName]);
if (missingEnvVars.length > 0) {
  console.error('Missing required environment variables:', missingEnvVars.join(', '));
  process.exit(1);
}

const iv = webcrypto.getRandomValues(new Uint8Array(parseInt(process.env.API_KEY_IV_LENGTH)));
const salt = webcrypto.getRandomValues(new Uint8Array(parseInt(process.env.API_KEY_SALT_LENGTH)));
const encodedCreds = new TextEncoder().encode(process.env.API_KEY_SECRET);
const baseKey = await subtle.importKey(
    "raw",
    encodedCreds,
    { name: "PBKDF2" },
    false,
    ["deriveKey"],
);
const key = await subtle.deriveKey(
  {
      name: "PBKDF2",
      salt,
      iterations: parseInt(process.env.PBKDF2_ITERATIONS),
      hash: "SHA-256",
  },
  baseKey,
  { name: "AES-GCM", length: 256 },
  true,
  ["encrypt"],
  );


  const plaintext = new TextEncoder().encode(process.env.API_KEY_CIPHER);
  const encrypted = await subtle.encrypt(
  {
    name: "AES-GCM",
    iv,
    tagLength: parseInt(process.env.GCM_TAG_LENGTH),
  },
  key,
  plaintext,
);
const ciphertext = new Uint8Array(encrypted);
const fullKey = new Uint8Array(ciphertext.byteLength + iv.byteLength + salt.byteLength);

fullKey.set(ciphertext);
fullKey.set(iv, ciphertext.byteLength);
fullKey.set(salt, ciphertext.byteLength + iv.byteLength);

const apiKey = Buffer.from(fullKey).toString('base64');

http.request({
  method: 'POST',
  hostname: 'localhost',
  port: port,
  path: '/health',
  headers: {
    'Content-Type': 'application/json',
    'X-API-Key': apiKey
  }
}, (res) => {
  res.on('end', () => {
    process.exit(res.statusCode === 200 ? 0 : 1);
  });
  res.on('error', () => process.exit(1));
}).end();
