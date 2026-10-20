<template>
  <!--
    战斗情报面板 —— 战后统计行 / 本战所得 / 此物所知 / 战斗分析。
    自 CombatPanel 拆分第六刀:所知(lore)与分析(analysis)只此一处消费,收进自家
    组件自取 store(与 cultivation/RetreatCard 同族先例);宿主保留回放引擎
    (逐行投入/血条/浮伤/因果环动画)、敌我半卡与适配星级(星级行仍挂敌名旁)。
  -->
  <!-- 战斗后统计 + 分析入口 -->
  <p
    v-if="battleSummary"
    class="mt-2 flex items-center justify-center gap-2 text-center text-[10px] text-ink-faint tabular"
  >
    {{ battleSummary }}
    <!--
      行内文字的按钮也得有 28px 触达区(见 layout-check 的判据):
      它们此前只有一个字高(实测 15px),拇指点不着 —— 用 min-h 撑起来,
      再用负外边距把这多出来的高度抵掉,视觉密度不变。
    -->
    <button
      v-if="lore"
      class="-my-2 inline-flex min-h-[28px] items-center px-1 text-violet-ink active:opacity-60"
      :aria-expanded="showLore"
      @click="showLore = !showLore"
    >
      {{ showLore ? "收起所知" : "此物所知 »" }}
    </button>
    <button
      v-if="analysis"
      class="-my-2 inline-flex min-h-[28px] items-center px-1 text-qing active:opacity-60"
      :aria-expanded="showAnalysis"
      @click="showAnalysis = !showAnalysis"
    >
      {{ showAnalysis ? "收起分析" : "战斗分析 »" }}
    </button>
  </p>
  <!-- 本战拾获明细:战报里原本只进件数,「得了什么」全靠猜 -->
  <p v-if="battleLoot.length" class="mt-1 text-center text-[10px] leading-relaxed text-ink-faint">
    <span class="text-gold-ink">本战所得</span>
    {{ battleLoot.join(" · ") }}
  </p>
  <!-- 此物所知(Phase 32.5:交手越多,战前看得越清楚) -->
  <div v-if="showLore && lore" class="mt-2 rounded-md bg-ink/4 px-3 py-2.5">
    <p class="flex items-center gap-2">
      <span class="font-kai text-[12px] tracking-wider text-ink">{{ battle?.enemyName }}</span>
      <span class="chip-ink border-violet-ink/50 text-[9px] text-violet-ink">{{
        lore.stageName
      }}</span>
      <span v-if="lore.boosted" class="text-[10px] text-gold-ink">宿慧照见</span>
    </p>
    <p v-if="lore.elementName || lore.frame.length" class="mt-1 text-[11px] text-ink-soft">
      <span v-if="lore.elementName" class="mr-1.5 text-qing">{{ lore.elementName }}属</span>
      {{ lore.frame.join(" · ") }}
    </p>
    <p v-for="s in lore.skills" :key="s.name" class="mt-1 t-body text-ink-soft">
      ·
      <span class="text-ink">{{ s.name }}</span>
      ——{{ s.note }}
    </p>
    <p
      v-for="ph in lore.phases"
      :key="ph.at"
      class="mt-1 text-[11px] leading-relaxed text-cinnabar"
    >
      · {{ ph.at }}时{{ ph.label }}
    </p>
    <p v-if="lore.archetype" class="mt-1.5 text-[11px] leading-relaxed text-gold-ink">
      <span v-if="lore.archetypeLabel" class="mr-1 rounded bg-gold-ink/6 px-1 py-0.5 text-[10px]">
        {{ lore.archetypeLabel }}
      </span>
      {{ lore.archetype }}
    </p>
    <p v-if="lore.hint" class="mt-1.5 text-[10px] text-ink-faint">{{ lore.hint }}</p>
  </div>
  <!-- 战斗分析(战败自动展开;硬核数据供研究) -->
  <div v-if="showAnalysis && analysis" class="mt-2 rounded-md bg-ink/4 px-3 py-2.5">
    <p
      class="font-kai text-[12px] tracking-wider"
      :class="battle?.result.win ? 'text-jade' : 'text-cinnabar'"
    >
      {{ analysis.headline }}
    </p>
    <template v-if="analysis.findings.length">
      <p v-for="(f, i) in analysis.findings" :key="i" class="mt-1 t-body text-ink-soft">
        · {{ f.text }}
      </p>
    </template>
    <!--
      可借力的方向:适配星级理由同款 —— 手机没有 hover,「为什么看好这个方向」
      此前只挂在 :title 上,点了没反应 = 对触屏玩家死提示。方向名改可点、理由点开
      直出(与「此物所知/战斗分析」同款行内按钮 idiom)。
    -->
    <p v-if="analysis.directions.length" class="mt-1.5 text-[10px] text-ink-faint">
      可借力的方向(非唯一解):
      <span v-for="d in analysis.directions" :key="d.styleName" class="ml-1">
        <button
          type="button"
          class="-my-2 inline-flex min-h-[28px] items-center px-1 text-violet-ink underline underline-offset-2 active:opacity-60"
          :aria-expanded="directionTap === d.styleName"
          @click="directionTap = directionTap === d.styleName ? null : d.styleName"
        >
          {{ d.styleName }}
        </button>
        <span v-if="directionTap === d.styleName" class="text-violet-ink"> —— {{ d.reason }}</span>
      </span>
    </p>
    <div
      v-if="analysis.dataRows.length"
      class="mt-2 grid grid-cols-2 gap-x-4 gap-y-0.5 border-t border-ink/10 pt-1.5"
    >
      <p
        v-for="row in analysis.dataRows"
        :key="row.label"
        class="flex justify-between text-[10px] tabular"
      >
        <span class="text-ink-faint">{{ row.label }}</span>
        <span class="text-ink-soft">{{ row.value }}</span>
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useAdventureStore } from "@/stores/adventure";
import { usePlayerStore } from "@/stores/player";
import { detectBuild } from "@/core/buildDetect";
import { analyzeBattle } from "@/core/battleAnalysis";
import { playSfx } from "@/core/audio";
import { enemyLoreView } from "@/ui/enemyLore";
import { formatPercent } from "@/utils/format";

