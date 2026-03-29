/**
 * instrumentation.js
 * Next.js startup hook (Next.js 15+).
 * Registers cron jobs for SGP sync, ONU provisioning queue, and Auto-Find.
 *
 * Each job has an overlap guard: if the previous execution is still running,
 * the new tick is skipped to prevent event-loop saturation and node-cron
 * "missed execution" warnings.
 *
 * Runs ONLY in the Node.js runtime (not in edge/browser).
 */

export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return

  const [{ default: cron }, { connectDB }, { SGPConfig }] = await Promise.all([
    import('node-cron'),
    import('@/lib/db'),
    import('@/models/SGPConfig'),
  ])

  // ── SGP auto-sync every 5 minutes ──────────────────────────────────────────
  let syncRunning = false
  cron.schedule('*/5 * * * *', async () => {
    if (syncRunning) return
    syncRunning = true
    try {
      await connectDB()

      const configs = await SGPConfig
        .find({ is_active: true, is_syncing: false })
        .select('projeto_id')
        .lean()

      if (configs.length === 0) return

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
    } finally {
      syncRunning = false
    }
  })

  // ── Provision queue drain every 5 minutes ──────────────────────────────────
  let provisionRunning = false
  cron.schedule('*/5 * * * *', async () => {
    if (provisionRunning) return
    provisionRunning = true
    try {
      await connectDB()

      const { ProvisionEvent } = await import('@/models/ProvisionEvent')
      const { processNextEvent } = await import('@/actions/provisioning')

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
    } finally {
      provisionRunning = false
    }
  })

  // ── Auto-Find every 1 minute ────────────────────────────────────────────────
  // Scans all active OLTs for unconfigured ONUs and logs findings.
  // SSH connections are wrapped in a 30s timeout to prevent hanging.
  const SSH_TIMEOUT_MS = 30_000

  let autoFindRunning = false
  cron.schedule('* * * * *', async () => {
    if (autoFindRunning) return
    autoFindRunning = true
    try {
      await connectDB()

      const { OLT } = await import('@/models/OLT')
      const { ONU } = await import('@/models/ONU')
      const { HuaweiOltAdapter } = await import('@/lib/huawei-adapter')
      const { nocLog } = await import('@/lib/noc-logger')

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
            // Wrap SSH work in a timeout so a slow OLT can't block the job
            await Promise.race([
              (async () => {
                await adapter.connect()
                const detected = await adapter.getUnconfiguredOnus()
                await adapter.disconnect()

                const serials = detected.map(d => d.serial)
                if (serials.length === 0) return

                const existing = new Set(
                  (await ONU.find({ projeto_id: pid, serial: { $in: serials } }, 'serial').lean())
                    .map(o => o.serial)
                )
                const novos = detected.filter(d => !existing.has(d.serial))

                for (const d of novos) {
                  await nocLog(pid, 'AUTO-FIND', `ONU detectada: ${d.serial} (PON ${d.pon}) — aguardando provisionamento`, 'info')
                }
              })(),
              new Promise((_, reject) =>
                setTimeout(() => reject(new Error('SSH timeout')), SSH_TIMEOUT_MS)
              ),
            ])
          } catch (err) {
            try { await adapter.disconnect() } catch {}
            if (err.message !== 'SSH timeout') {
              console.error(`[cron] auto-find OLT ${olt.ip}:`, err.message)
            }
          }
        }
      }
    } catch (err) {
      console.error('[cron] auto-find error:', err.message)
    } finally {
      autoFindRunning = false
    }
  })

  console.log('[NOC] Cron jobs registered (SGP sync + provision queue every 5 min, Auto-Find every 1 min)')
}
