/**
 * src/lib/auth.config.js
 *
 * Configuração NextAuth v5 compatível com Edge Runtime.
 * Não importa nenhum módulo Node.js (crypto, mongoose, etc.).
 *
 * Usado pelo proxy.js (middleware) para proteção de rotas.
 * O auth.js completo estende esta config adicionando o Credentials provider.
 *
 * Os campos empresa_* são apenas propagados do token — nenhuma consulta
 * ao banco é feita aqui (Edge Runtime não suporta Mongoose).
 */

export const authConfig = {
  pages: {
    signIn:  '/login',
    signOut: '/login',
    error:   '/login',
  },

  session: {
    strategy: 'jwt',
    maxAge:   8 * 60 * 60, // 8 horas
  },

  callbacks: {
    /**
     * Callback JWT edge-safe — apenas repassa campos já no token.
     * A lógica completa (rate limiting, single-session, empresa check) fica no auth.js.
     */
    async jwt({ token, user }) {
      if (user) {
        token.id                   = user.id
        token.username             = user.username
        token.role                 = user.role
        token.projeto_id           = user.projeto_id
        token.projeto_nome         = user.projeto_nome
        token.must_change_password = user.must_change_password
        token.sessionToken         = user.sessionToken
        token.empresa_id           = user.empresa_id
        token.empresa_slug         = user.empresa_slug
        token.empresa_nome         = user.empresa_nome
        token.empresa_status       = user.empresa_status
      }
      return token
    },

    async session({ session, token }) {
      if (!token) return null
      session.user.id                   = token.id
      session.user.username             = token.username
      session.user.role                 = token.role
      session.user.projeto_id           = token.projeto_id
      session.user.projeto_nome         = token.projeto_nome
      session.user.must_change_password = token.must_change_password
      session.user.empresa_id           = token.empresa_id
      session.user.empresa_slug         = token.empresa_slug
      session.user.empresa_nome         = token.empresa_nome
      session.user.empresa_status       = token.empresa_status
      return session
    },

    /**
     * authorized — controla acesso nas rotas protegidas pelo proxy.
     * Retorna true se pode prosseguir; false redireciona para signIn.
     */
    authorized({ auth: session, request: { nextUrl } }) {
      const isLoggedIn  = !!session?.user
      const pathname    = nextUrl.pathname

      // Rotas públicas: sempre permitido
      const publicRoutes = ['/login', '/cadastro']
      const isPublic = publicRoutes.includes(pathname) ||
        pathname.startsWith('/api/auth') ||
        pathname.startsWith('/api/registro')

      if (isPublic) return true

      // Demais rotas: exige autenticação
      return isLoggedIn
    },
  },

  providers: [], // Providers são adicionados no auth.js (Node.js runtime)
}
