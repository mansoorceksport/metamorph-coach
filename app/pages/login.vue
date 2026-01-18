<script setup lang="ts">
definePageMeta({
  layout: false
})

const { signInWithGoogle, loading, error, isAuthenticated } = useAuth()
const toast = useToast()
const router = useRouter()

// Redirect if already authenticated
watchEffect(() => {
  if (isAuthenticated.value) {
    console.log("am i running?")
    router.push('/hydrating')
  }
})

const handleGoogleSignIn = async () => {
  try {
    await signInWithGoogle()
    toast.add({
      title: 'Success!',
      description: 'You have been signed in successfully.',
      color: 'success',
      icon: 'i-heroicons-check-circle'
    })
    
    // Explicit redirect to ensure navigation occurs
    await router.push('/hydrating')
  } catch (err: any) {
    toast.add({
      title: 'Sign In Failed',
      description: err.message || 'Failed to sign in with Google. Please try again.',
      color: 'error',
      icon: 'i-heroicons-exclamation-circle'
    })
  }
}
</script>

<template>
  <UApp>
    <div class="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-4 relative overflow-hidden">
      <!-- Enhanced background with centered teal hint -->
      <div class="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(20,184,166,0.15),transparent_60%)] pointer-events-none" />

      <!-- Login Card -->
      <UCard class="relative w-full max-w-md shadow-2xl border border-slate-800 bg-slate-900/90 backdrop-blur-sm">
        <div class="space-y-8 p-8">
          <!-- User Provided Branding from public/logo.svg -->
          <div class="flex flex-col items-center justify-center mb-8">
            <div class="w-28 h-28 bg-white rounded-full flex items-center justify-center shadow-2xl ring-4 ring-white/10">
              <svg 
                viewBox="0 0 100 100" 
                class="w-20 h-20" 
                fill="none" 
                xmlns="http://www.w3.org/2000/svg"
              >
                <path 
                  d="M22 50C22 42 28 36 35 36C40 36 45 40 50 50C55 60 60 64 65 64C72 64 78 58 78 50C78 42 72 36 65 36C60 36 55 40 50 50C45 60 40 64 35 64C28 64 22 58 22 50Z" 
                  stroke="#0e172c" 
                  stroke-width="5" 
                  stroke-linecap="round" 
                  stroke-linejoin="round"
                />
              </svg>
            </div>
            
            <h1 class="mt-8 text-3xl font-extralight tracking-[0.4em] text-white uppercase">
              Metamorph
            </h1>
            <p class="mt-2 text-slate-400 text-xs tracking-[0.3em] uppercase opacity-80">
              Intelligence & Transformation
            </p>
          </div>

          <!-- Header -->
          <div class="text-center space-y-2">
            <h2 class="text-xl font-bold text-white">
              Coach Dashboard
            </h2>
            <p class="text-slate-400 text-sm">
              Secure access for HOM Professional Coaches
            </p>
          </div>

          <!-- Error Display -->
          <UAlert
            v-if="error"
            color="error"
            variant="soft"
            :title="error"
            icon="i-heroicons-exclamation-triangle"
            class="text-sm"
          />

          <!-- Sign In Button -->
          <!-- Sign In Button -->
          <UButton
            @click="handleGoogleSignIn"
            :loading="loading"
            :disabled="loading"
            color="neutral"
            variant="solid"
            size="xl"
            block
            class="font-bold bg-white hover:bg-gray-100 text-slate-900"
          >
            <template #leading>
              <UIcon name="i-simple-icons-google" class="w-5 h-5 text-slate-900" />
            </template>
            {{ loading ? 'Signing in...' : 'Sign in with Google' }}
          </UButton>

          <!-- Footer -->
          <div class="text-center pt-4 border-t border-slate-800">
            <p class="text-xs text-slate-500">
              Powered by Metamorph Intelligence
            </p>
          </div>
        </div>
      </UCard>
    </div>
  </UApp>
</template>
