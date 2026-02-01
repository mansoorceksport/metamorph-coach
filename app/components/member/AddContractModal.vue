<script setup lang="ts">
const props = defineProps<{
  open: boolean
  memberId: string
  memberName?: string
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'created', contract: any): void
}>()

const toast = useToast()
const { t } = useI18n()

// Packages
const packages = ref<any[]>([])
const isLoadingPackages = ref(false)
const selectedPackageId = ref('')

// Submit state
const isSubmitting = ref(false)

// Load packages on mount
async function loadPackages() {
  isLoadingPackages.value = true
  const token = useCookie('metamorph-token')
  try {
    packages.value = await $fetch<any[]>('/api/v1/pro/packages', {
      headers: {
        Authorization: `Bearer ${token.value}`
      }
    })
  } catch (error: any) {
    toast.add({
      title: 'Failed to load packages',
      description: error.data?.error || error.message,
      color: 'error'
    })
  } finally {
    isLoadingPackages.value = false
  }
}

async function handleSubmit() {
  if (!selectedPackageId.value) {
    toast.add({
      title: 'Please select a package',
      color: 'warning'
    })
    return
  }

  isSubmitting.value = true

  try {
    const token = useCookie('metamorph-token')
    const contract = await $fetch<any>('/api/v1/pro/contracts', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token.value}`
      },
      body: {
        member_id: props.memberId,
        package_id: selectedPackageId.value
      }
    })

    const pkg = packages.value.find(p => p.id === selectedPackageId.value)
    toast.add({
      title: 'Package Added',
      description: `${pkg?.name || 'Package'} assigned successfully`,
      color: 'success',
      icon: 'i-heroicons-check-circle'
    })

    emit('created', contract)
    emit('close')
    selectedPackageId.value = ''
  } catch (error: any) {
    toast.add({
      title: 'Failed to add package',
      description: error.data?.error || error.message,
      color: 'error',
      icon: 'i-heroicons-x-circle'
    })
  } finally {
    isSubmitting.value = false
  }
}

// Load packages when modal opens
watch(() => props.open, (isOpen) => {
  if (isOpen && packages.value.length === 0) {
    loadPackages()
  }
})
</script>

<template>
  <UModal :open="props.open" @update:open="$emit('close')">
    <template #content>
      <div class="p-6 space-y-4">
        <!-- Header -->
        <div class="flex items-center gap-3 mb-4">
          <div class="w-12 h-12 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
            <UIcon name="i-heroicons-clipboard-document-list" class="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 class="text-xl font-bold text-gray-900 dark:text-white">{{ $t('modals.addContract') }}</h2>
            <p class="text-sm text-gray-500">{{ props.memberName || 'Select a package' }}</p>
          </div>
        </div>

        <!-- Loading State -->
        <div v-if="isLoadingPackages" class="py-8 text-center">
          <div class="w-8 h-8 mx-auto mb-3 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
          <p class="text-gray-500">Loading packages...</p>
        </div>

        <!-- No Packages -->
        <div v-else-if="packages.length === 0" class="py-8 text-center">
          <UIcon name="i-heroicons-archive-box-x-mark" class="w-12 h-12 mx-auto text-gray-300 mb-3" />
          <p class="text-gray-500 mb-2">No packages available</p>
          <p class="text-sm text-gray-400">Contact your tenant admin to create packages</p>
        </div>

        <!-- Package Selection -->
        <div v-else class="space-y-4">
          <div>
            <label class="block text-sm font-medium mb-2">Select Package</label>
            <div class="space-y-2">
              <div
                v-for="pkg in packages"
                :key="pkg.id"
                class="p-4 border rounded-lg cursor-pointer transition-all"
                :class="selectedPackageId === pkg.id 
                  ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20' 
                  : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'"
                @click="selectedPackageId = pkg.id"
              >
                <div class="flex items-center justify-between">
                  <div>
                    <h4 class="font-medium">{{ pkg.name }}</h4>
                    <p class="text-sm text-gray-500">{{ pkg.total_sessions }} sessions</p>
                  </div>
                  <div class="flex items-center gap-3">
                    <span class="font-semibold text-primary-600">{{ pkg.price ? `$${pkg.price}` : 'Free' }}</span>
                    <div 
                      class="w-5 h-5 rounded-full border-2 flex items-center justify-center"
                      :class="selectedPackageId === pkg.id 
                        ? 'border-primary-500 bg-primary-500' 
                        : 'border-gray-300 dark:border-gray-600'"
                    >
                      <UIcon 
                        v-if="selectedPackageId === pkg.id" 
                        name="i-heroicons-check" 
                        class="w-3 h-3 text-white" 
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Actions -->
          <div class="flex gap-3 pt-4">
            <UButton
              :label="$t('common.cancel')"
              color="neutral"
              variant="outline"
              class="flex-1"
              @click="$emit('close')"
            />
            <UButton
              :label="$t('modals.addContract')"
              color="primary"
              class="flex-1"
              :loading="isSubmitting"
              :disabled="!selectedPackageId"
              @click="handleSubmit"
            />
          </div>
        </div>
      </div>
    </template>
  </UModal>
</template>
