<script setup lang="ts">
const { pendingSyncCount, isSyncing, isOnline, forceSyncNow, getDeadLetterItems } = useDatabase()
const toast = useToast()
const { t } = useI18n()

// Track dead-letter (failed) items count
const deadLetterCount = ref(0)
const totalQueueCount = computed(() => pendingSyncCount.value + deadLetterCount.value)

// Refresh dead-letter count
async function refreshDeadLetterCount() {
  if (!import.meta.client) return
  const items = await getDeadLetterItems()
  deadLetterCount.value = items.length
}

// Load on mount
onMounted(() => {
  refreshDeadLetterCount()
})

// Force sync handler
const handleForceSync = async () => {
  if (isSyncing.value || !isOnline.value) return
  
  try {
    toast.add({
      title: t('sync.syncing'),
      icon: 'i-heroicons-arrow-path',
      color: 'info'
    })
    
    const result = await forceSyncNow()
    
    // Refresh counts after sync
    await refreshDeadLetterCount()
    
    if (result.success > 0) {
      toast.add({
        title: t('sync.syncComplete'),
        description: t('sync.itemsSynced', { count: result.success }),
        icon: 'i-heroicons-check-circle',
        color: 'success'
      })
    } else if (result.failed > 0) {
      toast.add({
        title: t('sync.syncIssues'),
        description: t('sync.itemsFailedSync', { count: result.failed }),
        icon: 'i-heroicons-exclamation-triangle',
        color: 'warning'
      })
    } else {
      toast.add({
        title: t('sync.nothingToSync'),
        icon: 'i-heroicons-check',
        color: 'neutral'
      })
    }
  } catch (error: any) {
    toast.add({
      title: t('sync.syncFailed'),
      description: error.message,
      color: 'error'
    })
  }
}
</script>

<template>
  <div class="space-y-6">
    <!-- Header -->
    <div>
      <h1 class="text-3xl font-bold text-gray-900 dark:text-white">{{ $t('settings.title') }}</h1>
      <p class="text-gray-500 dark:text-gray-400 mt-1">{{ $t('settings.subtitle') }}</p>
    </div>

    <!-- Sync Settings Section -->
    <UCard>
      <template #header>
        <div class="flex items-center gap-3">
          <div class="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
            <UIcon name="i-heroicons-cloud-arrow-up" class="w-6 h-6 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <h3 class="text-lg font-semibold text-gray-900 dark:text-white">{{ $t('settings.dataSync') }}</h3>
            <p class="text-sm text-gray-500">{{ $t('settings.dataSyncDesc') }}</p>
          </div>
        </div>
      </template>

      <div class="space-y-6">
        <!-- Current Status -->
        <div class="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-900/50 rounded-xl">
          <div class="flex items-center gap-3">
            <div 
              class="w-10 h-10 rounded-full flex items-center justify-center"
              :class="!isOnline 
                ? 'bg-yellow-100 dark:bg-yellow-900/30' 
                : totalQueueCount > 0 
                  ? deadLetterCount > 0 
                    ? 'bg-red-100 dark:bg-red-900/30'
                    : 'bg-orange-100 dark:bg-orange-900/30'
                  : 'bg-green-100 dark:bg-green-900/30'"
            >
              <UIcon 
                :name="!isOnline 
                  ? 'i-heroicons-wifi' 
                  : totalQueueCount > 0 
                    ? deadLetterCount > 0 
                      ? 'i-heroicons-exclamation-triangle'
                      : 'i-heroicons-cloud-arrow-up'
                    : 'i-heroicons-check-circle'"
                :class="!isOnline 
                  ? 'text-yellow-600' 
                  : totalQueueCount > 0 
                    ? deadLetterCount > 0 
                      ? 'text-red-600'
                      : 'text-orange-600'
                    : 'text-green-600'"
                class="w-5 h-5"
              />
            </div>
            <div>
              <p class="font-medium text-gray-900 dark:text-white">
                {{ !isOnline ? $t('settings.offline') : totalQueueCount > 0 ? $t('settings.itemsPending', { count: totalQueueCount }) : $t('settings.allSynced') }}
              </p>
              <p class="text-sm text-gray-500">
                {{ !isOnline 
                  ? $t('settings.connectToInternet') 
                  : deadLetterCount > 0 
                    ? $t('settings.failedPending', { failed: deadLetterCount, pending: pendingSyncCount })
                    : pendingSyncCount > 0 
                      ? $t('settings.waitingToSync')
                      : $t('settings.dataUpToDate') 
                }}
              </p>
            </div>
          </div>
          <UBadge 
            :color="!isOnline ? 'warning' : deadLetterCount > 0 ? 'error' : totalQueueCount > 0 ? 'warning' : 'success'" 
            variant="subtle"
            :label="!isOnline ? $t('settings.offline') : deadLetterCount > 0 ? $t('common.failed') : totalQueueCount > 0 ? $t('common.pending') : $t('common.synced')"
          />
        </div>

        <!-- Sync Button -->
        <div class="flex items-center justify-between p-4 border border-gray-200 dark:border-gray-700 rounded-xl">
          <div>
            <p class="font-medium text-gray-900 dark:text-white">{{ $t('settings.syncPending') }}</p>
            <p class="text-sm text-gray-500">{{ $t('settings.syncPendingDesc') }}</p>
          </div>
          <UButton
            :label="$t('settings.syncNow')"
            color="primary"
            icon="i-heroicons-arrow-path"
            :loading="isSyncing"
            :disabled="!isOnline || totalQueueCount === 0"
            @click="handleForceSync"
          />
        </div>

        <!-- Info Alert -->
        <UAlert
          color="info"
          variant="soft"
          icon="i-heroicons-information-circle"
          :title="$t('settings.aboutSync')"
          :description="$t('settings.aboutSyncDesc')"
        />
      </div>
    </UCard>
  </div>
</template>
