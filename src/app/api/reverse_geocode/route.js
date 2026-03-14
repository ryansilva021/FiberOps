/**
 * src/app/api/reverse_geocode/route.js
 * Proxy para geocodificação reversa via Nominatim (OpenStreetMap).
 *
 * GET /api/reverse_geocode?lat={lat}&lon={lon}
 *   200 — JSON do Nominatim com Cache-Control de 1 hora
 *   400 — lat ou lon ausentes / não numéricos
 *   502 — falha ao comunicar com o Nominatim
 *
 * Nominatim exige User-Agent identificando a aplicação.
 * Política de uso: https://operations.osmfoundation.org/policies/nominatim/
 */

import { NextResponse } from 'next/server'

const NOMINATIM_BASE = 'https://nominatim.openstreetmap.org/reverse'
const USER_AGENT     = 'FiberOps FTTH App/1.0'

/**
 * Valida que um valor de string pode ser convertido em número finito
 * dentro dos limites geográficos esperados.
 *
 * @param {string|null} value
 * @param {number} min
 * @param {number} max
 * @returns {number|null}
 */
function parseCoord(value, min, max) {
  if (value == null || value === '') return null
  const num = Number(value)
  if (!Number.isFinite(num) || num < min || num > max) return null
  return num
}

export async function GET(request) {
  const { searchParams } = new URL(request.url)

  const latRaw = searchParams.get('lat')
  const lonRaw = searchParams.get('lon')

  const lat = parseCoord(latRaw, -90,  90)
  const lon = parseCoord(lonRaw, -180, 180)

  if (lat === null || lon === null) {
    return NextResponse.json(
      { error: 'Parâmetros inválidos. Forneça lat e lon como números válidos.' },
      { status: 400 }
    )
  }

  const url = `${NOMINATIM_BASE}?format=json&lat=${lat}&lon=${lon}`

  let nominatimRes
  try {
    nominatimRes = await fetch(url, {
      headers: {
        'User-Agent': USER_AGENT,
        'Accept-Language': 'pt-BR,pt;q=0.9',
      },
      // Garante que o Next.js não reutilize cache antigo do fetch interno
      cache: 'no-store',
    })
  } catch (err) {
    console.error('[reverse_geocode] Erro ao contactar Nominatim:', err)
    return NextResponse.json(
      { error: 'Falha ao conectar com o serviço de geocodificação.' },
      { status: 502 }
    )
  }

  if (!nominatimRes.ok) {
    console.error('[reverse_geocode] Nominatim retornou status:', nominatimRes.status)
    return NextResponse.json(
      { error: `Serviço de geocodificação indisponível (${nominatimRes.status}).` },
      { status: 502 }
    )
  }

  let data
  try {
    data = await nominatimRes.json()
  } catch (err) {
    console.error('[reverse_geocode] Resposta inválida do Nominatim:', err)
    return NextResponse.json(
      { error: 'Resposta inválida do serviço de geocodificação.' },
      { status: 502 }
    )
  }

  return NextResponse.json(data, {
    status: 200,
    headers: {
      // Coordenadas raramente mudam de endereço — 1 hora é seguro
      'Cache-Control': 'public, max-age=3600',
    },
  })
}
