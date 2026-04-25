'use client'

import { useState, useEffect } from 'react'
import { getHistoricoPonto } from '@/actions/time-record'
import { T } from '../pontoTheme'

function fmtTime(date) {
  if (!date) return '—'
  return new Date(date).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

function calcMinutos(r) {
  if (!r?.entrada) return 0
  const fim = r.saida ? new Date(r.saida).getTime() : Date.now()
  const total = fim - new Date(r.entrada).getTime()
  let pausaMs = 0
  if (r.pausaInicio) {
    const pI = new Date(r.pausaInicio).getTime()
    const pF = r.pausaFim ? new Date(r.pausaFim).getTime() : (r.status === 'em_pausa' ? Date.now() : pI)
    pausaMs = pF - pI
  }
  return Math.max(0, Math.floor((total - pausaMs) / 60_000))
}

function fmtMin(min) {
  if (!min) return '—'
  const h = Math.floor(min / 60)
  const m = min % 60
  return h === 0 ? `${m}min` : `${h}h ${String(m).padStart(2, '0')}min`
}

const STATUS_CFG = {
  trabalhando: { label: 'Trabalhando', dot: '#22c55e', bg: 'rgba(34,197,94,0.12)',    border: 'rgba(34,197,94,0.3)'    },
  em_pausa:    { label: 'Em Pausa',    dot: '#f59e0b', bg: 'rgba(245,158,11,0.12)',   border: 'rgba(245,158,11,0.3)'   },
  finalizado:  { label: 'Finalizado',  dot: '#94a3b8', bg: 'rgba(148,163,184,0.10)',  border: 'rgba(148,163,184,0.25)' },
}

export default function HistoricoTab() {
  const [registros, setRegistros] = useState([])
  const [loading,   setLoading]   = useState(true)

  useEffect(() => {
    getHistoricoPonto({ limit: 30 })
      .then(data => setRegistros(data ?? []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  return (
    <div style={{ padding: '24px 16px', maxWidth: 600, margin: '0 auto', width: '100%' }}>
      <div style={{
        fontSize: 11, color: T.dim, fontWeight: 700,
        textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 16,
      }}>
        Histórico — últimos 30 dias
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px 0', color: T.dim, fontSize: 14 }}>
          Carregando…
        </div>
      ) : registros.length === 0 ? (
        <div style={{
          textAlign: 'center', padding: '40px 0', color: T.dim, fontSize: 14,
          background: T.card, border: `1px solid ${T.border}`, borderRadius: 14,
        }}>
          Nenhum registro encontrado
        </div>
      ) : (() => {
        const totalMin      = registros.reduce((acc, r) => acc + calcMinutos(r), 0)
        const diasTrabalhados = registros.filter(r => r.entrada).length
        const mediaMin      = diasTrabalhados > 0 ? Math.round(totalMin / diasTrabalhados) : 0

        return (
        <>
          {/* Card de somatória */}
          <div style={{
            background: T.card, border: `1px solid ${T.border}`,
            borderRadius: 14, padding: '16px 20px', marginBottom: 16,
            display: 'flex', gap: 0, flexWrap: 'wrap',
          }}>
            <div style={{ flex: 1, minWidth: 100, textAlign: 'center', padding: '0 12px' }}>
              <div style={{ fontSize: 10, color: T.dim, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6 }}>
                Total trabalhado
              </div>
              <div style={{ fontSize: 22, fontWeight: 800, color: T.accent, fontVariantNumeric: 'tabular-nums' }}>
                {fmtMin(totalMin)}
              </div>
            </div>
            <div style={{ width: 1, background: T.border, margin: '4px 0' }} />
            <div style={{ flex: 1, minWidth: 100, textAlign: 'center', padding: '0 12px' }}>
              <div style={{ fontSize: 10, color: T.dim, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6 }}>
                Dias registrados
              </div>
              <div style={{ fontSize: 22, fontWeight: 800, color: T.text }}>
                {diasTrabalhados}
              </div>
            </div>
            <div style={{ width: 1, background: T.border, margin: '4px 0' }} />
            <div style={{ flex: 1, minWidth: 100, textAlign: 'center', padding: '0 12px' }}>
              <div style={{ fontSize: 10, color: T.dim, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6 }}>
                Média por dia
              </div>
              <div style={{ fontSize: 22, fontWeight: 800, color: T.text, fontVariantNumeric: 'tabular-nums' }}>
                {fmtMin(mediaMin)}
              </div>
            </div>
          </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {registros.map(r => {
            const st = STATUS_CFG[r.status] ?? STATUS_CFG.finalizado
            const duracao = fmtMin(calcMinutos(r)) === '—' ? null : fmtMin(calcMinutos(r))
            const [y, m, d] = r.date.split('-')
            const dateLabel = `${d}/${m}/${y}`

            return (
              <div key={r._id ?? r.date} style={{
                background: T.card, border: `1px solid ${T.border}`,
                borderRadius: 12, padding: '14px 16px',
              }}>
                {/* Linha 1: data + status + duração */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: T.text }}>{dateLabel}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {duracao && duracao !== '—' && (
                      <span style={{ fontSize: 13, fontWeight: 700, color: T.accent }}>{duracao}</span>
                    )}
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', gap: 4,
                      background: st.bg, border: `1px solid ${st.border}`,
                      borderRadius: 20, padding: '2px 8px',
                      fontSize: 10, fontWeight: 700, color: st.dot,
                    }}>
                      <span style={{ width: 5, height: 5, borderRadius: '50%', background: st.dot, flexShrink: 0 }} />
                      {st.label}
                    </span>
                  </div>
                </div>

                {/* Linha 2: marcações */}
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {[
                    { icon: '🟢', label: 'Entrada',      val: r.entrada     },
                    { icon: '⏸️', label: 'Pausa início', val: r.pausaInicio },
                    { icon: '▶️', label: 'Pausa fim',    val: r.pausaFim    },
                    { icon: '🔴', label: 'Saída',         val: r.saida       },
                  ].map(({ icon, label, val }) => (
                    <div key={label} style={{
                      flex: 1, minWidth: 60,
                      background: val ? 'rgba(255,255,255,0.04)' : 'transparent',
                      border: `1px solid ${val ? T.border : 'transparent'}`,
                      borderRadius: 8, padding: '6px 8px',
                      opacity: val ? 1 : 0.35,
                    }}>
                      <div style={{ fontSize: 9, color: T.dim, marginBottom: 2 }}>{icon} {label}</div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: T.text, fontVariantNumeric: 'tabular-nums' }}>
                        {fmtTime(val)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
        </>
        )
      })()}
    </div>
  )
}
