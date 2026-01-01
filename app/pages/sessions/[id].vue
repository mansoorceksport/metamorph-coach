<script setup lang="ts">
const route = useRoute()
const sessionId = route.params.id

// Mock Session Data
const session = ref({
  id: sessionId,
  memberName: 'Sarah Jenkins',
  goal: 'Hypertrophy Focus',
  startTime: '3:00 PM',
  status: 'in-progress'
})

// Mock Exercise Data (PlannedExercise schema)
const exercises = ref([
  {
    id: 'ex1',
    name: 'Barbell Back Squat',
    targetSets: 4,
    targetReps: 8,
    restSeconds: 120,
    notes: 'Focus on depth and controlled eccentric'
  },
  {
    id: 'ex2',
    name: 'Romanian Deadlift',
    targetSets: 3,
    targetReps: 10,
    restSeconds: 90,
    notes: 'Maintain neutral spine'
  },
  {
    id: 'ex3',
    name: 'Leg Press',
    targetSets: 3,
    targetReps: 12,
    restSeconds: 60,
    notes: 'Full range of motion'
  },
  {
    id: 'ex4',
    name: 'Walking Lunges',
    targetSets: 3,
    targetReps: 12,
    restSeconds: 60,
    notes: 'Each leg counts as 1 rep'
  }
])

// Mock Personal Bests (for PB detection)
const exercisePBs: Record<string, number> = {
  'ex1': 80, // Squat PB: 80kg
  'ex2': 70, // RDL PB: 70kg
  'ex3': 150, // Leg Press PB: 150kg
  'ex4': 20 // Lunges PB: 20kg
}

// Set Logs State - tracks weight/reps/completed for each set
interface SetLog {
  weight: number | null
  reps: number | null
  completed: boolean
}

const setLogs = ref<Record<string, SetLog[]>>({})

// Initialize set logs for each exercise
function initializeSetLogs() {
  exercises.value.forEach(ex => {
    if (!setLogs.value[ex.id]) {
      setLogs.value[ex.id] = Array.from({ length: ex.targetSets }, () => ({
        weight: null,
        reps: null,
        completed: false
      }))
    }
  })
}
initializeSetLogs()

// Check if a weight is a new PB
function isNewPB(exerciseId: string, weight: number | null): boolean {
  if (!weight || weight <= 0) return false
  const currentPB = exercisePBs[exerciseId] || 0
  return weight > currentPB
}

// Get the current PB for an exercise
function getPB(exerciseId: string): number {
  return exercisePBs[exerciseId] || 0
}

// Mark set as complete
function toggleSetComplete(exerciseId: string, setIndex: number) {
  setLogs.value[exerciseId][setIndex].completed = !setLogs.value[exerciseId][setIndex].completed
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

// Check if session is complete
const isSessionComplete = computed(() => overallProgress.value.percentage === 100)

// Add a set to an exercise
function addSet(exerciseId: string) {
  if (!setLogs.value[exerciseId]) {
    setLogs.value[exerciseId] = []
  }
  setLogs.value[exerciseId].push({
    weight: null,
    reps: null,
    completed: false
  })
}

// Remove a set from an exercise
function removeSet(exerciseId: string, setIndex: number) {
  if (setLogs.value[exerciseId] && setLogs.value[exerciseId].length > 1) {
    setLogs.value[exerciseId].splice(setIndex, 1)
  }
}

// Add a new exercise to the session
const showAddExercise = ref(false)
const newExerciseName = ref('')

function addExercise() {
  if (!newExerciseName.value.trim()) return
  
  const newId = `ex${Date.now()}`
  exercises.value.push({
    id: newId,
    name: newExerciseName.value.trim(),
    targetSets: 3,
    targetReps: 10,
    restSeconds: 60,
    notes: ''
  })
  
  // Initialize set logs for the new exercise
  setLogs.value[newId] = Array.from({ length: 3 }, () => ({
    weight: null,
    reps: null,
    completed: false
  }))
  
  newExerciseName.value = ''
  showAddExercise.value = false
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

// Final finish - navigate home
function completeFinalFinish() {
  console.log('Session finished with remarks:', coachRemarks.value)
  console.log('Session data:', setLogs.value)
  console.log('Improvements:', sessionImprovements.value)
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
      :default-value="[exercises[0]?.id]"
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
                  :disabled="setLogs[exercise.id].length <= 1"
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
              variant="dashed"
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
      <div v-else class="space-y-3">
        <UInput
          v-model="newExerciseName"
          placeholder="Exercise name (e.g., Bench Press)"
          size="lg"
          autofocus
          @keyup.enter="addExercise"
        />
        <div class="flex gap-2">
          <UButton
            label="Add"
            icon="i-heroicons-check"
            color="primary"
            class="flex-1"
            @click="addExercise"
            :disabled="!newExerciseName.trim()"
          />
          <UButton
            label="Cancel"
            color="neutral"
            variant="outline"
            @click="showAddExercise = false; newExerciseName = ''"
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

    <!-- Confirmation Modal -->
    <UModal v-model:open="showConfirmModal" :ui="{ width: 'sm:max-w-md' }">
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
    <UModal v-model:open="showRemarksModal" :ui="{ width: 'sm:max-w-lg' }">
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
    <UModal v-model:open="showSummaryModal" :ui="{ width: 'sm:max-w-lg' }">
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
