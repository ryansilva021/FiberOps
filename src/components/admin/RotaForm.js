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

const TIPOS = [
  { value: 'BACKBONE', label: 'Backbone', color: 'text-blue-300' },
  { value: 'RAMAL', label: 'Ramal', color: 'text-orange-300' },
  { value: 'DROP', label: 'Drop', color: 'text-emerald-300' },
]

const DEFAULT_FORM = {
  rotaId: '',
  nome: '',
  tipo: 'RAMAL',
  coordenadas: '',
}

export default function RotaForm({ rota, onSubmit, onCancel, isLoading }) {
  const [form, setForm] = useState(() => ({
    ...DEFAULT_FORM,
    ...(rota
      ? {
          rotaId: rota.rotaId || '',
          nome: rota.nome || '',
          tipo: rota.tipo || 'RAMAL',
          coordenadas: rota.coordenadas
            ? typeof rota.coordenadas === 'string'
              ? rota.coordenadas
              : JSON.stringify(rota.coordenadas, null, 2)
            : '',
        }
      : {}),
  }))

  const set = (field) => (e) =>
    setForm((prev) => ({ ...prev, [field]: e.target.value }))

  const setSelect = (field) => (value) =>
    setForm((prev) => ({ ...prev, [field]: value }))

  const handleSubmit = (e) => {
    e.preventDefault()
    let coordenadas = form.coordenadas
    try {
      coordenadas = JSON.parse(form.coordenadas)
    } catch {
      // keep as string if not valid JSON — let the server validate
    }
    onSubmit?.({ ...form, coordenadas })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label className="text-white/70">Rota ID *</Label>
          <Input
            value={form.rotaId}
            onChange={set('rotaId')}
            required
            placeholder="ex: RT-001"
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
                <SelectItem key={t.value} value={t.value} className={`text-white ${t.color}`}>
                  {t.label}
                </SelectItem>
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
          placeholder="Nome da rota"
          className="bg-white/5 border-white/10 text-white placeholder:text-white/30"
        />
      </div>

      <div className="space-y-1.5">
        <Label className="text-white/70">
          Coordenadas
          <span className="ml-1 text-xs text-white/30">(GeoJSON ou lista de pares lat,lng)</span>
        </Label>
        <Textarea
          value={form.coordenadas}
          onChange={set('coordenadas')}
          rows={8}
          placeholder={`Cole o GeoJSON LineString ou uma lista:\n-23.5505,-46.6333\n-23.5510,-46.6340\n...`}
          className="bg-white/5 border-white/10 text-white placeholder:text-white/30 font-mono text-xs resize-none"
        />
        <p className="text-xs text-white/30">
          Aceita GeoJSON Feature/LineString ou linhas com &quot;lat,lng&quot;
        </p>
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
