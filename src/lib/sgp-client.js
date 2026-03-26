/**
 * src/lib/sgp-client.js
 * TMSX/SGP HTTP client for subscriber synchronization.
 *
 * Falls back to mock data when:
 *   - host === 'mock'
 *   - Network request fails
 *   - Authentication returns mock token
 */

const REQUEST_TIMEOUT_MS = 10_000

/**
 * Returns mock subscriber data for development/testing.
 * @returns {Array<{ id: string, nome: string, serial: string, status: string }>}
 */
function getMockClientes() {
  return [
    { id: 'C001', nome: 'João Silva',   serial: 'HWTC1A2B3C4D', status: 'ativo'      },
    { id: 'C002', nome: 'Maria Santos', serial: 'HWTC5E6F7G8H', status: 'ativo'      },
    { id: 'C003', nome: 'Pedro Costa',  serial: 'HWTC9I0J1K2L', status: 'cancelado'  },
  ]
}

/**
 * Authenticates against the TMSX/SGP API and returns a bearer token.
 * Returns 'mock-token' when host is 'mock' or when the request fails.
 *
 * @param {string} host - Base URL of the SGP instance (e.g. https://sgp.isp.com.br)
 * @param {string} username
 * @param {string} password - Plaintext password (decrypted before calling)
 * @returns {Promise<string>} Bearer token or 'mock-token'
 */
export async function authenticate(host, username, password) {
  if (!host || host === 'mock') {
    return 'mock-token'
  }

  try {
    const controller = new AbortController()
    const timeoutId  = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

    const res = await fetch(`${host}/api/auth/login`, {
      method:  'POST',
      signal:  controller.signal,
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ username, password }),
    })

    clearTimeout(timeoutId)

    if (!res.ok) {
      console.warn(`[SGP] Auth failed: HTTP ${res.status}`)
      return 'mock-token'
    }

    const data = await res.json()
    const token = data?.token || data?.access_token || data?.data?.token

    if (!token) {
      console.warn('[SGP] Auth response did not contain a token, using mock')
      return 'mock-token'
    }

    return token
  } catch (err) {
    console.warn('[SGP] Auth request failed, using mock mode:', err.message)
    return 'mock-token'
  }
}

/**
 * Fetches the subscriber list from the SGP API.
 * Returns mock data when token is 'mock-token'.
 *
 * @param {string} host - Base URL of the SGP instance
 * @param {string} token - Bearer token from authenticate()
 * @returns {Promise<Array<{ id: string, nome: string, serial: string, status: string }>>}
 */
export async function getClientes(host, token) {
  if (token === 'mock-token') {
    return getMockClientes()
  }

  try {
    const controller = new AbortController()
    const timeoutId  = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

    const res = await fetch(`${host}/api/clientes`, {
      signal:  controller.signal,
      headers: {
        Authorization: `Bearer ${token}`,
        Accept:        'application/json',
      },
    })

    clearTimeout(timeoutId)

    if (!res.ok) {
      console.warn(`[SGP] getClientes failed: HTTP ${res.status}, falling back to mock`)
      return getMockClientes()
    }

    const data = await res.json()
    // Support both { data: [] } and plain [] responses
    const raw = Array.isArray(data) ? data : (data?.data ?? data?.clientes ?? [])

    // Normalize to consistent shape
    return raw.map((c) => ({
      id:     String(c.id     ?? c.cliente_id  ?? ''),
      nome:   String(c.nome   ?? c.name        ?? c.razao_social ?? ''),
      serial: String(c.serial ?? c.serial_onu  ?? c.onu_serial   ?? ''),
      status: String(c.status ?? c.situacao    ?? 'ativo').toLowerCase(),
    }))
  } catch (err) {
    console.warn('[SGP] getClientes request failed, falling back to mock:', err.message)
    return getMockClientes()
  }
}
