'use client'

/**
 * DiagramaCDOEditor.js
 * Editor visual de diagrama para uma CE/CDO.
 *
 * Props:
 *   ceId              {string}       — identificador da caixa (ce_id)
 *   projetoId         {string}       — tenant
 *   capacidadeSaidas  {number}       — número de saídas da caixa
 *   initialDiagrama   {object|null}  — diagrama já carregado (campo diagrama do documento)
 */

import { useState, useTransition, useEffect } from 'react'
import { getDiagramaCaixa, saveDiagramaCaixa } from '@/actions/caixas'

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
  secao: {
    backgroundColor: '#0d1526',
    border: '1px solid #1f2937',
    borderRadius: '10px',
    padding: '18px',
    marginBottom: '20px',
  },
  secaoTitulo: {
    fontSize: '13px',
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: '0.07em',
    color: '#94a3b8',
    marginBottom: '14px',
  },
  inputBase: {
    backgroundColor: '#0b1220',
    border: '1px solid #374151',
    color: '#f1f5f9',
    borderRadius: '6px',
    padding: '8px 12px',
    fontSize: '13px',
    width: '100%',
    outline: 'none',
    boxSizing: 'border-box',
  },
  cardUtilizada: {
    backgroundColor: '#1a3a2a',
    border: '1px solid #16a34a',
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
  saidaNum: {
    fontSize: '12px',
    fontWeight: '700',
    color: '#86efac',
  },
  saidaNumLivre: {
    fontSize: '12px',
    fontWeight: '700',
    color: '#64748b',
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
  entradaLabel: {
    fontSize: '12px',
    color: '#94a3b8',
    marginBottom: '6px',
    display: 'block',
  },
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Constrói o estado inicial das saídas a partir do diagrama salvo.
 * diagrama.saidas é um Map serializado como objeto plano após .lean():
 *   { "1": { cto_id, obs, ativo }, "2": { ... } }
 */
function buildSaidasIniciais(capacidade, diagrama) {
  const saidas = {}
  for (let i = 1; i <= capacidade; i++) {
    const chave = String(i)
    const saidaSalva = diagrama?.saidas?.[chave] ?? null
    saidas[chave] = saidaSalva?.cto_id ?? ''
  }
  return saidas
}

/**
 * Extrai a string de entrada (OLT + porta) do diagrama salvo.
 * Schema: diagrama.entrada = { olt_id, porta_olt }
 * Exibimos como "OLT-01 Porta 3" e editamos como texto livre para flexibilidade.
 */
function entradaParaString(diagrama) {
  const olt  = diagrama?.entrada?.olt_id   ?? ''
  const porta = diagrama?.entrada?.porta_olt ?? ''
  if (!olt && !porta) return ''
  if (olt && porta)  return `${olt} Porta ${porta}`
  return olt || String(porta)
}

/**
 * Tenta parsear a string de entrada em { olt_id, porta_olt }.
 * Aceita formatos: "OLT-01 Porta 3" | "OLT-01 3" | "OLT-01"
 */
function parseEntrada(str) {
  if (!str.trim()) return { olt_id: null, porta_olt: null }
  const match = str.trim().match(/^(.+?)\s+(?:porta\s+)?(\d+)$/i)
  if (match) {
    return {
      olt_id:    match[1].trim(),
      porta_olt: parseInt(match[2], 10),
    }
  }
  return { olt_id: str.trim(), porta_olt: null }
}

/**
 * Monta o objeto diagrama para salvar, respeitando o schema DiagramaCDOSchema.
 */
function buildDiagramaParaSalvar(entradaStr, saidasState, diagramaOriginal) {
  const entradaParsed = parseEntrada(entradaStr)

  const saidasObj = {}
  for (const [chave, ctoId] of Object.entries(saidasState)) {
    saidasObj[chave] = {
      cto_id: ctoId.trim() || null,
      obs:    diagramaOriginal?.saidas?.[chave]?.obs   ?? null,
      ativo:  diagramaOriginal?.saidas?.[chave]?.ativo ?? true,
    }
  }

  return {
    entrada: entradaParsed,
    saidas:  saidasObj,
    splitter_info: diagramaOriginal?.splitter_info ?? null,
  }
}

// ---------------------------------------------------------------------------
// Componente principal
// ---------------------------------------------------------------------------

export default function DiagramaCDOEditor({ ceId, projetoId, capacidadeSaidas, initialDiagrama }) {
  const total = Number(capacidadeSaidas) || 0

  const [entrada, setEntrada] = useState(() => entradaParaString(initialDiagrama))
  const [saidas,  setSaidas]  = useState(() => buildSaidasIniciais(total, initialDiagrama))

  const [diagramaOriginal, setDiagramaOriginal] = useState(initialDiagrama ?? null)
  const [carregando, setCarregando] = useState(!initialDiagrama)
  const [sucesso, setSucesso] = useState(null)
  const [erro,    setErro]    = useState(null)
  const [isPending, startTransition] = useTransition()

  // Carrega diagrama do servidor se não foi passado via prop
  useEffect(() => {
    if (initialDiagrama) return

    let cancelado = false
    setCarregando(true)
    getDiagramaCaixa(ceId, projetoId)
      .then((resultado) => {
        if (cancelado) return
        if (resultado) {
          setDiagramaOriginal(resultado.diagrama)
          setEntrada(entradaParaString(resultado.diagrama))
          setSaidas(buildSaidasIniciais(total, resultado.diagrama))
        }
      })
      .catch((e) => {
        if (!cancelado) setErro('Erro ao carregar diagrama: ' + e.message)
      })
      .finally(() => {
        if (!cancelado) setCarregando(false)
      })

    return () => { cancelado = true }
  }, [ceId, projetoId, total, initialDiagrama])

  // Métricas
  const utilizadas = Object.values(saidas).filter((v) => v.trim() !== '').length

  // Atualiza CTO de uma saída
  function handleSaidaChange(chave, valor) {
    setSaidas((prev) => ({ ...prev, [chave]: valor }))
  }

  // Limpa uma saída
  function handleLimpar(chave) {
    setSaidas((prev) => ({ ...prev, [chave]: '' }))
  }

  // Salva diagrama
  function handleSalvar() {
    setErro(null)
    setSucesso(null)
    startTransition(async () => {
      try {
        const diagrama = buildDiagramaParaSalvar(entrada, saidas, diagramaOriginal)
        const resultado = await saveDiagramaCaixa({
          ce_id:      ceId,
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
            Diagrama CE / CDO
          </h3>
          <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#94a3b8' }}>
            <span style={{ color: utilizadas > 0 ? '#86efac' : '#64748b', fontWeight: '600' }}>
              {utilizadas}
            </span>
            /{total} saídas utilizadas
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

      {/* Seção Entrada */}
      <div style={S.secao}>
        <p style={S.secaoTitulo}>Entrada — Origem do Sinal</p>
        <label style={S.entradaLabel}>
          OLT e Porta de Origem
          <span style={{ color: '#475569', fontWeight: '400', fontSize: '11px', marginLeft: '8px' }}>
            (ex: OLT-01 Porta 3)
          </span>
        </label>
        <input
          type="text"
          value={entrada}
          onChange={(e) => setEntrada(e.target.value)}
          placeholder="Ex: OLT-01 Porta 3"
          style={{
            ...S.inputBase,
            borderColor: entrada.trim() ? '#0284c7' : '#374151',
          }}
        />
      </div>

      {/* Seção Saídas */}
      <div style={S.secao}>
        <p style={S.secaoTitulo}>Saídas — CTOs Conectadas</p>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))',
            gap: '12px',
          }}
        >
          {Array.from({ length: total }, (_, idx) => {
            const chave    = String(idx + 1)
            const ctoId    = saidas[chave] ?? ''
            const utilizada = ctoId.trim() !== ''
            const cardStyle = utilizada ? S.cardUtilizada : S.cardLivre

            return (
              <div key={chave} style={cardStyle}>
                {/* Cabeçalho do card */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={utilizada ? S.saidaNum : S.saidaNumLivre}>
                    Saída {chave}
                  </span>
                  {utilizada && (
                    <button
                      onClick={() => handleLimpar(chave)}
                      style={S.btnLimpar}
                      title="Limpar saída"
                    >
                      Limpar
                    </button>
                  )}
                </div>

                {/* Input do CTO destino */}
                <input
                  type="text"
                  value={ctoId}
                  onChange={(e) => handleSaidaChange(chave, e.target.value)}
                  placeholder="CTO destino"
                  style={{
                    ...S.inputBase,
                    borderColor: utilizada ? '#16a34a' : '#374151',
                  }}
                />
              </div>
            )
          })}
        </div>
      </div>

      {/* Footer com botão duplicado para listas longas */}
      {total > 6 && (
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
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
