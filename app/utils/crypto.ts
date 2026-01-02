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
 * Uses Web Crypto API for performance
 */
export async function generateHash(payload: string): Promise<string> {
    const encoder = new TextEncoder()
    const data = encoder.encode(payload)
    const hashBuffer = await crypto.subtle.digest('SHA-256', data)
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

/**
 * Calculate exponential backoff delay in milliseconds
 * Formula: min(2^retryCount * 1000, maxDelay)
 */
export function calculateBackoffMs(retryCount: number, maxDelayMs: number = 60000): number {
    return Math.min(Math.pow(2, retryCount) * 1000, maxDelayMs)
}
