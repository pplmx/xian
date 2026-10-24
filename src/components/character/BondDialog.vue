<template>
  <!-- 道侣弹窗:这一世的关系与历世的同行(自 CharacterView 迁入) -->
  <BaseModal
    :open="open"
    :title="bondDef ? `道侣 · ${bondDef.name}` : '道侣'"
    @close="emit('close')"
  >
    <template v-if="bondDef && bond">
      <p class="font-kai text-[14px] text-ink">{{ bondDef.name }}</p>
      <p class="mt-0.5 t-body text-ink-faint">{{ bondDef.brief }}</p>

      <!--
        「她此刻在等什么」提到三维条**之前**。

        此前这块的顺序是:名 → 简介 → 性情 → 三维条 → 共历 → 她所求 → 底线
        → 门槛 → 她开了口 → 共同事件。三维条(知交/信任/情意)排在第二屏,
        而它是**关系状态的度量**,不是玩家打开这个弹窗要办的事。
        打开道侣弹窗的人真正想问的是「她在等我说什么」和「她要不要什么」——
        这两件事原本被压在最底下。

        现在:先说事(她开了口 / 共同事件),再说人(性情 · 所求 · 底线),
        最后才是关系刻度。三维条仍在,只是降到该在的位置。
      -->

      <!-- 她自己提出的事(Phase 34.1):不是世界安排的事件,是她开的口 -->
      <template v-if="herIntent">
        <div class="mt-3 rounded-md border border-gold-ink/30 bg-gold-ink/[0.04] px-3 py-2.5">
          <p class="text-[11px] leading-relaxed text-gold-ink">{{ herIntent.line }}</p>
          <p class="mt-1 text-[10px] text-ink-faint">她所求:{{ herIntent.wish }}</p>
          <!-- 意图由经历催生,不是凭空的:把「因何而起」摆出来 -->
          <p v-if="herIntentSparks" class="text-[10px] text-ink-faint">
            因何而起:{{ herIntentSparks }}
          </p>
          <div class="mt-2.5 flex gap-2">
            <button
              v-for="r in INTENT_CHOICES"
              :key="r.id"
              class="card-ink grow px-2 py-2 text-center text-[11px] text-ink-soft active:scale-99"
              @click="answerIntent(r.id)"
            >
              {{ r.label }}
            </button>
          </div>
        </div>
      </template>

      <!-- 共同事件:她的诉求与底线在此第一次被玩家看见并回应 -->
      <template v-if="pendingEvent && !bond.fallen && !bond.departed">
        <div class="mt-3 rounded-md border border-ink/15 bg-paper-deep/50 px-3 py-2.5">
          <p class="t-card">{{ pendingEvent.title }}</p>
          <p class="text-[10px] text-ink-faint">因何而来:{{ pendingEventTriggers }}</p>
          <p class="mt-1 t-body text-ink-soft">{{ pendingEvent.text }}</p>
          <!-- 她的诉求与底线并列成一对:先她要什么,再她不越什么 —— 回应之前必须都知道 -->
          <div class="mt-1.5 space-y-0.5 border-l-2 border-qing/40 pl-2">
            <p class="text-[11px] text-qing">{{ pendingEvent.herWish }}</p>
            <p class="text-[10px] text-ink-faint">{{ pendingEvent.herLimit }}</p>
          </div>
          <p v-if="herLine" class="mt-1.5 text-[11px] text-gold-ink">{{ herLine }}</p>
          <div class="mt-2.5 space-y-1.5">
            <button
              v-for="ch in pendingEvent.choices"
              :key="ch.id"
              class="card-ink w-full px-3 py-2 text-left text-[11px] text-ink-soft active:scale-99"
              :class="{
                '!border-cinnabar/50 text-cinnabar': ch.peril,
                '!border-gold-ink/40': ch.risky && !ch.peril,
              }"
              @click="pickChoice(ch.id)"
            >
              {{ ch.label }}
              <span v-if="ch.peril" class="ml-1 text-[10px] text-cinnabar">〔共命之险〕</span>
            </button>
          </div>
        </div>
      </template>
      <p
        v-else-if="lastEventText"
        class="mt-3 rounded-md border border-ink/10 bg-paper-deep/40 px-3 py-2 t-body text-ink-soft"
      >
        {{ lastEventText }}
      </p>

      <!-- 人:性情与两句话 —— 她所求 / 她不越的线 -->
      <!-- 花饰分隔(ink-divider-mark 的中腰墨点)是页面层专属 —— 弹窗用素分隔(ornament 判据;
           迁出宿主前它一直靠 views/ 整目录豁免躲在判据外,拆出后照弹窗族先例归位) -->
      <div class="mt-3 ink-divider" />
      <p class="text-[11px] text-ink-soft">
        {{ TEMPER_NAMES[bondDef.temper] }} · {{ LEAN_NAMES[bondDef.lean] }}道
        <span class="ml-1 text-qing">{{ STAGE_NAMES[bond.stage] }}</span>
        <span v-if="bond.fallen" class="ml-1 text-cinnabar">已殁</span
        ><span v-if="bond.departed" class="ml-1 text-qing">已离</span>
      </p>
      <p class="mt-1.5 t-body text-ink-soft">她所求:{{ bondDef.pursuit }}</p>
      <p class="mt-0.5 t-body text-ink-faint">她不越的线:{{ bondDef.taboo }}</p>

      <!-- 关系刻度:三维只影响关系推进,不进任何属性 -->
      <div class="mt-3 space-y-1.5">
        <p v-for="m in bondMeters" :key="m.label" class="flex items-center gap-2 text-[11px]">
          <span class="w-10 shrink-0 text-ink-faint">{{ m.label }}</span>
          <ProgressBar :value="m.v / 100" class="grow" :height="4" color="var(--color-qing)" />
          <span class="w-8 shrink-0 text-right tabular text-ink-soft">{{ m.v }}</span>
        </p>
      </div>
      <p class="mt-1.5 text-[10px] text-ink-faint">
        共历 {{ bond.shared }} 次<span v-if="responseLine">
          · 她开的口,你历次回应:{{ responseLine }}</span
        >
      </p>

      <!-- 门槛:离下一段还差什么 —— 紧挨着刻度,因为差的正是这些刻度的值 -->
      <p v-if="gateHint" class="mt-2 text-[11px] text-gold-ink">
        离「{{ STAGE_NAMES[gateHint.stage] }}」尚差:{{ gateHint.lacking.join("、") }}
      </p>
    </template>
    <p v-else class="t-body text-ink-faint">
      此生尚未遇见谁。人是在路上碰到的,不是挑出来的 —— 多走几处地界,或许自有相逢。
    </p>
    <!--
      空态得给一条出路。此前这段只把「为什么没有」说清楚(人是在路上碰到的),
      却没说「那就往哪走」—— 读完仍停在原地。历练页本来就是遇人的地方,
      直接给一枚到那儿的按钮。
    -->
    <RouterLink
      v-if="!bondDef"
      to="/adventure"
      class="btn-ghost mt-3 flex w-full items-center justify-center !text-[11px]"
      @click="emit('close')"
    >
      去 历 练
    </RouterLink>

    <template v-if="pastBonds.length">
      <p class="mt-4 font-kai text-[14px] tracking-widest text-ink-soft">历世同行</p>
      <div class="scroll-pane mt-2 max-h-40 space-y-1.5 overflow-y-auto">
        <p v-for="(r, i) in pastBonds" :key="i" class="flex justify-between text-[11px]">
          <span class="text-ink-soft">{{ r.name }}</span>
          <span class="text-ink-faint"
            >{{ STAGE_NAMES[r.stage] }} · {{ ENDING_NAMES[r.ending] }}</span
          >
        </p>
      </div>
    </template>
  </BaseModal>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { ENDING_NAMES, LEAN_NAMES, STAGE_NAMES, TEMPER_NAMES } from "@/data/daolu";
