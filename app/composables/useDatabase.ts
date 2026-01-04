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
     * Update a planned exercise
     */
    async function updatePlannedExercise(id: string, data: Partial<PlannedExercise>): Promise<void> {
        if (!import.meta.client) return
        await db.plannedExercises.update(id, data)
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
    async function saveSetLog(log: Omit<SessionLog, 'id' | 'is_new_pb' | 'velocity_delta'>): Promise<SessionLog> {
        if (!import.meta.client) throw new Error('Client-side only')

        // Get exercise for PB check
        let is_new_pb = false
        let velocity_delta: number | undefined

        const exercise = await db.exercises.get(log.exercise_id)
        if (exercise && log.weight) {
            is_new_pb = checkIfNewPB(log.weight, exercise.personal_best_weight)
            velocity_delta = calculateVelocityDelta(log.weight, exercise.last_3_weights_history)

            // Update exercise PB if new record
            if (is_new_pb) {
                await db.exercises.update(log.exercise_id, {
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
            // Update existing log
            const updatedLog: SessionLog = {
                ...log,
                id: existing.id,
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
                is_new_pb,
                velocity_delta,
                completed_at: log.completed ? new Date().toISOString() : undefined
            }
            await db.sessionLogs.add(newLog)
            return newLog
        }
    }

    /**
     * Save or update a schedule
     */
    async function saveSchedule(schedule: Schedule): Promise<void> {
        if (!import.meta.client) return
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

            for (const item of items) {
                try {
                    // Build request with X-Correlation-ID header
                    const headers: Record<string, string> = {
                        'Content-Type': 'application/json',
                        'X-Correlation-ID': item.correlation_id,
                        ...(item.headers || {})
                    }

                    const response = await fetch(item.url, {
                        method: item.method,
                        headers,
                        body: item.body
                    })

                    if (response.ok) {
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
        removePlannedExercise,
        removePlannedExerciseByKeys,
        updatePlannedExercise,
        updatePlannedExerciseByKeys,
        seedPlannedExercises,

        // Mutations
        saveSetLog,
        saveSchedule,
        getSchedule,
        createSchedule,
        getCachedMembers,
        updateScheduleStatus,
        saveExercise,

        // Sync queue (idempotent with correlation context)
        queueSync,
        getPendingSyncItems,
        removeSyncItem,
        markSyncFailed,
        processSyncQueue,
        getDeadLetterItems,
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
