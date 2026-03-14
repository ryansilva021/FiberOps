/**
 * src/actions/empresas.js
 * Server Actions para gerenciamento de Empresas (multi-tenant, superadmin).
 */

'use server'

import { revalidatePath } from 'next/cache'
import { connectDB } from '@/lib/db'
import { requireActiveEmpresa } from '@/lib/tenant-guard'
import { Empresa } from '@/models/Empresa'

const SUPERADMIN_ONLY = ['superadmin']

// ---------------------------------------------------------------------------
// getEmpresas — lista todas as empresas ativas
// ---------------------------------------------------------------------------

/**
 * Lista todas as empresas cadastradas no sistema.
 * Requer: superadmin.
 *
 * @returns {Promise<Array>}
 */
export async function getEmpresas() {
  await requireActiveEmpresa(SUPERADMIN_ONLY)
  await connectDB()

  const empresas = await Empresa.find({ is_active: true })
    .sort({ criado_em: -1 })
    .lean()

  return empresas.map((e) => ({
    ...e,
    _id: e._id.toString(),
    data_vencimento: e.data_vencimento ? e.data_vencimento.toISOString() : null,
    trial_expira_em: e.trial_expira_em ? e.trial_expira_em.toISOString() : null,
    criado_em: e.criado_em ? e.criado_em.toISOString() : null,
    updated_at: e.updated_at ? e.updated_at.toISOString() : null,
  }))
}

// ---------------------------------------------------------------------------
// upsertEmpresa — criar ou atualizar empresa
// ---------------------------------------------------------------------------

/**
 * Cria ou atualiza uma empresa.
 * Requer: superadmin.
 *
 * @param {Object} data
 * @param {string} [data._id]               — se presente, atualiza; senão cria
 * @param {string} data.razao_social         — obrigatório
 * @param {string} [data.slug]              — obrigatório na criação
 * @param {string} [data.nome_fantasia]
 * @param {string} [data.cnpj]              — 14 dígitos sem pontuação
 * @param {string} [data.email_contato]
 * @param {string} [data.telefone_contato]
 * @param {string} [data.responsavel]
 * @param {string} [data.plano]             — basico | pro | enterprise
 * @param {string} [data.status_assinatura] — trial | ativo | vencido | bloqueado
 * @param {string} [data.data_vencimento]   — ISO date string
 * @returns {Promise<Object>}
 */
export async function upsertEmpresa(data) {
  await requireActiveEmpresa(SUPERADMIN_ONLY)
  await connectDB()

  const {
    _id,
    razao_social,
    slug,
    cnpj,
    email_contato,
    telefone_contato,
    plano,
    status_assinatura,
    data_vencimento,
  } = data

  if (!razao_social || !razao_social.trim()) {
    throw new Error('razao_social é obrigatória.')
  }

  const payload = {
    razao_social: razao_social.trim(),
    cnpj: cnpj ? cnpj.replace(/\D/g, '') || null : null,
    email_contato: email_contato?.trim().toLowerCase() || null,
    telefone_contato: telefone_contato?.trim() || null,
    plano: plano || 'basico',
    status_assinatura: status_assinatura || 'trial',
    data_vencimento: data_vencimento ? new Date(data_vencimento) : null,
  }

  let empresa

  if (_id) {
    // Atualização
    empresa = await Empresa.findByIdAndUpdate(
      _id,
      { $set: payload },
      { new: true, runValidators: true }
    ).lean()

    if (!empresa) {
      throw new Error('Empresa não encontrada.')
    }
  } else {
    // Criação — slug é obrigatório
    if (!slug || !slug.trim()) {
      throw new Error('slug é obrigatório para criação de empresa.')
    }

    const slugLimpo = slug.trim().toLowerCase()
    const existente = await Empresa.findOne({ slug: slugLimpo }).lean()
    if (existente) {
      throw new Error(`Já existe uma empresa com o slug "${slugLimpo}".`)
    }

    empresa = await Empresa.create({ ...payload, slug: slugLimpo })
    empresa = empresa.toObject()
  }

  revalidatePath('/superadmin/empresas')

  return {
    ...empresa,
    _id: empresa._id.toString(),
    data_vencimento: empresa.data_vencimento ? empresa.data_vencimento.toISOString() : null,
    trial_expira_em: empresa.trial_expira_em ? empresa.trial_expira_em.toISOString() : null,
    criado_em: empresa.criado_em ? empresa.criado_em.toISOString() : null,
    updated_at: empresa.updated_at ? empresa.updated_at.toISOString() : null,
  }
}

// ---------------------------------------------------------------------------
// bloquearEmpresa — suspende o acesso de uma empresa
// ---------------------------------------------------------------------------

/**
 * Bloqueia uma empresa, definindo status_assinatura como 'bloqueado'.
 * Requer: superadmin.
 *
 * @param {string} empresaId
 * @param {string} [motivo] — motivo exibido aos usuários da empresa
 * @returns {Promise<Object>}
 */
export async function bloquearEmpresa(empresaId, motivo = '') {
  await requireActiveEmpresa(SUPERADMIN_ONLY)
  await connectDB()

  const empresa = await Empresa.findByIdAndUpdate(
    empresaId,
    {
      $set: {
        status_assinatura: 'bloqueado',
        motivo_bloqueio: motivo.trim() || 'Acesso suspenso pelo administrador.',
      },
    },
    { new: true }
  ).lean()

  if (!empresa) {
    throw new Error('Empresa não encontrada.')
  }

  revalidatePath('/superadmin/empresas')

  return { ...empresa, _id: empresa._id.toString() }
}

// ---------------------------------------------------------------------------
// desbloquearEmpresa — reativa uma empresa bloqueada
// ---------------------------------------------------------------------------

/**
 * Desbloqueia uma empresa, restaurando status_assinatura para 'ativo'.
 * Requer: superadmin.
 *
 * @param {string} empresaId
 * @returns {Promise<Object>}
 */
export async function desbloquearEmpresa(empresaId) {
  await requireActiveEmpresa(SUPERADMIN_ONLY)
  await connectDB()

  const empresa = await Empresa.findByIdAndUpdate(
    empresaId,
    {
      $set: {
        status_assinatura: 'ativo',
        motivo_bloqueio: null,
      },
    },
    { new: true }
  ).lean()

  if (!empresa) {
    throw new Error('Empresa não encontrada.')
  }

  revalidatePath('/superadmin/empresas')

  return { ...empresa, _id: empresa._id.toString() }
}

// ---------------------------------------------------------------------------
// deleteEmpresa — soft delete (is_active = false)
// ---------------------------------------------------------------------------

/**
 * Desativa uma empresa (soft delete). Não remove do banco.
 * Requer: superadmin.
 *
 * @param {string} empresaId
 * @returns {Promise<void>}
 */
export async function deleteEmpresa(empresaId) {
  await requireActiveEmpresa(SUPERADMIN_ONLY)
  await connectDB()

  const empresa = await Empresa.findByIdAndUpdate(
    empresaId,
    { $set: { is_active: false } },
    { new: true }
  ).lean()

  if (!empresa) {
    throw new Error('Empresa não encontrada.')
  }

  revalidatePath('/superadmin/empresas')
}
