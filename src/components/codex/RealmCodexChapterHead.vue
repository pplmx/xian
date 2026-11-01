<template>
  <header class="realm-codex-chapter-head" data-realm-codex-chapter-head :data-chapter="tab">
    <span class="realm-codex-chapter-head__index" aria-hidden="true">{{ index }}</span>
    <div class="realm-codex-chapter-head__copy">
      <h2 class="realm-codex-chapter-head__title">{{ title }}</h2>
      <p class="realm-codex-chapter-head__hint">{{ hint }}</p>
    </div>
    <p v-if="fact" class="realm-codex-chapter-head__fact tabular">{{ fact }}</p>
  </header>
</template>

<script setup lang="ts">
import type { RealmCodexTab } from "@/ui/realmCodexDesk";

defineProps<{
  tab: RealmCodexTab;
  index: string;
  title: string;
  hint: string;
  fact?: string;
}>();
</script>
