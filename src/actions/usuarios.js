/**
 * src/actions/usuarios.js
 * Server Actions para gerenciamento de usuários (admin).
 *
 * Mapeamento de endpoints:
 *   GET    /api/users                   → getUsuarios(projetoId)
 *   POST   /api/users (upsert)         → upsertUsuario(data)
 *   DELETE /api/users                  → deleteUsuario(username, projetoId)
 *   POST   /api/users/toggle-active    → toggleUsuarioAtivo(username, projetoId)
 *   POST   /api/users/set-password     → setPassword(username, newPassword, projetoId)
 */

'use server'

import { revalidatePath } from 'next/cache'
import { connectDB } from '@/lib/db'
import { requireAuth, WRITE_ROLES } from '@/lib/auth'
import { requireActiveEmpresa } from '@/lib/tenant-guard'
import { hashPassword, verifyPassword } from '@/lib/password'
import { User } from '@/models/User'

// ---------------------------------------------------------------------------
// GET /api/users → getUsuarios
// ---------------------------------------------------------------------------

/**
 * Lista usuários do projeto autenticado (admin vê apenas o seu projeto).
 * Requer: admin ou superior com empresa ativa.
 *
 * @param {string} [projetoId]  — ignorado para admin; usado pelo superadmin
 * @returns {Promise<Array>}
 */
export async function getUsuarios(projetoId) {
  const session = await requireActiveEmpresa(WRITE_ROLES)
  const { role, projeto_id: userProjeto } = session.user
  const targetProjeto = role === 'superadmin' ? projetoId : userProjeto

  await connectDB()

  const users = await User.find(
    { projeto_id: targetProjeto },
    'username role is_active email nome_completo must_change_password last_login created_at projeto_id'
  ).lean()

  return users.map((u) => ({ ...u, _id: u._id.toString() }))
}

// ---------------------------------------------------------------------------
// POST /api/users → upsertUsuario
// ---------------------------------------------------------------------------

/**
 * Cria ou atualiza um usuário.
 * Na criação, password é obrigatório.
 * Na atualização, password é opcional (se omitido, mantém o atual).
 * Requer: admin ou superior com empresa ativa.
 *
 * @param {Object} data
 * @param {string} data.username           — obrigatório
 * @param {string} data.projeto_id
 * @param {string} data.role               — 'user' | 'tecnico' | 'admin' (superadmin só via superadmin panel)
 * @param {string} [data.password]         — obrigatório na criação
 * @param {string} [data.email]
 * @param {string} [data.nome_completo]
 * @param {boolean} [data.must_change_password]
 * @returns {Promise<Object>}  — usuário criado/atualizado (sem password_hash)
 */
export async function upsertUsuario(data) {
  const session = await requireActiveEmpresa(WRITE_ROLES)
  const { role: callerRole, projeto_id: userProjeto } = session.user

  const { username, projeto_id, role: targetRole, password, email, nome_completo, must_change_password } = data ?? {}

  if (!username?.trim()) throw new Error('username é obrigatório')

  const targetProjeto = callerRole === 'superadmin' ? projeto_id : userProjeto
  if (!targetProjeto) throw new Error('projeto_id é obrigatório')

  // Admins não podem criar superadmins
  if (callerRole === 'admin' && targetRole === 'superadmin') {
    throw new Error('Admin não pode criar superadmin')
  }

  await connectDB()

  const existing = await User.findOne({ username: username.toLowerCase().trim(), projeto_id: targetProjeto }).lean()

  const update = {
    role:                 targetRole ?? 'user',
    email:                email?.trim()?.toLowerCase()   ?? null,
    nome_completo:        nome_completo?.trim()          ?? null,
    must_change_password: must_change_password ?? false,
    projeto_id:           targetProjeto,
  }

  if (password) {
    if (password.length < 6) throw new Error('Senha deve ter ao menos 6 caracteres')
    update.password_hash = await hashPassword(password)
  } else if (!existing) {
    throw new Error('Senha é obrigatória para novo usuário')
  }

  const user = await User.findOneAndUpdate(
    { username: username.toLowerCase().trim() },
    { $set: update },
    { upsert: true, new: true, runValidators: true, projection: '-password_hash' }
  ).lean()

  revalidatePath('/admin/usuarios')

  return { ...user, _id: user._id.toString() }
}

// ---------------------------------------------------------------------------
// DELETE /api/users → deleteUsuario
// ---------------------------------------------------------------------------

/**
 * Remove um usuário pelo username.
 * Admin não pode remover a si mesmo.
 * Requer: admin ou superior com empresa ativa.
 *
 * @param {string} username
 * @param {string} [projetoId]
 * @returns {Promise<{ deleted: boolean }>}
 */
export async function deleteUsuario(username, projetoId) {
  const session = await requireActiveEmpresa(WRITE_ROLES)
  const { role: callerRole, projeto_id: userProjeto, username: callerUsername } = session.user

  if (!username) throw new Error('username é obrigatório')
  if (username === callerUsername) throw new Error('Não é possível remover o próprio usuário')

  const targetProjeto = callerRole === 'superadmin' ? projetoId : userProjeto

  await connectDB()

  const filter = { username: username.toLowerCase().trim() }
  // Admin só pode remover do seu próprio projeto
  if (callerRole !== 'superadmin') filter.projeto_id = targetProjeto

  const result = await User.deleteOne(filter)

  revalidatePath('/admin/usuarios')

  return { deleted: result.deletedCount > 0 }
}

