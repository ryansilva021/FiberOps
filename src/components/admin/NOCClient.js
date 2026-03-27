'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import OltMgmtTab from './OltMgmtTab'

// ─── Style constants ──────────────────────────────────────────────────────────

const card = {
  backgroundColor: 'var(--card-bg)',
  border: '1px solid var(--border-color)',
  borderRadius: 12,
  padding: 20,
}

const btn = (color = '#0284c7') => ({
  backgroundColor: color,
  color: '#fff',
  border: 'none',
  borderRadius: 8,
  padding: '8px 16px',
  fontSize: 13,
  fontWeight: 600,
  cursor: 'pointer',
})

const btnOutline = {
  backgroundColor: 'transparent',
  color: 'var(--text-muted)',
  border: '1px solid var(--border-color)',
  borderRadius: 8,
  padding: '7px 15px',
  fontSize: 13,
  cursor: 'pointer',
}

const inp = {
  backgroundColor: 'var(--inp-bg)',
  border: '1px solid var(--border-color)',
  color: 'var(--foreground)',
  borderRadius: 8,
  padding: '8px 12px',
  fontSize: 13,
  outline: 'none',
  width: '100%',
  boxSizing: 'border-box',
}

const lbl = {
  fontSize: 11,
  color: 'var(--text-muted)',
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  fontWeight: 600,
  display: 'block',
  marginBottom: 4,
}

// ─── Lookup tables ────────────────────────────────────────────────────────────

const STATUS_OLT = {
  ativo:         { label: 'Ativo',      color: '#22c55e' },
  inativo:       { label: 'Inativo',    color: '#ef4444' },
  em_manutencao: { label: 'Manutenção', color: '#f59e0b' },
}

const STATUS_ONU = {
  active:       { label: 'Ativa',         color: '#22c55e' },
  provisioning: { label: 'Provisionando', color: '#60a5fa' },
  offline:      { label: 'Offline',       color: '#ef4444' },
  error:        { label: 'Erro',          color: '#f87171' },
}

const SIGNAL_QUALITY = {
  excelente: { label: 'Excelente', color: '#22c55e' },
  bom:       { label: 'Bom',       color: '#4ade80' },
  medio:     { label: 'Médio',     color: '#f59e0b' },
  critico:   { label: 'Crítico',   color: '#ef4444' },
}

const NIVEL_TERM_COLOR = {
  info:    '#4ade80',
  warn:    '#fbbf24',
  error:   '#f87171',
  success: '#86efac',
}

const ALERTA_CONFIG = {
  onu_offline:   { icon: '📴', color: '#ef4444', label: 'ONU Offline' },
  sinal_critico: { icon: '⚡', color: '#f97316', label: 'Sinal Crítico' },
  cto_cheia:     { icon: '📦', color: '#f59e0b', label: 'CTO Cheia' },
}

// ─── Signal analysis ──────────────────────────────────────────────────────────

function analyzeSignal(rx, tx) {
  let rxQuality, rxClass, rxDiags = []

  if (rx == null) {
    rxQuality = 'N/D'; rxClass = 'unknown'
  } else if (rx > -20) {
    rxQuality = 'EXCELENTE'; rxClass = 'success'
  } else if (rx >= -25) {
    rxQuality = 'BOM'; rxClass = 'bom'
  } else if (rx >= -28) {
    rxQuality = 'LIMITE'; rxClass = 'limite'
    rxDiags.push('Cliente no limite operacional — verificar CTO / fusão')
  } else {
    rxQuality = 'CRÍTICO'; rxClass = 'critico'
    rxDiags.push('Sinal muito baixo (possível problema de fibra, fusão ou CTO)')
  }

  let txStatus, txClass, txDiags = []

  if (tx == null) {
    txStatus = 'N/D'; txClass = 'unknown'
  } else if (tx > 5) {
    txStatus = 'MUITO ALTO'; txClass = 'critico'
    txDiags.push('Potência muito alta (risco de saturação)')
  } else if (tx < 1) {
    txStatus = 'BAIXO'; txClass = 'limite'
    txDiags.push('Potência de retorno baixa')
  } else {
    txStatus = 'OK'; txClass = 'success'
  }

  const allDiags = [...rxDiags, ...txDiags]
  const statusGeral =
    (rxClass === 'critico' || txClass === 'critico') ? 'ALERTA' :
    (rxClass === 'limite'  || txClass === 'limite')  ? 'ATENÇÃO' : 'OK'

  return { rxQuality, rxClass, txStatus, txClass, statusGeral, diags: allDiags }
}

const SIG_COLOR = {
  success: '#22c55e',
  bom:     '#4ade80',
  limite:  '#f59e0b',
  critico: '#ef4444',
  unknown: 'var(--text-muted)',
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtTs(iso) {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleString('pt-BR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    })
  } catch { return iso }
}

function fmtTime(date) {
  return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

function fmtHHMMSS(iso) {
  if (!iso) return '??:??:??'
  try {
    return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  } catch { return '??:??:??' }
}

function barColor(pct) {
  if (pct >= 90) return '#ef4444'
  if (pct >= 70) return '#f59e0b'
  return '#22c55e'
}

// ─── Atoms ────────────────────────────────────────────────────────────────────

function MiniCard({ label, value, accent, sublabel }) {
  return (
    <div style={{ ...card, padding: '14px 18px', borderLeft: accent ? `3px solid ${accent}` : undefined }}>
      <p style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4, fontWeight: 600 }}>
        {label}
      </p>
      <p style={{ fontSize: 26, fontWeight: 700, color: accent ?? 'var(--foreground)', lineHeight: 1 }}>
        {value ?? '—'}
      </p>
      {sublabel && <p style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4 }}>{sublabel}</p>}
    </div>
  )
}

function StatusBadge({ statusMap, status }) {
  const cfg = statusMap?.[status]
  if (!cfg) return <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{status ?? '—'}</span>
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '2px 8px', borderRadius: 99,
      backgroundColor: cfg.color + '22', border: `1px solid ${cfg.color}55`,
      fontSize: 11, color: cfg.color, fontWeight: 600,
    }}>
      <span style={{ width: 5, height: 5, borderRadius: '50%', backgroundColor: cfg.color, display: 'inline-block' }} />
      {cfg.label}
    </span>
  )
}

function SignalBadge({ quality }) {
  if (!quality) return <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>—</span>
  const cfg = SIGNAL_QUALITY[quality]
  if (!cfg) return null
  return (
    <span style={{
      display: 'inline-block', padding: '2px 8px', borderRadius: 99,
      backgroundColor: cfg.color + '22', border: `1px solid ${cfg.color}55`,
      fontSize: 11, color: cfg.color, fontWeight: 600,
    }}>
      {cfg.label}
    </span>
  )
}

function Spinner() {
  return (
    <span style={{
      display: 'inline-block', width: 14, height: 14,
      border: '2px solid var(--border-color)', borderTopColor: 'var(--foreground)',
      borderRadius: '50%', animation: 'noc-spin 0.7s linear infinite',
      verticalAlign: 'middle',
    }} />
  )
}

function SectionTitle({ children }) {
  return (
    <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--foreground)', marginBottom: 16 }}>
      {children}
    </p>
  )
}

function FeedbackBanner({ feedback }) {
  if (!feedback) return null
  return (
    <div style={{
      padding: '10px 16px', borderRadius: 8, marginBottom: 12,
      backgroundColor: feedback.type === 'success' ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
      border: `1px solid ${feedback.type === 'success' ? 'rgba(34,197,94,0.35)' : 'rgba(239,68,68,0.35)'}`,
      color: feedback.type === 'success' ? '#16a34a' : '#dc2626',
      fontSize: 13,
    }}>
      {feedback.message}
    </div>
  )
}

// Table helpers
function TH({ children, right }) {
  return (
    <th style={{
      padding: '8px 12px', textAlign: right ? 'right' : 'left',
      fontSize: 11, fontWeight: 600, color: 'var(--text-muted)',
      textTransform: 'uppercase', letterSpacing: '0.05em',
      borderBottom: '1px solid var(--border-color)', whiteSpace: 'nowrap',
    }}>
      {children}
    </th>
  )
}

function TD({ children, mono, muted, right, bold, style: extra }) {
  return (
    <td style={{
      padding: '9px 12px',
      fontSize: mono ? 12 : 13,
      color: muted ? 'var(--text-muted)' : 'var(--foreground)',
      fontFamily: mono ? 'monospace' : undefined,
      fontWeight: bold ? 600 : undefined,
      textAlign: right ? 'right' : 'left',
      borderBottom: '1px solid var(--border-color)',
      verticalAlign: 'middle',
      ...extra,
    }}>
      {children}
    </td>
  )
}

// ─── TAB 1: VISÃO GERAL ───────────────────────────────────────────────────────

