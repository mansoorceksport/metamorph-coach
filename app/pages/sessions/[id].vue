<script setup lang="ts">
import type { PlannedExercise } from '~/utils/db'

const route = useRoute()
const sessionId = computed(() => route.params.id as string)

// Database composable
const { 
  getSchedule, 
  fetchPlannedExercises, 
  getExercisePBs,
  saveSetLog: dbSaveSetLog,
  removePlannedExerciseWithSync,
  addPlannedExerciseWithSync,
  updatePlannedExercise,
  // Atomic set sync (new)
  updateSetLogWithSync,
  addSetWithSync,
  syncScheduleSets,
  syncPlannedExercises
} = useDatabase()

// Session Data (loaded from database)
const session = ref({
  id: sessionId.value,
  memberName: 'Loading...',
  goal: '',
  startTime: '',
  status: 'in-progress'
})

// Exercise Data (loaded from database)
// Exercise Data (loaded from database)
const exercises = ref<Array<{
  id: string // Planned Exercise ID (unique instance)
  remoteId?: string | null // Remote ID (MongoID) for synced exercises
  exerciseId: string // Library Exercise ID (for reference/PB)
  name: string
  targetSets: number
  targetReps: number
  restSeconds: number
  notes?: string
}>>([])

// Personal Bests (loaded from database)
const exercisePBs = ref<Record<string, number>>({})

// Loading state
const isLoading = ref(true)

// Load data from database on mount
async function loadSessionData() {
  if (!import.meta.client) return
  
  try {
    // 1. Sync Sets & Exercises (ensure we have backend data)
    // Run sequentially because sets depend on exercises being present to resolve ULIDs
    await syncPlannedExercises(sessionId.value)
    await syncScheduleSets(sessionId.value)

    // Load schedule
    const schedule = await getSchedule(sessionId.value)
    if (schedule) {
      session.value = {
        id: schedule.id,
        memberName: schedule.member_name,
        goal: schedule.session_goal || 'Workout Session',
        startTime: new Date(schedule.start_time).toLocaleTimeString('en-US', { 
          hour: 'numeric', 
          minute: '2-digit',
          hour12: true 
        }),
        status: schedule.status
      }
    }

    // Load planned exercises
    // Use remote_id (Mongo ID) if available, as syned exercises use that. Fallback to local ID (ULID)
    const queryId = schedule?.remote_id || sessionId.value
    const planned = await fetchPlannedExercises(queryId)
    exercises.value = planned.map(ex => ({
      id: ex.id!, // Planned ID (Definite assignment as they come from DB)
      remoteId: ex.remote_id, // Expose remote_id for matching synced set logs
      exerciseId: ex.exercise_id, // Library ID
      name: ex.name,
      targetSets: ex.target_sets,
      targetReps: ex.target_reps,
      restSeconds: ex.rest_seconds,
      notes: ex.notes
    }))

    // Load PBs for these exercises
    const exerciseIds = planned.map(ex => ex.exercise_id)
    if (exerciseIds.length > 0) {
      exercisePBs.value = await getExercisePBs(exerciseIds)
    }

    // Initialize set logs after loading exercises
    await initializeSetLogs() // Made async to load from Dexie
    
    console.log(`[Session] Loaded ${exercises.value.length} exercises for session ${sessionId.value}`)
  } catch (error) {
    console.error('[Session] Failed to load session data:', error)
  } finally {
    isLoading.value = false
  }
}

onMounted(async () => {
  await loadSessionData()
  await loadPersistedLogs()
  await initLibrary()
})

// React to ID changes (e.g. after sync updates ULID -> ObjectId)
watch(sessionId, async (newId) => {
  if (newId) {
    console.log('[Session] ID changed, reloading data:', newId)
    await loadSessionData()
    await loadPersistedLogs()
  }
})

// Set Logs State - tracks weight/reps/completed for each set
// Set Logs State - tracks weight/reps/completed for each set
interface SetLog {
  id?: string // Dexie/Backend ID (optional for optimistic created sets)
  weight: number | null
  reps: number | null
  completed: boolean
}

const setLogs = ref<Record<string, SetLog[]>>({})

// Initialize set logs for each exercise (load from Dexie)
async function initializeSetLogs() {
  if (!import.meta.client) return

  const { getSetLogs } = useDatabase()

  for (const ex of exercises.value) {
    if (!setLogs.value[ex.id]) {
      // 1. Load existing logs from Dexie
      // Query by both local ID (ULID) and remote ID (MongoID) for synced data
      const keys = [ex.id]
      if (ex.remoteId) keys.push(ex.remoteId)
      
      const existingLogs = await db.setLogs
        .where('planned_exercise_id')
        .anyOf(keys)
        .sortBy('set_index')
      
      if (existingLogs.length > 0) {
        console.log(`[Session] Loaded ${existingLogs.length} persisted logs for ${ex.name}`)
        // Map Dexie logs to UI state
        setLogs.value[ex.id] = existingLogs.map(log => ({
          id: log.id,
          weight: log.weight,
          reps: log.reps,
          completed: log.completed
        }))
        
        // Ensure we have enough rows for target sets
        if (setLogs.value[ex.id] && setLogs.value[ex.id].length < ex.targetSets) {
             const diff = ex.targetSets - setLogs.value[ex.id].length
             for (let i = 0; i < diff; i++) {
                 // Create empty UI state for missing sets (will be created on save)
                 setLogs.value[ex.id].push({
                    weight: null,
                    reps: null,
                    completed: false
                 })
             }
        }
      } else {
        // Fallback: Create empty rows
        setLogs.value[ex.id] = Array.from({ length: ex.targetSets }, () => ({
          weight: null,
          reps: null,
          completed: false
        }))
      }
    }
  }
}
// Removed standalone call as it's now awaited in loadSessionData


// Load persisted set logs from Dexie on mount
async function loadPersistedLogs() {
  if (!import.meta.client) return
  
  const { db } = await import('~/utils/db')
  const scheduleId = sessionId.value
  
  try {
    const persistedLogs = await db.sessionLogs
      .where('schedule_id')
      .equals(scheduleId)
      .toArray()
    
    // Apply persisted logs to reactive state
    persistedLogs.forEach(log => {
      if (setLogs.value[log.exercise_id]?.[log.set_index]) {
        setLogs.value[log.exercise_id]![log.set_index] = {
          weight: log.weight,
          reps: log.reps,
          completed: log.completed
        }
      }
    })
    console.log(`[Session] Loaded ${persistedLogs.length} persisted logs from Dexie`)
  } catch (error) {
    console.error('[Session] Failed to load persisted logs:', error)
  }
}

