<template>
  <div class="folio-page folio-page--stack stagger-in">
    <FolioPageHeader
      title="修仙录"
      subtitle="这一部,只写你自己"
      back-to="character"
      back-label="人物"
    />

    <!-- 修行画像 -->
    <div v-if="profile" class="card-ink px-4 py-3">
      <p class="mb-1.5 font-kai text-[11px] tracking-[0.3em] text-ink-faint">修行画像</p>
      <p class="font-kai text-[14px] leading-relaxed text-ink">「{{ profile.verdict }}」</p>
      <div class="mt-2 space-y-1">
        <p v-for="d in profile.daoShares" :key="d.name" class="flex items-center gap-2 text-[11px]">
          <span class="w-14 shrink-0 text-ink-faint">{{ d.name }}</span>
          <ProgressBar
            :value="d.pct / 100"
            class="grow"
            :height="5"
            color="var(--color-cinnabar)"
          />
          <span class="w-8 shrink-0 text-right tabular text-ink-soft">{{
            formatPercent(d.pct / 100)
          }}</span>
        </p>
      </div>
      <div class="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-[11px] tinylens:grid-cols-1">
        <p class="flex justify-between">
          <span class="text-ink-faint">风险偏好</span>
          <span class="text-ink-soft">{{ profile.riskText }}</span>
        </p>
        <p class="flex justify-between">
          <span class="text-ink-faint">构筑倾向</span>
          <span class="text-ink-soft">{{ profile.buildTendency }}</span>
        </p>
        <p class="flex justify-between">
          <span class="text-ink-faint">常用流派</span>
          <span class="text-ink-soft">{{ profile.favoriteBuild }}</span>
        </p>
        <p v-if="profile.favoritePacts.length" class="flex justify-between">
          <span class="text-ink-faint">常立之契</span>
          <span class="text-ink-soft">{{ profile.favoritePacts.join(" / ") }}</span>
        </p>
        <p v-if="profile.bestWorld" class="flex justify-between">
          <span class="text-ink-faint">最擅长</span>
          <span class="text-jade">{{ profile.bestWorld }}</span>
        </p>
        <p v-if="profile.weakWorld" class="flex justify-between">
          <span class="text-ink-faint">最薄弱</span>
          <span class="text-cinnabar">{{ profile.weakWorld }}</span>
        </p>
      </div>
      <p class="mt-1.5 text-[10px] text-ink-faint">画像皆出自真实道痕,不可人工修饰。</p>
    </div>
    <p v-else class="empty-note card-ink px-4 py-6 text-center text-[11px] text-ink-faint">
      道痕未满{{ cnNumber(PROFILE_MIN_MARKS) }}则,画像尚不成形。
    </p>

    <!-- 页签:长卷分册 —— 与界域志 / 图鉴 / 名号 / 天界同构,免得七段一路滑到底 -->
    <InkTabs v-model="tab" :tabs="TABS" />

    <template v-if="tab === 'samsara'">
      <!-- 轮回录(Phase 32.5):第 N 世与第 1 世的实质区别 -->
      <SectionTitle title="轮回录" :hint="`宿慧 ${insight}`" />
      <div class="card-ink px-4 py-3">
        <!-- 极窄档(≤220 CSS px):阶段名 + 第 N 世 + 再积 N 宿慧一行塞不下,
             阶段名被压到 15px 一字一行 —— 允许换行。320 / 390 两档不动。 -->
        <p class="flex flex-wrap items-center gap-2">
          <span class="t-card whitespace-nowrap">{{ stage.name }}</span>
          <span class="text-[10px] text-ink-faint tabular"
            >第 {{ player.reincarnation.count + 1 }} 世</span
          >
          <span
            v-if="toNextStage !== null"
            class="ml-auto shrink-0 text-[10px] text-ink-faint tabular"
          >
            再积 {{ toNextStage }} 宿慧入下一境地
          </span>
          <span v-else class="ml-auto shrink-0 text-[10px] text-gold-ink">此道已至尽头</span>
        </p>
        <p class="mt-1 t-body text-ink-faint">{{ stage.desc }}</p>

        <!-- 随神魂不灭的那一份 -->
        <div
          class="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 border-t border-ink/10 pt-2 text-[11px] tinylens:grid-cols-1"
        >
          <p class="flex justify-between">
            <span class="text-ink-faint">认得灵材</span>
            <span class="tabular text-ink-soft">{{ lore.knownMaterialCount }} 味</span>
          </p>
          <p class="flex justify-between">
            <span class="text-ink-faint">通晓丹方</span>
            <span class="tabular text-ink-soft">{{ lore.masteredRecipeCount }} 张</span>
          </p>
          <p class="flex justify-between">
            <span class="text-ink-faint">读通器谱</span>
            <span class="tabular text-ink-soft">{{ lore.masteredBlueprintCount }} 张</span>
          </p>
          <p class="flex justify-between">
            <span class="text-ink-faint">洞悉敌手</span>
            <span class="tabular text-ink-soft">{{ lore.masteredEnemyCount }} 种</span>
          </p>
          <p class="flex justify-between">
            <span class="text-ink-faint">睁眼即识</span>
            <span class="tabular text-ink-soft">{{ stage.knownMaterialRank }} 阶以下</span>
          </p>
        </div>

        <!-- 这一世的命题 -->
        <div v-if="vowTheme" class="mt-2 rounded-sm border border-ink/15 px-3 py-2">
          <p class="flex items-center justify-between">
            <span class="font-kai text-[14px] text-ink">「{{ vowTheme.vow }}」</span>
            <span
              class="text-[11px]"
              :class="vowBroken ? 'text-amber-ink' : vowDone ? 'text-cinnabar' : 'text-ink-faint'"
            >
              {{ vowBroken ? "已破" : vowDone ? "已成" : "在途" }}
            </span>
          </p>
          <p class="mt-1 text-[11px] text-ink-faint">
            {{ vowTheme.goal }}
            <span v-if="vowProg" class="tabular"
              >({{ Math.floor(vowProg.cur) }} / {{ vowProg.need }})</span
            >
          </p>
        </div>
        <p v-else class="mt-2 text-[11px] text-ink-faint">
          这一世不曾为自己立题。兵解转世时,可择一题而行。
        </p>
      </div>

      <!-- 历世履历 -->
      <SectionTitle
        title="历世履历"
        :hint="lifeRows.length ? `共 ${lifeRows.length} 世` : '初世'"
      />
      <div
        class="card-ink divide-y divide-ink/6 px-4"
        :data-life-total="lifeRows.length"
        :data-life-shown="lifePage.shown"
        :data-life-start="lifePage.start"
      >
        <template v-if="lifeRows.length">
          <p
            v-for="l in lifePage.visible"
            :key="l.index"
            :data-life-row="l.index"
            tabindex="-1"
            class="flex flex-wrap items-center gap-x-2 gap-y-0.5 py-2 text-[11px]"
          >
            <span class="w-11 shrink-0 whitespace-nowrap font-kai text-ink-faint tabular"
              >第{{ l.index }}世</span
            >
            <span class="shrink-0 whitespace-nowrap text-ink-soft">{{ l.realmLabel }}</span>
            <span class="shrink-0 whitespace-nowrap text-[10px] text-ink-faint tabular"
              >寿 {{ l.age }} 载</span
            >
            <span
              v-if="l.themeName"
              class="shrink-0 whitespace-nowrap text-[10px]"
              :class="l.resultColor"
              >{{ l.themeName }}·{{ l.resultText }}</span
            >
            <span class="ml-auto shrink-0 whitespace-nowrap tabular text-[10px] text-gold-ink"
              >宿慧 +{{ l.insight }}</span
            >
          </p>
          <div v-if="lifePage.start > 0 || lifePage.hidden > 0" class="flex flex-wrap gap-1 py-2">
            <button
              v-if="lifePage.start > 0"
              type="button"
              data-life-prev
              class="chip-ink !whitespace-normal text-center text-[10px] leading-relaxed text-ink-soft active:scale-95"
              :aria-label="previousLifeText()"
              @click="showPreviousLives"
            >
              {{ previousLifeText() }}
            </button>
            <button
              v-if="lifePage.hidden > 0"
              type="button"
              data-life-more
              class="chip-ink !whitespace-normal text-center text-[10px] leading-relaxed text-cinnabar active:scale-95"
              :aria-label="moreLifeText()"
              :data-promised="Math.min(LIFE_RENDER_BATCH, lifePage.hidden)"
              @click="showMoreLives"
            >
              {{ moreLifeText() }}
            </button>
          </div>
        </template>
        <p v-else class="empty-note py-4 text-center text-[11px] text-ink-faint">
          此为初世。你尚未死过一次,也就还没有什么可以回忆。
        </p>
      </div>
    </template>

    <template v-else-if="tab === 'journey'">
      <!-- 修行节点 -->
      <SectionTitle
        title="修行节点"
        :hint="`${endgame.milestones.length}/${MILESTONE_DEFS.length}`"
      />
      <div class="card-ink px-4 py-2">
        <div v-if="milestoneRows.length" class="relative ml-2 border-l border-ink/15 pl-4">
          <div v-for="row in milestoneRows" :key="row.id" class="relative py-1.5">
            <span class="absolute -left-5.25 top-2.5 h-2 w-2 rounded-full bg-gold-ink" />
            <p class="font-kai text-[14px] text-ink">第 {{ row.life }} 世 · {{ row.name }}</p>
            <p class="text-[10px] text-ink-faint">{{ row.desc }}</p>
          </div>
        </div>
        <p v-else class="empty-note py-4 text-center text-[11px] text-ink-faint">
          此录尚白。天界之行,自会留名。
        </p>
      </div>

      <!-- 征战录(Phase 30.9 S2):宿敌与雪耻 -->
      <SectionTitle title="征战录" :hint="`宿敌 ${nemesisRows.length} 位`" />
      <div class="card-ink divide-y divide-ink/6 px-4">
        <template v-if="nemesisRows.length">
          <p
            v-for="n in nemesisRows"
            :key="n.enemyId"
            class="flex items-center gap-2 py-2 text-[11px]"
          >
            <span
              class="font-kai text-[14px]"
              :class="n.avengedAt ? 'text-ink' : 'text-cinnabar'"
              >{{ n.enemyName }}</span
            >
            <span class="text-[10px] text-ink-faint"
              >{{ n.regionName }} · 败我 {{ n.lossCount }} 次</span
            >
            <span
              class="ml-auto shrink-0 text-[10px]"
              :class="n.avengedAt ? 'text-jade' : 'text-cinnabar'"
            >
              {{ n.avengedAt ? "已雪耻" : "尚为宿敌" }}
            </span>
          </p>
        </template>
        <p v-else class="empty-note py-4 text-center text-[11px] text-ink-faint">
          尚无宿敌。此录待你的血与道来填。
        </p>
      </div>
    </template>

    <template v-else-if="tab === 'fate'">
      <!-- 奇缘录(Phase 34.2):未了之缘,一世一世接下去 -->
      <SectionTitle title="奇缘录" :hint="`未了之缘 ${unfinishedChains} 条`" />
      <div class="card-ink divide-y divide-ink/6 px-4">
        <template v-if="chainRows.length">
          <p v-for="c in chainRows" :key="c.id" class="flex items-center gap-2 py-2 text-[11px]">
            <span
              class="shrink-0 font-kai text-[14px]"
              :class="c.broken ? 'text-ink-faint' : c.finished ? 'text-ink' : 'text-cinnabar'"
              >{{ c.name }}</span
            >
            <span class="min-w-0 truncate text-[10px] text-ink-faint">
              {{ c.broken ? "缘断,不复再续" : c.hint }}
            </span>
            <span
              class="ml-auto shrink-0 tabular text-[10px]"
              :class="c.broken ? 'text-ink-faint' : c.finished ? 'text-jade' : 'text-ink-faint'"
            >
              {{ c.broken ? "缘断" : c.finished ? "已了" : `第 ${c.stage + 1}/${c.total} 程` }}
            </span>
          </p>
        </template>
        <p v-else class="empty-note py-4 text-center text-[11px] text-ink-faint">
          尚无未了之缘。缘起于路上,不在名录里。
        </p>
      </div>

      <SectionTitle title="行迹录" :hint="`际遇回响 ${lossTotal} 则`" />
      <div
        class="card-ink divide-y divide-ink/6 px-4"
        :data-loss-total="lossTotal"
        :data-loss-shown="lossPage.shown"
        :data-loss-start="lossPage.start"
      >
        <template v-if="lossRows.length">
          <p
            v-for="l in lossPage.visible"
            :key="l.eventId + l.at"
            :data-loss-row="l.eventId"
            tabindex="-1"
            class="flex flex-wrap items-center gap-x-2 gap-y-0.5 py-2 text-[11px]"
          >
            <span class="shrink-0 whitespace-nowrap text-[10px] text-ink-faint">{{
              formatDate(l.at)
            }}</span>
            <span class="shrink-0 whitespace-nowrap text-ink-soft">{{ l.eventName }}</span>
            <span
              class="ml-auto shrink-0 text-[10px] text-ink-faint tinylens:ml-0 tinylens:basis-full tinylens:whitespace-normal"
              >{{ l.note }}</span
            >
          </p>
          <div v-if="lossPage.start > 0 || lossPage.hidden > 0" class="flex flex-wrap gap-1 py-2">
            <button
              v-if="lossPage.start > 0"
              type="button"
              data-loss-prev
              class="chip-ink !whitespace-normal text-center text-[10px] leading-relaxed text-ink-soft active:scale-95"
              :aria-label="previousLossText()"
              @click="showPreviousLoss"
            >
              {{ previousLossText() }}
            </button>
            <button
              v-if="lossPage.hidden > 0"
              type="button"
              data-loss-more
              class="chip-ink !whitespace-normal text-center text-[10px] leading-relaxed text-cinnabar active:scale-95"
              :aria-label="moreLossText()"
              :data-promised="Math.min(LOSS_RENDER_BATCH, lossPage.hidden)"
              @click="showMoreLoss"
            >
              {{ moreLossText() }}
            </button>
          </div>
        </template>
        <p v-else class="empty-note py-4 text-center text-[11px] text-ink-faint">
          世界尚未记住你的足迹。此录待你行过此世,自会留下回响。
        </p>
      </div>
    </template>

    <template v-else>
      <!-- 我的纪录 -->
      <SectionTitle title="我的纪录" hint="只与过去的自己比" />
      <div class="card-ink divide-y divide-ink/6 px-4">
        <template v-if="recordRows.length">
          <p v-for="r in recordRows" :key="r.id" class="flex items-center gap-2 py-2 text-[11px]">
            <span class="text-ink-faint">{{ r.name }}</span>
            <span class="ml-auto tabular font-kai text-[14px] text-gold-ink">{{
              r.valueText
            }}</span>
            <span class="shrink-0 text-[10px] text-ink-faint">第{{ r.life }}世 · {{ r.note }}</span>
          </p>
        </template>
        <p v-else class="empty-note py-4 text-center text-[11px] text-ink-faint">
          纪录待创。破界之时,自见分晓。
        </p>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, ref } from "vue";
