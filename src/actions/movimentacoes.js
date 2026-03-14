/**
 * src/actions/movimentacoes.js
 * Server Actions para Movimentações (instalações de clientes).
 *
 * Mapeamento de endpoints:
 *   GET  /api/movimentacoes               → getMovimentacoes(projetoId, ctoId?)
 *   POST /api/movimentacoes               → registrarMovimentacao(data)
 *   POST /api/movimentacoes/remove_cliente → removerClienteCTO(data)
 *   GET  /api/movimentacoes/export        → exportarMovimentacoesCSV(projetoId)
 *   POST /api/movimentacoes/import        → importarMovimentacoesCSV(formData)
 */

'use server'

import { connectDB } from '@/lib/db'
import { FIELD_ROLES, WRITE_ROLES, ALL_ROLES } from '@/lib/auth'
import { requireActiveEmpresa } from '@/lib/tenant-guard'
import { Movimentacao } from '@/models/Movimentacao'
import { CTO } from '@/models/CTO'

// ---------------------------------------------------------------------------
// GET /api/movimentacoes → getMovimentacoes
// ---------------------------------------------------------------------------

/**
 * Lista movimentações do projeto, com filtro opcional por cto_id.
 * Requer: qualquer usuário autenticado com empresa ativa.
 *
 * @param {string} projetoId
 * @param {string} [ctoId]       — filtra por CTO específica
 * @param {number} [limit=200]   — máximo de registros retornados
 * @param {number} [skip=0]      — offset para paginação
 * @returns {Promise<Array>}
 */
export async function getMovimentacoes(projetoId, ctoId = null, limit = 200, skip = 0) {
  const session = await requireActiveEmpresa(ALL_ROLES)
  const { role, projeto_id: userProjeto } = session.user
  const targetProjeto = role === 'superadmin' ? projetoId : userProjeto

  await connectDB()

  const filter = { projeto_id: targetProjeto }
  if (ctoId) filter.cto_id = ctoId

  const movs = await Movimentacao.find(filter)
    .sort({ data: -1 })
    .skip(Number(skip))
    .limit(Number(limit))
    .lean()

  return movs.map((m) => ({ ...m, _id: m._id.toString() }))
}

// ---------------------------------------------------------------------------
// POST /api/movimentacoes → registrarMovimentacao
// ---------------------------------------------------------------------------

/**
 * Registra uma nova movimentação (instalação/desinstalação).
 * Requer: tecnico, admin ou superadmin com empresa ativa.
 *
 * @param {Object} data
 * @param {string} data.projeto_id
 * @param {string} data.cto_id       — obrigatório
 * @param {string} data.tipo         — 'instalacao' | 'desinstalacao' | 'troca' | 'manutencao'
 * @param {string} data.cliente      — nome do cliente (obrigatório)
 * @param {number} [data.porta]
 * @param {string} [data.observacao]
 * @param {string} [data.data]       — ISO string; padrão: agora
 * @param {string} [data.referencia_externa]
 * @returns {Promise<Object>}  — movimentação criada
 */
export async function registrarMovimentacao(data) {
  const session = await requireActiveEmpresa(FIELD_ROLES)
  const { role, projeto_id: userProjeto, username } = session.user

  const { projeto_id, cto_id, tipo, cliente, porta, observacao, data: dataStr, referencia_externa } = data ?? {}

  if (!cto_id?.trim())   throw new Error('cto_id é obrigatório')
  if (!tipo?.trim())     throw new Error('tipo é obrigatório')
  if (!cliente?.trim())  throw new Error('cliente é obrigatório')
  if (porta != null && (!Number.isInteger(Number(porta)) || Number(porta) < 1)) {
    throw new Error('porta deve ser um número inteiro positivo')
  }

  const targetProjeto = role === 'superadmin' ? projeto_id : userProjeto
  if (!targetProjeto) throw new Error('projeto_id é obrigatório')

  await connectDB()

  const mov = await Movimentacao.create({
    projeto_id:          targetProjeto,
    cto_id:              cto_id.trim(),
    tipo:                tipo.trim(),
    cliente:             cliente.trim(),
    porta:               porta != null ? Number(porta) : null,
    observacao:          observacao?.trim()          ?? null,
    usuario:             username,
    data:                dataStr ? new Date(dataStr) : new Date(),
    referencia_externa:  referencia_externa?.trim()  ?? null,
  })

  // Atualiza o diagrama da CTO se porta foi informada
  if (porta != null) {
    const portaKey = String(porta)
    const tipoNorm = tipo.toLowerCase()
    const isInstalacao = tipoNorm.includes('instal')
    const isRemocao    = tipoNorm.includes('desins') || tipoNorm.includes('remov') || tipoNorm.includes('cancel')

    if (isInstalacao) {
      await CTO.updateOne(
        { projeto_id: targetProjeto, cto_id: cto_id.trim() },
        { $set: { [`diagrama.portas.${portaKey}.cliente`]: cliente.trim(), [`diagrama.portas.${portaKey}.ativo`]: true } }
      )
    } else if (isRemocao) {
      await CTO.updateOne(
        { projeto_id: targetProjeto, cto_id: cto_id.trim() },
        { $set: { [`diagrama.portas.${portaKey}.cliente`]: null, [`diagrama.portas.${portaKey}.ativo`]: false } }
      )
    }
  }

  return { ...mov.toObject(), _id: mov._id.toString() }
}

