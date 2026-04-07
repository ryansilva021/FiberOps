/**
 * scripts/seed-simulador.mjs
 *
 * Registra a OLT Huawei MA5800 do simulador (Provedor Virtual) no MongoDB
 * do projeto-externo, pronta para conexão via SSH.
 *
 * Pré-requisito: simulador rodando (`docker compose up -d` em provedor-virtual/)
 *
 * Uso:
 *   node scripts/seed-simulador.mjs
 *   node scripts/seed-simulador.mjs --projeto_id=meu-projeto
 */

import mongoose from 'mongoose'
import { readFileSync, existsSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')

// ── Carrega .env.local ─────────────────────────────────────────────────────

function loadEnv() {
  const envFile = resolve(ROOT, '.env.local')
  if (!existsSync(envFile)) return
  for (const raw of readFileSync(envFile, 'utf-8').split('\n')) {
    const line = raw.trim()
    if (!line || line.startsWith('#')) continue
    const eq  = line.indexOf('=')
    if (eq === -1) continue
    const key = line.slice(0, eq).trim()
    let   val = line.slice(eq + 1).trim()
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'")))
      val = val.slice(1, -1)
    if (!process.env[key]) process.env[key] = val
  }
}

loadEnv()

// ── Parse de args ──────────────────────────────────────────────────────────

const args = Object.fromEntries(
  process.argv.slice(2)
    .filter(a => a.startsWith('--'))
    .map(a => { const [k, ...v] = a.slice(2).split('='); return [k, v.join('=')] })
)

const PROJETO_ID = args.projeto_id ?? 'default'

// ── Schema mínimo (espelho do src/models/OLT.js) ──────────────────────────

const OLTSchema = new mongoose.Schema(
  {
    id:         { type: String, required: true, trim: true },
    projeto_id: { type: String, required: true, trim: true, default: 'default' },
    nome:       { type: String, required: true, trim: true },
    modelo:     { type: String, default: null },
    ip:         { type: String, default: null },
    ssh_user:   { type: String, default: 'admin' },
    ssh_pass:   { type: String, default: '' },
    ssh_port:   { type: Number, default: 22 },
    capacidade: { type: Number, default: 16 },
    status:     { type: String, default: 'ativo' },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }, collection: 'olts', id: false }
)

OLTSchema.index({ projeto_id: 1, id: 1 }, { unique: true })

const OLT = mongoose.models.OLT || mongoose.model('OLT', OLTSchema)

// ── OLTs do simulador ──────────────────────────────────────────────────────

const OLTS_SIMULADOR = [
  {
    id:         'olt-huawei-sim',
    projeto_id: PROJETO_ID,
    nome:       'OLT Huawei MA5800 (Simulador)',
    modelo:     'Huawei MA5800-X7',
    ip:         'localhost',   // acessível no host via porta mapeada
    ssh_user:   'admin',       // simulador aceita qualquer credencial
    ssh_pass:   'admin',
    ssh_port:   2222,          // porta mapeada no host pelo docker-compose
    capacidade: 16,
    status:     'ativo',
  },
]

// ── Main ───────────────────────────────────────────────────────────────────

async function main() {
  const MONGODB_URI = process.env.MONGODB_URI
  if (!MONGODB_URI) {
    console.error('\n❌  MONGODB_URI não encontrada. Crie o arquivo .env.local:\n')
    console.error('    MONGODB_URI=mongodb://admin:admin123@localhost:27017/ftth?authSource=admin\n')
    process.exit(1)
  }

  console.log(`\n🔌  Conectando ao MongoDB...`)
  await mongoose.connect(MONGODB_URI, { bufferCommands: false })
  console.log(`✓   Conectado.`)
  console.log(`    Projeto: ${PROJETO_ID}\n`)

  for (const data of OLTS_SIMULADOR) {
    const result = await OLT.findOneAndUpdate(
      { projeto_id: data.projeto_id, id: data.id },
      { $set: data },
      { upsert: true, returnDocument: 'after', runValidators: true }
    )
    console.log(`✓   OLT "${result.nome}" → ${result.ip}:${result.ssh_port} (id: ${result.id})`)
  }

  console.log('\n✅  Seed concluído!')
  console.log(`\n    Próximos passos:`)
  console.log(`    1. npm run dev  (no diretório projeto-externo)`)
  console.log(`    2. Acesse http://localhost:3000 e faça login`)
  console.log(`    3. A OLT "${OLTS_SIMULADOR[0].nome}" estará disponível\n`)

  await mongoose.disconnect()
}

main().catch(err => {
  console.error('\n❌  Erro:', err.message)
  process.exit(1)
})
