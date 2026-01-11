/**
 * Auth Middleware
 * Redirects unauthenticated users to login page
 * Attempts silent token refresh if access token is expired
 */
export default defineNuxtRouteMiddleware(async (to) => {
    // Skip middleware on login page
    if (to.path === '/login') {
        return
    }

    // Check for auth token
    const token = useCookie('metamorph-token')

    if (!token.value) {
        // No access token - try to refresh using refresh token cookie
        if (import.meta.client) {
            console.log('[Auth Middleware] No token, attempting silent refresh...')

            try {
                const response = await $fetch<{
                    token: string
                    expires_in: number
                }>('/api/v1/auth/refresh', {
                    method: 'POST',
                    credentials: 'include', // Include httpOnly refresh token cookie
                })

                if (response?.token) {
                    // Set the new token and allow navigation
                    token.value = response.token
                    console.log('[Auth Middleware] Silent refresh successful!')
                    return // Continue to requested page
                }
            } catch (error) {
                console.log('[Auth Middleware] Silent refresh failed:', error)
            }
        }

        // No token and refresh failed - redirect to login
        console.log('[Auth Middleware] No valid token, redirecting to login')
        return navigateTo('/login')
    }

    // Token exists - check if it's about to expire
    if (import.meta.client) {
        try {
            const parts = token.value.split('.')
            if (parts.length === 3) {
                const payload = JSON.parse(atob(parts[1] as string))
                const expiresAt = payload.exp * 1000
                const bufferMs = 2 * 60 * 1000 // 2 min buffer

                if (Date.now() >= expiresAt - bufferMs) {
                    // Token expiring soon, try proactive refresh
                    console.log('[Auth Middleware] Token expiring soon, refreshing...')

                    try {
                        const response = await $fetch<{
                            token: string
                            expires_in: number
                        }>('/api/v1/auth/refresh', {
                            method: 'POST',
                            credentials: 'include',
                        })

                        if (response?.token) {
                            token.value = response.token
                            console.log('[Auth Middleware] Proactive refresh successful!')
                        }
                    } catch (error) {
                        console.warn('[Auth Middleware] Proactive refresh failed:', error)
                        // Don't redirect - token might still be valid for a bit
                    }
                }
            }
        } catch (error) {
            console.warn('[Auth Middleware] Token validation error:', error)
        }
    }
})
