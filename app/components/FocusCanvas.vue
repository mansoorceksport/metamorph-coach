<script setup lang="ts">
import type { PlannedExercise, SetLog } from '~/utils/db'

const props = defineProps<{
  scheduleId: string
  exercises: Array<{
    id: string
    remoteId?: string | null
    exerciseId: string
    name: string
    targetSets: number
    targetReps: number
    restSeconds: number
    notes?: string
  }>
  setLogs: Record<string, Array<{
    id?: string
    weight: number | null
    reps: number | null
    completed: boolean
  }>>
}>()

const emit = defineEmits<{
  (e: 'updateSet', payload: { exerciseId: string; setIndex: number; field: 'weight' | 'reps'; value: number }): void
  (e: 'toggleComplete', payload: { exerciseId: string; setIndex: number }): void
  (e: 'addSet', exerciseId: string): void
  (e: 'removeSet', payload: { exerciseId: string; setIndex: number }): void
  (e: 'swapExercise', payload: { plannedExerciseId: string; newExerciseId: string; newName: string }): void
  (e: 'addExerciseToSession', payload: { exerciseId: string; name: string; targetSets: number; targetReps: number }): void
}>()

const focusStore = useFocusStore()
const { isOnline, pendingSyncCount, isSyncing } = useDatabase()

// Initialize store with exercise IDs
watchEffect(() => {
  focusStore.setExercises(props.exercises.map(ex => ex.id))
})

// Current active exercise
const activeExercise = computed(() => {
  if (!focusStore.activeExerciseId) return null
  return props.exercises.find(ex => ex.id === focusStore.activeExerciseId) || null
})

// Current set logs for active exercise
const activeSets = computed(() => {
  if (!focusStore.activeExerciseId) return []
  return props.setLogs[focusStore.activeExerciseId] || []
})

// Progress for active exercise
const activeProgress = computed(() => {
  const completed = activeSets.value.filter(s => s.completed).length
  return {
    completed,
    total: activeSets.value.length,
    percentage: activeSets.value.length > 0 ? Math.round((completed / activeSets.value.length) * 100) : 0
  }
})

// Overall session progress
const overallProgress = computed(() => {
  let total = 0
  let completed = 0
  for (const ex of props.exercises) {
    const logs = props.setLogs[ex.id] || []
    total += logs.length
    completed += logs.filter(s => s.completed).length
  }
  return {
    completed,
    total,
    percentage: total > 0 ? Math.round((completed / total) * 100) : 0
  }
})

// Stepper handlers
function incrementWeight(setIndex: number) {
  if (!focusStore.activeExerciseId) return
  const current = activeSets.value[setIndex]?.weight || 0
  emit('updateSet', {
    exerciseId: focusStore.activeExerciseId,
    setIndex,
    field: 'weight',
    value: current + 2.5
  })
}

function decrementWeight(setIndex: number) {
  if (!focusStore.activeExerciseId) return
  const current = activeSets.value[setIndex]?.weight || 0
  if (current >= 2.5) {
    emit('updateSet', {
      exerciseId: focusStore.activeExerciseId,
      setIndex,
      field: 'weight',
      value: current - 2.5
    })
  }
}

function incrementReps(setIndex: number) {
  if (!focusStore.activeExerciseId) return
  const current = activeSets.value[setIndex]?.reps || 0
  emit('updateSet', {
    exerciseId: focusStore.activeExerciseId,
    setIndex,
    field: 'reps',
    value: current + 1
  })
}

function decrementReps(setIndex: number) {
  if (!focusStore.activeExerciseId) return
  const current = activeSets.value[setIndex]?.reps || 0
  if (current > 0) {
    emit('updateSet', {
      exerciseId: focusStore.activeExerciseId,
      setIndex,
      field: 'reps',
      value: current - 1
    })
  }
}

function handleToggleComplete(setIndex: number) {
  if (!focusStore.activeExerciseId) return
  emit('toggleComplete', {
    exerciseId: focusStore.activeExerciseId,
    setIndex
  })
}

function handleAddSet() {
  if (!focusStore.activeExerciseId) return
  emit('addSet', focusStore.activeExerciseId)
}

function handleRemoveSet(setIndex: number) {
  if (!focusStore.activeExerciseId) return
  emit('removeSet', {
    exerciseId: focusStore.activeExerciseId,
    setIndex
  })
}

// Swipe gesture support (simplified - can enhance with VueUse)
const touchStartX = ref(0)
function handleTouchStart(e: TouchEvent) {
  const touch = e.touches[0]
  if (touch) {
    touchStartX.value = touch.clientX
  }
}
function handleTouchEnd(e: TouchEvent) {
  const touch = e.changedTouches[0]
  if (!touch) return
  const touchEndX = touch.clientX
  const diff = touchEndX - touchStartX.value
  if (Math.abs(diff) > 50) {
    if (diff > 0) {
      focusStore.prevExercise()
    } else {
      focusStore.nextExercise()
    }
  }
}
</script>

