/**
 * scripts/migrate-02-empresa-id-em-docs.mjs
 *
 * Migração 02 — Propaga empresa_id para todos os documentos filhos.
 *
 * Lê o mapa projeto_id → empresa_id dos Projetos e aplica updateMany
 * nas coleções filhas que ainda nao possuem empresa_id.
 *
 * Colecoes atualizadas:
 *   users, ctos, caixas_emenda_cdo, rotas_fibras, postes,
 *   olts, movimentacoes, topologias, log_eventos, registros_pendentes
 *
 * Idempotente: filtra por `{ projeto_id, empresa_id: { $exists: false } }`
 * para nao sobrescrever documentos ja migrados.
 *
 * PRE-REQUISITO: rodar migrate-01-criar-empresas.mjs antes deste script.
 *
 * Uso:
 *   node scripts/migrate-02-empresa-id-em-docs.mjs
 *   node scripts/migrate-02-empresa-id-em-docs.mjs --dry-run
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
  console.log('[migrate-02] Modo --dry-run ativo. Nenhuma alteracao sera salva.\n')
}

// ---------------------------------------------------------------------------
// Conectar e obter db
// ---------------------------------------------------------------------------

async function main() {
  const MONGODB_URI = process.env.MONGODB_URI
  if (!MONGODB_URI) {
    console.error('MONGODB_URI nao encontrada em .env.local')
    process.exit(1)
  }

  console.log('[migrate-02] Conectando ao MongoDB...')
  await mongoose.connect(MONGODB_URI, { bufferCommands: false })
  console.log('[migrate-02] Conectado.\n')

  const db = mongoose.connection.db

  // ── Lê mapa projeto_id → empresa_id dos Projetos ──────────────────────────
  const projetos = await db.collection('projetos').find(
    { empresa_id: { $exists: true, $ne: null } },
    { projection: { projeto_id: 1, empresa_id: 1 } }
  ).toArray()

  if (projetos.length === 0) {
    console.error('[migrate-02] Nenhum Projeto com empresa_id encontrado.')
    console.error('             Execute migrate-01-criar-empresas.mjs primeiro.')
    await mongoose.disconnect()
    process.exit(1)
  }

  // Mapa: projeto_id (string) → empresa_id (ObjectId)
  const mapaEmpresa = {}
  for (const p of projetos) {
    if (p.projeto_id && p.empresa_id) {
      mapaEmpresa[p.projeto_id] = p.empresa_id
    }
  }

  console.log(`[migrate-02] Mapa carregado: ${Object.keys(mapaEmpresa).length} projeto(s) com empresa_id.\n`)

  // ── Colecoes a atualizar ───────────────────────────────────────────────────
  // Nome da colecao MongoDB → campo de referencia ao projeto
  const colecoes = [
    { nome: 'users',                  campoProjetoId: 'projeto_id' },
    { nome: 'ctos',                   campoProjetoId: 'projeto_id' },
    { nome: 'caixas_emenda_cdo',      campoProjetoId: 'projeto_id' },
    { nome: 'rotas_fibras',           campoProjetoId: 'projeto_id' },
    { nome: 'postes',                 campoProjetoId: 'projeto_id' },
    { nome: 'olts',                   campoProjetoId: 'projeto_id' },
    { nome: 'movimentacoes',          campoProjetoId: 'projeto_id' },
    { nome: 'topologias',             campoProjetoId: 'projeto_id' },
    { nome: 'log_eventos',            campoProjetoId: 'projeto_id' },
    { nome: 'registros_pendentes',    campoProjetoId: 'projeto_id' },
  ]

  const resumo = []

  for (const { nome, campoProjetoId } of colecoes) {
    // Verifica se a colecao existe
    const colsExistentes = await db.listCollections({ name: nome }).toArray()
    if (colsExistentes.length === 0) {
      console.log(`  [pular]   colecao "${nome}" nao existe.`)
      continue
    }

    const col = db.collection(nome)
    let totalAtualizado = 0

    for (const [projetoId, empresaId] of Object.entries(mapaEmpresa)) {
      const filter = {
        [campoProjetoId]: projetoId,
        empresa_id: { $exists: false },
      }

      if (DRY_RUN) {
        const count = await col.countDocuments(filter)
        if (count > 0) {
          console.log(`  [dry-run] "${nome}" projeto="${projetoId}" — ${count} doc(s) seriam atualizados`)
          totalAtualizado += count
        }
      } else {
        const result = await col.updateMany(
          filter,
          { $set: { empresa_id: empresaId } }
        )
        if (result.modifiedCount > 0) {
          console.log(`  [ok]      "${nome}" projeto="${projetoId}" — ${result.modifiedCount} doc(s) atualizados`)
          totalAtualizado += result.modifiedCount
        }
      }
    }

    resumo.push({ colecao: nome, atualizados: totalAtualizado })
  }

  console.log('\n[migrate-02] Resumo final:')
  for (const r of resumo) {
    console.log(`  ${r.colecao.padEnd(30)} ${r.atualizados} doc(s)`)
  }

  if (DRY_RUN) {
    console.log('\n[migrate-02] Dry-run: nenhuma alteracao foi salva.')
  }

  await mongoose.disconnect()
  console.log('\n[migrate-02] Concluido.')
}

main().catch((err) => {
  console.error('\n[migrate-02] Erro fatal:', err.message)
  process.exit(1)
})
