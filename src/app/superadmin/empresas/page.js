import { getEmpresas } from '@/actions/empresas'
import EmpresasClient from '@/components/superadmin/EmpresasClient'

export const metadata = {
  title: 'Empresas | FiberOps Superadmin',
}

export default async function EmpresasPage() {
  let empresas = []
  let erroCarregamento = null

  try {
    empresas = await getEmpresas()
  } catch (e) {
    erroCarregamento = e.message
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-white">Empresas (Multi-tenant)</h1>
          <p className="text-sm text-slate-400 mt-0.5">
            {empresas.length} empresa{empresas.length !== 1 ? 's' : ''} cadastrada{empresas.length !== 1 ? 's' : ''}
          </p>
        </div>
      </div>

      {erroCarregamento && (
        <div
          style={{ backgroundColor: '#450a0a', border: '1px solid #7f1d1d' }}
          className="rounded-lg px-4 py-3 text-sm text-red-400 mb-4"
        >
          Erro ao carregar empresas: {erroCarregamento}
        </div>
      )}

      <EmpresasClient empresasIniciais={empresas} />
    </div>
  )
}
