<template>
  <!--
    山门图只给七作的当前位置与状态意象，精确等级和造价都在正文总账与建筑卡里，
    因此整图不重复进入读屏。
  -->
  <div class="dongfu-atlas" data-dongfu-atlas aria-hidden="true">
    <svg viewBox="0 0 168 146" role="presentation">
      <path
        class="dongfu-atlas__terrain dongfu-atlas__terrain--far"
        d="M2 117 C21 100 30 104 44 88 C58 72 72 82 85 76 C102 68 113 84 128 80 C142 76 154 87 166 101 V144 H2 Z"
      />
      <path
        class="dongfu-atlas__terrain dongfu-atlas__terrain--near"
        d="M2 129 C21 116 35 119 52 105 C70 90 84 103 98 96 C113 89 126 103 139 100 C151 97 160 105 166 115 V144 H2 Z"
      />
      <path
        v-for="node in placedNodes"
        :key="`path-${node.id}`"
        class="dongfu-atlas__way"
        :d="`M84 73 L${node.x} ${node.y}`"
      />

      <g
        v-for="node in placedNodes"
        :key="node.id"
        class="dongfu-atlas__node"
        :class="{
          'is-built': node.level > 0,
          'is-maxed': node.cap > 0 && node.level >= node.cap,
          'is-ready': node.canUpgrade,
          'is-hub': node.id === 'mansion',
        }"
      >
        <circle class="dongfu-atlas__node-disc" :cx="node.x" :cy="node.y" :r="node.radius" />
        <circle
          v-if="node.level > 0"
          class="dongfu-atlas__node-progress"
          :cx="node.x"
          :cy="node.y"
          :r="node.radius"
          pathLength="100"
          :stroke-dasharray="`${node.ratio} ${100 - node.ratio}`"
          :transform="`rotate(-90 ${node.x} ${node.y})`"
        />
        <text
          class="dongfu-atlas__node-mark"
          :x="node.x"
          :y="node.y + 0.5"
          text-anchor="middle"
          dominant-baseline="middle"
        >
          {{ node.mark }}
        </text>
        <circle
          v-if="node.canUpgrade"
          class="dongfu-atlas__ready-dot"
          :cx="node.x + node.radius * 0.72"
          :cy="node.y - node.radius * 0.72"
          r="2.2"
        />
      </g>

      <path class="dongfu-atlas__mist" d="M20 31 C33 27 43 29 55 32" />
      <path class="dongfu-atlas__mist" d="M112 22 C123 18 133 20 145 24" />
    </svg>
    <span class="dongfu-atlas__caption">
      <span>山门</span>
      <span class="tabular">{{ builtCount }}/{{ nodes.length }}</span>
    </span>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";

type AtlasNode = {
  id: string;
  mark: string;
  level: number;
  cap: number;
  canUpgrade: boolean;
};

const props = defineProps<{
  nodes: AtlasNode[];
  builtCount: number;
}>();

const POSITIONS: Record<string, { x: number; y: number; radius: number }> = {
  mansion: { x: 84, y: 73, radius: 13 },
  array: { x: 50, y: 56, radius: 7.5 },
  alchemy: { x: 117, y: 52, radius: 7.5 },
  forge: { x: 141, y: 84, radius: 7.5 },
  field: { x: 31, y: 103, radius: 7.5 },
  library: { x: 69, y: 115, radius: 7.5 },
  beast: { x: 119, y: 111, radius: 7.5 },
};

const placedNodes = computed(() =>
  props.nodes
    .filter((node) => POSITIONS[node.id])
    .map((node) => {
      const position = POSITIONS[node.id]!;
      return {
        ...node,
        ...position,
        ratio: node.cap > 0 ? Math.max(0, Math.min(100, (node.level / node.cap) * 100)) : 0,
      };
    }),
);
</script>

<style scoped>
.dongfu-atlas {
  position: relative;
  display: grid;
  width: 168px;
  height: 146px;
  place-items: center;
  isolation: isolate;
}

.dongfu-atlas::before {
  position: absolute;
  inset: 15px 10px 20px;
  border: 1px solid rgb(var(--color-ink-rgb) / 0.075);
  border-radius: 50%;
  background:
    radial-gradient(circle at 45% 38%, rgb(var(--color-paper-rgb) / 0.9), transparent 55%),
    rgb(var(--color-paper-deep-rgb) / 0.2);
  box-shadow: inset 0 0 28px rgb(var(--color-ink-rgb) / 0.035);
  content: "";
}

