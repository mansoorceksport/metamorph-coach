<script setup lang="ts">
const navItems = [
  {
    label: 'Agenda',
    to: '/',
    icon: 'i-heroicons-calendar-days'
  },
  {
    label: 'Clients',
    to: '/clients',
    icon: 'i-heroicons-users'
  },
  {
    label: 'Library',
    to: '/library',
    icon: 'i-heroicons-book-open'
  }
]
</script>

<template>
  <div class="min-h-screen flex flex-col">
    <!-- Global Header -->
    <header class="border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950">
      <div class="flex items-center justify-between px-4 py-3">
        <div class="flex items-center gap-3">
          <UIcon name="i-heroicons-bolt" class="w-8 h-8 text-primary" />
          <span class="text-xl font-bold">House of Metamorfit</span>
        </div>
        <UButton
          color="neutral"
          variant="ghost"
          label="Logout"
          icon="i-heroicons-arrow-right-on-rectangle"
        />
      </div>
    </header>

    <div class="flex flex-1 overflow-hidden">
      <!-- Desktop Sidebar Navigation -->
      <aside class="hidden lg:block w-64 border-r border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950">
        <nav class="p-4">
          <UNavigationMenu :items="navItems" orientation="vertical" />
        </nav>
      </aside>

      <!-- Main Content Area -->
      <main class="flex-1 overflow-y-auto pb-20 lg:pb-0">
        <div class="container mx-auto p-4 lg:p-8">
          <slot />
        </div>
      </main>
    </div>

    <!-- Mobile Bottom Navigation -->
    <nav class="lg:hidden fixed bottom-0 left-0 right-0 border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950">
      <UNavigationMenu :items="navItems" orientation="horizontal" />
    </nav>
  </div>
</template>
