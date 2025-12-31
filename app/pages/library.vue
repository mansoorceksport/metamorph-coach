<script setup lang="ts">
const mockExercises = [
  {
    id: '1',
    name: 'Barbell Back Squat',
    category: 'Lower Body',
    difficulty: 'Intermediate'
  },
  {
    id: '2',
    name: 'Bench Press',
    category: 'Upper Body',
    difficulty: 'Beginner'
  },
  {
    id: '3',
    name: 'Deadlift',
    category: 'Full Body',
    difficulty: 'Advanced'
  },
  {
    id: '4',
    name: 'Pull-ups',
    category: 'Upper Body',
    difficulty: 'Intermediate'
  }
]
</script>

<template>
  <div class="space-y-6">
    <!-- Header Section -->
    <div class="flex items-center justify-between">
      <h1 class="text-3xl font-bold">Exercise Library</h1>
      <UButton
        label="+ Add Exercise"
        color="primary"
        size="lg"
        icon="i-heroicons-plus"
      />
    </div>

    <!-- Exercise Cards -->
    <div class="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      <UCard v-for="exercise in mockExercises" :key="exercise.id">
        <template #header>
          <div class="flex items-center gap-3">
            <UIcon name="i-heroicons-fire" class="w-8 h-8 text-orange-500" />
            <div>
              <h3 class="font-semibold">{{ exercise.name }}</h3>
              <p class="text-sm text-gray-500 dark:text-gray-400">
                {{ exercise.category }}
              </p>
            </div>
          </div>
        </template>

        <div class="py-2">
          <div class="flex items-center gap-2">
            <UIcon name="i-heroicons-signal" class="w-4 h-4 text-gray-400" />
            <span class="text-sm text-gray-600 dark:text-gray-300">
              {{ exercise.difficulty }}
            </span>
          </div>
        </div>

        <template #footer>
          <UButton
            label="View Details"
            color="primary"
            variant="outline"
            block
            icon="i-heroicons-information-circle"
          />
        </template>
      </UCard>
    </div>
  </div>
</template>
