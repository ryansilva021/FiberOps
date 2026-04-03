'use client'

/**
 * useLeafletGPS — substituto de useGPS.js para Leaflet
 * -------------------------------------------------------
 * Interface idêntica a useGPS. Usa L.circleMarker para a posição GPS.
 *
 * TROCA em MapaFTTH.js:
 *   - import { useGPS }        from '@/hooks/useGPS'
 *   + import { useLeafletGPS } from '@/hooks/useLeafletGPS'
 */

import { useEffect, useRef, useState, useCallback } from 'react'
import L from 'leaflet'

export function useLeafletGPS(map) {
  const [position, setPosition]     = useState(null)
  const [tracking, setTracking]     = useState(false)
  const [error, setError]           = useState(null)
  const [followMode, setFollowMode] = useState(false)

  const watchIdRef   = useRef(null)
  const markerRef    = useRef(null)
  const followRef    = useRef(followMode)
  const firstFixRef  = useRef(false)

  useEffect(() => { followRef.current = followMode }, [followMode])

  // Cria o marcador GPS ao montar (circleMarker pulsante via CSS)
  useEffect(() => {
    if (!map) return

    // Injeta animação keyframe uma única vez
    if (!document.getElementById('gps-pulse-style')) {
      const style = document.createElement('style')
      style.id = 'gps-pulse-style'
      style.textContent = `
        @keyframes gps-pulse {
          0%   { box-shadow: 0 0 0 0   rgba(59,130,246,0.5); }
          70%  { box-shadow: 0 0 0 10px rgba(59,130,246,0);   }
          100% { box-shadow: 0 0 0 0   rgba(59,130,246,0);    }
        }
      `
      document.head.appendChild(style)
    }

    // Ícone personalizado via DivIcon
    const el = document.createElement('div')
    el.style.cssText = `
      width: 20px; height: 20px;
      border-radius: 50%;
      background: #3b82f6;
      border: 3px solid #ffffff;
      box-shadow: 0 0 0 4px rgba(59,130,246,0.4);
      animation: gps-pulse 1.5s ease-in-out infinite;
    `
    const icon = L.divIcon({ html: el, className: '', iconSize: [20, 20], iconAnchor: [10, 10] })

    // Marker fora do mapa até ter posição GPS
    const marker = L.marker([0, 0], { icon, zIndexOffset: 1000 })
    markerRef.current = marker

    return () => {
      try { map.removeLayer(marker) } catch (_) {}
      markerRef.current = null
    }
  }, [map])

  // Atualiza posição e segue (followMode)
  useEffect(() => {
    if (!map || !position || !markerRef.current) return

    const latlng = [position.lat, position.lng]
    markerRef.current.setLatLng(latlng)

    // Adiciona ao mapa na primeira posição
    if (!map.hasLayer(markerRef.current)) {
      markerRef.current.addTo(map)
    }

    if (firstFixRef.current) {
      // Primeiro fix: voa até o usuário
      map.flyTo(latlng, 17, { duration: 1.2 })
      firstFixRef.current = false
    } else if (followRef.current) {
      map.setView(latlng, map.getZoom(), { animate: true, duration: 0.8 })
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
          () => setError('Não foi possível obter a localização. Verifique se o GPS está ativo.'),
          { enableHighAccuracy: false, maximumAge: 30000, timeout: 10000 }
        )
      } else if (err.code === err.PERMISSION_DENIED || err.code === 1) {
        setError('Permissão de localização negada. Habilite nas configurações.')
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
    if (map && markerRef.current && map.hasLayer(markerRef.current)) {
      map.removeLayer(markerRef.current)
    }
  }, [map])

  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current)
      }
    }
  }, [])

  return { position, tracking, error, followMode, setFollowMode, startTracking, stopTracking }
}
