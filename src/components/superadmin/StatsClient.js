'use client'

// Explicit dark palette — does not rely on CSS variables
const C = {
  bg:       '#0d1117',
  card:     '#161b27',
  border:   '#1f2937',
  text:     '#f1f5f9',
  muted:    '#94a3b8',
  subtle:   '#475569',
}

const METRICS = [
  { key: 'projetos',      label: 'Projetos',       sub: 'Tenants ativos',            color: '#818cf8', icon: '🏢' },
  { key: 'empresas',      label: 'Empresas',        sub: 'Cadastradas no sistema',     color: '#c084fc', icon: '🏭' },
  { key: 'usuarios',      label: 'Usuários',         sub: 'Contas de acesso',           color: '#2dd4bf', icon: '👤' },
  { key: 'olts',          label: 'OLTs',             sub: 'Optical Line Terminals',     color: '#38bdf8', icon: '🖥️'  },
  { key: 'ctos',          label: 'CTOs',             sub: 'Caixas Terminação Óptica',   color: '#34d399', icon: '📡' },
  { key: 'caixas',        label: 'CDOs / CEs',       sub: 'Caixas de Emenda / Dist.',   color: '#fbbf24', icon: '📦' },
  { key: 'rotas',         label: 'Rotas',            sub: 'Traçados de fibra óptica',   color: '#a78bfa', icon: '〰️'  },
  { key: 'postes',        label: 'Postes',           sub: 'Pontos de infraestrutura',   color: '#f97316', icon: '🪵' },
  { key: 'movimentacoes', label: 'Movimentações',    sub: 'Instalações e remoções',     color: '#f472b6', icon: '📋' },
]

function MetricCard({ label, sub, valor, color, icon }) {
  return (
    <div
      className="rounded-xl p-5 flex flex-col gap-3 transition-colors"
      style={{
        background:  C.card,
        border:      `1px solid ${C.border}`,
        cursor: 'default',
      }}
      onMouseEnter={e => e.currentTarget.style.borderColor = color + '55'}
      onMouseLeave={e => e.currentTarget.style.borderColor = C.border}
    >
      <div className="flex items-center justify-between">
        <div
          className="w-9 h-9 rounded-lg flex items-center justify-center text-base"
          style={{ background: color + '18', border: `1px solid ${color}33` }}
        >
          {icon}
        </div>
        <span
          className="text-[10px] font-semibold uppercase tracking-widest"
          style={{ color }}
        >
          {label}
        </span>
      </div>

      <div>
        <p className="text-3xl font-bold tabular-nums" style={{ color }}>
          {(valor ?? 0).toLocaleString('pt-BR')}
        </p>
        <p className="text-xs mt-1" style={{ color: C.muted }}>{sub}</p>
      </div>
    </div>
  )
}

export default function StatsClient({ stats }) {
  const totalRegistros = METRICS.reduce((acc, m) => acc + (stats[m.key] ?? 0), 0)
  const infra = (stats.ctos ?? 0) + (stats.caixas ?? 0) + (stats.olts ?? 0) + (stats.postes ?? 0) + (stats.rotas ?? 0)

  return (
    <div>
      {/* ── KPI Strip ───────────────────────────────────────────────────── */}
      <div
        className="grid grid-cols-2 sm:grid-cols-4 gap-px mb-8 rounded-xl overflow-hidden"
        style={{ border: `1px solid ${C.border}`, background: C.border }}
      >
        {[
          { label: 'Total de registros', value: totalRegistros.toLocaleString('pt-BR'), color: '#f1f5f9' },
          { label: 'Projetos',           value: (stats.projetos ?? 0).toLocaleString('pt-BR'), color: '#818cf8' },
          { label: 'Usuários',           value: (stats.usuarios ?? 0).toLocaleString('pt-BR'), color: '#2dd4bf' },
          { label: 'Infra de rede',      value: infra.toLocaleString('pt-BR'), color: '#34d399' },
        ].map((kpi) => (
          <div key={kpi.label} className="px-5 py-4" style={{ background: C.card }}>
            <p className="text-2xl font-bold tabular-nums" style={{ color: kpi.color }}>
              {kpi.value}
            </p>
            <p className="text-xs mt-0.5" style={{ color: C.muted }}>{kpi.label}</p>
          </div>
        ))}
      </div>

      {/* ── Metric Grid ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4 mb-8">
        {METRICS.map((m) => (
          <MetricCard
            key={m.key}
            label={m.label}
            sub={m.sub}
            valor={stats[m.key] ?? 0}
            color={m.color}
            icon={m.icon}
          />
        ))}
      </div>

      {/* ── Distribution bar ────────────────────────────────────────────── */}
      <div
        className="rounded-xl p-5"
        style={{ background: C.card, border: `1px solid ${C.border}` }}
      >
        <p className="text-xs font-semibold uppercase tracking-widest mb-4" style={{ color: C.muted }}>
          Distribuição de registros
        </p>
        <div className="flex h-3 rounded-full overflow-hidden gap-px">
          {METRICS.filter(m => (stats[m.key] ?? 0) > 0).map((m) => {
            const pct = totalRegistros > 0 ? ((stats[m.key] ?? 0) / totalRegistros) * 100 : 0
            return (
              <div
                key={m.key}
                title={`${m.label}: ${stats[m.key]}`}
                style={{ width: `${pct}%`, background: m.color, minWidth: pct > 0 ? 2 : 0 }}
              />
            )
          })}
        </div>
        <div className="flex flex-wrap gap-x-5 gap-y-2 mt-4">
          {METRICS.filter(m => (stats[m.key] ?? 0) > 0).map((m) => (
            <div key={m.key} className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: m.color }} />
              <span className="text-xs" style={{ color: C.muted }}>{m.label}</span>
              <span className="text-xs font-semibold tabular-nums" style={{ color: C.text }}>
                {(stats[m.key] ?? 0).toLocaleString('pt-BR')}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
