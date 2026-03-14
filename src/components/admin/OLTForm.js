'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

const DEFAULT_FORM = {
  oltId: '',
  nome: '',
  modelo: '',
  ipGestao: '',
  capacidade: '',
  lat: '',
  lng: '',
  obs: '',
}

export default function OLTForm({ olt, onSubmit, onCancel, isLoading }) {
  const [form, setForm] = useState(() => ({
    ...DEFAULT_FORM,
    ...(olt
      ? {
          oltId: olt.oltId || '',
          nome: olt.nome || '',
          modelo: olt.modelo || '',
          ipGestao: olt.ipGestao || '',
          capacidade: olt.capacidade != null ? String(olt.capacidade) : '',
          lat: olt.lat != null ? String(olt.lat) : '',
          lng: olt.lng != null ? String(olt.lng) : '',
          obs: olt.obs || '',
        }
      : {}),
  }))

  const set = (field) => (e) =>
    setForm((prev) => ({ ...prev, [field]: e.target.value }))

  const handleSubmit = (e) => {
    e.preventDefault()
    onSubmit?.({
      ...form,
      capacidade: form.capacidade ? parseInt(form.capacidade) : null,
      lat: form.lat ? parseFloat(form.lat) : null,
      lng: form.lng ? parseFloat(form.lng) : null,
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label className="text-white/70">OLT ID *</Label>
          <Input
            value={form.oltId}
            onChange={set('oltId')}
            required
            placeholder="ex: OLT-001"
            className="bg-white/5 border-white/10 text-white placeholder:text-white/30"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-white/70">Nome</Label>
          <Input
            value={form.nome}
            onChange={set('nome')}
            placeholder="Nome da OLT"
            className="bg-white/5 border-white/10 text-white placeholder:text-white/30"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label className="text-white/70">Modelo</Label>
          <Input
            value={form.modelo}
            onChange={set('modelo')}
            placeholder="ex: Huawei MA5800"
            className="bg-white/5 border-white/10 text-white placeholder:text-white/30"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-white/70">IP de Gestão</Label>
          <Input
            value={form.ipGestao}
            onChange={set('ipGestao')}
            placeholder="ex: 192.168.1.100"
            className="bg-white/5 border-white/10 text-white placeholder:text-white/30"
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label className="text-white/70">
          Capacidade
          <span className="ml-1 text-xs text-white/30">(nº de portas PON)</span>
        </Label>
        <Input
          type="number"
          value={form.capacidade}
          onChange={set('capacidade')}
          placeholder="ex: 16"
          min={1}
          className="bg-white/5 border-white/10 text-white placeholder:text-white/30"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label className="text-white/70">Latitude</Label>
          <Input
            type="number"
            step="any"
            value={form.lat}
            onChange={set('lat')}
            placeholder="-23.0000"
            className="bg-white/5 border-white/10 text-white placeholder:text-white/30"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-white/70">Longitude</Label>
          <Input
            type="number"
            step="any"
            value={form.lng}
            onChange={set('lng')}
            placeholder="-46.0000"
            className="bg-white/5 border-white/10 text-white placeholder:text-white/30"
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label className="text-white/70">Observações</Label>
        <Textarea
          value={form.obs}
          onChange={set('obs')}
          placeholder="Observações sobre a OLT..."
          rows={3}
          className="bg-white/5 border-white/10 text-white placeholder:text-white/30 resize-none"
        />
      </div>

      <div className="flex gap-3 pt-2">
        <Button type="submit" disabled={isLoading} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white border-0">
          {isLoading ? 'Salvando...' : 'Salvar'}
        </Button>
        <Button type="button" variant="outline" onClick={onCancel} disabled={isLoading}
          className="flex-1 border-white/20 text-white/70 hover:text-white hover:bg-white/10">
          Cancelar
        </Button>
      </div>
    </form>
  )
}
