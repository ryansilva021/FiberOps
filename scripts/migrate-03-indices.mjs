/**
 * scripts/migrate-03-indices.mjs
 *
 * Migração 03 — Imprime os comandos mongosh para criar índices compostos
 * com empresa_id nas coleções filhas.
 *
 * Este script NAO cria os índices diretamente. Ele imprime os comandos
 * mongosh prontos para revisão e execução manual (ou via pipeline CI/CD).
 *
 * Por que imprimir em vez de criar automaticamente?
 *   - Índices em coleções grandes podem bloquear leituras em MongoDB < 4.4
 *   - O DBA pode querer usar createIndex com opção { background: true }
 *   - Permite revisão antes da execução em produção
 *
 * Uso:
 *   node scripts/migrate-03-indices.mjs
 *   node scripts/migrate-03-indices.mjs | mongosh "$MONGODB_URI"
 *
 * PRE-REQUISITO: migrate-02-empresa-id-em-docs.mjs ja executado
 *                (os documentos precisam ter empresa_id antes de indexar)
 */

import { readFileSync, existsSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

// ---------------------------------------------------------------------------
// Carrega .env.local para obter o nome do banco (opcional — apenas exibicao)
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
// Definicao dos índices necessários
// ---------------------------------------------------------------------------

// Cada entrada define:
//   colecao  : nome da coleção MongoDB
//   indices  : array de { keys, options } para createIndex()
const INDICES = [
  // ── Empresa ──────────────────────────────────────────────────────────────
  {
    colecao: 'empresas',
    indices: [
      { keys: { slug: 1 },                         options: { unique: true, name: 'slug_1' } },
      { keys: { status_assinatura: 1, is_active: 1 }, options: { name: 'status_assinatura_1_is_active_1' } },
      { keys: { plano: 1, status_assinatura: 1 },  options: { name: 'plano_1_status_assinatura_1' } },
    ],
  },

  // ── Users ─────────────────────────────────────────────────────────────────
  {
    colecao: 'users',
    indices: [
      { keys: { empresa_id: 1, is_active: 1 },     options: { name: 'empresa_id_1_is_active_1' } },
      { keys: { empresa_id: 1, role: 1 },          options: { name: 'empresa_id_1_role_1' } },
    ],
  },

  // ── CTOs ──────────────────────────────────────────────────────────────────
  {
    colecao: 'ctos',
    indices: [
      { keys: { empresa_id: 1, projeto_id: 1 },                         options: { name: 'empresa_id_1_projeto_id_1' } },
      { keys: { empresa_id: 1, projeto_id: 1, cto_id: 1 },             options: { unique: true, name: 'empresa_projeto_cto_unique' } },
    ],
  },

  // ── Caixas de Emenda / CDO ────────────────────────────────────────────────
  {
    colecao: 'caixas_emenda_cdo',
    indices: [
      { keys: { empresa_id: 1, projeto_id: 1 },                         options: { name: 'empresa_id_1_projeto_id_1' } },
      { keys: { empresa_id: 1, projeto_id: 1, id: 1 },                 options: { unique: true, name: 'empresa_projeto_ce_unique' } },
    ],
  },

  // ── Rotas de Fibra ────────────────────────────────────────────────────────
  {
    colecao: 'rotas_fibras',
    indices: [
      { keys: { empresa_id: 1, projeto_id: 1 },                         options: { name: 'empresa_id_1_projeto_id_1' } },
      { keys: { empresa_id: 1, projeto_id: 1, rota_id: 1 },            options: { unique: true, name: 'empresa_projeto_rota_unique' } },
    ],
  },

  // ── Postes ────────────────────────────────────────────────────────────────
  {
    colecao: 'postes',
    indices: [
      { keys: { empresa_id: 1, projeto_id: 1 },                         options: { name: 'empresa_id_1_projeto_id_1' } },
      { keys: { empresa_id: 1, projeto_id: 1, poste_id: 1 },           options: { unique: true, name: 'empresa_projeto_poste_unique' } },
    ],
  },

  // ── OLTs ──────────────────────────────────────────────────────────────────
  {
    colecao: 'olts',
    indices: [
      { keys: { empresa_id: 1, projeto_id: 1 },                         options: { name: 'empresa_id_1_projeto_id_1' } },
      { keys: { empresa_id: 1, projeto_id: 1, olt_id: 1 },             options: { unique: true, name: 'empresa_projeto_olt_unique' } },
    ],
  },

  // ── Movimentacoes ─────────────────────────────────────────────────────────
  {
    colecao: 'movimentacoes',
    indices: [
      { keys: { empresa_id: 1, projeto_id: 1, data: -1 },              options: { name: 'empresa_projeto_data' } },
      { keys: { empresa_id: 1, projeto_id: 1, cto_id: 1, data: -1 },  options: { name: 'empresa_projeto_cto_data' } },
    ],
  },

  // ── Topologias ────────────────────────────────────────────────────────────
  {
    colecao: 'topologias',
    indices: [
      { keys: { empresa_id: 1, projeto_id: 1 },                         options: { name: 'empresa_id_1_projeto_id_1' } },
    ],
  },

  // ── Log Eventos ───────────────────────────────────────────────────────────
  {
    colecao: 'log_eventos',
    indices: [
      { keys: { empresa_id: 1, projeto_id: 1, created_at: -1 },        options: { name: 'empresa_projeto_created_at' } },
    ],
  },

  // ── Registros Pendentes ───────────────────────────────────────────────────
  {
    colecao: 'registros_pendentes',
    indices: [
      { keys: { empresa_id: 1, projeto_id: 1 },                         options: { name: 'empresa_id_1_projeto_id_1' } },
    ],
  },
]

// ---------------------------------------------------------------------------
// Imprime os comandos mongosh
// ---------------------------------------------------------------------------

function printIndexCommands() {
  console.log('// ============================================================')
  console.log('// migrate-03 — Indices compostos com empresa_id')
  console.log('// Gerado em:', new Date().toISOString())
  console.log('//')
  console.log('// Execute no mongosh:')
  console.log('//   node scripts/migrate-03-indices.mjs | mongosh "$MONGODB_URI"')
  console.log('// ============================================================')
  console.log('')

  for (const { colecao, indices } of INDICES) {
    console.log(`// ── ${colecao} ${'─'.repeat(Math.max(0, 54 - colecao.length))}`)
    for (const { keys, options } of indices) {
      const keysStr    = JSON.stringify(keys)
      const optionsStr = JSON.stringify({ ...options, background: true })
      console.log(`db.getCollection("${colecao}").createIndex(${keysStr}, ${optionsStr});`)
    }
    console.log('')
  }

  console.log('// ── Verificar índices criados ────────────────────────────────')
  for (const { colecao } of INDICES) {
    console.log(`db.getCollection("${colecao}").getIndexes();`)
  }
}

printIndexCommands()
