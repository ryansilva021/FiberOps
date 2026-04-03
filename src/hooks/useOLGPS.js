'use client'

/**
 * useOLGPS — rastreamento GPS com OpenLayers
 * -------------------------------------------
 * Drop-in para useLeafletGPS.
 * Usa ol/geom/Point + ol/Feature para o marcador GPS.
 *
 * Troca em MapaFTTH.js:
 *   - import { useLeafletGPS } from '@/hooks/useLeafletGPS'
 *   + import { useOLGPS }      from '@/hooks/useOLGPS'
 */

import { useEffect, useRef, useState, useCallback } from 'react'
import Feature      from 'ol/Feature'
import Point        from 'ol/geom/Point'
import VectorLayer  from 'ol/layer/Vector'
import VectorSource from 'ol/source/Vector'
import { Style, Circle as CircleStyle, Fill, Stroke } from 'ol/style'
import { fromLonLat } from 'ol/proj'

/** Estilo do marcador GPS — círculo azul pulsante via animação de raio */
function _gpsStyle(opacity = 1) {
  return new Style({
    image: new CircleStyle({
      radius:  10,
      fill:    new Fill({ color: `rgba(59,130,246,${opacity})` }),
      stroke:  new Stroke({ color: '#ffffff', width: 3 }),
    }),
  })
}

export function useOLGPS(map) {
  const [position, setPosition]     = useState(null)
  const [tracking, setTracking]     = useState(false)
  const [error, setError]           = useState(null)
  const [followMode, setFollowMode] = useState(false)

  const watchIdRef    = useRef(null)
  const gpsLayerRef   = useRef(null)
  const gpsFeatureRef = useRef(null)
  const followRef     = useRef(followMode)
  const firstFixRef   = useRef(false)
  const pulseTimerRef = useRef(null)
  const pulseOpacity  = useRef(1)

  useEffect(() => { followRef.current = followMode }, [followMode])

  // Cria layer GPS dedicada ao montar
  useEffect(() => {
    if (!map) return

    const gpsFeature = new Feature()
    gpsFeature.setStyle(_gpsStyle(1))
    gpsFeatureRef.current = gpsFeature

    const gpsSource = new VectorSource({ features: [gpsFeature] })
    const gpsLayer  = new VectorLayer({
      source:    gpsSource,
      zIndex:    999,
      updateWhileAnimating: true,
    })
    gpsLayerRef.current = gpsLayer
    map.addLayer(gpsLayer)

    // Animação de pulso via setInterval (alterna opacidade)
    pulseTimerRef.current = setInterval(() => {
      pulseOpacity.current = pulseOpacity.current > 0.3 ? 0.3 : 1
      gpsFeature.setStyle(_gpsStyle(pulseOpacity.current))
    }, 700)

    return () => {
      clearInterval(pulseTimerRef.current)
      try { map.removeLayer(gpsLayer) } catch (_) {}
      gpsLayerRef.current  = null
      gpsFeatureRef.current = null
    }
  }, [map])

  // Atualiza posição e modo follow
  useEffect(() => {
    if (!map || !position || !gpsFeatureRef.current) return

    const coord = fromLonLat([position.lng, position.lat])
    gpsFeatureRef.current.setGeometry(new Point(coord))

    if (firstFixRef.current) {
      map.getView().animate({ center: coord, zoom: 17, duration: 1200 })
      firstFixRef.current = false
    } else if (followRef.current) {
      map.getView().animate({ center: coord, duration: 800 })
    }
  }, [map, position])

  const startTracking = useCallback(() => {
    if (!navigator.geolocation) {
      setError('Geolocalização não suportada neste dispositivo.')
      return
    }
    setError(null)
    setTracking(true)
    firstFixRef.current = true

    function onSuccess(pos) {
      setPosition({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy })
      setError(null)
    }

    function onError(err) {
      if (err.code === err.TIMEOUT || err.code === 3) {
        navigator.geolocation.getCurrentPosition(
          onSuccess,
          () => setError('Não foi possível obter a localização.'),
          { enableHighAccuracy: false, maximumAge: 30000, timeout: 10000 }
        )
      } else if (err.code === err.PERMISSION_DENIED || err.code === 1) {
        setError('Permissão de localização negada.')
        setTracking(false)
      } else {
        setError('Erro ao obter localização. Tente novamente.')
      }
    }

    watchIdRef.current = navigator.geolocation.watchPosition(onSuccess, onError, {
      enableHighAccuracy: true,
      maximumAge:         0,
      timeout:            15000,
    })
  }, [])

  const stopTracking = useCallback(() => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current)
      watchIdRef.current = null
    }
    setTracking(false)
    setFollowMode(false)
    // Remove geometria sem destruir a feature/layer
    gpsFeatureRef.current?.setGeometry(null)
  }, [])

  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current)
      }
    }
  }, [])

  return { position, tracking, error, followMode, setFollowMode, startTracking, stopTracking }
}
