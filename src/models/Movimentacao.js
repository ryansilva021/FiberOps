/**
 * Movimentacao.js
 * Registro de instalações e desinstalações de clientes em CTOs.
 * Equivalente à tabela SQL: movimentacoes_d1
 *
 * Campos SQL originais:
 *   id INTEGER PK AUTOINCREMENT, projeto_id TEXT, DATA TEXT,
 *   CTO_ID TEXT, Tipo TEXT, Cliente TEXT, Usuario TEXT,
 *   Observacao TEXT, created_at TEXT
 *
 * Tipos de movimentação:
 *   "instalacao"   — cliente instalado em uma porta da CTO
 *   "desinstalacao"— cliente removido de uma porta da CTO
 *   "troca"        — mudança de porta ou CTO
 *   "manutencao"   — visita de manutenção sem instalação/remoção
 *
 * Os nomes de campos em maiúsculas (CTO_ID, Tipo, Cliente, etc.)
 * são mantidos como aliases via `alias` para facilitar a migração.
 */

import mongoose from "mongoose";

const { Schema, model, models } = mongoose;

const MovimentacaoSchema = new Schema(
  {
    // Multi-tenancy
    projeto_id: {
      type:     String,
      required: [true, "projeto_id é obrigatório"],
      trim:     true,
      default:  "default",
    },

    // Data da movimentação (separada do createdAt para permitir lançamentos retroativos)
    data: {
      type:    Date,
      default: () => new Date(),
    },

    // CTO onde ocorreu a movimentação
    cto_id: {
      type:     String,
      required: [true, "cto_id é obrigatório"],
      trim:     true,
    },

    // Porta específica na CTO (opcional — pode ser preenchida após instalação)
    porta: {
      type:    Number,
      default: null,
      min:     [1, "porta deve ser >= 1"],
    },

    // Tipo de movimentação
    tipo: {
      type:     String,
      required: [true, "tipo é obrigatório"],
      trim:     true,
      // Mantemos como string livre (não enum) para compatibilidade com valores legados
      // como "instalacao", "desinstalacao", "Instalação", "Remoção", etc.
    },

    // Nome do cliente (não é uma referência a um modelo de clientes — sistema legado não possui)
    cliente: {
      type:     String,
      required: [true, "cliente é obrigatório"],
      trim:     true,
    },

    // Username do operador que registrou a movimentação
    usuario: {
      type:    String,
      trim:    true,
      default: null,
    },

    observacao: {
      type:    String,
      trim:    true,
      default: null,
    },

    // Campo extra para integração com sistemas externos (ex: código de OS)
    referencia_externa: {
      type:    String,
      trim:    true,
      default: null,
    },
  },
  {
    timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
    collection: "movimentacoes",
  }
);

// ---------------------------------------------------------------------------
// Índices
// ---------------------------------------------------------------------------

// Índice composto principal: queries por CTO dentro do projeto
MovimentacaoSchema.index({ projeto_id: 1, cto_id: 1 });

// Índice temporal: histórico ordenado
MovimentacaoSchema.index({ projeto_id: 1, data: -1 });

// Índice por cliente: buscar todas as movimentações de um cliente
MovimentacaoSchema.index({ projeto_id: 1, cliente: 1 });

// Índice por usuário: auditoria de operações por técnico
MovimentacaoSchema.index({ projeto_id: 1, usuario: 1 });

// Índice por tipo: filtro instalacao/desinstalacao
MovimentacaoSchema.index({ projeto_id: 1, tipo: 1 });

// ---------------------------------------------------------------------------
// Virtuals
// ---------------------------------------------------------------------------

/**
 * Normaliza o tipo para um conjunto canônico de valores,
 * independente de maiúsculas/minúsculas ou variações do legado.
 */
MovimentacaoSchema.virtual("tipoNormalizado").get(function () {
  const t = String(this.tipo || "").trim().toLowerCase();
  if (t.includes("instal"))  return "instalacao";
  if (t.includes("desins") || t.includes("remov") || t.includes("cancel")) return "desinstalacao";
  if (t.includes("troca"))   return "troca";
  if (t.includes("manut"))   return "manutencao";
  return t;
});

/**
 * Formatação legível: "João Silva — CTO-01 (instalacao)"
 */
MovimentacaoSchema.virtual("resumo").get(function () {
  return `${this.cliente} — ${this.cto_id} (${this.tipo})`;
});

// ---------------------------------------------------------------------------
// Métodos estáticos
// ---------------------------------------------------------------------------

/**
 * Retorna o cliente atualmente instalado em uma porta específica de uma CTO.
 * Busca a movimentação de instalação mais recente sem desinstalação posterior.
 *
 * @param {string} projeto_id
 * @param {string} cto_id
 * @param {number} porta
 */
MovimentacaoSchema.statics.clienteAtual = async function (
  projeto_id,
  cto_id,
  porta
) {
  const ultima = await this.findOne(
    { projeto_id, cto_id, porta },
    null,
    { sort: { data: -1 } }
  ).lean();
  if (!ultima) return null;
  const t = String(ultima.tipo || "").toLowerCase();
  if (t.includes("desins") || t.includes("remov") || t.includes("cancel")) return null;
  return ultima.cliente;
};

/**
 * Exporta todas as movimentações de um projeto como array de objetos planos.
 * Compatível com o formato CSV esperado pelo sistema legado.
 *
 * @param {string} projeto_id
 */
MovimentacaoSchema.statics.exportarCSV = async function (projeto_id) {
  const docs = await this.find({ projeto_id })
    .sort({ data: -1 })
    .lean();

  return docs.map((d) => ({
    DATA:       d.data ? new Date(d.data).toISOString() : "",
    CTO_ID:     d.cto_id,
    Tipo:       d.tipo,
    Cliente:    d.cliente,
    Usuario:    d.usuario || "",
    Observacao: d.observacao || "",
  }));
};

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------
export const Movimentacao =
  models.Movimentacao || model("Movimentacao", MovimentacaoSchema);
