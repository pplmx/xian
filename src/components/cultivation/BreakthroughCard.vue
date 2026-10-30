<template>
  <!--
    破境卡 —— 与修行/闭关同族的卡头:左为楷书卡名(必须为 span,判据钉着),
    右侧是状态位:可破时石绿,不可破时把拦因原样写出来(与突破钮同一个 reason,
    不在这一行另编一套话)。
    卡名读作「破 境」两字一顿,与「修 行」「闭 关」同一口气。
  -->
  <!--
    素卡:不加封条,因为它不是「正在进行的事」,是「下一步要不要做」。
  -->
  <div class="card-ink px-4 py-3">
    <div class="flex items-baseline justify-between">
      <span class="font-kai text-title tracking-[0.2em] text-ink">破 境</span>
      <span class="text-body" :class="btInfo.ready ? 'text-jade' : 'text-ink-soft'">
        {{ btInfo.ready ? "可破" : btInfo.reason }}
      </span>
    </div>
    <!--
      天劫步不显示「突破成功率」:那条路根本不掷这个骰子(见 breakthrough.attemptBreakthrough,
      渡劫走 runTribulation 的逐波推演),摆出来只会让人以为还有一个可以堆的概率。
    -->
    <div class="mt-2 grid gap-2" :class="btInfo.needTribulation ? 'grid-cols-1' : 'grid-cols-2'">
      <div v-if="!btInfo.needTribulation" class="rounded-md bg-paper-deep/60 px-2.5 py-1.5">
        <p class="text-note text-ink-faint">进阶成功率(小进阶)</p>
        <p
          class="tabular text-[16px] font-kai leading-tight"
          :class="btInfo.rate >= 0.7 ? 'text-jade' : 'text-cinnabar'"
        >
          {{ btInfo.rateText }}
        </p>
        <!--
          概率不直观,期望直观:71% 读起来"还行",但它意味着平均要试 1.4 次。
          数值来自 core 的 expectedTries(与 realms.sim 同一个口径),不在这里另算。
        -->
        <p v-if="triesText" class="tabular text-note text-ink-faint">{{ triesText }}</p>
      </div>
      <div class="rounded-md bg-paper-deep/60 px-2.5 py-1.5">
        <p class="text-note text-ink-faint">{{ btInfo.needTribulation ? "此劫" : "渡劫" }}</p>
        <template v-if="tribPlan">
          <p
            class="tabular text-[16px] font-kai leading-tight"
            :class="PLAN_COLOR[tribPlan.verdict]"
          >
            {{ tribPlan.title }}
          </p>
          <p class="text-note text-ink-faint">
            劫势:{{ verdictLabel(tribPlan.verdict) }}
            <template v-if="tribPlan.risks.length"> · {{ tribPlan.risks[0] }}</template>
          </p>
        </template>
        <p v-else class="text-[16px] font-kai leading-tight text-ink-faint">非大关</p>
      </div>
    </div>

    <!--
      破境增益 · 此刻在身:小进阶的成功率是谁在顶,突破前一眼见 —— buff→modsText,
      与开炉幕同款(不做两本账);大关不吃此益,故只在非天劫幕亮。
    -->
    <div v-if="!btInfo.needTribulation" class="mt-2 rounded-md bg-paper-deep/60 px-3 py-2">
      <p class="text-note text-ink-faint">破境增益 · 此刻在身</p>
      <div v-if="breakthroughBuffRows.length" class="mt-1 space-y-0.5">
        <p
          v-for="row in breakthroughBuffRows"
          :key="row.buffId"
          class="flex items-baseline gap-1.5 text-body"
        >
          <span class="font-kai shrink-0" :class="row.rate > 0 ? 'text-qing' : 'text-cinnabar'">{{
            row.name
          }}</span>
          <span class="tabular text-ink-soft">{{ row.effect }}</span>
        </p>
        <!-- 诚实收口:这条只列「状态」来源 —— 装备/称号/天时等别的源头在大数字里,不在条里重抄 -->
        <p class="pt-0.5 text-note leading-relaxed text-ink-faint">
          只列状态来源 —— 装备·名号·天时等见上值
        </p>
      </div>
      <p v-else class="mt-0.5 text-note leading-relaxed text-ink-faint">
        此刻身无破境状态 —— 备一味
        <span class="text-qing">破境 · 凝神 · 定心 · 本源归一</span>,成功率即刻见涨
      </p>
    </div>

    <!-- 劫势详情(决意前评估:风险维度 + 建议)→ TribulationPanel,注释与读数群随本体迁入 -->
    <TribulationPanel v-if="tribPlan" :plan="tribPlan" />
    <p data-value-row class="mt-1 text-body text-ink-soft tabular">
      耗灵气 {{ formatNum(btInfo.qiCost) }}
      <template v-if="btInfo.needTribulation">
        ·
        <span class="text-violet-ink">此乃大关,需渡天劫</span>
      </template>
    </p>
    <!-- 突破不成的真代价也要摊:灵气付了之外,还有修为折损与必发的重伤
         (buffs.ts injury:修速减半、战力大减,需引气静养耗灵气平复)—— 频率≠无代价,
         且不复述「只损修为」那种不完整的账。
         减多少由 buff 本体现算:这里曾读 injury 的 desc,而 desc 现在只写风味 ——
         数值若留在那句风味里,改 mods 之后这行就成了唯一不跟的那处。 -->
    <p class="mt-0.5 text-note leading-relaxed text-ink-faint tabular">
      突破不成损修为 {{ formatPercent(BT_FAIL_EXP_LOSS) }}、身负
      <span class="text-cinnabar">重伤</span>({{ modsText(injuryDef.mods) }},持续
      {{ cnNumber(INJURY_DURATION) }}
      秒,可引气静养平复)(破境返还词条可减修为损,首败跬步传承可全免)
    </p>

    <!-- Phase 28 突破准备:静坐调息 / 服聚气丹(无劫突破时,一次性加成) -->
    <div
      v-if="!btInfo.needTribulation"
      class="mt-2 rounded-md border border-ink/10 bg-paper-deep/50 px-2.5 py-2"
    >
      <div class="flex items-center justify-between text-note text-ink-faint">
        <span>突破准备(一次有效)</span>
        <!--
          倒计时一律走 formatCountdown(定宽),不用 formatDuration:
          后者每秒都可能改宽度,这枚胶囊一涨一缩,同一行的其余内容会跟着跳。
        -->
        <span v-if="btInfo.prep.sitting" class="text-amber-ink tabular">
          调息中 ·
          <span class="countdown-slot">{{ formatCountdown(btInfo.prep.remainingSec) }}</span>
        </span>
        <span v-else-if="btInfo.prep.ready" class="text-jade"
          >加成 +{{ formatPercent(btInfo.prep.bonus, 0) }} 就绪</span
        >
      </div>
      <!--
        两个准备选项并排,但 chip-ink 是 nowrap 的胶囊,320px 窄屏放不下两枚
        (实测第二枚右缘到 331px,越界 11px)。故允许换行:宽屏并排、窄屏上下。
      -->
      <div v-if="!btInfo.prep.sitting && !btInfo.prep.ready" class="mt-1.5 flex flex-wrap gap-1.5">
        <button type="button" class="chip-ink !py-1.5 text-note" @click="startPrep('meditate')">
          {{ prepMeditate.label }} · {{ Math.round(prepMeditate.duration / 60) }}分钟 +{{
            formatPercent(prepMeditate.bonusRate, 0)
          }}
        </button>
        <button
          type="button"
          class="chip-ink !py-1.5 text-note"
          :disabled="!prepCanPill"
          @click="startPrep('pill')"
        >
          <!--
            付不起时换口「尚差 X 石」(与建筑卡同款,价与加成只在买得起时念全):
            更短才扛得住 200% 缩放档(390 放大一倍只剩 195 CSS px,chips 是 nowrap,
            实测「服用聚气丹 · +5% 尚差 30 石」会把右缘顶到 211px 越界 16px)。
          -->
          <template v-if="prepCanPill"
            >{{ prepPill.label }} · {{ prepPillCost }}石 +{{
              formatPercent(prepPill.bonusRate, 0)
            }}</template
          >
          <template v-else>聚气丹 · 尚差 {{ prepPillShort }} 石</template>
        </button>
      </div>
    </div>
    <button
      class="btn-seal mt-3 w-full !py-3"
      :class="{ 'animate-glow-pulse pulse-ready': btInfo.ready }"
      :disabled="!btInfo.ready"
      @click="attemptBreakthrough()"
    >
      {{ btInfo.ready ? (btInfo.needTribulation ? "引 劫 突 破" : "尝 试 突 破") : btInfo.reason }}
    </button>
    <!-- 灵气不足是四个字,拦下的却是「还差多少、回够要多久」 —— 补齐直显,别让玩家点开灵气数才看见等待值(与修为 ETA 同款口径) -->
    <QiShortfallNote v-if="btQiBlock" :short="btQiBlock.short" :eta="btQiBlock.eta" />
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { usePlayerStore } from "@/stores/player";
import { useResourcesStore } from "@/stores/resources";
import { useCultivationStore } from "@/stores/cultivation";
import { useUiStore } from "@/stores/ui";
import { attemptBreakthrough, breakthroughInfo, expectedTries } from "@/core/breakthrough";
import { todayWeather } from "@/core/weather";
import { prepareBreakthrough, pillPrepShortfall } from "@/core/earlyGameService";
import { toNum } from "@/utils/gnum";
import {
  currentTribulationPlan,
  verdictLabel,
  type TribulationPlan,
} from "@/core/tribulationDecision";
import { BREAKTHROUGH_PREP_OPTIONS } from "@/data/earlyGame";
import { buffDef } from "@/data/buffs";
import { modsText } from "@/data/statNames";
import { BT_FAIL_EXP_LOSS, INJURY_DURATION } from "@/data/constants";
import {
  cnNumber,
  formatCountdown,
  formatDuration,
  formatNum,
  formatPercent,
} from "@/utils/format";
import TribulationPanel from "@/components/cultivation/TribulationPanel.vue";
import QiShortfallNote from "@/components/cultivation/QiShortfallNote.vue";
import { useGameNow } from "@/composables/useGameNow";

