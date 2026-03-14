import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import SuperadminSidebarLayout from '@/components/superadmin/SuperadminSidebarLayout'

export default async function SuperadminLayout({ children }) {
  const session = await auth()

  if (!session?.user) {
    redirect('/login')
  }

  if (session.user.role !== 'superadmin') {
    redirect('/')
  }

  return <SuperadminSidebarLayout session={session}>{children}</SuperadminSidebarLayout>
}
