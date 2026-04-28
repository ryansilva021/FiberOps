import OLTConnectionsView from '@/components/noc/OLTConnectionsView'

export const metadata = { title: 'NOC — Integrações de OLT' }
export const dynamic  = 'force-dynamic'

export default function IntegracoesPage() {
  return <OLTConnectionsView />
}
