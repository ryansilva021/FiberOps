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
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-white">Registros de Cadastro</h1>
          <p className="text-sm text-slate-400 mt-0.5">
            {pendentes.length} pendente{pendentes.length !== 1 ? 's' : ''} •{' '}
            {processados.length} processado{processados.length !== 1 ? 's' : ''}
          </p>
        </div>
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