import { useEndgameStore } from "@/stores/endgame";
import { usePlayerStore } from "@/stores/player";
import { useAdventureStore } from "@/stores/adventure";
import { useLoreStore } from "@/stores/lore";
import { cnNumber, formatPercent } from "@/utils/format";
import {
  cultivatorProfile,
  MILESTONE_DEFS,
  milestoneDef,
  PROFILE_MIN_MARKS,
  RECORD_DEFS,
} from "@/core/identity";
import { currentStage, totalInsight, vowProgress, vowResult } from "@/core/samsaraService";
import { nextStageAfter } from "@/data/samsara";
import { lifeThemeDef } from "@/data/lifeThemes";
import { regionDef } from "@/data/regions";
import { eventDef } from "@/data/events";
import { isNemesis } from "@/core/worldMemory";
import { chainProgressRows } from "@/core/eventEngine";
import {
  firstNewVisibleIndex,
  listWindow,
  nextListLimit,
  previousListLimit,
  previousListStep,
} from "@/core/listRender";
import { formatDate } from "@/utils/time";
import FolioPageHeader from "@/components/common/FolioPageHeader.vue";
import SectionTitle from "@/components/common/SectionTitle.vue";
import InkTabs from "@/components/common/InkTabs.vue";
import ProgressBar from "@/components/common/ProgressBar.vue";

