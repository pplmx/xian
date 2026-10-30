<template>
  <!--
    卷首罗盘只做方向感:四界各据一方,值日之宿指向今日得利之界。
    精确比例与地名在「今日行旅」正文完整出现,故整盘不重复进读屏。
  -->
  <div
    class="adventure-compass"
    :data-favored-world="favoredWorldId"
    data-adventure-compass
    aria-hidden="true"
  >
    <svg viewBox="0 0 140 140" role="presentation">
      <circle class="adventure-compass__rim" cx="70" cy="70" r="64" />
      <circle class="adventure-compass__rim adventure-compass__rim--inner" cx="70" cy="70" r="49" />
      <line
        v-for="node in nodes"
        :key="node.id"
        class="adventure-compass__spoke"
        x1="70"
        y1="70"
        :x2="node.innerX"
        :y2="node.innerY"
      />
      <line class="adventure-compass__needle" x1="70" y1="70" :x2="needleEnd.x" :y2="needleEnd.y" />
      <circle
        v-for="node in nodes"
        :key="`${node.id}-dot`"
        class="adventure-compass__node"
        :class="{ 'is-favored': node.favored }"
        :cx="node.x"
        :cy="node.y"
        r="4.5"
      />
      <text
        v-for="node in nodes"
        :key="`${node.id}-label`"
        class="adventure-compass__world"
        :class="{ 'is-favored': node.favored }"
        :x="node.labelX"
        :y="node.labelY"
        text-anchor="middle"
        dominant-baseline="middle"
      >
        {{ node.mark }}
      </text>
      <circle class="adventure-compass__core" cx="70" cy="70" r="28" />
      <path
        class="adventure-compass__star"
        :transform="`translate(${star.x} ${star.y})`"
        d="M0 -4 L1 -1 L4 0 L1 1 L0 4 L-1 1 L-4 0 L-1 -1 Z"
      />
      <text class="adventure-compass__today" x="70" y="58" text-anchor="middle">今日</text>
      <text class="adventure-compass__mark" x="70" y="74" text-anchor="middle">
        {{ favoredMark }}
      </text>
      <text class="adventure-compass__mansion" x="70" y="88" text-anchor="middle">
        {{ mansionName }}
      </text>
    </svg>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import type { WorldId } from "@/types";
import { WORLDS, worldDef } from "@/data/realms";

const props = defineProps<{
  favoredWorldId: WorldId;
  mansionName: string;
}>();

const AXIS: Record<WorldId, number> = {
  god: -90,
  immortal: 0,
  mortal: 90,
  chaos: 180,
};

const pointAt = (angle: number, radius: number) => {
  const rad = (angle * Math.PI) / 180;
  return {
    x: 70 + Math.cos(rad) * radius,
    y: 70 + Math.sin(rad) * radius,
  };
};

const favoredMark = computed(() => worldDef(props.favoredWorldId).name.slice(0, 1));

const nodes = computed(() =>
  WORLDS.map((world) => {
    const angle = AXIS[world.id];
    const node = pointAt(angle, 50);
    const inner = pointAt(angle, 37);
    const label = pointAt(angle, 61);
    return {
      id: world.id,
      favored: world.id === props.favoredWorldId,
      mark: world.name.slice(0, 1),
      x: node.x,
      y: node.y,
      innerX: inner.x,
      innerY: inner.y,
      labelX: label.x,
      labelY: label.y,
    };
  }),
);

const needleEnd = computed(() => pointAt(AXIS[props.favoredWorldId], 34));
const star = computed(() => pointAt(AXIS[props.favoredWorldId], 45));
</script>
