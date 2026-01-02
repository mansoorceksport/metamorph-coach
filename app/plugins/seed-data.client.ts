/**
 * Seed Data Plugin
 * Seeds initial demo data for schedules, exercises, and planned workouts
 * Only runs once on first app launch (checks if data already exists)
 */
import { db, type Schedule, type Exercise, type PlannedExercise } from '~/utils/db'

// Demo schedules for today
const DEMO_SCHEDULES: Schedule[] = [
    {
        id: 's1',
        member_id: 'm1',
        start_time: new Date().toISOString(),
        status: 'in-progress',
        member_name: 'Sarah Jenkins',
        member_avatar: '',
        churn_score: 15,
        attendance_trend: 'rising',
        session_goal: 'Leg Day - Hypertrophy Focus'
    },
    {
        id: 's2',
        member_id: 'm2',
        start_time: new Date(Date.now() + 3600000).toISOString(), // 1 hour from now
        status: 'scheduled',
        member_name: 'Mike Chen',
        member_avatar: '',
        churn_score: 45,
        attendance_trend: 'stable',
        session_goal: 'Upper Body - Strength'
    },
    {
        id: 's3',
        member_id: 'm3',
        start_time: new Date(Date.now() + 7200000).toISOString(), // 2 hours from now
        status: 'scheduled',
        member_name: 'Emma Wilson',
        member_avatar: '',
        churn_score: 72,
        attendance_trend: 'declining',
        session_goal: 'Full Body - Maintenance'
    }
]

// Exercise library with PB data
const DEMO_EXERCISES: Exercise[] = [
    // Legs
    { id: 'ex1', name: 'Barbell Back Squat', muscle_group: 'Legs', equipment: 'Barbell', personal_best_weight: 80, last_3_weights_history: [70, 75, 80] },
    { id: 'ex2', name: 'Romanian Deadlift', muscle_group: 'Legs', equipment: 'Barbell', personal_best_weight: 70, last_3_weights_history: [60, 65, 70] },
    { id: 'ex3', name: 'Leg Press', muscle_group: 'Legs', equipment: 'Machine', personal_best_weight: 150, last_3_weights_history: [130, 140, 150] },
    { id: 'ex4', name: 'Walking Lunges', muscle_group: 'Legs', equipment: 'Dumbbells', personal_best_weight: 20, last_3_weights_history: [15, 18, 20] },
    { id: 'ex5', name: 'Leg Curl', muscle_group: 'Legs', equipment: 'Machine', personal_best_weight: 40, last_3_weights_history: [30, 35, 40] },
    { id: 'ex6', name: 'Calf Raises', muscle_group: 'Legs', equipment: 'Machine', personal_best_weight: 60, last_3_weights_history: [50, 55, 60] },
    // Upper Body
    { id: 'ex7', name: 'Bench Press', muscle_group: 'Chest', equipment: 'Barbell', personal_best_weight: 60, last_3_weights_history: [50, 55, 60] },
    { id: 'ex8', name: 'Incline Dumbbell Press', muscle_group: 'Chest', equipment: 'Dumbbells', personal_best_weight: 25, last_3_weights_history: [20, 22, 25] },
    { id: 'ex9', name: 'Lat Pulldown', muscle_group: 'Back', equipment: 'Cable', personal_best_weight: 55, last_3_weights_history: [45, 50, 55] },
    { id: 'ex10', name: 'Seated Row', muscle_group: 'Back', equipment: 'Cable', personal_best_weight: 50, last_3_weights_history: [40, 45, 50] },
    { id: 'ex11', name: 'Shoulder Press', muscle_group: 'Shoulders', equipment: 'Dumbbells', personal_best_weight: 20, last_3_weights_history: [15, 18, 20] },
    { id: 'ex12', name: 'Bicep Curls', muscle_group: 'Arms', equipment: 'Dumbbells', personal_best_weight: 12, last_3_weights_history: [10, 11, 12] },
    { id: 'ex13', name: 'Tricep Pushdown', muscle_group: 'Arms', equipment: 'Cable', personal_best_weight: 25, last_3_weights_history: [20, 22, 25] },
    // Core
    { id: 'ex14', name: 'Plank', muscle_group: 'Core', equipment: 'Bodyweight', personal_best_weight: 0, last_3_weights_history: [] },
    { id: 'ex15', name: 'Russian Twists', muscle_group: 'Core', equipment: 'Medicine Ball', personal_best_weight: 8, last_3_weights_history: [5, 6, 8] }
]