const player = usePlayerStore();
const resources = useResourcesStore();
const cultivation = useCultivationStore();
const ui = useUiStore();

/**
 * 调息倒计时的秒级心跳 —— 本卡此前是全库最后一枚没接的秒表。
 *
 * `breakthroughInfo()` 的 prep 段由 `breakthroughPrepState()` 现算,而那条链只依赖
 * `totalPlaySec`(引擎按 ACTIVE_STAMP_MS=5s 盖章):「调息中 · 03分00秒」的秒针
 * 5 秒才跳 5 格,「加成 +8% 就绪」与突破成功率瓦片同样晚 5 秒才翻。
 * 接 `useGameNow`(1s 心跳、gameNow() 同源 —— 暂停冻结、恢复顺延与
 * shiftTimedState 对 readyAt 的顺延一致):显示与判定仍读同一个时刻函数,
 * 判定链(breakthroughPrepState / attemptBreakthrough)不读它,口径不变。
 */
const gameNowSec = useGameNow();
const btInfo = computed(() => {
  void gameNowSec.value;
  return breakthroughInfo();
});
/**
 * 突破按钮的「灵气不足」补齐:reason 只报四字,不报还差多少、回够要多久。
 * 站在按钮前的人不该再点开灵气数字才看见等待值 —— short 与 eta 现算,无 rebound。
 */
