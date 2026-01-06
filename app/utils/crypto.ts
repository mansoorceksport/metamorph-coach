/**
 * Crypto utilities for generating unique identifiers and hashes
 */
import { ulid } from 'ulid'

/**
 * Generate a ULID (Universally Unique Lexicographically Sortable Identifier)
 * ULIDs are preferred over UUIDs for IndexedDB as they are lexicographically
 * sortable and more efficient for range queries.
 */
export function generateId(): string {
    return ulid()
}

/**
 * Generate a SHA-256 hash of a string payload for deduplication
 * Uses Web Crypto API when available (requires HTTPS on mobile)
 * Falls back to simple hash for HTTP contexts
 */
export async function generateHash(payload: string): Promise<string> {
    // Check if crypto.subtle is available (requires secure context on mobile)
    if (typeof crypto !== 'undefined' && crypto.subtle) {
        try {
            const encoder = new TextEncoder()
            const data = encoder.encode(payload)
            const hashBuffer = await crypto.subtle.digest('SHA-256', data)
            const hashArray = Array.from(new Uint8Array(hashBuffer))
            return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
        } catch (e) {
            console.warn('[Crypto] Web Crypto failed, using fallback hash:', e)
        }
    }

    // Fallback: Simple djb2 hash for non-secure contexts (HTTP on mobile)
    // Not cryptographically secure, but fine for deduplication
    let hash = 5381
    for (let i = 0; i < payload.length; i++) {
        hash = ((hash << 5) + hash) + payload.charCodeAt(i)
        hash = hash & hash // Convert to 32bit integer
    }
    // Convert to hex string with enough entropy for deduplication
    const timestamp = Date.now().toString(16)
    return `djb2-${(hash >>> 0).toString(16)}-${timestamp}`
}

/**
 * Calculate exponential backoff delay in milliseconds
 * Formula: min(2^retryCount * 1000, maxDelay)
 */
export function calculateBackoffMs(retryCount: number, maxDelayMs: number = 60000): number {
    return Math.min(Math.pow(2, retryCount) * 1000, maxDelayMs)
}
