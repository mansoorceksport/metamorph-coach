<script setup lang="ts">
import { db } from '~/utils/db'
import { liveQuery } from 'dexie'

// Load schedules from IndexedDB
const todaysSessions = ref<Array<{
  id: string
  time: string
  clientName: string
  type: string
  status: string
}>>([])

const isLoadingSchedules = ref(true)

// Status priority for sorting (lower = higher priority)
const statusPriority: Record<string, number> = {
  'in-progress': 0,
  'scheduled': 1,
  'pending_confirmation': 2,
  'completed': 3,
  'cancelled': 4,
  'no-show': 5
}

function getStatusPriority(status: string): number {
  return statusPriority[status] ?? 99
}

// Use liveQuery for reactivity - schedules will update when data changes
onMounted(() => {
  if (!import.meta.client) return
  
  const today = new Date()
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  const endOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1)
  
  const subscription = liveQuery(async () => {
    return await db.schedules.toArray()
  }).subscribe({
    next: (allSchedules) => {
      // Filter to only today's schedules
      const todaysSchedules = allSchedules.filter(schedule => {
        const scheduleDate = new Date(schedule.start_time)
        return scheduleDate >= startOfToday && scheduleDate < endOfToday
      })
      
      // Sort by status priority (in-progress > scheduled > completed)
      todaysSchedules.sort((a, b) => getStatusPriority(a.status) - getStatusPriority(b.status))
      
      // Transform to display format
      todaysSessions.value = todaysSchedules.map(schedule => ({
        id: schedule.id,
        time: new Date(schedule.start_time).toLocaleTimeString('en-US', { 
          hour: '2-digit', 
          minute: '2-digit',
          hour12: true 
        }),
        clientName: schedule.member_name,
        type: schedule.session_goal || 'Training Session',
        status: schedule.status
      }))
      
      console.log(`[CommandCenter] Found ${todaysSchedules.length} sessions for today (${startOfToday.toDateString()})`)
      isLoadingSchedules.value = false
    },
    error: (error) => {
      console.error('[CommandCenter] Failed to load schedules:', error)
      isLoadingSchedules.value = false
    }
  })
  
  // Cleanup on unmount
  onUnmounted(() => {
    subscription.unsubscribe()
  })
})

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

const churnRisk = [
  { id: 'cr1', name: 'Sarah Connor', drop: '-35% vs Avg', lastSeen: '3 days ago' },
  { id: 'cr2', name: 'Kyle Reese', drop: '-28% vs Avg', lastSeen: '5 days ago' },
  { id: 'cr3', name: 'Ellen Ripley', drop: '-40% vs Avg', lastSeen: '1 week ago' },
  { id: 'cr4', name: 'Dutch S.', drop: '-30% vs Avg', lastSeen: '4 days ago' },
  { id: 'cr5', name: 'John Rambo', drop: '-26% vs Avg', lastSeen: '6 days ago' }
]

const packageHealth = [
  { id: 'ph1', name: 'Rocky Balboa', sessions: 2, plan: '20 Pack' },
  { id: 'ph2', name: 'Apollo Creed', sessions: 1, plan: '10 Pack' },
  { id: 'ph3', name: 'Ivan Drago', sessions: 2, plan: 'Monthly' },
  { id: 'ph4', name: 'Clubber Lang', sessions: 0, plan: '10 Pack' },
  { id: 'ph5', name: 'Adonis Creed', sessions: 3, plan: '20 Pack' }
]

const strengthWins = [
  { id: 'sw1', name: 'Alex Wong', exercise: 'Deadlift', newWeight: '140kg', delta: '5kg' },
  { id: 'sw2', name: 'Maria Garcia', exercise: 'Bench Press', newWeight: '55kg', delta: '2.5kg' },
  { id: 'sw3', name: 'David Smith', exercise: 'Back Squat', newWeight: '120kg', delta: '5kg' },
  { id: 'sw4', name: 'Sarah Jenkins', exercise: 'Hip Thrust', newWeight: '100kg', delta: '10kg' },
  { id: 'sw5', name: 'Emily R.', exercise: 'Pull Up', newWeight: 'BW+10kg', delta: '2.5kg' }
]

