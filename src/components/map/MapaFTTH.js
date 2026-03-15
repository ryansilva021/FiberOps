'use client'

import 'maplibre-gl/dist/maplibre-gl.css'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useMap }        from '@/hooks/useMap'
import { useMapLayers }  from '@/hooks/useMapLayers'
import { useMapEvents }  from '@/hooks/useMapEvents'
import { useGPS }        from '@/hooks/useGPS'
import { useOfflineQueue } from '@/hooks/useOfflineQueue'

import BottomSheet   from '@/components/map/BottomSheet'
import LayerToggles  from '@/components/map/LayerToggles'

import { getCTOs }   from '@/actions/ctos'
import { getCaixas } from '@/actions/caixas'
import { getRotas }  from '@/actions/rotas'
import { getPostes } from '@/actions/postes'

// ---------------------------------------------------------------------------
// Constantes
// ---------------------------------------------------------------------------

const DEFAULT_LAYER_TOGGLES = {
  ctos:      true,
  caixas:    true,
  rotas:     true,
  postes:    true,
  satellite: false,
}

// ---------------------------------------------------------------------------
// Componente principal
// ---------------------------------------------------------------------------

/**
 * Mapa interativo FTTH com MapLibre GL.
 *
 * @param {{
 *   session: import('next-auth').Session,
 *   initialCTOs:   Array,
 *   initialCaixas: Array,
 *   initialRotas:  { type: 'FeatureCollection', features: Array },
 *   initialPostes: Array,
 * }} props
 */