<template>
  <div 
    class="fixed inset-0 z-50 bg-slate-950 text-white flex flex-col"
    @touchstart="handleTouchStart"
    @touchend="handleTouchEnd"
  >
    <!-- Header -->
    <header class="flex items-center justify-between p-4 border-b border-slate-800">
      <UButton
        icon="i-heroicons-x-mark"
        color="neutral"
        variant="ghost"
        size="lg"
        @click="focusStore.exitMode()"
      />
      
      <div class="flex items-center gap-4">
        <!-- Sync Status -->
        <div v-if="!isOnline" class="flex items-center gap-2 px-3 py-1.5 bg-yellow-900/50 rounded-full">
          <UIcon name="i-heroicons-wifi" class="w-4 h-4 text-yellow-400" />
          <span class="text-xs font-medium text-yellow-400">Offline</span>
        </div>
        <div v-else-if="isSyncing" class="flex items-center gap-2 px-3 py-1.5 bg-blue-900/50 rounded-full">
          <UIcon name="i-heroicons-arrow-path" class="w-4 h-4 text-blue-400 animate-spin" />
          <span class="text-xs font-medium text-blue-400">Syncing</span>
        </div>
        <div v-else-if="pendingSyncCount > 0" class="flex items-center gap-2 px-3 py-1.5 bg-orange-900/50 rounded-full">
          <UIcon name="i-heroicons-cloud-arrow-up" class="w-4 h-4 text-orange-400" />
          <span class="text-xs font-medium text-orange-400">{{ pendingSyncCount }}</span>
        </div>
        <div v-else class="flex items-center gap-2 px-3 py-1.5 bg-green-900/50 rounded-full">
          <UIcon name="i-heroicons-check-circle" class="w-4 h-4 text-green-400" />
          <span class="text-xs font-medium text-green-400">Synced</span>
        </div>

        <!-- Overall Progress -->
        <div class="text-right">
          <div class="text-2xl font-bold">{{ overallProgress.percentage }}%</div>
          <div class="text-xs text-slate-400">{{ overallProgress.completed }}/{{ overallProgress.total }} sets</div>
        </div>
      </div>
    </header>

    <!-- Main Canvas Area -->
    <div class="flex-1 overflow-auto p-4 lg:p-8">
      <div v-if="activeExercise" class="max-w-2xl mx-auto">
        <!-- Exercise Header -->
        <div class="text-center mb-8">
          <h1 class="text-3xl lg:text-4xl font-bold mb-2">{{ activeExercise.name }}</h1>
          <p class="text-slate-400 text-lg">
            Target: {{ activeExercise.targetSets }} × {{ activeExercise.targetReps }} reps
          </p>
          <div class="mt-4 flex items-center justify-center gap-2">
            <div class="h-2 w-48 bg-slate-800 rounded-full overflow-hidden">
              <div 
                class="h-full bg-gradient-to-r from-green-500 to-emerald-400 transition-all duration-300"
                :style="{ width: `${activeProgress.percentage}%` }"
              />
            </div>
            <span class="text-sm text-slate-400">{{ activeProgress.completed }}/{{ activeProgress.total }}</span>
          </div>
        </div>

        <!-- Sets List -->
        <div class="space-y-4">
          <div 
            v-for="(set, index) in activeSets" 
            :key="index"
            class="bg-slate-900 rounded-2xl p-4 lg:p-6 transition-all duration-200"
            :class="set.completed ? 'ring-2 ring-green-500 bg-green-950/30' : ''"
          >
            <div class="flex items-center justify-between mb-4">
              <span class="text-xl font-semibold text-slate-300">Set {{ index + 1 }}</span>
              <button
                v-if="activeSets.length > 1"
                class="text-red-400 hover:text-red-300 p-2"
                @click="handleRemoveSet(index)"
              >
                <UIcon name="i-heroicons-trash" class="w-5 h-5" />
              </button>
            </div>

            <div class="grid grid-cols-2 gap-4 mb-4">
              <!-- Weight Stepper -->
              <div class="text-center">
                <label class="text-sm text-slate-400 block mb-2">Weight (kg)</label>
                <div class="flex items-center justify-center gap-2">
                  <button 
                    class="w-14 h-14 lg:w-16 lg:h-16 rounded-xl bg-slate-800 hover:bg-slate-700 active:bg-slate-600 text-2xl font-bold transition-colors"
                    @click="decrementWeight(index)"
                  >
                    −
                  </button>
                  <div class="w-20 text-center">
                    <span class="text-3xl lg:text-4xl font-bold">{{ set.weight ?? 0 }}</span>
                  </div>
                  <button 
                    class="w-14 h-14 lg:w-16 lg:h-16 rounded-xl bg-slate-800 hover:bg-slate-700 active:bg-slate-600 text-2xl font-bold transition-colors"
                    @click="incrementWeight(index)"
                  >
                    +
                  </button>
                </div>
              </div>

              <!-- Reps Stepper -->
              <div class="text-center">
                <label class="text-sm text-slate-400 block mb-2">Reps</label>
                <div class="flex items-center justify-center gap-2">
                  <button 
                    class="w-14 h-14 lg:w-16 lg:h-16 rounded-xl bg-slate-800 hover:bg-slate-700 active:bg-slate-600 text-2xl font-bold transition-colors"
                    @click="decrementReps(index)"
                  >
                    −
                  </button>
                  <div class="w-20 text-center">
                    <span class="text-3xl lg:text-4xl font-bold">{{ set.reps ?? 0 }}</span>
                  </div>
                  <button 
                    class="w-14 h-14 lg:w-16 lg:h-16 rounded-xl bg-slate-800 hover:bg-slate-700 active:bg-slate-600 text-2xl font-bold transition-colors"
                    @click="incrementReps(index)"
                  >
                    +
                  </button>
                </div>
              </div>
            </div>

            <!-- Done Button -->
            <button
              class="w-full py-4 rounded-xl text-xl font-bold transition-all duration-200"
              :class="set.completed 
                ? 'bg-green-600 hover:bg-green-500 text-white' 
                : 'bg-slate-700 hover:bg-slate-600 text-slate-200'"
              @click="handleToggleComplete(index)"
            >
              <span class="flex items-center justify-center gap-2">
                <UIcon 
                  :name="set.completed ? 'i-heroicons-check-circle-solid' : 'i-heroicons-check-circle'" 
                  class="w-6 h-6" 
                />
                {{ set.completed ? 'Completed!' : 'Mark Done' }}
              </span>
            </button>
          </div>

          <!-- Add Set Button -->
          <button
            class="w-full py-4 rounded-xl border-2 border-dashed border-slate-700 text-slate-400 hover:border-slate-500 hover:text-slate-300 transition-colors"
            @click="handleAddSet"
          >
            <span class="flex items-center justify-center gap-2">
              <UIcon name="i-heroicons-plus" class="w-5 h-5" />
              Add Set
            </span>
          </button>
        </div>
      </div>
    </div>

    <!-- Footer Navigation -->
    <footer class="border-t border-slate-800 p-4">
      <div class="max-w-2xl mx-auto flex items-center justify-between gap-4">
        <!-- Prev Button -->
        <button
          class="flex-1 py-4 rounded-xl bg-slate-800 text-slate-300 font-semibold transition-all"
          :class="focusStore.hasPrev ? 'hover:bg-slate-700' : 'opacity-50 cursor-not-allowed'"
          :disabled="!focusStore.hasPrev"
          @click="focusStore.prevExercise()"
        >
          <span class="flex items-center justify-center gap-2">
            <UIcon name="i-heroicons-chevron-left" class="w-5 h-5" />
            Previous
          </span>
        </button>

        <!-- Action Buttons -->
        <div class="flex gap-2">
          <UButton
            icon="i-heroicons-arrows-right-left"
            color="neutral"
            variant="soft"
            size="lg"
            class="!bg-slate-800 hover:!bg-slate-700"
            title="Replace Exercise"
            @click="focusStore.openSwapModal()"
          />
          <UButton
            icon="i-heroicons-plus-circle"
            color="neutral"
            variant="soft"
            size="lg"
            class="!bg-slate-800 hover:!bg-slate-700"
            title="Add Exercise"
            @click="focusStore.openAddModal()"
          />
        </div>

        <!-- Next Button -->
        <button
          class="flex-1 py-4 rounded-xl bg-slate-800 text-slate-300 font-semibold transition-all"
          :class="focusStore.hasNext ? 'hover:bg-slate-700' : 'opacity-50 cursor-not-allowed'"
          :disabled="!focusStore.hasNext"
          @click="focusStore.nextExercise()"
        >
          <span class="flex items-center justify-center gap-2">
            Next
            <UIcon name="i-heroicons-chevron-right" class="w-5 h-5" />
          </span>
        </button>
      </div>

      <!-- Exercise Dots -->
      <div class="flex items-center justify-center gap-2 mt-4">
        <button
          v-for="(ex, index) in exercises"
          :key="ex.id"
          class="w-3 h-3 rounded-full transition-all"
          :class="ex.id === focusStore.activeExerciseId 
            ? 'bg-white scale-125' 
            : 'bg-slate-600 hover:bg-slate-500'"
          :title="ex.name"
          @click="focusStore.setActiveExercise(ex.id)"
        />
      </div>
    </footer>
  </div>
</template>
