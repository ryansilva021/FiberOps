/**
 * CTO.js
 * Caixa de Terminação Óptica — ponto final da rede FTTH onde os clientes se conectam.
 * Equivalente à tabela SQL: ctos
 *
 * Campos SQL originais:
 *   cto_id TEXT PK, projeto_id TEXT, nome TEXT, rua TEXT, bairro TEXT,
 *   capacidade INTEGER, lat REAL, lng REAL, updated_at TEXT,
 *   cdo_id TEXT, porta_cdo INTEGER, splitter_cto TEXT, diagrama TEXT
 *
 * Topologia hierárquica: OLT → CDO/CE → CTO
 *   - cdo_id   : FK para CaixaEmendaCDO (porta de saída do CDO)
 *   - porta_cdo: número da porta ocupada no CDO pai
 */

import mongoose from "mongoose";

const { Schema, model, models } = mongoose;

// ---------------------------------------------------------------------------
// Schema principal
// ---------------------------------------------------------------------------
const CTOSchema = new Schema(
  {
    // Identificador legível único por projeto (ex: "CTO-001", "CTO-CENTRO-05")
    cto_id: {
      type:     String,
      required: [true, "cto_id é obrigatório"],
      trim:     true,
    },

    // Multi-tenancy: obrigatório
    projeto_id: {
      type:     String,
      required: [true, "projeto_id é obrigatório"],
      trim:     true,
      default:  "default",
    },

    nome: {
      type:    String,
      trim:    true,
      default: null,
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

    // Capacidade total de portas da CTO (ex: 8, 16, 32)
    capacidade: {
      type:    Number,
      default: 0,
      min:     [0, "capacidade não pode ser negativa"],
    },

    // Coordenadas geográficas (lat/lng simples, conforme sistema legado)
    lat: {
      type:     Number,
      required: [true, "latitude é obrigatória"],
      min:      [-90, "latitude deve estar entre -90 e 90"],
      max:      [90,  "latitude deve estar entre -90 e 90"],
    },

    lng: {
      type:     Number,
      required: [true, "longitude é obrigatória"],
      min:      [-180, "longitude deve estar entre -180 e 180"],
      max:      [180,  "longitude deve estar entre -180 e 180"],
    },

    // Topologia: CDO/CE pai desta CTO
    cdo_id: {
      type:    String, // referência ao id da CaixaEmendaCDO (string, não ObjectId)
      default: null,
    },

    porta_cdo: {
      type:    Number,
      default: null,
      min:     [1, "porta_cdo deve ser >= 1"],
    },

    // Tipo/configuração do splitter interno (ex: "1:8", "1:16", "passthrough")
    splitter_cto: {
      type:    String,
      trim:    true,
      default: null,
    },

    // Diagrama interno da CTO (estrutura JSON livre — aceita qualquer shape)
    // Novo formato: { entrada, bandejas, splitters, portas }
    // Legado:       { entrada: { ce_id, porta_cdo }, portas: Map }
    diagrama: {
      type:    Schema.Types.Mixed,
      default: null,
    },
  },
  {
    timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
    collection: "ctos",
  }
);

// ---------------------------------------------------------------------------
// Índice composto único por projeto (cto_id único dentro do tenant)
// ---------------------------------------------------------------------------
CTOSchema.index({ projeto_id: 1, cto_id: 1 }, { unique: true });

// Índice para buscas geoespaciais simples por caixa delimitadora
CTOSchema.index({ projeto_id: 1, lat: 1, lng: 1 });

// Índice para queries de topologia: "todos os CTOs do CDO X"
CTOSchema.index({ projeto_id: 1, cdo_id: 1 });

// Índice para busca por nome/bairro no painel admin
CTOSchema.index({ projeto_id: 1, bairro: 1 });

// ---------------------------------------------------------------------------
// Virtuals
// ---------------------------------------------------------------------------

/**
 * Retorna as coordenadas como objeto { lat, lng } para facilitar serialização
 */
CTOSchema.virtual("coords").get(function () {
  return { lat: this.lat, lng: this.lng };
});

/**
 * Retorna o endereço formatado: "Rua das Flores, Centro"
 */
CTOSchema.virtual("endereco").get(function () {
  const partes = [this.rua, this.bairro].filter(Boolean);
  return partes.join(", ") || null;
});

// ---------------------------------------------------------------------------
// Métodos de instância
// ---------------------------------------------------------------------------

/**
 * Retorna quantas portas estão ocupadas com base no diagrama.
 */
CTOSchema.methods.portasOcupadas = function () {
  if (!this.diagrama?.portas) return 0;
  let count = 0;
  for (const porta of this.diagrama.portas.values()) {
    if (porta?.cliente) count++;
  }
  return count;
};

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------
export const CTO = models.CTO || model("CTO", CTOSchema);
