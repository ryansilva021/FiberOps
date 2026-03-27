/**
 * src/app/api/simulation/install/route.js
 * POST /api/simulation/install
 *
 * Simulates a FTTH installation at a given geographic point.
 * Selects the optimal CTO based on proximity, free ports, and estimated RX power.
 * Does NOT touch any real equipment — purely analytical.
 *
 * Body: { lat: number, lng: number }
 * Returns: simulation result with CTO, distance, estimated RX, signal quality, port, OLT/PON info.
 */

import { auth }             from '@/lib/auth'
import { connectDB }        from '@/lib/db'
import { CTO }              from '@/models/CTO'
import { OLT }              from '@/models/OLT'
import { CaixaEmendaCDO }   from '@/models/CaixaEmendaCDO'
import { PonCtoMap }        from '@/models/PonCtoMap'

const ALLOWED = ['superadmin', 'admin', 'noc', 'tecnico']

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// ─── Geo helpers ──────────────────────────────────────────────────────────────

/**
 * Haversine distance between two geographic points, in meters.
 */
function haversineMeters(lat1, lng1, lat2, lng2) {
  const R    = 6_371_000
  const toR  = d => d * Math.PI / 180
  const φ1   = toR(lat1), φ2 = toR(lat2)
  const Δφ   = toR(lat2 - lat1)
  const Δλ   = toR(lng2 - lng1)
  const a    = Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2
  return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)))
}

function fmtDist(m) {
  return m < 1000 ? `${m}m` : `${(m / 1000).toFixed(2)}km`
}

// ─── Signal estimation ────────────────────────────────────────────────────────

/**
 * Estimates optical RX power based on fiber distance.
 * Uses a simplified model aligned with ITU-T G.984 GPON link budgets:
 *   ≤ 100m  → -18 dBm (excellent — very close to splitter)
 *   ≤ 300m  → -22 dBm (good)
 *   ≤ 600m  → -25 dBm (borderline)
 *   >  600m → -28 dBm (critical — far end of PON reach)
 *
 * @param {number} meters
 * @returns {number} estimated RX in dBm
 */
function estimateRx(meters) {
  if (meters <= 100) return -18
  if (meters <= 300) return -22
  if (meters <= 600) return -25
  return -28
}

function signalQuality(rx) {
  if (rx > -20)  return 'EXCELENTE'
  if (rx >= -25) return 'BOM'
  if (rx >= -28) return 'LIMITE'
  return 'CRÍTICO'
}

function signalDiag(rx, meters) {
  const diags = []
  if (rx <= -28) diags.push('Sinal muito baixo — verificar continuidade da fibra e fusões')
  else if (rx <= -25) diags.push('Cliente no limite operacional — verificar atenuação da CTO')
  if (meters > 600) diags.push(`Distância elevada (${fmtDist(meters)}) — considerar CTO mais próxima`)
  return diags
}

// ─── CTO port helpers ─────────────────────────────────────────────────────────

function analyzeCtoPorts(cto) {
  const splitters = cto.diagrama?.splitters ?? []
  let livres = 0
  let primeiraPortaLivre = null
  let portNum = 0

  for (const splitter of splitters) {
    for (const saida of (splitter.saidas ?? [])) {
      portNum++
      if (!saida?.cliente?.trim()) {
        livres++
        if (primeiraPortaLivre === null) primeiraPortaLivre = portNum
      }
    }
  }

  // Fallback if no splitters are defined
  if (portNum === 0 && cto.capacidade > 0) {
    livres            = cto.capacidade
    primeiraPortaLivre = 1
  }

  return { livres, primeiraPortaLivre }
}

// ─── OLT / PON resolution ─────────────────────────────────────────────────────

/**
 * Resolves the OLT and PON for a given CTO.
 * Tries: PON map first (most accurate), then CDO/CE chain.
 */
