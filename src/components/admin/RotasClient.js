'use client'

import { useState, useTransition } from 'react'
import { upsertRota, deleteRota } from '@/actions/rotas'

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

const TIPOS = ['BACKBONE', 'RAMAL', 'DROP']

const TIPO_CORES = {
  BACKBONE: 'text-blue-300',
  RAMAL: 'text-orange-300',
  DROP: 'text-emerald-300',
}

export default function RotasClient({ rotasIniciais, projetoId, userRole }) {
  // rotasIniciais are GeoJSON Features: { type, id, geometry, properties }
  const [rotas, setRotas] = useState(rotasIniciais)
  const [modalAberto, setModalAberto] = useState(false)
  const [rotaEditando, setRotaEditando] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [erro, setErro] = useState(null)
  const [sucesso, setSucesso] = useState(null)
  const [isPending, startTransition] = useTransition()

  const [form, setForm] = useState({
    rota_id: '',
    nome: '',
    tipo: 'RAMAL',
    coordinates: '',
    obs: '',
  })

  function abrirNovo() {
    setForm({ rota_id: '', nome: '', tipo: 'RAMAL', coordinates: '', obs: '' })
    setRotaEditando(null)
    setErro(null)
    setModalAberto(true)
  }

  function abrirEditar(rota) {
    const props = rota.properties ?? rota
    const coords = rota.geometry?.coordinates ?? []
    setForm({
      rota_id: props.rota_id ?? '',
      nome: props.nome ?? '',
      tipo: props.tipo ?? 'RAMAL',
      coordinates: coords.length > 0 ? JSON.stringify(coords, null, 2) : '',
      obs: props.obs ?? '',
    })
    setRotaEditando(rota)
    setErro(null)
    setModalAberto(true)
  }

  function fecharModal() {
    setModalAberto(false)
    setRotaEditando(null)
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
        let coordinates
        try {
          coordinates = JSON.parse(form.coordinates)
        } catch {
          throw new Error('Coordenadas inválidas. Informe um array JSON válido, ex: [[-46.6, -23.5], [-46.7, -23.6]]')
        }

        const resultado = await upsertRota({
          rota_id: form.rota_id,
          projeto_id: projetoId,
          coordinates,
          geometry_type: 'LineString',
          nome: form.nome || null,
          tipo: form.tipo || null,
          obs: form.obs || null,
        })

        // Converte o documento retornado para formato Feature para consistência de estado
        const feature = {
          type: 'Feature',
          id: resultado.rota_id,
          geometry: {
            type: resultado.geometry_type ?? 'LineString',
            coordinates: resultado.coordinates ?? [],
          },
          properties: {
            rota_id: resultado.rota_id,
            nome: resultado.nome,
            tipo: resultado.tipo,
            obs: resultado.obs,
            projeto_id: resultado.projeto_id,
            _id: resultado._id,
          },
        }

        if (rotaEditando) {
          const rotaId = (rotaEditando.properties ?? rotaEditando).rota_id
          setRotas((prev) => prev.map((r) => {
            const rId = (r.properties ?? r).rota_id
            return rId === rotaId ? feature : r
          }))
        } else {
          setRotas((prev) => [feature, ...prev])
        }

        setSucesso(rotaEditando ? 'Rota atualizada com sucesso.' : 'Rota criada com sucesso.')
        setTimeout(() => setSucesso(null), 3000)
        fecharModal()
      } catch (e) {
        setErro(e.message)
      }
    })
  }

  function handleExcluir(rota) {
    setConfirmDelete(rota)
  }

  function confirmarExclusao() {
    if (!confirmDelete) return
    startTransition(async () => {
      try {
        const rotaId = (confirmDelete.properties ?? confirmDelete).rota_id
        await deleteRota(rotaId, projetoId)
        setRotas((prev) => prev.filter((r) => {
          const rId = (r.properties ?? r).rota_id
          return rId !== rotaId
        }))
        setSucesso('Rota removida.')
        setTimeout(() => setSucesso(null), 3000)
      } catch (e) {
        setErro(e.message)
      } finally {
        setConfirmDelete(null)
      }
    })
  }

  const getRotaId = (rota) => (rota.properties ?? rota).rota_id ?? '—'
  const getRotaNome = (rota) => (rota.properties ?? rota).nome ?? '—'
  const getRotaTipo = (rota) => (rota.properties ?? rota).tipo ?? '—'
  const getRotaPontos = (rota) => rota.geometry?.coordinates?.length ?? 0

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
          + Nova Rota
        </button>
      </div>

      {/* Tabela */}
      <div style={cardStyle} className="rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: '1px solid #1f2937', backgroundColor: '#0d1526' }}>
                {['ID', 'Nome', 'Tipo', 'Pontos', 'Ações'].map((h) => (
                  <th key={h} className="text-left text-xs text-slate-400 font-semibold uppercase tracking-wider px-4 py-3">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rotas.length === 0 && (
                <tr>
                  <td colSpan={5} className="text-center text-slate-500 py-12 text-sm">
                    Nenhuma rota cadastrada ainda.
                  </td>
                </tr>
              )}
              {rotas.map((rota, i) => {
                const tipo = getRotaTipo(rota)
                return (
                  <tr
                    key={(rota.properties ?? rota)._id ?? i}
                    style={{ borderBottom: i < rotas.length - 1 ? '1px solid #1f2937' : 'none' }}
                    className="hover:bg-slate-800/30 transition-colors"
                  >
                    <td className="px-4 py-3 font-mono text-xs text-sky-400">{getRotaId(rota)}</td>
                    <td className="px-4 py-3 text-slate-200">{getRotaNome(rota)}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-semibold ${TIPO_CORES[tipo] ?? 'text-slate-300'}`}>
                        {tipo}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-400 text-xs">
                      {getRotaPontos(rota)} pontos
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => abrirEditar(rota)}
                          className="text-xs text-sky-400 hover:text-sky-300 transition-colors"
                        >
                          Editar
                        </button>
                        <span className="text-slate-700">|</span>
                        <button
                          onClick={() => handleExcluir(rota)}
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

      {/* Modal Nova/Editar Rota */}
      {modalAberto && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={modalBgStyle}
        >
          <div style={cardStyle} className="rounded-2xl w-full max-w-lg p-6">
            <h2 className="text-lg font-bold text-white mb-5">
              {rotaEditando ? 'Editar Rota' : 'Nova Rota'}
            </h2>

            <div className="grid grid-cols-2 gap-4 mb-4">
              <div className="flex flex-col gap-1">
                <label className="text-xs text-slate-400 uppercase tracking-wider">ID da Rota *</label>
                <input
                  name="rota_id"
                  value={form.rota_id}
                  onChange={handleFormChange}
                  disabled={!!rotaEditando}
                  placeholder="ex: RT-001"
                  style={inputStyle}
                  className="rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 disabled:opacity-50"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs text-slate-400 uppercase tracking-wider">Tipo</label>
                <select
                  name="tipo"
                  value={form.tipo}
                  onChange={handleFormChange}
                  style={inputStyle}
                  className="rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                >
                  {TIPOS.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-1 col-span-2">
                <label className="text-xs text-slate-400 uppercase tracking-wider">Nome</label>
                <input
                  name="nome"
                  value={form.nome}
                  onChange={handleFormChange}
                  placeholder="Nome da rota"
                  style={inputStyle}
                  className="rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>
              <div className="flex flex-col gap-1 col-span-2">
                <label className="text-xs text-slate-400 uppercase tracking-wider">
                  Coordenadas * <span className="normal-case text-slate-500">(JSON: [[lng, lat], ...])</span>
                </label>
                <textarea
                  name="coordinates"
                  value={form.coordinates}
                  onChange={handleFormChange}
                  rows={6}
                  placeholder={`[[-46.6333, -23.5505], [-46.6340, -23.5510]]`}
                  style={{ ...inputStyle, fontFamily: 'monospace', fontSize: '12px', resize: 'vertical' }}
                  className="rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
                <p className="text-xs text-slate-500">Formato GeoJSON: [longitude, latitude] por ponto, mínimo 2 pontos.</p>
              </div>
              <div className="flex flex-col gap-1 col-span-2">
                <label className="text-xs text-slate-400 uppercase tracking-wider">Observações</label>
                <textarea
                  name="obs"
                  value={form.obs}
                  onChange={handleFormChange}
                  rows={2}
                  placeholder="Observações sobre a rota..."
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
                disabled={isPending || !form.rota_id || !form.coordinates}
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
            <p className="text-white font-semibold mb-2">Excluir Rota?</p>
            <p className="text-sm text-slate-400 mb-6">
              A rota <span className="text-white font-mono">{getRotaId(confirmDelete)}</span> será
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
