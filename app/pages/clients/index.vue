<script setup lang="ts">
const mockClients = [
  {
    id: '1',
    name: 'John Smith',
    lastSession: '2025-12-30',
    sessions: 24
  },
  {
    id: '2',
    name: 'Sarah Johnson',
    lastSession: '2025-12-29',
    sessions: 18
  },
  {
    id: '3',
    name: 'Mike Chen',
    lastSession: '2025-12-28',
    sessions: 31
  }
]
</script>

<template>
  <div class="space-y-6">
    <!-- Header Section -->
    <div class="flex items-center justify-between">
      <h1 class="text-3xl font-bold">Clients</h1>
      <UButton
        label="+ Add Client"
        color="primary"
        size="lg"
        icon="i-heroicons-plus"
      />
    </div>

    <!-- Client Cards -->
    <div class="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      <UCard v-for="client in mockClients" :key="client.id">
        <template #header>
          <div class="flex items-center gap-3">
            <UIcon name="i-heroicons-user-circle" class="w-10 h-10 text-primary" />
            <div>
              <h3 class="font-semibold text-lg">{{ client.name }}</h3>
              <p class="text-sm text-gray-500 dark:text-gray-400">
                {{ client.sessions }} sessions
              </p>
            </div>
          </div>
        </template>

        <div class="space-y-2 py-2">
          <div class="flex items-center gap-2 text-sm">
            <UIcon name="i-heroicons-calendar" class="w-4 h-4 text-gray-400" />
            <span class="text-gray-600 dark:text-gray-300">
              Last: {{ client.lastSession }}
            </span>
          </div>
        </div>

        <template #footer>
          <UButton
            :to="`/clients/${client.id}`"
            label="View Profile"
            color="primary"
            variant="outline"
            block
            icon="i-heroicons-arrow-right"
          />
        </template>
      </UCard>
    </div>
  </div>
</template>
