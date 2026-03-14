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

const TIPOS = ['simples', 'transformador', 'ancoragem', 'derivacao', 'cruzamento']
const STATUS = ['ativo', 'manutencao', 'inativo']
const ALTURAS = ['7m', '9m', '11m', '13m']
const MATERIAIS = ['concreto', 'madeira', 'ferro', 'fibra']
const PROPRIETARIOS = ['concessionaria', 'proprio', 'prefeitura', 'compartilhado']

const DEFAULT_FORM = {
  posteId: '',
  nome: '',
  tipo: 'simples',
  status: 'ativo',
  altura: '9m',
  material: 'concreto',
  proprietario: 'concessionaria',
  rua: '',
  bairro: '',
  lat: '',
  lng: '',
  obs: '',
}

export default function PosteForm({ poste, onSubmit, onCancel, isLoading }) {
  const [form, setForm] = useState(() => ({
    ...DEFAULT_FORM,
    ...(poste
      ? {
          posteId: poste.posteId || '',
          nome: poste.nome || '',
          tipo: poste.tipo || 'simples',
          status: poste.status || 'ativo',
          altura: poste.altura || '9m',
          material: poste.material || 'concreto',
          proprietario: poste.proprietario || 'concessionaria',
          rua: poste.rua || '',
          bairro: poste.bairro || '',
          lat: poste.lat != null ? String(poste.lat) : '',
          lng: poste.lng != null ? String(poste.lng) : '',
          obs: poste.obs || '',
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
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label className="text-white/70">Poste ID *</Label>
          <Input
            value={form.posteId}
            onChange={set('posteId')}
            required
            placeholder="ex: PT-001"
            className="bg-white/5 border-white/10 text-white placeholder:text-white/30"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-white/70">Nome</Label>
          <Input
            value={form.nome}
            onChange={set('nome')}
            placeholder="Identificação"
            className="bg-white/5 border-white/10 text-white placeholder:text-white/30"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label className="text-white/70">Tipo</Label>
          <Select value={form.tipo} onValueChange={setSelect('tipo')}>
            <SelectTrigger className="bg-white/5 border-white/10 text-white capitalize">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-[#0d1829] border-white/10">
              {TIPOS.map((t) => (
                <SelectItem key={t} value={t} className="text-white capitalize">{t}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-white/70">Status</Label>
          <Select value={form.status} onValueChange={setSelect('status')}>
            <SelectTrigger className="bg-white/5 border-white/10 text-white capitalize">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-[#0d1829] border-white/10">
              {STATUS.map((s) => (
                <SelectItem key={s} value={s} className="text-white capitalize">{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label className="text-white/70">Altura</Label>
          <Select value={form.altura} onValueChange={setSelect('altura')}>
            <SelectTrigger className="bg-white/5 border-white/10 text-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-[#0d1829] border-white/10">
              {ALTURAS.map((a) => (
                <SelectItem key={a} value={a} className="text-white">{a}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-white/70">Material</Label>
          <Select value={form.material} onValueChange={setSelect('material')}>
            <SelectTrigger className="bg-white/5 border-white/10 text-white capitalize">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-[#0d1829] border-white/10">
              {MATERIAIS.map((m) => (
                <SelectItem key={m} value={m} className="text-white capitalize">{m}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label className="text-white/70">Proprietário</Label>
        <Select value={form.proprietario} onValueChange={setSelect('proprietario')}>
          <SelectTrigger className="bg-white/5 border-white/10 text-white capitalize">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-[#0d1829] border-white/10">
            {PROPRIETARIOS.map((p) => (
              <SelectItem key={p} value={p} className="text-white capitalize">{p}</SelectItem>
            ))}
          </SelectContent>
        </Select>
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
