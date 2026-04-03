'use client'

/**
 * useOLMap — hook React para o motor OpenLayers
 * -----------------------------------------------
 * Drop-in para useLeafletMap / useMap.
 * Mesma interface de retorno: { mapLoaded, map }
 *
 * Troca em MapaFTTH.js:
 *   - import { useLeafletMap } from '@/hooks/useLeafletMap'
 *   + import { useOLMap }      from '@/hooks/useOLMap'
 *
 *   - const { mapLoaded, map } = useLeafletMap(containerRef, options)
 *   + const { mapLoaded, map } = useOLMap(containerRef, options)
 */

import { useEffect, useRef, useState } from 'react'
import { initMap, destroyMap } from '@/lib/olMap'

/**
 * @param {React.RefObject<HTMLElement>} containerRef
 * @param {object}  [options]
 * @param {[number,number]} [options.center=[-41.88,-22.75]] - [lng, lat]
 * @param {number}  [options.zoom=13]
 * @returns {{ mapLoaded: boolean, map: ol/Map|null }}
 */
export function useOLMap(containerRef, options = {}) {
  const initializedRef = useRef(false)
  const [mapLoaded, setMapLoaded] = useState(false)
  const [map, setMap]             = useState(null)

  useEffect(() => {
    if (!containerRef.current) return
    if (initializedRef.current) return

    const {
      center = [-41.88, -22.75],
      zoom   = 13,
    } = options

    initializedRef.current = true

    const result = initMap(containerRef.current, { center, zoom })
    if (!result) {
      initializedRef.current = false
      return
    }

    setMap(result.map)
    setMapLoaded(true)

    return () => {
      destroyMap()
      initializedRef.current = false
      setMap(null)
      setMapLoaded(false)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [containerRef])

  return { mapLoaded, map }
}
