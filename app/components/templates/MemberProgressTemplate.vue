<script setup lang="ts">
/**
 * MemberProgressTemplate - "The Transformation Card"
 * Instagram Story template (1080x1920) showing member body recomposition progress
 */

interface ScanData {
  weight: number
  pbf: number
  smm: number
  date: string
}

interface VolumePoint {
  date: string
  total_volume: number
}

const props = defineProps<{
  memberName: string
  coachName: string
  beforeScan: ScanData
  afterScan: ScanData
  sessionsCompleted: number
  attendanceRate: number
  volumeData: VolumePoint[]
  totalVolume: number
}>()

// Format date for display
function formatDate(dateStr: string): string {
  const date = new Date(dateStr)
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

// Calculate days between scans
const daysBetween = computed(() => {
  const before = new Date(props.beforeScan.date)
  const after = new Date(props.afterScan.date)
  return Math.round((after.getTime() - before.getTime()) / (1000 * 60 * 60 * 24))
})

// Calculate deltas
const deltas = computed(() => ({
  weight: props.afterScan.weight - props.beforeScan.weight,
  pbf: props.afterScan.pbf - props.beforeScan.pbf,
  smm: props.afterScan.smm - props.beforeScan.smm
}))

// Generate sparkline bars (max 10 bars)
const sparklineBars = computed(() => {
  if (!props.volumeData || props.volumeData.length === 0) return []
  
  // Take last 10 data points
  const data = props.volumeData.slice(-10)
  const maxVolume = Math.max(...data.map(v => v.total_volume))
  
  return data.map(v => ({
    height: maxVolume > 0 ? (v.total_volume / maxVolume) * 100 : 0
  }))
})

// Format total volume
const formattedVolume = computed(() => {
  if (props.totalVolume >= 1000) {
    return `${(props.totalVolume / 1000).toFixed(1)}k`
  }
  return props.totalVolume.toLocaleString()
})
</script>

<template>
  <!-- Fixed 1080x1920 container -->
  <div 
    class="bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white flex flex-col p-12"
    style="width: 1080px; height: 1920px; font-family: 'Inter', system-ui, sans-serif;"
  >
    <!-- TOP: Branding -->
    <div class="flex items-center justify-between mb-8">
      <div class="flex items-center gap-4">
        <img 
          src="/metamorph-logo.png" 
          alt="Metamorph" 
          class="w-16 h-16 rounded-2xl"
        />
        <span class="text-3xl font-bold text-slate-300">METAMORPH</span>
      </div>
      <div class="text-right">
        <p class="text-xl text-slate-400">Coach</p>
        <p class="text-2xl font-semibold text-white">{{ coachName }}</p>
      </div>
    </div>

    <!-- HEADER: Transformation Title -->
    <div class="text-center mb-10">
      <div class="flex items-center justify-center gap-4 mb-4">
        <span class="text-6xl">🏆</span>
      </div>
      <h1 class="text-7xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-teal-300 mb-4">
        TRANSFORMATION
      </h1>
      <p class="text-4xl font-semibold text-white mb-2">{{ memberName }}</p>
      <p class="text-2xl text-slate-400">
        {{ formatDate(beforeScan.date) }} → {{ formatDate(afterScan.date) }}
        <span class="text-slate-500">({{ daysBetween }} days)</span>
      </p>
    </div>

    <!-- BEFORE / AFTER Cards -->
    <div class="flex items-center justify-center gap-8 mb-10">
      <!-- Before Card -->
      <div class="bg-slate-800/60 backdrop-blur rounded-[32px] p-8 w-[420px] border border-slate-700/50">
        <p class="text-2xl text-slate-400 uppercase tracking-wider font-semibold mb-6 text-center">Before</p>
        <div class="space-y-4">
          <div class="flex justify-between items-center">
            <span class="text-xl text-slate-400">Weight</span>
            <span class="text-3xl font-bold">{{ beforeScan.weight.toFixed(1) }} kg</span>
          </div>
          <div class="flex justify-between items-center">
            <span class="text-xl text-slate-400">Body Fat</span>
            <span class="text-3xl font-bold">{{ beforeScan.pbf.toFixed(1) }}%</span>
          </div>
          <div class="flex justify-between items-center">
            <span class="text-xl text-slate-400">Muscle</span>
            <span class="text-3xl font-bold">{{ beforeScan.smm.toFixed(1) }} kg</span>
          </div>
        </div>
      </div>

      <!-- Arrow -->
      <div class="text-6xl text-emerald-400">→</div>

      <!-- After Card -->
      <div class="bg-gradient-to-br from-emerald-500/20 to-teal-500/20 backdrop-blur rounded-[32px] p-8 w-[420px] border border-emerald-500/30">
        <p class="text-2xl text-emerald-300 uppercase tracking-wider font-semibold mb-6 text-center">After</p>
        <div class="space-y-4">
          <div class="flex justify-between items-center">
            <span class="text-xl text-emerald-200/80">Weight</span>
            <span class="text-3xl font-bold text-white">{{ afterScan.weight.toFixed(1) }} kg</span>
          </div>
          <div class="flex justify-between items-center">
            <span class="text-xl text-emerald-200/80">Body Fat</span>
            <span class="text-3xl font-bold text-white">{{ afterScan.pbf.toFixed(1) }}%</span>
          </div>
          <div class="flex justify-between items-center">
            <span class="text-xl text-emerald-200/80">Muscle</span>
            <span class="text-3xl font-bold text-white">{{ afterScan.smm.toFixed(1) }} kg</span>
          </div>
        </div>
      </div>
    </div>

    <!-- DELTA BADGES -->
    <div class="flex justify-center gap-4 mb-6">
      <!-- Weight Change -->
      <div 
        class="rounded-2xl px-6 py-4 text-center min-w-[180px]"
        :class="deltas.weight <= 0 ? 'bg-emerald-500/20 border border-emerald-500/30' : 'bg-orange-500/20 border border-orange-500/30'"
      >
        <p 
          class="text-4xl font-black"
          :class="deltas.weight <= 0 ? 'text-emerald-400' : 'text-orange-400'"
        >
          {{ deltas.weight > 0 ? '+' : '' }}{{ deltas.weight.toFixed(1) }}
        </p>
        <p class="text-base text-slate-300 mt-1">kg Weight</p>
      </div>
      
      <!-- Body Fat Change -->
      <div 
        class="rounded-2xl px-6 py-4 text-center min-w-[180px]"
        :class="deltas.pbf <= 0 ? 'bg-emerald-500/20 border border-emerald-500/30' : 'bg-orange-500/20 border border-orange-500/30'"
      >
        <p 
          class="text-4xl font-black"
          :class="deltas.pbf <= 0 ? 'text-emerald-400' : 'text-orange-400'"
        >
          {{ deltas.pbf > 0 ? '+' : '' }}{{ deltas.pbf.toFixed(1) }}%
        </p>
        <p class="text-base text-slate-300 mt-1">Body Fat</p>
      </div>
      
      <!-- Muscle Change -->
      <div 
        class="rounded-2xl px-6 py-4 text-center min-w-[180px]"
        :class="deltas.smm >= 0 ? 'bg-emerald-500/20 border border-emerald-500/30' : 'bg-orange-500/20 border border-orange-500/30'"
      >
        <p 
          class="text-4xl font-black"
          :class="deltas.smm >= 0 ? 'text-emerald-400' : 'text-orange-400'"
        >
          {{ deltas.smm > 0 ? '+' : '' }}{{ deltas.smm.toFixed(1) }}
        </p>
        <p class="text-base text-slate-300 mt-1">kg Muscle</p>
      </div>
    </div>

    <!-- EFFORT SECTION: Sleek XP Badge Design -->
    <div class="bg-gradient-to-r from-violet-600/20 via-fuchsia-500/20 to-pink-500/20 backdrop-blur rounded-[28px] p-6 mb-6 border border-violet-400/20">
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-4">
          <div class="w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center">
            <span class="text-3xl">🔥</span>
          </div>
          <div>
            <p class="text-xl text-violet-200 font-medium">Total Lifted</p>
            <p class="text-4xl font-black text-white">{{ formattedVolume }} <span class="text-2xl text-violet-300">kg</span></p>
          </div>
        </div>
        <div class="bg-gradient-to-br from-violet-500 to-fuchsia-600 px-6 py-3 rounded-2xl">
          <p class="text-3xl font-black text-white">{{ Math.round(totalVolume / 1000) }}k</p>
          <p class="text-sm text-violet-200 text-center">XP</p>
        </div>
      </div>
    </div>

    <!-- FOOTER: Sessions & Attendance - More Compact -->
    <div class="flex items-center justify-center gap-8 py-5 bg-slate-800/40 rounded-2xl">
      <div class="flex items-center gap-3">
        <span class="text-3xl">💪</span>
        <div>
          <p class="text-3xl font-bold text-white">{{ sessionsCompleted }}</p>
          <p class="text-sm text-slate-400">Sessions</p>
        </div>
      </div>
      <div class="w-px h-12 bg-slate-600" />
      <div class="flex items-center gap-3">
        <span class="text-3xl">🎯</span>
        <div>
          <p class="text-3xl font-bold text-white">{{ attendanceRate }}%</p>
          <p class="text-sm text-slate-400">Attendance</p>
        </div>
      </div>
    </div>
  </div>
</template>

