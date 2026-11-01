<template>
  <header class="dongfu-chapter-head" data-dongfu-chapter-head>
    <span class="dongfu-chapter-head__index" aria-hidden="true">{{ index }}</span>
    <div class="dongfu-chapter-head__copy">
      <p v-if="eyebrow" class="dongfu-chapter-head__eyebrow">{{ eyebrow }}</p>
      <h2 class="dongfu-chapter-head__title">{{ title }}</h2>
      <p class="dongfu-chapter-head__hint">{{ hint }}</p>
    </div>
    <p v-if="fact" class="dongfu-chapter-head__fact tabular">{{ fact }}</p>
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