// Auto-save set log to Dexie and sync to backend when changed
async function persistSetLog(exerciseId: string, setIndex: number) {
  if (!import.meta.client) return
  
  const log = setLogs.value[exerciseId]?.[setIndex]
  if (!log) return
  
  const exercise = exercises.value.find(ex => ex.id === exerciseId)
  if (!exercise) return
  
  // Auto-unmark as complete if reps or weight is cleared
  if (log.completed && (!log.reps || !log.weight)) {
    log.completed = false
    console.log(`[Session] Auto-uncompleted set ${setIndex + 1} (data cleared)`)
  }
  
  try {
    // Legacy: Save to sessionLogs table (for backward compatibility)
    await dbSaveSetLog({
      schedule_id: sessionId.value,
      exercise_id: exerciseId,
      exercise_name: exercise.name,
      set_index: setIndex,
      weight: log.weight,
      reps: log.reps,
      completed: log.completed
    })
    
    // NEW: Sync to backend using atomic set_logs collection
    // 1. Resolve Set ID from Dexie if we don't have it
    let setId = log.id
    if (!setId) {
        const dexieLog = await db.setLogs.where('[planned_exercise_id+set_index]').equals([exerciseId, setIndex]).first()
        if (dexieLog) {
            setId = dexieLog.id
            log.id = dexieLog.id // cache it locally
        }
    }

    if (setId) {
        await updateSetLogWithSync(setId, {
            weight: log.weight || 0,
            reps: log.reps || 0,
            remarks: '',
            completed: log.completed
        })
        console.log(`[Session] Persisted and synced set ${setIndex + 1} for ${exercise.name}`)
    } else {
        // Fallback: This set exists locally but has no ID/Entry in Dexie atomic table yet.
        // This likely means we are offline and haven't synced the sets from backend yet,
        // OR it's a new set that hasn't been saved to Dexie setLogs yet.
        // We should create it in Dexie now.
        // But what ID? If we use random ULID, backend sync might fail if backend expects matched ID.
        // However, since we implemented syncScheduleSets, we should have IDs if online.
        console.warn(`[Session] Cannot sync atomic set - missing ID for ${exercise.name} set ${setIndex}`)
        // TODO: Handle this edge case (Create local atomic log?)
    }
  } catch (error) {
    console.error('[Session] Failed to persist/sync set log:', error)
  }
}

// Debounce timer refs for each set
const debounceTimers = ref<Record<string, ReturnType<typeof setTimeout>>>({})

// Debounced persist on input - catches every keystroke including deletions
function debouncedPersist(exerciseId: string, setIndex: number) {
  const key = `${exerciseId}-${setIndex}`
  
  // Clear existing timer
  if (debounceTimers.value[key]) {
    clearTimeout(debounceTimers.value[key])
  }
  
  // Set new timer - persist after 500ms of no typing
  debounceTimers.value[key] = setTimeout(() => {
    persistSetLog(exerciseId, setIndex)
    delete debounceTimers.value[key]
  }, 500)
}

// Check if a weight is a new PB
function isNewPB(exerciseId: string, weight: number | null): boolean {
  if (!weight || weight <= 0) return false
  const currentPB = exercisePBs.value[exerciseId] || 0
  return weight > currentPB
}

// Get the current PB for an exercise
function getPB(exerciseId: string): number {
  return exercisePBs.value[exerciseId] || 0
}

// Delete an exercise from the session
async function deleteExercise(plannedExerciseId: string) {
  const toast = useToast()
  
  // Find the exercise name for toast
  const exercise = exercises.value.find(ex => ex.id === plannedExerciseId)
  
  if (exercise) {
    // Remove from DB with sync
    await removePlannedExerciseWithSync(plannedExerciseId)
    
    // Remove from local state
    exercises.value = exercises.value.filter(ex => ex.id !== plannedExerciseId)
    delete setLogs.value[plannedExerciseId]
    
    toast.add({
      title: 'Exercise Removed',
      description: `${exercise.name} has been removed from this session.`,
      icon: 'i-heroicons-trash',
      color: 'neutral'
    })
    
    console.log(`[Session] Deleted exercise ${plannedExerciseId}`)
  }
}

// Mark set as complete and persist
async function toggleSetComplete(exerciseId: string, setIndex: number) {
  if (setLogs.value[exerciseId]?.[setIndex]) {
    setLogs.value[exerciseId][setIndex].completed = !setLogs.value[exerciseId][setIndex].completed
    await persistSetLog(exerciseId, setIndex)
  }
}

// Get exercise completion status
function getExerciseProgress(exerciseId: string): { completed: number; total: number } {
  const logs = setLogs.value[exerciseId] || []
  const completed = logs.filter(log => log.completed).length
  return { completed, total: logs.length }
}

// Get overall progress
const overallProgress = computed(() => {
  const total = exercises.value.reduce((acc, ex) => acc + getExerciseProgress(ex.id).total, 0)
  const completed = exercises.value.reduce((acc, ex) => acc + getExerciseProgress(ex.id).completed, 0)
  return { completed, total, percentage: total > 0 ? Math.round((completed / total) * 100) : 0 }
})

// Check if session is complete (all sets done in current view)
const isSessionComplete = computed(() => overallProgress.value.percentage === 100)

// Check if session was already completed (status in database)
const isAlreadyCompleted = computed(() => session.value.status === 'completed')

// Check if session is in scheduled state (preview mode - coach is planning)
const isPreviewMode = computed(() => session.value.status === 'scheduled')

// Check if session is currently in progress
const isInProgress = computed(() => session.value.status === 'in-progress')

// Start the session - update status to 'in-progress'
async function startSession() {
  const { updateScheduleStatusWithSync } = useDatabase()
  const toast = useToast()
  
  try {
    await updateScheduleStatusWithSync(sessionId.value, 'in-progress')
    session.value.status = 'in-progress'
    toast.add({
      title: 'Session Started',
      description: `Training with ${session.value.memberName}`,
      color: 'success',
      icon: 'i-heroicons-play'
    })
    console.log('[Session] Status updated to in-progress (synced)')
  } catch (error) {
    console.error('[Session] Failed to start session:', error)
    toast.add({
      title: 'Failed to start session',
      color: 'error'
    })
  }
}

// Add a set to an exercise (with backend sync)
async function addSet(exerciseId: string) {
  // Get next set index
  const currentSets = setLogs.value[exerciseId] || []
  const newSetIndex = currentSets.length + 1
  
  // Update local state immediately (optimistic)
  if (!setLogs.value[exerciseId]) {
    setLogs.value[exerciseId] = []
  }
  setLogs.value[exerciseId].push({
    weight: null,
    reps: null,
    completed: false
  })
  
  // Queue sync to backend
  try {
    const newLog = await addSetWithSync(exerciseId, newSetIndex)
    console.log(`[Session] Added set ${newSetIndex} to exercise ${exerciseId}`)
    
    // Update local state with the generated ID (so updates/deletes work immediately)
    const sets = setLogs.value[exerciseId]
    if (sets && sets[newSetIndex - 1]) {
        sets[newSetIndex - 1].id = newLog.id
    }
  } catch (error) {
    console.error('[Session] Failed to sync new set:', error)
  }
}

