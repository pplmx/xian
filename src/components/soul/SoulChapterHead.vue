<template>
  <header class="soul-chapter-head" data-soul-chapter-head>
    <span class="soul-chapter-head__index" aria-hidden="true">{{ index }}</span>
    <div class="soul-chapter-head__copy">
      <h2 class="soul-chapter-head__title">{{ title }}</h2>
      <p class="soul-chapter-head__hint">{{ hint }}</p>
    </div>
    <p v-if="fact" class="soul-chapter-head__fact tabular">{{ fact }}</p>
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
