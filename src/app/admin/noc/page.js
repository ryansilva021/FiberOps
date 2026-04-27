import NOCDashboardClient from '@/components/noc/NOCDashboardClient'

export const metadata = { title: 'NOC — Centro de Operações de Rede' }
export const dynamic  = 'force-dynamic'

export default function NOCDashboardPage() {
  return <NOCDashboardClient />
}
