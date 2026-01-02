/**
 * Background Sync Engine Plugin
 * Handles offline-first synchronization with automatic retry
 * 
 * Features:
 * - Connectivity listener for immediate queue processing
 * - FIFO queue processing with exponential backoff
 * - X-Correlation-ID header injection for idempotency
 * - Global sync state for UI feedback
 */

// Max retry attempts before giving up on an item
const MAX_RETRIES = 5
// Heartbeat interval for checking queue (ms)
const HEARTBEAT_INTERVAL = 30000

export default defineNuxtPlugin(async (nuxtApp) => {
    // Only run on client
    if (!import.meta.client) return

    const {
        isSyncing,
        pendingSyncCount,
        isOnline,
        refreshPendingCount,
        processSyncQueue, // Use the idempotent sync worker
        getPendingSyncItems,
        getDeadLetterItems
    } = useDatabase()

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
    // QUEUE FLUSH LOGIC (Uses idempotent processor)
    // ============================================

    async function flushQueue(): Promise<void> {
        // Prevent concurrent processing
        if (isProcessing || !navigator.onLine) return

        isProcessing = true

        try {
            // Use the enhanced idempotent sync processor
            const result = await processSyncQueue()

            if (result.success > 0 || result.failed > 0) {
                console.log(`[SyncEngine] Sync completed: ${result.success} success, ${result.failed} failed`)
            }

            // Check for dead-letter items
            const deadLetters = await getDeadLetterItems()
            if (deadLetters.length > 0) {
                console.warn(`[SyncEngine] ${deadLetters.length} items exceeded max retries (dead-letter)`)
            }
        } catch (error) {
            console.error('[SyncEngine] Error during sync:', error)
        } finally {
            isProcessing = false
        }
    }

    // ============================================
    // HEARTBEAT
    // ============================================

    function startHeartbeat(): void {
        if (heartbeatTimer) return

        heartbeatTimer = setInterval(async () => {
            if (navigator.onLine && !isProcessing) {
                const items = await getPendingSyncItems()
                if (items.length > 0) {
                    console.log(`[SyncEngine] Heartbeat: ${items.length} items ready for sync...`)
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
