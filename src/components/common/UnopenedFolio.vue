<template>
  <section data-unopened-folio class="unopened-folio stagger-in">
    <!--
      封卷页不是空白占位:玩家要能一眼读到「现在在哪、门在哪里、还差几重」。
      背景只画天门与云气,文字信息全部放在前景,装饰层不参与读屏。
    -->
    <svg
      class="unopened-folio__backdrop"
      viewBox="0 0 520 280"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
    >
      <g fill="none" stroke="currentColor" stroke-linecap="round">
        <path d="M168 248V105c0-13 10-23 23-23h138c13 0 23 10 23 23v143" />
        <path d="M153 106h214M186 82h148M199 248h118" />
        <path d="M218 248V142c0-9 7-16 16-16h52c9 0 16 7 16 16v106" />
        <path d="M64 225c42-21 78-18 108-4 30 14 70 15 109-3 38-18 82-21 175 6" />
        <path d="M32 190c25-13 48-12 69-3 22 9 46 9 68-2M350 179c27-14 54-13 79-3" />
        <path d="M266 54V31M247 42h38" />
      </g>
    </svg>

    <div class="relative z-10">
      <p class="unopened-folio__eyebrow">{{ eyebrow }}</p>
      <div class="unopened-folio__seal" aria-hidden="true">
        <span>封</span>
      </div>
      <h2 class="mt-4 font-kai text-display tracking-[0.3em] text-ink">{{ title }}</h2>
      <p class="mx-auto mt-3 max-w-[30rem] t-body text-ink-soft">{{ lead }}</p>
      <p v-if="hint" class="mx-auto mt-1 max-w-[30rem] text-note leading-relaxed text-ink-faint">
        {{ hint }}
      </p>

      <div class="unopened-folio__ledger" data-unopened-ledger>
        <p>
          <span>当前</span>
          <strong>{{ currentRealm }}</strong>
        </p>
        <p>
          <span>门限</span>
          <strong class="text-cinnabar">{{ gateRealm }}</strong>
        </p>
        <p>
          <span>尚隔</span>
          <strong>{{ remainingMajors }} 重境</strong>
        </p>
      </div>

      <div class="unopened-folio__progress" data-unopened-progress>
        <p class="flex items-baseline justify-between gap-3">
          <span class="text-note text-ink-faint">此世行迹</span>
          <span class="tabular text-note text-ink-soft"
            >{{ currentMajor + 1 }} / {{ gateMajor + 1 }} 境</span
          >
        </p>
        <div
          class="mt-1.5"
          role="progressbar"
          :aria-label="`修行进度，当前${currentRealm}，门限${gateRealm}`"
          aria-valuemin="0"
          aria-valuemax="100"
          :aria-valuenow="progress * 100"
          :aria-valuetext="`${currentMajor + 1} / ${gateMajor + 1} 境`"
        >
          <ProgressBar :value="progress" :height="5" color="var(--color-qing)" />
        </div>
        <p class="mt-1.5 text-note leading-relaxed text-ink-faint">
          门限未至前,这一册只报行迹;修至门限后,内容会在此展开。
        </p>
      </div>

      <div class="unopened-folio__actions">
        <RouterLink to="/cultivation" class="btn-seal min-h-11">回修炼 →</RouterLink>
        <RouterLink to="/codex" class="btn-ghost min-h-11">看境界谱</RouterLink>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed } from "vue";
import ProgressBar from "./ProgressBar.vue";

const props = withDefaults(
  defineProps<{
    title: string;
    lead: string;
    hint?: string;
    eyebrow?: string;
    currentRealm: string;
    currentMajor: number;
    gateRealm: string;
    gateMajor: number;
  }>(),
  { eyebrow: "天机未启", hint: "" },
);

const remainingMajors = computed(() => Math.max(0, props.gateMajor - props.currentMajor));
const progress = computed(() => {
  if (props.gateMajor <= 0) return 1;
  return Math.min(1, Math.max(0, props.currentMajor / props.gateMajor));
});
</script>