// Remove a set from an exercise
async function removeSet(exerciseId: string, setIndex: number) {
  if (setLogs.value[exerciseId] && setLogs.value[exerciseId].length > 0) {
    const logToDelete = setLogs.value[exerciseId][setIndex]
    
    // Remove from UI immediately
    setLogs.value[exerciseId].splice(setIndex, 1)
    
    // Remove from DB/Backend
    if (logToDelete && logToDelete.id) {
        const { deleteSetLogWithSync } = useDatabase()
        try {
            await deleteSetLogWithSync(logToDelete.id)
            console.log(`[Session] Removed set ${setIndex + 1} for ex ${exerciseId}`)
        } catch (e) {
            console.error('Failed to delete set log:', e)
        }
    }
  }
}

// Add a new exercise to the session
const showAddExercise = ref(false)
const selectedExercise = ref<{ id: string; label: string; name: string; muscle_group: string; equipment: string; suffix: string } | undefined>(undefined)
const newExerciseSets = ref(3)
const newExerciseReps = ref(10)

// Exercise library for dropdown
const { exerciseLibrary, initLibrary, isLoadingLibrary } = useExerciseLibrary()

// Dropdown options for exercise select
const exerciseOptions = computed(() => {
  return exerciseLibrary.value.map(ex => ({
    id: ex.id,
    label: ex.name,
    name: ex.name,
    muscle_group: ex.muscle_group,
    equipment: ex.equipment,
    suffix: ex.muscle_group
  }))
})

async function addExercise() {
  if (!selectedExercise.value) return
  
  const newOrder = exercises.value.length + 1
  
  // Resolve schedule ID (use remote ID if available aka synced) to match what loadSessionData expects
  const schedule = await getSchedule(sessionId.value)
  const targetScheduleId = schedule?.remote_id || sessionId.value

  // Add to database with sync -> Returns Planned ID
  const newPlannedExercise = await addPlannedExerciseWithSync({
    schedule_id: targetScheduleId,
    exercise_id: selectedExercise.value.id,
    name: selectedExercise.value.name,
    target_sets: newExerciseSets.value,
    target_reps: newExerciseReps.value,
    rest_seconds: 60,
    notes: '',
    order: newOrder
  })
  // Create initial sets locally (Backend auto-creation disabled)
  // The sets will rely on the newly created PlannedExercise ULID
  if (newExerciseSets.value > 0) {
      const setsToCreate = newExerciseSets.value
      for (let i = 1; i <= setsToCreate; i++) {
          await addSetWithSync(newPlannedExercise, i)
      }
  }

  // Refresh data
  await loadSessionData()
  await initializeSetLogs()
  
  // Reset form
  selectedExercise.value = undefined
  newExerciseSets.value = 3
  newExerciseReps.value = 10
  showAddExercise.value = false
  
  const toast = useToast()
  toast.add({
    title: 'Exercise Added',
    icon: 'i-heroicons-plus-circle',
    color: 'success'
  })
}

// Update exercise plan (for preview mode inline editing)
// Use debouncing to avoid spamming the backend
const updateDebounceTimers = new Map<string, NodeJS.Timeout>()

async function updateExercisePlan(exerciseId: string, field: string, value: number | string) {
  // Update local state immediately (optimistic UI)
  const exercise = exercises.value.find(ex => ex.id === exerciseId)
  if (exercise) {
    (exercise as any)[field] = value
  }
  
  // Debounce the sync - clear previous timer for this field+exercise combo
  const debounceKey = `${exerciseId}:${field}`
  const existingTimer = updateDebounceTimers.get(debounceKey)
  if (existingTimer) {
    clearTimeout(existingTimer)
  }
  
  // Set new timer - sync after 2 seconds of no changes (gym-friendly delay)
  updateDebounceTimers.set(debounceKey, setTimeout(async () => {
    updateDebounceTimers.delete(debounceKey)
    try {
      const { updatePlannedExerciseWithSync } = useDatabase()
      await updatePlannedExerciseWithSync(exerciseId, { [field === 'targetSets' ? 'target_sets' : field === 'targetReps' ? 'target_reps' : field === 'restSeconds' ? 'rest_seconds' : field]: value })
      console.log(`[Session] Synced ${field} for exercise ${exerciseId}`)
    } catch (error) {
      console.error('[Session] Failed to update exercise:', error)
    }
  }, 2000))
}

// Remove exercise from plan (for preview mode)
async function removeExerciseFromPlan(plannedExerciseId: string) {
  const toast = useToast()
  
  try {
    // Determine exercise name before deleting (finding by ID is simpler now)
    const exercise = exercises.value.find(ex => ex.id === plannedExerciseId)
    const exerciseName = exercise?.name || 'Exercise'

    // Remove from local state
    exercises.value = exercises.value.filter(ex => ex.id !== plannedExerciseId)
    
    // Remove from DB with Sync
    await removePlannedExerciseWithSync(plannedExerciseId)
    
    // Also remove set logs
    delete setLogs.value[plannedExerciseId]
    
    toast.add({
      title: 'Exercise Removed',
      description: `${exerciseName} removed from plan`,
      icon: 'i-heroicons-trash',
      color: 'warning'
    })
    
    console.log(`[Session] Removed exercise ${plannedExerciseId} from plan`)
  } catch (error) {
    console.error('[Session] Failed to remove exercise:', error)
    toast.add({
      title: 'Failed to remove exercise',
      color: 'error'
    })
  }
}

// Finish session flow
const showConfirmModal = ref(false)
const showRemarksModal = ref(false)
const showSummaryModal = ref(false)
const coachRemarks = ref('')

// Computed session improvements
const sessionImprovements = computed(() => {
  const improvements: { type: 'pb' | 'endurance'; exercise: string; detail: string }[] = []
  
  exercises.value.forEach(ex => {
    const logs = setLogs.value[ex.id] || []
    const pb = getPB(ex.id)
    
    // Check for PB improvements
    logs.forEach((log, index) => {
      if (log.weight && log.weight > pb) {
        improvements.push({
          type: 'pb',
          exercise: ex.name,
          detail: `New PB: ${log.weight}kg (was ${pb}kg) - Set ${index + 1}`
        })
      }
    })
    
    // Check for extra reps (endurance improvement)
    const targetReps = ex.targetReps
    logs.forEach((log, index) => {
      if (log.reps && log.reps > targetReps) {
        improvements.push({
          type: 'endurance',
          exercise: ex.name,
          detail: `Extra reps: ${log.reps} reps (target was ${targetReps}) - Set ${index + 1}`
        })
      }
    })
  })
  
  return improvements
})

// Start finish flow - show confirmation
function handleFinishClick() {
  showConfirmModal.value = true
}

