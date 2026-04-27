'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useOLT, usePONs, useAlerts } from '@/hooks/useNetworkLab'

const FO = {
  bg: '#EDE3D2', card: '#F7F0E2', espresso: '#1A120D', orange: '#C45A2C',
  muted: '#7A5C46', border: 'rgba(196,140,100,0.22)', line: 'rgba(196,140,100,0.13)',
}

function Bar({ value, max = 100 }) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100))
  const color = pct > 85 ? '#dc2626' : pct > 65 ? '#f59e0b' : '#22c55e'
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{ flex: 1, height: 5, borderRadius: 3, backgroundColor: FO.border }}>
        <div style={{ width: `${pct}%`, height: '100%', backgroundColor: color, borderRadius: 3 }} />
      </div>
      <span style={{ fontSize: 11, color, fontWeight: 700, minWidth: 30, textAlign: 'right' }}>{value}%</span>
    </div>
  )
}

function SectionCard({ title, children }) {
  return (
    <div style={{ backgroundColor: FO.card, border: `1px solid ${FO.border}`, borderRadius: 12, overflow: 'hidden', marginBottom: 20 }}>
      <div style={{ padding: '12px 20px', borderBottom: `1px solid ${FO.line}` }}>
        <h3 style={{ fontSize: 14, fontWeight: 800, color: FO.espresso, margin: 0 }}>{title}</h3>
      </div>
      <div style={{ padding: 20 }}>{children}</div>
    </div>
  )
}

