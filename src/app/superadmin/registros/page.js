import { getRegistros } from '@/actions/registros'
import RegistrosClient from '@/components/superadmin/RegistrosClient'

export const metadata = {
  title: 'Registros Pendentes | FiberOps Superadmin',
}

export default async function RegistrosPage() {
  let registros = []
  let erroCarregamento = null

  try {
    registros = await getRegistros()
  } catch (e) {
    erroCarregamento = e.message
  }

  const pendentes = registros.filter((r) => r.status === 'pendente')
  const processados = registros.filter((r) => r.status !== 'pendente')

  return (
    <div className="p-6">
      <div className="mb-8">
        <h1 className="text-2xl font-bold" style={{ color: '#f1f5f9' }}>Registros de Cadastro</h1>
        <p className="text-sm mt-1" style={{ color: '#64748b' }}>
          {pendentes.length} pendente{pendentes.length !== 1 ? 's' : ''} •{' '}
          {processados.length} processado{processados.length !== 1 ? 's' : ''}
        </p>
      </div>

      {erroCarregamento && (
        <div
          style={{ backgroundColor: '#450a0a', border: '1px solid #7f1d1d' }}
          className="rounded-lg px-4 py-3 text-sm text-red-400 mb-4"
        >
          Erro ao carregar registros: {erroCarregamento}
        </div>
      )}

      <RegistrosClient registrosIniciais={registros} />
    </div>
  )
}
