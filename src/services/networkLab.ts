/**
 * src/services/networkLab.ts
 *
 * Cliente isomórfico para o fiberops-network-lab.
 * Funciona em Server Components, Server Actions E no browser (client components).
 *
 * Env vars:
 *   NEXT_PUBLIC_NETWORK_LAB_URL      — Node.js lab (porta 4000), exposta ao browser
 *   NETWORK_LAB_TOKEN                — Bearer token (somente servidor)
 *   NETWORK_ENGINE_URL               — Docker FastAPI engine (porta 8000), somente servidor
 *   NEXT_PUBLIC_NETWORK_ENGINE_WS_URL — WebSocket do engine, exposto ao browser
 *
 * Quando NETWORK_ENGINE_URL estiver definido:
 *   OLTs / ONUs / alertas → Docker network-engine (porta 8000)
 *   PONs / conexões / telemetria → Node.js lab (porta 4000)
 */

// ── Tipos ─────────────────────────────────────────────────────────────────────

export type LabStatus = 'online' | 'offline' | 'degraded' | 'unknown'

export interface OLT {
  id: string
  name: string
  ip: string
  vendor?: string
  fabricante?: string
  model?: string
  status: LabStatus
  temperature?: number
  cpu_usage?: number
  mem_usage?: number
  onu_count?: number
  pon_ports?: number
  uptime?: string
  uplink?: string
  firmware_version?: string
  location?: string
  serial?: string
  boards?: OLTBoard[]
  lat?: number
  lng?: number
}

export interface OLTBoard {
  slot: number
  type?: string
  model?: string
  ports?: number
  status?: string
}

export interface PON {
  id: string
  olt_id: string
  olt_name?: string
  port: number
  name?: string
  status: LabStatus | 'down'
  onu_count?: number
  cto_count?: number
  client_count?: number
  bandwidth_down?: string
  speed?: string
}

export interface ONU {
  id: string
  serial?: string
  onu_sn?: string
  model?: string
  client?: string
  cliente?: string
  status: LabStatus
  power_rx?: number
  power_tx?: number
  distance?: string
  uptime?: string
  drop_count?: number
  falls?: number
  olt_id?: string
  olt_name?: string
  pon_id?: string
  lat?: number
  lng?: number
}

export type AlertSeverity = 'critical' | 'warning' | 'info'
export type AlertType =
  | 'ONU_OFFLINE'
  | 'PON_DOWN'
  | 'LOW_POWER'
  | 'HIGH_POWER'
  | 'LOS'
  | 'OLT_OVERLOAD'
  | string

export interface LabAlert {
  id: string
  type: AlertType
  severity: AlertSeverity
  message?: string
  description?: string
  status?: 'active' | 'acknowledged' | 'resolved'
  olt_id?: string
  olt_name?: string
  pon_id?: string
  onu_id?: string
  onu_sn?: string
  client?: string
  client_count?: number
  ts?: string
  created_at?: string
}

export interface TopologyNode {
  id: string
  type: 'olt' | 'pon' | 'onu' | 'cto'
  name?: string
  status: LabStatus
  lat?: number
  lng?: number
  parent_id?: string
}

export interface Topology {
  nodes: TopologyNode[]
  edges: { source: string; target: string }[]
}

export interface Telemetry {
  total_traffic_gbps?: number
  upload_gbps?: number
  download_gbps?: number
  active_sessions?: number
  ts?: string
}

export interface LabResponse<T> {
  data: T
  meta?: { total?: number; page?: number; pages?: number }
}

export interface DashboardSummary {
  oltList: OLT[]
  onuList: ONU[]
  alertList: LabAlert[]
  telemetry: Telemetry
  summary: {
    oltsOnline: number
    oltsOffline: number
    oltsTotal: number
    onusOnline: number
    onusOffline: number
    onusTotal: number
    activeAlerts: number
    criticalAlerts: number
    clientsImpacted: number
    totalTraffic: number | null
  }
  labOnline: boolean
}

// ── Fallback ──────────────────────────────────────────────────────────────────

const OFFLINE_SUMMARY: DashboardSummary = {
  oltList: [], onuList: [], alertList: [],
  telemetry: {},
  summary: {
    oltsOnline: 0, oltsOffline: 0, oltsTotal: 0,
    onusOnline: 0, onusOffline: 0, onusTotal: 0,
    activeAlerts: 0, criticalAlerts: 0,
    clientsImpacted: 0, totalTraffic: null,
  },
  labOnline: false,
}

// ── Config ────────────────────────────────────────────────────────────────────

function getLabURL(): string {
  return (
    process.env.NEXT_PUBLIC_NETWORK_LAB_URL ??
    process.env.NETWORK_LAB_URL ??
    'http://localhost:4000'
  )
}

function getEngineURL(): string | null {
  return process.env.NETWORK_ENGINE_URL ?? null
}

function getLabToken(): string {
  return process.env.NETWORK_LAB_TOKEN ?? ''
}

function labHeaders(): HeadersInit {
  const h: Record<string, string> = { 'Content-Type': 'application/json' }
  const token = getLabToken()
  if (token) h['Authorization'] = `Bearer ${token}`
  return h
}

