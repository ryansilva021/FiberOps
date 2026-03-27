'use server'

/**
 * src/actions/pon-cto-map.js
 *
 * Server actions for managing PON→CTO mappings and automatic CTO assignment.
 *
 * Exported actions (callable from client components):
 *   - getPonCtoMaps()                         list all maps for current project
 *   - getCtoSuggestionsForPon(olt_id, pon)     preview which CTO will be chosen
 *   - savePonCtoMap({ olt_id, pon, ctos })     upsert a mapping
 *   - deletePonCtoMap({ olt_id, pon })         remove a mapping
 *
 * Exported utility (callable from other server-side modules):
 *   - assignCtoAutomatically(params)           select + allocate the best CTO port
 */

import { connectDB }          from '@/lib/db'
import { requireActiveEmpresa } from '@/lib/tenant-guard'
import { PonCtoMap }          from '@/models/PonCtoMap'
import { CTO }                from '@/models/CTO'

const NOC_ALLOWED = ['superadmin', 'admin', 'noc']

// ─── getPonCtoMaps ────────────────────────────────────────────────────────────

/**
 * Returns all PON→CTO mappings for the current project, enriched with CTO names.
 */
export async function getPonCtoMaps() {
  const session = await requireActiveEmpresa(NOC_ALLOWED)
  const { projeto_id } = session.user

  await connectDB()

  const maps = await PonCtoMap.find({ projeto_id }).sort({ olt_id: 1, pon: 1 }).lean()

  // Collect all cto_ids to resolve names in one query
  const allIds = [...new Set(maps.flatMap(m => m.ctos.map(c => c.cto_id)))]
  const ctos   = await CTO.find({ projeto_id, cto_id: { $in: allIds } }, 'cto_id nome capacidade diagrama').lean()
  const ctoLookup = new Map(ctos.map(c => [c.cto_id, c]))

  return maps.map(m => ({
    _id:    m._id.toString(),
    olt_id: m.olt_id,
    pon:    m.pon,
    ctos:   m.ctos
      .sort((a, b) => a.ordem - b.ordem)
      .map(entry => {
        const cto   = ctoLookup.get(entry.cto_id)
        const livres = _countLivres(cto)
        return {
          cto_id: entry.cto_id,
          nome:   cto?.nome ?? entry.cto_id,
          ordem:  entry.ordem,
          livres,
        }
      }),
  }))
}

// ─── getCtoSuggestionsForPon ──────────────────────────────────────────────────

/**
 * Returns the PON mapping + availability info for a specific PON.
 * Called from ProvisionModal to preview automatic CTO assignment.
 *
 * @param {{ olt_id: string, pon: string, rx_power?: number }} params
 */
export async function getCtoSuggestionsForPon({ olt_id, pon, rx_power }) {
  const session = await requireActiveEmpresa(NOC_ALLOWED)
  const { projeto_id } = session.user

  await connectDB()

  const map = await PonCtoMap.findOne({ projeto_id, olt_id, pon }).lean()
  if (!map || map.ctos.length === 0) {
    return { mapped: false, suggestions: [], auto_reason: 'no_map' }
  }

  const ordered = [...map.ctos].sort((a, b) => a.ordem - b.ordem)
  const ctoIds  = ordered.map(c => c.cto_id)
  const ctos    = await CTO.find({ projeto_id, cto_id: { $in: ctoIds } }, 'cto_id nome capacidade diagrama').lean()
  const ctoMap  = new Map(ctos.map(c => [c.cto_id, c]))

  const suggestions = ordered.map(entry => {
    const cto    = ctoMap.get(entry.cto_id)
    const livres = _countLivres(cto)
    return {
      cto_id:   entry.cto_id,
      nome:     cto?.nome ?? entry.cto_id,
      ordem:    entry.ordem,
      livres,
      available: livres > 0,
    }
  })

  // Which CTO would be auto-selected?
  const available = suggestions.filter(s => s.available)
  let selectedIdx = 0
  let auto_reason = 'first_available'

  if (rx_power != null && available.length > 1) {
    const n   = available.length
    const idx = _rxToIndex(rx_power, n)
    selectedIdx = idx
    auto_reason = 'signal_based'
  }

  const selectedCto = available[selectedIdx] ?? null

  return {
    mapped:       true,
    suggestions,
    selected_cto: selectedCto,
    auto_reason,
  }
}

// ─── savePonCtoMap ────────────────────────────────────────────────────────────

/**
 * Creates or replaces the CTO list for a given (olt_id, pon) pair.
 *
 * @param {{ olt_id: string, pon: string, ctos: Array<{ cto_id: string, ordem: number }> }} params
 */
export async function savePonCtoMap({ olt_id, pon, ctos }) {
  const session = await requireActiveEmpresa(NOC_ALLOWED)
  const { projeto_id } = session.user

  if (!olt_id?.trim()) throw new Error('olt_id obrigatório')
  if (!pon?.trim())    throw new Error('pon obrigatório')
  if (!Array.isArray(ctos) || ctos.length === 0) throw new Error('Pelo menos uma CTO é necessária')

  await connectDB()

  const normalizedCtos = ctos.map((c, i) => ({
    cto_id: c.cto_id.trim(),
    ordem:  c.ordem ?? i,
  }))

  await PonCtoMap.findOneAndUpdate(
    { projeto_id, olt_id: olt_id.trim(), pon: pon.trim() },
    { $set: { ctos: normalizedCtos } },
    { upsert: true, new: true }
  )

  return { success: true }
}

