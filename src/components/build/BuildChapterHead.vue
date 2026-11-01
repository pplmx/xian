<template>
  <header class="build-chapter-head" data-folio-chapter-head data-build-chapter-head>
    <span class="build-chapter-head__index" aria-hidden="true">{{ index }}</span>
    <div class="build-chapter-head__copy">
      <p v-if="eyebrow" class="build-chapter-head__eyebrow">{{ eyebrow }}</p>
      <h2 class="build-chapter-head__title">{{ title }}</h2>
      <p class="build-chapter-head__hint">{{ hint }}</p>
    </div>
    <p v-if="fact" class="build-chapter-head__fact tabular">{{ fact }}</p>
  </header>
</template>

<script setup lang="ts">
defineProps<{
  index: string;
  title: string;
  hint: string;
  fact?: string;
  eyebrow?: string;
}>();
</script>
