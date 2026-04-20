'use client'

const pulseKeyframes = `
@keyframes pulse-alert {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.55; }
}
`

function Badge({ children, color, pulse = false }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center',
      fontSize: 11, fontWeight: 700, borderRadius: 6,
      padding: '3px 9px', whiteSpace: 'nowrap',
      backgroundColor: color + '18',
      border: `1px solid ${color}44`,
      color: color,
      animation: pulse ? 'pulse-alert 1.5s ease-in-out infinite' : 'none',
    }}>
      {children}
    </span>
  )
}

function CapacidadeBar({ valor, total, cor }) {
  const pct = total > 0 ? Math.min(100, Math.round((valor / total) * 100)) : 0
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 120 }}>
      <div style={{
        flex: 1, height: 5, borderRadius: 3,
        backgroundColor: 'var(--border-color)', overflow: 'hidden',
      }}>
        <div style={{
          height: '100%', width: `${pct}%`,
          backgroundColor: cor, borderRadius: 3,
          transition: 'width .4s',
        }} />
      </div>
      <span style={{ fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
        {valor}/{total} ({pct}%)
      </span>
    </div>
  )
}

export default function TopologiaHealthPanel({ stats }) {
  if (!stats) return null

  const {
    totalOlts = 0,
    totalCdos = 0,
    totalCtos = 0,
    ctosOrfas = 0,
    cdosOrfos = 0,
    capacidadeTotal = 0,
    clientesAtivos = 0,
    pctPonUsado = 0,
    ponUsadas = 0,
    ponTotal = 0,
  } = stats

  const ponColor = pctPonUsado >= 95 ? '#ef4444' : pctPonUsado >= 80 ? '#f59e0b' : '#22c55e'
  const capColor = capacidadeTotal > 0
    ? (clientesAtivos / capacidadeTotal >= 0.9 ? '#ef4444'
      : clientesAtivos / capacidadeTotal >= 0.7 ? '#f59e0b'
      : '#22c55e')
    : '#22c55e'

  return (
    <>
      <style>{pulseKeyframes}</style>
      <div style={{
        backgroundColor: 'var(--card-bg)',
        border: '1px solid var(--border-color)',
        borderRadius: 10,
        padding: '10px 16px',
        marginBottom: 20,
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        flexWrap: 'wrap',
      }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', whiteSpace: 'nowrap' }}>
          Saude da Rede
        </span>

        <div style={{ width: 1, height: 16, backgroundColor: 'var(--border-color)', flexShrink: 0 }} />

        {ctosOrfas > 0 && (
          <Badge color="#ef4444" pulse>
            {ctosOrfas} CTO{ctosOrfas !== 1 ? 's' : ''} sem CDO
          </Badge>
        )}

        {cdosOrfos > 0 && (
          <Badge color="#f59e0b" pulse={false}>
            {cdosOrfos} CDO{cdosOrfos !== 1 ? 's' : ''} sem OLT
          </Badge>
        )}

        {ctosOrfas === 0 && cdosOrfos === 0 && (
          <Badge color="#22c55e">Topologia OK</Badge>
        )}

        <Badge color={ponColor}>
          OLT {pctPonUsado}% PON ({ponUsadas}/{ponTotal})
        </Badge>

        <div style={{ width: 1, height: 16, backgroundColor: 'var(--border-color)', flexShrink: 0 }} />

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 180 }}>
          <span style={{ fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>Capacidade</span>
          <CapacidadeBar valor={clientesAtivos} total={capacidadeTotal} cor={capColor} />
        </div>

        <div style={{ width: 1, height: 16, backgroundColor: 'var(--border-color)', flexShrink: 0 }} />

        <span style={{ fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
          {totalCtos} CTOs &middot; {totalCdos} CDOs &middot; {totalOlts} OLT{totalOlts !== 1 ? 's' : ''}
        </span>
      </div>
    </>
  )
}
