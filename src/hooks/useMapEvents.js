'use client'

import { useEffect, useRef } from 'react'

// Layers nos quais o clique deve abrir o bottom sheet
const CLICKABLE_LAYERS = [
  'ctos-layer',
  'caixas-ce-layer',
  'caixas-cdo-layer',
  'rotas-layer',
  'rotas-layer-drop',
  'postes-layer',
]

// Mapeamento layer → tipo de elemento
const LAYER_TYPE_MAP = {
  'ctos-layer':       'cto',
  'caixas-ce-layer':  'caixa',
  'caixas-cdo-layer': 'caixa',
  'rotas-layer':      'rota',
  'rotas-layer-drop': 'rota',
  'postes-layer':     'poste',
}

/**
 * Registra eventos do mapa: clique em elementos, clique no mapa, cursor e hover.
 *
 * @param {maplibregl.Map | null} map
 * @param {boolean} mapLoaded
 * @param {{
 *   onElementClick?: (payload: { type: string, data: Object }) => void,
 *   onMapClick?: (lngLat: { lng: number, lat: number }) => void,
 * }} callbacks
 */
export function useMapEvents(map, mapLoaded, callbacks) {
  // Manter ref estável para callbacks para evitar re-registro desnecessário
  const callbacksRef = useRef(callbacks)
  useEffect(() => {
    callbacksRef.current = callbacks
  }, [callbacks])

  useEffect(() => {
    if (!map || !mapLoaded) return

    // Estado de hover encapsulado neste closure
    let hoveredFeature = null

    function clearHover() {
      if (!hoveredFeature) return
      try {
        map.setFeatureState(
          { source: hoveredFeature.source, id: hoveredFeature.id },
          { hover: false }
        )
      } catch (_) {
        // source pode não suportar feature-state; ignorar
      }
      hoveredFeature = null
    }

    // ---- Clique em elemento ou mapa vazio ----
    function handleClick(e) {
      const activeLayers = CLICKABLE_LAYERS.filter((id) => map.getLayer(id))
      const features = map.queryRenderedFeatures(e.point, { layers: activeLayers })

      if (features.length > 0) {
        const feature = features[0]
        const type = LAYER_TYPE_MAP[feature.layer.id] ?? 'unknown'
        callbacksRef.current?.onElementClick?.({ type, data: feature.properties ?? {} })
      } else {
        callbacksRef.current?.onMapClick?.(e.lngLat)
      }
    }

    // ---- Cursor pointer + highlight de hover ----
    function handleMouseMove(e) {
      const activeLayers = CLICKABLE_LAYERS.filter((id) => map.getLayer(id))
      if (activeLayers.length === 0) return

      const features = map.queryRenderedFeatures(e.point, { layers: activeLayers })

      if (features.length > 0) {
        map.getCanvas().style.cursor = 'pointer'

        const feature    = features[0]
        const sourceId   = feature.source
        const featureId  = feature.id

        const sameFeature =
          hoveredFeature &&
          hoveredFeature.source === sourceId &&
          hoveredFeature.id === featureId

        if (!sameFeature) {
          clearHover()

          if (featureId !== undefined && featureId !== null) {
            try {
              map.setFeatureState(
                { source: sourceId, id: featureId },
                { hover: true }
              )
              hoveredFeature = { source: sourceId, id: featureId }
            } catch (_) {
              // ignorar sources sem suporte a feature-state
            }
          }
        }
      } else {
        map.getCanvas().style.cursor = ''
        clearHover()
      }
    }

    function handleMouseLeave() {
      map.getCanvas().style.cursor = ''
      clearHover()
    }

    map.on('click',      handleClick)
    map.on('mousemove',  handleMouseMove)
    map.on('mouseleave', handleMouseLeave)

    return () => {
      map.off('click',      handleClick)
      map.off('mousemove',  handleMouseMove)
      map.off('mouseleave', handleMouseLeave)
      clearHover()
    }
  }, [map, mapLoaded])
}
