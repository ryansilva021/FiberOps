/**
 * src/actions/registros.js
 * Server Actions para auto-cadastro público e aprovação de registros.
 *
 * Mapeamento de endpoints:
 *   GET  /api/registro/check?login=   → checkLoginDisponivel(login)
 *   POST /api/registro                → criarRegistro(data)
 *   GET  /api/registros               → getRegistros()              [superadmin]
 *   POST /api/registros/aprovar       → aprovarRegistro(id, role?)
 *   POST /api/registros/rejeitar      → rejeitarRegistro(id, motivo?)
 */

'use server'

import { connectDB } from '@/lib/db'
import { requireRole } from '@/lib/auth'
import { hashPassword } from '@/lib/password'
import { RegistroPendente } from '@/models/RegistroPendente'
import { User } from '@/models/User'
import { Projeto } from '@/models/Projeto'

const SUPERADMIN_ONLY = ['superadmin']

// ---------------------------------------------------------------------------
// GET /api/registro/check?login= → checkLoginDisponivel
// ---------------------------------------------------------------------------

/**
 * Verifica se um username está disponível para cadastro.
 * Rota pública — não requer autenticação.
 *
 * @param {string} login
 * @returns {Promise<{ disponivel: boolean }>}
 */
export async function checkLoginDisponivel(login) {
  if (!login?.trim()) return { disponivel: false }

  const normalized = login.toLowerCase().trim()

  // Valida formato antes de consultar o banco
  if (!/^[a-z0-9_.-]+$/.test(normalized) || normalized.length < 3) {
    return { disponivel: false, motivo: 'login_invalido' }
  }

  await connectDB()

  const existeUser     = await User.exists({ username: normalized })
  const existeRegistro = await RegistroPendente.exists({ username: normalized, status: 'pendente' })

  return { disponivel: !existeUser && !existeRegistro }
}

// ---------------------------------------------------------------------------
// POST /api/registro → criarRegistro
// ---------------------------------------------------------------------------

/**
 * Cria um registro de auto-cadastro público (aguarda aprovação do superadmin).
 * Rota pública — não requer autenticação.
 *
 * @param {Object} data
 * @param {string} data.username       — obrigatório
 * @param {string} data.password       — obrigatório, mínimo 6 chars
 * @param {string} data.projeto_id     — ID do projeto desejado (obrigatório)
 * @param {string} [data.email]
 * @param {string} [data.nome_completo]
 * @param {string} [data.telefone]
 * @param {string} [data.empresa]
 * @returns {Promise<{ criado: boolean, mensagem: string }>}
 */
export async function criarRegistro(data) {
  const { username, password, projeto_id, email, nome_completo, telefone, empresa } = data ?? {}

  if (!username?.trim())  throw new Error('username é obrigatório')
  if (!password)          throw new Error('password é obrigatório')
  if (!projeto_id?.trim()) throw new Error('projeto_id é obrigatório')

  if (password.length < 6) throw new Error('Senha deve ter ao menos 6 caracteres')

  const normalized = username.toLowerCase().trim()
  if (!/^[a-z0-9_.-]+$/.test(normalized)) {
    throw new Error('username deve conter apenas letras minúsculas, números, _ . e -')
  }

  await connectDB()

  // Verifica disponibilidade
  const { disponivel } = await checkLoginDisponivel(normalized)
  if (!disponivel) throw new Error('Username já está em uso ou em análise')

  // Verifica se o projeto existe e está ativo
  const projeto = await Projeto.findOne({ projeto_id: projeto_id.trim(), is_active: true }).lean()
  if (!projeto) throw new Error('Projeto não encontrado ou inativo')

  // Armazena senha hasheada mesmo no registro pendente (não ficará em claro)
  const passwordHash = await hashPassword(password)

  await RegistroPendente.create({
    username:      normalized,
    password_hash: passwordHash,
    projeto_id:    projeto_id.trim(),
    email:         email?.trim()?.toLowerCase()   ?? null,
    nome_completo: nome_completo?.trim()           ?? null,
    telefone:      telefone?.trim()                ?? null,
    empresa:       empresa?.trim()                 ?? null,
    status:        'pendente',
    solicitado_em: new Date(),
  })

  return {
    criado:   true,
    mensagem: 'Cadastro enviado. Aguarde a aprovação do administrador.',
  }
}

