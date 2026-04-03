/**
 * src/app/api/noc/stream/route.js
 * Server-Sent Events endpoint that streams NOCLog entries in real time.
 *
 * Sends the last 20 entries on connect, then uses a MongoDB Change Stream
 * to push new inserts instantly — zero polling, sub-second latency.
 *
 * Requires a MongoDB replica set or Atlas (Change Streams prerequisite).
 * A heartbeat comment is sent every 30 s so proxies don't close idle connections.
 */

import { auth } from '@/lib/auth'
import { connectDB } from '@/lib/db'
import { NOCLog } from '@/models/NOCLog'

const NOC_ALLOWED   = ['superadmin', 'admin', 'noc']
const HEARTBEAT_MS  = 30_000

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  // Auth check
  const session = await auth()
  const role    = session?.user?.role ?? 'user'
  if (!NOC_ALLOWED.includes(role)) {
    return new Response('Forbidden', { status: 403 })
  }
  const projeto_id = session.user.projeto_id

  await connectDB()

  // ── Initial burst: last 20 entries ─────────────────────────────────────────
  const initial = await NOCLog
    .find({ projeto_id })
    .sort({ ts: -1 })
    .limit(20)
    .lean()
  initial.reverse()

  // ── Change Stream: watch only inserts for this project ─────────────────────
  const pipeline = [
    {
      $match: {
        operationType: 'insert',
        'fullDocument.projeto_id': projeto_id,
      },
    },
  ]
  const changeStream = NOCLog.watch(pipeline, { fullDocument: 'required' })

  // ── SSE stream ─────────────────────────────────────────────────────────────
  const encoder = new TextEncoder()
  let hbTimer

  const stream = new ReadableStream({
    start(ctrl) {
      const send = (data) => {
        try {
          ctrl.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))
        } catch {
          // client disconnected — cancel() will clean up
        }
      }

      // Send initial burst (oldest → newest)
      for (const doc of initial) {
        send({
          _id:     doc._id.toString(),
          ts:      doc.ts?.toISOString() ?? new Date().toISOString(),
          tag:     doc.tag   ?? 'SYSTEM',
          message: doc.message,
          nivel:   doc.nivel ?? 'info',
        })
      }

      // Push new inserts in real time
      changeStream.on('change', (event) => {
        const doc = event.fullDocument
        send({
          _id:     doc._id.toString(),
          ts:      doc.ts?.toISOString() ?? new Date().toISOString(),
          tag:     doc.tag   ?? 'SYSTEM',
          message: doc.message,
          nivel:   doc.nivel ?? 'info',
        })
      })

      changeStream.on('error', (err) => {
        console.error('[SSE] change stream error:', err.message)
        // Stream will be closed by the client reconnecting via EventSource
        try { ctrl.close() } catch {}
      })

      // Heartbeat — prevents proxy / load-balancer timeouts on idle connections
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
      changeStream.close().catch(() => {})
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
