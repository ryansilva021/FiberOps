/**
 * src/services/networklab.js
 *
 * Cliente HTTP para o fiberops-network-lab.
 * FiberOps APENAS consome — nunca move lógica de coleta para cá.
 *
 * Configuração via env:
 *   NETWORK_LAB_URL   — base URL do network-lab (ex: http://localhost:4000)
 *   NETWORK_LAB_TOKEN — token Bearer opcional
 */

const BASE = process.env.NETWORK_LAB_URL ?? 'http://localhost:4000'
const TOKEN = process.env.NETWORK_LAB_TOKEN ?? ''

function headers() {
  const h = { 'Content-Type': 'application/json' }
  if (TOKEN) h['Authorization'] = `Bearer ${TOKEN}`
  return h
}

async function get(path, params = {}) {
  const url = new URL(BASE + path)
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null) url.searchParams.set(k, String(v))
  }
  const res = await fetch(url.toString(), {
    method: 'GET',
    headers: headers(),
    next: { revalidate: 0 },
  })
  if (!res.ok) {
    const msg = await res.text().catch(() => res.statusText)
    throw new Error(`[network-lab] GET ${path} → ${res.status}: ${msg}`)
  }
  return res.json()
}

async function post(path, body = {}) {
  const res = await fetch(BASE + path, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const msg = await res.text().catch(() => res.statusText)
    throw new Error(`[network-lab] POST ${path} → ${res.status}: ${msg}`)
  }
  return res.json()
}

// ── OLTs ──────────────────────────────────────────────────────────────────────

export async function getOLTs(params = {}) {
  return get('/olts', params)
}

export async function getOLT(id) {
  return get(`/olts/${id}`)
}

// ── PONs ──────────────────────────────────────────────────────────────────────

export async function getPONs(params = {}) {
  return get('/pons', params)
}

export async function getPON(id) {
  return get(`/pons/${id}`)
}

// ── ONUs ──────────────────────────────────────────────────────────────────────

export async function getONUs(params = {}) {
  return get('/onus', params)
}

export async function getONU(id) {
  return get(`/onus/${id}`)
}

export async function rebootONU(id) {
  return post(`/onus/${id}/reboot`)
}

export async function resetONU(id) {
  return post(`/onus/${id}/reset`)
}

// ── Alertas ───────────────────────────────────────────────────────────────────

export async function getAlerts(params = {}) {
  return get('/alerts', params)
}

export async function acknowledgeAlert(id) {
  return post(`/alerts/${id}/acknowledge`)
}

// ── Topologia / Telemetria ────────────────────────────────────────────────────

export async function getTopology() {
  return get('/topology')
}

export async function getTelemetry(params = {}) {
  return get('/telemetry', params)
}

// ── Dashboard summary (helper que agrega múltiplos endpoints) ─────────────────

export async function getDashboardSummary() {
  const [olts, onus, alerts, telemetry] = await Promise.allSettled([
    getOLTs(),
    getONUs({ limit: 9999 }),
    getAlerts({ status: 'active' }),
    getTelemetry(),
  ])

  const oltList     = olts.status     === 'fulfilled' ? (olts.value?.data     ?? olts.value     ?? []) : []
  const onuList     = onus.status     === 'fulfilled' ? (onus.value?.data     ?? onus.value     ?? []) : []
  const alertList   = alerts.status   === 'fulfilled' ? (alerts.value?.data   ?? alerts.value   ?? []) : []
  const telemetryData = telemetry.status === 'fulfilled' ? (telemetry.value ?? {}) : {}

  const oltsOnline  = oltList.filter(o => o.status === 'online').length
  const oltsOffline = oltList.filter(o => o.status !== 'online').length
  const onusOnline  = onuList.filter(o => o.status === 'online').length
  const onusOffline = onuList.filter(o => o.status !== 'online').length
  const critAlerts  = alertList.filter(a => a.severity === 'critical').length

  return {
    oltList,
    onuList,
    alertList,
    telemetry: telemetryData,
    summary: {
      oltsOnline,
      oltsOffline,
      oltsTotal: oltList.length,
      onusOnline,
      onusOffline,
      onusTotal: onuList.length,
      activeAlerts: alertList.length,
      criticalAlerts: critAlerts,
      clientsImpacted: onusOffline,
      totalTraffic: telemetryData.total_traffic_gbps ?? null,
    },
  }
}

// ── WebSocket URL helper ──────────────────────────────────────────────────────

export function getWebSocketURL() {
  const base = process.env.NEXT_PUBLIC_NETWORK_LAB_WS_URL
    ?? (BASE.replace(/^http/, 'ws') + '/ws')
  return base
}
