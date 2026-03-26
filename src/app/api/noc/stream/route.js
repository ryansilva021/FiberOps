/**
 * src/app/api/noc/stream/route.js
 * Server-Sent Events endpoint that streams NOCLog entries in real time.
 * Sends the last 20 entries on connect, then polls every 2 s for new entries.
 * A heartbeat comment is sent every 15 s so proxies don't close idle connections.
 */

import { auth } from '@/lib/auth'
import { connectDB } from '@/lib/db'
import { NOCLog } from '@/models/NOCLog'

const NOC_ALLOWED = ['superadmin', 'admin', 'noc']
const POLL_MS     = 2000
const HEARTBEAT_MS = 15000

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

  let controller
  const stream = new ReadableStream({
    async start(ctrl) {
      controller = ctrl

      const encoder = new TextEncoder()

      const send = (data) => {
        try {
          ctrl.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))
        } catch {
          // client disconnected
        }
      }

      const heartbeat = () => {
        try {
          ctrl.enqueue(encoder.encode(': heartbeat\n\n'))
        } catch {
          // client disconnected
        }
      }

      // Connect to DB and load initial burst
      await connectDB()

      const initial = await NOCLog
        .find({ projeto_id })
        .sort({ ts: -1 })
        .limit(20)
        .lean()

      // Send oldest first
      initial.reverse().forEach((doc) => {
        send({
          _id:     doc._id.toString(),
          ts:      doc.ts?.toISOString() ?? new Date().toISOString(),
          tag:     doc.tag   ?? 'SYSTEM',
          message: doc.message,
          nivel:   doc.nivel ?? 'info',
        })
      })

      // Track the most recent _id seen
      let lastId = initial.length > 0
        ? initial[initial.length - 1]._id
        : null

      // Polling loop
      const pollInterval = setInterval(async () => {
        try {
          const query = lastId
            ? { projeto_id, _id: { $gt: lastId } }
            : { projeto_id }

          const newDocs = await NOCLog
            .find(query)
            .sort({ _id: 1 })
            .limit(50)
            .lean()

          for (const doc of newDocs) {
            send({
              _id:     doc._id.toString(),
              ts:      doc.ts?.toISOString() ?? new Date().toISOString(),
              tag:     doc.tag   ?? 'SYSTEM',
              message: doc.message,
              nivel:   doc.nivel ?? 'info',
            })
            lastId = doc._id
          }
        } catch {
          // DB error — continue polling
        }
      }, POLL_MS)

      // Heartbeat loop
      const hbInterval = setInterval(heartbeat, HEARTBEAT_MS)

      // Cleanup when client disconnects (stream cancelled)
      const cleanup = () => {
        clearInterval(pollInterval)
        clearInterval(hbInterval)
      }

      // Store cleanup on controller so cancel() can call it
      ctrl._cleanup = cleanup
    },

    cancel() {
      if (controller?._cleanup) controller._cleanup()
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type':  'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection':    'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  })
}
