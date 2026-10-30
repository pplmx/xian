<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { getCurrentCaveEvent, chooseCaveOption, dismissCaveEvent } from "@/core/earlyGameService";
import { gameNow } from "@/core/enginePause";
import { useGameClock } from "@/composables/useGameClock";
import { URGENT_COUNTDOWN_SEC } from "@/data/constants";
import { formatCountdown } from "@/utils/format";
import { caveOptionEffectText } from "@/ui/earlyGameText";
import type { CaveEvent } from "@/types";
import BaseModal from "@/components/common/BaseModal.vue";

/*
 * 洞府巡游 —— 与顿悟同一个毛病(自己铺 fixed inset-0):没有 dialog 语义、
 * 没有焦点管理、样式也自成一套。改用 BaseModal,行为一字不改:
 * 秒数照刷、到点由引擎收场。关掉即散=放弃当日巡游 —— 后果只挂在写明了
 * 它的「离开」按钮上,故 :closable=false 禁掉 Esc/背板/X 的无声退出
 * (随手一关与明确放弃代价相同却毫无提示,审计视为坑)。
 *
 * 每秒的轮询走 useGameClock(暂停冻结),与顿悟弹窗同一处收口:
 * 重置/导入确认开着时不再把事件窗叠到确认窗上。
 */
const event = ref<CaveEvent | null>(null);
const remaining = ref(0);

const locationNames: Record<string, string> = {
  field: "灵田",
  furnace: "丹炉",
  library: "藏经阁",
  array: "聚灵阵",
  garden: "灵兽园",
};

function refresh() {
  event.value = getCurrentCaveEvent();
  if (event.value) {
    remaining.value = Math.max(0, Math.ceil((event.value.expiresAt - gameNow()) / 1000));
  }
}

function handleChoose(index: number) {
  chooseCaveOption(index);
  event.value = null;
}

function handleIgnore() {
  dismissCaveEvent(); // 清模块级事件,轮询才不会把它弹回来
  event.value = null;
}

onMounted(refresh);
useGameClock(refresh, 1000);

const show = computed(() => event.value !== null);
const locationLabel = computed(() =>
  event.value ? (locationNames[event.value.location] ?? "未知") : "",
);
</script>

<template>
  <BaseModal :open="show" title="洞府巡游" :closable="false" @close="handleIgnore">
    <p class="flex items-center justify-between text-body text-ink-faint">
      <span class="chip-ink !py-0 text-note text-jade">{{ locationLabel }}</span>
      <!-- 临散前转朱砂:关掉=放弃当日巡游,紧迫得用颜色说出来
           (颜色判断用原始秒数,呈现走 formatCountdown 定宽串) -->
      <span
        class="tabular"
        :class="remaining <= URGENT_COUNTDOWN_SEC ? 'text-cinnabar' : 'text-gold-ink'"
        ><span class="countdown-slot">{{ formatCountdown(remaining) }}</span> 后自散</span
      >
    </p>
    <p class="mt-3 t-card">{{ event?.title }}</p>
    <p class="mt-1 t-body text-ink-soft">{{ event?.desc }}</p>
    <div class="mt-3 space-y-2">
      <button
        v-for="(opt, idx) in event?.options ?? []"
        :key="idx"
        class="w-full rounded-sm border border-ink/25 px-4 py-2.5 text-left transition-[transform,background-color] active:scale-98 active:bg-ink/5"
        @click="handleChoose(idx)"
      >
        <span class="block t-card">{{ opt.label }}</span>
        <!-- 风味一行、数值一行:数值由 ui/earlyGameText 从 reward / penalty 现算,
             文案(opt.effect)只剩风味 —— 改 buffs.ts 或 reward 的值,这一行跟着变 -->
        <span class="mt-0.5 block t-body text-ink-faint">{{ opt.effect }}</span>
        <span class="mt-0.5 block text-body leading-relaxed tabular text-jade">{{
          caveOptionEffectText(opt)
        }}</span>
      </button>
    </div>
    <template #footer>
      <button class="btn-ghost w-full" @click="handleIgnore">离 开(今日不再巡游)</button>
    </template>
  </BaseModal>
</template>
