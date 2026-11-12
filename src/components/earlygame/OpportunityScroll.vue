<template>
  <BaseModal :open="open" :closable="false" :size="'wide'" :aria-label="`${source} · ${title}`">
    <article
      class="opportunity-scroll stagger-in"
      data-opportunity-scroll
      :data-opportunity-kind="kind"
    >
      <header class="opportunity-scroll__head">
        <span class="opportunity-scroll__seal font-kai" aria-hidden="true">{{ seal }}</span>
        <div class="opportunity-scroll__identity">
          <p class="opportunity-scroll__source">{{ source }} · 限时机缘</p>
          <h2 class="opportunity-scroll__title text-section font-kai" data-opportunity-title>
            {{ title }}
          </h2>
        </div>
        <div
          class="opportunity-scroll__clock"
          :class="{ 'is-urgent': urgent }"
          :aria-label="`剩余 ${formatCountdown(remainingSec)}`"
        >
          <span class="opportunity-scroll__clock-label">时机</span>
          <span
            class="opportunity-scroll__clock-value countdown-slot tabular"
            data-opportunity-timer
          >
            {{ formatCountdown(remainingSec) }}
          </span>
        </div>
      </header>

      <!--
        一眼先看见这是什么事 —— 限时机缘卷有倒计时在走、几签只能择一,
        玩家**来不及细读**;那种屏上画比字先到。

        取景分两层:`kind` 说明这件事从哪来(顿悟在修行里 / 巡游在洞府某处),
        `place` 只在洞府那一路才有、说明是洞府哪一处。灵田与丹炉不是一回事。

        落法是背景层(卷首那一条,绝对定位、不接指针):这一卷的正文是几个选项
        与它们的后果,倒计时还在走 —— 把画排进流里就会把选项推下去。
      -->
      <InkScene
        class="opportunity-scroll__scene"
        :terrain="sceneTerrainOfOpportunity(kind, place)"
        :marks="'ground'"
        aria-hidden="true"
      />

      <div class="opportunity-scroll__meter" :class="{ 'is-urgent': urgent }" aria-hidden="true">
        <span :style="{ width: `${remainingPercent}%` }" />
      </div>

      <p class="opportunity-scroll__story">{{ description }}</p>

      <div class="opportunity-scroll__rule">
        <span>{{ cnNumber(options.length) }} 签择一</span>
        <span>选定即生效 · 其余随风而散</span>
      </div>

      <div class="opportunity-scroll__choices">
        <button
          v-for="(option, index) in options"
          :key="`${option.label}-${index}`"
          type="button"
          class="opportunity-choice hoverable:hover:border-qing/50"
          :data-opportunity-choice="index"
          :data-risk="option.risk ? 'true' : undefined"
          :aria-label="`${option.label}。${option.flavor}。${option.risk ? '有代价。' : ''}${option.effect}`"
          @click="emit('choose', index)"
        >
          <span class="opportunity-choice__ordinal font-kai tabular" aria-hidden="true">
            {{ cnNumber(index + 1) }}
          </span>
          <span class="opportunity-choice__copy">
            <span class="opportunity-choice__name font-kai">
              {{ option.label }}
              <span v-if="option.risk" class="opportunity-choice__risk">有代价</span>
            </span>
            <span class="opportunity-choice__flavor">{{ option.flavor }}</span>
            <span class="opportunity-choice__effect" data-opportunity-effect>
              <span class="opportunity-choice__effect-label">本签</span>
              <span class="tabular">{{ option.effect || "无事发生" }}</span>
            </span>
          </span>
          <span class="opportunity-choice__action font-kai" aria-hidden="true">择</span>
        </button>
      </div>
    </article>

    <template #footer>
      <p class="opportunity-scroll__leave-note">{{ leaveNote }}</p>
      <button
        type="button"
        class="btn-ghost tap-row w-full !text-body"
        data-opportunity-leave
        @click="emit('leave')"
      >
        {{ leaveLabel }}
      </button>
    </template>
  </BaseModal>
</template>

<script setup lang="ts">
import { computed } from "vue";
import InkScene from "@/components/common/InkScene.vue";
import { sceneTerrainOfOpportunity } from "@/ui/sceneTerrain";
import { URGENT_COUNTDOWN_SEC } from "@/data/constants";
import { cnNumber, formatCountdown } from "@/utils/format";
import BaseModal from "@/components/common/BaseModal.vue";
import { clampPercent } from "@/utils/unitRatio";

interface OpportunityChoice {
  label: string;
  flavor: string;
  effect: string;
  risk?: boolean;
}

const props = defineProps<{
  open: boolean;
  kind: "enlightenment" | "cave";
  /**
   * 这一卷发生在洞府的哪一处(`field` / `furnace` / `library` / `array` / `garden`)。
   *
   * 只有洞府巡游那一路给;顿悟不在任何一处地里,传 null。取景要按它分开 ——
   * 灵田与丹炉不是一回事,五处地点画成同一片就等于这一卷只有一枚印。
   */
  place?: string | null;
  seal: string;
  source: string;
  title: string;
  description: string;
  remainingSec: number;
  totalSec: number;
  options: OpportunityChoice[];
  leaveLabel: string;
  leaveNote: string;
}>();

