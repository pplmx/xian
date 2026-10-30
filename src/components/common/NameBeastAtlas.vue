<script setup lang="ts">
import { computed } from "vue";

const props = defineProps<{
  titleName: string;
  titleCount: string;
  titleRatio: number;
  petName: string;
  petCount: string;
  petRatio: number;
}>();

function width(value: number): string {
  return `${Math.max(0, Math.min(1, value)) * 100}%`;
}

const titleWidth = computed(() => width(props.titleRatio));
const petWidth = computed(() => width(props.petRatio));
</script>

<template>
  <div class="name-beast-atlas" aria-hidden="true">
    <span class="name-beast-atlas__row" data-kind="title">
      <span class="name-beast-atlas__mark">名</span>
      <span class="name-beast-atlas__copy">
        <span class="name-beast-atlas__name">{{ titleName }}</span>
        <span class="name-beast-atlas__meta">佩印 · {{ titleCount }}</span>
      </span>
      <span class="name-beast-atlas__track">
        <span :style="{ width: titleWidth }" />
      </span>
    </span>
    <span class="name-beast-atlas__row" data-kind="pet">
      <span class="name-beast-atlas__mark">兽</span>
      <span class="name-beast-atlas__copy">
        <span class="name-beast-atlas__name">{{ petName }}</span>
        <span class="name-beast-atlas__meta">灵契 · {{ petCount }}</span>
      </span>
      <span class="name-beast-atlas__track">
        <span :style="{ width: petWidth }" />
      </span>
    </span>
  </div>
</template>
