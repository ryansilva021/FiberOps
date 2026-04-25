import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { getHistoricoPontoAdmin } from '@/actions/time-record'
import { connectDB } from '@/lib/db'
import PontoHistoricoClient from '@/components/admin/PontoHistoricoClient'

export const metadata = { title: 'Histórico de Ponto · FiberOps' }

export default async function PontoAdminPage() {
  const session = await auth()
  if (!session?.user) redirect('/login')
  if (!['admin', 'superadmin'].includes(session.user.role)) redirect('/')

  // Carrega o mês atual por padrão
  const now = new Date()
  const ano = now.getFullYear()
  const mes = now.getMonth() + 1

  let registros = []
  try {
    registros = await getHistoricoPontoAdmin({ ano, mes })
  } catch { /* retorna vazio */ }

  return (
    <div className="p-6">
      <PontoHistoricoClient
        registrosIniciais={registros}
        anoInicial={ano}
        mesInicial={mes}
      />
    </div>
  )
}
