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
      <div className="mb-8">
        <h1 className="text-2xl font-bold" style={{ color: '#f1f5f9' }}>Empresas</h1>
        <p className="text-sm mt-1" style={{ color: '#64748b' }}>
          {empresas.length} empresa{empresas.length !== 1 ? 's' : ''} cadastrada{empresas.length !== 1 ? 's' : ''}
        </p>
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
