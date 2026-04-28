'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const FO = {
  card: '#F7F0E2', espresso: '#1A120D', orange: '#C45A2C',
  muted: '#7A5C46', border: 'rgba(196,140,100,0.22)', orangeBg: 'rgba(196,90,44,0.08)',
}

const NAV = [
  { href: '/admin/noc',                label: 'Dashboard',  icon: '◈', exact: true },
  { href: '/admin/noc/olts',           label: 'OLTs',       icon: '🖥️' },
  { href: '/admin/noc/pons',           label: 'PONs',       icon: '⬡' },
  { href: '/admin/noc/onus',           label: 'ONUs',       icon: '◎' },
  { href: '/admin/noc/alertas',        label: 'Alertas',    icon: '⚠️' },
  { href: '/admin/noc/integracoes',    label: 'Integrações', icon: '⚡' },
]

export default function NOCSubNav() {
  const pathname = usePathname()

  return (
    <nav style={{
      display: 'flex', gap: 2, alignItems: 'center',
      padding: '0 24px',
      borderBottom: `1px solid ${FO.border}`,
      backgroundColor: FO.card,
      overflowX: 'auto',
    }}>
      <div style={{ marginRight: 12, paddingRight: 12, borderRight: `1px solid ${FO.border}`, flexShrink: 0 }}>
        <span style={{ fontSize: 11, fontWeight: 800, color: FO.orange, letterSpacing: '0.06em' }}>NOC</span>
      </div>
      {NAV.map(item => {
        const active = item.exact ? pathname === item.href : pathname.startsWith(item.href)
        return (
          <Link
            key={item.href}
            href={item.href}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '10px 14px',
              fontSize: 13, fontWeight: active ? 700 : 500,
              color: active ? FO.orange : FO.muted,
              textDecoration: 'none',
              borderBottom: `2px solid ${active ? FO.orange : 'transparent'}`,
              marginBottom: -1, flexShrink: 0,
              transition: 'color 0.15s',
              backgroundColor: active ? FO.orangeBg : 'transparent',
            }}
          >
            <span style={{ fontSize: 11 }}>{item.icon}</span>
            {item.label}
          </Link>
        )
      })}
    </nav>
  )
}
