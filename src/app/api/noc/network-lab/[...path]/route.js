/**
 * /api/noc/network-lab/[...path]
 *
 * Proxy autenticado para o fiberops-network-lab.
 * Somente usuários com ACCESS_NOC podem consumir este endpoint.
 *
 * Rota especial:
 *   GET /api/noc/network-lab/dashboard  — agrega /olts, /onus, /alerts, /telemetry
 */

import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { hasPermission, PERM } from '@/lib/permissions'
import {
  getOLTs, getOLT, getPONs, getONUs,
  getAlerts, acknowledgeAlert, rebootONU, resetONU,
  getTelemetry, getTopology, getDashboardSummary,
} from '@/services/networklab'

// ── Guard ─────────────────────────────────────────────────────────────────────

async function guard() {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  }
  if (!hasPermission(session.user.role, PERM.ACCESS_NOC)) {
    return NextResponse.json(
      { error: 'Acesso restrito ao centro de operações de rede' },
      { status: 403 }
    )
  }
  return null
}

function notFound() {
  return NextResponse.json({ error: 'Endpoint não encontrado' }, { status: 404 })
}

function ok(data) {
  return NextResponse.json(data, {
    headers: { 'Cache-Control': 'no-store' },
  })
}

function err(e, status = 502) {
  const msg = e instanceof Error ? e.message : 'Erro interno'
  console.error('[noc/network-lab]', msg)
  return NextResponse.json({ error: msg }, { status })
}

// ── GET ───────────────────────────────────────────────────────────────────────

export async function GET(request, { params }) {
  const denied = await guard()
  if (denied) return denied

  const segments = params.path ?? []
  const [resource, id, action] = segments
  const sp = request.nextUrl.searchParams
  const qp = Object.fromEntries(sp.entries())

  try {
    // /dashboard — summary agregado
    if (resource === 'dashboard') return ok(await getDashboardSummary())

    if (resource === 'olts') {
      if (id) return ok(await getOLT(id))
      return ok(await getOLTs(qp))
    }

    if (resource === 'pons') {
      if (id) return ok(await getPONs({ olt_id: id, ...qp }))
      return ok(await getPONs(qp))
    }

    if (resource === 'onus') {
      if (id) {
        const onu = await getONUs({ id, ...qp })
        return ok(onu)
      }
      return ok(await getONUs(qp))
    }

    if (resource === 'alerts')   return ok(await getAlerts(qp))
    if (resource === 'topology') return ok(await getTopology())
    if (resource === 'telemetry') return ok(await getTelemetry(qp))

    return notFound()
  } catch (e) {
    return err(e)
  }
}

// ── POST ──────────────────────────────────────────────────────────────────────

export async function POST(request, { params }) {
  const denied = await guard()
  if (denied) return denied

  const session = await auth()
  if (!hasPermission(session.user.role, PERM.RUN_OLT_COMMANDS)) {
    return NextResponse.json(
      { error: 'Sem permissão para executar comandos remotos' },
      { status: 403 }
    )
  }

  const segments = params.path ?? []
  const [resource, id, action] = segments

  try {
    if (resource === 'onus' && id) {
      if (action === 'reboot') return ok(await rebootONU(id))
      if (action === 'reset')  return ok(await resetONU(id))
    }

    if (resource === 'alerts' && id && action === 'acknowledge') {
      return ok(await acknowledgeAlert(id))
    }

    return notFound()
  } catch (e) {
    return err(e)
  }
}
