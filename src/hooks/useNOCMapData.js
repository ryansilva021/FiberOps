'use client'

/**
 * src/hooks/useNOCMapData.js
 *
 * Combina OLTs + ONUs + PONs + Alertas + Topologia do network-lab
 * num objeto pronto para ser renderizado no mapa OpenLayers.
 *
 * Retorna:
 *   - oltFeatures  — OLTs com coordenadas (lat/lng) e status
 *   - onuFeatures  — ONUs offline ou com sinal crítico (para highlight no mapa)
 *   - ponDownIds   — set de IDs de PONs com falha
 *   - alertsByOLT  — mapa olt_id → alertas ativos
 *   - labOnline    — booleano indicando se o lab está acessível
 *   - lastSync     — timestamp da última sincronização bem-sucedida
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import { useNOCSocket } from '@/hooks/useNOCSocket'

const LAB_BASE =
  process.env.NEXT_PUBLIC_NETWORK_LAB_URL ?? 'http://localhost:4000'

async function fetchLab(path, signal) {
  const res = await fetch(`${LAB_BASE}/api${path}`, {
    cache: 'no-store',
    signal,
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

function extractList(res) {
  return Array.isArray(res) ? res : (res?.data ?? [])
}

export function useNOCMapData({ enabled = true, interval = 30_000 } = {}) {
  const [oltFeatures,  setOLTFeatures]  = useState([])
  const [onuFeatures,  setONUFeatures]  = useState([])
  const [ponDownIds,   setPonDownIds]   = useState(new Set())
  const [alertsByOLT,  setAlertsByOLT]  = useState({})
  const [labOnline,    setLabOnline]    = useState(true)
  const [lastSync,     setLastSync]     = useState(null)

  const abortRef = useRef(null)

  const sync = useCallback(async () => {
    if (!enabled) return
    abortRef.current?.abort()
    const ctrl = new AbortController()
    abortRef.current = ctrl

    try {
      const [oltsRes, onusRes, ponsRes, alertsRes] = await Promise.allSettled([
        fetchLab('/olts',             ctrl.signal),
        fetchLab('/onus?limit=9999',  ctrl.signal),
        fetchLab('/pons',             ctrl.signal),
        fetchLab('/alerts?status=active', ctrl.signal),
      ])

      const allFailed = [oltsRes, onusRes, ponsRes, alertsRes]
        .every(r => r.status === 'rejected')

      if (allFailed) {
        setLabOnline(false)
        return
      }

      setLabOnline(true)

      // OLTs com coordenadas
      const oltList = oltsRes.status === 'fulfilled' ? extractList(oltsRes.value) : []
      setOLTFeatures(
        oltList.filter(o => o.lat != null && o.lng != null)
      )

      // ONUs offline ou com potência crítica
      const onuList = onusRes.status === 'fulfilled' ? extractList(onusRes.value) : []
      setONUFeatures(
        onuList.filter(o =>
          o.status !== 'online' ||
          (o.power_rx != null && parseFloat(o.power_rx) < -27)
        ).filter(o => o.lat != null && o.lng != null)
      )

      // PONs com falha
      const ponList = ponsRes.status === 'fulfilled' ? extractList(ponsRes.value) : []
      setPonDownIds(
        new Set(
          ponList
            .filter(p => p.status === 'down' || p.status === 'offline')
            .map(p => p.id ?? p._id)
        )
      )

      // Alertas agrupados por OLT
      const alertList = alertsRes.status === 'fulfilled' ? extractList(alertsRes.value) : []
      const byOLT = {}
      for (const a of alertList) {
        const key = a.olt_id ?? 'unknown'
        if (!byOLT[key]) byOLT[key] = []
        byOLT[key].push(a)
      }
      setAlertsByOLT(byOLT)
      setLastSync(new Date())

    } catch (e) {
      if (e.name !== 'AbortError') {
        setLabOnline(false)
      }
    }
  }, [enabled])

  // Polling inicial + intervalo
  useEffect(() => {
    if (!enabled) return
    sync()
    if (interval > 0) {
      const id = setInterval(sync, interval)
      return () => { clearInterval(id); abortRef.current?.abort() }
    }
    return () => abortRef.current?.abort()
  }, [sync, enabled, interval])

  // Real-time via WebSocket: atualiza incrementalmente on event
  const handleSocketEvent = useCallback((event) => {
    const type = event.type

    if (type === 'ONU_OFFLINE') {
      // Marca ONU como offline nas features (se tiver lat/lng)
      if (event.lat != null && event.lng != null) {
        const feat = {
          id:     event.onu_id ?? event.onu_sn ?? event.id,
          lat:    event.lat,
          lng:    event.lng,
          status: 'offline',
          client: event.client,
          type:   'ONU_OFFLINE',
        }
        setONUFeatures(prev => {
          const without = prev.filter(f => f.id !== feat.id)
          return [...without, feat]
        })
      }
    }

    if (type === 'PON_DOWN' && event.pon_id) {
      setPonDownIds(prev => new Set([...prev, event.pon_id]))
    }

    // Em qualquer evento crítico, re-sync completo após 3s
    // para capturar novos alertas sem delay de polling
    if (type === 'PON_DOWN' || type === 'OLT_OVERLOAD' || type === 'LOS') {
      const t = setTimeout(sync, 3_000)
      return () => clearTimeout(t)
    }
  }, [sync])

  useNOCSocket({ enabled, onEvent: handleSocketEvent })

  return {
    oltFeatures,
    onuFeatures,
    ponDownIds,
    alertsByOLT,
    labOnline,
    lastSync,
    refresh: sync,
  }
}
