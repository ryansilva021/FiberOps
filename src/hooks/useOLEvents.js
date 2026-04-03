'use client'

/**
 * useOLEvents — eventos de mapa para OpenLayers
 * -----------------------------------------------
 * Drop-in para useLeafletEvents.
 * Escuta o evento customizado 'olmap:map-click' disparado por olMap.js
 * e repassa para os callbacks do sistema (add mode, reposicionamento, etc.)
 *
 * Troca em MapaFTTH.js:
 *   - import { useLeafletEvents } from '@/hooks/useLeafletEvents'
 *   + import { useOLEvents }      from '@/hooks/useOLEvents'
 */

import { useEffect, useRef } from 'react'
import { getMap } from '@/lib/olMap'

/**
 * @param {ol/Map|null}  map
 * @param {boolean}      mapLoaded
 * @param {object}       callbacks
 * @param {Function}     callbacks.onMapClick      - ({ lat, lng }) => void
 * @param {Function}     [callbacks.onRouteDblClick] - () => void
 */
export function useOLEvents(map, mapLoaded, callbacks) {
  const callbacksRef = useRef(callbacks)
  useEffect(() => { callbacksRef.current = callbacks }, [callbacks])

  useEffect(() => {
    if (!map || !mapLoaded) return

    // olMap.js dispara 'olmap:map-click' com { lngLat: { lat, lng } }
    function handleMapClick(e) {
      callbacksRef.current?.onMapClick?.(e.detail.lngLat)
    }

    // Duplo clique no mapa OL → finalizar rota
    function handleDblClick(e) {
      e.originalEvent?.preventDefault?.()
      callbacksRef.current?.onRouteDblClick?.()
    }

    window.addEventListener('olmap:map-click', handleMapClick)
    map.on('dblclick', handleDblClick)

    return () => {
      window.removeEventListener('olmap:map-click', handleMapClick)
      map.un('dblclick', handleDblClick)
    }
  }, [map, mapLoaded])
}
