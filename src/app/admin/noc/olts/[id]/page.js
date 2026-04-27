import OLTDetailClient from '@/components/noc/OLTDetailClient'

export const metadata = { title: 'NOC — Detalhe OLT' }
export const dynamic  = 'force-dynamic'

export default function OLTDetailPage({ params }) {
  return <OLTDetailClient id={params.id} />
}
