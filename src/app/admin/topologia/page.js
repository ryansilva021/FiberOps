import { auth } from '@/lib/auth'
import { getTopologia } from '@/actions/olts'
import TopologiaClient from '@/components/admin/TopologiaClient'

export const metadata = {
  title: 'Topologia | FiberOps',
}

export default async function TopologiaPage() {
  const session = await auth()
  let arvore = []
  let erroCarregamento = null

  try {
    arvore = await getTopologia(session?.user?.projeto_id)
  } catch (e) {
    erroCarregamento = e.message
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-white">Topologia da Rede</h1>
          <p className="text-sm text-slate-400 mt-0.5">
            Hierarquia OLT → CDO / CE → CTO
          </p>
        </div>
      </div>

      {erroCarregamento && (
        <div
          style={{ backgroundColor: '#450a0a', border: '1px solid #7f1d1d' }}
          className="rounded-lg px-4 py-3 text-sm text-red-400 mb-4"
        >
          Erro ao carregar topologia: {erroCarregamento}
        </div>
      )}

      <TopologiaClient
        arvoreInicial={arvore}
        projetoId={session?.user?.projeto_id}
        userRole={session?.user?.role}
      />
    </div>
  )
}
