'use client'

import { useState, useCallback } from 'react'
import { useAlerts } from '@/hooks/useNetworkLab'
import { useNOCSocket, NOC_EVENT_META } from '@/hooks/useNOCSocket'

const FO = {
  bg: '#EDE3D2', card: '#F7F0E2', espresso: '#1A120D', orange: '#C45A2C',
  muted: '#7A5C46', border: 'rgba(196,140,100,0.22)', line: 'rgba(196,140,100,0.13)',
}

const SEVERITY_META = {
  critical: { label: 'Crítico', bg: '#fee2e2', color: '#991b1b', border: '#dc262633' },
  warning:  { label: 'Aviso',   bg: '#fef3c7', color: '#92400e', border: '#f59e0b33' },
  info:     { label: 'Info',    bg: '#dbeafe', color: '#1e40af', border: '#3b82f633' },
}

const TYPE_FILTERS = [
  { value: '', label: 'Todos os tipos' },
  { value: 'ONU_OFFLINE',  label: 'ONU Offline'     },
  { value: 'PON_DOWN',     label: 'PON Down'         },
  { value: 'LOW_POWER',    label: 'Potência Baixa'   },
  { value: 'HIGH_POWER',   label: 'Potência Alta'    },
  { value: 'LOS',          label: 'Perda de Sinal'   },
  { value: 'OLT_OVERLOAD', label: 'Sobrecarga OLT'   },
]

function AlertCard({ alert, onAck }) {
  const meta    = NOC_EVENT_META[alert.type] ?? { label: alert.type, color: '#6b7280', severity: 'info' }
  const sevMeta = SEVERITY_META[meta.severity] ?? SEVERITY_META.info
  const acked   = alert.acknowledged || alert.status === 'acknowledged'

  return (
    <div style={{
      backgroundColor: acked ? '#f9f9f9' : FO.card,
      border: `1px solid ${sevMeta.border}`,
      borderLeft: `4px solid ${acked ? FO.muted : meta.color}`,
      borderRadius: 10, padding: '14px 18px', marginBottom: 10,
      opacity: acked ? 0.6 : 1,
      transition: 'opacity 0.3s',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Tipo + severity */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 12, fontWeight: 800, color: acked ? FO.muted : meta.color }}>
              {meta.label}
            </span>
            <span style={{
              fontSize: 9, fontWeight: 700, padding: '2px 7px', borderRadius: 99,
              backgroundColor: sevMeta.bg, color: sevMeta.color,
            }}>
              {sevMeta.label.toUpperCase()}
            </span>
            {acked && (
              <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 7px', borderRadius: 99, backgroundColor: '#dcfce7', color: '#166534' }}>
                RECONHECIDO
              </span>
            )}
          </div>

          {/* Mensagem */}
          <p style={{ fontSize: 13, color: FO.espresso, marginBottom: 6 }}>
            {alert.message ?? alert.description ?? '—'}
          </p>

          {/* Detalhes */}
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            {alert.olt_name && <span style={{ fontSize: 11, color: FO.muted }}>OLT: {alert.olt_name}</span>}
            {alert.onu_sn   && <span style={{ fontSize: 11, color: FO.muted }}>ONU: {alert.onu_sn}</span>}
            {alert.client   && <span style={{ fontSize: 11, color: FO.muted }}>Cliente: {alert.client}</span>}
            {alert.pon_id   && <span style={{ fontSize: 11, color: FO.muted }}>PON: {alert.pon_id}</span>}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8, flexShrink: 0 }}>
          <span style={{ fontSize: 10, color: FO.muted, whiteSpace: 'nowrap' }}>
            {new Date(alert.ts ?? alert.created_at ?? Date.now()).toLocaleString('pt-BR')}
          </span>
          {!acked && (
            <button
              onClick={() => onAck(alert.id ?? alert._id)}
              style={{
                padding: '5px 12px', fontSize: 11, fontWeight: 700, cursor: 'pointer',
                border: `1px solid ${FO.border}`, borderRadius: 6,
                backgroundColor: FO.bg, color: FO.muted,
              }}
            >
              ✓ Reconhecer
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

function HistoryRow({ event }) {
  const meta = NOC_EVENT_META[event.type] ?? { label: event.type, color: '#6b7280' }
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12, padding: '8px 16px',
      borderBottom: `1px solid ${FO.line}`,
    }}>
      <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: meta.color, flexShrink: 0 }} />
      <span style={{ fontSize: 11, fontWeight: 700, color: meta.color, minWidth: 110 }}>{meta.label}</span>
      <span style={{ fontSize: 11, color: FO.espresso, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {event.message ?? event.olt_name ?? event.onu_sn ?? '—'}
      </span>
      <span style={{ fontSize: 10, color: FO.muted, flexShrink: 0, whiteSpace: 'nowrap' }}>
        {new Date(event.ts ?? Date.now()).toLocaleTimeString('pt-BR')}
      </span>
    </div>
  )
}