function VisaoGeralTab({ stats }) {
  const { oltStats, onuStats, totalCTOs, pendingEvents, alertas = [] } = stats ?? {}
  const onus = stats?.onus ?? []

  const [ackedAlerts, setAckedAlerts] = useState(new Set())

  // ── Network Health Score ──────────────────────────────────────────────────
  const pctActive   = (onuStats?.active  ?? 0) / Math.max(onuStats?.total ?? 1, 1) * 100
  const criticalOnus = onus.filter(o => o.signal_quality === 'critico').length
  const sigScore    = criticalOnus === 0 ? 100 : Math.max(0, 100 - criticalOnus * 20)
  const pctOlts     = (oltStats?.ativos  ?? 0) / Math.max(oltStats?.total ?? 1, 1) * 100
  const score       = Math.round(0.5 * pctActive + 0.3 * sigScore + 0.2 * pctOlts)
  const status      = score >= 90 ? 'OPERAÇÃO NORMAL' : score >= 70 ? 'DEGRADADO' : 'CRITICO'
  const statusColor = score >= 90 ? '#22c55e' : score >= 70 ? '#f59e0b' : '#ef4444'

  // ── Signal Quality Distribution ──────────────────────────────────────────
  const sqCounts = {
    excelente: onus.filter(o => o.signal_quality === 'excelente').length,
    bom:       onus.filter(o => o.signal_quality === 'bom').length,
    medio:     onus.filter(o => o.signal_quality === 'medio').length,
    critico:   onus.filter(o => o.signal_quality === 'critico').length,
    sem_dados: onus.filter(o => !o.signal_quality).length,
  }
  const totalWithData = sqCounts.excelente + sqCounts.bom + sqCounts.medio + sqCounts.critico

  const sqRows = [
    { key: 'excelente', label: 'Excelente', color: '#22c55e', count: sqCounts.excelente },
    { key: 'bom',       label: 'Bom',       color: '#4ade80', count: sqCounts.bom },
    { key: 'medio',     label: 'Medio',     color: '#f59e0b', count: sqCounts.medio },
    { key: 'critico',   label: 'Critico',   color: '#ef4444', count: sqCounts.critico },
    { key: 'sem_dados', label: 'Sem Dados', color: 'var(--text-muted)', count: sqCounts.sem_dados },
  ]

  // ── Alert helpers ─────────────────────────────────────────────────────────
  function alertKey(a) { return `${a.tipo}-${a.serial ?? a.cto_id}` }

  function severityBadge(tipo) {
    if (tipo === 'onu_offline' || tipo === 'sinal_critico') {
      return (
        <span style={{
          fontSize: 10, fontWeight: 700, letterSpacing: '0.06em',
          padding: '2px 6px', borderRadius: 4,
          backgroundColor: '#ef444422', border: '1px solid #ef444466', color: '#ef4444',
        }}>P1 CRITICO</span>
      )
    }
    if (tipo === 'cto_cheia') {
      return (
        <span style={{
          fontSize: 10, fontWeight: 700, letterSpacing: '0.06em',
          padding: '2px 6px', borderRadius: 4,
          backgroundColor: '#f59e0b22', border: '1px solid #f59e0b66', color: '#f59e0b',
        }}>P2 ALTO</span>
      )
    }
    return null
  }

  const activeAlerts = alertas.filter(a => !ackedAlerts.has(alertKey(a)))
  const ackedList    = alertas.filter(a =>  ackedAlerts.has(alertKey(a)))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* A. Network Health Score */}
      <div style={{ ...card, borderLeft: `4px solid ${statusColor}` }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, alignItems: 'center' }}>
          {/* Left: big score */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 6 }}>
            <p style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600, margin: 0 }}>
              Saude da Rede
            </p>
            <p style={{ fontSize: 48, fontWeight: 700, color: statusColor, lineHeight: 1, margin: 0 }}>
              {score}
            </p>
            <span style={{
              fontSize: 11, fontWeight: 700, letterSpacing: '0.1em',
              padding: '3px 10px', borderRadius: 99,
              backgroundColor: statusColor + '22', border: `1px solid ${statusColor}55`,
              color: statusColor,
            }}>
              {status}
            </span>
          </div>
          {/* Right: 3 mini rows */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[
              { label: 'ONUs Ativas',   val: onuStats?.active  ?? 0, total: onuStats?.total  ?? 0 },
              { label: 'Sinal Normal',  val: sqCounts.excelente + sqCounts.bom, total: Math.max(totalWithData, 1) },
              { label: 'OLTs',          val: oltStats?.ativos  ?? 0, total: oltStats?.total  ?? 0 },
            ].map(row => (
              <div key={row.label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{row.label}</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--foreground)', fontVariantNumeric: 'tabular-nums' }}>
                  {row.val}
                  <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 400 }}>/{row.total}</span>
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* B. KPI Grid — 2 rows of 4 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
          <MiniCard label="ONUs Total"    value={onuStats?.total        ?? 0} />
          <MiniCard label="ONUs Ativas"   value={onuStats?.active       ?? 0} accent="#22c55e" />
          <MiniCard label="ONUs Offline"  value={onuStats?.offline      ?? 0} accent={onuStats?.offline > 0 ? '#ef4444' : undefined} />
          <MiniCard label="Provisionando" value={onuStats?.provisioning ?? 0} accent={(onuStats?.provisioning ?? 0) > 0 ? '#60a5fa' : undefined} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
          <MiniCard label="OLTs Ativas"   value={oltStats?.ativos       ?? 0} accent="#22c55e" />
          <MiniCard label="Manutencao"    value={oltStats?.em_manutencao ?? 0} accent={(oltStats?.em_manutencao ?? 0) > 0 ? '#f59e0b' : undefined} />
          <MiniCard label="CTOs"          value={totalCTOs              ?? 0} />
          <MiniCard label="Fila"          value={pendingEvents          ?? 0} accent={(pendingEvents ?? 0) > 0 ? '#f59e0b' : undefined} />
        </div>
      </div>

      {/* C. Signal Quality Distribution */}
      <div style={card}>
        <SectionTitle>Distribuicao de Sinal</SectionTitle>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {sqRows.map(row => {
            const pct = totalWithData > 0 ? (row.count / (row.key === 'sem_dados' ? Math.max(onus.length, 1) : totalWithData)) * 100 : 0
            return (
              <div key={row.key} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: row.color, flexShrink: 0, display: 'inline-block' }} />
                <span style={{ fontSize: 12, color: 'var(--text-muted)', width: 72, flexShrink: 0 }}>{row.label}</span>
                <div style={{ flex: 1, height: 6, borderRadius: 99, backgroundColor: 'var(--border-color)', overflow: 'hidden' }}>
                  <div style={{
                    height: '100%', borderRadius: 99,
                    width: `${Math.max(pct, row.count > 0 ? 2 : 0)}%`,
                    backgroundColor: row.color,
                    transition: 'width 0.4s ease',
                  }} />
                </div>
                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--foreground)', width: 28, textAlign: 'right', flexShrink: 0 }}>
                  {row.count}
                </span>
              </div>
            )
          })}
        </div>
      </div>

      {/* D. Alertas com reconhecimento */}
      <div style={card}>
        <SectionTitle>
          {activeAlerts.length > 0 ? `Alertas Ativos (${activeAlerts.length})` : 'Alertas'}
        </SectionTitle>

        {activeAlerts.length === 0 && ackedList.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '20px 0', color: '#22c55e', fontSize: 13 }}>
            Nenhum alerta — rede operando normalmente
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {/* Active alerts */}
            {activeAlerts.map((a) => {
              const cfg = ALERTA_CONFIG[a.tipo] ?? { icon: '', color: '#f59e0b', label: a.tipo }
              const key = alertKey(a)
              return (
                <div key={key} style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '10px 14px', borderRadius: 8,
                  backgroundColor: cfg.color + '14', border: `1px solid ${cfg.color}44`,
                }}>
                  <span style={{ fontSize: 16 }}>{cfg.icon}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: cfg.color }}>{cfg.label}</span>
                      {severityBadge(a.tipo)}
                    </div>
                    {a.tipo === 'onu_offline' && (
                      <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                        {a.cliente ?? a.serial}{a.cto_id ? ` — CTO ${a.cto_id}` : ''}
                      </span>
                    )}
                    {a.tipo === 'sinal_critico' && (
                      <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                        {a.cliente ?? a.serial} — RX {a.rx_power?.toFixed(2)} dBm
                      </span>
                    )}
                    {a.tipo === 'cto_cheia' && (
                      <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                        {a.nome ?? a.cto_id} — {a.pct}% ocupado
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => setAckedAlerts(prev => new Set([...prev, key]))}
                    style={{
                      fontSize: 11, padding: '4px 10px', borderRadius: 6, cursor: 'pointer',
                      backgroundColor: 'transparent', border: '1px solid var(--border-color)',
                      color: 'var(--text-muted)', flexShrink: 0,
                    }}
                  >
                    Reconhecer
                  </button>
                </div>
              )
            })}

            {/* Acknowledged alerts */}
            {ackedList.length > 0 && (
              <div style={{ marginTop: 8 }}>
                <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  Reconhecidos ({ackedList.length})
                </p>
                {ackedList.map((a) => {
                  const cfg = ALERTA_CONFIG[a.tipo] ?? { icon: '', color: '#94a3b8', label: a.tipo }
                  const key = alertKey(a)
                  return (
                    <div key={key} style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      padding: '8px 14px', borderRadius: 8,
                      backgroundColor: 'var(--inp-bg)', border: '1px solid var(--border-color)',
                      opacity: 0.55, marginBottom: 6,
                    }}>
                      <span style={{ fontSize: 14 }}>{cfg.icon}</span>
                      <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{cfg.label}</span>
                      {a.tipo === 'onu_offline' && (
                        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{a.cliente ?? a.serial}</span>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── TAB 2: CLIENTES ──────────────────────────────────────────────────────────

function ClientesTab({ onus = [], olts = [], onLog }) {
  const [search, setSearch]             = useState('')
  const [statusFilter, setStatusFilter] = useState('todos')
  const [provisioning, setProvisioning] = useState(false)
  const [cancelling, setCancelling]     = useState(false)
  const [feedback, setFeedback]         = useState(null)
  const [form, setForm]                 = useState({ serial: '', cliente: '', oltId: '', ponPort: '', ctoId: '' })
  const [testingSerial, setTestingSerial] = useState(null)
  const [monitorActive,  setMonitorActive]  = useState(false)
  const [monitorAlerts,  setMonitorAlerts]  = useState([])
  const monitorRef = useRef(null)

  function showFeedback(type, message) {
    setFeedback({ type, message })
    setTimeout(() => setFeedback(null), 5000)
  }

  // Auto-monitor: scans offline ONUs every 60s
  useEffect(() => {
    if (!monitorActive) {
      if (monitorRef.current) { clearInterval(monitorRef.current); monitorRef.current = null }
      return
    }

    async function runMonitor() {
      try {
        const { monitorOfflineOnus } = await import('@/actions/provisioning')
        const alerts = await monitorOfflineOnus()
        setMonitorAlerts(alerts)
        if (alerts.length > 0) {
          onLog('MONITOR', `${alerts.length} ONU(s) offline detectada(s)`, 'warn')
        }
      } catch { /* silent */ }
    }

    runMonitor()
    monitorRef.current = setInterval(runMonitor, 60_000)
    return () => { if (monitorRef.current) clearInterval(monitorRef.current) }
  }, [monitorActive, onLog])

  const STATUS_CHIPS = [
    { id: 'todos',         label: 'Todos',         color: '#0284c7' },
    { id: 'ativas',        label: 'Ativas',         color: '#22c55e' },
    { id: 'offline',       label: 'Offline',        color: '#ef4444' },
    { id: 'critico',       label: 'Critico',        color: '#f97316' },
    { id: 'provisionando', label: 'Provisionando',  color: '#60a5fa' },
  ]

  const filtered = onus.filter(o => {
    if (search.trim()) {
      const q = search.toLowerCase()
      const matchesSearch = (
        o.serial?.toLowerCase().includes(q) ||
        o.cliente?.toLowerCase().includes(q) ||
        o.cto_id?.toLowerCase().includes(q) ||
        o.olt_id?.toLowerCase().includes(q)
      )
      if (!matchesSearch) return false
    }
    if (statusFilter === 'ativas')        return o.status === 'active'
    if (statusFilter === 'offline')       return o.status === 'offline'
    if (statusFilter === 'critico')       return o.signal_quality === 'critico'
    if (statusFilter === 'provisionando') return o.status === 'provisioning'
    return true
  })

  async function handleProvision() {
    if (!form.serial.trim()) { showFeedback('error', 'Serial ONU é obrigatório.'); return }
    setProvisioning(true)
    onLog('ONU', `Provisionando ${form.serial}`, 'info')
    try {
      const { manualProvision } = await import('@/actions/provisioning')
      const result = await manualProvision({
        serial:  form.serial.trim(),
        cliente: form.cliente.trim(),
        oltId:   form.oltId || null,
        ponPort: form.ponPort || null,
        ctoId:   form.ctoId.trim() || null,
      })
      if (result.processed) {
        showFeedback('success', `ONU ${form.serial} provisionada. Atualize a página para ver.`)
        onLog('ONU', `${form.serial} provisionada com sucesso`, 'success')
        setForm({ serial: '', cliente: '', oltId: '', ponPort: '', ctoId: '' })
      } else {
        showFeedback('error', result.reason ?? 'Falha no provisionamento.')
        onLog('ONU', result.reason ?? 'Falha no provisionamento', 'error')
      }
    } catch (e) {
      showFeedback('error', e.message ?? 'Erro ao provisionar.')
      onLog('ONU', e.message, 'error')
    } finally {
      setProvisioning(false)
    }
  }

  async function handleCancel() {
    if (!form.serial.trim()) { showFeedback('error', 'Serial ONU é obrigatório.'); return }
    setCancelling(true)
    onLog('ONU', `Cancelando ONU ${form.serial}`, 'warn')
    try {
      const { manualCancel } = await import('@/actions/provisioning')
      await manualCancel(form.serial.trim())
      showFeedback('success', `ONU ${form.serial} cancelada. Atualize a página para ver.`)
      onLog('ONU', `${form.serial} cancelada`, 'info')
      setForm(f => ({ ...f, serial: '' }))
    } catch (e) {
      showFeedback('error', e.message ?? 'Erro ao cancelar.')
      onLog('ONU', e.message, 'error')
    } finally {
      setCancelling(false)
    }
  }

  const selectedOlt = olts.find(o => o.id === form.oltId)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* Diagnostic modal */}
      {testingSerial && (
        <DiagnosticModal serial={testingSerial} onClose={() => setTestingSerial(null)} />
      )}

      {/* Monitor alerts banner */}
      {monitorAlerts.length > 0 && (
        <div style={{
          backgroundColor: '#422006', border: '1px solid #d97706',
          borderRadius: 10, padding: '12px 16px',
        }}>
          <p style={{ fontSize: 13, fontWeight: 700, color: '#fbbf24', marginBottom: 8 }}>
            ⚠️ Monitor detectou {monitorAlerts.length} ONU(s) offline
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {monitorAlerts.map((a, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12 }}>
                <span style={{
                  width: 6, height: 6, borderRadius: '50%',
                  backgroundColor: '#ef4444', flexShrink: 0,
                }} />
                <span style={{ fontFamily: 'monospace', color: '#fbbf24', fontWeight: 600 }}>{a.serial}</span>
                <span style={{ color: 'var(--text-muted)' }}>{a.cliente}</span>
                <span style={{ color: '#f87171' }}>— {a.problema}</span>
                <button
                  onClick={() => setTestingSerial(a.serial)}
                  style={{
                    marginLeft: 'auto', fontSize: 10, fontWeight: 600,
                    padding: '2px 8px', borderRadius: 4, border: 'none',
                    cursor: 'pointer', backgroundColor: '#0284c7', color: '#fff',
                  }}
                >
                  Testar
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ONU list */}
      <div style={card}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, gap: 12, flexWrap: 'wrap' }}>
          <SectionTitle>ONUs ({filtered.length})</SectionTitle>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {/* Auto-monitor toggle */}
            <button
              onClick={() => setMonitorActive(m => !m)}
              style={{
                fontSize: 11, fontWeight: 600, padding: '5px 12px',
                borderRadius: 6, border: 'none', cursor: 'pointer',
                backgroundColor: monitorActive ? '#16a34a22' : 'var(--inp-bg)',
                color: monitorActive ? '#4ade80' : 'var(--text-muted)',
                outline: monitorActive ? '1px solid #16a34a55' : '1px solid var(--border-color)',
                display: 'flex', alignItems: 'center', gap: 5,
              }}
            >
              {monitorActive && (
                <span style={{
                  display: 'inline-block', width: 6, height: 6, borderRadius: '50%',
                  backgroundColor: '#22c55e',
                  animation: 'noc-blink 1s ease-in-out infinite',
                }} />
              )}
              Monitor Auto
            </button>
            <input
              style={{ ...inp, width: 220 }}
              type="text"
              placeholder="Buscar serial, cliente, CTO..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
        </div>

        {/* Filter chips */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
          {STATUS_CHIPS.map(chip => {
            const active = statusFilter === chip.id
            return (
              <button
                key={chip.id}
                onClick={() => setStatusFilter(chip.id)}
                style={{
                  fontSize: 11, fontWeight: 600, padding: '4px 12px',
                  borderRadius: 99, cursor: 'pointer', border: 'none',
                  backgroundColor: active ? chip.color : 'var(--inp-bg)',
                  color: active ? '#fff' : 'var(--text-muted)',
                  outline: active ? 'none' : `1px solid var(--border-color)`,
                  transition: 'background-color 0.15s, color 0.15s',
                }}
              >
                {chip.label}
              </button>
            )
          })}
        </div>

        {filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text-muted)', fontSize: 13 }}>
            {onus.length === 0 ? 'Nenhuma ONU provisionada.' : 'Nenhum resultado.'}
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <TH>Cliente</TH>
                  <TH>Serial</TH>
                  <TH>CTO</TH>
                  <TH right>Porta</TH>
                  <TH>OLT</TH>
                  <TH right>PON</TH>
                  <TH right>RX (dBm)</TH>
                  <TH>Qualidade</TH>
                  <TH>Status</TH>
                  <TH>Diagnóstico</TH>
                  <TH>Teste</TH>
                </tr>
              </thead>
              <tbody>
                {filtered.map((o, i) => {
                  const diagColor =
                    !o.last_diagnostic ? 'var(--text-muted)'
                    : o.last_diagnostic.toLowerCase().includes('normal') ? '#22c55e'
                    : o.last_diagnostic.toLowerCase().includes('atenuação') ||
                      o.last_diagnostic.toLowerCase().includes('saturação') ? '#f59e0b'
                    : '#ef4444'

                  return (
                    <tr key={o._id ?? i}>
                      <TD bold>{o.cliente ?? '—'}</TD>
                      <TD mono>{o.serial}</TD>
                      <TD mono muted>{o.cto_id ?? '—'}</TD>
                      <TD right muted>{o.cto_port ?? '—'}</TD>
                      <TD mono muted>{o.olt_id ?? '—'}</TD>
                      <TD right muted>{o.pon_port ?? '—'}</TD>
                      <TD right mono>
                        {o.rx_power != null ? (
                          <span style={{ color: SIGNAL_QUALITY[o.signal_quality]?.color ?? 'var(--foreground)' }}>
                            {o.rx_power.toFixed(2)}
                          </span>
                        ) : '—'}
                      </TD>
                      <TD><SignalBadge quality={o.signal_quality} /></TD>
                      <TD><StatusBadge statusMap={STATUS_ONU} status={o.status} /></TD>
                      <TD>
                        {o.last_diagnostic ? (
                          <span style={{ fontSize: 11, color: diagColor, fontWeight: 600 }}>
                            {o.last_diagnostic.length > 30
                              ? o.last_diagnostic.slice(0, 28) + '…'
                              : o.last_diagnostic}
                          </span>
                        ) : (
                          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>—</span>
                        )}
                      </TD>
                      <TD>
                        <button
                          onClick={() => setTestingSerial(o.serial)}
                          style={{
                            fontSize: 11, fontWeight: 600,
                            padding: '4px 10px', borderRadius: 6,
                            border: 'none', cursor: 'pointer',
                            backgroundColor: '#0284c722',
                            color: '#38bdf8',
                          }}
                        >
                          Testar
                        </button>
                      </TD>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Diagnostic legend */}
      <div style={{ ...card, padding: '14px 18px' }}>
        <SectionTitle>Referência de Diagnóstico</SectionTitle>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 10 }}>
          {[
            { color: '#22c55e', label: 'RX > -20 dBm',       desc: 'Sinal excelente' },
            { color: '#4ade80', label: 'RX -20 a -25 dBm',   desc: 'Sinal bom' },
            { color: '#f59e0b', label: 'RX -25 a -28 dBm',   desc: 'Alta atenuação — verificar CTO/fusão' },
            { color: '#ef4444', label: 'RX < -28 dBm',        desc: 'Crítico — fibra ou ONU com problema' },
            { color: '#ef4444', label: 'Offline sem RX',       desc: 'ONU desligada / sem energia' },
            { color: '#ef4444', label: 'Offline + RX < -30',  desc: 'Possível fibra rompida' },
            { color: '#f59e0b', label: 'TX > 5 dBm',          desc: 'Saturação — problema de transmissão' },
            { color: '#22c55e', label: 'TX 1 – 5 dBm',        desc: 'Retorno da ONU OK' },
          ].map((r, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: r.color, flexShrink: 0 }} />
              <div>
                <span style={{ fontSize: 11, fontFamily: 'monospace', color: r.color, fontWeight: 600 }}>{r.label}</span>
                <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 4 }}>— {r.desc}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Provision form */}
      <div style={card}>
        <SectionTitle>Provisionar / Cancelar ONU</SectionTitle>
        <FeedbackBanner feedback={feedback} />

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={lbl}>Serial ONU *</label>
              <input style={inp} type="text" placeholder="ZTEG1A2B3C4D" value={form.serial} onChange={e => setForm(f => ({ ...f, serial: e.target.value }))} />
            </div>
            <div>
              <label style={lbl}>Nome do Cliente</label>
              <input style={inp} type="text" placeholder="João da Silva" value={form.cliente} onChange={e => setForm(f => ({ ...f, cliente: e.target.value }))} />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            <div>
              <label style={lbl}>OLT</label>
              <select
                style={{ ...inp }}
                value={form.oltId}
                onChange={e => setForm(f => ({ ...f, oltId: e.target.value, ponPort: '' }))}
              >
                <option value="">Auto / selecionar OLT...</option>
                {olts.map(olt => (
                  <option key={olt.id} value={olt.id}>
                    {olt.nome}{olt.ip ? ` (${olt.ip})` : ''}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label style={lbl}>Porta PON</label>
              <input
                style={inp}
                type="number"
                min="0"
                placeholder={selectedOlt ? `0 – ${(selectedOlt.capacidade ?? 16) - 1}` : '0'}
                value={form.ponPort}
                onChange={e => setForm(f => ({ ...f, ponPort: e.target.value }))}
              />
            </div>
            <div>
              <label style={lbl}>CTO ID (auto se vazio)</label>
              <input style={inp} type="text" placeholder="CTO-001" value={form.ctoId} onChange={e => setForm(f => ({ ...f, ctoId: e.target.value }))} />
            </div>
          </div>

          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button
              style={{ ...btn('#0284c7'), display: 'inline-flex', alignItems: 'center', gap: 8, opacity: (provisioning || cancelling) ? 0.7 : 1 }}
              onClick={handleProvision}
              disabled={provisioning || cancelling}
            >
              {provisioning && <Spinner />}
              Provisionar ONU
            </button>
            <button
              style={{ ...btn('#dc2626'), display: 'inline-flex', alignItems: 'center', gap: 8, opacity: (provisioning || cancelling) ? 0.7 : 1 }}
              onClick={handleCancel}
              disabled={provisioning || cancelling}
            >
              {cancelling && <Spinner />}
              Cancelar ONU
            </button>
            <button
              style={btnOutline}
              onClick={() => setForm({ serial: '', cliente: '', oltId: '', ponPort: '', ctoId: '' })}
              disabled={provisioning || cancelling}
            >
              Limpar
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── TAB 3: TOPOLOGIA ─────────────────────────────────────────────────────────

function CTOCard({ cto }) {
  const [expanded, setExpanded] = useState(false)
  const pct   = cto.pct ?? (cto.capacidade > 0 ? Math.min(100, Math.round(((cto.ocupadas ?? cto.ocupacao ?? 0) / cto.capacidade) * 100)) : 0)
  const color = barColor(pct)
  const ports = cto.ports ?? []

  return (
    <div style={{
      backgroundColor: 'var(--inp-bg)',
      border: '1px solid var(--border-color)',
      borderRadius: 10,
      overflow: 'hidden',
    }}>
      {/* Header — always visible */}
      <div
        style={{ padding: '12px 14px', cursor: 'pointer', userSelect: 'none' }}
        onClick={() => setExpanded(v => !v)}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
          <div>
            <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--foreground)', margin: 0 }}>{cto.id ?? cto.cto_id}</p>
            {cto.name && cto.name !== (cto.id ?? cto.cto_id) && (
              <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: '2px 0 0' }}>{cto.name}</p>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{
              padding: '2px 8px', borderRadius: 99,
              backgroundColor: color + '22', border: `1px solid ${color}55`,
              color, fontSize: 11, fontWeight: 700,
            }}>
              {pct}%
            </span>
            <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{expanded ? '▲' : '▼'}</span>
          </div>
        </div>

        {/* Occupancy bar */}
        <div style={{ height: 5, borderRadius: 99, backgroundColor: 'var(--border-color)', overflow: 'hidden', marginBottom: 6 }}>
          <div style={{ height: '100%', width: `${pct}%`, backgroundColor: color, borderRadius: 99 }} />
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-muted)' }}>
          <span>
            <span style={{ color: '#ef4444', fontWeight: 600 }}>{cto.ocupadas ?? cto.ocupacao ?? 0}</span>
            {' / '}
            {cto.capacidade ?? ports.length} portas
            {(cto.livres ?? 0) > 0 && (
              <span style={{ color: '#22c55e', marginLeft: 6 }}>· {cto.livres} livre{cto.livres !== 1 ? 's' : ''}</span>
            )}
          </span>
          {cto.cdo_id && (
            <span>CDO: <span style={{ fontFamily: 'monospace', color: 'var(--foreground)' }}>{cto.cdo_id}</span></span>
          )}
        </div>
      </div>

      {/* Port list — expanded */}
      {expanded && (
        <div style={{
          borderTop: '1px solid var(--border-color)',
          maxHeight: 280,
          overflowY: 'auto',
        }}>
          {ports.length === 0 ? (
            <p style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center', padding: '12px 0' }}>
              Nenhuma porta mapeada no diagrama.
            </p>
          ) : (
            ports.map((p) => {
              const occupied  = p.status === 'OCUPADO'
              const dotColor  = occupied ? '#ef4444' : '#22c55e'
              const sqColor   = p.client?.signal_quality ? SIGNAL_QUALITY[p.client.signal_quality]?.color : null
              return (
                <div
                  key={p.port_number}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '6px 14px',
                    borderBottom: '1px solid var(--border-color)',
                    fontSize: 12,
                  }}
                >
                  {/* Port dot */}
                  <span style={{
                    width: 8, height: 8, borderRadius: '50%',
                    backgroundColor: dotColor,
                    flexShrink: 0,
                  }} />

                  {/* Port number */}
                  <span style={{ color: 'var(--text-muted)', fontFamily: 'monospace', minWidth: 54 }}>
                    Porta {String(p.port_number).padStart(2, '0')}
                  </span>

                  {/* Client or "Livre" */}
                  {occupied ? (
                    <span style={{ color: 'var(--foreground)', fontWeight: 600, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {p.client?.name ?? '—'}
                    </span>
                  ) : (
                    <span style={{ color: 'var(--text-muted)', flex: 1 }}>Livre</span>
                  )}

                  {/* RX power badge for occupied ports */}
                  {occupied && p.client?.rx_power != null && (
                    <span style={{ fontSize: 10, color: sqColor ?? 'var(--text-muted)', fontFamily: 'monospace', flexShrink: 0 }}>
                      {p.client.rx_power.toFixed(1)} dBm
                    </span>
                  )}

                  {/* Splitter label */}
                  {p.splitter_nome && (
                    <span style={{ fontSize: 10, color: 'var(--text-muted)', flexShrink: 0 }}>
                      {p.splitter_nome}
                    </span>
                  )}
                </div>
              )
            })
          )}
        </div>
      )}
    </div>
  )
}

function TopologiaTab({ ctos: ctosBasic = [], olts = [] }) {
  const [ctosFull, setCtosFull]   = useState(null)
  const [loading,  setLoading]    = useState(true)
  const [fetchErr, setFetchErr]   = useState(null)

  useEffect(() => {
    setLoading(true)
    fetch('/api/ctos/full')
      .then(r => r.ok ? r.json() : Promise.reject(r.statusText))
      .then(data => { setCtosFull(data); setLoading(false) })
      .catch(e  => { setFetchErr(String(e)); setLoading(false) })
  }, [])

  // Prefer full data (with ports); fall back to basic stats list
  const ctos = ctosFull ?? ctosBasic.map(c => ({
    id:         c.cto_id,
    name:       c.nome,
    cdo_id:     c.cdo_id,
    capacidade: c.capacidade,
    ocupadas:   c.ocupacao,
    livres:     (c.capacidade ?? 0) - (c.ocupacao ?? 0),
    pct:        c.capacidade > 0 ? Math.min(100, Math.round((c.ocupacao / c.capacidade) * 100)) : 0,
    ports:      [],
  }))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* OLT table */}
      <div style={card}>
        <SectionTitle>OLTs ({olts.length})</SectionTitle>
        {olts.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '20px 0', color: 'var(--text-muted)', fontSize: 13 }}>
            Nenhuma OLT cadastrada.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <TH>Nome</TH>
                  <TH>IP</TH>
                  <TH>Modelo</TH>
                  <TH>Status</TH>
                  <TH right>Capacidade</TH>
                </tr>
              </thead>
              <tbody>
                {olts.map((o, i) => {
                  const status = STATUS_OLT[o.status] ? o.status : 'ativo'
                  return (
                    <tr key={o._id ?? o.id ?? i}>
                      <TD bold>{o.nome || o.id || '—'}</TD>
                      <TD mono muted>{o.ip || '—'}</TD>
                      <TD muted>{o.modelo || '—'}</TD>
                      <TD><StatusBadge statusMap={STATUS_OLT} status={status} /></TD>
                      <TD right muted>{o.capacidade ?? '—'}</TD>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* CTO grid */}
      <div style={card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--foreground)', margin: 0 }}>
            CTOs — Portas por Cliente ({ctos.length})
          </p>
          {loading && <Spinner />}
          {fetchErr && <span style={{ fontSize: 12, color: '#ef4444' }}>{fetchErr}</span>}
        </div>
        {ctos.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '20px 0', color: 'var(--text-muted)', fontSize: 13 }}>
            Nenhuma CTO cadastrada.
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
            {ctos.map((cto, i) => (
              <CTOCard key={cto.id ?? cto.cto_id ?? i} cto={cto} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── TAB 4: SGP ───────────────────────────────────────────────────────────────

function SGPTab({ sgpStatus, onLog }) {
  const [sgpForm, setSgpForm]         = useState({ host: '', username: '', password: '' })
  const [savingCreds, setSavingCreds] = useState(false)
  const [fetching, setFetching]       = useState(false)
  const [applying, setApplying]       = useState(false)
  const [diff, setDiff]               = useState(null)
  const [selectedInstalls, setSelectedInstalls] = useState([])
  const [selectedCancels,  setSelectedCancels]  = useState([])
  const [feedback, setFeedback]       = useState(null)

  function showFeedback(type, message) {
    setFeedback({ type, message })
    setTimeout(() => setFeedback(null), 5000)
  }

  async function handleSaveCreds() {
    if (!sgpForm.host.trim()) { showFeedback('error', 'Host é obrigatório.'); return }
    setSavingCreds(true)
    try {
      const { saveSGPConfig } = await import('@/actions/sgp')
      await saveSGPConfig({ host: sgpForm.host.trim(), username: sgpForm.username.trim(), password: sgpForm.password })
      showFeedback('success', 'Credenciais salvas. Recarregue a página.')
      onLog('SGP', 'Credenciais configuradas', 'success')
    } catch (e) {
      showFeedback('error', e.message)
      onLog('SGP', e.message, 'error')
    } finally {
      setSavingCreds(false)
    }
  }

  async function handleFetch() {
    setFetching(true)
    setDiff(null)
    setSelectedInstalls([])
    setSelectedCancels([])
    onLog('SGP', 'Buscando dados do SGP...', 'info')
    try {
      const { fetchFromSGP } = await import('@/actions/sgp')
      const result = await fetchFromSGP()
      setDiff(result)
      const msg = `${result.novos.length} novos, ${result.cancelamentos.length} cancelamentos detectados`
      onLog('SGP', msg, 'info')
      if (result.novos.length === 0 && result.cancelamentos.length === 0) {
        showFeedback('success', 'SGP sincronizado — sem diferenças.')
      }
    } catch (e) {
      showFeedback('error', e.message)
      onLog('SGP', e.message, 'error')
    } finally {
      setFetching(false)
    }
  }

  async function handleApply() {
    const installs = (diff?.novos ?? []).filter(n => selectedInstalls.includes(n.serial))
    const cancels  = (diff?.cancelamentos ?? []).filter(c => selectedCancels.includes(c.serial))
    if (installs.length === 0 && cancels.length === 0) {
      showFeedback('error', 'Selecione ao menos um item.')
      return
    }
    setApplying(true)
    onLog('SGP', `Aplicando ${installs.length + cancels.length} itens selecionados`, 'info')
    try {
      const { applyFromSGP } = await import('@/actions/sgp')
      const result = await applyFromSGP({ installs, cancels })
      showFeedback('success', `${result.criados} eventos enfileirados para processamento.`)
      onLog('SGP', `${result.criados} eventos criados`, 'success')
      setDiff(null)
      setSelectedInstalls([])
      setSelectedCancels([])
    } catch (e) {
      showFeedback('error', e.message)
      onLog('SGP', e.message, 'error')
    } finally {
      setApplying(false)
    }
  }

  function toggleInstall(serial) {
    setSelectedInstalls(prev => prev.includes(serial) ? prev.filter(s => s !== serial) : [...prev, serial])
  }

  function toggleCancel(serial) {
    setSelectedCancels(prev => prev.includes(serial) ? prev.filter(s => s !== serial) : [...prev, serial])
  }

  const isConfigured = sgpStatus?.isConfigured ?? false

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <FeedbackBanner feedback={feedback} />

      {/* Connection card */}
      <div style={card}>
        <SectionTitle>Integração SGP / TMSX</SectionTitle>

        {isConfigured ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '4px 12px', borderRadius: 99,
                backgroundColor: '#052e1688', border: '1px solid #166534',
                color: '#4ade80', fontSize: 12, fontWeight: 600,
              }}>
                <span style={{ width: 7, height: 7, borderRadius: '50%', backgroundColor: '#4ade80', display: 'inline-block' }} />
                Configurado
              </span>
              <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                Host: <strong style={{ color: 'var(--foreground)' }}>{sgpStatus.host}</strong>
              </span>
              {sgpStatus.username && (
                <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                  Usuário: <strong style={{ color: 'var(--foreground)' }}>{sgpStatus.username}</strong>
                </span>
              )}
            </div>
            {sgpStatus.lastSync && (
              <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                Última consulta: {fmtTs(sgpStatus.lastSync)}
                {sgpStatus.lastSyncStats && (
                  <> — {sgpStatus.lastSyncStats.novos ?? 0} novos, {sgpStatus.lastSyncStats.cancelamentos ?? 0} cancelamentos</>
                )}
              </p>
            )}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>SGP não configurado.</p>
            <div>
              <label style={lbl}>Host (URL ou &apos;mock&apos;)</label>
              <input style={inp} type="text" placeholder="https://sgp.empresa.com.br" value={sgpForm.host} onChange={e => setSgpForm(f => ({ ...f, host: e.target.value }))} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={lbl}>Usuário</label>
                <input style={inp} type="text" value={sgpForm.username} onChange={e => setSgpForm(f => ({ ...f, username: e.target.value }))} />
              </div>
              <div>
                <label style={lbl}>Senha</label>
                <input style={inp} type="password" value={sgpForm.password} onChange={e => setSgpForm(f => ({ ...f, password: e.target.value }))} />
              </div>
            </div>
            <button
              style={{ ...btn('#0284c7'), display: 'inline-flex', alignItems: 'center', gap: 8, alignSelf: 'flex-start', opacity: savingCreds ? 0.7 : 1 }}
              onClick={handleSaveCreds}
              disabled={savingCreds}
            >
              {savingCreds && <Spinner />}
              Salvar Credenciais
            </button>
          </div>
        )}
      </div>

      {/* Diff viewer */}
      {isConfigured && (
        <div style={card}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, gap: 12, flexWrap: 'wrap' }}>
            <SectionTitle>Comparar com SGP</SectionTitle>
            <button
              style={{ ...btn(fetching ? '#475569' : '#0284c7'), display: 'inline-flex', alignItems: 'center', gap: 8, opacity: (fetching || applying) ? 0.8 : 1 }}
              onClick={handleFetch}
              disabled={fetching || applying}
            >
              {fetching && <Spinner />}
              {fetching ? 'Buscando...' : 'Atualizar dados do SGP'}
            </button>
          </div>

          <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 16 }}>
            Consulta o SGP em modo leitura e mostra as diferenças. Nenhum dado é alterado até você confirmar.
          </p>

          {diff && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Novos */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <p style={{ fontSize: 12, fontWeight: 700, color: '#4ade80' }}>
                    ✚ {diff.novos.length} novos clientes encontrados
                  </p>
                  {diff.novos.length > 0 && (
                    <button style={{ ...btnOutline, fontSize: 11, padding: '4px 10px' }} onClick={() => setSelectedInstalls(diff.novos.map(n => n.serial))}>
                      Todos
                    </button>
                  )}
                </div>
                {diff.novos.length === 0 ? (
                  <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>Nenhum cliente novo.</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {diff.novos.map(n => {
                      const checked = selectedInstalls.includes(n.serial)
                      return (
                        <label key={n.serial} style={{
                          display: 'flex', alignItems: 'center', gap: 10,
                          padding: '8px 12px', borderRadius: 8, cursor: 'pointer',
                          backgroundColor: checked ? '#052e16aa' : 'var(--inp-bg)',
                          border: `1px solid ${checked ? '#16a34a' : 'var(--border-color)'}`,
                          transition: 'background-color 0.15s, border-color 0.15s',
                        }}>
                          <input type="checkbox" checked={checked} onChange={() => toggleInstall(n.serial)} style={{ accentColor: '#22c55e', width: 14, height: 14 }} />
                          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--foreground)' }}>{n.nome}</span>
                          <span style={{ fontSize: 11, fontFamily: 'monospace', color: 'var(--text-muted)' }}>{n.serial}</span>
                        </label>
                      )
                    })}
                  </div>
                )}
              </div>

              {/* Cancelamentos */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <p style={{ fontSize: 12, fontWeight: 700, color: '#f87171' }}>
                    ✕ {diff.cancelamentos.length} clientes cancelados no SGP
                  </p>
                  {diff.cancelamentos.length > 0 && (
                    <button style={{ ...btnOutline, fontSize: 11, padding: '4px 10px' }} onClick={() => setSelectedCancels(diff.cancelamentos.map(c => c.serial))}>
                      Todos
                    </button>
                  )}
                </div>
                {diff.cancelamentos.length === 0 ? (
                  <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>Nenhum cancelamento.</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {diff.cancelamentos.map(c => {
                      const checked = selectedCancels.includes(c.serial)
                      return (
                        <label key={c.serial} style={{
                          display: 'flex', alignItems: 'center', gap: 10,
                          padding: '8px 12px', borderRadius: 8, cursor: 'pointer',
                          backgroundColor: checked ? '#3d0a0aaa' : 'var(--inp-bg)',
                          border: `1px solid ${checked ? '#7f1d1d' : 'var(--border-color)'}`,
                          transition: 'background-color 0.15s, border-color 0.15s',
                        }}>
                          <input type="checkbox" checked={checked} onChange={() => toggleCancel(c.serial)} style={{ accentColor: '#ef4444', width: 14, height: 14 }} />
                          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--foreground)' }}>{c.nome}</span>
                          <span style={{ fontSize: 11, fontFamily: 'monospace', color: 'var(--text-muted)' }}>{c.serial}</span>
                        </label>
                      )
                    })}
                  </div>
                )}
              </div>

              {(selectedInstalls.length > 0 || selectedCancels.length > 0) && (
                <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: 14 }}>
                  <button
                    style={{ ...btn('#0284c7'), display: 'inline-flex', alignItems: 'center', gap: 8, opacity: applying ? 0.7 : 1 }}
                    onClick={handleApply}
                    disabled={applying}
                  >
                    {applying && <Spinner />}
                    Aplicar Selecionados ({selectedInstalls.length + selectedCancels.length})
                  </button>
                  <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 8 }}>
                    Eventos de provisionamento serão criados e processados na fila.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Diagnostic Modal ─────────────────────────────────────────────────────────

const NIVEL_STYLE = {
  ok:      { bg: '#052e16', border: '#16a34a', text: '#4ade80', label: 'OK',      icon: '✅' },
  atencao: { bg: '#422006', border: '#d97706', text: '#fbbf24', label: 'ATENÇÃO', icon: '⚠️' },
  critico: { bg: '#450a0a', border: '#dc2626', text: '#f87171', label: 'CRÍTICO', icon: '🚨' },
  unknown: { bg: '#1c1c1c', border: '#444',    text: '#aaa',    label: '...',      icon: '❓' },
}

function DiagnosticModal({ serial, onClose }) {
  const [loading, setLoading] = useState(true)
  const [result,  setResult]  = useState(null)
  const [error,   setError]   = useState(null)

  useEffect(() => {
    let cancelled = false
    async function run() {
      try {
        const { testOnuConnection } = await import('@/actions/provisioning')
        const res = await testOnuConnection({ serial })
        if (!cancelled) { setResult(res); setLoading(false) }
      } catch (e) {
        if (!cancelled) { setError(e.message); setLoading(false) }
      }
    }
    run()
    return () => { cancelled = true }
  }, [serial])

  const ns = NIVEL_STYLE[result?.nivel ?? 'unknown']

  const rxColor = result
    ? result.rx_raw == null      ? 'var(--text-muted)'
    : result.rx_raw > -20        ? '#22c55e'
    : result.rx_raw >= -25       ? '#4ade80'
    : result.rx_raw >= -28       ? '#f59e0b'
    : '#ef4444'
    : 'var(--text-muted)'

  const txColor = result
    ? result.tx_raw == null      ? 'var(--text-muted)'
    : result.tx_raw > 5          ? '#ef4444'
    : result.tx_raw < 1          ? '#f59e0b'
    : '#22c55e'
    : 'var(--text-muted)'

  const statusColor = result?.status === 'online' ? '#22c55e' : '#ef4444'

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      backgroundColor: 'rgba(0,0,0,0.6)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{
        ...card,
        width: '100%', maxWidth: 520,
        maxHeight: '90vh', overflowY: 'auto',
        display: 'flex', flexDirection: 'column', gap: 16,
      }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <p style={{ fontWeight: 700, fontSize: 15 }}>Testar Conexão — {serial}</p>
          <button onClick={onClose} style={{ ...btnOutline, padding: '4px 10px' }}>✕</button>
        </div>

        {loading && (
          <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--text-muted)' }}>
            <Spinner /> <span style={{ marginLeft: 8, fontSize: 13 }}>Conectando à OLT…</span>
          </div>
        )}

        {error && (
          <div style={{
            backgroundColor: '#450a0a', border: '1px solid #dc2626',
            borderRadius: 8, padding: 14, fontSize: 13, color: '#f87171',
          }}>
            Erro: {error}
          </div>
        )}

        {result && (
          <>
            {/* Status row */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div style={{ ...card, padding: '14px 16px' }}>
                <p style={{ ...lbl, marginBottom: 6 }}>Status</p>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{
                    width: 10, height: 10, borderRadius: '50%',
                    backgroundColor: statusColor, boxShadow: `0 0 6px ${statusColor}`,
                    flexShrink: 0,
                  }} />
                  <span style={{ fontSize: 15, fontWeight: 700, color: statusColor, textTransform: 'uppercase' }}>
                    {result.status}
                  </span>
                </div>
                {result.last_down_cause && (
                  <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>
                    Causa: {result.last_down_cause}
                  </p>
                )}
              </div>

              <div style={{ ...card, padding: '14px 16px' }}>
                <p style={{ ...lbl, marginBottom: 6 }}>Diagnóstico</p>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 16 }}>{ns.icon}</span>
                  <span style={{
                    fontSize: 12, fontWeight: 700, color: ns.text,
                    padding: '2px 8px', borderRadius: 99,
                    backgroundColor: ns.bg, border: `1px solid ${ns.border}`,
                  }}>
                    {ns.label}
                  </span>
                </div>
              </div>
            </div>

            {/* Power readings */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div style={{ ...card, padding: '14px 16px' }}>
                <p style={{ ...lbl, marginBottom: 4 }}>RX (potência recebida)</p>
                <p style={{ fontSize: 22, fontWeight: 700, fontFamily: 'monospace', color: rxColor }}>
                  {result.rx}
                </p>
                <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                  {result.rx_raw == null       ? '—'
                  : result.rx_raw > -20        ? 'Excelente'
                  : result.rx_raw >= -25       ? 'Bom'
                  : result.rx_raw >= -28       ? 'Limite'
                  : 'Crítico'}
                </p>
              </div>

              <div style={{ ...card, padding: '14px 16px' }}>
                <p style={{ ...lbl, marginBottom: 4 }}>TX (retorno ONU)</p>
                <p style={{ fontSize: 22, fontWeight: 700, fontFamily: 'monospace', color: txColor }}>
                  {result.tx}
                </p>
                <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                  {result.tx_raw == null ? '—'
                  : result.tx_raw > 5   ? 'Muito alto'
                  : result.tx_raw < 1   ? 'Baixo'
                  : 'OK'}
                </p>
              </div>
            </div>

            {/* Diagnosis & recommendation */}
            <div style={{
              backgroundColor: ns.bg, border: `1px solid ${ns.border}`,
              borderRadius: 10, padding: 16,
            }}>
              <p style={{ fontSize: 13, fontWeight: 700, color: ns.text, marginBottom: 6 }}>
                {ns.icon} {result.problema}
              </p>
              <p style={{ fontSize: 12, color: ns.text, opacity: 0.85 }}>
                {result.recomendacao}
              </p>
            </div>

            {result.mock && (
              <p style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'center' }}>
                Modo simulação — conecte uma OLT real para dados ao vivo
              </p>
            )}
          </>
        )}

        <button onClick={onClose} style={{ ...btn('#374151'), alignSelf: 'flex-end' }}>
          Fechar
        </button>
      </div>
    </div>
  )
}

