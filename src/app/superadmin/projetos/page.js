import { getProjetosStats } from '@/actions/projetos'
import ProjetosClient from '@/components/superadmin/ProjetosClient'

export const metadata = {
  title: 'Projetos | FiberOps Superadmin',
}

export default async function ProjetosPage() {
  let projetos = []
  let erroCarregamento = null

  try {
    projetos = await getProjetosStats()
  } catch (e) {
    erroCarregamento = e.message
  }

  return (
    <div className="p-6">
      <div className="mb-8">
        <h1 className="text-2xl font-bold" style={{ color: '#f1f5f9' }}>Projetos / Tenants</h1>
        <p className="text-sm mt-1" style={{ color: '#64748b' }}>
          {projetos.length} projeto{projetos.length !== 1 ? 's' : ''} cadastrado{projetos.length !== 1 ? 's' : ''}
        </p>
      </div>

      {erroCarregamento && (
        <div
          style={{ backgroundColor: '#450a0a', border: '1px solid #7f1d1d' }}
          className="rounded-lg px-4 py-3 text-sm text-red-400 mb-4"
        >
          Erro ao carregar projetos: {erroCarregamento}
        </div>
      )}

      <ProjetosClient projetosIniciais={projetos} />
    </div>
  )
}
