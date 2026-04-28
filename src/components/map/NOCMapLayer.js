'use client'

/**
 * src/components/map/NOCMapLayer.js
 *
 * Camada OpenLayers que renderiza dados do fiberops-network-lab sobre o mapa:
 *   - OLTs: marcadores coloridos por status (verde/vermelho/laranja)
 *   - ONUs offline: marcadores vermelhos pulsantes
 *   - Alertas críticos: halo de alerta sobre a posição
 *
 * Uso:
 *   <NOCMapLayer map={olMap} visible={layerToggles.noc} />
 *
 * O componente não renderiza DOM — só adiciona/atualiza layers OL.
 */

import { useEffect, useRef } from 'react'
import VectorSource from 'ol/source/Vector'
import VectorLayer  from 'ol/layer/Vector'
import Feature      from 'ol/Feature'
import Point        from 'ol/geom/Point'
import { fromLonLat } from 'ol/proj'
import { Style, Circle as OLCircle, Fill, Stroke, Text } from 'ol/style'
import Overlay from 'ol/Overlay'
import { useNOCMapData } from '@/hooks/useNOCMapData'
import { NOC_EVENT_META } from '@/hooks/useNOCSocket'

// ── Estilos OL ────────────────────────────────────────────────────────────────

function oltStyle(status, alertCount = 0) {
  const color =
    status === 'online'   ? '#22c55e' :
    status === 'offline'  ? '#dc2626' :
    status === 'degraded' ? '#f59e0b' : '#6b7280'

  const ring = alertCount > 0 ? new OLCircle({
    radius: 13,
    stroke: new Stroke({ color: '#dc262666', width: 2 }),
    fill:   new Fill({ color: '#dc262611' }),
  }) : null

  return [
    ring && new Style({ image: ring }),
    new Style({
      image: new OLCircle({
        radius: 8,
        fill:   new Fill({ color }),
        stroke: new Stroke({ color: '#fff', width: 2 }),
      }),
      text: new Text({
        text:       'OLT',
        font:       'bold 8px sans-serif',
        fill:       new Fill({ color: '#fff' }),
        offsetY:    -16,
        backgroundFill:  new Fill({ color: color + 'cc' }),
        backgroundStroke: new Stroke({ color: color, width: 1 }),
        padding:    [2, 4, 2, 4],
      }),
    }),
  ].filter(Boolean)
}

function onuOfflineStyle() {
  return new Style({
    image: new OLCircle({
      radius: 6,
      fill:   new Fill({ color: '#dc2626cc' }),
      stroke: new Stroke({ color: '#fff', width: 1.5 }),
    }),
  })
}

// ── Componente ────────────────────────────────────────────────────────────────

export default function NOCMapLayer({ map, visible = true, onOLTClick }) {
  const oltLayerRef  = useRef(null)
  const onuLayerRef  = useRef(null)
  const tooltipRef   = useRef(null)
  const overlayRef   = useRef(null)

  const { oltFeatures, onuFeatures, alertsByOLT, labOnline, lastSync } =
    useNOCMapData({ enabled: visible && !!map, interval: 30_000 })

  // ── Cria os layers no mount ───────────────────────────────────────────────
  useEffect(() => {
    if (!map) return

    const oltSource = new VectorSource()
    const onuSource = new VectorSource()

    const oltLayer = new VectorLayer({
      source: oltSource,
      zIndex: 90,
      visible,
      properties: { name: 'noc-olts' },
    })

    const onuLayer = new VectorLayer({
      source: onuSource,
      zIndex: 89,
      visible,
      properties: { name: 'noc-onus' },
    })

    map.addLayer(oltLayer)
    map.addLayer(onuLayer)
    oltLayerRef.current = oltLayer
    onuLayerRef.current = onuLayer

    // Tooltip overlay
    const el = document.createElement('div')
    el.style.cssText = [
      'background:#1A120D', 'color:#F7F0E2',
      'padding:6px 10px', 'border-radius:6px',
      'font-size:11px', 'font-weight:600',
      'pointer-events:none', 'white-space:nowrap',
      'border:1px solid rgba(196,90,44,0.4)',
      'box-shadow:0 2px 8px rgba(0,0,0,0.4)',
    ].join(';')
    tooltipRef.current = el

    const overlay = new Overlay({
      element: el,
      positioning: 'bottom-center',
      offset: [0, -14],
      stopEvent: false,
    })
    map.addOverlay(overlay)
    overlayRef.current = overlay

    // Click handler para OLT
    const clickKey = map.on('click', (e) => {
      let hit = false
      map.forEachFeatureAtPixel(e.pixel, (feat, layer) => {
        if (layer === oltLayer && feat.get('nocType') === 'olt') {
          onOLTClick?.(feat.get('data'))
          hit = true
        }
      })
      if (!hit) overlayRef.current?.setPosition(undefined)
    })

    // Hover tooltip
    const moveKey = map.on('pointermove', (e) => {
      let found = false
      map.forEachFeatureAtPixel(e.pixel, (feat, layer) => {
        if (layer === oltLayer || layer === onuLayer) {
          const data = feat.get('data')
          const type = feat.get('nocType')
          if (data) {
            let label = ''
            if (type === 'olt') {
              const alerts = alertsByOLT[data.id ?? data._id] ?? []
              label = `${data.name} — ${data.status}${alerts.length ? ` ⚠ ${alerts.length} alerta${alerts.length > 1 ? 's' : ''}` : ''}`
            } else {
              label = `ONU ${data.serial ?? data.onu_sn ?? ''} — ${data.status}`
              if (data.client) label += ` · ${data.client}`
            }
            tooltipRef.current.textContent = label
            overlayRef.current?.setPosition(e.coordinate)
            found = true
          }
        }
      })
      if (!found) overlayRef.current?.setPosition(undefined)
      map.getTargetElement().style.cursor = found ? 'pointer' : ''
    })

    return () => {
      map.un('click', clickKey.listener)
      map.un('pointermove', moveKey.listener)
      map.removeLayer(oltLayer)
      map.removeLayer(onuLayer)
      map.removeOverlay(overlay)
    }
  }, [map]) // eslint-disable-line

  // ── Atualiza visibilidade ─────────────────────────────────────────────────
  useEffect(() => {
    oltLayerRef.current?.setVisible(visible)
    onuLayerRef.current?.setVisible(visible)
  }, [visible])

  // ── Atualiza features OLT ─────────────────────────────────────────────────
  useEffect(() => {
    const src = oltLayerRef.current?.getSource()
    if (!src) return
    src.clear()

    for (const olt of oltFeatures) {
      const alerts = alertsByOLT[olt.id ?? olt._id] ?? []
      const feat = new Feature({
        geometry: new Point(fromLonLat([olt.lng, olt.lat])),
      })
      feat.set('nocType', 'olt')
      feat.set('data', olt)
      feat.setStyle(oltStyle(olt.status, alerts.length))
      src.addFeature(feat)
    }
  }, [oltFeatures, alertsByOLT])

  // ── Atualiza features ONU offline ─────────────────────────────────────────
  useEffect(() => {
    const src = onuLayerRef.current?.getSource()
    if (!src) return
    src.clear()

    for (const onu of onuFeatures) {
      const feat = new Feature({
        geometry: new Point(fromLonLat([onu.lng, onu.lat])),
      })
      feat.set('nocType', 'onu')
      feat.set('data', onu)
      feat.setStyle(onuOfflineStyle())
      src.addFeature(feat)
    }
  }, [onuFeatures])

  // Componente não renderiza DOM
  return null
}
