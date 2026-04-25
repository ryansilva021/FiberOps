'use client'

import { useState, useTransition } from 'react'
import { getHistoricoPontoAdmin } from '@/actions/time-record'
import { Clock, User, MapPin, ChevronDown, ChevronUp, Search, RefreshCw } from 'lucide-react'

const MESES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
]

const ROLE_LABELS = {
  admin:     'Admin',
  tecnico:   'Técnico',
  noc:       'NOC',
  recepcao:  'Recepção',
  superadmin: 'Superadmin',
}

const STATUS_COLORS = {
  trabalhando: { bg: 'rgba(34,197,94,0.12)', text: '#4ade80', label: 'Trabalhando' },
  em_pausa:    { bg: 'rgba(250,204,21,0.12)', text: '#fbbf24', label: 'Em Pausa' },
  finalizado:  { bg: 'rgba(148,163,184,0.12)', text: '#94a3b8', label: 'Finalizado' },
}

function fmtTime(dateStr) {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

function calcDuracao(entrada, saida, pausaInicio, pausaFim) {
  if (!entrada) return '—'
  const fim = saida ? new Date(saida) : new Date()
  const totalMs = fim - new Date(entrada)
  const pausaMs = (pausaInicio && pausaFim)
    ? new Date(pausaFim) - new Date(pausaInicio)
    : 0
  const trabalhoMs = Math.max(totalMs - pausaMs, 0)
  const h = Math.floor(trabalhoMs / 3_600_000)
  const m = Math.floor((trabalhoMs % 3_600_000) / 60_000)
  return `${h}h ${String(m).padStart(2, '0')}m`
}

function fmtDate(dateStr) {
  if (!dateStr) return '—'
  const [y, m, d] = dateStr.split('-')
  return `${d}/${m}/${y}`
}

export default function PontoHistoricoClient({ registrosIniciais, anoInicial, mesInicial }) {
  const currentYear = new Date().getFullYear()
  const anos = Array.from({ length: 3 }, (_, i) => currentYear - i)

  const [registros, setRegistros]   = useState(registrosIniciais)
  const [ano, setAno]               = useState(anoInicial)
  const [mes, setMes]               = useState(mesInicial)
  const [dia, setDia]               = useState('')
  const [filtroUser, setFiltroUser] = useState('')
  const [busca, setBusca]           = useState('')
  const [expandido, setExpandido]   = useState(null)
  const [isPending, startTransition] = useTransition()

  function carregar(novoAno, novoMes, novoDia, novoUser) {
    startTransition(async () => {
      try {
        const params = { ano: novoAno, mes: novoMes }
        if (novoDia) params.dia = Number(novoDia)
        if (novoUser) params.userId = novoUser
        const data = await getHistoricoPontoAdmin(params)
        setRegistros(data)
      } catch { /* mantém anterior */ }
    })
  }

  function onAnoChange(v) {
    setAno(Number(v))
    setDia('')
    carregar(Number(v), mes, '', filtroUser)
  }

  function onMesChange(v) {
    setMes(Number(v))
    setDia('')
    carregar(ano, Number(v), '', filtroUser)
  }

  function onDiaChange(v) {
    setDia(v)
    carregar(ano, mes, v, filtroUser)
  }

  function onBuscarUser() {
    setFiltroUser(busca.trim())
    carregar(ano, mes, dia, busca.trim())
  }

  function onLimparFiltros() {
    const now = new Date()
    setAno(now.getFullYear())
    setMes(now.getMonth() + 1)
    setDia('')
    setFiltroUser('')
    setBusca('')
    carregar(now.getFullYear(), now.getMonth() + 1, '', '')
  }

  // Agrupamento por usuário
  const grouped = registros.reduce((acc, r) => {
    if (!acc[r.userId]) {
      acc[r.userId] = {
        userId:      r.userId,
        nomeCompleto: r.nomeCompleto,
        role:        r.roleUsuario,
        registros:   [],
      }
    }
    acc[r.userId].registros.push(r)
    return acc
  }, {})

  const grupos = Object.values(grouped).sort((a, b) =>
    a.nomeCompleto.localeCompare(b.nomeCompleto)
  )

  // Dias do mês para o select
  const diasNoMes = new Date(ano, mes, 0).getDate()
  const dias = Array.from({ length: diasNoMes }, (_, i) => i + 1)

  const totalHoje = registros.filter((r) => {
    const today = new Date().toISOString().slice(0, 10)
    return r.date === today
  }).length

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold" style={{ color: '#F7F0E2' }}>
            Histórico de Ponto
          </h1>
          <p className="text-sm mt-0.5" style={{ color: 'rgba(237,227,210,0.5)' }}>
            {registros.length} registros encontrados
            {totalHoje > 0 && (
              <span className="ml-2" style={{ color: '#C45A2C' }}>
                · {totalHoje} hoje
              </span>
            )}
          </p>
        </div>
        <button
          onClick={onLimparFiltros}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors"
          style={{ background: 'rgba(237,227,210,0.08)', color: 'rgba(237,227,210,0.6)' }}
        >
          <RefreshCw className={`size-3.5 ${isPending ? 'animate-spin' : ''}`} />
          Resetar
        </button>
      </div>

      {/* Filtros */}
      <div
        className="rounded-xl p-4 mb-6 flex flex-wrap gap-3 items-end"
        style={{ background: 'rgba(26,18,13,0.6)', border: '1px solid rgba(196,90,44,0.15)' }}
      >
        {/* Ano */}
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium" style={{ color: 'rgba(237,227,210,0.5)' }}>Ano</label>
          <select
            value={ano}
            onChange={(e) => onAnoChange(e.target.value)}
            className="px-3 py-2 rounded-lg text-sm outline-none"
            style={{ background: 'rgba(237,227,210,0.06)', border: '1px solid rgba(196,90,44,0.2)', color: '#EDE3D2' }}
          >
            {anos.map((a) => (
              <option key={a} value={a} style={{ background: '#1A120D' }}>{a}</option>
            ))}
          </select>
        </div>

        {/* Mês */}
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium" style={{ color: 'rgba(237,227,210,0.5)' }}>Mês</label>
          <select
            value={mes}
            onChange={(e) => onMesChange(e.target.value)}
            className="px-3 py-2 rounded-lg text-sm outline-none"
            style={{ background: 'rgba(237,227,210,0.06)', border: '1px solid rgba(196,90,44,0.2)', color: '#EDE3D2' }}
          >
            {MESES.map((m, i) => (
              <option key={i + 1} value={i + 1} style={{ background: '#1A120D' }}>{m}</option>
            ))}
          </select>
        </div>

        {/* Dia */}
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium" style={{ color: 'rgba(237,227,210,0.5)' }}>Dia</label>
          <select
            value={dia}
            onChange={(e) => onDiaChange(e.target.value)}
            className="px-3 py-2 rounded-lg text-sm outline-none"
            style={{ background: 'rgba(237,227,210,0.06)', border: '1px solid rgba(196,90,44,0.2)', color: '#EDE3D2' }}
          >
            <option value="" style={{ background: '#1A120D' }}>Todos os dias</option>
            {dias.map((d) => (
              <option key={d} value={d} style={{ background: '#1A120D' }}>{String(d).padStart(2, '0')}</option>
            ))}
          </select>
        </div>

        {/* Busca por usuário */}
        <div className="flex flex-col gap-1 flex-1 min-w-48">
          <label className="text-xs font-medium" style={{ color: 'rgba(237,227,210,0.5)' }}>Usuário</label>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="username ou nome..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && onBuscarUser()}
              className="flex-1 px-3 py-2 rounded-lg text-sm outline-none"
              style={{ background: 'rgba(237,227,210,0.06)', border: '1px solid rgba(196,90,44,0.2)', color: '#EDE3D2' }}
            />
            <button
              onClick={onBuscarUser}
              className="px-3 py-2 rounded-lg transition-colors"
              style={{ background: '#C45A2C', color: '#F7F0E2' }}
            >
              <Search className="size-4" />
            </button>
          </div>
        </div>

        {isPending && (
          <div className="flex items-center gap-1.5 text-sm pb-2" style={{ color: '#C45A2C' }}>
            <RefreshCw className="size-3.5 animate-spin" />
            Carregando...
          </div>
        )}
      </div>

      {/* Tabela agrupada por usuário */}
      {grupos.length === 0 ? (
        <div
          className="rounded-xl p-12 text-center"
          style={{ background: 'rgba(26,18,13,0.4)', border: '1px solid rgba(196,90,44,0.1)' }}
        >
          <Clock className="size-10 mx-auto mb-3" style={{ color: 'rgba(196,90,44,0.4)' }} />
          <p className="text-sm" style={{ color: 'rgba(237,227,210,0.4)' }}>
            Nenhum registro encontrado para os filtros selecionados
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {grupos.map((grupo) => {
            const aberto = expandido === grupo.userId
            const totalRegistros = grupo.registros.length
            const finalizados = grupo.registros.filter((r) => r.status === 'finalizado').length

            return (
              <div
                key={grupo.userId}
                className="rounded-xl overflow-hidden"
                style={{ border: '1px solid rgba(196,90,44,0.15)', background: 'rgba(26,18,13,0.5)' }}
              >
                {/* Cabeçalho do grupo */}
                <button
                  onClick={() => setExpandido(aberto ? null : grupo.userId)}
                  className="w-full flex items-center justify-between px-4 py-3 transition-colors hover:bg-white/5"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="size-9 rounded-full flex items-center justify-center text-sm font-semibold"
                      style={{ background: 'rgba(196,90,44,0.15)', color: '#C45A2C' }}
                    >
                      {(grupo.nomeCompleto || grupo.userId)[0].toUpperCase()}
                    </div>
                    <div className="text-left">
                      <p className="text-sm font-medium" style={{ color: '#EDE3D2' }}>
                        {grupo.nomeCompleto}
                      </p>
                      <p className="text-xs" style={{ color: 'rgba(237,227,210,0.4)' }}>
                        @{grupo.userId}
                        {grupo.role && (
                          <span className="ml-1.5" style={{ color: 'rgba(196,90,44,0.7)' }}>
                            · {ROLE_LABELS[grupo.role] || grupo.role}
                          </span>
                        )}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right hidden sm:block">
                      <p className="text-sm font-medium" style={{ color: '#EDE3D2' }}>
                        {totalRegistros} {totalRegistros === 1 ? 'dia' : 'dias'}
                      </p>
                      <p className="text-xs" style={{ color: 'rgba(237,227,210,0.4)' }}>
                        {finalizados} finalizado{finalizados !== 1 ? 's' : ''}
                      </p>
                    </div>
                    {aberto
                      ? <ChevronUp className="size-4" style={{ color: 'rgba(237,227,210,0.4)' }} />
                      : <ChevronDown className="size-4" style={{ color: 'rgba(237,227,210,0.4)' }} />
                    }
                  </div>
                </button>

                {/* Registros do usuário */}
                {aberto && (
                  <div style={{ borderTop: '1px solid rgba(196,90,44,0.1)' }}>
                    <table className="w-full text-sm">
                      <thead>
                        <tr style={{ background: 'rgba(0,0,0,0.2)' }}>
                          {['Data', 'Entrada', 'Início Pausa', 'Fim Pausa', 'Saída', 'Trabalhado', 'Status'].map((h) => (
                            <th
                              key={h}
                              className="px-4 py-2 text-left text-xs font-medium"
                              style={{ color: 'rgba(237,227,210,0.4)' }}
                            >
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {grupo.registros.map((rec) => {
                          const st = STATUS_COLORS[rec.status] || STATUS_COLORS.finalizado
                          const duracao = calcDuracao(rec.entrada, rec.saida, rec.pausaInicio, rec.pausaFim)
                          return (
                            <tr
                              key={rec._id}
                              className="transition-colors hover:bg-white/5"
                              style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}
                            >
                              <td className="px-4 py-3 font-medium" style={{ color: '#EDE3D2' }}>
                                {fmtDate(rec.date)}
                              </td>
                              <td className="px-4 py-3" style={{ color: 'rgba(237,227,210,0.7)' }}>
                                <span className="flex items-center gap-1">
                                  {fmtTime(rec.entrada)}
                                  {rec.entradaLocation && (
                                    <MapPin className="size-3" style={{ color: '#C45A2C' }} title={`${rec.entradaLocation.lat.toFixed(4)}, ${rec.entradaLocation.lng.toFixed(4)}`} />
                                  )}
                                </span>
                              </td>
                              <td className="px-4 py-3" style={{ color: 'rgba(237,227,210,0.7)' }}>
                                {fmtTime(rec.pausaInicio)}
                              </td>
                              <td className="px-4 py-3" style={{ color: 'rgba(237,227,210,0.7)' }}>
                                {fmtTime(rec.pausaFim)}
                              </td>
                              <td className="px-4 py-3" style={{ color: 'rgba(237,227,210,0.7)' }}>
                                <span className="flex items-center gap-1">
                                  {fmtTime(rec.saida)}
                                  {rec.saidaLocation && (
                                    <MapPin className="size-3" style={{ color: '#C45A2C' }} title={`${rec.saidaLocation.lat.toFixed(4)}, ${rec.saidaLocation.lng.toFixed(4)}`} />
                                  )}
                                </span>
                              </td>
                              <td className="px-4 py-3 font-medium" style={{ color: '#C45A2C' }}>
                                {duracao}
                              </td>
                              <td className="px-4 py-3">
                                <span
                                  className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium"
                                  style={{ background: st.bg, color: st.text }}
                                >
                                  {st.label}
                                </span>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
