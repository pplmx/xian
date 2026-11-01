<template>
  <header class="cultivation-chapter-head">
    <span class="cultivation-chapter-head__index">{{ index }}</span>
    <div class="cultivation-chapter-head__copy">
      <h2 class="cultivation-chapter-head__title">{{ title }}</h2>
      <p class="cultivation-chapter-head__hint">{{ hint }}</p>
    </div>
    <p v-if="fact" class="cultivation-chapter-head__fact tabular">{{ fact }}</p>
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
