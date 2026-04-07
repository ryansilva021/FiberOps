'use client'

/**
 * src/components/admin/POLTTestPanel.js
 *
 * Painel de teste da pOLT integrado ao /admin/noc.
 * Permite enviar comandos ADDONU, REMOVEONU e RxMODE para uma pOLT
 * e ver os resultados aparecerem no feed NOC em tempo real.
 */

import { useState, useTransition } from 'react'
import { addOnuAction, removeOnuAction, setRxModeAction } from '@/actions/polt-actions'

// ─── Estilos ──────────────────────────────────────────────────────────────────

const s = {
  panel: {
    backgroundColor: 'var(--card-bg)',
    border: '1px solid var(--border-color)',
    borderRadius: 12,
    overflow: 'hidden',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '12px 16px',
    borderBottom: '1px solid var(--border-color)',
    cursor: 'pointer',
    userSelect: 'none',
  },
  headerLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
  },
  badge: {
    fontSize: 10,
    fontWeight: 700,
    padding: '2px 8px',
    borderRadius: 99,
    backgroundColor: '#7c3aed22',
    border: '1px solid #7c3aed55',
    color: '#a78bfa',
    letterSpacing: '0.05em',
  },
  body: {
    padding: 16,
  },
  tabs: {
    display: 'flex',
    gap: 4,
    marginBottom: 16,
    borderBottom: '1px solid var(--border-color)',
    paddingBottom: 0,
  },
  tab: (active) => ({
    padding: '7px 14px',
    fontSize: 12,
    fontWeight: 600,
    cursor: 'pointer',
    border: 'none',
    background: 'none',
    borderBottom: `2px solid ${active ? '#7c3aed' : 'transparent'}`,
    color: active ? '#a78bfa' : 'var(--text-muted)',
    borderRadius: 0,
    transition: 'all 0.15s',
    marginBottom: -1,
  }),
  urlRow: {
    display: 'flex',
    gap: 8,
    marginBottom: 16,
    alignItems: 'center',
  },
  urlLabel: {
    fontSize: 11,
    color: 'var(--text-muted)',
    fontWeight: 600,
    whiteSpace: 'nowrap',
  },
  inp: {
    flex: 1,
    backgroundColor: 'var(--inp-bg)',
    border: '1px solid var(--border-color)',
    color: 'var(--foreground)',
    borderRadius: 8,
    padding: '7px 12px',
    fontSize: 12,
    fontFamily: 'monospace',
    outline: 'none',
    width: '100%',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
    gap: 10,
    marginBottom: 14,
  },
  field: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
  },
  lbl: {
    fontSize: 10,
    color: 'var(--text-muted)',
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
  },
  inpSm: {
    backgroundColor: 'var(--inp-bg)',
    border: '1px solid var(--border-color)',
    color: 'var(--foreground)',
    borderRadius: 6,
    padding: '6px 10px',
    fontSize: 12,
    fontFamily: 'monospace',
    outline: 'none',
    width: '100%',
    boxSizing: 'border-box',
  },
  btnSend: (loading) => ({
    backgroundColor: loading ? '#4c1d95' : '#7c3aed',
    color: '#fff',
    border: 'none',
    borderRadius: 8,
    padding: '8px 20px',
    fontSize: 13,
    fontWeight: 700,
    cursor: loading ? 'not-allowed' : 'pointer',
    opacity: loading ? 0.7 : 1,
    transition: 'all 0.15s',
  }),
  result: (ok) => ({
    marginTop: 14,
    padding: '10px 14px',
    borderRadius: 8,
    fontSize: 12,
    fontFamily: 'monospace',
    backgroundColor: ok ? '#00C85312' : '#FF3D0012',
    border: `1px solid ${ok ? '#00C85344' : '#FF3D0044'}`,
    color: ok ? '#4ade80' : '#f87171',
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-all',
  }),
  hint: {
    fontSize: 11,
    color: 'var(--text-muted)',
    marginTop: 8,
    display: 'flex',
    alignItems: 'center',
    gap: 6,
  },
}

// ─── Componentes de cada aba ───────────────────────────────────────────────────

function FieldInput({ label, value, onChange, placeholder, type = 'text' }) {
  return (
    <div style={s.field}>
      <label style={s.lbl}>{label}</label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        style={s.inpSm}
      />
    </div>
  )
}

// ─── Aba ADDONU / REMOVEONU (mesmos campos) ────────────────────────────────────

