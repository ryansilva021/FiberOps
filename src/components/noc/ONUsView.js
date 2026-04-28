'use client'

import { useState, useCallback } from 'react'
import { useONUs, useOLTs } from '@/hooks/useNetworkLab'
import { useNOCSocket } from '@/hooks/useNOCSocket'

const FO = {
  bg: '#EDE3D2', card: '#F7F0E2', espresso: '#1A120D', orange: '#C45A2C',
  orangeSoft: '#E88A5A', muted: '#7A5C46', border: 'rgba(196,140,100,0.22)',
  line: 'rgba(196,140,100,0.13)',
}

function PowerBadge({ value, type = 'rx' }) {
  if (value == null) return <span style={{ color: FO.muted }}>—</span>
  const v = parseFloat(value)
  const critical = type === 'rx' ? v < -27 : v < -3
  const warning  = type === 'rx' ? v < -24 : v < -1
  const color = critical ? '#dc2626' : warning ? '#f59e0b' : '#16a34a'
  return <span style={{ fontWeight: 700, color }}>{v.toFixed(1)} dBm</span>
}

function ONURow({ onu, onAction }) {
  const online = onu.status === 'online'
  const [actLoading, setActLoading] = useState(false)

  async function handleAction(action) {
    if (actLoading) return
    setActLoading(true)
    try {
      await fetch(`/api/noc/network-lab/onus/${onu.id ?? onu._id}/${action}`, { method: 'POST' })
      onAction?.(onu, action)
    } catch (e) {
      console.error(e)
    } finally {
      setActLoading(false)
    }
  }

  return (
    <tr style={{ borderBottom: `1px solid ${FO.line}` }}
      onMouseEnter={e => e.currentTarget.style.backgroundColor = FO.line}
      onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
    >
      <td style={{ padding: '10px 14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{
            width: 7, height: 7, borderRadius: '50%', flexShrink: 0,
            backgroundColor: online ? '#22c55e' : '#dc2626',
            boxShadow: online ? '0 0 5px #22c55e88' : 'none',
          }} />
          <div>
            <p style={{ fontSize: 12, fontWeight: 700, color: FO.espresso }}>{onu.serial ?? onu.onu_sn ?? '—'}</p>
            <p style={{ fontSize: 10, color: FO.muted }}>{onu.model ?? '—'}</p>
          </div>
        </div>
      </td>
      <td style={{ padding: '10px 14px', fontSize: 12, color: FO.espresso }}>{onu.client ?? onu.cliente ?? '—'}</td>
      <td style={{ padding: '10px 14px' }}>
        <span style={{
          fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 99,
          backgroundColor: online ? '#dcfce7' : '#fee2e2',
          color: online ? '#166534' : '#991b1b',
        }}>
          {online ? 'Online' : 'Offline'}
        </span>
      </td>
      <td style={{ padding: '10px 14px', fontSize: 12 }}><PowerBadge value={onu.power_rx} type="rx" /></td>
      <td style={{ padding: '10px 14px', fontSize: 12 }}><PowerBadge value={onu.power_tx} type="tx" /></td>
      <td style={{ padding: '10px 14px', fontSize: 12, color: FO.muted }}>{onu.distance ?? '—'}</td>
      <td style={{ padding: '10px 14px', fontSize: 12, color: FO.muted }}>{onu.uptime ?? '—'}</td>
      <td style={{ padding: '10px 14px', fontSize: 12, color: FO.muted }}>{onu.drop_count ?? onu.falls ?? '—'}</td>
      <td style={{ padding: '10px 14px' }}>
        <div style={{ display: 'flex', gap: 6 }}>
          <button
            onClick={() => handleAction('reboot')}
            disabled={actLoading}
            title="Reboot remoto"
            style={{
              padding: '4px 10px', fontSize: 11, fontWeight: 600, cursor: actLoading ? 'not-allowed' : 'pointer',
              border: `1px solid ${FO.border}`, borderRadius: 6,
              backgroundColor: FO.card, color: FO.muted, opacity: actLoading ? 0.5 : 1,
            }}
          >
            ↺ Reboot
          </button>
          <button
            onClick={() => handleAction('reset')}
            disabled={actLoading}
            title="Reset remoto"
            style={{
              padding: '4px 10px', fontSize: 11, fontWeight: 600, cursor: actLoading ? 'not-allowed' : 'pointer',
              border: `1px solid #dc262633`, borderRadius: 6,
              backgroundColor: '#fee2e2', color: '#991b1b', opacity: actLoading ? 0.5 : 1,
            }}
          >
            ⚠ Reset
          </button>
        </div>
      </td>
    </tr>
  )
}

