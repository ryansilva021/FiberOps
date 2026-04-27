'use client'

/**
 * AutoOSAlert — exibe banner de sugestão de OS coletiva quando PON_DOWN
 * impacta múltiplos clientes.
 * Monta sobre o useNOCSocket e sugere abertura de OS.
 */

import { useState, useEffect } from 'react'
import Link from 'next/link'

const FO = {
  card: '#F7F0E2', espresso: '#1A120D', orange: '#C45A2C',
  muted: '#7A5C46', border: 'rgba(196,140,100,0.22)',
}

const MIN_CLIENTS = 3  // threshold para sugerir OS coletiva

export default function AutoOSAlert({ event }) {
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => { setDismissed(false) }, [event?.id])

  if (!event || dismissed) return null
  if (event.type !== 'PON_DOWN' && event.type !== 'OLT_OVERLOAD') return null

  const clients = event.client_count ?? event.clients_impacted ?? 0
  if (clients < MIN_CLIENTS) return null

  const ponLabel = event.pon_id ? `PON ${event.pon_id}` : 'PON'
  const oltLabel = event.olt_name ?? event.olt_id ?? ''

  const osParams = new URLSearchParams({
    tipo:     'manutencao',
    descricao: `${ponLabel}${oltLabel ? ` OLT ${oltLabel}` : ''} caiu e impactou ${clients} clientes`,
    origem:   'noc_auto',
  })

  return (
    <div style={{
      position: 'fixed', bottom: 24, right: 24, zIndex: 100,
      maxWidth: 380, backgroundColor: FO.card,
      border: `1px solid ${FO.orange}55`,
      borderLeft: `4px solid ${FO.orange}`,
      borderRadius: 12, padding: '16px 18px',
      boxShadow: `0 8px 32px rgba(196,90,44,0.18)`,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
        <div>
          <p style={{ fontSize: 13, fontWeight: 800, color: FO.espresso, marginBottom: 4 }}>
            ⚡ Falha detectada — sugestão de OS coletiva
          </p>
          <p style={{ fontSize: 12, color: FO.muted, marginBottom: 12, lineHeight: 1.5 }}>
            <strong style={{ color: FO.espresso }}>{ponLabel}</strong>
            {oltLabel ? ` da OLT ${oltLabel}` : ''} caiu e impactou{' '}
            <strong style={{ color: '#dc2626' }}>{clients} clientes</strong>.
          </p>
          <Link
            href={`/admin/os/new?${osParams.toString()}`}
            style={{
              display: 'inline-block', padding: '7px 16px', borderRadius: 8,
              backgroundColor: FO.orange, color: '#fff',
              fontSize: 12, fontWeight: 700, textDecoration: 'none',
            }}
          >
            + Criar OS Coletiva
          </Link>
        </div>
        <button
          onClick={() => setDismissed(true)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: FO.muted, fontSize: 16, padding: 0, flexShrink: 0 }}
        >
          ✕
        </button>
      </div>
    </div>
  )
}
