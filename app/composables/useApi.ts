/**
 * API Composable
 * Provides authenticated API calls to the Metamorph backend
 * with local-first sync support
 */
import { type CachedMember, type Schedule } from '~/utils/db'

// Types matching backend responses
export interface ClientResponse {
    id: string
    name: string
    email: string
    avatar?: string
    active_contract_id: string
    remaining_sessions: number
    churn_score: number
    attendance_trend: 'rising' | 'stable' | 'declining'
    last_session_date?: string
    total_sessions: number
}

export interface ScheduleResponse {
    id: string
    client_id?: string  // Frontend ULID for dual-identity
    tenant_id: string
    branch_id: string
    contract_id: string
    coach_id: string
    member_id: string
    start_time: string
    end_time: string
    status: string
    session_goal?: string
    remarks?: string
    member_name: string // Denormalized from backend
    created_at: string
    updated_at: string
}

export interface CreateScheduleRequest {
    member_id: string
    start_time: string // ISO datetime
    session_goal?: string
    remarks?: string
    // contract_id is auto-resolved by backend
}

export function useApi() {
    const config = useRuntimeConfig()
    const { metamorphToken } = useAuth()

    const baseUrl = config.public.apiBase || ''

    /**
     * Make an authenticated API request with automatic 401 retry
     */
    async function apiFetch<T>(
        endpoint: string,
        options: {
            method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
            body?: any
            query?: Record<string, string>
        } = {},
        _retried = false // Internal flag to prevent infinite retry
    ): Promise<T> {
        const token = metamorphToken.value
        if (!token) {
            throw new Error('Not authenticated')
        }

        const url = new URL(`${baseUrl}${endpoint}`)
        if (options.query) {
            Object.entries(options.query).forEach(([key, value]) => {
                if (value) url.searchParams.set(key, value)
            })
        }

        try {
            const response = await $fetch<T>(url.toString(), {
                method: options.method || 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: options.body ? JSON.stringify(options.body) : undefined,
                credentials: 'include', // Include cookies for refresh
            })

            return response
        } catch (error: any) {
            // Check for 401 and attempt token refresh if not already retried
            if (error?.response?.status === 401 && !_retried) {
                console.log('[API] Got 401, attempting token refresh...')

                try {
                    // Try to refresh the token
                    const refreshResponse = await $fetch<{
                        token: string
                        expires_in: number
                    }>(`${baseUrl}/v1/auth/refresh`, {
                        method: 'POST',
                        credentials: 'include',
                    })

                    if (refreshResponse?.token) {
                        // Update the token cookie
                        const tokenCookie = useCookie('metamorph-token', {
                            maxAge: refreshResponse.expires_in || 900,
                            path: '/',
                            sameSite: 'lax'
                        })
                        tokenCookie.value = refreshResponse.token
                        console.log('[API] Token refreshed, retrying original request...')

                        // Retry the original request with new token
                        return await apiFetch<T>(endpoint, options, true)
                    }
                } catch (refreshError) {
                    console.error('[API] Token refresh failed:', refreshError)
                    // Clear token and let the error propagate
                    const tokenCookie = useCookie('metamorph-token')
                    tokenCookie.value = null
                }
            }

            throw error
        }
    }

    // ============================================
    // CLIENT ENDPOINTS
    // ============================================

    /**
     * Fetch all clients (members) for the authenticated coach
     */
    async function fetchClients(): Promise<ClientResponse[]> {
        return await apiFetch<ClientResponse[]>('/v1/pro/clients')
    }

    // ============================================
    // SCHEDULE ENDPOINTS
    // ============================================

    /**
     * Fetch schedules for a date range
     */
    async function fetchSchedules(from?: Date, to?: Date): Promise<ScheduleResponse[]> {
        const query: Record<string, string> = {}
        if (from) {
            const fromStr = from.toISOString().split('T')[0]
            if (fromStr) query.from = fromStr
        }
        if (to) {
            const toStr = to.toISOString().split('T')[0]
            if (toStr) query.to = toStr
        }

        return await apiFetch<ScheduleResponse[]>('/v1/pro/schedules', { query })
    }

    /**
     * Create a new schedule
     */
    async function createSchedule(data: CreateScheduleRequest): Promise<ScheduleResponse> {
        return await apiFetch<ScheduleResponse>('/v1/pro/schedules', {
            method: 'POST',
            body: data
        })
    }

    /**
     * Complete a schedule
     */
    async function completeSchedule(scheduleId: string): Promise<void> {
        await apiFetch(`/v1/pro/schedules/${scheduleId}/complete`, {
            method: 'POST'
        })
    }

    // ============================================
    // SYNC HELPERS
    // ============================================

    /**
     * Convert API client response to CachedMember for local storage
     */
    function clientToCachedMember(client: ClientResponse): CachedMember {
        return {
            id: client.id,
            name: client.name,
            email: client.email,
            avatar: client.avatar,
            active_contract_id: client.active_contract_id,
            remaining_sessions: client.remaining_sessions,
            churn_score: client.churn_score,
            attendance_trend: client.attendance_trend,
            last_session_date: client.last_session_date,
            total_sessions: client.total_sessions,
            cached_at: Date.now()
        }
    }

    async function fetchSets(scheduleId: string) {
        return await apiFetch<any[]>(`/v1/pro/schedules/${scheduleId}/sets`)
    }

    async function fetchExercises(scheduleId: string) {
        return await apiFetch<any[]>(`/v1/pro/schedules/${scheduleId}/exercises`)
    }

    /**
     * Fetch master exercise library
     */
    async function fetchMasterExercises() {
        return await apiFetch<any[]>('/v1/exercises')
    }

    /**
     * Convert API schedule response to local Schedule format
     * Uses client_id (ULID) as primary key if present, with MongoDB ID as remote_id
     */
    function scheduleResponseToLocal(schedule: ScheduleResponse): Schedule {
        // Map backend status to frontend status (handle case differences)
        const statusMap: Record<string, Schedule['status']> = {
            'Scheduled': 'scheduled',
            'Completed': 'completed',
            'No-Show': 'no-show',
            'Cancelled': 'cancelled',
            'Pending_Confirmation': 'scheduled', // Treat as scheduled on frontend
            // Lowercase fallbacks
            'scheduled': 'scheduled',
            'completed': 'completed',
            'no-show': 'no-show',
            'cancelled': 'cancelled',
            'in-progress': 'in-progress'
        }

        // Dual-identity: use client_id as local primary key if available
        const localId = schedule.client_id || schedule.id
        const remoteId = schedule.client_id ? schedule.id : null

        return {
            id: localId,
            remote_id: remoteId,
            sync_status: 'synced', // Came from backend, so it's synced
            member_id: schedule.member_id,
            member_name: schedule.member_name || '',
            start_time: schedule.start_time,
            end_time: schedule.end_time,
            status: statusMap[schedule.status] || 'scheduled',
            session_goal: schedule.session_goal,
            coach_remarks: schedule.remarks,
            // These will be computed/cached separately
            churn_score: 50,
            attendance_trend: 'stable'
        }
    }

    return {
        // Raw API calls
        apiFetch,
        fetchClients,
        fetchSchedules,
        fetchSets,
        fetchExercises,
        fetchMasterExercises,
        createSchedule,
        completeSchedule,
        // Sync helpers
        clientToCachedMember,
        scheduleResponseToLocal
    }
}
