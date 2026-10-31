<template>
  <!--
    标题带档位:从前三档(际遇/机缘/奇缘)共用「际遇」一个名,玩家撞上千分之几的机缘
    与撞上一件小事,看到的字一模一样 —— 稀有度白设了。档名一律取自 core/eventTier。
  -->
  <!-- 标题始终是这件事自己的名字(结算后 pendingEventId 已清,故沿用上一次记下的那个) -->
  <BaseModal :open="open" :closable="false" :title="def?.title ?? lastTitle" size="wide">
    <!-- 抉择阶段 -->
    <article
      v-if="!result && def"
      class="event-slip"
      data-event-slip
      :style="{ '--event-tier': tierDef.color }"
    >
      <header class="event-slip__head">
        <div class="event-slip__origin">
          <span class="event-slip__seal" aria-hidden="true">{{ tierSeal }}</span>
          <div class="event-slip__origin-copy">
            <p class="event-slip__eyebrow">
              <strong>{{ tierDef.name }}</strong>
              <span>{{ tierDef.brief }}</span>
            </p>
            <p class="event-slip__odds tabular">
              <span>{{ tierOdds }}</span>
              <span data-event-auto>{{ autoResolveText }}</span>
            </p>
          </div>
        </div>
        <p class="event-slip__source">{{ tierDef.source }}</p>
      </header>

      <blockquote class="event-slip__narrative" data-event-narrative>
        <span class="event-slip__mark" aria-hidden="true">遇</span>
        <p>{{ def.text }}</p>
      </blockquote>

      <!-- Phase 31.3 遗产回声:曾弃之缘,世界记得(叙事,无数值) -->
      <aside v-if="echo" class="event-slip__marginal is-echo" data-event-echo>
        <span class="event-slip__marginal-label">旧影</span>
        <p>{{ echo.line }}</p>
      </aside>
      <!-- 世界记忆:余波文本(曾经完成过的事件,再次遭遇时概率出现) -->
      <aside v-else-if="aftermath" class="event-slip__marginal is-aftermath" data-event-aftermath>
        <span class="event-slip__marginal-label">余波</span>
        <p>{{ aftermath }}</p>
      </aside>

      <section class="event-slip__choices" aria-labelledby="event-choice-heading">
        <header class="event-slip__choices-head">
          <div>
            <p id="event-choice-heading" class="event-slip__choices-title">此事何择</p>
            <p class="event-slip__choices-note">门限、代价与去向按当前档位现算</p>
          </div>
          <p class="event-slip__choice-count tabular">
            <strong>{{ availableChoiceCount }}</strong>
            <span>/ {{ choiceRows.length }} 可走</span>
          </p>
        </header>

        <div class="event-slip__choice-list">
          <button
            v-for="row in choiceRows"
            :key="row.index"
            type="button"
            class="event-choice"
            data-event-choice
            :class="{ 'is-blocked': !row.available, 'is-default': row.choice.isDefault }"
            :data-choice-available="row.available ? 'true' : 'false'"
            :disabled="!row.available"
            @click="choose(row.index)"
          >
            <span class="event-choice__index" aria-hidden="true">{{
              cnNumber(row.index + 1)
            }}</span>
            <span class="event-choice__body">
              <span class="event-choice__head">
                <span class="event-choice__label">{{ row.choice.label }}</span>
                <span v-if="row.choice.isDefault" class="event-choice__tag is-default">默选</span>
                <span v-if="row.choice.endsChain" class="event-choice__tag is-end">断此缘</span>
              </span>
              <span v-if="row.hint" class="event-choice__hint">{{ row.hint }}</span>
              <span v-if="row.blocked" class="event-choice__blocked" data-event-shortfall>
                {{ row.blocked }}
              </span>
              <span v-if="row.forecasts.length" class="event-slip__forecast" data-event-forecast>
                <span
                  v-for="(forecast, i) in row.forecasts"
                  :key="i"
                  class="event-outcome"
                  :class="`is-${forecast.tone}`"
                  data-event-outcome
                >
                  <span v-if="forecast.chance" class="event-outcome__chance tabular">{{
                    forecast.chance
                  }}</span>
                  <span class="event-outcome__text">{{ forecast.text }}</span>
                </span>
              </span>
            </span>
            <span class="event-choice__verb" aria-hidden="true">{{
              row.available ? "择" : "止"
            }}</span>
          </button>
        </div>
        <p class="event-slip__rule">逾时按可选的「默选」结算；没有默选时，取第一条能走的路。</p>
      </section>
    </article>

    <!-- 结果阶段 -->
    <article
      v-else-if="result"
      ref="resultSlip"
      class="event-slip event-slip--result"
      data-event-result
      role="status"
      aria-live="polite"
      tabindex="-1"
      :style="{ '--event-tier': tierDef.color }"
    >
      <header class="event-slip__head">
        <div class="event-slip__origin">
          <span class="event-slip__seal" aria-hidden="true">了</span>
          <div class="event-slip__origin-copy">
            <p class="event-slip__eyebrow">
              <strong>{{ tierDef.name }}</strong>
              <span>此遇已结</span>
            </p>
            <p v-if="chosenChoiceLabel" class="event-slip__result-choice">
              你择「{{ chosenChoiceLabel }}」
              <span v-if="chosenEndsChain" class="event-slip__result-end"> · 此缘已断</span>
            </p>
          </div>
        </div>
        <p class="event-slip__source">{{ tierDef.source }}</p>
      </header>

      <blockquote class="event-slip__narrative is-result">
        <span class="event-slip__mark" aria-hidden="true">果</span>
        <p class="animate-ink-pop">{{ result.outcomeText }}</p>
      </blockquote>

      <section v-if="result.lines.length" class="event-slip__result-ledger">
        <header>
          <span>此择清点</span>
          <small>真正入账的数目</small>
        </header>
        <!-- 收益清点逐行晕开(与离线归来卷轴同款 stagger-in) -->
        <ul v-if="result.lines.length" class="stagger-in event-slip__result-list">
          <li
            v-for="(line, i) in result.lines"
            :key="i"
            class="rounded-[2px] bg-paper-deep/70 px-3 py-1.5 text-body text-ink tabular"
          >
            {{ line }}
          </li>
        </ul>
      </section>
      <p v-else class="event-slip__empty">此事未留下数值账目。</p>
    </article>

    <template v-if="result" #footer>
      <button class="btn-seal w-full" @click="finish">继续赶路</button>
    </template>
  </BaseModal>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, useTemplateRef, watch } from "vue";
