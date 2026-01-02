/**
 * Metamorph Offline-First Database Schema
 * Using Dexie.js for IndexedDB with TypeScript support
 */
import Dexie, { type EntityTable } from 'dexie'

// ============================================
// AUGMENTED TYPE DEFINITIONS
// ============================================

/**
 * Schedule with augmented intelligence fields for Command Center UI
 */
export interface Schedule {
    id: string
    member_id: string
    start_time: string // ISO datetime
    end_time?: string
    status: 'scheduled' | 'in-progress' | 'completed' | 'cancelled' | 'no-show'
    member_name: string
    member_avatar?: string
    // Augmented intelligence fields
    churn_score: number // 0-100, higher = more likely to churn
    attendance_trend: 'rising' | 'stable' | 'declining'
    session_goal?: string
    coach_remarks?: string
    completed_at?: string
}

/**
 * Exercise with PB tracking for real-time strength win alerts
 */
export interface Exercise {
    id: string
    name: string
    muscle_group: string
    equipment: string
    video_url?: string
    // Augmented fields for PB alerts
    personal_best_weight: number
    last_3_weights_history: number[] // For velocity/trend analysis
}

/**
 * Session log entry for tracking sets with PB flags
 */
export interface SessionLog {
    id?: number // Auto-increment
    schedule_id: string
    exercise_id: string
    exercise_name: string
    set_index: number
    weight: number | null
    reps: number | null
    completed: boolean
    completed_at?: string
    // Augmented fields
    is_new_pb: boolean
    velocity_delta?: number // % change from last session
    remarks?: string
}

/**
 * Sync queue entry for offline-first failure recovery
 */
export interface SyncQueueItem {
    id?: number // Auto-increment
    method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
    url: string
    body?: string // JSON stringified
    headers?: Record<string, string>
    timestamp: number // Unix timestamp
    retryCount: number
    lastError?: string
    priority: 'high' | 'normal' | 'low'
}

/**
 * Cached member data for offline roster access
 */
export interface CachedMember {
    id: string
    name: string
    avatar?: string
    email?: string
    phone?: string
    churn_score: number
    attendance_trend: 'rising' | 'stable' | 'declining'
    last_session_date?: string
    total_sessions: number
    cached_at: number // Unix timestamp
}

/**
 * Planned exercise for a session (workout plan)
 */
export interface PlannedExercise {
    id?: number // Auto-increment
    schedule_id: string
    exercise_id: string
    name: string
    target_sets: number
    target_reps: number
    rest_seconds: number
    notes?: string
    order: number
}

// ============================================
// DEXIE DATABASE CLASS
// ============================================

export class MetamorphDB extends Dexie {
    schedules!: EntityTable<Schedule, 'id'>
    exercises!: EntityTable<Exercise, 'id'>
    sessionLogs!: EntityTable<SessionLog, 'id'>
    syncQueue!: EntityTable<SyncQueueItem, 'id'>
    cachedMembers!: EntityTable<CachedMember, 'id'>
    plannedExercises!: EntityTable<PlannedExercise, 'id'>

    constructor() {
        super('MetamorphCoachDB')

        this.version(2).stores({
            // Primary key and indexed fields
            schedules: 'id, member_id, start_time, status, [start_time+status]',
            exercises: 'id, name, muscle_group',
            sessionLogs: '++id, schedule_id, exercise_id, [schedule_id+exercise_id]',
            syncQueue: '++id, timestamp, priority, retryCount',
            cachedMembers: 'id, name, churn_score, attendance_trend',
            plannedExercises: '++id, schedule_id, exercise_id, [schedule_id+order]'
        })
    }
}

// Singleton instance
export const db = new MetamorphDB()

// ============================================
// HELPER TYPES
// ============================================

export type ScheduleStatus = Schedule['status']
export type AttendanceTrend = Schedule['attendance_trend']
export type SyncPriority = SyncQueueItem['priority']
export type HttpMethod = SyncQueueItem['method']

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Get today's date range for filtering schedules
 */
export function getTodayRange(): { start: string; end: string } {
    const now = new Date()
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const end = new Date(start.getTime() + 24 * 60 * 60 * 1000)
    return {
        start: start.toISOString(),
        end: end.toISOString()
    }
}

/**
 * Check if a weight is a new personal best
 */
export function checkIfNewPB(currentWeight: number, pbWeight: number): boolean {
    return currentWeight > pbWeight && currentWeight > 0
}

/**
 * Calculate velocity delta (% change from last session)
 */
export function calculateVelocityDelta(
    currentWeight: number,
    history: number[]
): number | undefined {
    if (history.length === 0 || currentWeight <= 0) return undefined
    const lastWeight = history[history.length - 1]
    if (lastWeight <= 0) return undefined
    return Math.round(((currentWeight - lastWeight) / lastWeight) * 100)
}
