<template>
  <nav
    v-if="neighbors"
    data-folio-turner
    class="folio-turner"
    :aria-label="`第 ${neighbors.index + 1} / ${neighbors.total} 册，前后翻册`"
  >
    <div class="folio-turner__grid">
      <RouterLink
        v-if="neighbors.previous"
        :to="neighbors.previous.to"
        class="folio-turner__link folio-turner__link--previous"
        :aria-label="`回翻至${neighbors.previous.sectionLabel}卷${neighbors.previous.label}`"
      >
        <span class="folio-turner__direction">← 回翻</span>
        <span class="folio-turner__title">{{ neighbors.previous.label }}</span>
        <span class="folio-turner__meta">
          {{ neighbors.previous.sectionLabel }}卷 · {{ neighbors.previous.description }}
        </span>
      </RouterLink>
      <span v-else class="folio-turner__edge" aria-hidden="true">卷首</span>

      <span class="folio-turner__spine" aria-hidden="true">
        <span>翻</span>
        <small class="tabular">{{ neighbors.index + 1 }}/{{ neighbors.total }}</small>
      </span>

      <RouterLink
        v-if="neighbors.next"
        :to="neighbors.next.to"
        class="folio-turner__link folio-turner__link--next"
        :aria-label="`续翻至${neighbors.next.sectionLabel}卷${neighbors.next.label}`"
      >
        <span class="folio-turner__direction">续翻 →</span>
        <span class="folio-turner__title">{{ neighbors.next.label }}</span>
        <span class="folio-turner__meta">
          {{ neighbors.next.sectionLabel }}卷 · {{ neighbors.next.description }}
        </span>
      </RouterLink>
      <span v-else class="folio-turner__edge" aria-hidden="true">卷终</span>
    </div>
  </nav>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { RouterLink, useRoute } from "vue-router";
import { folioTurnNeighborsOf } from "@/ui/folioTurner";

const route = useRoute();
const neighbors = computed(() => folioTurnNeighborsOf(route.name));
</script>
