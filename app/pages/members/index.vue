<script setup lang="ts">
const { getMembers, syncClients } = useDatabase()
const toast = useToast()

const showAddModal = ref(false)
const isSyncing = ref(false)

// Search & Pagination
const searchQuery = ref('')
const displayCount = ref(10)
const loadMoreRef = ref<HTMLElement | null>(null)

// Reactive query - updates automatically when IndexedDB changes
const { members, loading } = getMembers()

// Filter by search, then paginate
const filteredMembers = computed(() => {
  let result = members.value
  if (searchQuery.value.trim()) {
    const query = searchQuery.value.toLowerCase()
    result = result.filter(m => m.name?.toLowerCase().includes(query))
  }
  return result.slice(0, displayCount.value)
})

// Check if there are more members to load
const totalMemberCount = computed(() => {
  if (searchQuery.value.trim()) {
    return members.value.filter(m => m.name?.toLowerCase().includes(searchQuery.value.toLowerCase())).length
  }
  return members.value.length
})

const hasMore = computed(() => displayCount.value < totalMemberCount.value)

function loadMore() {
  displayCount.value += 10
}

// Reset pagination when search changes
watch(searchQuery, () => {
  displayCount.value = 10
})

// Sync members from API - called only on explicit Refresh button click
async function refreshMembers() {
  isSyncing.value = true
  try {
    const result = await syncClients()
    if (result.error) {
      toast.add({
        title: 'Sync Warning',
        description: result.error,
        color: 'warning'
      })
    } else if (result.synced > 0) {
      console.log(`[Members] Synced ${result.synced} members from API`)
      toast.add({
        title: 'Synced',
        description: `${result.synced} members updated`,
        color: 'success'
      })
    }
  } catch (error: any) {
    toast.add({
      title: 'Failed to load members',
      description: error.message,
      color: 'error'
    })
  } finally {
    isSyncing.value = false
  }
}

// When a member is created via the modal, we need to refresh from API
async function handleMemberCreated() {
  await refreshMembers()
}

// Show cached data immediately - no API call on mount
// User can click Refresh to sync latest data from backend
onMounted(() => {
  // Infinite scroll observer
  const observer = new IntersectionObserver(
    (entries) => {
      if (entries[0]?.isIntersecting && hasMore.value && !loading.value) {
        loadMore()
      }
    },
    { threshold: 0.1 }
  )

  watchEffect(() => {
    if (loadMoreRef.value) {
      observer.observe(loadMoreRef.value)
    }
  })

  onUnmounted(() => observer.disconnect())
})
</script>

<template>
  <div class="space-y-6">
    <!-- Header Section -->
    <div class="flex items-center justify-between">
      <div class="flex items-center gap-3">
        <h1 class="text-3xl font-bold">Members</h1>
        <UButton
          v-if="isSyncing"
          size="xs"
          color="neutral"
          variant="ghost"
          icon="i-heroicons-arrow-path"
          class="animate-spin"
          disabled
        />
      </div>
      <div class="flex gap-2">
        <UButton
          label="Refresh"
          color="neutral"
          variant="ghost"
          icon="i-heroicons-arrow-path"
          :loading="isSyncing"
          @click="refreshMembers"
        />
        <UButton
          label="+ Add Member"
          color="primary"
          size="lg"
          icon="i-heroicons-plus"
          @click="showAddModal = true"
        />
      </div>
    </div>

    <!-- Search Input -->
    <div class="mb-2">
      <UInput
        v-model="searchQuery"
        placeholder="Search members by name..."
        icon="i-heroicons-magnifying-glass"
        size="lg"
        class="w-full"
      />
    </div>

    <!-- Loading State -->
    <div v-if="loading && members.length === 0" class="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      <UCard v-for="n in 3" :key="n" class="animate-pulse">
        <template #header>
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 bg-gray-200 dark:bg-gray-700 rounded-full" />
            <div class="space-y-2">
              <div class="w-24 h-4 bg-gray-200 dark:bg-gray-700 rounded" />
              <div class="w-16 h-3 bg-gray-200 dark:bg-gray-700 rounded" />
            </div>
          </div>
        </template>
      </UCard>
    </div>

    <!-- Empty State -->
    <div v-else-if="members.length === 0 && !loading" class="text-center py-12">
      <UIcon name="i-heroicons-users" class="w-16 h-16 mx-auto text-gray-300 mb-4" />
      <h3 class="text-lg font-medium text-gray-700 dark:text-gray-300 mb-2">No members yet</h3>
      <p class="text-gray-500 mb-4">Add your first member to get started</p>
      <UButton
        label="Add Member"
        color="primary"
        icon="i-heroicons-plus"
        @click="showAddModal = true"
      />
    </div>

    <!-- No Search Results -->
    <div v-else-if="searchQuery && filteredMembers.length === 0" class="text-center py-12">
      <UIcon name="i-heroicons-magnifying-glass" class="w-16 h-16 mx-auto text-gray-300 mb-4" />
      <h3 class="text-lg font-medium text-gray-700 dark:text-gray-300 mb-2">No members found</h3>
      <p class="text-gray-500">No members match "{{ searchQuery }}"</p>
    </div>

    <!-- Member Cards -->
    <div v-else class="space-y-4">
      <div class="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <UCard v-for="member in filteredMembers" :key="member.id">
        <template #header>
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-full bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center">
              <span class="text-white font-semibold">{{ member.name?.charAt(0)?.toUpperCase() || '?' }}</span>
            </div>
            <div>
              <h3 class="font-semibold text-lg">{{ member.name }}</h3>
              <p class="text-sm text-gray-500 dark:text-gray-400">
                {{ member.total_sessions || 0 }} sessions
              </p>
            </div>
          </div>
        </template>

        <div class="space-y-2 py-2">
          <!-- Remaining Sessions Badge -->
          <div class="flex items-center gap-2">
            <span 
              class="px-2 py-1 text-xs font-medium rounded-full"
              :class="member.remaining_sessions > 5 
                ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' 
                : member.remaining_sessions > 0 
                  ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400'
                  : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'"
            >
              {{ member.remaining_sessions || 0 }} sessions remaining
            </span>
          </div>
          
          <div v-if="member.last_session_date" class="flex items-center gap-2 text-sm">
            <UIcon name="i-heroicons-calendar" class="w-4 h-4 text-gray-400" />
            <span class="text-gray-600 dark:text-gray-300">
              Last: {{ new Date(member.last_session_date).toLocaleDateString() }}
            </span>
          </div>
          <div v-else class="text-sm text-gray-400 italic">
            No sessions yet
          </div>
        </div>

        <template #footer>
          <UButton
            :to="`/members/${member.id}`"
            label="View Profile"
            color="primary"
            variant="outline"
            block
            icon="i-heroicons-arrow-right"
          />
          </template>
        </UCard>
      </div>

      <!-- Infinite Scroll Sentinel -->
      <div
        v-if="hasMore"
        ref="loadMoreRef"
        class="flex justify-center py-8"
      >
        <UIcon name="i-heroicons-arrow-path" class="w-6 h-6 animate-spin text-gray-400" />
      </div>
    </div>

    <!-- Add Member Modal -->
    <MemberAddMemberModal
      :open="showAddModal"
      @close="showAddModal = false"
      @created="handleMemberCreated"
    />
  </div>
</template>
