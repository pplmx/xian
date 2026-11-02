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
    ? `${props.report.judgementLines.length} 则归因`
    : "无额外判定",
);

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
