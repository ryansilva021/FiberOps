'use client'

import { useState, useTransition } from 'react'
import { updateSystemConfig } from '@/actions/config'

export default function OsSettingsPanel({ initialSlaHoras = 48 }) {
  const [open,     setOpen]    = useState(false)
  const [sla,      setSla]     = useState(initialSlaHoras)
  const [msg,      setMsg]     = useState(null)
  const [pending,  startTrans] = useTransition()

  function handleSave() {
    setMsg(null)
    startTrans(async () => {
      const res = await updateSystemConfig({ os_prazo_horas: sla })
      setMsg(res.error ?? 'SLA salvo!')
    })
  }

  return (
    <div style={{ position: 'relative' }}>
      <button
        onClick={() => { setOpen(v => !v); setMsg(null) }}
        title="Configurações de OS"
        style={{
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '7px 14px', borderRadius: 8, border: '1px solid var(--border-color, #334155)',
          background: 'var(--card-bg, #0f172a)', color: 'var(--text-muted)',
          fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit',
        }}
      >
        ⚙️ SLA
      </button>

      {open && (
        <div style={{
          position: 'absolute', top: '110%', right: 0, zIndex: 50,
          background: 'var(--card-bg, #0f172a)',
          border: '1px solid var(--border-color, #1e293b)',
          borderRadius: 12, padding: '18px 20px', minWidth: 240,
          boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
        }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--foreground)', marginBottom: 14 }}>
            Configurações de OS
          </div>

          <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Prazo padrão de SLA (horas)
          </label>
          <p style={{ fontSize: 11, color: '#475569', marginBottom: 8 }}>
            Tempo máximo para conclusão de uma OS aberta.
          </p>
          <input
            type="number"
            value={sla}
            onChange={e => setSla(Number(e.target.value))}
            min={1} max={720}
            style={{
              width: 100, padding: '8px 10px', borderRadius: 7,
              background: 'var(--input-bg, #1e293b)',
              border: '1px solid var(--border-color, #334155)',
              color: 'var(--foreground)', fontSize: 14,
              fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box',
            }}
          />

          {msg && (
            <div style={{
              marginTop: 10, padding: '7px 10px', borderRadius: 6, fontSize: 12,
              background: msg.includes('!') ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
              border: `1px solid ${msg.includes('!') ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}`,
              color: msg.includes('!') ? '#4ade80' : '#f87171',
            }}>
              {msg}
            </div>
          )}

          <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
            <button
              onClick={handleSave}
              disabled={pending}
              style={{
                flex: 1, padding: '8px 0', borderRadius: 8, border: 'none',
                background: pending ? '#374151' : 'linear-gradient(135deg,#c2410c,#ea580c)',
                color: '#fff', fontSize: 13, fontWeight: 700,
                cursor: pending ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
              }}
            >
              {pending ? 'Salvando…' : 'Salvar'}
            </button>
            <button
              onClick={() => setOpen(false)}
              style={{
                padding: '8px 14px', borderRadius: 8,
                border: '1px solid var(--border-color, #334155)',
                background: 'transparent', color: 'var(--text-muted)',
                fontSize: 13, cursor: 'pointer', fontFamily: 'inherit',
              }}
            >
              Fechar
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