/** 长卷分册:轮回(本世与历世)/ 征程(节点与宿敌)/ 缘迹(奇缘与行迹)/ 纪录 */
type LegacyTab = "samsara" | "journey" | "fate" | "record";
const TABS: { id: LegacyTab; label: string }[] = [
  { id: "samsara", label: "轮回" },
  { id: "journey", label: "征程" },
  { id: "fate", label: "缘迹" },
  { id: "record", label: "纪录" },
];
const tab = ref<LegacyTab>("samsara");

const endgame = useEndgameStore();
const player = usePlayerStore();
const adventure = useAdventureStore();
const lore = useLoreStore();

// ---- 轮回录 ----
const insight = computed(() => totalInsight());
const stage = computed(() => currentStage());
const toNextStage = computed(() => {
  const next = nextStageAfter(insight.value);
  return next ? next.insight - insight.value : null;
});
const vowTheme = computed(() => {
  const vow = player.reincarnation.vow;
  return vow ? (lifeThemeDef(vow.themeId) ?? null) : null;
});
const vowProg = computed(() => vowProgress());
const vowBroken = computed(() => vowResult() === "broken");
const vowDone = computed(() => vowResult() === "done");

const RESULT_TEXTS: Record<"done" | "unfinished" | "broken", string> = {
  done: "践行到底",
  unfinished: "未竟",
  broken: "已破",
};
const RESULT_COLORS: Record<"done" | "unfinished" | "broken", string> = {
  done: "text-cinnabar",
  unfinished: "text-ink-faint",
  broken: "text-amber-ink",
};