const emit = defineEmits<{
  choose: [index: number];
  leave: [];
}>();

const urgent = computed(() => props.remainingSec <= URGENT_COUNTDOWN_SEC);
const remainingPercent = computed(() => {
  if (props.totalSec <= 0) return 0;
  return clampPercent((props.remainingSec / props.totalSec) * 100);
});
</script>

<style scoped>
/*
 * 卷首那片天 —— 一条定高的背景层。
 *
 * 一屏「限时 + 择一」的地方,玩家没有时间读长句,画要**先到**。
 * 但正文是几个选项与它们的后果、倒计时还在走 —— 画占布局就会把它们推下去。
 * 故绝对定位、不接指针,只落在卷首那一条。
 *
 * 点景关掉(`:marks="'ground'"`):这条底下压着卷名与来源那两行,月与舟落在字上
 * 两边都读不清 —— 与地界志卷首、行旅图那两处同一条理由。
 */
.opportunity-scroll__scene {
  /*
   * 这一层在 **Teleport 到 body** 的弹窗里:`--world-mountain` 定义在
   * `.app-shell[data-world=…]` 上,弹窗不在那棵子树里,取不到值 ——
   * `InkScene` 那句 `fill: var(--world-mountain, currentColor)` 会退化成 currentColor。
   * 故在这一层自己给一个固定墨色(与突破结果 / 试炼档案两处既有做法一致)。
   */
  --world-mountain: rgb(var(--color-ink-rgb));
  --ink-scene-h: 100%;
  --ink-scene-ink: 0.62;
  position: absolute;
  inset-inline: 0;
  top: 0;
  height: 6.4rem;
  pointer-events: none;
}

.opportunity-scroll {
  --opportunity-line: rgb(var(--color-ink-rgb) / 0.14);
  --opportunity-line-strong: rgb(var(--color-ink-rgb) / 0.22);
  --opportunity-paper: rgb(var(--color-paper-deep-rgb) / 0.34);
  position: relative;
  isolation: isolate;
  min-width: 0;
}

/* 读数压在画之上 —— 背景层若盖住字,这一卷就废了 */
.opportunity-scroll > :not(.opportunity-scroll__scene) {
  position: relative;
  z-index: 1;
}

.opportunity-scroll__head {
  display: grid;
  grid-template-columns: 2.55rem minmax(0, 1fr) auto;
  align-items: start;
  gap: 0.65rem;
}

.opportunity-scroll__seal {
  display: grid;
  width: 2.35rem;
  height: 2.35rem;
  place-items: center;
  border: 1px solid rgb(var(--color-qing-rgb) / 0.38);
  border-radius: 2px;
  background: rgb(var(--color-qing-rgb) / 0.06);
  color: rgb(var(--color-qing-rgb));
  font-size: var(--type-section);
  line-height: 1;
}

.opportunity-scroll__identity {
  min-width: 0;
}

.opportunity-scroll__source {
  color: rgb(var(--color-qing-rgb));
  font-size: var(--type-note);
  letter-spacing: 0.16em;
  line-height: 1.5;
}

.opportunity-scroll__title {
  margin-top: 0.1rem;
  color: rgb(var(--color-ink-rgb));
  letter-spacing: 0.08em;
  line-height: 1.3;
  overflow-wrap: anywhere;
}

.opportunity-scroll__clock {
  display: flex;
  min-width: 4.8rem;
  flex-direction: column;
  align-items: flex-end;
  gap: 0.1rem;
  color: rgb(var(--color-gold-ink-rgb));
}

.opportunity-scroll__clock.is-urgent {
  color: rgb(var(--color-cinnabar-rgb));
}

.opportunity-scroll__clock-label {
  color: rgb(var(--color-ink-faint-rgb));
  font-size: var(--type-note);
  letter-spacing: 0.18em;
}

.opportunity-scroll__clock-value {
  white-space: nowrap;
  font-size: var(--type-title);
  line-height: 1.2;
}

.opportunity-scroll__meter {
  height: 2px;
  margin-top: 0.55rem;
  overflow: hidden;
  background: rgb(var(--color-ink-rgb) / 0.09);
}

.opportunity-scroll__meter span {
  display: block;
  height: 100%;
  background: rgb(var(--color-qing-rgb) / 0.66);
  transition: width 0.3s linear;
}

.opportunity-scroll__meter.is-urgent span {
  background: rgb(var(--color-cinnabar-rgb) / 0.72);
}

.opportunity-scroll__story {
  margin-top: 0.75rem;
  color: rgb(var(--color-ink-soft-rgb));
  font-size: var(--type-body);
  line-height: 1.75;
}

.opportunity-scroll__rule {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  justify-content: space-between;
  gap: 0.2rem 0.75rem;
  margin-top: 0.85rem;
  padding: 0.38rem 0 0.34rem;
  border-top: 1px solid var(--opportunity-line);
  color: rgb(var(--color-ink-faint-rgb));
  font-size: var(--type-note);
}

