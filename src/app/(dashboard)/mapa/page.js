import { auth }        from '@/lib/auth'
import { redirect }    from 'next/navigation'
import { connectDB }   from '@/lib/db'
import { PLAN_LIMITS } from '@/lib/plan-config'
import MapaFTTHClient  from '@/components/map/MapaFTTHClient'

export default async function MapaPage() {
  const session = await auth()
  if (!session?.user) redirect('/login')

  const projetoId = session.user.projeto_id
  const userRole  = session.user.role

  let plano   = 'trial'
  let limites = PLAN_LIMITS.trial

  if (userRole !== 'superadmin' && projetoId) {
    try {
      await connectDB()
      const { Empresa } = await import('@/models/Empresa')
      const empresa = await Empresa.findOne({ projetos: projetoId }, 'plano').lean()
      if (empresa?.plano) {
        plano   = empresa.plano
        limites = PLAN_LIMITS[plano] ?? PLAN_LIMITS.trial
      }
    } catch { /* usa trial como fallback */ }
  }

  return (
    <div className="h-full w-full relative">
      <MapaFTTHClient
        projetoId={projetoId}
        userRole={userRole}
        plano={plano}
        limiteCTOs={limites.ctos ?? null}
        limiteOLTs={limites.olts ?? null}
      />
    </div>
  )
}