/** 历世履历:最近的一世排在最前 */
const lifeRows = computed(() =>
  [...player.reincarnation.lives]
    .sort((a, b) => b.index - a.index)
    .map((l) => {
      const result = l.themeResult ?? "unfinished";
      return {
        ...l,
        themeName: l.themeId ? (lifeThemeDef(l.themeId)?.name ?? null) : null,
        resultText: RESULT_TEXTS[result],
        resultColor: RESULT_COLORS[result],
      };
    }),
);
const LIFE_RENDER_BATCH = 12;
const LIFE_RENDER_WINDOW = LIFE_RENDER_BATCH * 2;
const lifeLimit = ref(LIFE_RENDER_BATCH);
const lifePage = computed(() => listWindow(lifeRows.value, lifeLimit.value, LIFE_RENDER_WINDOW));

function moreLifeText(): string {
  const next = Math.min(LIFE_RENDER_BATCH, lifePage.value.hidden);
  return `再看 ${next} 世 · 余 ${lifePage.value.hidden}`;
}

function previousLifeText(): string {
  const step = previousListStep(lifePage.value.shown, lifeRows.value.length, LIFE_RENDER_BATCH);
  return `前一批 ${step} 世`;
}

function focusHistoryRow(selector: string, index = 0): void {
  void nextTick(() => {
    const rows = document.querySelectorAll<HTMLElement>(selector);
    rows[Math.min(Math.max(0, index), rows.length - 1)]?.focus();
  });
}

