/**
 * src/actions/sim-sync.js
 * Sincroniza ONUs e status em tempo real com o simulador provedor-virtual.
 *
 * Cada OLT com rest_url configurado é consultada via REST API do simulador.
 * ONUs ausentes são criadas; existentes têm sinal e status atualizados.
 * Mudanças de status geram entradas no NOCLog → aparecem no terminal SSE.
 */

'use server'

import { revalidatePath }      from 'next/cache'
import { connectDB }           from '@/lib/db'
import { requireActiveEmpresa } from '@/lib/tenant-guard'
import { OLT }                 from '@/models/OLT'
import { ONU }                 from '@/models/ONU'
import { nocLog }              from '@/lib/noc-logger'

const NOC_ALLOWED = ['superadmin', 'admin', 'noc']

// ─── helpers ──────────────────────────────────────────────────────────────────

function calcSignalQuality(rx) {
  if (rx == null) return null
  if (rx > -20)  return 'excelente'
  if (rx >= -25) return 'bom'
  if (rx >= -28) return 'medio'
  return 'critico'
}

function calcSignalStatus(rx) {
  if (rx == null) return null
  if (rx > -20)  return 'Sinal excelente'
  if (rx >= -25) return 'Sinal bom'
  if (rx >= -28) return 'Sinal no limite operacional'
  return 'Sinal crítico — risco de queda'
}

// ─── syncFromSimulator ────────────────────────────────────────────────────────

/**
 * Importa/atualiza ONUs de todas as OLTs do projeto que possuem rest_url.
 * Retorna { imported, updated, errors }.
 */
export async function syncFromSimulator() {
  const session    = await requireActiveEmpresa(NOC_ALLOWED)
  const { projeto_id } = session.user

  await connectDB()

  const olts = await OLT.find({ projeto_id, rest_url: { $exists: true, $nin: [null, ''] } }).lean()

  let imported = 0
  let updated  = 0
  const errors = []

  for (const olt of olts) {
    const restUrl = olt.rest_url
    let oltOnus

    // ── Fetch ONUs from OLT REST API ──────────────────────────────────────
    try {
      const res = await fetch(`${restUrl}/api/onus`, {
        signal: AbortSignal.timeout(6000),
        cache: 'no-store',
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      oltOnus = await res.json()
    } catch (err) {
      const msg = `[SYNC] Falha ao acessar REST ${olt.nome}: ${err.message}`
      errors.push(msg)
      await nocLog(projeto_id, 'SYNC', msg, 'error')
      continue
    }

    // ── Upsert each ONU ───────────────────────────────────────────────────
    for (const o of oltOnus) {
      const isUnprovisioned = o.status === 'unprovisioned'
      const serial          = String(o.serial).toUpperCase()
      const status          = isUnprovisioned ? 'provisioning' : (o.status === 'active' ? 'active' : 'offline')
      const signalQuality   = calcSignalQuality(o.rxPower)
      const signalStatus    = calcSignalStatus(o.rxPower)

      const existing = await ONU.findOne({ projeto_id, serial }).lean()

      if (!existing) {
        await ONU.create({
          projeto_id,
          serial,
          status,
          olt_id:         olt.id,
          pon_port:       o.ponPort  ?? 0,
          pon:            `${o.ponSlot ?? 0}/${o.ponPort ?? 0}/${o.onuId ?? 0}`,
          onu_id_olt:     o.onuId    ?? 1,
          rx_power:       o.rxPower  ?? null,
          tx_power:       o.txPower  ?? null,
          signal_quality: signalQuality,
          signal_status:  signalStatus,
          provisioned_at: isUnprovisioned ? null : new Date(o.provisionedAt ?? Date.now()),
          cliente:        o.loid     ?? null,
          obs:            o.model    ?? null,
        })
        imported++
        await nocLog(
          projeto_id, 'SYNC',
          `[SYNC] ONU importada do simulador: ${serial} (${olt.nome} PON ${o.ponSlot}/${o.ponPort})`,
          'success'
        )
      } else {
        // Detect status change
        if (existing.status !== status) {
          const nivel = status === 'offline' ? 'warn' : 'info'
          await nocLog(
            projeto_id, 'SYNC',
            `[SYNC] ONU ${serial}: ${existing.status} → ${status} (RX: ${o.rxPower ?? '?'} dBm)`,
            nivel
          )
          updated++
        }

        await ONU.updateOne(
          { projeto_id, serial },
          {
            $set: {
              status,
              rx_power:       o.rxPower  ?? existing.rx_power,
              tx_power:       o.txPower  ?? existing.tx_power,
              signal_quality: signalQuality,
              signal_status:  signalStatus,
              olt_id:         olt.id,
            },
          }
        )
      }
    }
  }

  if (imported > 0 || updated > 0) {
    revalidatePath('/admin/noc')
  }

  return { imported, updated, errors }
}

// ─── getSimulatorStatus ───────────────────────────────────────────────────────

/**
 * Retorna o status atual do simulador (sem escrever no banco).
 * Usado pelo poll automático para comparação rápida.
 */
export async function getSimulatorStatus() {
  const session    = await requireActiveEmpresa(NOC_ALLOWED)
  const { projeto_id } = session.user

  await connectDB()

  const olts = await OLT.find({ projeto_id, rest_url: { $exists: true, $nin: [null, ''] } }).lean()

  const result = []
  for (const olt of olts) {
    try {
      const res = await fetch(`${olt.rest_url}/api/status`, {
        signal: AbortSignal.timeout(4000),
        cache: 'no-store',
      })
      if (!res.ok) continue
      const data = await res.json()
      result.push({ olt_id: olt.id, nome: olt.nome, ...data })
    } catch {
      result.push({ olt_id: olt.id, nome: olt.nome, status: 'unreachable' })
    }
  }

  return result
}