import { useAdventureStore } from "@/stores/adventure";
import { eventDef } from "@/data/events";
import { choiceHintText, choiceOutcomeForecasts } from "@/ui/eventText";
import {
  choiceAvailable,
  choiceUnavailableReason,
  resolveEventChoice,
  type EventResolution,
} from "@/core/eventEngine";
import { pendingChainStages } from "@/core/eventEngine";
import { usePlayerStore } from "@/stores/player";
import { afterEventResolved } from "@/core/exploration";
import { aftermathText, shouldTriggerAftermath } from "@/core/worldMemory";
import { echoFor, rollEcho, ECHO_CHANCE } from "@/core/fortuneEcho";
import { eventTierDef, eventTierOf, tierOddsText, type EventTier } from "@/core/eventTier";
import BaseModal from "@/components/common/BaseModal.vue";
import { EVENT_AUTO_RESOLVE_SECONDS } from "@/data/constants";
import { useNow } from "@/composables/useNow";
import { cnNumber, formatCountdown } from "@/utils/format";

const adventure = useAdventureStore();
const now = useNow();

const result = ref<EventResolution | null>(null);
const chosenChoiceLabel = ref("");
const chosenEndsChain = ref(false);
const resultSlip = useTemplateRef<HTMLElement>("resultSlip");
/** 本次弹窗的回声 roll(打开时一次,会话内稳定) */
let echoRolled = false;
let echoActive = false;
/**
 * 本次弹窗的余波 roll(打开时一次)。
 * 余波是「再次遭遇时按 AFTERMATH_CHANCE 概率出现」的**每次遭遇独立**判定 ——
 * 必须现场抽一个随机数。此前用事件 id 的固定 hash,同一事件怎么刷都恒大于/恒小于
 * AFTERMATH_CHANCE(实测 ev_jade_slip hash≈0.79、ev_old_man≈0.17),于是约八成事件
 * 永远不出余波、两成每次都出 —— 事件 id 不随完成次数变化,那个"20%"就退化成
 * 一道写死的二进制门,与 worldMemory 的"概率出现"承诺脱节。改成打开时抽一次。
 */
let aftermathRolled = false;
let aftermathRoll = 0;

const def = computed(() =>
  adventure.pendingEventId ? eventDef(adventure.pendingEventId) : undefined,
);
/**
 * 这一档是谁 —— 档位只在「事件已经定了」时才成立:
 * 结算阶段 pendingEventId 已被清掉(Tick 里 setPendingEvent(null)),
 * 故结果阶段沿用上一次算出的档位,不让横幅在结算的一瞬间闪成「际遇」。
 */
