<script setup lang="ts">
import { useExerciseLibrary } from '~/composables/useExerciseLibrary'

// Exercise library composable
const { exercises, loading, initLibrary, forceSync } = useExerciseLibrary()

// Search and filter state
const searchQuery = ref('')
const selectedMuscleGroup = ref('all')

// Filter options - use 'all' instead of empty string (USelect requires non-empty values)
const muscleGroupOptions = [
    { label: 'All Muscle Groups', value: 'all' },
    { label: 'Legs', value: 'Legs' },
    { label: 'Chest', value: 'Chest' },
    { label: 'Back', value: 'Back' },
    { label: 'Shoulders', value: 'Shoulders' },
    { label: 'Arms', value: 'Arms' },
    { label: 'Core', value: 'Core' },
    { label: 'Full Body', value: 'Full Body' }
]

// Filtered exercises
const filteredExercises = computed(() => {
    let result = exercises.value

    // Filter by search query
    if (searchQuery.value) {
        const query = searchQuery.value.toLowerCase()
        result = result.filter(ex =>
            ex.name.toLowerCase().includes(query) ||
            ex.equipment.toLowerCase().includes(query)
        )
    }

    // Filter by muscle group (skip if 'all' is selected)
    if (selectedMuscleGroup.value && selectedMuscleGroup.value !== 'all') {
        result = result.filter(ex => ex.muscle_group === selectedMuscleGroup.value)
    }

    return result
})

// Modal state
const isModalOpen = ref(false)
const isSubmitting = ref(false)
const submitError = ref<string | null>(null)

// Delete state
const isDeleteModalOpen = ref(false)
const exerciseToDelete = ref<{ id: string; name: string } | null>(null)
const isDeleting = ref(false)

// Form state
const form = reactive({
    name: '',
    muscle_group: '',
    equipment: '',
    video_url: ''
})

// Form dropdown options
const muscleGroups = ['Legs', 'Chest', 'Back', 'Shoulders', 'Arms', 'Core', 'Full Body']
const equipmentOptions = ['Barbell', 'Dumbbell', 'Machine', 'Cable', 'Bodyweight', 'Kettlebell', 'Resistance Band', 'Other']

// Initialize library on mount
onMounted(async () => {
    await initLibrary()
})

// Open add modal
function openModal() {
    form.name = ''
    form.muscle_group = ''
    form.equipment = ''
    form.video_url = ''
    submitError.value = null
    isModalOpen.value = true
}

// Submit form
async function submitExercise() {
    if (!form.name.trim()) {
        submitError.value = 'Exercise name is required'
        return
    }
    if (!form.muscle_group) {
        submitError.value = 'Please select a muscle group'
        return
    }
    if (!form.equipment) {
        submitError.value = 'Please select equipment'
        return
    }

    isSubmitting.value = true
    submitError.value = null

    try {
        const { apiFetch } = useApi()
        await apiFetch('/v1/exercises', {
            method: 'POST',
            body: {
                name: form.name.trim(),
                muscle_group: form.muscle_group,
                equipment: form.equipment,
                video_url: form.video_url.trim() || ''
            }
        })

        // Force sync to update local IndexedDB
        await forceSync()
        isModalOpen.value = false
    } catch (error: any) {
        console.error('Failed to create exercise:', error)
        submitError.value = error?.data?.error || 'Failed to create exercise'
    } finally {
        isSubmitting.value = false
    }
}

// Open delete confirmation
function confirmDelete(exercise: { id: string; name: string }) {
    exerciseToDelete.value = exercise
    isDeleteModalOpen.value = true
}

// Delete exercise
async function deleteExercise() {
    if (!exerciseToDelete.value) return

    isDeleting.value = true

    try {
        const { apiFetch } = useApi()
        await apiFetch(`/v1/exercises/${exerciseToDelete.value.id}`, {
            method: 'DELETE'
        })

        // Force sync to update local IndexedDB
        await forceSync()
        isDeleteModalOpen.value = false
        exerciseToDelete.value = null
    } catch (error: any) {
        console.error('Failed to delete exercise:', error)
    } finally {
        isDeleting.value = false
    }
}

