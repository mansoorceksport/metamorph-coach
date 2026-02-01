<script setup lang="ts">
const { locale, locales, setLocale } = useI18n()

// Get available locales with their display names
const availableLocales = computed(() => {
  return (locales.value as Array<{ code: string; name: string }>).map(loc => ({
    code: loc.code,
    name: loc.name
  }))
})

// Current locale display info
const currentLocale = computed(() => {
  return availableLocales.value.find(l => l.code === locale.value)
})

// Flag emoji mapping
const flagEmoji: Record<string, string> = {
  en: '🇬🇧',
  id: '🇮🇩'
}

// Handle locale change
const handleLocaleChange = async (code: string) => {
  console.log('[LanguageSwitcher] Changing locale to:', code)
  await setLocale(code)
}

// Dropdown items for UDropdownMenu - Nuxt UI v4 format
const localeItems = computed(() =>
  availableLocales.value.map(loc => [{
    label: `${flagEmoji[loc.code] || ''} ${loc.name}`,
    icon: loc.code === locale.value ? 'i-heroicons-check' : undefined,
    onSelect: () => handleLocaleChange(loc.code)
  }])
)
</script>

<template>
  <UDropdownMenu :items="localeItems">
    <UButton
      color="neutral"
      variant="ghost"
      size="sm"
      class="gap-2"
    >
      <span class="text-lg">{{ flagEmoji[locale] }}</span>
      <span class="hidden sm:inline">{{ currentLocale?.name }}</span>
      <UIcon name="i-heroicons-chevron-down" class="w-4 h-4" />
    </UButton>
  </UDropdownMenu>
</template>
