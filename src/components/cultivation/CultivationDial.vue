<script setup lang="ts">
import { computed } from "vue";
import { usePlayerStore } from "@/stores/player";
import { realmLadderPoints } from "@/core/realmLadder";
import { formatPercent } from "@/utils/format";

const player = usePlayerStore();
const points = computed(() => realmLadderPoints(player.major));
const progress = computed(() => Math.max(0, Math.min(1, player.expProgress)));
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
    周天盘 —— 卷首的纯视觉摘要:外圈读仙路三态,内圈读本境修为。
    读数已在正文完整呈现,这里不重复进读屏;它负责让玩家一眼认出「我在哪、走到多远」。
  -->
  <div class="cultivation-dial" data-cultivation-dial aria-hidden="true">
    <svg class="cultivation-dial__svg" viewBox="0 0 140 140">
      <circle class="cultivation-dial__orbit" cx="70" cy="70" r="60" />
      <line
        v-for="(point, i) in points"
        :key="point.index"
        class="cultivation-dial__tick"
        :class="`is-${point.state}`"
        x1="70"
        y1="4"
        x2="70"
        :y2="point.worldStart ? 13 : 10"
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
    </svg>
    <div class="cultivation-dial__core">
      <span class="cultivation-dial__eyebrow">周天</span>
      <strong class="cultivation-dial__number">{{ progressText }}</strong>
      <span class="cultivation-dial__stage">{{ player.realm.name }} · {{ player.subName }}</span>
    </div>
  </div>
</template>

<style scoped>
.cultivation-dial {
  position: relative;
  display: grid;
  width: 140px;
  height: 140px;
  flex: none;
  place-items: center;
  isolation: isolate;
}

.cultivation-dial::before,
.cultivation-dial::after {
  position: absolute;
  content: "";
  border-radius: 50%;
  pointer-events: none;
}

.cultivation-dial::before {
  inset: 13px;
  border: 1px solid rgb(var(--color-ink-rgb) / 0.08);
  background:
    radial-gradient(circle at 42% 38%, rgb(var(--color-paper-rgb) / 0.82), transparent 48%),
    rgb(var(--color-paper-deep-rgb) / 0.42);
  box-shadow:
    inset 0 0 24px rgb(var(--color-ink-rgb) / 0.045),
    0 5px 18px rgb(var(--shadow-ink-rgb) / 0.08);
}

.cultivation-dial::after {
  inset: 25px;
  border: 1px dashed rgb(var(--color-ink-rgb) / 0.1);
}

.cultivation-dial__svg {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  overflow: visible;
}

.cultivation-dial__orbit,
.cultivation-dial__track,
.cultivation-dial__progress {
  fill: none;
}

.cultivation-dial__orbit {
  stroke: rgb(var(--color-ink-rgb) / 0.08);
  stroke-width: 0.75;
}

.cultivation-dial__tick {
  stroke: rgb(var(--color-ink-rgb) / 0.18);
  stroke-width: 1.5;
}

.cultivation-dial__tick.is-done {
  stroke: rgb(var(--color-qing-rgb) / 0.62);
}

.cultivation-dial__tick.is-now {
  stroke: rgb(var(--color-cinnabar-rgb));
  stroke-width: 2.5;
  animation: cultivation-dial-now 2.8s ease-in-out infinite;
}

.cultivation-dial__track {
  stroke: rgb(var(--color-ink-rgb) / 0.07);
  stroke-width: 2;
}

.cultivation-dial__progress {
  stroke: rgb(var(--color-qing-rgb) / 0.78);
  stroke-width: 2.5;
  stroke-linecap: round;
  transform: rotate(-90deg);
  transform-origin: 70px 70px;
  transition: stroke-dashoffset 0.5s ease;
}

.cultivation-dial__core {
  position: relative;
  z-index: 1;
  display: grid;
  justify-items: center;
  line-height: 1;
}

.cultivation-dial__eyebrow,
.cultivation-dial__stage {
  color: rgb(var(--color-ink-faint-rgb));
  font-family: var(--font-kai);
  font-size: var(--type-note);
  letter-spacing: 0.16em;
}

.cultivation-dial__number {
  margin: 0.15rem 0 0.22rem;
  color: rgb(var(--color-ink-rgb));
  font-family: var(--font-kai);
  font-size: var(--type-section);
  font-weight: 400;
  font-variant-numeric: tabular-nums;
  letter-spacing: 0.02em;
}

.cultivation-dial__stage {
  max-width: 5.6rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  letter-spacing: 0.06em;
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
</style>
