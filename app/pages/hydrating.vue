<script setup lang="ts">
/**
 * Login Hydration Page
 * Shows "Please wait..." while syncing user data after login
 */

const router = useRouter()
const { db } = await import('~/utils/db')

// Progress state
const progress = ref(0)
const message = ref('hydrating.initializing')
const hasError = ref(false)
const errorMessage = ref('')

// Hydration steps
async function hydrate() {
  const token = useCookie('metamorph-token')
  
  if (!token.value) {
    console.error('[Hydration] No token found, redirecting to login')
    router.push('/login')
    return
  }

  try {
    // Step 1: Sync exercises (10%)
    message.value = 'hydrating.loadingExercises'
    progress.value = 10
    await syncMasterExercises()
    
    // Step 2: Sync clients (25%)
    message.value = 'hydrating.loadingClients'
    progress.value = 25
    await syncClients()
    
    // Step 3: Sync schedule history - past 10 days (40%)
    message.value = 'hydrating.syncingHistory'
    progress.value = 40
    const today = new Date()
    const past10Days = new Date(today.getTime() - 10 * 24 * 60 * 60 * 1000)
    await syncSchedulesWithHydrate(past10Days, today)
    
    // Step 4: Sync future schedules - next 7 days (60%)
    message.value = 'hydrating.syncingUpcoming'
    progress.value = 60
    const future7Days = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000)
    await syncSchedulesWithHydrate(today, future7Days)
    
    // Step 5: Deep sync exercises and sets - DISABLED for performance
    // Exercises/sets will be fetched on-demand when opening a session
    message.value = 'hydrating.finalizing'
    progress.value = 80
    // await deepSyncExercisesAndSets() // Disabled: causes N×2 API calls
    
    // Done!
    progress.value = 100
    message.value = 'hydrating.ready'
    
    // Brief pause to show 100% before redirect
    await new Promise(resolve => setTimeout(resolve, 500))
    router.push('/')
    
  } catch (error: any) {
    console.error('[Hydration] Failed:', error)
    hasError.value = true
    errorMessage.value = error?.message || 'An unknown error occurred'
  }
}

// API Functions
async function syncMasterExercises() {
  const token = useCookie('metamorph-token')
  try {
    const exercises = await $fetch<any[]>('/api/v1/exercises', {
      headers: { Authorization: `Bearer ${token.value}` }
    })
    
    if (exercises && exercises.length > 0) {
      const localExercises = exercises.map(ex => ({
        id: ex.id || ex._id, // Use backend ID as local ID for simplicity
        remote_id: ex.id || ex._id, // Also store as remote_id for consistency
        name: ex.name,
        muscle_group: ex.muscle_group || ex.category,
        category: ex.category,
        equipment: ex.equipment,
        is_custom: ex.is_custom || false,
        personal_best_weight: 0,
        last_3_weights_history: [] as number[]
      }))
      await db.exercises.bulkPut(localExercises)
      console.log(`[Hydration] Synced ${localExercises.length} exercises`)
    }
  } catch (error) {
    console.warn('[Hydration] Failed to sync exercises:', error)
    // Non-critical, continue
  }
}

async function syncClients() {
  const token = useCookie('metamorph-token')
  try {
    const clients = await $fetch<any[]>('/api/v1/pro/clients/simple', {
      headers: { Authorization: `Bearer ${token.value}` }
    })
    
    if (clients && clients.length > 0) {
    // For now, just log success (clients table might not exist in current schema)
    // If needed, store in a dedicated clients table later
    console.log(`[Hydration] Synced ${clients.length} clients (not persisting to IndexedDB)`)
    }
  } catch (error) {
    console.warn('[Hydration] Failed to sync clients:', error)
    // Non-critical, continue
  }
}

