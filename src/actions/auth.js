/**
 * src/actions/auth.js
 * Server Actions de autenticação.
 *
 * Mapeamento de endpoints:
 *   POST /api/login          → loginAction(formData)
 *   GET  /api/me             → getMeAction()
 *   POST /api/logout         → logoutAction()
 *
 * IMPORTANTE: Server Actions devem importar signIn/signOut de @/lib/auth
 * (NextAuth v5), não de next-auth/react (que é exclusivo para Client Components).
 */

'use server'

import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { signIn, signOut, auth, requireAuth } from '@/lib/auth'
import { connectDB } from '@/lib/db'
import { User } from '@/models/User'

// ---------------------------------------------------------------------------
// POST /api/login → loginAction
// ---------------------------------------------------------------------------

/**
 * Autentica o usuário via NextAuth v5 Credentials provider.
 * Chamada a partir do formulário de login (Server Action em <form action={...}>).
 *
 * O IP do cliente é extraído dos headers do servidor e repassado ao
 * authorize callback para rate limiting por endereço.
 *
 * @param {Object} prevState  — estado anterior do useActionState (pode ser null)
 * @param {FormData} formData — campos: username, password, callbackUrl (opcional)
 * @returns {{ error: string, errorKind?: string, retryAfterMin?: number } | never}
 */
export async function loginAction(prevState, formData) {
  const username    = formData.get('username')?.toString().trim().toLowerCase() ?? ''
  const password    = formData.get('password')?.toString() ?? ''
  // Validate callbackUrl to prevent open redirect: only accept relative paths
  // starting with /  and not containing // (which would become protocol-relative)
  const rawCallbackUrl = formData.get('callbackUrl')?.toString() ?? ''
  const callbackUrl    = /^\/(?!\/)/.test(rawCallbackUrl) ? rawCallbackUrl : '/'

  if (!username || !password) {
    return { error: 'Usuário e senha são obrigatórios' }
  }

  // Extrai IP real do cliente para rate limiting
  const headerStore = await headers()
  const clientIp =
    headerStore.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    headerStore.get('x-real-ip') ??
    '127.0.0.1'

  try {
    // Em NextAuth v5 signIn lança NEXT_REDIRECT em caso de sucesso
    await signIn('credentials', {
      username,
      password,
      clientIp,
      redirect: true,
      redirectTo: callbackUrl,
    })
  } catch (err) {
    // NEXT_REDIRECT (next/navigation) deve ser repropagado
    if (err?.digest?.startsWith('NEXT_REDIRECT')) throw err

    const message = err?.message ?? ''

    // Mensagens de rate limiting codificadas pelo authorize callback
    // Formato: "rate_limited:<kind>:<mensagem legível>"
    if (message.startsWith('rate_limited:')) {
      const [, kind, ...rest] = message.split(':')
      const mins = rest.join(':').match(/(\d+)\s*min/)?.[1]
      return {
        error:          rest.join(':').replace(/rate_limited:\w+:/, '') || 'Muitas tentativas. Aguarde antes de tentar novamente.',
        errorKind:      kind,
        retryAfterMin:  mins ? Number(mins) : undefined,
      }
    }

    // Erro genérico de credenciais (senha errada / usuário não existe)
    return { error: 'Usuário ou senha inválidos' }
  }
}

// ---------------------------------------------------------------------------
// GET /api/me → getMeAction
// ---------------------------------------------------------------------------

/**
 * Retorna os dados do usuário autenticado.
 * Requer: qualquer usuário autenticado.
 *
 * @returns {{ id, username, role, projeto_id, projeto_nome, must_change_password, email?, nome_completo? }}
 */
export async function getMeAction() {
  const session = await requireAuth()
  const { username } = session.user

  await connectDB()

  // Busca dados adicionais do perfil que não ficam no token JWT
  const user = await User.findOne(
    { username },
    'username role projeto_id is_active email nome_completo must_change_password last_login created_at'
  ).lean()

  if (!user) throw new Error('Usuário não encontrado')

  return {
    id:                   user._id.toString(),
    username:             user.username,
    role:                 user.role,
    projeto_id:           user.projeto_id,
    projeto_nome:         session.user.projeto_nome ?? user.projeto_id,
    is_active:            user.is_active,
    email:                user.email ?? null,
    nome_completo:        user.nome_completo ?? null,
    must_change_password: user.must_change_password ?? false,
    last_login:           user.last_login ?? null,
    created_at:           user.created_at,
  }
}

// ---------------------------------------------------------------------------
// POST /api/logout → logoutAction
// ---------------------------------------------------------------------------

/**
 * Encerra a sessão do usuário e redireciona para /login.
 * Requer: qualquer usuário autenticado.
 */
export async function logoutAction() {
  await signOut({ redirectTo: '/login' })
}

// ---------------------------------------------------------------------------
// Helpers internos reutilizáveis
// ---------------------------------------------------------------------------

/**
 * Verifica se o usuário autenticado pertence ao projeto informado.
 * Superadmin acessa qualquer projeto.
 *
 * @param {string} projeto_id
 * @returns {Promise<import('next-auth').Session>}
 */
export async function requireProjectAccess(projeto_id) {
  const session = await requireAuth()
  const { role, projeto_id: userProjeto } = session.user

  if (role !== 'superadmin' && userProjeto !== projeto_id) {
    throw new Error('Sem acesso a este projeto')
  }

  return session
}
