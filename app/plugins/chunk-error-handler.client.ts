/**
 * Chunk Load Error Handler
 * 
 * Handles "Importing a module script failed" errors that occur on iOS
 * when network issues or cache mismatches prevent loading JS chunks.
 * 
 * This plugin listens for Vite's preload errors and navigation errors,
 * then prompts the user to reload the page.
 */
export default defineNuxtPlugin((nuxtApp) => {
    if (!import.meta.client) return

    // Track if we've already shown a reload prompt
    let hasShownPrompt = false

    // Handle Vite preload errors (dynamic import failures)
    window.addEventListener('vite:preloadError', (event: any) => {
        console.error('[ChunkErrorHandler] Vite preload error:', event.payload)
        handleChunkError()
    })

    // Handle unhandled promise rejections for dynamic imports
    window.addEventListener('unhandledrejection', (event) => {
        const message = event.reason?.message || String(event.reason)

        // Check for chunk loading errors
        if (
            message.includes('Importing a module script failed') ||
            message.includes('Failed to fetch dynamically imported module') ||
            message.includes('Failed to load module script') ||
            message.includes('Loading chunk') ||
            message.includes('ChunkLoadError')
        ) {
            console.error('[ChunkErrorHandler] Dynamic import failed:', message)
            event.preventDefault() // Prevent Sentry from capturing again
            handleChunkError()
        }
    })

    // Handle regular errors for chunk loading
    window.addEventListener('error', (event) => {
        const message = event.message || ''

        if (
            message.includes('Importing a module script failed') ||
            message.includes('Failed to fetch dynamically imported module') ||
            message.includes('Loading chunk')
        ) {
            console.error('[ChunkErrorHandler] Script error:', message)
            handleChunkError()
        }
    })

    // Handle Vue router navigation errors
    nuxtApp.hook('vue:error', (error: any) => {
        const message = error?.message || String(error)

        if (
            message.includes('Importing a module script failed') ||
            message.includes('Failed to fetch dynamically imported module')
        ) {
            console.error('[ChunkErrorHandler] Vue navigation error:', message)
            handleChunkError()
        }
    })

    function handleChunkError() {
        if (hasShownPrompt) return
        hasShownPrompt = true

        // Use a simple confirm dialog that works on all browsers
        const shouldReload = window.confirm(
            'A new version is available. The page needs to reload to continue.\n\nClick OK to reload now.'
        )

        if (shouldReload) {
            // Clear any cached chunks by doing a hard reload
            // Add a cache-busting query param to ensure fresh assets
            const url = new URL(window.location.href)
            url.searchParams.set('_t', Date.now().toString())
            window.location.replace(url.toString())
        } else {
            // Reset the flag so they can try again
            hasShownPrompt = false
        }
    }
})
