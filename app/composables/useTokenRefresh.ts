/**
 * Token Refresh Composable
 * Handles automatic token refresh and request retry
 */

// Token refresh state
const isRefreshing = ref(false)
const refreshPromise = ref<Promise<boolean> | null>(null)

export function useTokenRefresh() {
    const config = useRuntimeConfig()

    /**
     * Get the current access token
     */
    function getAccessToken(): string | null {
        if (!import.meta.client) return null
        const tokenCookie = useCookie('metamorph-token')
        return tokenCookie.value || null
    }

    /**
     * Set the access token
     */
    function setAccessToken(token: string, expiresIn?: number) {
        const tokenCookie = useCookie('metamorph-token', {
            maxAge: expiresIn || 900, // Default 15 min
            path: '/',
            sameSite: 'strict'
        })
        tokenCookie.value = token
    }

    /**
     * Clear the access token
     */
    function clearAccessToken() {
        const tokenCookie = useCookie('metamorph-token')
        tokenCookie.value = null
    }

    /**
     * Check if access token is expired or about to expire (within 2 minutes)
     */
    function isTokenExpiringSoon(): boolean {
        const token = getAccessToken()
        if (!token) return true

        try {
            // Decode JWT to check expiry (without verification)
            const parts = token.split('.')
            if (parts.length !== 3) return true // Invalid format
            const payloadPart = parts[1] as string
            const payload = JSON.parse(atob(payloadPart))
            const expiresAt = payload.exp * 1000 // Convert to ms
            const now = Date.now()
            const bufferMs = 2 * 60 * 1000 // 2 minutes buffer

            return now >= (expiresAt - bufferMs)
        } catch {
            return true // Assume expired if can't parse
        }
    }

    /**
     * Refresh the access token using the refresh token cookie
     * Returns true if refresh succeeded, false otherwise
     */
    async function refreshAccessToken(): Promise<boolean> {
        // If already refreshing, wait for that promise
        if (isRefreshing.value && refreshPromise.value) {
            return refreshPromise.value
        }

        isRefreshing.value = true

        refreshPromise.value = (async () => {
            try {
                console.log('[TokenRefresh] Refreshing access token...')

                const response = await $fetch<{
                    token: string
                    expires_in: number
                }>('/api/v1/auth/refresh', {
                    method: 'POST',
                    credentials: 'include', // Include httpOnly cookie
                })

                // Update access token
                setAccessToken(response.token, response.expires_in)
                console.log('[TokenRefresh] Token refreshed successfully')

                return true
            } catch (error: any) {
                console.error('[TokenRefresh] Failed to refresh token:', error)
                // Clear access token on refresh failure
                clearAccessToken()
                return false
            } finally {
                isRefreshing.value = false
                refreshPromise.value = null
            }
        })()

        return refreshPromise.value
    }

    /**
     * Ensure we have a valid token before making a request
     * Proactively refreshes if token is about to expire
     */
    async function ensureValidToken(): Promise<boolean> {
        const token = getAccessToken()

        if (!token) {
            // No token at all, try to refresh (might have refresh cookie)
            return await refreshAccessToken()
        }

        if (isTokenExpiringSoon()) {
            // Token expiring soon, refresh proactively
            return await refreshAccessToken()
        }

        return true
    }

    /**
     * Logout - clear tokens and call backend
     */
    async function logout(): Promise<void> {
        try {
            await $fetch('/api/v1/auth/logout', {
                method: 'POST',
                credentials: 'include',
            })
        } catch (error) {
            console.error('[TokenRefresh] Logout request failed:', error)
        } finally {
            clearAccessToken()
        }
    }

    return {
        getAccessToken,
        setAccessToken,
        clearAccessToken,
        isTokenExpiringSoon,
        refreshAccessToken,
        ensureValidToken,
        logout,
        isRefreshing: readonly(isRefreshing)
    }
}