// ---------------------------------------------------------------------------
// POST /api/movimentacoes/remove_cliente → removerClienteCTO
// ---------------------------------------------------------------------------

/**
 * Remove um cliente de uma porta específica de uma CTO.
 * Registra movimentação de desinstalação e limpa o diagrama.
 * Requer: tecnico, admin ou superadmin com empresa ativa.
 *
 * @param {Object} data
 * @param {string} data.projeto_id
 * @param {string} data.cto_id
 * @param {number} data.porta         — porta a liberar (obrigatório)
 * @param {string} [data.observacao]
 * @returns {Promise<{ removed: boolean }>}
 */
export async function removerClienteCTO(data) {
  const session = await requireActiveEmpresa(FIELD_ROLES)
  const { role, projeto_id: userProjeto, username } = session.user

  const { projeto_id, cto_id, porta, observacao } = data ?? {}

  if (!cto_id?.trim()) throw new Error('cto_id é obrigatório')
  if (porta == null)   throw new Error('porta é obrigatório')

  const targetProjeto = role === 'superadmin' ? projeto_id : userProjeto
  if (!targetProjeto) throw new Error('projeto_id é obrigatório')

  await connectDB()

  const portaKey = String(porta)

  // Descobre quem está na porta para registrar no histórico
  const cto = await CTO.findOne(
    { projeto_id: targetProjeto, cto_id: cto_id.trim() },
    'diagrama'
  ).lean()

  const clienteAtual = cto?.diagrama?.portas?.[portaKey]?.cliente ?? 'Desconhecido'

  // Limpa a porta no diagrama
  await CTO.updateOne(
    { projeto_id: targetProjeto, cto_id: cto_id.trim() },
    {
      $set: {
        [`diagrama.portas.${portaKey}.cliente`]: null,
        [`diagrama.portas.${portaKey}.ativo`]:   false,
      },
    }
  )

  // Registra a movimentação de desinstalação
  await Movimentacao.create({
    projeto_id: targetProjeto,
    cto_id:     cto_id.trim(),
    tipo:       'desinstalacao',
    cliente:    clienteAtual,
    porta:      Number(porta),
    observacao: observacao?.trim() ?? null,
    usuario:    username,
    data:       new Date(),
  })

  return { removed: true }
}

// ---------------------------------------------------------------------------
// GET /api/movimentacoes/export → exportarMovimentacoesCSV
// ---------------------------------------------------------------------------

/**
 * Exporta todas as movimentações como array de objetos no formato CSV legado.
 * O componente de UI é responsável por serializar para .csv.
 * Requer: admin ou superior com empresa ativa.
 *
 * @param {string} projetoId
 * @returns {Promise<Array<{ DATA, CTO_ID, Tipo, Cliente, Usuario, Observacao }>>}
 */
export async function exportarMovimentacoesCSV(projetoId) {
  const session = await requireActiveEmpresa(WRITE_ROLES)
  const { role, projeto_id: userProjeto } = session.user
  const targetProjeto = role === 'superadmin' ? projetoId : userProjeto

  await connectDB()

  return Movimentacao.exportarCSV(targetProjeto)
}

// ---------------------------------------------------------------------------
// POST /api/movimentacoes/import → importarMovimentacoesCSV
// ---------------------------------------------------------------------------

/**
 * Importa movimentações a partir de um array de objetos (já parseado do CSV).
 * Requer: admin ou superior com empresa ativa.
 *
 * @param {Object} params
 * @param {string} params.projeto_id
 * @param {Array}  params.rows  — array de { DATA, CTO_ID, Tipo, Cliente, Usuario, Observacao }
 * @returns {Promise<{ inserted: number, errors: Array }>}
 */
export async function importarMovimentacoesCSV({ projeto_id, rows }) {
  const session = await requireActiveEmpresa(WRITE_ROLES)
  const { role, projeto_id: userProjeto } = session.user

  const targetProjeto = role === 'superadmin' ? projeto_id : userProjeto
  if (!targetProjeto) throw new Error('projeto_id é obrigatório')

  if (!Array.isArray(rows) || rows.length === 0) {
    throw new Error('rows deve ser um array não-vazio')
  }

  await connectDB()

  let inserted = 0
  const errors = []

  for (const [i, row] of rows.entries()) {
    try {
      if (!row.CTO_ID || !row.Tipo || !row.Cliente) {
        errors.push({ linha: i + 2, erro: 'CTO_ID, Tipo e Cliente são obrigatórios' })
        continue
      }

      await Movimentacao.create({
        projeto_id: targetProjeto,
        cto_id:     String(row.CTO_ID).trim(),
        tipo:       String(row.Tipo).trim(),
        cliente:    String(row.Cliente).trim(),
        usuario:    row.Usuario   ? String(row.Usuario).trim()   : null,
        observacao: row.Observacao ? String(row.Observacao).trim() : null,
        data:       row.DATA ? new Date(row.DATA) : new Date(),
      })
      inserted++
    } catch (err) {
      errors.push({ linha: i + 2, erro: err.message })
    }
  }

  return { inserted, errors }
}
