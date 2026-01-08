<script setup lang="ts">
const props = defineProps<{
  open: boolean
  memberId: string
  memberName?: string
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'success', record: any): void
}>()

const toast = useToast()

// Step tracking
const step = ref<'upload' | 'processing' | 'result'>('upload')

// Upload state
const selectedFile = ref<File | null>(null)
const previewUrl = ref<string | null>(null)
const isDragging = ref(false)

// Result state
const scanResult = ref<any>(null)
const isProcessing = ref(false)

// File input ref
const fileInputRef = ref<HTMLInputElement | null>(null)

function triggerFileInput() {
  fileInputRef.value?.click()
}

function handleDragOver(e: DragEvent) {
  e.preventDefault()
  isDragging.value = true
}

function handleDragLeave() {
  isDragging.value = false
}

function handleDrop(e: DragEvent) {
  e.preventDefault()
  isDragging.value = false
  
  const file = e.dataTransfer?.files[0]
  if (file && isValidImage(file)) {
    selectFile(file)
  }
}

function handleFileInput(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (file && isValidImage(file)) {
    selectFile(file)
  }
  // Reset input so same file can be selected again
  if (input) input.value = ''
}

function isValidImage(file: File): boolean {
  const validTypes = ['image/jpeg', 'image/png', 'image/heic', 'image/heif']
  return validTypes.includes(file.type) || /\.(jpg|jpeg|png|heic|heif)$/i.test(file.name)
}

function selectFile(file: File) {
  selectedFile.value = file
  previewUrl.value = URL.createObjectURL(file)
}

function clearSelection() {
  selectedFile.value = null
  if (previewUrl.value) {
    URL.revokeObjectURL(previewUrl.value)
    previewUrl.value = null
  }
}

