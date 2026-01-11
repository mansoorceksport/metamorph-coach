/**
 * Sentry Client Configuration
 * https://docs.sentry.io/platforms/javascript/guides/nuxt/
 */
import * as Sentry from '@sentry/nuxt'

Sentry.init({
    // DSN from environment variable
    dsn: useRuntimeConfig().public.sentryDsn,

    // Release version for tracking deploys
    release: `metamorph-coach@${useRuntimeConfig().public.appVersion || '1.0.0'}`,

    // Performance Monitoring
    tracesSampleRate: 1.0, // Capture 100% of transactions (reduce in production)

    // Session Replay
    replaysSessionSampleRate: 0.1, // 10% of sessions
    replaysOnErrorSampleRate: 1.0, // 100% of sessions with errors

    // Integrations
    integrations: [
        Sentry.replayIntegration({
            // Mask all text content by default for privacy
            maskAllText: false,
            blockAllMedia: false
        })
    ],

    // Environment
    environment: process.env.NODE_ENV || 'development',

    // Only send errors in production
    enabled: process.env.NODE_ENV === 'production',

    // Filter out noisy errors
    ignoreErrors: [
        // Browser extensions
        /extensions\//i,
        /^chrome-extension:\/\//i,
        // Network errors that are expected
        'Network request failed',
        'Failed to fetch',
        // User cancelled
        'AbortError'
    ],

    // Before sending error
    beforeSend(event) {
        // Don't send if user is on localhost
        if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
            return null
        }
        return event
    }
})
