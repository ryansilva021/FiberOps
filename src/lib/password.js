/**
 * src/lib/password.js
 * Utilitários de senha — suporte a PBKDF2 legado e hash moderno.
 *
 * Formatos de hash suportados:
 *   1. PBKDF2 legado: "pbkdf2$<iterations>$<salt_b64>$<hash_b64>"
 *      - Derivado com SHA-256, salt e iterações variáveis
 *   2. SHA-256 simples legado: 64 caracteres hex (sem prefixo)
 *   3. Moderno: "pbkdf2$100000$<salt_b64>$<hash_b64>" (gerado por este módulo)
 *
 * Usa APENAS Node.js crypto (sem Web Crypto API) para compatibilidade
 * garantida em todos os runtimes do Next.js (Node, não Edge).
 */

import crypto from 'crypto'

const ITERATIONS  = 100_000
const KEY_LENGTH  = 32   // 256 bits
const DIGEST      = 'sha256'
const ENCODING    = 'base64'

// ---------------------------------------------------------------------------
// Verificação
// ---------------------------------------------------------------------------

/**
 * Verifica uma senha em texto claro contra um hash armazenado.
 * Suporta todos os formatos legados e o formato moderno.
 *
 * @param {string} plainPassword  — senha em texto claro
 * @param {string} storedHash     — hash conforme armazenado no banco
 * @returns {Promise<boolean>}
 */
export async function verifyPassword(plainPassword, storedHash) {
  if (!plainPassword || !storedHash) return false

  // Formato PBKDF2: "pbkdf2$<iter>$<salt>$<hash>"
  if (storedHash.startsWith('pbkdf2$')) {
    return verifyPBKDF2(plainPassword, storedHash)
  }

  // Formato SHA-256 simples legado: 64 hex chars
  if (/^[0-9a-f]{64}$/i.test(storedHash)) {
    return verifySHA256Simple(plainPassword, storedHash)
  }

  // Hash desconhecido — nunca autorizar
  return false
}

/**
 * Verifica senha contra hash PBKDF2 legado/moderno.
 * Formato: "pbkdf2$<iterations>$<salt_b64>$<hash_b64>"
 *
 * @param {string} plainPassword
 * @param {string} storedHash
 * @returns {Promise<boolean>}
 */
async function verifyPBKDF2(plainPassword, storedHash) {
  const parts = storedHash.split('$')
  if (parts.length !== 4) return false

  const [, iterStr, saltB64, hashB64] = parts
  const iterations = parseInt(iterStr, 10)
  if (!iterations || iterations < 1) return false

  const saltBuffer = Buffer.from(saltB64, ENCODING)
  const expectedBuffer = Buffer.from(hashB64, ENCODING)

  return new Promise((resolve) => {
    crypto.pbkdf2(
      plainPassword,
      saltBuffer,
      iterations,
      KEY_LENGTH,
      DIGEST,
      (err, derivedKey) => {
        if (err) return resolve(false)
        // timingSafeEqual previne timing attacks
        try {
          resolve(crypto.timingSafeEqual(derivedKey, expectedBuffer))
        } catch {
          resolve(false)
        }
      }
    )
  })
}

/**
 * Verifica senha contra SHA-256 simples (sistema legado sem salt).
 *
 * @param {string} plainPassword
 * @param {string} storedHash  — 64 hex chars
 * @returns {boolean}
 */
function verifySHA256Simple(plainPassword, storedHash) {
  const hash = crypto
    .createHash('sha256')
    .update(plainPassword)
    .digest('hex')

  try {
    return crypto.timingSafeEqual(
      Buffer.from(hash, 'hex'),
      Buffer.from(storedHash.toLowerCase(), 'hex')
    )
  } catch {
    return false
  }
}

// ---------------------------------------------------------------------------
// Hash para novas senhas
// ---------------------------------------------------------------------------

/**
 * Gera um hash PBKDF2 seguro para uma nova senha.
 * Retorna string no formato "pbkdf2$100000$<salt_b64>$<hash_b64>".
 *
 * @param {string} plainPassword
 * @returns {Promise<string>}
 */
export async function hashPassword(plainPassword) {
  const salt = crypto.randomBytes(16)

  return new Promise((resolve, reject) => {
    crypto.pbkdf2(
      plainPassword,
      salt,
      ITERATIONS,
      KEY_LENGTH,
      DIGEST,
      (err, derivedKey) => {
        if (err) return reject(err)
        const saltB64 = salt.toString(ENCODING)
        const hashB64 = derivedKey.toString(ENCODING)
        resolve(`pbkdf2$${ITERATIONS}$${saltB64}$${hashB64}`)
      }
    )
  })
}
