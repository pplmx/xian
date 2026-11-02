<template>
  <section data-unopened-folio class="unopened-folio stagger-in" :aria-label="`${title}封卷`">
    <!--
      封卷页不是空白占位:玩家要能一眼读到「现在在哪、门在哪里、还差几重」。
      背景只画天门与云气,文字信息全部放在前景,装饰层不参与读屏。
    -->
    <svg
      class="unopened-folio__backdrop"
      viewBox="0 0 620 320"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
    >
      <g fill="none" stroke="currentColor" stroke-linecap="round">
        <path d="M334 112h278l-43-38H377zM355 131h238" />
        <path d="M382 131v155M566 131v155M366 286h216" />
        <path d="M426 286V186c0-11 9-20 20-20h62c11 0 20 9 20 20v100" />
        <path d="M54 270c45-23 84-20 116-5 32 14 75 16 117-3 41-20 89-23 188 6" />
        <path d="M22 232c27-14 51-13 73-4 24 10 49 10 73-2M422 221c29-15 58-14 85-3" />
        <path d="M502 57V25M478 41h48" />
      </g>
    </svg>

    <div class="unopened-folio__body">
      <div class="unopened-folio__narrative">
        <div class="unopened-folio__heading">
          <div class="unopened-folio__seal" aria-hidden="true">
            <span>封</span>
          </div>
          <div class="unopened-folio__heading-copy">
            <p class="unopened-folio__eyebrow">{{ eyebrow }}</p>
            <p class="unopened-folio__awaits">
              <span>尚待</span>
              <strong>{{ gateRealm }}</strong>
            </p>
            <p class="unopened-folio__route">再越 {{ remainingMajors }} 重境，此卷自开。</p>
          </div>
        </div>
        <p class="unopened-folio__lead">{{ lead }}</p>
        <p v-if="hint" class="unopened-folio__hint">{{ hint }}</p>
      </div>

      <div class="unopened-folio__gate" data-unopened-gate>
        <div class="unopened-folio__gate-head">
          <span>门径账</span>
          <span class="tabular">{{ currentMajor + 1 }} / {{ gateMajor + 1 }} 境</span>
        </div>

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
          <div
            class="unopened-folio__notches"
            data-unopened-notches
            role="progressbar"
            :aria-label="`修行进度，当前${currentRealm}，门限${gateRealm}`"
            aria-valuemin="1"
            :aria-valuemax="gateSteps.length"
            :aria-valuenow="currentStep + 1"
            :aria-valuetext="`${currentRealm}，尚隔 ${remainingMajors} 重境至${gateRealm}`"
            :style="{ '--unopened-steps': gateSteps.length }"
            :data-unopened-gate-major="gateMajor"
            :data-unopened-current-major="currentStep"
          >
            <span
              class="unopened-folio__thread"
              aria-hidden="true"
              :style="{ '--unopened-progress': progress }"
            />
            <span
              v-for="step in gateSteps"
              :key="step"
              class="unopened-folio__notch"
              :class="{
                'is-passed': step < currentStep,
                'is-current': step === currentStep,
                'is-gate': step === gateMajor,
              }"
              aria-hidden="true"
            >
              <span class="unopened-folio__notch-dot" />
            </span>
          </div>
          <p class="unopened-folio__notch-legend">
            <span>此世行迹</span>
            <span>门限</span>
          </p>
          <p class="unopened-folio__note">
            门限未至前，这一册只报行迹；修至门限后，内容会在此展开。
          </p>
        </div>
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
const gateSteps = computed(() =>
  Array.from({ length: Math.max(0, props.gateMajor) + 1 }, (_, step) => step),
);
const currentStep = computed(() =>
  Math.min(Math.max(0, props.currentMajor), Math.max(0, props.gateMajor)),
);
</script>
