<script setup lang="ts">
import type { Exercise } from '~/utils/db'

const props = defineProps<{
  mode: 'swap' | 'add'
  currentExerciseId?: string
}>()

const emit = defineEmits<{
  (e: 'select', payload: { exerciseId: string; name: string; muscleGroup: string; equipment: string }): void
  (e: 'createNew', payload: { name: string; muscleGroup: string; equipment: string }): void
  (e: 'close'): void
}>()

const focusStore = useFocusStore()
const { exerciseLibrary, searchExercises, muscleGroups, isLoadingLibrary, initLibrary } = useExerciseLibrary()

// Search state
const searchQuery = ref('')
const showCreateForm = ref(false)

// New exercise form state
const newExerciseName = ref('')
const newExerciseMuscleGroup = ref('')
const newExerciseEquipment = ref('')

// Initialize library on mount
onMounted(async () => {
  await initLibrary()
})

// Filtered exercises
const filteredExercises = computed(() => {
  if (!searchQuery.value.trim()) {
    return exerciseLibrary.value.slice(0, 20) // Show first 20
  }
  return searchExercises(searchQuery.value).slice(0, 20)
})

// Common equipment options
const equipmentOptions = [
  'Barbell',
  'Dumbbell',
  'Cable',
  'Machine',
  'Bodyweight',
  'Kettlebell',
  'Resistance Band',
  'Smith Machine',
  'Other'
]

function handleSelect(exercise: Exercise) {
  emit('select', {
    exerciseId: exercise.id,
    name: exercise.name,
    muscleGroup: exercise.muscle_group,
    equipment: exercise.equipment
  })
  handleClose()
}

function handleCreateNew() {
  if (!newExerciseName.value.trim()) return
  
  emit('createNew', {
    name: newExerciseName.value.trim(),
    muscleGroup: newExerciseMuscleGroup.value || 'Other',
    equipment: newExerciseEquipment.value || 'Other'
  })
  handleClose()
}

function handleClose() {
  focusStore.closeModals()
  emit('close')
}

function toggleCreateForm() {
  showCreateForm.value = !showCreateForm.value
  if (showCreateForm.value) {
    // Pre-fill name from search if available
    newExerciseName.value = searchQuery.value
  }
}
</script>

<template>
  <Teleport to="body">
    <div 
      class="fixed inset-0 z-[60] bg-black/80 flex items-end lg:items-center justify-center"
      @click.self="handleClose"
    >
      <div 
        class="bg-slate-900 w-full max-w-lg max-h-[85vh] rounded-t-3xl lg:rounded-2xl flex flex-col overflow-hidden"
      >
        <!-- Header -->
        <div class="flex items-center justify-between p-4 border-b border-slate-800">
          <h2 class="text-xl font-bold text-white">
            {{ mode === 'swap' ? 'Replace Exercise' : 'Add Exercise' }}
          </h2>
          <button 
            class="p-2 rounded-lg hover:bg-slate-800 transition-colors"
            @click="handleClose"
          >
            <UIcon name="i-heroicons-x-mark" class="w-6 h-6 text-slate-400" />
          </button>
        </div>

        <!-- Search -->
        <div class="p-4 border-b border-slate-800">
          <div class="relative">
            <UIcon 
              name="i-heroicons-magnifying-glass" 
              class="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" 
            />
            <input
              v-model="searchQuery"
              type="text"
              placeholder="Search exercises..."
              class="w-full bg-slate-800 text-white pl-12 pr-4 py-3 rounded-xl border border-slate-700 focus:border-blue-500 focus:outline-none transition-colors"
            />
          </div>
        </div>

        <!-- Create New Form -->
        <div v-if="showCreateForm" class="p-4 bg-slate-800/50 border-b border-slate-700">
          <h3 class="text-sm font-semibold text-slate-300 mb-3">Create Custom Exercise</h3>
          <div class="space-y-3">
            <input
              v-model="newExerciseName"
              type="text"
              placeholder="Exercise name"
              class="w-full bg-slate-800 text-white px-4 py-3 rounded-xl border border-slate-700 focus:border-blue-500 focus:outline-none"
            />
            <div class="grid grid-cols-2 gap-3">
              <select
                v-model="newExerciseMuscleGroup"
                class="bg-slate-800 text-white px-4 py-3 rounded-xl border border-slate-700 focus:border-blue-500 focus:outline-none"
              >
                <option value="">Muscle Group</option>
                <option v-for="group in muscleGroups" :key="group" :value="group">
                  {{ group }}
                </option>
                <option value="Other">Other</option>
              </select>
              <select
                v-model="newExerciseEquipment"
                class="bg-slate-800 text-white px-4 py-3 rounded-xl border border-slate-700 focus:border-blue-500 focus:outline-none"
              >
                <option value="">Equipment</option>
                <option v-for="eq in equipmentOptions" :key="eq" :value="eq">
                  {{ eq }}
                </option>
              </select>
            </div>
            <div class="flex gap-2">
              <button
                class="flex-1 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold transition-colors disabled:opacity-50"
                :disabled="!newExerciseName.trim()"
                @click="handleCreateNew"
              >
                Create & Select
              </button>
              <button
                class="px-4 py-3 rounded-xl bg-slate-700 hover:bg-slate-600 text-slate-300 transition-colors"
                @click="showCreateForm = false"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>

        <!-- Exercise List -->
        <div class="flex-1 overflow-auto p-4">
          <div v-if="isLoadingLibrary" class="flex items-center justify-center py-8">
            <UIcon name="i-heroicons-arrow-path" class="w-8 h-8 text-slate-400 animate-spin" />
          </div>

          <div v-else-if="filteredExercises.length === 0" class="text-center py-8">
            <UIcon name="i-heroicons-magnifying-glass" class="w-12 h-12 text-slate-600 mx-auto mb-3" />
            <p class="text-slate-400 mb-4">No exercises found</p>
            <button
              v-if="!showCreateForm"
              class="px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold transition-colors"
              @click="toggleCreateForm"
            >
              Create "{{ searchQuery }}"
            </button>
          </div>

          <div v-else class="space-y-2">
            <!-- Create New Button -->
            <button
              v-if="!showCreateForm"
              class="w-full p-4 rounded-xl border-2 border-dashed border-slate-700 text-slate-400 hover:border-blue-500 hover:text-blue-400 transition-colors flex items-center gap-3"
              @click="toggleCreateForm"
            >
              <UIcon name="i-heroicons-plus-circle" class="w-6 h-6" />
              <span>Create Custom Exercise</span>
            </button>

            <!-- Exercise Items -->
            <button
              v-for="exercise in filteredExercises"
              :key="exercise.id"
              class="w-full p-4 rounded-xl bg-slate-800 hover:bg-slate-700 transition-colors text-left flex items-center gap-4"
              :class="exercise.id === currentExerciseId ? 'ring-2 ring-blue-500' : ''"
              @click="handleSelect(exercise)"
            >
              <div class="flex-1 min-w-0">
                <p class="font-semibold text-white truncate">{{ exercise.name }}</p>
                <p class="text-sm text-slate-400 truncate">
                  {{ exercise.muscle_group }} · {{ exercise.equipment }}
                </p>
              </div>
              <UIcon 
                v-if="exercise.id === currentExerciseId" 
                name="i-heroicons-check-circle-solid" 
                class="w-6 h-6 text-blue-500 flex-shrink-0" 
              />
            </button>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>
