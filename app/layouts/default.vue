<script setup lang="ts">
const { signOut, checkPendingSync, forceSyncBeforeLogout } = useAuth()
const toast = useToast()
const { pendingSyncCount, isSyncing, isOnline, forceSyncNow } = useDatabase()

// Sidebar collapse state - persisted in localStorage
const isSidebarCollapsed = ref(false)

// Load sidebar state from localStorage on mount
onMounted(() => {
  if (import.meta.client) {
    const saved = localStorage.getItem('sidebar-collapsed')
    if (saved) {
      isSidebarCollapsed.value = saved === 'true'
    }
  }
})

// Toggle sidebar and persist
const toggleSidebar = () => {
  isSidebarCollapsed.value = !isSidebarCollapsed.value
  if (import.meta.client) {
    localStorage.setItem('sidebar-collapsed', String(isSidebarCollapsed.value))
  }
}

// Logout warning modal state
const showLogoutWarning = ref(false)
const pendingLogoutCount = ref(0)
const isForceSyncing = ref(false)

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
    label: 'Members',
    to: '/members',
    icon: 'i-heroicons-users'
  },
  {
    label: 'Library',
    to: '/library',
    icon: 'i-heroicons-book-open'
  },
  {
    label: 'Settings',
    to: '/settings',
    icon: 'i-heroicons-cog-6-tooth'
  }
]

