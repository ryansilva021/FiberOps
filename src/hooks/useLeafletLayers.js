'use client'

/**
 * useLeafletLayers — substituto drop-in de useMapLayers.js
 * ----------------------------------------------------------
 * Mesma assinatura: useLeafletLayers(map, mapLoaded, data, layerToggles)
 *
 * TROCA em MapaFTTH.js:
 *   - import { useMapLayers }     from '@/hooks/useMapLayers'
 *   + import { useLeafletLayers } from '@/hooks/useLeafletLayers'
 *
 * Os dados chegam exatamente no mesmo formato que o sistema já usa:
 *   { ctos, caixas, rotas (GeoJSON), postes, olts }
 */

import { useEffect, useRef } from 'react'
import L from 'leaflet'

// ---------------------------------------------------------------------------
// Helpers de ícones via Canvas — mantém visual idêntico ao atual
// ---------------------------------------------------------------------------

/** Cor do CTO baseada em ocupação (pct = ocupacao/capacidade) */
function ctoColor(pct) {
  if (pct >= 0.9) return '#f43f5e'  // vermelho
  if (pct >= 0.7) return '#f59e0b'  // amarelo
  return '#22c55e'                   // verde
}

/** Ícone "X" para CTO — mesmo visual do canvas atual */
function makeCTOIcon(color = '#22c55e', size = 28) {
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  // Contorno preto
  ctx.strokeStyle = '#000000'
  ctx.lineWidth   = size * 0.28
  ctx.lineCap     = 'round'
  ctx.beginPath()
  ctx.moveTo(size * 0.2, size * 0.2); ctx.lineTo(size * 0.8, size * 0.8)
  ctx.moveTo(size * 0.8, size * 0.2); ctx.lineTo(size * 0.2, size * 0.8)
  ctx.stroke()
  // X colorido
  ctx.strokeStyle = color
  ctx.lineWidth   = size * 0.16
  ctx.beginPath()
  ctx.moveTo(size * 0.2, size * 0.2); ctx.lineTo(size * 0.8, size * 0.8)
  ctx.moveTo(size * 0.8, size * 0.2); ctx.lineTo(size * 0.2, size * 0.8)
  ctx.stroke()
  return L.icon({
    iconUrl:     canvas.toDataURL(),
    iconSize:    [size, size],
    iconAnchor:  [size / 2, size / 2],
    popupAnchor: [0, -(size / 2 + 4)],
  })
}

/** Ícone quadrado para CE */
function makeCEIcon(color = '#3b82f6', size = 20) {
  const canvas = document.createElement('canvas')
  canvas.width = size; canvas.height = size
  const ctx = canvas.getContext('2d')
  const pad = size * 0.1
  ctx.fillStyle = '#000'
  ctx.fillRect(pad - 2, pad - 2, size - pad * 2 + 4, size - pad * 2 + 4)
  ctx.fillStyle = color
  ctx.fillRect(pad, pad, size - pad * 2, size - pad * 2)
  return L.icon({
    iconUrl:     canvas.toDataURL(),
    iconSize:    [size, size],
    iconAnchor:  [size / 2, size / 2],
    popupAnchor: [0, -(size / 2 + 4)],
  })
}

/** Ícone triângulo para CDO */
function makeCDOIcon(color = '#a855f7', size = 22) {
  const canvas = document.createElement('canvas')
  canvas.width = size; canvas.height = size
  const ctx = canvas.getContext('2d')
  const cx = size / 2
  ctx.beginPath()
  ctx.moveTo(cx, size * 0.08); ctx.lineTo(size * 0.96, size * 0.92); ctx.lineTo(size * 0.04, size * 0.92)
  ctx.closePath()
  ctx.fillStyle = '#000'; ctx.fill()
  ctx.beginPath()
  ctx.moveTo(cx, size * 0.12); ctx.lineTo(size * 0.92, size * 0.88); ctx.lineTo(size * 0.08, size * 0.88)
  ctx.closePath()
  ctx.fillStyle = color; ctx.fill()
  return L.icon({
    iconUrl:     canvas.toDataURL(),
    iconSize:    [size, size],
    iconAnchor:  [size / 2, size / 2],
    popupAnchor: [0, -(size / 2 + 4)],
  })
}