// Member type for analytics cards
interface AnalyticsMember {
  id: string
  name: string
  [key: string]: any
}

// Selection Logic
const selectedMember = ref<AnalyticsMember | null>(null)
const selectedCategory = ref('')
const isSlideoverOpen = ref(false)

function handleMemberSelect(member: AnalyticsMember, category: string) {
  selectedMember.value = member
  selectedCategory.value = category
  isSlideoverOpen.value = true
}

function getStatusColor(category: string): 'success' | 'info' | 'primary' | 'warning' | 'error' | 'neutral' | 'secondary' {
  if (category === 'Rising Stars') return 'warning'
  if (category === 'Consistent') return 'success'
  if (category === 'Intervention Needed') return 'error'
  if (category === 'Churn Risk') return 'error'
  if (category === 'Package Health') return 'warning'
  if (category === 'Strength Wins') return 'info'
  return 'primary'
}

// Mock Data for Contextual Insights (Strength Wins)
const mockRecentPRs = [
    { exercise: 'Deadlift', weight: '140kg', delta: '+5kg' },
    { exercise: 'Front Squat', weight: '110kg', delta: '+2.5kg' },
    { exercise: 'Overhead Press', weight: '60kg', delta: '+1kg' }
]
</script>

<template>
  <div>
    <div class="space-y-8">
    <!-- Header Section with Action -->
    <div class="flex items-center justify-between">
      <h1 class="text-3xl font-bold text-gray-900 dark:text-white">Command Center</h1>
      <UButton
        label="+ New Session"
        color="primary"
        size="lg"
        icon="i-heroicons-plus"
        @click="$router.push('/schedule?new=1')"
      />
    </div>

    <!-- Today's Schedule -->
    <section>
      <h2 class="text-xl font-semibold mb-4 text-gray-700 dark:text-gray-200">Today's Schedule</h2>
      
      <!-- Loading State -->
      <div v-if="isLoadingSchedules" class="grid gap-6 md:grid-cols-3">
        <UCard v-for="i in 3" :key="i" class="animate-pulse">
          <div class="h-6 bg-gray-200 dark:bg-gray-700 rounded w-24 mb-2"></div>
          <div class="h-4 bg-gray-200 dark:bg-gray-700 rounded w-32 mb-4"></div>
          <div class="h-3 bg-gray-200 dark:bg-gray-700 rounded w-48"></div>
        </UCard>
      </div>
      
      <!-- Empty State -->
      <div v-else-if="todaysSessions.length === 0" class="text-center py-12 bg-gray-50 dark:bg-gray-900/50 rounded-xl border-2 border-dashed border-gray-200 dark:border-gray-700">
        <UIcon name="i-heroicons-calendar-days" class="w-16 h-16 mx-auto text-gray-300 dark:text-gray-600 mb-4" />
        <h3 class="text-lg font-semibold text-gray-600 dark:text-gray-400 mb-2">No Sessions Today</h3>
        <p class="text-sm text-gray-500 dark:text-gray-500 mb-4">You have no training sessions scheduled for today.</p>
        <UButton
          label="Schedule Session"
          color="primary"
          variant="soft"
          icon="i-heroicons-plus"
          @click="$router.push('/schedule?new=1')"
        />
      </div>
      
      <!-- Sessions Grid -->
      <div v-else class="grid gap-6 md:grid-cols-3">
        <NuxtLink 
          v-for="session in todaysSessions" 
          :key="session.id"
          :to="`/sessions/${session.id}`"
          class="block"
        >
          <UCard 
            :class="[
              'border-l-4 hover:shadow-lg transition-all cursor-pointer hover:scale-[1.02]',
              session.status === 'completed' 
                ? 'border-l-green-500 bg-green-50/50 dark:bg-green-900/10' 
                : session.status === 'in-progress'
                  ? 'border-l-blue-500 bg-blue-50/50 dark:bg-blue-900/10'
                  : 'border-l-primary-500'
            ]"
          >
            <template #header>
              <div class="flex justify-between items-start">
                <div>
                  <p :class="[
                    'text-2xl font-bold',
                    session.status === 'completed' 
                      ? 'text-green-600 dark:text-green-400' 
                      : session.status === 'in-progress'
                        ? 'text-blue-600 dark:text-blue-400'
                        : 'text-primary-600 dark:text-primary-400'
                  ]">{{ session.time }}</p>
                  <p class="font-medium text-lg mt-1">{{ session.clientName }}</p>
                </div>
                <UIcon 
                  :name="session.status === 'completed' 
                    ? 'i-heroicons-check-circle-solid' 
                    : session.status === 'in-progress'
                      ? 'i-heroicons-play-circle-solid'
                      : 'i-heroicons-calendar'" 
                  :class="[
                    'w-6 h-6',
                    session.status === 'completed' ? 'text-green-500' : 
                    session.status === 'in-progress' ? 'text-blue-500' : 'text-gray-400'
                  ]" 
                />
              </div>
            </template>
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2">
                <span class="text-sm text-gray-600 dark:text-gray-400">{{ session.type }}</span>
                <UBadge 
                  v-if="session.status === 'completed'" 
                  color="success" 
                  variant="subtle" 
                  size="xs"
                  label="Completed"
                />
                <UBadge 
                  v-else-if="session.status === 'in-progress'" 
                  color="info" 
                  variant="subtle" 
                  size="xs"
                  label="In Progress"
                />
              </div>
              <UIcon 
                name="i-heroicons-chevron-right" 
                class="w-5 h-5 text-gray-400" 
              />
            </div>
          </UCard>
        </NuxtLink>
      </div>
    </section>

    <!-- Analytics Grid -->
    <section>
       <h2 class="text-xl font-semibold mb-4 text-gray-700 dark:text-gray-200">Member Analytics</h2>
       <div class="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
         
         <!-- Rising Stars -->
         <UCard>
            <template #header>
              <div>
                <div class="flex items-center gap-2">
                  <UIcon name="i-heroicons-sparkles" class="w-5 h-5 text-yellow-500" />
                  <h3 class="font-semibold">Rising Stars</h3>
                </div>
                <p class="text-xs text-slate-400 mt-1">Optimal Recomposition: Highest positive muscle gain and fat loss deltas.</p>
              </div>
            </template>
           <ul class="space-y-3">
             <li 
                v-for="member in risingStars" 
                :key="member.id" 
                class="flex items-center justify-between p-2 -mx-2 rounded-lg cursor-pointer transition-colors hover:bg-gray-50 dark:hover:bg-gray-800/50"
                :class="{ 'ring-2 ring-primary-500 bg-primary-50 dark:bg-primary-900/10': selectedMember?.id === member.id }"
                @click="handleMemberSelect(member, 'Rising Stars')"
             >
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
              <div>
                <div class="flex items-center gap-2">
                  <UIcon name="i-heroicons-check-badge" class="w-5 h-5 text-green-500" />
                  <h3 class="font-semibold">Consistent (100%)</h3>
                </div>
                <p class="text-xs text-slate-400 mt-1">High Diligence: Top attendance rate with zero missed sessions in 30 days.</p>
              </div>
            </template>
            <ul class="space-y-3">
             <li 
                v-for="member in consistentMembers" 
                :key="member.id" 
                class="flex items-center justify-between p-2 -mx-2 rounded-lg cursor-pointer transition-colors hover:bg-gray-50 dark:hover:bg-gray-800/50"
                :class="{ 'ring-2 ring-primary-500 bg-primary-50 dark:bg-primary-900/10': selectedMember?.id === member.id }"
                @click="handleMemberSelect(member, 'Consistent')"
             >
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
              <div>
                <div class="flex items-center gap-2">
                  <UIcon name="i-heroicons-exclamation-triangle" class="w-5 h-5 text-red-500" />
                  <h3 class="font-semibold">Intervention Needed</h3>
                </div>
                <p class="text-xs text-slate-400 mt-1">Stalled Progress: High attendance but regressed or plateaued physical metrics.</p>
              </div>
            </template>
            <ul class="space-y-3">
             <li 
                v-for="member in interventionNeeded" 
                :key="member.id" 
                class="flex items-center justify-between p-2 -mx-2 rounded-lg cursor-pointer transition-colors hover:bg-gray-50 dark:hover:bg-gray-800/50"
                :class="{ 'ring-2 ring-primary-500 bg-primary-50 dark:bg-primary-900/10': selectedMember?.id === member.id }"
                @click="handleMemberSelect(member, 'Intervention Needed')"
             >
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

         <!-- Churn Risk -->
         <UCard>
           <template #header>
             <div>
               <div class="flex items-center gap-2">
                 <UIcon name="i-heroicons-bell-alert" class="w-5 h-5 text-red-400" />
                 <h3 class="font-semibold">Churn Risk</h3>
               </div>
               <p class="text-xs text-slate-400 mt-1">Frequency Drift: Attendance dropped by >25% vs. their 30-day trailing average.</p>
             </div>
           </template>
            <ul class="space-y-3">
             <li 
                v-for="member in churnRisk" 
                :key="member.id" 
                class="flex items-center justify-between p-2 -mx-2 rounded-lg cursor-pointer transition-colors hover:bg-gray-50 dark:hover:bg-gray-800/50"
                :class="{ 'ring-2 ring-primary-500 bg-primary-50 dark:bg-primary-900/10': selectedMember?.id === member.id }"
                @click="handleMemberSelect(member, 'Churn Risk')"
             >
               <div class="flex items-center gap-3">
                 <UAvatar :alt="member.name" size="sm" />
                 <span class="text-sm font-medium">{{ member.name }}</span>
               </div>
               <div class="flex items-center gap-1 text-xs text-red-400">
                 <span>{{ member.drop }}</span>
                  <UTooltip :text="'Last seen: ' + member.lastSeen">
                    <UIcon name="i-heroicons-clock" class="w-4 h-4 cursor-help" />
                  </UTooltip>
               </div>
             </li>
           </ul>
         </UCard>

         <!-- Package Health -->
         <UCard>
           <template #header>
             <div>
               <div class="flex items-center gap-2">
                 <UIcon name="i-heroicons-clock" class="w-5 h-5 text-orange-400" />
                 <h3 class="font-semibold">Package Health</h3>
               </div>
               <p class="text-xs text-slate-400 mt-1">Renewal Window: Members with <3 sessions remaining but high attendance.</p>
             </div>
           </template>
            <ul class="space-y-3">
             <li 
                v-for="member in packageHealth" 
                :key="member.id" 
                class="flex items-center justify-between p-2 -mx-2 rounded-lg cursor-pointer transition-colors hover:bg-gray-50 dark:hover:bg-gray-800/50"
                :class="{ 'ring-2 ring-primary-500 bg-primary-50 dark:bg-primary-900/10': selectedMember?.id === member.id }"
                @click="handleMemberSelect(member, 'Package Health')"
              >
               <div class="flex items-center gap-3">
                 <UAvatar :alt="member.name" size="sm" />
                 <span class="text-sm font-medium">{{ member.name }}</span>
               </div>
               <div class="flex items-center gap-2">
                 <UBadge color="warning" variant="soft" size="xs">{{ member.sessions }} left</UBadge>
                 <span class="text-xs text-gray-500">{{ member.plan }}</span>
               </div>
             </li>
           </ul>
         </UCard>

         <!-- Strength Wins -->
         <UCard>
           <template #header>
             <div>
               <div class="flex items-center gap-2">
                 <UIcon name="i-heroicons-chart-bar" class="w-5 h-5 text-indigo-400" />
                 <h3 class="font-semibold">Strength Wins</h3>
               </div>
               <p class="text-xs text-slate-400 mt-1">Progressive Overload: Members who hit a Personal Record (PR) in the last 7 days.</p>
             </div>
           </template>
           <ul class="space-y-3">
             <li 
                v-for="member in strengthWins" 
                :key="member.id" 
                class="flex items-center justify-between p-2 -mx-2 rounded-lg cursor-pointer transition-colors hover:bg-gray-50 dark:hover:bg-gray-800/50"
                :class="{ 'ring-2 ring-primary-500 bg-primary-50 dark:bg-primary-900/10': selectedMember?.id === member.id }"
                @click="handleMemberSelect(member, 'Strength Wins')"
              >
               <div class="flex items-center gap-3">
                 <UAvatar :alt="member.name" size="sm" />
                 <div>
                    <span class="text-sm font-medium block">{{ member.name }}</span>
                    <span class="text-xs text-gray-500">{{ member.exercise }}</span>
                 </div>
               </div>
               <div class="flex items-center gap-2">
                 <div class="text-right">
                    <div class="text-xs font-bold text-indigo-400">{{ member.newWeight }} (+{{ member.delta }})</div>
                    <UBadge color="success" variant="subtle" size="xs" label="NEW PR" />
                 </div>
                 <UButton icon="i-heroicons-chat-bubble-left-ellipsis" color="neutral" variant="ghost" size="xs" />
               </div>
             </li>
           </ul>
         </UCard>

       </div>
    </section>
    </div>

    <!-- Member Detail Slideover -->
    <USlideover 
      v-model:open="isSlideoverOpen" 
      :title="selectedMember?.name"
      :ui="{ 
        body: 'bg-slate-50 dark:bg-slate-950 overflow-y-auto max-h-[calc(100vh-200px)]', 
        footer: 'bg-white dark:bg-slate-900 border-t border-gray-200 dark:border-gray-800' 
      }"
    >
      <template #header>
        <div class="flex items-center justify-between w-full">
          <div class="flex items-center gap-4">
            <UAvatar :alt="selectedMember?.name" size="lg" />
            <div>
              <h3 class="text-xl font-bold text-gray-900 dark:text-white">{{ selectedMember?.name }}</h3>
              <UBadge :color="getStatusColor(selectedCategory)" variant="subtle" class="mt-1">
                {{ selectedCategory }}
              </UBadge>
            </div>
          </div>
          <UButton
            icon="i-heroicons-x-mark"
            color="neutral"
            variant="ghost"
            size="lg"
            @click="isSlideoverOpen = false"
            aria-label="Close"
          />
        </div>
      </template>

      <template #body>
        <div class="space-y-6">
          <!-- Strength Wins Summary -->
          <div>
            <h4 class="text-sm font-semibold text-gray-500 mb-3 uppercase tracking-wider">Recent Strength Wins</h4>
            <div class="space-y-3">
              <div v-for="(pr, i) in mockRecentPRs" :key="i" class="flex items-center justify-between p-3 bg-white dark:bg-slate-900 rounded-lg border border-gray-200 dark:border-gray-800">
                <span class="text-sm font-medium">{{ pr.exercise }}</span>
                <span class="text-sm font-bold text-indigo-500">{{ pr.weight }} ({{ pr.delta }})</span>
              </div>
            </div>
          </div>

          <!-- Progress Sparkline (Mock) -->
          <div>
            <h4 class="text-sm font-semibold text-gray-500 mb-3 uppercase tracking-wider">Transformation Velocity</h4>
            <div class="p-4 bg-white dark:bg-slate-900 rounded-lg border border-gray-200 dark:border-gray-800">
              <div class="flex justify-between items-end mb-2">
                <div>
                  <span class="text-2xl font-bold text-gray-900 dark:text-white">+1.2%</span>
                  <span class="text-xs text-gray-500 ml-1">Muscle Mass</span>
                </div>
                <div class="text-right">
                  <span class="text-xl font-bold text-gray-900 dark:text-white">-0.8%</span>
                  <span class="text-xs text-gray-500 ml-1">Body Fat</span>
                </div>
              </div>
              <!-- Mock Sparkbar -->
              <div class="h-2 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden flex">
                <div class="h-full bg-indigo-500 w-3/5"></div>
                <div class="h-full bg-indigo-200 dark:bg-indigo-900 w-2/5"></div>
              </div>
              <p class="text-xs text-center text-gray-400 mt-2">Last 30 Days Trend</p>
            </div>
          </div>
        </div>
      </template>

      <template #footer>
        <div class="space-y-3 w-full">
          <UButton block label="Book Next Session" color="primary" variant="solid" />
          <UButton block label="Message Member" icon="i-heroicons-chat-bubble-left-right" color="neutral" variant="ghost" />
        </div>
      </template>
    </USlideover>
  </div>
</template>