async function uploadScan() {
  if (!selectedFile.value) return

  step.value = 'processing'
  isProcessing.value = true

  try {
    const token = useCookie('metamorph-token')
    const formData = new FormData()
    formData.append('image', selectedFile.value)

    const result = await $fetch<{ success: boolean; data: any }>(`/api/v1/pro/members/${props.memberId}/scans`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token.value}`
      },
      body: formData
    })

    scanResult.value = result.data
    step.value = 'result'

    toast.add({
      title: 'Scan Processed',
      description: 'InBody data has been extracted successfully.',
      color: 'success',
      icon: 'i-heroicons-check-circle'
    })

    emit('success', result.data)
  } catch (error: any) {
    toast.add({
      title: 'Processing Failed',
      description: error.data?.error || error.message,
      color: 'error',
      icon: 'i-heroicons-x-circle'
    })
    step.value = 'upload'
  } finally {
    isProcessing.value = false
  }
}

function close() {
  step.value = 'upload'
  clearSelection()
  scanResult.value = null
  emit('close')
}
</script>

<template>
  <UModal :open="props.open" @update:open="close">
    <template #content>
      <div class="p-6 space-y-4">
        <!-- Header -->
        <div class="flex items-center gap-3 mb-4">
          <div class="w-12 h-12 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
            <UIcon name="i-heroicons-document-chart-bar" class="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 class="text-xl font-bold text-gray-900 dark:text-white">InBody Scan</h2>
            <p class="text-sm text-gray-500">{{ props.memberName || 'Member' }}</p>
          </div>
        </div>

        <!-- Hidden File Input -->
        <input 
          ref="fileInputRef"
          type="file" 
          accept="image/*,.heic,.heif" 
          class="hidden" 
          @change="handleFileInput" 
        />

        <!-- Step 1: Upload -->
        <div v-if="step === 'upload'" class="space-y-4">
          <!-- Drop Zone -->
          <div
            class="border-2 border-dashed rounded-xl p-8 text-center transition-colors cursor-pointer"
            :class="[
              isDragging ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20' : 'border-gray-300 dark:border-gray-700',
              selectedFile ? 'border-success-500' : ''
            ]"
            @dragover="handleDragOver"
            @dragleave="handleDragLeave"
            @drop="handleDrop"
            @click="!selectedFile && triggerFileInput()"
          >
            <template v-if="!selectedFile">
              <UIcon name="i-heroicons-cloud-arrow-up" class="w-12 h-12 mx-auto text-gray-400 mb-3" />
              <p class="text-gray-600 dark:text-gray-300 mb-2">Drag & drop InBody scan image</p>
              <p class="text-sm text-gray-400 mb-4">JPEG, PNG, HEIC supported</p>
              <UButton 
                label="Browse Files" 
                color="primary" 
                icon="i-heroicons-folder-open" 
                @click.stop="triggerFileInput"
              />
            </template>
            <template v-else>
              <img :src="previewUrl!" alt="Preview" class="max-h-48 mx-auto rounded-lg mb-3" />
              <p class="text-sm text-gray-600 dark:text-gray-300">{{ selectedFile.name }}</p>
              <UButton label="Change" variant="ghost" size="sm" class="mt-2" @click.stop="clearSelection" />
            </template>
          </div>

          <!-- Actions -->
          <div class="flex gap-3">
            <UButton label="Cancel" color="neutral" variant="outline" class="flex-1" @click="close" />
            <UButton
              label="Analyze Scan"
              color="primary"
              class="flex-1"
              icon="i-heroicons-sparkles"
              :disabled="!selectedFile"
              @click="uploadScan"
            />
          </div>
        </div>

        <!-- Step 2: Processing -->
        <div v-if="step === 'processing'" class="py-12 text-center">
          <div class="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center animate-pulse">
            <UIcon name="i-heroicons-sparkles" class="w-8 h-8 text-white" />
          </div>
          <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-2">Analyzing Scan...</h3>
          <p class="text-gray-500 text-sm">AI is extracting body composition metrics</p>
          <div class="mt-4 flex justify-center">
            <div class="flex gap-1">
              <div class="w-2 h-2 rounded-full bg-primary-500 animate-bounce" style="animation-delay: 0s" />
              <div class="w-2 h-2 rounded-full bg-primary-500 animate-bounce" style="animation-delay: 0.1s" />
              <div class="w-2 h-2 rounded-full bg-primary-500 animate-bounce" style="animation-delay: 0.2s" />
            </div>
          </div>
        </div>

        <!-- Step 3: Result -->
        <div v-if="step === 'result' && scanResult" class="space-y-4">
          <div class="bg-gradient-to-r from-emerald-500 to-teal-500 rounded-xl p-4 text-center text-white">
            <UIcon name="i-heroicons-check-badge" class="w-10 h-10 mx-auto mb-2" />
            <h3 class="font-bold">Scan Processed!</h3>
          </div>

          <!-- Key Metrics -->
          <div class="grid grid-cols-3 gap-3">
            <div class="bg-gray-50 dark:bg-slate-800 rounded-lg p-3 text-center">
              <p class="text-xs text-gray-500 uppercase">Weight</p>
              <p class="text-xl font-bold">{{ scanResult.weight?.toFixed(1) || '--' }} <span class="text-sm font-normal">kg</span></p>
            </div>
            <div class="bg-gray-50 dark:bg-slate-800 rounded-lg p-3 text-center">
              <p class="text-xs text-gray-500 uppercase">SMM</p>
              <p class="text-xl font-bold">{{ scanResult.smm?.toFixed(1) || '--' }} <span class="text-sm font-normal">kg</span></p>
            </div>
            <div class="bg-gray-50 dark:bg-slate-800 rounded-lg p-3 text-center">
              <p class="text-xs text-gray-500 uppercase">Body Fat</p>
              <p class="text-xl font-bold">{{ scanResult.pbf?.toFixed(1) || '--' }}%</p>
            </div>
          </div>

          <!-- AI Analysis Summary -->
          <div v-if="scanResult.analysis?.summary" class="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
            <div class="flex items-center gap-2 mb-2">
              <UIcon name="i-heroicons-light-bulb" class="w-5 h-5 text-blue-500" />
              <span class="font-semibold text-blue-700 dark:text-blue-300">AI Insights</span>
            </div>
            <p class="text-sm text-blue-600 dark:text-blue-400">{{ scanResult.analysis.summary }}</p>
          </div>

          <UButton label="Done" color="primary" block @click="close" />
        </div>
      </div>
    </template>
  </UModal>
</template>