// User confirmed - show remarks
function confirmFinish() {
  showConfirmModal.value = false
  showRemarksModal.value = true
}

// User submitted remarks - show summary
function submitRemarks() {
  showRemarksModal.value = false
  showSummaryModal.value = true
}

// Final finish - navigate home with optimistic sync
async function completeFinalFinish() {
  const toast = useToast()
  const { updateScheduleStatusWithSync, queueSync, isOnline } = useDatabase()
  
  const scheduleId = sessionId.value

  // Phase A: Optimistic - Update local state immediately
  try {
    // Manually update local DB to avoid queuing a redundant 'status update' sync job
    // The main 'complete' endpoint handles the status change on the backend.
    await db.schedules.update(scheduleId, { status: 'completed', coach_remarks: coachRemarks.value, completed_at: new Date().toISOString() })
    session.value.status = 'completed'
    console.log('[Session] Phase A: Optimistic update complete (local only)')
  } catch (error) {
    console.error('[Session] Failed to update local state:', error)
  }

  // Phase B: Network Attempt
  try {
    const token = useCookie('metamorph-token')
    const headers: Record<string, string> = {}
    if (token.value) {
      headers['Authorization'] = `Bearer ${token.value}`
    }

    const response = await $fetch(`/api/v1/pro/schedules/${scheduleId}/complete`, {
      method: 'POST',
      headers,
      body: {
        remarks: coachRemarks.value,
        session_logs: Object.entries(setLogs.value).flatMap(([exerciseId, logs]) =>
          logs.map((log, index) => ({
            exercise_id: exerciseId,
            set_index: index,
            weight: log.weight,
            reps: log.reps,
            completed: log.completed
          }))
        ),
        improvements: sessionImprovements.value
      }
    })
    console.log('[Session] Phase B: Network sync successful', response)
  } catch (error: any) {
    // Phase C: Failover - Queue for later sync
    console.warn('[Session] Phase C: Network failed, queuing for offline sync', error)

    await queueSync({
      method: 'POST',
      url: `/api/v1/pro/schedules/${scheduleId}/complete`,
      body: JSON.stringify({
        remarks: coachRemarks.value,
        session_logs: Object.entries(setLogs.value).flatMap(([exerciseId, logs]) =>
          logs.map((log, index) => ({
            exercise_id: exerciseId,
            set_index: index,
            weight: log.weight,
            reps: log.reps,
            completed: log.completed
          }))
        ),
        improvements: sessionImprovements.value
      }),
      priority: 'high',
      context: {
        schedule_id: scheduleId,
        type: 'session_complete'
      }
    })

    // Show offline toast
    toast.add({
      title: 'Saved Offline',
      description: "We'll sync your session as soon as you're back online.",
      icon: 'i-heroicons-cloud-arrow-up',
      color: 'warning'
    })
  }

  // Close modal and navigate home
  showSummaryModal.value = false
  navigateTo('/')
}

// Motivation messages
const motivationMessages = [
  "🎉 Amazing workout! You crushed it today!",
  "💪 Beast mode activated! Great session!",
  "🔥 Every rep counts! You're getting stronger!",
  "⭐ Champion mentality! Keep pushing!",
  "🏆 Another session in the books! Well done!"
]
const randomMotivation = motivationMessages[Math.floor(Math.random() * motivationMessages.length)]
</script>

