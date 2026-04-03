/**
 * FiberOps Map Engine — Leaflet + OpenStreetMap
 * -----------------------------------------------
 * Motor de mapa modular e independente de framework.
 * Plugue no sistema sem alterar lógica de negócio FTTH.
 *
 * INTEGRAÇÃO:
 *   import { initMap, renderNodes, renderLinks, clearMap } from '@/lib/mapEngine'
 *
 *   // 1. Inicialize passando o elemento DOM (ou ref.current do React)
 *   const map = initMap(containerElement, { center: [-22.75, -41.88], zoom: 13 })
 *
 *   // 2. Renderize seus dados
 *   renderNodes(ctos, (node) => iconeFuncao(node))
 *   renderLinks(rotasGeoJSON)
 */

// ─── IMPORTANTE: importe o CSS do Leaflet no seu componente pai ───────────────
// import 'leaflet/dist/leaflet.css'
// ─────────────────────────────────────────────────────────────────────────────

import L from 'leaflet'

// Fix para bundlers (Next.js/Webpack): o Leaflet usa caminhos absolutos para
// ícones padrão que quebram com bundlers. Como usamos apenas DivIcon e Canvas
// em todo o sistema, o marcador padrão não é utilizado — mas desativamos o
// _getIconUrl para evitar erros no console.
if (typeof L.Icon !== 'undefined' && L.Icon.Default?.prototype) {
  delete L.Icon.Default.prototype._getIconUrl
}

// ---------------------------------------------------------------------------
// Estado interno — módulo singleton
// ---------------------------------------------------------------------------

let _map         = null  // instância L.Map
let _nodeLayer   = null  // L.FeatureGroup para markers (CTOs, Caixas, OLTs...)
let _linkLayer   = null  // L.FeatureGroup para polylines (Rotas)
let _markerIndex = {}    // { nodeId → L.Marker } para reutilização sem recriar

// ---------------------------------------------------------------------------
// initMap
// ---------------------------------------------------------------------------

/**
 * Inicializa o mapa Leaflet no container fornecido.
 * Idempotente: chamadas repetidas retornam a mesma instância.
 *
 * @param {HTMLElement}  container - Elemento DOM onde o mapa será montado
 * @param {object}       [opts]
 * @param {[lat,lng]}    [opts.center=[-22.75,-41.88]] - Coordenadas iniciais
 * @param {number}       [opts.zoom=13]                - Zoom inicial
 * @returns {L.Map|null}
 */
export function initMap(container, opts = {}) {
  // Garante inicialização única
  if (_map) return _map
  if (!container) {
    console.error('[MapEngine] Container não encontrado.')
    return null
  }

  const {
    center = [-22.75, -41.88],
    zoom   = 13,
  } = opts

  // Instância Leaflet
  _map = L.map(container, {
    center,
    zoom,
    zoomControl:   false, // adicionado manualmente para controlar posição
    preferCanvas:  true,  // melhor performance para muitos pontos
  })

  // Tile layer: OpenStreetMap
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    maxZoom:     19,
    crossOrigin: true,
  }).addTo(_map)

  // Controles posicionados para não conflitar com sidebar esquerda
  L.control.zoom({ position: 'topright' }).addTo(_map)
  L.control.scale({ position: 'bottomleft', metric: true, imperial: false }).addTo(_map)

  // Camadas separadas por tipo (permite toggle de visibilidade)
  _nodeLayer = L.featureGroup().addTo(_map)
  _linkLayer = L.featureGroup().addTo(_map)

  // Garante que _linkLayer fique abaixo dos markers
  _linkLayer.setZIndex?.(1)
  _nodeLayer.setZIndex?.(2)

  return _map
}

// ---------------------------------------------------------------------------
// clearMap
// ---------------------------------------------------------------------------

/**
 * Remove todos os elementos visuais sem destruir o mapa.
 * Use ao recarregar dados — o mapa permanece inicializado.
 */
export function clearMap() {
  if (_nodeLayer) _nodeLayer.clearLayers()
  if (_linkLayer) _linkLayer.clearLayers()
  _markerIndex = {}
}

// ---------------------------------------------------------------------------
// addMarker
// ---------------------------------------------------------------------------

/**
 * Adiciona (ou atualiza) um marker no layer de nós.
 * Reutiliza markers existentes pelo ID — não recria desnecessariamente.
 *
 * @param {object}            node
 * @param {string|number}     node.id       - ID único do nó
 * @param {number}            node.lat
 * @param {number}            node.lng
 * @param {L.MarkerOptions}   [node.options] - Opções L.marker (incluindo icon)
 * @param {string}            [node.popup]   - HTML para popup
 * @param {Function}          [node.onClick] - Callback ao clicar
 * @returns {L.Marker|null}
 */
export function addMarker({ id, lat, lng, options = {}, popup, onClick } = {}) {
  if (!_nodeLayer) {
    console.warn('[MapEngine] Chame initMap() antes de addMarker()')
    return null
  }
  if (lat == null || lng == null) return null

  // Atualiza marker existente em vez de recriar
  if (_markerIndex[id]) {
    _markerIndex[id].setLatLng([lat, lng])
    return _markerIndex[id]
  }

  const marker = L.marker([lat, lng], options)

  if (popup)   marker.bindPopup(popup)
  if (onClick) marker.on('click', () => onClick(marker))

  marker.addTo(_nodeLayer)
  _markerIndex[id] = marker
  return marker
}

