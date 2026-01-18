/**
 * Focus Mode Store
 * Manages state for the distraction-free training canvas
 */
import { defineStore } from 'pinia'

export const useFocusStore = defineStore('focus', () => {
    // State
    const isActive = ref(false)
    const activeExerciseId = ref<string | null>(null)
    const isSwapping = ref(false)
    const isAdding = ref(false)

    // Exercises list (set externally by FocusCanvas)
    const exerciseIds = ref<string[]>([])

    // Computed
    const activeIndex = computed(() => {
        if (!activeExerciseId.value) return -1
        return exerciseIds.value.indexOf(activeExerciseId.value)
    })

    const hasNext = computed(() => activeIndex.value < exerciseIds.value.length - 1)
    const hasPrev = computed(() => activeIndex.value > 0)

    // Actions
    function enterMode(exerciseId?: string) {
        isActive.value = true
        if (exerciseId) {
            activeExerciseId.value = exerciseId
        } else if (exerciseIds.value.length > 0) {
            activeExerciseId.value = exerciseIds.value[0] ?? null
        }
    }

    function exitMode() {
        isActive.value = false
        activeExerciseId.value = null
        isSwapping.value = false
        isAdding.value = false
    }

    function setExercises(ids: string[]) {
        exerciseIds.value = ids
    }

    function setActiveExercise(id: string) {
        if (exerciseIds.value.includes(id)) {
            activeExerciseId.value = id
        } else {
            // New exercise added, update list and set active
            exerciseIds.value.push(id)
            activeExerciseId.value = id
        }
    }

    function nextExercise() {
        if (hasNext.value) {
            activeExerciseId.value = exerciseIds.value[activeIndex.value + 1] ?? null
        }
    }

    function prevExercise() {
        if (hasPrev.value) {
            activeExerciseId.value = exerciseIds.value[activeIndex.value - 1] ?? null
        }
    }

    function openSwapModal() {
        isSwapping.value = true
        isAdding.value = false
    }

    function openAddModal() {
        isAdding.value = true
        isSwapping.value = false
    }

    function closeModals() {
        isSwapping.value = false
        isAdding.value = false
    }

    return {
        // State
        isActive,
        activeExerciseId,
        isSwapping,
        isAdding,
        exerciseIds,
        // Computed
        activeIndex,
        hasNext,
        hasPrev,
        // Actions
        enterMode,
        exitMode,
        setExercises,
        setActiveExercise,
        nextExercise,
        prevExercise,
        openSwapModal,
        openAddModal,
        closeModals
    }
})
