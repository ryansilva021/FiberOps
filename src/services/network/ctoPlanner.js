/**
 * src/services/network/ctoPlanner.js
 * ────────────────────────────────────────────────────────────────────────────
 * Calcula posições de CTOs.
 *
 * Modo principal: planCTOsAlongStreets
 *   1. Detecta intersecções reais (nós OSM compartilhados por 2+ vias)
 *   2. Coloca CTOs nas intersecções prioritariamente
 *   3. Completa com posições mid-block ao longo de cada rua
 *   4. Faz snap final de cada CTO ao nó de rua mais próximo (≤ 40m)
 *
 * Modo fallback: planCTOs (grade uniforme)
 *   Usado quando não há dados de ruas disponíveis.
 */

import { pointInPolygon, getBBox } from './routeGenerator'

// ===========================================================================
// MODO PRINCIPAL — posicionamento ao longo das ruas
// ===========================================================================

/**
 * @param {Array<[number,number]>} polygon
 * @param {Array}                  streets   — retorno de fetchStreetsInPolygon
 * @param {object}                 [opts]
 * @param {number}  [opts.spacingM=120]
 * @param {number}  [opts.capacidade=16]
 * @param {string}  [opts.prefix='CTO']
 */
export function planCTOsAlongStreets(polygon, streets, opts = {}) {
  const { spacingM = 120, capacidade = 16, prefix = 'CTO' } = opts

  if (!streets?.length) return []

  const minDistM = spacingM * 0.7

  // ── 1. Coletar todos os nós de todas as ruas ──────────────────────────────
  // nodeCount: chave → { coord, count }  onde chave é grade de ~1m
  const nodeCount = new Map()
  const allNodes  = []   // todos os nós para snap posterior

  for (const street of streets) {
    for (const coord of street.coordinates) {
      const key = _nodeKey(coord)
      if (nodeCount.has(key)) {
        nodeCount.get(key).count++
      } else {
        const entry = { coord, count: 1 }
        nodeCount.set(key, entry)
        allNodes.push(entry)
      }
    }
  }

  // Índice espacial leve para snap rápido (grid de células de ~50m)
  const snapGrid = _buildSnapGrid(allNodes)

  const ctos   = []
  const placed = []  // [lng, lat] das CTOs colocadas
  let   idx    = 1

  // ── 2. Primeiro passe: intersecções ──────────────────────────────────────
  for (const { coord, count } of nodeCount.values()) {
    if (count < 2) continue
    const [lng, lat] = coord
    if (!pointInPolygon([lng, lat], polygon)) continue
    if (_tooClose(lng, lat, placed, minDistM)) continue
    ctos.push(_makeCTO(prefix, idx++, lat, lng, capacidade, null))
    placed.push([lng, lat])
  }

  // ── 3. Segundo passe: posições mid-block ──────────────────────────────────
  for (const street of streets) {
    const pts = street.coordinates
    if (pts.length < 2) continue

    // Distância acumulada desde a última CTO colocada
    let nearestDist = spacingM / 2
    for (const [plng, plat] of placed) {
      const d = _segLenM(pts[0][0], pts[0][1], plng, plat)
      if (d < nearestDist) nearestDist = d
    }
    let distFromLast = nearestDist

    for (let i = 1; i < pts.length; i++) {
      const [lng1, lat1] = pts[i - 1]
      const [lng2, lat2] = pts[i]
      const segLen = _segLenM(lng1, lat1, lng2, lat2)
      if (segLen < 0.1) continue

      let consumed = 0
      while (consumed + (spacingM - distFromLast) <= segLen + 0.01) {
        consumed += spacingM - distFromLast
        const t   = Math.min(consumed / segLen, 1)
        const lng = lng1 + (lng2 - lng1) * t
        const lat = lat1 + (lat2 - lat1) * t

        if (pointInPolygon([lng, lat], polygon) && !_tooClose(lng, lat, placed, minDistM)) {
          ctos.push(_makeCTO(prefix, idx++, lat, lng, capacidade, street.name))
          placed.push([lng, lat])
        }
        distFromLast = 0
      }
      distFromLast += segLen - consumed
    }
  }

  // ── 3.5. Cobertura de ruas curtas: ao menos uma CTO por rua ─────────────
  // Ruas menores que spacingM nunca acionam o while acima; se nenhuma CTO já
  // cobre o trecho, insere uma no ponto médio da rua.
  for (const street of streets) {
    const pts = street.coordinates
    if (pts.length < 2) continue

    let totalLen = 0
    for (let i = 1; i < pts.length; i++) {
      totalLen += _segLenM(pts[i-1][0], pts[i-1][1], pts[i][0], pts[i][1])
    }
    if (totalLen < 5) continue  // segmento degenerado

    // Ponto médio ao longo da polilinha
    const midDist = totalLen / 2
    let acc = 0
    let mid = pts[0]
    for (let i = 1; i < pts.length; i++) {
      const seg = _segLenM(pts[i-1][0], pts[i-1][1], pts[i][0], pts[i][1])
      if (acc + seg >= midDist) {
        const t = seg > 0 ? (midDist - acc) / seg : 0
        mid = [pts[i-1][0] + (pts[i][0] - pts[i-1][0]) * t,
               pts[i-1][1] + (pts[i][1] - pts[i-1][1]) * t]
        break
      }
      acc += seg
    }

    const [mlng, mlat] = mid
    if (!pointInPolygon([mlng, mlat], polygon)) continue
    if (!_tooClose(mlng, mlat, placed, spacingM * 0.6)) {
      ctos.push(_makeCTO(prefix, idx++, mlat, mlng, capacidade, street.name))
      placed.push([mlng, mlat])
    }
  }

  // ── 4. Snap final: mover cada CTO para o nó de rua mais próximo (≤ 40m) ──
  const snapRadiusM = 40
  for (const cto of ctos) {
    const nearest = _nearestNode(cto.lng, cto.lat, snapGrid, snapRadiusM)
    if (nearest) {
      cto.lat = parseFloat(nearest[1].toFixed(7))
      cto.lng = parseFloat(nearest[0].toFixed(7))
    }
  }

  // Remove duplicatas que o snap pode ter criado
  const dedupedCtos = _deduplicateCTOs(ctos, minDistM * 0.8)

  return snakeOrderCTOs(dedupedCtos, prefix, capacidade)
}

