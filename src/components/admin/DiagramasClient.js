'use client'

/**
 * DiagramasClient.js
 * Seletor e orquestrador de diagramas CTO e CE/CDO.
 *
 * Props:
 *   ctos      {Array}  — lista de CTOs com _id, cto_id, nome, capacidade, diagrama
 *   caixas    {Array}  — lista de CE/CDOs com _id, ce_id, nome, tipo, capacidade, diagrama
 *   projetoId {string} — tenant
 */

import { useState } from 'react'
import DiagramaCTOEditor from '@/components/admin/DiagramaCTOEditor'
import DiagramaCDOEditor from '@/components/admin/DiagramaCDOEditor'

// ---------------------------------------------------------------------------
// Estilos
// ---------------------------------------------------------------------------
const S = {
  container: {
    color: '#f1f5f9',
  },
  // Abas
  tabBar: {
    display: 'flex',
    gap: '4px',
    marginBottom: '24px',
    borderBottom: '1px solid #1f2937',
    paddingBottom: '0',
  },
  tabAtiva: {
    backgroundColor: '#0284c7',
    color: '#fff',
    border: 'none',
    borderRadius: '8px 8px 0 0',
    padding: '10px 24px',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer',
    marginBottom: '-1px',
    borderBottom: '2px solid #0284c7',
  },
  tabInativa: {
    backgroundColor: 'transparent',
    color: '#64748b',
    border: 'none',
    borderRadius: '8px 8px 0 0',
    padding: '10px 24px',
    fontSize: '14px',
    fontWeight: '500',
    cursor: 'pointer',
    marginBottom: '-1px',
  },
  // Lista de itens
  lista: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    marginBottom: '28px',
  },
  cardItem: {
    backgroundColor: '#111827',
    border: '1px solid #1f2937',
    borderRadius: '10px',
    padding: '14px 18px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    cursor: 'pointer',
    transition: 'border-color 0.15s',
  },
  cardItemAtivo: {
    backgroundColor: '#0c1a2e',
    border: '1px solid #0284c7',
    borderRadius: '10px',
    padding: '14px 18px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    cursor: 'pointer',
  },
  cardItemNome: {
    fontSize: '14px',
    fontWeight: '600',
    color: '#f1f5f9',
  },
  cardItemSub: {
    fontSize: '12px',
    color: '#64748b',
    marginTop: '2px',
  },
  badgeOcupacao: {
    fontSize: '12px',
    color: '#94a3b8',
    backgroundColor: '#1f2937',
    padding: '4px 10px',
    borderRadius: '20px',
    whiteSpace: 'nowrap',
  },
  badgeOcupacaoAtivo: {
    fontSize: '12px',
    color: '#7dd3fc',
    backgroundColor: '#1e3a5f',
    padding: '4px 10px',
    borderRadius: '20px',
    whiteSpace: 'nowrap',
  },
  vazioMsg: {
    color: '#64748b',
    fontSize: '14px',
    padding: '24px',
    textAlign: 'center',
    backgroundColor: '#111827',
    border: '1px solid #1f2937',
    borderRadius: '10px',
  },
  editorWrapper: {
    marginTop: '4px',
  },
  sectionTitle: {
    fontSize: '12px',
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: '0.07em',
    color: '#475569',
    marginBottom: '12px',
  },
}

// ---------------------------------------------------------------------------
// Helpers de ocupação
// ---------------------------------------------------------------------------

function calcOcupacaoCTO(cto) {
  let ocupadas = 0
  const portas = cto.diagrama?.portas
  if (portas) {
    for (const p of Object.values(portas)) {
      if (p?.cliente) ocupadas++
    }
  }
  return { ocupadas, total: cto.capacidade || 0 }
}

function calcOcupacaoCDO(caixa) {
  let utilizadas = 0
  const saidas = caixa.diagrama?.saidas
  if (saidas) {
    for (const s of Object.values(saidas)) {
      if (s?.cto_id) utilizadas++
    }
  }
  return { utilizadas, total: caixa.capacidade || 0 }
}

// ---------------------------------------------------------------------------
// Subcomponente: item de lista CTO
// ---------------------------------------------------------------------------