export default function AlertsView() {
  const [typeFilter,     setTypeFilter]     = useState('')
  const [severityFilter, setSeverityFilter] = useState('')
  const [showAcked,      setShowAcked]      = useState(false)
  const [tab,            setTab]            = useState('active')

  const { data: alertsData, loading, error, refresh } = useAlerts(
    { type: typeFilter || undefined, status: showAcked ? undefined : 'active' },
    10_000
  )

  const { events: realtimeEvents, connected, clearEvents, acknowledgeEvent } = useNOCSocket()

  const alertList = alertsData?.data ?? alertsData ?? []

  const handleAck = useCallback(async (id) => {
    try {
      await fetch(`/api/noc/network-lab/alerts/${id}/acknowledge`, { method: 'POST' })
      acknowledgeEvent(id)
      refresh()
    } catch (e) {
      console.error(e)
    }
  }, [acknowledgeEvent, refresh])

  const filtered = alertList.filter(a => {
    if (typeFilter && a.type !== typeFilter) return false
    if (severityFilter) {
      const meta = NOC_EVENT_META[a.type]
      if (meta?.severity !== severityFilter) return false
    }
    return true
  })

  const criticalCount = alertList.filter(a => NOC_EVENT_META[a.type]?.severity === 'critical').length
  const warningCount  = alertList.filter(a => NOC_EVENT_META[a.type]?.severity === 'warning').length

  return (
    <div style={{ padding: 24, maxWidth: 1200, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 800, color: FO.espresso, margin: 0 }}>Central de Alarmes</h1>
          <div style={{ display: 'flex', gap: 12, marginTop: 6 }}>
            {criticalCount > 0 && (
              <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 99, backgroundColor: '#fee2e2', color: '#991b1b' }}>
                {criticalCount} Crítico{criticalCount > 1 ? 's' : ''}
              </span>
            )}
            {warningCount > 0 && (
              <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 99, backgroundColor: '#fef3c7', color: '#92400e' }}>
                {warningCount} Aviso{warningCount > 1 ? 's' : ''}
              </span>
            )}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          {/* Live status */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 99,
            backgroundColor: connected ? '#dcfce7' : '#fee2e2',
            border: `1px solid ${connected ? '#16a34a44' : '#dc262644'}`,
          }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: connected ? '#22c55e' : '#dc2626', boxShadow: connected ? '0 0 5px #22c55e' : 'none' }} />
            <span style={{ fontSize: 10, fontWeight: 700, color: connected ? '#166534' : '#991b1b' }}>
              {connected ? 'Live' : 'Offline'}
            </span>
          </div>
          <button onClick={refresh} style={{ padding: '6px 12px', fontSize: 12, cursor: 'pointer', border: `1px solid ${FO.border}`, borderRadius: 8, backgroundColor: FO.card, color: FO.muted }}>↻</button>
        </div>
      </div>

      {/* Filtros */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
        <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} style={{
          padding: '7px 10px', fontSize: 12, borderRadius: 8, border: `1px solid ${FO.border}`, backgroundColor: FO.card, color: FO.espresso, outline: 'none',
        }}>
          {TYPE_FILTERS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
        </select>

        <select value={severityFilter} onChange={e => setSeverityFilter(e.target.value)} style={{
          padding: '7px 10px', fontSize: 12, borderRadius: 8, border: `1px solid ${FO.border}`, backgroundColor: FO.card, color: FO.espresso, outline: 'none',
        }}>
          <option value="">Todos os níveis</option>
          <option value="critical">Crítico</option>
          <option value="warning">Aviso</option>
          <option value="info">Info</option>
        </select>

        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: FO.muted, cursor: 'pointer' }}>
          <input type="checkbox" checked={showAcked} onChange={e => setShowAcked(e.target.checked)} />
          Mostrar reconhecidos
        </label>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20, borderBottom: `1px solid ${FO.border}` }}>
        {[
          { key: 'active',   label: `Ativos (${filtered.length})` },
          { key: 'realtime', label: `Tempo Real (${realtimeEvents.length})` },
        ].map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{
            padding: '8px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer',
            border: 'none', borderBottom: `2px solid ${tab === t.key ? FO.orange : 'transparent'}`,
            backgroundColor: 'transparent', color: tab === t.key ? FO.orange : FO.muted,
            marginBottom: -1,
          }}>
            {t.label}
          </button>
        ))}
      </div>

      {error && (
        <div style={{ padding: '12px 16px', borderRadius: 8, backgroundColor: '#fee2e2', color: '#991b1b', fontSize: 13, marginBottom: 16 }}>
          Erro ao conectar ao network-lab: {error}
        </div>
      )}

      {/* Tab: Ativos */}
      {tab === 'active' && (
        loading && alertList.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 60, color: FO.muted }}>Carregando alertas…</div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 60 }}>
            <p style={{ fontSize: 32, marginBottom: 8 }}>✓</p>
            <p style={{ fontSize: 14, color: '#166534', fontWeight: 600 }}>Nenhum alerta ativo</p>
            <p style={{ fontSize: 12, color: FO.muted }}>A rede está operando normalmente</p>
          </div>
        ) : (
          filtered.map((a, i) => <AlertCard key={a.id ?? a._id ?? i} alert={a} onAck={handleAck} />)
        )
      )}

      {/* Tab: Real-time */}
      {tab === 'realtime' && (
        <div style={{ backgroundColor: FO.card, border: `1px solid ${FO.border}`, borderRadius: 12, overflow: 'hidden' }}>
          <div style={{ padding: '12px 16px', borderBottom: `1px solid ${FO.line}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <p style={{ fontSize: 13, fontWeight: 700, color: FO.espresso, margin: 0 }}>
              Eventos WebSocket
              {connected && <span style={{ display: 'inline-block', marginLeft: 8, width: 6, height: 6, borderRadius: '50%', backgroundColor: '#22c55e', boxShadow: '0 0 5px #22c55e' }} />}
            </p>
            <button onClick={clearEvents} style={{ fontSize: 11, color: FO.muted, background: 'none', border: 'none', cursor: 'pointer' }}>Limpar</button>
          </div>
          {realtimeEvents.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: FO.muted, fontSize: 13 }}>
              {connected ? 'Aguardando eventos…' : 'WebSocket desconectado'}
            </div>
          ) : (
            realtimeEvents.map(e => <HistoryRow key={e.id} event={e} />)
          )}
        </div>
      )}
    </div>
  )
}
