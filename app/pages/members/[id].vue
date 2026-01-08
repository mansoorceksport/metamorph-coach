<script setup lang="ts">
const route = useRoute()
const memberId = computed(() => route.params.id as string)
const toast = useToast()

interface MemberDetails {
  id: string
  name: string
  email: string
  remaining_sessions: number
  contracts: any[]
}

// Member data
const member = ref<MemberDetails | null>(null)
const isLoading = ref(true)
const loadError = ref<string | null>(null)

// Scans
const scans = ref<any[]>([])
const showDigitizer = ref(false)
const showAddContract = ref(false)
const selectedScan = ref<any>(null)
const showScanDetail = ref(false)
const router = useRouter()

function openScanDetail(scan: any) {
  // Navigate to scan detail page
  router.push(`/members/${memberId.value}/scans/${scan.id || scan._id}`)
}

// Load member data from API
async function loadMember() {
  isLoading.value = true
  loadError.value = null
  
  const token = useCookie('metamorph-token')
  try {
    const data = await $fetch<MemberDetails>(`/api/v1/pro/members/${memberId.value}`, {
      headers: {
        Authorization: `Bearer ${token.value}`
      }
    })
    member.value = data
  } catch (error: any) {
    loadError.value = error.data?.error || error.message
    toast.add({
      title: 'Failed to load member',
      description: loadError.value || undefined,
      color: 'error'
    })
  } finally {
    isLoading.value = false
  }
}

// Load member's scans
async function loadScans() {
  const token = useCookie('metamorph-token')
  try {
    const data = await $fetch<any[]>(`/api/v1/pro/members/${memberId.value}/scans`, {
      headers: {
        Authorization: `Bearer ${token.value}`
      }
    })
    scans.value = data || []
  } catch (error: any) {
    // Silently fail for scans - not critical
    console.warn('Failed to load scans:', error)
    scans.value = []
  }
}

function handleScanSuccess(record: any) {
  scans.value.unshift(record)
}

function handleContractCreated() {
  // Reload member to get updated contract info
  loadMember()
}

onMounted(() => {
  loadMember()
  loadScans()
})
</script>

