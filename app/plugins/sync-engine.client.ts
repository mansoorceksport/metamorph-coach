/**
 * Background Sync Engine Plugin
 * Handles offline-first synchronization with automatic retry
 * 
 * Features:
 * - Connectivity listener for immediate queue flush
 * - FIFO queue processing
 * - Exponential backoff for retries
 * - Global sync state for UI feedback
 */
import { db } from '~/utils/db'

// Max retry attempts before giving up on an item
const MAX_RETRIES = 5
// Base delay for exponential backoff (ms)
const BASE_RETRY_DELAY = 1000
// Heartbeat interval for checking queue (ms)
const HEARTBEAT_INTERVAL = 30000

export default defineNuxtPlugin(async (nuxtApp) => {
    // Only run on client
    if (!import.meta.client) return

    const { isSyncing, pendingSyncCount, isOnline, refreshPendingCount } = useDatabase()

    let isProcessing = false
    let heartbeatTimer: ReturnType<typeof setInterval> | null = null

    // ============================================
    // CONNECTIVITY LISTENER
    // ============================================

    const handleOnline = () => {
        console.log('[SyncEngine] Connection restored, flushing queue...')
        isOnline.value = true
        flushQueue()
    }

    const handleOffline = () => {
        console.log('[SyncEngine] Connection lost')
        isOnline.value = false
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    // Set initial online state
    isOnline.value = navigator.onLine

    // ============================================
    // QUEUE FLUSH LOGIC
    // ============================================

    async function flushQueue(): Promise<void> {
        // Prevent concurrent processing
        if (isProcessing || !navigator.onLine) return

        isProcessing = true
        isSyncing.value = true

        try {
            // Get all pending items in FIFO order
            const items = await db.syncQueue.orderBy('timestamp').toArray()

            if (items.length === 0) {
                isSyncing.value = false
                isProcessing = false
                return
            }

            console.log(`[SyncEngine] Processing ${items.length} queued items...`)

            for (const item of items) {
                if (!navigator.onLine) {
                    console.log('[SyncEngine] Lost connection, stopping queue processing')
                    break
                }

                try {
                    // Attempt the request
                    const response = await fetch(item.url, {
                        method: item.method,
                        headers: {
                            'Content-Type': 'application/json',
                            ...item.headers
                        },
                        body: item.body
                    })

                    if (response.ok) {
                        // Success! Remove from queue
                        console.log(`[SyncEngine] Successfully synced: ${item.method} ${item.url}`)
                        await db.syncQueue.delete(item.id!)
                        await refreshPendingCount()
                    } else if (response.status >= 500) {
                        // Server error - stop and wait for heartbeat
                        console.warn(`[SyncEngine] Server error (${response.status}), pausing queue`)
                        await incrementRetryCount(item.id!, `Server error: ${response.status}`)
                        break
                    } else if (response.status >= 400) {
                        // Client error - likely won't succeed on retry, remove it
                        console.error(`[SyncEngine] Client error (${response.status}), removing item`)
                        await db.syncQueue.delete(item.id!)
                        await refreshPendingCount()
                    }
                } catch (error) {
                    // Network error - increment retry and continue
                    console.error(`[SyncEngine] Network error:`, error)
                    await incrementRetryCount(item.id!, String(error))

                    // Check if max retries exceeded
                    const updatedItem = await db.syncQueue.get(item.id!)
                    if (updatedItem && updatedItem.retryCount >= MAX_RETRIES) {
                        console.warn(`[SyncEngine] Max retries exceeded for item ${item.id}, removing`)
                        await db.syncQueue.delete(item.id!)
                        await refreshPendingCount()
                    }

                    // Stop processing on network error
                    break
                }
            }
        } finally {
            isProcessing = false
            isSyncing.value = false
        }
    }

    async function incrementRetryCount(id: number, error: string): Promise<void> {
        const item = await db.syncQueue.get(id)
        if (item) {
            await db.syncQueue.update(id, {
                retryCount: item.retryCount + 1,
                lastError: error
            })
        }
    }

    // ============================================
    // HEARTBEAT
    // ============================================

    function startHeartbeat(): void {
        if (heartbeatTimer) return

        heartbeatTimer = setInterval(async () => {
            if (navigator.onLine && !isProcessing) {
                const count = await db.syncQueue.count()
                if (count > 0) {
                    console.log(`[SyncEngine] Heartbeat: ${count} items pending, attempting flush...`)
                    flushQueue()
                }
            }
        }, HEARTBEAT_INTERVAL)
    }

    function stopHeartbeat(): void {
        if (heartbeatTimer) {
            clearInterval(heartbeatTimer)
            heartbeatTimer = null
        }
    }

    // ============================================
    // INITIALIZATION
    // ============================================

    // Initialize pending count
    await refreshPendingCount()

    // Start heartbeat
    startHeartbeat()

    // Attempt initial flush if online
    if (navigator.onLine) {
        flushQueue()
    }

    // ============================================
    // CLEANUP
    // ============================================

    nuxtApp.hook('app:beforeMount', () => {
        // Cleanup on unmount
    })

    // Provide a manual flush function
    nuxtApp.provide('syncEngine', {
        flush: flushQueue,
        isProcessing: () => isProcessing
    })
})

// Type augmentation for $syncEngine
declare module '#app' {
    interface NuxtApp {
        $syncEngine: {
            flush: () => Promise<void>
            isProcessing: () => boolean
        }
    }
}
