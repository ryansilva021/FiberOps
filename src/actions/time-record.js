'use server'

/**
 * time-record.js — Server Actions para controle de ponto.
 * Todas as ações validam sessão e isolam por projeto_id.
 */

import { connectDB } from '@/lib/db'
import { requireActiveEmpresa } from '@/lib/tenant-guard'
import { TimeRecord } from '@/models/TimeRecord'
import { User } from '@/models/User'

const PONTO_ROLES = ['admin', 'tecnico', 'noc', 'recepcao']

/** Retorna a data de hoje no formato 'YYYY-MM-DD' no fuso local do servidor */
function todayStr() {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** Serializa um documento Mongoose para objeto plain */
function ser(doc) {
  if (!doc) return null
  return JSON.parse(JSON.stringify(doc))
}

// ─────────────────────────────────────────────────────────────────────────────
// Leitura
// ─────────────────────────────────────────────────────────────────────────────

/** Retorna o registro de ponto do dia atual do usuário logado. */
export async function getPontoHoje() {
  const session = await requireActiveEmpresa(PONTO_ROLES)
  const { username, projeto_id } = session.user
  await connectDB()

  const record = await TimeRecord.findOne({
    userId:     username,
    projeto_id,
    date:       todayStr(),
  }).lean()

  return ser(record)
}

/** Retorna os últimos N registros do usuário (histórico). */
export async function getHistoricoPonto({ limit = 30 } = {}) {
  const session = await requireActiveEmpresa(PONTO_ROLES)
  const { username, projeto_id } = session.user
  await connectDB()

  const records = await TimeRecord.find({ userId: username, projeto_id })
    .sort({ date: -1 })
    .limit(limit)
    .lean()

  return ser(records)
}

// ─────────────────────────────────────────────────────────────────────────────
// Mutações
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Admin: retorna histórico de ponto de todos os usuários do projeto.
 * Filtros opcionais: ano, mes (1-12), dia (1-31), userId.
 */
export async function getHistoricoPontoAdmin({ ano, mes, dia, userId } = {}) {
  const session = await requireActiveEmpresa(['admin', 'superadmin'])
  const { projeto_id } = session.user
  await connectDB()

  const query = { projeto_id }

  if (userId) query.userId = userId

  // Monta prefixo de data para filtro via string 'YYYY-MM-DD'
  if (ano) {
    const y = String(ano).padStart(4, '0')
    if (mes) {
      const m = String(mes).padStart(2, '0')
      if (dia) {
        const d = String(dia).padStart(2, '0')
        query.date = `${y}-${m}-${d}`
      } else {
        query.date = { $regex: `^${y}-${m}-` }
      }
    } else {
      query.date = { $regex: `^${y}-` }
    }
  }

  const records = await TimeRecord.find(query)
    .sort({ date: -1, entrada: -1 })
    .limit(500)
    .lean()

  // Busca nomes dos usuários
  const userIds = [...new Set(records.map((r) => r.userId))]
  const users = await User.find(
    { username: { $in: userIds }, projeto_id },
    'username nome_completo role'
  ).lean()
  const userMap = Object.fromEntries(users.map((u) => [u.username, u]))

  const enriched = records.map((r) => ({
    ...r,
    nomeCompleto: userMap[r.userId]?.nome_completo || r.userId,
    roleUsuario:  userMap[r.userId]?.role || '',
  }))

  return JSON.parse(JSON.stringify(enriched))
}

/** Registra a entrada (início de jornada). Impede duplicata no mesmo dia. */
export async function registrarEntrada({ location } = {}) {
  const session = await requireActiveEmpresa(PONTO_ROLES)
  const { username, projeto_id } = session.user
  await connectDB()

  const date = todayStr()
  const existing = await TimeRecord.findOne({ userId: username, projeto_id, date })
  if (existing) {
    return { error: 'Você já registrou entrada hoje.' }
  }

  const record = await TimeRecord.create({
    userId:          username,
    projeto_id,
    date,
    entrada:         new Date(),
    entradaLocation: location ?? null,
    status:          'trabalhando',
  })

  return { ok: true, record: ser(record) }
}

/** Inicia pausa. Requer status "trabalhando". */
export async function registrarPausaInicio() {
  const session = await requireActiveEmpresa(PONTO_ROLES)
  const { username, projeto_id } = session.user
  await connectDB()

  const record = await TimeRecord.findOne({ userId: username, projeto_id, date: todayStr() })
  if (!record)                        return { error: 'Nenhuma entrada registrada hoje.' }
  if (record.status !== 'trabalhando') return { error: 'Não é possível iniciar pausa agora.' }
  if (record.pausaInicio)              return { error: 'Pausa já foi iniciada hoje.' }

  record.pausaInicio = new Date()
  record.status = 'em_pausa'
  await record.save()

  return { ok: true, record: ser(record) }
}

/** Encerra pausa. Requer status "em_pausa". */
export async function registrarPausaFim() {
  const session = await requireActiveEmpresa(PONTO_ROLES)
  const { username, projeto_id } = session.user
  await connectDB()

  const record = await TimeRecord.findOne({ userId: username, projeto_id, date: todayStr() })
  if (!record)                      return { error: 'Nenhuma entrada registrada hoje.' }
  if (record.status !== 'em_pausa') return { error: 'Não há pausa ativa para encerrar.' }

  record.pausaFim = new Date()
  record.status = 'trabalhando'
  await record.save()

  return { ok: true, record: ser(record) }
}

/** Registra saída (encerra jornada). Impede saída com pausa ativa. */
export async function registrarSaida({ location } = {}) {
  const session = await requireActiveEmpresa(PONTO_ROLES)
  const { username, projeto_id } = session.user
  await connectDB()

  const record = await TimeRecord.findOne({ userId: username, projeto_id, date: todayStr() })
  if (!record)                         return { error: 'Nenhuma entrada registrada hoje.' }
  if (record.status === 'finalizado')  return { error: 'Jornada já foi finalizada.' }
  if (record.status === 'em_pausa')    return { error: 'Encerre a pausa antes de registrar saída.' }

  record.saida = new Date()
  record.saidaLocation = location ?? null
  record.status = 'finalizado'
  await record.save()

  return { ok: true, record: ser(record) }
}
