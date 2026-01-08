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

// Register Chart.js components
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

interface Scan {
  test_date_time: string
  weight: number
  smm: number
  pbf: number
}

const props = defineProps<{
  scans: Scan[]
}>()

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
</script>

<template>
  <div>
    <!-- Line Chart - Body Composition Trends -->
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

    <!-- No data state -->
    <div v-if="scans.length === 0" class="text-center py-8 text-gray-500">
      <UIcon name="i-heroicons-chart-bar" class="w-12 h-12 mx-auto opacity-30 mb-3" />
      <p>No scan data available for trends</p>
    </div>
  </div>
</template>
