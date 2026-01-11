import {
    signInWithPopup,
    GoogleAuthProvider,
    signOut as firebaseSignOut,
    onAuthStateChanged,
    type User
} from 'firebase/auth'
import { clearAllData } from '~/utils/db'

// Global flag to prevent duplicate listener registration
let authListenerInitialized = false

export const useAuth = () => {
    const { auth } = useFirebase()
    const user = useState<User | null>('firebase-user', () => null)
    // Configure cookie with proper options - short-lived access token
    const metamorphToken = useCookie<string | null>('metamorph-token', {
        sameSite: 'lax', // Allow cookie in same-site navigations
        secure: false,   // Allow over HTTP in development
        maxAge: 60 * 15, // 15 minutes (matches access token expiry)
    })
    const loading = useState<boolean>('firebase-loading', () => true)
    const error = useState<string | null>('firebase-error', () => null)
    const config = useRuntimeConfig()

    // Initialize auth state listener ONCE
    if (import.meta.client && !authListenerInitialized) {
        authListenerInitialized = true

        onAuthStateChanged(auth, async (currentUser) => {
            user.value = currentUser
            if (currentUser) {
                // Only exchange token if we don't already have a valid metamorph token
                if (!metamorphToken.value) {
                    try {
                        console.log('[Auth] No metamorph token, exchanging Firebase token...')
                        const token = await currentUser.getIdToken()
                        await exchangeToken(token)
                    } catch (e) {
                        console.error('[Auth] Token exchange failed on init', e)
                    }
                } else {
                    console.log('[Auth] Already have metamorph token, skipping exchange')
                }
            }
            loading.value = false
        })
    }

    const exchangeToken = async (firebaseIdToken: string) => {
        try {
            // Use proxy path to ensure cookies are set on the same domain
            // This ensures refresh token cookie works correctly
            const response = await $fetch<{
                token: string
                expires_in?: number
            }>('/api/v1/auth/login', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${firebaseIdToken}`,
                    'Accept': 'application/json'
                },
                credentials: 'include', // Include cookies for refresh token
            })

            // Store the access token
            if (response?.token) {
                metamorphToken.value = response.token
                console.log('[Auth] Token exchanged, expires in:', response.expires_in || 900, 'seconds')
            }
        } catch (err: any) {
            console.error('Backend token exchange failed:', err)
            throw new Error('Failed to authenticate with backend')
        }
    }

    /**
     * Sync user data after successful login
     */
    const syncUserData = async () => {
        if (!import.meta.client) return

        try {
            console.log('[Auth] Syncing user data after login...')
            const { syncClients, syncSchedules, syncMasterExercises } = useDatabase()

            // Sync master exercise library (essential for session planning)
            const exerciseResult = await syncMasterExercises()
            console.log(`[Auth] Synced ${exerciseResult} master exercises`)

            // Sync clients (members) for this coach
            const clientResult = await syncClients()
            console.log(`[Auth] Synced ${clientResult.synced} clients`)

            // Sync schedules for the next 7 days
            const today = new Date()
            const weekFromNow = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000)
            const scheduleResult = await syncSchedules(today, weekFromNow)
            console.log(`[Auth] Synced ${scheduleResult.synced} schedules`)

            // Deep sync: Fetch exercises and sets for these schedules (for offline use)
            if (scheduleResult.synced > 0) {
                const { db } = await import('~/utils/db')
                const { syncPlannedExercises, syncScheduleSets } = useDatabase()

                // Get schedules directly from DB to get IDs
                const schedules = await db.schedules
                    .where('start_time')
                    .between(today.toISOString(), weekFromNow.toISOString())
                    .toArray()

                console.log(`[Auth] Deep syncing ${schedules.length} sessions...`)
                for (const sched of schedules) {
                    // Use remote_id (Mongo ID) for sync if available, else local ID
                    // Actually sync functions expect Remote ID usually? No, they take ScheduleID and call backend.
                    // Backend expects ScheduleID (MongoID).
                    // Our local schedule has `remote_id` if synced.
                    const syncId = sched.remote_id || sched.id
                    try {
                        await syncPlannedExercises(syncId)
                        await syncScheduleSets(syncId)
                    } catch (e) {
                        console.warn(`[Auth] Deep sync failed for ${syncId}`, e)
                    }
                }
            }

            console.log('[Auth] User data sync complete')
        } catch (error) {
            console.error('[Auth] Failed to sync user data:', error)
            // Don't block login on sync failure - data will be available from seed/cache
        }
    }

    const signInWithGoogle = async () => {
        loading.value = true
        error.value = null

        try {
            const provider = new GoogleAuthProvider()
            const result = await signInWithPopup(auth, provider)

            // Explicitly exchange token to ensure backend session is created immediately
            const token = await result.user.getIdToken()
            await exchangeToken(token)

            user.value = result.user

            // Await user data sync to ensure data is ready when user reaches dashboard
            await syncUserData()

            return result.user
        } catch (err: any) {
            error.value = err.message || 'Failed to sign in with Google'
            throw err
        } finally {
            loading.value = false
        }
    }

    /**
     * Check if there are pending sync items that would be lost on logout
     */
    const checkPendingSync = async (): Promise<{ hasPending: boolean; count: number }> => {
        if (!import.meta.client) return { hasPending: false, count: 0 }

        try {
            const { getPendingSyncItems } = useDatabase()
            const pending = await getPendingSyncItems()
            return { hasPending: pending.length > 0, count: pending.length }
        } catch {
            return { hasPending: false, count: 0 }
        }
    }

    /**
     * Force sync pending items before logout
     */
    const forceSyncBeforeLogout = async (): Promise<boolean> => {
        if (!import.meta.client) return true

        try {
            const { processSyncQueue, getPendingSyncItems } = useDatabase()

            // Process the sync queue
            await processSyncQueue()

            // Check if all items were synced
            const remaining = await getPendingSyncItems()
            return remaining.length === 0
        } catch (error) {
            console.error('[Auth] Force sync failed:', error)
            return false
        }
    }

    /**
     * Sign out with optional force parameter to skip pending sync check
     * @param options.force - Skip the pending sync check and logout anyway
     */
    const signOut = async (options?: { force?: boolean }): Promise<{ success: boolean; pendingCount?: number }> => {
        loading.value = true
        error.value = null

        try {
            if (import.meta.client && !options?.force) {
                // Check for pending sync items
                const { hasPending, count } = await checkPendingSync()

                if (hasPending) {
                    console.log(`[Auth] Warning: ${count} pending sync items will be lost on logout`)
                    loading.value = false
                    return { success: false, pendingCount: count }
                }
            }

            // Clear local database before signing out
            if (import.meta.client) {
                console.log('[Auth] Clearing local data on logout...')
                await clearAllData()
            }

            // Call backend logout to revoke refresh token
            try {
                await $fetch('/api/v1/auth/logout', {
                    method: 'POST',
                    credentials: 'include', // Include refresh token cookie
                })
                console.log('[Auth] Backend logout successful')
            } catch (e) {
                console.warn('[Auth] Backend logout failed, continuing with local logout:', e)
            }

            await firebaseSignOut(auth)
            user.value = null
            metamorphToken.value = null

            console.log('[Auth] Logout complete, all local data cleared')
            return { success: true }
        } catch (err: any) {
            error.value = err.message || 'Failed to sign out'
            throw err
        } finally {
            loading.value = false
        }
    }

    const isAuthenticated = computed(() => !!user.value && !!metamorphToken.value)

    return {
        user: readonly(user),
        metamorphToken: readonly(metamorphToken),
        loading: readonly(loading),
        error: readonly(error),
        isAuthenticated,
        signInWithGoogle,
        signOut,
        syncUserData, // Expose for manual refresh if needed
        checkPendingSync, // Check if there are unsync'd items
        forceSyncBeforeLogout // Force sync before logging out
    }
}
