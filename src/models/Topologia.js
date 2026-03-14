/**
 * Topologia.js
 * Registro explícito dos vínculos hierárquicos da rede: OLT → CDO → CTO.
 *
 * No sistema legado (worker.js), a topologia é inferida a partir de campos
 * FK embutidos nas próprias tabelas (ctos.cdo_id, caixas_emenda_cdo.olt_id).
 * Este modelo centraliza esses vínculos como documentos independentes,
 * facilitando queries de árvore, auditoria de mudanças e notificações.
 *
 * Casos de uso:
 *   - GET /api/topologia → montar árvore OLT→CDO→CTO
 *   - POST /api/topologia/link → criar ou atualizar vínculo
 *   - Histórico de mudanças topológicas (campo history)
 *
 * Os campos olt_id / cdo_id / cto_id continuam existindo nos documentos CTO
 * e CaixaEmendaCDO como denormalização para queries rápidas. Este modelo é
 * a fonte de verdade para vinculações.
 */

import mongoose from "mongoose";

const { Schema, model, models } = mongoose;

// ---------------------------------------------------------------------------
// Schema principal
// ---------------------------------------------------------------------------
const TopologiaSchema = new Schema(
  {
    // Multi-tenancy: obrigatório
    projeto_id: {
      type:     String,
      required: [true, "projeto_id é obrigatório"],
      trim:     true,
      default:  "default",
    },

    // Tipo do vínculo
    tipo: {
      type:    String,
      required: [true, "tipo é obrigatório"],
      enum:    ["cdo_to_olt", "cto_to_cdo"],
    },

    // Elemento filho (CDO vinculado a OLT; ou CTO vinculado a CDO)
    filho_id: {
      type:     String,
      required: [true, "filho_id é obrigatório"],
      trim:     true,
    },

    // Elemento pai (OLT quando tipo=cdo_to_olt; CDO quando tipo=cto_to_cdo)
    pai_id: {
      type:    String,
      trim:    true,
      default: null,
    },

    // Porta ocupada no pai (porta_olt ou porta_cdo)
    porta: {
      type:    Number,
      default: null,
      min:     [1, "porta deve ser >= 1"],
    },

    // Configuração do splitter neste ponto da hierarquia
    splitter: {
      type:    String,
      trim:    true,
      default: null,
      // Ex: "1:8", "1:16", "2:8", "passthrough"
    },

    // Histórico de mudanças (útil para auditoria)
    history: [
      {
        pai_id_anterior: { type: String, default: null },
        porta_anterior:  { type: Number, default: null },
        alterado_em:     { type: Date, default: () => new Date() },
        alterado_por:    { type: String, default: null }, // username
        _id: false,
      },
    ],
  },
  {
    timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
    collection: "topologias",
  }
);

// ---------------------------------------------------------------------------
// Índices
// ---------------------------------------------------------------------------

// Vínculo único por elemento filho dentro do projeto
// (um CDO só pode estar vinculado a uma OLT; uma CTO a um CDO)
TopologiaSchema.index(
  { projeto_id: 1, tipo: 1, filho_id: 1 },
  { unique: true }
);

// Queries: "todos os filhos de um pai" (CDOs de uma OLT; CTOs de um CDO)
TopologiaSchema.index({ projeto_id: 1, tipo: 1, pai_id: 1 });

// ---------------------------------------------------------------------------
// Métodos estáticos
// ---------------------------------------------------------------------------

/**
 * Retorna todos os CDOs vinculados a uma OLT.
 *
 * @param {string} projeto_id
 * @param {string} olt_id
 */
TopologiaSchema.statics.cdosDaOLT = function (projeto_id, olt_id) {
  return this.find({ projeto_id, tipo: "cdo_to_olt", pai_id: olt_id }).lean();
};

/**
 * Retorna todos os CTOs vinculados a um CDO.
 *
 * @param {string} projeto_id
 * @param {string} cdo_id
 */
TopologiaSchema.statics.ctosDoCDO = function (projeto_id, cdo_id) {
  return this.find({ projeto_id, tipo: "cto_to_cdo", pai_id: cdo_id }).lean();
};

/**
 * Upsert de um vínculo — preserva histórico se o pai mudou.
 * Equivale ao handleLinkTopologia do worker.js.
 *
 * @param {object} params
 * @param {string} params.projeto_id
 * @param {"cdo_to_olt"|"cto_to_cdo"} params.tipo
 * @param {string} params.filho_id
 * @param {string|null} params.pai_id
 * @param {number|null} params.porta
 * @param {string|null} params.splitter
 * @param {string} params.usuario - username de quem fez a alteração
 */
TopologiaSchema.statics.vincular = async function ({
  projeto_id,
  tipo,
  filho_id,
  pai_id,
  porta,
  splitter,
  usuario,
}) {
  const existing = await this.findOne({ projeto_id, tipo, filho_id });

  if (existing) {
    // Registra histórico se o pai mudou
    if (existing.pai_id !== pai_id || existing.porta !== porta) {
      existing.history.push({
        pai_id_anterior: existing.pai_id,
        porta_anterior:  existing.porta,
        alterado_por:    usuario || null,
      });
    }
    existing.pai_id   = pai_id   ?? null;
    existing.porta    = porta    ?? null;
    existing.splitter = splitter ?? null;
    return existing.save();
  }

  return this.create({ projeto_id, tipo, filho_id, pai_id, porta, splitter });
};

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------
export const Topologia = models.Topologia || model("Topologia", TopologiaSchema);
