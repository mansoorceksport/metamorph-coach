<script setup lang="ts">
import { Line } from 'vue-chartjs'
import {
  Chart as ChartJS,
  LineElement,
  PointElement,
  LinearScale,
  CategoryScale,
  Filler
} from 'chart.js'

ChartJS.register(LineElement, PointElement, LinearScale, CategoryScale, Filler)

interface SegmentData {
  mass: number
  percentage: number
}

interface SegmentalData {
  left_arm: SegmentData
  right_arm: SegmentData
  trunk: SegmentData
  left_leg: SegmentData
  right_leg: SegmentData
}

interface Scan {
  test_date_time: string
  segmental_lean?: SegmentalData
  segmental_fat?: SegmentalData
}

const props = defineProps<{
  scans: Scan[]
  type: 'lean' | 'fat'
}>()

// Get last 5 scans sorted by date (oldest first for proper trend)
const recentScans = computed(() => {
  return [...props.scans]
    .sort((a, b) => new Date(a.test_date_time).getTime() - new Date(b.test_date_time).getTime())
    .slice(-5)
})

// Body segment configuration
const segments = [
  { key: 'left_arm', label: 'Left Arm', icon: '💪' },
  { key: 'right_arm', label: 'Right Arm', icon: '💪' },
  { key: 'trunk', label: 'Trunk', icon: '🎯' },
  { key: 'left_leg', label: 'Left Leg', icon: '🦵' },
  { key: 'right_leg', label: 'Right Leg', icon: '🦵' }
] as const

// Helper to get segment data
function getSegmentData(scan: Scan, segmentKey: string): SegmentData | null {
  const data = props.type === 'lean' ? scan.segmental_lean : scan.segmental_fat
  if (!data) return null
  return (data as any)[segmentKey] || null
}

// Get sparkline data for a segment
function getSparklineData(segmentKey: string) {
  const masses = recentScans.value.map(scan => {
    const segment = getSegmentData(scan, segmentKey)
    return segment?.mass || 0
  }).filter(m => m > 0)

  if (masses.length < 2) return null

  const first = masses[0] || 0
  const last = masses[masses.length - 1] || 0
  const change = last - first
  const trend = change > 0.1 ? 'up' : change < -0.1 ? 'down' : 'stable'

  return {
    masses,
    first,
    last,
    change,
    trend
  }
}

// Get percentage trend
function getPercentageTrend(segmentKey: string) {
  const pcts = recentScans.value.map(scan => {
    const segment = getSegmentData(scan, segmentKey)
    return segment?.percentage || 0
  }).filter(p => p > 0)

  if (pcts.length < 2) return null

  const first = pcts[0] || 0
  const last = pcts[pcts.length - 1] || 0
  
  return {
    first,
    last,
    change: last - first
  }
}

// Sparkline chart options (minimal, no axes)
const sparklineOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { display: false },
    tooltip: { enabled: false }
  },
  scales: {
    x: { display: false },
    y: { display: false }
  },
  elements: {
    point: { radius: 0 },
    line: { tension: 0.4 }
  }
}

// Build chart data for a segment
function buildChartData(segmentKey: string) {
  const data = getSparklineData(segmentKey)
  if (!data) return null

  const color = props.type === 'lean' ? '#10b981' : '#f97316'
  const bgColor = props.type === 'lean' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(249, 115, 22, 0.2)'

  return {
    labels: data.masses.map((_, i) => i.toString()),
    datasets: [{
      data: data.masses,
      borderColor: color,
      backgroundColor: bgColor,
      borderWidth: 2,
      fill: true
    }]
  }
}
</script>

<template>
  <UCard>
    <template #header>
      <div class="flex items-center gap-2">
        <span v-if="type === 'lean'" class="w-3 h-3 rounded-full bg-emerald-500" />
        <span v-else class="w-3 h-3 rounded-full bg-orange-500" />
        <h3 class="font-semibold text-sm">
          Segmental {{ type === 'lean' ? 'Muscle' : 'Fat' }} Trends
        </h3>
        <span class="text-xs text-gray-400">(last 5 scans)</span>
      </div>
    </template>

    <div class="grid grid-cols-5 gap-3">
      <div 
        v-for="segment in segments" 
        :key="segment.key"
        class="flex flex-col items-center p-2 rounded-lg bg-gray-50 dark:bg-slate-800"
      >
        <!-- Segment Label -->
        <div class="text-center mb-2">
          <span class="text-lg">{{ segment.icon }}</span>
          <p class="text-xs font-medium text-gray-600 dark:text-gray-400">{{ segment.label }}</p>
        </div>

        <!-- Sparkline -->
        <div 
          v-if="buildChartData(segment.key)" 
          class="w-full h-10"
        >
          <Line 
            :data="buildChartData(segment.key)!" 
            :options="sparklineOptions" 
          />
        </div>
        <div v-else class="w-full h-10 flex items-center justify-center">
          <span class="text-xs text-gray-400">--</span>
        </div>

        <!-- Mass & Change -->
        <div v-if="getSparklineData(segment.key)" class="mt-2 text-center">
          <p class="text-sm font-bold" :class="type === 'lean' ? 'text-emerald-600' : 'text-orange-600'">
            {{ getSparklineData(segment.key)!.last.toFixed(1) }} kg
          </p>
          <p 
            class="text-xs font-medium"
            :class="{
              'text-emerald-500': type === 'lean' ? getSparklineData(segment.key)!.change > 0 : getSparklineData(segment.key)!.change < 0,
              'text-red-500': type === 'lean' ? getSparklineData(segment.key)!.change < 0 : getSparklineData(segment.key)!.change > 0,
              'text-gray-400': Math.abs(getSparklineData(segment.key)!.change) < 0.1
            }"
          >
            {{ getSparklineData(segment.key)!.change > 0 ? '+' : '' }}{{ getSparklineData(segment.key)!.change.toFixed(1) }} kg
          </p>
        </div>

        <!-- Percentage -->
        <div v-if="getPercentageTrend(segment.key)" class="mt-1">
          <p 
            class="text-xs"
            :class="{
              'text-emerald-500': getPercentageTrend(segment.key)!.change > 0 && type === 'lean',
              'text-red-500': getPercentageTrend(segment.key)!.change > 0 && type === 'fat',
              'text-gray-400': Math.abs(getPercentageTrend(segment.key)!.change) < 1
            }"
          >
            {{ getPercentageTrend(segment.key)!.last.toFixed(0) }}%
          </p>
        </div>
      </div>
    </div>
  </UCard>
</template>
