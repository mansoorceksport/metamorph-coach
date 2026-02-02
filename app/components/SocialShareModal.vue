<script setup lang="ts">
/**
 * SocialShareModal
 * Modal component for previewing and sharing Instagram Story images
 */
import { useSocialShare } from '~/composables/useSocialShare'

export interface SessionShareData {
  memberName: string
  focusArea: string
  setsCompleted: number
  exerciseCount: number
  newPRs: number
  motivationQuote?: string
}

export interface ScanShareData {
  weight: number
  smm: number
  bodyFat: number
  bmi: number
  memberName?: string
}

export interface ScanItem {
  id: string
  weight: number
  pbf: number
  smm: number
  test_date_time: string
}

export interface ProgressShareData {
  memberName: string
  coachName: string
  scans: ScanItem[]
  sessionsCompleted: number
  attendanceRate: number
  volumeData: Array<{ date: string; total_volume: number }>
  totalVolume: number
}

const props = defineProps<{
  type: 'session' | 'scan' | 'progress'
  sessionData?: SessionShareData
  scanData?: ScanShareData
  progressData?: ProgressShareData
}>()

const emit = defineEmits<{
  (e: 'close'): void
}>()

const isOpen = defineModel<boolean>('show', { default: false })

const { isGenerating, generateAndShare } = useSocialShare()
const toast = useToast()

// Template refs
const templateRef = ref<HTMLElement | null>(null)

// Preview scale (to fit modal)
const previewScale = 0.22

// Scan picker state (for progress type)
const selectedBeforeScanId = ref<string>('')
const selectedAfterScanId = ref<string>('')

// Initialize scan picker when modal opens
watch(isOpen, (open) => {
  if (open && props.type === 'progress' && props.progressData?.scans.length) {
    const sortedScans = [...props.progressData.scans].sort(
      (a, b) => new Date(a.test_date_time).getTime() - new Date(b.test_date_time).getTime()
    )
    selectedBeforeScanId.value = sortedScans[0]?.id || ''
    selectedAfterScanId.value = sortedScans[sortedScans.length - 1]?.id || ''
  }
})

// Get selected scans
const beforeScan = computed(() => {
  if (!props.progressData?.scans) return null
  const scan = props.progressData.scans.find(s => s.id === selectedBeforeScanId.value)
  if (!scan) return null
  return {
    weight: scan.weight,
    pbf: scan.pbf,
    smm: scan.smm,
    date: scan.test_date_time
  }
})

const afterScan = computed(() => {
  if (!props.progressData?.scans) return null
  const scan = props.progressData.scans.find(s => s.id === selectedAfterScanId.value)
  if (!scan) return null
  return {
    weight: scan.weight,
    pbf: scan.pbf,
    smm: scan.smm,
    date: scan.test_date_time
  }
})

// Scan options for dropdown
const scanOptions = computed(() => {
  if (!props.progressData?.scans) return []
  return props.progressData.scans
    .sort((a, b) => new Date(a.test_date_time).getTime() - new Date(b.test_date_time).getTime())
    .map(s => ({
      value: s.id,
      label: `${new Date(s.test_date_time).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} - ${s.weight.toFixed(1)}kg`
    }))
})

async function handleShare() {
  if (!templateRef.value) {
    toast.add({
      title: 'Error',
      description: 'Template not ready. Please try again.',
      color: 'error'
    })
    return
  }

  try {
    let filename = 'metamorph-share.png'
    if (props.type === 'session') filename = `metamorph-session-${Date.now()}.png`
    else if (props.type === 'scan') filename = `metamorph-scan-${Date.now()}.png`
    else if (props.type === 'progress') filename = `metamorph-progress-${Date.now()}.png`
    
    await generateAndShare(templateRef.value, { filename })
    
    toast.add({
      title: 'Shared!',
      description: 'Your image is ready to post.',
      icon: 'i-heroicons-share',
      color: 'success'
    })
    
    isOpen.value = false
  } catch (err: any) {
    toast.add({
      title: 'Share Failed',
      description: err.message || 'Could not generate image.',
      color: 'error'
    })
  }
}