// ---------------------------------------------------------------------------
// addPolyline
// ---------------------------------------------------------------------------

/**
 * Adiciona uma polyline no layer de links.
 *
 * @param {object}              link
 * @param {Array<[lat,lng]>}    link.latlngs - Coordenadas Leaflet [lat, lng]
 * @param {L.PolylineOptions}   [link.options]
 * @returns {L.Polyline|null}
 */
export function addPolyline({ latlngs, options = {} } = {}) {
  if (!_linkLayer) {
    console.warn('[MapEngine] Chame initMap() antes de addPolyline()')
    return null
  }
  if (!latlngs || latlngs.length < 2) return null

  const polyline = L.polyline(latlngs, {
    color:   '#6366f1',
    weight:  3,
    opacity: 0.85,
    ...options,
  })
  polyline.addTo(_linkLayer)
  return polyline
}

// ---------------------------------------------------------------------------
// renderNodes
// ---------------------------------------------------------------------------

/**
 * Renderiza um array de nós com suporte a ícones customizados.
 * Conecte aqui seus CTOs, Caixas, OLTs, Postes.
 *
 * @param {Array}    nodes   - Array de objetos com { id, lat, lng, ... }
 * @param {Function} [iconFn] - Opcional: (node) => L.Icon  (retorna ícone customizado)
 * @param {Function} [popupFn] - Opcional: (node) => string (retorna HTML do popup)
 * @param {Function} [onClickFn] - Opcional: (node, marker) => void
 */
export function renderNodes(nodes = [], iconFn = null, popupFn = null, onClickFn = null) {
  if (!_nodeLayer) {
    console.warn('[MapEngine] Chame initMap() antes de renderNodes()')
    return
  }

  nodes.forEach((node) => {
    const nodeId = node.id ?? node.cto_id ?? node.ce_id ?? node.poste_id ?? node.olt_id

    const markerOptions = {}
    if (iconFn) {
      const icon = iconFn(node)
      if (icon) markerOptions.icon = icon
    }

    const popupHtml = popupFn
      ? popupFn(node)
      : `<strong>${node.nome ?? nodeId ?? 'Nó'}</strong>`

    addMarker({
      id:      nodeId,
      lat:     node.lat,
      lng:     node.lng,
      options: markerOptions,
      popup:   popupHtml,
      onClick: onClickFn ? (marker) => onClickFn(node, marker) : null,
    })
  })
}

// ---------------------------------------------------------------------------
// renderLinks
// ---------------------------------------------------------------------------

/**
 * Renderiza rotas de fibra.
 * Aceita GeoJSON FeatureCollection (formato do seu sistema) ou array simples.
 *
 * @param {object|Array} links - GeoJSON FeatureCollection ou array de features
 */
export function renderLinks(links = []) {
  if (!_linkLayer) {
    console.warn('[MapEngine] Chame initMap() antes de renderLinks()')
    return
  }

  // Aceita GeoJSON FeatureCollection OU array de features
  const features = links?.type === 'FeatureCollection'
    ? links.features
    : Array.isArray(links) ? links : []

  const COLORS = {
    BACKBONE: '#6366f1',
    RAMAL:    '#1e293b',
    DROP:     '#22c55e',
  }
  const WEIGHTS = { BACKBONE: 6, RAMAL: 3, DROP: 2 }

  features.forEach((feature) => {
    const coords = feature?.geometry?.coordinates
    const props  = feature?.properties ?? {}

    if (!coords || coords.length < 2) return

    // GeoJSON usa [lng, lat] → Leaflet usa [lat, lng]
    const latlngs = coords.map(([lng, lat]) => [lat, lng])

    addPolyline({
      latlngs,
      options: {
        color:     COLORS[props.tipo]   ?? '#94a3b8',
        weight:    WEIGHTS[props.tipo]  ?? 2,
        dashArray: props.tipo === 'DROP' ? '6 4' : null,
        opacity:   0.85,
      },
    })
  })
}

// ---------------------------------------------------------------------------
// Getters — acesso à instância para uso avançado
// ---------------------------------------------------------------------------

/** Retorna a instância L.Map ativa (null se não inicializado) */
export function getMap()       { return _map }
/** Retorna o FeatureGroup de markers */
export function getNodeLayer() { return _nodeLayer }
/** Retorna o FeatureGroup de polylines */
export function getLinkLayer() { return _linkLayer }
/** Retorna o índice de markers { id → L.Marker } */
export function getMarkerIndex() { return _markerIndex }

// ---------------------------------------------------------------------------
// destroyMap — use apenas ao desmontar o componente React
// ---------------------------------------------------------------------------

/**
 * Destrói o mapa e libera todos os recursos.
 * Chamado automaticamente pelo hook useLeafletMap no cleanup do useEffect.
 */
export function destroyMap() {
  if (_map) {
    try { _map.remove() } catch (_) {}
    _map = null
  }
  _nodeLayer   = null
  _linkLayer   = null
  _markerIndex = {}
}