const btQiBlock = computed(() => {
  if (btInfo.value.ready || btInfo.value.reason !== "灵气不足") return null;
  const short = Math.max(0, Math.ceil(btInfo.value.qiCost - resources.qi));
  const sec =
    player.qiRegenPerSec > 0 ? Math.ceil(short / player.qiRegenPerSec) : Number.POSITIVE_INFINITY;
  return { short, eta: Number.isFinite(sec) ? `约 ${formatDuration(sec)}` : "当前无回复" };
});

// Phase 28 突破准备:按钮文案/耗时/药价全部来自 BREAKTHROUGH_PREP_OPTIONS,不再在视图里写第二份
const prepMeditate = BREAKTHROUGH_PREP_OPTIONS.find((o) => o.id === "meditate")!;
const prepPill = BREAKTHROUGH_PREP_OPTIONS.find((o) => o.id === "pill")!;
const prepPillCost = prepPill.cost?.stone ?? 0;
const prepCanPill = computed(() => toNum(resources.spiritStone) >= prepPillCost);
// 付不起时直显「尚差 X 石」(与建筑升级同款纪律,短差从药价现算,无第二份魔法数)
const prepPillShort = computed(() => pillPrepShortfall(resources.spiritStone));

function startPrep(option: "meditate" | "pill"): void {
  // 失败臂有意不给 toast:唯一真实失败路(灵石不足)已被按钮置灰 +「尚差 X 石」
  // 内联拦下(与建筑升级同款),meditate 又不花钱恒成功 —— 此前的「灵石不足,
  // 无以备药」在按钮加 disabled 后成了到不了的死路,留着会在未来新失败模式上
  // 报错文案。prepareBreakthrough 返回 false 时安静放行即可。
  if (prepareBreakthrough(option)) {
    ui.toast(option === "meditate" ? "你盘膝入定,静待调息完成" : "丹药入腹,气机已然蓄足", "info");
  }
}

