<script setup lang="ts">
/**
 * SessionSmashTemplate - "The Session Smash"
 * Instagram Story template (1080x1920) for completed workouts
 */

const props = defineProps<{
  memberName: string
  focusArea: string
  setsCompleted: number
  exerciseCount: number
  newPRs: number
  motivationQuote?: string
}>()

// Default motivation quotes
const defaultQuotes = [
  'Consistency beats intensity.',
  'Another day, another victory.',
  'Building strength, one rep at a time.',
  'Progress over perfection.',
  'Champions train, losers complain.'
]

const quote = computed(() => props.motivationQuote || defaultQuotes[Math.floor(Math.random() * defaultQuotes.length)])
</script>

<template>
  <!-- Fixed 1080x1920 container (scaled for preview) -->
  <div 
    class="bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white flex flex-col items-center justify-between p-16 font-sans"
    style="width: 1080px; height: 1920px; font-family: 'Inter', system-ui, sans-serif;"
  >
    <!-- Header: Trophy Icon -->
    <div class="flex flex-col items-center pt-24">
      <div class="w-48 h-48 rounded-full bg-gradient-to-br from-green-400 to-emerald-600 flex items-center justify-center shadow-2xl shadow-green-500/30">
        <svg class="w-28 h-28 text-white" fill="currentColor" viewBox="0 0 24 24">
          <path d="M5 3h14a2 2 0 0 1 2 2v2a5 5 0 0 1-5 5h-1.5a5.5 5.5 0 0 1-5 5.5V20h2a1 1 0 1 1 0 2H7a1 1 0 1 1 0-2h2v-2.5a5.5 5.5 0 0 1-5-5.5H5a5 5 0 0 1-5-5V5a2 2 0 0 1 2-2zm0 2v2a3 3 0 0 0 3 3h1V5H5zm14 0h-4v5h1a3 3 0 0 0 3-3V5z"/>
        </svg>
      </div>
      
      <!-- Title -->
      <h1 class="text-8xl font-black mt-16 tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-emerald-300">
        Session Crushed!
      </h1>
      
      <!-- Subtext -->
      <p class="text-4xl text-slate-400 mt-6 font-medium">
        {{ memberName }} <span class="text-slate-600">•</span> {{ focusArea }}
      </p>
    </div>
    
    <!-- Stats Grid -->
    <div class="grid grid-cols-3 gap-8 w-full max-w-4xl">
      <!-- Sets Done -->
      <div class="bg-slate-800/60 backdrop-blur rounded-3xl p-10 text-center border border-slate-700/50">
        <p class="text-7xl font-black text-white">{{ setsCompleted }}</p>
        <p class="text-2xl text-slate-400 mt-3 uppercase tracking-wider font-semibold">Sets Done</p>
      </div>
      
      <!-- Exercises -->
      <div class="bg-slate-800/60 backdrop-blur rounded-3xl p-10 text-center border border-slate-700/50">
        <p class="text-7xl font-black text-white">{{ exerciseCount }}</p>
        <p class="text-2xl text-slate-400 mt-3 uppercase tracking-wider font-semibold">Exercises</p>
      </div>
      
      <!-- New PRs -->
      <div class="bg-gradient-to-br from-green-500/20 to-emerald-500/20 backdrop-blur rounded-3xl p-10 text-center border border-green-500/30">
        <p class="text-7xl font-black text-green-400">{{ newPRs }}</p>
        <p class="text-2xl text-green-300/80 mt-3 uppercase tracking-wider font-semibold">New PRs</p>
      </div>
    </div>
    
    <!-- Footer -->
    <div class="flex flex-col items-center pb-16 w-full">
      <!-- Motivation Quote -->
      <div class="bg-slate-800/40 backdrop-blur-sm rounded-2xl px-12 py-8 mb-12 max-w-3xl border border-slate-700/30">
        <p class="text-3xl text-slate-300 text-center italic font-light">
          "{{ quote }}"
        </p>
      </div>
      
      <!-- Logo -->
      <div class="flex items-center gap-4">
        <div class="w-14 h-14 rounded-xl bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center">
          <span class="text-3xl font-black text-white">M</span>
        </div>
        <span class="text-3xl font-bold text-slate-400">Metamorph Coach</span>
      </div>
    </div>
  </div>
</template>
