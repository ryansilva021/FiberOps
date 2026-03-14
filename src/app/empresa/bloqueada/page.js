import { signOut } from '@/lib/auth'

export const metadata = {
  title: 'Acesso Suspenso | FiberOps',
}

export default function EmpresaBloqueadaPage() {
  return (
    <div
      style={{
        minHeight: '100vh',
        backgroundColor: '#030712',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1.5rem',
      }}
    >
      <div
        style={{
          backgroundColor: '#111827',
          border: '1px solid #1f2937',
          borderRadius: '1rem',
          padding: '2.5rem',
          maxWidth: '440px',
          width: '100%',
          textAlign: 'center',
        }}
      >
        {/* Icone de alerta */}
        <div
          style={{
            width: '56px',
            height: '56px',
            borderRadius: '50%',
            backgroundColor: '#450a0a',
            border: '1px solid #7f1d1d',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 1.5rem',
            fontSize: '1.5rem',
          }}
        >
          🔒
        </div>

        <h1
          style={{
            color: '#f1f5f9',
            fontWeight: 700,
            fontSize: '1.25rem',
            marginBottom: '0.5rem',
          }}
        >
          Acesso Suspenso
        </h1>

        <p
          style={{
            color: '#94a3b8',
            fontSize: '0.875rem',
            lineHeight: '1.6',
            marginBottom: '1.5rem',
          }}
        >
          O acesso da sua empresa ao FiberOps está temporariamente suspenso.
          Entre em contato com o suporte para regularizar a situação.
        </p>

        <div
          style={{
            backgroundColor: '#0b1220',
            border: '1px solid #1f2937',
            borderRadius: '0.5rem',
            padding: '1rem',
            marginBottom: '1.5rem',
            textAlign: 'left',
          }}
        >
          <p
            style={{
              color: '#64748b',
              fontSize: '0.75rem',
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              marginBottom: '0.25rem',
            }}
          >
            Suporte
          </p>
          <p style={{ color: '#94a3b8', fontSize: '0.875rem' }}>
            suporte@fiberops.com.br
          </p>
        </div>

        <form
          action={async () => {
            'use server'
            await signOut({ redirectTo: '/login' })
          }}
        >
          <button
            type="submit"
            style={{
              width: '100%',
              backgroundColor: '#1f2937',
              border: '1px solid #374151',
              color: '#94a3b8',
              borderRadius: '0.5rem',
              padding: '0.625rem 1rem',
              fontSize: '0.875rem',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Sair
          </button>
        </form>
      </div>
    </div>
  )
}
