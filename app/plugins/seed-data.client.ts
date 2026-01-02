/**
 * Seed Data Plugin
 * Seeds initial demo data for schedules, exercises, and planned workouts
 * Only runs once on first app launch (checks if data already exists)
 * Uses ULID for all IDs to ensure global uniqueness
 */
import { db, type Schedule, type Exercise, type PlannedExercise } from '~/utils/db'
import { generateId } from '~/utils/crypto'

// Generate stable ULIDs for seed data (regenerated on each fresh seed)
function createSeedIds() {
    return {
        // Schedules
        schedule1: generateId(),
        schedule2: generateId(),
        schedule3: generateId(),
        // Members
        member1: generateId(),
        member2: generateId(),
        member3: generateId(),
        // Exercises
        ex1: generateId(),
        ex2: generateId(),
        ex3: generateId(),
        ex4: generateId(),
        ex5: generateId(),
        ex6: generateId(),
        ex7: generateId(),
        ex8: generateId(),
        ex9: generateId(),
        ex10: generateId(),
        ex11: generateId(),
        ex12: generateId(),
        ex13: generateId(),
        ex14: generateId(),
        ex15: generateId(),
        // Planned Exercises
        pe1: generateId(),
        pe2: generateId(),
        pe3: generateId(),
        pe4: generateId(),
        pe5: generateId(),
        pe6: generateId(),
        pe7: generateId(),
        pe8: generateId(),
        pe9: generateId(),
        pe10: generateId(),
        pe11: generateId(),
        pe12: generateId(),
        pe13: generateId()
    }
}

