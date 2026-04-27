'use client'

/**
 * src/hooks/useNetworkLab.js
 *
 * Hook genérico para consumir os endpoints do network-lab via proxy interno
 * /api/noc/network-lab/[...path].
 *
 * Uso:
 *   const { data, loading, error, refresh } = useNetworkLab('/olts')
 */

import { useState, useEffect, useCallback, useRef } from 'react'

const PROXY_BASE = '/api/noc/network-lab'

export function useNetworkLab(path, options = {}) {
  const {
    params         = {},
    interval       = 0,        // ms — 0 desativa polling
    enabled        = true,
    initialData    = null,
  } = options

  const [data,    setData]    = useState(initialData)
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState(null)
  const abortRef = useRef(null)

  const buildURL = useCallback(() => {
    const url = new URL(PROXY_BASE + path, window.location.origin)
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== null) url.searchParams.set(k, String(v))
    }
    return url.toString()
  }, [path, JSON.stringify(params)])  // eslint-disable-line

  const fetch_ = useCallback(async (silent = false) => {
    if (!enabled) return
    abortRef.current?.abort()
    const ctrl = new AbortController()
    abortRef.current = ctrl

    if (!silent) setLoading(true)
    setError(null)
    try {
      const res = await fetch(buildURL(), { signal: ctrl.signal })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = await res.json()
      setData(json)
    } catch (e) {
      if (e.name !== 'AbortError') setError(e.message ?? 'Erro desconhecido')
    } finally {
      if (!silent) setLoading(false)
    }
  }, [buildURL, enabled])

  useEffect(() => {
    if (!enabled) return
    fetch_(false)
    if (interval > 0) {
      const id = setInterval(() => fetch_(true), interval)
      return () => clearInterval(id)
    }
    return () => abortRef.current?.abort()
  }, [fetch_, enabled, interval])

  return { data, loading, error, refresh: () => fetch_(false) }
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

export function useDashboardSummary(interval = 15_000) {
  return useNetworkLab('/dashboard', { interval })
}
