<template>
  <div class="flex items-center justify-center min-h-[80vh]">
    <UCard class="w-full max-w-md">
      <template #header>
        <div class="text-center">
          <UIcon name="i-heroicons-bolt" class="w-12 h-12 text-primary mx-auto mb-2" />
          <h1 class="text-2xl font-bold">Coach Login</h1>
          <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Access the House of Metamorfit coaching platform
          </p>
        </div>
      </template>

      <div class="space-y-4">
        <div class="text-center text-sm text-gray-500 dark:text-gray-400">
          Login form will be implemented here
        </div>
        
        <UButton
          label="Login with Demo Account"
          color="primary"
          block
          size="lg"
          icon="i-heroicons-arrow-right-on-rectangle"
        />
      </div>
    </UCard>
  </div>
</template>
