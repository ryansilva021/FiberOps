'use client'

import { useState, useCallback } from 'react'
import Link from 'next/link'
import { useDashboardSummary, useAlerts } from '@/hooks/useNetworkLab'
import { useNOCSocket, NOC_EVENT_META } from '@/hooks/useNOCSocket'
import AutoOSAlert from '@/components/noc/AutoOSAlert'

// ── FO palette ────────────────────────────────────────────────────────────────
const FO = {
  bg:         '#EDE3D2',
  card:       '#F7F0E2',
  espresso:   '#1A120D',
  orange:     '#C45A2C',
  orangeSoft: '#E88A5A',
  muted:      '#7A5C46',
  border:     'rgba(196,140,100,0.22)',
  line:       'rgba(196,140,100,0.13)',
}

// ── KPI Card ──────────────────────────────────────────────────────────────────
function KPICard({ label, value, sub, color, icon, loading, href }) {
  const inner = (
    <div style={{
      backgroundColor: FO.card,
      border: `1px solid ${FO.border}`,
      borderRadius: 12,
      padding: '18px 20px',
      borderLeft: `4px solid ${color}`,
      transition: 'box-shadow 0.15s',
      height: '100%',
      cursor: href ? 'pointer' : 'default',
    }}
      onMouseEnter={e => href && (e.currentTarget.style.boxShadow = `0 4px 16px ${color}22`)}
      onMouseLeave={e => href && (e.currentTarget.style.boxShadow = 'none')}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <p style={{ fontSize: 11, fontWeight: 700, color: FO.muted, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6 }}>
            {label}
          </p>
          {loading ? (
            <div style={{ width: 60, height: 28, borderRadius: 6, backgroundColor: FO.border, animation: 'pulse 1.5s infinite' }} />
          ) : (
            <p style={{ fontSize: 28, fontWeight: 800, color: FO.espresso, lineHeight: 1 }}>
              {value ?? '—'}
            </p>
          )}
          {sub && <p style={{ fontSize: 11, color: FO.muted, marginTop: 4 }}>{sub}</p>}
        </div>
        <div style={{
          width: 40, height: 40, borderRadius: 10,
          backgroundColor: color + '18',
          border: `1px solid ${color}44`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 18, flexShrink: 0,
        }}>
          {icon}
        </div>
      </div>
    </div>
  )
  if (href) return <Link href={href} style={{ textDecoration: 'none', display: 'block' }}>{inner}</Link>
  return inner
}

// ── Status dot ────────────────────────────────────────────────────────────────
function StatusDot({ online }) {
  return (
    <span style={{
      display: 'inline-block',
      width: 8, height: 8, borderRadius: '50%',
      backgroundColor: online ? '#22c55e' : '#6b7280',
      boxShadow: online ? '0 0 6px #22c55e88' : 'none',
      marginRight: 6, flexShrink: 0,
    }} />
  )
}

// ── Evento real-time toast ────────────────────────────────────────────────────
function EventToast({ event, onDismiss }) {
  const meta = NOC_EVENT_META[event.type] ?? { label: event.type, color: '#6b7280' }
  return (
    <div style={{
      display: 'flex', gap: 12, alignItems: 'flex-start',
      padding: '10px 14px',
      backgroundColor: FO.card,
      border: `1px solid ${meta.color}44`,
      borderLeft: `4px solid ${meta.color}`,
      borderRadius: 8, marginBottom: 8,
      boxShadow: `0 2px 8px ${meta.color}18`,
    }}>
      <span style={{ fontSize: 14, flexShrink: 0 }}>
        {event.type === 'PON_DOWN' || event.type === 'OLT_OVERLOAD' ? '🔴' :
         event.type === 'ONU_OFFLINE' ? '⚠️' :
         event.type === 'LOS' ? '📡' : '⚡'}
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: 12, fontWeight: 800, color: meta.color, marginBottom: 2 }}>
          {meta.label}
        </p>
        <p style={{ fontSize: 11, color: FO.muted }}>
          {event.message || (event.olt_name ? `${event.olt_name}` : '') + (event.client ? ` · ${event.client}` : '')}
        </p>
        <p style={{ fontSize: 10, color: FO.muted, marginTop: 2 }}>
          {new Date(event.ts).toLocaleTimeString('pt-BR')}
        </p>
      </div>
      <button onClick={() => onDismiss(event.id)} style={{
        background: 'none', border: 'none', cursor: 'pointer',
        color: FO.muted, fontSize: 14, padding: 0, flexShrink: 0,
      }}>✕</button>
    </div>
  )
}

