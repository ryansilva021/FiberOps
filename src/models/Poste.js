/**
 * Poste.js
 * Poste de infraestrutura utilizado para passar cabos de fibra óptica.
 * Equivalente à tabela SQL: postes
 *
 * Campos SQL originais:
 *   poste_id TEXT PK, projeto_id TEXT, tipo TEXT, nome TEXT, altura TEXT,
 *   material TEXT, proprietario TEXT, status TEXT, rua TEXT, bairro TEXT,
 *   obs TEXT, lat REAL, lng REAL, updated_at TEXT
 */

import mongoose from "mongoose";

const { Schema, model, models } = mongoose;

const PosteSchema = new Schema(
  {
    // Identificador único por projeto
    poste_id: {
      type:     String,
      required: [true, "poste_id é obrigatório"],
      trim:     true,
    },

    // Multi-tenancy
    projeto_id: {
      type:     String,
      required: [true, "projeto_id é obrigatório"],
      trim:     true,
      default:  "default",
    },

    // Tipo do poste: "simples", "duplo", "concreto", "madeira", etc.
    tipo: {
      type:    String,
      trim:    true,
      default: "simples",
    },

    nome: {
      type:    String,
      trim:    true,
      default: null,
    },

    // Altura em metros (armazenada como string para preservar "11m", "13m" do legado)
    altura: {
      type:    String,
      trim:    true,
      default: null,
    },

    // Material: "concreto", "madeira", "metalico", "fibra"
    material: {
      type:    String,
      trim:    true,
      default: null,
    },

    // Proprietário do poste: "CEMIG", "COPEL", "Empresa X", "proprio"
    proprietario: {
      type:    String,
      trim:    true,
      default: null,
    },

    // Status operacional
    status: {
      type:    String,
      trim:    true,
      enum:    ["ativo", "inativo", "em_manutencao", "removido"],
      default: "ativo",
    },

    rua: {
      type:    String,
      trim:    true,
      default: null,
    },

    bairro: {
      type:    String,
      trim:    true,
      default: null,
    },

    obs: {
      type:    String,
      trim:    true,
      default: null,
    },

    // Coordenadas geográficas
    lat: {
      type:    Number,
      default: null,
      min:     [-90,  "latitude deve estar entre -90 e 90"],
      max:     [90,   "latitude deve estar entre -90 e 90"],
    },

    lng: {
      type:    Number,
      default: null,
      min:     [-180, "longitude deve estar entre -180 e 180"],
      max:     [180,  "longitude deve estar entre -180 e 180"],
    },
  },
  {
    timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
    collection: "postes",
  }
);

// ---------------------------------------------------------------------------
// Índices
// ---------------------------------------------------------------------------

// Identificador único por projeto
PosteSchema.index({ projeto_id: 1, poste_id: 1 }, { unique: true });

// Índice geoespacial simples
PosteSchema.index({ projeto_id: 1, lat: 1, lng: 1 });

// Índice para filtros no mapa por bairro e status
PosteSchema.index({ projeto_id: 1, status: 1 });
PosteSchema.index({ projeto_id: 1, bairro: 1 });
PosteSchema.index({ projeto_id: 1, proprietario: 1 });

// ---------------------------------------------------------------------------
// Virtuals
// ---------------------------------------------------------------------------

/**
 * Endereço formatado: "Rua das Flores, Centro"
 */
PosteSchema.virtual("endereco").get(function () {
  return [this.rua, this.bairro].filter(Boolean).join(", ") || null;
});

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------
export const Poste = models.Poste || model("Poste", PosteSchema);
