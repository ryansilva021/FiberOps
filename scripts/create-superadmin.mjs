/**
 * scripts/create-superadmin.mjs
 *
 * Cria (ou atualiza) o usuário superadmin no MongoDB.
 * Lê MONGODB_URI do .env.local automaticamente.
 *
 * Uso:
 *   node scripts/create-superadmin.mjs
 *   node scripts/create-superadmin.mjs --username=admin --password=MinhaSenh@123
 *
 * Flags opcionais:
 *   --username=<str>   login do superadmin  (padrão: superadmin)
 *   --password=<str>   senha em texto claro (será solicitada interativamente se omitida)
 *   --force            sobrescreve superadmin existente sem perguntar
 */

import mongoose from 'mongoose'
import crypto from 'crypto'
import { createInterface } from 'readline'
import { readFileSync, existsSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

// ---------------------------------------------------------------------------
// Carrega .env.local manualmente (sem depender do Next.js)
// ---------------------------------------------------------------------------

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')

function loadEnv() {
  const envFile = resolve(ROOT, '.env.local')
  if (!existsSync(envFile)) return

  const lines = readFileSync(envFile, 'utf-8').split('\n')
  for (const raw of lines) {
    const line = raw.trim()
    if (!line || line.startsWith('#')) continue
    const eq = line.indexOf('=')
    if (eq === -1) continue
    const key = line.slice(0, eq).trim()
    let val = line.slice(eq + 1).trim()
    // Remove aspas envolventes
    if ((val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1)
    }
    if (!process.env[key]) process.env[key] = val
  }
}

loadEnv()

// ---------------------------------------------------------------------------
// Parse de argumentos CLI
// ---------------------------------------------------------------------------

const args = Object.fromEntries(
  process.argv.slice(2)
    .filter(a => a.startsWith('--'))
    .map(a => {
      const [k, ...v] = a.slice(2).split('=')
      return [k, v.length ? v.join('=') : true]
    })
)

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function ask(question, hidden = false) {
  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout })
    if (hidden) {
      // Oculta a digitação da senha
      process.stdout.write(question)
      process.stdin.setRawMode?.(true)
      let input = ''
      process.stdin.resume()
      process.stdin.setEncoding('utf8')
      process.stdin.once('data', function onData(ch) {
        // Fallback para terminais sem raw mode
        rl.close()
        resolve(ch.trim())
      })
      rl.on('line', (line) => {
        rl.close()
        process.stdout.write('\n')
        resolve(line)
      })
    } else {
      rl.question(question, (answer) => {
        rl.close()
        resolve(answer.trim())
      })
    }
  })
}

function hashPassword(plainPassword) {
  const ITERATIONS = 100_000
  const KEY_LENGTH = 32
  const DIGEST     = 'sha256'
  const salt       = crypto.randomBytes(16)

  return new Promise((resolve, reject) => {
    crypto.pbkdf2(plainPassword, salt, ITERATIONS, KEY_LENGTH, DIGEST, (err, derivedKey) => {
      if (err) return reject(err)
      resolve(`pbkdf2$${ITERATIONS}$${salt.toString('base64')}$${derivedKey.toString('base64')}`)
    })
  })
}

// ---------------------------------------------------------------------------
// Schema mínimo (inline — sem importar os modelos do Next.js)
// ---------------------------------------------------------------------------

const UserSchema = new mongoose.Schema(
  {
    username:             { type: String, required: true, unique: true, trim: true, lowercase: true },
    password_hash:        { type: String, required: true, select: false },
    role:                 { type: String, enum: ['superadmin','admin','tecnico','user'], default: 'user' },
    is_active:            { type: Boolean, default: true },
    projeto_id:           { type: String, required: true, default: 'default' },
    email:                { type: String, default: null },
    nome_completo:        { type: String, default: null },
    must_change_password: { type: Boolean, default: false },
    last_login:           { type: Date,    default: null },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }, collection: 'users' }
)

const User = mongoose.models.User || mongoose.model('User', UserSchema)

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const MONGODB_URI = process.env.MONGODB_URI
  if (!MONGODB_URI) {
    console.error('\n❌  MONGODB_URI não encontrada.')
    console.error('    Crie o arquivo .env.local com:\n')
    console.error('    MONGODB_URI=mongodb+srv://user:pass@cluster/ftthdb\n')
    process.exit(1)
  }

  // ── Coleta username ────────────────────────────────────────────────────────
  let username = args.username
  if (!username) {
    username = await ask('Username do superadmin [superadmin]: ')
    if (!username) username = 'superadmin'
  }
  username = username.toLowerCase().trim()

  if (!/^[a-z0-9_.-]+$/.test(username)) {
    console.error('❌  Username inválido. Use apenas letras minúsculas, números, _ . e -')
    process.exit(1)
  }

  // ── Coleta senha ───────────────────────────────────────────────────────────
  let password = args.password
  if (!password) {
    password = await ask('Senha: ', true)
    if (!password) {
      console.error('\n❌  Senha não pode ser vazia.')
      process.exit(1)
    }
    const confirm = await ask('Confirme a senha: ', true)
    if (password !== confirm) {
      console.error('\n❌  Senhas não conferem.')
      process.exit(1)
    }
    console.log('')
  }

  if (password.length < 8) {
    console.error('❌  Senha deve ter ao menos 8 caracteres.')
    process.exit(1)
  }

  // ── Conecta ao MongoDB ─────────────────────────────────────────────────────
  console.log('\n🔌  Conectando ao MongoDB...')
  await mongoose.connect(MONGODB_URI, { bufferCommands: false })
  console.log('✓   Conectado.')

  // ── Verifica se já existe ──────────────────────────────────────────────────
  const existing = await User.findOne({ username }).select('+password_hash').lean()

  if (existing) {
    if (existing.role === 'superadmin') {
      if (!args.force) {
        const confirm = await ask(
          `⚠️   Superadmin "${username}" já existe. Sobrescrever senha? [s/N]: `
        )
        if (confirm.toLowerCase() !== 's') {
          console.log('Cancelado.')
          await mongoose.disconnect()
          process.exit(0)
        }
      }
      console.log(`\n🔄  Atualizando senha de "${username}"...`)
    } else {
      console.error(`\n❌  Usuário "${username}" existe mas tem role "${existing.role}".`)
      console.error('    Use --force para sobrescrever ou escolha outro username.')
      await mongoose.disconnect()
      process.exit(1)
    }
  }

  // ── Gera hash da senha ─────────────────────────────────────────────────────
  console.log('🔐  Gerando hash da senha (PBKDF2, 100.000 iterações)...')
  const password_hash = await hashPassword(password)

  // ── Upsert ─────────────────────────────────────────────────────────────────
  await User.findOneAndUpdate(
    { username },
    {
      $set: {
        password_hash,
        role:                 'superadmin',
        is_active:            true,
        projeto_id:           'default',
        must_change_password: false,
      },
    },
    { upsert: true, returnDocument: 'after', runValidators: true }
  )

  console.log('\n✅  Superadmin criado com sucesso!')
  console.log(`    Username : ${username}`)
  console.log(`    Role     : superadmin`)
  console.log(`    Projeto  : default`)
  console.log(`    URL      : ${process.env.NEXTAUTH_URL ?? 'http://localhost:3000'}/login\n`)

  await mongoose.disconnect()
}

main().catch((err) => {
  console.error('\n❌  Erro inesperado:', err.message)
  process.exit(1)
})
