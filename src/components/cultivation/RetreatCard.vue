<template>
  <!-- Phase 28 闭关:5 分钟 +150% 修炼,期间禁止历练(数值唯一来源 = buffs.ts retreat + earlyGameService) -->
  <!-- 开始那瞬整行一闪(与洞府建筑账行升级同款 card-flash)——「这件事发生在我这条账上」 -->
  <article
    class="cultivation-action cultivation-action--retreat"
    :class="retreatFlash ? 'card-flash' : ''"
    data-cultivation-action="retreat"
    @animationend.self="retreatFlash = false"
  >
    <header class="cultivation-action__head">
      <span class="cultivation-action__mark" aria-hidden="true">静</span>
      <div class="cultivation-action__heading">
        <div class="cultivation-action__title-row">
          <h3 class="cultivation-action__title">闭 关</h3>
          <span v-if="retreating" class="cultivation-action__status tabular">
            闭关中 · <span class="countdown-slot">{{ formatCountdown(retreatRemaining) }}</span>
          </span>
        </div>
        <p class="cultivation-action__lede">封洞静坐,换一段更快的行功;期间不能外出历练。</p>
      </div>
    </header>
    <div class="cultivation-action__body">
      <p class="cultivation-action__copy">
        <!--
          文案里的时制要与真实时长对得上:闭关只有 5 分钟,一炷香却是 30 分钟 ——
          拿"一炷香"说 5 分钟,玩家按古语理解会以为半小时,那就成了撒谎。
        -->
        静坐片刻({{ retreatMinutes }} 分钟),修炼速度
        {{ formatSignedPercent(retreatPct, 0) }};闭关期间无法外出历练。
      </p>
      <button
        v-if="!retreating"
        type="button"
        class="cultivation-action__primary"
        data-cultivation-primary-action="retreat"
        @click="beginRetreat"
      >
        闭关 · {{ retreatMinutes }}分钟 修炼 {{ formatSignedPercent(retreatPct, 0) }}(期间无法历练)
      </button>
      <!-- 闭关该收多少就摊多少:照现倍率折算 base,不只在定性「+150%」上打转。
           只在未闭关头展示为**前瞻**;闭关中现速率已含 +150%,再折算一遍会重复叠加,故撤。
           「闭关后」后面不许写「每秒」—— formatRate 自带「/秒」,两句都写就印成
           「闭关后每秒 ≈ 4.034亿/秒」。那一笔「约多收」是**五分钟的总量**,
           走 formatGN 报数,不借速率的单位(借了就成了「503.6亿/秒 修为」)。 -->
      <p v-if="!retreating" class="cultivation-action__forecast tabular">
        闭关后 ≈ {{ formatRate(retreatPerSec) }}(现 {{ formatRate(player.cultPerSec) }})·{{
          retreatMinutes
        }}分钟约多收 {{ formatGN(retreatExtra) }} 修为
      </p>
      <!--
        出关时可能有悟 —— 第 365 轮给闭关补了第二个顿悟入口(出关时掷一次)，
        而它此前**只在手册里写着**，界面一个字都没有。AGENTS.md 的
        「让看不见的机制可见」要管的正是这种事:该露的都要露进界面。

        它改变的是「什么时候闭关」这个决策，而不只是"多一份奖励":
          不知道   闭关 = 什么时候缺修为什么时候点
          知道     闭关 = 一个可能带回来点什么的选择(前期 35%)

        概率**现算**(`retreatEnlightenChance` → EARLY_EVENT_DECAY 同一条曲线)，
        不手抄 35% —— 与这张卡里「时长与加成取自 buffs.ts」同一条纪律。

        到了不会再出的境界(元婴之后)这一行自动消失:留一条永远不会发生的
        承诺，比不说更糟。
      -->
      <p
        v-if="!retreating && retreatEnlightenRate > 0"
        class="cultivation-action__forecast"
        data-retreat-enlighten
      >
        出关时约 {{ formatPercent(retreatEnlightenRate, 0) }} 携带顿悟(与历练偶遇同一套选项)
      </p>
    </div>
  </article>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { usePlayerStore } from "@/stores/player";
import { useUiStore } from "@/stores/ui";
import {
  isRetreating,
  startRetreat,
  getRetreatRemainingSec,
  retreatEnlightenChance,
} from "@/core/earlyGameService";
import { modOf } from "@/core/statsCalc";
import { buffDef } from "@/data/buffs";
import { formatPercent, formatSignedPercent } from "@/utils/format";
import { formatCountdown, formatGN, formatRate } from "@/utils/format";
import { useGameNow } from "@/composables/useGameNow";

const player = usePlayerStore();
const ui = useUiStore();

// Phase 28 闭关:状态与倒计时接 earlyGameService(buff 为真相源,重载后依旧可信)
const retreating = computed(() => isRetreating());
// 显示心跳(useGameNow,1s 心跳、gameNow() 同源):totalPlaySec 只每 5 秒
// (ACTIVE_STAMP_MS)被引擎加一次,分秒倒计时会 5 秒一跳 —— 换它之后秒针顺走;
// 暂停冻结/恢复顺延与 shiftBuffEnds 同一条语义,判定链(getRetreatRemainingSec)不读它,照旧
const gameNowSec = useGameNow();
const retreatRemaining = computed(() => {
  void gameNowSec.value;
  return getRetreatRemainingSec();
});
/**
 * 闭关的时长与加成取自 buffs.ts 的 retreat 本体(不在这里手抄 5 分钟 / +150%)。
 * 之前注释写着"数值唯一来源 = buffs.ts",但文案里的数字是手打的 —— 改常数就会撒谎。
 */
const retreatDef = buffDef("retreat");
const retreatMinutes = Math.round((retreatDef?.durationSec ?? 0) / 60);
/*
 * 存**比例**而不是百分数,格式化交给 `formatPercent`。
 *
 * 原先这里是 `Math.round(x * 100)` 再在模板里手写 `%` —— 那等于在视图里重做了一遍
 * `formatPercent` 的全部工作,却没有它的边界处理(上溢、`-0%` 印成「-0%」、去尾零)。
 * 同一张屏上其他百分比都走 `formatPercent`,只有这一处不同,精度也会分叉。
 */
const retreatPct = retreatDef?.mods.cultivationSpeed ?? 0;
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
/**
 * 一次闭关出顿悟的概率（百分数，已按境界衰减）。
 *
 * 直接读 `retreatEnlightenChance` —— 它内部乘 `EARLY_EVENT_DECAY`，
 * 故元婴之后为 0，模板那一行随之消失。不在这里另算一遍衰减。
 */
const retreatEnlightenRate = computed(() => retreatEnlightenChance(player.major));

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