// ─── deletePonCtoMap ──────────────────────────────────────────────────────────

/**
 * Removes a PON→CTO mapping by (olt_id, pon).
 */
export async function deletePonCtoMap({ olt_id, pon }) {
  const session = await requireActiveEmpresa(NOC_ALLOWED)
  const { projeto_id } = session.user

  await connectDB()

  await PonCtoMap.deleteOne({ projeto_id, olt_id, pon })

  return { success: true }
}

// ─── assignCtoAutomatically ───────────────────────────────────────────────────

/**
 * Core auto-assignment logic. Called internally from provisioning actions.
 *
 * Strategy:
 *   1. Look up PON→CTO mapping for the given OLT + PON
 *   2. Filter only CTOs with free ports
 *   3. If rx_power is known, pick the CTO at the matching distance index
 *      (high RX → near OLT → first CTOs; low RX → far → last CTOs)
 *   4. Allocate the first free port in the selected CTO
 *
 * @param {{ projeto_id: string, olt_id: string, pon: string, rx_power?: number }} params
 * @returns {{ success: boolean, cto?, splitterIdx?, saidaIdx?, reason: string, suggestions?: string[] }}
 */
export async function assignCtoAutomatically({ projeto_id, olt_id, pon, rx_power }) {
  await connectDB()

  // ── Step 1: Find mapping ──────────────────────────────────────────────────
  const map = await PonCtoMap.findOne({ projeto_id, olt_id, pon }).lean()

  if (!map || map.ctos.length === 0) {
    return { success: false, reason: 'no_map', suggestions: [] }
  }

  // ── Step 2: Order + resolve CTOs ─────────────────────────────────────────
  const ordered = [...map.ctos].sort((a, b) => a.ordem - b.ordem)
  const ctoIds  = ordered.map(c => c.cto_id)

  const ctos    = await CTO.find({ projeto_id, cto_id: { $in: ctoIds } }).lean()
  const ctoMap  = new Map(ctos.map(c => [c.cto_id, c]))

  // ── Step 3: Filter available CTOs (with free splitter ports) ─────────────
  const available = []
  for (const entry of ordered) {
    const cto = ctoMap.get(entry.cto_id)
    if (!cto) continue

    const freePort = _findFreePort(cto)
    if (freePort) {
      available.push({ cto, ...freePort, ordem: entry.ordem ?? 0 })
    }
  }

  if (available.length === 0) {
    return {
      success:     false,
      reason:      'all_full',
      suggestions: ctoIds,
    }
  }

  // ── Step 4: Select CTO by RX power (distance estimation) ─────────────────
  let selected    = available[0]
  let selectReason = 'first_available'

  if (rx_power != null && available.length > 1) {
    const idx = _rxToIndex(rx_power, available.length)
    selected    = available[idx]
    selectReason = 'signal_based'
  }

  return {
    success:      true,
    cto:          selected.cto,
    splitterIdx:  selected.splitterIdx,
    saidaIdx:     selected.saidaIdx,
    reason:       selectReason,
    cto_id:       selected.cto.cto_id,
  }
}

// ─── Private helpers ──────────────────────────────────────────────────────────

/**
 * Maps an RX power reading to an index in an ordered list of CTOs.
 * Higher RX (less attenuation) → closer to OLT → lower index.
 *
 * Reference range: -18 dBm (closest) … -30 dBm (farthest)
 *
 * @param {number} rx     RX power in dBm (negative number)
 * @param {number} n      Number of available CTOs
 * @returns {number}      Index 0..n-1
 */
function _rxToIndex(rx, n) {
  if (n <= 1) return 0
  const MIN_RX   = -18   // closest to OLT
  const MAX_RX   = -30   // farthest from OLT
  const norm     = (rx - MIN_RX) / (MAX_RX - MIN_RX)   // 0 = near, 1 = far
  const clamped  = Math.max(0, Math.min(1, norm))
  return Math.round(clamped * (n - 1))
}

/**
 * Finds the first free splitter port in a CTO.
 * Returns { splitterIdx, saidaIdx } or null if all full.
 *
 * @param {object} cto   Lean CTO document
 */
function _findFreePort(cto) {
  const splitters = cto.diagrama?.splitters ?? []
  for (let si = 0; si < splitters.length; si++) {
    const saidas = splitters[si].saidas ?? []
    for (let pi = 0; pi < saidas.length; pi++) {
      if (!saidas[pi]?.cliente?.trim()) {
        return { splitterIdx: si, saidaIdx: pi }
      }
    }
  }
  return null
}

/**
 * Counts free ports across all splitters in a CTO.
 *
 * @param {object|null} cto
 */
function _countLivres(cto) {
  if (!cto) return 0
  const splitters = cto.diagrama?.splitters ?? []
  let count = 0
  for (const s of splitters) {
    for (const saida of (s.saidas ?? [])) {
      if (!saida?.cliente?.trim()) count++
    }
  }
  return count || (cto.capacidade ?? 0)
}