function showMoreLives(): void {
  const shownBefore = lifePage.value.shown;
  const shownAfter = nextListLimit(shownBefore, lifeRows.value.length, LIFE_RENDER_BATCH);
  lifeLimit.value = shownAfter;
  focusHistoryRow(
    "[data-life-row]",
    firstNewVisibleIndex(shownBefore, shownAfter, LIFE_RENDER_WINDOW),
  );
}

function showPreviousLives(): void {
  lifeLimit.value = previousListLimit(
    lifePage.value.shown,
    lifeRows.value.length,
    LIFE_RENDER_BATCH,
  );
  focusHistoryRow("[data-life-row]");
}

/** 征战录:当前未雪耻/已雪耻的宿敌 */
const nemesisRows = computed(() =>
  player.nemeses
    .filter((n) => n.lossCount >= 3)
    .map((n) => ({
      ...n,
      regionName: regionDef(n.regionId)?.name ?? n.regionId,
      avengedAt: n.avengedAt,
      active: isNemesis(player.nemeses, n.enemyId),
    }))
    .sort((a, b) => (a.avengedAt ?? 0) - (b.avengedAt ?? 0)),
);

/** 征战录:事件余波(世界记忆的最近完成) */
const lossRows = computed(() =>
  Object.values(adventure.eventMemories)
    .filter((m) => m.times >= 2)
    .map((m) => ({
      eventId: m.eventId,
      at: m.lastAt,
      eventName: eventDef(m.eventId)?.title ?? m.eventId,
      note: `${m.times} 次际遇后,此地已别有风貌`,
    }))
    .sort((a, b) => b.at - a.at),
);
const lossTotal = computed(() => lossRows.value.length);
const LOSS_RENDER_BATCH = 8;
const LOSS_RENDER_WINDOW = LOSS_RENDER_BATCH * 2;
const lossLimit = ref(LOSS_RENDER_BATCH);
const lossPage = computed(() => listWindow(lossRows.value, lossLimit.value, LOSS_RENDER_WINDOW));

