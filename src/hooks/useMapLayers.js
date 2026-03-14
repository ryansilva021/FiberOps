'use client'

import { useEffect, useRef } from 'react'

// ---------------------------------------------------------------------------
// Helpers: geração de ícones via canvas 2D
// ---------------------------------------------------------------------------

/**
 * Ícone "X" para CTO, colorido por ocupação.
 *
 * @param {string} color - cor CSS (hex)
 * @param {number} [size=40] - lado do canvas em pixels
 * @returns {ImageData}
 */
function createCTOIcon(color = '#22c55e', size = 40) {
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  ctx.strokeStyle = color
  ctx.lineWidth = size * 0.18
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.moveTo(size * 0.2, size * 0.2)
  ctx.lineTo(size * 0.8, size * 0.8)
  ctx.moveTo(size * 0.8, size * 0.2)
  ctx.lineTo(size * 0.2, size * 0.8)
  ctx.stroke()
  return ctx.getImageData(0, 0, size, size)
}

/**
 * Ícone quadrado preenchido para Caixa de Emenda (CE).
 *
 * @param {string} color
 * @param {number} [size=36]
 * @returns {ImageData}
 */
function createCEIcon(color = '#3b82f6', size = 36) {
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  const pad = size * 0.15
  ctx.fillStyle = color
  ctx.strokeStyle = '#ffffff'
  ctx.lineWidth = size * 0.08
  ctx.fillRect(pad, pad, size - pad * 2, size - pad * 2)
  ctx.strokeRect(pad, pad, size - pad * 2, size - pad * 2)
  return ctx.getImageData(0, 0, size, size)
}

/**
 * Ícone triângulo preenchido para CDO.
 *
 * @param {string} color
 * @param {number} [size=36]
 * @returns {ImageData}
 */
function createCDOIcon(color = '#f59e0b', size = 36) {
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  const pad = size * 0.1
  ctx.fillStyle = color
  ctx.strokeStyle = '#ffffff'
  ctx.lineWidth = size * 0.08
  ctx.beginPath()
  ctx.moveTo(size / 2, pad)
  ctx.lineTo(size - pad, size - pad)
  ctx.lineTo(pad, size - pad)
  ctx.closePath()
  ctx.fill()
  ctx.stroke()
  return ctx.getImageData(0, 0, size, size)
}

/**
 * Ícone círculo para Poste.
 *
 * @param {string} color
 * @param {number} [size=24]
 * @returns {ImageData}
 */
function createPosteIcon(color = '#94a3b8', size = 24) {
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  const r = size * 0.35
  ctx.fillStyle = color
  ctx.strokeStyle = '#ffffff'
  ctx.lineWidth = size * 0.1
  ctx.beginPath()
  ctx.arc(size / 2, size / 2, r, 0, Math.PI * 2)
  ctx.fill()
  ctx.stroke()
  return ctx.getImageData(0, 0, size, size)
}

// ---------------------------------------------------------------------------
// Conversores: dados do backend → GeoJSON FeatureCollection
// ---------------------------------------------------------------------------

function ctosToGeoJSON(ctos = []) {
  return {
    type: 'FeatureCollection',
    features: ctos.map((cto) => ({
      type: 'Feature',
      id: cto.cto_id,
      geometry: {
        type: 'Point',
        coordinates: [cto.lng, cto.lat],
      },
      properties: {
        ...cto,
        pct: cto.capacidade > 0 ? cto.ocupacao / cto.capacidade : 0,
      },
    })),
  }
}

function caixasToGeoJSON(caixas = []) {
  return {
    type: 'FeatureCollection',
    features: caixas.map((c) => ({
      type: 'Feature',
      id: c.ce_id,
      geometry: {
        type: 'Point',
        coordinates: [c.lng, c.lat],
      },
      properties: { ...c },
    })),
  }
}

function postesToGeoJSON(postes = []) {
  return {
    type: 'FeatureCollection',
    features: postes.map((p) => ({
      type: 'Feature',
      id: p.poste_id,
      geometry: {
        type: 'Point',
        coordinates: [p.lng, p.lat],
      },
      properties: { ...p },
    })),
  }
}