/** Ícone diamante para OLT */
function makeOLTIcon(color = '#06b6d4', size = 24) {
  const canvas = document.createElement('canvas')
  canvas.width = size; canvas.height = size
  const ctx = canvas.getContext('2d')
  const cx = size / 2, cy = size / 2, r = size * 0.42
  // sombra
  ctx.beginPath()
  ctx.moveTo(cx, cy - r - 2); ctx.lineTo(cx + r + 2, cy)
  ctx.lineTo(cx, cy + r + 2); ctx.lineTo(cx - r - 2, cy)
  ctx.closePath(); ctx.fillStyle = '#000'; ctx.fill()
  // diamante
  ctx.beginPath()
  ctx.moveTo(cx, cy - r); ctx.lineTo(cx + r, cy)
  ctx.lineTo(cx, cy + r); ctx.lineTo(cx - r, cy)
  ctx.closePath(); ctx.fillStyle = color; ctx.fill()
  return L.icon({
    iconUrl:     canvas.toDataURL(),
    iconSize:    [size, size],
    iconAnchor:  [size / 2, size / 2],
    popupAnchor: [0, -(size / 2 + 4)],
  })
}

// ---------------------------------------------------------------------------
// Cores de rota
// ---------------------------------------------------------------------------

const ROTA_COLORS  = { BACKBONE: '#6366f1', RAMAL: '#1e293b', DROP: '#22c55e' }
const ROTA_WEIGHTS = { BACKBONE: 6, RAMAL: 3, DROP: 2 }

// ---------------------------------------------------------------------------
// Hook principal
// ---------------------------------------------------------------------------

/**
 * @param {L.Map|null}  map
 * @param {boolean}     mapLoaded
 * @param {{ ctos, caixas, rotas, postes, olts }} data
 * @param {{ ctos, caixas, rotas, postes, olts, satellite }} layerToggles
 * @param {object}      [callbacks]               - Opcional: { onClickCTO, onClickCaixa, ... }
 */