export default defineNuxtPlugin(async () => {
    // Only run on client
    if (!import.meta.client) return

    try {
        // Check if data already seeded
        const existingSchedules = await db.schedules.count()
        const existingExercises = await db.exercises.count()
        const existingPlanned = await db.plannedExercises.count()

        // If all tables have data, only refresh schedule times
        if (existingSchedules > 0 && existingExercises > 0 && existingPlanned > 0) {
            console.log('[SeedData] Data exists, refreshing schedule times for today...')
            await refreshScheduleTimes()
            return
        }

        // Fresh seed needed - generate all IDs
        console.log('[SeedData] Fresh database detected, seeding with ULIDs...')
        const ids = createSeedIds()
        const today = new Date()

        // Seed schedules
        const schedules: Schedule[] = [
            {
                id: ids.schedule1,
                member_id: ids.member1,
                start_time: new Date(today.getFullYear(), today.getMonth(), today.getDate(), 9, 0).toISOString(),
                status: 'scheduled',
                member_name: 'Sarah Jenkins',
                member_avatar: '',
                churn_score: 15,
                attendance_trend: 'rising',
                session_goal: 'Leg Day - Hypertrophy Focus'
            },
            {
                id: ids.schedule2,
                member_id: ids.member2,
                start_time: new Date(today.getFullYear(), today.getMonth(), today.getDate(), 14, 0).toISOString(),
                status: 'scheduled',
                member_name: 'Mike Chen',
                member_avatar: '',
                churn_score: 45,
                attendance_trend: 'stable',
                session_goal: 'Upper Body - Strength'
            },
            {
                id: ids.schedule3,
                member_id: ids.member3,
                start_time: new Date(today.getFullYear(), today.getMonth(), today.getDate(), 16, 30).toISOString(),
                status: 'scheduled',
                member_name: 'Emma Wilson',
                member_avatar: '',
                churn_score: 72,
                attendance_trend: 'declining',
                session_goal: 'Full Body - Maintenance'
            }
        ]

        // Seed exercises
        const exercises: Exercise[] = [
            // Legs
            { id: ids.ex1, name: 'Barbell Back Squat', muscle_group: 'Legs', equipment: 'Barbell', personal_best_weight: 80, last_3_weights_history: [70, 75, 80] },
            { id: ids.ex2, name: 'Romanian Deadlift', muscle_group: 'Legs', equipment: 'Barbell', personal_best_weight: 70, last_3_weights_history: [60, 65, 70] },
            { id: ids.ex3, name: 'Leg Press', muscle_group: 'Legs', equipment: 'Machine', personal_best_weight: 150, last_3_weights_history: [130, 140, 150] },
            { id: ids.ex4, name: 'Walking Lunges', muscle_group: 'Legs', equipment: 'Dumbbells', personal_best_weight: 20, last_3_weights_history: [15, 18, 20] },
            { id: ids.ex5, name: 'Leg Curl', muscle_group: 'Legs', equipment: 'Machine', personal_best_weight: 40, last_3_weights_history: [30, 35, 40] },
            { id: ids.ex6, name: 'Calf Raises', muscle_group: 'Legs', equipment: 'Machine', personal_best_weight: 60, last_3_weights_history: [50, 55, 60] },
            // Upper Body
            { id: ids.ex7, name: 'Bench Press', muscle_group: 'Chest', equipment: 'Barbell', personal_best_weight: 60, last_3_weights_history: [50, 55, 60] },
            { id: ids.ex8, name: 'Incline Dumbbell Press', muscle_group: 'Chest', equipment: 'Dumbbells', personal_best_weight: 25, last_3_weights_history: [20, 22, 25] },
            { id: ids.ex9, name: 'Lat Pulldown', muscle_group: 'Back', equipment: 'Cable', personal_best_weight: 55, last_3_weights_history: [45, 50, 55] },
            { id: ids.ex10, name: 'Seated Row', muscle_group: 'Back', equipment: 'Cable', personal_best_weight: 50, last_3_weights_history: [40, 45, 50] },
            { id: ids.ex11, name: 'Shoulder Press', muscle_group: 'Shoulders', equipment: 'Dumbbells', personal_best_weight: 20, last_3_weights_history: [15, 18, 20] },
            { id: ids.ex12, name: 'Bicep Curls', muscle_group: 'Arms', equipment: 'Dumbbells', personal_best_weight: 12, last_3_weights_history: [10, 11, 12] },
            { id: ids.ex13, name: 'Tricep Pushdown', muscle_group: 'Arms', equipment: 'Cable', personal_best_weight: 25, last_3_weights_history: [20, 22, 25] },
            // Core
            { id: ids.ex14, name: 'Plank', muscle_group: 'Core', equipment: 'Bodyweight', personal_best_weight: 0, last_3_weights_history: [] },
            { id: ids.ex15, name: 'Russian Twists', muscle_group: 'Core', equipment: 'Medicine Ball', personal_best_weight: 8, last_3_weights_history: [5, 6, 8] }
        ]

        // Seed planned exercises (linking schedules to exercises)
        const plannedExercises: PlannedExercise[] = [
            // Session 1: Sarah - Leg Day
            { id: ids.pe1, schedule_id: ids.schedule1, exercise_id: ids.ex1, name: 'Barbell Back Squat', target_sets: 4, target_reps: 8, rest_seconds: 120, notes: 'Focus on depth and controlled eccentric', order: 1 },
            { id: ids.pe2, schedule_id: ids.schedule1, exercise_id: ids.ex2, name: 'Romanian Deadlift', target_sets: 3, target_reps: 10, rest_seconds: 90, notes: 'Maintain neutral spine', order: 2 },
            { id: ids.pe3, schedule_id: ids.schedule1, exercise_id: ids.ex3, name: 'Leg Press', target_sets: 3, target_reps: 12, rest_seconds: 60, notes: 'Full range of motion', order: 3 },
            { id: ids.pe4, schedule_id: ids.schedule1, exercise_id: ids.ex4, name: 'Walking Lunges', target_sets: 3, target_reps: 12, rest_seconds: 60, notes: 'Each leg counts as 1 rep', order: 4 },

            // Session 2: Mike - Upper Body
            { id: ids.pe5, schedule_id: ids.schedule2, exercise_id: ids.ex7, name: 'Bench Press', target_sets: 4, target_reps: 6, rest_seconds: 180, notes: 'Strength focus - heavy weight', order: 1 },
            { id: ids.pe6, schedule_id: ids.schedule2, exercise_id: ids.ex8, name: 'Incline Dumbbell Press', target_sets: 3, target_reps: 10, rest_seconds: 90, notes: 'Full stretch at bottom', order: 2 },
            { id: ids.pe7, schedule_id: ids.schedule2, exercise_id: ids.ex9, name: 'Lat Pulldown', target_sets: 4, target_reps: 8, rest_seconds: 90, notes: 'Squeeze lats at bottom', order: 3 },
            { id: ids.pe8, schedule_id: ids.schedule2, exercise_id: ids.ex10, name: 'Seated Row', target_sets: 3, target_reps: 10, rest_seconds: 60, notes: 'Keep chest up', order: 4 },
            { id: ids.pe9, schedule_id: ids.schedule2, exercise_id: ids.ex11, name: 'Shoulder Press', target_sets: 3, target_reps: 10, rest_seconds: 60, notes: 'Control the weight', order: 5 },

            // Session 3: Emma - Full Body
            { id: ids.pe10, schedule_id: ids.schedule3, exercise_id: ids.ex1, name: 'Barbell Back Squat', target_sets: 3, target_reps: 10, rest_seconds: 90, notes: 'Moderate weight, focus on form', order: 1 },
            { id: ids.pe11, schedule_id: ids.schedule3, exercise_id: ids.ex7, name: 'Bench Press', target_sets: 3, target_reps: 10, rest_seconds: 90, notes: 'Controlled tempo', order: 2 },
            { id: ids.pe12, schedule_id: ids.schedule3, exercise_id: ids.ex9, name: 'Lat Pulldown', target_sets: 3, target_reps: 12, rest_seconds: 60, notes: 'Mind-muscle connection', order: 3 },
            { id: ids.pe13, schedule_id: ids.schedule3, exercise_id: ids.ex14, name: 'Plank', target_sets: 3, target_reps: 60, rest_seconds: 30, notes: '60 seconds hold', order: 4 }
        ]

        // Bulk insert all data
        console.log('[SeedData] Seeding schedules with ULIDs...')
        await db.schedules.bulkPut(schedules)

        console.log('[SeedData] Seeding exercises with ULIDs...')
        await db.exercises.bulkPut(exercises)

        console.log('[SeedData] Seeding planned exercises with ULIDs...')
        await db.plannedExercises.bulkPut(plannedExercises)

        console.log('[SeedData] Database seeded successfully with ULIDs')

    } catch (error) {
        console.error('[SeedData] Failed to seed data:', error)
    }
})

/**
 * Refresh schedule times to today while preserving status
 */
async function refreshScheduleTimes(): Promise<void> {
    const today = new Date()
    const schedules = await db.schedules.toArray()

    for (const schedule of schedules) {
        const existingTime = new Date(schedule.start_time)
        const newTime = new Date(
            today.getFullYear(),
            today.getMonth(),
            today.getDate(),
            existingTime.getHours(),
            existingTime.getMinutes()
        )

        // Only update if the date changed (not time)
        if (newTime.toDateString() !== existingTime.toDateString()) {
            await db.schedules.update(schedule.id, {
                start_time: newTime.toISOString()
            })
        }
    }
    console.log('[SeedData] Schedule times refreshed for today')
}
