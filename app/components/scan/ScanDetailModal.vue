<script setup lang="ts">
const props = defineProps<{
  open: boolean
  scan: any
  memberName?: string
}>()

const emit = defineEmits<{
  (e: 'close'): void
}>()

// Computed values for body composition chart
const bodyComposition = computed(() => {
  if (!props.scan) return null
  
  const weight = props.scan.weight || 0
  // Use body_fat_mass from MongoDB, fallback to calculated from pbf
  const bfm = props.scan.body_fat_mass || props.scan.bfm || (weight * (props.scan.pbf || 0) / 100)
  const smm = props.scan.smm || 0
  // tbw may not exist, estimate from fat_free_mass or weight
  const tbw = props.scan.tbw || (props.scan.fat_free_mass ? props.scan.fat_free_mass * 0.73 : weight * 0.55)
  
  // Calculate percentages for bar chart
  const total = weight || 1
  return {
    bfm: { value: bfm, percent: (bfm / total) * 100, label: 'Body Fat', color: 'bg-orange-400' },
    smm: { value: smm, percent: (smm / total) * 100, label: 'Muscle', color: 'bg-emerald-500' },
    tbw: { value: tbw, percent: Math.min((tbw / total) * 100, 60), label: 'Water', color: 'bg-blue-400' },
  }
})

// Helper to safely get a numeric value
function safeNumber(val: any): number {
  if (typeof val === 'number') return val
  if (typeof val === 'string') {
    const parsed = parseFloat(val)
    return isNaN(parsed) ? 0 : parsed
  }
  // Handle objects like { mass: 30.5, percentage: 90 }
  if (val && typeof val === 'object') {
    if ('mass' in val) return safeNumber(val.mass)
    if ('value' in val) return safeNumber(val.value)
  }
  return 0
}

// Helper to format a number safely
function formatNumber(val: any, decimals: number = 1): string {
  const num = safeNumber(val)
  return num.toFixed(decimals)
}

// Helper to get percentage from segmental object
function safePercentage(val: any): number {
  if (typeof val === 'number') return 100 // If just a number, assume 100%
  if (val && typeof val === 'object' && 'percentage' in val) {
    return safeNumber(val.percentage)
  }
  return 0
}

// Segmental lean analysis data - handles {mass, percentage} structure
const segmentalData = computed(() => {
  if (!props.scan?.segmental_lean) return null
  const sl = props.scan.segmental_lean
  return {
    leftArm: { mass: safeNumber(sl.left_arm), pct: safePercentage(sl.left_arm) },
    rightArm: { mass: safeNumber(sl.right_arm), pct: safePercentage(sl.right_arm) },
    trunk: { mass: safeNumber(sl.trunk), pct: safePercentage(sl.trunk) },
    leftLeg: { mass: safeNumber(sl.left_leg), pct: safePercentage(sl.left_leg) },
    rightLeg: { mass: safeNumber(sl.right_leg), pct: safePercentage(sl.right_leg) }
  }
})

// Segmental fat analysis data
const segmentalFatData = computed(() => {
  if (!props.scan?.segmental_fat) return null
  const sf = props.scan.segmental_fat
  return {
    leftArm: { mass: safeNumber(sf.left_arm), pct: safePercentage(sf.left_arm) },
    rightArm: { mass: safeNumber(sf.right_arm), pct: safePercentage(sf.right_arm) },
    trunk: { mass: safeNumber(sf.trunk), pct: safePercentage(sf.trunk) },
    leftLeg: { mass: safeNumber(sf.left_leg), pct: safePercentage(sf.left_leg) },
    rightLeg: { mass: safeNumber(sf.right_leg), pct: safePercentage(sf.right_leg) }
  }
})

// Format date
const scanDate = computed(() => {
  if (!props.scan) return ''
  const date = new Date(props.scan.test_date_time || props.scan.metadata?.processed_at)
  return date.toLocaleDateString('en-US', { 
    weekday: 'long',
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  })
})

// Health indicators
const healthIndicators = computed(() => {
  if (!props.scan) return []
  
  const indicators = []
  
  // PBF indicator
  const pbf = props.scan.pbf
  if (pbf !== undefined) {
    let status = 'normal'
    if (pbf < 10) status = 'low'
    else if (pbf > 25) status = 'high'
    indicators.push({ 
      label: 'Body Fat %', 
      value: pbf.toFixed(1) + '%', 
      status,
      ideal: '10-20%'
    })
  }
  
  // BMI indicator
  const bmi = props.scan.bmi
  if (bmi !== undefined) {
    let status = 'normal'
    if (bmi < 18.5) status = 'low'
    else if (bmi > 25) status = 'high'
    indicators.push({ 
      label: 'BMI', 
      value: bmi.toFixed(1), 
      status,
      ideal: '18.5-24.9'
    })
  }
  
  // Visceral Fat - field is visceral_fat in MongoDB
  const vfl = props.scan.visceral_fat ?? props.scan.visceral_fat_level
  if (vfl !== undefined && vfl !== null) {
    let status = 'normal'
    if (vfl > 10) status = 'high'
    indicators.push({ 
      label: 'Visceral Fat', 
      value: vfl.toString(), 
      status,
      ideal: '1-9'
    })
  }
  
  return indicators
})
</script>