// ===========================================================================
// ORDENAÇÃO ESPACIAL — snake scan
// ===========================================================================

export function snakeOrderCTOs(ctos, prefix, capacidade) {
  if (ctos.length === 0) return []

  const BAND_DEG = 150 / 111000

  const maxLat = Math.max(...ctos.map(c => c.lat))

  const sorted = [...ctos].sort((a, b) => {
    const rowA = Math.floor((maxLat - a.lat) / BAND_DEG)
    const rowB = Math.floor((maxLat - b.lat) / BAND_DEG)
    if (rowA !== rowB) return rowA - rowB
    return rowA % 2 === 0 ? a.lng - b.lng : b.lng - a.lng
  })

  return sorted.map((cto, i) => {
    const idx    = i + 1
    const pad    = String(idx).padStart(2, '0')
    const cto_id = `${prefix}-${pad}`
    return { ...cto, cto_id, nome: cto_id, capacidade: capacidade ?? cto.capacidade }
  })
}

// ===========================================================================
// MODO FALLBACK — grade uniforme (sem dados de ruas)
// ===========================================================================

export function planCTOs(polygon, opts = {}) {
  const { capacidade = 16, prefix = 'CTO' } = opts

  const bbox   = getBBox(polygon)
  const midLat = (bbox.minLat + bbox.maxLat) / 2
  const latM   = (bbox.maxLat - bbox.minLat) * 111000
  const lngM   = (bbox.maxLng - bbox.minLng) * 111000 * Math.cos(midLat * Math.PI / 180)
  const step   = opts.gridStep ?? (Math.max(80, Math.min(400, Math.min(latM, lngM) / 5)) / 111000)

  const ctos = []
  let idx = 1

  for (let lat = bbox.minLat + step / 2; lat < bbox.maxLat; lat += step) {
    for (let lng = bbox.minLng + step / 2; lng < bbox.maxLng; lng += step) {
      if (pointInPolygon([lng, lat], polygon)) {
        ctos.push(_makeCTO(prefix, idx++, lat, lng, capacidade, null))
      }
    }
  }
  return snakeOrderCTOs(ctos, prefix, capacidade)
}

