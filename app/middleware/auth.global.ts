/**
 * Auth Middleware
 * Redirects unauthenticated users to login page
 */
export default defineNuxtRouteMiddleware((to) => {
    // Skip middleware on login page
    if (to.path === '/login') {
        return
    }

    // Check for auth token
    const token = useCookie('metamorph-token')

    if (!token.value) {
        console.log('[Auth Middleware] No token found, redirecting to login')
        return navigateTo('/login')
    }
})
