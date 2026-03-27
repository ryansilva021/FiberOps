/**
 * src/models/PonCtoMap.js
 *
 * Maps a GPON PON port to the ordered list of CTOs it serves.
 * Used by assignCtoAutomatically() to route auto-found ONUs to the correct CTO
 * based on PON identifier and RX power (distance estimation).
 *
 * Topology context:
 *   OLT (PON 0/1/0) ──fiber──► CTO-01 ──► CTO-02 ──► CTO-03
 *   Higher RX power (e.g. -18 dBm) → closer to OLT → lower ordem
 *   Lower  RX power (e.g. -27 dBm) → farther from OLT → higher ordem
 */

import mongoose from 'mongoose'

const { Schema, model, models } = mongoose

const PonCtoMapSchema = new Schema(
  {
    // Multi-tenancy
    projeto_id: {
      type:     String,
      required: [true, 'projeto_id é obrigatório'],
      trim:     true,
    },

    // FK → OLT.id (string identifier, not ObjectId)
    olt_id: {
      type:     String,
      required: [true, 'olt_id é obrigatório'],
      trim:     true,
    },

    // PON port identifier (e.g. "0/1/0")
    pon: {
      type:     String,
      required: [true, 'pon é obrigatório'],
      trim:     true,
    },

    // Ordered list of CTOs on this PON (ascending by distance from OLT)
    ctos: [
      {
        // FK → CTO.cto_id
        cto_id: {
          type:     String,
          required: true,
          trim:     true,
        },
        // Position along the fiber (0 = closest to OLT)
        ordem: {
          type:    Number,
          default: 0,
        },
      },
    ],
  },
  {
    timestamps: true,
    collection: 'pon_cto_maps',
  }
)

// One map per (project, OLT, PON) — upsert on save
PonCtoMapSchema.index({ projeto_id: 1, olt_id: 1, pon: 1 }, { unique: true })

// Quick lookup when assigning CTOs by OLT
PonCtoMapSchema.index({ projeto_id: 1, olt_id: 1 })

export const PonCtoMap = models.PonCtoMap || model('PonCtoMap', PonCtoMapSchema)
