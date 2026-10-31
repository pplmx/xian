<template>
  <section v-if="battleSummary && battle" class="combat-intel" data-battle-intel>
    <header class="combat-intel__head">
      <div class="combat-intel__verdict">
        <span
          class="combat-intel__seal"
          :class="battle.result.win ? 'is-win' : 'is-loss'"
          aria-hidden="true"
          >{{ battle.result.win ? "胜" : "负" }}</span
        >
        <div class="combat-intel__summary">
          <p class="combat-intel__eyebrow">最近一战</p>
          <p class="combat-intel__line tabular">{{ battleSummary }}</p>
          <p v-if="battleLoot.length" class="combat-intel__loot">
            <span>本战所得</span>
            {{ battleLoot.join(" · ") }}
          </p>
        </div>
      </div>
      <div class="combat-intel__toggles">
        <button
          v-if="lore"
          type="button"
          class="combat-intel__toggle combat-intel__toggle--lore tap-row"
          :aria-expanded="showLore"
          @click="showLore = !showLore"
        >
          {{ showLore ? "收起所知" : "此物所知 »" }}
        </button>
        <button
          v-if="analysis"
          type="button"
          class="combat-intel__toggle combat-intel__toggle--analysis tap-row"
          :aria-expanded="showAnalysis"
          @click="showAnalysis = !showAnalysis"
        >
          {{ showAnalysis ? "收起分析" : "战斗分析 »" }}
        </button>
      </div>
    </header>

    <section v-if="showLore && lore" class="combat-intel__paper" data-battle-lore>
      <header class="combat-intel__paper-head">
        <span class="font-kai text-body">{{ battle.enemyName }}</span>
        <span class="chip-ink border-violet-ink/50 text-note text-violet-ink">{{
          lore.stageName
        }}</span>
        <span v-if="lore.boosted" class="text-note text-gold-ink">宿慧照见</span>
      </header>
      <p v-if="lore.elementName || lore.frame.length" class="text-body text-ink-soft">
        <span v-if="lore.elementName" class="mr-1.5 text-qing">{{ lore.elementName }}属</span>
        {{ lore.frame.join(" · ") }}
      </p>
      <p v-for="s in lore.skills" :key="s.name" class="text-body text-ink-soft">
        <span class="combat-intel__bullet" aria-hidden="true">·</span>
        <span class="text-ink">{{ s.name }}</span>
        ——{{ s.note }}
      </p>
      <p v-for="ph in lore.phases" :key="ph.at" class="text-body text-cinnabar">
        <span class="combat-intel__bullet" aria-hidden="true">·</span>
        {{ ph.at }}时{{ ph.label }}
      </p>
      <p v-if="lore.archetype" class="text-body text-gold-ink">
        <span v-if="lore.archetypeLabel" class="combat-intel__label text-note">
          {{ lore.archetypeLabel }}
        </span>
        {{ lore.archetype }}
      </p>
      <p v-if="lore.hint" class="text-note text-ink-faint">{{ lore.hint }}</p>
    </section>

    <section v-if="showAnalysis && analysis" class="combat-intel__paper" data-battle-analysis>
      <p class="text-body" :class="battle.result.win ? 'text-jade' : 'text-cinnabar'">
        {{ analysis.headline }}
      </p>
      <template v-if="analysis.findings.length">
        <p v-for="(f, i) in analysis.findings" :key="i" class="text-body text-ink-soft">
          <span class="combat-intel__bullet" aria-hidden="true">·</span>
          {{ f.text }}
        </p>
      </template>
      <div v-if="analysis.directions.length" class="combat-intel__directions">
        <p class="text-note text-ink-faint">可借力的方向(非唯一解):</p>
        <div class="combat-intel__direction-list">
          <span v-for="d in analysis.directions" :key="d.styleName">
            <button
              type="button"
              class="combat-intel__direction tap-row text-body"
              :aria-expanded="directionTap === d.styleName"
              @click="directionTap = directionTap === d.styleName ? null : d.styleName"
            >
              {{ d.styleName }}
            </button>
            <span v-if="directionTap === d.styleName" class="text-note text-violet-ink">
              —— {{ d.reason }}
            </span>
          </span>
        </div>
      </div>
      <div v-if="analysis.dataRows.length" class="combat-intel__data">
        <p
          v-for="row in analysis.dataRows"
          :key="row.label"
          class="combat-intel__data-row text-note tabular"
        >
          <span>{{ row.label }}</span>
          <strong>{{ row.value }}</strong>
        </p>
      </div>
    </section>
  </section>
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
