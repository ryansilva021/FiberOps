import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import SidebarLayout from '@/components/shared/SidebarLayout'

export default async function DashboardLayout({ children }) {
  const session = await auth()

  if (!session?.user) {
    redirect('/login')
  }

  return <SidebarLayout session={session}>{children}</SidebarLayout>
}