// Get icon based on muscle group
function getMuscleIcon(group: string): string {
    const icons: Record<string, string> = {
        'Legs': 'i-lucide-footprints',
        'Chest': 'i-lucide-heart',
        'Back': 'i-lucide-move-diagonal',
        'Shoulders': 'i-lucide-circle-user-round',
        'Arms': 'i-lucide-biceps-flexed',
        'Core': 'i-lucide-target',
        'Full Body': 'i-lucide-flame'
    }
    return icons[group] || 'i-lucide-dumbbell'
}

// Get color based on muscle group
function getMuscleColor(group: string): string {
    const colors: Record<string, string> = {
        'Legs': 'text-blue-500',
        'Chest': 'text-red-500',
        'Back': 'text-purple-500',
        'Shoulders': 'text-yellow-500',
        'Arms': 'text-orange-500',
        'Core': 'text-green-500',
        'Full Body': 'text-pink-500'
    }
    return colors[group] || 'text-gray-500'
}
</script>

<template>
  <div class="space-y-6">
    <!-- Header Section -->
    <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <h1 class="text-3xl font-bold">Exercise Library</h1>
      <UButton
        label="Add Exercise"
        color="primary"
        size="lg"
        icon="i-lucide-plus"
        @click="openModal"
      />
    </div>

    <!-- Search and Filter Bar -->
    <div class="flex flex-col gap-3 sm:flex-row sm:items-center">
      <div class="flex-1">
        <UInput
          v-model="searchQuery"
          placeholder="Search exercises..."
          icon="i-lucide-search"
          size="lg"
          class="w-full"
        />
      </div>
      <div class="w-full sm:w-48">
        <USelect
          v-model="selectedMuscleGroup"
          :items="muscleGroupOptions"
          value-key="value"
          size="lg"
        />
      </div>
    </div>

    <!-- Results count -->
    <div v-if="!loading" class="text-sm text-gray-500">
      {{ filteredExercises.length }} exercise{{ filteredExercises.length !== 1 ? 's' : '' }}
      <span v-if="searchQuery || selectedMuscleGroup !== 'all'">found</span>
    </div>

    <!-- Loading State -->
    <div v-if="loading" class="flex justify-center py-12">
      <UIcon name="i-lucide-loader-2" class="w-8 h-8 animate-spin text-primary" />
    </div>

    <!-- Empty State -->
    <div v-else-if="filteredExercises.length === 0" class="text-center py-12">
      <UIcon name="i-lucide-dumbbell" class="w-16 h-16 mx-auto text-gray-300 mb-4" />
      <h3 class="text-lg font-medium text-gray-900 dark:text-white">
        {{ (searchQuery || selectedMuscleGroup !== 'all') ? 'No exercises match your search' : 'No exercises yet' }}
      </h3>
      <p class="text-gray-500 mt-1">
        {{ (searchQuery || selectedMuscleGroup !== 'all') ? 'Try adjusting your filters' : 'Add your first exercise to get started' }}
      </p>
      <UButton
        v-if="!searchQuery && selectedMuscleGroup === 'all'"
        label="Add Exercise"
        color="primary"
        class="mt-4"
        @click="openModal"
      />
    </div>

    <!-- Exercise Cards Grid -->
    <div v-else class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      <div
        v-for="exercise in filteredExercises"
        :key="exercise.id"
        class="group relative bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 hover:shadow-lg hover:border-primary-300 dark:hover:border-primary-600 transition-all duration-200"
      >
        <!-- Delete button (top right) -->
        <button
          class="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30 text-gray-400 hover:text-red-500"
          title="Delete exercise"
          @click="confirmDelete({ id: exercise.id, name: exercise.name })"
        >
          <UIcon name="i-lucide-trash-2" class="w-4 h-4" />
        </button>

        <!-- Exercise icon and name -->
        <div class="flex items-start gap-3 mb-3">
          <div class="p-2 bg-gray-100 dark:bg-gray-700 rounded-lg">
            <UIcon
              :name="getMuscleIcon(exercise.muscle_group)"
              :class="['w-6 h-6', getMuscleColor(exercise.muscle_group)]"
            />
          </div>
          <div class="flex-1 min-w-0">
            <h3 class="font-semibold text-gray-900 dark:text-white truncate">
              {{ exercise.name }}
            </h3>
            <p class="text-sm text-gray-500 dark:text-gray-400">
              {{ exercise.muscle_group }}
            </p>
          </div>
        </div>

        <!-- Equipment -->
        <div class="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
          <UIcon name="i-lucide-wrench" class="w-4 h-4 text-gray-400" />
          <span>{{ exercise.equipment }}</span>
        </div>

        <!-- Video link -->
        <div v-if="exercise.video_url" class="mt-2">
          <a
            :href="exercise.video_url"
            target="_blank"
            class="inline-flex items-center gap-1.5 text-sm text-red-500 hover:text-red-600"
          >
            <UIcon name="i-lucide-play-circle" class="w-4 h-4" />
            <span>Watch Video</span>
          </a>
        </div>
      </div>
    </div>

    <!-- Add Exercise Modal -->
    <UModal v-model:open="isModalOpen">
      <template #content>
        <div class="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-md mx-auto overflow-hidden">
          <!-- Modal Header -->
          <div class="bg-gradient-to-r from-primary-500 to-primary-600 px-6 py-4">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-3">
                <div class="p-2 bg-white/20 rounded-lg">
                  <UIcon name="i-lucide-plus" class="w-5 h-5 text-white" />
                </div>
                <h2 class="text-xl font-semibold text-white">Add New Exercise</h2>
              </div>
              <button
                class="p-1.5 rounded-lg hover:bg-white/20 transition-colors"
                @click="isModalOpen = false"
              >
                <UIcon name="i-lucide-x" class="w-5 h-5 text-white" />
              </button>
            </div>
          </div>

          <!-- Modal Body -->
          <div class="p-6 space-y-5">
            <!-- Error Alert -->
            <UAlert
              v-if="submitError"
              color="error"
              icon="i-lucide-alert-circle"
              :title="submitError"
              class="mb-4"
            />

            <!-- Exercise Name -->
            <div class="space-y-2">
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Exercise Name <span class="text-red-500">*</span>
              </label>
              <UInput
                v-model="form.name"
                placeholder="e.g., Barbell Squat"
                size="lg"
              />
            </div>

            <!-- Muscle Group & Equipment Grid -->
            <div class="grid grid-cols-2 gap-4">
              <div class="space-y-2">
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Muscle Group <span class="text-red-500">*</span>
                </label>
                <USelect
                  v-model="form.muscle_group"
                  :items="muscleGroups"
                  placeholder="Select..."
                  size="lg"
                />
              </div>

              <div class="space-y-2">
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Equipment <span class="text-red-500">*</span>
                </label>
                <USelect
                  v-model="form.equipment"
                  :items="equipmentOptions"
                  placeholder="Select..."
                  size="lg"
                />
              </div>
            </div>

            <!-- Video URL -->
            <div class="space-y-2">
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Video URL
                <span class="text-gray-400 font-normal">(optional)</span>
              </label>
              <UInput
                v-model="form.video_url"
                placeholder="https://youtube.com/watch?v=..."
                size="lg"
              />
            </div>
          </div>

          <!-- Modal Footer -->
          <div class="px-6 py-4 bg-gray-50 dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-3">
            <UButton
              label="Cancel"
              color="neutral"
              variant="ghost"
              @click="isModalOpen = false"
            />
            <UButton
              label="Add Exercise"
              color="primary"
              icon="i-lucide-plus"
              :loading="isSubmitting"
              @click="submitExercise"
            />
          </div>
        </div>
      </template>
    </UModal>

    <!-- Delete Confirmation Modal -->
    <UModal v-model:open="isDeleteModalOpen">
      <template #content>
        <div class="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-sm mx-auto overflow-hidden">
          <div class="p-6 text-center">
            <div class="w-16 h-16 mx-auto mb-4 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center">
              <UIcon name="i-lucide-trash-2" class="w-8 h-8 text-red-500" />
            </div>
            <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-2">Delete Exercise?</h3>
            <p class="text-gray-500 dark:text-gray-400 mb-6">
              Are you sure you want to delete <strong>"{{ exerciseToDelete?.name }}"</strong>? This action cannot be undone.
            </p>
            <div class="flex gap-3 justify-center">
              <UButton
                label="Cancel"
                color="neutral"
                variant="outline"
                @click="isDeleteModalOpen = false"
              />
              <UButton
                label="Delete"
                color="error"
                icon="i-lucide-trash-2"
                :loading="isDeleting"
                @click="deleteExercise"
              />
            </div>
          </div>
        </div>
      </template>
    </UModal>
  </div>
</template>
