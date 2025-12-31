<script setup lang="ts">
const route = useRoute()
const clientId = route.params.id
</script>

<template>
  <div class="space-y-6">
    <!-- Header Section -->
    <div class="flex items-center justify-between">
      <div class="flex items-center gap-3">
        <UButton
          to="/clients"
          icon="i-heroicons-arrow-left"
          color="neutral"
          variant="ghost"
          aria-label="Back to clients"
        />
        <h1 class="text-3xl font-bold">Client Profile</h1>
      </div>
      <UButton
        label="Schedule Session"
        color="primary"
        icon="i-heroicons-calendar-plus"
      />
    </div>

    <!-- Client Info Card -->
    <UCard>
      <template #header>
        <div class="flex items-center gap-4">
          <UIcon name="i-heroicons-user-circle" class="w-16 h-16 text-primary" />
          <div>
            <h2 class="text-2xl font-semibold">Client #{{ clientId }}</h2>
            <p class="text-gray-500 dark:text-gray-400">Member since 2024</p>
          </div>
        </div>
      </template>

      <div class="space-y-4">
        <div>
          <h3 class="font-semibold mb-2">Contact Information</h3>
          <p class="text-sm text-gray-600 dark:text-gray-300">
            Contact details will be displayed here
          </p>
        </div>
      </div>
    </UCard>

    <!-- Session History -->
    <UCard>
      <template #header>
        <div class="flex items-center gap-2">
          <UIcon name="i-heroicons-clock" class="w-6 h-6" />
          <h2 class="text-xl font-semibold">Session History</h2>
        </div>
      </template>

      <div class="text-sm text-gray-600 dark:text-gray-300">
        Session history will be displayed here
      </div>
    </UCard>

    <!-- InBody Trends -->
    <UCard>
      <template #header>
        <div class="flex items-center gap-2">
          <UIcon name="i-heroicons-chart-bar" class="w-6 h-6" />
          <h2 class="text-xl font-semibold">InBody Trends</h2>
        </div>
      </template>

      <div class="text-sm text-gray-600 dark:text-gray-300">
        InBody measurement trends and analytics will be displayed here
      </div>
    </UCard>
  </div>
</template>
