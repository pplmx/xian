<template>
  <header class="celestial-chapter-head" data-folio-chapter-head>
    <span class="celestial-chapter-head__index" aria-hidden="true">{{ index }}</span>
    <div class="celestial-chapter-head__copy">
      <h2 class="celestial-chapter-head__title">{{ title }}</h2>
      <p class="celestial-chapter-head__hint">{{ hint }}</p>
    </div>
    <p v-if="fact" class="celestial-chapter-head__fact tabular">{{ fact }}</p>
  </header>
</template>

<script setup lang="ts">
defineProps<{
  index: string;
  title: string;
  hint: string;
  fact?: string;
}>();
</script>
