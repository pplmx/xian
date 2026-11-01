<template>
  <header class="collection-chapter-head" data-collection-chapter-head>
    <span class="collection-chapter-head__index" aria-hidden="true">{{ index }}</span>
    <div class="collection-chapter-head__copy">
      <p v-if="eyebrow" class="collection-chapter-head__eyebrow">{{ eyebrow }}</p>
      <h2 class="collection-chapter-head__title">{{ title }}</h2>
      <p class="collection-chapter-head__hint">{{ hint }}</p>
    </div>
    <p v-if="fact" class="collection-chapter-head__fact tabular">{{ fact }}</p>
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