// ── OLT Row ───────────────────────────────────────────────────────────────────
function OLTRow({ olt }) {
  const online = olt.status === 'online'
  return (
    <Link
      href={`/admin/noc/olts/${olt.id ?? olt._id}`}
      style={{ textDecoration: 'none', display: 'block' }}
    >
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '10px 16px',
        borderBottom: `1px solid ${FO.line}`,
        transition: 'background 0.12s',
      }}
        onMouseEnter={e => e.currentTarget.style.backgroundColor = FO.line}
        onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
      >
        <StatusDot online={online} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: 13, fontWeight: 700, color: FO.espresso }}>{olt.name}</p>
          <p style={{ fontSize: 11, color: FO.muted }}>{olt.ip} · {olt.vendor ?? olt.fabricante ?? '—'}</p>
        </div>
        <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexShrink: 0 }}>
          {olt.cpu_usage != null && (
            <span style={{ fontSize: 11, color: olt.cpu_usage > 80 ? '#dc2626' : FO.muted }}>
              CPU {olt.cpu_usage}%
            </span>
          )}
          {olt.temperature != null && (
            <span style={{ fontSize: 11, color: olt.temperature > 70 ? '#dc2626' : FO.muted }}>
              {olt.temperature}°C
            </span>
          )}
          <span style={{
            fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 99,
            backgroundColor: online ? '#dcfce7' : '#fee2e2',
            color: online ? '#166534' : '#991b1b',
          }}>
            {online ? 'Online' : 'Offline'}
          </span>
        </div>
      </div>
    </Link>
  )
}

// ── Alert Row ─────────────────────────────────────────────────────────────────
function AlertRow({ alert }) {
  const meta = NOC_EVENT_META[alert.type] ?? { label: alert.type, color: '#6b7280', severity: 'info' }
  return (
    <div style={{
      display: 'flex', gap: 10, alignItems: 'flex-start',
      padding: '8px 16px',
      borderBottom: `1px solid ${FO.line}`,
      borderLeft: `3px solid ${meta.color}`,
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 11, fontWeight: 800, color: meta.color }}>{meta.label}</span>
          <span style={{
            fontSize: 9, fontWeight: 700, padding: '1px 6px', borderRadius: 99,
            backgroundColor: meta.severity === 'critical' ? '#fee2e2' : '#fef3c7',
            color: meta.severity === 'critical' ? '#991b1b' : '#92400e',
          }}>
            {meta.severity === 'critical' ? 'CRÍTICO' : 'AVISO'}
          </span>
        </div>
        <p style={{ fontSize: 11, color: FO.muted, marginTop: 2 }}>
          {alert.message || alert.description || (alert.olt_name ?? alert.onu_sn ?? '—')}
        </p>
      </div>
      <span style={{ fontSize: 10, color: FO.muted, flexShrink: 0, whiteSpace: 'nowrap' }}>
        {new Date(alert.ts ?? alert.created_at ?? Date.now()).toLocaleTimeString('pt-BR')}
      </span>
    </div>
  )
}

