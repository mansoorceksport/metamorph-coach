<script setup lang="ts">
// Mock Data for "Today's Schedule"
const todaysSessions = [
  {
    id: 's1',
    time: '09:00 AM',
    clientName: 'Sarah Jenkins',
    type: 'Hypertrophy Focus',
    status: 'upcoming'
  },
  {
    id: 's2',
    time: '14:00 PM',
    clientName: 'Mike Ross',
    type: 'Metabolic Conditioning',
    status: 'upcoming'
  },
  {
    id: 's3',
    time: '16:30 PM',
    clientName: 'Jessica Pearson',
    type: 'Recovery & Mobility',
    status: 'upcoming'
  }
]

// Mock Data for Analytics
const risingStars = [
  { id: 'rs1', name: 'Alex Wong', trend: 'up', metric: '-2.1% Body Fat' },
  { id: 'rs2', name: 'Maria Garcia', trend: 'up', metric: '+1.5kg Muscle' },
  { id: 'rs3', name: 'David Smith', trend: 'up', metric: 'PB Squat' },
  { id: 'rs4', name: 'Linda Chen', trend: 'up', metric: 'Perfect Form' },
  { id: 'rs5', name: 'Tom Baker', trend: 'up', metric: 'Consistency' }
]

const consistentMembers = [
  { id: 'cm1', name: 'John D.', streak: '24 Days' },
  { id: 'cm2', name: 'Sarah M.', streak: '18 Days' },
  { id: 'cm3', name: 'Mike T.', streak: '15 Days' },
  { id: 'cm4', name: 'Emily R.', streak: '14 Days' },
  { id: 'cm5', name: 'Chris P.', streak: '12 Days' }
]

const interventionNeeded = [
  { id: 'in1', name: 'Gary Oldman', issue: 'Stalled Progress', trend: 'down' },
  { id: 'in2', name: 'Uma Thurman', issue: 'Skipped 3 Sessions', trend: 'down' },
  { id: 'in3', name: 'Samuel L.', issue: 'Fatigue Signs', trend: 'down' },
  { id: 'in4', name: 'Bruce W.', issue: 'Injury Risk', trend: 'down' },
  { id: 'in5', name: 'Tony S.', issue: 'Diet Adherence', trend: 'down' }
]
</script>

<template>
  <div class="space-y-8">
    <!-- Header Section with Action -->
    <div class="flex items-center justify-between">
      <h1 class="text-3xl font-bold text-gray-900 dark:text-white">Command Center</h1>
      <UButton
        label="+ New Session"
        color="primary"
        size="lg"
        icon="i-heroicons-plus"
      />
    </div>

    <!-- Today's Schedule -->
    <section>
      <h2 class="text-xl font-semibold mb-4 text-gray-700 dark:text-gray-200">Today's Schedule</h2>
      <div class="grid gap-6 md:grid-cols-3">
        <UCard v-for="session in todaysSessions" :key="session.id" class="border-l-4 border-l-primary-500 hover:shadow-lg transition-shadow">
          <template #header>
            <div class="flex justify-between items-start">
              <div>
                <p class="text-2xl font-bold text-primary-600 dark:text-primary-400">{{ session.time }}</p>
                <p class="font-medium text-lg mt-1">{{ session.clientName }}</p>
              </div>
              <UIcon name="i-heroicons-calendar" class="w-6 h-6 text-gray-400" />
            </div>
          </template>
          <div class="text-sm text-gray-600 dark:text-gray-400">
            {{ session.type }}
          </div>
          <template #footer>
             <UButton
              variant="soft"
              color="primary"
              block
              label="Start Session"
              icon="i-heroicons-play-circle"
            />
          </template>
        </UCard>
      </div>
    </section>

    <!-- Analytics Grid -->
    <section>
       <h2 class="text-xl font-semibold mb-4 text-gray-700 dark:text-gray-200">Member Analytics</h2>
       <div class="grid gap-6 md:grid-cols-3">
         
         <!-- Rising Stars -->
         <UCard>
           <template #header>
             <div class="flex items-center gap-2">
               <UIcon name="i-heroicons-sparkles" class="w-5 h-5 text-yellow-500" />
               <h3 class="font-semibold">Rising Stars</h3>
             </div>
           </template>
           <ul class="space-y-3">
             <li v-for="member in risingStars" :key="member.id" class="flex items-center justify-between">
               <div class="flex items-center gap-3">
                 <UAvatar :alt="member.name" size="sm" />
                 <span class="text-sm font-medium">{{ member.name }}</span>
               </div>
               <div class="flex items-center gap-1 text-xs text-green-500">
                 <span>{{ member.metric }}</span>
                 <UIcon name="i-heroicons-arrow-trending-up" class="w-4 h-4" />
               </div>
             </li>
           </ul>
         </UCard>

         <!-- Consistent -->
         <UCard>
           <template #header>
             <div class="flex items-center gap-2">
               <UIcon name="i-heroicons-check-badge" class="w-5 h-5 text-green-500" />
               <h3 class="font-semibold">Consistent (100%)</h3>
             </div>
           </template>
            <ul class="space-y-3">
             <li v-for="member in consistentMembers" :key="member.id" class="flex items-center justify-between">
               <div class="flex items-center gap-3">
                 <UAvatar :alt="member.name" size="sm" />
                 <span class="text-sm font-medium">{{ member.name }}</span>
               </div>
               <span class="text-xs font-bold text-primary-600 dark:text-primary-400">{{ member.streak }}</span>
             </li>
           </ul>
         </UCard>

         <!-- Intervention Needed -->
         <UCard>
           <template #header>
             <div class="flex items-center gap-2">
               <UIcon name="i-heroicons-exclamation-triangle" class="w-5 h-5 text-red-500" />
               <h3 class="font-semibold">Intervention Needed</h3>
             </div>
           </template>
            <ul class="space-y-3">
             <li v-for="member in interventionNeeded" :key="member.id" class="flex items-center justify-between">
               <div class="flex items-center gap-3">
                 <UAvatar :alt="member.name" size="sm" />
                 <span class="text-sm font-medium">{{ member.name }}</span>
               </div>
               <div class="flex items-center gap-1 text-xs text-red-500">
                 <span>{{ member.issue }}</span>
                 <UIcon name="i-heroicons-arrow-trending-down" class="w-4 h-4" />
               </div>
             </li>
           </ul>
         </UCard>

       </div>
    </section>
  </div>
</template>
