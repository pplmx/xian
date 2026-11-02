<script setup lang="ts">
import { computed } from "vue";
import { unitRatio } from "@/utils/unitRatio";
import { usePlayerStore } from "@/stores/player";
import { realmLadderPoints, realmOrdinalText } from "@/core/realmLadder";
import { formatPercent } from "@/utils/format";

withDefaults(
  defineProps<{
    /** 纸面正文与暗场内观台共用同一枚周天盘，只换已定义的色组。 */
    tone?: "paper" | "chrome";
  }>(),
  { tone: "paper" },
);

const player = usePlayerStore();
const points = computed(() => realmLadderPoints(player.major));
const progress = computed(() => unitRatio(player.expProgress));
const progressText = computed(() => {
  const text = formatPercent(progress.value, 1);
  // 后期一境常有进度小到一位小数仍读成 0% 的时候;只要真在涨,就不许显示成零。
  return progress.value > 0 && text === "0%" ? "<0.1%" : text;
});
const circumference = 2 * Math.PI * 53;
const dashOffset = computed(() => circumference * (1 - progress.value));
</script>

<template>
  <!--
    周天盘 —— 内观台的纯视觉摘要:外圈读仙路三态,内圈读本境修为。
    读数已在正文完整呈现,这里不重复进读屏;它负责让玩家一眼认出「我在哪、走到多远」。
  -->
  <div class="cultivation-dial" data-cultivation-dial :data-tone="tone" aria-hidden="true">
    <span class="cultivation-dial__aura" />
    <svg class="cultivation-dial__svg" viewBox="0 0 140 140">
      <circle class="cultivation-dial__orbit" cx="70" cy="70" r="60" />
      <circle class="cultivation-dial__inner-orbit" cx="70" cy="70" r="42" />
      <line
        v-for="(point, i) in points"
        :key="point.index"
        class="cultivation-dial__tick"
        :class="[`is-${point.state}`, { 'is-gate': point.worldStart }]"
        x1="70"
        y1="4"
        x2="70"
        :y2="point.worldStart ? 15 : 10"
        :transform="`rotate(${(i * 360) / points.length} 70 70)`"
      />
      <circle class="cultivation-dial__track" cx="70" cy="70" r="53" />
      <circle
        class="cultivation-dial__progress"
        cx="70"
        cy="70"
        r="53"
        :stroke-dasharray="circumference"
        :stroke-dashoffset="dashOffset"
      />
      <circle class="cultivation-dial__core-ring" cx="70" cy="70" r="31" />
    </svg>
    <div class="cultivation-dial__core">
      <span class="cultivation-dial__eyebrow">内观 · 周天</span>
      <strong class="cultivation-dial__number">{{ progressText }}</strong>
      <span class="cultivation-dial__stage">{{ player.realm.name }} · {{ player.subName }}</span>
      <span class="cultivation-dial__ordinal tabular">{{ realmOrdinalText(player.major) }}</span>
    </div>
  </div>
</template>

<style scoped>
.cultivation-dial {
  --dial-line: rgb(var(--color-ink-rgb) / 0.08);
  --dial-line-strong: rgb(var(--color-ink-rgb) / 0.2);
  --dial-ink: rgb(var(--color-ink-rgb));
  --dial-faint: rgb(var(--color-ink-faint-rgb));
  --dial-done: rgb(var(--color-qing-rgb) / 0.62);
  --dial-now: rgb(var(--color-cinnabar-rgb));
  --dial-core:
    radial-gradient(circle at 42% 38%, rgb(var(--color-paper-rgb) / 0.82), transparent 48%),
    rgb(var(--color-paper-deep-rgb) / 0.42);

  position: relative;
  display: grid;
  width: 140px;
  height: 140px;
  flex: none;
  place-items: center;
  isolation: isolate;
}

.cultivation-dial[data-tone="chrome"] {
  --dial-line: rgb(var(--chrome-muted-rgb) / 0.14);
  --dial-line-strong: rgb(var(--chrome-ink-rgb) / 0.32);
  --dial-ink: rgb(var(--chrome-ink-rgb));
  --dial-faint: rgb(var(--chrome-muted-rgb));
  --dial-done: rgb(var(--chrome-qing-rgb) / 0.78);
  --dial-now: rgb(var(--chrome-accent-rgb));
  --dial-core:
    radial-gradient(circle at 43% 35%, rgb(var(--chrome-qing-rgb) / 0.13), transparent 46%),
    linear-gradient(145deg, rgb(var(--chrome-rgb) / 0.84), rgb(var(--chrome-deep-rgb) / 0.94));
}

