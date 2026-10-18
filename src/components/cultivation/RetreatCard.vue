<template>
  <!--
    闭关卡 —— 与修行/破境同族的卡头:左为楷书卡名(必须为 span,判据钉着),
    右侧是状态位:闭关中报倒计时(琥珀=进行中的事),未闭关不留字。
    卡名读作「闭 关」两字一顿,与「修 行」「破 境」同一口气。
  -->
  <!-- Phase 28 闭关:5 分钟 +150% 修炼,期间禁止历练(数值唯一来源 = buffs.ts retreat + earlyGameService) -->
  <!-- 开始那瞬整卡一闪(与 BuildingCard 升级同款 card-flash)——「这件事发生在我这张卡上」 -->
  <div
    class="card-ink px-4 py-3"
    :class="retreatFlash ? 'card-flash' : ''"
    @animationend.self="retreatFlash = false"
  >
    <div class="flex items-baseline justify-between">
      <span class="font-kai text-[14px] tracking-[0.2em] text-ink">闭 关</span>
      <span v-if="retreating" class="text-[11px] text-amber-ink tabular">
        闭关中 · <span class="countdown-slot">{{ formatCountdown(retreatRemaining) }}</span>
      </span>
    </div>
    <p class="mt-0.5 text-[10px] text-ink-faint">
      <!--
        文案里的时制要与真实时长对得上:闭关只有 5 分钟,一炷香却是 30 分钟 ——
        拿"一炷香"说 5 分钟,玩家按古语理解会以为半小时,那就成了撒谎。
      -->
      静坐片刻({{ retreatMinutes }} 分钟),修炼速度 +{{ retreatPct }}%;闭关期间无法外出历练。
    </p>
    <button
      v-if="!retreating"
      type="button"
      class="chip-ink mt-2 w-full !py-1.5 text-[11px]"
      @click="beginRetreat"
    >
      闭关 · {{ retreatMinutes }}分钟 修炼 +{{ retreatPct }}%(期间无法历练)
    </button>
    <!-- 闭关该收多少就摊多少:照现倍率折算 base,不只在定性「+150%」上打转。
         只在未闭关头展示为**前瞻**;闭关中现速率已含 +150%,再折算一遍会重复叠加,故撤 -->
    <p v-if="!retreating" class="mt-1 text-[10px] text-ink-faint tabular">
      闭关后每秒 ≈ {{ formatRate(retreatPerSec) }}(现 {{ formatRate(player.cultPerSec) }})·{{
        retreatMinutes
      }}分钟约多收 {{ formatRate(retreatExtra) }} 修为
    </p>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { usePlayerStore } from "@/stores/player";
import { useUiStore } from "@/stores/ui";
import { useGameStore } from "@/stores/game";
import { isRetreating, startRetreat, getRetreatRemainingSec } from "@/core/earlyGameService";
import { modOf } from "@/core/statsCalc";
import { buffDef } from "@/data/buffs";
import { formatCountdown, formatRate } from "@/utils/format";

const player = usePlayerStore();
const ui = useUiStore();

// Phase 28 闭关:状态与倒计时接 earlyGameService(buff 为真相源,重载后依旧可信)
const retreating = computed(() => isRetreating());
// 暂停感知:闭关剩余与结算同读 getRetreatRemainingSec(gameNow 冻结、恢复顺延),随心跳刷新
const retreatRemaining = computed(() => {
  void useGameStore().totalPlaySec;
  return getRetreatRemainingSec();
});
/**
 * 闭关的时长与加成取自 buffs.ts 的 retreat 本体(不在这里手抄 5 分钟 / +150%)。
 * 之前注释写着"数值唯一来源 = buffs.ts",但文案里的数字是手打的 —— 改常数就会撒谎。
 */
const retreatDef = buffDef("retreat");
const retreatMinutes = Math.round((retreatDef?.durationSec ?? 0) / 60);
const retreatPct = Math.round((retreatDef?.mods.cultivationSpeed ?? 0) * 100);
/**
 * 闭关该收多少:不能只按「现在每秒 ×2.5」—— 那会在已有聚气丹等速度增益时虚高。
 * 闭关给修为速度 ×(1+现倍率+retreat 的 1.5),故按现倍率折算 base 再乘,才是真值。
 * 现倍率与宿主的 cultMultiplier 同源(都读 modOf(finalStats.mods, "cultivationSpeed"))。
 */
const retreatPerSec = computed(() => {
  const r = retreatDef?.mods.cultivationSpeed ?? 0;
  const mult = 1 + modOf(player.finalStats.mods, "cultivationSpeed");
  return mult > 0 ? (player.cultPerSec * (mult + r)) / mult : player.cultPerSec;
});
/** 躺这 5 分钟,比照常多收多少修为 */
const retreatExtra = computed(
  () => (retreatPerSec.value - player.cultPerSec) * (retreatDef?.durationSec ?? 0),
);
function beginRetreat(): void {
  if (startRetreat()) {
    ui.toast("你封洞闭关,心不外骛", "info");
  }
}
/** 闭关开始那瞬卡片一闪(Watch 到 retreating 真值成立;5 分钟一到整卡随之回落,不再闪) */
const retreatFlash = ref(false);
watch(
  () => retreating.value,
  (nv, ov) => {
    if (nv && !ov) retreatFlash.value = true;
  },
);
</script>
