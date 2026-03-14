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

const SPLITTER_TYPES = ['1x2', '1x4', '1x8', '1x16', '2x8', '2x16', '1x32']

const DEFAULT_FORM = {
  ctoId: '',
  nome: '',
  descricao: '',
  rua: '',
  bairro: '',
  lat: '',
  lng: '',
  capacidade: '8',
  caixaPai: '',
  portaCdo: '',
  tipoSplitter: '1x8',
}

export default function CTOForm({ cto, caixas = [], onSubmit, onCancel, isLoading }) {
  const [form, setForm] = useState(() => ({
    ...DEFAULT_FORM,
    ...(cto
      ? {
          ctoId: cto.ctoId || '',
          nome: cto.nome || '',
          descricao: cto.descricao || '',
          rua: cto.rua || '',
          bairro: cto.bairro || '',
          lat: cto.lat != null ? String(cto.lat) : '',
          lng: cto.lng != null ? String(cto.lng) : '',
          capacidade: cto.capacidade != null ? String(cto.capacidade) : '8',
          caixaPai: cto.caixaPai || '',
          portaCdo: cto.portaCdo != null ? String(cto.portaCdo) : '',
          tipoSplitter: cto.tipoSplitter || '1x8',
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
      capacidade: parseInt(form.capacidade),
      portaCdo: form.portaCdo ? parseInt(form.portaCdo) : null,
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label className="text-white/70">CTO ID *</Label>
          <Input
            value={form.ctoId}
            onChange={set('ctoId')}
            required
            placeholder="ex: CTO-001"
            className="bg-white/5 border-white/10 text-white placeholder:text-white/30"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-white/70">Capacidade</Label>
          <Input
            type="number"
            value={form.capacidade}
            onChange={set('capacidade')}
            min={1}
            className="bg-white/5 border-white/10 text-white"
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label className="text-white/70">Nome / Descrição</Label>
        <Input
          value={form.nome}
          onChange={set('nome')}
          placeholder="Nome da CTO"
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
          <Label className="text-white/70">CE/CDO pai</Label>
          <Select value={form.caixaPai} onValueChange={setSelect('caixaPai')}>
            <SelectTrigger className="bg-white/5 border-white/10 text-white">
              <SelectValue placeholder="Selecionar CDO" />
            </SelectTrigger>
            <SelectContent className="bg-[#0d1829] border-white/10">
              <SelectItem value="" className="text-white/60">Nenhum</SelectItem>
              {caixas.map((c) => (
                <SelectItem key={c._id || c.id} value={c._id || c.id} className="text-white">
                  {c.nome || c.caixaId}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-white/70">Porta no CDO</Label>
          <Input
            type="number"
            value={form.portaCdo}
            onChange={set('portaCdo')}
            placeholder="ex: 1"
            min={1}
            className="bg-white/5 border-white/10 text-white placeholder:text-white/30"
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label className="text-white/70">Tipo de Splitter</Label>
        <Select value={form.tipoSplitter} onValueChange={setSelect('tipoSplitter')}>
          <SelectTrigger className="bg-white/5 border-white/10 text-white">
            <SelectValue placeholder="Selecionar splitter" />
          </SelectTrigger>
          <SelectContent className="bg-[#0d1829] border-white/10">
            {SPLITTER_TYPES.map((s) => (
              <SelectItem key={s} value={s} className="text-white">
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
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
