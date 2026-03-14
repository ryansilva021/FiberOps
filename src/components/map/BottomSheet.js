'use client'

import { useEffect, useRef, useState } from 'react'
import {
  X,
  Edit,
  Network,
  FileText,
  MapPin,
  MoveVertical,
  Zap,
  Box,
  Layers,
  Route,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import OcupacaoBar from '@/components/shared/OcupacaoBar'

const ROTA_TIPO_CONFIG = {
  BACKBONE: { label: 'Backbone', className: 'bg-blue-500/20 text-blue-300 border-blue-500/40' },
  RAMAL: { label: 'Ramal', className: 'bg-orange-500/20 text-orange-300 border-orange-500/40' },
  DROP: { label: 'Drop', className: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' },
}

const STATUS_CONFIG = {
  ativo: { label: 'Ativo', className: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' },
  manutencao: { label: 'Manutenção', className: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/40' },
  inativo: { label: 'Inativo', className: 'bg-red-500/20 text-red-300 border-red-500/40' },
}

function InfoRow({ label, value }) {
  if (!value) return null
  return (
    <div className="flex items-start justify-between gap-4 py-1.5">
      <span className="text-xs text-white/40 shrink-0">{label}</span>
      <span className="text-xs text-white/80 text-right">{value}</span>
    </div>
  )
}

function CTOContent({ data, isAdmin, onAction }) {
  const clientes = data.clientes || []
  return (
    <div className="space-y-4">
      <OcupacaoBar ocupadas={data.ocupadas ?? clientes.length} capacidade={data.capacidade ?? 8} />
      <Separator className="bg-white/10" />
      <div className="space-y-0.5">
        <InfoRow label="ID" value={data.ctoId || data._id} />
        <InfoRow label="Rua" value={data.rua} />
        <InfoRow label="Bairro" value={data.bairro} />
        <InfoRow label="Splitter" value={data.tipoSplitter} />
        <InfoRow label="CDO pai" value={data.caixaPai?.nome || data.caixaPai} />
      </div>
      {clientes.length > 0 && (
        <>
          <Separator className="bg-white/10" />
          <div>
            <p className="text-xs font-medium text-white/50 mb-2 uppercase tracking-wider">Clientes</p>
            <ul className="space-y-1">
              {clientes.map((c, i) => (
                <li key={i} className="text-xs text-white/70 px-2 py-1 bg-white/5 rounded">
                  {typeof c === 'string' ? c : c.nome || c.onu}
                </li>
              ))}
            </ul>
          </div>
        </>
      )}
      <div className="flex flex-wrap gap-2 pt-2">
        <Button size="sm" variant="outline" onClick={() => onAction('movimentacao')}
          className="border-white/20 text-white/70 hover:text-white hover:bg-white/10">
          <FileText className="size-3.5" />
          Registrar Movimentação
        </Button>
        <Button size="sm" variant="outline" onClick={() => onAction('diagrama')}
          className="border-white/20 text-white/70 hover:text-white hover:bg-white/10">
          <Network className="size-3.5" />
          Diagrama
        </Button>
        {isAdmin && (
          <Button size="sm" variant="outline" onClick={() => onAction('reposicionar')}
            className="border-white/20 text-white/70 hover:text-white hover:bg-white/10">
            <MoveVertical className="size-3.5" />
            Reposicionar
          </Button>
        )}
      </div>
    </div>
  )
}

function CaixaContent({ data, isAdmin, onAction }) {
  const tipoCfg = {
    CE: 'bg-blue-500/20 text-blue-300 border-blue-500/40',
    CDO: 'bg-purple-500/20 text-purple-300 border-purple-500/40',
  }
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${tipoCfg[data.tipo] || tipoCfg.CDO}`}>
          {data.tipo || 'CDO'}
        </span>
      </div>
      <div className="space-y-0.5">
        <InfoRow label="ID" value={data.caixaId || data._id} />
        <InfoRow label="Rua" value={data.rua} />
        <InfoRow label="Bairro" value={data.bairro} />
        <InfoRow label="Splitter CDO" value={data.splitterCdo} />
        <InfoRow label="OLT vinculada" value={data.olt?.nome || data.olt} />
        <InfoRow label="Porta PON" value={data.portaPon != null ? String(data.portaPon) : null} />
      </div>
      <div className="flex flex-wrap gap-2 pt-2">
        <Button size="sm" variant="outline" onClick={() => onAction('diagrama')}
          className="border-white/20 text-white/70 hover:text-white hover:bg-white/10">
          <FileText className="size-3.5" />
          Diagrama ABNT
        </Button>
        {isAdmin && (
          <Button size="sm" variant="outline" onClick={() => onAction('editar')}
            className="border-white/20 text-white/70 hover:text-white hover:bg-white/10">
            <Edit className="size-3.5" />
            Editar
          </Button>
        )}
      </div>
    </div>
  )
}

function RotaContent({ data, isAdmin, onAction }) {
  const tipoCfg = ROTA_TIPO_CONFIG[data.tipo] || ROTA_TIPO_CONFIG.RAMAL
  const distancia = data.distancia != null
    ? `${data.distancia >= 1000 ? (data.distancia / 1000).toFixed(2) + ' km' : data.distancia + ' m'}`
    : null
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${tipoCfg.className}`}>
          {tipoCfg.label}
        </span>
      </div>
      <div className="space-y-0.5">
        <InfoRow label="ID" value={data.rotaId || data._id} />
        <InfoRow label="Nome" value={data.nome} />
        <InfoRow label="Distância" value={distancia} />
      </div>
      {isAdmin && (
        <div className="flex flex-wrap gap-2 pt-2">
          <Button size="sm" variant="outline" onClick={() => onAction('editar')}
            className="border-white/20 text-white/70 hover:text-white hover:bg-white/10">
            <Edit className="size-3.5" />
            Editar
          </Button>
        </div>
      )}
    </div>
  )
}

function PosteContent({ data, isAdmin, onAction }) {
  const statusCfg = STATUS_CONFIG[data.status] || STATUS_CONFIG.ativo
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${statusCfg.className}`}>
          {statusCfg.label}
        </span>
      </div>
      <div className="space-y-0.5">
        <InfoRow label="ID" value={data.posteId || data._id} />
        <InfoRow label="Tipo" value={data.tipo} />
        <InfoRow label="Altura" value={data.altura} />
        <InfoRow label="Material" value={data.material} />
        <InfoRow label="Proprietário" value={data.proprietario} />
        <InfoRow label="Rua" value={data.rua} />
        <InfoRow label="Bairro" value={data.bairro} />
      </div>
      {isAdmin && (
        <div className="flex flex-wrap gap-2 pt-2">
          <Button size="sm" variant="outline" onClick={() => onAction('editar')}
            className="border-white/20 text-white/70 hover:text-white hover:bg-white/10">
            <Edit className="size-3.5" />
            Editar
          </Button>
        </div>
      )}
    </div>
  )
}

const TYPE_ICONS = {
  cto: Box,
  cdo: Layers,
  rota: Route,
  poste: Zap,
}

const TYPE_LABELS = {
  cto: 'CTO',
  cdo: 'CE/CDO',
  rota: 'Rota',
  poste: 'Poste',
}

export default function BottomSheet({ element, onClose, session, onAction }) {
  const [visible, setVisible] = useState(false)
  const startYRef = useRef(null)
  const currentYRef = useRef(0)
  const sheetRef = useRef(null)

  const role = session?.user?.role || 'user'
  const isAdmin = role === 'admin' || role === 'superadmin'

  useEffect(() => {
    if (element) {
      requestAnimationFrame(() => setVisible(true))
    } else {
      setVisible(false)
    }
  }, [element])

  const handleDragStart = (e) => {
    startYRef.current = e.type === 'touchstart' ? e.touches[0].clientY : e.clientY
  }

  const handleDragEnd = (e) => {
    const endY = e.type === 'touchend'
      ? e.changedTouches[0].clientY
      : e.clientY
    if (endY - startYRef.current > 80) {
      onClose?.()
    }
    startYRef.current = null
    currentYRef.current = 0
    if (sheetRef.current) sheetRef.current.style.transform = ''
  }

  const handleDragMove = (e) => {
    if (startYRef.current === null) return
    const y = e.type === 'touchmove' ? e.touches[0].clientY : e.clientY
    const delta = Math.max(0, y - startYRef.current)
    currentYRef.current = delta
    if (sheetRef.current) {
      sheetRef.current.style.transform = `translateY(${delta}px)`
    }
  }

  if (!element) return null

  const { type, data } = element
  const Icon = TYPE_ICONS[type] || MapPin
  const typeLabel = TYPE_LABELS[type] || type
  const name = data?.nome || data?.ctoId || data?.rotaId || data?.posteId || data?._id || 'Sem nome'

  const handleAction = (action) => onAction?.({ type, data, action })

  return (
    <div
      className={[
        'fixed bottom-0 left-0 right-0 z-50',
        'transition-transform duration-300 ease-out',
        visible ? 'translate-y-0' : 'translate-y-full',
      ].join(' ')}
      ref={sheetRef}
    >
      {/* Handle area */}
      <div
        className="flex justify-center pt-3 pb-1 bg-[#0d1829] rounded-t-2xl border-t border-x border-white/10 cursor-grab active:cursor-grabbing"
        onMouseDown={handleDragStart}
        onMouseMove={handleDragMove}
        onMouseUp={handleDragEnd}
        onMouseLeave={handleDragEnd}
        onTouchStart={handleDragStart}
        onTouchMove={handleDragMove}
        onTouchEnd={handleDragEnd}
      >
        <div className="w-10 h-1 rounded-full bg-white/20" />
      </div>

      {/* Content */}
      <div
        className="bg-[#0d1829] border-x border-b border-white/10 px-4 pb-6"
        style={{ maxHeight: '60vh', overflowY: 'auto' }}
      >
        {/* Sheet header */}
        <div className="flex items-center justify-between py-3 sticky top-0 bg-[#0d1829] z-10">
          <div className="flex items-center gap-2">
            <Icon className="size-4 text-blue-400" />
            <div>
              <p className="text-xs text-white/40 uppercase tracking-wider">{typeLabel}</p>
              <p className="text-sm font-semibold text-white">{name}</p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="size-7 text-white/50 hover:text-white hover:bg-white/10"
          >
            <X className="size-3.5" />
          </Button>
        </div>

        <Separator className="bg-white/10 mb-4" />

        {type === 'cto' && (
          <CTOContent data={data} isAdmin={isAdmin} onAction={handleAction} />
        )}
        {(type === 'cdo' || type === 'caixa') && (
          <CaixaContent data={data} isAdmin={isAdmin} onAction={handleAction} />
        )}
        {type === 'rota' && (
          <RotaContent data={data} isAdmin={isAdmin} onAction={handleAction} />
        )}
        {type === 'poste' && (
          <PosteContent data={data} isAdmin={isAdmin} onAction={handleAction} />
        )}
      </div>
    </div>
  )
}
