/**
 * src/app/api/noc/worker/route.js
 * Internal worker endpoint — processes one pending ProvisionEvent per call.
 * Called by the cron job in instrumentation.js every 5 minutes.
 * Also callable manually from the NOC dashboard or tests.
 *
 * Accepts:
 *   POST /api/noc/worker                        — auth via session (NOC roles)
 *   POST /api/noc/worker  { projeto_id, key }   — auth via NOC_WORKER_KEY secret
 */

import { auth } from '@/lib/auth'
import { processNextEvent } from '@/actions/provisioning'

const NOC_ALLOWED   = ['superadmin', 'admin', 'noc']
const WORKER_KEY    = process.env.NOC_WORKER_KEY ?? null

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request) {
  let projeto_id = null

  try {
    const body = await request.json().catch(() => ({}))

    // Path 1: internal call with worker key
    if (WORKER_KEY && body.key === WORKER_KEY && body.projeto_id) {
      projeto_id = body.projeto_id
    } else {
      // Path 2: authenticated session call
      const session = await auth()
      const role    = session?.user?.role ?? 'user'
      if (!NOC_ALLOWED.includes(role)) {
        return Response.json({ error: 'Forbidden' }, { status: 403 })
      }
      projeto_id = body.projeto_id ?? session.user.projeto_id
    }

    if (!projeto_id) {
      return Response.json({ error: 'projeto_id required' }, { status: 400 })
    }

    const result = await processNextEvent(projeto_id)
    return Response.json(result)
  } catch (err) {
    console.error('[NOC worker]', err.message)
    return Response.json({ error: err.message }, { status: 500 })
  }
}
