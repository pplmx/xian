<template>
  <header class="name-beast-chapter-head" data-folio-chapter-head data-name-beast-chapter-head>
    <span class="name-beast-chapter-head__index" aria-hidden="true">{{ index }}</span>
    <div class="name-beast-chapter-head__copy">
      <p v-if="eyebrow" class="name-beast-chapter-head__eyebrow">{{ eyebrow }}</p>
      <h2 class="name-beast-chapter-head__title">{{ title }}</h2>
      <p class="name-beast-chapter-head__hint">{{ hint }}</p>
    </div>
    <p v-if="fact" class="name-beast-chapter-head__fact tabular">{{ fact }}</p>
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