function OnuForm({ action, poltUrl, label, color }) {
  const [isPending, startTransition] = useTransition()
  const [result, setResult] = useState(null)
  const [f, setF] = useState({
    channel_term: '1',
    onu_id: '2',
    serial_vendor_id: 'HWTC',
    serial_vendor_specific: '12345678',
    flags: 'present+in_o5',
    management_state: 'relying-on-vomci',
    loid: 'test1',
    v_ani: 'vani-user1',
  })

  const set = (k) => (v) => setF(prev => ({ ...prev, [k]: v }))

  function submit() {
    setResult(null)
    startTransition(async () => {
      const res = await action({ poltUrl, ...f })
      setResult(res)
    })
  }

  return (
    <div>
      <div style={s.grid}>
        <FieldInput label="channel_term" value={f.channel_term} onChange={set('channel_term')} placeholder="1" type="number" />
        <FieldInput label="onu_id" value={f.onu_id} onChange={set('onu_id')} placeholder="2" type="number" />
        <FieldInput label="serial_vendor_id" value={f.serial_vendor_id} onChange={set('serial_vendor_id')} placeholder="HWTC" />
        <FieldInput label="serial_vendor_specific" value={f.serial_vendor_specific} onChange={set('serial_vendor_specific')} placeholder="12345678" />
        <FieldInput label="flags" value={f.flags} onChange={set('flags')} placeholder="present+in_o5" />
        <FieldInput label="management_state" value={f.management_state} onChange={set('management_state')} placeholder="relying-on-vomci" />
        <FieldInput label="loid" value={f.loid} onChange={set('loid')} placeholder="test1" />
        <FieldInput label="v_ani" value={f.v_ani} onChange={set('v_ani')} placeholder="vani-user1" />
      </div>

      <button
        onClick={submit}
        disabled={isPending}
        style={{ ...s.btnSend(isPending), backgroundColor: isPending ? '#666' : color }}
      >
        {isPending ? 'Enviando...' : `Enviar ${label}`}
      </button>

      {result && (
        <div style={s.result(result.ok)}>
          {result.ok
            ? `✓ Sucesso\n${JSON.stringify(result.data, null, 2)}`
            : `✗ Erro: ${result.error}`}
        </div>
      )}

      <div style={s.hint}>
        <span>💡</span>
        <span>O resultado também aparece no feed NOC ao vivo acima</span>
      </div>
    </div>
  )
}

// ─── Aba RxMODE ───────────────────────────────────────────────────────────────

function RxModeForm({ poltUrl }) {
  const [isPending, startTransition] = useTransition()
  const [result, setResult] = useState(null)
  const [f, setF] = useState({
    mode: 'onu_sim',
    onu_sim_ip: '172.18.0.5',
    onu_sim_port: '50000',
  })
  const set = (k) => (v) => setF(prev => ({ ...prev, [k]: v }))

  function submit() {
    setResult(null)
    startTransition(async () => {
      const res = await setRxModeAction({ poltUrl, ...f })
      setResult(res)
    })
  }

  return (
    <div>
      <div style={s.grid}>
        <FieldInput label="mode" value={f.mode} onChange={set('mode')} placeholder="onu_sim" />
        <FieldInput label="onu_sim_ip" value={f.onu_sim_ip} onChange={set('onu_sim_ip')} placeholder="172.18.0.5" />
        <FieldInput label="onu_sim_port" value={f.onu_sim_port} onChange={set('onu_sim_port')} placeholder="50000" type="number" />
      </div>

      <button onClick={submit} disabled={isPending} style={s.btnSend(isPending)}>
        {isPending ? 'Enviando...' : 'Enviar RxMODE'}
      </button>

      {result && (
        <div style={s.result(result.ok)}>
          {result.ok
            ? `✓ Sucesso\n${JSON.stringify(result.data, null, 2)}`
            : `✗ Erro: ${result.error}`}
        </div>
      )}

      <div style={s.hint}>
        <span>💡</span>
        <span>O resultado também aparece no feed NOC ao vivo acima</span>
      </div>
    </div>
  )
}

// ─── Painel principal ──────────────────────────────────────────────────────────

const TABS = [
  { id: 'add',    label: 'ADDONU',    color: '#00C853' },
  { id: 'remove', label: 'REMOVEONU', color: '#FF3D00' },
  { id: 'rx',     label: 'RxMODE',   color: '#7c3aed' },
]

export default function POLTTestPanel() {
  const [open, setOpen]     = useState(false)
  const [tab, setTab]       = useState('add')
  const [poltUrl, setPoltUrl] = useState('http://localhost:3002')

  return (
    <div style={s.panel}>
      {/* Header colapsável */}
      <div style={s.header} onClick={() => setOpen(o => !o)}>
        <div style={s.headerLeft}>
          <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--foreground)' }}>
            pOLT Test Console
          </span>
          <span style={s.badge}>REST API</span>
        </div>
        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
          {open ? '▲ fechar' : '▼ abrir'}
        </span>
      </div>

      {open && (
        <div style={s.body}>
          {/* URL da pOLT */}
          <div style={s.urlRow}>
            <span style={s.urlLabel}>pOLT URL</span>
            <input
              value={poltUrl}
              onChange={e => setPoltUrl(e.target.value)}
              placeholder="http://192.168.1.100:3002"
              style={s.inp}
              spellCheck={false}
            />
          </div>

          {/* Tabs de ação */}
          <div style={s.tabs}>
            {TABS.map(t => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                style={s.tab(tab === t.id)}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Conteúdo da aba */}
          {tab === 'add' && (
            <OnuForm
              key="add"
              action={addOnuAction}
              poltUrl={poltUrl}
              label="ADDONU"
              color="#00C853"
            />
          )}
          {tab === 'remove' && (
            <OnuForm
              key="remove"
              action={removeOnuAction}
              poltUrl={poltUrl}
              label="REMOVEONU"
              color="#FF3D00"
            />
          )}
          {tab === 'rx' && (
            <RxModeForm poltUrl={poltUrl} />
          )}

          {/* Info do endpoint */}
          <div style={{
            marginTop: 16,
            padding: '8px 12px',
            borderRadius: 6,
            backgroundColor: 'var(--inp-bg)',
            fontSize: 11,
            fontFamily: 'monospace',
            color: 'var(--text-muted)',
          }}>
            POST {poltUrl}/polt/polt_actions
          </div>
        </div>
      )}
    </div>
  )
}
