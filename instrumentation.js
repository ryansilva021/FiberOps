/**
 * instrumentation.js
 * Next.js startup hook (Next.js 15+).
 * Registers a cron job that runs the SGP sync and ONU provisioning queue
 * every 5 minutes for all active projects.
 *
 * Runs ONLY in the Node.js runtime (not in edge/browser).
 */

export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return

  // Dynamically import to avoid bundling issues with edge runtime
  const [{ default: cron }, { connectDB }, { SGPConfig }] = await Promise.all([
    import('node-cron'),
    import('@/lib/db'),
    import('@/models/SGPConfig'),
  ])

  // ── SGP auto-sync every 5 minutes ──────────────────────────────────────────
  cron.schedule('*/5 * * * *', async () => {
    try {
      await connectDB()

      // Find all active, non-syncing SGP configurations
      const configs = await SGPConfig
        .find({ is_active: true, is_syncing: false })
        .select('projeto_id')
        .lean()

      if (configs.length === 0) return

      // Lazy-import to avoid circular dep issues at startup
      const { syncSGP: _syncSGP } = await import('@/lib/sgp-sync')

      for (const cfg of configs) {
        try {
          await _syncSGP(cfg.projeto_id)
        } catch (err) {
          console.error(`[cron] sgp-sync failed for ${cfg.projeto_id}:`, err.message)
        }
      }
    } catch (err) {
      console.error('[cron] sgp auto-sync error:', err.message)
    }
  })

  // ── Provision queue drain every 5 minutes ──────────────────────────────────
  // Runs after the SGP sync, processes up to 20 pending events per project
  cron.schedule('*/5 * * * *', async () => {
    try {
      await connectDB()

      const { ProvisionEvent } = await import('@/models/ProvisionEvent')
      const { processNextEvent } = await import('@/actions/provisioning')

      // Get distinct projects that have pending events
      const pending = await ProvisionEvent
        .distinct('projeto_id', { status: 'pending' })

      for (const pid of pending) {
        let count = 0
        while (count < 20) {
          const result = await processNextEvent(pid)
          if (!result.processed) break
          count++
        }
      }
    } catch (err) {
      console.error('[cron] provision-queue error:', err.message)
    }
  })

  // ── Auto-Find every 1 minute ────────────────────────────────────────────────
  // Scans all active OLTs for unconfigured ONUs and logs findings.
  // Auto-provisioning is NOT done automatically — user reviews in NOC panel.
  cron.schedule('* * * * *', async () => {
    try {
      await connectDB()

      const { OLT } = await import('@/models/OLT')
      const { ONU } = await import('@/models/ONU')
      const { HuaweiOltAdapter } = await import('@/lib/huawei-adapter')
      const { nocLog } = await import('@/lib/noc-logger')

      // Only run if there are active OLTs
      const projects = await OLT.distinct('projeto_id', { status: { $ne: 'inativo' } })

      for (const pid of projects) {
        const olts = await OLT.find({ projeto_id: pid, status: { $ne: 'inativo' } }).lean()

        for (const olt of olts) {
          const adapter = new HuaweiOltAdapter({
            ip:       olt.ip ?? 'mock',
            ssh_user: olt.ssh_user ?? 'admin',
            ssh_pass: olt.ssh_pass ?? '',
          })
          try {
            await adapter.connect()
            const detected = await adapter.getUnconfiguredOnus()
            await adapter.disconnect()

            const serials = detected.map(d => d.serial)
            if (serials.length === 0) continue

            const existing = new Set(
              (await ONU.find({ projeto_id: pid, serial: { $in: serials } }, 'serial').lean())
                .map(o => o.serial)
            )
            const novos = detected.filter(d => !existing.has(d.serial))

            if (novos.length > 0) {
              for (const d of novos) {
                await nocLog(pid, 'AUTO-FIND', `ONU detectada: ${d.serial} (PON ${d.pon}) — aguardando provisionamento`, 'info')
              }
            }
          } catch (err) {
            try { await adapter.disconnect() } catch {}
          }
        }
      }
    } catch (err) {
      console.error('[cron] auto-find error:', err.message)
    }
  })

  console.log('[NOC] Cron jobs registered (SGP sync + provision queue every 5 min, Auto-Find every 1 min)')
}
