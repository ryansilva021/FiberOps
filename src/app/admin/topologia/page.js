import { auth }      from '@/lib/auth'
import { redirect }   from 'next/navigation'
import { hasPermission, PERM } from '@/lib/permissions'
import { getCTOs }    from '@/actions/ctos'
import { getCaixas }  from '@/actions/caixas'
import { getOLTs }    from '@/actions/olts'
import DiagramasClient from '@/components/admin/DiagramasClient'
import PageHeading from '@/components/shared/PageHeading'
import TopologiaHealthPanel from '@/components/admin/TopologiaHealthPanel'

export const metadata = { title: 'Topologia | FiberOps' }

export default async function TopologiaPage({ searchParams }) {
  const session  = await auth()
  const userRole = session?.user?.role ?? 'user'
  const projetoId = session?.user?.projeto_id

  if (!hasPermission(userRole, PERM.VIEW_TOPOLOGY)) redirect('/')

  const sp        = await Promise.resolve(searchParams)
  const tabInicial = sp?.tab ?? 'topologia'   // abre o canvas por padrão
  const idInicial  = sp?.id  ?? null

  let ctos   = []
  let caixas = []
  let olts   = []
  let erroCarregamento = null

  try {
    ;[ctos, caixas, olts] = await Promise.all([
      getCTOs(projetoId),
      getCaixas(projetoId),
      getOLTs(projetoId),
    ])
  } catch (e) {
    erroCarregamento = e.message
  }

  const ctosOrfas      = ctos.filter(c => !c.cdo_id).length
  const cdosOrfos      = caixas.filter(c => !c.olt_id && !c.cdo_pai_id).length
  const capacidadeTotal = ctos.reduce((a, c) => a + (c.capacidade || 0), 0)
  const clientesAtivos  = ctos.reduce((a, c) => a + (c.ocupacao || 0), 0)
  const ponTotal        = olts.reduce((a, o) => a + (o.capacidade || 0), 0)
  const ponUsadas       = caixas.filter(c => c.olt_id).length
  const pctPonUsado     = ponTotal > 0 ? Math.round((ponUsadas / ponTotal) * 100) : 0

  const stats = {
    totalOlts: olts.length,
    totalCdos: caixas.length,
    totalCtos: ctos.length,
    ctosOrfas,
    cdosOrfos,
    capacidadeTotal,
    clientesAtivos,
    pctPonUsado,
    ponUsadas,
    ponTotal,
  }

  return (
    <div className="lg:p-6 p-4">
      <div className="hidden lg:flex items-center justify-between mb-6">
        <PageHeading
          titleKey="topologia.title"
          subtitle={`${olts.length} OLTs · ${caixas.length} CE/CDOs · ${ctos.length} CTOs`}
        />
      </div>

      {erroCarregamento && (
        <div style={{ backgroundColor: '#450a0a', border: '1px solid #7f1d1d' }}
          className="rounded-lg px-4 py-3 text-sm text-red-400 mb-4">
          Erro ao carregar dados: {erroCarregamento}
        </div>
      )}

      <TopologiaHealthPanel stats={stats} />

      <DiagramasClient
        ctos={ctos}
        caixas={caixas}
        olts={olts}
        projetoId={projetoId}
        tabInicial={tabInicial}
        idInicial={idInicial}
        userRole={userRole}
      />
    </div>
  )
}