const adventure = useAdventureStore();
const player = usePlayerStore();

const battle = computed(() => adventure.lastBattle);

/** 本战拾获明细(旧存档/旧战报没有这一栏 → 空数组) */
const battleLoot = computed(() => battle.value?.loot ?? []);

/** 此物所知(Phase 32.5)—— 战前情报由认知层决定,不是白送的 */
const lore = computed(() => {
  const id = battle.value?.enemyId;
  return id ? enemyLoreView(id) : null;
});

/** 战斗后统计行 */
const battleSummary = computed(() => {
  const b = battle.value;
  if (!b) return null;
  const r = b.result;
  // 结语只多四个字,却是每个玩家每场都会读到的一行:抢先 / 被抢先
  const first = r.firstMove ? (r.firstMove.playerFirst ? " · 抢先" : " · 被抢先") : "";
  return `此战 ${r.rounds} 回合 · 战后气血 ${formatPercent(r.playerHpPct, 0)} · ${r.win ? "胜" : "负"}${first}`;
});

// ---- 战斗分析(第三层信息) ----
const showAnalysis = ref(false);
const showLore = ref(false);
/** 方向上点开的是哪一系(理由内联展开);换敌时复位,免得挂着上一战的旧名 */
const directionTap = ref<string | null>(null);

const analysis = computed(() => {
  const b = battle.value;
  if (!b) return null;
  const build = detectBuild(player.finalStats.mods);
  return analyzeBattle(b.result, build?.style.id ?? null);
});

// 战败时自动展开分析;并按胜负配一声战果音
watch(
  () => battle.value?.at,
  () => {
    if (!battle.value) return;
    playSfx(battle.value.result.win ? "win" : "lose");
    if (!battle.value.result.win) showAnalysis.value = true;
  },
);
</script>
