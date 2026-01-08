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

ChartJS.register(
  Title,
  Tooltip,
  Legend,
  LineElement,
  PointElement,
  CategoryScale,
  LinearScale,
  Filler
)

const props = defineProps<{
  memberId: string
}>()

const token = useCookie('metamorph-token')
const isLoading = ref(true)

interface VolumePoint {
  date: string
  total_volume: number
  total_sets: number
  total_reps: number
  total_weight: number
  exercise_count: number
}

const volumes = ref<VolumePoint[]>([])

// Fetch volume history
async function loadVolumeHistory() {
  isLoading.value = true
  try {
    const data = await $fetch<{ volumes: VolumePoint[] }>(
      `/api/v1/pro/members/${props.memberId}/volume-history`,
      {
        headers: { Authorization: `Bearer ${token.value}` }
      }
    )
    volumes.value = data.volumes || []
  } catch (error) {
    console.warn('Failed to load volume history:', error)
    volumes.value = []
  } finally {
    isLoading.value = false
  }
}

onMounted(() => {
  loadVolumeHistory()
})

// Chart data - Stacked Area Chart showing volume accumulation
const chartData = computed(() => {
  if (volumes.value.length === 0) return null

  const labels = volumes.value.map(v => {
    const date = new Date(v.date)
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  })

  return {
    labels,
    datasets: [
      {
        label: 'Total Volume (kg × reps)',
        data: volumes.value.map(v => v.total_volume),
        borderColor: '#10b981',
        backgroundColor: 'rgba(16, 185, 129, 0.3)',
        borderWidth: 3,
        tension: 0.4,
        fill: true,
        pointRadius: 4,
        pointBackgroundColor: '#10b981',
        pointBorderColor: '#fff',
        pointBorderWidth: 2
      }
    ]
  }
})

const chartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      display: false
    },
    tooltip: {
      backgroundColor: 'rgba(17, 24, 39, 0.95)',
      titleFont: { size: 13 },
      bodyFont: { size: 12 },
      padding: 14,
      cornerRadius: 8,
      callbacks: {
        title: (contexts: any) => {
          return `📅 ${contexts[0].label}`
        },
        label: (context: any) => {
          const idx = context.dataIndex
          const vol = volumes.value[idx]
          if (!vol) return []
          return [
            `💪 Volume: ${Math.round(vol.total_volume).toLocaleString()} kg`,
            `📊 Sets: ${vol.total_sets}`,
            `🔁 Reps: ${vol.total_reps}`,
            `🏋️ Exercises: ${vol.exercise_count}`
          ]
        }
      }
    }
  },
  scales: {
    y: {
      beginAtZero: true,
      title: {
        display: true,
        text: 'Volume (kg × reps)',
        font: { size: 11, weight: 'bold' as const },
        color: '#10b981'
      },
      grid: {
        color: 'rgba(156, 163, 175, 0.2)'
      },
      ticks: {
        callback: (value: string | number) => `${(Number(value) / 1000).toFixed(1)}k`
      }
    },
    x: {
      grid: {
        display: false
      }
    }
  }
}

// Calculate total XP
const totalXP = computed(() => {
  return volumes.value.reduce((sum, v) => sum + v.total_volume, 0)
})

// Calculate trend
const trend = computed(() => {
  if (volumes.value.length < 2) return null
  
  const recent = volumes.value.slice(-3)
  const earlier = volumes.value.slice(0, 3)
  
  const recentAvg = recent.reduce((s, v) => s + v.total_volume, 0) / recent.length
  const earlierAvg = earlier.reduce((s, v) => s + v.total_volume, 0) / earlier.length
  
  const change = ((recentAvg - earlierAvg) / earlierAvg) * 100
  
  return {
    percentage: Math.abs(change).toFixed(0),
    direction: change > 0 ? 'up' : change < 0 ? 'down' : 'stable'
  }
})
</script>

<template>
  <UCard v-if="!isLoading && volumes.length > 0">
    <template #header>
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-2">
          <span class="text-xl">⛰️</span>
          <h2 class="font-semibold">XP Mountain</h2>
          <span class="text-xs text-gray-400">Strength Volume Over Time</span>
        </div>
        
        <!-- XP Badge -->
        <div class="flex items-center gap-3">
          <div v-if="trend && trend.direction !== 'stable'" 
               class="flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium"
               :class="trend.direction === 'up' 
                 ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
                 : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'"
          >
            <span>{{ trend.direction === 'up' ? '📈' : '📉' }}</span>
            <span>{{ trend.percentage }}%</span>
          </div>
          <div class="bg-gradient-to-r from-emerald-500 to-teal-500 px-3 py-1.5 rounded-full">
            <span class="text-white font-bold text-sm">{{ Math.round(totalXP / 1000) }}k XP</span>
          </div>
        </div>
      </div>
    </template>

    <div class="h-64">
      <Line v-if="chartData" :data="chartData" :options="chartOptions" />
    </div>

    <div class="flex items-center justify-center gap-6 mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
      <div class="text-center">
        <p class="text-2xl font-bold text-emerald-600">{{ volumes.length }}</p>
        <p class="text-xs text-gray-500">Workouts</p>
      </div>
      <div class="text-center">
        <p class="text-2xl font-bold text-blue-600">{{ volumes.reduce((s, v) => s + v.total_sets, 0) }}</p>
        <p class="text-xs text-gray-500">Total Sets</p>
      </div>
      <div class="text-center">
        <p class="text-2xl font-bold text-purple-600">{{ Math.round(totalXP).toLocaleString() }}</p>
        <p class="text-xs text-gray-500">Total Volume (kg)</p>
      </div>
    </div>
  </UCard>

  <!-- Loading state -->
  <UCard v-else-if="isLoading">
    <div class="h-64 flex items-center justify-center">
      <div class="animate-pulse text-gray-400">Loading volume history...</div>
    </div>
  </UCard>

  <!-- Empty state -->
  <UCard v-else>
    <div class="h-48 flex flex-col items-center justify-center text-gray-400">
      <span class="text-4xl mb-2">⛰️</span>
      <p class="font-medium">No workout data yet</p>
      <p class="text-sm">Complete workouts to build your XP Mountain!</p>
    </div>
  </UCard>
</template>
