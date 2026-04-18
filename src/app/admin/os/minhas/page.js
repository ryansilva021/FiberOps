import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { listOS } from '@/actions/service-orders'
import MinhasOSClient from '@/components/admin/os/MinhasOSClient'

export const metadata = { title: 'Minhas OS · FiberOps' }

const ALLOWED = ['superadmin', 'admin', 'noc', 'recepcao', 'tecnico']

export default async function MinhasOSPage() {
  const session = await auth()
  if (!session?.user) redirect('/login')

  const role     = session.user.role
  const username = session.user.username ?? ''

  if (!ALLOWED.includes(role)) redirect('/')

  let items = []
  let erro  = null

  try {
    // Backend enforces filtering:
    //   tecnico  → only OS where tecnico_id === username (in listOS action)
    //   admin / recepcao / noc / superadmin → all OS of the project
    const data = await listOS({ limit: 200 })
    items = data.items
  } catch (e) {
    erro = e.message
  }

  const isTecnico  = role === 'tecnico'
  const pageTitle  = isTecnico ? 'Minhas OS' : 'Todas as OS'

  return (
    <MinhasOSClient
      initialItems={items}
      userRole={role}
      userId={username}
      pageTitle={pageTitle}
      erro={erro}
    />
  )
}
