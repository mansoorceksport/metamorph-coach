<script setup lang="ts">
import { Line, Radar } from 'vue-chartjs'
import {
  Chart as ChartJS,
  Title,
  Tooltip,
  Legend,
  LineElement,
  PointElement,
  CategoryScale,
  LinearScale,
  RadialLinearScale,
  Filler
} from 'chart.js'

// Register Chart.js components
ChartJS.register(
  Title,
  Tooltip,
  Legend,
  LineElement,
  PointElement,
  CategoryScale,
  LinearScale,
  RadialLinearScale,
  Filler
)

interface Scan {
  test_date_time: string
  weight: number
  smm: number
  pbf: number
  segmental_lean?: {
    left_arm: { mass: number; percentage: number }
    right_arm: { mass: number; percentage: number }
    trunk: { mass: number; percentage: number }
    left_leg: { mass: number; percentage: number }
    right_leg: { mass: number; percentage: number }
  }
  segmental_fat?: {
    left_arm: { mass: number; percentage: number }
    right_arm: { mass: number; percentage: number }
    trunk: { mass: number; percentage: number }
    left_leg: { mass: number; percentage: number }
    right_leg: { mass: number; percentage: number }
  }
}

const props = defineProps<{
  scans: Scan[]
}>()

// Helper to safely get percentage
function getPct(val: any): number {
  if (typeof val === 'number') return val
  if (val && typeof val === 'object' && 'percentage' in val) {
    return val.percentage || 0
  }
  return 0
}

// Sort scans by date (oldest first for trend line)
const sortedScans = computed(() => {
  return [...props.scans].sort((a, b) => 
    new Date(a.test_date_time).getTime() - new Date(b.test_date_time).getTime()
  )
})

// Line chart data (Weight, SMM, PBF trends)
const lineChartData = computed(() => {
  const labels = sortedScans.value.map(s => {
    const date = new Date(s.test_date_time)
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  })

  return {
    labels,
    datasets: [
      {
        label: 'Weight (kg)',
        data: sortedScans.value.map(s => s.weight),
        borderColor: '#3b82f6',
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        tension: 0.3,
        fill: false
      },
      {
        label: 'SMM (kg)',
        data: sortedScans.value.map(s => s.smm),
        borderColor: '#10b981',
        backgroundColor: 'rgba(16, 185, 129, 0.1)',
        tension: 0.3,
        fill: false
      },
      {
        label: 'Body Fat %',
        data: sortedScans.value.map(s => s.pbf),
        borderColor: '#f97316',
        backgroundColor: 'rgba(249, 115, 22, 0.1)',
        tension: 0.3,
        fill: false
      }
    ]
  }
})

const lineChartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      position: 'top' as const,
      labels: {
        usePointStyle: true,
        padding: 15
      }
    }
  },
  scales: {
    y: {
      beginAtZero: false,
      grid: {
        color: 'rgba(156, 163, 175, 0.2)'
      }
    },
    x: {
      grid: {
        display: false
      }
    }
  }
}

// Get latest scan for radar charts
const latestScan = computed(() => props.scans[0])

// Segmental Lean radar data
const leanRadarData = computed(() => {
  const sl = latestScan.value?.segmental_lean
  if (!sl) return null

  return {
    labels: ['Left Arm', 'Right Arm', 'Trunk', 'Left Leg', 'Right Leg'],
    datasets: [{
      label: 'Lean Mass %',
      data: [
        getPct(sl.left_arm),
        getPct(sl.right_arm),
        getPct(sl.trunk),
        getPct(sl.left_leg),
        getPct(sl.right_leg)
      ],
      backgroundColor: 'rgba(16, 185, 129, 0.2)',
      borderColor: '#10b981',
      borderWidth: 2,
      pointBackgroundColor: '#10b981'
    }]
  }
})

// Segmental Fat radar data
const fatRadarData = computed(() => {
  const sf = latestScan.value?.segmental_fat
  if (!sf) return null

  return {
    labels: ['Left Arm', 'Right Arm', 'Trunk', 'Left Leg', 'Right Leg'],
    datasets: [{
      label: 'Fat %',
      data: [
        getPct(sf.left_arm),
        getPct(sf.right_arm),
        getPct(sf.trunk),
        getPct(sf.left_leg),
        getPct(sf.right_leg)
      ],
      backgroundColor: 'rgba(249, 115, 22, 0.2)',
      borderColor: '#f97316',
      borderWidth: 2,
      pointBackgroundColor: '#f97316'
    }]
  }
})

const radarOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      display: false
    }
  },
  scales: {
    r: {
      beginAtZero: false,
      suggestedMin: 80,
      suggestedMax: 120,
      grid: {
        color: 'rgba(156, 163, 175, 0.3)'
      },
      angleLines: {
        color: 'rgba(156, 163, 175, 0.3)'
      },
      ticks: {
        stepSize: 10,
        backdropColor: 'transparent'
      }
    }
  }
}
</script>

<template>
  <div class="space-y-6">
    <!-- Line Chart - Trends -->
    <UCard v-if="scans.length > 1">
      <template #header>
        <div class="flex items-center gap-2">
          <UIcon name="i-heroicons-chart-bar" class="w-5 h-5 text-primary-500" />
          <h2 class="font-semibold">Body Composition Trends</h2>
        </div>
      </template>
      <div class="h-64">
        <Line :data="lineChartData" :options="lineChartOptions" />
      </div>
    </UCard>

    <!-- Radar Charts Row -->
    <div v-if="latestScan" class="grid grid-cols-1 md:grid-cols-2 gap-4">
      <!-- Segmental Lean Radar -->
      <UCard v-if="leanRadarData">
        <template #header>
          <div class="flex items-center gap-2">
            <span class="w-3 h-3 rounded-full bg-emerald-500" />
            <h3 class="font-semibold text-sm">Segmental Lean (%)</h3>
          </div>
        </template>
        <div class="h-56">
          <Radar :data="leanRadarData" :options="radarOptions" />
        </div>
        <p class="text-xs text-gray-500 text-center mt-2">
          100% = Standard • Above = More muscle • Below = Less muscle
        </p>
      </UCard>

      <!-- Segmental Fat Radar -->
      <UCard v-if="fatRadarData">
        <template #header>
          <div class="flex items-center gap-2">
            <span class="w-3 h-3 rounded-full bg-orange-500" />
            <h3 class="font-semibold text-sm">Segmental Fat (%)</h3>
          </div>
        </template>
        <div class="h-56">
          <Radar :data="fatRadarData" :options="radarOptions" />
        </div>
        <p class="text-xs text-gray-500 text-center mt-2">
          100% = Standard • Above = More fat • Below = Less fat
        </p>
      </UCard>
    </div>

    <!-- No data state -->
    <div v-if="scans.length === 0" class="text-center py-8 text-gray-500">
      <UIcon name="i-heroicons-chart-bar" class="w-12 h-12 mx-auto opacity-30 mb-3" />
      <p>No scan data available for trends</p>
    </div>
  </div>
</template>
