/**
 * src/lib/sgp-sync.js
 * Internal SGP sync logic — accepts a projeto_id directly (no session required).
 * Used by the cron job in instrumentation.js.
 * The public `syncSGP` server action in src/actions/sgp.js wraps this.
 */

import { connectDB } from '@/lib/db'
import { SGPConfig } from '@/models/SGPConfig'
import { ONU } from '@/models/ONU'
import { ProvisionEvent } from '@/models/ProvisionEvent'
import { decrypt } from '@/lib/aes-crypt'
import { authenticate, getClientes } from '@/lib/sgp-client'
import { nocLog } from '@/lib/noc-logger'

/**
 * Runs a full SGP sync for the given project.
 * Creates ProvisionEvents for new installs and cancellations.
 *
 * @param {string} projeto_id
 * @returns {Promise<{ novos: number, cancelamentos: number, erros: number }>}
 */
export async function syncSGP(projeto_id) {
  await connectDB()

  const sgp = await SGPConfig.findOne({ projeto_id })
  if (!sgp)            throw new Error('SGP não configurado para este projeto')
  if (!sgp.is_active)  throw new Error('Integração SGP está desativada')
  if (sgp.is_syncing)  return { novos: 0, cancelamentos: 0, erros: 0, message: 'Sincronização já em andamento' }

  await SGPConfig.updateOne({ projeto_id }, { $set: { is_syncing: true } })
  await nocLog(projeto_id, 'SGP', 'Sincronização automática iniciada (cron)', 'info')

  let novos         = 0
  let cancelamentos = 0
  let erros         = 0

  try {
    const password = decrypt(sgp.password_enc)
    const token    = await authenticate(sgp.host, sgp.username, password)
    const clientes = await getClientes(sgp.host, token)

    await nocLog(projeto_id, 'SYNC', `${clientes.length} clientes recebidos do SGP`, 'info')

    for (const cliente of clientes) {
      if (!cliente.serial) continue
      try {
        const serialNorm = cliente.serial.toUpperCase().trim()
        const onu        = await ONU.findOne({ projeto_id, serial: serialNorm }).lean()
        const isAtivo    = cliente.status === 'ativo'

        if (!onu && isAtivo) {
          await ProvisionEvent.create({
            projeto_id,
            tipo:    'install',
            status:  'pending',
            cliente: cliente.nome,
            serial:  serialNorm,
          })
          novos++
        } else if (onu && !isAtivo && onu.status !== 'cancelled') {
          await ProvisionEvent.create({
            projeto_id,
            tipo:    'cancel',
            status:  'pending',
            cliente: cliente.nome,
            serial:  serialNorm,
            olt_id:  onu.olt_id ?? null,
            cto_id:  onu.cto_id ?? null,
          })
          cancelamentos++
        }
      } catch (itemErr) {
        console.error('[SGP sync] Error processing cliente:', cliente.id, itemErr.message)
        erros++
      }
    }

    await nocLog(
      projeto_id,
      'SYNC',
      `Sync automático concluído: ${novos} novos, ${cancelamentos} cancelamentos, ${erros} erros`,
      erros > 0 ? 'warn' : 'success'
    )
  } catch (err) {
    console.error('[SGP sync] error:', err.message)
    await nocLog(projeto_id, 'SGP', `Erro na sincronização automática: ${err.message}`, 'error')
    erros++
  } finally {
    await SGPConfig.updateOne(
      { projeto_id },
      {
        $set: {
          is_syncing:      false,
          last_sync:       new Date(),
          last_sync_stats: { novos, cancelamentos, erros },
        },
      }
    )
  }

  return { novos, cancelamentos, erros }
}