/**
 * 重伤那一行读 buff 本体:desc 现在只写风味(见 data/buffs.ts 文件头),
 * 减多少、减哪几项只有 mods 一处能说。
 */
const injuryDef = buffDef("injury")!;

// PLAN_COLOR/verdictLabel 只服务瓦片;风险/准备/折算/天时/界膜/道数各群随本体迁入 TribulationPanel
const PLAN_COLOR: Record<TribulationPlan["verdict"], string> = {
  danger: "text-cinnabar",
  hard: "text-amber-ink",
  ok: "text-qing",
  easy: "text-jade",
};
/**
 * 劫势瓦片 —— 刻意**不**读 btInfo:那枚 computed 现在跟着 1s 心跳走,
 * 而 currentTribulationPlan 要整段推演每一波雷(traceTribulation 逐波算伤害)。
 * 「是不是大关」由 player.isMajorStep 直接给,与 btInfo.needTribulation 同源
 * (见 breakthrough.ts 的 needTribulation = isMajorStep),值守恒不靠副产物。
 */
const tribPlan = computed(() => (player.isMajorStep ? currentTribulationPlan(player) : null));

/**
 * 破境增益 · 此刻在身 —— 小进阶的成功率读 breakthroughRate,读数只是结果;
 * 谁在顶、顶多少,突破前一眼见(遍历 activeBuffs 的面,文案走 modsText,与开炉幕同款)。
 * 大关天劫不吃此事,整条只在非天劫幕亮(模板 v-if 于此)。
 */
const breakthroughBuffRows = computed(() => {
  const rows: { buffId: string; name: string; rate: number; effect: string }[] =
    cultivation.activeBuffs
      .map(({ def }) => {
        const face = Object.fromEntries(
          Object.entries(def.mods ?? {}).filter(([k]) => k === "breakthroughRate" || k === "luck"),
        );
        // luck 也按实判口径折进成功率(+luck*0.05,见 breakthrough.ts 的 rate)
        const rate =
          ((face as import("@/types").StatMods).breakthroughRate ?? 0) +
          ((face as import("@/types").StatMods).luck ?? 0) * 0.05;
        return rate !== 0
          ? {
              buffId: def.id,
              name: def.name,
              rate,
              effect: modsText(face as import("@/types").StatMods),
            }
          : null;
      })
      .filter(
        (x): x is { buffId: string; name: string; rate: number; effect: string } => x !== null,
      );
  // 天时也真吃小进阶成功率(breakthrough.ts 的 rate 并入 weatherMods),露进破境幕 —— 与渡劫幕同标准
  const wFace: import("@/types").StatMods = Object.fromEntries(
    Object.entries((todayWeather().mods ?? {}) as import("@/types").StatMods).filter(
      ([k]) => k === "breakthroughRate" || k === "luck",
    ),
  );
  const wRate = (wFace.breakthroughRate ?? 0) + (wFace.luck ?? 0) * 0.05;
  if (wRate !== 0) {
    rows.push({
      buffId: "weather",
      name: `天时·${todayWeather().name}`,
      rate: wRate,
      effect: modsText(wFace),
    });
  }
  return rows;
});

/** 成功率旁边的「平均约 N 次」—— 必成时不说「平均」 */
const triesText = computed(() => {
  const n = expectedTries(btInfo.value.rate);
  return n === null ? "" : `平均约 ${n} 次`;
});
</script>
