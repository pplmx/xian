<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { getCurrentCaveEvent, chooseCaveOption, dismissCaveEvent } from "@/core/earlyGameService";
import { gameNow } from "@/core/enginePause";
import { useGameClock } from "@/composables/useGameClock";
import { caveOptionEffectText } from "@/ui/earlyGameText";
import type { CaveEvent } from "@/types";
import OpportunityScroll from "@/components/earlygame/OpportunityScroll.vue";

/*
 * 洞府巡游 —— 与顿悟共用一张限时机缘卷。秒数照刷、到点由引擎收场;
 * 离开会占掉今日唯一一次巡游,故只能由写明后果的卷尾动作落定,
 * Esc、背板与关闭键都不许无声退出。
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
const totalSeconds = computed(() =>
  event.value
    ? Math.max(1, Math.ceil((event.value.expiresAt - event.value.triggeredAt) / 1000))
    : 0,
);
const choices = computed(() =>
  (event.value?.options ?? []).map((opt) => ({
    label: opt.label,
    flavor: opt.effect,
    effect: caveOptionEffectText(opt),
    risk: Boolean(opt.penalty),
  })),
);
</script>

<template>
  <OpportunityScroll
    :open="show"
    kind="cave"
    seal="巡"
    :source="`洞府巡游 · ${locationLabel}`"
    :title="event?.title ?? ''"
    :description="event?.desc ?? ''"
    :remaining-sec="remaining"
    :total-sec="totalSeconds"
    :options="choices"
    leave-label="离 开"
    leave-note="离开后,今日不再巡游"
    @choose="handleChoose"
    @leave="handleIgnore"
  />
</template>
