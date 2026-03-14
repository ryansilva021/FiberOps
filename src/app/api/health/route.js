/**
 * src/app/api/health/route.js
 * Health check endpoint — verifica se a aplicação e o banco estão operacionais.
 *
 * GET /api/health
 *   Resposta 200: { status: 'ok', db: 'connected', timestamp: '...' }
 *   Resposta 503: { status: 'degraded', db: 'disconnected', timestamp: '...' }
 *
 * Sem autenticação — consumido por load balancers e ferramentas de monitoramento.
 */

import { NextResponse } from 'next/server'
import mongoose from 'mongoose'
import { connectDB } from '@/lib/db'

/**
 * Tenta conectar ao MongoDB e retorna o readyState resultante.
 * readyState 1 = connected (mongoose.ConnectionStates.connected)
 *
 * @returns {Promise<number>}
 */
async function getDbState() {
  try {
    await connectDB()
  } catch {
    // Falha na conexão — retorna o estado atual (provavelmente 0 = disconnected)
  }
  return mongoose.connection.readyState
}

export async function GET() {
  const timestamp = new Date().toISOString()

  const readyState = await getDbState()
  const isConnected = readyState === 1

  const body = {
    status:    isConnected ? 'ok' : 'degraded',
    db:        isConnected ? 'connected' : 'disconnected',
    timestamp,
  }

  return NextResponse.json(body, {
    status: isConnected ? 200 : 503,
    headers: {
      // Sem cache: monitoramento precisa de dados em tempo real
      'Cache-Control': 'no-store',
    },
  })
}
