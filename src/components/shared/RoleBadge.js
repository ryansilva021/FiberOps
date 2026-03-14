'use client'

const ROLE_CONFIG = {
  superadmin: {
    label: 'Superadmin',
    className: 'bg-purple-500/20 text-purple-300 border border-purple-500/40',
  },
  admin: {
    label: 'Admin',
    className: 'bg-blue-500/20 text-blue-300 border border-blue-500/40',
  },
  tecnico: {
    label: 'Técnico',
    className: 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40',
  },
  user: {
    label: 'Usuário',
    className: 'bg-white/10 text-white/60 border border-white/20',
  },
}

export default function RoleBadge({ role }) {
  const config = ROLE_CONFIG[role] || ROLE_CONFIG.user
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${config.className}`}
    >
      {config.label}
    </span>
  )
}
