<script setup lang="ts">
const emit = defineEmits<{
  (e: 'close'): void
  (e: 'created', member: { id: string; name: string; email: string }): void
}>()

const props = defineProps<{
  open: boolean
}>()

const toast = useToast()
const isSubmitting = ref(false)

// Packages
const packages = ref<any[]>([])
const isLoadingPackages = ref(false)

const form = reactive({
  name: '',
  email: '',
  packageId: ''
})

const formErrors = reactive({
  name: '',
  email: '',
  packageId: ''
})

// Format price in Indonesian Rupiah
function formatIDR(price: number): string {
  if (!price) return 'Gratis'
  return `Rp ${price.toLocaleString('id-ID')}`
}

// Package options for dropdown
const packageOptions = computed(() => {
  return packages.value.map(pkg => ({
    value: pkg.id,
    label: `${pkg.name} | ${pkg.total_sessions} sesi | ${formatIDR(pkg.price)}`
  }))
})

// Load packages on modal open
async function loadPackages() {
  if (packages.value && packages.value.length > 0) return // Already loaded
  
  isLoadingPackages.value = true
  const token = useCookie('metamorph-token')
  try {
    const response = await $fetch<any[]>('/api/v1/pro/packages', {
      headers: {
        Authorization: `Bearer ${token.value}`
      }
    })
    // Ensure we always have an array (API might return null)
    packages.value = response || []
  } catch (error: any) {
    toast.add({
      title: 'Failed to load packages',
      description: error.data?.error || error.message,
      color: 'warning'
    })
    packages.value = [] // Ensure array on error
  } finally {
    isLoadingPackages.value = false
  }
}

function validate(): boolean {
  formErrors.name = ''
  formErrors.email = ''
  formErrors.packageId = ''
  let valid = true

  if (!form.name.trim()) {
    formErrors.name = 'Name is required'
    valid = false
  }

  if (!form.email.trim()) {
    formErrors.email = 'Email is required'
    valid = false
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
    formErrors.email = 'Invalid email format'
    valid = false
  }

  if (!form.packageId) {
    formErrors.packageId = 'Please select a package'
    valid = false
  }

  return valid
}

async function handleSubmit() {
  if (!validate()) return

  isSubmitting.value = true

  try {
    const token = useCookie('metamorph-token')
    const response = await $fetch<{ member: any; contract: any; warning?: string }>('/api/v1/pro/members', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token.value}`
      },
      body: {
        name: form.name,
        email: form.email,
        package_id: form.packageId
      }
    })

    const pkg = packages.value.find(p => p.id === form.packageId)
    toast.add({
      title: 'Member Created',
      description: `${response.member.name} added with ${pkg?.name || 'package'}.`,
      color: 'success',
      icon: 'i-heroicons-check-circle'
    })

    if (response.warning) {
      toast.add({
        title: 'Warning',
        description: response.warning,
        color: 'warning'
      })
    }

    emit('created', response.member)
    emit('close')

    // Reset form
    form.name = ''
    form.email = ''
    form.packageId = ''
  } catch (error: any) {
    toast.add({
      title: 'Failed to create member',
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
  if (isOpen) {
    loadPackages()
  }
})
</script>

<template>
  <UModal :open="props.open" @update:open="$emit('close')" class="sm:max-w-lg">
    <template #content>
      <div class="p-6 space-y-4">
        <div class="flex items-center gap-3 mb-4">
          <div class="w-12 h-12 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center">
            <UIcon name="i-heroicons-user-plus" class="w-6 h-6 text-primary-600" />
          </div>
          <div>
            <h2 class="text-xl font-bold text-gray-900 dark:text-white">Add New Member</h2>
            <p class="text-sm text-gray-500">Create a member with a package</p>
          </div>
        </div>

        <form @submit.prevent="handleSubmit" class="space-y-4">
          <!-- Name -->
          <div>
            <label class="block text-sm font-medium mb-1">Name</label>
            <UInput
              v-model="form.name"
              placeholder="John Doe"
              size="lg"
              :color="formErrors.name ? 'error' : 'primary'"
            />
            <p v-if="formErrors.name" class="text-sm text-red-500 mt-1">{{ formErrors.name }}</p>
          </div>

          <!-- Email -->
          <div>
            <label class="block text-sm font-medium mb-1">Email</label>
            <UInput
              v-model="form.email"
              type="email"
              placeholder="john@example.com"
              size="lg"
              :color="formErrors.email ? 'error' : 'primary'"
            />
            <p v-if="formErrors.email" class="text-sm text-red-500 mt-1">{{ formErrors.email }}</p>
          </div>

          <!-- Package Selection (Dropdown) -->
          <div>
            <label class="block text-sm font-medium mb-2">Package <span class="text-red-500">*</span></label>
            
            <div v-if="isLoadingPackages" class="py-4 text-center">
              <div class="w-6 h-6 mx-auto border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
              <p class="text-sm text-gray-500 mt-2">Loading packages...</p>
            </div>

            <div v-else-if="packages.length === 0" class="p-4 bg-amber-50 dark:bg-amber-900/20 rounded-lg text-center">
              <UIcon name="i-heroicons-exclamation-triangle" class="w-8 h-8 mx-auto text-amber-500 mb-2" />
              <p class="text-sm text-amber-700 dark:text-amber-300">No packages available. Contact your tenant admin.</p>
            </div>

            <USelect
              v-else
              v-model="form.packageId"
              :items="packageOptions"
              placeholder="Pilih paket..."
              size="lg"
              class="w-full"
              :color="formErrors.packageId ? 'error' : 'primary'"
            />
            <p v-if="formErrors.packageId" class="text-sm text-red-500 mt-1">{{ formErrors.packageId }}</p>
          </div>

          <!-- Actions -->
          <div class="flex gap-3 pt-4">
            <UButton
              label="Cancel"
              color="neutral"
              variant="outline"
              class="flex-1"
              @click="$emit('close')"
            />
            <UButton
              type="submit"
              label="Add Member"
              color="primary"
              class="flex-1"
              :loading="isSubmitting"
              :disabled="packages.length === 0"
            />
          </div>
        </form>
      </div>
    </template>
  </UModal>
</template>
