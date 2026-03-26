/**
 * src/models/ONU.js
 * Tracks provisioned ONUs (Optical Network Units) across the FTTH network.
 * Each ONU corresponds to a subscriber's CPE device connected to a CTO port.
 */

import mongoose from 'mongoose'

const { Schema, model, models } = mongoose

const ONUSchema = new Schema(
  {
    // Multi-tenancy
    projeto_id: {
      type:     String,
      required: [true, 'projeto_id é obrigatório'],
      trim:     true,
    },

    // ONU serial number (e.g. HWTC1A2B3C4D)
    serial: {
      type:     String,
      required: [true, 'serial é obrigatório'],
      trim:     true,
      uppercase: true,
    },

    // MAC address (optional, auto-discovered or null)
    mac: {
      type:    String,
      trim:    true,
      default: null,
    },

    // Provisioning lifecycle status
    status: {
      type:    String,
      enum:    ['provisioning', 'active', 'offline', 'cancelled', 'error'],
      default: 'provisioning',
    },

    // Reference to OLT.id (string, not ObjectId)
    olt_id: {
      type:    String,
      default: null,
    },

    // PON port number on the OLT
    pon_port: {
      type:    Number,
      default: null,
    },

    // Reference to CTO.cto_id
    cto_id: {
      type:    String,
      default: null,
    },

    // Port number within the CTO splitter
    cto_port: {
      type:    Number,
      default: null,
    },

    // Client name or identifier (synced from SGP)
    cliente: {
      type:    String,
      trim:    true,
      default: null,
    },

    // Free-form observations
    obs: {
      type:    String,
      trim:    true,
      default: null,
    },

    // When the ONU was successfully provisioned on the OLT
    provisioned_at: {
      type:    Date,
      default: null,
    },

    // When the ONU was cancelled/deprovisioned
    cancelled_at: {
      type:    Date,
      default: null,
    },

    // Optical power readings (from Huawei OLT after provisioning)
    rx_power: {
      type:    Number,
      default: null,
    },

    tx_power: {
      type:    Number,
      default: null,
    },

    // Signal quality derived from rx_power
    signal_quality: {
      type:    String,
      enum:    ['excelente', 'bom', 'medio', 'critico'],
      default: null,
    },
  },
  {
    timestamps: true,
    collection: 'onus',
  }
)

// Unique ONU per project (no duplicate serials within a tenant)
ONUSchema.index({ projeto_id: 1, serial: 1 }, { unique: true })

// CTO occupancy queries
ONUSchema.index({ projeto_id: 1, cto_id: 1 })

// Status filtering for the NOC dashboard
ONUSchema.index({ projeto_id: 1, status: 1 })

export const ONU = models.ONU || model('ONU', ONUSchema)
