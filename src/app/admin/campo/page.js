import { auth }      from '@/lib/auth'
import { getCTOs }   from '@/actions/ctos'
import { getCaixas } from '@/actions/caixas'
import { getRotas }  from '@/actions/rotas'
import { getPostes } from '@/actions/postes'
import { getOLTs }   from '@/actions/olts'
import CampoClient   from '@/components/admin/CampoClient'
import PageHeading   from '@/components/shared/PageHeading'
import { connectDB } from '@/lib/db'
import { PLAN_LIMITS } from '@/lib/plan-config'

export const metadata = {
  title: 'Campo | FiberOps',
}

export default async function CampoPage({ searchParams }) {
  const session   = await auth()
  const projetoId = session?.user?.projeto_id
  const userRole  = session?.user?.role
  const sp = await Promise.resolve(searchParams)
  const tabInicial = sp?.tab ?? 'ctos'
  const idInicial  = sp?.id  ?? null

  const [ctos, caixas, rotasFC, postes, olts] = await Promise.allSettled([
    getCTOs(projetoId),
    getCaixas(projetoId),
    getRotas(projetoId),
    getPostes(projetoId),
    getOLTs(projetoId),
  ]).then((results) => results.map((r) => (r.status === 'fulfilled' ? r.value : [])))

  const rotas = rotasFC?.features ?? []

  // Buscar plano da empresa para exibir limites na UI
  let planoEmpresa = 'trial'
  try {
    await connectDB()
    const { Empresa } = await import('@/models/Empresa')
    const empresa = await Empresa.findOne({ projetos: projetoId }, 'plano').lean()
    if (empresa?.plano) planoEmpresa = empresa.plano
  } catch { /* usa trial como fallback */ }

  const limites = PLAN_LIMITS[planoEmpresa] ?? PLAN_LIMITS.trial

  return (
    <div className="p-6">
      <div className="mb-6">
        <PageHeading titleKey="campo.title" subtitleKey="campo.subtitle" />
      </div>

      <CampoClient
        ctosIniciais={ctos}
        caixasIniciais={caixas}
        rotasIniciais={rotas}
        postesIniciais={postes}
        oltsIniciais={olts}
        projetoId={projetoId}
        userRole={userRole}
        tabInicial={tabInicial}
        idInicial={idInicial}
        plano={planoEmpresa}
        limites={limites}
      />
    </div>
  )
}