async function syncSchedulesWithHydrate(from: Date, to: Date) {
  const token = useCookie('metamorph-token')
  const fromStr = from.toISOString().split('T')[0]
  const toStr = to.toISOString().split('T')[0]
  
  try {
    // Use the HYDRATE endpoint (returns all statuses including cancelled)
    const schedules = await $fetch<any[]>(`/api/v1/pro/schedules/hydrate?from=${fromStr}&to=${toStr}`, {
      headers: { Authorization: `Bearer ${token.value}` }
    })
    
    if (schedules && schedules.length > 0) {
      const localSchedules = schedules.map(s => ({
        id: s.client_id || s.id,
        remote_id: s.id,
        sync_status: 'synced' as const,
        member_id: s.member_id,
        member_name: s.member_name,
        coach_id: s.coach_id,
        start_time: s.start_time,
        end_time: s.end_time,
        status: s.status?.toLowerCase() || 'scheduled',
        session_goal: s.session_goal,
        coach_remarks: s.coach_remarks,
        churn_score: 0,
        attendance_trend: 'stable' as const
      }))
      await db.schedules.bulkPut(localSchedules)
      console.log(`[Hydration] Synced ${localSchedules.length} schedules (${fromStr} to ${toStr})`)
    }
  } catch (error) {
    console.warn('[Hydration] Failed to sync schedules:', error)
    throw error // This is critical
  }
}

async function deepSyncExercisesAndSets() {
  const token = useCookie('metamorph-token')
  const { syncPlannedExercises, syncScheduleSets } = useDatabase()
  
  // Get recently synced schedules
  const today = new Date()
  const past10Days = new Date(today.getTime() - 10 * 24 * 60 * 60 * 1000)
  const future7Days = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000)
  
  const schedules = await db.schedules
    .where('start_time')
    .between(past10Days.toISOString(), future7Days.toISOString())
    .toArray()
  
  console.log(`[Hydration] Deep syncing ${schedules.length} sessions...`)
  
  for (const sched of schedules) {
    const syncId = sched.remote_id || sched.id
    try {
      await syncPlannedExercises(syncId)
      await syncScheduleSets(syncId)
    } catch (e) {
      console.warn(`[Hydration] Deep sync failed for ${syncId}`, e)
      // Continue with other schedules
    }
  }
}

function retry() {
  hasError.value = false
  errorMessage.value = ''
  progress.value = 0
  hydrate()
}

// Start hydration on mount
onMounted(() => {
  hydrate()
})
</script>

<template>
  <div class="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
    <div class="text-center max-w-md mx-auto px-6">
      <!-- Logo -->
      <div class="mb-8">
        <div class="w-20 h-20 mx-auto bg-gradient-to-br from-primary-500 to-primary-600 rounded-2xl flex items-center justify-center shadow-lg shadow-primary-500/20">
          <span class="text-3xl font-bold text-white">M</span>
        </div>
        <h1 class="text-2xl font-bold text-white mt-4">METAMORPH</h1>
      </div>

      <!-- Error State -->
      <div v-if="hasError" class="space-y-6">
        <div class="bg-red-500/10 border border-red-500/20 rounded-xl p-6">
          <UIcon name="i-heroicons-exclamation-triangle" class="w-12 h-12 mx-auto text-red-400 mb-4" />
          <h2 class="text-lg font-semibold text-white mb-2">{{ $t('hydrating.errorTitle') }}</h2>
          <p class="text-sm text-gray-400 mb-4">{{ errorMessage }}</p>
          <UButton
            :label="$t('hydrating.tryAgain')"
            color="primary"
            @click="retry"
          />
        </div>
      </div>

      <!-- Loading State -->
      <div v-else class="space-y-6">
        <div class="space-y-2">
          <h2 class="text-xl font-semibold text-white">{{ $t('hydrating.pleaseWait') }}</h2>
          <p class="text-gray-400 text-sm">{{ $t('hydrating.settingUp') }}</p>
          <p class="text-gray-500 text-xs">{{ $t('hydrating.moment') }}</p>
        </div>

        <!-- Progress Bar -->
        <div class="space-y-3">
          <div class="h-2 bg-slate-700 rounded-full overflow-hidden">
            <div 
              class="h-full bg-gradient-to-r from-primary-500 to-primary-400 rounded-full transition-all duration-500 ease-out"
              :style="{ width: `${progress}%` }"
            />
          </div>
          <p class="text-sm text-gray-400">{{ $t(message) }}</p>
        </div>
      </div>
    </div>
  </div>
</template>
