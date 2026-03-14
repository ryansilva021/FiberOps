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
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-white">Projetos / Tenants</h1>
          <p className="text-sm text-slate-400 mt-0.5">
            {projetos.length} projeto{projetos.length !== 1 ? 's' : ''} cadastrado{projetos.length !== 1 ? 's' : ''}
          </p>
        </div>
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
