<template>
  <div class="celestial-report-ledger" data-celestial-report-ledger>
    <!-- 壹 · 战果:一战胜负与整程结果先落总账。 -->
    <section
      class="celestial-report-chapter"
      data-celestial-report-chapter="result"
      data-celestial-report-result
    >
      <FolioChapterHead
        data-celestial-chapter-head
        index="壹"
        title="战果"
        hint="先报此程终局,再逐场回看"
        :fact="`${report.rows.length} 战 · ${totalRounds} 回合`"
      />
      <div class="celestial-report-result">
        <div class="celestial-report-result__identity">
          <span
            class="celestial-report-result__seal"
            :class="{ 'is-cleared': report.cleared }"
            aria-hidden="true"
            >{{ report.cleared ? "成" : "止" }}</span
          >
          <div class="celestial-report-result__copy">
            <p class="celestial-report-result__source">{{ report.title }}</p>
            <p
              class="celestial-report-result__mark"
              :class="report.cleared ? 'text-ink' : 'text-cinnabar'"
            >
              {{ report.markText }}
            </p>
            <p class="celestial-report-result__meta tabular">
              {{ wins }} 胜 · {{ losses }} 负 · 共 {{ totalRounds }} 回合
            </p>
          </div>
        </div>
        <p v-if="report.reward > 0" class="celestial-report-result__reward tabular">
          <GameIcon name="sparkles" :size="12" class="inline" />
          道源 +{{ report.reward }}
        </p>
      </div>
    </section>

    <!-- 贰 · 战局:当前场唯一一份对阵与逐回合战报。 -->
    <section
      class="celestial-report-chapter"
      data-celestial-report-chapter="field"
      data-celestial-report-field
    >
      <FolioChapterHead
        data-celestial-chapter-head
        index="贰"
        title="战局"
        hint="选一场,重看当场对阵与回放"
        :fact="currentFightFact"
      />
      <GauntletPanel
        :rows="report.rows"
        :player-name="playerName"
        :current="currentFight"
        @select="selectFight"
      />
    </section>

    <!-- 叁 · 逐场:整程胜负、回合与余血沿同一组账行续读。 -->
    <section
      class="celestial-report-chapter"
      data-celestial-report-chapter="fights"
      data-celestial-report-fights
    >
      <FolioChapterHead
        data-celestial-chapter-head
        index="叁"
        title="逐场"
        hint="胜负之外,余血与回合也一并入账"
        :fact="`${wins} 胜 / ${losses} 负`"
      />
      <div class="celestial-report-fights">
        <div
          v-for="(row, index) in report.rows"
          :key="index"
          class="celestial-report-fight"
          :class="{ 'is-current': currentFight === index }"
          data-celestial-report-fight
          :data-current="currentFight === index ? '' : undefined"
          :aria-current="currentFight === index ? 'step' : undefined"
        >
          <span class="celestial-report-fight__ordinal tabular">{{ index + 1 }}</span>
          <span class="celestial-report-fight__foe">{{ row.foeName }}</span>
          <span
            class="celestial-report-fight__verdict"
            :class="row.win ? 'text-ink' : 'text-cinnabar'"
            >{{ row.win ? "胜" : "负" }}</span
          >
          <span class="celestial-report-fight__meta tabular"
            >{{ row.rounds }} 回合 · 余血 {{ formatPercent(row.hpLeftPct, 0) }}</span
          >
        </div>
      </div>
    </section>

    <!-- 肆 · 此战之判:为什么难、下一次怎么办,和战前预估同源。 -->
    <section
      class="celestial-report-chapter"
      data-celestial-report-chapter="judgement"
      data-celestial-report-judgement
    >
      <FolioChapterHead
        data-celestial-chapter-head
        index="肆"
        title="此战之判"
        hint="战报不是判决书,是下一次出发的依据"
        :fact="judgementFact"
      />
      <div class="celestial-report-judgement">
        <p
          v-for="(line, index) in report.judgementLines ?? []"
          :key="index"
          class="celestial-report-judgement__line"
        >
          <span aria-hidden="true">◇</span>
          <span>{{ line }}</span>
        </p>
        <p
          v-if="!report.judgementLines?.length"
          class="celestial-report-judgement__empty"
          data-celestial-report-judgement-empty
        >
          敌我之势皆已在账上,此战没有额外的判定来源。
        </p>
        <!--
          战后归因:上面那几行是**战前就定下的数**(道之理解 / 境界压制),
          回答「这一界为什么难」。这一段回答的是另一个问题 ——「这一场为什么输、
          下一次改什么」,读数来自逐场遥测,与历练页同一个 `analyzeBattle`。
          两者并列,因为「难」与「输」不是同一件事:难而赢,与易而输,都发生过。
        -->
        <template v-if="fightAnalysis">
          <p
            v-for="(finding, index) in fightAnalysis.findings"
            :key="`f${index}`"
            class="celestial-report-judgement__line is-finding"
            data-celestial-report-finding
          >
            <span aria-hidden="true">◆</span>
            <span>{{ finding.text }}</span>
          </p>
          <!--
            方向单独起一行小标题 —— 与历练页同一句(「可借力的方向(非唯一解)」)。
            归因是「你为什么输」,方向是「下一步试什么」;两者挤成连续几行、
            只靠 ◆ / → 区分,读起来仍是一串并列的结论,而它们其实层级不同。
          -->
          <p
            v-if="fightAnalysis.directions.length"
            class="celestial-report-judgement__label text-note"
            data-celestial-report-direction-label
          >
            可借力的方向(非唯一解):
          </p>
          <p
            v-for="(dir, index) in fightAnalysis.directions"
            :key="`d${index}`"
            class="celestial-report-judgement__line is-direction"
            data-celestial-report-direction
          >
            <span aria-hidden="true">→</span>
            <span>{{ dir.styleName }}:{{ dir.reason }}</span>
          </p>
        </template>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { formatPercent } from "@/utils/format";
