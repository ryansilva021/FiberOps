import { auth } from '@/lib/auth'
import MapaFTTHClient from '@/components/map/MapaFTTHClient'

export default async function DashboardPage() {
  const session = await auth()

  return (
    <div className="h-full w-full relative">
      <MapaFTTHClient
        projetoId={session?.user?.projeto_id}
        userRole={session?.user?.role}
      />
    </div>
  )
}
