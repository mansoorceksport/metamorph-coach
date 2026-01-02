/**
 * Database Repository Composable
 * Provides reactive queries and mutations for offline-first data access
 */
import { db, type Schedule, type SessionLog, type SyncQueueItem, type Exercise, type PlannedExercise, getTodayRange, checkIfNewPB, calculateVelocityDelta } from '~/utils/db'
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
    async function addPlannedExercise(exercise: Omit<PlannedExercise, 'id'>): Promise<number> {
        if (!import.meta.client) throw new Error('Client-side only')
        return await db.plannedExercises.add(exercise) as number
    }

    /**
     * Remove a planned exercise from a session
     */
    async function removePlannedExercise(id: number): Promise<void> {
        if (!import.meta.client) return
        await db.plannedExercises.delete(id)
    }

    /**
     * Update a planned exercise
     */
    async function updatePlannedExercise(id: number, data: Partial<PlannedExercise>): Promise<void> {
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

        const sessionLog: SessionLog = {
            ...log,
            is_new_pb,
            velocity_delta,
            completed_at: log.completed ? new Date().toISOString() : undefined
        }

        // Check if log already exists for this schedule+exercise+set
        const existing = await db.sessionLogs
            .where('[schedule_id+exercise_id]')
            .equals([log.schedule_id, log.exercise_id])
            .filter(l => l.set_index === log.set_index)
            .first()

        if (existing?.id) {
            await db.sessionLogs.update(existing.id, sessionLog)
            return { ...sessionLog, id: existing.id }
        } else {
            const id = await db.sessionLogs.add(sessionLog)
            return { ...sessionLog, id: id as number }
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
     * Save or update an exercise
     */
    async function saveExercise(exercise: Exercise): Promise<void> {
        if (!import.meta.client) return
        await db.exercises.put(exercise)
    }

    // ============================================
    // SYNC QUEUE
    // ============================================

    /**
     * Queue a failed API request for later sync
     */
    async function queueSync(
        action: Omit<SyncQueueItem, 'id' | 'timestamp' | 'retryCount'>
    ): Promise<number> {
        if (!import.meta.client) throw new Error('Client-side only')

        const item: SyncQueueItem = {
            ...action,
            timestamp: Date.now(),
            retryCount: 0
        }

        const id = await db.syncQueue.add(item)
        await refreshPendingCount()
        return id as number
    }

    /**
     * Get all pending sync items (oldest first)
     */
    async function getPendingSyncItems(): Promise<SyncQueueItem[]> {
        if (!import.meta.client) return []
        return await db.syncQueue.orderBy('timestamp').toArray()
    }

    /**
     * Remove a sync item after successful sync
     */
    async function removeSyncItem(id: number): Promise<void> {
        if (!import.meta.client) return
        await db.syncQueue.delete(id)
        await refreshPendingCount()
    }

    /**
     * Increment retry count for a failed sync item
     */
    async function incrementRetryCount(id: number, error?: string): Promise<void> {
        if (!import.meta.client) return
        const item = await db.syncQueue.get(id)
        if (item) {
            await db.syncQueue.update(id, {
                retryCount: item.retryCount + 1,
                lastError: error
            })
        }
    }

    /**
     * Refresh the pending sync count
     */
    async function refreshPendingCount(): Promise<void> {
        if (!import.meta.client) {
            pendingSyncCount.value = 0
            return
        }
        pendingSyncCount.value = await db.syncQueue.count()
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
        updateScheduleStatus,
        saveExercise,

        // Sync queue
        queueSync,
        getPendingSyncItems,
        removeSyncItem,
        incrementRetryCount,
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
