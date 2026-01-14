/**
 * Sentry Enrichment Plugin
 * 
 * Adds rich context to all Sentry errors:
 * - User identity (ID, email, tenant, roles)
 * - Sync queue status (pending, failed items)
 * - Device info (connection, battery, memory)
 * 
 * This helps diagnose issues like:
 * - "Coach Juna has 25 pending sync items when she got this error"
 * - "User was offline when this happened"
 */
import * as Sentry from '@sentry/nuxt'
import { db } from '~/utils/db'

export default defineNuxtPlugin(() => {
    if (!import.meta.client) return

    // Update context periodically (every 30 seconds)
    setInterval(updateSentryContext, 30000)

    // Update context on visibility change (app comes back to foreground)
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
            updateSentryContext()
        }
    })

    // Update context on online/offline changes
    window.addEventListener('online', () => {
        Sentry.setTag('device.connection', 'online')
        updateSentryContext()
    })
    window.addEventListener('offline', () => {
        Sentry.setTag('device.connection', 'offline')
    })

    // Initial context update
    updateSentryContext()
})

/**
 * Update Sentry context with current app state
 */
async function updateSentryContext() {
    try {
        // Set device tags
        setDeviceTags()

        // Set user context from JWT
        await setUserContext()

        // Set sync queue context
        await setSyncQueueContext()
    } catch (error) {
        console.warn('[SentryEnrichment] Failed to update context:', error)
    }
}

/**
 * Set device-related tags
 */
function setDeviceTags() {
    // Connection status
    Sentry.setTag('device.connection', navigator.onLine ? 'online' : 'offline')

    // Connection type (if available)
    const nav = navigator as any
    if (nav.connection) {
        Sentry.setTag('device.connection_type', nav.connection.effectiveType || 'unknown')
        Sentry.setTag('device.connection_downlink', String(nav.connection.downlink || 0))
    }

    // Battery status (if available)
    if ('getBattery' in navigator) {
        (navigator as any).getBattery?.().then((battery: any) => {
            Sentry.setTag('device.battery_level', `${Math.round(battery.level * 100)}%`)
            Sentry.setTag('device.battery_charging', battery.charging ? 'yes' : 'no')
        }).catch(() => {
            // Battery API not available
        })
    }

    // Memory info (if available)
    const memory = (performance as any).memory
    if (memory) {
        const usedMB = Math.round(memory.usedJSHeapSize / 1024 / 1024)
        const totalMB = Math.round(memory.jsHeapSizeLimit / 1024 / 1024)
        Sentry.setTag('device.memory_used_mb', String(usedMB))
        Sentry.setContext('device_memory', {
            used_mb: usedMB,
            total_mb: totalMB,
            usage_percent: Math.round((usedMB / totalMB) * 100)
        })
    }

    // Viewport info
    Sentry.setContext('device_viewport', {
        width: window.innerWidth,
        height: window.innerHeight,
        device_pixel_ratio: window.devicePixelRatio
    })
}

/**
 * Set user context from JWT token
 */
async function setUserContext() {
    const token = useCookie<string | null>('metamorph-token')

    if (!token.value) {
        return
    }

    try {
        // Decode JWT payload (base64)
        const parts = token.value.split('.')
        if (parts.length !== 3) return

        const payload = JSON.parse(atob(parts[1] as string))

        // Set rich user context - now includes name and email from JWT
        Sentry.setUser({
            id: payload.user_id || payload.sub,
            email: payload.email || undefined,
            username: payload.name || undefined
        })

        // Set custom tags for filtering in Sentry UI
        if (payload.tenant_id) {
            Sentry.setTag('user.tenant_id', payload.tenant_id)
        }
        if (payload.home_branch_id) {
            Sentry.setTag('user.branch_id', payload.home_branch_id)
        }
        if (payload.roles && Array.isArray(payload.roles)) {
            Sentry.setTag('user.roles', payload.roles.join(','))
        }
        if (payload.name) {
            Sentry.setTag('user.name', payload.name)
        }

        // Token expiry info
        if (payload.exp) {
            const expiresAt = new Date(payload.exp * 1000)
            const now = new Date()
            const minutesUntilExpiry = Math.round((expiresAt.getTime() - now.getTime()) / 1000 / 60)
            Sentry.setContext('token_info', {
                expires_at: expiresAt.toISOString(),
                minutes_until_expiry: minutesUntilExpiry,
                is_expired: minutesUntilExpiry < 0
            })
        }
    } catch (error) {
        console.warn('[SentryEnrichment] Failed to parse JWT:', error)
    }
}

/**
 * Set sync queue context
 */
async function setSyncQueueContext() {
    try {
        // Get sync queue stats
        const allItems = await db.syncQueue.toArray()

        // Items are "pending" if no lastError, "failed" if has lastError
        const pending = allItems.filter(i => !i.lastError).length
        const failed = allItems.filter(i => !!i.lastError).length
        const deadLetter = allItems.filter(i => i.retryCount >= 5).length

        // Set as tags for easy filtering
        Sentry.setTag('sync.has_pending', pending > 0 ? 'yes' : 'no')
        Sentry.setTag('sync.pending_count', String(pending))
        Sentry.setTag('sync.failed_count', String(failed))

        // Set detailed context
        Sentry.setContext('sync_queue', {
            total_items: allItems.length,
            pending_items: pending,
            failed_items: failed,
            dead_letter_items: deadLetter,
            oldest_pending: getOldestItemAge(allItems.filter(i => !i.lastError))
        })

        // If there are many failed items, this is a high-priority issue
        if (failed >= 5 || deadLetter > 0) {
            Sentry.setTag('sync.health', 'critical')
        } else if (pending >= 10) {
            Sentry.setTag('sync.health', 'warning')
        } else {
            Sentry.setTag('sync.health', 'healthy')
        }
    } catch (error) {
        // Database might not be open yet
        Sentry.setContext('sync_queue', {
            error: 'Unable to read sync queue'
        })
    }
}

/**
 * Get the age of the oldest item in minutes
 */
function getOldestItemAge(items: any[]): string {
    if (items.length === 0) return 'none'

    const oldest = items.reduce((min, item) =>
        new Date(item.timestamp) < new Date(min.timestamp) ? item : min
    )

    const ageMs = Date.now() - new Date(oldest.timestamp).getTime()
    const ageMinutes = Math.round(ageMs / 1000 / 60)

    if (ageMinutes < 60) return `${ageMinutes}m`
    if (ageMinutes < 1440) return `${Math.round(ageMinutes / 60)}h`
    return `${Math.round(ageMinutes / 1440)}d`
}
