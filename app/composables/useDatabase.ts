/**
 * Database Repository Composable
 * Provides reactive queries and mutations for offline-first data access
 */
import { db, type Schedule, type SessionLog, type SyncQueueItem, type Exercise, type PlannedExercise, type CachedMember, type SetLog, getTodayRange, checkIfNewPB, calculateVelocityDelta } from '~/utils/db'
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

    async function syncMasterExercises(): Promise<number> {
        if (!import.meta.client) return 0
        try {
            const api = useApi()
            const exercises = await api.fetchMasterExercises() as any[]

            if (!exercises || exercises.length === 0) return 0

            // Map backend fields to local schema
            const localExercises: Exercise[] = exercises.map(e => ({
                id: e.id,
                name: e.name,
                muscle_group: e.muscle_group,
                equipment: e.equipment,
                video_url: e.video_url,
                personal_best_weight: 0,
                last_3_weights_history: []
            }))

            await db.exercises.bulkPut(localExercises)
            console.log(`[Database] Synced ${localExercises.length} master exercises`)
            return localExercises.length
        } catch (error) {
            console.error('[Database] Failed to sync master exercises:', error)
            return 0
        }
    }
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
        const id = generateId()
        await db.plannedExercises.add({ ...exercise, id, remote_id: null, sync_status: 'pending' })

        // 2. Queue Sync (include client_id for dual-identity handshake)
        const config = useRuntimeConfig()
        const baseUrl = config.public.apiBase || ''

        // Resolve schedule's remote_id for the backend URL
        const schedule = await db.schedules.get(exercise.schedule_id)
        const backendScheduleId = schedule?.remote_id || exercise.schedule_id

        // Resolve exercise's remote_id for the backend request body
        // For exercises from backend, use remote_id (MongoDB ObjectID)
        // For newly created local exercises, use the local id (ULID - backend will resolve via client_id)
        const localExercise = await db.exercises.get(exercise.exercise_id)
        const backendExerciseId = localExercise?.remote_id || exercise.exercise_id

        await queueSync({
            method: 'POST',
            url: `${baseUrl}/v1/pro/schedules/${backendScheduleId}/exercises`,
            body: JSON.stringify({
                client_id: id, // Local ULID for identity handshake
                exercise_id: backendExerciseId, // Use resolved backend ID
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
                backend_schedule_id: backendScheduleId,
                local_exercise_id: exercise.exercise_id,
                backend_exercise_id: backendExerciseId
            }
        })

        return id
    }

    /**
     * CASCADE CANCELLATION HELPERS
     * Cancel all pending sync operations for an entity and its children
     */

    /**
     * Cancel all pending operations related to an exercise (sets, updates, etc.)
     * Uses hybrid matching: context metadata + URL parsing for robustness
     */
    async function cancelPendingOperationsForExercise(exerciseId: string): Promise<number> {
        if (!import.meta.client) return 0

        const orphanedOps = await db.syncQueue
            .filter(item => {
                // Match by context metadata (preferred)
                if (item.context?.planned_exercise_id === exerciseId ||
                    item.context?.temp_id === exerciseId) {
                    return true
                }

                // Fallback: Match by URL pattern
                if (item.url?.includes(`/exercises/${exerciseId}`) ||
                    item.url?.includes(`/exercises/${exerciseId}/sets`)) {
                    return true
                }

                return false
            })
            .toArray()

        let cancelledCount = 0
        for (const op of orphanedOps) {
            await removeSyncItem(op.id)
            console.log(`[Sync] Cascade cancel: ${op.method} ${op.url} (exercise ${exerciseId})`)
            cancelledCount++
        }

        return cancelledCount
    }

    /**
     * Cancel all pending operations related to a schedule (exercises, sets, updates)
     * Includes deep cascade: schedule → exercises → sets
     */
    async function cancelPendingOperationsForSchedule(scheduleId: string): Promise<number> {
        if (!import.meta.client) return 0

        // Step 1: Find all exercises pending for this schedule
        const pendingExercises = await db.syncQueue
            .filter(item =>
                item.context?.type === 'exercise_add' &&
                (item.context?.schedule_id === scheduleId || item.context?.backend_schedule_id === scheduleId)
            )
            .toArray()

        // Step 2: Cancel operations for each exercise (including their sets)
        let cancelledCount = 0
        for (const exOp of pendingExercises) {
            const exId = exOp.context?.temp_id
            if (exId) {
                const exCancelled = await cancelPendingOperationsForExercise(exId)
                cancelledCount += exCancelled
            }
        }

        // Step 3: Cancel schedule-level operations (updates, the schedule itself)
        // BUT: Preserve important operations like status updates and completion
        const scheduleOps = await db.syncQueue
            .filter(item => {
                // CRITICAL: Never cancel status updates or completion requests
                // These represent important state transitions that should always sync
                if (item.context?.type === 'schedule_status_update' ||
                    item.context?.type === 'session_complete') {
                    return false // Preserve these
                }

                // Match by context
                if (item.context?.schedule_id === scheduleId ||
                    item.context?.backend_schedule_id === scheduleId ||
                    item.context?.temp_id === scheduleId) {
                    return true
                }

                // Fallback: Match by URL (but exclude status and complete endpoints)
                if (item.url?.includes(`/schedules/${scheduleId}`) &&
                    !item.url?.includes('/status') &&
                    !item.url?.includes('/complete')) {
                    return true
                }

                return false
            })
            .toArray()

        for (const op of scheduleOps) {
            await removeSyncItem(op.id)
            console.log(`[Sync] Cascade cancel: ${op.method} ${op.url} (schedule ${scheduleId})`)
            cancelledCount++
        }

        return cancelledCount
    }

    /**
     * Remove a planned exercise with sync (Dual-Identity aware)
     */
    async function removePlannedExerciseWithSync(id: string): Promise<void> {
        if (!import.meta.client) return

        const entity = await db.plannedExercises.get(id)
        if (!entity) return // Already deleted

        // 0. CASCADE CANCEL all pending operations for this exercise (sets, updates, etc.)
        const cancelledCount = await cancelPendingOperationsForExercise(id)
        if (cancelledCount > 0) {
            console.log(`[Sync] Cascade cancelled ${cancelledCount} operations for exercise ${id}`)
        }

        // 1. Cleanup local set logs (Atomic Set Logs)
        // Ensure strictly associated logs are removed locally to reflect UI state immediately
        await db.setLogs.where('planned_exercise_id').equals(id).delete()

        // Scenario A: Not synced yet (remote_id is null or undefined)
        // Also check if id looks like a MongoDB ObjectID (legacy synced records before migration)
        const isMongoObjectId = /^[a-f0-9]{24}$/.test(id)

        if (!entity.remote_id && !isMongoObjectId) {
            // Cancel pending POST in syncQueue (if cascade didn't already get it)
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

    // ============================================
    // ATOMIC SET SYNC (new set_logs collection)
    // ============================================

    /**
     * Update a set log with sync to backend
     * Uses PUT /v1/pro/sets/:id
     */
    async function updateSetLogWithSync(
        setId: string,
        updates: { weight?: number; reps?: number; remarks?: string; completed?: boolean }
    ): Promise<void> {
        if (!import.meta.client) return

        const setLog = await db.setLogs.get(setId)
        if (!setLog) {
            console.error(`[Sync] SetLog not found: ${setId}`)
            return
        }

        // 1. Update locally (optimistic)
        const updatedLog = {
            ...setLog,
            weight: updates.weight ?? setLog.weight,
            reps: updates.reps ?? setLog.reps,
            remarks: updates.remarks ?? setLog.remarks,
            completed: updates.completed ?? setLog.completed
        }
        await db.setLogs.put(updatedLog)

        // 2. Queue sync to backend
        const backendId = setLog.remote_id || setId
        const config = useRuntimeConfig()
        const baseUrl = config.public.apiBase || ''

        await queueSync({
            method: 'PUT',
            url: `${baseUrl}/v1/pro/sets/${backendId}`,
            body: JSON.stringify({
                weight: updatedLog.weight,
                reps: updatedLog.reps,
                remarks: updatedLog.remarks,
                completed: updatedLog.completed
            }),
            priority: 'normal',
            context: {
                type: 'set_update',
                set_id: setId,
                planned_exercise_id: setLog.planned_exercise_id
            }
        })
        console.log(`[Sync] Queued set update: ${setId}`)
        console.log(`[Sync] Queued set update: ${setId}`)
    }

    /**
 * Delete a set log with sync to backend
 * Uses DELETE /v1/pro/sets/:id
 */
    async function deleteSetLogWithSync(setId: string): Promise<void> {
        if (!import.meta.client) return

        // Smart Deletion: Check if this set is pending creation
        // If it is, we can just remove the pending create request and delete locally
        // This allows offline create -> delete without sending any network traffic
        const pendingCreate = await db.syncQueue
            .filter(item => item.context?.type === 'set_add' && item.context?.temp_id === setId)
            .first()

        if (pendingCreate) {
            await removeSyncItem(pendingCreate.id)
            console.log(`[Sync] Smart Deletion: Cancelled pending set creation for ${setId}`)
            // Delete locally
            await db.setLogs.delete(setId)
            return
        }

        const setLog = await db.setLogs.get(setId)
        if (!setLog) {
            // Maybe already deleted, but check if we need to clean up anyway
            // If we don't have the log, we can't know the remote_id easily unless we trust setId is remote_id
            // But let's assume if it's not in DB, it's gone
            return
        }

        // 1. Delete locally
        await db.setLogs.delete(setId)

        // 2. Queue sync to backend
        // CRITICAL: Use remote_id if available, otherwise fallback to setId (legacy or already synced but not updated locally?)
        // If it was synced, it SHOULD have remote_id. If not, and not pending, maybe it's a legacy ID.
        const backendId = setLog.remote_id || setId
        const config = useRuntimeConfig()
        const baseUrl = config.public.apiBase || ''

        await queueSync({
            method: 'DELETE',
            url: `${baseUrl}/v1/pro/sets/${backendId}`,
            priority: 'normal',
            context: {
                type: 'set_delete',
                set_id: setId,
                remote_id: backendId
            }
        })
        console.log(`[Sync] Queued set delete: ${setId} (remote: ${backendId})`)
    }
    /**
     * Add a new set to an exercise with sync
     * Uses POST /v1/pro/exercises/:id/sets
     */
    async function addSetWithSync(
        plannedExerciseId: string,
        setIndex: number
    ): Promise<SetLog> {
        if (!import.meta.client) throw new Error('Client-side only')

        const plannedExercise = await db.plannedExercises.get(plannedExerciseId)
        if (!plannedExercise) {
            throw new Error(`PlannedExercise not found: ${plannedExerciseId}`)
        }

        // Get schedule for member_id
        const schedule = await db.schedules.get(plannedExercise.schedule_id)

        // Create local set log
        const newSetLog: SetLog = {
            id: generateId(),
            remote_id: null,
            sync_status: 'pending',
            planned_exercise_id: plannedExerciseId,
            schedule_id: plannedExercise.schedule_id,
            member_id: schedule?.member_id || '',
            exercise_id: plannedExercise.exercise_id,
            set_index: setIndex,
            weight: 0,
            reps: 0,
            remarks: '',
            completed: false
        }
        await db.setLogs.add(newSetLog)

        // Queue sync to backend
        const backendExId = plannedExercise.remote_id || plannedExerciseId
        const config = useRuntimeConfig()
        const baseUrl = config.public.apiBase || ''

        await queueSync({
            method: 'POST',
            url: `${baseUrl}/v1/pro/exercises/${backendExId}/sets`,
            body: JSON.stringify({
                client_id: newSetLog.id,
                set_index: setIndex
            }),
            priority: 'normal',
            context: {
                type: 'set_add',
                temp_id: newSetLog.id,
                planned_exercise_id: plannedExerciseId
            }
        })
        console.log(`[Sync] Queued new set: ${newSetLog.id} for exercise ${plannedExerciseId}`)

        return newSetLog
    }

    /**
     * Get set logs for a planned exercise (reactive)
     */
    function getSetLogs(plannedExerciseId: string) {
        const sets = ref<SetLog[]>([])
        const loading = ref(true)

        if (import.meta.client) {
            const subscription = liveQuery(async () => {
                return await db.setLogs
                    .where('planned_exercise_id')
                    .equals(plannedExerciseId)
                    .sortBy('set_index')
            }).subscribe({
                next: (result) => {
                    sets.value = result
                    loading.value = false
                },
                error: () => {
                    loading.value = false
                }
            })

            onUnmounted(() => subscription.unsubscribe())
        }

        return { sets, loading }
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
     * Update schedule status with sync
     */
    async function updateScheduleStatusWithSync(
        scheduleId: string,
        status: Schedule['status'],
        remarks?: string
    ): Promise<void> {
        if (!import.meta.client) return

        // Get schedule to resolve remote_id
        const schedule = await db.schedules.get(scheduleId)
        if (!schedule) return

        // 1. Update locally (optimistic)
        const updates: Partial<Schedule> = { status }
        if (status === 'completed') {
            updates.completed_at = new Date().toISOString()
        }
        if (remarks) {
            updates.coach_remarks = remarks
        }

        await db.schedules.update(scheduleId, updates)

        // 2. Queue sync to backend
        const isMongoObjectId = /^[a-f0-9]{24}$/.test(scheduleId)
        const backendId = schedule.remote_id || (isMongoObjectId ? scheduleId : null)

        if (backendId) {
            const config = useRuntimeConfig()
            const baseUrl = config.public.apiBase || ''

            await queueSync({
                method: 'PUT',
                url: `${baseUrl}/v1/pro/schedules/${backendId}/status`,
                body: JSON.stringify({ status }),
                priority: 'high',
                context: {
                    type: 'schedule_status_update',
                    schedule_id: scheduleId,
                    status
                }
            })
            console.log(`[Sync] Queued status update: ${scheduleId} → ${status}`)
        } else {
            // Schedule not synced yet - update the pending create body
            const pendingCreate = await db.syncQueue
                .filter(item => item.context?.type === 'schedule_create' && item.context?.schedule_id === scheduleId)
                .first()

            if (pendingCreate && pendingCreate.body) {
                const existingBody = JSON.parse(pendingCreate.body)
                const mergedBody = { ...existingBody, status }
                await db.syncQueue.update(pendingCreate.id, { body: JSON.stringify(mergedBody) })
                console.log(`[Sync] Merged status update into pending POST for schedule ${scheduleId}`)
            }
        }
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
     * Get members as a reactive query (live updates)
     */
    function getMembers() {
        const members = ref<CachedMember[]>([])
        const loading = ref(true)
        const error = ref<Error | null>(null)

        if (import.meta.client) {
            const subscription = liveQuery(async () => {
                return await db.cachedMembers.orderBy('name').toArray()
            }).subscribe({
                next: (result) => {
                    members.value = result
                    loading.value = false
                },
                error: (err) => {
                    error.value = err
                    loading.value = false
                }
            })

            onUnmounted(() => subscription.unsubscribe())
        }

        return { members, loading, error }
    }

    /**
     * Get all cached members for dropdown (non-reactive)
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
            // Use lightweight endpoint for faster sync
            const clients = await api.fetchClientsSimple()

            // Convert to cached members and bulk upsert
            const members = clients.map(api.clientToCachedMember)
            await db.cachedMembers.bulkPut(members)

            console.log(`[Database] Synced ${members.length} clients from API (simple)`)
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
     * Sync Sets for a schedule (Fetch & Upsert)
     */
    async function syncScheduleSets(scheduleId: string): Promise<number> {
        if (!import.meta.client) return 0

        try {
            const api = useApi()
            const sets = await api.fetchSets(scheduleId) as any[]

            if (!sets || sets.length === 0) return 0

            // Pre-fetch all planned exercises for this schedule to resolve IDs
            // We need to map Backend ID (Mongo) -> Frontend ID (ULID)
            const exercises = await db.plannedExercises
                .where('remote_id')
                .anyOf(sets.map(s => s.planned_exercise_id))
                .toArray()

            const mongoToUlidMap = new Map<string, string>()
            exercises.forEach(ex => {
                if (ex.remote_id) mongoToUlidMap.set(ex.remote_id, ex.id)
            })

            // Convert to SetLog format
            const setLogs: SetLog[] = sets.map(s => {
                // If we can resolve the planned exercise to a local ULID, use it.
                // Otherwise fall back to the backend ID (which might happen if exercise sync failed or race condition)
                const localExerciseId = mongoToUlidMap.get(s.planned_exercise_id) || s.planned_exercise_id

                return {
                    id: s.client_id || s.id, // Prefer client_id if available
                    remote_id: s.id,
                    sync_status: 'synced',
                    planned_exercise_id: localExerciseId,
                    schedule_id: s.schedule_id,
                    member_id: s.member_id,
                    exercise_id: s.exercise_id,
                    set_index: s.set_index,
                    weight: s.weight,
                    reps: s.reps,
                    remarks: s.remarks,
                    completed: s.completed
                }
            })

            await db.setLogs.bulkPut(setLogs)
            console.log(`[Database] Synced ${setLogs.length} sets for schedule ${scheduleId}`)
            return setLogs.length
        } catch (error: any) {
            console.error(`[Database] Failed to sync sets for ${scheduleId}:`, error)
            return 0
        }
    }

    /**
     * Sync Planned Exercises for a schedule
     */
    async function syncPlannedExercises(scheduleId: string): Promise<number> {
        if (!import.meta.client) return 0

        try {
            const api = useApi()
            const exercises = await api.fetchExercises(scheduleId) as any[]

            if (!exercises || exercises.length === 0) return 0

            // Convert to PlannedExercise format
            const plannedExercises: PlannedExercise[] = exercises.map(e => ({
                id: e.client_id || e.id, // Prefer client_id
                remote_id: e.id,
                sync_status: 'synced',
                schedule_id: e.schedule_id,
                exercise_id: e.exercise_id,
                name: e.name,
                target_sets: e.target_sets,
                target_reps: e.target_reps,
                rest_seconds: e.rest_seconds,
                notes: e.notes,
                order: e.order
            }))

            await db.plannedExercises.bulkPut(plannedExercises)
            console.log(`[Database] Synced ${plannedExercises.length} exercises for schedule ${scheduleId}`)
            return plannedExercises.length
        } catch (error: any) {
            console.error(`[Database] Failed to sync exercises for ${scheduleId}:`, error)
            return 0
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

        const schedule = await db.schedules.get(scheduleId)
        const remoteId = schedule?.remote_id

        await db.schedules.delete(scheduleId)

        // Also delete any planned exercises and set logs for this schedule
        // Query by local ID or remote ID to ensure cleanup
        const keys = [scheduleId]
        if (remoteId) keys.push(remoteId)

        await db.plannedExercises.where('schedule_id').anyOf(keys).delete()
        await db.sessionLogs.where('schedule_id').anyOf(keys).delete() // Legacy
        await db.setLogs.where('schedule_id').anyOf(keys).delete() // Atomic Sets

        console.log(`[Database] Deleted schedule ${scheduleId} (and cascaded sets)`)
    }

    /**
     * Delete schedule with local-first + sync queue (Dual-Identity aware)
     */
    async function deleteScheduleWithSync(scheduleId: string): Promise<void> {
        if (!import.meta.client) throw new Error('Client-side only')

        const entity = await db.schedules.get(scheduleId)

        // 0. CASCADE CANCEL all pending operations for this schedule (exercises, sets, updates)
        const cancelledCount = await cancelPendingOperationsForSchedule(scheduleId)
        if (cancelledCount > 0) {
            console.log(`[Sync] Deep cascade cancelled ${cancelledCount} operations for schedule ${scheduleId}`)
        }

        // 1. Delete local associated data
        const keys = [scheduleId]
        if (entity?.remote_id) keys.push(entity.remote_id)

        await db.plannedExercises.where('schedule_id').anyOf(keys).delete()
        await db.sessionLogs.where('schedule_id').anyOf(keys).delete()
        await db.setLogs.where('schedule_id').anyOf(keys).delete()

        if (!entity) {
            // Already deleted? Just clean up
            await db.schedules.delete(scheduleId)
            return
        }

        // Scenario A: Not synced yet (remote_id is null or undefined)
        // Also check if id looks like a MongoDB ObjectID (legacy synced records before migration)
        const isMongoObjectId = /^[a-f0-9]{24}$/.test(scheduleId)

        if (!entity.remote_id && !isMongoObjectId) {
            // Cancel pending POST in syncQueue (Schedule Create) - if cascade didn't already get it
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
        // Use navigator.onLine as fallback for mobile browsers
        if (isOnline.value || navigator.onLine) {
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
        if (!import.meta.client) {
            return { success: 0, failed: 0 }
        }

        // Check if already syncing
        if (isSyncing.value) {
            console.log('[SyncQueue] Already syncing, skipping...')
            return { success: 0, failed: 0 }
        }

        // Use navigator.onLine as fallback if isOnline ref is false
        // Mobile browsers can have unreliable navigator.onLine, but if GET requests work, we're online
        const effectivelyOnline = isOnline.value || navigator.onLine
        if (!effectivelyOnline) {
            console.log('[SyncQueue] Offline (isOnline:', isOnline.value, ', navigator.onLine:', navigator.onLine, '), skipping sync')
            return { success: 0, failed: 0 }
        }

        isSyncing.value = true
        let success = 0
        let failed = 0
        let tokenRefreshed = false  // Track if we've already refreshed this cycle

        try {
            const items = await getPendingSyncItems()
            console.log(`[SyncQueue] Processing ${items.length} pending items (online: ${effectivelyOnline})`)

            // Get auth token from cookie
            const metamorphToken = useCookie<string | null>('metamorph-token')
            if (!metamorphToken.value) {
                console.warn('[SyncQueue] No auth token available, attempting refresh...')
                // Try to refresh token before giving up
                const refreshed = await attemptTokenRefresh(metamorphToken)
                if (!refreshed) {
                    console.warn('[SyncQueue] Token refresh failed, skipping sync')
                    return { success: 0, failed: 0 }
                }
                tokenRefreshed = true
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

                    let response = await fetch(item.url, {
                        method: item.method,
                        headers,
                        body: item.body
                    })

                    // Handle 401 - Token expired, try to refresh and retry ONCE
                    if (response.status === 401 && !tokenRefreshed) {
                        console.log('[SyncQueue] Got 401, attempting token refresh...')
                        const refreshed = await attemptTokenRefresh(metamorphToken)

                        if (refreshed) {
                            tokenRefreshed = true
                            console.log('[SyncQueue] Token refreshed, retrying request...')

                            // Retry with new token
                            headers['Authorization'] = `Bearer ${metamorphToken.value}`
                            response = await fetch(item.url, {
                                method: item.method,
                                headers,
                                body: item.body
                            })
                        } else {
                            // Refresh failed - user needs to re-login
                            console.error('[SyncQueue] Token refresh failed, user needs to re-login')
                            await markSyncFailed(item.id, 'Auth token expired, please login again')
                            failed++
                            continue
                        }
                    }

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

                        // Handle global exercise creation - populate remote_id (Dual-Identity)
                        // This is for exercises created via createCustomExercise (not planned exercises)
                        if (item.method === 'POST' && item.context?.type === 'exercise_create') {
                            try {
                                const backendEx = await response.json()
                                const localId = item.context.temp_id
                                if (backendEx.id && localId) {
                                    // Update local exercise with remote_id
                                    await db.exercises.update(localId, {
                                        remote_id: backendEx.id
                                    })
                                    console.log(`[Sync] Linked global exercise: ${localId} → ${backendEx.id}`)

                                    // Rewrite pending exercise_add items that reference this exercise
                                    // They may have used the ULID as exercise_id in the body
                                    const pendingAdds = await db.syncQueue
                                        .filter(q => q.context?.type === 'exercise_add' && q.context?.local_exercise_id === localId)
                                        .toArray()

                                    for (const pending of pendingAdds) {
                                        if (pending.body) {
                                            try {
                                                const bodyObj = JSON.parse(pending.body)
                                                if (bodyObj.exercise_id === localId) {
                                                    bodyObj.exercise_id = backendEx.id
                                                    await db.syncQueue.update(pending.id, {
                                                        body: JSON.stringify(bodyObj)
                                                    })
                                                    console.log(`[Sync] Fixed pending add: exercise_id ${localId} → ${backendEx.id}`)
                                                }
                                            } catch (e) {
                                                console.warn('[Sync] Could not update pending add body:', e)
                                            }
                                        }
                                    }
                                }
                            } catch (e) {
                                console.error('[SyncQueue] Failed to update local global exercise:', e)
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

                                    // Rewrite pending URL for Sets dependent on this exercise
                                    // They would have URL: /v1/pro/exercises/<ULID>/sets
                                    // Need URL: /v1/pro/exercises/<MongoID>/sets
                                    const pendingSets = await db.syncQueue
                                        .filter(q => q.context?.type === 'set_add' && q.context?.planned_exercise_id === localId)
                                        .toArray()

                                    for (const pendingSet of pendingSets) {
                                        const newUrl = pendingSet.url.replace(localId, backendEx.id)
                                        await db.syncQueue.update(pendingSet.id, { url: newUrl })
                                        console.log(`[Sync] Fixed pending set URL for set ${pendingSet.context?.set_index}`)
                                    }
                                }
                            } catch (e) {
                                console.error('[SyncQueue] Failed to update local exercise IDs:', e)
                            }
                        }

                        // Handle set creation - populate remote_id
                        if (item.method === 'POST' && item.context?.type === 'set_add') {
                            try {
                                const backendSet = await response.json()
                                const localSetId = item.context.temp_id
                                if (backendSet.id && localSetId) {
                                    await db.setLogs.update(localSetId, {
                                        remote_id: backendSet.id,
                                        sync_status: 'synced',
                                        planned_exercise_id: backendSet.planned_exercise_id // Ensure MongoID linkage on sync
                                    })
                                    console.log(`[Sync] Linked set: ${localSetId} → ${backendSet.id}`)
                                }
                            } catch (e) {
                                console.error('[SyncQueue] Failed to update local set remote_id:', e)
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
                    } else if ((item.method === 'DELETE' || item.method === 'PUT') && response.status === 404) {
                        // DELETE/PUT + 404 = Target doesn't exist = Operation is irrelevant/done
                        await removeSyncItem(item.id)
                        success++
                        console.log(`[SyncQueue] Target missing (404) - Dropping operation: ${item.method} ${item.url}`)
                    } else if (response.status === 401) {
                        // 401 after token refresh attempt - user must re-login
                        const errorText = await response.text()
                        await markSyncFailed(item.id, `Auth expired: ${errorText}`)
                        failed++
                        console.error(`[SyncQueue] Auth failed after refresh: ${item.url}`)
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
     * Attempt to refresh the access token using refresh token cookie
     * Returns true if refresh succeeded, false otherwise
     */
    async function attemptTokenRefresh(tokenRef: Ref<string | null>): Promise<boolean> {
        try {
            console.log('[SyncQueue] Calling /api/v1/auth/refresh...')
            const response = await fetch('/api/v1/auth/refresh', {
                method: 'POST',
                credentials: 'include',  // Include httpOnly refresh token cookie
                headers: {
                    'Content-Type': 'application/json'
                }
            })

            if (response.ok) {
                const data = await response.json()
                if (data.token) {
                    tokenRef.value = data.token
                    console.log('[SyncQueue] Token refresh successful!')
                    return true
                }
            }

            console.error('[SyncQueue] Token refresh failed:', response.status)
            return false
        } catch (error) {
            console.error('[SyncQueue] Token refresh error:', error)
            return false
        }
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
     * Trigger a full resync of all local data
     * This is useful after backend data fixes to ensure everything is in sync
     * It will re-queue all synced schedules, exercises, and sets for upload
     */
    async function triggerFullResync(): Promise<{ success: number; failed: number }> {
        if (!import.meta.client) return { success: 0, failed: 0 }

        console.log('[FullResync] Starting full data resync...')
        const config = useRuntimeConfig()
        const baseUrl = config.public.apiBase || ''

        let queuedCount = 0

        // 1. Get all schedules that have been synced (have remote_id)
        const syncedSchedules = await db.schedules
            .filter(s => s.remote_id !== null && s.sync_status === 'synced')
            .toArray()

        console.log(`[FullResync] Found ${syncedSchedules.length} synced schedules to re-sync`)

        // 2. Re-queue each schedule for resync (just update the schedule data)
        for (const schedule of syncedSchedules) {
            await queueSync({
                method: 'PUT',
                url: `${baseUrl}/v1/pro/schedules/${schedule.remote_id}`,
                body: JSON.stringify({
                    start_time: schedule.start_time,
                    end_time: schedule.end_time,
                    session_goal: schedule.session_goal,
                    status: schedule.status,
                    coach_remarks: schedule.coach_remarks
                }),
                priority: 'low',
                context: {
                    type: 'schedule_resync',
                    schedule_id: schedule.id,
                    remote_id: schedule.remote_id
                }
            })
            queuedCount++
        }

        // 3. Get all synced planned exercises
        const syncedExercises = await db.plannedExercises
            .filter(e => e.remote_id !== null && e.sync_status === 'synced')
            .toArray()

        console.log(`[FullResync] Found ${syncedExercises.length} synced exercises to re-sync`)

        for (const exercise of syncedExercises) {
            await queueSync({
                method: 'PUT',
                url: `${baseUrl}/v1/pro/exercises/${exercise.remote_id}`,
                body: JSON.stringify({
                    target_sets: exercise.target_sets,
                    target_reps: exercise.target_reps,
                    rest_seconds: exercise.rest_seconds,
                    notes: exercise.notes,
                    order: exercise.order
                }),
                priority: 'low',
                context: {
                    type: 'exercise_resync',
                    exercise_id: exercise.id,
                    remote_id: exercise.remote_id
                }
            })
            queuedCount++
        }

        // 4. Get all synced set logs
        const syncedSets = await db.setLogs
            .filter(s => s.remote_id !== null && s.sync_status === 'synced')
            .toArray()

        console.log(`[FullResync] Found ${syncedSets.length} synced sets to re-sync`)

        for (const setLog of syncedSets) {
            await queueSync({
                method: 'PUT',
                url: `${baseUrl}/v1/pro/sets/${setLog.remote_id}`,
                body: JSON.stringify({
                    weight: setLog.weight,
                    reps: setLog.reps,
                    remarks: setLog.remarks,
                    completed: setLog.completed
                }),
                priority: 'low',
                context: {
                    type: 'set_resync',
                    set_id: setLog.id,
                    remote_id: setLog.remote_id
                }
            })
            queuedCount++
        }

        console.log(`[FullResync] Queued ${queuedCount} items for resync, now processing...`)

        // 5. Process the queue
        await refreshPendingCount()
        const result = await processSyncQueue()

        console.log(`[FullResync] Complete: ${result.success} synced, ${result.failed} failed`)
        return result
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
        seedPlannedExercises,

        // Mutations
        saveSetLog,
        saveSchedule,
        getSchedule,
        createSchedule,
        createScheduleWithSync,
        deleteSchedule,
        deleteScheduleWithSync,
        getMembers,
        getCachedMembers,
        updateScheduleStatusWithSync,
        saveExercise,

        // Atomic Set Sync (new set_logs collection)
        updateSetLogWithSync,
        addSetWithSync,
        deleteSetLogWithSync,
        getSetLogs,

        // Sync operations (requires auth)
        syncClients,
        syncSchedules,
        syncScheduleSets,
        syncPlannedExercises,
        syncMasterExercises,

        // Sync queue (idempotent with correlation context)
        queueSync,
        getPendingSyncItems,
        removeSyncItem,
        markSyncFailed,
        processSyncQueue,
        getDeadLetterItems,
        resetDeadLetterItems,
        forceSyncNow,
        triggerFullResync,
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