// ---------------------------------------------------------------------------
// GET /api/registros → getRegistros
// ---------------------------------------------------------------------------

/**
 * Lista todos os registros pendentes/processados.
 * Requer: superadmin.
 *
 * @param {string} [status]  — 'pendente' | 'aprovado' | 'rejeitado' | undefined (todos)
 * @returns {Promise<Array>}
 */
export async function getRegistros(status) {
  await requireRole(SUPERADMIN_ONLY)
  await connectDB()

  const filter = {}
  if (status) filter.status = status

  const registros = await RegistroPendente.find(filter)
    .sort({ solicitado_em: -1 })
    .lean()

  return registros.map((r) => ({ ...r, _id: r._id.toString() }))
}

// ---------------------------------------------------------------------------
// POST /api/registros/aprovar → aprovarRegistro
// ---------------------------------------------------------------------------

/**
 * Aprova um registro pendente, criando o usuário no sistema.
 * Requer: superadmin.
 *
 * @param {string} registroId   — _id do RegistroPendente
 * @param {string} [role]       — role do novo usuário (padrão: 'user')
 * @returns {Promise<{ aprovado: boolean, username: string }>}
 */
export async function aprovarRegistro(registroId, role = 'user') {
  const session = await requireRole(SUPERADMIN_ONLY)

  if (!registroId) throw new Error('registroId é obrigatório')

  const ALLOWED_ROLES = ['user', 'tecnico', 'admin']
  if (role && !ALLOWED_ROLES.includes(role)) throw new Error('Role inválido para aprovação de registro')

  await connectDB()

  const registro = await RegistroPendente.findById(registroId).select('+password_hash')
  if (!registro) throw new Error('Registro não encontrado')
  if (registro.status !== 'pendente') throw new Error('Registro já foi processado')

  // Verifica novamente se o username ainda está livre
  const existeUser = await User.exists({ username: registro.username })
  if (existeUser) {
    registro.status = 'rejeitado'
    registro.motivo_rejeicao = 'Username já existe no sistema'
    registro.processado_em = new Date()
    registro.processado_por = session.user.username
    await registro.save()
    throw new Error('Username já existe no sistema')
  }

  // Cria o usuário com a senha já hasheada do registro
  await User.create({
    username:      registro.username,
    password_hash: registro.password_hash,
    role:          role ?? 'user',
    projeto_id:    registro.projeto_id,
    email:         registro.email ?? null,
    nome_completo: registro.nome_completo ?? null,
    is_active:     true,
  })

  // Atualiza status do registro
  registro.status         = 'aprovado'
  registro.processado_em  = new Date()
  registro.processado_por = session.user.username
  await registro.save()

  return { aprovado: true, username: registro.username }
}

// ---------------------------------------------------------------------------
// POST /api/registros/rejeitar → rejeitarRegistro
// ---------------------------------------------------------------------------

/**
 * Rejeita um registro pendente.
 * Requer: superadmin.
 *
 * @param {string} registroId
 * @param {string} [motivo]
 * @returns {Promise<{ rejeitado: boolean }>}
 */
export async function rejeitarRegistro(registroId, motivo) {
  const session = await requireRole(SUPERADMIN_ONLY)

  if (!registroId) throw new Error('registroId é obrigatório')

  await connectDB()

  const registro = await RegistroPendente.findById(registroId)
  if (!registro)                    throw new Error('Registro não encontrado')
  if (registro.status !== 'pendente') throw new Error('Registro já foi processado')

  registro.status            = 'rejeitado'
  registro.motivo_rejeicao   = motivo?.trim() ?? null
  registro.processado_em     = new Date()
  registro.processado_por    = session.user.username
  await registro.save()

  return { rejeitado: true }
}
