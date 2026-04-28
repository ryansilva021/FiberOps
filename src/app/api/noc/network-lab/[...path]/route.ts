/**
 * /api/noc/network-lab/[...path]
 *
 * Proxy server-side autenticado para o fiberops-network-lab.
 * Usa NEXT_PUBLIC_NETWORK_LAB_URL + NETWORK_LAB_TOKEN.
 * Endpoints do lab têm prefixo /api/ (ex: /api/olts).
 *
 * Somente usuários com ACCESS_NOC podem usar este proxy.
 * Ações de comando (reboot, reset, acknowledge) exigem RUN_OLT_COMMANDS.
 */

import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { hasPermission, PERM } from '@/lib/permissions'
import {
  getOLTs, getOLT, getPONs, getONUs, getOLT as getOLTById,
  getAlerts, acknowledgeAlert, rebootONU, resetONU,
  getTelemetry, getTopology, getDashboardSummary,
} from '@/services/networkLab'

// ── Guards ────────────────────────────────────────────────────────────────────

async function requireNOC() {
  const session = await auth()
  if (!session?.user) return { error: NextResponse.json({ error: 'Não autenticado' }, { status: 401 }) }
  if (!hasPermission((session.user as any).role, PERM.ACCESS_NOC)) {
    return {
      error: NextResponse.json(
        { error: 'Acesso restrito ao centro de operações de rede' },
        { status: 403 }
      ),
    }
  }
  return { session }
}

const NO_STORE = { headers: { 'Cache-Control': 'no-store' } }

function labOffline() {
  return NextResponse.json(
    { error: 'network-lab offline', labOnline: false, data: [] },
    { status: 503 }
  )
}

function notFound() {
  return NextResponse.json({ error: 'Endpoint não encontrado' }, { status: 404 })
}

function ok(data: unknown) {
  return NextResponse.json(data, NO_STORE)
}

function fail(e: unknown, status = 502) {
  const msg = e instanceof Error ? e.message : 'Erro interno'
  console.error('[noc/network-lab proxy]', msg)
  // Se mensagem indica lab offline, retorna 503 gracioso
  if (msg.includes('fetch') || msg.includes('ECONNREFUSED') || msg.includes('network')) {
    return labOffline()
  }
  return NextResponse.json({ error: msg, labOnline: false }, { status })
}

// ── GET ───────────────────────────────────────────────────────────────────────

export async function GET(
  request: Request,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { error } = await requireNOC()
  if (error) return error

  const { path } = await params
  const segments = path ?? []
  const [resource, id] = segments
  const sp = new URL(request.url).searchParams
  const qp = Object.fromEntries(sp.entries())

  try {
    // /dashboard — summary agregado com fallback embutido
    if (resource === 'dashboard') return ok(await getDashboardSummary())

    if (resource === 'olts') {
      if (id) return ok(await getOLTById(id))
      return ok(await getOLTs(qp))
    }

    if (resource === 'pons')     return ok(await getPONs({ ...qp, ...(id ? { olt_id: id } : {}) }))
    if (resource === 'onus')     return ok(await getONUs(qp))
    if (resource === 'alerts')   return ok(await getAlerts(qp))
    if (resource === 'topology') return ok(await getTopology())
    if (resource === 'telemetry') return ok(await getTelemetry(qp))

    return notFound()
  } catch (e) {
    return fail(e)
  }
}

// ── POST ──────────────────────────────────────────────────────────────────────

export async function POST(
  request: Request,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { error, session } = await requireNOC()
  if (error) return error

  if (!hasPermission((session!.user as any).role, PERM.RUN_OLT_COMMANDS)) {
    return NextResponse.json(
      { error: 'Sem permissão para executar comandos remotos' },
      { status: 403 }
    )
  }

  const { path } = await params
  const segments = path ?? []
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
    return fail(e)
  }
}
