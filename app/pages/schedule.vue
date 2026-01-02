<script setup lang="ts">
import { db, type Schedule } from '~/utils/db'

// All schedules from database
const schedules = ref<Schedule[]>([])
const isLoading = ref(true)

// Filters
const selectedDate = ref<Date | null>(null)
const selectedStatus = ref<string>('all')

const statusOptions = [
  { label: 'All Status', value: 'all' },
  { label: 'Scheduled', value: 'scheduled' },
  { label: 'In Progress', value: 'in-progress' },
  { label: 'Completed', value: 'completed' },
  { label: 'Cancelled', value: 'cancelled' },
  { label: 'No Show', value: 'no-show' }
]

// Load schedules from database
async function loadSchedules() {
  if (!import.meta.client) return
  
  try {
    isLoading.value = true
    schedules.value = await db.schedules.toArray()
    console.log(`[Schedule] Loaded ${schedules.value.length} schedules`)
  } catch (error) {
    console.error('[Schedule] Failed to load:', error)
  } finally {
    isLoading.value = false
  }
}

onMounted(loadSchedules)

// Filtered schedules
const filteredSchedules = computed(() => {
  let result = [...schedules.value]
  
  // Filter by date
  if (selectedDate.value) {
    const filterDate = new Date(selectedDate.value)
    const startOfDay = new Date(filterDate.getFullYear(), filterDate.getMonth(), filterDate.getDate())
    const endOfDay = new Date(filterDate.getFullYear(), filterDate.getMonth(), filterDate.getDate() + 1)
    
    result = result.filter(s => {
      const scheduleDate = new Date(s.start_time)
      return scheduleDate >= startOfDay && scheduleDate < endOfDay
    })
  }
  
  // Filter by status
  if (selectedStatus.value !== 'all') {
    result = result.filter(s => s.status === selectedStatus.value)
  }
  
  // Sort by start time
  result.sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime())
  
  return result
})

// Format date for display
function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric'
  })
}

function formatTime(dateStr: string) {
  return new Date(dateStr).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  })
}

// Status badge colors
function getStatusColor(status: string) {
  switch (status) {
    case 'completed': return 'success'
    case 'in-progress': return 'info'
    case 'scheduled': return 'primary'
    case 'cancelled': return 'error'
    case 'no-show': return 'warning'
    default: return 'neutral'
  }
}

// Clear filters
function clearFilters() {
  selectedDate.value = null
  selectedStatus.value = 'all'
}
</script>

