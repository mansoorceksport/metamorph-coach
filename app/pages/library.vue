<script setup lang="ts">
import { useExerciseLibrary } from '~/composables/useExerciseLibrary'

// Exercise library composable
const { exercises, loading, initLibrary, forceSync } = useExerciseLibrary()

// Search and filter state
const searchQuery = ref('')
const selectedMuscleGroup = ref('all')

// Pagination
const displayCount = ref(10)
const loadMoreRef = ref<HTMLElement | null>(null)

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

// Filtered exercises (with pagination)
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

    return result.slice(0, displayCount.value)
})

// Total count for "showing X of Y" display
const totalFilteredCount = computed(() => {
    let result = exercises.value
    if (searchQuery.value) {
        const query = searchQuery.value.toLowerCase()
        result = result.filter(ex =>
            ex.name.toLowerCase().includes(query) ||
            ex.equipment.toLowerCase().includes(query)
        )
    }
    if (selectedMuscleGroup.value && selectedMuscleGroup.value !== 'all') {
        result = result.filter(ex => ex.muscle_group === selectedMuscleGroup.value)
    }
    return result.length
})

// Check if there are more exercises to load
const hasMore = computed(() => displayCount.value < totalFilteredCount.value)

// Load more exercises
function loadMore() {
    displayCount.value += 10
}

// Reset pagination when filters change
watch([searchQuery, selectedMuscleGroup], () => {
    displayCount.value = 10
})

// Infinite scroll observer
onMounted(() => {
    const observer = new IntersectionObserver(
        (entries) => {
            if (entries[0]?.isIntersecting && hasMore.value && !loading.value) {
                loadMore()
            }
        },
        { threshold: 0.1 }
    )

    // Watch for the sentinel element
    watchEffect(() => {
        if (loadMoreRef.value) {
            observer.observe(loadMoreRef.value)
        }
    })

    onUnmounted(() => observer.disconnect())
})

// Modal state
const isModalOpen = ref(false)
const isSubmitting = ref(false)
const submitError = ref<string | null>(null)
const isEditMode = ref(false)
const editingExerciseId = ref<string | null>(null)

// Delete state
const isDeleteModalOpen = ref(false)
const exerciseToDelete = ref<{ id: string; name: string } | null>(null)
const isDeleting = ref(false)

