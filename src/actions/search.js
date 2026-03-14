/**
 * src/actions/search.js
 * Server Action de busca global no projeto FTTH.
 *
 * Pesquisa simultânea em CTOs, CaixasEmendaCDO, Rotas e Postes
 * com filtro por projeto_id (multi-tenancy).
 */

'use server'

import { connectDB }       from '@/lib/db'
import { requireAuth }     from '@/lib/auth'
import { CTO }             from '@/models/CTO'
import { CaixaEmendaCDO }  from '@/models/CaixaEmendaCDO'
import { Rota }            from '@/models/Rota'
import { Poste }           from '@/models/Poste'

const MAX_PER_COLLECTION = 10

/**
 * Busca global por texto em todas as coleções do projeto.
 * Requer: qualquer usuário autenticado.
 *
 * @param {string} query      — termo de busca (mínimo 2 caracteres)
 * @param {string} projetoId  — tenant a pesquisar (superadmin pode informar qualquer um)
 * @returns {Promise<{
 *   ctos:    Array<{ _id: string, tipo: string, label: string }>,
 *   caixas:  Array<{ _id: string, tipo: string, label: string }>,
 *   rotas:   Array<{ _id: string, tipo: string, label: string }>,
 *   postes:  Array<{ _id: string, tipo: string, label: string }>,
 * }>}
 */
export async function searchGlobal(query, projetoId) {
  const session = await requireAuth()
  const { role, projeto_id: userProjeto } = session.user

  // Não-superadmin só pode pesquisar no próprio projeto
  const targetProjeto = role === 'superadmin' ? projetoId : userProjeto

  if (!targetProjeto) {
    return { ctos: [], caixas: [], rotas: [], postes: [] }
  }

  // Sanitiza e valida query mínima
  const term = String(query ?? '').trim()
  if (term.length < 2) {
    return { ctos: [], caixas: [], rotas: [], postes: [] }
  }

  // Regex case-insensitive para MongoDB — escapa caracteres especiais de regex
  const safePattern = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const regex = { $regex: safePattern, $options: 'i' }

  await connectDB()

  // Executa as 4 buscas em paralelo para reduzir latência
  const [rawCtos, rawCaixas, rawRotas, rawPostes] = await Promise.all([
    // CTOs: busca por cto_id, rua (campo de endereço), bairro, nome
    CTO.find(
      {
        projeto_id: targetProjeto,
        $or: [
          { cto_id: regex },
          { rua:    regex },
          { bairro: regex },
          { nome:   regex },
        ],
      },
      'cto_id nome rua bairro'
    )
      .limit(MAX_PER_COLLECTION)
      .lean(),

    // CaixaEmendaCDO: busca por id (ce_id), rua, bairro, obs, nome
    CaixaEmendaCDO.find(
      {
        projeto_id: targetProjeto,
        $or: [
          { id:     regex },
          { nome:   regex },
          { rua:    regex },
          { bairro: regex },
          { obs:    regex },
        ],
      },
      'id nome rua bairro tipo'
    )
      .limit(MAX_PER_COLLECTION)
      .lean(),

    // Rotas: busca por rota_id e nome
    Rota.find(
      {
        projeto_id: targetProjeto,
        $or: [
          { rota_id: regex },
          { nome:    regex },
        ],
      },
      'rota_id nome tipo'
    )
      .limit(MAX_PER_COLLECTION)
      .lean(),

    // Postes: busca por poste_id, rua, bairro
    Poste.find(
      {
        projeto_id: targetProjeto,
        $or: [
          { poste_id: regex },
          { rua:      regex },
          { bairro:   regex },
          { nome:     regex },
        ],
      },
      'poste_id nome rua bairro tipo'
    )
      .limit(MAX_PER_COLLECTION)
      .lean(),
  ])

  // Serializa e constrói label legível para cada coleção

  const ctos = rawCtos.map((doc) => ({
    _id:  doc._id.toString(),
    tipo: 'cto',
    label: doc.cto_id + (doc.nome ? ` — ${doc.nome}` : '') +
           (doc.rua ? `, ${doc.rua}` : '') +
           (doc.bairro ? `, ${doc.bairro}` : ''),
  }))

  const caixas = rawCaixas.map((doc) => ({
    _id:  doc._id.toString(),
    tipo: 'caixa',
    label: doc.id + (doc.nome ? ` — ${doc.nome}` : '') +
           (doc.tipo ? ` (${doc.tipo})` : '') +
           (doc.rua ? `, ${doc.rua}` : '') +
           (doc.bairro ? `, ${doc.bairro}` : ''),
  }))

  const rotas = rawRotas.map((doc) => ({
    _id:  doc._id.toString(),
    tipo: 'rota',
    label: doc.rota_id + (doc.nome ? ` — ${doc.nome}` : '') +
           (doc.tipo ? ` (${doc.tipo})` : ''),
  }))

  const postes = rawPostes.map((doc) => ({
    _id:  doc._id.toString(),
    tipo: 'poste',
    label: doc.poste_id + (doc.nome ? ` — ${doc.nome}` : '') +
           (doc.rua ? `, ${doc.rua}` : '') +
           (doc.bairro ? `, ${doc.bairro}` : ''),
  }))

  return { ctos, caixas, rotas, postes }
}
