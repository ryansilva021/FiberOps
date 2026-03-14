/**
 * src/app/(admin)/diagramas/page.js
 * Página de gerenciamento de diagramas ópticos (CTOs e CE/CDOs).
 * Server Component — carrega dados e passa para DiagramasClient.
 */

import { auth } from '@/lib/auth'
import { getCTOs } from '@/actions/ctos'
import { getCaixas } from '@/actions/caixas'
import DiagramasClient from '@/components/admin/DiagramasClient'

export const metadata = {
  title: 'Diagramas | FiberOps',
}

export default async function DiagramasPage() {
  const session = await auth()
  const projetoId = session?.user?.projeto_id

  let ctos   = []
  let caixas = []
  let erroCarregamento = null

  try {
    ;[ctos, caixas] = await Promise.all([
      getCTOs(projetoId),
      getCaixas(projetoId),
    ])
  } catch (e) {
    erroCarregamento = e.message
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-white">Diagramas Ópticos</h1>
          <p className="text-sm text-slate-400 mt-0.5">
            Mapeamento de portas e conexões — {ctos.length} CTOs · {caixas.length} CE/CDOs
          </p>
        </div>
      </div>

      {erroCarregamento && (
        <div
          style={{ backgroundColor: '#450a0a', border: '1px solid #7f1d1d' }}
          className="rounded-lg px-4 py-3 text-sm text-red-400 mb-4"
        >
          Erro ao carregar dados: {erroCarregamento}
        </div>
      )}

      <DiagramasClient
        ctos={ctos}
        caixas={caixas}
        projetoId={projetoId}
      />
    </div>
  )
}