const handleLogout = async () => {
  try {
    const result = await signOut()
    
    if (!result.success && result.pendingCount) {
      // Has pending sync items - show warning
      pendingLogoutCount.value = result.pendingCount
      showLogoutWarning.value = true
      return
    }
    
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

const handleSyncAndLogout = async () => {
  isForceSyncing.value = true
  try {
    // Try to sync first
    const synced = await forceSyncBeforeLogout()
    
    if (synced) {
      toast.add({
        title: 'Data synced successfully',
        color: 'success',
        icon: 'i-heroicons-check-circle'
      })
    } else {
      toast.add({
        title: 'Some data could not be synced',
        description: 'Check your internet connection',
        color: 'warning',
        icon: 'i-heroicons-exclamation-triangle'
      })
    }
    
    // Force logout after sync attempt
    await signOut({ force: true })
    showLogoutWarning.value = false
    await navigateTo('/login')
  } catch (error: any) {
    toast.add({
      title: 'Sync failed',
      description: error.message,
      color: 'error'
    })
  } finally {
    isForceSyncing.value = false
  }
}

const handleForceLogout = async () => {
  try {
    await signOut({ force: true })
    showLogoutWarning.value = false
    await navigateTo('/login')
    toast.add({
      title: 'Logged out',
      description: 'Unsaved data was discarded',
      color: 'warning',
      icon: 'i-heroicons-exclamation-triangle'
    })
  } catch (error: any) {
    toast.add({
      title: 'Logout failed',
      description: error.message,
      color: 'error'
    })
  }
}

const handleForceSync = async () => {
  if (isSyncing.value || !isOnline.value) return
  
  try {
    toast.add({
      title: 'Syncing...',
      icon: 'i-heroicons-arrow-path',
      color: 'info'
    })
    
    const result = await forceSyncNow()
    
    if (result.success > 0) {
      toast.add({
        title: 'Sync Complete',
        description: `${result.success} items synced successfully`,
        icon: 'i-heroicons-check-circle',
        color: 'success'
      })
    } else if (result.failed > 0) {
      toast.add({
        title: 'Sync Issues',
        description: `${result.failed} items failed to sync`,
        icon: 'i-heroicons-exclamation-triangle',
        color: 'warning'
      })
    } else {
      toast.add({
        title: 'Nothing to sync',
        icon: 'i-heroicons-check',
        color: 'neutral'
      })
    }
  } catch (error: any) {
    toast.add({
      title: 'Sync failed',
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
          <button 
            v-else-if="pendingSyncCount > 0" 
            class="flex items-center gap-2 px-3 py-1.5 bg-orange-100 dark:bg-orange-900/30 rounded-full hover:bg-orange-200 dark:hover:bg-orange-900/50 transition-colors cursor-pointer"
            @click="handleForceSync"
            title="Click to force sync"
          >
            <UIcon name="i-heroicons-cloud-arrow-up" class="w-4 h-4 text-orange-600" />
            <span class="text-xs font-medium text-orange-700 dark:text-orange-400">{{ pendingSyncCount }} pending</span>
            <UIcon name="i-heroicons-arrow-path" class="w-3 h-3 text-orange-500" />
          </button>
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
      <aside 
        class="hidden lg:flex lg:flex-col border-r border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 transition-all duration-300 ease-in-out"
        :class="isSidebarCollapsed ? 'w-20' : 'w-64'"
      >
        <!-- Toggle Button -->
        <div class="p-3 flex justify-end border-b border-gray-100 dark:border-gray-800">
          <button 
            @click="toggleSidebar"
            class="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            :title="isSidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'"
          >
            <UIcon 
              :name="isSidebarCollapsed ? 'i-heroicons-chevron-right' : 'i-heroicons-chevron-left'" 
              class="w-5 h-5 text-gray-500"
            />
          </button>
        </div>
        
        <nav class="flex-1 space-y-2" :class="isSidebarCollapsed ? 'p-3' : 'p-6'">
          <NuxtLink
            v-for="item in navItems"
            :key="item.to"
            :to="item.to"
            class="flex items-center rounded-xl text-base font-medium transition-all duration-200"
            :class="[
              isSidebarCollapsed ? 'justify-center p-3' : 'gap-4 px-4 py-3',
              $route.path === item.to 
                ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400' 
                : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800/50 hover:text-gray-900 dark:hover:text-white'
            ]"
            :title="isSidebarCollapsed ? item.label : ''"
          >
            <UIcon 
              :name="item.icon" 
              class="w-6 h-6 flex-shrink-0"
              :class="$route.path === item.to ? 'text-primary-500' : ''"
            />
            <span v-if="!isSidebarCollapsed">{{ item.label }}</span>
          </NuxtLink>
        </nav>
        
        <!-- Sidebar Sync Status Footer -->
        <div v-if="(pendingSyncCount > 0 || !isOnline) && !isSidebarCollapsed" class="p-4 border-t border-gray-200 dark:border-gray-800">
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
        <!-- Collapsed Sync Indicator -->
        <div v-else-if="(pendingSyncCount > 0 || !isOnline) && isSidebarCollapsed" class="p-3 border-t border-gray-200 dark:border-gray-800 flex justify-center">
          <div 
            class="w-10 h-10 rounded-full flex items-center justify-center"
            :class="!isOnline 
              ? 'bg-yellow-50 dark:bg-yellow-900/20' 
              : 'bg-orange-50 dark:bg-orange-900/20'"
            :title="!isOnline ? 'Offline' : `${pendingSyncCount} pending sync`"
          >
            <UIcon 
              :name="!isOnline ? 'i-heroicons-wifi' : 'i-heroicons-cloud-arrow-up'" 
              :class="!isOnline ? 'text-yellow-500' : 'text-orange-500'"
              class="w-5 h-5" 
            />
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
    <nav class="lg:hidden fixed bottom-0 left-0 right-0 border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 safe-area-pb">
      <div class="flex items-stretch justify-around">
        <NuxtLink
          v-for="item in navItems"
          :key="item.to"
          :to="item.to"
          class="flex-1 flex flex-col items-center justify-center py-3 gap-1 transition-colors"
          :class="$route.path === item.to 
            ? 'text-primary-600 dark:text-primary-400' 
            : 'text-gray-500 dark:text-gray-400'"
        >
          <UIcon 
            :name="item.icon" 
            class="w-6 h-6"
          />
          <span class="text-xs font-medium">{{ item.label }}</span>
        </NuxtLink>
        <!-- Mobile Sync Indicator -->
        <div 
          v-if="pendingSyncCount > 0 || !isOnline" 
          class="flex items-center justify-center px-4"
        >
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

    <!-- Logout Warning Modal -->
    <UModal v-model:open="showLogoutWarning">
      <template #content>
        <div class="p-6 text-center">
          <div class="w-16 h-16 mx-auto mb-4 bg-orange-100 dark:bg-orange-900/30 rounded-full flex items-center justify-center">
            <UIcon name="i-heroicons-exclamation-triangle" class="w-8 h-8 text-orange-500" />
          </div>
          <h3 class="text-xl font-bold text-gray-900 dark:text-white mb-2">Unsaved Data Warning</h3>
          <p class="text-gray-500 dark:text-gray-400 mb-6">
            You have <span class="font-bold text-orange-600">{{ pendingLogoutCount }}</span> 
            {{ pendingLogoutCount === 1 ? 'item' : 'items' }} that haven't been synced to the server.
            <br><br>
            If you logout now, <span class="font-bold text-red-600">this data will be lost</span>.
          </p>
          
          <!-- Options -->
          <div class="space-y-3">
            <!-- Sync and Logout (Recommended) -->
            <UButton
              :label="isForceSyncing ? 'Syncing...' : 'Sync & Logout (Recommended)'"
              color="primary"
              size="lg"
              block
              icon="i-heroicons-cloud-arrow-up"
              :loading="isForceSyncing"
              :disabled="!isOnline || isForceSyncing"
              @click="handleSyncAndLogout"
            />
            
            <!-- Offline Warning -->
            <p v-if="!isOnline" class="text-xs text-yellow-600 dark:text-yellow-400 flex items-center justify-center gap-1">
              <UIcon name="i-heroicons-wifi" class="w-3 h-3" />
              Connect to internet to sync data
            </p>
            
            <!-- Force Logout (Dangerous) -->
            <UButton
              label="Logout Anyway (Lose Data)"
              color="error"
              variant="outline"
              size="lg"
              block
              icon="i-heroicons-trash"
              :disabled="isForceSyncing"
              @click="handleForceLogout"
            />
            
            <!-- Cancel -->
            <UButton
              label="Cancel"
              color="neutral"
              variant="ghost"
              size="lg"
              block
              :disabled="isForceSyncing"
              @click="showLogoutWarning = false"
            />
          </div>
        </div>
      </template>
    </UModal>
  </div>
</template>
