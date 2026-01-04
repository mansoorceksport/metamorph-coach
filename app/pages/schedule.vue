<script setup lang="ts">
import { db, type Schedule, type CachedMember } from '~/utils/db'

const { createSchedule, getCachedMembers } = useDatabase()
const router = useRouter()

// All schedules from database
const schedules = ref<Schedule[]>([])
const isLoading = ref(true)

// Filters
const selectedDate = ref<string | null>(null)
const selectedStatus = ref<string>('all')

const statusOptions = [
  { label: 'All Status', value: 'all' },
  { label: 'Scheduled', value: 'scheduled' },
  { label: 'In Progress', value: 'in-progress' },
  { label: 'Completed', value: 'completed' },
  { label: 'Cancelled', value: 'cancelled' },
  { label: 'No Show', value: 'no-show' }
]

// New Schedule Modal
const showNewScheduleModal = ref(false)
const members = ref<CachedMember[]>([])
const isCreating = ref(false)

// Form state
const newSchedule = ref({
  member: undefined as CachedMember | undefined,
  date: new Date().toISOString().split('T')[0],
  time: '09:00',
  sessionGoal: ''
})

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

// Load members for dropdown
async function loadMembers() {
  if (!import.meta.client) return
  members.value = await getCachedMembers()
}

// Check for ?new=1 query param to auto-open modal
const route = useRoute()

onMounted(() => {
  loadSchedules()
  loadMembers()
  
  // Auto-open modal if navigated with ?new=1
  if (route.query.new === '1') {
    showNewScheduleModal.value = true
  }
})

// Member options for dropdown
const memberOptions = computed(() => 
  members.value.map(m => ({
    label: m.name,
    value: m,
    avatar: m.avatar ? { src: m.avatar, alt: m.name } : undefined
  }))
)

// Create new schedule
async function handleCreateSchedule() {
  if (!newSchedule.value.member) return
  
  isCreating.value = true
  try {
    const startTime = new Date(`${newSchedule.value.date}T${newSchedule.value.time}:00`)
    
    const scheduleId = await createSchedule({
      member_id: newSchedule.value.member.id,
      member_name: newSchedule.value.member.name,
      member_avatar: newSchedule.value.member.avatar,
      start_time: startTime.toISOString(),
      session_goal: newSchedule.value.sessionGoal || undefined
    })
    
    // Reset form
    newSchedule.value = {
      member: undefined,
      date: new Date().toISOString().split('T')[0],
      time: '09:00',
      sessionGoal: ''
    }
    showNewScheduleModal.value = false
    
    // Navigate to new session
    router.push(`/sessions/${scheduleId}`)
  } catch (error) {
    console.error('[Schedule] Failed to create:', error)
  } finally {
    isCreating.value = false
  }
}

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
        @click="showNewScheduleModal = true"
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

    <!-- New Schedule Modal -->
    <UModal v-model:open="showNewScheduleModal">
      <template #header>
        <div class="flex items-center gap-3">
          <div class="p-2 bg-primary-100 dark:bg-primary-900/30 rounded-lg">
            <UIcon name="i-heroicons-calendar-plus" class="w-6 h-6 text-primary-600 dark:text-primary-400" />
          </div>
          <div>
            <h3 class="text-lg font-semibold text-gray-900 dark:text-white">New Training Session</h3>
            <p class="text-sm text-gray-500">Schedule a session with a member</p>
          </div>
        </div>
      </template>

      <template #body>
        <div class="space-y-5 p-4">
          <!-- Member Selection -->
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Select Member <span class="text-red-500">*</span>
            </label>
            <USelectMenu
              v-model="newSchedule.member"
              :items="memberOptions"
              value-key="value"
              placeholder="Choose a member..."
              size="lg"
              class="w-full"
            >
              <template #item="{ item }">
                <div v-if="item && typeof item === 'object' && 'label' in item" class="flex items-center gap-3">
                  <UAvatar :alt="String(item.label)" size="sm" />
                  <span>{{ item.label }}</span>
                </div>
              </template>
            </USelectMenu>
          </div>

          <!-- Date & Time -->
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Date <span class="text-red-500">*</span>
              </label>
              <UInput
                v-model="newSchedule.date"
                type="date"
                size="lg"
                class="w-full"
              />
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Time <span class="text-red-500">*</span>
              </label>
              <UInput
                v-model="newSchedule.time"
                type="time"
                size="lg"
                class="w-full"
              />
            </div>
          </div>

          <!-- Session Goal -->
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Session Goal (optional)
            </label>
            <UInput
              v-model="newSchedule.sessionGoal"
              placeholder="e.g., Leg Day - Hypertrophy Focus"
              size="lg"
              class="w-full"
            />
          </div>
        </div>
      </template>

      <template #footer>
        <div class="flex justify-end gap-3">
          <UButton
            label="Cancel"
            color="neutral"
            variant="ghost"
            @click="showNewScheduleModal = false"
          />
          <UButton
            label="Create Session"
            color="primary"
            icon="i-heroicons-plus"
            :loading="isCreating"
            :disabled="!newSchedule.member"
            @click="handleCreateSchedule"
          />
        </div>
      </template>
    </UModal>
  </div>
</template>
