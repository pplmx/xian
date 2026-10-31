<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import {
  getCurrentEnlightenment,
  chooseEnlightenment,
  dismissEnlightenment,
} from "@/core/earlyGameService";
import { gameNow } from "@/core/enginePause";
import { useGameClock } from "@/composables/useGameClock";
import { enlightenmentEffectText } from "@/ui/earlyGameText";
import type { EnlightenmentEvent } from "@/types";
import OpportunityScroll from "@/components/earlygame/OpportunityScroll.vue";

/*
 * 顿悟弹窗 —— 曾经是自己铺的一层 fixed inset-0。
 *
 * 那样写有三个代价,而它们都不会在界面上露馅:没有 role=dialog / aria-modal
 * (读屏不知道有弹窗开了)、没有焦点管理(打开后焦点还在背后的按钮上,Tab 会跑出去)、
 * 样式也自成一套(font-bold/text-sm/rounded,与本作的水墨设计系统两回事)。
 * 全屏浮层只该有一个出处 —— 故改用共享机缘卷:语义、焦点与排版判据一并继承。
 *
 * 倒计时的口径不变:秒数每秒刷一次,到点由引擎自己收场。背板与 Esc 不再
 * 静默舍弃机缘 —— 秘境的签一旦丢弃没有第二次,必须由卷尾的显式动作落定。
 * 每秒的轮询走 useGameClock(暂停冻结):重置/导入确认开着时心跳是停的,
 * 轮询不该在这当口把一扇事件窗叠到确认窗上 —— 这正是收口后顺手修正的一处。
 */
const event = ref<EnlightenmentEvent | null>(null);
const remaining = ref(0);

function refresh() {
  event.value = getCurrentEnlightenment();
  if (event.value) {
    remaining.value = Math.max(0, Math.ceil((event.value.expiresAt - gameNow()) / 1000));
  }
}

function handleChoose(index: number) {
  chooseEnlightenment(index);
  event.value = null;
}

function handleIgnore() {
  dismissEnlightenment(); // 清模块级事件,轮询才不会把它弹回来
  event.value = null;
}

onMounted(refresh);
useGameClock(refresh, 1000);

const show = computed(() => event.value !== null);
const totalSeconds = computed(() =>
  event.value
    ? Math.max(1, Math.ceil((event.value.expiresAt - event.value.triggeredAt) / 1000))
    : 0,
);
const choices = computed(() =>
  (event.value?.options ?? []).map((opt) => ({
    label: opt.label,
    flavor: opt.desc,
    effect: enlightenmentEffectText(opt),
  })),
);
</script>

<template>
  <OpportunityScroll
    :open="show"
    kind="enlightenment"
    seal="悟"
    source="悟道顿悟"
    title="灵光乍现"
    description="识海无尘,数道灵机同时浮现。择定一签,所得即刻落身。"
    :remaining-sec="remaining"
    :total-sec="totalSeconds"
    :options="choices"
    leave-label="舍此机缘"
    leave-note="合卷即散,本次冷却仍照常计时"
    @choose="handleChoose"
    @leave="handleIgnore"
  />
</template>
