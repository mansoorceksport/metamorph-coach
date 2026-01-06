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

    // Set initial online state - on mobile browsers navigator.onLine can be unreliable
    // Default to true and let actual network requests determine connectivity
    isOnline.value = navigator.onLine
    console.log(`[SyncEngine] Initial online state: ${navigator.onLine} (navigator.onLine)`)

    // ============================================
    // QUEUE FLUSH LOGIC (Uses idempotent processor)
    // ============================================

    async function flushQueue(): Promise<void> {
        // Prevent concurrent processing
        if (isProcessing) return

        // Use navigator.onLine as fallback - mobile browsers can have unreliable isOnline ref
        const effectivelyOnline = isOnline.value || navigator.onLine
        if (!effectivelyOnline) {
            console.log('[SyncEngine] Offline, skipping flush')
            return
        }

        // Force isOnline to true if navigator says we're online
        // This helps recover from stale offline state
        if (navigator.onLine && !isOnline.value) {
            console.log('[SyncEngine] Correcting stale offline state')
            isOnline.value = true
        }

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
            // Correct stale offline state
            if (navigator.onLine && !isOnline.value) {
                console.log('[SyncEngine] Heartbeat: Correcting stale offline state')
                isOnline.value = true
            }

            if ((isOnline.value || navigator.onLine) && !isProcessing) {
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
    // INITIAL DATA SYNC
    // ============================================

    // Sync clients and schedules on app startup if online and authenticated
    async function performInitialSync(): Promise<void> {
        if (!navigator.onLine) {
            console.log('[SyncEngine] Offline, skipping initial sync')
            return
        }

        try {
            const { syncClients, syncSchedules } = useDatabase()
            const { isAuthenticated } = useAuth()

            // Wait a bit to ensure auth state is initialized
            await new Promise(resolve => setTimeout(resolve, 500))

            if (!isAuthenticated.value) {
                console.log('[SyncEngine] Not authenticated, skipping initial sync')
                return
            }

            console.log('[SyncEngine] Performing initial data sync...')

            // Sync clients (members) for the coach
            const clientResult = await syncClients()
            if (clientResult.synced > 0) {
                console.log(`[SyncEngine] Synced ${clientResult.synced} clients`)
            }

            // Sync schedules for the next 7 days
            const today = new Date()
            const weekFromNow = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000)
            const scheduleResult = await syncSchedules(today, weekFromNow)
            if (scheduleResult.synced > 0) {
                console.log(`[SyncEngine] Synced ${scheduleResult.synced} schedules`)
            }

            console.log('[SyncEngine] Initial sync complete')
        } catch (error) {
            console.error('[SyncEngine] Initial sync failed:', error)
        }
    }

    // Run initial sync after a short delay to ensure auth is ready
    setTimeout(performInitialSync, 1000)

    // ============================================
    // CLEANUP
    // ============================================

    nuxtApp.hook('app:beforeMount', () => {
        // Cleanup on unmount
    })

    // Provide a manual flush function
    nuxtApp.provide('syncEngine', {
        flush: flushQueue,
        isProcessing: () => isProcessing,
        syncNow: performInitialSync // Allow manual trigger
    })
})

// Type augmentation for $syncEngine
declare module '#app' {
    interface NuxtApp {
        $syncEngine: {
            flush: () => Promise<void>
            isProcessing: () => boolean
            syncNow: () => Promise<void>
        }
    }
}
