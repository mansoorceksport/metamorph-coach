<script setup lang="ts">
const route = useRoute()
const router = useRouter()
const toast = useToast()

const memberId = computed(() => route.params.memberId as string)
const scanId = computed(() => route.params.scanId as string)

// Scan data
const scan = ref<any>(null)
const member = ref<any>(null)
const isLoading = ref(true)
const isSaving = ref(false)
const isDeleting = ref(false)
const isEditing = ref(false)

// Editable form data - all fields except AI analysis
const editForm = ref({
  // Core Metrics
  weight: 0,
  smm: 0,
  pbf: 0,
  bmi: 0,
  body_fat_mass: 0,
  // Health Indicators
  visceral_fat: 0,
  bmr: 0,
  fat_free_mass: 0,
  inbody_score: 0,
  whr: 0,
  obesity_degree: 0,
  // Control Guide
  target_weight: 0,
  weight_control: 0,
  fat_control: 0,
  muscle_control: 0,
  recommended_calorie_intake: 0,
  // Segmental Lean
  segmental_lean: {
    left_arm: { mass: 0, percentage: 0 },
    right_arm: { mass: 0, percentage: 0 },
    trunk: { mass: 0, percentage: 0 },
    left_leg: { mass: 0, percentage: 0 },
    right_leg: { mass: 0, percentage: 0 }
  },
  // Segmental Fat
  segmental_fat: {
    left_arm: { mass: 0, percentage: 0 },
    right_arm: { mass: 0, percentage: 0 },
    trunk: { mass: 0, percentage: 0 },
    left_leg: { mass: 0, percentage: 0 },
    right_leg: { mass: 0, percentage: 0 }
  }
})

// Helper to safely get a numeric value
function safeNumber(val: any): number {
  if (typeof val === 'number') return val
  if (typeof val === 'string') {
    const parsed = parseFloat(val)
    return isNaN(parsed) ? 0 : parsed
  }
  if (val && typeof val === 'object') {
    if ('mass' in val) return safeNumber(val.mass)
    if ('value' in val) return safeNumber(val.value)
  }
  return 0
}

function safePercentage(val: any): number {
  if (typeof val === 'number') return 100
  if (val && typeof val === 'object' && 'percentage' in val) {
    return safeNumber(val.percentage)
  }
  return 0
}

// Load scan data
async function loadScan() {
  isLoading.value = true
  const token = useCookie('metamorph-token')
  try {
    const data = await $fetch<any>(`/api/v1/pro/scans/${scanId.value}`, {
      headers: { Authorization: `Bearer ${token.value}` }
    })
    scan.value = data
    
    // Populate edit form with all data
    editForm.value = {
      // Core Metrics
      weight: data.weight || 0,
      smm: data.smm || 0,
      pbf: data.pbf || 0,
      bmi: data.bmi || 0,
      body_fat_mass: data.body_fat_mass || 0,
      // Health Indicators
      visceral_fat: data.visceral_fat || 0,
      bmr: data.bmr || 0,
      fat_free_mass: data.fat_free_mass || 0,
      inbody_score: data.inbody_score || 0,
      whr: data.whr || 0,
      obesity_degree: data.obesity_degree || 0,
      // Control Guide
      target_weight: data.target_weight || 0,
      weight_control: data.weight_control || 0,
      fat_control: data.fat_control || 0,
      muscle_control: data.muscle_control || 0,
      recommended_calorie_intake: data.recommended_calorie_intake || 0,
      // Segmental Lean
      segmental_lean: {
        left_arm: { mass: safeNumber(data.segmental_lean?.left_arm), percentage: safePercentage(data.segmental_lean?.left_arm) },
        right_arm: { mass: safeNumber(data.segmental_lean?.right_arm), percentage: safePercentage(data.segmental_lean?.right_arm) },
        trunk: { mass: safeNumber(data.segmental_lean?.trunk), percentage: safePercentage(data.segmental_lean?.trunk) },
        left_leg: { mass: safeNumber(data.segmental_lean?.left_leg), percentage: safePercentage(data.segmental_lean?.left_leg) },
        right_leg: { mass: safeNumber(data.segmental_lean?.right_leg), percentage: safePercentage(data.segmental_lean?.right_leg) }
      },
      // Segmental Fat
      segmental_fat: {
        left_arm: { mass: safeNumber(data.segmental_fat?.left_arm), percentage: safePercentage(data.segmental_fat?.left_arm) },
        right_arm: { mass: safeNumber(data.segmental_fat?.right_arm), percentage: safePercentage(data.segmental_fat?.right_arm) },
        trunk: { mass: safeNumber(data.segmental_fat?.trunk), percentage: safePercentage(data.segmental_fat?.trunk) },
        left_leg: { mass: safeNumber(data.segmental_fat?.left_leg), percentage: safePercentage(data.segmental_fat?.left_leg) },
        right_leg: { mass: safeNumber(data.segmental_fat?.right_leg), percentage: safePercentage(data.segmental_fat?.right_leg) }
      }
    }
  } catch (error: any) {
    toast.add({
      title: 'Failed to load scan',
      description: error.data?.error || error.message,
      color: 'error'
    })
  } finally {
    isLoading.value = false
  }
}

