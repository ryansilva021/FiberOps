'use client'

import { useState, useTransition } from 'react'
import dynamic from 'next/dynamic'
import { upsertCTO, deleteCTO } from '@/actions/ctos'

const LocationPicker = dynamic(() => import('@/components/map/LocationPicker'), {
  ssr: false,
  loading: () => (
    <div style={{ height: 220, backgroundColor: '#0d1526', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <span style={{ color: '#475569', fontSize: 13 }}>Carregando mapa...</span>
    </div>
  ),
})

const CAPACIDADES = [8, 16, 24, 32, 48, 64]

const inputStyle = {
  backgroundColor: '#0b1220',
  border: '1px solid #1f2937',
  color: '#f1f5f9',
}

const cardStyle = {
  backgroundColor: '#111827',
  border: '1px solid #1f2937',
}

const modalBgStyle = {
  backgroundColor: 'rgba(0,0,0,0.7)',
}

export default function CTOsClient({ ctosIniciais, projetoId, userRole }) {
  const [ctos, setCTOs] = useState(ctosIniciais)
  const [modalAberto, setModalAberto] = useState(false)
  const [ctoEditando, setCTOEditando] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [erro, setErro] = useState(null)
  const [sucesso, setSucesso] = useState(null)
  const [isPending, startTransition] = useTransition()
  const [mostrarMapa, setMostrarMapa] = useState(false)
  const [gpsCarregando, setGpsCarregando] = useState(false)

  const [form, setForm] = useState({
    cto_id: '',
    nome: '',
    rua: '',
    bairro: '',
    capacidade: 16,
    lat: '',
    lng: '',
    cdo_id: '',
    porta_cdo: '',
    splitter_cto: '',
  })

  function abrirNovo() {
    setForm({ cto_id: '', nome: '', rua: '', bairro: '', capacidade: 16, lat: '', lng: '', cdo_id: '', porta_cdo: '', splitter_cto: '' })
    setCTOEditando(null)
    setErro(null)
    setModalAberto(true)
  }

  function abrirEditar(cto) {
    setForm({
      cto_id: cto.cto_id,
      nome: cto.nome ?? '',
      rua: cto.rua ?? '',
      bairro: cto.bairro ?? '',
      capacidade: cto.capacidade ?? 16,
      lat: cto.lat ?? '',
      lng: cto.lng ?? '',
      cdo_id: cto.cdo_id ?? '',
      porta_cdo: cto.porta_cdo != null ? String(cto.porta_cdo) : '',
      splitter_cto: cto.splitter_cto ?? '',
    })
    setCTOEditando(cto)
    setErro(null)
    setModalAberto(true)
  }

  function fecharModal() {
    setModalAberto(false)
    setCTOEditando(null)
    setErro(null)
    setMostrarMapa(false)
  }

  function usarGPS() {
    if (!navigator.geolocation) {
      setErro('Geolocalização não suportada neste dispositivo.')
      return
    }
    setGpsCarregando(true)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setForm((prev) => ({
          ...prev,
          lat: pos.coords.latitude.toFixed(7),
          lng: pos.coords.longitude.toFixed(7),
        }))
        setGpsCarregando(false)
      },
      () => {
        setErro('Não foi possível obter a localização GPS.')
        setGpsCarregando(false)
      },
      { enableHighAccuracy: true, timeout: 10000 }
    )
  }

  function handleFormChange(e) {
    const { name, value } = e.target
    setForm((prev) => ({ ...prev, [name]: value }))
  }

  function handleSalvar() {
    setErro(null)
    startTransition(async () => {
      try {
        const resultado = await upsertCTO({
          ...form,
          projeto_id: projetoId,
          lat: parseFloat(form.lat),
          lng: parseFloat(form.lng),
          capacidade: parseInt(form.capacidade),
          porta_cdo: form.porta_cdo ? parseInt(form.porta_cdo) : null,
          splitter_cto: form.splitter_cto || null,
        })
        if (ctoEditando) {
          setCTOs((prev) => prev.map((c) => (c.cto_id === resultado.cto_id ? resultado : c)))
        } else {
          setCTOs((prev) => [resultado, ...prev])
        }
        setSucesso(ctoEditando ? 'CTO atualizada com sucesso.' : 'CTO criada com sucesso.')
        setTimeout(() => setSucesso(null), 3000)
        fecharModal()
      } catch (e) {
        setErro(e.message)
      }
    })
  }

  function handleExcluir(cto) {
    setConfirmDelete(cto)
  }

  function confirmarExclusao() {
    if (!confirmDelete) return
    startTransition(async () => {
      try {
        await deleteCTO(confirmDelete.cto_id, projetoId)
        setCTOs((prev) => prev.filter((c) => c.cto_id !== confirmDelete.cto_id))
        setSucesso('CTO removida.')
        setTimeout(() => setSucesso(null), 3000)
      } catch (e) {
        setErro(e.message)
      } finally {
        setConfirmDelete(null)
      }
    })
  }

  const ocupacaoPct = (cto) => {
    if (!cto.capacidade) return 0
    return Math.round(((cto.ocupacao ?? 0) / cto.capacidade) * 100)
  }

  return (
    <>
      {/* Barra de ações */}
      <div className="flex items-center justify-between mb-4">
        {sucesso && (
          <p className="text-sm text-green-400">{sucesso}</p>
        )}
        {!sucesso && <div />}
        <button
          onClick={abrirNovo}
          className="bg-sky-600 hover:bg-sky-500 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
        >
          + Nova CTO
        </button>
      </div>

      {/* Tabela */}
      <div style={cardStyle} className="rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: '1px solid #1f2937', backgroundColor: '#0d1526' }}>
                {['ID', 'Nome', 'Endereço', 'Capacidade', 'Ocupação', 'CDO', 'Ações'].map((h) => (
                  <th key={h} className="text-left text-xs text-slate-400 font-semibold uppercase tracking-wider px-4 py-3">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ctos.length === 0 && (
                <tr>
                  <td colSpan={7} className="text-center text-slate-500 py-12 text-sm">
                    Nenhuma CTO cadastrada ainda.
                  </td>
                </tr>
              )}
              {ctos.map((cto, i) => {
                const pct = ocupacaoPct(cto)
                return (
                  <tr
                    key={cto._id}
                    style={{ borderBottom: i < ctos.length - 1 ? '1px solid #1f2937' : 'none' }}
                    className="hover:bg-slate-800/30 transition-colors"
                  >
                    <td className="px-4 py-3 font-mono text-xs text-sky-400">{cto.cto_id}</td>
                    <td className="px-4 py-3 text-slate-200">{cto.nome ?? '—'}</td>
                    <td className="px-4 py-3 text-slate-400 text-xs">
                      {[cto.rua, cto.bairro].filter(Boolean).join(', ') || '—'}
                    </td>
                    <td className="px-4 py-3 text-slate-300">{cto.capacidade ?? '—'}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div
                          style={{ backgroundColor: '#1f2937' }}
                          className="w-16 h-1.5 rounded-full overflow-hidden"
                        >
                          <div
                            style={{
                              width: `${pct}%`,
                              backgroundColor: pct > 80 ? '#ef4444' : pct > 50 ? '#f59e0b' : '#22c55e',
                            }}
                            className="h-full rounded-full transition-all"
                          />
                        </div>
                        <span className="text-xs text-slate-400">
                          {cto.ocupacao ?? 0}/{cto.capacidade ?? 0}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-400">{cto.cdo_id ?? '—'}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => abrirEditar(cto)}
                          className="text-xs text-sky-400 hover:text-sky-300 transition-colors"
                        >
                          Editar
                        </button>
                        <span className="text-slate-700">|</span>
                        <button
                          onClick={() => handleExcluir(cto)}
                          className="text-xs text-red-400 hover:text-red-300 transition-colors"
                        >
                          Excluir
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Nova/Editar CTO */}
      {modalAberto && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={modalBgStyle}
        >
          <div style={cardStyle} className="rounded-2xl w-full max-w-lg p-6">
            <h2 className="text-lg font-bold text-white mb-5">
              {ctoEditando ? 'Editar CTO' : 'Nova CTO'}
            </h2>

            <div className="grid grid-cols-2 gap-4 mb-4">
              <div className="flex flex-col gap-1">
                <label className="text-xs text-slate-400 uppercase tracking-wider">ID da CTO *</label>
                <input
                  name="cto_id"
                  value={form.cto_id}
                  onChange={handleFormChange}
                  disabled={!!ctoEditando}
                  placeholder="ex: CTO-001"
                  style={inputStyle}
                  className="rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 disabled:opacity-50"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs text-slate-400 uppercase tracking-wider">Nome</label>
                <input
                  name="nome"
                  value={form.nome}
                  onChange={handleFormChange}
                  placeholder="Nome descritivo"
                  style={inputStyle}
                  className="rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs text-slate-400 uppercase tracking-wider">Rua</label>
                <input
                  name="rua"
                  value={form.rua}
                  onChange={handleFormChange}
                  placeholder="Rua / Av."
                  style={inputStyle}
                  className="rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs text-slate-400 uppercase tracking-wider">Bairro</label>
                <input
                  name="bairro"
                  value={form.bairro}
                  onChange={handleFormChange}
                  placeholder="Bairro"
                  style={inputStyle}
                  className="rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>
              {/* Coordenadas + ações de localização */}
              <div className="col-span-2 flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs text-slate-400 uppercase tracking-wider">Localização *</label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={usarGPS}
                      disabled={gpsCarregando}
                      style={{ border: '1px solid #1e40af', color: '#93c5fd', backgroundColor: '#1e3a5f' }}
                      className="text-xs px-3 py-1 rounded-lg disabled:opacity-40 hover:brightness-110 transition-all flex items-center gap-1"
                    >
                      {gpsCarregando ? '⏳ Obtendo...' : '📍 Usar GPS'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setMostrarMapa((v) => !v)}
                      style={{ border: '1px solid #065f46', color: '#6ee7b7', backgroundColor: '#064e3b' }}
                      className="text-xs px-3 py-1 rounded-lg hover:brightness-110 transition-all"
                    >
                      {mostrarMapa ? '✕ Fechar mapa' : '🗺 Selecionar no mapa'}
                    </button>
                  </div>
                </div>

                {mostrarMapa && (
                  <LocationPicker
                    lat={form.lat}
                    lng={form.lng}
                    onChange={(lat, lng) =>
                      setForm((prev) => ({ ...prev, lat: String(lat), lng: String(lng) }))
                    }
                  />
                )}

                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1">
                    <label className="text-xs text-slate-500">Latitude</label>
                    <input
                      name="lat"
                      value={form.lat}
                      onChange={handleFormChange}
                      placeholder="-23.550520"
                      type="number"
                      step="any"
                      style={inputStyle}
                      className="rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-xs text-slate-500">Longitude</label>
                    <input
                      name="lng"
                      value={form.lng}
                      onChange={handleFormChange}
                      placeholder="-46.633309"
                      type="number"
                      step="any"
                      style={inputStyle}
                      className="rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                    />
                  </div>
                </div>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs text-slate-400 uppercase tracking-wider">Capacidade</label>
                <select
                  name="capacidade"
                  value={form.capacidade}
                  onChange={handleFormChange}
                  style={inputStyle}
                  className="rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                >
                  {CAPACIDADES.map((c) => (
                    <option key={c} value={c}>{c} portas</option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs text-slate-400 uppercase tracking-wider">CDO vinculado</label>
                <input
                  name="cdo_id"
                  value={form.cdo_id}
                  onChange={handleFormChange}
                  placeholder="ID do CDO"
                  style={inputStyle}
                  className="rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs text-slate-400 uppercase tracking-wider">Porta CDO</label>
                <input
                  name="porta_cdo"
                  value={form.porta_cdo}
                  onChange={handleFormChange}
                  placeholder="ex: 1"
                  type="number"
                  min={1}
                  style={inputStyle}
                  className="rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>
              <div className="flex flex-col gap-1 col-span-2">
                <label className="text-xs text-slate-400 uppercase tracking-wider">Splitter CTO</label>
                <input
                  name="splitter_cto"
                  value={form.splitter_cto}
                  onChange={handleFormChange}
                  placeholder="ex: 1:8, 1:16, passthrough"
                  style={inputStyle}
                  className="rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>
            </div>

            {erro && (
              <div
                style={{ backgroundColor: '#450a0a', border: '1px solid #7f1d1d' }}
                className="rounded-lg px-4 py-3 text-sm text-red-400 mb-4"
              >
                {erro}
              </div>
            )}

            <div className="flex justify-end gap-3">
              <button
                onClick={fecharModal}
                disabled={isPending}
                style={{ border: '1px solid #1f2937', color: '#94a3b8' }}
                className="px-4 py-2 rounded-lg text-sm hover:bg-slate-800 transition-colors disabled:opacity-40"
              >
                Cancelar
              </button>
              <button
                onClick={handleSalvar}
                disabled={isPending || !form.cto_id || !form.lat || !form.lng}
                className="bg-sky-600 hover:bg-sky-500 disabled:opacity-40 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
              >
                {isPending ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm delete */}
      {confirmDelete && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={modalBgStyle}
        >
          <div style={cardStyle} className="rounded-2xl w-full max-w-sm p-6 text-center">
            <p className="text-white font-semibold mb-2">Excluir CTO?</p>
            <p className="text-sm text-slate-400 mb-6">
              A CTO <span className="text-white font-mono">{confirmDelete.cto_id}</span> será
              removida permanentemente.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmDelete(null)}
                style={{ border: '1px solid #1f2937', color: '#94a3b8' }}
                className="flex-1 py-2 rounded-lg text-sm hover:bg-slate-800 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={confirmarExclusao}
                disabled={isPending}
                className="flex-1 bg-red-600 hover:bg-red-500 disabled:opacity-40 text-white text-sm font-semibold py-2 rounded-lg transition-colors"
              >
                {isPending ? 'Removendo...' : 'Excluir'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