<template>
  <div class="space-y-4 pb-8">
    <!-- Session Header -->
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div class="flex items-center gap-3">
        <UButton
          to="/"
          icon="i-heroicons-arrow-left"
          color="neutral"
          variant="ghost"
          aria-label="Back to agenda"
        />
        <div>
          <h1 class="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">{{ session.memberName }}</h1>
          <p class="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-2">
            <UIcon name="i-heroicons-fire" class="w-4 h-4 text-orange-500" />
            {{ session.goal }}
          </p>
        </div>
      </div>
    </div>

    <!-- COMPLETED SESSION SUMMARY VIEW -->
    <template v-if="isAlreadyCompleted">
      <div class="space-y-6">
        <!-- Completion Banner -->
        <div class="bg-gradient-to-r from-green-500 to-emerald-500 rounded-xl p-6 text-center text-white shadow-lg">
          <UIcon name="i-heroicons-check-badge" class="w-16 h-16 mx-auto mb-3" />
          <h2 class="text-2xl font-bold mb-2">Session Completed!</h2>
          <p class="text-green-100">This workout has been successfully finished.</p>
        </div>

        <!-- Session Summary Card -->
        <UCard>
          <template #header>
            <div class="flex items-center gap-2">
              <UIcon name="i-heroicons-document-text" class="w-5 h-5 text-primary-500" />
              <h3 class="font-semibold">Session Summary</h3>
            </div>
          </template>
          
          <div class="space-y-4">
            <!-- Session Info -->
            <div class="grid grid-cols-2 gap-4">
              <div class="bg-gray-50 dark:bg-slate-800 rounded-lg p-3">
                <p class="text-xs text-gray-500 uppercase tracking-wider">Member</p>
                <p class="font-semibold text-gray-900 dark:text-white">{{ session.memberName }}</p>
              </div>
              <div class="bg-gray-50 dark:bg-slate-800 rounded-lg p-3">
                <p class="text-xs text-gray-500 uppercase tracking-wider">Goal</p>
                <p class="font-semibold text-gray-900 dark:text-white">{{ session.goal }}</p>
              </div>
              <div class="bg-gray-50 dark:bg-slate-800 rounded-lg p-3">
                <p class="text-xs text-gray-500 uppercase tracking-wider">Scheduled</p>
                <p class="font-semibold text-gray-900 dark:text-white">{{ session.startTime }}</p>
              </div>
              <div class="bg-gray-50 dark:bg-slate-800 rounded-lg p-3">
                <p class="text-xs text-gray-500 uppercase tracking-wider">Status</p>
                <UBadge color="success" variant="subtle" label="Completed" />
              </div>
            </div>

            <!-- Exercises List -->
            <div>
              <p class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Exercises Completed</p>
              <div class="space-y-2">
                <div 
                  v-for="exercise in exercises" 
                  :key="exercise.id"
                  class="flex items-center justify-between p-3 bg-gray-50 dark:bg-slate-800 rounded-lg"
                >
                  <div class="flex items-center gap-2">
                    <UIcon name="i-heroicons-check-circle-solid" class="w-5 h-5 text-green-500" />
                    <span class="font-medium">{{ exercise.name }}</span>
                  </div>
                  <span class="text-sm text-gray-500">{{ exercise.targetSets }} × {{ exercise.targetReps }}</span>
                </div>
              </div>
            </div>
          </div>

          <template #footer>
            <UButton
              to="/"
              block
              color="primary"
              label="Back to Command Center"
              icon="i-heroicons-arrow-left"
            />
          </template>
        </UCard>
      </div>
    </template>

    <!-- PREVIEW MODE (Session is Scheduled - Coach is Planning) -->
    <template v-else-if="isPreviewMode">
      <div class="space-y-6 pb-24">
        <!-- Preview Banner -->
        <div class="bg-gradient-to-r from-blue-500 to-indigo-500 rounded-xl p-6 text-center text-white shadow-lg">
          <UIcon name="i-heroicons-pencil-square" class="w-12 h-12 mx-auto mb-3" />
          <h2 class="text-xl font-bold mb-2">Plan Session</h2>
          <p class="text-blue-100 text-sm">Add exercises and set targets for {{ session.memberName }}</p>
        </div>

        <!-- Session Info Card -->
        <UCard>
          <template #header>
            <div class="flex items-center gap-2">
              <UIcon name="i-heroicons-information-circle" class="w-5 h-5 text-primary-500" />
              <h3 class="font-semibold">Session Details</h3>
            </div>
          </template>
          
          <div class="grid grid-cols-2 gap-4">
            <div class="bg-gray-50 dark:bg-slate-800 rounded-lg p-3">
              <p class="text-xs text-gray-500 uppercase tracking-wider">Member</p>
              <p class="font-semibold text-gray-900 dark:text-white">{{ session.memberName }}</p>
            </div>
            <div class="bg-gray-50 dark:bg-slate-800 rounded-lg p-3">
              <p class="text-xs text-gray-500 uppercase tracking-wider">Goal</p>
              <p class="font-semibold text-gray-900 dark:text-white">{{ session.goal }}</p>
            </div>
            <div class="bg-gray-50 dark:bg-slate-800 rounded-lg p-3">
              <p class="text-xs text-gray-500 uppercase tracking-wider">Scheduled</p>
              <p class="font-semibold text-gray-900 dark:text-white">{{ session.startTime }}</p>
            </div>
            <div class="bg-gray-50 dark:bg-slate-800 rounded-lg p-3">
              <p class="text-xs text-gray-500 uppercase tracking-wider">Exercises</p>
              <p class="font-semibold text-gray-900 dark:text-white">{{ exercises.length }} planned</p>
            </div>
          </div>
        </UCard>

        <!-- Workout Plan - Editable -->
        <UCard>
          <template #header>
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2">
                <UIcon name="i-heroicons-clipboard-document-list" class="w-5 h-5 text-primary-500" />
                <h3 class="font-semibold">Workout Plan</h3>
              </div>
              <UButton
                label="Add Exercise"
                color="primary"
                variant="soft"
                size="sm"
                icon="i-heroicons-plus"
                @click="showAddExercise = true"
              />
            </div>
          </template>

          <!-- Empty State -->
          <div v-if="exercises.length === 0" class="text-center py-8">
            <UIcon name="i-heroicons-clipboard-document" class="w-12 h-12 mx-auto text-gray-300 dark:text-gray-600 mb-3" />
            <p class="text-gray-500 mb-4">No exercises planned yet</p>
            <UButton
              label="Add First Exercise"
              color="primary"
              icon="i-heroicons-plus"
              @click="showAddExercise = true"
            />
          </div>

          <!-- Exercise List -->
          <div v-else class="space-y-4">
            <div 
              v-for="(exercise, index) in exercises" 
              :key="exercise.id"
              class="border border-gray-200 dark:border-gray-700 rounded-xl p-4 bg-gray-50/50 dark:bg-slate-800/50"
            >
              <!-- Exercise Header -->
              <div class="flex items-start justify-between mb-3">
                <div class="flex items-center gap-3">
                  <span class="w-8 h-8 rounded-full bg-primary-500 text-white flex items-center justify-center text-sm font-bold">
                    {{ index + 1 }}
                  </span>
                  <div>
                    <h4 class="font-semibold text-gray-900 dark:text-white">{{ exercise.name }}</h4>
                  </div>
                </div>
                <UButton
                  icon="i-heroicons-trash"
                  color="error"
                  variant="ghost"
                  size="xs"
                  @click="removeExerciseFromPlan(exercise.id)"
                />
              </div>

              <!-- Editable Fields -->
              <div class="grid grid-cols-3 gap-3 mb-3">
                <div>
                  <label class="text-xs text-gray-500 block mb-1">Sets</label>
                  <UInput
                    :model-value="exercise.targetSets"
                    type="number"
                    size="sm"
                    min="1"
                    @update:model-value="(val) => updateExercisePlan(exercise.id, 'targetSets', Number(val))"
                  />
                </div>
                <div>
                  <label class="text-xs text-gray-500 block mb-1">Reps</label>
                  <UInput
                    :model-value="exercise.targetReps"
                    type="number"
                    size="sm"
                    min="1"
                    @update:model-value="(val) => updateExercisePlan(exercise.id, 'targetReps', Number(val))"
                  />
                </div>
                <div>
                  <label class="text-xs text-gray-500 block mb-1">Rest (sec)</label>
                  <UInput
                    :model-value="exercise.restSeconds"
                    type="number"
                    size="sm"
                    min="0"
                    step="15"
                    @update:model-value="(val) => updateExercisePlan(exercise.id, 'restSeconds', Number(val))"
                  />
                </div>
              </div>

              <!-- Notes Field -->
              <div>
                <label class="text-xs text-gray-500 block mb-1">Notes / Goal</label>
                <UTextarea
                  :model-value="exercise.notes || ''"
                  placeholder="E.g., Focus on form, increase weight from last week..."
                  size="sm"
                  :rows="2"
                  @update:model-value="(val) => updateExercisePlan(exercise.id, 'notes', val)"
                />
              </div>
            </div>
          </div>
        </UCard>

        <!-- Add Exercise Button (Bottom of list) -->
        <div class="text-center py-4 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-xl bg-gray-50/50 dark:bg-slate-800/50">
          <UButton
            label="Add Another Exercise"
            icon="i-heroicons-plus-circle"
            color="primary"
            variant="soft"
            size="lg"
            @click="showAddExercise = true"
          />
        </div>

        <!-- Start Session Button (Sticky) -->
        <div class="fixed bottom-4 left-0 right-0 px-4 lg:left-64">
          <div class="max-w-4xl mx-auto">
            <UButton
              label="Start Session"
              color="primary"
              size="xl"
              icon="i-heroicons-play-circle"
              block
              @click="startSession"
            />
          </div>
        </div>
      </div>
    </template>

    <!-- ACTIVE WORKOUT VIEW (Session is In Progress) -->
    <template v-else-if="isInProgress">
    
    <!-- Progress Bar (Moved to Top) -->
    <div class="bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4">
      <div class="flex items-center justify-between mb-2">
        <span class="text-sm font-medium text-gray-700 dark:text-gray-300">Session Progress</span>
        <span class="text-sm font-bold text-primary-600 dark:text-primary-400">
          {{ overallProgress.completed }}/{{ overallProgress.total }} sets ({{ overallProgress.percentage }}%)
        </span>
      </div>
      <div class="h-3 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
        <div 
          class="h-full bg-gradient-to-r from-primary-500 to-primary-400 rounded-full transition-all duration-500"
          :style="{ width: `${overallProgress.percentage}%` }"
        ></div>
      </div>
    </div>

    <!-- Exercise Accordion -->
    <UAccordion 
      :items="exercises.map(ex => ({ 
        label: ex.name, 
        value: ex.id,
        icon: getExerciseProgress(ex.id).completed === getExerciseProgress(ex.id).total ? 'i-heroicons-check-circle-solid' : 'i-heroicons-clipboard-document-list',
        trailingIcon: ''
      }))"
      :default-value="exercises[0]?.id ? [exercises[0].id] : []"
      multiple
      :ui="{ 
        root: 'flex flex-col gap-3',
        item: 'bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden shadow-sm',
        trigger: 'px-4 py-3 font-semibold text-base',
        content: 'p-0'
      }"
    >
      <template #trailing="{ item }">
        <span 
          class="text-xs font-bold px-2 py-1 rounded-full"
          :class="getExerciseProgress(item.value).completed === getExerciseProgress(item.value).total 
            ? 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400' 
            : 'bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400'"
        >
          {{ getExerciseProgress(item.value).completed }}/{{ getExerciseProgress(item.value).total }}
        </span>
      </template>
      <template #body="{ item }">
        <!-- Find the exercise by ID -->
        <div v-for="exercise in exercises.filter(ex => ex.id === item.value)" :key="exercise.id" class="px-4 pb-4">
          <!-- Exercise Meta -->
          <div class="flex flex-wrap items-center gap-x-3 gap-y-1 mb-4 pb-3 border-b border-gray-100 dark:border-gray-800">
            <p class="text-sm text-gray-500 dark:text-gray-400">
              Target: {{ exercise.targetSets }} sets × {{ exercise.targetReps }} reps
              <span v-if="exercise.restSeconds" class="ml-2">• {{ exercise.restSeconds }}s rest</span>
            </p>
            <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 text-xs font-medium">
              <UIcon name="i-heroicons-trophy" class="w-3 h-3" />
              PB: {{ getPB(exercise.id) }}kg
            </span>
            <span class="text-sm font-medium text-primary-600 dark:text-primary-400 ml-auto">
              {{ getExerciseProgress(exercise.id).completed }}/{{ getExerciseProgress(exercise.id).total }} sets
            </span>
            <!-- Delete Exercise Button -->
            <UButton
              icon="i-heroicons-trash"
              color="error"
              variant="ghost"
              size="xs"
              @click="deleteExercise(exercise.id)"
              aria-label="Remove exercise"
            />
          </div>

          <!-- Set Logging Rows -->
          <div class="space-y-2">
            <div 
              v-for="(setLog, setIndex) in setLogs[exercise.id]" 
              :key="setIndex"
              class="flex items-center gap-2 p-2 rounded-lg transition-all"
              :class="setLog.completed 
                ? 'bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800' 
                : 'bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700'"
            >
              <!-- Set Number -->
              <div 
                class="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold"
                :class="setLog.completed 
                  ? 'bg-green-500 text-white' 
                  : 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300'"
              >
                {{ setIndex + 1 }}
              </div>

              <!-- Weight Input -->
              <div class="flex-1 min-w-0">
                <label class="text-xs text-gray-500 dark:text-gray-400 mb-0.5 block">Weight</label>
                <div class="relative">
                  <UInput
                    v-model.number="setLog.weight"
                    type="number"
                    placeholder="0"
                    size="lg"
                    :ui="{ 
                      base: 'text-center text-lg font-bold'
                    }"
                    inputmode="numeric"
                    @input="debouncedPersist(exercise.id, setIndex)"
                    @blur="persistSetLog(exercise.id, setIndex)"
                  />
                  <!-- NEW PB Badge -->
                  <Transition
                    enter-active-class="transition-all duration-300 ease-out"
                    enter-from-class="opacity-0 scale-75"
                    enter-to-class="opacity-100 scale-100"
                    leave-active-class="transition-all duration-200 ease-in"
                    leave-from-class="opacity-100 scale-100"
                    leave-to-class="opacity-0 scale-75"
                  >
                    <div 
                      v-if="isNewPB(exercise.id, setLog.weight)"
                      class="absolute -top-2 -right-2 px-2 py-0.5 bg-green-500 text-white text-xs font-bold rounded-full shadow-lg animate-pulse"
                    >
                      🔥 NEW PB
                    </div>
                  </Transition>
                </div>
              </div>

              <!-- Reps Input -->
              <div class="flex-1 min-w-0">
                <label class="text-xs text-gray-500 dark:text-gray-400 mb-0.5 block">Reps</label>
                <UInput
                  v-model.number="setLog.reps"
                  type="number"
                  placeholder="0"
                  size="lg"
                  :ui="{ 
                    base: 'text-center text-lg font-bold'
                  }"
                  inputmode="numeric"
                  @input="debouncedPersist(exercise.id, setIndex)"
                  @blur="persistSetLog(exercise.id, setIndex)"
                />
              </div>

              <!-- Complete Checkbox -->
              <div class="flex-shrink-0">
                <UButton
                  :icon="setLog.completed ? 'i-heroicons-check-circle-solid' : 'i-heroicons-check-circle'"
                  :color="setLog.completed ? 'success' : 'neutral'"
                  :variant="setLog.completed ? 'solid' : 'ghost'"
                  size="lg"
                  @click="toggleSetComplete(exercise.id, setIndex)"
                  aria-label="Mark set complete"
                />
              </div>

              <!-- Remove Set Button -->
              <div class="flex-shrink-0">
                <UButton
                  icon="i-heroicons-trash"
                  color="error"
                  variant="ghost"
                  size="sm"
                  @click="removeSet(exercise.id, setIndex)"
                  :disabled="(setLogs[exercise.id]?.length ?? 0) <= 1"
                  aria-label="Remove set"
                />
              </div>
            </div>
          </div>

          <!-- Add Set Button -->
          <div class="mt-3">
            <UButton
              label="Add Set"
              icon="i-heroicons-plus"
              color="neutral"
              variant="outline"
              size="sm"
              block
              @click="addSet(exercise.id)"
            />
          </div>

          <!-- Exercise Notes -->
          <div v-if="exercise.notes" class="flex items-start gap-2 text-sm text-gray-500 dark:text-gray-400 mt-4 pt-3 border-t border-gray-100 dark:border-gray-800">
            <UIcon name="i-heroicons-light-bulb" class="w-4 h-4 mt-0.5 text-yellow-500 flex-shrink-0" />
            <span>{{ exercise.notes }}</span>
          </div>
        </div>
      </template>
    </UAccordion>

    <!-- Add Exercise Section -->
    <div class="bg-white dark:bg-slate-900 rounded-xl border border-dashed border-gray-300 dark:border-gray-700 p-4">
      <div v-if="!showAddExercise" class="text-center">
        <UButton
          label="Add Exercise"
          icon="i-heroicons-plus-circle"
          color="neutral"
          variant="ghost"
          size="lg"
          @click="showAddExercise = true"
        />
      </div>
      <div v-else class="space-y-4">
        <!-- Exercise Dropdown -->
        <div>
          <label class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block">Select Exercise</label>
          <UInputMenu
            v-model="selectedExercise"
            :items="exerciseOptions"
            placeholder="Search exercises..."
            :loading="isLoadingLibrary"
            size="lg"
            class="w-full"
            by="id"
          />
        </div>
        
        <!-- Sets & Reps Inputs -->
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block">Sets</label>
            <UInput
              v-model.number="newExerciseSets"
              type="number"
              min="1"
              max="10"
              size="lg"
              inputmode="numeric"
            />
          </div>
          <div>
            <label class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block">Reps</label>
            <UInput
              v-model.number="newExerciseReps"
              type="number"
              min="1"
              max="50"
              size="lg"
              inputmode="numeric"
            />
          </div>
        </div>
        
        <!-- Action Buttons -->
        <div class="flex gap-2">
          <UButton
            label="Add Exercise"
            icon="i-heroicons-check"
            color="primary"
            class="flex-1"
            @click="addExercise"
            :disabled="!selectedExercise"
          />
          <UButton
            label="Cancel"
            color="neutral"
            variant="outline"
            @click="showAddExercise = false; selectedExercise = undefined"
          />
        </div>
      </div>
    </div>

    <!-- Motivation Message (Shows when session is complete) -->
    <Transition
      enter-active-class="transition-all duration-500 ease-out"
      enter-from-class="opacity-0 translate-y-4"
      enter-to-class="opacity-100 translate-y-0"
    >
      <div 
        v-if="isSessionComplete"
        class="bg-gradient-to-r from-green-500 to-emerald-500 rounded-xl p-6 text-center text-white shadow-lg"
      >
        <UIcon name="i-heroicons-trophy" class="w-12 h-12 mx-auto mb-3" />
        <h3 class="text-xl font-bold mb-2">Session Complete!</h3>
        <p class="text-green-100">{{ randomMotivation }}</p>
      </div>
    </Transition>

    <!-- Finish Session Button (Sticky Footer) -->
    <div class="sticky bottom-0 left-0 right-0 p-4 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm border-t border-gray-200 dark:border-gray-800 -mx-4 sm:-mx-6">
      <UButton
        :label="isSessionComplete ? 'Complete Workout 🎉' : 'Finish Session'"
        :color="isSessionComplete ? 'success' : 'primary'"
        size="lg"
        :icon="isSessionComplete ? 'i-heroicons-trophy' : 'i-heroicons-check-circle'"
        block
        @click="handleFinishClick"
      />
    </div>
    
    </template>
    <!-- END ACTIVE WORKOUT VIEW -->

    <!-- Add Exercise Modal (Global - works in Preview and Active modes) -->
    <UModal v-model:open="showAddExercise" class="sm:max-w-lg">
      <template #content>
        <div class="p-6">
          <div class="flex items-center gap-4 mb-6">
            <div class="w-12 h-12 bg-primary-100 dark:bg-primary-900/30 rounded-full flex items-center justify-center flex-shrink-0">
              <UIcon name="i-heroicons-plus-circle" class="w-6 h-6 text-primary-500" />
            </div>
            <div>
              <h3 class="text-xl font-bold text-gray-900 dark:text-white">Add Exercise</h3>
              <p class="text-sm text-gray-500 dark:text-gray-400">Search and add to workout plan</p>
            </div>
          </div>

          <!-- Exercise Dropdown -->
          <div class="mb-4">
            <label class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block">Select Exercise</label>
            <UInputMenu
              v-model="selectedExercise"
              :items="exerciseOptions"
              placeholder="Search exercises..."
              :loading="isLoadingLibrary"
              size="lg"
              class="w-full"
              by="id"
            />
          </div>
          
          <!-- Sets & Reps Inputs -->
          <div class="grid grid-cols-2 gap-3 mb-4">
            <div>
              <label class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block">Sets</label>
              <UInput
                v-model.number="newExerciseSets"
                type="number"
                min="1"
                max="10"
                size="lg"
                inputmode="numeric"
              />
            </div>
            <div>
              <label class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block">Reps</label>
              <UInput
                v-model.number="newExerciseReps"
                type="number"
                min="1"
                max="50"
                size="lg"
                inputmode="numeric"
              />
            </div>
          </div>
          
          <!-- Action Buttons -->
          <div class="flex gap-3">
            <UButton
              label="Cancel"
              color="neutral"
              variant="ghost"
              size="lg"
              class="flex-1"
              @click="showAddExercise = false; selectedExercise = undefined"
            />
            <UButton
              label="Add Exercise"
              icon="i-heroicons-check"
              color="primary"
              size="lg"
              class="flex-1"
              @click="addExercise"
              :disabled="!selectedExercise"
            />
          </div>
        </div>
      </template>
    </UModal>

    <!-- Confirmation Modal -->
    <UModal v-model:open="showConfirmModal" class="sm:max-w-md">
      <template #content>
        <div class="p-8 text-center">
          <div class="w-20 h-20 mx-auto mb-6 bg-primary-100 dark:bg-primary-900/30 rounded-full flex items-center justify-center">
            <UIcon name="i-heroicons-hand-raised" class="w-10 h-10 text-primary-500" />
          </div>
          <h3 class="text-2xl font-bold text-gray-900 dark:text-white mb-3">Ready to Wrap Up?</h3>
          <p class="text-gray-500 dark:text-gray-400 mb-8 text-base">
            End the session with <span class="font-semibold text-gray-700 dark:text-gray-300">{{ session.memberName }}</span>?
          </p>
          <div class="flex gap-4">
            <UButton 
              label="Not Yet" 
              color="neutral" 
              variant="soft" 
              size="lg"
              class="flex-1"
              icon="i-heroicons-arrow-left"
              @click="showConfirmModal = false" 
            />
            <UButton 
              label="Yes, Finish" 
              color="primary" 
              size="lg"
              class="flex-1"
              icon="i-heroicons-check"
              @click="confirmFinish" 
            />
          </div>
        </div>
      </template>
    </UModal>

    <!-- Remarks Modal -->
    <UModal v-model:open="showRemarksModal" class="sm:max-w-lg">
      <template #content>
        <div class="p-6">
          <div class="flex items-center gap-4 mb-6">
            <div class="w-12 h-12 bg-yellow-100 dark:bg-yellow-900/30 rounded-full flex items-center justify-center flex-shrink-0">
              <UIcon name="i-heroicons-pencil-square" class="w-6 h-6 text-yellow-600 dark:text-yellow-400" />
            </div>
            <div>
              <h3 class="text-xl font-bold text-gray-900 dark:text-white">Session Notes</h3>
              <p class="text-sm text-gray-500 dark:text-gray-400">Add coach remarks for this session</p>
            </div>
          </div>
          
          <div class="mb-6">
            <UTextarea
              v-model="coachRemarks"
              placeholder="e.g., Great progress on squats today! Form improved significantly. Need to focus on hip hinge for deadlifts next session..."
              :rows="5"
              :ui="{ base: 'text-base' }"
              autofocus
            />
            <p class="text-xs text-gray-400 mt-2">These notes will be saved to the member's session history</p>
          </div>
          
          <div class="flex gap-3">
            <UButton 
              label="Skip for Now" 
              color="neutral" 
              variant="ghost" 
              size="lg"
              class="flex-1"
              @click="coachRemarks = ''; submitRemarks()" 
            />
            <UButton 
              label="Save Notes" 
              color="primary" 
              size="lg"
              class="flex-1"
              icon="i-heroicons-check"
              @click="submitRemarks" 
            />
          </div>
        </div>
      </template>
    </UModal>

    <!-- Summary Modal (Scrollable) -->
    <UModal v-model:open="showSummaryModal" class="sm:max-w-lg">
      <template #content>
        <div class="flex flex-col max-h-[85vh]">
          <!-- Fixed Header -->
          <div class="p-6 pb-4 text-center border-b border-gray-100 dark:border-gray-800 flex-shrink-0">
            <div class="w-20 h-20 mx-auto mb-4 bg-gradient-to-br from-green-400 to-emerald-500 rounded-full flex items-center justify-center shadow-lg">
              <UIcon name="i-heroicons-trophy" class="w-10 h-10 text-white" />
            </div>
            <h3 class="text-2xl font-bold text-gray-900 dark:text-white">Session Complete! 🎉</h3>
            <p class="text-gray-500 dark:text-gray-400">{{ session.memberName }} • {{ session.goal }}</p>
          </div>

          <!-- Scrollable Content -->
          <div class="flex-1 overflow-y-auto p-6 space-y-4">
            <!-- Session Stats -->
            <div class="grid grid-cols-3 gap-3">
              <div class="bg-gray-50 dark:bg-gray-800 rounded-xl p-4 text-center">
                <p class="text-3xl font-bold text-gray-900 dark:text-white">{{ overallProgress.completed }}</p>
                <p class="text-xs text-gray-500 mt-1">Sets Done</p>
              </div>
              <div class="bg-gray-50 dark:bg-gray-800 rounded-xl p-4 text-center">
                <p class="text-3xl font-bold text-gray-900 dark:text-white">{{ exercises.length }}</p>
                <p class="text-xs text-gray-500 mt-1">Exercises</p>
              </div>
              <div class="bg-gray-50 dark:bg-gray-800 rounded-xl p-4 text-center">
                <p class="text-3xl font-bold text-green-500">{{ sessionImprovements.filter(i => i.type === 'pb').length }}</p>
                <p class="text-xs text-gray-500 mt-1">New PRs</p>
              </div>
            </div>

            <!-- Improvements Section -->
            <div v-if="sessionImprovements.length > 0">
              <h4 class="text-sm font-semibold text-gray-500 mb-3 uppercase tracking-wider flex items-center gap-2">
                <UIcon name="i-heroicons-sparkles" class="w-4 h-4 text-yellow-500" />
                Session Highlights
              </h4>
              <div class="space-y-2">
                <div 
                  v-for="(improvement, i) in sessionImprovements" 
                  :key="i"
                  class="flex items-start gap-3 p-3 rounded-xl"
                  :class="improvement.type === 'pb' 
                    ? 'bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950/30 dark:to-emerald-950/30 border border-green-200 dark:border-green-800' 
                    : 'bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 border border-blue-200 dark:border-blue-800'"
                >
                  <div 
                    class="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                    :class="improvement.type === 'pb' ? 'bg-green-500' : 'bg-blue-500'"
                  >
                    <UIcon 
                      :name="improvement.type === 'pb' ? 'i-heroicons-fire' : 'i-heroicons-arrow-trending-up'" 
                      class="w-4 h-4 text-white" 
                    />
                  </div>
                  <div>
                    <p class="text-sm font-semibold text-gray-900 dark:text-white">{{ improvement.exercise }}</p>
                    <p class="text-xs text-gray-500 dark:text-gray-400">{{ improvement.detail }}</p>
                  </div>
                </div>
              </div>
            </div>

            <!-- No Improvements Message -->
            <div v-else class="text-center p-6 bg-gray-50 dark:bg-gray-800 rounded-xl">
              <UIcon name="i-heroicons-heart" class="w-8 h-8 text-pink-400 mx-auto mb-2" />
              <p class="text-sm text-gray-600 dark:text-gray-300 font-medium">Solid consistency today!</p>
              <p class="text-xs text-gray-400">Keep pushing for those PRs next time 💪</p>
            </div>

            <!-- Coach Remarks (if any) -->
            <div v-if="coachRemarks" class="p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-xl border border-yellow-200 dark:border-yellow-800">
              <div class="flex items-center gap-2 mb-2">
                <UIcon name="i-heroicons-chat-bubble-bottom-center-text" class="w-4 h-4 text-yellow-600" />
                <h4 class="text-xs font-semibold text-yellow-700 dark:text-yellow-400 uppercase">Coach Notes</h4>
              </div>
              <p class="text-sm text-gray-700 dark:text-gray-300">{{ coachRemarks }}</p>
            </div>

            <!-- Motivation -->
            <div class="text-center p-5 bg-gradient-to-r from-primary-500/10 via-primary-400/10 to-primary-500/10 rounded-xl">
              <p class="text-lg font-semibold text-primary-600 dark:text-primary-400">{{ randomMotivation }}</p>
            </div>
          </div>

          <!-- Fixed Footer -->
          <div class="p-4 border-t border-gray-100 dark:border-gray-800 flex-shrink-0">
            <UButton 
              label="Done" 
              color="primary" 
              size="xl"
              block
              @click="completeFinalFinish" 
            />
          </div>
        </div>
      </template>
    </UModal>
  </div>
</template>

<style scoped>
/* Touch-friendly input sizing */
:deep(input[type="number"]) {
  -moz-appearance: textfield;
  font-size: 1.25rem;
}

:deep(input[type="number"]::-webkit-outer-spin-button),
:deep(input[type="number"]::-webkit-inner-spin-button) {
  -webkit-appearance: none;
  margin: 0;
}
</style>