function moreLossText(): string {
  const next = Math.min(LOSS_RENDER_BATCH, lossPage.value.hidden);
  return `再看 ${next} 则 · 余 ${lossPage.value.hidden}`;
}

function previousLossText(): string {
  const step = previousListStep(lossPage.value.shown, lossRows.value.length, LOSS_RENDER_BATCH);
  return `前一批 ${step} 则`;
}

function showMoreLoss(): void {
  const shownBefore = lossPage.value.shown;
  const shownAfter = nextListLimit(shownBefore, lossRows.value.length, LOSS_RENDER_BATCH);
  lossLimit.value = shownAfter;
  focusHistoryRow(
    "[data-loss-row]",
    firstNewVisibleIndex(shownBefore, shownAfter, LOSS_RENDER_WINDOW),
  );
}

function showPreviousLoss(): void {
  lossLimit.value = previousListLimit(
    lossPage.value.shown,
    lossRows.value.length,
    LOSS_RENDER_BATCH,
  );
  focusHistoryRow("[data-loss-row]");
}

const profile = computed(() => cultivatorProfile(endgame.marks));

/** 奇缘录:只有起了头的缘才露面(往后的路不说破) */
const chainRows = computed(() => chainProgressRows());
const unfinishedChains = computed(
  () => chainRows.value.filter((c) => !c.finished && !c.broken).length,
);

const milestoneRows = computed(() =>
  [...endgame.milestones]
    .sort((a, b) => a.at - b.at)
    .map((m) => {
      const def = milestoneDef(m.id);
      return { id: m.id, life: m.life, name: def?.name ?? m.id, desc: def?.desc ?? "" };
    }),
);

const recordRows = computed(() =>
  RECORD_DEFS.map((def) => {
    const r = endgame.records[def.id];
    if (!r) return null;
    return {
      id: def.id,
      name: def.name,
      valueText: def.unit === "×" ? `×${r.value}` : `${r.value} ${def.unit}`,
      life: r.life,
      note: r.note,
    };
  }).filter((x): x is NonNullable<typeof x> => x !== null),
);
</script>
