/**
 * src/models/SystemConfig.js
 * Configurações globais por projeto (multi-tenant).
 * Uma entrada por projeto_id.
 */

import mongoose from 'mongoose'
export { FIBER_COLOR_DEFAULTS } from '@/lib/fiber-color-defaults'

// ─── Schema ────────────────────────────────────────────────────────────────────

const FiberColorSchema = new mongoose.Schema({
  posicao: { type: Number, required: true },
  nome:    { type: String, required: true },
  hex:     { type: String, required: true, match: /^#[0-9a-fA-F]{6}$/ },
}, { _id: false })

const SystemConfigSchema = new mongoose.Schema({
  projeto_id: {
    type:     String,
    required: true,
    unique:   true,
    index:    true,
  },

  // ── Informações da empresa ────────────────────────────────────────────────
  nome_empresa:    { type: String, default: '' },
  logo_url:        { type: String, default: '' },
  timezone:        { type: String, default: 'America/Sao_Paulo' },

  // ── Cores de fibra ────────────────────────────────────────────────────────
  padrao_fibra:    { type: String, enum: ['brasil', 'eua', 'personalizado'], default: 'brasil' },
  cores_fibra:     { type: [FiberColorSchema], default: () => FIBER_COLOR_DEFAULTS.brasil },

  // ── Notificações ──────────────────────────────────────────────────────────
  notif_nova_os:      { type: Boolean, default: true },
  notif_status_os:    { type: Boolean, default: true },
  notif_ponto:        { type: Boolean, default: true },

  // ── OS ────────────────────────────────────────────────────────────────────
  os_prazo_horas:  { type: Number, default: 48 },   // SLA padrão em horas
  os_tipos_ativos: {
    type:    [String],
    default: ['instalacao', 'manutencao', 'suporte', 'cancelamento'],
  },

  // ── Mapa ─────────────────────────────────────────────────────────────────
  mapa_lat_default: { type: Number, default: -15.7942 },
  mapa_lng_default: { type: Number, default: -47.8822 },
  mapa_zoom_default: { type: Number, default: 13 },

  updated_at: { type: Date, default: Date.now },
}, {
  collection:  'system_configs',
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
})

export const SystemConfig = mongoose.models.SystemConfig
  ?? mongoose.model('SystemConfig', SystemConfigSchema)

/** Retorna config do projeto; cria com defaults se não existir. */
export async function getOrCreateConfig(projeto_id) {
  let cfg = await SystemConfig.findOne({ projeto_id }).lean()
  if (!cfg) {
    cfg = await SystemConfig.create({ projeto_id })
    cfg = cfg.toObject()
  }
  return cfg
}
