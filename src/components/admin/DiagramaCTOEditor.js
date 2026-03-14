'use client'

/**
 * DiagramaCTOEditor.js
 * Editor visual de diagrama de portas para uma CTO.
 *
 * Props:
 *   ctoId            {string}       — identificador da CTO (cto_id)
 *   projetoId        {string}       — tenant
 *   capacidadePortas {number}       — total de portas da CTO
 *   initialDiagrama  {object|null}  — diagrama já carregado (campo diagrama do documento)
 */

import { useState, useTransition, useEffect } from 'react'
import { getDiagramaCTO, saveDiagramaCTO } from '@/actions/ctos'

// ---------------------------------------------------------------------------
// Estilos reutilizáveis
// ---------------------------------------------------------------------------
const S = {
  container: {
    backgroundColor: '#111827',
    border: '1px solid #1f2937',
    borderRadius: '12px',
    padding: '24px',
    color: '#f1f5f9',
  },
  inputBase: {
    backgroundColor: '#0b1220',
    border: '1px solid #374151',
    color: '#f1f5f9',
    borderRadius: '6px',
    padding: '6px 10px',
    fontSize: '13px',
    width: '100%',
    outline: 'none',
    boxSizing: 'border-box',
  },
  cardOcupada: {
    backgroundColor: '#1e3a5f',
    border: '1px solid #2563eb',
    borderRadius: '10px',
    padding: '14px',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  cardLivre: {
    backgroundColor: '#1f2937',
    border: '1px solid #374151',
    borderRadius: '10px',
    padding: '14px',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  label: {
    fontSize: '11px',
    fontWeight: '600',
    letterSpacing: '0.05em',
    textTransform: 'uppercase',
    color: '#94a3b8',
  },
  portaNum: {
    fontSize: '12px',
    fontWeight: '700',
    color: '#7dd3fc',
  },
  btnLimpar: {
    fontSize: '11px',
    background: 'none',
    border: 'none',
    color: '#64748b',
    cursor: 'pointer',
    padding: '2px 4px',
    borderRadius: '4px',
    lineHeight: 1,
    alignSelf: 'flex-end',
  },
  btnSalvar: {
    backgroundColor: '#0284c7',
    color: '#fff',
    border: 'none',
    borderRadius: '8px',
    padding: '10px 24px',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer',
  },
  btnSalvarDisabled: {
    backgroundColor: '#1e40af',
    color: '#93c5fd',
    border: 'none',
    borderRadius: '8px',
    padding: '10px 24px',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'not-allowed',
    opacity: 0.6,
  },
  alertSucesso: {
    backgroundColor: '#052e16',
    border: '1px solid #166534',
    borderRadius: '8px',
    padding: '10px 16px',
    fontSize: '13px',
    color: '#4ade80',
  },
  alertErro: {
    backgroundColor: '#450a0a',
    border: '1px solid #7f1d1d',
    borderRadius: '8px',
    padding: '10px 16px',
    fontSize: '13px',
    color: '#f87171',
  },
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Constrói o estado inicial de portas a partir do diagrama salvo.
 * O campo `diagrama.portas` é um Map serializado como objeto simples (lean()).
 * Cada porta tem forma: { cliente: string|null, obs: string|null, ativo: boolean }
 */
function buildPortasIniciais(capacidade, diagrama) {
  const portas = {}
  for (let i = 1; i <= capacidade; i++) {
    const chave = String(i)
    const portaSalva = diagrama?.portas?.[chave] ?? null
    portas[chave] = portaSalva?.cliente ?? ''
  }
  return portas
}

/**
 * Monta o objeto diagrama para salvar, mantendo a estrutura do schema:
 * { entrada: {...}, portas: { "1": { cliente, obs, ativo }, ... } }
 */
function buildDiagramaParaSalvar(portasState, diagramaOriginal) {
  const portasObj = {}
  for (const [chave, cliente] of Object.entries(portasState)) {
    portasObj[chave] = {
      cliente: cliente.trim() || null,
      obs:     diagramaOriginal?.portas?.[chave]?.obs ?? null,
      ativo:   diagramaOriginal?.portas?.[chave]?.ativo ?? true,
    }
  }
  return {
    entrada: diagramaOriginal?.entrada ?? { ce_id: null, porta_cdo: null },
    portas:  portasObj,
  }
}

// ---------------------------------------------------------------------------
// Componente principal
// ---------------------------------------------------------------------------

export default function DiagramaCTOEditor({ ctoId, projetoId, capacidadePortas, initialDiagrama }) {
  const total = Number(capacidadePortas) || 0

  // Estado das portas: { "1": "Nome Cliente", "2": "", ... }
  const [portas, setPortas] = useState(() => buildPortasIniciais(total, initialDiagrama))

  // Diagrama original (para preservar campos como obs/ativo ao salvar)
  const [diagramaOriginal, setDiagramaOriginal] = useState(initialDiagrama ?? null)

  const [carregando, setCarregando] = useState(!initialDiagrama)
  const [sucesso, setSucesso] = useState(null)
  const [erro, setErro] = useState(null)
  const [isPending, startTransition] = useTransition()

  // Carrega o diagrama do servidor se não foi passado via prop
  useEffect(() => {
    if (initialDiagrama) return

    let cancelado = false
    setCarregando(true)
    getDiagramaCTO(ctoId, projetoId)
      .then((resultado) => {
        if (cancelado) return
        if (resultado) {
          setDiagramaOriginal(resultado.diagrama)
          setPortas(buildPortasIniciais(total, resultado.diagrama))
        }
      })
      .catch((e) => {
        if (!cancelado) setErro('Erro ao carregar diagrama: ' + e.message)
      })
      .finally(() => {
        if (!cancelado) setCarregando(false)
      })

    return () => { cancelado = true }
  }, [ctoId, projetoId, total, initialDiagrama])

  // Métricas
  const ocupadas = Object.values(portas).filter((v) => v.trim() !== '').length

  // Atualiza cliente de uma porta
  function handlePortaChange(chave, valor) {
    setPortas((prev) => ({ ...prev, [chave]: valor }))
  }

  // Limpa uma porta
  function handleLimpar(chave) {
    setPortas((prev) => ({ ...prev, [chave]: '' }))
  }

  // Salva diagrama via Server Action
  function handleSalvar() {
    setErro(null)
    setSucesso(null)
    startTransition(async () => {
      try {
        const diagrama = buildDiagramaParaSalvar(portas, diagramaOriginal)
        const resultado = await saveDiagramaCTO({
          cto_id:     ctoId,
          projeto_id: projetoId,
          diagrama,
        })
        if (resultado?.saved) {
          setSucesso('Diagrama salvo com sucesso.')
        } else {
          setSucesso('Diagrama salvo (sem alterações detectadas).')
        }
        setTimeout(() => setSucesso(null), 4000)
      } catch (e) {
        setErro('Erro ao salvar: ' + e.message)
      }
    })
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  if (carregando) {
    return (
      <div style={S.container}>
        <p style={{ color: '#64748b', fontSize: '14px' }}>Carregando diagrama...</p>
      </div>
    )
  }

  return (
    <div style={S.container}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '700', color: '#f1f5f9' }}>
            Diagrama de Portas
          </h3>
          <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#94a3b8' }}>
            <span style={{ color: ocupadas > 0 ? '#7dd3fc' : '#64748b', fontWeight: '600' }}>
              {ocupadas}
            </span>
            /{total} portas ocupadas
          </p>
        </div>

        <button
          onClick={handleSalvar}
          disabled={isPending}
          style={isPending ? S.btnSalvarDisabled : S.btnSalvar}
        >
          {isPending ? 'Salvando...' : 'Salvar Diagrama'}
        </button>
      </div>

      {/* Feedback */}
      {sucesso && <div style={{ ...S.alertSucesso, marginBottom: '16px' }}>{sucesso}</div>}
      {erro    && <div style={{ ...S.alertErro,    marginBottom: '16px' }}>{erro}</div>}

      {/* Grid de portas */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
          gap: '12px',
        }}
      >
        {Array.from({ length: total }, (_, idx) => {
          const chave = String(idx + 1)
          const cliente = portas[chave] ?? ''
          const ocupada = cliente.trim() !== ''
          const cardStyle = ocupada ? S.cardOcupada : S.cardLivre

          return (
            <div key={chave} style={cardStyle}>
              {/* Cabeçalho do card */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={S.portaNum}>Porta {chave}</span>
                {ocupada && (
                  <button
                    onClick={() => handleLimpar(chave)}
                    style={S.btnLimpar}
                    title="Limpar porta"
                  >
                    Limpar
                  </button>
                )}
              </div>

              {/* Input do cliente */}
              <input
                type="text"
                value={cliente}
                onChange={(e) => handlePortaChange(chave, e.target.value)}
                placeholder="Vaga livre"
                style={{
                  ...S.inputBase,
                  borderColor: ocupada ? '#2563eb' : '#374151',
                }}
              />
            </div>
          )
        })}
      </div>

      {/* Footer com botão duplicado para listas longas */}
      {total > 8 && (
        <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'flex-end' }}>
          <button
            onClick={handleSalvar}
            disabled={isPending}
            style={isPending ? S.btnSalvarDisabled : S.btnSalvar}
          >
            {isPending ? 'Salvando...' : 'Salvar Diagrama'}
          </button>
        </div>
      )}
    </div>
  )
}
