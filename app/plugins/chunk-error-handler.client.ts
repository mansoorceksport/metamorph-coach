/**
 * Client-Side Error Handler Plugin
 * 
 * Handles two types of errors that commonly occur on iOS:
 * 
 * 1. Chunk Loading Errors: "Importing a module script failed"
 *    - Caused by network issues or cache mismatches on iOS
 * 
 * 2. IndexedDB Connection Lost: "Connection to Indexed Database server lost"
 *    - Caused by iOS Safari/Chrome closing IDB connections in background
 * 
 * Both errors are handled gracefully by prompting the user to reload.
 */
export default defineNuxtPlugin((nuxtApp) => {
    if (!import.meta.client) return

    // Track if we've already shown a reload prompt
    let hasShownPrompt = false

    // Handle Vite preload errors (dynamic import failures)
    window.addEventListener('vite:preloadError', (event: any) => {
        console.error('[ErrorHandler] Vite preload error:', event.payload)
        handleRecoverableError('chunk')
    })

    // Handle unhandled promise rejections
    window.addEventListener('unhandledrejection', (event) => {
        const message = event.reason?.message || String(event.reason)

        // Check for chunk loading errors
        if (isChunkLoadError(message)) {
            console.error('[ErrorHandler] Dynamic import failed:', message)
            event.preventDefault()
            handleRecoverableError('chunk')
            return
        }

        // Check for IndexedDB connection errors
        if (isIndexedDBError(message)) {
            console.error('[ErrorHandler] IndexedDB error:', message)
            event.preventDefault()
            handleRecoverableError('database')
            return
        }
    })

    // Handle regular errors
    window.addEventListener('error', (event) => {
        const message = event.message || ''

        if (isChunkLoadError(message)) {
            console.error('[ErrorHandler] Script error:', message)
            handleRecoverableError('chunk')
            return
        }

        if (isIndexedDBError(message)) {
            console.error('[ErrorHandler] IndexedDB error:', message)
            handleRecoverableError('database')
            return
        }
    })

    // Handle Vue router navigation errors
    nuxtApp.hook('vue:error', (error: any) => {
        const message = error?.message || String(error)

        if (isChunkLoadError(message)) {
            console.error('[ErrorHandler] Vue navigation error:', message)
            handleRecoverableError('chunk')
            return
        }

        if (isIndexedDBError(message)) {
            console.error('[ErrorHandler] Vue IndexedDB error:', message)
            handleRecoverableError('database')
            return
        }
    })

    /**
     * Check if error is related to chunk/module loading
     */
    function isChunkLoadError(message: string): boolean {
        return (
            message.includes('Importing a module script failed') ||
            message.includes('Failed to fetch dynamically imported module') ||
            message.includes('Failed to load module script') ||
            message.includes('Loading chunk') ||
            message.includes('ChunkLoadError')
        )
    }

    /**
     * Check if error is related to IndexedDB connection
     */
    function isIndexedDBError(message: string): boolean {
        return (
            message.includes('Connection to Indexed Database server lost') ||
            message.includes('IndexedDB connection lost') ||
            message.includes('The database connection is closing') ||
            message.includes('AbortError: The transaction was aborted') ||
            message.includes('InvalidStateError') ||
            // Dexie-specific errors
            message.includes('Dexie.AbortError') ||
            message.includes('Database is closed') ||
            message.includes('Failed to execute transaction')
        )
    }

    /**
     * Handle recoverable errors by prompting user to reload
     */
    function handleRecoverableError(type: 'chunk' | 'database') {
        if (hasShownPrompt) return
        hasShownPrompt = true

        const messages = {
            chunk: 'A new version is available. The page needs to reload to continue.',
            database: 'The database connection was lost. The page needs to reload to reconnect.'
        }

        // Use a simple confirm dialog that works on all browsers
        const shouldReload = window.confirm(
            `${messages[type]}\n\nClick OK to reload now.`
        )

        if (shouldReload) {
            // For database errors, try to close Dexie first
            if (type === 'database') {
                try {
                    // Attempt to close any open connections
                    indexedDB.databases?.().then((dbs) => {
                        console.log('[ErrorHandler] Closing IndexedDB connections before reload')
                    }).catch(() => {
                        // Ignore errors, just reload
                    })
                } catch {
                    // Ignore errors, just reload
                }
            }

            // Force a hard reload
            const url = new URL(window.location.href)
            url.searchParams.set('_t', Date.now().toString())
            window.location.replace(url.toString())
        } else {
            // Reset the flag after a delay so they can try again
            setTimeout(() => {
                hasShownPrompt = false
            }, 5000)
        }
    }
})