// ── Fetch helpers — Node.js lab (porta 4000) ──────────────────────────────────

async function labGet<T>(path: string, params: Record<string, string> = {}): Promise<T> {
  const base = getLabURL()
  const url  = new URL(`${base}/api${path}`)
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null) url.searchParams.set(k, v)
  }
  const res = await fetch(url.toString(), {
    method: 'GET', headers: labHeaders(), cache: 'no-store',
    signal: AbortSignal.timeout(8_000),
  })
  if (!res.ok) {
    const body = await res.text().catch(() => res.statusText)
    throw new Error(`[network-lab] GET ${path} → ${res.status}: ${body}`)
  }
  return res.json() as Promise<T>
}

async function labPost<T>(path: string, body: unknown = {}): Promise<T> {
  const base = getLabURL()
  const res  = await fetch(`${base}/api${path}`, {
    method: 'POST', headers: labHeaders(), body: JSON.stringify(body),
    signal: AbortSignal.timeout(10_000),
  })
  if (!res.ok) {
    const msg = await res.text().catch(() => res.statusText)
    throw new Error(`[network-lab] POST ${path} → ${res.status}: ${msg}`)
  }
  return res.json() as Promise<T>
}

// ── Fetch helpers — Docker network-engine (porta 8000) ───────────────────────

async function engineGet<T>(path: string, params: Record<string, string> = {}): Promise<T> {
  const base = getEngineURL()!
  const url  = new URL(`${base}/api/v1${path}`)
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null) url.searchParams.set(k, v)
  }
  const res = await fetch(url.toString(), {
    method: 'GET', cache: 'no-store', redirect: 'follow',
    signal: AbortSignal.timeout(8_000),
  })
  if (!res.ok) {
    const body = await res.text().catch(() => res.statusText)
    throw new Error(`[network-engine] GET ${path} → ${res.status}: ${body}`)
  }
  return res.json() as Promise<T>
}

