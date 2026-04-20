'use client'

import { useEffect, useRef, useState } from 'react'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'

const TILE_URL =
  'https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json'

/**
 * Mini-mapa para selecionar uma coordenada clicando.
 *
 * Props:
 *   lat, lng      – coordenada inicial (opcional)
 *   onChange(lat, lng) – callback chamado ao clicar no mapa
 */
export default function LocationPicker({ lat, lng, onChange }) {
  const containerRef = useRef(null)
  const mapRef = useRef(null)
  const markerRef = useRef(null)
  const [coords, setCoords] = useState(
    lat && lng ? { lat: parseFloat(lat), lng: parseFloat(lng) } : null
  )

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return

    const initialCenter =
      lat && lng ? [parseFloat(lng), parseFloat(lat)] : [-46.633308, -23.55052]

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: TILE_URL,
      center: initialCenter,
      zoom: lat && lng ? 16 : 13,
    })
    mapRef.current = map

    // Marcador inicial se já há coordenadas
    if (lat && lng) {
      markerRef.current = new maplibregl.Marker({ color: '#38bdf8' })
        .setLngLat([parseFloat(lng), parseFloat(lat)])
        .addTo(map)
    }

    map.on('click', (e) => {
      const { lng: clickLng, lat: clickLat } = e.lngLat
      const rounded = { lat: +clickLat.toFixed(7), lng: +clickLng.toFixed(7) }

      if (markerRef.current) {
        markerRef.current.setLngLat([clickLng, clickLat])
      } else {
        markerRef.current = new maplibregl.Marker({ color: '#38bdf8' })
          .setLngLat([clickLng, clickLat])
          .addTo(map)
      }

      setCoords(rounded)
      onChange?.(rounded.lat, rounded.lng)
    })

    // Cursor pointer sobre o mapa para indicar que é clicável
    map.getCanvas().style.cursor = 'crosshair'

    return () => {
      map.remove()
      mapRef.current = null
      markerRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div style={{ position: 'relative' }}>
      <div
        ref={containerRef}
        style={{ width: '100%', height: 220, borderRadius: 8, overflow: 'hidden' }}
      />
      <div
        style={{
          position: 'absolute',
          bottom: 8,
          left: '50%',
          transform: 'translateX(-50%)',
          backgroundColor: 'rgba(0,0,0,0.75)',
          color: '#f1f5f9',
          fontSize: 11,
          padding: '3px 10px',
          borderRadius: 20,
          pointerEvents: 'none',
          whiteSpace: 'nowrap',
        }}
      >
        {coords
          ? `${coords.lat.toFixed(6)}, ${coords.lng.toFixed(6)}`
          : 'Clique no mapa para selecionar'}
      </div>
    </div>
  )
}