.dongfu-atlas svg {
  position: relative;
  z-index: 1;
  width: 100%;
  height: 100%;
  overflow: visible;
}

.dongfu-atlas__terrain {
  stroke: none;
}

.dongfu-atlas__terrain--far {
  fill: rgb(var(--color-ink-rgb) / 0.035);
}

.dongfu-atlas__terrain--near {
  fill: rgb(var(--color-ink-rgb) / 0.065);
}

.dongfu-atlas__way {
  fill: none;
  stroke: rgb(var(--color-ink-rgb) / 0.12);
  stroke-dasharray: 1.5 3;
  stroke-width: 0.8;
}

.dongfu-atlas__node-disc {
  fill: rgb(var(--color-paper-lifted-rgb) / 0.88);
  stroke: rgb(var(--color-ink-rgb) / 0.22);
  stroke-dasharray: 2 2;
  stroke-width: 0.9;
}

.dongfu-atlas__node-progress {
  fill: none;
  stroke: rgb(var(--color-qing-rgb) / 0.68);
  stroke-linecap: butt;
  stroke-width: 1.7;
}

.dongfu-atlas__node-mark {
  fill: rgb(var(--color-ink-faint-rgb));
  font-family: var(--font-kai);
  font-size: 7px;
  font-weight: 500;
}

.dongfu-atlas__node.is-hub .dongfu-atlas__node-disc {
  fill: rgb(var(--color-paper-lifted-rgb) / 0.96);
  stroke: rgb(var(--color-cinnabar-rgb) / 0.36);
  stroke-dasharray: none;
  stroke-width: 1.1;
}

.dongfu-atlas__node.is-hub .dongfu-atlas__node-mark {
  fill: rgb(var(--color-cinnabar-rgb));
  font-size: 12px;
}

.dongfu-atlas__node.is-built .dongfu-atlas__node-mark {
  fill: rgb(var(--color-ink-soft-rgb));
}

.dongfu-atlas__node.is-maxed .dongfu-atlas__node-progress {
  stroke: rgb(var(--color-jade-rgb) / 0.78);
}

.dongfu-atlas__node.is-maxed .dongfu-atlas__node-mark {
  fill: rgb(var(--color-jade-rgb));
}

.dongfu-atlas__ready-dot {
  fill: rgb(var(--color-cinnabar-rgb));
  stroke: rgb(var(--color-paper-lifted-rgb));
  stroke-width: 0.9;
}

.dongfu-atlas__mist {
  fill: none;
  stroke: rgb(var(--color-ink-rgb) / 0.075);
  stroke-linecap: round;
  stroke-width: 1;
}

.dongfu-atlas__caption {
  position: absolute;
  z-index: 2;
  right: 0.15rem;
  bottom: 0.08rem;
  display: flex;
  align-items: baseline;
  gap: 0.28rem;
  color: rgb(var(--color-ink-faint-rgb));
  font-family: var(--font-kai);
  font-size: var(--type-note);
  letter-spacing: 0.12em;
}

.dongfu-atlas__caption span:last-child {
  color: rgb(var(--color-ink-soft-rgb));
  font-variant-numeric: tabular-nums;
}

@media (prefers-reduced-motion: no-preference) {
  .dongfu-atlas__node {
    animation: dongfu-atlas-settle 0.42s ease-out both;
  }

  .dongfu-atlas__node:nth-of-type(2) {
    animation-delay: 0.035s;
  }

  .dongfu-atlas__node:nth-of-type(3) {
    animation-delay: 0.07s;
  }

  .dongfu-atlas__node:nth-of-type(4) {
    animation-delay: 0.105s;
  }

  .dongfu-atlas__node:nth-of-type(5) {
    animation-delay: 0.14s;
  }

  .dongfu-atlas__node:nth-of-type(6) {
    animation-delay: 0.175s;
  }

  .dongfu-atlas__node:nth-of-type(7) {
    animation-delay: 0.21s;
  }
}

@keyframes dongfu-atlas-settle {
  from {
    opacity: 0;
    transform: translateY(2px);
  }

  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>
