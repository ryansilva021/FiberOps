'use client'

import { useState, useCallback } from 'react'
import Link from 'next/link'
import { usePONs } from '@/hooks/useNetworkLab'
import { useNOCSocket } from '@/hooks/useNOCSocket'

const FO = {
  bg: '#EDE3D2', card: '#F7F0E2', espresso: '#1A120D', orange: '#C45A2C',
  muted: '#7A5C46', border: 'rgba(196,140,100,0.22)', line: 'rgba(196,140,100,0.13)',
}

function PONRow({ pon }) {
  const down = pon.status === 'down' || pon.status === 'offline'
  const warn = pon.status === 'degraded' || pon.status === 'warning'

  const badgeBg    = down ? '#fee2e2' : warn ? '#fef3c7' : '#dcfce7'
  const badgeColor = down ? '#991b1b' : warn ? '#92400e' : '#166534'
  const borderColor = down ? '#dc2626' : warn ? '#f59e0b' : '#22c55e'
  const label      = down ? 'Down' : warn ? 'Degradada' : 'Online'

  const impacted = pon.client_count ?? pon.onu_count ?? 0

  return (
    <div style={{
      backgroundColor: FO.card,
      border: `1px solid ${FO.border}`,
      borderLeft: `4px solid ${borderColor}`,
      borderRadius: 10, padding: 16, marginBottom: 10,
    }}>
      {down && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          backgroundColor: '#fee2e2', border: '1px solid #dc262633',
          borderRadius: 6, padding: '6px 12px', marginBottom: 12,
        }}>
          <span style={{ fontSize: 14 }}>🔴</span>
          <span style={{ fontSize: 12, fontWeight: 700, color: '#991b1b' }}>
            PON Down — {impacted} cliente{impacted !== 1 ? 's' : ''} impactado{impacted !== 1 ? 's' : ''}
          </span>
          {impacted >= 5 && (
            <Link
              href="/admin/os/new"
              style={{ marginLeft: 'auto', fontSize: 11, fontWeight: 700, color: FO.orange, textDecoration: 'none' }}
            >
              + Criar OS Coletiva →
            </Link>
          )}
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h3 style={{ fontSize: 14, fontWeight: 800, color: FO.espresso, margin: 0 }}>
            {pon.name ?? `PON ${pon.port}`}
          </h3>
          <p style={{ fontSize: 11, color: FO.muted, margin: '3px 0 0' }}>
            OLT: {pon.olt_name ?? pon.olt_id ?? '—'} · Porta: {pon.port ?? '—'}
          </p>
        </div>
        <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 9px', borderRadius: 99, backgroundColor: badgeBg, color: badgeColor }}>
          {label}
        </span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginTop: 12 }}>
        {[
          { label: 'ONUs',      value: pon.onu_count     ?? '—' },
          { label: 'CTOs',      value: pon.cto_count     ?? '—' },
          { label: 'Clientes',  value: pon.client_count  ?? '—' },
          { label: 'Vel. Down', value: pon.bandwidth_down ?? pon.speed ?? '—' },
        ].map(m => (
          <div key={m.label}>
            <p style={{ fontSize: 9, fontWeight: 700, color: FO.muted, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 2 }}>{m.label}</p>
            <p style={{ fontSize: 13, fontWeight: 700, color: FO.espresso }}>{m.value}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function PONsView() {
  const [filter, setFilter] = useState('all')
  const [search, setSearch] = useState('')
  const { data, loading, error, refresh } = usePONs({}, 10_000)
  const handleWsEvent = useCallback((e) => {
    if (['PON_DOWN', 'ONU_OFFLINE', 'LOS'].includes(e.type)) refresh()
  }, [refresh])
  useNOCSocket({ onEvent: handleWsEvent })

  const ponList = data?.data ?? data ?? []
  const downPONs = ponList.filter(p => p.status === 'down' || p.status === 'offline')

  const filtered = ponList.filter(pon => {
    if (filter === 'down'    && pon.status !== 'down' && pon.status !== 'offline')  return false
    if (filter === 'online'  && (pon.status === 'down' || pon.status === 'offline')) return false
    if (search) {
      const q = search.toLowerCase()
      return (pon.name ?? '').toLowerCase().includes(q) || (pon.olt_name ?? '').toLowerCase().includes(q)
    }
    return true
  })

  return (
    <div style={{ padding: 24, maxWidth: 1200, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 800, color: FO.espresso, margin: 0 }}>Portas PON</h1>
          <p style={{ fontSize: 12, color: FO.muted, margin: '3px 0 0' }}>
            {ponList.length} portas · {downPONs.length} down
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Buscar PON / OLT…"
            style={{ padding: '7px 12px', fontSize: 12, borderRadius: 8, border: `1px solid ${FO.border}`, backgroundColor: FO.card, color: FO.espresso, outline: 'none', width: 180 }}
          />
          {['all', 'down', 'online'].map(f => (
            <button key={f} onClick={() => setFilter(f)} style={{
              padding: '6px 14px', fontSize: 11, fontWeight: 700, cursor: 'pointer', borderRadius: 99,
              border: `1px solid ${filter === f ? FO.orange : FO.border}`,
              backgroundColor: filter === f ? FO.orange : FO.card,
              color: filter === f ? '#fff' : FO.muted,
            }}>
              {f === 'all' ? 'Todas' : f === 'down' ? '🔴 Down' : 'Online'}
            </button>
          ))}
          <button onClick={refresh} style={{ padding: '6px 12px', fontSize: 12, cursor: 'pointer', border: `1px solid ${FO.border}`, borderRadius: 8, backgroundColor: FO.card, color: FO.muted }}>↻</button>
        </div>
      </div>

      {/* Alerta global se há PONs down */}
      {downPONs.length > 0 && (
        <div style={{
          padding: '12px 16px', marginBottom: 20, borderRadius: 8,
          backgroundColor: '#fee2e2', border: '1px solid #dc262633',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: '#991b1b' }}>
            ⚠️ {downPONs.length} PON{downPONs.length > 1 ? 's' : ''} com falha detectada
          </span>
          <Link href="/admin/noc/alertas" style={{ fontSize: 12, color: FO.orange, textDecoration: 'none', fontWeight: 600 }}>Ver alertas →</Link>
        </div>
      )}

      {error && (
        <div style={{ padding: '12px 16px', borderRadius: 8, backgroundColor: '#fee2e2', color: '#991b1b', fontSize: 13, marginBottom: 20 }}>
          Erro ao conectar ao network-lab: {error}
        </div>
      )}

      {loading && ponList.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 60, color: FO.muted }}>Carregando PONs…</div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 60, color: FO.muted }}>Nenhuma porta PON encontrada</div>
      ) : (
        filtered.map(pon => <PONRow key={pon.id ?? pon._id ?? pon.port} pon={pon} />)
      )}
    </div>
  )
}
