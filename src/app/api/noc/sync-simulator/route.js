/**
 * /api/noc/sync-simulator
 *
 * POST → Executa sincronização completa (importa/atualiza ONUs + gera NOCLog)
 * GET  → Retorna status rápido das OLTs do simulador (sem escrever no banco)
 *
 * Chamado pelo poll automático do NOCClient a cada 30s e pelo botão "Sync".
 */

import { auth }               from '@/lib/auth'
import { connectDB }          from '@/lib/db'
import { OLT }                from '@/models/OLT'
import { ONU }                from '@/models/ONU'
import { NOCLog }             from '@/models/NOCLog'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const NOC_ALLOWED = ['superadmin', 'admin', 'noc']

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

async function nocLog(projeto_id, tag, message, nivel = 'info') {
  try {
    await NOCLog.log(projeto_id, tag, message, nivel)
  } catch { /* silent */ }
}

// ── GET — quick status poll ──────────────────────────────────────────────────

export async function GET() {
  const session = await auth()
  const role    = session?.user?.role ?? 'user'
  if (!NOC_ALLOWED.includes(role)) return Response.json({ error: 'Forbidden' }, { status: 403 })

  const { projeto_id } = session.user
  await connectDB()

  const olts = await OLT.find({ projeto_id, rest_url: { $exists: true, $ne: null } }).lean()

  const results = await Promise.all(
    olts.map(async (olt) => {
      try {
        const res = await fetch(`${olt.rest_url}/api/status`, {
          signal: AbortSignal.timeout(4000),
          cache: 'no-store',
        })
        if (!res.ok) return { olt_id: olt.id, nome: olt.nome, status: 'unreachable' }
        const data = await res.json()
        return { olt_id: olt.id, nome: olt.nome, ...data }
      } catch {
        return { olt_id: olt.id, nome: olt.nome, status: 'unreachable' }
      }
    })
  )

  return Response.json({ olts: results, ts: new Date().toISOString() })
}

// ── POST — full sync ─────────────────────────────────────────────────────────

export async function POST() {
  const session = await auth()
  const role    = session?.user?.role ?? 'user'
  if (!NOC_ALLOWED.includes(role)) return Response.json({ error: 'Forbidden' }, { status: 403 })

  const { projeto_id } = session.user
  await connectDB()

  const olts = await OLT.find({ projeto_id, rest_url: { $exists: true, $ne: null } }).lean()

  let imported = 0
  let updated  = 0
  const errors = []

  for (const olt of olts) {
    let oltOnus
    try {
      const res = await fetch(`${olt.rest_url}/api/onus`, {
        signal: AbortSignal.timeout(6000),
        cache: 'no-store',
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      oltOnus = await res.json()
    } catch (err) {
      const msg = `[SYNC] Falha ao acessar ${olt.nome}: ${err.message}`
      errors.push(msg)
      await nocLog(projeto_id, 'SYNC', msg, 'error')
      continue
    }

    for (const o of oltOnus) {
      const serial        = String(o.serial).toUpperCase()
      const isUnprov      = o.status === 'unprovisioned'
      const status        = isUnprov ? 'provisioning' : (o.status === 'active' ? 'active' : 'offline')
      const signalQuality = calcSignalQuality(o.rxPower)
      const signalStatus  = calcSignalStatus(o.rxPower)

      const existing = await ONU.findOne({ projeto_id, serial }).lean()

      if (!existing) {
        await ONU.create({
          projeto_id,
          serial,
          status,
          olt_id:         olt.id,
          pon_port:       o.ponPort   ?? 0,
          pon:            `${o.ponSlot ?? 0}/${o.ponPort ?? 0}/${o.onuId ?? 0}`,
          onu_id_olt:     o.onuId     ?? 1,
          rx_power:       o.rxPower   ?? null,
          tx_power:       o.txPower   ?? null,
          signal_quality: signalQuality,
          signal_status:  signalStatus,
          provisioned_at: isUnprov ? null : new Date(o.provisionedAt ?? Date.now()),
          cliente:        o.loid      ?? null,
          obs:            o.model     ?? null,
        })
        imported++
        await nocLog(
          projeto_id, 'SYNC',
          `[SYNC] ONU importada: ${serial} — ${olt.nome} PON ${o.ponSlot ?? 0}/${o.ponPort ?? 0}`,
          'success'
        )
      } else {
        const prevStatus = existing.status
        if (prevStatus !== status) {
          await nocLog(
            projeto_id, 'SYNC',
            `[SYNC] ${serial}: status ${prevStatus} → ${status} | RX ${o.rxPower ?? '?'} dBm`,
            status === 'offline' ? 'warn' : 'info'
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

  if (imported > 0) {
    await nocLog(projeto_id, 'SYNC', `[SYNC] Sincronização concluída: ${imported} importadas, ${updated} atualizadas`, 'success')
  }

  return Response.json({ imported, updated, errors, ts: new Date().toISOString() })
}
