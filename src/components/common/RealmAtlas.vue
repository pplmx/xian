<script setup lang="ts">
import { computed } from "vue";
import type { RealmCodexAtlasRow } from "@/ui/realmCodexDesk";
import { realmCodexRealmEntries } from "@/ui/realmCodexDesk";

const props = defineProps<{
  rows: RealmCodexAtlasRow[];
  major: number;
}>();

const atlasRows = computed(() =>
  props.rows.map((row) => ({
    ...row,
    entries: realmCodexRealmEntries(row, props.major),
  })),
);
</script>

<template>
  <div class="realm-atlas" aria-hidden="true">
    <span
      v-for="row in atlasRows"
      :key="row.world.id"
      class="realm-atlas__row"
      :data-world="row.world.id"
      :data-state="row.state"
    >
      <span class="realm-atlas__mark">{{ row.mark }}</span>
      <span class="realm-atlas__track">
        <span
          v-for="cell in row.entries"
          :key="cell.def.id"
          class="realm-atlas__dot"
          :class="`is-${cell.state}`"
        />
      </span>
      <span class="realm-atlas__count tabular">{{ row.entered }}/{{ row.total }}</span>
    </span>
  </div>
</template>