// ===========================================================================
// HELPERS INTERNOS
// ===========================================================================

/** Chave de grade ~1m para detecção de nós compartilhados */
function _nodeKey([lng, lat]) {
  return `${lng.toFixed(5)},${lat.toFixed(5)}`
}

function _segLenM(lng1, lat1, lng2, lat2) {
  const dlat = (lat2 - lat1) * 111000
  const dlng = (lng2 - lng1) * 111000 * Math.cos(lat1 * Math.PI / 180)
  return Math.sqrt(dlat * dlat + dlng * dlng)
}

function _tooClose(lng, lat, placed, minDistM) {
  for (const [plng, plat] of placed) {
    if (_segLenM(lng, lat, plng, plat) < minDistM) return true
  }
  return false
}

function _makeCTO(prefix, idx, lat, lng, capacidade, rua) {
  const pad    = String(idx).padStart(2, '0')
  const cto_id = `${prefix}-${pad}`
  const splitter_cto = capacidade <= 8 ? '1:8' : capacidade <= 16 ? '1:16' : '1:32'
  return {
    cto_id,
    nome: cto_id,
    lat:  parseFloat(lat.toFixed(7)),
    lng:  parseFloat(lng.toFixed(7)),
    capacidade,
    splitter_cto,
    status: 'ativo',
    rua:  rua ?? null,
  }
}

/**
 * Constrói índice espacial simples: divide o espaço em células de ~50m.
 * Retorna uma Map: chave_celula → [entry, …]
 */
function _buildSnapGrid(allNodes) {
  const CELL_DEG = 50 / 111000  // ~50m em graus
  const grid = new Map()
  for (const entry of allNodes) {
    const [lng, lat] = entry.coord
    const cx = Math.floor(lng / CELL_DEG)
    const cy = Math.floor(lat / CELL_DEG)
    const key = `${cx},${cy}`
    if (!grid.has(key)) grid.set(key, [])
    grid.get(key).push(entry)
  }
  return { grid, CELL_DEG }
}

/**
 * Encontra o nó de rua mais próximo dentro de radiusM metros.
 * Verifica as células vizinhas no grid.
 */
function _nearestNode(lng, lat, snapGrid, radiusM) {
  const { grid, CELL_DEG } = snapGrid
  const radiusDeg = radiusM / 111000
  const cx0 = Math.floor(lng / CELL_DEG)
  const cy0 = Math.floor(lat / CELL_DEG)
  const span = Math.ceil(radiusDeg / CELL_DEG) + 1

  let bestDist = radiusM
  let bestCoord = null

  for (let dx = -span; dx <= span; dx++) {
    for (let dy = -span; dy <= span; dy++) {
      const key = `${cx0 + dx},${cy0 + dy}`
      const bucket = grid.get(key)
      if (!bucket) continue
      for (const { coord } of bucket) {
        const d = _segLenM(lng, lat, coord[0], coord[1])
        if (d < bestDist) {
          bestDist  = d
          bestCoord = coord
        }
      }
    }
  }
  return bestCoord
}

/** Remove CTOs que o snap aproximou demais umas das outras */
function _deduplicateCTOs(ctos, minDistM) {
  const kept = []
  const keptCoords = []
  for (const cto of ctos) {
    if (!_tooClose(cto.lng, cto.lat, keptCoords, minDistM)) {
      kept.push(cto)
      keptCoords.push([cto.lng, cto.lat])
    }
  }
  return kept
}