function handleClose() {
  isOpen.value = false
  emit('close')
}
</script>

<template>
  <UModal v-model:open="isOpen">
    <template #content>
      <div class="p-6 max-h-[90vh] overflow-y-auto">
        <!-- Header -->
        <div class="flex items-center justify-between mb-4">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-full bg-gradient-to-br from-pink-500 to-purple-600 flex items-center justify-center">
              <UIcon name="i-heroicons-share" class="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 class="text-lg font-bold">Share to Instagram</h2>
              <p class="text-sm text-gray-500">Preview your story</p>
            </div>
          </div>
          <UButton
            icon="i-heroicons-x-mark"
            color="neutral"
            variant="ghost"
            @click="handleClose"
          />
        </div>

        <!-- Scan Picker (for progress type) -->
        <div v-if="type === 'progress' && progressData" class="grid grid-cols-2 gap-4 mb-4">
          <div>
            <label class="block text-sm font-medium text-gray-600 mb-1">Before Scan</label>
            <USelect
              v-model="selectedBeforeScanId"
              :items="scanOptions"
              value-key="value"
              label-key="label"
              placeholder="Select before scan"
            />
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-600 mb-1">After Scan</label>
            <USelect
              v-model="selectedAfterScanId"
              :items="scanOptions"
              value-key="value"
              label-key="label"
              placeholder="Select after scan"
            />
          </div>
        </div>

        <!-- Preview Container -->
        <div class="bg-slate-900 rounded-xl p-3 mb-4 flex items-center justify-center overflow-hidden">
          <div 
            class="relative"
            :style="{ width: `${1080 * previewScale}px`, height: `${1920 * previewScale}px` }"
          >
            <div 
              class="absolute top-0 left-0 origin-top-left"
              :style="{ transform: `scale(${previewScale})`, width: '1080px', height: '1920px' }"
            >
              <!-- Session Template -->
              <div v-if="type === 'session' && sessionData" ref="templateRef">
                <TemplatesSessionSmashTemplate
                  :member-name="sessionData.memberName"
                  :focus-area="sessionData.focusArea"
                  :sets-completed="sessionData.setsCompleted"
                  :exercise-count="sessionData.exerciseCount"
                  :new-p-rs="sessionData.newPRs"
                  :motivation-quote="sessionData.motivationQuote"
                />
              </div>
              
              <!-- Scan Template -->
              <div v-else-if="type === 'scan' && scanData" ref="templateRef">
                <TemplatesScanUpdateTemplate
                  :weight="scanData.weight"
                  :smm="scanData.smm"
                  :body-fat="scanData.bodyFat"
                  :bmi="scanData.bmi"
                  :member-name="scanData.memberName"
                />
              </div>

              <!-- Progress Template -->
              <div v-else-if="type === 'progress' && progressData && beforeScan && afterScan" ref="templateRef">
                <TemplatesMemberProgressTemplate
                  :member-name="progressData.memberName"
                  :coach-name="progressData.coachName"
                  :before-scan="beforeScan"
                  :after-scan="afterScan"
                  :sessions-completed="progressData.sessionsCompleted"
                  :attendance-rate="progressData.attendanceRate"
                  :volume-data="progressData.volumeData"
                  :total-volume="progressData.totalVolume"
                />
              </div>
            </div>
          </div>
        </div>

        <!-- Share Button -->
        <UButton
          block
          size="xl"
          color="primary"
          :loading="isGenerating"
          icon="i-heroicons-share"
          @click="handleShare"
        >
          {{ isGenerating ? 'Generating...' : 'Share to Instagram' }}
        </UButton>
        
        <p class="text-xs text-gray-500 text-center mt-3">
          On mobile, this will open your share menu. On desktop, the image will download.
        </p>
      </div>
    </template>
  </UModal>
</template>

