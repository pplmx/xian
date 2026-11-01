<template>
  <header class="character-chapter-head">
    <span class="character-chapter-head__index" aria-hidden="true">{{ index }}</span>
    <div class="character-chapter-head__copy">
      <h2 class="character-chapter-head__title">{{ title }}</h2>
      <p class="character-chapter-head__hint">{{ hint }}</p>
    </div>
    <p v-if="fact" class="character-chapter-head__fact tabular">{{ fact }}</p>
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