export function useLeafletLayers(map, mapLoaded, data, layerToggles, callbacks = {}) {
  const { ctos = [], caixas = [], rotas = null, postes = [], olts = [] } = data ?? {}
  const groupsRef    = useRef({})
  const satelliteRef = useRef(null)

  // ── Setup inicial: cria um LayerGroup por tipo + satélite (Esri) ──────
  useEffect(() => {
    if (!map || !mapLoaded) return

    // Tile layer de satélite — adicionado mas oculto até o toggle ativar
    const satelliteTile = L.tileLayer(
      'https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      { attribution: 'Esri World Imagery', maxZoom: 19, opacity: 0.95 }
    )
    satelliteRef.current = satelliteTile

    const groups = {
      ctos:   L.layerGroup().addTo(map),
      caixas: L.layerGroup().addTo(map),
      rotas:  L.layerGroup().addTo(map),
      postes: L.layerGroup().addTo(map),
      olts:   L.layerGroup().addTo(map),
    }

    groupsRef.current = groups

    return () => {
      try { if (map.hasLayer(satelliteTile)) map.removeLayer(satelliteTile) } catch (_) {}
      satelliteRef.current = null
      Object.values(groups).forEach((g) => {
        try { map.removeLayer(g) } catch (_) {}
      })
      groupsRef.current = {}
    }
  }, [map, mapLoaded])

  // ── CTOs ───────────────────────────────────────────────────────────────
  useEffect(() => {
    const g = groupsRef.current.ctos
    if (!g) return
    g.clearLayers()
    ctos.forEach((cto) => {
      if (cto.lat == null || cto.lng == null) return
      const pct  = cto.capacidade > 0 ? cto.ocupacao / cto.capacidade : 0
      const icon = makeCTOIcon(ctoColor(pct))
      const m    = L.marker([cto.lat, cto.lng], { icon })
      m.bindPopup(
        `<strong>CTO ${cto.cto_id}</strong><br>` +
        `${cto.nome ?? ''}<br>` +
        `Ocupação: ${Math.round(pct * 100)}% (${cto.ocupacao ?? 0}/${cto.capacidade ?? 0})`
      )
      if (callbacks.onClickCTO) {
        m.on('click', (e) => { L.DomEvent.stopPropagation(e); callbacks.onClickCTO(cto) })
      }
      m.addTo(g)
    })
  }, [map, mapLoaded, ctos]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Caixas (CE / CDO) ─────────────────────────────────────────────────
  useEffect(() => {
    const g = groupsRef.current.caixas
    if (!g) return
    g.clearLayers()
    caixas.forEach((c) => {
      if (c.lat == null || c.lng == null) return
      const icon = c.tipo === 'CE' ? makeCEIcon() : makeCDOIcon()
      const m    = L.marker([c.lat, c.lng], { icon })
      m.bindPopup(`<strong>${c.tipo} ${c.ce_id ?? c.id ?? ''}</strong><br>${c.nome ?? ''}`)
      if (callbacks.onClickCaixa) {
        m.on('click', (e) => { L.DomEvent.stopPropagation(e); callbacks.onClickCaixa(c) })
      }
      m.addTo(g)
    })
  }, [map, mapLoaded, caixas]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Rotas (GeoJSON FeatureCollection) ─────────────────────────────────
  useEffect(() => {
    const g = groupsRef.current.rotas
    if (!g) return
    g.clearLayers()
    if (!rotas?.features) return
    rotas.features.forEach((f) => {
      const coords = f.geometry?.coordinates
      if (!coords || coords.length < 2) return
      // GeoJSON [lng, lat] → Leaflet [lat, lng]
      const latlngs = coords.map(([lng, lat]) => [lat, lng])
      const props   = f.properties ?? {}
      L.polyline(latlngs, {
        color:     ROTA_COLORS[props.tipo]  ?? '#94a3b8',
        weight:    ROTA_WEIGHTS[props.tipo] ?? 2,
        dashArray: props.tipo === 'DROP' ? '6 4' : null,
        opacity:   0.85,
      }).addTo(g)
    })
  }, [map, mapLoaded, rotas])

  // ── Postes ─────────────────────────────────────────────────────────────
  useEffect(() => {
    const g = groupsRef.current.postes
    if (!g) return
    g.clearLayers()
    postes.forEach((p) => {
      if (p.lat == null || p.lng == null) return
      const pm = L.circleMarker([p.lat, p.lng], {
        radius:      5,
        color:       '#1e293b',
        weight:      1.5,
        fillColor:   '#64748b',
        fillOpacity: 1,
      }).bindPopup(`Poste ${p.poste_id ?? ''}`)
      if (callbacks.onClickPoste) {
        pm.on('click', (e) => { L.DomEvent.stopPropagation(e); callbacks.onClickPoste(p) })
      }
      pm.addTo(g)
    })
  }, [map, mapLoaded, postes])

  // ── OLTs ───────────────────────────────────────────────────────────────
  useEffect(() => {
    const g = groupsRef.current.olts
    if (!g) return
    g.clearLayers()
    olts.filter((o) => o.lat != null && o.lng != null).forEach((o) => {
      const m = L.marker([o.lat, o.lng], { icon: makeOLTIcon() })
      m.bindPopup(`<strong>OLT ${o.nome ?? o.id ?? ''}</strong>`)
      if (callbacks.onClickOLT) {
        m.on('click', (e) => { L.DomEvent.stopPropagation(e); callbacks.onClickOLT(o) })
      }
      m.addTo(g)
    })
  }, [map, mapLoaded, olts]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Toggle de visibilidade ─────────────────────────────────────────────
  useEffect(() => {
    if (!map || !mapLoaded) return
    const g = groupsRef.current

    const setVisible = (group, visible) => {
      if (!group) return
      if (visible) { if (!map.hasLayer(group)) map.addLayer(group) }
      else         { if (map.hasLayer(group))  map.removeLayer(group) }
    }

    setVisible(g.ctos,   layerToggles?.ctos   !== false)
    setVisible(g.caixas, layerToggles?.caixas !== false)
    setVisible(g.rotas,  layerToggles?.rotas  !== false)
    setVisible(g.postes, layerToggles?.postes !== false)
    setVisible(g.olts,   layerToggles?.olts   !== false)

    // Satélite (Esri)
    const sat = satelliteRef.current
    if (sat) {
      if (layerToggles?.satellite) { if (!map.hasLayer(sat)) sat.addTo(map) }
      else                         { if (map.hasLayer(sat))  map.removeLayer(sat) }
    }
  }, [map, mapLoaded, layerToggles])
}