.cultivation-dial::before,
.cultivation-dial::after {
  position: absolute;
  content: "";
  border-radius: 50%;
  pointer-events: none;
}

.cultivation-dial__aura {
  position: absolute;
  z-index: -1;
  inset: -14px;
  border: 1px solid var(--dial-line);
  border-radius: 50%;
  background: radial-gradient(circle, transparent 48%, var(--dial-line) 49%, transparent 50%);
  opacity: 0.72;
  animation: cultivation-dial-aura 6.8s ease-in-out infinite;
  pointer-events: none;
}

.cultivation-dial::before {
  inset: 12px;
  border: 1px solid var(--dial-line);
  background: var(--dial-core);
  box-shadow:
    inset 0 0 24px var(--dial-line),
    0 5px 18px rgb(var(--shadow-ink-rgb) / 0.08);
}

.cultivation-dial::after {
  inset: 25px;
  border: 1px dashed var(--dial-line-strong);
  opacity: 0.54;
}

.cultivation-dial__svg {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  overflow: visible;
}

.cultivation-dial__orbit,
.cultivation-dial__inner-orbit,
.cultivation-dial__track,
.cultivation-dial__progress,
.cultivation-dial__core-ring {
  fill: none;
}

.cultivation-dial__orbit {
  stroke: var(--dial-line);
  stroke-width: 0.75;
}

.cultivation-dial__inner-orbit {
  stroke: var(--dial-line);
  stroke-width: 0.6;
  stroke-dasharray: 1 4;
}

.cultivation-dial__tick {
  stroke: var(--dial-line-strong);
  stroke-width: 1.5;
}

.cultivation-dial__tick.is-done {
  stroke: var(--dial-done);
}

.cultivation-dial__tick.is-now {
  stroke: var(--dial-now);
  stroke-width: 2.5;
  animation: cultivation-dial-now 2.8s ease-in-out infinite;
}

.cultivation-dial__tick.is-gate {
  stroke-width: 2;
}

.cultivation-dial__track {
  stroke: var(--dial-line);
  stroke-width: 2;
}

.cultivation-dial__progress {
  stroke: var(--dial-done);
  stroke-width: 2.5;
  stroke-linecap: round;
  transform: rotate(-90deg);
  transform-origin: 70px 70px;
  transition: stroke-dashoffset 0.5s ease;
}

.cultivation-dial__core-ring {
  stroke: var(--dial-line-strong);
  stroke-width: 0.55;
  stroke-dasharray: 18 3 2 3;
  opacity: 0.56;
}

.cultivation-dial__core {
  position: relative;
  z-index: 1;
  display: grid;
  justify-items: center;
  line-height: 1;
}

.cultivation-dial__eyebrow,
.cultivation-dial__stage,
.cultivation-dial__ordinal {
  color: var(--dial-faint);
  font-family: var(--font-kai);
  font-size: var(--type-note);
  letter-spacing: 0.16em;
}

.cultivation-dial__number {
  margin: 0.15rem 0 0.22rem;
  color: var(--dial-ink);
  font-family: var(--font-kai);
  font-size: calc(var(--type-section) + 2px);
  font-weight: 400;
  font-variant-numeric: tabular-nums;
  letter-spacing: 0.02em;
  text-shadow: 0 0 18px var(--dial-line-strong);
}

.cultivation-dial__stage {
  max-width: 5.6rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  letter-spacing: 0.06em;
}

.cultivation-dial__ordinal {
  margin-top: 0.18rem;
  font-size: max(8px, calc(var(--type-note) - 1px));
  letter-spacing: 0.05em;
}

@keyframes cultivation-dial-now {
  0%,
  100% {
    opacity: 0.62;
  }

  50% {
    opacity: 1;
  }
}

@keyframes cultivation-dial-aura {
  0%,
  100% {
    opacity: 0.32;
    transform: scale(0.98);
  }

  50% {
    opacity: 0.74;
    transform: scale(1.03);
  }
}
</style>
