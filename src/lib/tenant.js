/**
 * src/lib/tenant.js
 *
 * Utilitários de verificação de status de tenant (Empresa).
 * Usado pelo auth.js (renovação de token) e pelo tenant-guard.js (Server Actions).
 *
 * IMPORTANTE: este módulo usa Mongoose — deve rodar apenas no Node.js runtime,
 * nunca no Edge Runtime. Não importe este arquivo em proxy.js ou auth.config.js.
 */

import { connectDB } from '@/lib/db'

/**
 * Verifica o status operacional de uma Empresa pelo seu _id.
 *
 * @param {string} empresaId  — _id da Empresa (string ou ObjectId)
 * @returns {Promise<{
 *   ativa:  boolean,
 *   status: 'ativo' | 'trial' | 'vencido' | 'bloqueado' | 'trial_expirado' | 'inexistente',
 *   motivo?: string,
 * }>}
 */
export async function verificarStatusEmpresa(empresaId) {
  if (!empresaId) return { ativa: false, status: 'inexistente' }

  await connectDB()

  // Import dinâmico para evitar problemas de inicialização circular com Mongoose
  const { Empresa } = await import('@/models/Empresa')

  return Empresa.verificarStatus(empresaId)
}
