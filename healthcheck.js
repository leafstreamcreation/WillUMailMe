require('dotenv').config();
const http = require('http');
const crypto = require('node:crypto').webcrypto;

const iv = crypto.getRandomValues(new Uint8Array(12));
const salt = crypto.getRandomValues(new Uint8Array(16));
const encodedCreds = new TextEncoder().encode(process.env.API_KEY_SECRET);
const baseKey = await crypto.subtle.importKey(
    "raw",
    encodedCreds,
    { name: "PBKDF2" },
    false,
    ["deriveKey"],
);
const key = await crypto.subtle.deriveKey(
  {
      name: "PBKDF2",
      salt,
      iterations: process.env.PBKDF2_ITERATIONS,
      hash: "SHA-256",
  },
  baseKey,
  { name: "AES-GCM", length: 256 },
  true,
  ["encrypt", "decrypt"],
  );


  const plaintext = new TextEncoder().encode(process.env.API_KEY_CIPHER);
  const encrypted = await crypto.subtle.encrypt(
  {
    name: "AES-GCM",
    iv,
    tagLength: process.env.AES_TAG_LENGTH,
  },
  key,
  plaintext,
);
const apiKey = new Uint8Array(encrypted);

const body = {
    iv: iv,
    salt: salt
};

http.request({
  method: 'POST',
  hostname: 'localhost',
  port: 3000,
  path: '/health',
  headers: {
    'Content-Type': 'application/json',
    'x-api-key': apiKey,
    'content-length': Buffer.byteLength(JSON.stringify(body))
  },
  body: JSON.stringify({
    iv: Array.from(iv),
    salt: Array.from(salt)
  })
}, (res) => { process.exit(res.statusCode === 200 ? 0 : 1) }).on('error', () => process.exit(1));
