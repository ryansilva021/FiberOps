import { connectDB } from '@/lib/db'
import { requireRole } from '@/lib/auth'
import { Projeto } from '@/models/Projeto'
import { CTO } from '@/models/CTO'
import { CaixaEmendaCDO } from '@/models/CaixaEmendaCDO'
import { Rota } from '@/models/Rota'
import { Poste } from '@/models/Poste'
import { OLT } from '@/models/OLT'
import { Movimentacao } from '@/models/Movimentacao'
import { User } from '@/models/User'
import StatsClient from '@/components/superadmin/StatsClient'

export const metadata = {
  title: 'Estatísticas | FiberOps Superadmin',
}

export default async function StatsPage() {
  let stats = null
  let erroCarregamento = null

  try {
    await requireRole(['superadmin'])
    await connectDB()

    const [projetos, olts, ctos, caixas, rotas, postes, movimentacoes, usuarios] =
      await Promise.all([
        Projeto.countDocuments(),
        OLT.countDocuments(),
        CTO.countDocuments(),
        CaixaEmendaCDO.countDocuments(),
        Rota.countDocuments(),
        Poste.countDocuments(),
        Movimentacao.countDocuments(),
        User.countDocuments(),
      ])

    stats = {
      projetos,
      olts,
      ctos,
      caixas,
      rotas,
      postes,
      movimentacoes,
      usuarios,
    }
  } catch (e) {
    erroCarregamento = e.message
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-white">Estatísticas Globais</h1>
          <p className="text-sm text-slate-400 mt-0.5">
            Contagem de todos os registros no banco de dados
          </p>
        </div>
      </div>

      {erroCarregamento && (
        <div
          style={{ backgroundColor: '#450a0a', border: '1px solid #7f1d1d' }}
          className="rounded-lg px-4 py-3 text-sm text-red-400 mb-4"
        >
          Erro ao carregar estatísticas: {erroCarregamento}
        </div>
      )}

      {stats && <StatsClient stats={stats} />}
    </div>
  )
}
