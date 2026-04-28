'use client'

/**
 * src/hooks/useNOCSocket.js
 *
 * WebSocket para eventos em tempo real do fiberops-network-lab.
 * URL: ws(s)://NEXT_PUBLIC_NETWORK_LAB_URL/ws
 *
 * Eventos suportados:
 *   ONU_OFFLINE | PON_DOWN | LOW_POWER | HIGH_POWER | LOS | OLT_OVERLOAD
 *
 * Fallback: reconnect automático com backoff exponencial.
 * Quando o lab está offline, connected = false sem travar a UI.
 */

import { useState, useEffect, useCallback, useRef } from 'react'

function buildWsURL(): string {
  // Prefer Docker network-engine WebSocket when configured
  const engineWs = process.env.NEXT_PUBLIC_NETWORK_ENGINE_WS_URL
  if (engineWs) return engineWs
  const base = process.env.NEXT_PUBLIC_NETWORK_LAB_URL ?? 'http://localhost:4000'
  return base.replace(/^http/, 'ws') + '/ws'
}

const RECONNECT_DELAYS = [1_000, 2_000, 5_000, 10_000, 30_000]
const MAX_EVENTS = 200

export const NOC_EVENT_TYPES = {
  ONU_OFFLINE:  'ONU_OFFLINE',
  PON_DOWN:     'PON_DOWN',
  LOW_POWER:    'LOW_POWER',
  HIGH_POWER:   'HIGH_POWER',
  LOS:          'LOS',
  OLT_OVERLOAD: 'OLT_OVERLOAD',
} as const

export type NOCEventType = keyof typeof NOC_EVENT_TYPES

export const NOC_EVENT_META: Record<string, { label: string; severity: 'critical' | 'warning' | 'info'; color: string }> = {
  ONU_OFFLINE:  { label: 'ONU Offline',     severity: 'critical', color: '#dc2626' },
  PON_DOWN:     { label: 'PON Caída',        severity: 'critical', color: '#dc2626' },
  LOW_POWER:    { label: 'Potência Baixa',   severity: 'warning',  color: '#d97706' },
  HIGH_POWER:   { label: 'Potência Alta',    severity: 'warning',  color: '#f59e0b' },
  LOS:          { label: 'Perda de Sinal',   severity: 'critical', color: '#7c3aed' },
  OLT_OVERLOAD: { label: 'Sobrecarga OLT',   severity: 'critical', color: '#dc2626' },
}

export interface NOCEvent {
  id: string
  type: string
  ts: string
  olt_id?: string | null
  olt_name?: string | null
  pon_id?: string | null
  onu_id?: string | null
  onu_sn?: string | null
  client?: string | null
  client_count?: number | null
  power_rx?: number | null
  power_tx?: number | null
  lat?: number | null
  lng?: number | null
  message: string
  severity: 'critical' | 'warning' | 'info'
  acknowledged: boolean
}

export interface UseNOCSocketOptions {
  enabled?: boolean
  onEvent?: (event: NOCEvent) => void
}

export function useNOCSocket({ enabled = true, onEvent }: UseNOCSocketOptions = {}) {
  const [connected, setConnected] = useState(false)
  const [events,    setEvents]    = useState<NOCEvent[]>([])
  const [lastEvent, setLastEvent] = useState<NOCEvent | null>(null)

  const wsRef      = useRef<WebSocket | null>(null)
  const retryRef   = useRef(0)
  const retryTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const enabledRef = useRef(enabled)
  const onEventRef = useRef(onEvent)

  useEffect(() => { enabledRef.current = enabled }, [enabled])
  useEffect(() => { onEventRef.current = onEvent },  [onEvent])

  const connect = useCallback(() => {
    if (!enabledRef.current) return
    if (typeof window === 'undefined') return
    if (wsRef.current?.readyState === WebSocket.OPEN) return

    let ws: WebSocket
    try {
      ws = new WebSocket(buildWsURL())
    } catch {
      // URL inválida ou bloqueada — não reconectar agressivamente
      retryTimer.current = setTimeout(connect, 30_000)
      return
    }
    wsRef.current = ws

    ws.onopen = () => {
      setConnected(true)
      retryRef.current = 0
    }

    ws.onmessage = (e: MessageEvent) => {
      let parsed: Record<string, unknown>
      try { parsed = JSON.parse(e.data as string) } catch { return }

      // Normalise event types from Docker network-engine
      const ENGINE_TYPE_MAP: Record<string, string> = {
        RX_LOW: 'LOW_POWER', TX_HIGH: 'HIGH_POWER', OLT_ALARM: 'OLT_OVERLOAD',
      }
      const rawType = (parsed.type as string) ?? 'UNKNOWN'
      const type    = ENGINE_TYPE_MAP[rawType] ?? rawType

      // engine sends 'serial' instead of 'onu_sn', and impact object for counts
      const impact = parsed.impact as Record<string, unknown> | undefined

      const event: NOCEvent = {
        id:           (parsed.id as string)        ?? `${Date.now()}-${Math.random()}`,
        type,
        ts:           (parsed.ts as string)        ?? new Date().toISOString(),
        olt_id:       (parsed.olt_id as string)    ?? null,
        olt_name:     (parsed.olt_name as string)  ?? null,
        pon_id:       (parsed.pon_id as string)    ?? null,
        onu_id:       (parsed.onu_id as string)    ?? null,
        onu_sn:       (parsed.onu_sn as string) ?? (parsed.serial as string) ?? null,
        client:       (parsed.client as string)    ?? null,
        client_count: (parsed.client_count as number) ?? (impact?.affected_onus as number) ?? null,
        power_rx:     (parsed.power_rx as number) ?? (parsed.rx_power as number) ?? null,
        power_tx:     (parsed.power_tx as number) ?? (parsed.tx_power as number) ?? null,
        lat:          (parsed.lat as number)       ?? null,
        lng:          (parsed.lng as number)       ?? null,
        message:      (parsed.message as string)   ?? '',
        severity:     (NOC_EVENT_META[type]?.severity) ?? 'info',
        acknowledged: false,
      }

      setLastEvent(event)
      setEvents(prev => [event, ...prev].slice(0, MAX_EVENTS))
      onEventRef.current?.(event)
    }

    ws.onclose = () => {
      setConnected(false)
      if (!enabledRef.current) return
      const delay = RECONNECT_DELAYS[Math.min(retryRef.current, RECONNECT_DELAYS.length - 1)]
      retryRef.current++
      retryTimer.current = setTimeout(connect, delay)
    }

    ws.onerror = () => ws.close()
  }, [])

  useEffect(() => {
    if (!enabled) {
      wsRef.current?.close()
      return
    }
    connect()
    return () => {
      enabledRef.current = false
      if (retryTimer.current) clearTimeout(retryTimer.current)
      wsRef.current?.close()
    }
  }, [connect, enabled])

  const clearEvents = useCallback(() => setEvents([]), [])

  const acknowledgeEvent = useCallback((id: string) => {
    setEvents(prev => prev.map(e => e.id === id ? { ...e, acknowledged: true } : e))
  }, [])

  return { connected, events, lastEvent, clearEvents, acknowledgeEvent }
}
