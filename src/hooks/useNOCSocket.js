'use client'

/**
 * src/hooks/useNOCSocket.js
 *
 * WebSocket real-time para eventos do fiberops-network-lab.
 *
 * Eventos recebidos:
 *   ONU_OFFLINE | PON_DOWN | LOW_POWER | HIGH_POWER | LOS | OLT_OVERLOAD
 *
 * Uso:
 *   const { connected, events, lastEvent, clearEvents } = useNOCSocket({ onEvent })
 */

import { useState, useEffect, useCallback, useRef } from 'react'

const WS_URL = typeof window !== 'undefined'
  ? (process.env.NEXT_PUBLIC_NETWORK_LAB_WS_URL ?? 'ws://localhost:4000/ws')
  : null

const RECONNECT_DELAYS = [1_000, 2_000, 5_000, 10_000, 30_000]
const MAX_EVENTS       = 200

export const NOC_EVENT_TYPES = {
  ONU_OFFLINE:  'ONU_OFFLINE',
  PON_DOWN:     'PON_DOWN',
  LOW_POWER:    'LOW_POWER',
  HIGH_POWER:   'HIGH_POWER',
  LOS:          'LOS',
  OLT_OVERLOAD: 'OLT_OVERLOAD',
}

export const NOC_EVENT_META = {
  ONU_OFFLINE:  { label: 'ONU Offline',       severity: 'critical', color: '#dc2626' },
  PON_DOWN:     { label: 'PON Caída',          severity: 'critical', color: '#dc2626' },
  LOW_POWER:    { label: 'Potência Baixa',     severity: 'warning',  color: '#d97706' },
  HIGH_POWER:   { label: 'Potência Alta',      severity: 'warning',  color: '#f59e0b' },
  LOS:          { label: 'Perda de Sinal',     severity: 'critical', color: '#7c3aed' },
  OLT_OVERLOAD: { label: 'Sobrecarga OLT',     severity: 'critical', color: '#dc2626' },
}

export function useNOCSocket({ enabled = true, onEvent } = {}) {
  const [connected, setConnected] = useState(false)
  const [events,    setEvents]    = useState([])
  const [lastEvent, setLastEvent] = useState(null)

  const wsRef       = useRef(null)
  const retryRef    = useRef(0)
  const retryTimer  = useRef(null)
  const enabledRef  = useRef(enabled)
  const onEventRef  = useRef(onEvent)

  useEffect(() => { enabledRef.current = enabled },  [enabled])
  useEffect(() => { onEventRef.current = onEvent },  [onEvent])

  const connect = useCallback(() => {
    if (!enabledRef.current || !WS_URL) return
    if (wsRef.current?.readyState === WebSocket.OPEN) return

    const ws = new WebSocket(WS_URL)
    wsRef.current = ws

    ws.onopen = () => {
      setConnected(true)
      retryRef.current = 0
    }

    ws.onmessage = (e) => {
      let parsed
      try { parsed = JSON.parse(e.data) } catch { return }

      const event = {
        id:        parsed.id ?? `${Date.now()}-${Math.random()}`,
        type:      parsed.type ?? 'UNKNOWN',
        ts:        parsed.ts   ?? new Date().toISOString(),
        olt_id:    parsed.olt_id    ?? null,
        olt_name:  parsed.olt_name  ?? null,
        pon_id:    parsed.pon_id    ?? null,
        onu_id:    parsed.onu_id    ?? null,
        onu_sn:    parsed.onu_sn    ?? null,
        client:    parsed.client    ?? null,
        power_rx:  parsed.power_rx  ?? null,
        power_tx:  parsed.power_tx  ?? null,
        message:   parsed.message   ?? '',
        severity:  NOC_EVENT_META[parsed.type]?.severity ?? 'info',
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
      clearTimeout(retryTimer.current)
      wsRef.current?.close()
    }
  }, [connect, enabled])

  const clearEvents = useCallback(() => setEvents([]), [])

  const acknowledgeEvent = useCallback((id) => {
    setEvents(prev => prev.map(e => e.id === id ? { ...e, acknowledged: true } : e))
  }, [])

  return { connected, events, lastEvent, clearEvents, acknowledgeEvent }
}