export default function ONUsView() {
  const [filter, setFilter]   = useState('all')
  const [search,  setSearch]  = useState('')
  const [oltId,   setOltId]   = useState('')
  const [page,    setPage]    = useState(1)
  const [actionLog, setActionLog] = useState([])
  const PER_PAGE = 50

  const { data: onuData, loading, error, refresh } = useONUs({ olt_id: oltId || undefined, page, limit: PER_PAGE }, 15_000)
  const handleWsEvent = useCallback((e) => {
    if (['ONU_OFFLINE', 'ONU_ONLINE', 'LOW_POWER', 'HIGH_POWER'].includes(e.type)) refresh()
  }, [refresh])
  useNOCSocket({ onEvent: handleWsEvent })
  const { data: oltData } = useOLTs()

  const onuList = onuData?.data ?? onuData ?? []
  const oltList = oltData?.data ?? oltData ?? []
  const total   = onuData?.total ?? onuData?.meta?.total ?? onuList.length

  const filtered = onuList.filter(onu => {
    if (filter === 'online'  && onu.status !== 'online')  return false
    if (filter === 'offline' && onu.status === 'online')  return false
    if (search) {
      const q = search.toLowerCase()
      return (onu.serial ?? onu.onu_sn ?? '').toLowerCase().includes(q) ||
             (onu.client ?? onu.cliente ?? '').toLowerCase().includes(q)
    }
    return true
  })

  const handleAction = useCallback((onu, action) => {
    const entry = { id: Date.now(), serial: onu.serial ?? onu.onu_sn, action, ts: new Date().toLocaleTimeString('pt-BR') }
    setActionLog(prev => [entry, ...prev].slice(0, 20))
  }, [])

  return (
    <div style={{ padding: 24, maxWidth: 1400, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 800, color: FO.espresso, margin: 0 }}>ONUs</h1>
          <p style={{ fontSize: 12, color: FO.muted, margin: '3px 0 0' }}>
            {total} ONUs · {onuList.filter(o => o.status === 'online').length} online
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          {/* Filtro OLT */}
          <select
            value={oltId} onChange={e => { setOltId(e.target.value); setPage(1) }}
            style={{ padding: '7px 10px', fontSize: 12, borderRadius: 8, border: `1px solid ${FO.border}`, backgroundColor: FO.card, color: FO.espresso, outline: 'none' }}
          >
            <option value="">Todas as OLTs</option>
            {oltList.map(olt => <option key={olt.id ?? olt._id} value={olt.id ?? olt._id}>{olt.name}</option>)}
          </select>

          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Serial / cliente…"
            style={{ padding: '7px 12px', fontSize: 12, borderRadius: 8, border: `1px solid ${FO.border}`, backgroundColor: FO.card, color: FO.espresso, outline: 'none', width: 160 }}
          />

          {['all', 'online', 'offline'].map(f => (
            <button key={f} onClick={() => setFilter(f)} style={{
              padding: '6px 14px', fontSize: 11, fontWeight: 700, cursor: 'pointer', borderRadius: 99,
              border: `1px solid ${filter === f ? FO.orange : FO.border}`,
              backgroundColor: filter === f ? FO.orange : FO.card,
              color: filter === f ? '#fff' : FO.muted,
            }}>
              {f === 'all' ? 'Todas' : f === 'online' ? 'Online' : 'Offline'}
            </button>
          ))}
          <button onClick={refresh} style={{ padding: '6px 12px', fontSize: 12, cursor: 'pointer', border: `1px solid ${FO.border}`, borderRadius: 8, backgroundColor: FO.card, color: FO.muted }}>↻</button>
        </div>
      </div>

      {error && (
        <div style={{ padding: '12px 16px', borderRadius: 8, backgroundColor: '#fee2e2', color: '#991b1b', fontSize: 13, marginBottom: 16 }}>
          Erro ao conectar ao network-lab: {error}
        </div>
      )}

      {/* Log de ações */}
      {actionLog.length > 0 && (
        <div style={{ backgroundColor: FO.card, border: `1px solid ${FO.border}`, borderRadius: 10, padding: '10px 16px', marginBottom: 16 }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: FO.muted, marginBottom: 8 }}>LOG DE AÇÕES</p>
          {actionLog.slice(0, 5).map(l => (
            <p key={l.id} style={{ fontSize: 11, color: FO.espresso, marginBottom: 2 }}>
              [{l.ts}] {l.action.toUpperCase()} → {l.serial}
            </p>
          ))}
        </div>
      )}

      {/* Tabela */}
      <div style={{ backgroundColor: FO.card, border: `1px solid ${FO.border}`, borderRadius: 12, overflow: 'hidden' }}>
        {loading && onuList.length === 0 ? (
          <div style={{ padding: 60, textAlign: 'center', color: FO.muted }}>Carregando ONUs…</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ backgroundColor: FO.bg }}>
                  {['Serial / Modelo', 'Cliente', 'Status', 'RX', 'TX', 'Distância', 'Uptime', 'Quedas', 'Ações'].map(h => (
                    <th key={h} style={{ padding: '10px 14px', fontSize: 10, fontWeight: 700, color: FO.muted, textTransform: 'uppercase', letterSpacing: '0.07em', textAlign: 'left', whiteSpace: 'nowrap' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={9} style={{ padding: 40, textAlign: 'center', color: FO.muted, fontSize: 13 }}>
                      Nenhuma ONU encontrada
                    </td>
                  </tr>
                ) : (
                  filtered.map(onu => <ONURow key={onu.id ?? onu._id ?? onu.serial} onu={onu} onAction={handleAction} />)
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Paginação */}
      {total > PER_PAGE && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 16 }}>
          <button
            disabled={page === 1}
            onClick={() => setPage(p => p - 1)}
            style={{ padding: '6px 14px', fontSize: 12, cursor: page === 1 ? 'not-allowed' : 'pointer', border: `1px solid ${FO.border}`, borderRadius: 8, backgroundColor: FO.card, color: FO.muted, opacity: page === 1 ? 0.5 : 1 }}
          >
            ← Anterior
          </button>
          <span style={{ padding: '6px 14px', fontSize: 12, color: FO.muted }}>
            Pág. {page} de {Math.ceil(total / PER_PAGE)}
          </span>
          <button
            disabled={page >= Math.ceil(total / PER_PAGE)}
            onClick={() => setPage(p => p + 1)}
            style={{ padding: '6px 14px', fontSize: 12, cursor: 'pointer', border: `1px solid ${FO.border}`, borderRadius: 8, backgroundColor: FO.card, color: FO.muted }}
          >
            Próxima →
          </button>
        </div>
      )}
    </div>
  )
}
