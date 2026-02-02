<script setup lang="ts">
/**
 * ScanUpdateTemplate - "The Scan Update"
 * Instagram Story template (1080x1920) for InBody scan results
 */

const props = defineProps<{
  weight: number
  smm: number
  bodyFat: number
  bmi: number
  memberName?: string
}>()
</script>

<template>
  <!-- Fixed 1080x1920 container -->
  <div 
    class="bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white flex flex-col items-center justify-between p-16 font-sans"
    style="width: 1080px; height: 1920px; font-family: 'Inter', system-ui, sans-serif;"
  >
    <!-- Header -->
    <div class="flex flex-col items-center pt-32">
      <div class="w-32 h-32 rounded-full bg-gradient-to-br from-blue-400 to-indigo-600 flex items-center justify-center shadow-2xl shadow-blue-500/30">
        <svg class="w-20 h-20 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/>
        </svg>
      </div>
      
      <h1 class="text-7xl font-black mt-12 tracking-tight text-white">
        Progress Check
      </h1>
      
      <p v-if="memberName" class="text-3xl text-slate-400 mt-4 font-medium">
        {{ memberName }}
      </p>
    </div>
    
    <!-- 2x2 Stats Grid -->
    <div class="grid grid-cols-2 gap-10 w-full max-w-4xl px-8">
      <!-- Weight Card -->
      <div class="bg-gradient-to-br from-blue-500 to-blue-600 rounded-[40px] p-12 text-center shadow-2xl shadow-blue-500/30">
        <p class="text-3xl text-blue-100 uppercase tracking-wider font-semibold mb-4">Weight</p>
        <p class="text-9xl font-black text-white">{{ weight.toFixed(1) }}</p>
        <p class="text-4xl text-blue-200 mt-2 font-medium">kg</p>
      </div>
      
      <!-- SMM Card -->
      <div class="bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-[40px] p-12 text-center shadow-2xl shadow-emerald-500/30">
        <p class="text-3xl text-emerald-100 uppercase tracking-wider font-semibold mb-4">Muscle Mass</p>
        <p class="text-9xl font-black text-white">{{ smm.toFixed(1) }}</p>
        <p class="text-4xl text-emerald-200 mt-2 font-medium">kg</p>
      </div>
      
      <!-- Body Fat Card -->
      <div class="bg-gradient-to-br from-orange-500 to-orange-600 rounded-[40px] p-12 text-center shadow-2xl shadow-orange-500/30">
        <p class="text-3xl text-orange-100 uppercase tracking-wider font-semibold mb-4">Body Fat</p>
        <p class="text-9xl font-black text-white">{{ bodyFat.toFixed(1) }}</p>
        <p class="text-4xl text-orange-200 mt-2 font-medium">%</p>
      </div>
      
      <!-- BMI Card -->
      <div class="bg-gradient-to-br from-purple-500 to-purple-600 rounded-[40px] p-12 text-center shadow-2xl shadow-purple-500/30">
        <p class="text-3xl text-purple-100 uppercase tracking-wider font-semibold mb-4">BMI</p>
        <p class="text-9xl font-black text-white">{{ bmi.toFixed(1) }}</p>
        <p class="text-4xl text-purple-200 mt-2 font-medium">kg/m²</p>
      </div>
    </div>
    
    <!-- Footer -->
    <div class="flex flex-col items-center pb-20">
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
