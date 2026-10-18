<template>
  <!--
    Phase 32.0 劫势详情(决意前评估:风险维度 + 建议,信息给足,决定留给玩家)
    劫势的次序 = 决策的次序:先说这一劫是什么(desc),再说它会怎么伤到你
    (主要风险)、建议你怎么站(advice)、有没有一线(灵根相应);
    然后才是要核的四项读数,最后是脚注(天时/折算/界膜/道数)。
    一字未删,只是把「与你有关的三句」提到读数之前。
  -->
  <div class="mt-2 rounded-md border border-violet-ink/25 bg-violet-ink/5 px-3 py-2">
    <p class="text-[11px] text-violet-ink">{{ plan.desc }}</p>
    <p class="mt-1 text-[11px] text-ink-soft">
      主要风险:<span class="text-cinnabar">{{ plan.risks.join("; ") }}</span>
    </p>
    <p class="mt-1 text-[11px] text-ink-soft">{{ plan.advice }}</p>
    <!-- Phase 32.2:灵根解开的那条路——说明这道劫为何对你不太一样(留一线,不是免死) -->
    <p v-if="reliefRoots.length" class="mt-1 text-[11px] text-jade">
      灵根相应:{{
        reliefRoots.map((e) => ELEMENTS[e].name).join("、")
      }}——此劫为你留了一线,能走到哪一步仍看自身准备
    </p>
    <div class="ink-divider my-2" aria-hidden="true" />
    <!--
      天劫是**按最大生命百分比**扣血的(见 core/formulas.tribulationWaveDamage),
      攻伐不进公式;防御与气血只能按「本境裸修为」折算成抗性与开劫水位,且两条都有上限。
      摊开读数是因为玩家最容易在这里误判:一身厚血厚防站在劫前,却不知道自己缺什么。
    -->
    <!-- 渡劫账:一排挤成串的读数改造成可扫读的 2×2 小网格 —— 四项各占一格,三维折算作小字跟在本格 -->
    <p class="text-[10px] text-ink-faint">此劫只认百分比 —— 此刻会读的几项:</p>
    <p class="mt-1.5 text-[10px] text-ink-faint tabular">
      准备:
      <span class="text-ink-soft">{{ PREP_NAMES.guard }} {{ PREP_STARS[plan.prep.guard] }}</span>
      · {{ PREP_NAMES.sustain }} {{ PREP_STARS[plan.prep.sustain] }} · {{ PREP_NAMES.resist }}
      {{ PREP_STARS[plan.prep.resist] }}
      <template v-if="plan.def.id === 'soulrend'">
        · {{ PREP_NAMES.burst }} {{ PREP_STARS[plan.prep.burst] }}
      </template>
    </p>
    <!--
      格子分两行:上行「标签 + 值」,下行「折算成几成」。320 宽下两列各只 ~104px,
      「天劫抗性 42%(防御折算 3%)」挤一行必然顶折 —— 拆成两行才扫得动。
    -->
    <div class="mt-1 grid grid-cols-2 gap-x-3 gap-y-1.5 text-[10px] tabular">
      <p>
        <span class="flex items-baseline gap-1">
          <span class="text-ink-faint">天劫抗性</span>
          <span class="text-ink-soft">{{ formatPercent(tribLedger?.resist ?? 0, 0) }}</span>
        </span>
        <span class="block text-[10px] text-ink-faint"
          >(防御折算 {{ formatPercent(tribLedger?.statResist ?? 0, 0) }})</span
        >
      </p>
      <p>
        <span class="flex items-baseline gap-1">
          <span class="text-ink-faint">减伤</span>
          <span class="text-ink-soft">{{ formatPercent(tribLedger?.reduction ?? 0, 0) }}</span>
        </span>
      </p>
      <p>
        <span class="flex items-baseline gap-1">
          <span class="text-ink-faint">每波恢复</span>
          <span class="text-ink-soft">{{ formatPercent(tribLedger?.sustain ?? 0, 1) }}</span>
        </span>
      </p>
      <p>
        <span class="flex items-baseline gap-1">
          <span class="text-ink-faint">开劫护持</span>
          <span class="text-ink-soft">{{ formatPercent(tribLedger?.guard ?? 0, 0) }}</span>
        </span>
        <span class="block text-[10px] text-ink-faint"
          >(气血折算 {{ formatPercent(tribLedger?.statGuard ?? 0, 0) }})</span
        >
      </p>
    </div>
    <div class="ink-divider my-2" aria-hidden="true" />
    <!--
      天时是这场劫的第三个输入:劫型看境界×今日天时、结算 damage 再乘
      tribulationMult —— verdict/建议早已吃进这一笔,但没摆成一行。
      这里与主页天时卡同一口径(读 todayWeather,不另算),渡劫前一眼对上。
    -->
    <p class="text-[10px] text-ink-faint tabular">
      今日天时 · {{ tribWeather.name
      }}<template v-if="tribWeatherMult"> · 渡劫 ×{{ tribWeatherMult }}</template
      ><template v-if="tribWeatherResistPenalty">
        · {{ STAT_NAMES["tribulationResist"] }} {{ tribWeatherResistPenalty }}</template
      >
    </p>
    <p class="mt-0.5 text-[10px] text-ink-faint">
      攻伐不进天劫公式;防御与气血按本境裸修为折算成上面的抗性与护持,各有上限 ——
      血再厚也只能硬抗一部分,剩下的仍要抗性/减伤/恢复来补。进阶成功率与突破准备也只作用于小进阶,大关不看它们。
    </p>
    <!--
      界膜之劫:这一版对跨界那一关的规则加难(见 data/constants 的
      TRIB_WORLD_STEP_STAT_FOLD)。必须**在决意之前**说清楚 ——
      上一版玩家吃过"护持明明写着有,过劫时却像没有"的亏,
      那种误会不该靠失败去发现。
    -->
    <div
      v-if="worldStep"
      class="mt-2 rounded-md border border-cinnabar/30 bg-cinnabar/5 px-2.5 py-2"
    >
      <p class="text-[10px] leading-relaxed text-cinnabar">
        界膜之劫:跨界这一关血肉之厚一概不算 ——
        防御与气血折算出的抗性、开劫护持在此作废,只认词条与准备。
      </p>
    </div>
    <!-- 天威本身的长相:道数随境界涨、单波逐道加重,摊出来才知道护持该留到哪一段 -->
    <p v-if="tribWave" class="mt-0.5 text-[10px] text-ink-faint tabular">
      共 {{ tribWave.waves }} 道,单波 {{ formatPercent(tribWave.min, 0) }}–{{
        formatPercent(tribWave.max, 0)
      }}
      最大气血(合计约 {{ formatPercent(tribWave.total, 0) }}),
      {{ plan.def.waveShape === "frontLoaded" ? "起手两道最重" : "逐道加重" }}
    </p>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { usePlayerStore } from "@/stores/player";