import { chooseBondEvent, herStance, nextGateHint, respondIntent } from "@/core/daoluService";
import { RESPONSE_NAMES, SPARK_NAMES } from "@/data/bondIntent";
import { TRIGGER_NAMES } from "@/data/bondEvents";
import { useBondOverview } from "@/composables/useBondOverview";
import BaseModal from "@/components/common/BaseModal.vue";
import ProgressBar from "@/components/common/ProgressBar.vue";

/**
 * 道侣弹窗(自 CharacterView 迁入)。
 *
 * 关系状态的本体投影(bond/bondDef/pastBonds/pendingEvent/herIntent/hasBondWord)
 * 收在 composables/useBondOverview.ts —— 入口卡与这里共用同一份定义;
 * 本组件只留弹窗自己的交互态:回应后的尾账(lastEventText)、三维条、
 * 门槛提示、回应史。
 */
const props = defineProps<{ open: boolean }>();
const emit = defineEmits<{ close: [] }>();

const { bond, bondDef, pastBonds, pendingEvent, herIntent } = useBondOverview();

const bondMeters = computed(() =>
  bond.value
    ? [
        { label: "缘分", v: bond.value.fate },
        { label: "信任", v: bond.value.trust },
        { label: "契合", v: bond.value.accord },
      ]
    : [],
);
const gateHint = computed(() => nextGateHint());
/** 这件事因何而来(触发名取自 bondEvents,不在视图里手写) */
const pendingEventTriggers = computed(() =>
  (pendingEvent.value?.triggers ?? [])
    .map((t) => TRIGGER_NAMES[t])
    .filter(Boolean)
    .join("、"),
);
const lastEventText = ref("");
const herLine = computed(() => (pendingEvent.value ? herStance(pendingEvent.value) : null));
watch(
  () => props.open,
  (open) => {
    if (open) lastEventText.value = "";
  },
);
function pickChoice(choiceId: string): void {
  if (!pendingEvent.value) return;
  const r = chooseBondEvent(pendingEvent.value.id, choiceId);
  lastEventText.value = r?.text ?? "";
}

/** 这份心意因何而起(经历名取自 bondIntent) */
const herIntentSparks = computed(() => {
  const sparks = herIntent.value?.sparks ?? [];
  return [...new Set(sparks)].map((s) => SPARK_NAMES[s]).join("、");
});
/** 她记得你怎么答的 —— 回应名取自 bondIntent,视图不另写一份 */
const responseLine = computed(() => {
  const rs = bond.value?.intent?.responses ?? [];
  return rs.length ? rs.map((r) => RESPONSE_NAMES[r]).join(" · ") : "";
});
const INTENT_CHOICES = [
  { id: "accept" as const, label: "与她同去" },
  { id: "refuse" as const, label: "婉言谢绝" },
  { id: "ignore" as const, label: "不作声" },
];
function answerIntent(r: "accept" | "refuse" | "ignore"): void {
  const a = respondIntent(r);
  lastEventText.value = a?.text ?? "";
}
</script>
