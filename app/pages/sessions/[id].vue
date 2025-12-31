<script setup lang="ts">
const route = useRoute()
const sessionId = route.params.id
</script>

<template>
  <div class="space-y-6">
    <!-- Header Section -->
    <div class="flex items-center justify-between">
      <div class="flex items-center gap-3">
        <UButton
          to="/"
          icon="i-heroicons-arrow-left"
          color="neutral"
          variant="ghost"
          aria-label="Back to agenda"
        />
        <h1 class="text-3xl font-bold">Live Session</h1>
      </div>
      <UButton
        label="End Session"
        color="error"
        variant="outline"
        icon="i-heroicons-x-mark"
      />
    </div>

    <!-- Session Info Card -->
    <UCard>
      <template #header>
        <div class="flex items-center justify-between">
          <div>
            <h2 class="text-xl font-semibold">Session #{{ sessionId }}</h2>
            <p class="text-sm text-gray-500 dark:text-gray-400">
              Client: John Smith • Started 3:00 PM
            </p>
          </div>
          <UIcon name="i-heroicons-play-circle" class="w-10 h-10 text-green-500" />
        </div>
      </template>

      <div class="space-y-4">
        <div class="grid grid-cols-3 gap-4 text-center">
          <div>
            <p class="text-2xl font-bold">24:35</p>
            <p class="text-sm text-gray-500 dark:text-gray-400">Duration</p>
          </div>
          <div>
            <p class="text-2xl font-bold">8/12</p>
            <p class="text-sm text-gray-500 dark:text-gray-400">Exercises</p>
          </div>
          <div>
            <p class="text-2xl font-bold">142</p>
            <p class="text-sm text-gray-500 dark:text-gray-400">Avg HR</p>
          </div>
        </div>
      </div>
    </UCard>

    <!-- Workout Controls -->
    <UCard>
      <template #header>
        <div class="flex items-center gap-2">
          <UIcon name="i-heroicons-clipboard-document-list" class="w-6 h-6" />
          <h2 class="text-xl font-semibold">Workout Plan</h2>
        </div>
      </template>

      <div class="space-y-3">
        <div class="text-sm text-gray-600 dark:text-gray-300">
          Exercise list and workout controls will be displayed here
        </div>

        <div class="flex gap-3 pt-4">
          <UButton
            label="Previous Exercise"
            color="neutral"
            icon="i-heroicons-chevron-left"
          />
          <UButton
            label="Next Exercise"
            color="primary"
            icon="i-heroicons-chevron-right"
            trailing
            class="flex-1"
          />
        </div>
      </div>
    </UCard>
  </div>
</template>