import { todayWeather } from "@/core/weather";
import { modOf } from "@/core/statsCalc";
import {
  currentStatGuard,
  currentTribulationRelief,
  guardScore,
  settlementResist,
  statFoldAt,
  sustainScore,
  tribulationWaveSpan,
  type TribulationPlan,
} from "@/core/tribulationDecision";
import { reliefElements, rootElements } from "@/core/linggenAffinity";
import { ELEMENTS } from "@/data/linggen";
import { STAT_NAMES } from "@/data/statNames";
import { formatPercent } from "@/utils/format";

const player = usePlayerStore();

const props = defineProps<{
  /** 当前大关的劫势推演(宿主算好传入:破境卡的「此劫」瓦片与这里读同一份) */
  plan: TribulationPlan;
}>();

const PREP_NAMES = { guard: "护持", sustain: "恢复", resist: "抗性", burst: "爆发" } as const;
const PREP_STARS = ["·", "✧", "✧✧", "✧✧✧"] as const;

/** 这天时是这场劫算进去的那一个(与结算/主页同源);倍率 >1 才挂字 */
const tribWeather = computed(() => todayWeather());
const tribWeatherMult = computed(() =>
  tribWeather.value.tribulationMult > 1 ? tribWeather.value.tribulationMult : null,
);
/** 同一天时并行的抗性折损(雷鸣 -5% / 仙劫日 -8% / 神威日 -10%)—— 真吃进伤害,必须摊出来 */
const tribWeatherResistPenalty = computed(() => {
  const r = tribWeather.value.mods?.tribulationResist ?? 0;
  return r < 0 ? formatPercent(r, 0) : null;
});

/**
 * 这一劫是不是「界膜」那一关(人间→仙界 / 仙界→神界 / 神界→混沌海)。
 *
 * 判据取自 tribulationDecision.statFoldAt(三维折算的折扣):
 * 界面与结算读的必须是同一个数,否则又会出现"显示有护持、结算没有"。
 */
const tribTargetMajor = computed(() => (player.isMajorStep ? player.major + 1 : player.major));
const worldStep = computed(() => statFoldAt(tribTargetMajor.value) < 1);

/**
 * 渡劫账上的四项实际读数 —— 只摊天劫真的会读的那些,恢复/护持/抗性直接调
 * 结算的同一批函数(sustainScore / guardScore / settlementResist),界面不抄
 * 第二份系数。曾抄过:0.3/0.8 字面量与 easeDiscount 折叠全对不上(逆流劫
 * 界面报 30% 实际只有 19.5%),注释还写着「同源」—— 审计抓出来后根治。
 * 玩家按这个数决定补词条、换灵根,看到的就是结算的。
 */
const tribLedger = computed(() => {
  const mods = player.finalStats.mods;
  const stat = currentStatGuard(player);
  const def = props.plan.def;
  const relief = currentTribulationRelief(player, props.plan.kind);
  return {
    resist: settlementResist(mods, relief, stat),
    statResist: stat.resist,
    // 减伤同受结算的 0.6 上限:显示"此劫真的会读的"值,不拿全局裸减伤充数
    reduction: Math.min(0.6, modOf(mods, "damageReduction")),
    sustain: sustainScore(mods, def, relief),
    guard: guardScore(mods, def, relief) + stat.guard,
    statGuard: stat.guard,
  };
});

/** 天威本身的长相(道数 + 单波区间):与结算同一批函数,不在界面里另算一遍 */
const tribWave = computed(() =>
  tribulationWaveSpan(
    props.plan.def,
    player.isMajorStep ? player.major + 1 : player.major,
    tribWeather.value.tribulationMult,
  ),
);

/** Phase 32.2 与此劫气机相应的灵根:判据取自 tribulationRelief,界面说的与结算做的同源 */
const reliefRoots = computed(() =>
  reliefElements(rootElements(player.linggen?.roots), props.plan.kind),
);
</script>
