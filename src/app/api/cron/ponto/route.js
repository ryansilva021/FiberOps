/**
 * GET /api/cron/ponto
 * Envia push de lembrete de ponto para todos os usuários do projeto.
 *
 * Pode ser acionado por:
 *   1. Vercel Cron (vercel.json) — até 2 horários/dia no plano Hobby
 *   2. cron-job.org (recomendado) — grátis, suporta disparo a cada minuto
 *      → Configurar em https://cron-job.org apontando para /api/cron/ponto
 *      → Adicionar header Authorization: Bearer <CRON_SECRET>
 *
 * Timezone: compara no horário de Brasília (UTC-3).
 * Se o projeto tiver fuso diferente, adicionar campo tz no TimeSettings.
 */

import { NextResponse }     from 'next/server'
import { connectDB }        from '@/lib/db'
import { TimeSettings }     from '@/models/TimeSettings'
import { PushSubscription } from '@/models/PushSubscription'
import { sendPushToUser }   from '@/lib/webpush'

export const runtime = 'nodejs'

const ALERTS = [
  { field: 'entrada',       alertToggle: 'alerta_entrada',       msg: '⏰ Hora de iniciar sua jornada!' },
  { field: 'almoco_inicio', alertToggle: 'alerta_almoco_inicio',  msg: '🍽 Hora de ir para o almoço!' },
  { field: 'almoco_fim',    alertToggle: 'alerta_almoco_fim',     msg: '▶ Hora de retornar do almoço!' },
  { field: 'saida',         alertToggle: 'alerta_saida',          msg: '🔴 Hora de encerrar seu expediente!' },
]

// Offset padrão Brasília (UTC-3). Ajuste se precisar suportar outros fusos.
const TZ_OFFSET_HOURS = -3

export async function GET(req) {
  const secret = process.env.CRON_SECRET
  if (secret) {
    const auth = req.headers.get('authorization')
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  await connectDB()

  // Hora atual no fuso de Brasília
  const utcNow  = new Date()
  const brtNow  = new Date(utcNow.getTime() + TZ_OFFSET_HOURS * 60 * 60 * 1000)
  const padded  = `${String(brtNow.getUTCHours()).padStart(2, '0')}:${String(brtNow.getUTCMinutes()).padStart(2, '0')}`

  const allSettings = await TimeSettings.find({}).lean()
  const sent = []

  for (const settings of allSettings) {
    for (const alert of ALERTS) {
      if (!settings[alert.alertToggle]) continue
      if (settings[alert.field] !== padded) continue

      // Busca todos os usernames com push subscription no projeto
      const usernames = await PushSubscription
        .find({ projeto_id: settings.projeto_id })
        .distinct('username')

      if (!usernames.length) continue

      await Promise.allSettled(
        usernames.map(u =>
          sendPushToUser(u, {
            title: 'Lembrete de Ponto · FiberOps',
            body:  alert.msg,
            url:   '/ponto',
            tag:   'fiberops-ponto',
          })
        )
      )

      sent.push({ projeto_id: settings.projeto_id, alert: alert.field, users: usernames.length, time: padded })
    }
  }

  return NextResponse.json({ ok: true, brt_time: padded, utc_time: utcNow.toISOString(), sent })
}