// ---------------------------------------------------------------------------
// Constantes de IDs
// ---------------------------------------------------------------------------

const SATELLITE_SOURCE = 'esri-satellite'
const SATELLITE_LAYER  = 'satellite-layer'
const SOURCES = ['ctos', 'caixas', 'rotas', 'postes']
const LAYERS  = [
  'postes-layer',
  'rotas-layer',
  'rotas-layer-drop',
  'ctos-layer',
  'caixas-ce-layer',
  'caixas-cdo-layer',
]

// ---------------------------------------------------------------------------
// Hook principal
// ---------------------------------------------------------------------------

/**
 * Gerencia todas as sources e layers do mapa FTTH.
 *
 * @param {maplibregl.Map | null} map
 * @param {boolean} mapLoaded
 * @param {{ ctos: Array, caixas: Array, rotas: Object, postes: Array }} data
 * @param {{ ctos: boolean, caixas: boolean, rotas: boolean, postes: boolean, satellite: boolean }} layerToggles
 */
export function useMapLayers(map, mapLoaded, data, layerToggles) {
  const { ctos = [], caixas = [], rotas = null, postes = [] } = data ?? {}
  const layersReady = useRef(false)

  // ---------- Setup inicial das sources + layers ----------
  useEffect(() => {
    if (!map || !mapLoaded) return

    // Registrar ícones
    map.addImage('cto-green',  createCTOIcon('#22c55e'))
    map.addImage('cto-yellow', createCTOIcon('#eab308'))
    map.addImage('cto-red',    createCTOIcon('#ef4444'))
    map.addImage('ce-icon',    createCEIcon('#3b82f6'))
    map.addImage('cdo-icon',   createCDOIcon('#f59e0b'))
    map.addImage('poste-icon', createPosteIcon('#94a3b8'))

    // Fonte satélite (Esri)
    map.addSource(SATELLITE_SOURCE, {
      type: 'raster',
      tiles: [
        'https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      ],
      tileSize: 256,
      attribution: 'Esri World Imagery',
    })
    map.addLayer(
      {
        id: SATELLITE_LAYER,
        type: 'raster',
        source: SATELLITE_SOURCE,
        layout: { visibility: 'none' },
        paint: { 'raster-opacity': 1 },
      },
      'osm-layer' // insere logo acima do OSM
    )

    // Source + layer: Postes
    map.addSource('postes', {
      type: 'geojson',
      data: postesToGeoJSON(postes),
    })
    map.addLayer({
      id: 'postes-layer',
      type: 'symbol',
      source: 'postes',
      layout: {
        'icon-image': 'poste-icon',
        'icon-size': 0.9,
        'icon-allow-overlap': false,
      },
    })

    // Source + layer: Rotas de fibra
    map.addSource('rotas', {
      type: 'geojson',
      data: rotas ?? { type: 'FeatureCollection', features: [] },
    })
    // Rotas não-DROP (sem dasharray)
    map.addLayer({
      id: 'rotas-layer',
      type: 'line',
      source: 'rotas',
      filter: ['!=', ['get', 'tipo'], 'DROP'],
      paint: {
        'line-color': [
          'match', ['get', 'tipo'],
          'BACKBONE', '#7c3aed',
          'RAMAL',    '#1f2937',
          '#f97316',
        ],
        'line-width': [
          'match', ['get', 'tipo'],
          'BACKBONE', 6,
          'RAMAL',    3.5,
          2,
        ],
      },
    })
    // Rotas DROP (tracejadas)
    map.addLayer({
      id: 'rotas-layer-drop',
      type: 'line',
      source: 'rotas',
      filter: ['==', ['get', 'tipo'], 'DROP'],
      paint: {
        'line-color': '#22c55e',
        'line-width': 2,
        'line-dasharray': [2, 2],
      },
    })

    // Source + layer: CTOs
    map.addSource('ctos', {
      type: 'geojson',
      data: ctosToGeoJSON(ctos),
    })
    map.addLayer({
      id: 'ctos-layer',
      type: 'symbol',
      source: 'ctos',
      layout: {
        'icon-image': [
          'case',
          ['>=', ['get', 'pct'], 0.9], 'cto-red',
          ['>=', ['get', 'pct'], 0.7], 'cto-yellow',
          'cto-green',
        ],
        'icon-size': 0.8,
        'icon-allow-overlap': true,
      },
    })

    // Source + layers: Caixas CE / CDO (mesma source, layers distintos por tipo)
    map.addSource('caixas', {
      type: 'geojson',
      data: caixasToGeoJSON(caixas),
    })
    map.addLayer({
      id: 'caixas-ce-layer',
      type: 'symbol',
      source: 'caixas',
      filter: ['==', ['get', 'tipo'], 'ce'],
      layout: {
        'icon-image': 'ce-icon',
        'icon-size': 0.85,
        'icon-allow-overlap': true,
      },
    })
    map.addLayer({
      id: 'caixas-cdo-layer',
      type: 'symbol',
      source: 'caixas',
      filter: ['!=', ['get', 'tipo'], 'ce'],
      layout: {
        'icon-image': 'cdo-icon',
        'icon-size': 0.85,
        'icon-allow-overlap': true,
      },
    })

    layersReady.current = true

    return () => {
      // Cleanup: remover layers + sources + imagens ao desmontar
      if (!map || !map.loaded()) return
      try {
        LAYERS.forEach((id)  => { if (map.getLayer(id))   map.removeLayer(id) })
        if (map.getLayer(SATELLITE_LAYER))  map.removeLayer(SATELLITE_LAYER)
        SOURCES.forEach((id) => { if (map.getSource(id))  map.removeSource(id) })
        if (map.getSource(SATELLITE_SOURCE)) map.removeSource(SATELLITE_SOURCE)
        ;['cto-green','cto-yellow','cto-red','ce-icon','cdo-icon','poste-icon'].forEach(
          (name) => { if (map.hasImage(name)) map.removeImage(name) }
        )
      } catch (_) {
        // O mapa pode já ter sido destruído; ignorar erros de cleanup
      }
      layersReady.current = false
    }
    // Intencionalmente sem deps de data — os dados são atualizados no effect abaixo
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, mapLoaded])

  // ---------- Atualização de dados ----------
  useEffect(() => {
    if (!map || !mapLoaded || !layersReady.current) return
    const src = map.getSource('ctos')
    if (src) src.setData(ctosToGeoJSON(ctos))
  }, [map, mapLoaded, ctos])

  useEffect(() => {
    if (!map || !mapLoaded || !layersReady.current) return
    const src = map.getSource('caixas')
    if (src) src.setData(caixasToGeoJSON(caixas))
  }, [map, mapLoaded, caixas])

  useEffect(() => {
    if (!map || !mapLoaded || !layersReady.current) return
    const src = map.getSource('rotas')
    if (src) src.setData(rotas ?? { type: 'FeatureCollection', features: [] })
  }, [map, mapLoaded, rotas])

  useEffect(() => {
    if (!map || !mapLoaded || !layersReady.current) return
    const src = map.getSource('postes')
    if (src) src.setData(postesToGeoJSON(postes))
  }, [map, mapLoaded, postes])

  // ---------- Visibilidade das layers ----------
  useEffect(() => {
    if (!map || !mapLoaded || !layersReady.current) return

    const setVis = (layerId, visible) => {
      if (map.getLayer(layerId)) {
        map.setLayoutProperty(layerId, 'visibility', visible ? 'visible' : 'none')
      }
    }

    setVis('ctos-layer',       layerToggles?.ctos      !== false)
    setVis('caixas-ce-layer',  layerToggles?.caixas    !== false)
    setVis('caixas-cdo-layer', layerToggles?.caixas    !== false)
    setVis('rotas-layer',      layerToggles?.rotas     !== false)
    setVis('rotas-layer-drop', layerToggles?.rotas     !== false)
    setVis('postes-layer',     layerToggles?.postes    !== false)
    setVis(SATELLITE_LAYER,    layerToggles?.satellite === true)
  }, [map, mapLoaded, layerToggles])
}
