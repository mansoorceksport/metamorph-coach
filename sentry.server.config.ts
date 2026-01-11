/**
 * Sentry Server Configuration
 * https://docs.sentry.io/platforms/javascript/guides/nuxt/
 */
import * as Sentry from '@sentry/nuxt'

Sentry.init({
    // DSN from environment variable
    dsn: process.env.SENTRY_DSN,

    // Performance Monitoring  
    tracesSampleRate: 1.0, // Capture 100% of transactions (reduce in production)

    // Environment
    environment: process.env.NODE_ENV || 'development',

    // Only send errors in production
    enabled: process.env.NODE_ENV === 'production'
})
