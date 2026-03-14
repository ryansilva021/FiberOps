'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

const STORAGE_KEY = 'ftth_queue'

/**
 * Lê a fila do localStorage de forma segura.
 * @returns {Array}
 */
function readQueue() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch (_) {
    return []
  }
}

/**
 * Persiste a fila no localStorage de forma segura.
 * @param {Array} queue
 */
function writeQueue(queue) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(queue))
  } catch (_) {
    // Quota excedida ou ambiente sem localStorage; ignorar
  }
}

/**
 * Hook para gerenciar operações offline com fila persistida no localStorage.
 *
 * Quando a conexão voltar (`online` event), tenta processar a fila
 * chamando `syncHandler` (se fornecido) para cada item.
 *
 * @param {((operation: Object) => Promise<void>) | null} [syncHandler]
 *   Função assíncrona responsável por re-executar uma operação da fila.
 *   Se não fornecida, os itens são apenas removidos da fila ao processar.
 *
 * @returns {{
 *   isOnline: boolean,
 *   queueSize: number,
 *   enqueue: (operation: Object) => void,
 *   flush: () => Promise<void>,
 * }}
 */
export function useOfflineQueue(syncHandler = null) {
  const [isOnline, setIsOnline]   = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  )
  const [queueSize, setQueueSize] = useState(() => readQueue().length)
  const syncHandlerRef = useRef(syncHandler)
  const syncingRef     = useRef(false)

  // Manter ref do handler estável
  useEffect(() => {
    syncHandlerRef.current = syncHandler
  }, [syncHandler])

  // ---- Escuta eventos de rede ----
  useEffect(() => {
    function handleOnline() {
      setIsOnline(true)
      flush()
    }
    function handleOffline() {
      setIsOnline(false)
    }

    window.addEventListener('online',  handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online',  handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ---- enqueue ----
  const enqueue = useCallback((operation) => {
    const queue = readQueue()
    queue.push({
      ...operation,
      _enqueuedAt: Date.now(),
    })
    writeQueue(queue)
    setQueueSize(queue.length)
  }, [])

  // ---- flush (processa fila quando online) ----
  const flush = useCallback(async () => {
    if (syncingRef.current) return
    const queue = readQueue()
    if (queue.length === 0) return

    syncingRef.current = true
    const failed = []

    for (const operation of queue) {
      try {
        if (syncHandlerRef.current) {
          await syncHandlerRef.current(operation)
        }
        // Operação processada com sucesso; não readicionar
      } catch (_) {
        // Falha ao processar; manter na fila para próxima tentativa
        failed.push(operation)
      }
    }

    writeQueue(failed)
    setQueueSize(failed.length)
    syncingRef.current = false
  }, [])

  return { isOnline, queueSize, enqueue, flush }
}
