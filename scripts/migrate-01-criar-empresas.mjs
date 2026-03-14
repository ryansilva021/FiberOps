/**
 * scripts/migrate-01-criar-empresas.mjs
 *
 * Migração 01 — Cria Empresas a partir dos Projetos existentes.
 *
 * Para cada Projeto existente:
 *   - Cria uma Empresa com slug = projeto_id e razao_social = nome do projeto
 *   - Atualiza o Projeto com empresa_id (FK para a Empresa recém-criada)
 *
 * Idempotente: se a Empresa já existir (pelo slug), reutiliza e apenas
 * atualiza o projeto_id na lista de projetos da empresa.
 *
 * Uso:
 *   node scripts/migrate-01-criar-empresas.mjs
 *   node scripts/migrate-01-criar-empresas.mjs --dry-run   (apenas lista, não persiste)
 */

import mongoose from 'mongoose'
import { readFileSync, existsSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

// ---------------------------------------------------------------------------
// Carrega .env.local
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
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1)
    }
    if (!process.env[key]) process.env[key] = val
  }
}

loadEnv()

// ---------------------------------------------------------------------------
// Flags CLI
// ---------------------------------------------------------------------------

const args = process.argv.slice(2)
const DRY_RUN = args.includes('--dry-run')

if (DRY_RUN) {
  console.log('[migrate-01] Modo --dry-run ativo. Nenhuma alteracao sera salva.\n')
}

// ---------------------------------------------------------------------------
// Schemas inline (sem importar modelos do Next.js)
// ---------------------------------------------------------------------------

const ProjetoSchema = new mongoose.Schema(
  {
    projeto_id:  { type: String, required: true, unique: true, trim: true, lowercase: true },
    nome:        { type: String, required: true, trim: true },
    plano:       { type: String, default: 'basico' },
    ativo:       { type: Boolean, default: true },
    empresa_id:  { type: mongoose.Schema.Types.ObjectId, default: null, ref: 'Empresa' },
  },
  { timestamps: { createdAt: 'criado_em', updatedAt: 'updated_at' }, collection: 'projetos' }
)

const EmpresaSchema = new mongoose.Schema(
  {
    razao_social:       { type: String, required: true, trim: true },
    slug:               { type: String, required: true, unique: true, trim: true, lowercase: true },
    status_assinatura:  { type: String, enum: ['ativo', 'trial', 'vencido', 'bloqueado'], default: 'ativo' },
    plano:              { type: String, default: 'basico' },
    projetos:           { type: [String], default: [] },
    is_active:          { type: Boolean, default: true },
    trial_expira_em:    { type: Date, default: null },
    data_vencimento:    { type: Date, default: null },
    motivo_bloqueio:    { type: String, default: null },
    email_contato:      { type: String, default: null },
    telefone_contato:   { type: String, default: null },
  },
  { timestamps: { createdAt: 'criado_em', updatedAt: 'updated_at' }, collection: 'empresas' }
)

const Projeto = mongoose.models.Projeto || mongoose.model('Projeto', ProjetoSchema)
const Empresa = mongoose.models.Empresa || mongoose.model('Empresa', EmpresaSchema)

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const MONGODB_URI = process.env.MONGODB_URI
  if (!MONGODB_URI) {
    console.error('MONGODB_URI nao encontrada em .env.local')
    process.exit(1)
  }

  console.log('[migrate-01] Conectando ao MongoDB...')
  await mongoose.connect(MONGODB_URI, { bufferCommands: false })
  console.log('[migrate-01] Conectado.\n')

  const projetos = await Projeto.find().lean()
  console.log(`[migrate-01] ${projetos.length} projeto(s) encontrado(s).\n`)

  if (projetos.length === 0) {
    console.log('[migrate-01] Nenhum projeto para migrar. Encerrando.')
    await mongoose.disconnect()
    return
  }

  let criadas = 0
  let reutilizadas = 0
  let erros = 0

  for (const projeto of projetos) {
    const slug = projeto.projeto_id
    const nome = projeto.nome

    try {
      // Verifica se a empresa ja existe
      let empresa = await Empresa.findOne({ slug }).lean()

      if (empresa) {
        console.log(`  [reutilizar] slug="${slug}" — Empresa _id=${empresa._id}`)
        reutilizadas++
      } else {
        console.log(`  [criar]      slug="${slug}" nome="${nome}"`)

        if (!DRY_RUN) {
          empresa = await Empresa.create({
            razao_social:      nome,
            slug,
            status_assinatura: projeto.ativo ? 'ativo' : 'bloqueado',
            plano:             projeto.plano ?? 'basico',
            projetos:          [slug],
            is_active:         projeto.ativo ?? true,
          })
        }
        criadas++
      }

      if (!DRY_RUN && empresa) {
        // Garante que o projeto_id esta na lista de projetos da empresa
        await Empresa.updateOne(
          { _id: empresa._id },
          { $addToSet: { projetos: slug } }
        )

        // Atualiza o Projeto com empresa_id FK (somente se ainda nao tiver)
        if (!projeto.empresa_id) {
          await Projeto.updateOne(
            { _id: projeto._id },
            { $set: { empresa_id: empresa._id } }
          )
        }
      }
    } catch (err) {
      console.error(`  [erro]       slug="${slug}" — ${err.message}`)
      erros++
    }
  }

  console.log('\n[migrate-01] Resumo:')
  console.log(`  Empresas criadas     : ${criadas}`)
  console.log(`  Empresas reutilizadas: ${reutilizadas}`)
  console.log(`  Erros                : ${erros}`)

  if (DRY_RUN) {
    console.log('\n[migrate-01] Dry-run: nenhuma alteracao foi salva.')
  }

  await mongoose.disconnect()
  console.log('\n[migrate-01] Concluido.')
}

main().catch((err) => {
  console.error('\n[migrate-01] Erro fatal:', err.message)
  process.exit(1)
})
