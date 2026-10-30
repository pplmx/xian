<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import {
  getCurrentEnlightenment,
  chooseEnlightenment,
  dismissEnlightenment,
} from "@/core/earlyGameService";
import { gameNow } from "@/core/enginePause";
import { useGameClock } from "@/composables/useGameClock";
import { URGENT_COUNTDOWN_SEC } from "@/data/constants";
import { enlightenmentEffectText } from "@/ui/earlyGameText";
import { formatCountdown } from "@/utils/format";
import type { EnlightenmentEvent } from "@/types";
import BaseModal from "@/components/common/BaseModal.vue";

/*
 * 顿悟弹窗 —— 曾经是自己铺的一层 fixed inset-0。
 *
 * 那样写有三个代价,而它们都不会在界面上露馅:没有 role=dialog / aria-modal
 * (读屏不知道有弹窗开了)、没有焦点管理(打开后焦点还在背后的按钮上,Tab 会跑出去)、
 * 样式也自成一套(font-bold/text-sm/rounded,与本作的水墨设计系统两回事)。
 * 全屏浮层只该有一个出处 —— 故改用 BaseModal:语义、焦点、Esc/背板关闭、
 * 以及排版自检里那两条尺子(控件要有名、不小于 28px)一并继承。
 *
 * 倒计时的口径不变:秒数每秒刷一次,到点由引擎自己收场;「忽略」= 关掉即散。
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
</script>

<template>
  <!-- 背板/Esc/关闭键一律等于「忽略」:与从前点背板的语义一致 -->
  <BaseModal :open="show" title="悟道顿悟" @close="handleIgnore">
    <p class="flex items-center justify-between text-[11px] text-ink-faint">
      <span>灵光一闪,选择一项增益</span>
      <!-- 临散前转朱砂:限时增益,过了就白丢 —— 紧迫得用颜色说出来,不看倒计时也瞥见
           (颜色判断用原始秒数,呈现走 formatCountdown 定宽串) -->
      <span
        class="tabular"
        :class="remaining <= URGENT_COUNTDOWN_SEC ? 'text-cinnabar' : 'text-gold-ink'"
        ><span class="countdown-slot">{{ formatCountdown(remaining) }}</span> 后自散</span
      >
    </p>
    <div class="mt-3 space-y-2">
      <button
        v-for="(opt, idx) in event?.options ?? []"
        :key="idx"
        class="w-full rounded-sm border border-ink/25 px-4 py-2.5 text-left transition-[transform,background-color] active:scale-98 active:bg-ink/5"
        @click="handleChoose(idx)"
      >
        <span class="block t-card">{{ opt.label }}</span>
        <!-- 风味一行、数值一行:数值由 ui/earlyGameText 从 buff 本体现算,
             文案(opt.desc)只剩风味 —— 改 buffs.ts 的常数,这一行跟着变 -->
        <span class="mt-0.5 block t-body text-ink-faint">{{ opt.desc }}</span>
        <span class="mt-0.5 block text-[11px] leading-relaxed tabular text-jade">{{
          enlightenmentEffectText(opt)
        }}</span>
      </button>
    </div>
    <template #footer>
      <button class="btn-ghost w-full" @click="handleIgnore">忽 略</button>
    </template>
  </BaseModal>
</template>