// ─── TAB 5: AUTO-FIND ─────────────────────────────────────────────────────────

// ─── Provision Modal ──────────────────────────────────────────────────────────

function ProvisionModal({ item, onConfirm, onCancel, loading }) {
  const [cliente,     setCliente]     = useState(item?.serial ?? '')
  const [vlan,        setVlan]        = useState('100')
  const [ponData,     setPonData]     = useState(null)    // null=loading, false=no-map, object=loaded
  const [ctoOverride, setCtoOverride] = useState('')      // '' = auto

  // Load PON mapping preview when modal opens
  useEffect(() => {
    if (!item?.olt_id || !item?.pon) {
      setPonData(false)
      return
    }
    let cancelled = false
    ;(async () => {
      try {
        const { getCtoSuggestionsForPon } = await import('@/actions/pon-cto-map')
        const res = await getCtoSuggestionsForPon({ olt_id: item.olt_id, pon: item.pon })
        if (!cancelled) setPonData(res)
      } catch {
        if (!cancelled) setPonData(false)
      }
    })()
    return () => { cancelled = true }
  }, [item?.olt_id, item?.pon])

  if (!item) return null

  const hasSuggestions = ponData?.mapped && ponData.suggestions?.length > 0
  const autoCto        = ponData?.selected_cto ?? null
  const effectiveCto   = ctoOverride
    ? ponData?.suggestions?.find(s => s.cto_id === ctoOverride) ?? null
    : autoCto

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      backgroundColor: 'rgba(0,0,0,0.55)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 16,
    }}>
      <div style={{
        ...card, width: 460, maxWidth: '95vw', maxHeight: '90vh', overflowY: 'auto',
        boxShadow: '0 20px 60px rgba(0,0,0,0.4)',
        display: 'flex', flexDirection: 'column', gap: 16,
      }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--foreground)', margin: 0 }}>Provisionar ONU</p>
            <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: '2px 0 0' }}>Detectada via Auto-Find (PON piscando)</p>
          </div>
          <button onClick={onCancel} style={{ ...btnOutline, padding: '4px 10px', fontSize: 16 }}>✕</button>
        </div>

        {/* ONU identity */}
        <div style={{ backgroundColor: 'var(--inp-bg)', border: '1px solid var(--border-color)', borderRadius: 8, padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: 6 }}>
          {[
            ['SERIAL',      <span style={{ fontFamily: 'monospace', fontWeight: 700 }}>{item.serial}</span>],
            ['OLT',         `${item.olt_nome ?? '—'} ${item.olt_ip ? `(${item.olt_ip})` : ''}`],
            ['PLACA / PON', <span style={{ fontFamily: 'monospace' }}>{item.board ?? '—'} / {item.pon ?? '—'}</span>],
          ].map(([k, v]) => (
            <div key={k} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 11, color: 'var(--text-muted)', flexShrink: 0 }}>{k}</span>
              <span style={{ fontSize: 12, color: 'var(--foreground)', textAlign: 'right' }}>{v}</span>
            </div>
          ))}
          {item.mock && (
            <span style={{ fontSize: 10, color: '#f59e0b', backgroundColor: 'rgba(245,158,11,0.1)', padding: '2px 6px', borderRadius: 4, alignSelf: 'flex-start' }}>MODO MOCK</span>
          )}
        </div>

        {/* PON → CTO mapping preview */}
        <div>
          <label style={{ ...lbl, marginBottom: 6 }}>MAPEAMENTO PON → CTO</label>

          {ponData === null && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-muted)', fontSize: 12 }}>
              <Spinner /> Verificando mapeamento PON...
            </div>
          )}

          {ponData === false && (
            <div style={{
              backgroundColor: 'var(--inp-bg)', border: '1px solid var(--border-color)',
              borderRadius: 8, padding: '8px 12px', fontSize: 12, color: 'var(--text-muted)',
            }}>
              Sem mapeamento PON configurado — será usada a primeira CTO disponível.
              <br />
              <span style={{ fontSize: 10 }}>Configure o mapeamento PON→CTO abaixo para vinculação inteligente.</span>
            </div>
          )}

          {ponData?.mapped === false && (
            <div style={{
              backgroundColor: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.3)',
              borderRadius: 8, padding: '8px 12px', fontSize: 12, color: '#f59e0b',
            }}>
              PON <strong>{item.pon}</strong> sem mapeamento — será usada a primeira CTO disponível.
            </div>
          )}

          {hasSuggestions && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {/* Auto-selected CTO info */}
              {autoCto && (
                <div style={{
                  backgroundColor: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.3)',
                  borderRadius: 8, padding: '8px 12px', fontSize: 12,
                }}>
                  <span style={{ color: '#22c55e', fontWeight: 700 }}>✓ Auto-assign:</span>{' '}
                  <span style={{ color: 'var(--foreground)' }}>
                    CTO <strong>{autoCto.nome}</strong> ({autoCto.livres} porta{autoCto.livres !== 1 ? 's' : ''} livre{autoCto.livres !== 1 ? 's' : ''})
                    — <span style={{ color: 'var(--text-muted)' }}>posição {autoCto.ordem + 1} na fibra</span>
                  </span>
                  <br />
                  <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                    PON {item.pon} atende {ponData.suggestions.length} CTO{ponData.suggestions.length > 1 ? 's' : ''}
                  </span>
                </div>
              )}

              {/* All CTOs on this PON */}
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                  <thead>
                    <tr>
                      <TH>Ord.</TH>
                      <TH>CTO</TH>
                      <TH>Portas Livres</TH>
                      <TH>Status</TH>
                    </tr>
                  </thead>
                  <tbody>
                    {ponData.suggestions.map((s, i) => (
                      <tr key={s.cto_id} style={{ backgroundColor: autoCto?.cto_id === s.cto_id ? 'rgba(34,197,94,0.05)' : 'transparent' }}>
                        <TD mono muted>{s.ordem}</TD>
                        <TD bold>{s.nome}</TD>
                        <TD mono muted>{s.livres}</TD>
                        <TD>
                          <span style={{
                            fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 4,
                            backgroundColor: s.available ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)',
                            color: s.available ? '#22c55e' : '#ef4444',
                          }}>
                            {s.available ? 'DISPONÍVEL' : 'CHEIA'}
                          </span>
                          {autoCto?.cto_id === s.cto_id && (
                            <span style={{ marginLeft: 4, fontSize: 10, color: '#22c55e' }}>← auto</span>
                          )}
                        </TD>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Override selector */}
              <div>
                <label style={{ ...lbl, marginBottom: 4 }}>SOBRESCREVER CTO (opcional)</label>
                <select
                  style={{ ...inp, width: '100%' }}
                  value={ctoOverride}
                  onChange={e => setCtoOverride(e.target.value)}
                  disabled={loading}
                >
                  <option value="">— Auto (recomendado: {autoCto?.nome ?? 'primeira disponível'}) —</option>
                  {ponData.suggestions.filter(s => s.available).map(s => (
                    <option key={s.cto_id} value={s.cto_id}>
                      {s.nome} (posição {s.ordem}, {s.livres} livres)
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}
        </div>

        {/* Client name */}
        <div>
          <label style={lbl}>NOME DO CLIENTE</label>
          <input
            style={inp}
            value={cliente}
            onChange={e => setCliente(e.target.value)}
            placeholder="Ex: João Silva"
            disabled={loading}
          />
          <p style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4 }}>
            Deixe em branco para usar o serial como identificador.
          </p>
        </div>

        {/* VLAN */}
        <div>
          <label style={lbl}>VLAN</label>
          <input
            style={{ ...inp, width: 120 }}
            type="number"
            value={vlan}
            onChange={e => setVlan(e.target.value)}
            min={1} max={4094}
            disabled={loading}
          />
        </div>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={onCancel} style={btnOutline} disabled={loading}>Cancelar</button>
          <button
            onClick={() => onConfirm({
              cliente:     cliente.trim() || item.serial,
              vlan:        Number(vlan) || 100,
              ctoOverride: ctoOverride || null,
            })}
            style={{ ...btn('#16a34a'), display: 'inline-flex', alignItems: 'center', gap: 8, opacity: loading ? 0.8 : 1 }}
            disabled={loading}
          >
            {loading && <Spinner />}
            {loading ? 'Provisionando...' : 'Confirmar e Provisionar'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Signal Report Modal ──────────────────────────────────────────────────────

function SignalReportModal({ result, onClose }) {
  if (!result) return null
  const sig = analyzeSignal(result.rx_power, result.tx_power)

  const statusColor = sig.statusGeral === 'OK' ? '#22c55e' : sig.statusGeral === 'ATENÇÃO' ? '#f59e0b' : '#ef4444'

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      backgroundColor: 'rgba(0,0,0,0.6)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 16,
    }}>
      <div style={{
        ...card, width: 520, maxWidth: '95vw', maxHeight: '90vh', overflowY: 'auto',
        boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
        display: 'flex', flexDirection: 'column', gap: 14,
      }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
              <span style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: statusColor, display: 'inline-block', boxShadow: `0 0 8px ${statusColor}` }} />
              <p style={{ fontSize: 15, fontWeight: 700, color: 'var(--foreground)', margin: 0 }}>
                Relatório Técnico — ONU Provisionada
              </p>
            </div>
            <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: 0 }}>Padrão UNM — FiberOps NOC</p>
          </div>
          <button onClick={onClose} style={{ ...btnOutline, padding: '4px 10px', fontSize: 16, flexShrink: 0 }}>✕</button>
        </div>

        {/* Identity */}
        <div style={{ backgroundColor: 'var(--inp-bg)', border: '1px solid var(--border-color)', borderRadius: 8, padding: '10px 14px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 16px' }}>
          {[
            ['SERIAL', result.serial],
            ['CLIENTE', result.cliente],
            ['OLT', result.olt_ip ?? '—'],
            ['PLACA', result.board ?? '—'],
            ['PON', result.pon ?? '—'],
            ['CTO', result.cto_id ?? '—'],
          ].map(([k, v]) => (
            <div key={k}>
              <span style={{ fontSize: 10, color: 'var(--text-muted)', display: 'block' }}>{k}</span>
              <span style={{ fontSize: 12, fontFamily: 'monospace', color: 'var(--foreground)', fontWeight: 600 }}>{v}</span>
            </div>
          ))}
        </div>

        {/* Optical readings */}
        <div>
          <p style={{ ...lbl, marginBottom: 8 }}>Sinal Óptico</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {/* RX */}
            <div style={{
              border: `1px solid ${SIG_COLOR[sig.rxClass]}40`,
              borderLeft: `3px solid ${SIG_COLOR[sig.rxClass]}`,
              borderRadius: 8, padding: '10px 14px',
              backgroundColor: `${SIG_COLOR[sig.rxClass]}0d`,
            }}>
              <p style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 4 }}>RX — CHEGADA (ONU)</p>
              <p style={{ fontSize: 22, fontWeight: 800, color: SIG_COLOR[sig.rxClass], margin: '0 0 2px', fontFamily: 'monospace' }}>
                {result.rx_power != null ? `${result.rx_power.toFixed(2)}` : 'N/D'}
                <span style={{ fontSize: 12, fontWeight: 400, marginLeft: 2 }}>dBm</span>
              </p>
              <span style={{ fontSize: 11, fontWeight: 700, color: SIG_COLOR[sig.rxClass] }}>{sig.rxQuality}</span>
            </div>
            {/* TX */}
            <div style={{
              border: `1px solid ${SIG_COLOR[sig.txClass]}40`,
              borderLeft: `3px solid ${SIG_COLOR[sig.txClass]}`,
              borderRadius: 8, padding: '10px 14px',
              backgroundColor: `${SIG_COLOR[sig.txClass]}0d`,
            }}>
              <p style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 4 }}>TX — RETORNO (OLT)</p>
              <p style={{ fontSize: 22, fontWeight: 800, color: SIG_COLOR[sig.txClass], margin: '0 0 2px', fontFamily: 'monospace' }}>
                {result.tx_power != null ? `${result.tx_power.toFixed(2)}` : 'N/D'}
                <span style={{ fontSize: 12, fontWeight: 400, marginLeft: 2 }}>dBm</span>
              </p>
              <span style={{ fontSize: 11, fontWeight: 700, color: SIG_COLOR[sig.txClass] }}>{sig.txStatus}</span>
            </div>
          </div>
        </div>

        {/* Status geral */}
        <div style={{
          borderRadius: 8, padding: '10px 14px',
          backgroundColor: `${statusColor}15`,
          border: `1px solid ${statusColor}40`,
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <span style={{ fontSize: 18 }}>{sig.statusGeral === 'OK' ? '✅' : sig.statusGeral === 'ATENÇÃO' ? '⚠️' : '🚨'}</span>
          <div>
            <p style={{ fontSize: 12, fontWeight: 700, color: statusColor, margin: 0 }}>Status Geral: {sig.statusGeral}</p>
            {sig.diags.length === 0
              ? <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: '2px 0 0' }}>Sem alertas — operação normal</p>
              : sig.diags.map((d, i) => <p key={i} style={{ fontSize: 11, color: statusColor, margin: '2px 0 0' }}>• {d}</p>)
            }
          </div>
        </div>

        {/* Raw report */}
        <div>
          <p style={{ ...lbl, marginBottom: 6 }}>Relatório Completo (UNM)</p>
          <pre style={{
            backgroundColor: '#0f172a', color: '#94a3b8',
            border: '1px solid #1e293b', borderRadius: 8,
            padding: '12px 14px', fontSize: 11, lineHeight: 1.7,
            overflowX: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-word',
            margin: 0, fontFamily: 'monospace',
          }}>
            {result.report}
          </pre>
        </div>

        {result.mock && (
          <p style={{ fontSize: 10, color: '#f59e0b', margin: 0 }}>
            ⚠ Dados simulados — OLT em modo mock. Em produção os valores reais serão coletados via SSH.
          </p>
        )}

        <button onClick={onClose} style={{ ...btn('#0284c7'), alignSelf: 'flex-end' }}>Fechar</button>
      </div>
    </div>
  )
}

