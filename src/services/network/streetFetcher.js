/**
 * src/services/network/streetFetcher.js
 * ────────────────────────────────────────────────────────────────────────────
 * Busca ruas do OpenStreetMap via Overpass API dentro de um polígono.
 * Apenas client-side — sem imports de servidor.
 *
 * Estratégia de fetch (em ordem, parando no primeiro sucesso):
 *   1. bbox+poly  via overpass-api.de    — mais rápido para áreas grandes
 *   2. bbox+poly  via overpass.kumi.systems — endpoint alternativo
 *   3. somente bbox (sem clip ao polígono) — fallback tolerante
 */

const OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
]

const FETCH_TIMEOUT_MS = 32_000
const OVP_TIMEOUT_S    = 28

const HIGHWAY_FILTER =
  'primary|primary_link|secondary|secondary_link|trunk|trunk_link|' +
  'tertiary|tertiary_link|residential|unclassified|service|' +
  'living_street|road'

function _tipoRota(highway = '') {
  if (/^(primary|secondary|trunk)/.test(highway)) return 'BACKBONE'
  return 'RAMAL'
}

export function streetWeight(highway = '') {
  if (/^(primary|secondary|trunk)/.test(highway)) return 1.0
  if (/^(tertiary|residential)/.test(highway))     return 0.8
  if (/^(unclassified|service)/.test(highway))     return 0.6
  return 0.5
}

/** Calcula bounding box de um polígono [[lng,lat],…] */
function _bbox(polygon) {
  let minLat = Infinity, maxLat = -Infinity, minLng = Infinity, maxLng = -Infinity
  for (const [lng, lat] of polygon) {
    if (lat < minLat) minLat = lat
    if (lat > maxLat) maxLat = lat
    if (lng < minLng) minLng = lng
    if (lng > maxLng) maxLng = lng
  }
  // margem de 0.002° (~200m) para não cortar ruas de borda
  return { minLat: minLat - 0.002, maxLat: maxLat + 0.002, minLng: minLng - 0.002, maxLng: maxLng + 0.002 }
}

async function _ovpFetch(endpoint, query) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
  try {
    const resp = await fetch(endpoint, {
      method:  'POST',
      body:    'data=' + encodeURIComponent(query),
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      signal:  controller.signal,
    })
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
    return await resp.json()
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Busca ruas do OSM dentro do polígono informado.
 *
 * @param {Array<[number,number]>} polygon — vértices [lng, lat] WGS84
 * @param {{ maxWays?: number }} [opts]
 * @returns {Promise<Array<{
 *   osm_id: number,
 *   highway: string,
 *   name: string|null,
 *   tipo: 'BACKBONE'|'RAMAL',
 *   coordinates: Array<[number,number]>   — [lng, lat]
 * }>>}
 */
export async function fetchStreetsInPolygon(polygon, opts = {}) {
  const { maxWays = 1200 } = opts

  const bb = _bbox(polygon)
  // "minlat,minlon,maxlat,maxlon" — formato Overpass
  const bboxStr = `${bb.minLat.toFixed(6)},${bb.minLng.toFixed(6)},${bb.maxLat.toFixed(6)},${bb.maxLng.toFixed(6)}`
  const polyStr = polygon.map(([lng, lat]) => `${lat.toFixed(6)} ${lng.toFixed(6)}`).join(' ')

  // Query 1: bbox+poly (clip preciso ao polígono — mais rápido que só poly)
  const queryPoly =
    `[out:json][timeout:${OVP_TIMEOUT_S}];` +
    `(way["highway"~"^(${HIGHWAY_FILTER})$"](${bboxStr})(poly:"${polyStr}"););` +
    `out geom qt;`

  // Query 2: somente bbox (fallback — inclui ruas fora do polígono, filtramos depois)
  const queryBbox =
    `[out:json][timeout:${OVP_TIMEOUT_S}];` +
    `(way["highway"~"^(${HIGHWAY_FILTER})$"](${bboxStr}););` +
    `out geom qt;`

  const attempts = [
    { url: OVERPASS_ENDPOINTS[0], query: queryPoly,  label: 'poly/primary'    },
    { url: OVERPASS_ENDPOINTS[1], query: queryPoly,  label: 'poly/backup'     },
    { url: OVERPASS_ENDPOINTS[0], query: queryBbox,  label: 'bbox/primary'    },
    { url: OVERPASS_ENDPOINTS[1], query: queryBbox,  label: 'bbox/backup'     },
  ]

  let data = null
  for (const attempt of attempts) {
    try {
      data = await _ovpFetch(attempt.url, attempt.query)
      if (data?.elements?.length) break
    } catch {
      // próxima tentativa
    }
  }

  if (!data?.elements?.length) return []

  const elements = data.elements
    .filter(el => el.type === 'way' && el.geometry?.length >= 2)
    .slice(0, maxWays)

  return elements
    .map(el => {
      const coordinates = el.geometry
        .map(({ lat, lon }) => [lon, lat])
        .filter(([lng, lat]) => lng != null && lat != null && isFinite(lng) && isFinite(lat))

      if (coordinates.length < 2) return null

      return {
        osm_id:  el.id,
        highway: el.tags?.highway ?? 'unclassified',
        name:    el.tags?.name ?? null,
        tipo:    _tipoRota(el.tags?.highway),
        coordinates,
      }
    })
    .filter(Boolean)
}