function ItemCTO({ cto, ativo, onClick }) {
  const { ocupadas, total } = calcOcupacaoCTO(cto)
  return (
    <div
      style={ativo ? S.cardItemAtivo : S.cardItem}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && onClick()}
    >
      <div>
        <p style={S.cardItemNome}>{cto.nome ?? cto.cto_id}</p>
        <p style={S.cardItemSub}>{cto.cto_id}</p>
      </div>
      <span style={ativo ? S.badgeOcupacaoAtivo : S.badgeOcupacao}>
        {ocupadas}/{total} portas
      </span>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Subcomponente: item de lista CDO/CE
// ---------------------------------------------------------------------------

function ItemCDO({ caixa, ativo, onClick }) {
  const { utilizadas, total } = calcOcupacaoCDO(caixa)
  // O campo identificador pode ser ce_id (legado/ação) ou id (schema Mongoose)
  const idCaixa = caixa.ce_id ?? caixa.id ?? ''
  const label   = caixa.nome ?? idCaixa
  return (
    <div
      style={ativo ? S.cardItemAtivo : S.cardItem}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && onClick()}
    >
      <div>
        <p style={S.cardItemNome}>{label}</p>
        <p style={S.cardItemSub}>
          {idCaixa}
          {caixa.tipo ? ` · ${caixa.tipo.toUpperCase()}` : ''}
        </p>
      </div>
      <span style={ativo ? S.badgeOcupacaoAtivo : S.badgeOcupacao}>
        {utilizadas}/{total} saídas
      </span>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Componente principal
// ---------------------------------------------------------------------------

export default function DiagramasClient({ ctos, caixas, projetoId }) {
  const [aba, setAba] = useState('ctos')            // 'ctos' | 'cdos'
  const [ctoSelecionada, setCTOSelecionada]     = useState(null) // objeto CTO
  const [caixaSelecionada, setCaixaSelecionada] = useState(null) // objeto caixa

  // id resolvido da caixa selecionada (campo pode ser ce_id ou id dependendo da versão)
  const idCaixaSelecionada = caixaSelecionada
    ? (caixaSelecionada.ce_id ?? caixaSelecionada.id ?? '')
    : ''

  function selecionarCTO(cto) {
    setCTOSelecionada((prev) => (prev?._id === cto._id ? null : cto))
  }

  function selecionarCaixa(caixa) {
    setCaixaSelecionada((prev) => (prev?._id === caixa._id ? null : caixa))
  }

  return (
    <div style={S.container}>
      {/* Abas */}
      <div style={S.tabBar}>
        <button
          style={aba === 'ctos' ? S.tabAtiva : S.tabInativa}
          onClick={() => { setAba('ctos'); setCTOSelecionada(null) }}
        >
          CTOs ({ctos.length})
        </button>
        <button
          style={aba === 'cdos' ? S.tabAtiva : S.tabInativa}
          onClick={() => { setAba('cdos'); setCaixaSelecionada(null) }}
        >
          CE / CDOs ({caixas.length})
        </button>
      </div>

      {/* Aba CTOs */}
      {aba === 'ctos' && (
        <div>
          <p style={S.sectionTitle}>Selecione uma CTO para editar o diagrama</p>

          {ctos.length === 0 ? (
            <div style={S.vazioMsg}>Nenhuma CTO cadastrada neste projeto.</div>
          ) : (
            <div style={S.lista}>
              {ctos.map((cto) => (
                <ItemCTO
                  key={cto._id}
                  cto={cto}
                  ativo={ctoSelecionada?._id === cto._id}
                  onClick={() => selecionarCTO(cto)}
                />
              ))}
            </div>
          )}

          {/* Editor inline */}
          {ctoSelecionada && (
            <div style={S.editorWrapper}>
              <p style={{ ...S.sectionTitle, color: '#0284c7', marginBottom: '16px' }}>
                Editando: {ctoSelecionada.nome ?? ctoSelecionada.cto_id}
              </p>
              <DiagramaCTOEditor
                key={ctoSelecionada.cto_id}
                ctoId={ctoSelecionada.cto_id}
                projetoId={projetoId}
                capacidadePortas={ctoSelecionada.capacidade ?? 0}
                initialDiagrama={ctoSelecionada.diagrama ?? null}
              />
            </div>
          )}
        </div>
      )}

      {/* Aba CDOs/CEs */}
      {aba === 'cdos' && (
        <div>
          <p style={S.sectionTitle}>Selecione uma CE/CDO para editar o diagrama</p>

          {caixas.length === 0 ? (
            <div style={S.vazioMsg}>Nenhuma CE/CDO cadastrada neste projeto.</div>
          ) : (
            <div style={S.lista}>
              {caixas.map((caixa) => (
                <ItemCDO
                  key={caixa._id}
                  caixa={caixa}
                  ativo={caixaSelecionada?._id === caixa._id}
                  onClick={() => selecionarCaixa(caixa)}
                />
              ))}
            </div>
          )}

          {/* Editor inline */}
          {caixaSelecionada && (
            <div style={S.editorWrapper}>
              <p style={{ ...S.sectionTitle, color: '#0284c7', marginBottom: '16px' }}>
                Editando: {caixaSelecionada.nome ?? idCaixaSelecionada}
              </p>
              <DiagramaCDOEditor
                key={idCaixaSelecionada}
                ceId={idCaixaSelecionada}
                projetoId={projetoId}
                capacidadeSaidas={caixaSelecionada.capacidade ?? 0}
                initialDiagrama={caixaSelecionada.diagrama ?? null}
              />
            </div>
          )}
        </div>
      )}
    </div>
  )
}