<template>
  <UModal :open="props.open" @update:open="$emit('close')" size="lg">
    <template #content>
      <div class="p-6 space-y-6 max-h-[80vh] overflow-y-auto">
        <!-- Header -->
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-3">
            <div class="w-12 h-12 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
              <UIcon name="i-heroicons-chart-bar-square" class="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 class="text-xl font-bold text-gray-900 dark:text-white">Scan Results</h2>
              <p class="text-sm text-gray-500">{{ scanDate }}</p>
            </div>
          </div>
          <UButton icon="i-heroicons-x-mark" color="neutral" variant="ghost" @click="$emit('close')" />
        </div>

        <!-- Key Metrics Grid -->
        <div class="grid grid-cols-4 gap-3">
          <div class="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-4 text-white">
            <p class="text-xs opacity-80 uppercase">Weight</p>
            <p class="text-2xl font-bold">{{ scan?.weight?.toFixed(1) || '--' }}</p>
            <p class="text-xs opacity-80">kg</p>
          </div>
          <div class="bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-xl p-4 text-white">
            <p class="text-xs opacity-80 uppercase">SMM</p>
            <p class="text-2xl font-bold">{{ scan?.smm?.toFixed(1) || '--' }}</p>
            <p class="text-xs opacity-80">kg</p>
          </div>
          <div class="bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl p-4 text-white">
            <p class="text-xs opacity-80 uppercase">Body Fat</p>
            <p class="text-2xl font-bold">{{ scan?.pbf?.toFixed(1) || '--' }}</p>
            <p class="text-xs opacity-80">%</p>
          </div>
          <div class="bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl p-4 text-white">
            <p class="text-xs opacity-80 uppercase">BMI</p>
            <p class="text-2xl font-bold">{{ scan?.bmi?.toFixed(1) || '--' }}</p>
            <p class="text-xs opacity-80">kg/m²</p>
          </div>
        </div>

        <!-- Body Composition Bar Chart -->
        <div v-if="bodyComposition" class="bg-gray-50 dark:bg-slate-800 rounded-xl p-4">
          <h3 class="font-semibold mb-4">Body Composition</h3>
          <div class="space-y-3">
            <!-- Muscle -->
            <div>
              <div class="flex justify-between text-sm mb-1">
                <span class="text-gray-600 dark:text-gray-300">Muscle Mass</span>
                <span class="font-medium text-emerald-600">{{ scan?.smm?.toFixed(1) || '--' }} kg</span>
              </div>
              <div class="h-4 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                <div 
                  class="h-full bg-gradient-to-r from-emerald-400 to-emerald-500 rounded-full transition-all duration-500"
                  :style="{ width: `${Math.min(bodyComposition.smm.percent * 2, 100)}%` }"
                />
              </div>
            </div>
            <!-- Body Fat -->
            <div>
              <div class="flex justify-between text-sm mb-1">
                <span class="text-gray-600 dark:text-gray-300">Body Fat Mass</span>
                <span class="font-medium text-orange-600">{{ bodyComposition.bfm.value.toFixed(1) }} kg</span>
              </div>
              <div class="h-4 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                <div 
                  class="h-full bg-gradient-to-r from-orange-400 to-orange-500 rounded-full transition-all duration-500"
                  :style="{ width: `${Math.min(bodyComposition.bfm.percent * 2, 100)}%` }"
                />
              </div>
            </div>
            <!-- Water -->
            <div>
              <div class="flex justify-between text-sm mb-1">
                <span class="text-gray-600 dark:text-gray-300">Total Body Water</span>
                <span class="font-medium text-blue-600">{{ bodyComposition.tbw.value.toFixed(1) }} L</span>
              </div>
              <div class="h-4 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                <div 
                  class="h-full bg-gradient-to-r from-blue-400 to-blue-500 rounded-full transition-all duration-500"
                  :style="{ width: `${bodyComposition.tbw.percent}%` }"
                />
              </div>
            </div>
          </div>
        </div>

        <!-- Segmental Lean Analysis -->
        <div v-if="segmentalData" class="bg-gray-50 dark:bg-slate-800 rounded-xl p-4">
          <h3 class="font-semibold mb-4 flex items-center gap-2">
            <span class="w-3 h-3 rounded-full bg-emerald-500"></span>
            Segmental Lean Analysis (Muscle)
          </h3>
          <div class="flex items-center justify-center gap-4">
            <!-- Left Side -->
            <div class="text-right space-y-3">
              <div>
                <p class="text-xs text-gray-500">Left Arm</p>
                <p class="font-bold text-lg text-emerald-600">{{ segmentalData.leftArm.mass.toFixed(1) }} kg</p>
                <p class="text-xs text-gray-400">{{ segmentalData.leftArm.pct.toFixed(0) }}%</p>
              </div>
              <div>
                <p class="text-xs text-gray-500">Left Leg</p>
                <p class="font-bold text-lg text-emerald-600">{{ segmentalData.leftLeg.mass.toFixed(1) }} kg</p>
                <p class="text-xs text-gray-400">{{ segmentalData.leftLeg.pct.toFixed(0) }}%</p>
              </div>
            </div>
            <!-- Body Icon -->
            <div class="w-28 h-40 relative">
              <svg viewBox="0 0 100 160" class="w-full h-full">
                <!-- Head -->
                <circle cx="50" cy="15" r="12" fill="currentColor" class="text-gray-300 dark:text-gray-600" />
                <!-- Torso -->
                <rect x="30" y="30" width="40" height="50" rx="5" fill="currentColor" class="text-emerald-400" opacity="0.8" />
                <!-- Left Arm -->
                <rect x="10" y="35" width="15" height="40" rx="5" fill="currentColor" class="text-emerald-300" opacity="0.8" />
                <!-- Right Arm -->
                <rect x="75" y="35" width="15" height="40" rx="5" fill="currentColor" class="text-emerald-300" opacity="0.8" />
                <!-- Left Leg -->
                <rect x="32" y="85" width="15" height="55" rx="5" fill="currentColor" class="text-emerald-500" opacity="0.8" />
                <!-- Right Leg -->
                <rect x="53" y="85" width="15" height="55" rx="5" fill="currentColor" class="text-emerald-500" opacity="0.8" />
              </svg>
              <div class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center">
                <p class="text-xs text-white font-medium">Trunk</p>
                <p class="font-bold text-sm text-white">{{ segmentalData.trunk.mass.toFixed(1) }}</p>
                <p class="text-xs text-white/80">{{ segmentalData.trunk.pct.toFixed(0) }}%</p>
              </div>
            </div>
            <!-- Right Side -->
            <div class="text-left space-y-3">
              <div>
                <p class="text-xs text-gray-500">Right Arm</p>
                <p class="font-bold text-lg text-emerald-600">{{ segmentalData.rightArm.mass.toFixed(1) }} kg</p>
                <p class="text-xs text-gray-400">{{ segmentalData.rightArm.pct.toFixed(0) }}%</p>
              </div>
              <div>
                <p class="text-xs text-gray-500">Right Leg</p>
                <p class="font-bold text-lg text-emerald-600">{{ segmentalData.rightLeg.mass.toFixed(1) }} kg</p>
                <p class="text-xs text-gray-400">{{ segmentalData.rightLeg.pct.toFixed(0) }}%</p>
              </div>
            </div>
          </div>
        </div>

        <!-- Segmental Fat Analysis -->
        <div v-if="segmentalFatData" class="bg-gray-50 dark:bg-slate-800 rounded-xl p-4">
          <h3 class="font-semibold mb-4 flex items-center gap-2">
            <span class="w-3 h-3 rounded-full bg-orange-500"></span>
            Segmental Fat Analysis
          </h3>
          <div class="flex items-center justify-center gap-4">
            <!-- Left Side -->
            <div class="text-right space-y-3">
              <div>
                <p class="text-xs text-gray-500">Left Arm</p>
                <p class="font-bold text-lg text-orange-600">{{ segmentalFatData.leftArm.mass.toFixed(1) }} kg</p>
                <p class="text-xs" :class="segmentalFatData.leftArm.pct > 160 ? 'text-red-500' : 'text-gray-400'">{{ segmentalFatData.leftArm.pct.toFixed(0) }}%</p>
              </div>
              <div>
                <p class="text-xs text-gray-500">Left Leg</p>
                <p class="font-bold text-lg text-orange-600">{{ segmentalFatData.leftLeg.mass.toFixed(1) }} kg</p>
                <p class="text-xs" :class="segmentalFatData.leftLeg.pct > 160 ? 'text-red-500' : 'text-gray-400'">{{ segmentalFatData.leftLeg.pct.toFixed(0) }}%</p>
              </div>
            </div>
            <!-- Body Icon -->
            <div class="w-28 h-40 relative">
              <svg viewBox="0 0 100 160" class="w-full h-full">
                <!-- Head -->
                <circle cx="50" cy="15" r="12" fill="currentColor" class="text-gray-300 dark:text-gray-600" />
                <!-- Torso -->
                <rect x="30" y="30" width="40" height="50" rx="5" fill="currentColor" class="text-orange-400" opacity="0.8" />
                <!-- Left Arm -->
                <rect x="10" y="35" width="15" height="40" rx="5" fill="currentColor" class="text-orange-300" opacity="0.8" />
                <!-- Right Arm -->
                <rect x="75" y="35" width="15" height="40" rx="5" fill="currentColor" class="text-orange-300" opacity="0.8" />
                <!-- Left Leg -->
                <rect x="32" y="85" width="15" height="55" rx="5" fill="currentColor" class="text-orange-500" opacity="0.8" />
                <!-- Right Leg -->
                <rect x="53" y="85" width="15" height="55" rx="5" fill="currentColor" class="text-orange-500" opacity="0.8" />
              </svg>
              <div class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center">
                <p class="text-xs text-white font-medium">Trunk</p>
                <p class="font-bold text-sm text-white">{{ segmentalFatData.trunk.mass.toFixed(1) }}</p>
                <p class="text-xs" :class="segmentalFatData.trunk.pct > 160 ? 'text-red-300' : 'text-white/80'">{{ segmentalFatData.trunk.pct.toFixed(0) }}%</p>
              </div>
            </div>
            <!-- Right Side -->
            <div class="text-left space-y-3">
              <div>
                <p class="text-xs text-gray-500">Right Arm</p>
                <p class="font-bold text-lg text-orange-600">{{ segmentalFatData.rightArm.mass.toFixed(1) }} kg</p>
                <p class="text-xs" :class="segmentalFatData.rightArm.pct > 160 ? 'text-red-500' : 'text-gray-400'">{{ segmentalFatData.rightArm.pct.toFixed(0) }}%</p>
              </div>
              <div>
                <p class="text-xs text-gray-500">Right Leg</p>
                <p class="font-bold text-lg text-orange-600">{{ segmentalFatData.rightLeg.mass.toFixed(1) }} kg</p>
                <p class="text-xs" :class="segmentalFatData.rightLeg.pct > 160 ? 'text-red-500' : 'text-gray-400'">{{ segmentalFatData.rightLeg.pct.toFixed(0) }}%</p>
              </div>
            </div>
          </div>
        </div>

        <!-- Health Indicators -->
        <div v-if="healthIndicators.length > 0" class="bg-gray-50 dark:bg-slate-800 rounded-xl p-4">
          <h3 class="font-semibold mb-4">Health Indicators</h3>
          <div class="grid grid-cols-3 gap-3">
            <div 
              v-for="indicator in healthIndicators" 
              :key="indicator.label"
              class="p-3 rounded-lg text-center"
              :class="{
                'bg-emerald-100 dark:bg-emerald-900/30': indicator.status === 'normal',
                'bg-amber-100 dark:bg-amber-900/30': indicator.status === 'low',
                'bg-red-100 dark:bg-red-900/30': indicator.status === 'high'
              }"
            >
              <p class="text-xs text-gray-500 mb-1">{{ indicator.label }}</p>
              <p 
                class="text-xl font-bold"
                :class="{
                  'text-emerald-600': indicator.status === 'normal',
                  'text-amber-600': indicator.status === 'low',
                  'text-red-600': indicator.status === 'high'
                }"
              >
                {{ indicator.value }}
              </p>
              <p class="text-xs text-gray-400">Ideal: {{ indicator.ideal }}</p>
            </div>
          </div>
        </div>

        <!-- AI Analysis -->
        <div v-if="scan?.analysis?.summary" class="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4">
          <div class="flex items-center gap-2 mb-3">
            <UIcon name="i-heroicons-sparkles" class="w-5 h-5 text-blue-500" />
            <h3 class="font-semibold text-blue-700 dark:text-blue-300">AI Analysis</h3>
          </div>
          <p class="text-sm text-blue-600 dark:text-blue-400 leading-relaxed">{{ scan.analysis.summary }}</p>
          
          <div v-if="scan.analysis.recommendations?.length" class="mt-4 space-y-2">
            <p class="text-xs font-medium text-blue-700 dark:text-blue-300 uppercase">Recommendations</p>
            <ul class="space-y-1">
              <li 
                v-for="(rec, i) in scan.analysis.recommendations" 
                :key="i"
                class="flex items-start gap-2 text-sm text-blue-600 dark:text-blue-400"
              >
                <UIcon name="i-heroicons-check-circle" class="w-4 h-4 mt-0.5 flex-shrink-0" />
                <span>{{ rec }}</span>
              </li>
            </ul>
          </div>
        </div>

        <!-- Close Button -->
        <UButton label="Close" color="neutral" variant="outline" block @click="$emit('close')" />
      </div>
    </template>
  </UModal>
</template>
