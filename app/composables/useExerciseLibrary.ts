/**
 * Exercise Library Composable
 * Fetches exercises from API and caches in Dexie for offline use
 */
import { db, type Exercise } from '~/utils/db'

// Global state for exercise library
const exerciseLibrary = ref<Exercise[]>([])
const isLoadingLibrary = ref(false)
const libraryError = ref<string | null>(null)

export function useExerciseLibrary() {

    /**
     * Fetch exercises from API and cache in Dexie
     */
    async function fetchAndCacheExercises(): Promise<Exercise[]> {
        if (!import.meta.client) return []

        isLoadingLibrary.value = true
        libraryError.value = null

        try {
            // Get token from cookie (set by auth system)
            const tokenCookie = useCookie('metamorph-token')
            const token = tokenCookie.value

            if (!token) {
                console.warn('[ExerciseLibrary] No auth token, loading from cache only')
                return await loadFromCache()
            }

            // Fetch from API using proxy route (configured in nuxt.config.ts)
            const response = await $fetch<Array<{
                id: string
                name: string
                muscle_group: string
                equipment: string
                video_url?: string
            }>>('/api/v1/exercises', {
                headers: {
                    Authorization: `Bearer ${token}`
                }
            })

            // Transform and cache in Dexie
            const exercises: Exercise[] = response.map(ex => ({
                id: ex.id,
                name: ex.name,
                muscle_group: ex.muscle_group,
                equipment: ex.equipment,
                video_url: ex.video_url,
                personal_best_weight: 0,
                last_3_weights_history: []
            }))

            // Merge with existing PB data (don't overwrite PBs)
            for (const ex of exercises) {
                const existing = await db.exercises.get(ex.id)
                if (existing) {
                    ex.personal_best_weight = existing.personal_best_weight
                    ex.last_3_weights_history = existing.last_3_weights_history
                }
            }

            // Get current exercise IDs from API
            const apiExerciseIds = new Set(exercises.map(ex => ex.id))

            // Get all local exercise IDs
            const localExercises = await db.exercises.toArray()
            const localExerciseIds = localExercises.map(ex => ex.id)

            // Find exercises that exist locally but not on API (deleted)
            const deletedIds = localExerciseIds.filter(id => !apiExerciseIds.has(id))

            // Delete removed exercises from local DB
            if (deletedIds.length > 0) {
                await db.exercises.bulkDelete(deletedIds)
                console.log(`[ExerciseLibrary] Removed ${deletedIds.length} deleted exercises from local DB`)
            }

            // Bulk upsert remaining exercises
            await db.exercises.bulkPut(exercises)

            exerciseLibrary.value = exercises
            console.log(`[ExerciseLibrary] Synced ${exercises.length} exercises`)

            return exercises
        } catch (error: any) {
            console.error('[ExerciseLibrary] API fetch failed, loading from cache:', error)
            libraryError.value = error.message || 'Failed to fetch exercises'

            // Fallback to cached data
            return await loadFromCache()
        } finally {
            isLoadingLibrary.value = false
        }
    }

    /**
     * Load exercises from Dexie cache
     */
    async function loadFromCache(): Promise<Exercise[]> {
        if (!import.meta.client) return []

        const cached = await db.exercises.toArray()
        exerciseLibrary.value = cached
        console.log(`[ExerciseLibrary] Loaded ${cached.length} exercises from cache`)
        return cached
    }

    /**
     * Get exercises by muscle group
     */
    function getByMuscleGroup(muscleGroup: string): Exercise[] {
        return exerciseLibrary.value.filter(ex => ex.muscle_group === muscleGroup)
    }

    /**
     * Search exercises by name
     */
    function searchExercises(query: string): Exercise[] {
        const lowerQuery = query.toLowerCase()
        return exerciseLibrary.value.filter(ex =>
            ex.name.toLowerCase().includes(lowerQuery) ||
            ex.muscle_group.toLowerCase().includes(lowerQuery) ||
            ex.equipment.toLowerCase().includes(lowerQuery)
        )
    }

    /**
     * Get unique muscle groups
     */
    const muscleGroups = computed(() => {
        const groups = new Set(exerciseLibrary.value.map(ex => ex.muscle_group))
        return Array.from(groups).sort()
    })

    /**
     * Initialize library (load from cache, only sync with API if cache is empty)
     */
    async function initLibrary(): Promise<void> {
        // First load from cache for instant availability
        const cached = await loadFromCache()

        // Only sync with API if cache is empty (first time or cleared)
        if (cached.length === 0) {
            console.log('[ExerciseLibrary] Cache empty, fetching from API')
            await fetchAndCacheExercises()
        } else {
            console.log(`[ExerciseLibrary] Using cached ${cached.length} exercises`)
        }
    }

    /**
     * Force sync with API (used after creating/updating exercises)
     * This always fetches from API and updates local DB
     */
    async function forceSync(): Promise<void> {
        console.log('[ExerciseLibrary] Force syncing with API...')
        await fetchAndCacheExercises()
    }

    return {
        // State (with aliases for convenience)
        exercises: exerciseLibrary,
        loading: isLoadingLibrary,
        error: libraryError,
        // Legacy names
        exerciseLibrary,
        isLoadingLibrary,
        libraryError,
        // Methods
        fetchAndCacheExercises,
        loadFromCache,
        getByMuscleGroup,
        searchExercises,
        muscleGroups,
        initLibrary,
        forceSync
    }
}