.opportunity-scroll__rule span:first-child {
  color: rgb(var(--color-ink-soft-rgb));
  font-family: var(--font-kai);
  letter-spacing: 0.12em;
}

.opportunity-scroll__choices {
  display: grid;
  gap: 0.45rem;
  margin-top: 0.45rem;
}

.opportunity-choice {
  display: grid;
  min-width: 0;
  min-height: 4.4rem;
  grid-template-columns: 1.55rem minmax(0, 1fr) auto;
  align-items: center;
  gap: 0.48rem 0.62rem;
  padding: 0.58rem 0.62rem;
  border: 1px solid var(--opportunity-line);
  border-left: 2px solid rgb(var(--color-qing-rgb) / 0.48);
  border-radius: 2px;
  background:
    linear-gradient(105deg, rgb(var(--color-qing-rgb) / 0.025), transparent 44%),
    var(--opportunity-paper);
  text-align: left;
  transition:
    border-color 0.14s ease,
    background-color 0.14s ease;
}

.opportunity-choice[data-risk="true"] {
  border-left-color: rgb(var(--color-cinnabar-rgb) / 0.48);
}

.opportunity-choice__ordinal {
  display: grid;
  width: 1.55rem;
  height: 1.55rem;
  place-items: center;
  border: 1px solid var(--opportunity-line-strong);
  border-radius: 2px;
  color: rgb(var(--color-ink-faint-rgb));
  font-size: var(--type-note);
  line-height: 1;
}

.opportunity-choice__copy {
  display: flex;
  min-width: 0;
  flex-direction: column;
}

.opportunity-choice__name {
  color: rgb(var(--color-ink-rgb));
  font-size: var(--type-title);
  letter-spacing: 0.07em;
  line-height: 1.4;
  overflow-wrap: anywhere;
}

.opportunity-choice__risk {
  display: inline-block;
  margin-left: 0.35rem;
  padding: 0 0.22rem;
  border: 1px solid rgb(var(--color-cinnabar-rgb) / 0.3);
  border-radius: 2px;
  color: rgb(var(--color-cinnabar-rgb));
  font-family: var(--font-kai);
  font-size: var(--type-note);
  letter-spacing: 0.08em;
  line-height: 1.5;
  vertical-align: 0.12em;
}

.opportunity-choice__flavor {
  margin-top: 0.06rem;
  color: rgb(var(--color-ink-faint-rgb));
  font-size: var(--type-note);
  line-height: 1.6;
  overflow-wrap: anywhere;
}

.opportunity-choice__effect {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  align-items: baseline;
  gap: 0.3rem;
  margin-top: 0.28rem;
  color: rgb(var(--color-ink-soft-rgb));
  font-size: var(--type-body);
  line-height: 1.55;
  overflow-wrap: anywhere;
}

.opportunity-choice__effect-label {
  color: rgb(var(--color-qing-rgb));
  font-family: var(--font-kai);
  font-size: var(--type-note);
  letter-spacing: 0.08em;
  white-space: nowrap;
}

.opportunity-choice[data-risk="true"] .opportunity-choice__effect-label {
  color: rgb(var(--color-cinnabar-rgb));
}

.opportunity-choice__action {
  display: grid;
  width: 1.75rem;
  height: 1.75rem;
  place-items: center;
  border: 1px solid rgb(var(--color-cinnabar-rgb) / 0.34);
  border-radius: 2px;
  color: rgb(var(--color-cinnabar-rgb));
  font-size: var(--type-body);
  line-height: 1;
}

.opportunity-choice:focus-visible {
  outline: 2px solid rgb(var(--color-cinnabar-rgb) / 0.7);
  outline-offset: 2px;
}

.opportunity-scroll__leave-note {
  margin-bottom: 0.45rem;
  color: rgb(var(--color-ink-faint-rgb));
  font-size: var(--type-note);
  line-height: 1.5;
  text-align: center;
}

@media (max-width: 220px) {
  .opportunity-scroll__head {
    grid-template-columns: 2.25rem minmax(0, 1fr);
    gap: 0.48rem;
  }

  .opportunity-scroll__seal {
    width: 2.1rem;
    height: 2.1rem;
  }

  .opportunity-scroll__clock {
    min-width: 0;
    grid-column: 2;
    flex-direction: row;
    align-items: baseline;
    justify-self: start;
    gap: 0.35rem;
  }

  .opportunity-scroll__rule {
    align-items: flex-start;
    flex-direction: column;
  }

  .opportunity-choice {
    grid-template-columns: 1.4rem minmax(0, 1fr);
    align-items: start;
    gap: 0.35rem 0.45rem;
    padding-inline: 0.48rem;
  }

  .opportunity-choice__ordinal {
    width: 1.4rem;
    height: 1.4rem;
    grid-row: 1 / span 2;
  }

  .opportunity-choice__action {
    width: auto;
    min-width: 2.2rem;
    height: 1.55rem;
    grid-column: 2;
    justify-self: start;
    padding-inline: 0.35rem;
  }

  .opportunity-choice__effect {
    grid-template-columns: minmax(0, 1fr);
    gap: 0.05rem;
  }
}
</style>