const tierId = ref<EventTier>("jingyu");
/** 结算阶段事件定义已查不到(pendingEventId 被清),故把它的名字一并记下 */
const lastTitle = ref("际遇");
watch(
  () => adventure.pendingEventId,
  (id) => {
    if (!id) return;
    tierId.value = eventTierOf(id);
    lastTitle.value = eventDef(id)?.title ?? lastTitle.value;
    // 每次新遭遇都是一次**独立**的开场 roll:回声(5%)与余波(20%)必须当场抽,
    // 不能挂在会话级 flag 上只抽一次 —— 否则 5%/20% 又会退化成整局一道写死的
    // 二进制门(与 aftermath 注释里要修掉的旧 bug 同一种)。事件一开就重置占位。
    echoRolled = false;
    echoActive = false;
    aftermathRolled = false;
    aftermathRoll = 0;
    chosenChoiceLabel.value = "";
    chosenEndsChain.value = false;
  },
  { immediate: true },
);
/** 档位定义(名字/颜色/一句话)与概率文案 */
const tierDef = computed(() => eventTierDef(tierId.value));
const tierSeal = computed(() => ({ jingyu: "遇", qiyuan: "缘", jiyuan: "机" })[tierId.value]);
const tierOdds = computed(() => tierOddsText(tierId.value, chainPending.value));
/** 有没有缘在续 —— 奇缘与机缘的实际概率都受它影响(见 core/eventTier.tierChances) */
const chainPending = computed(() => pendingChainStages(usePlayerStore().major).length > 0);
const tier = computed(() => adventure.currentRegion?.tier ?? 1);
const open = computed(() => def.value !== undefined || result.value !== null);
const autoResolveText = computed(() => {
  const since = adventure.pendingEventSince;
  if (!since) return `逾时默选 · ${EVENT_AUTO_RESOLVE_SECONDS} 秒`;
  const left = Math.max(0, EVENT_AUTO_RESOLVE_SECONDS - Math.floor((now.value - since) / 1000));
  return left > 0 ? `逾时默选 · 余 ${formatCountdown(left)}` : "逾时默选 · 即将结算";
});
const choiceRows = computed(() => {
  const current = def.value;
  if (!current) return [];
  return current.choices.map((choice, index) => ({
    choice,
    index,
    available: choiceAvailable(choice, tier.value),
    blocked: choiceUnavailableReason(choice, tier.value),
    hint: choiceHintText(choice, tier.value),
    forecasts: choiceOutcomeForecasts(choice, tier.value),
  }));
});
const availableChoiceCount = computed(() => choiceRows.value.filter((row) => row.available).length);

/** Phase 31.3 遗产回声:曾弃机缘,极低概率(5%)触发"世界认出你"(打开时一次) */
const echo = computed(() => {
  if (!def.value || result.value) return null;
  const evId = def.value.id;
  if (!evId.startsWith("ft_")) return null;
  if (!echoRolled) {
    echoRolled = true;
    echoActive = rollEcho() < ECHO_CHANCE;
  }
  return echoActive ? echoFor(evId) : null;
});

/** 世界记忆:此事件是否已完过,若是则按概率决定余波文案 */
const aftermath = computed<string | null>(() => {
  if (!def.value || result.value) return null;
  const mem = adventure.eventMemories[def.value.id];
  // 余波横幅只在「这次是第 2 次完成后的再次遭遇」才亮(times≥2):第 2 次遭遇时
  // times=1,筛选出的档位是「silence/已然远去」—— 人还站在事件选择界面就说它远去,
  // 文案自相矛盾;且行迹录/echo 档本就只统计 times≥2,横幅要与它们同一条线。
  if (!mem || mem.times < 2) return null;
  // 打开时抽一次的独立 roll(见 file 头的 aftermathRolled 注释)
  if (!aftermathRolled) {
    aftermathRolled = true;
    aftermathRoll = Math.random();
  }
  if (!shouldTriggerAftermath(adventure.eventMemories, def.value.id, aftermathRoll)) return null;
  return aftermathText(
    def.value.title,
    mem.times >= 3 ? "good" : mem.times >= 2 ? "echo" : "silence",
  );
});

function choose(idx: number): void {
  if (!def.value) return;
  const choice = def.value.choices[idx];
  if (!choice || !choiceAvailable(choice, tier.value)) return;
  chosenChoiceLabel.value = choice.label;
  chosenEndsChain.value = choice.endsChain ?? false;
  result.value = resolveEventChoice(def.value, idx, tier.value);
  afterEventResolved(Date.now());
  void nextTick(() => resultSlip.value?.focus());
}

function finish(): void {
  result.value = null;
  chosenChoiceLabel.value = "";
  chosenEndsChain.value = false;
}
</script>
