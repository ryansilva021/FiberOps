import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { hasPermission, PERM } from '@/lib/permissions'
import NOCSubNav from '@/components/noc/NOCSubNav'

export default async function NOCLayout({ children }) {
  const session = await auth()

  if (!session?.user) redirect('/login')

  if (!hasPermission(session.user.role, PERM.ACCESS_NOC)) {
    redirect('/acesso-negado')
  }

  return (
    <div style={{ minHeight: '100%', backgroundColor: 'var(--background)' }}>
      <NOCSubNav />
      {children}
    </div>
  )
}
