'use client'

/**
 * useLeafletEvents — substituto de useMapEvents.js para Leaflet
 * --------------------------------------------------------------
 * Gerencia eventos de mapa (click vazio, duplo-clique para rota).
 * Cliques em elementos individuais (CTOs, Caixas, etc.) são tratados
 * diretamente nos markers dentro de useLeafletLayers.
 *
 * TROCA em MapaFTTH.js:
 *   - import { useMapEvents, LAYER_TYPE_MAP } from '@/hooks/useMapEvents'
 *   + import { useLeafletEvents }             from '@/hooks/useLeafletEvents'
 */

import { useEffect, useRef } from 'react'

/**
 * @param {L.Map|null}  map
 * @param {boolean}     mapLoaded
 * @param {object}      callbacks
 * @param {Function}    callbacks.onMapClick      - (latlng: {lat, lng}) => void
 * @param {Function}    [callbacks.onRouteDblClick] - () => void
 */
export function useLeafletEvents(map, mapLoaded, callbacks) {
  const callbacksRef = useRef(callbacks)
  useEffect(() => { callbacksRef.current = callbacks }, [callbacks])

  useEffect(() => {
    if (!map || !mapLoaded) return

    function handleClick(e) {
      // e.latlng = { lat, lng } — mesmo formato que o sistema espera
      callbacksRef.current?.onMapClick?.(e.latlng)
    }

    function handleDblClick(e) {
      e.originalEvent?.preventDefault?.()
      callbacksRef.current?.onRouteDblClick?.()
    }

    map.on('click',    handleClick)
    map.on('dblclick', handleDblClick)

    return () => {
      map.off('click',    handleClick)
      map.off('dblclick', handleDblClick)
    }
  }, [map, mapLoaded])
}
