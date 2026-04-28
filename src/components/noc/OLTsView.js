'use client'

import { useState, useCallback } from 'react'
import Link from 'next/link'
import { useOLTs } from '@/hooks/useNetworkLab'
import { useNOCSocket } from '@/hooks/useNOCSocket'
import OLTIntegrationModal from '@/components/noc/OLTIntegrationModal'

const FO = {
  bg: '#EDE3D2', card: '#F7F0E2', espresso: '#1A120D', orange: '#C45A2C',
  muted: '#7A5C46', border: 'rgba(196,140,100,0.22)', line: 'rgba(196,140,100,0.13)',
}

function ProgressBar({ value, max = 100, color = FO.orange }) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100))
  const barColor = pct > 85 ? '#dc2626' : pct > 65 ? '#f59e0b' : color
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{ flex: 1, height: 6, borderRadius: 3, backgroundColor: FO.border, overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', backgroundColor: barColor, borderRadius: 3, transition: 'width 0.3s' }} />
      </div>
      <span style={{ fontSize: 11, color: barColor, fontWeight: 700, minWidth: 32, textAlign: 'right' }}>{value}%</span>
    </div>
  )
}

function OLTCard({ olt, onSelect }) {
  const online    = olt.status === 'online'
  const sc        = online ? { bg: '#dcfce7', color: '#166534', border: '#16a34a44' }
                           : { bg: '#fee2e2', color: '#991b1b', border: '#dc262644' }

  return (
    <div
      style={{
        backgroundColor: FO.card,
        border: `1px solid ${FO.border}`,
        borderRadius: 12,
        borderLeft: `4px solid ${online ? '#22c55e' : '#dc2626'}`,
        padding: 20,
        cursor: 'pointer',
        transition: 'box-shadow 0.15s',
      }}
      onMouseEnter={e => e.currentTarget.style.boxShadow = '0 4px 16px rgba(26,18,13,0.08)'}
      onMouseLeave={e => e.currentTarget.style.boxShadow = 'none'}
      onClick={() => onSelect(olt)}
    >
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
        <div>
          <h3 style={{ fontSize: 15, fontWeight: 800, color: FO.espresso, margin: 0 }}>{olt.name}</h3>
          <p style={{ fontSize: 11, color: FO.muted, margin: '2px 0 0' }}>{olt.vendor ?? olt.fabricante ?? '—'} · {olt.ip}</p>
        </div>
        <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 9px', borderRadius: 99, backgroundColor: sc.bg, color: sc.color, border: `1px solid ${sc.border}` }}>
          {online ? 'Online' : 'Offline'}
        </span>
      </div>

      {/* Métricas */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
        {[
          { label: 'ONUs', value: olt.onu_count ?? olt.onus ?? '—' },
          { label: 'Uplink', value: olt.uplink ?? '—' },
          { label: 'Uptime', value: olt.uptime ?? '—' },
          { label: 'Temperatura', value: olt.temperature != null ? `${olt.temperature}°C` : '—' },
        ].map(m => (
          <div key={m.label}>
            <p style={{ fontSize: 9, fontWeight: 700, color: FO.muted, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 2 }}>{m.label}</p>
            <p style={{ fontSize: 13, fontWeight: 700, color: FO.espresso }}>{m.value}</p>
          </div>
        ))}
      </div>

      {/* CPU / Memória */}
      {olt.cpu_usage != null && (
        <div style={{ marginBottom: 8 }}>
          <p style={{ fontSize: 9, fontWeight: 700, color: FO.muted, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>CPU</p>
          <ProgressBar value={olt.cpu_usage} />
        </div>
      )}
      {olt.mem_usage != null && (
        <div>
          <p style={{ fontSize: 9, fontWeight: 700, color: FO.muted, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>Memória</p>
          <ProgressBar value={olt.mem_usage} />
        </div>
      )}

      <div style={{ marginTop: 14, paddingTop: 12, borderTop: `1px solid ${FO.line}`, textAlign: 'right' }}>
        <Link href={`/admin/noc/olts/${olt.id ?? olt._id}`} style={{ fontSize: 11, color: FO.orange, textDecoration: 'none', fontWeight: 600 }}
          onClick={e => e.stopPropagation()}>
          Ver detalhes →
        </Link>
      </div>
    </div>
  )
}

function OLTDrawer({ olt, onClose }) {
  if (!olt) return null
  const online = olt.status === 'online'

  const panels = [
    { label: 'Fabricante',   value: olt.vendor ?? olt.fabricante ?? '—' },
    { label: 'Modelo',       value: olt.model  ?? '—' },
    { label: 'IP',           value: olt.ip      ?? '—' },
    { label: 'Versão FW',    value: olt.firmware_version ?? '—' },
    { label: 'Localização',  value: olt.location ?? '—' },
    { label: 'Uptime',       value: olt.uptime  ?? '—' },
    { label: 'ONUs Total',   value: olt.onu_count ?? olt.onus ?? '—' },
    { label: 'PON Ports',    value: olt.pon_ports ?? '—' },
  ]

  return (
    <>
      <div
        style={{ position: 'fixed', inset: 0, zIndex: 40, backgroundColor: 'rgba(0,0,0,0.4)' }}
        onClick={onClose}
      />
      <div style={{
        position: 'fixed', right: 0, top: 0, bottom: 0, zIndex: 50,
        width: 460, backgroundColor: FO.card,
        borderLeft: `1px solid ${FO.border}`,
        boxShadow: '-8px 0 32px rgba(26,18,13,0.12)',
        overflowY: 'auto', display: 'flex', flexDirection: 'column',
      }}>
        {/* Drawer header */}
        <div style={{ padding: '20px 24px', borderBottom: `1px solid ${FO.line}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2 style={{ fontSize: 17, fontWeight: 800, color: FO.espresso, margin: 0 }}>{olt.name}</h2>
            <p style={{ fontSize: 12, color: FO.muted, margin: '3px 0 0' }}>{olt.ip}</p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: FO.muted, fontSize: 20 }}>✕</button>
        </div>

        <div style={{ padding: 24, flex: 1 }}>
          {/* Status badge */}
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 8, marginBottom: 20,
            padding: '6px 14px', borderRadius: 99,
            backgroundColor: online ? '#dcfce7' : '#fee2e2',
            border: `1px solid ${online ? '#16a34a44' : '#dc262644'}`,
          }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: online ? '#22c55e' : '#dc2626', boxShadow: online ? '0 0 6px #22c55e' : 'none' }} />
            <span style={{ fontSize: 12, fontWeight: 700, color: online ? '#166534' : '#991b1b' }}>
              {online ? 'Online' : 'Offline'}
            </span>
          </div>

          {/* Dados gerais */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 24 }}>
            {panels.map(p => (
              <div key={p.label} style={{ backgroundColor: FO.bg, borderRadius: 8, padding: '10px 12px' }}>
                <p style={{ fontSize: 9, fontWeight: 700, color: FO.muted, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>{p.label}</p>
                <p style={{ fontSize: 13, fontWeight: 700, color: FO.espresso }}>{p.value}</p>
              </div>
            ))}
          </div>

          {/* CPU/Mem */}
          {(olt.cpu_usage != null || olt.mem_usage != null) && (
            <div style={{ marginBottom: 24 }}>
              <h3 style={{ fontSize: 13, fontWeight: 800, color: FO.espresso, marginBottom: 12 }}>Utilização</h3>
              {olt.cpu_usage != null && (
                <div style={{ marginBottom: 10 }}>
                  <p style={{ fontSize: 11, color: FO.muted, marginBottom: 6 }}>CPU</p>
                  <ProgressBar value={olt.cpu_usage} />
                </div>
              )}
              {olt.mem_usage != null && (
                <div>
                  <p style={{ fontSize: 11, color: FO.muted, marginBottom: 6 }}>Memória</p>
                  <ProgressBar value={olt.mem_usage} />
                </div>
              )}
            </div>
          )}

          {/* Placas/slots */}
          {olt.boards?.length > 0 && (
            <div style={{ marginBottom: 24 }}>
              <h3 style={{ fontSize: 13, fontWeight: 800, color: FO.espresso, marginBottom: 10 }}>Placas</h3>
              {olt.boards.map((b, i) => (
                <div key={i} style={{ padding: '8px 12px', backgroundColor: FO.bg, borderRadius: 8, marginBottom: 6, display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 12, color: FO.espresso, fontWeight: 600 }}>Slot {b.slot ?? i}: {b.type ?? b.model ?? '—'}</span>
                  <span style={{ fontSize: 11, color: b.status === 'online' ? '#166534' : FO.muted }}>{b.status ?? '—'}</span>
                </div>
              ))}
            </div>
          )}

          <div style={{ marginTop: 'auto', paddingTop: 16 }}>
            <Link href={`/admin/noc/olts/${olt.id ?? olt._id}`} style={{
              display: 'block', textAlign: 'center', padding: '10px', borderRadius: 8,
              backgroundColor: FO.orange, color: '#fff', textDecoration: 'none',
              fontSize: 13, fontWeight: 700,
            }}>
              Abrir página completa →
            </Link>
          </div>
        </div>
      </div>
    </>
  )
}

export default function OLTsView() {
  const [filter,     setFilter]     = useState('all')
  const [search,     setSearch]     = useState('')
  const [selected,   setSelected]   = useState(null)
  const [showModal,  setShowModal]  = useState(false)
  const { data, loading, error, refresh } = useOLTs({}, 15_000)
  const handleWsEvent = useCallback((e) => {
    if (['OLT_OVERLOAD', 'LOS', 'PON_DOWN', 'ONU_OFFLINE'].includes(e.type)) refresh()
  }, [refresh])
  useNOCSocket({ onEvent: handleWsEvent })

  const oltList = data?.data ?? data ?? []
  const filtered = oltList.filter(olt => {
    if (filter === 'online'  && olt.status !== 'online')  return false
    if (filter === 'offline' && olt.status === 'online')  return false
    if (search) {
      const q = search.toLowerCase()
      return (olt.name ?? '').toLowerCase().includes(q) || (olt.ip ?? '').includes(q)
    }
    return true
  })

  return (
    <div style={{ padding: 24, maxWidth: 1400, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 800, color: FO.espresso, margin: 0 }}>OLTs</h1>
          <p style={{ fontSize: 12, color: FO.muted, margin: '3px 0 0' }}>
            {oltList.length} equipamentos · {oltList.filter(o => o.status === 'online').length} online
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar nome / IP…"
            style={{
              padding: '7px 12px', fontSize: 12, borderRadius: 8, border: `1px solid ${FO.border}`,
              backgroundColor: FO.card, color: FO.espresso, outline: 'none', width: 180,
            }}
          />
          {['all', 'online', 'offline'].map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              style={{
                padding: '6px 14px', fontSize: 11, fontWeight: 700, cursor: 'pointer', borderRadius: 99,
                border: `1px solid ${filter === f ? FO.orange : FO.border}`,
                backgroundColor: filter === f ? FO.orange : FO.card,
                color: filter === f ? '#fff' : FO.muted,
              }}
            >
              {f === 'all' ? 'Todas' : f === 'online' ? 'Online' : 'Offline'}
            </button>
          ))}
          <button onClick={refresh} style={{ padding: '6px 12px', fontSize: 12, cursor: 'pointer', border: `1px solid ${FO.border}`, borderRadius: 8, backgroundColor: FO.card, color: FO.muted }}>↻</button>
          <button
            onClick={() => setShowModal(true)}
            style={{ padding: '7px 16px', fontSize: 12, fontWeight: 700, cursor: 'pointer', border: 'none', borderRadius: 8, backgroundColor: FO.orange, color: '#fff' }}
          >
            + Integrar OLT
          </button>
        </div>
      </div>

      {error && (
        <div style={{ padding: '12px 16px', borderRadius: 8, backgroundColor: '#fee2e2', border: '1px solid #dc262633', color: '#991b1b', fontSize: 13, marginBottom: 20 }}>
          Erro ao conectar ao network-lab: {error}
        </div>
      )}

      {loading && oltList.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 60, color: FO.muted }}>Carregando OLTs…</div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 60, color: FO.muted }}>Nenhuma OLT encontrada</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
          {filtered.map(olt => <OLTCard key={olt.id ?? olt._id} olt={olt} onSelect={setSelected} />)}
        </div>
      )}

      <OLTDrawer olt={selected} onClose={() => setSelected(null)} />

      {showModal && (
        <OLTIntegrationModal
          onClose={() => setShowModal(false)}
          onSaved={() => { setShowModal(false); setTimeout(refresh, 800) }}
        />
      )}
    </div>
  )
}