// Load member info
async function loadMember() {
  const token = useCookie('metamorph-token')
  try {
    const data = await $fetch<any>(`/api/v1/pro/members/${memberId.value}`, {
      headers: { Authorization: `Bearer ${token.value}` }
    })
    member.value = data
  } catch (error) {
    // Silently fail
  }
}

// Save changes
async function saveScan() {
  isSaving.value = true
  const token = useCookie('metamorph-token')
  try {
    await $fetch(`/api/v1/pro/scans/${scanId.value}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token.value}` },
      body: editForm.value
    })
    toast.add({
      title: 'Scan Updated',
      description: 'Changes saved successfully',
      color: 'success',
      icon: 'i-heroicons-check-circle'
    })
    isEditing.value = false
    loadScan() // Reload to get updated data
  } catch (error: any) {
    toast.add({
      title: 'Failed to save',
      description: error.data?.error || error.message,
      color: 'error'
    })
  } finally {
    isSaving.value = false
  }
}

// Delete scan
async function deleteScan() {
  if (!confirm('Are you sure you want to delete this scan? This action cannot be undone.')) {
    return
  }
  
  isDeleting.value = true
  const token = useCookie('metamorph-token')
  try {
    await $fetch(`/api/v1/pro/scans/${scanId.value}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token.value}` }
    })
    toast.add({
      title: 'Scan Deleted',
      color: 'success'
    })
    router.push(`/members/${memberId.value}`)
  } catch (error: any) {
    toast.add({
      title: 'Failed to delete',
      description: error.data?.error || error.message,
      color: 'error'
    })
  } finally {
    isDeleting.value = false
  }
}

// Format date
const scanDate = computed(() => {
  if (!scan.value) return ''
  const date = new Date(scan.value.test_date_time || scan.value.metadata?.processed_at)
  return date.toLocaleDateString('en-US', { 
    weekday: 'long',
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  })
})

// Segmental lean data
const segmentalLean = computed(() => {
  if (!scan.value?.segmental_lean) return null
  const sl = scan.value.segmental_lean
  return {
    leftArm: { mass: safeNumber(sl.left_arm), pct: safePercentage(sl.left_arm) },
    rightArm: { mass: safeNumber(sl.right_arm), pct: safePercentage(sl.right_arm) },
    trunk: { mass: safeNumber(sl.trunk), pct: safePercentage(sl.trunk) },
    leftLeg: { mass: safeNumber(sl.left_leg), pct: safePercentage(sl.left_leg) },
    rightLeg: { mass: safeNumber(sl.right_leg), pct: safePercentage(sl.right_leg) }
  }
})

// Segmental fat data
const segmentalFat = computed(() => {
  if (!scan.value?.segmental_fat) return null
  const sf = scan.value.segmental_fat
  return {
    leftArm: { mass: safeNumber(sf.left_arm), pct: safePercentage(sf.left_arm) },
    rightArm: { mass: safeNumber(sf.right_arm), pct: safePercentage(sf.right_arm) },
    trunk: { mass: safeNumber(sf.trunk), pct: safePercentage(sf.trunk) },
    leftLeg: { mass: safeNumber(sf.left_leg), pct: safePercentage(sf.left_leg) },
    rightLeg: { mass: safeNumber(sf.right_leg), pct: safePercentage(sf.right_leg) }
  }
})

onMounted(() => {
  loadScan()
  loadMember()
})
</script>