// ── Main dashboard ────────────────────────────────────────────────────────────
export default function NOCDashboardClient() {
  const { data: summary, loading: loadingSummary, refresh } = useDashboardSummary(15_000)
  const { data: alertsData, loading: loadingAlerts } = useAlerts({ limit: 20, status: 'active' }, 10_000)

  const [toasts,     setToasts]     = useState([])
  const [autoOSEvent, setAutoOSEvent] = useState(null)

  const handleEvent = useCallback((event) => {
    setToasts(prev => [event, ...prev].slice(0, 6))
    if (event.type === 'PON_DOWN' || event.type === 'OLT_OVERLOAD') {
      setAutoOSEvent(event)
    }
  }, [])

  const { connected } = useNOCSocket({ enabled: true, onEvent: handleEvent })

  const dismissToast = useCallback((id) => {
    setToasts(prev => prev.filter(e => e.id !== id))
  }, [])

  const s = summary?.summary ?? {}
  const oltList   = summary?.oltList   ?? []
  const alertList = alertsData?.data ?? alertsData ?? []

  return (
    <div style={{ padding: 24, maxWidth: 1400, margin: '0 auto' }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: FO.espresso, margin: 0 }}>
            Centro de Operações de Rede
          </h1>
          <p style={{ fontSize: 13, color: FO.muted, margin: '4px 0 0' }}>
            Monitoramento em tempo real · fiberops-network-lab
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '5px 12px', borderRadius: 99,
            backgroundColor: connected ? '#dcfce7' : '#fee2e2',
            border: `1px solid ${connected ? '#16a34a44' : '#dc262644'}`,
          }}>
            <span style={{
              width: 7, height: 7, borderRadius: '50%',
              backgroundColor: connected ? '#22c55e' : '#dc2626',
              boxShadow: connected ? '0 0 6px #22c55e' : 'none',
            }} />
            <span style={{ fontSize: 11, fontWeight: 700, color: connected ? '#166534' : '#991b1b' }}>
              {connected ? 'Live' : 'Offline'}
            </span>
          </div>
          <button
            onClick={refresh}
            style={{
              padding: '6px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer',
              border: `1px solid ${FO.border}`, borderRadius: 8,
              backgroundColor: FO.card, color: FO.muted,
            }}
          >
            ↻ Atualizar
          </button>
        </div>
      </div>

      {/* KPI Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
        gap: 14, marginBottom: 28,
      }}>
        <KPICard label="OLTs Online"       value={s.oltsOnline}       color="#22c55e" icon="🟢" loading={loadingSummary} href="/admin/noc/olts" />
        <KPICard label="OLTs Offline"      value={s.oltsOffline}      color="#dc2626" icon="🔴" loading={loadingSummary} href="/admin/noc/olts" />
        <KPICard label="ONUs Online"       value={s.onusOnline}       color="#3b82f6" icon="📶" loading={loadingSummary} href="/admin/noc/onus" />
        <KPICard label="ONUs Offline"      value={s.onusOffline}      color="#dc2626" icon="📵" loading={loadingSummary} sub={`${s.clientsImpacted ?? 0} clientes impactados`} href="/admin/noc/onus" />
        <KPICard label="Alertas Ativos"    value={s.activeAlerts}     color="#f59e0b" icon="⚠️" loading={loadingSummary} href="/admin/noc/alertas" />
        <KPICard label="Alertas Críticos"  value={s.criticalAlerts}   color="#dc2626" icon="🔥" loading={loadingSummary} href="/admin/noc/alertas" />
        <KPICard label="Tráfego Total"     value={s.totalTraffic != null ? `${s.totalTraffic} Gbps` : null} color={FO.orange} icon="📊" loading={loadingSummary} />
        <KPICard label="Total OLTs"        value={s.oltsTotal}        color={FO.muted} icon="🖥️" loading={loadingSummary} href="/admin/noc/olts" />
      </div>

      {/* Two-column: OLTs + Alertas */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 28 }}>

        {/* OLTs */}
        <div style={{ backgroundColor: FO.card, border: `1px solid ${FO.border}`, borderRadius: 12, overflow: 'hidden' }}>
          <div style={{ padding: '14px 16px', borderBottom: `1px solid ${FO.line}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 style={{ fontSize: 14, fontWeight: 800, color: FO.espresso, margin: 0 }}>OLTs</h2>
            <Link href="/admin/noc/olts" style={{ fontSize: 11, color: FO.orange, textDecoration: 'none', fontWeight: 600 }}>Ver todas →</Link>
          </div>
          {loadingSummary ? (
            <div style={{ padding: 24, textAlign: 'center', color: FO.muted, fontSize: 13 }}>Carregando…</div>
          ) : oltList.length === 0 ? (
            <div style={{ padding: 24, textAlign: 'center', color: FO.muted, fontSize: 13 }}>Nenhuma OLT encontrada</div>
          ) : (
            oltList.slice(0, 8).map(olt => <OLTRow key={olt.id ?? olt._id} olt={olt} />)
          )}
        </div>

        {/* Alertas */}
        <div style={{ backgroundColor: FO.card, border: `1px solid ${FO.border}`, borderRadius: 12, overflow: 'hidden' }}>
          <div style={{ padding: '14px 16px', borderBottom: `1px solid ${FO.line}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 style={{ fontSize: 14, fontWeight: 800, color: FO.espresso, margin: 0 }}>Alertas Ativos</h2>
            <Link href="/admin/noc/alertas" style={{ fontSize: 11, color: FO.orange, textDecoration: 'none', fontWeight: 600 }}>Central de alarmes →</Link>
          </div>
          {loadingAlerts ? (
            <div style={{ padding: 24, textAlign: 'center', color: FO.muted, fontSize: 13 }}>Carregando…</div>
          ) : alertList.length === 0 ? (
            <div style={{ padding: 24, textAlign: 'center', color: '#166534', fontSize: 13 }}>✓ Nenhum alerta ativo</div>
          ) : (
            alertList.slice(0, 10).map((a, i) => <AlertRow key={a.id ?? a._id ?? i} alert={a} />)
          )}
        </div>
      </div>

      {/* Real-time events feed */}
      {toasts.length > 0 && (
        <div style={{ backgroundColor: FO.card, border: `1px solid ${FO.border}`, borderRadius: 12, padding: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h2 style={{ fontSize: 14, fontWeight: 800, color: FO.espresso, margin: 0 }}>
              Eventos em Tempo Real
              <span style={{
                display: 'inline-block', marginLeft: 8, width: 7, height: 7, borderRadius: '50%',
                backgroundColor: '#22c55e', boxShadow: '0 0 6px #22c55e',
                animation: 'pulse 1.5s infinite',
              }} />
            </h2>
            <button onClick={() => setToasts([])} style={{
              fontSize: 11, color: FO.muted, background: 'none', border: 'none', cursor: 'pointer',
            }}>
              Limpar
            </button>
          </div>
          {toasts.map(e => <EventToast key={e.id} event={e} onDismiss={dismissToast} />)}
        </div>
      )}

      {/* Sugestão automática de OS coletiva */}
      <AutoOSAlert event={autoOSEvent} />
    </div>
  )
}
