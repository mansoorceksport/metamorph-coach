// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  modules: [
    '@nuxt/eslint',
    '@nuxt/ui',
    '@nuxt/hints',
    '@nuxt/image',
    '@nuxt/test-utils',
    '@sentry/nuxt/module'
  ],

  runtimeConfig: {
    public: {
      firebaseApiKey: process.env.NUXT_PUBLIC_FIREBASE_API_KEY,
      firebaseAuthDomain: process.env.NUXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
      firebaseProjectId: process.env.NUXT_PUBLIC_FIREBASE_PROJECT_ID,
      firebaseStorageBucket: process.env.NUXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
      firebaseMessagingSenderId: process.env.NUXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
      firebaseAppId: process.env.NUXT_PUBLIC_FIREBASE_APP_ID,
      apiBase: process.env.NUXT_PUBLIC_API_BASE || 'http://localhost:8080',
      // Sentry configuration
      sentryDsn: process.env.SENTRY_DSN,
      appVersion: process.env.APP_VERSION || '1.0.0'
    }
  },

  // Sentry configuration
  sentry: {
    sourceMapsUploadOptions: {
      org: 'metamorph',
      project: 'metamorph-coach'
    }
  },

  devtools: {
    enabled: true
  },

  css: ['~/assets/css/main.css'],

  routeRules: {
    '/': { prerender: true },
    // Proxy API requests to backend - Nitro automatically forwards cookies
    '/api/v1/**': { proxy: `${process.env.NUXT_PUBLIC_API_BASE || 'http://localhost:8080'}/v1/**` }
  },

  compatibilityDate: '2025-01-15',

  eslint: {
    config: {
      stylistic: {
        commaDangle: 'never',
        braceStyle: '1tbs'
      }
    }
  },

  // Enable source maps for Sentry stack traces
  sourcemap: {
    client: true
  }
})