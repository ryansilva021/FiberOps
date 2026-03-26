/**
 * src/app/api/ctos/full/route.js
 * GET /api/ctos/full
 *
 * Returns all CTOs for the authenticated project with full port occupancy:
 * [{ id, name, cdo_id, lat, lng, ports: [{ port_number, status, client: { name } | null }] }]
 *
 * "status" is either "OCUPADO" or "LIVRE" for easy frontend consumption.
 * Ports are derived from diagrama.splitters[].saidas[].cliente.
 */

import { auth } from '@/lib/auth'
import { connectDB } from '@/lib/db'
import { CTO } from '@/models/CTO'

const NOC_ALLOWED = ['superadmin', 'admin', 'noc', 'tecnico']

export const dynamic = 'force-dynamic'

export async function GET() {
  const session = await auth()
  const role    = session?.user?.role ?? 'user'

  if (!NOC_ALLOWED.includes(role)) {
    return Response.json({ error: 'Forbidden' }, { status: 403 })
  }

  const projeto_id = session.user.projeto_id

  try {
    await connectDB()

    const ctos = await CTO
      .find({ projeto_id }, 'cto_id nome cdo_id lat lng diagrama capacidade')
      .lean()

    const result = ctos.map((cto) => {
      const splitters = cto.diagrama?.splitters ?? []
      const ports     = []
      let   portNum   = 0

      for (const splitter of splitters) {
        const saidas = splitter.saidas ?? []
        for (const saida of saidas) {
          portNum++
          const clienteName = saida?.cliente?.trim() || null
          ports.push({
            port_number: saida.porta ?? portNum,
            splitter_nome: splitter.nome ?? null,
            status: clienteName ? 'OCUPADO' : 'LIVRE',
            client: clienteName ? { name: clienteName } : null,
          })
        }
      }

      // Fallback: if no splitters, show empty slots up to capacidade
      if (ports.length === 0 && cto.capacidade > 0) {
        for (let i = 1; i <= cto.capacidade; i++) {
          ports.push({ port_number: i, splitter_nome: null, status: 'LIVRE', client: null })
        }
      }

      const ocupadas = ports.filter(p => p.status === 'OCUPADO').length

      return {
        id:         cto.cto_id,
        name:       cto.nome ?? cto.cto_id,
        cdo_id:     cto.cdo_id ?? null,
        lat:        cto.lat,
        lng:        cto.lng,
        capacidade: cto.capacidade ?? ports.length,
        ocupadas,
        livres:     ports.length - ocupadas,
        pct:        ports.length > 0 ? Math.round((ocupadas / ports.length) * 100) : 0,
        ports,
      }
    })

    return Response.json(result)
  } catch (err) {
    console.error('[GET /api/ctos/full]', err.message)
    return Response.json({ error: err.message }, { status: 500 })
  }
}
