<script setup lang="ts">
import { Line } from 'vue-chartjs'
import {
  Chart as ChartJS,
  Title,
  Tooltip,
  Legend,
  LineElement,
  PointElement,
  CategoryScale,
  LinearScale,
  Filler
} from 'chart.js'
import annotationPlugin from 'chartjs-plugin-annotation'

// Register Chart.js components
ChartJS.register(
  Title,
  Tooltip,
  Legend,
  LineElement,
  PointElement,
  CategoryScale,
  LinearScale,
  Filler,
  annotationPlugin
)

interface Scan {
  test_date_time: string
  weight: number
  smm: number
  pbf: number
  body_fat_mass: number
}

const props = defineProps<{
  scans: Scan[]
}>()

// Sort scans by date (oldest first)
const sortedScans = computed(() => {
  return [...props.scans].sort((a, b) => 
    new Date(a.test_date_time).getTime() - new Date(b.test_date_time).getTime()
  )
})

// Find success zones (where SMM is rising and fat mass is falling)
const successZones = computed(() => {
  const zones: { startIdx: number; endIdx: number }[] = []
  let inSuccessZone = false
  let zoneStart = 0

  for (let i = 1; i < sortedScans.value.length; i++) {
    const prev = sortedScans.value[i - 1]
    const curr = sortedScans.value[i]
    if (!prev || !curr) continue
    
    // Success: SMM increased AND body fat mass decreased
    const isSuccess = curr.smm > prev.smm && curr.body_fat_mass < prev.body_fat_mass

    if (isSuccess && !inSuccessZone) {
      inSuccessZone = true
      zoneStart = i - 1
    } else if (!isSuccess && inSuccessZone) {
      inSuccessZone = false
      zones.push({ startIdx: zoneStart, endIdx: i - 1 })
    }
  }

  // Close final zone if still in success
  if (inSuccessZone) {
    zones.push({ startIdx: zoneStart, endIdx: sortedScans.value.length - 1 })
  }

  return zones
})

// Generate annotation boxes for success zones
const annotations = computed(() => {
  const result: Record<string, any> = {}
  
  successZones.value.forEach((zone, idx) => {
    result[`successZone${idx}`] = {
      type: 'box',
      xMin: zone.startIdx,
      xMax: zone.endIdx,
      backgroundColor: 'rgba(16, 185, 129, 0.15)',
      borderColor: 'rgba(16, 185, 129, 0.3)',
      borderWidth: 1,
      label: {
        display: zone.endIdx - zone.startIdx >= 1,
        content: '🎯 Recomp',
        position: 'start',
        font: { size: 10 },
        color: '#10b981'
      }
    }
  })
  
  return result
})

// Chart data - SMM and Body Fat Mass on same kg scale
const chartData = computed(() => {
  const labels = sortedScans.value.map(s => {
    const date = new Date(s.test_date_time)
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  })

  return {
    labels,
    datasets: [
      {
        label: 'Muscle (SMM)',
        data: sortedScans.value.map(s => s.smm),
        borderColor: '#10b981',
        backgroundColor: 'rgba(16, 185, 129, 0.1)',
        borderWidth: 3,
        tension: 0.4,
        fill: true,
        pointRadius: 6,
        pointBackgroundColor: '#10b981',
        pointBorderColor: '#fff',
        pointBorderWidth: 2
      },
      {
        label: 'Fat Mass',
        data: sortedScans.value.map(s => s.body_fat_mass),
        borderColor: '#f97316',
        backgroundColor: 'rgba(249, 115, 22, 0.1)',
        borderWidth: 3,
        tension: 0.4,
        fill: true,
        pointRadius: 6,
        pointBackgroundColor: '#f97316',
        pointBorderColor: '#fff',
        pointBorderWidth: 2
      }
    ]
  }
})

