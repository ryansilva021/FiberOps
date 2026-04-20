'use client'
/**
 * nativeNotif.js
 * Exibe notificação nativa via Service Worker.
 *
 * REGRA: se SW está registrado, usa EXCLUSIVAMENTE reg.showNotification().
 * NUNCA faz fallback para new Notification() quando SW existe — isso causaria
 * duplicação com o push do backend que também dispara via SW.
 *
 * Fallback para new Notification() SOMENTE quando SW genuinamente indisponível.
 */

let _swReg = null

async function getSwReg() {
  if (_swReg) return _swReg
  if (!('serviceWorker' in navigator)) return null
  try {
    _swReg = await Promise.race([
      navigator.serviceWorker.ready,
      new Promise((_, rej) => setTimeout(() => rej(new Error('sw_timeout')), 3000)),
    ])
    return _swReg
  } catch (_) {
    return null
  }
}

/**
 * Exibe notificação nativa.
 * Quando SW existe, NUNCA usa new Notification() como fallback.
 *
 * @param {{ title: string, body: string, tag?: string, url?: string, icon?: string }} opts
 */
export async function showNativeNotif({ title, body, tag, url, icon } = {}) {
  if (typeof window === 'undefined') return
  if (!('Notification' in window)) return
  if (Notification.permission !== 'granted') return

  const options = {
    body:     body    ?? '',
    icon:     icon    ?? '/short-logo.svg',
    badge:    '/short-logo.svg',
    tag:      tag     ?? 'fiberops',
    renotify: true,
    vibrate:  [150, 75, 150],
    data:     { url: url ?? '/' },
  }

  const reg = await getSwReg()

  if (reg) {
    // SW disponível: usa APENAS reg.showNotification().
    // Mesmo se falhar, NÃO cai para new Notification() — evita notificação azul
    // padrão do browser em paralelo com o push do backend.
    try { await reg.showNotification(title ?? 'FiberOps', options) } catch (_) {}
    return  // ← return incondicional quando SW existe
  }

  // SW indisponível: fallback para Notification API (só funciona em foreground)
  try { new Notification(title ?? 'FiberOps', options) } catch (_) {}
}

/**
 * Solicita permissão de notificação.
 */
export async function requestNotifPermission() {
  if (typeof window === 'undefined') return 'unavailable'
  if (!('Notification' in window)) return 'unavailable'
  if (Notification.permission === 'granted') return 'granted'
  if (Notification.permission === 'denied')  return 'denied'
  const result = await Notification.requestPermission()
  return result
}
