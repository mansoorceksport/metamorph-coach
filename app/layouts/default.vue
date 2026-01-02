<script setup lang="ts">
const { signOut } = useAuth()
const toast = useToast()
const { pendingSyncCount, isSyncing, isOnline } = useDatabase()

const navItems = [
  {
    label: 'Agenda',
    to: '/',
    icon: 'i-heroicons-calendar-days'
  },
  {
    label: 'Schedule',
    to: '/schedule',
    icon: 'i-heroicons-clock'
  },
  {
    label: 'Clients',
    to: '/clients',
    icon: 'i-heroicons-users'
  },
  {
    label: 'Library',
    to: '/library',
    icon: 'i-heroicons-book-open'
  }
]

const handleLogout = async () => {
  try {
    await signOut()
    await navigateTo('/login')
    toast.add({ 
      title: 'Logged out successfully', 
      color: 'success',
      icon: 'i-heroicons-check-circle'
    })
  } catch (error: any) {
    toast.add({ 
      title: 'Logout failed', 
      description: error.message, 
      color: 'error' 
    })
  }
}
</script>

<template>
  <div class="min-h-screen flex flex-col">
    <!-- Global Header -->
    <header class="border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950">
      <div class="flex items-center justify-between px-4 py-3">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 bg-slate-900 dark:bg-white rounded-full flex items-center justify-center shadow-lg">
            <svg 
              viewBox="0 0 100 100" 
              class="w-6 h-6" 
              fill="none" 
              xmlns="http://www.w3.org/2000/svg"
            >
              <path 
                d="M22 50C22 42 28 36 35 36C40 36 45 40 50 50C55 60 60 64 65 64C72 64 78 58 78 50C78 42 72 36 65 36C60 36 55 40 50 50C45 60 40 64 35 64C28 64 22 58 22 50Z" 
                stroke="currentColor" 
                class="text-white dark:text-slate-900"
                stroke-width="5" 
                stroke-linecap="round" 
                stroke-linejoin="round"
              />
            </svg>
          </div>
          <span class="text-xl font-light tracking-[0.15em] uppercase text-slate-900 dark:text-white">Metamorph</span>
        </div>
        <div class="flex items-center gap-3">
          <!-- Sync Status Indicator -->
          <div v-if="!isOnline" class="flex items-center gap-2 px-3 py-1.5 bg-yellow-100 dark:bg-yellow-900/30 rounded-full">
            <UIcon name="i-heroicons-wifi" class="w-4 h-4 text-yellow-600" />
            <span class="text-xs font-medium text-yellow-700 dark:text-yellow-400">Offline</span>
          </div>
          <div v-else-if="isSyncing" class="flex items-center gap-2 px-3 py-1.5 bg-blue-100 dark:bg-blue-900/30 rounded-full">
            <UIcon name="i-heroicons-arrow-path" class="w-4 h-4 text-blue-600 animate-spin" />
            <span class="text-xs font-medium text-blue-700 dark:text-blue-400">Syncing...</span>
          </div>
          <div v-else-if="pendingSyncCount > 0" class="flex items-center gap-2 px-3 py-1.5 bg-orange-100 dark:bg-orange-900/30 rounded-full">
            <UIcon name="i-heroicons-cloud-arrow-up" class="w-4 h-4 text-orange-600" />
            <span class="text-xs font-medium text-orange-700 dark:text-orange-400">{{ pendingSyncCount }} pending</span>
          </div>
          <UButton
            color="neutral"
            variant="ghost"
            label="Logout"
            icon="i-heroicons-arrow-right-on-rectangle"
            @click="handleLogout"
          />
        </div>
      </div>
    </header>

    <div class="flex flex-1 overflow-hidden">
      <!-- Desktop Sidebar Navigation -->
      <aside class="hidden lg:flex lg:flex-col w-64 border-r border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950">
        <nav class="p-6 flex-1 space-y-2">
          <NuxtLink
            v-for="item in navItems"
            :key="item.to"
            :to="item.to"
            class="flex items-center gap-4 px-4 py-3 rounded-xl text-base font-medium transition-all duration-200"
            :class="[
              $route.path === item.to 
                ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400' 
                : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800/50 hover:text-gray-900 dark:hover:text-white'
            ]"
          >
            <UIcon 
              :name="item.icon" 
              class="w-6 h-6 flex-shrink-0"
              :class="$route.path === item.to ? 'text-primary-500' : ''"
            />
            <span>{{ item.label }}</span>
          </NuxtLink>
        </nav>
        
        <!-- Sidebar Sync Status Footer -->
        <div v-if="pendingSyncCount > 0 || !isOnline" class="p-4 border-t border-gray-200 dark:border-gray-800">
          <div 
            class="flex items-center gap-3 p-3 rounded-lg"
            :class="!isOnline 
              ? 'bg-yellow-50 dark:bg-yellow-900/20' 
              : 'bg-orange-50 dark:bg-orange-900/20'"
          >
            <UIcon 
              :name="!isOnline ? 'i-heroicons-wifi' : 'i-heroicons-cloud-arrow-up'" 
              :class="!isOnline ? 'text-yellow-500' : 'text-orange-500'"
              class="w-5 h-5" 
            />
            <div>
              <p class="text-sm font-medium" :class="!isOnline ? 'text-yellow-700 dark:text-yellow-400' : 'text-orange-700 dark:text-orange-400'">
                {{ !isOnline ? 'Offline Mode' : `${pendingSyncCount} pending sync` }}
              </p>
              <p class="text-xs text-gray-500">
                {{ !isOnline ? 'Data saved locally' : "Will sync when online" }}
              </p>
            </div>
          </div>
        </div>
      </aside>

      <!-- Main Content Area -->
      <main class="flex-1 overflow-y-auto pb-20 lg:pb-0">
        <div class="container mx-auto p-4 lg:p-8">
          <slot />
        </div>
      </main>
    </div>

    <!-- Mobile Bottom Navigation -->
    <nav class="lg:hidden fixed bottom-0 left-0 right-0 border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950">
      <div class="flex items-center">
        <UNavigationMenu :items="navItems" orientation="horizontal" class="flex-1" />
        <!-- Mobile Sync Indicator -->
        <div v-if="pendingSyncCount > 0 || !isOnline" class="px-3 py-2">
          <div 
            class="w-8 h-8 rounded-full flex items-center justify-center"
            :class="!isOnline 
              ? 'bg-yellow-100 dark:bg-yellow-900/30' 
              : isSyncing 
                ? 'bg-blue-100 dark:bg-blue-900/30' 
                : 'bg-orange-100 dark:bg-orange-900/30'"
          >
            <UIcon 
              :name="!isOnline 
                ? 'i-heroicons-wifi' 
                : isSyncing 
                  ? 'i-heroicons-arrow-path' 
                  : 'i-heroicons-cloud-arrow-up'" 
              :class="[
                !isOnline ? 'text-yellow-600' : isSyncing ? 'text-blue-600' : 'text-orange-600',
                isSyncing ? 'animate-spin' : ''
              ]"
              class="w-4 h-4" 
            />
          </div>
        </div>
      </div>
    </nav>
  </div>
</template>