const chartOptions = computed(() => ({
  responsive: true,
  maintainAspectRatio: false,
  interaction: {
    mode: 'index' as const,
    intersect: false
  },
  plugins: {
    legend: {
      position: 'top' as const,
      labels: {
        usePointStyle: true,
        padding: 15,
        font: { size: 12 }
      }
    },
    tooltip: {
      backgroundColor: 'rgba(17, 24, 39, 0.9)',
      titleFont: { size: 13 },
      bodyFont: { size: 12 },
      padding: 12,
      cornerRadius: 8,
      callbacks: {
        label: (context: any) => {
          const label = context.dataset.label
          const value = context.raw
          return `${label}: ${value.toFixed(1)} kg`
        },
        afterBody: (contexts: any) => {
          // Show PBF as extra context
          const idx = contexts[0]?.dataIndex
          if (idx !== undefined && sortedScans.value[idx]) {
            return [`Body Fat %: ${sortedScans.value[idx].pbf?.toFixed(1) || '--'}%`]
          }
          return []
        }
      }
    },
    annotation: {
      annotations: annotations.value
    }
  },
  scales: {
    y: {
      type: 'linear' as const,
      display: true,
      title: {
        display: true,
        text: 'Mass (kg)',
        font: { size: 11, weight: 'bold' as const },
        color: '#6b7280'
      },
      grid: {
        color: 'rgba(156, 163, 175, 0.2)'
      },
      ticks: {
        callback: (value: string | number) => `${value} kg`
      }
    },
    x: {
      grid: {
        display: false
      }
    }
  }
}))

// Calculate recomposition score (keep PBF for the badge)
const recompScore = computed(() => {
  if (sortedScans.value.length < 2) return null
  
  const first = sortedScans.value[0]
  const last = sortedScans.value[sortedScans.value.length - 1]
  if (!first || !last) return null
  
  const muscleGain = last.smm - first.smm
  const fatMassLoss = first.body_fat_mass - last.body_fat_mass
  const pbfChange = first.pbf - last.pbf // Keep PBF for context
  
  return {
    muscleGain: muscleGain.toFixed(1),
    fatMassLoss: fatMassLoss.toFixed(1),
    pbfChange: pbfChange.toFixed(1),
    isSuccess: muscleGain > 0 && fatMassLoss > 0
  }
})
</script>

<template>
  <UCard v-if="scans.length > 1">
    <template #header>
      <div class="flex items-center justify-between flex-wrap gap-2">
        <div class="flex items-center gap-2">
          <UIcon name="i-heroicons-arrow-trending-up" class="w-5 h-5 text-primary-500" />
          <h2 class="font-semibold">Recomposition Cross</h2>
        </div>
        
        <!-- Success Badge -->
        <div v-if="recompScore?.isSuccess" class="flex items-center gap-2 bg-emerald-50 dark:bg-emerald-900/30 px-3 py-1.5 rounded-full">
          <span class="text-lg">🎉</span>
          <span class="text-sm font-medium text-emerald-700 dark:text-emerald-300">
            +{{ recompScore.muscleGain }}kg muscle, -{{ recompScore.fatMassLoss }}kg fat
          </span>
          <span class="text-xs text-gray-500">({{ recompScore.pbfChange }}% BF)</span>
        </div>
      </div>
    </template>
    
    <div class="h-72">
      <Line :data="chartData" :options="chartOptions" />
    </div>
    
    <div class="flex items-center justify-center gap-6 mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
      <div class="flex items-center gap-2">
        <span class="w-3 h-3 rounded-full bg-emerald-500" />
        <span class="text-xs text-gray-600 dark:text-gray-400">Muscle (SMM kg)</span>
      </div>
      <div class="flex items-center gap-2">
        <span class="w-3 h-3 rounded-full bg-orange-500" />
        <span class="text-xs text-gray-600 dark:text-gray-400">Fat Mass (kg)</span>
      </div>
      <div class="flex items-center gap-2">
        <span class="w-4 h-3 bg-emerald-200 dark:bg-emerald-800 rounded" />
        <span class="text-xs text-gray-600 dark:text-gray-400">Success Zone</span>
      </div>
    </div>
  </UCard>
</template>