// ---------------------------------------------------------------------------
// POST /api/users/toggle-active → toggleUsuarioAtivo
// ---------------------------------------------------------------------------

/**
 * Ativa ou desativa um usuário (toggle).
 * Requer: admin ou superior com empresa ativa.
 *
 * @param {string} username
 * @param {string} [projetoId]
 * @returns {Promise<{ username: string, is_active: boolean }>}
 */
export async function toggleUsuarioAtivo(username, projetoId) {
  const session = await requireActiveEmpresa(WRITE_ROLES)
  const { role: callerRole, projeto_id: userProjeto, username: callerUsername } = session.user

  if (!username) throw new Error('username é obrigatório')
  if (username === callerUsername) throw new Error('Não é possível desativar o próprio usuário')

  const targetProjeto = callerRole === 'superadmin' ? projetoId : userProjeto

  await connectDB()

  const filter = { username: username.toLowerCase().trim() }
  if (callerRole !== 'superadmin') filter.projeto_id = targetProjeto

  const user = await User.findOne(filter, 'is_active')
  if (!user) throw new Error('Usuário não encontrado')

  user.is_active = !user.is_active
  await user.save()

  revalidatePath('/admin/usuarios')

  return { username, is_active: user.is_active }
}

// ---------------------------------------------------------------------------
// POST /api/users/set-password → setPassword
// ---------------------------------------------------------------------------

/**
 * Redefine a senha de um usuário.
 * Requer: admin ou superior com empresa ativa.
 * Admin só pode redefinir senhas de usuários do seu projeto.
 *
 * @param {string} username
 * @param {string} newPassword       — mínimo 6 caracteres
 * @param {string} [projetoId]
 * @returns {Promise<{ updated: boolean }>}
 */
export async function setPassword(username, newPassword, projetoId) {
  const session = await requireActiveEmpresa(WRITE_ROLES)
  const { role: callerRole, projeto_id: userProjeto } = session.user

  if (!username)    throw new Error('username é obrigatório')
  if (!newPassword) throw new Error('newPassword é obrigatório')
  if (newPassword.length < 6) throw new Error('Senha deve ter ao menos 6 caracteres')

  const targetProjeto = callerRole === 'superadmin' ? projetoId : userProjeto

  await connectDB()

  const filter = { username: username.toLowerCase().trim() }
  if (callerRole !== 'superadmin') filter.projeto_id = targetProjeto

  const hash   = await hashPassword(newPassword)
  const result = await User.updateOne(filter, {
    $set: {
      password_hash:        hash,
      must_change_password: false,
    },
  })

  revalidatePath('/admin/usuarios')

  return { updated: result.modifiedCount > 0 }
}

// ---------------------------------------------------------------------------
// changePassword → permite ao usuário autenticado alterar a própria senha
// ---------------------------------------------------------------------------

/**
 * Permite que o usuário autenticado troque a própria senha.
 * Verifica a senha atual antes de aplicar a nova.
 * Usa requireAuth() (sem verificação de empresa) para não bloquear troca de senha
 * em contas com empresa vencida.
 *
 * @param {FormData} formData
 *   senhaAtual      — senha atual em texto claro
 *   novaSenha       — nova senha (mínimo 8 caracteres)
 *   confirmarSenha  — confirmação da nova senha
 * @returns {Promise<{ success: true } | { error: string }>}
 */
export async function changePassword(formData) {
  let session
  try {
    session = await requireAuth()
  } catch {
    return { error: 'Não autenticado. Faça login novamente.' }
  }

  const senhaAtual     = formData.get('senhaAtual')     ?? ''
  const novaSenha      = formData.get('novaSenha')      ?? ''
  const confirmarSenha = formData.get('confirmarSenha') ?? ''

  // Validações de entrada
  if (!senhaAtual)                    return { error: 'Senha atual é obrigatória.' }
  if (!novaSenha)                     return { error: 'Nova senha é obrigatória.' }
  if (novaSenha.length < 8)           return { error: 'A nova senha deve ter no mínimo 8 caracteres.' }
  if (novaSenha !== confirmarSenha)   return { error: 'A confirmação de senha não coincide com a nova senha.' }
  if (novaSenha === senhaAtual)       return { error: 'A nova senha deve ser diferente da senha atual.' }

  try {
    await connectDB()

    // Busca o hash atual — select('+password_hash') necessário pois o campo tem select:false
    const user = await User
      .findOne({ username: session.user.username })
      .select('+password_hash')
      .lean()

    if (!user) return { error: 'Usuário não encontrado.' }

    // Verifica a senha atual antes de prosseguir
    const senhaValida = await verifyPassword(String(senhaAtual), user.password_hash)
    if (!senhaValida) return { error: 'Senha atual incorreta.' }

    // Gera o novo hash e persiste
    const novoHash = await hashPassword(String(novaSenha))

    await User.updateOne(
      { _id: user._id },
      {
        $set: {
          password_hash:        novoHash,
          must_change_password: false,
        },
      }
    )

    revalidatePath('/perfil/senha')

    return { success: true }
  } catch (err) {
    console.error('[changePassword] Erro inesperado:', err)
    return { error: 'Erro interno ao alterar senha. Tente novamente.' }
  }
}
