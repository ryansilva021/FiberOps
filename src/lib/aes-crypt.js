/**
 * src/lib/aes-crypt.js
 * AES-256-CBC encryption/decryption using Node.js built-in crypto.
 *
 * Environment variables:
 *   NOC_AES_KEY — 32-character key (preferred)
 *   NEXTAUTH_SECRET — fallback; SHA-256 hash is used as key
 *
 * Cipher format: "${ivHex}:${cipherBase64}"
 */

import crypto from 'crypto'

const ALGORITHM = 'aes-256-cbc'
const IV_LENGTH = 16 // AES block size

/**
 * Derives the 32-byte AES key from environment variables.
 * Priority: NOC_AES_KEY (first 32 chars) > SHA-256(NEXTAUTH_SECRET) > SHA-256('fallback')
 *
 * @returns {Buffer} 32-byte key buffer
 */
function getKey() {
  const rawKey = process.env.NOC_AES_KEY
  if (rawKey && rawKey.length >= 32) {
    return Buffer.from(rawKey.slice(0, 32), 'utf8')
  }

  const secret = process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET || 'fallback-insecure-key'
  return crypto.createHash('sha256').update(secret).digest()
}

/**
 * Encrypts plaintext using AES-256-CBC with a random IV.
 *
 * @param {string} text - Plaintext to encrypt
 * @returns {string} Encrypted string in format "${ivHex}:${cipherBase64}"
 */
export function encrypt(text) {
  const key    = getKey()
  const iv     = crypto.randomBytes(IV_LENGTH)
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv)

  const encrypted = Buffer.concat([
    cipher.update(String(text), 'utf8'),
    cipher.final(),
  ])

  return `${iv.toString('hex')}:${encrypted.toString('base64')}`
}

/**
 * Decrypts a ciphertext produced by encrypt().
 *
 * @param {string} enc - Encrypted string in format "${ivHex}:${cipherBase64}"
 * @returns {string} Decrypted plaintext
 * @throws {Error} If the format is invalid or decryption fails
 */
export function decrypt(enc) {
  if (!enc || typeof enc !== 'string') {
    throw new Error('Invalid encrypted value: expected "ivHex:cipherBase64"')
  }

  const colonIdx = enc.indexOf(':')
  if (colonIdx === -1) {
    throw new Error('Invalid encrypted format: missing ":" separator')
  }

  const ivHex       = enc.slice(0, colonIdx)
  const cipherB64   = enc.slice(colonIdx + 1)

  const key      = getKey()
  const iv       = Buffer.from(ivHex, 'hex')
  const cipherBuf = Buffer.from(cipherB64, 'base64')

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv)
  const decrypted = Buffer.concat([decipher.update(cipherBuf), decipher.final()])

  return decrypted.toString('utf8')
}
