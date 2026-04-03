'use client'

/**
 * useLeafletMap — substituto drop-in de useMap.js
 * -------------------------------------------------
 * Mesma interface de retorno: { mapLoaded, map }
 *
 * TROCA em MapaFTTH.js:
 *   - import { useMap }        from '@/hooks/useMap'
 *   + import { useLeafletMap } from '@/hooks/useLeafletMap'
 *
 *   - const { mapRef, mapLoaded, map } = useMap(containerRef, options)
 *   + const { mapLoaded, map }         = useLeafletMap(containerRef, options)
 */

import { useEffect, useRef, useState } from 'react'
import { initMap, destroyMap } from '@/lib/mapEngine'

/**
 * @param {React.RefObject<HTMLElement>} containerRef
 * @param {object}  [options]
 * @param {[number,number]} [options.center=[-22.75,-41.88]]
 * @param {number}  [options.zoom=13]
 * @returns {{ mapLoaded: boolean, map: L.Map|null }}
 */
export function useLeafletMap(containerRef, options = {}) {
  const initializedRef = useRef(false)
  const [mapLoaded, setMapLoaded] = useState(false)
  const [map, setMap]             = useState(null)

  useEffect(() => {
    if (!containerRef.current) return
    if (initializedRef.current) return  // Só inicializa uma vez

    const {
      center = [-22.75, -41.88],
      zoom   = 13,
    } = options

    initializedRef.current = true

    const instance = initMap(containerRef.current, { center, zoom })
    if (!instance) {
      initializedRef.current = false
      return
    }

    setMap(instance)
    setMapLoaded(true)

    // Cleanup ao desmontar o componente React
    return () => {
      destroyMap()
      initializedRef.current = false
      setMap(null)
      setMapLoaded(false)
    }
  // containerRef é um ref — não muda; options são estáticas na inicialização
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [containerRef])

  return { mapLoaded, map }
}