// ─── AutoFindTab ──────────────────────────────────────────────────────────────

function AutoFindTab({ olts, onLog }) {
  const [running,      setRunning]      = useState(false)
  const [autoRefresh,  setAutoRefresh]  = useState(false)
  const [detected,     setDetected]     = useState(null)   // null = not yet run
  const [feedback,     setFeedback]     = useState(null)
  const [modalItem,    setModalItem]    = useState(null)   // item being provisioned
  const [provLoading,  setProvLoading]  = useState(false)
  const [reportResult, setReportResult] = useState(null)  // signal report
  const autoRefreshRef = useRef(null)

  function showFeedback(type, message) {
    setFeedback({ type, message })
    setTimeout(() => setFeedback(null), 6000)
  }

  const doScan = useCallback(async (quiet = false) => {
    if (!quiet) {
      setRunning(true)
      setDetected(null)
      onLog('AUTO-FIND', 'Escaneando OLTs em busca de ONUs (PON piscando)...', 'info')
    }
    try {
      const { autoFindONUs } = await import('@/actions/provisioning')
      const result = await autoFindONUs()
      setDetected(result)
      if (!quiet) {
        if (result.length === 0) {
          onLog('AUTO-FIND', 'Nenhuma ONU nova detectada', 'info')
          showFeedback('success', 'Nenhuma ONU nova detectada nas OLTs.')
        } else {
          onLog('AUTO-FIND', `${result.length} ONU(s) detectada(s) (PON piscando)`, 'warn')
        }
      } else if (result.length > 0) {
        // Silent refresh found new ONUs
        onLog('AUTO-FIND', `[Auto-Refresh] ${result.length} ONU(s) detectada(s)`, 'info')
      }
    } catch (e) {
      if (!quiet) {
        onLog('AUTO-FIND', e.message, 'error')
        showFeedback('error', e.message)
      }
    } finally {
      if (!quiet) setRunning(false)
    }
  }, [onLog])

  // Auto-refresh every 30s
  useEffect(() => {
    if (autoRefresh) {
      autoRefreshRef.current = setInterval(() => doScan(true), 30_000)
    } else {
      clearInterval(autoRefreshRef.current)
    }
    return () => clearInterval(autoRefreshRef.current)
  }, [autoRefresh, doScan])

  async function handleProvisionConfirm({ cliente, vlan, ctoOverride }) {
    if (!modalItem) return
    const item = modalItem
    setProvLoading(true)
    onLog('AUTO-FIND', `Iniciando provisionamento 1-click: ${item.serial}`, 'info')
    try {
      const { quickProvisionAutoFound } = await import('@/actions/provisioning')
      const result = await quickProvisionAutoFound({
        serial:        item.serial,
        olt_id:        item.olt_id,
        olt_ip:        item.olt_ip,
        pon:           item.pon,
        pon_port:      item.pon_port,
        board:         item.board,
        slot:          item.slot,
        cliente,
        vlan,
        ctoIdOverride: ctoOverride ?? null,
      })
      if (result.success) {
        onLog('PROVISION', `${item.serial} → ${result.cliente} provisionada`, 'success')
        setDetected(prev => (prev ?? []).filter(d => d.serial !== item.serial))
        setModalItem(null)
        setReportResult(result)
      } else {
        onLog('PROVISION', result.error ?? 'Falha', 'error')
        showFeedback('error', result.error ?? 'Falha no provisionamento')
        setModalItem(null)
      }
    } catch (e) {
      onLog('PROVISION', e.message, 'error')
      showFeedback('error', e.message)
      setModalItem(null)
    } finally {
      setProvLoading(false)
    }
  }

  async function handleProvisionAll() {
    if (!detected?.length) return
    for (const item of detected) {
      setModalItem(null)
      onLog('AUTO-FIND', `Provisionando em lote: ${item.serial}`, 'info')
      try {
        const { quickProvisionAutoFound } = await import('@/actions/provisioning')
        const result = await quickProvisionAutoFound({
          serial:   item.serial,
          olt_id:   item.olt_id,
          olt_ip:   item.olt_ip,
          pon:      item.pon,
          pon_port: item.pon_port,
          board:    item.board,
          slot:     item.slot,
          cliente:  item.serial,
          vlan:     100,
        })
        if (result.success) {
          onLog('PROVISION', `${item.serial} provisionada (lote)`, 'success')
          setDetected(prev => (prev ?? []).filter(d => d.serial !== item.serial))
        }
      } catch (e) {
        onLog('PROVISION', `${item.serial}: ${e.message}`, 'error')
      }
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Modals */}
      <ProvisionModal
        item={modalItem}
        loading={provLoading}
        onConfirm={handleProvisionConfirm}
        onCancel={() => setModalItem(null)}
      />
      <SignalReportModal result={reportResult} onClose={() => setReportResult(null)} />

      <FeedbackBanner feedback={feedback} />

      {/* Main card */}
      <div style={card}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12, gap: 12, flexWrap: 'wrap' }}>
          <div>
            <SectionTitle>ONUs Detectadas — PON Piscando</SectionTitle>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: -10, marginBottom: 0 }}>
              Executa <span style={{ fontFamily: 'monospace', color: 'var(--foreground)' }}>display ont autofind all</span> em cada OLT ativa.
              ONUs listadas foram conectadas fisicamente mas ainda não provisionadas.
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            {/* Auto-refresh toggle */}
            <button
              style={{
                ...btnOutline,
                fontSize: 12,
                color: autoRefresh ? '#0284c7' : 'var(--text-muted)',
                borderColor: autoRefresh ? '#0284c7' : 'var(--border-color)',
                display: 'inline-flex', alignItems: 'center', gap: 6,
              }}
              onClick={() => setAutoRefresh(v => !v)}
            >
              <span style={{
                width: 8, height: 8, borderRadius: '50%',
                backgroundColor: autoRefresh ? '#22c55e' : 'var(--text-muted)',
                display: 'inline-block',
                ...(autoRefresh ? { boxShadow: '0 0 6px #22c55e', animation: 'pulse 1.5s infinite' } : {}),
              }} />
              {autoRefresh ? 'Auto 30s' : 'Auto-Refresh'}
            </button>

            <button
              style={{ ...btn(running ? '#475569' : '#0284c7'), display: 'inline-flex', alignItems: 'center', gap: 8, opacity: running ? 0.8 : 1 }}
              onClick={() => doScan(false)}
              disabled={running}
            >
              {running && <Spinner />}
              {running ? 'Escaneando...' : 'Executar Auto-Find'}
            </button>
          </div>
        </div>

        {/* OLT pills */}
        {olts.length > 0 && (
          <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
            {olts.map(olt => (
              <span key={olt.id ?? olt._id} style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '3px 10px', borderRadius: 99, fontSize: 11,
                backgroundColor: 'var(--inp-bg)', border: '1px solid var(--border-color)',
                color: 'var(--text-muted)',
              }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: '#22c55e', display: 'inline-block' }} />
                {olt.nome}{olt.ip ? ` (${olt.ip})` : ''}
              </span>
            ))}
          </div>
        )}

        {/* Not yet scanned */}
        {detected === null && !running && (
          <div style={{ textAlign: 'center', padding: '36px 0', color: 'var(--text-muted)', fontSize: 13 }}>
            <p style={{ fontSize: 32, marginBottom: 8 }}>📡</p>
            <p>Clique em <strong>Executar Auto-Find</strong> para escanear as OLTs.</p>
            <p style={{ fontSize: 11, marginTop: 4 }}>Detecta ONUs com PON piscando aguardando provisionamento.</p>
          </div>
        )}

        {/* No results */}
        {detected !== null && detected.length === 0 && (
          <div style={{ textAlign: 'center', padding: '28px 0', color: '#22c55e', fontSize: 13 }}>
            <p style={{ fontSize: 28, marginBottom: 6 }}>✓</p>
            <p>Nenhuma ONU nova detectada — todas já estão provisionadas.</p>
          </div>
        )}

        {/* Results table */}
        {detected !== null && detected.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  backgroundColor: 'rgba(245,158,11,0.15)',
                  border: '1px solid rgba(245,158,11,0.4)',
                  color: '#f59e0b', borderRadius: 99, padding: '3px 10px', fontSize: 11, fontWeight: 700,
                }}>
                  <span style={{ width: 7, height: 7, borderRadius: '50%', backgroundColor: '#f59e0b', display: 'inline-block', animation: 'pulse 1s infinite' }} />
                  {detected.length} ONU{detected.length > 1 ? 's' : ''} aguardando provisionamento
                </span>
              </div>
              <button
                style={{ ...btn('#475569'), fontSize: 11, padding: '5px 12px' }}
                onClick={handleProvisionAll}
              >
                Provisionar Todas (serial como nome)
              </button>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <TH>Serial</TH>
                    <TH>Placa</TH>
                    <TH>PON</TH>
                    <TH>OLT</TH>
                    <TH>IP OLT</TH>
                    <TH></TH>
                  </tr>
                </thead>
                <tbody>
                  {detected.map((item, i) => (
                    <tr key={item.serial ?? i}>
                      <TD mono bold>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{
                            width: 7, height: 7, borderRadius: '50%',
                            backgroundColor: '#f59e0b', display: 'inline-block',
                            boxShadow: '0 0 6px #f59e0b', flexShrink: 0,
                          }} />
                          {item.serial}
                        </div>
                        {item.mock && <span style={{ fontSize: 10, color: '#f59e0b' }}>(mock)</span>}
                      </TD>
                      <TD mono muted>{item.board ?? '—'}</TD>
                      <TD mono muted>{item.pon ?? '—'}</TD>
                      <TD muted>{item.olt_nome ?? item.olt_id ?? '—'}</TD>
                      <TD mono muted>{item.olt_ip ?? '—'}</TD>
                      <TD>
                        <button
                          style={{ ...btn('#0284c7'), fontSize: 12, padding: '5px 14px', display: 'inline-flex', alignItems: 'center', gap: 6 }}
                          onClick={() => setModalItem(item)}
                        >
                          Provisionar
                        </button>
                      </TD>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Signal analysis legend */}
      <div style={{ ...card, padding: '14px 16px' }}>
        <p style={{ ...lbl, marginBottom: 10 }}>Análise de Sinal Óptico — Referência UNM</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 10 }}>
          {/* RX thresholds */}
          <div>
            <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--foreground)', marginBottom: 6 }}>RX — Potência de Chegada (ONU)</p>
            {[
              ['> -20 dBm',      'EXCELENTE', '#22c55e'],
              ['-20 a -25 dBm',  'BOM',       '#4ade80'],
              ['-25 a -28 dBm',  'LIMITE',    '#f59e0b'],
              ['< -28 dBm',      'CRÍTICO',   '#ef4444'],
            ].map(([range, label, color]) => (
              <div key={range} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: color, flexShrink: 0 }} />
                <span style={{ fontSize: 11, fontFamily: 'monospace', color: 'var(--text-muted)', flex: 1 }}>{range}</span>
                <span style={{ fontSize: 11, fontWeight: 700, color }}>{label}</span>
              </div>
            ))}
          </div>
          {/* TX thresholds */}
          <div>
            <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--foreground)', marginBottom: 6 }}>TX — Potência de Retorno (OLT)</p>
            {[
              ['1 a 5 dBm',  'OK',         '#22c55e'],
              ['> 5 dBm',    'MUITO ALTO', '#ef4444'],
              ['< 1 dBm',    'BAIXO',      '#f59e0b'],
            ].map(([range, label, color]) => (
              <div key={range} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: color, flexShrink: 0 }} />
                <span style={{ fontSize: 11, fontFamily: 'monospace', color: 'var(--text-muted)', flex: 1 }}>{range}</span>
                <span style={{ fontSize: 11, fontWeight: 700, color }}>{label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* PON → CTO mapping management */}
      <PonMapSection olts={olts} />

      {/* How it works */}
      <div style={{
        ...card, padding: '12px 16px',
        backgroundColor: 'var(--inp-bg)',
        display: 'flex', alignItems: 'flex-start', gap: 10,
      }}>
        <span style={{ fontSize: 16 }}>ℹ️</span>
        <div>
          <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--foreground)', marginBottom: 4 }}>Como funciona o Auto-Find com mapeamento PON</p>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.6 }}>
            O Auto-Find detecta ONUs não provisionadas. Ao provisionar, o sistema verifica se há um
            mapeamento <strong>PON → CTO</strong> configurado: se sim, seleciona automaticamente a CTO
            correta com base na posição da fibra. Configure o mapeamento acima para habilitar a vinculação
            inteligente. Sem mapeamento, usa a primeira CTO disponível como fallback.
          </p>
        </div>
      </div>
    </div>
  )
}

