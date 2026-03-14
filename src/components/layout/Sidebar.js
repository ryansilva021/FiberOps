'use client'

import { useState } from 'react'
import { signOut } from 'next-auth/react'
import Link from 'next/link'
import {
  X,
  Search,
  Layers,
  Map,
  Box,
  Route,
  Zap,
  LogOut,
  Settings,
  ShieldCheck,
  Radio,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'

const LAYERS = [
  { key: 'ctos', label: 'CTOs', icon: Box },
  { key: 'caixas', label: 'CE/CDOs', icon: Layers },
  { key: 'rotas', label: 'Rotas', icon: Route },
  { key: 'postes', label: 'Postes', icon: Zap },
]

export default function Sidebar({ isOpen, onClose, session, layerToggles = {}, onLayerToggle }) {
  const [search, setSearch] = useState('')

  const role = session?.user?.role || 'user'
  const isAdmin = role === 'admin' || role === 'superadmin'
  const isSuperadmin = role === 'superadmin'

  return (
    <>
      {/* Overlay for mobile */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={onClose}
        />
      )}

      {/* Drawer */}
      <aside
        className={[
          'fixed top-0 left-0 z-50 h-full w-80 flex flex-col',
          'bg-[#0d1829] border-r border-white/10',
          'transition-transform duration-300 ease-in-out',
          isOpen ? 'translate-x-0' : '-translate-x-full',
        ].join(' ')}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-4 border-b border-white/10">
          <div className="flex items-center gap-2">
            <Radio className="size-5 text-blue-400" />
            <span className="text-lg font-bold text-white tracking-tight">FiberOps</span>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="text-white/60 hover:text-white hover:bg-white/10"
          >
            <X className="size-4" />
          </Button>
        </div>

        <ScrollArea className="flex-1">
          <div className="px-4 py-4 space-y-6">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-white/40" />
              <Input
                placeholder="Buscar CTO, rota, poste..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 bg-white/5 border-white/10 text-white placeholder:text-white/30 focus-visible:ring-blue-500/50 focus-visible:border-blue-500/50"
              />
            </div>

            <Separator className="bg-white/10" />

            {/* Layer toggles */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Map className="size-4 text-blue-400" />
                <span className="text-xs font-semibold uppercase tracking-widest text-white/50">
                  Camadas
                </span>
              </div>
              <div className="space-y-3">
                {LAYERS.map(({ key, label, icon: Icon }) => (
                  <div key={key} className="flex items-center justify-between">
                    <Label
                      htmlFor={`layer-${key}`}
                      className="flex items-center gap-2 text-sm text-white/80 cursor-pointer"
                    >
                      <Icon className="size-4 text-white/40" />
                      {label}
                    </Label>
                    <Switch
                      id={`layer-${key}`}
                      checked={layerToggles[key] ?? true}
                      onCheckedChange={(checked) => onLayerToggle?.(key, checked)}
                      className="data-[state=checked]:bg-blue-500"
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Admin section */}
            {isAdmin && (
              <>
                <Separator className="bg-white/10" />
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <Settings className="size-4 text-blue-400" />
                    <span className="text-xs font-semibold uppercase tracking-widest text-white/50">
                      Admin
                    </span>
                  </div>
                  <nav className="space-y-1">
                    <Link
                      href="/admin/ctos"
                      onClick={onClose}
                      className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-white/70 hover:text-white hover:bg-white/10 transition-colors"
                    >
                      <Box className="size-4" />
                      CTOs
                    </Link>
                    <Link
                      href="/admin/caixas"
                      onClick={onClose}
                      className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-white/70 hover:text-white hover:bg-white/10 transition-colors"
                    >
                      <Layers className="size-4" />
                      CE / CDOs
                    </Link>
                    <Link
                      href="/admin/rotas"
                      onClick={onClose}
                      className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-white/70 hover:text-white hover:bg-white/10 transition-colors"
                    >
                      <Route className="size-4" />
                      Rotas
                    </Link>
                    <Link
                      href="/admin/postes"
                      onClick={onClose}
                      className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-white/70 hover:text-white hover:bg-white/10 transition-colors"
                    >
                      <Zap className="size-4" />
                      Postes
                    </Link>
                    <Link
                      href="/admin/olts"
                      onClick={onClose}
                      className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-white/70 hover:text-white hover:bg-white/10 transition-colors"
                    >
                      <Radio className="size-4" />
                      OLTs
                    </Link>
                    <Link
                      href="/admin/movimentacoes"
                      onClick={onClose}
                      className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-white/70 hover:text-white hover:bg-white/10 transition-colors"
                    >
                      <Zap className="size-4" />
                      Movimentações
                    </Link>
                    <Link
                      href="/admin/diagramas"
                      onClick={onClose}
                      className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-white/70 hover:text-white hover:bg-white/10 transition-colors"
                    >
                      <Map className="size-4" />
                      Diagramas
                    </Link>
                    <Link
                      href="/admin/topologia"
                      onClick={onClose}
                      className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-white/70 hover:text-white hover:bg-white/10 transition-colors"
                    >
                      <Layers className="size-4" />
                      Topologia
                    </Link>
                    <Link
                      href="/admin/usuarios"
                      onClick={onClose}
                      className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-white/70 hover:text-white hover:bg-white/10 transition-colors"
                    >
                      <Settings className="size-4" />
                      Usuários
                    </Link>
                  </nav>
                </div>
              </>
            )}

            {/* Superadmin section */}
            {isSuperadmin && (
              <>
                <Separator className="bg-white/10" />
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <ShieldCheck className="size-4 text-purple-400" />
                    <span className="text-xs font-semibold uppercase tracking-widest text-white/50">
                      Superadmin
                    </span>
                  </div>
                  <nav className="space-y-1">
                    <Link
                      href="/superadmin/empresas"
                      onClick={onClose}
                      className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-white/70 hover:text-white hover:bg-white/10 transition-colors"
                    >
                      <ShieldCheck className="size-4" />
                      Empresas
                    </Link>
                    <Link
                      href="/superadmin/projetos"
                      onClick={onClose}
                      className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-white/70 hover:text-white hover:bg-white/10 transition-colors"
                    >
                      <Layers className="size-4" />
                      Projetos
                    </Link>
                    <Link
                      href="/superadmin/registros"
                      onClick={onClose}
                      className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-white/70 hover:text-white hover:bg-white/10 transition-colors"
                    >
                      <ShieldCheck className="size-4" />
                      Registros
                    </Link>
                    <Link
                      href="/superadmin/stats"
                      onClick={onClose}
                      className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-white/70 hover:text-white hover:bg-white/10 transition-colors"
                    >
                      <Map className="size-4" />
                      Estatísticas
                    </Link>
                  </nav>
                </div>
              </>
            )}
          </div>
        </ScrollArea>

        {/* Footer with user info + logout */}
        <div className="px-4 py-4 border-t border-white/10">
          {session?.user && (
            <div className="flex items-center gap-3 mb-3">
              <div className="size-8 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-300 text-sm font-medium">
                {session.user.name?.[0]?.toUpperCase() || 'U'}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-white truncate">{session.user.name}</p>
                <p className="text-xs text-white/40 truncate">{session.user.email}</p>
              </div>
            </div>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => signOut({ callbackUrl: '/login' })}
            className="w-full justify-start gap-2 text-white/60 hover:text-red-400 hover:bg-red-400/10"
          >
            <LogOut className="size-4" />
            Sair
          </Button>
        </div>
      </aside>
    </>
  )
}
