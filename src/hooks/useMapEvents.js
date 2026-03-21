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
  'olts-layer',
]

// Mapeamento layer → tipo de elemento (exportado para uso externo)
export const LAYER_TYPE_MAP = {
  'ctos-layer':       'cto',
  'caixas-ce-layer':  'caixa',
  'caixas-cdo-layer': 'caixa',
  'rotas-layer':      'rota',
  'rotas-layer-drop': 'rota',
  'postes-layer':     'poste',
  'olts-layer':       'olt',
}

export function useMapEvents(map, mapLoaded, callbacks) {
  const callbacksRef = useRef(callbacks)
  useEffect(() => { callbacksRef.current = callbacks }, [callbacks])

  useEffect(() => {
    if (!map || !mapLoaded) return

    let hoveredFeature = null

    function clearHover() {
      if (!hoveredFeature) return
      try {
        map.setFeatureState(
          { source: hoveredFeature.source, id: hoveredFeature.id },
          { hover: false }
        )
      } catch (_) {}
      hoveredFeature = null
    }

    function handleClick(e) {
      const addMode = callbacksRef.current?.addMode
      const activeLayers = CLICKABLE_LAYERS.filter((id) => map.getLayer(id))
      const TOL = 6
      const features = map.queryRenderedFeatures(
        [[e.point.x - TOL, e.point.y - TOL], [e.point.x + TOL, e.point.y + TOL]],
        { layers: activeLayers }
      )

      if (addMode) {
        // Em modo de adição: rota pode se vincular a CTO/CDO; outros modos ignoram elementos
        if (addMode === 'rota' && features.length > 0) {
          const feature = features[0]
          const type = LAYER_TYPE_MAP[feature.layer.id] ?? 'unknown'
          if (type === 'cto' || type === 'caixa') {
            const props = feature.properties ?? {}
            const snapLng = parseFloat(props.lng)
            const snapLat = parseFloat(props.lat)
            if (!isNaN(snapLng) && !isNaN(snapLat)) {
              const snapId = props.cto_id ?? props.ce_id ?? props.id ?? null
              callbacksRef.current?.onMapClick?.(
                { lng: snapLng, lat: snapLat },
                { type, id: snapId, nome: props.nome ?? snapId }
              )
              return
            }
          }
        }
        callbacksRef.current?.onMapClick?.(e.lngLat)
        return
      }

      if (features.length > 1) {
        // Múltiplos itens sobrepostos — expande em círculo
        callbacksRef.current?.onClusterClick?.(features, e.lngLat, e.point)
      } else if (features.length === 1) {
        const feature = features[0]
        const type = LAYER_TYPE_MAP[feature.layer.id] ?? 'unknown'
        callbacksRef.current?.onElementClick?.({ type, data: feature.properties ?? {} })
      } else {
        callbacksRef.current?.onMapClick?.(e.lngLat)
      }
    }

    function handleDblClick(e) {
      if (callbacksRef.current?.addMode === 'rota') {
        e.preventDefault()
        callbacksRef.current?.onRouteDblClick?.()
      }
    }

    function handleMouseMove(e) {
      const activeLayers = CLICKABLE_LAYERS.filter((id) => map.getLayer(id))
      if (activeLayers.length === 0) return

      const features = map.queryRenderedFeatures(e.point, { layers: activeLayers })

      if (features.length > 0) {
        map.getCanvas().style.cursor = 'pointer'
        const feature   = features[0]
        const sourceId  = feature.source
        const featureId = feature.id

        const sameFeature =
          hoveredFeature &&
          hoveredFeature.source === sourceId &&
          hoveredFeature.id === featureId

        if (!sameFeature) {
          clearHover()
          if (featureId !== undefined && featureId !== null) {
            try {
              map.setFeatureState({ source: sourceId, id: featureId }, { hover: true })
              hoveredFeature = { source: sourceId, id: featureId }
            } catch (_) {}
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

    map.on('click',     handleClick)
    map.on('dblclick',  handleDblClick)
    map.on('mousemove', handleMouseMove)
    map.on('mouseleave', handleMouseLeave)

    return () => {
      map.off('click',     handleClick)
      map.off('dblclick',  handleDblClick)
      map.off('mousemove', handleMouseMove)
      map.off('mouseleave', handleMouseLeave)
      clearHover()
    }
  }, [map, mapLoaded])
}