async function enginePost<T>(path: string, body: unknown = {}): Promise<T> {
  const base = getEngineURL()!
  const res  = await fetch(`${base}/api/v1${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    redirect: 'follow',
    signal: AbortSignal.timeout(10_000),
  })
  if (!res.ok) {
    const msg = await res.text().catch(() => res.statusText)
    throw new Error(`[network-engine] POST ${path} → ${res.status}: ${msg}`)
  }
  return res.json() as Promise<T>
}

// Wrap plain array from engine into our paginated shape
function wrapArray<T>(arr: T[]): LabResponse<T[]> {
  return { data: arr, meta: { total: arr.length, page: 1, pages: 1 } }
}

// ── Alarm type normalisation (engine → our types) ─────────────────────────────

const ENGINE_TYPE_MAP: Record<string, string> = {
  RX_LOW:    'LOW_POWER',
  TX_HIGH:   'HIGH_POWER',
  OLT_ALARM: 'OLT_OVERLOAD',
}

function normaliseAlarmType(type: string): string {
  return ENGINE_TYPE_MAP[type] ?? type
}

function normaliseSeverity(s: string): AlertSeverity {
  if (s === 'critical' || s === 'major') return 'critical'
  if (s === 'minor' || s === 'warning')  return 'warning'
  return 'info'
}

// ── Ping ──────────────────────────────────────────────────────────────────────

export async function pingLab(): Promise<boolean> {
  try {
    const engine = getEngineURL()
    const url = engine
      ? `${engine}/api/v1/olts/`
      : `${getLabURL()}/api/health`
    await fetch(url, {
      method: 'GET', cache: 'no-store', redirect: 'follow',
      signal: AbortSignal.timeout(3_000),
    })
    return true
  } catch {
    return false
  }
}

// ── OLTs ──────────────────────────────────────────────────────────────────────

export async function getOLTs(params: Record<string, string> = {}): Promise<LabResponse<OLT[]>> {
  if (getEngineURL()) {
    const raw = await engineGet<OLT[]>('/olts/', params)
    return wrapArray(raw)
  }
  return labGet<LabResponse<OLT[]>>('/olts', params)
}

export async function getOLT(id: string): Promise<OLT> {
  if (getEngineURL()) {
    return engineGet<OLT>(`/olts/${id}/`)
  }
  return labGet<OLT>(`/olts/${id}`)
}

// ── PONs — engine has no /pons endpoint, always from Node.js lab ──────────────

export async function getPONs(params: Record<string, string> = {}): Promise<LabResponse<PON[]>> {
  return labGet<LabResponse<PON[]>>('/pons', params)
}

// ── ONUs ──────────────────────────────────────────────────────────────────────

type EngineONU = {
  id: string; olt_id: string; onu_id: number; serial: string
  status: string; rx_power?: number; tx_power?: number
  distance?: number; uptime?: number; slot?: number; port?: number; vendor?: string
}

function normaliseONU(o: EngineONU): ONU {
  return {
    id:       o.id,
    olt_id:   o.olt_id,
    serial:   o.serial,
    onu_sn:   o.serial,
    status:   o.status as LabStatus,
    power_rx: o.rx_power,
    power_tx: o.tx_power,
    distance: o.distance != null ? `${o.distance}m` : undefined,
    uptime:   o.uptime   != null
      ? `${Math.floor(o.uptime / 86400)}d ${Math.floor((o.uptime % 86400) / 3600)}h`
      : undefined,
    pon_id: o.slot != null && o.port != null ? `pon-${o.slot}-${o.port}` : undefined,
  }
}

export async function getONUs(params: Record<string, string> = {}): Promise<LabResponse<ONU[]>> {
  if (getEngineURL()) {
    const raw = await engineGet<EngineONU[]>('/onus/', params)
    return wrapArray(raw.map(normaliseONU))
  }
  return labGet<LabResponse<ONU[]>>('/onus', params)
}

export async function rebootONU(id: string): Promise<{ ok: boolean }> {
  if (getEngineURL()) {
    await enginePost(`/onus/${id}/reboot/`)
    return { ok: true }
  }
  return labPost<{ ok: boolean }>(`/onus/${id}/reboot`)
}

export async function resetONU(id: string): Promise<{ ok: boolean }> {
  if (getEngineURL()) {
    await enginePost(`/onus/${id}/reset/`)
    return { ok: true }
  }
  return labPost<{ ok: boolean }>(`/onus/${id}/reset`)
}

// ── Alertas ───────────────────────────────────────────────────────────────────

type EngineAlarm = {
  id: string; severity: string; type: string; message: string
  resolved: boolean; created_at: string; olt_id?: string; onu_id?: string
}

function normaliseAlarm(a: EngineAlarm): LabAlert {
  return {
    id:         a.id,
    type:       normaliseAlarmType(a.type),
    severity:   normaliseSeverity(a.severity),
    message:    a.message,
    status:     a.resolved ? 'resolved' : 'active',
    olt_id:     a.olt_id,
    onu_id:     a.onu_id,
    ts:         a.created_at,
    created_at: a.created_at,
  }
}

export async function getAlerts(
  params: Record<string, string> = {}
): Promise<LabResponse<LabAlert[]>> {
  if (getEngineURL()) {
    const engineParams: Record<string, string> = { ...params }
    if (params.status === 'active')   engineParams.resolved = 'false'
    if (params.status === 'resolved') engineParams.resolved = 'true'
    delete engineParams.status
    const raw = await engineGet<EngineAlarm[]>('/alarms/', engineParams)
    return wrapArray(raw.map(normaliseAlarm))
  }
  return labGet<LabResponse<LabAlert[]>>('/alerts', params)
}

export async function acknowledgeAlert(id: string): Promise<{ ok: boolean }> {
  if (getEngineURL()) {
    await enginePost(`/alarms/${id}/acknowledge/`)
    return { ok: true }
  }
  return labPost<{ ok: boolean }>(`/alerts/${id}/acknowledge`)
}

// ── Topologia ─────────────────────────────────────────────────────────────────

export async function getTopology(): Promise<Topology> {
  if (getEngineURL()) {
    try {
      return await engineGet<Topology>('/topology/')
    } catch {
      // engine topology may be unavailable — fall back to lab
    }
  }
  return labGet<Topology>('/topology')
}

// ── Telemetria — engine has no /telemetry endpoint, always from Node.js lab ───

export async function getTelemetry(
  params: Record<string, string> = {}
): Promise<Telemetry> {
  try {
    return await labGet<Telemetry>('/telemetry', params)
  } catch {
    return {}
  }
}

// ── Dashboard (agrega endpoints) ──────────────────────────────────────────────

export async function getDashboardSummary(): Promise<DashboardSummary> {
  const [oltsRes, onusRes, alertsRes, telRes] = await Promise.allSettled([
    getOLTs(),
    getONUs({ limit: '9999' }),
    getAlerts({ status: 'active' }),
    getTelemetry(),
  ])

  const allFailed = [oltsRes, onusRes, alertsRes, telRes].every(
    r => r.status === 'rejected'
  )
  if (allFailed) return OFFLINE_SUMMARY

  const oltList   = oltsRes.status   === 'fulfilled' ? (oltsRes.value?.data   ?? []) : []
  const onuList   = onusRes.status   === 'fulfilled' ? (onusRes.value?.data   ?? []) : []
  const alertList = alertsRes.status === 'fulfilled' ? (alertsRes.value?.data ?? []) : []
  const telemetry = telRes.status    === 'fulfilled' ? (telRes.value ?? {})          : {}

  const oltsOnline  = oltList.filter(o => o.status === 'online').length
  const oltsOffline = oltList.filter(o => o.status !== 'online').length
  const onusOnline  = onuList.filter(o => o.status === 'online').length
  const onusOffline = onuList.filter(o => o.status !== 'online').length
  const critAlerts  = alertList.filter(a => a.severity === 'critical').length

  return {
    oltList,
    onuList,
    alertList,
    telemetry,
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
      totalTraffic: telemetry.total_traffic_gbps ?? null,
    },
    labOnline: true,
  }
}

// ── WebSocket URL ─────────────────────────────────────────────────────────────

export function getWebSocketURL(): string {
  const base = getLabURL().replace(/^http/, 'ws')
  return `${base}/ws`
}