// Planned exercises for each session (different workouts per member)
const DEMO_PLANNED_EXERCISES: Omit<PlannedExercise, 'id'>[] = [
    // Session 1: Sarah - Leg Day
    { schedule_id: 's1', exercise_id: 'ex1', name: 'Barbell Back Squat', target_sets: 4, target_reps: 8, rest_seconds: 120, notes: 'Focus on depth and controlled eccentric', order: 1 },
    { schedule_id: 's1', exercise_id: 'ex2', name: 'Romanian Deadlift', target_sets: 3, target_reps: 10, rest_seconds: 90, notes: 'Maintain neutral spine', order: 2 },
    { schedule_id: 's1', exercise_id: 'ex3', name: 'Leg Press', target_sets: 3, target_reps: 12, rest_seconds: 60, notes: 'Full range of motion', order: 3 },
    { schedule_id: 's1', exercise_id: 'ex4', name: 'Walking Lunges', target_sets: 3, target_reps: 12, rest_seconds: 60, notes: 'Each leg counts as 1 rep', order: 4 },

    // Session 2: Mike - Upper Body
    { schedule_id: 's2', exercise_id: 'ex7', name: 'Bench Press', target_sets: 4, target_reps: 6, rest_seconds: 180, notes: 'Strength focus - heavy weight', order: 1 },
    { schedule_id: 's2', exercise_id: 'ex8', name: 'Incline Dumbbell Press', target_sets: 3, target_reps: 10, rest_seconds: 90, notes: 'Full stretch at bottom', order: 2 },
    { schedule_id: 's2', exercise_id: 'ex9', name: 'Lat Pulldown', target_sets: 4, target_reps: 8, rest_seconds: 90, notes: 'Squeeze lats at bottom', order: 3 },
    { schedule_id: 's2', exercise_id: 'ex10', name: 'Seated Row', target_sets: 3, target_reps: 10, rest_seconds: 60, notes: 'Keep chest up', order: 4 },
    { schedule_id: 's2', exercise_id: 'ex11', name: 'Shoulder Press', target_sets: 3, target_reps: 10, rest_seconds: 60, notes: 'Control the weight', order: 5 },

    // Session 3: Emma - Full Body
    { schedule_id: 's3', exercise_id: 'ex1', name: 'Barbell Back Squat', target_sets: 3, target_reps: 10, rest_seconds: 90, notes: 'Moderate weight, focus on form', order: 1 },
    { schedule_id: 's3', exercise_id: 'ex7', name: 'Bench Press', target_sets: 3, target_reps: 10, rest_seconds: 90, notes: 'Controlled tempo', order: 2 },
    { schedule_id: 's3', exercise_id: 'ex9', name: 'Lat Pulldown', target_sets: 3, target_reps: 12, rest_seconds: 60, notes: 'Mind-muscle connection', order: 3 },
    { schedule_id: 's3', exercise_id: 'ex14', name: 'Plank', target_sets: 3, target_reps: 60, rest_seconds: 30, notes: '60 seconds hold', order: 4 }
]

export default defineNuxtPlugin(async () => {
    // Only run on client
    if (!import.meta.client) return

    try {
        // Check if data already seeded
        const existingSchedules = await db.schedules.count()
        const existingExercises = await db.exercises.count()
        const existingPlanned = await db.plannedExercises.count()

        // Update schedules to use today's date, but preserve status if already exists
        // This ensures "Today's Schedule" always has data while not resetting completed sessions
        const today = new Date()

        // Define default schedules
        const defaultSchedules: Schedule[] = [
            {
                id: 's1',
                member_id: 'm1',
                start_time: new Date(today.getFullYear(), today.getMonth(), today.getDate(), 9, 0).toISOString(),
                status: 'scheduled',
                member_name: 'Sarah Jenkins',
                member_avatar: '',
                churn_score: 15,
                attendance_trend: 'rising',
                session_goal: 'Leg Day - Hypertrophy Focus'
            },
            {
                id: 's2',
                member_id: 'm2',
                start_time: new Date(today.getFullYear(), today.getMonth(), today.getDate(), 14, 0).toISOString(),
                status: 'scheduled',
                member_name: 'Mike Chen',
                member_avatar: '',
                churn_score: 45,
                attendance_trend: 'stable',
                session_goal: 'Upper Body - Strength'
            },
            {
                id: 's3',
                member_id: 'm3',
                start_time: new Date(today.getFullYear(), today.getMonth(), today.getDate(), 16, 30).toISOString(),
                status: 'scheduled',
                member_name: 'Emma Wilson',
                member_avatar: '',
                churn_score: 72,
                attendance_trend: 'declining',
                session_goal: 'Full Body - Maintenance'
            }
        ]

        // Merge with existing data (preserve status, coach_remarks, completed_at)
        const schedulesToSave: Schedule[] = []
        for (const schedule of defaultSchedules) {
            const existing = await db.schedules.get(schedule.id)
            if (existing) {
                // Update time to today but preserve mutable fields
                schedulesToSave.push({
                    ...schedule,
                    start_time: new Date(today.getFullYear(), today.getMonth(), today.getDate(),
                        new Date(existing.start_time).getHours(),
                        new Date(existing.start_time).getMinutes()
                    ).toISOString(),
                    status: existing.status, // PRESERVE STATUS
                    coach_remarks: existing.coach_remarks,
                    completed_at: existing.completed_at
                })
            } else {
                schedulesToSave.push(schedule)
            }
        }

        console.log('[SeedData] Syncing schedules for today (preserving status)...')
        await db.schedules.bulkPut(schedulesToSave)

        if (existingExercises === 0) {
            console.log('[SeedData] Seeding exercises...')
            await db.exercises.bulkPut(DEMO_EXERCISES)
        }

        if (existingPlanned === 0) {
            console.log('[SeedData] Seeding planned exercises...')
            await db.plannedExercises.bulkAdd(DEMO_PLANNED_EXERCISES)
        }

        console.log('[SeedData] Database ready')
    } catch (error) {
        console.error('[SeedData] Failed to seed data:', error)
    }
})
