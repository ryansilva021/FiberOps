/**
 * src/models/LoginAttempt.js
 *
 * Registro de tentativas de login para rate limiting.
 *
 * Regras replicadas do worker.js legado:
 *   - Por IP  : 5 falhas em 5 min  → bloqueio de 15 min
 *   - Por user: 10 falhas em 10 min → bloqueio de 30 min
 *
 * Documentos são expirados automaticamente pelo índice TTL do MongoDB
 * após `expiresAt`. Isso garante limpeza automática sem cron jobs.
 */

import mongoose from 'mongoose'

const { Schema, model, models } = mongoose

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

const LoginAttemptSchema = new Schema(
  {
    // "ip:<endereço>" ou "user:<username>"
    key: {
      type:     String,
      required: true,
      index:    true,
    },

    // Tipo da chave — facilita queries filtradas
    kind: {
      type:    String,
      enum:    ['ip', 'user'],
      required: true,
    },

    // Username envolvido (pode ser null em tentativas puras por IP)
    username: {
      type:    String,
      default: null,
    },

    // Momento da tentativa
    attempted_at: {
      type:    Date,
      default: () => new Date(),
    },

    // Data de expiração — o índice TTL remove o documento automaticamente
    // O valor é definido no momento da inserção conforme a janela do tipo
    expiresAt: {
      type:    Date,
      required: true,
    },
  },
  {
    collection: 'login_attempts',
    // Não precisamos de timestamps do Mongoose; usamos attempted_at explicitamente
    timestamps: false,
  }
)

// ---------------------------------------------------------------------------
// Índices
// ---------------------------------------------------------------------------

// TTL — MongoDB remove documentos automaticamente quando Date.now() > expiresAt
LoginAttemptSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 })

// Consulta principal: buscar tentativas recentes de uma chave
LoginAttemptSchema.index({ key: 1, attempted_at: 1 })

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

export const LoginAttempt = models.LoginAttempt || model('LoginAttempt', LoginAttemptSchema)
