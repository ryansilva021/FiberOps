'use client'

import { useState } from 'react'
import { MapPin, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

const TIPOS = [
  { value: 'ATIVACAO', label: 'Ativação', color: 'text-emerald-300' },
  { value: 'MANUTENCAO', label: 'Manutenção', color: 'text-yellow-300' },
  { value: 'DESATIVACAO', label: 'Desativação', color: 'text-red-300' },
  { value: 'OUTRO', label: 'Outro', color: 'text-white/70' },
]

const DEFAULT_FORM = {
  tipo: 'ATIVACAO',
  cliente: '',
  onu: '',
  obs: '',
  gpsLat: '',
  gpsLng: '',
}

export default function MovimentacaoForm({ cto, onSubmit, onCancel, isLoading }) {
  const [form, setForm] = useState(DEFAULT_FORM)
  const [gpsLoading, setGpsLoading] = useState(false)
  const [gpsError, setGpsError] = useState('')

  const set = (field) => (e) =>
    setForm((prev) => ({ ...prev, [field]: e.target.value }))

  const setSelect = (field) => (value) =>
    setForm((prev) => ({ ...prev, [field]: value }))

  const handleGetGps = () => {
    if (!navigator.geolocation) {
      setGpsError('Geolocalização não disponível neste dispositivo.')
      return
    }
    setGpsLoading(true)
    setGpsError('')
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setForm((prev) => ({
          ...prev,
          gpsLat: String(pos.coords.latitude),
          gpsLng: String(pos.coords.longitude),
        }))
        setGpsLoading(false)
      },
      (err) => {
        setGpsError('Não foi possível obter a localização: ' + err.message)
        setGpsLoading(false)
      },
      { enableHighAccuracy: true, timeout: 10000 }
    )
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    onSubmit?.({
      ...form,
      ctoId: cto?._id || cto?.ctoId,
      gpsLat: form.gpsLat ? parseFloat(form.gpsLat) : null,
      gpsLng: form.gpsLng ? parseFloat(form.gpsLng) : null,
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {cto && (
        <div className="px-3 py-2 rounded-lg bg-white/5 border border-white/10">
          <p className="text-xs text-white/40">CTO</p>
          <p className="text-sm text-white font-medium">{cto.nome || cto.ctoId}</p>
        </div>
      )}

      <div className="space-y-1.5">
        <Label className="text-white/70">Tipo de Movimentação *</Label>
        <Select value={form.tipo} onValueChange={setSelect('tipo')}>
          <SelectTrigger className="bg-white/5 border-white/10 text-white">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-[#0d1829] border-white/10">
            {TIPOS.map((t) => (
              <SelectItem key={t.value} value={t.value} className={`text-white ${t.color}`}>
                {t.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label className="text-white/70">Cliente</Label>
        <Input
          value={form.cliente}
          onChange={set('cliente')}
          placeholder="Nome do cliente"
          className="bg-white/5 border-white/10 text-white placeholder:text-white/30"
        />
      </div>

      <div className="space-y-1.5">
        <Label className="text-white/70">ONU / Serial</Label>
        <Input
          value={form.onu}
          onChange={set('onu')}
          placeholder="Serial da ONU"
          className="bg-white/5 border-white/10 text-white placeholder:text-white/30"
        />
      </div>

      <div className="space-y-1.5">
        <Label className="text-white/70">Observação</Label>
        <Textarea
          value={form.obs}
          onChange={set('obs')}
          placeholder="Detalhes da movimentação..."
          rows={3}
          className="bg-white/5 border-white/10 text-white placeholder:text-white/30 resize-none"
        />
      </div>

      <div className="space-y-2">
        <Label className="text-white/70">Localização GPS</Label>
        <div className="flex gap-2">
          <Input
            readOnly
            value={form.gpsLat && form.gpsLng ? `${form.gpsLat}, ${form.gpsLng}` : ''}
            placeholder="Clique para obter GPS"
            className="bg-white/5 border-white/10 text-white/60 placeholder:text-white/20 flex-1"
          />
          <Button
            type="button"
            variant="outline"
            size="default"
            onClick={handleGetGps}
            disabled={gpsLoading}
            className="shrink-0 border-white/20 text-white/70 hover:text-white hover:bg-white/10"
          >
            {gpsLoading ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <MapPin className="size-4" />
            )}
            {gpsLoading ? 'Obtendo...' : 'GPS'}
          </Button>
        </div>
        {gpsError && (
          <p className="text-xs text-red-400">{gpsError}</p>
        )}
        {form.gpsLat && form.gpsLng && (
          <p className="text-xs text-emerald-400">
            Localização obtida: {parseFloat(form.gpsLat).toFixed(6)}, {parseFloat(form.gpsLng).toFixed(6)}
          </p>
        )}
      </div>

      <div className="flex gap-3 pt-2">
        <Button type="submit" disabled={isLoading} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white border-0">
          {isLoading ? 'Salvando...' : 'Registrar'}
        </Button>
        <Button type="button" variant="outline" onClick={onCancel} disabled={isLoading}
          className="flex-1 border-white/20 text-white/70 hover:text-white hover:bg-white/10">
          Cancelar
        </Button>
      </div>
    </form>
  )
}