// Form state
const form = reactive({
    name: '',
    muscle_group: '',
    equipment: '',
    video_url: '',
    reference_url: ''
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
    isEditMode.value = false
    editingExerciseId.value = null
    form.name = ''
    form.muscle_group = ''
    form.equipment = ''
    form.video_url = ''
    form.reference_url = ''
    submitError.value = null
    isModalOpen.value = true
}

// Open edit modal
function openEditModal(exercise: any) {
    isEditMode.value = true
    editingExerciseId.value = exercise.id
    form.name = exercise.name
    form.muscle_group = exercise.muscle_group
    form.equipment = exercise.equipment
    form.video_url = exercise.video_url || ''
    form.reference_url = exercise.reference_url || ''
    submitError.value = null
    isModalOpen.value = true
}

// Submit form (create or update)
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
        const payload = {
            name: form.name.trim(),
            muscle_group: form.muscle_group,
            equipment: form.equipment,
            video_url: form.video_url.trim() || '',
            reference_url: form.reference_url.trim() || ''
        }

        if (isEditMode.value && editingExerciseId.value) {
            // Update existing exercise
            await apiFetch(`/v1/exercises/${editingExerciseId.value}`, {
                method: 'PUT',
                body: payload
            })
        } else {
            // Create new exercise
            await apiFetch('/v1/exercises', {
                method: 'POST',
                body: payload
            })
        }

        // Force sync to update local IndexedDB
        await forceSync()
        isModalOpen.value = false
    } catch (error: any) {
        console.error('Failed to save exercise:', error)
        submitError.value = error?.data?.error || 'Failed to save exercise'
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
      Showing {{ filteredExercises.length }} of {{ totalFilteredCount }} exercise{{ totalFilteredCount !== 1 ? 's' : '' }}
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
        class="group relative bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden hover:shadow-lg hover:border-primary-300 dark:hover:border-primary-600 transition-all duration-200"
      >
        <!-- Action buttons (top right) -->
        <div class="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1 z-10">
          <button
            class="p-1.5 rounded-lg bg-white/80 dark:bg-gray-900/80 hover:bg-primary-100 dark:hover:bg-primary-900/30 text-gray-400 hover:text-primary-600"
            title="Edit exercise"
            @click="openEditModal(exercise)"
          >
            <UIcon name="i-lucide-pencil" class="w-4 h-4" />
          </button>
          <button
            class="p-1.5 rounded-lg bg-white/80 dark:bg-gray-900/80 hover:bg-red-100 dark:hover:bg-red-900/30 text-gray-400 hover:text-red-500"
            title="Delete exercise"
            @click="confirmDelete({ id: exercise.id, name: exercise.name })"
          >
            <UIcon name="i-lucide-trash-2" class="w-4 h-4" />
          </button>
        </div>

        <!-- Reference Image (if image URL) -->
        <div v-if="exercise.reference_url && exercise.reference_url.match(/\.(jpg|jpeg|png|gif|webp)$/i)" class="aspect-video w-full overflow-hidden bg-gray-100 dark:bg-gray-700">
          <img 
            :src="exercise.reference_url" 
            :alt="exercise.name"
            class="w-full h-full object-cover"
          />
        </div>

        <!-- Card Content -->
        <div class="p-4">
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

          <!-- Reference link (non-image URLs) -->
          <div v-if="exercise.reference_url && !exercise.reference_url.match(/\.(jpg|jpeg|png|gif|webp)$/i)" class="mt-2">
            <a
              :href="exercise.reference_url"
              target="_blank"
              class="inline-flex items-center gap-1.5 text-sm text-primary-500 hover:text-primary-600"
            >
              <UIcon name="i-lucide-external-link" class="w-4 h-4" />
              <span>View Guide</span>
            </a>
          </div>
        </div>
      </div>
    </div>

    <!-- Infinite Scroll Sentinel -->
    <div
      v-if="hasMore"
      ref="loadMoreRef"
      class="flex justify-center py-8"
    >
      <UIcon name="i-lucide-loader-2" class="w-6 h-6 animate-spin text-gray-400" />
    </div>

    <!-- Add/Edit Exercise Modal -->
    <UModal v-model:open="isModalOpen" class="sm:max-w-lg">
      <template #content>
        <div class="p-6 space-y-4">
          <!-- Header -->
          <div class="flex items-center gap-3 mb-4">
            <div class="w-12 h-12 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center">
              <UIcon :name="isEditMode ? 'i-lucide-pencil' : 'i-lucide-plus'" class="w-6 h-6 text-primary-600" />
            </div>
            <div>
              <h2 class="text-xl font-bold text-gray-900 dark:text-white">{{ isEditMode ? 'Edit Exercise' : 'Add New Exercise' }}</h2>
              <p class="text-sm text-gray-500">{{ isEditMode ? 'Update exercise details' : 'Add to your exercise library' }}</p>
            </div>
          </div>

          <!-- Error Alert -->
          <UAlert
            v-if="submitError"
            color="error"
            icon="i-lucide-alert-circle"
            :title="submitError"
            class="mb-4"
          />

          <form @submit.prevent="submitExercise" class="space-y-4">
            <!-- Exercise Name -->
            <div>
              <label class="block text-sm font-medium mb-1">Exercise Name <span class="text-red-500">*</span></label>
              <UInput
                v-model="form.name"
                placeholder="e.g., Barbell Squat"
                size="lg"
              />
            </div>

            <!-- Muscle Group & Equipment -->
            <div class="grid grid-cols-2 gap-4">
              <div>
                <label class="block text-sm font-medium mb-1">Muscle Group <span class="text-red-500">*</span></label>
                <USelect
                  v-model="form.muscle_group"
                  :items="muscleGroups"
                  placeholder="Select..."
                  size="lg"
                />
              </div>

              <div>
                <label class="block text-sm font-medium mb-1">Equipment <span class="text-red-500">*</span></label>
                <USelect
                  v-model="form.equipment"
                  :items="equipmentOptions"
                  placeholder="Select..."
                  size="lg"
                />
              </div>
            </div>

            <!-- Video URL -->
            <div>
              <label class="block text-sm font-medium mb-1">
                Video URL
                <span class="text-gray-400 font-normal">(optional)</span>
              </label>
              <UInput
                v-model="form.video_url"
                placeholder="https://youtube.com/watch?v=..."
                size="lg"
              />
            </div>

            <!-- Reference URL -->
            <div>
              <label class="block text-sm font-medium mb-1">
                Reference URL
                <span class="text-gray-400 font-normal">(optional)</span>
              </label>
              <UInput
                v-model="form.reference_url"
                placeholder="https://weighttraining.guide/exercises/..."
                size="lg"
              />
              <p class="text-xs text-gray-500 mt-1">Image URL or link to exercise guide</p>
            </div>

            <!-- Actions -->
            <div class="flex gap-3 pt-4">
              <UButton
                label="Cancel"
                color="neutral"
                variant="outline"
                class="flex-1"
                @click="isModalOpen = false"
              />
              <UButton
                type="submit"
                :label="isEditMode ? 'Save Changes' : 'Add Exercise'"
                color="primary"
                class="flex-1"
                :loading="isSubmitting"
              />
            </div>
          </form>
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
