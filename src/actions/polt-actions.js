'use server'

/**
 * src/actions/polt-actions.js
 *
 * Server Actions para interagir com a pOLT (OLT simulada / programável).
 * Cada action:
 *   1. Verifica autenticação (roles NOC)
 *   2. Chama a pOLT via POLTAdapter
 *   3. Registra o resultado no NOC feed (aparece em tempo real)
 *   4. Retorna { ok, data?, error? }
 */

import { requireActiveEmpresa } from '@/lib/tenant-guard'
import { nocLog }               from '@/lib/noc-logger'
import { POLTAdapter }          from '@/lib/polt-adapter'

const NOC_ALLOWED = ['superadmin', 'admin', 'noc']

// ─── Helper ───────────────────────────────────────────────────────────────────

function makeAdapter(poltUrl) {
  if (!poltUrl || !poltUrl.startsWith('http')) {
    throw new Error('URL da pOLT inválida. Use o formato: http://IP:3002')
  }
  return new POLTAdapter(poltUrl)
}

// ─── addOnuAction ─────────────────────────────────────────────────────────────

/**
 * Provisiona uma ONU via pOLT e loga no NOC.
 *
 * @param {object} form
 * @param {string} form.poltUrl            URL base da pOLT (ex: http://192.168.1.10:3002)
 * @param {number} form.channel_term
 * @param {number} form.onu_id
 * @param {string} form.serial_vendor_id
 * @param {string} form.serial_vendor_specific
 * @param {string} [form.flags]
 * @param {string} [form.management_state]
 * @param {string} [form.loid]
 * @param {string} [form.v_ani]
 */
export async function addOnuAction(form) {
  const session = await requireActiveEmpresa(NOC_ALLOWED)
  const { projeto_id } = session.user

  try {
    const adapter = makeAdapter(form.poltUrl)
    const data = await adapter.addOnu({
      channel_term:           Number(form.channel_term),
      onu_id:                 Number(form.onu_id),
      serial_vendor_id:       form.serial_vendor_id,
      serial_vendor_specific: form.serial_vendor_specific,
      flags:                  form.flags            || 'present+in_o5',
      management_state:       form.management_state || 'relying-on-vomci',
      loid:                   form.loid             || '',
      v_ani:                  form.v_ani            || '',
    })

    await nocLog(
      projeto_id,
      'pOLT',
      `[pOLT] ADDONU → ch=${form.channel_term} onu_id=${form.onu_id} ` +
      `serial=${form.serial_vendor_id}${form.serial_vendor_specific} ✓`,
      'success'
    )

    return { ok: true, data }
  } catch (err) {
    await nocLog(
      projeto_id,
      'pOLT',
      `[pOLT] ADDONU falhou: ${err.message}`,
      'error'
    )
    return { ok: false, error: err.message }
  }
}

// ─── removeOnuAction ──────────────────────────────────────────────────────────

/**
 * Remove uma ONU via pOLT e loga no NOC.
 */
export async function removeOnuAction(form) {
  const session = await requireActiveEmpresa(NOC_ALLOWED)
  const { projeto_id } = session.user

  try {
    const adapter = makeAdapter(form.poltUrl)
    const data = await adapter.removeOnu({
      channel_term:           Number(form.channel_term),
      onu_id:                 Number(form.onu_id),
      serial_vendor_id:       form.serial_vendor_id,
      serial_vendor_specific: form.serial_vendor_specific,
      flags:                  form.flags            || 'present+in_o5',
      management_state:       form.management_state || 'relying-on-vomci',
      loid:                   form.loid             || '',
      v_ani:                  form.v_ani            || '',
    })

    await nocLog(
      projeto_id,
      'pOLT',
      `[pOLT] REMOVEONU → ch=${form.channel_term} onu_id=${form.onu_id} ` +
      `serial=${form.serial_vendor_id}${form.serial_vendor_specific} ✓`,
      'warn'
    )

    return { ok: true, data }
  } catch (err) {
    await nocLog(
      projeto_id,
      'pOLT',
      `[pOLT] REMOVEONU falhou: ${err.message}`,
      'error'
    )
    return { ok: false, error: err.message }
  }
}

// ─── setRxModeAction ──────────────────────────────────────────────────────────

/**
 * Configura o modo RX da pOLT e loga no NOC.
 *
 * @param {object} form
 * @param {string} form.poltUrl
 * @param {string} form.mode         Ex: "onu_sim"
 * @param {string} form.onu_sim_ip
 * @param {number} form.onu_sim_port
 */
export async function setRxModeAction(form) {
  const session = await requireActiveEmpresa(NOC_ALLOWED)
  const { projeto_id } = session.user

  try {
    const adapter = makeAdapter(form.poltUrl)
    const data = await adapter.setRxMode({
      mode:         form.mode,
      onu_sim_ip:   form.onu_sim_ip,
      onu_sim_port: Number(form.onu_sim_port),
    })

    await nocLog(
      projeto_id,
      'pOLT',
      `[pOLT] RxMODE → mode=${form.mode} sim=${form.onu_sim_ip}:${form.onu_sim_port} ✓`,
      'info'
    )

    return { ok: true, data }
  } catch (err) {
    await nocLog(
      projeto_id,
      'pOLT',
      `[pOLT] RxMODE falhou: ${err.message}`,
      'error'
    )
    return { ok: false, error: err.message }
  }
}
