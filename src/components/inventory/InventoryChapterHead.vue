<template>
  <header class="inventory-chapter-head" data-inventory-chapter-head>
    <span class="inventory-chapter-head__index" aria-hidden="true">{{ index }}</span>
    <div class="inventory-chapter-head__copy">
      <h2 class="inventory-chapter-head__title">{{ title }}</h2>
      <p class="inventory-chapter-head__hint">{{ hint }}</p>
    </div>
    <div v-if="fact || $slots.actions" class="inventory-chapter-head__tail">
      <p v-if="fact" class="inventory-chapter-head__fact tabular">{{ fact }}</p>
      <div v-if="$slots.actions" class="inventory-chapter-head__actions">
        <slot name="actions" />
      </div>
    </div>
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