// ─── PonMapSection ────────────────────────────────────────────────────────────

function PonMapSection({ olts }) {
  const [expanded,   setExpanded]   = useState(false)
  const [maps,       setMaps]       = useState(null)      // null=not loaded
  const [loading,    setLoading]    = useState(false)
  const [feedback,   setFeedback]   = useState(null)
  const [editOltId,  setEditOltId]  = useState('')
  const [editPon,    setEditPon]    = useState('')
  const [editCtoIds, setEditCtoIds] = useState('')        // CSV of cto_ids
  const [saving,     setSaving]     = useState(false)

  function showFeedback(type, msg) {
    setFeedback({ type, msg })
    setTimeout(() => setFeedback(null), 5000)
  }

  async function loadMaps() {
    setLoading(true)
    try {
      const { getPonCtoMaps } = await import('@/actions/pon-cto-map')
      setMaps(await getPonCtoMaps())
    } catch (e) {
      showFeedback('error', e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (expanded && maps === null) loadMaps()
  }, [expanded])

  async function handleSave() {
    if (!editOltId.trim() || !editPon.trim() || !editCtoIds.trim()) {
      showFeedback('error', 'OLT, PON e pelo menos uma CTO são obrigatórios')
      return
    }
    const ctoParsed = editCtoIds.split(',').map((s, i) => ({ cto_id: s.trim(), ordem: i })).filter(c => c.cto_id)
    if (!ctoParsed.length) { showFeedback('error', 'Insira ao menos uma CTO'); return }

    setSaving(true)
    try {
      const { savePonCtoMap } = await import('@/actions/pon-cto-map')
      await savePonCtoMap({ olt_id: editOltId.trim(), pon: editPon.trim(), ctos: ctoParsed })
      setEditOltId(''); setEditPon(''); setEditCtoIds('')
      showFeedback('success', `Mapeamento PON ${editPon.trim()} salvo`)
      await loadMaps()
    } catch (e) {
      showFeedback('error', e.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(olt_id, pon) {
    if (!window.confirm(`Excluir mapeamento PON ${pon}?`)) return
    try {
      const { deletePonCtoMap } = await import('@/actions/pon-cto-map')
      await deletePonCtoMap({ olt_id, pon })
      showFeedback('success', `Mapeamento ${pon} removido`)
      await loadMaps()
    } catch (e) {
      showFeedback('error', e.message)
    }
  }

  function startEdit(map) {
    setEditOltId(map.olt_id)
    setEditPon(map.pon)
    setEditCtoIds(map.ctos.map(c => c.cto_id).join(', '))
  }

  return (
    <div style={{ ...card, padding: 0, overflow: 'hidden' }}>
      {/* Collapsible header */}
      <button
        onClick={() => setExpanded(v => !v)}
        style={{
          width: '100%', padding: '12px 16px', border: 'none', cursor: 'pointer',
          backgroundColor: 'transparent', display: 'flex', alignItems: 'center',
          justifyContent: 'space-between', gap: 8,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--foreground)' }}>
            Mapeamento PON → CTO
          </span>
          <span style={{
            fontSize: 10, padding: '2px 7px', borderRadius: 99,
            backgroundColor: 'rgba(2,132,199,0.12)', color: '#0284c7', fontWeight: 700,
          }}>
            Vinculação Automática
          </span>
        </div>
        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{expanded ? '▲' : '▼'}</span>
      </button>

      {expanded && (
        <div style={{ padding: '0 16px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 0, lineHeight: 1.5 }}>
            Configure quais CTOs pertencem a cada PON da OLT (na ordem da fibra, da mais próxima à mais distante).
            O sistema usará o mapeamento para vincular automaticamente ONUs detectadas à CTO correta.
          </p>

          {feedback && (
            <div style={{
              padding: '8px 12px', borderRadius: 6, fontSize: 12,
              backgroundColor: feedback.type === 'error' ? 'rgba(239,68,68,0.1)' : 'rgba(34,197,94,0.1)',
              color: feedback.type === 'error' ? '#ef4444' : '#22c55e',
              border: `1px solid ${feedback.type === 'error' ? 'rgba(239,68,68,0.3)' : 'rgba(34,197,94,0.3)'}`,
            }}>
              {feedback.msg}
            </div>
          )}

          {/* Add/edit form */}
          <div style={{ backgroundColor: 'var(--inp-bg)', border: '1px solid var(--border-color)', borderRadius: 8, padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--foreground)', margin: 0 }}>Adicionar / Atualizar Mapeamento</p>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div>
                <label style={lbl}>OLT</label>
                <select style={inp} value={editOltId} onChange={e => setEditOltId(e.target.value)} disabled={saving}>
                  <option value="">Selecione a OLT</option>
                  {olts.map(o => (
                    <option key={o.id ?? o._id} value={o.id ?? o._id}>{o.nome} {o.ip ? `(${o.ip})` : ''}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={lbl}>PON (ex: 0/1/0)</label>
                <input
                  style={inp} value={editPon}
                  onChange={e => setEditPon(e.target.value)}
                  placeholder="0/1/0" disabled={saving}
                />
              </div>
            </div>

            <div>
              <label style={lbl}>CTOs (IDs separados por vírgula, em ordem de distância)</label>
              <input
                style={inp} value={editCtoIds}
                onChange={e => setEditCtoIds(e.target.value)}
                placeholder="CTO-01, CTO-02, CTO-03"
                disabled={saving}
              />
              <p style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4 }}>
                Insira os IDs das CTOs na ordem da fibra (primeira = mais próxima da OLT).
              </p>
            </div>

            <button
              style={{ ...btn('#0284c7'), alignSelf: 'flex-start', display: 'inline-flex', alignItems: 'center', gap: 6, opacity: saving ? 0.7 : 1 }}
              onClick={handleSave} disabled={saving}
            >
              {saving && <Spinner />}
              {saving ? 'Salvando...' : 'Salvar Mapeamento'}
            </button>
          </div>

          {/* Existing maps */}
          {loading && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-muted)', fontSize: 12 }}>
              <Spinner /> Carregando mapeamentos...
            </div>
          )}

          {!loading && maps !== null && maps.length === 0 && (
            <p style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center', padding: '12px 0' }}>
              Nenhum mapeamento cadastrado.
            </p>
          )}

          {!loading && maps !== null && maps.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <p style={{ ...lbl, marginBottom: 4 }}>MAPEAMENTOS CADASTRADOS</p>
              {maps.map(m => {
                const olt = olts.find(o => (o.id ?? o._id) === m.olt_id)
                return (
                  <div key={m._id} style={{
                    backgroundColor: 'var(--inp-bg)', border: '1px solid var(--border-color)',
                    borderRadius: 8, padding: '8px 12px',
                    display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12,
                  }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{olt?.nome ?? m.olt_id}</span>
                        <span style={{ fontFamily: 'monospace', fontSize: 12, fontWeight: 700, color: '#0284c7' }}>PON {m.pon}</span>
                      </div>
                      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                        {m.ctos.map((c, idx) => (
                          <span key={c.cto_id} style={{
                            fontSize: 11, padding: '2px 8px', borderRadius: 99,
                            backgroundColor: c.livres > 0 ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
                            color: c.livres > 0 ? '#22c55e' : '#ef4444',
                            border: `1px solid ${c.livres > 0 ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}`,
                          }}>
                            {idx + 1}. {c.nome} ({c.livres} livre{c.livres !== 1 ? 's' : ''})
                          </span>
                        ))}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                      <button
                        onClick={() => startEdit(m)}
                        style={{ ...btnOutline, padding: '4px 10px', fontSize: 11 }}
                      >Editar</button>
                      <button
                        onClick={() => handleDelete(m.olt_id, m.pon)}
                        style={{ ...btn('#ef4444'), padding: '4px 10px', fontSize: 11 }}
                      >✕</button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── LOG TERMINAL ─────────────────────────────────────────────────────────────

function LogTerminal({ logs }) {
  const endRef = useRef(null)
  const [tagFilter,    setTagFilter]    = useState('TODOS')
  const [levelFilter,  setLevelFilter]  = useState('todos')
  const [paused,       setPaused]       = useState(false)
  const [userScrolled, setUserScrolled] = useState(false)

  useEffect(() => {
    if (!paused && !userScrolled) {
      endRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [logs, paused, userScrolled])

  const TAG_OPTIONS = ['TODOS', 'PROVISION', 'OLT', 'CTO', 'SGP', 'AUTO-FIND', 'POWER', 'SYNC', 'QUEUE', 'TEST', 'ANALYSIS', 'MONITOR']

  const filtered = logs.filter(e => {
    if (tagFilter !== 'TODOS' && (e.tag ?? '').toUpperCase() !== tagFilter) return false
    if (levelFilter === 'warn'  && !['warn', 'error'].includes(e.nivel))    return false
    if (levelFilter === 'error' && e.nivel !== 'error')                     return false
    return true
  })

  return (
    <div style={{ marginTop: 24 }}>

      {/* Filter bar — themed */}
      <div style={{
        backgroundColor: 'var(--card-bg)', border: '1px solid var(--border-color)',
        borderBottom: 'none', borderRadius: '8px 8px 0 0',
        padding: '8px 12px',
        display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
      }}>
        {/* TAG chips */}
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', flex: 1 }}>
          {TAG_OPTIONS.map(tag => {
            const active = tagFilter === tag
            return (
              <button
                key={tag}
                onClick={() => setTagFilter(tag)}
                style={{
                  fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 99,
                  cursor: 'pointer', border: 'none', letterSpacing: '0.06em',
                  backgroundColor: active ? '#0284c7' : 'transparent',
                  color: active ? '#fff' : 'var(--text-muted)',
                  outline: active ? 'none' : '1px solid var(--border-color)',
                }}
              >
                {tag}
              </button>
            )
          })}
        </div>
        {/* Right controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          <select
            value={levelFilter}
            onChange={e => setLevelFilter(e.target.value)}
            style={{
              fontSize: 11, padding: '3px 8px', borderRadius: 6,
              backgroundColor: 'var(--inp-bg)', border: '1px solid var(--border-color)',
              color: 'var(--text-muted)', cursor: 'pointer', outline: 'none',
            }}
          >
            <option value="todos">Todos niveis</option>
            <option value="warn">Warn+</option>
            <option value="error">Apenas Erros</option>
          </select>
          <button
            onClick={() => { setPaused(p => !p); setUserScrolled(false) }}
            style={{
              fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 6,
              cursor: 'pointer', border: '1px solid var(--border-color)',
              backgroundColor: 'transparent',
              color: paused ? '#f59e0b' : 'var(--text-muted)',
            }}
          >
            {paused ? '▶ Retomar' : '⏸ Pausar'}
          </button>
          <span style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'monospace' }}>
            {filtered.length}/{logs.length}
          </span>
        </div>
      </div>

      {/* Terminal header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '6px 14px', backgroundColor: '#0d1117',
        border: '1px solid #1e3a20', borderTop: '1px solid #1e3a20', borderBottom: 'none',
      }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: '#4ade80', fontFamily: 'monospace' }}>
          LOG EM TEMPO REAL
        </span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, marginLeft: 6 }}>
          <span style={{
            width: 7, height: 7, borderRadius: '50%', backgroundColor: paused ? '#f59e0b' : '#4ade80',
            animation: paused ? 'none' : 'noc-blink 1.2s step-start infinite', display: 'inline-block',
          }} />
          <span style={{ fontSize: 10, color: paused ? '#f59e0b' : '#4ade80', fontWeight: 700, letterSpacing: '0.12em' }}>
            {paused ? 'PAUSADO' : 'AO VIVO'}
          </span>
        </span>
      </div>

      {/* Terminal body */}
      <div
        style={{
          backgroundColor: '#0a0e1a', border: '1px solid #1e3a20',
          borderRadius: '0 0 8px 8px', height: 220, overflowY: 'auto',
          padding: '8px 14px', fontFamily: 'monospace', fontSize: 12,
          display: 'flex', flexDirection: 'column', gap: 1,
        }}
        onScroll={e => {
          const el = e.currentTarget
          const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 20
          setUserScrolled(!atBottom)
        }}
      >
        {filtered.length === 0 && (
          <span style={{ color: '#4ade8055', fontSize: 11 }}>Aguardando eventos...</span>
        )}
        {filtered.map((entry, i) => {
          const color = NIVEL_TERM_COLOR[entry.nivel] ?? NIVEL_TERM_COLOR.info
          return (
            <div key={entry.id ?? i} style={{ display: 'flex', gap: 8, lineHeight: 1.5 }}>
              <span style={{ color: '#4ade8066', flexShrink: 0 }}>{fmtHHMMSS(entry.ts)}</span>
              <span style={{ color: '#60a5fa', flexShrink: 0 }}>[{entry.tag ?? 'NOC'}]</span>
              <span style={{ color }}>{entry.message}</span>
            </div>
          )
        })}
        <div ref={endRef} />
      </div>
    </div>
  )
}

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────

export default function NOCClient({ stats, userRole }) {
  const [activeTab, setActiveTab] = useState('visao-geral')
  const [logs, setLogs]           = useState([])
  const [lastUpdate]              = useState(() => new Date())
  const [now, setNow]             = useState(() => new Date())

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(t)
  }, [])

  const olts      = stats?.olts      ?? []
  const onus      = stats?.onus      ?? []
  const ctos      = stats?.ctos      ?? []
  const alertas   = stats?.alertas   ?? []
  const sgpStatus = stats?.sgpStatus ?? { isConfigured: false }
  const eventos   = stats?.eventos   ?? []

  // Seed log terminal with recent eventos on mount
  useEffect(() => {
    if (eventos.length > 0) {
      setLogs(eventos.slice(0, 200).map(e => ({
        id:      e._id,
        ts:      e.ts ?? new Date().toISOString(),
        tag:     (e.role ?? 'NOC').toUpperCase(),
        message: [e.action, e.entity].filter(Boolean).join(' · '),
        nivel:   e.nivel ?? 'info',
      })))
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // SSE real-time log stream
  useEffect(() => {
    const es = new EventSource('/api/noc/stream')

    es.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data)
        if (data.heartbeat) return
        setLogs(prev => [...prev.slice(-199), {
          id:      data._id ?? data.id ?? String(Date.now()),
          ts:      data.ts ?? new Date().toISOString(),
          tag:     (data.tag ?? data.role ?? 'NOC').toUpperCase(),
          message: data.message ?? data.action ?? JSON.stringify(data),
          nivel:   data.nivel ?? 'info',
        }])
      } catch { /* ignore */ }
    }

    es.onerror = () => { /* EventSource auto-reconnects */ }

    return () => es.close()
  }, [])

  const addLog = useCallback((tag, message, nivel = 'info') => {
    setLogs(prev => [...prev.slice(-199), {
      id:      String(Date.now()),
      ts:      new Date().toISOString(),
      tag:     tag.toUpperCase(),
      message,
      nivel,
    }])
  }, [])

  const TABS = [
    { id: 'visao-geral', label: alertas.length > 0 ? `Visão Geral ⚠${alertas.length}` : 'Visão Geral' },
    { id: 'clientes',    label: `Clientes (${onus.length})` },
    { id: 'topologia',   label: 'Topologia' },
    { id: 'sgp',         label: 'SGP' },
    { id: 'autofind',    label: 'Auto-Find' },
    { id: 'olt-mgmt',    label: 'Gerenciar OLTs' },
  ]

  return (
    <div>
      <style>{`
        @keyframes noc-spin  { to { transform: rotate(360deg); } }
        @keyframes noc-blink { 0%, 100% { opacity: 1; } 50% { opacity: 0; } }
      `}</style>

      {/* Top bar */}
      {(() => {
        const dotColor = alertas.length === 0 ? '#22c55e' : alertas.length <= 3 ? '#f59e0b' : '#ef4444'
        return (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, gap: 12, flexWrap: 'wrap' }}>
            {/* Left: health dot + label + clock */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{
                display: 'inline-block', width: 10, height: 10, borderRadius: '50%',
                backgroundColor: dotColor,
                boxShadow: `0 0 6px ${dotColor}`,
                flexShrink: 0,
              }} />
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--foreground)', letterSpacing: '0.08em' }}>
                NOC AO VIVO
              </span>
              <span style={{ fontSize: 13, fontFamily: 'monospace', color: dotColor, fontWeight: 600, letterSpacing: '0.05em' }}>
                {now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </span>
            </div>
            {/* Right: last loaded + refresh */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                Carregado as {fmtTime(lastUpdate)}
              </span>
              <button onClick={() => window.location.reload()} style={btn('#0284c7')}>
                Atualizar
              </button>
            </div>
          </div>
        )
      })()}

      {/* Tab bar */}
      <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid var(--border-color)', marginBottom: 20 }}>
        {TABS.map(tab => {
          const isActive = activeTab === tab.id
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                padding: '9px 20px', fontSize: 13,
                fontWeight: isActive ? 700 : 500,
                border: 'none',
                borderBottom: isActive ? '2px solid #0284c7' : '2px solid transparent',
                backgroundColor: 'transparent',
                color: isActive ? '#0284c7' : 'var(--text-muted)',
                cursor: 'pointer',
                transition: 'color 0.15s, border-color 0.15s',
                marginBottom: -1,
              }}
            >
              {tab.label}
            </button>
          )
        })}
      </div>

      {/* Tab panels */}
      {activeTab === 'visao-geral' && <VisaoGeralTab stats={stats} />}
      {activeTab === 'clientes'    && <ClientesTab onus={onus} olts={olts} onLog={addLog} />}
      {activeTab === 'topologia'   && <TopologiaTab ctos={ctos} olts={olts} />}
      {activeTab === 'sgp'         && <SGPTab sgpStatus={sgpStatus} onLog={addLog} />}
      {activeTab === 'autofind'    && <AutoFindTab olts={olts} onLog={addLog} />}
      {activeTab === 'olt-mgmt'    && <OltMgmtTab olts={olts} onLog={addLog} />}

      {/* Log terminal — always visible */}
      <LogTerminal logs={logs} />
    </div>
  )
}