<template>
  <div class="space-y-6">
    <!-- Header Section -->
    <div class="flex items-center justify-between">
      <div class="flex items-center gap-3">
        <UButton
          to="/members"
          icon="i-heroicons-arrow-left"
          color="neutral"
          variant="ghost"
          aria-label="Back to members"
        />
        <h1 class="text-3xl font-bold">Member Profile</h1>
      </div>
      <div class="flex gap-2">
        <UButton
          label="Add Package"
          color="success"
          icon="i-heroicons-plus-circle"
          @click="showAddContract = true"
        />
        <UButton
          label="Upload Scan"
          color="success"
          icon="i-heroicons-document-chart-bar"
          @click="showDigitizer = true"
        />
        <UButton
          label="Schedule Session"
          color="primary"
          icon="i-heroicons-calendar-plus"
          @click="router.push({ path: '/schedule', query: { member: memberId, new: 'true' } })"
        />
      </div>
    </div>

    <!-- Loading State -->
    <div v-if="isLoading" class="animate-pulse">
      <UCard>
        <template #header>
          <div class="flex items-center gap-4">
            <div class="w-16 h-16 rounded-full bg-gray-200 dark:bg-gray-700" />
            <div class="space-y-2">
              <div class="w-40 h-6 bg-gray-200 dark:bg-gray-700 rounded" />
              <div class="w-32 h-4 bg-gray-200 dark:bg-gray-700 rounded" />
            </div>
          </div>
        </template>
      </UCard>
    </div>

    <!-- Error State -->
    <div v-else-if="loadError" class="text-center py-12">
      <UIcon name="i-heroicons-exclamation-triangle" class="w-16 h-16 mx-auto text-red-400 mb-4" />
      <h3 class="text-lg font-medium text-gray-700 dark:text-gray-300 mb-2">Failed to load member</h3>
      <p class="text-gray-500 mb-4">{{ loadError }}</p>
      <UButton label="Try Again" color="primary" @click="loadMember" />
    </div>

    <!-- Member Content -->
    <template v-else>
      <!-- Member Info Card -->
      <UCard>
        <template #header>
          <div class="flex items-center gap-4">
            <div class="w-16 h-16 rounded-full bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center">
              <span class="text-2xl font-bold text-white">{{ member?.name?.charAt(0)?.toUpperCase() || '?' }}</span>
            </div>
            <div>
              <h2 class="text-2xl font-semibold">{{ member?.name }}</h2>
              <p class="text-gray-500 dark:text-gray-400">{{ member?.email }}</p>
            </div>
          </div>
        </template>

        <div class="grid grid-cols-3 gap-4">
          <div class="text-center p-4 bg-gray-50 dark:bg-slate-800 rounded-lg">
            <p class="text-2xl font-bold text-primary-600">{{ scans.length }}</p>
            <p class="text-sm text-gray-500">Scans</p>
          </div>
          <div class="text-center p-4 bg-gray-50 dark:bg-slate-800 rounded-lg">
            <p 
              class="text-2xl font-bold"
              :class="(member?.remaining_sessions || 0) > 5 
                ? 'text-emerald-600' 
                : (member?.remaining_sessions || 0) > 0 
                  ? 'text-orange-600' 
                  : 'text-red-600'"
            >
              {{ member?.remaining_sessions || 0 }}
            </p>
            <p class="text-sm text-gray-500">Sessions Remaining</p>
          </div>
          <div class="text-center p-4 bg-gray-50 dark:bg-slate-800 rounded-lg">
            <p class="text-2xl font-bold text-blue-600">{{ member?.contracts?.length || 0 }}</p>
            <p class="text-sm text-gray-500">Packages</p>
          </div>
        </div>
      </UCard>

      <!-- No Package Warning -->
      <div v-if="member && (!member.contracts || member.contracts.length === 0)" 
           class="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4 flex items-center gap-4"
      >
        <div class="flex-shrink-0">
          <UIcon name="i-heroicons-exclamation-triangle" class="w-8 h-8 text-amber-500" />
        </div>
        <div class="flex-1">
          <h4 class="font-semibold text-amber-800 dark:text-amber-200">No Active Package</h4>
          <p class="text-sm text-amber-700 dark:text-amber-300">Add a package to start scheduling sessions with this member.</p>
        </div>
        <UButton
          label="Add Package"
          color="warning"
          icon="i-heroicons-plus"
          @click="showAddContract = true"
        />
      </div>

      <!-- XP Mountain (Strength Volume) -->
      <MemberVolumeMountain :member-id="memberId" />

      <!-- Recomposition Cross Chart (The Win) -->
      <MemberRecompositionCross v-if="scans.length > 1" :scans="scans" />

      <!-- Trend Charts -->
      <MemberTrendCharts v-if="scans.length > 0" :scans="scans" />

      <!-- Segmental Sparkline Grids -->
      <div v-if="scans.length > 1" class="grid grid-cols-1 gap-4">
        <MemberSegmentalGrid :scans="scans" type="lean" />
        <MemberSegmentalGrid :scans="scans" type="fat" />
      </div>

      <!-- InBody Scans -->
      <UCard>
        <template #header>
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2">
              <UIcon name="i-heroicons-chart-bar" class="w-6 h-6 text-emerald-500" />
              <h2 class="text-xl font-semibold">InBody Scans</h2>
            </div>
            <UButton
              label="+ New Scan"
              size="sm"
              color="success"
              variant="soft"
              icon="i-heroicons-plus"
              @click="showDigitizer = true"
            />
          </div>
        </template>

        <div v-if="scans.length === 0" class="text-center py-8">
          <UIcon name="i-heroicons-document-chart-bar" class="w-12 h-12 mx-auto text-gray-300 mb-3" />
          <p class="text-gray-500 mb-4">No scans uploaded yet</p>
          <UButton
            label="Upload First Scan"
            color="primary"
            icon="i-heroicons-cloud-arrow-up"
            @click="showDigitizer = true"
          />
        </div>

        <div v-else class="space-y-3">
          <div
            v-for="scan in scans"
            :key="scan.id"
            class="p-4 bg-gray-50 dark:bg-slate-800 rounded-lg flex items-center justify-between cursor-pointer hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors"
            @click="openScanDetail(scan)"
          >
            <div class="flex items-center gap-4">
              <div class="w-10 h-10 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                <UIcon name="i-heroicons-document-text" class="w-5 h-5 text-emerald-600" />
              </div>
              <div>
                <p class="font-medium">{{ new Date(scan.test_date_time || scan.metadata?.processed_at).toLocaleDateString() }}</p>
                <p class="text-sm text-gray-500">Weight: {{ scan.weight?.toFixed(1) }}kg • PBF: {{ scan.pbf?.toFixed(1) }}%</p>
              </div>
            </div>
            <div class="flex items-center gap-3">
              <span class="text-sm font-medium text-emerald-600">SMM {{ scan.smm?.toFixed(1) }}kg</span>
              <UIcon name="i-heroicons-chevron-right" class="w-5 h-5 text-gray-400" />
            </div>
          </div>
        </div>
      </UCard>
    </template>

    <!-- Digitizer Modal -->
    <ScanDigitizerModal
      :open="showDigitizer"
      :member-id="memberId"
      :member-name="member?.name"
      @close="showDigitizer = false"
      @success="handleScanSuccess"
    />

    <!-- Add Contract Modal -->
    <MemberAddContractModal
      v-if="member"
      :open="showAddContract"
      :member-id="memberId"
      :member-name="member?.name"
      @close="showAddContract = false"
      @created="handleContractCreated"
    />

    <!-- Scan Detail Modal -->
    <ScanDetailModal
      :open="showScanDetail"
      :scan="selectedScan"
      :member-name="member?.name"
      @close="showScanDetail = false"
    />
  </div>
</template>
