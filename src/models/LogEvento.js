/**
 * LogEvento.js
 * Trilha de auditoria de todas as ações relevantes do sistema.
 * Equivalente à tabela SQL: log_eventos (criada via safeLog no worker.js)
 *
 * Campos SQL originais (via INSERT na função safeLog):
 *   ts TEXT, user TEXT, role TEXT, action TEXT,
 *   entity TEXT, entity_id TEXT, details TEXT
 *
 * Ações rastreadas (exemplos do worker.js):
 *   UPSERT_POSTE, DELETE_POSTE, LIMPAR_PROJETO,
 *   UPSERT_CTO, DELETE_CTO, UPSERT_CDO, DELETE_CDO,
 *   UPSERT_ROTA, DELETE_ROTA, ADD_MOVIMENTACAO, REMOVE_CLIENTE
 *
 * Política de retenção:
 *   - Logs operacionais: 90 dias (TTL index)
 *   - Logs de segurança (LOGIN, LOGOUT, LOGIN_FAIL): 365 dias
 *   Configure o TTL conforme sua política via expireAt ou MongoDB TTL index.
 */

import mongoose from "mongoose";

const { Schema, model, models } = mongoose;

const LogEventoSchema = new Schema(
  {
    // Multi-tenancy: a maioria dos logs pertence a um projeto
    // (pode ser null para eventos do sistema, como criação de projeto)
    projeto_id: {
      type:    String,
      trim:    true,
      default: null,
    },

    // Timestamp preciso do evento (mapeado para campo "ts" do SQL)
    ts: {
      type:    Date,
      default: () => new Date(),
      required: true,
    },

    // Username do operador
    user: {
      type:    String,
      trim:    true,
      default: null,
    },

    // Role do operador no momento da ação
    role: {
      type:    String,
      enum:    ["superadmin", "admin", "tecnico", "noc", "user", null],
      default: null,
    },

    // Ação realizada (ex: "UPSERT_CTO", "DELETE_ROTA", "LOGIN", "LIMPAR_PROJETO")
    action: {
      type:     String,
      required: [true, "action é obrigatório"],
      trim:     true,
      uppercase: true,
    },

    // Entidade afetada (ex: "CTO", "ROTA", "POSTE", "CDO", "PROJETO")
    entity: {
      type:    String,
      trim:    true,
      uppercase: true,
      default: null,
    },

    // ID do registro afetado na entidade
    entity_id: {
      type:    String,
      trim:    true,
      default: null,
    },

    // Detalhes adicionais em JSON (antes armazenado como TEXT no SQL)
    // Ex: { lat: -19.91, lng: -43.93, tipo: "simples" }
    details: {
      type:    Schema.Types.Mixed,
      default: null,
    },

    // Campo para TTL automático (MongoDB expira o documento nessa data)
    // Defina no application layer antes de salvar:
    //   logEvento.expireAt = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);
    expireAt: {
      type:    Date,
      default: null,
    },

    // Classificação de severidade
    nivel: {
      type:    String,
      enum:    ["info", "warn", "error", "security"],
      default: "info",
    },

    // IP do cliente (útil para auditoria de segurança)
    ip: {
      type:    String,
      trim:    true,
      default: null,
    },
  },
  {
    // Usa apenas createdAt — updatedAt não faz sentido para logs imutáveis
    timestamps: { createdAt: "created_at" },
    collection: "log_eventos",
  }
);

// ---------------------------------------------------------------------------
// Índices
// ---------------------------------------------------------------------------

// TTL index: MongoDB remove automaticamente documentos quando expireAt < agora
// IMPORTANTE: precisa criar este índice no MongoDB separadamente ou via migration:
//   db.log_eventos.createIndex({ expireAt: 1 }, { expireAfterSeconds: 0 })
LogEventoSchema.index({ expireAt: 1 }, { expireAfterSeconds: 0, sparse: true });

// Query principal: logs do projeto por data
LogEventoSchema.index({ projeto_id: 1, ts: -1 });

// Query por usuário
LogEventoSchema.index({ projeto_id: 1, user: 1, ts: -1 });

// Query por entidade afetada
LogEventoSchema.index({ projeto_id: 1, entity: 1, entity_id: 1 });

// Query por tipo de ação
LogEventoSchema.index({ projeto_id: 1, action: 1, ts: -1 });

// Índice para painel de segurança (logs sem projeto_id, ex: criação de projetos)
LogEventoSchema.index({ nivel: 1, ts: -1 });

// ---------------------------------------------------------------------------
// Métodos estáticos
// ---------------------------------------------------------------------------

/**
 * Registra um evento de forma silenciosa (nunca lança exceção).
 * Equivale à função safeLog() do worker.js.
 *
 * @param {object} entry
 * @param {string}      entry.projeto_id
 * @param {string}      entry.user
 * @param {string}      entry.role
 * @param {string}      entry.action
 * @param {string}      [entry.entity]
 * @param {string}      [entry.entity_id]
 * @param {object|string} [entry.details]
 * @param {string}      [entry.ip]
 * @param {"info"|"warn"|"error"|"security"} [entry.nivel]
 * @param {number}      [entry.retencaoDias] - dias de retenção (padrão: 90)
 */
LogEventoSchema.statics.registrar = async function (entry) {
  try {
    const retencaoDias = entry.retencaoDias ?? 90;
    const expireAt = new Date(Date.now() + retencaoDias * 24 * 60 * 60 * 1000);

    // Serializa details se for objeto
    const details =
      entry.details && typeof entry.details === "object"
        ? entry.details
        : entry.details
        ? String(entry.details)
        : null;

    await this.create({
      projeto_id: entry.projeto_id ?? null,
      ts:         new Date(),
      user:       entry.user    ?? null,
      role:       entry.role    ?? null,
      action:     String(entry.action || "").toUpperCase(),
      entity:     entry.entity    ? String(entry.entity).toUpperCase() : null,
      entity_id:  entry.entity_id ?? null,
      details,
      nivel:      entry.nivel ?? "info",
      ip:         entry.ip    ?? null,
      expireAt,
    });
  } catch (_) {
    // Silencioso — log nunca deve quebrar o fluxo principal
  }
};

/**
 * Retorna os últimos N eventos de um projeto.
 *
 * @param {string} projeto_id
 * @param {number} [limit=100]
 */
LogEventoSchema.statics.recentes = function (projeto_id, limit = 100) {
  return this.find({ projeto_id })
    .sort({ ts: -1 })
    .limit(limit)
    .lean();
};

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------
export const LogEvento = models.LogEvento || model("LogEvento", LogEventoSchema);
