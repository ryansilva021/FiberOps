'use client'

/**
 * src/hooks/useNetworkLab.js
 *
 * Hook React que consome o fiberops-network-lab diretamente via
 * NEXT_PUBLIC_NETWORK_LAB_URL (prefixo /api/ automático).
 *
 * Fallback: quando o lab está offline, retorna { data: null, labOnline: false }
 * sem lançar erros na UI.
 *
 * Uso:
 *   const { data, loading, labOnline, refresh } = useNetworkLab('/olts')
 */

import { useState, useEffect, useCallback, useRef } from 'react'

const LAB_BASE =
  (typeof window !== 'undefined' ? process.env.NEXT_PUBLIC_NETWORK_LAB_URL : null) ??
  process.env.NEXT_PUBLIC_NETWORK_LAB_URL ??
  'http://localhost:4000'

function labURL(path, params = {}) {
  const url = new URL(`${LAB_BASE}/api${path}`)
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null) url.searchParams.set(k, String(v))
  }
  return url.toString()
}

// ── Hook genérico ─────────────────────────────────────────────────────────────

export function useNetworkLab(path, options = {}) {
  const {
    params      = {},
    interval    = 0,
    enabled     = true,
    initialData = null,
  } = options

  const [data,      setData]      = useState(initialData)
  const [loading,   setLoading]   = useState(false)
  const [error,     setError]     = useState(null)
  const [labOnline, setLabOnline] = useState(true)

  const abortRef   = useRef(null)
  const paramsKey  = JSON.stringify(params)

  const fetchData = useCallback(async (silent = false) => {
    if (!enabled) return
    abortRef.current?.abort()
    const ctrl = new AbortController()
    abortRef.current = ctrl

    if (!silent) setLoading(true)
    setError(null)

    try {
      const res = await fetch(labURL(path, params), {
        signal: ctrl.signal,
        cache: 'no-store',
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = await res.json()
      setData(json)
      setLabOnline(true)
    } catch (e) {
      if (e.name === 'AbortError') return
      // Erros de rede = lab offline, não propagamos para a UI como erro crítico
      const isNetworkErr = e.message.includes('fetch') || e.message.includes('Failed') ||
        e.message.includes('NetworkError') || e.message.includes('net::')
      if (isNetworkErr) {
        setLabOnline(false)
        setData(null)
      } else {
        setError(e.message ?? 'Erro desconhecido')
        setLabOnline(false)
      }
    } finally {
      if (!silent) setLoading(false)
    }
  }, [path, paramsKey, enabled]) // eslint-disable-line

  useEffect(() => {
    if (!enabled) return
    fetchData(false)
    if (interval > 0) {
      const id = setInterval(() => fetchData(true), interval)
      return () => { clearInterval(id); abortRef.current?.abort() }
    }
    return () => abortRef.current?.abort()
  }, [fetchData, enabled, interval])

  return {
    data,
    loading,
    error,
    labOnline,
    refresh: () => fetchData(false),
  }
}

// ── Hooks específicos ─────────────────────────────────────────────────────────

export function useOLTs(params = {}, interval = 30_000) {
  return useNetworkLab('/olts', { params, interval })
}

export function useOLT(id) {
  return useNetworkLab(`/olts/${id}`, { interval: 15_000, enabled: !!id })
}

export function usePONs(params = {}, interval = 20_000) {
  return useNetworkLab('/pons', { params, interval })
}

export function useONUs(params = {}, interval = 30_000) {
  return useNetworkLab('/onus', { params, interval })
}

export function useAlerts(params = {}, interval = 10_000) {
  return useNetworkLab('/alerts', { params, interval })
}

export function useTelemetry(interval = 15_000) {
  return useNetworkLab('/telemetry', { interval })
}

export function useTopology(interval = 60_000) {
  return useNetworkLab('/topology', { interval })
}

/** Agrega OLTs + ONUs + Alertas + Telemetria via endpoint /dashboard (se existir) */
export function useDashboardSummary(interval = 15_000) {
  // Tenta /dashboard primeiro; se não existir, o hook retorna null e o componente
  // usa os hooks individuais como fallback.
  return useNetworkLab('/dashboard', { interval })
}

// ── Utilitário: URL base do lab (para uso externo) ─────────────────────────────

export function getLabBaseURL() {
  return LAB_BASE
}
