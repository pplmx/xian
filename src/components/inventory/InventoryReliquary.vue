<template>
  <!--
    卷首九佩匣只画「哪一席已经有着落」与行囊容量。
    精确件数、新得与可换项都在「本批检点」正文完整出现，故整匣不重复进读屏。
  -->
  <div class="inventory-reliquary" data-inventory-reliquary aria-hidden="true">
    <svg viewBox="0 0 140 140" role="presentation">
      <circle class="inventory-reliquary__rim" cx="70" cy="70" r="64" />
      <circle
        class="inventory-reliquary__rim inventory-reliquary__rim--inner"
        cx="70"
        cy="70"
        r="54"
      />
      <circle
        class="inventory-reliquary__capacity"
        cx="70"
        cy="70"
        r="58"
        pathLength="100"
        :stroke-dasharray="`${capacityPercent} 100`"
      />
      <g
        v-for="node in nodes"
        :key="node.slot"
        class="inventory-reliquary__slot"
        :class="{ 'is-filled': node.filled }"
      >
        <rect :x="node.x" :y="node.y" width="23" height="23" rx="2" />
        <text :x="node.x + 11.5" :y="node.y + 11.5" text-anchor="middle" dominant-baseline="middle">
          {{ node.mark }}
        </text>
      </g>
      <text class="inventory-reliquary__count" x="70" y="128" text-anchor="middle">
        藏 {{ bagCount }} / {{ capacity }}
      </text>
    </svg>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import type { EquipSlot } from "@/types";
import { EQUIP_SLOT_NAMES } from "@/data/equipment";

const props = defineProps<{
  slots: EquipSlot[];
  filledSlots: EquipSlot[];
  bagCount: number;
  capacity: number;
}>();

const GRID_POINTS = [
  { x: 34.5, y: 34.5 },
  { x: 58.5, y: 34.5 },
  { x: 82.5, y: 34.5 },
  { x: 34.5, y: 58.5 },
  { x: 58.5, y: 58.5 },
  { x: 82.5, y: 58.5 },
  { x: 34.5, y: 82.5 },
  { x: 58.5, y: 82.5 },
  { x: 82.5, y: 82.5 },
];

const filled = computed(() => new Set(props.filledSlots));
const nodes = computed(() =>
  props.slots.slice(0, GRID_POINTS.length).map((slot, index) => ({
    slot,
    ...GRID_POINTS[index]!,
    mark: EQUIP_SLOT_NAMES[slot].slice(0, 1),
    filled: filled.value.has(slot),
  })),
);
const capacityPercent = computed(() => {
  if (props.capacity <= 0) return 0;
  return Math.max(0, Math.min(100, (props.bagCount / props.capacity) * 100));
});
</script>
