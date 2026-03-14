'use client'

import { useState } from 'react'
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

const TIPOS = ['CE', 'CDO']
const SPLITTERS = ['1x2', '1x4', '1x8', '1x16', '2x8', '2x16', '1x32']

const DEFAULT_FORM = {
  caixaId: '',
  nome: '',
  tipo: 'CDO',
  rua: '',
  bairro: '',
  lat: '',
  lng: '',
  olt: '',
  portaPon: '',
  splitterCdo: '1x8',
  obs: '',
}

export default function CaixaForm({ caixa, olts = [], onSubmit, onCancel, isLoading }) {
  const [form, setForm] = useState(() => ({
    ...DEFAULT_FORM,
    ...(caixa
      ? {
          caixaId: caixa.caixaId || '',
          nome: caixa.nome || '',
          tipo: caixa.tipo || 'CDO',
          rua: caixa.rua || '',
          bairro: caixa.bairro || '',
          lat: caixa.lat != null ? String(caixa.lat) : '',
          lng: caixa.lng != null ? String(caixa.lng) : '',
          olt: caixa.olt || '',
          portaPon: caixa.portaPon != null ? String(caixa.portaPon) : '',
          splitterCdo: caixa.splitterCdo || '1x8',
          obs: caixa.obs || '',
        }
      : {}),
  }))

  const set = (field) => (e) =>
    setForm((prev) => ({ ...prev, [field]: e.target.value }))

  const setSelect = (field) => (value) =>
    setForm((prev) => ({ ...prev, [field]: value }))

  const handleSubmit = (e) => {
    e.preventDefault()
    onSubmit?.({
      ...form,
      lat: parseFloat(form.lat),
      lng: parseFloat(form.lng),
      portaPon: form.portaPon ? parseInt(form.portaPon) : null,
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label className="text-white/70">ID *</Label>
          <Input
            value={form.caixaId}
            onChange={set('caixaId')}
            required
            placeholder="ex: CDO-001"
            className="bg-white/5 border-white/10 text-white placeholder:text-white/30"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-white/70">Tipo</Label>
          <Select value={form.tipo} onValueChange={setSelect('tipo')}>
            <SelectTrigger className="bg-white/5 border-white/10 text-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-[#0d1829] border-white/10">
              {TIPOS.map((t) => (
                <SelectItem key={t} value={t} className="text-white">{t}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label className="text-white/70">Nome</Label>
        <Input
          value={form.nome}
          onChange={set('nome')}
          placeholder="Nome da caixa"
          className="bg-white/5 border-white/10 text-white placeholder:text-white/30"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label className="text-white/70">Rua</Label>
          <Input
            value={form.rua}
            onChange={set('rua')}
            placeholder="Logradouro"
            className="bg-white/5 border-white/10 text-white placeholder:text-white/30"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-white/70">Bairro</Label>
          <Input
            value={form.bairro}
            onChange={set('bairro')}
            placeholder="Bairro"
            className="bg-white/5 border-white/10 text-white placeholder:text-white/30"
          />
        </div>
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

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label className="text-white/70">OLT pai</Label>
          <Select value={form.olt} onValueChange={setSelect('olt')}>
            <SelectTrigger className="bg-white/5 border-white/10 text-white">
              <SelectValue placeholder="Selecionar OLT" />
            </SelectTrigger>
            <SelectContent className="bg-[#0d1829] border-white/10">
              <SelectItem value="" className="text-white/60">Nenhuma</SelectItem>
              {olts.map((o) => (
                <SelectItem key={o._id || o.id} value={o._id || o.id} className="text-white">
                  {o.nome || o.oltId}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-white/70">Porta PON</Label>
          <Input
            type="number"
            value={form.portaPon}
            onChange={set('portaPon')}
            placeholder="ex: 1"
            min={1}
            className="bg-white/5 border-white/10 text-white placeholder:text-white/30"
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label className="text-white/70">Splitter CDO</Label>
        <Select value={form.splitterCdo} onValueChange={setSelect('splitterCdo')}>
          <SelectTrigger className="bg-white/5 border-white/10 text-white">
            <SelectValue placeholder="Tipo de splitter" />
          </SelectTrigger>
          <SelectContent className="bg-[#0d1829] border-white/10">
            {SPLITTERS.map((s) => (
              <SelectItem key={s} value={s} className="text-white">{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label className="text-white/70">Observações</Label>
        <Textarea
          value={form.obs}
          onChange={set('obs')}
          placeholder="Observações..."
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
