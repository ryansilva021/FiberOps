'use client'

import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { signOut } from 'next-auth/react'

// ── Dark theme override — superadmin ignores the global amber theme ──────────
const DARK = {
  bg:          '#0d1117',
  sidebar:     '#161b27',
  sidebarBdr:  '#1f2937',
  card:        '#161b27',
  cardHover:   '#1d2333',
  border:      '#1f2937',
  borderStrg:  '#374151',
  text:        '#f1f5f9',
  muted:       '#94a3b8',
  subtle:      '#475569',
  accent:      '#8b5cf6',
  accentBg:    'rgba(139,92,246,0.12)',
  accentBdr:   'rgba(139,92,246,0.35)',
  inp:         '#0d1117',
  danger:      '#f87171',
  success:     '#4ade80',
  warning:     '#fbbf24',
}

const NAV = [
  {
    href:  '/superadmin/stats',
    label: 'Visão Geral',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>
      </svg>
    ),
  },
  {
    href:  '/superadmin/projetos',
    label: 'Projetos / Tenants',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>
      </svg>
    ),
  },
  {
    href:  '/superadmin/empresas',
    label: 'Empresas',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/>
        <path d="M16 10a4 4 0 0 1-8 0"/>
      </svg>
    ),
  },
  {
    href:  '/superadmin/registros',
    label: 'Registros Pendentes',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
        <polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/>
      </svg>
    ),
  },
]

export default function SuperadminSidebarLayout({ session, children }) {
  const [aberta, setAberta] = useState(false)
  const pathname = usePathname()

  return (
    // Force dark theme — overrides global CSS vars for this subtree
    <div
      className="flex h-screen overflow-hidden"
      style={{
        background: DARK.bg,
        color: DARK.text,
        '--background':      DARK.bg,
        '--foreground':      DARK.text,
        '--sidebar-bg':      DARK.sidebar,
        '--sidebar-border':  DARK.sidebarBdr,
        '--card-bg':         DARK.card,
        '--border-color':    DARK.border,
        '--border-color-strong': DARK.borderStrg,
        '--text-secondary':  DARK.muted,
        '--text-muted':      DARK.subtle,
        '--inp-bg':          DARK.inp,
        '--accent':          DARK.accent,
      }}
    >
      {/* Overlay mobile */}
      {aberta && (
        <div
          className="fixed inset-0 z-20 lg:hidden"
          style={{ backgroundColor: 'rgba(0,0,0,0.7)' }}
          onClick={() => setAberta(false)}
        />
      )}

      {/* ── Sidebar ──────────────────────────────────────────────────────── */}
      <aside
        className={`
          fixed top-[52px] left-0 z-30 flex flex-col
          transform transition-transform duration-200
          lg:static lg:translate-x-0 lg:top-0 lg:!h-screen lg:flex-shrink-0
          ${aberta ? 'translate-x-0' : '-translate-x-full'}
        `}
        style={{
          background:  DARK.sidebar,
          borderRight: `1px solid ${DARK.sidebarBdr}`,
          width: 248, minWidth: 248,
          height: 'calc(100dvh - 52px)',
        }}
      >
        {/* Brand */}
        <div
          className="flex items-center gap-3 px-5 py-4"
          style={{ borderBottom: `1px solid ${DARK.sidebarBdr}` }}
        >
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ background: DARK.accentBg, border: `1px solid ${DARK.accentBdr}` }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={DARK.accent} strokeWidth="2.5">
              <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
            </svg>
          </div>
          <div>
            <p style={{ color: DARK.text }} className="text-sm font-bold leading-tight">FiberOps</p>
            <p style={{ color: DARK.accent }} className="text-[10px] font-semibold uppercase tracking-widest">Superadmin</p>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 flex flex-col gap-0.5 overflow-y-auto">
          {NAV.map((item) => {
            const ativa = pathname === item.href || (item.href !== '/superadmin/stats' && pathname.startsWith(item.href))
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setAberta(false)}
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all"
                style={{
                  background:  ativa ? DARK.accentBg  : 'transparent',
                  color:       ativa ? DARK.accent     : DARK.muted,
                  border:      `1px solid ${ativa ? DARK.accentBdr : 'transparent'}`,
                }}
              >
                <span style={{ opacity: ativa ? 1 : 0.6 }}>{item.icon}</span>
                {item.label}
              </Link>
            )
          })}
        </nav>

        {/* Footer — user info + logout */}
        <div
          className="px-3 py-4"
          style={{ borderTop: `1px solid ${DARK.sidebarBdr}` }}
        >
          <Link
            href="/perfil"
            className="flex items-center gap-3 px-3 py-2 rounded-lg mb-1 transition-colors"
            style={{ textDecoration: 'none' }}
            onMouseEnter={e => e.currentTarget.style.background = DARK.cardHover}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
          >
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold uppercase flex-shrink-0"
              style={{ background: DARK.accentBg, color: DARK.accent, border: `1px solid ${DARK.accentBdr}` }}
            >
              {session?.user?.username?.[0] ?? '?'}
            </div>
            <div className="flex-1 min-w-0">
              <p style={{ color: DARK.text }} className="text-xs font-semibold truncate">{session?.user?.username}</p>
              <p style={{ color: DARK.accent }} className="text-[10px] font-medium">superadmin</p>
            </div>
          </Link>
          <button
            onClick={() => signOut({ callbackUrl: '/login' })}
            className="w-full text-xs py-2 rounded-lg transition-colors mt-1 flex items-center justify-center gap-2"
            style={{ border: `1px solid ${DARK.border}`, color: DARK.muted }}
            onMouseEnter={e => { e.currentTarget.style.background = DARK.cardHover; e.currentTarget.style.color = DARK.text }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = DARK.muted }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
              <polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
            </svg>
            Sair
          </button>
        </div>
      </aside>

      {/* ── Main area ────────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Mobile header */}
        <header
          className="sticky top-0 z-[60] flex items-center justify-between px-4 py-3 lg:hidden"
          style={{
            background:   DARK.sidebar,
            borderBottom: `1px solid ${DARK.sidebarBdr}`,
            flexShrink: 0,
          }}
        >
          <button
            onClick={() => setAberta(true)}
            className="p-1 transition-colors"
            style={{ color: DARK.muted }}
            aria-label="Abrir menu"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <span style={{ color: DARK.text }} className="text-sm font-bold">Superadmin</span>
          <div className="w-7" />
        </header>

        <main className="flex-1 overflow-auto" style={{ background: DARK.bg }}>
          {children}
        </main>
      </div>
    </div>
  )
}
