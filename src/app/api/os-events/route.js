/**
 * GET /api/os-events
 * Server-Sent Events stream para notificações de OS em tempo real.
 *
 * Estratégia: polling no banco a cada 3s — funciona em ambientes serverless
 * multi-instância (Vercel) onde EventEmitter in-memory não é compartilhado.
 *
 * Delivery rules:
 *   - admin / superadmin / recepcao / noc → todas as OS do projeto
 *   - tecnico → apenas OS onde tecnico_id ou auxiliar_id === username
 */

import { auth }         from '@/lib/auth'
import { connectDB }    from '@/lib/db'
import { ServiceOrder } from '@/models/ServiceOrder'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const POLL_MS = 3_000   // intervalo de polling (ms)
const HB_MS   = 25_000  // heartbeat keep-alive (ms)

export async function GET(request) {
  const session = await auth()
  if (!session?.user) {
    return new Response('Unauthorized', { status: 401 })
  }

  const { projeto_id, role, username } = session.user
  const isTecnico = role === 'tecnico'
  const encoder   = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      await connectDB()

      // Só entrega OS criadas APÓS a conexão do cliente
      let since = new Date()

      function enqueue(text) {
        try { controller.enqueue(encoder.encode(text)) }
        catch { /* controller fechado */ }
      }

      enqueue(': connected\n\n')

      // ── Polling DB ─────────────────────────────────────────────────────────
      const poll = async () => {
        try {
          const filter = { projeto_id, data_abertura: { $gt: since } }

          if (isTecnico) {
            filter.$or = [{ tecnico_id: username }, { auxiliar_id: username }]
          }

          const now   = new Date()
          const newOS = await ServiceOrder.find(filter)
            .sort({ data_abertura: 1 })
            .lean()
          since = now

          for (const os of newOS) {
            const event = {
              projeto_id,
              os_id:            os.os_id,
              cliente_nome:     os.cliente_nome,
              cliente_endereco: os.cliente_endereco ?? null,
              tipo:             os.tipo,
              status:           os.status,
              tecnico_id:       os.tecnico_id   ?? null,
              auxiliar_id:      os.auxiliar_id  ?? null,
              criado_em:        os.data_abertura?.toISOString() ?? new Date().toISOString(),
            }
            enqueue(`data: ${JSON.stringify(event)}\n\n`)
          }
        } catch {
          // erro de DB transiente — continua polling
        }
      }

      const pollTimer = setInterval(poll, POLL_MS)
      const hbTimer   = setInterval(() => enqueue(': ping\n\n'), HB_MS)

      request.signal.addEventListener('abort', () => {
        clearInterval(pollTimer)
        clearInterval(hbTimer)
        try { controller.close() } catch {}
      })
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