import FolioChapterHead from "@/components/common/FolioChapterHead.vue";
import GauntletPanel from "@/components/celestial/GauntletPanel.vue";
import GameIcon from "@/components/common/GameIcon.vue";
import type { ReportView } from "@/components/celestial/reportView";
import { analyzeBattle } from "@/core/battleAnalysis";
import { detectBuild } from "@/core/buildDetect";
import { usePlayerStore } from "@/stores/player";

const props = defineProps<{
  report: ReportView;
  playerName: string;
}>();

const currentFight = ref(0);
const wins = computed(() => props.report.rows.filter((row) => row.win).length);
const losses = computed(() => props.report.rows.length - wins.value);
const totalRounds = computed(() => props.report.rows.reduce((sum, row) => sum + row.rounds, 0));
const currentFightFact = computed(() =>
  props.report.rows.length
    ? `第 ${Math.min(currentFight.value + 1, props.report.rows.length)} / ${props.report.rows.length} 战`
    : "无场可看",
);
const judgementFact = computed(() =>
  props.report.judgementLines?.length
    ? `${props.report.judgementLines.length} 则判定`
    : "无额外判定",
);

/**
 * 当前这一场的战后归因 —— 与历练页同一个 `analyzeBattle`。
 *
 * 「此战之判」此前只有 `judgementLines`,那是**战前**就定下的数
 * (道之理解 / 境界压制),回答「这一界为什么难」;而「这一场为什么输、
 * 下一次改什么」一个字都没有。天界是最难的一档,却比历练页少一段归因。
 *
 * `analyzeBattle` 要 `CombatResult.stats`(遥测)。战报行现在带着它了 ——
 * 没有遥测的旧记录会返回 null,整段不出(与历练页对旧档的判定同源)。
 */
const fightAnalysis = computed(() => {
  const row = props.report.rows[currentFight.value];
  if (!row?.stats) return null;
  const styleId = detectBuild(usePlayerStore().celestialStats.mods)?.style.id ?? null;
  return analyzeBattle(
    {
      win: row.win,
      rounds: row.rounds,
      playerHpPct: row.hpLeftPct,
      log: [],
      foeOrigin: row.foe?.origin,
      stats: row.stats,
    },
    styleId,
  );
});

function selectFight(index: number): void {
  currentFight.value = Math.max(0, Math.min(index, props.report.rows.length - 1));
}

watch(
  () => props.report,
  () => {
    currentFight.value = 0;
  },
);
</script>
