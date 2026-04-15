import { connectDB } from '@/lib/db'
import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { Projeto } from '@/models/Projeto'
import { CTO } from '@/models/CTO'
import { CaixaEmendaCDO } from '@/models/CaixaEmendaCDO'
import { Rota } from '@/models/Rota'
import { Poste } from '@/models/Poste'
import { OLT } from '@/models/OLT'
import { Movimentacao } from '@/models/Movimentacao'
import { User } from '@/models/User'
import { Empresa } from '@/models/Empresa'
import StatsClient from '@/components/superadmin/StatsClient'

export const metadata = {
  title: 'Visão Geral | FiberOps Superadmin',
}

export default async function StatsPage() {
  const session = await auth()
  if (session?.user?.role !== 'superadmin') redirect('/')

  let stats = null
  let erroCarregamento = null

  try {
    await connectDB()

    const [projetos, empresas, olts, ctos, caixas, rotas, postes, movimentacoes, usuarios] =
      await Promise.all([
        Projeto.countDocuments(),
        Empresa.countDocuments({ is_active: true }),
        OLT.countDocuments(),
        CTO.countDocuments(),
        CaixaEmendaCDO.countDocuments(),
        Rota.countDocuments(),
        Poste.countDocuments(),
        Movimentacao.countDocuments(),
        User.countDocuments({ role: { $ne: 'superadmin' } }),
      ])

    stats = { projetos, empresas, olts, ctos, caixas, rotas, postes, movimentacoes, usuarios }
  } catch (e) {
    erroCarregamento = e.message
  }

  return (
    <div className="p-6">
      <div className="mb-8">
        <h1 className="text-2xl font-bold" style={{ color: '#f1f5f9' }}>
          Visão Geral
        </h1>
        <p className="text-sm mt-1" style={{ color: '#64748b' }}>
          Contagem global de todos os registros no sistema
        </p>
      </div>

      {erroCarregamento && (
        <div
          style={{ backgroundColor: '#450a0a', border: '1px solid #7f1d1d' }}
          className="rounded-lg px-4 py-3 text-sm text-red-400 mb-6"
        >
          Erro ao carregar estatísticas: {erroCarregamento}
        </div>
      )}

      {stats && <StatsClient stats={stats} />}
    </div>
  )
}
