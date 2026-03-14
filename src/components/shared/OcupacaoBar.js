'use client'

export default function OcupacaoBar({ ocupadas = 0, capacidade = 8 }) {
  const pct = capacidade > 0 ? Math.min(100, Math.round((ocupadas / capacidade) * 100)) : 0

  const barColor =
    pct >= 90
      ? 'bg-red-500'
      : pct >= 70
      ? 'bg-yellow-500'
      : 'bg-emerald-500'

  const textColor =
    pct >= 90
      ? 'text-red-400'
      : pct >= 70
      ? 'text-yellow-400'
      : 'text-emerald-400'

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs">
        <span className="text-white/60">Ocupação</span>
        <span className={`font-semibold ${textColor}`}>
          {ocupadas}/{capacidade} ({pct}%)
        </span>
      </div>
      <div className="h-2 w-full rounded-full bg-white/10 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${barColor}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}