export default function MapaFTTH({
  session,
  initialCTOs   = [],
  initialCaixas = [],
  initialRotas  = null,
  initialPostes = [],
}) {
  const containerRef = useRef(null)

  // ---- Dados do mapa (hidratados pelo servidor; recarregados após mutações) ----
  const [ctos,   setCTOs]   = useState(initialCTOs)
  const [caixas, setCaixas] = useState(initialCaixas)
  const [rotas,  setRotas]  = useState(initialRotas)
  const [postes, setPostes] = useState(initialPostes)
  const [loadingData, setLoadingData] = useState(false)

  // ---- Estado de UI ----
  const [selectedElement, setSelectedElement] = useState(null)
  const [layerToggles, setLayerToggles]       = useState(DEFAULT_LAYER_TOGGLES)

  // ---- Hooks do mapa ----
  const { map, mapLoaded } = useMap(containerRef, {
    center: [-46.633308, -23.55052],
    zoom:   14,
  })

  useMapLayers(map, mapLoaded, { ctos, caixas, rotas, postes }, layerToggles)

  const eventCallbacks = {
    onElementClick: useCallback(({ type, data }) => {
      setSelectedElement({ type, data })
    }, []),
    onMapClick: useCallback(() => {
      setSelectedElement(null)
    }, []),
  }
  useMapEvents(map, mapLoaded, eventCallbacks)

  // ---- GPS ----
  const {
    tracking,
    error:       gpsError,
    followMode,
    setFollowMode,
    startTracking,
    stopTracking,
  } = useGPS(map)

  // ---- Offline queue ----
  const { isOnline, queueSize } = useOfflineQueue()

  // ---- Funções de dados ----
  const reloadData = useCallback(async () => {
    if (!session?.user?.projeto_id) return
    const projetoId = session.user.projeto_id
    setLoadingData(true)
    try {
      const [newCTOs, newCaixas, newRotas, newPostes] = await Promise.all([
        getCTOs(projetoId),
        getCaixas(projetoId),
        getRotas(projetoId),
        getPostes(projetoId),
      ])
      setCTOs(newCTOs)
      setCaixas(newCaixas)
      setRotas(newRotas)
      setPostes(newPostes)
    } catch (err) {
      console.error('[MapaFTTH] Erro ao recarregar dados:', err)
    } finally {
      setLoadingData(false)
    }
  }, [session])

  // ---- Toggles de camada ----
  const handleLayerToggle = useCallback((key, value) => {
    setLayerToggles((prev) => ({ ...prev, [key]: value }))
  }, [])

  const handleSatelliteToggle = useCallback(() => {
    setLayerToggles((prev) => ({ ...prev, satellite: !prev.satellite }))
  }, [])

  // ---- Fechar bottom sheet ----
  const handleCloseSheet = useCallback(() => setSelectedElement(null), [])

  // ---- Ações disparadas pelo BottomSheet ----
  const handleAction = useCallback(({ type, data, action }) => {
    // Extensão futura: abrir modais de diagrama, reposicionamento, etc.
    console.info('[MapaFTTH] action:', action, type, data)
  }, [])

  // ---- GPS toggle handler ----
  const handleGPSToggle = useCallback(() => {
    if (tracking) {
      stopTracking()
    } else {
      startTracking()
      setFollowMode(true) // ativa follow mode junto para continuar seguindo após o flyTo
    }
  }, [tracking, startTracking, stopTracking, setFollowMode])

  const handleFollowToggle = useCallback(() => {
    setFollowMode((prev) => !prev)
  }, [setFollowMode])

  // ---- GPS automático: centraliza na localização do usuário ao abrir o mapa ----
  useEffect(() => {
    if (mapLoaded && !tracking) {
      startTracking()
      setFollowMode(true)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapLoaded])

  // ---- Recarregar dados quando componente monta (se não veio com dados iniciais) ----
  useEffect(() => {
    if (!initialCTOs.length && !initialCaixas.length) {
      reloadData()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="relative w-full h-full bg-[#0b1220]" style={{ minHeight: '100dvh' }}>
      {/* Container do mapa */}
      <div ref={containerRef} className="absolute inset-0 w-full h-full" aria-label="Mapa FTTH" role="application" />

      {/* Overlay: indicador offline */}
      {!isOnline && (
        <div
          role="status"
          aria-live="polite"
          className="absolute top-3 left-1/2 -translate-x-1/2 z-40
                     flex items-center gap-2 px-3 py-1.5 rounded-full
                     bg-yellow-500/90 text-yellow-950 text-xs font-semibold shadow"
        >
          <span className="w-2 h-2 rounded-full bg-yellow-950/60 inline-block" />
          Offline
          {queueSize > 0 && <span className="ml-1">({queueSize} na fila)</span>}
        </div>
      )}

      {/* Overlay: loading de dados */}
      {loadingData && (
        <div
          role="status"
          aria-label="Carregando dados do mapa"
          className="absolute top-3 right-14 z-40
                     px-3 py-1.5 rounded-full bg-zinc-900/80 text-zinc-300 text-xs shadow"
        >
          Carregando...
        </div>
      )}

      {/* Controles superiores: satélite + recarregar */}
      <div className="absolute top-3 left-3 z-40 flex flex-col gap-2 pointer-events-auto">
        {/* Toggle satélite */}
        <button
          onClick={handleSatelliteToggle}
          aria-pressed={layerToggles.satellite}
          aria-label="Alternar camada satélite"
          className={[
            'flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-medium shadow transition-all',
            layerToggles.satellite
              ? 'bg-sky-600/90 text-white border-sky-400'
              : 'bg-zinc-900/80 text-zinc-300 border-zinc-700 hover:border-zinc-500',
          ].join(' ')}
        >
          <SatelliteIcon />
          Satélite
        </button>

        {/* Botão recarregar */}
        <button
          onClick={reloadData}
          disabled={loadingData}
          aria-label="Recarregar dados do mapa"
          className="flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-medium shadow transition-all
                     bg-zinc-900/80 text-zinc-300 border-zinc-700 hover:border-zinc-500
                     disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <RefreshIcon spin={loadingData} />
          Recarregar
        </button>
      </div>

      {/* Toggles de camadas - canto inferior esquerdo (acima do scale) */}
      <div className="absolute bottom-10 left-0 z-40 pointer-events-auto">
        <LayerToggles toggles={layerToggles} onToggle={handleLayerToggle} />
      </div>

      {/* Botões GPS - canto inferior direito */}
      <div className="absolute bottom-20 right-3 z-40 flex flex-col gap-2 pointer-events-auto">
        {/* Follow mode (só visível quando tracking) */}
        {tracking && (
          <button
            onClick={handleFollowToggle}
            aria-pressed={followMode}
            aria-label={followMode ? 'Parar de seguir posição' : 'Seguir posição'}
            className={[
              'w-10 h-10 flex items-center justify-center rounded-full shadow-lg border transition-all',
              followMode
                ? 'bg-blue-600 text-white border-blue-400'
                : 'bg-zinc-900/90 text-zinc-300 border-zinc-700 hover:border-zinc-500',
            ].join(' ')}
          >
            <FollowIcon />
          </button>
        )}

        {/* GPS on/off */}
        <button
          onClick={handleGPSToggle}
          aria-pressed={tracking}
          aria-label={tracking ? 'Parar rastreamento GPS' : 'Iniciar rastreamento GPS'}
          className={[
            'w-10 h-10 flex items-center justify-center rounded-full shadow-lg border transition-all',
            tracking
              ? 'bg-blue-600 text-white border-blue-400 animate-pulse'
              : 'bg-zinc-900/90 text-zinc-300 border-zinc-700 hover:border-zinc-500',
          ].join(' ')}
        >
          <GPSIcon />
        </button>

        {/* Erro GPS */}
        {gpsError && (
          <div
            role="alert"
            className="absolute bottom-full mb-2 right-0 w-48
                       bg-red-900/90 text-red-200 text-xs px-3 py-2 rounded-lg shadow"
          >
            {gpsError}
          </div>
        )}
      </div>

      {/* Bottom sheet de elemento selecionado */}
      <BottomSheet
        element={selectedElement}
        onClose={handleCloseSheet}
        session={session}
        onAction={handleAction}
      />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Ícones SVG inline (sem dependência de lib de ícones)
// ---------------------------------------------------------------------------

function SatelliteIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m17 3 4 4-9.95 9.95-4-4L17 3Z" />
      <path d="M7 13.95 3 18l4 4 4.04-4.04" />
      <path d="m14 7 3 3" />
      <path d="m3 21 3-3" />
      <path d="M16 6 8.5 13.5" />
    </svg>
  )
}

function RefreshIcon({ spin }) {
  return (
    <svg
      width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"
      aria-hidden="true"
      style={spin ? { animation: 'spin 1s linear infinite' } : undefined}
    >
      <polyline points="23 4 23 10 17 10" />
      <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </svg>
  )
}

function GPSIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
    </svg>
  )
}

function FollowIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <polygon points="3 11 22 2 13 21 11 13 3 11" />
    </svg>
  )
}
