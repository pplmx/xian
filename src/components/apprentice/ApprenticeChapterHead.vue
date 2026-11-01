<template>
  <header class="apprentice-chapter-head" data-folio-chapter-head data-apprentice-chapter-head>
    <span class="apprentice-chapter-head__index" aria-hidden="true">{{ index }}</span>
    <div class="apprentice-chapter-head__copy">
      <p v-if="eyebrow" class="apprentice-chapter-head__eyebrow">{{ eyebrow }}</p>
      <h2 class="apprentice-chapter-head__title">{{ title }}</h2>
      <p class="apprentice-chapter-head__hint">{{ hint }}</p>
    </div>
    <p v-if="fact" class="apprentice-chapter-head__fact tabular">{{ fact }}</p>
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
