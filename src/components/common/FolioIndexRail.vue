<template>
  <nav
    :data-folio-index-rail="kind"
    class="folio-index-rail"
    :class="kind === 'volume' ? 'folio-index-rail--volume' : 'folio-index-rail--chapter'"
    :aria-label="label"
  >
    <RouterLink
      v-for="item in items"
      :key="item.key"
      :to="item.to"
      class="folio-index-rail__tab"
      :data-folio-rail-item="item.key"
      :data-folio-rail-current="item.active ? '' : undefined"
      :aria-current="item.active ? 'location' : undefined"
      :aria-label="`${item.label}：${item.hint}`"
      :title="`${item.label} · ${item.hint}`"
    >
      <span class="folio-index-rail__mark" aria-hidden="true">{{ item.mark }}</span>
      <span class="folio-index-rail__label" aria-hidden="true">{{ item.shortLabel }}</span>
    </RouterLink>
  </nav>
</template>

<script setup lang="ts">
import { RouterLink } from "vue-router";
import type { FolioIndexRailItem } from "@/ui/folioIndexRail";

withDefaults(
  defineProps<{
    items: readonly FolioIndexRailItem[];
    label: string;
    kind?: "volume" | "chapter";
  }>(),
  { kind: "chapter" },
);
</script>
