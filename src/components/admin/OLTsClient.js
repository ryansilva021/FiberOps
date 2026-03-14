'use client'

import { useState, useTransition } from 'react'
import { upsertOLT, deleteOLT } from '@/actions/olts'

const cardStyle = {
  backgroundColor: '#111827',
  border: '1px solid #1f2937',
}

const modalBgStyle = {
  backgroundColor: 'rgba(0,0,0,0.7)',
}

const inputStyle = {
  backgroundColor: '#0b1220',
  border: '1px solid #1f2937',
  color: '#f1f5f9',
}

const STATUS_CORES = {
  ativo: 'text-green-400',
  inativo: 'text-slate-500',
  em_manutencao: 'text-yellow-400',
}

export default function OLTsClient({ oltsIniciais, projetoId, userRole }) {
  const [olts, setOLTs] = useState(oltsIniciais)
  const [modalAberto, setModalAberto] = useState(false)
  const [oltEditando, setOLTEditando] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [erro, setErro] = useState(null)
  const [sucesso, setSucesso] = useState(null)
  const [isPending, startTransition] = useTransition()

  // OLT model uses 'id' field (not 'olt_id'). The action upsertOLT accepts 'olt_id'.
  const [form, setForm] = useState({
    olt_id: '',
    nome: '',
    modelo: '',
    ip: '',
    portas_pon: '',
    lat: '',
    lng: '',
    obs: '',
  })

  function abrirNovo() {
    setForm({ olt_id: '', nome: '', modelo: '', ip: '', portas_pon: '', lat: '', lng: '', obs: '' })
    setOLTEditando(null)
    setErro(null)
    setModalAberto(true)
  }

  function abrirEditar(olt) {
    // The model field is 'id', the action accepts 'olt_id'
    setForm({
      olt_id: olt.id ?? olt.olt_id ?? '',
      nome: olt.nome ?? '',
      modelo: olt.modelo ?? '',
      ip: olt.ip ?? '',
      portas_pon: olt.portas_pon != null ? String(olt.portas_pon) : olt.capacidade != null ? String(olt.capacidade) : '',
      lat: olt.lat != null ? String(olt.lat) : '',
      lng: olt.lng != null ? String(olt.lng) : '',
      obs: olt.obs ?? '',
    })
    setOLTEditando(olt)
    setErro(null)
    setModalAberto(true)
  }

  function fecharModal() {
    setModalAberto(false)
    setOLTEditando(null)
    setErro(null)
  }

  function handleFormChange(e) {
    const { name, value } = e.target
    setForm((prev) => ({ ...prev, [name]: value }))
  }

  function handleSalvar() {
    setErro(null)
    startTransition(async () => {
      try {
        const resultado = await upsertOLT({
          olt_id: form.olt_id,
          projeto_id: projetoId,
          lat: parseFloat(form.lat),
          lng: parseFloat(form.lng),
          nome: form.nome || null,
          modelo: form.modelo || null,
          ip: form.ip || null,
          portas_pon: form.portas_pon ? parseInt(form.portas_pon) : 0,
        })

        const idResultado = resultado.id ?? resultado.olt_id
        if (oltEditando) {
          const idEditando = oltEditando.id ?? oltEditando.olt_id
          setOLTs((prev) => prev.map((o) => {
            const oId = o.id ?? o.olt_id
            return oId === idEditando ? resultado : o
          }))
        } else {
          setOLTs((prev) => [resultado, ...prev])
        }

        setSucesso(oltEditando ? 'OLT atualizada com sucesso.' : 'OLT criada com sucesso.')
        setTimeout(() => setSucesso(null), 3000)
        fecharModal()
      } catch (e) {
        setErro(e.message)
      }
    })
  }

  function handleExcluir(olt) {
    setConfirmDelete(olt)
  }

  function confirmarExclusao() {
    if (!confirmDelete) return
    startTransition(async () => {
      try {
        const oltId = confirmDelete.id ?? confirmDelete.olt_id
        await deleteOLT(oltId, projetoId)
        setOLTs((prev) => prev.filter((o) => {
          const oId = o.id ?? o.olt_id
          return oId !== oltId
        }))
        setSucesso('OLT removida.')
        setTimeout(() => setSucesso(null), 3000)
      } catch (e) {
        setErro(e.message)
      } finally {
        setConfirmDelete(null)
      }
    })
  }

  const getOLTId = (olt) => olt.id ?? olt.olt_id ?? '—'
  // portas_pon in the action result; capacidade is the model field name
  const getCapacidade = (olt) => olt.portas_pon ?? olt.capacidade ?? '—'

  return (
    <>
      {/* Barra de ações */}
      <div className="flex items-center justify-between mb-4">
        {sucesso && (
          <p className="text-sm text-green-400">{sucesso}</p>
        )}
        {erro && !modalAberto && (
          <p className="text-sm text-red-400">{erro}</p>
        )}
        {!sucesso && !erro && <div />}
        <button
          onClick={abrirNovo}
          className="bg-sky-600 hover:bg-sky-500 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
        >
          + Nova OLT
        </button>
      </div>

      {/* Tabela */}
      <div style={cardStyle} className="rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: '1px solid #1f2937', backgroundColor: '#0d1526' }}>
                {['ID', 'Nome', 'IP', 'Modelo', 'Portas PON', 'Status', 'Ações'].map((h) => (
                  <th key={h} className="text-left text-xs text-slate-400 font-semibold uppercase tracking-wider px-4 py-3">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {olts.length === 0 && (
                <tr>
                  <td colSpan={7} className="text-center text-slate-500 py-12 text-sm">
                    Nenhuma OLT cadastrada ainda.
                  </td>
                </tr>
              )}
              {olts.map((olt, i) => (
                <tr
                  key={olt._id}
                  style={{ borderBottom: i < olts.length - 1 ? '1px solid #1f2937' : 'none' }}
                  className="hover:bg-slate-800/30 transition-colors"
                >
                  <td className="px-4 py-3 font-mono text-xs text-sky-400">{getOLTId(olt)}</td>
                  <td className="px-4 py-3 text-slate-200">{olt.nome ?? '—'}</td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-300">{olt.ip ?? '—'}</td>
                  <td className="px-4 py-3 text-slate-400 text-xs">{olt.modelo ?? '—'}</td>
                  <td className="px-4 py-3 text-slate-300">{getCapacidade(olt)}</td>
                  <td className="px-4 py-3 text-xs">
                    <span className={STATUS_CORES[olt.status] ?? 'text-slate-400'}>
                      {olt.status ?? '—'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => abrirEditar(olt)}
                        className="text-xs text-sky-400 hover:text-sky-300 transition-colors"
                      >
                        Editar
                      </button>
                      <span className="text-slate-700">|</span>
                      <button
                        onClick={() => handleExcluir(olt)}
                        className="text-xs text-red-400 hover:text-red-300 transition-colors"
                      >
                        Excluir
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Nova/Editar OLT */}
      {modalAberto && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={modalBgStyle}
        >
          <div style={cardStyle} className="rounded-2xl w-full max-w-lg p-6">
            <h2 className="text-lg font-bold text-white mb-5">
              {oltEditando ? 'Editar OLT' : 'Nova OLT'}
            </h2>

            <div className="grid grid-cols-2 gap-4 mb-4">
              <div className="flex flex-col gap-1">
                <label className="text-xs text-slate-400 uppercase tracking-wider">ID da OLT *</label>
                <input
                  name="olt_id"
                  value={form.olt_id}
                  onChange={handleFormChange}
                  disabled={!!oltEditando}
                  placeholder="ex: OLT-001"
                  style={inputStyle}
                  className="rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 disabled:opacity-50"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs text-slate-400 uppercase tracking-wider">Nome *</label>
                <input
                  name="nome"
                  value={form.nome}
                  onChange={handleFormChange}
                  placeholder="Nome da OLT"
                  style={inputStyle}
                  className="rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs text-slate-400 uppercase tracking-wider">Modelo</label>
                <input
                  name="modelo"
                  value={form.modelo}
                  onChange={handleFormChange}
                  placeholder="ex: Huawei MA5800"
                  style={inputStyle}
                  className="rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs text-slate-400 uppercase tracking-wider">IP de Gestão</label>
                <input
                  name="ip"
                  value={form.ip}
                  onChange={handleFormChange}
                  placeholder="ex: 192.168.1.100"
                  style={inputStyle}
                  className="rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs text-slate-400 uppercase tracking-wider">Portas PON</label>
                <input
                  name="portas_pon"
                  value={form.portas_pon}
                  onChange={handleFormChange}
                  placeholder="ex: 16"
                  type="number"
                  min={1}
                  style={inputStyle}
                  className="rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs text-slate-400 uppercase tracking-wider">Latitude *</label>
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
              <div className="flex flex-col gap-1 col-span-2">
                <label className="text-xs text-slate-400 uppercase tracking-wider">Longitude *</label>
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
              <div className="flex flex-col gap-1 col-span-2">
                <label className="text-xs text-slate-400 uppercase tracking-wider">Observações</label>
                <textarea
                  name="obs"
                  value={form.obs}
                  onChange={handleFormChange}
                  rows={3}
                  placeholder="Observações..."
                  style={{ ...inputStyle, resize: 'vertical' }}
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
                disabled={isPending || !form.olt_id || !form.nome || !form.lat || !form.lng}
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
            <p className="text-white font-semibold mb-2">Excluir OLT?</p>
            <p className="text-sm text-slate-400 mb-6">
              A OLT <span className="text-white font-mono">{getOLTId(confirmDelete)}</span> será
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