<template>
  <div class="space-y-6">
    <!-- Header -->
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div>
        <h1 class="text-3xl font-bold text-gray-900 dark:text-white">Schedule</h1>
        <p class="text-gray-500 dark:text-gray-400 mt-1">Manage all your training sessions</p>
      </div>
      <UButton
        label="+ New Session"
        color="primary"
        size="lg"
        icon="i-heroicons-plus"
      />
    </div>

    <!-- Filters -->
    <UCard>
      <div class="flex flex-col sm:flex-row gap-4">
        <!-- Date Filter -->
        <div class="flex-1">
          <label class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block">Filter by Date</label>
          <UInput
            v-model="selectedDate"
            type="date"
            placeholder="Select date..."
            size="lg"
          />
        </div>
        
        <!-- Status Filter -->
        <div class="flex-1">
          <label class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block">Filter by Status</label>
          <USelectMenu
            v-model="selectedStatus"
            :items="statusOptions"
            value-key="value"
            size="lg"
          />
        </div>
        
        <!-- Clear Filters -->
        <div class="flex items-end">
          <UButton
            v-if="selectedDate || selectedStatus !== 'all'"
            label="Clear Filters"
            color="neutral"
            variant="ghost"
            icon="i-heroicons-x-mark"
            @click="clearFilters"
          />
        </div>
      </div>
    </UCard>

    <!-- Results Count -->
    <div class="flex items-center justify-between">
      <p class="text-sm text-gray-500">
        Showing {{ filteredSchedules.length }} of {{ schedules.length }} sessions
      </p>
    </div>

    <!-- Loading State -->
    <div v-if="isLoading" class="space-y-4">
      <UCard v-for="i in 3" :key="i" class="animate-pulse">
        <div class="flex items-center gap-4">
          <div class="h-12 w-12 bg-gray-200 dark:bg-gray-700 rounded-full"></div>
          <div class="flex-1 space-y-2">
            <div class="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/3"></div>
            <div class="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/2"></div>
          </div>
        </div>
      </UCard>
    </div>

    <!-- Empty State -->
    <div v-else-if="filteredSchedules.length === 0" class="text-center py-16 bg-gray-50 dark:bg-gray-900/50 rounded-xl border-2 border-dashed border-gray-200 dark:border-gray-700">
      <UIcon name="i-heroicons-calendar-days" class="w-16 h-16 mx-auto text-gray-300 dark:text-gray-600 mb-4" />
      <h3 class="text-lg font-semibold text-gray-600 dark:text-gray-400 mb-2">No Sessions Found</h3>
      <p class="text-sm text-gray-500 dark:text-gray-500 mb-4">
        {{ selectedDate || selectedStatus !== 'all' ? 'Try adjusting your filters.' : 'No sessions scheduled yet.' }}
      </p>
      <UButton
        v-if="selectedDate || selectedStatus !== 'all'"
        label="Clear Filters"
        color="primary"
        variant="soft"
        @click="clearFilters"
      />
    </div>

    <!-- Schedule List -->
    <div v-else class="space-y-3">
      <NuxtLink 
        v-for="schedule in filteredSchedules" 
        :key="schedule.id"
        :to="`/sessions/${schedule.id}`"
        class="block"
      >
        <UCard 
          :class="[
            'border-l-4 hover:shadow-md transition-all cursor-pointer hover:scale-[1.01]',
            schedule.status === 'completed' ? 'border-l-green-500' : 
            schedule.status === 'in-progress' ? 'border-l-blue-500' :
            schedule.status === 'cancelled' ? 'border-l-red-500' :
            schedule.status === 'no-show' ? 'border-l-yellow-500' :
            'border-l-primary-500'
          ]"
        >
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-4">
              <!-- Avatar -->
              <UAvatar :alt="schedule.member_name" size="lg" />
              
              <!-- Details -->
              <div>
                <div class="flex items-center gap-2">
                  <h3 class="font-semibold text-gray-900 dark:text-white">{{ schedule.member_name }}</h3>
                  <UBadge 
                    :color="getStatusColor(schedule.status)" 
                    variant="subtle" 
                    size="xs"
                    :label="schedule.status.charAt(0).toUpperCase() + schedule.status.slice(1).replace('-', ' ')"
                  />
                </div>
                <p class="text-sm text-gray-500 dark:text-gray-400">
                  {{ schedule.session_goal || 'Training Session' }}
                </p>
                <div class="flex items-center gap-3 mt-1 text-xs text-gray-400">
                  <span class="flex items-center gap-1">
                    <UIcon name="i-heroicons-calendar" class="w-3 h-3" />
                    {{ formatDate(schedule.start_time) }}
                  </span>
                  <span class="flex items-center gap-1">
                    <UIcon name="i-heroicons-clock" class="w-3 h-3" />
                    {{ formatTime(schedule.start_time) }}
                  </span>
                </div>
              </div>
            </div>
            
            <!-- Status Icon -->
            <div class="flex items-center">
              <UIcon 
                :name="schedule.status === 'completed' ? 'i-heroicons-check-circle-solid' : 
                       schedule.status === 'in-progress' ? 'i-heroicons-play-circle-solid' :
                       'i-heroicons-chevron-right'"
                :class="[
                  'w-6 h-6',
                  schedule.status === 'completed' ? 'text-green-500' :
                  schedule.status === 'in-progress' ? 'text-blue-500' :
                  'text-gray-400'
                ]"
              />
            </div>
          </div>
        </UCard>
      </NuxtLink>
    </div>
  </div>
</template>