export default function OLTDetailClient({ id }) {
  const { data: olt,  loading: loadingOLT,  error: errOLT  } = useOLT(id)
  const { data: pons, loading: loadingPONs } = usePONs({ olt_id: id }, 20_000)
  const { data: alerts } = useAlerts({ olt_id: id, status: 'active' }, 10_000)

  const [tab, setTab] = useState('overview')

  const ponList   = pons?.data   ?? pons   ?? []
  const alertList = alerts?.data ?? alerts ?? []

  if (loadingOLT && !olt) {
    return <div style={{ padding: 60, textAlign: 'center', color: FO.muted }}>Carregando OLT…</div>
  }

  if (errOLT) {
    return (
      <div style={{ padding: 24 }}>
        <div style={{ padding: '12px 16px', borderRadius: 8, backgroundColor: '#fee2e2', color: '#991b1b', fontSize: 13 }}>
          Erro: {errOLT}
        </div>
      </div>
    )
  }

  if (!olt) return null

  const online = olt.status === 'online'
  const TABS   = ['overview', 'pons', 'alarmes', 'clientes']

  return (
    <div style={{ padding: 24, maxWidth: 1200, margin: '0 auto' }}>
      {/* Breadcrumb */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 20, fontSize: 12, color: FO.muted }}>
        <Link href="/admin/noc" style={{ color: FO.orange, textDecoration: 'none' }}>NOC</Link>
        <span>/</span>
        <Link href="/admin/noc/olts" style={{ color: FO.orange, textDecoration: 'none' }}>OLTs</Link>
        <span>/</span>
        <span style={{ color: FO.espresso, fontWeight: 600 }}>{olt.name}</span>
      </div>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: FO.espresso, margin: 0 }}>{olt.name}</h1>
          <p style={{ fontSize: 13, color: FO.muted, margin: '4px 0 0' }}>
            {olt.vendor ?? olt.fabricante ?? '—'} · {olt.ip} · {olt.model ?? ''}
          </p>
        </div>
        <span style={{
          padding: '6px 14px', borderRadius: 99, fontSize: 12, fontWeight: 700,
          backgroundColor: online ? '#dcfce7' : '#fee2e2',
          color: online ? '#166534' : '#991b1b',
          border: `1px solid ${online ? '#16a34a44' : '#dc262644'}`,
        }}>
          {online ? '● Online' : '● Offline'}
        </span>
      </div>

      {/* KPIs rápidos */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 12, marginBottom: 28 }}>
        {[
          { label: 'ONUs',        value: olt.onu_count ?? olt.onus ?? '—' },
          { label: 'PON Ports',   value: olt.pon_ports ?? ponList.length },
          { label: 'Alertas',     value: alertList.length, color: alertList.length > 0 ? '#dc2626' : '#166534' },
          { label: 'Temperatura', value: olt.temperature != null ? `${olt.temperature}°C` : '—', color: (olt.temperature ?? 0) > 70 ? '#dc2626' : FO.espresso },
          { label: 'Uptime',      value: olt.uptime ?? '—' },
        ].map(m => (
          <div key={m.label} style={{ backgroundColor: FO.card, border: `1px solid ${FO.border}`, borderRadius: 10, padding: '12px 14px' }}>
            <p style={{ fontSize: 9, fontWeight: 700, color: FO.muted, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>{m.label}</p>
            <p style={{ fontSize: 18, fontWeight: 800, color: m.color ?? FO.espresso }}>{m.value}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20, borderBottom: `1px solid ${FO.border}` }}>
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            padding: '8px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer',
            border: 'none', borderBottom: `2px solid ${tab === t ? FO.orange : 'transparent'}`,
            backgroundColor: 'transparent', color: tab === t ? FO.orange : FO.muted,
            marginBottom: -1, transition: 'color 0.15s',
          }}>
            {t === 'overview' ? 'Visão Geral' : t === 'pons' ? 'PONs' : t === 'alarmes' ? 'Alarmes' : 'Clientes'}
          </button>
        ))}
      </div>

      {/* Tab: overview */}
      {tab === 'overview' && (
        <>
          <SectionCard title="Informações Gerais">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 12 }}>
              {[
                ['Fabricante',    olt.vendor ?? olt.fabricante ?? '—'],
                ['Modelo',        olt.model  ?? '—'],
                ['IP',            olt.ip     ?? '—'],
                ['Versão FW',     olt.firmware_version ?? '—'],
                ['Localização',   olt.location  ?? '—'],
                ['Uptime',        olt.uptime    ?? '—'],
                ['Uplink',        olt.uplink    ?? '—'],
                ['Serial',        olt.serial    ?? '—'],
              ].map(([k, v]) => (
                <div key={k}>
                  <p style={{ fontSize: 9, fontWeight: 700, color: FO.muted, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 3 }}>{k}</p>
                  <p style={{ fontSize: 13, fontWeight: 600, color: FO.espresso }}>{v}</p>
                </div>
              ))}
            </div>
          </SectionCard>

          {(olt.cpu_usage != null || olt.mem_usage != null) && (
            <SectionCard title="Utilização de Recursos">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                {olt.cpu_usage != null && (
                  <div>
                    <p style={{ fontSize: 12, color: FO.muted, marginBottom: 8 }}>CPU</p>
                    <Bar value={olt.cpu_usage} />
                  </div>
                )}
                {olt.mem_usage != null && (
                  <div>
                    <p style={{ fontSize: 12, color: FO.muted, marginBottom: 8 }}>Memória</p>
                    <Bar value={olt.mem_usage} />
                  </div>
                )}
              </div>
            </SectionCard>
          )}

          {olt.boards?.length > 0 && (
            <SectionCard title="Placas (Boards)">
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 10 }}>
                {olt.boards.map((b, i) => (
                  <div key={i} style={{ backgroundColor: FO.bg, borderRadius: 8, padding: '10px 12px' }}>
                    <p style={{ fontSize: 11, fontWeight: 700, color: FO.espresso }}>Slot {b.slot ?? i}: {b.type ?? b.model ?? '—'}</p>
                    <p style={{ fontSize: 10, color: FO.muted, marginTop: 2 }}>Ports: {b.ports ?? '—'} · Status: {b.status ?? '—'}</p>
                  </div>
                ))}
              </div>
            </SectionCard>
          )}
        </>
      )}

      {/* Tab: pons */}
      {tab === 'pons' && (
        <SectionCard title={`Portas PON ${loadingPONs ? '…' : `(${ponList.length})`}`}>
          {ponList.length === 0 ? (
            <p style={{ color: FO.muted, fontSize: 13 }}>Nenhuma porta PON encontrada</p>
          ) : (
            <div style={{ display: 'grid', gap: 8 }}>
              {ponList.map((pon, i) => {
                const ponOnline = pon.status === 'online'
                return (
                  <div key={pon.id ?? pon._id ?? i} style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: '10px 14px', borderRadius: 8,
                    backgroundColor: ponOnline ? '#f0fdf4' : '#fef2f2',
                    border: `1px solid ${ponOnline ? '#16a34a22' : '#dc262622'}`,
                  }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: ponOnline ? '#22c55e' : '#dc2626', flexShrink: 0 }} />
                    <div style={{ flex: 1 }}>
                      <p style={{ fontSize: 13, fontWeight: 700, color: FO.espresso }}>
                        {pon.name ?? `PON ${pon.port ?? i}`}
                      </p>
                      <p style={{ fontSize: 11, color: FO.muted }}>
                        ONUs: {pon.onu_count ?? '—'} · CTOs: {pon.cto_count ?? '—'} · Clientes: {pon.client_count ?? '—'}
                      </p>
                    </div>
                    <span style={{
                      fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 99,
                      backgroundColor: ponOnline ? '#dcfce7' : '#fee2e2',
                      color: ponOnline ? '#166534' : '#991b1b',
                    }}>
                      {ponOnline ? 'Online' : 'Down'}
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </SectionCard>
      )}

      {/* Tab: alarmes */}
      {tab === 'alarmes' && (
        <SectionCard title={`Alarmes Ativos (${alertList.length})`}>
          {alertList.length === 0 ? (
            <p style={{ color: '#166534', fontSize: 13 }}>✓ Nenhum alarme ativo nesta OLT</p>
          ) : (
            alertList.map((a, i) => (
              <div key={a.id ?? a._id ?? i} style={{
                padding: '10px 14px', borderRadius: 8, marginBottom: 8,
                backgroundColor: FO.bg, borderLeft: `3px solid ${a.severity === 'critical' ? '#dc2626' : '#f59e0b'}`,
              }}>
                <p style={{ fontSize: 12, fontWeight: 700, color: FO.espresso }}>{a.type} — {a.message ?? a.description}</p>
                <p style={{ fontSize: 11, color: FO.muted, marginTop: 2 }}>{new Date(a.ts ?? a.created_at ?? Date.now()).toLocaleString('pt-BR')}</p>
              </div>
            ))
          )}
        </SectionCard>
      )}

      {/* Tab: clientes */}
      {tab === 'clientes' && (
        <SectionCard title="Clientes Conectados">
          <p style={{ color: FO.muted, fontSize: 13 }}>
            Ver lista completa de ONUs desta OLT na aba{' '}
            <Link href="/admin/noc/onus" style={{ color: FO.orange }}>ONUs</Link>
            {' '}filtrando por esta OLT.
          </p>
        </SectionCard>
      )}
    </div>
  )
}
