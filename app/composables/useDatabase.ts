/**
 * Database Repository Composable
 * Provides reactive queries and mutations for offline-first data access
 */
import { db, type Schedule, type SessionLog, type SyncQueueItem, type Exercise, type PlannedExercise, type CachedMember, getTodayRange, checkIfNewPB, calculateVelocityDelta } from '~/utils/db'
import { generateId, generateHash, calculateBackoffMs } from '~/utils/crypto'
import { liveQuery } from 'dexie'

// Global sync state (shared across all instances)
const isSyncing = ref(false)
const pendingSyncCount = ref(0)
const isOnline = ref(true)

export function useDatabase() {
    // ============================================
    // REACTIVE QUERIES
    // ============================================

    // Capture router context for background sync redirects
    const router = import.meta.client ? useRouter() : null
    const route = import.meta.client ? useRoute() : null

    /**
     * Get today's schedules as a reactive query
     */
    function getTodaySchedules() {
        const schedules = ref<Schedule[]>([])
        const loading = ref(true)
        const error = ref<Error | null>(null)

        if (import.meta.client) {
            const { start, end } = getTodayRange()

            const subscription = liveQuery(async () => {
                return await db.schedules
                    .where('start_time')
                    .between(start, end)
                    .toArray()
            }).subscribe({
                next: (result) => {
                    schedules.value = result
                    loading.value = false
                },
                error: (err) => {
                    error.value = err
                    loading.value = false
                }
            })

            onUnmounted(() => subscription.unsubscribe())
        }

        return { schedules, loading, error }
    }

    /**
     * Get session logs for a specific schedule
     */
    function getSessionLogs(scheduleId: string) {
        const logs = ref<SessionLog[]>([])
        const loading = ref(true)

        if (import.meta.client) {
            const subscription = liveQuery(async () => {
                return await db.sessionLogs
                    .where('schedule_id')
                    .equals(scheduleId)
                    .toArray()
            }).subscribe({
                next: (result) => {
                    logs.value = result
                    loading.value = false
                },
                error: () => {
                    loading.value = false
                }
            })

            onUnmounted(() => subscription.unsubscribe())
        }

        return { logs, loading }
    }

    /**
     * Get exercises with PB data
     */
    async function getExercise(exerciseId: string): Promise<Exercise | undefined> {
        if (!import.meta.client) return undefined
        return await db.exercises.get(exerciseId)
    }

    /**
     * Get PBs for multiple exercises
     */
    async function getExercisePBs(exerciseIds: string[]): Promise<Record<string, number>> {
        if (!import.meta.client) return {}

        const pbs: Record<string, number> = {}
        const exercises = await db.exercises.where('id').anyOf(exerciseIds).toArray()

        exercises.forEach(ex => {
            pbs[ex.id] = ex.personal_best_weight
        })

        return pbs
    }

    // ============================================
    // PLANNED EXERCISES (WORKOUT PLAN)
    // ============================================

    /**
     * Get planned exercises for a schedule (reactive)
     */
    function getPlannedExercises(scheduleId: string) {
        const exercises = ref<PlannedExercise[]>([])
        const loading = ref(true)

        if (import.meta.client) {
            const subscription = liveQuery(async () => {
                return await db.plannedExercises
                    .where('schedule_id')
                    .equals(scheduleId)
                    .sortBy('order')
            }).subscribe({
                next: (result) => {
                    exercises.value = result
                    loading.value = false
                },
                error: () => {
                    loading.value = false
                }
            })

            onUnmounted(() => subscription.unsubscribe())
        }

        return { exercises, loading }
    }

    /**
     * Get planned exercises for a schedule (async, non-reactive)
     */
    async function fetchPlannedExercises(scheduleId: string): Promise<PlannedExercise[]> {
        if (!import.meta.client) return []
        return await db.plannedExercises
            .where('schedule_id')
            .equals(scheduleId)
            .sortBy('order')
    }

    /**
     * Add a planned exercise to a session
     */
    async function addPlannedExercise(exercise: Omit<PlannedExercise, 'id'>): Promise<string> {
        if (!import.meta.client) throw new Error('Client-side only')
        const id = generateId()
        await db.plannedExercises.add({ ...exercise, id })
        return id
    }

    /**
     * Remove a planned exercise from a session
     */
    async function removePlannedExercise(id: string): Promise<void> {
        if (!import.meta.client) return
        await db.plannedExercises.delete(id)
    }

    /**
     * Add a planned exercise with sync
     */
    async function addPlannedExerciseWithSync(exercise: Omit<PlannedExercise, 'id' | 'remote_id' | 'sync_status'>): Promise<string> {
        if (!import.meta.client) throw new Error('Client-side only')

        // 1. Save locally with temp ID
        // Note: generateId is usually ulid() or similar. 
        // Existing code uses generateId() or ulid()? Let's check imports or other usages. 
        // Previous view showed `const id = generateId()` in addPlannedExercise. so use that.
        const id = generateId()
        await db.plannedExercises.add({ ...exercise, id, remote_id: null, sync_status: 'pending' })

        // 2. Queue Sync (include client_id for dual-identity handshake)
        const config = useRuntimeConfig()
        const baseUrl = config.public.apiBase || ''

        // Resolve schedule's remote_id for the backend URL
        const schedule = await db.schedules.get(exercise.schedule_id)
        const backendScheduleId = schedule?.remote_id || exercise.schedule_id

        await queueSync({
            method: 'POST',
            url: `${baseUrl}/v1/pro/schedules/${backendScheduleId}/exercises`,
            body: JSON.stringify({
                client_id: id, // Local ULID for identity handshake
                exercise_id: exercise.exercise_id,
                target_sets: exercise.target_sets,
                target_reps: exercise.target_reps,
                rest_seconds: exercise.rest_seconds,
                notes: exercise.notes,
                order: exercise.order
            }),
            priority: 'normal',
            context: {
                type: 'exercise_add',
                temp_id: id,
                schedule_id: exercise.schedule_id,
                backend_schedule_id: backendScheduleId
            }
        })

        return id
    }

    /**
     * Remove a planned exercise with sync (Dual-Identity aware)
     */
    async function removePlannedExerciseWithSync(id: string): Promise<void> {
        if (!import.meta.client) return

        const entity = await db.plannedExercises.get(id)
        if (!entity) return // Already deleted

        // Scenario A: Not synced yet (remote_id is null or undefined)
        // Also check if id looks like a MongoDB ObjectID (legacy synced records before migration)
        const isMongoObjectId = /^[a-f0-9]{24}$/.test(id)

        if (!entity.remote_id && !isMongoObjectId) {
            // Cancel pending POST in syncQueue
            const pendingCreate = await db.syncQueue
                .filter(item => item.context?.type === 'exercise_add' && item.context?.temp_id === id)
                .first()

            if (pendingCreate) {
                await removeSyncItem(pendingCreate.id)
                console.log(`[Sync] Smart Deletion: Cancelled pending POST for exercise ${id}`)
            }

            // Delete locally
            await db.plannedExercises.delete(id)
            return
        }

        // Scenario B: Already synced (remote_id exists OR legacy MongoDB ObjectID)
        await db.plannedExercises.update(id, { sync_status: 'deleted' })
        await db.plannedExercises.delete(id)

        // Queue DELETE using remote_id (or id for legacy records)
        const config = useRuntimeConfig()
        const baseUrl = config.public.apiBase || ''
        const deleteId = entity.remote_id || id // Use remote_id if available, else fallback to id

        await queueSync({
            method: 'DELETE',
            url: `${baseUrl}/v1/pro/exercises/${deleteId}`,
            priority: 'normal',
            context: {
                type: 'exercise_remove',
                local_id: id,
                remote_id: deleteId
            }
        })
        console.log(`[Sync] Queued DELETE for exercise ${id} (remote: ${deleteId})`)
    }

    /**
     * Update a planned exercise
     * If exercise hasn't synced yet (remote_id is null), updates the pending POST body instead
     */
    async function updatePlannedExerciseWithSync(id: string, data: Partial<PlannedExercise>): Promise<void> {
        if (!import.meta.client) return

        // 1. Update locally first (optimistic)
        await db.plannedExercises.update(id, data)
        const exercise = await db.plannedExercises.get(id)

        if (exercise) {
            // 2. Resolve the backend ID (remote_id if synced, or id if legacy MongoDB ID)
            const isMongoObjectId = /^[a-f0-9]{24}$/.test(id)
            const backendId = exercise.remote_id || (isMongoObjectId ? id : null)

            // If not synced yet (no remote_id and not a legacy ID)
            if (!backendId) {
                // Option A: Find pending POST and merge the update into its body
                const pendingCreate = await db.syncQueue
                    .filter(item => item.context?.type === 'exercise_add' && item.context?.temp_id === id)
                    .first()

                if (pendingCreate && pendingCreate.body) {
                    // Merge new data into the pending POST body
                    const existingBody = JSON.parse(pendingCreate.body)
                    const mergedBody = {
                        ...existingBody,
                        target_sets: exercise.target_sets,
                        target_reps: exercise.target_reps,
                        rest_seconds: exercise.rest_seconds,
                        notes: exercise.notes,
                        order: exercise.order
                    }
                    await db.syncQueue.update(pendingCreate.id, { body: JSON.stringify(mergedBody) })
                    console.log(`[Sync] Merged update into pending POST for exercise ${id}`)
                } else {
                    console.log(`[Sync] No pending POST found for unsynced exercise ${id}, update stored locally only`)
                }
                return
            }

            // If already synced, queue a PUT with the backend ID
            const config = useRuntimeConfig()
            const baseUrl = config.public.apiBase || ''

            await queueSync({
                method: 'PUT',
                url: `${baseUrl}/v1/pro/exercises/${backendId}`,
                body: JSON.stringify({
                    target_sets: exercise.target_sets,
                    target_reps: exercise.target_reps,
                    rest_seconds: exercise.rest_seconds,
                    notes: exercise.notes,
                    order: exercise.order
                }),
                priority: 'normal',
                context: {
                    type: 'exercise_update',
                    local_id: id,
                    remote_id: backendId
                }
            })
        }
    }

    /**
     * Update a planned exercise by schedule_id + exercise_id
     */
    async function updatePlannedExerciseByKeys(scheduleId: string, exerciseId: string, data: Partial<PlannedExercise>): Promise<void> {
        if (!import.meta.client) return
        const exercise = await db.plannedExercises
            .where('schedule_id')
            .equals(scheduleId)
            .filter(ex => ex.exercise_id === exerciseId)
            .first()
        if (exercise?.id) {
            await db.plannedExercises.update(exercise.id, data)
        }
    }

    /**
     * Remove a planned exercise by schedule_id + exercise_id
     */
    async function removePlannedExerciseByKeys(scheduleId: string, exerciseId: string): Promise<void> {
        if (!import.meta.client) return
        const exercise = await db.plannedExercises
            .where('schedule_id')
            .equals(scheduleId)
            .filter(ex => ex.exercise_id === exerciseId)
            .first()
        if (exercise?.id) {
            await db.plannedExercises.delete(exercise.id)
        }
    }

    /**
     * Seed planned exercises for a schedule
     */
    async function seedPlannedExercises(exercises: Omit<PlannedExercise, 'id'>[]): Promise<void> {
        if (!import.meta.client) return
        await db.plannedExercises.bulkAdd(exercises)
    }

    // ============================================
    // MUTATIONS
    // ============================================

    /**
     * Save a set log with automatic PB detection
     */
    async function saveSetLog(log: Omit<SessionLog, 'id' | 'remote_id' | 'sync_status' | 'is_new_pb' | 'velocity_delta'>): Promise<SessionLog> {
        if (!import.meta.client) throw new Error('Client-side only')

        // Get exercise for PB check
        let is_new_pb = false
        let velocity_delta: number | undefined

        // Resolve Library ID from Planned Exercise (log.exercise_id is Planned ID)
        let libraryId = log.exercise_id
        const planned = await db.plannedExercises.get(log.exercise_id)
        if (planned) {
            libraryId = planned.exercise_id
        }

        const exercise = await db.exercises.get(libraryId)
        if (exercise && log.weight) {
            is_new_pb = checkIfNewPB(log.weight, exercise.personal_best_weight)
            velocity_delta = calculateVelocityDelta(log.weight, exercise.last_3_weights_history)

            // Update exercise PB if new record
            if (is_new_pb) {
                await db.exercises.update(libraryId, {
                    personal_best_weight: log.weight,
                    last_3_weights_history: [
                        ...exercise.last_3_weights_history.slice(-2),
                        log.weight
                    ]
                })
            }
        }

        // Check if log already exists for this schedule+exercise+set
        const existing = await db.sessionLogs
            .where('[schedule_id+exercise_id]')
            .equals([log.schedule_id, log.exercise_id])
            .filter(l => l.set_index === log.set_index)
            .first()

        if (existing?.id) {
            // Update existing log - preserve dual-identity fields
            const updatedLog: SessionLog = {
                ...log,
                id: existing.id,
                remote_id: existing.remote_id,
                sync_status: existing.sync_status,
                is_new_pb,
                velocity_delta,
                completed_at: log.completed ? new Date().toISOString() : undefined
            }
            await db.sessionLogs.update(existing.id, updatedLog)
            return updatedLog
        } else {
            // Create new log with ULID
            const newLog: SessionLog = {
                ...log,
                id: generateId(),
                remote_id: null,
                sync_status: 'pending',
                is_new_pb,
                velocity_delta,
                completed_at: log.completed ? new Date().toISOString() : undefined
            }
            await db.sessionLogs.add(newLog)
            return newLog
        }
    }

    /**
     * Save or update a schedule (with deduplication for dual-identity)
     */
    async function saveSchedule(schedule: Schedule): Promise<void> {
        if (!import.meta.client) return

        // Deduplicate: If this has a remote_id, check if a record with that remote_id already exists
        if (schedule.remote_id) {
            const existing = await db.schedules
                .filter(s => s.remote_id === schedule.remote_id)
                .first()

            if (existing && existing.id !== schedule.id) {
                // A different record already has this remote_id, update it instead
                console.log(`[Sync] Dedup: Updating existing ${existing.id} instead of creating ${schedule.id}`)
                await db.schedules.update(existing.id, {
                    ...schedule,
                    id: existing.id // Keep the existing local ID
                })
                return
            }
        }

        await db.schedules.put(schedule)
    }

    /**
     * Get a schedule by ID
     */
    async function getSchedule(scheduleId: string): Promise<Schedule | undefined> {
        if (!import.meta.client) return undefined
        return await db.schedules.get(scheduleId)
    }

    /**
     * Update schedule status (optimistic)
     */
    async function updateScheduleStatus(
        scheduleId: string,
        status: Schedule['status'],
        remarks?: string
    ): Promise<void> {
        if (!import.meta.client) return

        const updates: Partial<Schedule> = { status }
        if (status === 'completed') {
            updates.completed_at = new Date().toISOString()
        }
        if (remarks) {
            updates.coach_remarks = remarks
        }

        await db.schedules.update(scheduleId, updates)
    }

    /**
     * Create a new schedule with defaults
     */
    interface CreateScheduleInput {
        member_id: string
        member_name: string
        member_avatar?: string
        start_time: string // ISO datetime
        session_goal?: string
    }

    async function createSchedule(input: CreateScheduleInput): Promise<string> {
        if (!import.meta.client) throw new Error('Client-side only')

        // Get member info for churn/trend defaults
        const member = await db.cachedMembers.get(input.member_id)

        const schedule: Schedule = {
            id: generateId(),
            remote_id: null, // Will be populated after first sync
            sync_status: 'pending',
            member_id: input.member_id,
            member_name: input.member_name,
            member_avatar: input.member_avatar,
            start_time: input.start_time,
            status: 'scheduled',
            churn_score: member?.churn_score ?? 50,
            attendance_trend: member?.attendance_trend ?? 'stable',
            session_goal: input.session_goal
        }

        await db.schedules.put(schedule)
        console.log(`[Database] Created schedule ${schedule.id} for ${input.member_name}`)
        return schedule.id
    }

    /**
     * Get all cached members for dropdown
     */
    async function getCachedMembers(): Promise<CachedMember[]> {
        if (!import.meta.client) return []
        return await db.cachedMembers.orderBy('name').toArray()
    }

    /**
     * Sync clients from API to local cache
     * Note: Requires auth - call only when authenticated
     */
    async function syncClients(): Promise<{ synced: number; error?: string }> {
        if (!import.meta.client) return { synced: 0 }

        try {
            // Lazy import to avoid circular dependency
            const api = useApi()
            const clients = await api.fetchClients()

            // Convert to cached members and bulk upsert
            const members = clients.map(api.clientToCachedMember)
            await db.cachedMembers.bulkPut(members)

            console.log(`[Database] Synced ${members.length} clients from API`)
            return { synced: members.length }
        } catch (error: any) {
            console.error('[Database] Failed to sync clients:', error)
            return { synced: 0, error: error.message }
        }
    }

    /**
     * Sync schedules from API to local cache
     * Note: Requires auth - call only when authenticated
     * @param from Start date for range (defaults to today)
     * @param to End date for range (defaults to 7 days from now)
     */
    async function syncSchedules(from?: Date, to?: Date): Promise<{ synced: number; error?: string }> {
        if (!import.meta.client) return { synced: 0 }

        try {
            // Lazy import to avoid circular dependency
            const api = useApi()
            const schedules = await api.fetchSchedules(from, to)

            // Convert to local format and bulk upsert
            const localSchedules = schedules.map(api.scheduleResponseToLocal)
            await db.schedules.bulkPut(localSchedules)

            console.log(`[Database] Synced ${localSchedules.length} schedules from API`)
            return { synced: localSchedules.length }
        } catch (error: any) {
            console.error('[Database] Failed to sync schedules:', error)
            return { synced: 0, error: error.message }
        }
    }

    /**
     * Create schedule with local-first + sync queue
     */
    async function createScheduleWithSync(input: CreateScheduleInput): Promise<string> {
        if (!import.meta.client) throw new Error('Client-side only')

        // 1. Create locally first (optimistic)
        const scheduleId = await createSchedule(input)

        // 2. Get API base URL from runtime config
        const config = useRuntimeConfig()
        const baseUrl = config.public.apiBase || ''

        // 3. Queue for backend sync (include client_id for dual-identity handshake)
        await queueSync({
            method: 'POST',
            url: `${baseUrl}/v1/pro/schedules`,
            body: JSON.stringify({
                client_id: scheduleId, // Local ULID for identity handshake
                member_id: input.member_id,
                start_time: input.start_time,
                session_goal: input.session_goal
            }),
            priority: 'high',
            context: {
                schedule_id: scheduleId,
                member_id: input.member_id,
                type: 'schedule_create'
            }
        })

        console.log(`[Database] Queued schedule ${scheduleId} for sync`)
        return scheduleId
    }

    /**
     * Delete schedule locally
     */
    async function deleteSchedule(scheduleId: string): Promise<void> {
        if (!import.meta.client) throw new Error('Client-side only')

        await db.schedules.delete(scheduleId)
        // Also delete any planned exercises and session logs for this schedule
        await db.plannedExercises.where('schedule_id').equals(scheduleId).delete()
        await db.sessionLogs.where('schedule_id').equals(scheduleId).delete()
        console.log(`[Database] Deleted schedule ${scheduleId}`)
    }

    /**
     * Delete schedule with local-first + sync queue (Dual-Identity aware)
     */
    async function deleteScheduleWithSync(scheduleId: string): Promise<void> {
        if (!import.meta.client) throw new Error('Client-side only')

        const entity = await db.schedules.get(scheduleId)

        // Delete local associated data first
        await db.plannedExercises.where('schedule_id').equals(scheduleId).delete()
        await db.sessionLogs.where('schedule_id').equals(scheduleId).delete()

        if (!entity) {
            // Already deleted? Just clean up
            await db.schedules.delete(scheduleId)
            return
        }

        // Scenario A: Not synced yet (remote_id is null or undefined)
        // Also check if id looks like a MongoDB ObjectID (legacy synced records before migration)
        const isMongoObjectId = /^[a-f0-9]{24}$/.test(scheduleId)

        if (!entity.remote_id && !isMongoObjectId) {
            // Cancel pending POST in syncQueue
            const pendingCreate = await db.syncQueue
                .filter(item => item.context?.type === 'schedule_create' && item.context?.schedule_id === scheduleId)
                .first()

            if (pendingCreate) {
                await removeSyncItem(pendingCreate.id)
                console.log(`[Sync] Smart Deletion: Cancelled pending POST for schedule ${scheduleId}`)
            }

            // Delete locally
            await db.schedules.delete(scheduleId)
            return
        }

        // Scenario B: Already synced (remote_id exists OR legacy MongoDB ObjectID)
        await db.schedules.delete(scheduleId)

        // Queue DELETE using remote_id (or id for legacy records)
        const config = useRuntimeConfig()
        const baseUrl = config.public.apiBase || ''
        const deleteId = entity.remote_id || scheduleId // Use remote_id if available, else fallback to id

        await queueSync({
            method: 'DELETE',
            url: `${baseUrl}/v1/pro/schedules/${deleteId}`,
            priority: 'high',
            context: {
                type: 'schedule_delete',
                local_id: scheduleId,
                remote_id: deleteId
            }
        })
        console.log(`[Sync] Queued DELETE for schedule ${scheduleId} (remote: ${deleteId})`)
    }

    /**
     * Save or update an exercise
     */
    async function saveExercise(exercise: Exercise): Promise<void> {
        if (!import.meta.client) return
        await db.exercises.put(exercise)
    }

    // ============================================
    // SYNC QUEUE (Idempotent with Correlation Context)
    // ============================================

    const MAX_RETRY_COUNT = 5 // After this, item goes to dead-letter state

    /**
     * Queue an API request for later sync with deduplication
     * Returns null if a duplicate already exists
     */
    async function queueSync(
        action: Omit<SyncQueueItem, 'id' | 'correlation_id' | 'payload_hash' | 'timestamp' | 'retryCount' | 'nextRetryAt'>,
        context: Record<string, any> = {}
    ): Promise<string | null> {
        if (!import.meta.client) throw new Error('Client-side only')

        // Generate payload hash for deduplication
        const payloadString = JSON.stringify({
            method: action.method,
            url: action.url,
            body: action.body
        })
        const payloadHash = await generateHash(payloadString)

        // Check for duplicates - skip if same payload already queued
        const existing = await db.syncQueue
            .where('payload_hash')
            .equals(payloadHash)
            .first()

        if (existing) {
            console.log(`[SyncQueue] Duplicate detected, skipping. Hash: ${payloadHash.slice(0, 8)}...`)
            return null
        }

        const item: SyncQueueItem = {
            id: generateId(),
            correlation_id: generateId(), // Unique ID for X-Correlation-ID header
            payload_hash: payloadHash,
            context: { ...context, ...action.context },
            method: action.method,
            url: action.url,
            body: action.body,
            headers: action.headers,
            timestamp: Date.now(),
            retryCount: 0,
            priority: action.priority
        }

        await db.syncQueue.add(item)
        await refreshPendingCount()
        console.log(`[SyncQueue] Queued: ${action.method} ${action.url} (correlation: ${item.correlation_id.slice(0, 8)}...)`)

        // Trigger immediate sync if online (with small delay to batch multiple operations)
        if (isOnline.value) {
            setTimeout(() => {
                processSyncQueue().catch(err =>
                    console.error('[SyncQueue] Auto-sync failed:', err)
                )
            }, 100) // 100ms delay to batch rapid-fire queue additions
        }

        return item.id
    }

    /**
     * Get all pending sync items ready for retry (respecting backoff)
     */
    async function getPendingSyncItems(): Promise<SyncQueueItem[]> {
        if (!import.meta.client) return []
        const now = Date.now()

        // Get items where nextRetryAt is null (new) or in the past (ready for retry)
        const items = await db.syncQueue.orderBy('timestamp').toArray()
        return items.filter(item => {
            // Skip items that exceeded max retries
            if (item.retryCount >= MAX_RETRY_COUNT) return false
            // Include if no backoff set or backoff expired
            return !item.nextRetryAt || item.nextRetryAt <= now
        })
    }

    /**
     * Remove a sync item after successful sync
     */
    async function removeSyncItem(id: string): Promise<void> {
        if (!import.meta.client) return
        await db.syncQueue.delete(id)
        await refreshPendingCount()
    }

    /**
     * Mark a sync item as failed with exponential backoff
     */
    async function markSyncFailed(id: string, error?: string): Promise<void> {
        if (!import.meta.client) return
        const item = await db.syncQueue.get(id)
        if (item) {
            const newRetryCount = item.retryCount + 1
            const backoffMs = calculateBackoffMs(newRetryCount)
            const nextRetryAt = Date.now() + backoffMs

            await db.syncQueue.update(id, {
                retryCount: newRetryCount,
                lastError: error,
                nextRetryAt
            })

            console.log(`[SyncQueue] Failed: ${item.url} - Retry ${newRetryCount}/${MAX_RETRY_COUNT} in ${backoffMs / 1000}s`)
        }
    }

    /**
     * Process the sync queue with exponential backoff
     */
    async function processSyncQueue(): Promise<{ success: number; failed: number }> {
        if (!import.meta.client || isSyncing.value || !isOnline.value) {
            return { success: 0, failed: 0 }
        }

        isSyncing.value = true
        let success = 0
        let failed = 0

        try {
            const items = await getPendingSyncItems()
            console.log(`[SyncQueue] Processing ${items.length} pending items`)

            // Get auth token from cookie
            const metamorphToken = useCookie<string | null>('metamorph-token')
            if (!metamorphToken.value) {
                console.warn('[SyncQueue] No auth token available, skipping sync')
                return { success: 0, failed: 0 }
            }

            for (const item of items) {
                try {
                    // Build request with X-Correlation-ID and Authorization headers
                    const headers: Record<string, string> = {
                        'Content-Type': 'application/json',
                        'X-Correlation-ID': item.correlation_id,
                        'Authorization': `Bearer ${metamorphToken.value}`,
                        ...(item.headers || {})
                    }

                    const response = await fetch(item.url, {
                        method: item.method,
                        headers,
                        body: item.body
                    })

                    if (response.ok) {
                        // Handle schedule creation - populate remote_id (Dual-Identity)
                        if (item.method === 'POST' && item.context?.type === 'schedule_create') {
                            try {
                                const backendSchedule = await response.json()
                                const localId = item.context.schedule_id
                                if (backendSchedule.id && localId) {
                                    await db.schedules.update(localId, {
                                        remote_id: backendSchedule.id,
                                        sync_status: 'synced'
                                    })
                                    console.log(`[Sync] Linked schedule: ${localId} → ${backendSchedule.id}`)

                                    // CRITICAL: Update all pending exercise_add items to use the new MongoDB ID
                                    // These were queued before the schedule synced, so they have ULID in URL
                                    const pendingExercises = await db.syncQueue
                                        .filter(q => q.context?.type === 'exercise_add' && q.context?.schedule_id === localId)
                                        .toArray()

                                    for (const pendingEx of pendingExercises) {
                                        // Update URL: replace ULID with MongoDB ID
                                        const newUrl = pendingEx.url.replace(localId, backendSchedule.id)
                                        await db.syncQueue.update(pendingEx.id, { url: newUrl })
                                        console.log(`[Sync] Fixed pending exercise URL: ${localId} → ${backendSchedule.id}`)
                                    }
                                }
                            } catch (parseErr) {
                                console.warn('[SyncQueue] Could not parse schedule response:', parseErr)
                            }
                        }

                        // Handle exercise creation - populate remote_id (Dual-Identity)
                        if (item.method === 'POST' && item.context?.type === 'exercise_add') {
                            try {
                                const backendEx = await response.json()
                                const localId = item.context.temp_id
                                if (backendEx.id && localId) {
                                    await db.plannedExercises.update(localId, {
                                        remote_id: backendEx.id,
                                        sync_status: 'synced'
                                    })
                                    console.log(`[Sync] Linked exercise: ${localId} → ${backendEx.id}`)
                                }
                            } catch (e) {
                                console.error('[SyncQueue] Failed to update local exercise IDs:', e)
                            }
                        }

                        await removeSyncItem(item.id)
                        success++
                        console.log(`[SyncQueue] Success: ${item.method} ${item.url}`)
                    } else if (response.status === 409) {
                        // Conflict - server already has this (idempotent success)
                        await removeSyncItem(item.id)
                        success++
                        console.log(`[SyncQueue] Already synced (409): ${item.url}`)
                    } else {
                        const errorText = await response.text()
                        await markSyncFailed(item.id, `HTTP ${response.status}: ${errorText}`)
                        failed++
                    }
                } catch (err: any) {
                    await markSyncFailed(item.id, err.message)
                    failed++
                }
            }
        } finally {
            isSyncing.value = false
            await refreshPendingCount()
        }

        return { success, failed }
    }

    /**
     * Get dead-letter items (exceeded max retries)
     */
    async function getDeadLetterItems(): Promise<SyncQueueItem[]> {
        if (!import.meta.client) return []
        const items = await db.syncQueue.toArray()
        return items.filter(item => item.retryCount >= MAX_RETRY_COUNT)
    }

    /**
     * Reset dead-letter items for retry (force sync)
     */
    async function resetDeadLetterItems(): Promise<number> {
        if (!import.meta.client) return 0

        const deadItems = await getDeadLetterItems()
        let resetCount = 0

        for (const item of deadItems) {
            await db.syncQueue.update(item.id, {
                retryCount: 0,
                nextRetryAt: undefined,
                lastError: undefined
            })
            resetCount++
        }

        await refreshPendingCount()
        console.log(`[SyncQueue] Reset ${resetCount} dead-letter items for retry`)
        return resetCount
    }

    /**
     * Force sync all pending items now
     */
    async function forceSyncNow(): Promise<{ success: number; failed: number; reset: number }> {
        if (!import.meta.client) return { success: 0, failed: 0, reset: 0 }

        // First reset any dead-lettered items
        const resetCount = await resetDeadLetterItems()

        // Then process the queue
        const result = await processSyncQueue()

        return { ...result, reset: resetCount }
    }

    /**
     * Refresh the pending sync count
     */
    async function refreshPendingCount(): Promise<void> {
        if (!import.meta.client) {
            pendingSyncCount.value = 0
            return
        }
        // Count only items that haven't exceeded max retries
        const items = await db.syncQueue.toArray()
        pendingSyncCount.value = items.filter(i => i.retryCount < MAX_RETRY_COUNT).length
    }

    // Initialize pending count on client
    if (import.meta.client) {
        refreshPendingCount()
    }

    // ============================================
    // BULK OPERATIONS
    // ============================================

    /**
     * Seed exercises from API response
     */
    async function seedExercises(exercises: Omit<Exercise, 'personal_best_weight' | 'last_3_weights_history'>[]): Promise<void> {
        if (!import.meta.client) return

        const augmentedExercises: Exercise[] = exercises.map(ex => ({
            ...ex,
            personal_best_weight: 0,
            last_3_weights_history: []
        }))

        await db.exercises.bulkPut(augmentedExercises)
    }

    /**
     * Seed schedules from API response
     */
    async function seedSchedules(schedules: Schedule[]): Promise<void> {
        if (!import.meta.client) return
        await db.schedules.bulkPut(schedules)
    }

    /**
     * Clear all session logs for a schedule (for reset)
     */
    async function clearSessionLogs(scheduleId: string): Promise<void> {
        if (!import.meta.client) return
        await db.sessionLogs.where('schedule_id').equals(scheduleId).delete()
    }

    // ============================================
    // RETURN
    // ============================================

    return {
        // Reactive queries
        getTodaySchedules,
        getSessionLogs,
        getExercise,
        getExercisePBs,
        getPlannedExercises,
        fetchPlannedExercises,

        // Planned Exercise CRUD
        addPlannedExercise,
        addPlannedExerciseWithSync,
        removePlannedExercise,
        removePlannedExerciseWithSync,
        removePlannedExerciseByKeys,
        updatePlannedExercise: updatePlannedExerciseWithSync, // Alias for backward compatibility if needed, or just rename
        updatePlannedExerciseWithSync,
        updatePlannedExerciseByKeys,
        seedPlannedExercises,

        // Mutations
        saveSetLog,
        saveSchedule,
        getSchedule,
        createSchedule,
        createScheduleWithSync,
        deleteSchedule,
        deleteScheduleWithSync,
        getCachedMembers,
        updateScheduleStatus,
        saveExercise,

        // Sync operations (requires auth)
        syncClients,
        syncSchedules,

        // Sync queue (idempotent with correlation context)
        queueSync,
        getPendingSyncItems,
        removeSyncItem,
        markSyncFailed,
        processSyncQueue,
        getDeadLetterItems,
        resetDeadLetterItems,
        forceSyncNow,
        refreshPendingCount,

        // Bulk operations
        seedExercises,
        seedSchedules,
        clearSessionLogs,

        // Global state
        isSyncing,
        pendingSyncCount,
        isOnline
    }
}
