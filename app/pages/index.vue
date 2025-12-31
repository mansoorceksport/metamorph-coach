<script setup lang="ts">
const mockSessions = [
  {
    id: 'mock-id-1',
    memberName: 'John Smith',
    time: '3:00 PM'
  },
  {
    id: 'mock-id-2',
    memberName: 'Sarah Johnson',
    time: '4:30 PM'
  },
  {
    id: 'mock-id-3',
    memberName: 'Mike Chen',
    time: '6:00 PM'
  }
]
</script>

<template>
  <div class="space-y-6">
    <!-- Header Section -->
    <div class="flex items-center justify-between">
      <h1 class="text-3xl font-bold">Agenda</h1>
      <UButton
        label="+ New Session"
        color="primary"
        size="lg"
        icon="i-heroicons-plus"
      />
    </div>

    <!-- Session Cards -->
    <div class="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      <UCard v-for="session in mockSessions" :key="session.id">
        <template #header>
          <div class="flex items-center gap-3">
            <UIcon name="i-heroicons-user-circle" class="w-8 h-8 text-gray-400" />
            <div>
              <h3 class="font-semibold">{{ session.memberName }}</h3>
              <p class="text-sm text-gray-500 dark:text-gray-400">{{ session.time }}</p>
            </div>
          </div>
        </template>

        <template #footer>
          <UButton
            :to="`/sessions/${session.id}`"
            label="Start Session"
            color="primary"
            block
            icon="i-heroicons-play"
          />
        </template>
      </UCard>
    </div>
  </div>
</template>
