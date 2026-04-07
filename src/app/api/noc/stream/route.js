/**
 * src/app/api/noc/stream/route.js
 * Server-Sent Events — streaming de NOCLog em tempo real.
 *
 * Modo preferido: MongoDB Change Stream (Atlas / replica set) — zero polling.
 * Fallback automático: polling a cada 3 s quando Change Streams indisponível
 * (standalone MongoDB sem replica set, ex: ambiente de desenvolvimento local).
 */

import { auth }     from '@/lib/auth'
import { connectDB } from '@/lib/db'
import { NOCLog }   from '@/models/NOCLog'

const NOC_ALLOWED  = ['superadmin', 'admin', 'noc']
const HEARTBEAT_MS = 30_000
const POLL_MS      = 3_000   // intervalo de polling no fallback

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function docToEvent(doc) {
  return {
    _id:     doc._id.toString(),
    ts:      doc.ts?.toISOString() ?? new Date().toISOString(),
    tag:     doc.tag    ?? 'SYSTEM',
    message: doc.message,
    nivel:   doc.nivel  ?? 'info',
  }
}

export async function GET() {
  const session = await auth()
  const role    = session?.user?.role ?? 'user'
  if (!NOC_ALLOWED.includes(role)) {
    return new Response('Forbidden', { status: 403 })
  }
  const projeto_id = session.user.projeto_id

  await connectDB()

  // ── Initial burst: últimos 20 entries ──────────────────────────────────────
  const initial = await NOCLog
    .find({ projeto_id })
    .sort({ ts: -1 })
    .limit(20)
    .lean()
  initial.reverse()

  // ── Testa se Change Streams estão disponíveis ──────────────────────────────
  let useChangeStream = false
  let changeStream    = null

  try {
    const pipeline = [{
      $match: {
        operationType:              'insert',
        'fullDocument.projeto_id': projeto_id,
      },
    }]
    changeStream    = NOCLog.watch(pipeline, { fullDocument: 'required' })
    useChangeStream = true
  } catch {
    // Standalone MongoDB — vai usar polling
  }

  // ── SSE stream ─────────────────────────────────────────────────────────────
  const encoder = new TextEncoder()
  let hbTimer
  let pollTimer
  let lastTs = initial.length > 0
    ? new Date(initial[initial.length - 1].ts ?? Date.now())
    : new Date()

  const stream = new ReadableStream({
    start(ctrl) {
      const send = (data) => {
        try {
          ctrl.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))
        } catch { /* client disconnected */ }
      }

      // Enviar burst inicial
      for (const doc of initial) send(docToEvent(doc))

      if (useChangeStream && changeStream) {
        // ── Modo Change Stream ───────────────────────────────────────────────
        changeStream.on('change', (event) => {
          const doc = event.fullDocument
          send(docToEvent(doc))
        })

        changeStream.on('error', (err) => {
          console.error('[SSE] change stream error:', err.message)
          try { ctrl.close() } catch {}
        })
      } else {
        // ── Modo Polling (fallback para standalone MongoDB) ──────────────────
        pollTimer = setInterval(async () => {
          try {
            const newDocs = await NOCLog
              .find({ projeto_id, ts: { $gt: lastTs } })
              .sort({ ts: 1 })
              .limit(20)
              .lean()

            for (const doc of newDocs) {
              send(docToEvent(doc))
              lastTs = new Date(doc.ts ?? Date.now())
            }
          } catch { /* silent */ }
        }, POLL_MS)
      }

      // Heartbeat — evita timeout de proxy em conexões ociosas
      hbTimer = setInterval(() => {
        try {
          ctrl.enqueue(encoder.encode(': heartbeat\n\n'))
        } catch {
          clearInterval(hbTimer)
        }
      }, HEARTBEAT_MS)
    },

    cancel() {
      clearInterval(hbTimer)
      clearInterval(pollTimer)
      if (changeStream) changeStream.close().catch(() => {})
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type':      'text/event-stream',
      'Cache-Control':     'no-cache, no-transform',
      'Connection':        'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  })
}