async function resolveOltPon(projeto_id, cto_id, cdo_id) {
  // Strategy A: PON map contains this CTO
  const ponMap = await PonCtoMap.findOne({
    projeto_id,
    'ctos.cto_id': cto_id,
  }).lean()

  if (ponMap) {
    const olt = await OLT.findOne({ projeto_id, id: ponMap.olt_id }, 'id nome ip modelo').lean()
    return {
      pon:      ponMap.pon,
      olt_id:   ponMap.olt_id,
      olt_nome: olt?.nome ?? ponMap.olt_id,
      olt_ip:   olt?.ip   ?? null,
    }
  }

  // Strategy B: CDO/CE hierarchy
  if (cdo_id) {
    const cdo = await CaixaEmendaCDO.findOne({ projeto_id, ce_id: cdo_id }).lean()
    if (cdo?.olt_id) {
      const olt = await OLT.findOne({ projeto_id, id: cdo.olt_id }, 'id nome ip modelo').lean()
      if (olt) {
        return {
          pon:      null,
          olt_id:   olt.id,
          olt_nome: olt.nome,
          olt_ip:   olt.ip ?? null,
        }
      }
    }
  }

  return { pon: null, olt_id: null, olt_nome: null, olt_ip: null }
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function POST(request) {
  const session = await auth()
  const role    = session?.user?.role ?? 'user'

  if (!ALLOWED.includes(role)) {
    return Response.json({ error: 'Forbidden' }, { status: 403 })
  }

  const projeto_id = session.user.projeto_id

  let lat, lng
  try {
    const body = await request.json()
    lat = Number(body.lat)
    lng = Number(body.lng)
    if (isNaN(lat) || isNaN(lng)) throw new Error('invalid')
  } catch {
    return Response.json({ error: 'Body deve conter lat e lng numéricos' }, { status: 400 })
  }

  try {
    await connectDB()

    // ── Load all CTOs with coordinates ──────────────────────────────────────
    const ctos = await CTO.find(
      { projeto_id, lat: { $ne: null }, lng: { $ne: null } },
      'cto_id nome lat lng capacidade diagrama cdo_id'
    ).lean()

    if (ctos.length === 0) {
      return Response.json({ error: 'Nenhuma CTO encontrada no projeto' }, { status: 404 })
    }

    // ── Score every CTO ──────────────────────────────────────────────────────
    const scored = ctos.map(cto => {
      const dist                       = haversineMeters(lat, lng, cto.lat, cto.lng)
      const { livres, primeiraPortaLivre } = analyzeCtoPorts(cto)
      return { cto, dist, livres, primeiraPortaLivre }
    }).sort((a, b) => a.dist - b.dist)

    const withPorts = scored.filter(s => s.livres > 0)

    // ── Handle all-full edge case ─────────────────────────────────────────────
    if (withPorts.length === 0) {
      const nearest = scored[0]
      return Response.json({
        success:     false,
        reason:      'all_ctos_full',
        cto_id:      nearest.cto.cto_id,
        cto_nome:    nearest.cto.nome ?? nearest.cto.cto_id,
        cto_lat:     nearest.cto.lat,
        cto_lng:     nearest.cto.lng,
        distance:    nearest.dist,
        distance_fmt: fmtDist(nearest.dist),
        client_lat:  lat,
        client_lng:  lng,
        message:     'Todas as CTOs próximas estão sem portas livres',
      })
    }

    // ── Select best CTO ───────────────────────────────────────────────────────
    const best       = withPorts[0]
    const rx_estimate = estimateRx(best.dist)
    const sig         = signalQuality(rx_estimate)
    const diags       = signalDiag(rx_estimate, best.dist)

    // ── Resolve OLT/PON ───────────────────────────────────────────────────────
    const { pon, olt_id, olt_nome, olt_ip } = await resolveOltPon(
      projeto_id, best.cto.cto_id, best.cto.cdo_id ?? null
    )

    // ── Alternatives (next 3 closest with free ports) ─────────────────────────
    const alternatives = withPorts.slice(1, 4).map(s => ({
      cto_id:       s.cto.cto_id,
      nome:         s.cto.nome ?? s.cto.cto_id,
      distance:     s.dist,
      distance_fmt: fmtDist(s.dist),
      livres:       s.livres,
      rx_estimate:  estimateRx(s.dist),
      signal:       signalQuality(estimateRx(s.dist)),
    }))

    return Response.json({
      success:       true,
      cto_id:        best.cto.cto_id,
      cto_nome:      best.cto.nome ?? best.cto.cto_id,
      cto_lat:       best.cto.lat,
      cto_lng:       best.cto.lng,
      distance:      best.dist,
      distance_fmt:  fmtDist(best.dist),
      livres:        best.livres,
      port:          best.primeiraPortaLivre,
      estimated_rx:  rx_estimate,
      signal_quality: sig,
      diags,
      pon,
      olt_id,
      olt_nome,
      olt_ip,
      alternatives,
      client_lat:    lat,
      client_lng:    lng,
    })
  } catch (err) {
    console.error('[POST /api/simulation/install]', err.message)
    return Response.json({ error: err.message }, { status: 500 })
  }
}