<template>
  <div class="min-h-screen pb-8">
    <!-- Header -->
    <div class="flex items-center justify-between mb-6">
      <div class="flex items-center gap-3">
        <UButton
          icon="i-heroicons-arrow-left"
          color="neutral"
          variant="ghost"
          @click="router.push(`/members/${memberId}`)"
        />
        <div>
          <h1 class="text-2xl font-bold">Scan Details</h1>
          <p class="text-sm text-gray-500">{{ member?.name || 'Member' }} • {{ scanDate }}</p>
        </div>
      </div>
      <div class="flex items-center gap-2">
        <UButton
          v-if="!isEditing"
          label="Edit"
          color="primary"
          variant="soft"
          icon="i-heroicons-pencil"
          @click="isEditing = true"
        />
        <UButton
          v-if="isEditing"
          label="Cancel"
          color="neutral"
          variant="ghost"
          @click="isEditing = false"
        />
        <UButton
          v-if="isEditing"
          label="Save"
          color="success"
          :loading="isSaving"
          icon="i-heroicons-check"
          @click="saveScan"
        />
        <UButton
          label="Delete"
          color="error"
          variant="soft"
          icon="i-heroicons-trash"
          :loading="isDeleting"
          @click="deleteScan"
        />
      </div>
    </div>

    <!-- Loading State -->
    <div v-if="isLoading" class="text-center py-12">
      <div class="w-8 h-8 mx-auto border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
      <p class="text-gray-500 mt-3">Loading scan...</p>
    </div>

    <!-- Content -->
    <div v-else-if="scan" class="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <!-- Left Column: Scan Image -->
      <div class="space-y-4">
        <UCard>
          <template #header>
            <div class="flex items-center gap-2">
              <UIcon name="i-heroicons-document" class="w-5 h-5 text-primary-500" />
              <h2 class="font-semibold">Scan Document</h2>
            </div>
          </template>
          
          <div v-if="scan.metadata?.image_url" class="bg-gray-100 dark:bg-slate-800 rounded-lg overflow-hidden">
            <img 
              :src="scan.metadata.image_url" 
              alt="InBody Scan"
              class="w-full h-auto"
            />
          </div>
          <div v-else class="py-12 text-center text-gray-500">
            <UIcon name="i-heroicons-photo" class="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>No scan image available</p>
          </div>
        </UCard>

        <!-- AI Analysis -->
        <UCard v-if="scan.analysis">
          <template #header>
            <div class="flex items-center gap-2">
              <UIcon name="i-heroicons-sparkles" class="w-5 h-5 text-blue-500" />
              <h2 class="font-semibold text-blue-700 dark:text-blue-300">AI Analysis</h2>
            </div>
          </template>
          
          <p v-if="scan.analysis.summary" class="text-sm text-gray-600 dark:text-gray-300 leading-relaxed mb-4">{{ scan.analysis.summary }}</p>
          
          <!-- Positive Feedback -->
          <div v-if="scan.analysis.positive_feedback?.length" class="mb-4">
            <p class="text-xs font-medium text-emerald-600 dark:text-emerald-400 uppercase mb-2 flex items-center gap-1">
              <UIcon name="i-heroicons-check-circle" class="w-4 h-4" />
              What's Going Well
            </p>
            <ul class="space-y-2">
              <li 
                v-for="(item, i) in scan.analysis.positive_feedback" 
                :key="'pos-'+i"
                class="flex items-start gap-2 text-sm text-gray-600 dark:text-gray-300 bg-emerald-50 dark:bg-emerald-900/20 p-2 rounded-lg"
              >
                <UIcon name="i-heroicons-star" class="w-4 h-4 mt-0.5 text-emerald-500 flex-shrink-0" />
                <span>{{ item }}</span>
              </li>
            </ul>
          </div>
          
          <!-- Improvements -->
          <div v-if="scan.analysis.improvements?.length" class="mb-4">
            <p class="text-xs font-medium text-amber-600 dark:text-amber-400 uppercase mb-2 flex items-center gap-1">
              <UIcon name="i-heroicons-arrow-trending-up" class="w-4 h-4" />
              Areas for Improvement
            </p>
            <ul class="space-y-2">
              <li 
                v-for="(item, i) in scan.analysis.improvements" 
                :key="'imp-'+i"
                class="flex items-start gap-2 text-sm text-gray-600 dark:text-gray-300 bg-amber-50 dark:bg-amber-900/20 p-2 rounded-lg"
              >
                <UIcon name="i-heroicons-exclamation-triangle" class="w-4 h-4 mt-0.5 text-amber-500 flex-shrink-0" />
                <span>{{ item }}</span>
              </li>
            </ul>
          </div>
          
          <!-- Advice -->
          <div v-if="scan.analysis.advice?.length" class="space-y-2">
            <p class="text-xs font-medium text-blue-600 dark:text-blue-400 uppercase mb-2 flex items-center gap-1">
              <UIcon name="i-heroicons-light-bulb" class="w-4 h-4" />
              Recommendations
            </p>
            <ul class="space-y-2">
              <li 
                v-for="(advice, i) in scan.analysis.advice" 
                :key="i"
                class="flex items-start gap-2 text-sm text-gray-600 dark:text-gray-300 bg-blue-50 dark:bg-blue-900/20 p-2 rounded-lg"
              >
                <UIcon name="i-heroicons-light-bulb" class="w-4 h-4 mt-0.5 text-blue-500 flex-shrink-0" />
                <span>{{ advice }}</span>
              </li>
            </ul>
          </div>
        </UCard>
      </div>

      <!-- Right Column: Metrics -->
      <div class="space-y-4">
        <!-- Key Metrics -->
        <UCard>
          <template #header>
            <div class="flex items-center gap-2">
              <UIcon name="i-heroicons-chart-bar" class="w-5 h-5 text-emerald-500" />
              <h2 class="font-semibold">Key Metrics</h2>
            </div>
          </template>

          <div v-if="!isEditing" class="grid grid-cols-2 gap-4">
            <div class="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-4 text-white">
              <p class="text-xs opacity-80 uppercase">Weight</p>
              <p class="text-2xl font-bold">{{ scan.weight?.toFixed(1) || '--' }}</p>
              <p class="text-xs opacity-80">kg</p>
            </div>
            <div class="bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-xl p-4 text-white">
              <p class="text-xs opacity-80 uppercase">SMM</p>
              <p class="text-2xl font-bold">{{ scan.smm?.toFixed(1) || '--' }}</p>
              <p class="text-xs opacity-80">kg</p>
            </div>
            <div class="bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl p-4 text-white">
              <p class="text-xs opacity-80 uppercase">Body Fat</p>
              <p class="text-2xl font-bold">{{ scan.pbf?.toFixed(1) || '--' }}</p>
              <p class="text-xs opacity-80">%</p>
            </div>
            <div class="bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl p-4 text-white">
              <p class="text-xs opacity-80 uppercase">BMI</p>
              <p class="text-2xl font-bold">{{ scan.bmi?.toFixed(1) || '--' }}</p>
              <p class="text-xs opacity-80">kg/m²</p>
            </div>
          </div>

          <!-- Edit Form -->
          <div v-else class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-medium mb-1">Weight (kg)</label>
              <UInput v-model.number="editForm.weight" type="number" step="0.1" />
            </div>
            <div>
              <label class="block text-sm font-medium mb-1">SMM (kg)</label>
              <UInput v-model.number="editForm.smm" type="number" step="0.1" />
            </div>
            <div>
              <label class="block text-sm font-medium mb-1">Body Fat %</label>
              <UInput v-model.number="editForm.pbf" type="number" step="0.1" />
            </div>
            <div>
              <label class="block text-sm font-medium mb-1">BMI</label>
              <UInput v-model.number="editForm.bmi" type="number" step="0.1" />
            </div>
            <div>
              <label class="block text-sm font-medium mb-1">Body Fat Mass (kg)</label>
              <UInput v-model.number="editForm.body_fat_mass" type="number" step="0.1" />
            </div>
            <div>
              <label class="block text-sm font-medium mb-1">Visceral Fat Level</label>
              <UInput v-model.number="editForm.visceral_fat" type="number" />
            </div>
            <div>
              <label class="block text-sm font-medium mb-1">BMR</label>
              <UInput v-model.number="editForm.bmr" type="number" />
            </div>
            <div>
              <label class="block text-sm font-medium mb-1">Fat Free Mass (kg)</label>
              <UInput v-model.number="editForm.fat_free_mass" type="number" step="0.1" />
            </div>
          </div>
        </UCard>

        <!-- Health Indicators -->
        <UCard>
          <template #header>
            <div class="flex items-center gap-2">
              <UIcon name="i-heroicons-heart" class="w-5 h-5 text-red-500" />
              <h2 class="font-semibold">Health Indicators</h2>
            </div>
          </template>

          <!-- View Mode -->
          <div v-if="!isEditing" class="grid grid-cols-3 gap-3">
            <!-- InBody Score -->
            <div class="text-center p-3 bg-gradient-to-br from-indigo-50 to-violet-50 dark:from-indigo-900/30 dark:to-violet-900/30 rounded-xl">
              <p class="text-xs text-gray-500 mb-1">InBody Score</p>
              <p class="text-2xl font-bold text-indigo-600">{{ scan.inbody_score || '--' }}</p>
              <p class="text-xs text-gray-400">/ 100</p>
            </div>
            <!-- BMR -->
            <div class="text-center p-3 bg-gradient-to-br from-rose-50 to-pink-50 dark:from-rose-900/30 dark:to-pink-900/30 rounded-xl">
              <p class="text-xs text-gray-500 mb-1">BMR</p>
              <p class="text-2xl font-bold text-rose-600">{{ scan.bmr || '--' }}</p>
              <p class="text-xs text-gray-400">kcal</p>
            </div>
            <!-- Visceral Fat -->
            <div class="text-center p-3 rounded-xl" :class="scan.visceral_fat > 10 ? 'bg-red-50 dark:bg-red-900/30' : 'bg-emerald-50 dark:bg-emerald-900/30'">
              <p class="text-xs text-gray-500 mb-1">Visceral Fat</p>
              <p class="text-2xl font-bold" :class="scan.visceral_fat > 10 ? 'text-red-600' : 'text-emerald-600'">{{ scan.visceral_fat || '--' }}</p>
              <p class="text-xs text-gray-400">Level (1-20)</p>
            </div>
            <!-- Body Fat Mass -->
            <div class="text-center p-3 bg-orange-50 dark:bg-orange-900/30 rounded-xl">
              <p class="text-xs text-gray-500 mb-1">Body Fat Mass</p>
              <p class="text-2xl font-bold text-orange-600">{{ scan.body_fat_mass?.toFixed(1) || '--' }}</p>
              <p class="text-xs text-gray-400">kg</p>
            </div>
            <!-- Fat Free Mass -->
            <div class="text-center p-3 bg-teal-50 dark:bg-teal-900/30 rounded-xl">
              <p class="text-xs text-gray-500 mb-1">Fat Free Mass</p>
              <p class="text-2xl font-bold text-teal-600">{{ scan.fat_free_mass?.toFixed(1) || '--' }}</p>
              <p class="text-xs text-gray-400">kg</p>
            </div>
            <!-- WHR -->
            <div class="text-center p-3 rounded-xl" :class="scan.whr > 0.95 ? 'bg-amber-50 dark:bg-amber-900/30' : 'bg-green-50 dark:bg-green-900/30'">
              <p class="text-xs text-gray-500 mb-1">Waist-Hip Ratio</p>
              <p class="text-2xl font-bold" :class="scan.whr > 0.95 ? 'text-amber-600' : 'text-green-600'">{{ scan.whr?.toFixed(2) || '--' }}</p>
              <p class="text-xs text-gray-400">M: &lt;0.90, F: &lt;0.85</p>
            </div>
            <!-- Obesity Degree -->
            <div class="text-center p-3 bg-slate-100 dark:bg-slate-800 rounded-xl col-span-3">
              <p class="text-xs text-gray-500 mb-1">Obesity Degree</p>
              <div class="flex items-center justify-center gap-4">
                <p class="text-2xl font-bold" :class="scan.obesity_degree > 110 ? 'text-red-600' : scan.obesity_degree < 90 ? 'text-blue-600' : 'text-emerald-600'">{{ scan.obesity_degree?.toFixed(0) || '--' }}%</p>
                <span class="text-sm text-gray-500">(Normal: 90-110%)</span>
              </div>
            </div>
          </div>

          <!-- Edit Mode -->
          <div v-else class="grid grid-cols-3 gap-4">
            <div>
              <label class="block text-xs font-medium mb-1">InBody Score</label>
              <UInput v-model.number="editForm.inbody_score" type="number" step="1" />
            </div>
            <div>
              <label class="block text-xs font-medium mb-1">WHR</label>
              <UInput v-model.number="editForm.whr" type="number" step="0.01" />
            </div>
            <div>
              <label class="block text-xs font-medium mb-1">Obesity Degree %</label>
              <UInput v-model.number="editForm.obesity_degree" type="number" step="1" />
            </div>
          </div>
        </UCard>

        <!-- Control Guide -->
        <UCard>
          <template #header>
            <div class="flex items-center gap-2">
              <UIcon name="i-heroicons-adjustments-horizontal" class="w-5 h-5 text-cyan-500" />
              <h2 class="font-semibold">Control Guide</h2>
            </div>
          </template>

          <!-- View Mode -->
          <div v-if="!isEditing" class="space-y-4">
            <!-- Target Weight -->
            <div class="flex items-center justify-between p-3 bg-gray-50 dark:bg-slate-800 rounded-lg">
              <span class="text-sm text-gray-600 dark:text-gray-300">Target Weight</span>
              <span class="text-lg font-bold text-primary-600">{{ scan.target_weight?.toFixed(1) || '--' }} kg</span>
            </div>

            <!-- Weight Control -->
            <div class="flex items-center justify-between p-3 rounded-lg" :class="scan.weight_control < 0 ? 'bg-red-50 dark:bg-red-900/20' : 'bg-emerald-50 dark:bg-emerald-900/20'">
              <span class="text-sm text-gray-600 dark:text-gray-300">Weight Control</span>
              <span class="text-lg font-bold" :class="scan.weight_control < 0 ? 'text-red-600' : 'text-emerald-600'">
                {{ scan.weight_control > 0 ? '+' : '' }}{{ scan.weight_control?.toFixed(1) || '--' }} kg
              </span>
            </div>

            <!-- Fat Control -->
            <div class="flex items-center justify-between p-3 rounded-lg" :class="scan.fat_control < 0 ? 'bg-emerald-50 dark:bg-emerald-900/20' : 'bg-red-50 dark:bg-red-900/20'">
              <span class="text-sm text-gray-600 dark:text-gray-300">Fat Control</span>
              <span class="text-lg font-bold" :class="scan.fat_control < 0 ? 'text-emerald-600' : 'text-red-600'">
                {{ scan.fat_control > 0 ? '+' : '' }}{{ scan.fat_control?.toFixed(1) || '--' }} kg
              </span>
            </div>

            <!-- Muscle Control -->
            <div class="flex items-center justify-between p-3 rounded-lg" :class="scan.muscle_control > 0 ? 'bg-emerald-50 dark:bg-emerald-900/20' : 'bg-amber-50 dark:bg-amber-900/20'">
              <span class="text-sm text-gray-600 dark:text-gray-300">Muscle Control</span>
              <span class="text-lg font-bold" :class="scan.muscle_control > 0 ? 'text-emerald-600' : 'text-amber-600'">
                {{ scan.muscle_control > 0 ? '+' : '' }}{{ scan.muscle_control?.toFixed(1) || '--' }} kg
              </span>
            </div>

            <!-- Recommended Calorie Intake -->
            <div class="flex items-center justify-between p-3 bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 rounded-lg">
              <span class="text-sm text-gray-600 dark:text-gray-300">Daily Calorie Target</span>
              <span class="text-lg font-bold text-amber-600">{{ scan.recommended_calorie_intake || '--' }} kcal</span>
            </div>
          </div>

          <!-- Edit Mode -->
          <div v-else class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-xs font-medium mb-1">Target Weight (kg)</label>
              <UInput v-model.number="editForm.target_weight" type="number" step="0.1" />
            </div>
            <div>
              <label class="block text-xs font-medium mb-1">Weight Control (kg)</label>
              <UInput v-model.number="editForm.weight_control" type="number" step="0.1" />
            </div>
            <div>
              <label class="block text-xs font-medium mb-1">Fat Control (kg)</label>
              <UInput v-model.number="editForm.fat_control" type="number" step="0.1" />
            </div>
            <div>
              <label class="block text-xs font-medium mb-1">Muscle Control (kg)</label>
              <UInput v-model.number="editForm.muscle_control" type="number" step="0.1" />
            </div>
            <div class="col-span-2">
              <label class="block text-xs font-medium mb-1">Daily Calorie Target</label>
              <UInput v-model.number="editForm.recommended_calorie_intake" type="number" />
            </div>
          </div>
        </UCard>

        <!-- Segmental Lean Analysis -->
        <UCard>
          <template #header>
            <div class="flex items-center gap-2">
              <span class="w-3 h-3 rounded-full bg-emerald-500" />
              <h2 class="font-semibold">Segmental Lean (Muscle)</h2>
            </div>
          </template>

          <!-- View Mode -->
          <div v-if="!isEditing && segmentalLean" class="flex items-center justify-center gap-4">
            <!-- Left Side -->
            <div class="text-right space-y-3">
              <div>
                <p class="text-xs text-gray-500">Left Arm</p>
                <p class="font-bold text-lg text-emerald-600">{{ segmentalLean.leftArm.mass.toFixed(1) }} kg</p>
                <p class="text-xs text-gray-400">{{ segmentalLean.leftArm.pct.toFixed(0) }}%</p>
              </div>
              <div>
                <p class="text-xs text-gray-500">Left Leg</p>
                <p class="font-bold text-lg text-emerald-600">{{ segmentalLean.leftLeg.mass.toFixed(1) }} kg</p>
                <p class="text-xs text-gray-400">{{ segmentalLean.leftLeg.pct.toFixed(0) }}%</p>
              </div>
            </div>
            <!-- Body Icon -->
            <div class="w-24 h-36 relative">
              <svg viewBox="0 0 100 160" class="w-full h-full">
                <circle cx="50" cy="15" r="12" fill="currentColor" class="text-gray-300 dark:text-gray-600" />
                <rect x="30" y="30" width="40" height="50" rx="5" fill="currentColor" class="text-emerald-400" opacity="0.8" />
                <rect x="10" y="35" width="15" height="40" rx="5" fill="currentColor" class="text-emerald-300" opacity="0.8" />
                <rect x="75" y="35" width="15" height="40" rx="5" fill="currentColor" class="text-emerald-300" opacity="0.8" />
                <rect x="32" y="85" width="15" height="55" rx="5" fill="currentColor" class="text-emerald-500" opacity="0.8" />
                <rect x="53" y="85" width="15" height="55" rx="5" fill="currentColor" class="text-emerald-500" opacity="0.8" />
              </svg>
              <div class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center">
                <p class="text-xs text-white font-medium">Trunk</p>
                <p class="font-bold text-sm text-white">{{ segmentalLean.trunk.mass.toFixed(1) }}</p>
              </div>
            </div>
            <!-- Right Side -->
            <div class="text-left space-y-3">
              <div>
                <p class="text-xs text-gray-500">Right Arm</p>
                <p class="font-bold text-lg text-emerald-600">{{ segmentalLean.rightArm.mass.toFixed(1) }} kg</p>
                <p class="text-xs text-gray-400">{{ segmentalLean.rightArm.pct.toFixed(0) }}%</p>
              </div>
              <div>
                <p class="text-xs text-gray-500">Right Leg</p>
                <p class="font-bold text-lg text-emerald-600">{{ segmentalLean.rightLeg.mass.toFixed(1) }} kg</p>
                <p class="text-xs text-gray-400">{{ segmentalLean.rightLeg.pct.toFixed(0) }}%</p>
              </div>
            </div>
          </div>

          <!-- Edit Mode -->
          <div v-else-if="isEditing" class="space-y-4">
            <div class="grid grid-cols-6 gap-2 text-xs">
              <div></div>
              <div class="text-center font-medium text-emerald-600">Left Arm</div>
              <div class="text-center font-medium text-emerald-600">Right Arm</div>
              <div class="text-center font-medium text-emerald-600">Trunk</div>
              <div class="text-center font-medium text-emerald-600">Left Leg</div>
              <div class="text-center font-medium text-emerald-600">Right Leg</div>
            </div>
            <div class="grid grid-cols-6 gap-2">
              <div class="text-xs font-medium self-center">Mass (kg)</div>
              <UInput v-model.number="editForm.segmental_lean.left_arm.mass" type="number" step="0.1" size="sm" />
              <UInput v-model.number="editForm.segmental_lean.right_arm.mass" type="number" step="0.1" size="sm" />
              <UInput v-model.number="editForm.segmental_lean.trunk.mass" type="number" step="0.1" size="sm" />
              <UInput v-model.number="editForm.segmental_lean.left_leg.mass" type="number" step="0.1" size="sm" />
              <UInput v-model.number="editForm.segmental_lean.right_leg.mass" type="number" step="0.1" size="sm" />
            </div>
            <div class="grid grid-cols-6 gap-2">
              <div class="text-xs font-medium self-center">% Level</div>
              <UInput v-model.number="editForm.segmental_lean.left_arm.percentage" type="number" step="1" size="sm" />
              <UInput v-model.number="editForm.segmental_lean.right_arm.percentage" type="number" step="1" size="sm" />
              <UInput v-model.number="editForm.segmental_lean.trunk.percentage" type="number" step="1" size="sm" />
              <UInput v-model.number="editForm.segmental_lean.left_leg.percentage" type="number" step="1" size="sm" />
              <UInput v-model.number="editForm.segmental_lean.right_leg.percentage" type="number" step="1" size="sm" />
            </div>
          </div>
        </UCard>

        <!-- Segmental Fat Analysis -->
        <UCard>
          <template #header>
            <div class="flex items-center gap-2">
              <span class="w-3 h-3 rounded-full bg-orange-500" />
              <h2 class="font-semibold">Segmental Fat</h2>
            </div>
          </template>

          <!-- View Mode -->
          <div v-if="!isEditing && segmentalFat" class="flex items-center justify-center gap-4">
            <!-- Left Side -->
            <div class="text-right space-y-3">
              <div>
                <p class="text-xs text-gray-500">Left Arm</p>
                <p class="font-bold text-lg text-orange-600">{{ segmentalFat.leftArm.mass.toFixed(1) }} kg</p>
                <p class="text-xs" :class="segmentalFat.leftArm.pct > 160 ? 'text-red-500' : 'text-gray-400'">{{ segmentalFat.leftArm.pct.toFixed(0) }}%</p>
              </div>
              <div>
                <p class="text-xs text-gray-500">Left Leg</p>
                <p class="font-bold text-lg text-orange-600">{{ segmentalFat.leftLeg.mass.toFixed(1) }} kg</p>
                <p class="text-xs" :class="segmentalFat.leftLeg.pct > 160 ? 'text-red-500' : 'text-gray-400'">{{ segmentalFat.leftLeg.pct.toFixed(0) }}%</p>
              </div>
            </div>
            <!-- Body Icon -->
            <div class="w-24 h-36 relative">
              <svg viewBox="0 0 100 160" class="w-full h-full">
                <circle cx="50" cy="15" r="12" fill="currentColor" class="text-gray-300 dark:text-gray-600" />
                <rect x="30" y="30" width="40" height="50" rx="5" fill="currentColor" class="text-orange-400" opacity="0.8" />
                <rect x="10" y="35" width="15" height="40" rx="5" fill="currentColor" class="text-orange-300" opacity="0.8" />
                <rect x="75" y="35" width="15" height="40" rx="5" fill="currentColor" class="text-orange-300" opacity="0.8" />
                <rect x="32" y="85" width="15" height="55" rx="5" fill="currentColor" class="text-orange-500" opacity="0.8" />
                <rect x="53" y="85" width="15" height="55" rx="5" fill="currentColor" class="text-orange-500" opacity="0.8" />
              </svg>
              <div class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center">
                <p class="text-xs text-white font-medium">Trunk</p>
                <p class="font-bold text-sm text-white">{{ segmentalFat.trunk.mass.toFixed(1) }}</p>
              </div>
            </div>
            <!-- Right Side -->
            <div class="text-left space-y-3">
              <div>
                <p class="text-xs text-gray-500">Right Arm</p>
                <p class="font-bold text-lg text-orange-600">{{ segmentalFat.rightArm.mass.toFixed(1) }} kg</p>
                <p class="text-xs" :class="segmentalFat.rightArm.pct > 160 ? 'text-red-500' : 'text-gray-400'">{{ segmentalFat.rightArm.pct.toFixed(0) }}%</p>
              </div>
              <div>
                <p class="text-xs text-gray-500">Right Leg</p>
                <p class="font-bold text-lg text-orange-600">{{ segmentalFat.rightLeg.mass.toFixed(1) }} kg</p>
                <p class="text-xs" :class="segmentalFat.rightLeg.pct > 160 ? 'text-red-500' : 'text-gray-400'">{{ segmentalFat.rightLeg.pct.toFixed(0) }}%</p>
              </div>
            </div>
          </div>

          <!-- Edit Mode -->
          <div v-else-if="isEditing" class="space-y-4">
            <div class="grid grid-cols-6 gap-2 text-xs">
              <div></div>
              <div class="text-center font-medium text-orange-600">Left Arm</div>
              <div class="text-center font-medium text-orange-600">Right Arm</div>
              <div class="text-center font-medium text-orange-600">Trunk</div>
              <div class="text-center font-medium text-orange-600">Left Leg</div>
              <div class="text-center font-medium text-orange-600">Right Leg</div>
            </div>
            <div class="grid grid-cols-6 gap-2">
              <div class="text-xs font-medium self-center">Mass (kg)</div>
              <UInput v-model.number="editForm.segmental_fat.left_arm.mass" type="number" step="0.1" size="sm" />
              <UInput v-model.number="editForm.segmental_fat.right_arm.mass" type="number" step="0.1" size="sm" />
              <UInput v-model.number="editForm.segmental_fat.trunk.mass" type="number" step="0.1" size="sm" />
              <UInput v-model.number="editForm.segmental_fat.left_leg.mass" type="number" step="0.1" size="sm" />
              <UInput v-model.number="editForm.segmental_fat.right_leg.mass" type="number" step="0.1" size="sm" />
            </div>
            <div class="grid grid-cols-6 gap-2">
              <div class="text-xs font-medium self-center">% Level</div>
              <UInput v-model.number="editForm.segmental_fat.left_arm.percentage" type="number" step="1" size="sm" />
              <UInput v-model.number="editForm.segmental_fat.right_arm.percentage" type="number" step="1" size="sm" />
              <UInput v-model.number="editForm.segmental_fat.trunk.percentage" type="number" step="1" size="sm" />
              <UInput v-model.number="editForm.segmental_fat.left_leg.percentage" type="number" step="1" size="sm" />
              <UInput v-model.number="editForm.segmental_fat.right_leg.percentage" type="number" step="1" size="sm" />
            </div>
          </div>
        </UCard>
      </div>
    </div>
  </div>
</template>
