<template>
  <div class="folio-page folio-page--stack stagger-in legacy-page-shell">
    <FolioPageHeader
      class="legacy-masthead"
      title="三生录"
      subtitle="一世一笔，所知与旧缘都从这里续写"
      back-to="character"
      back-label="人物"
      featured
    >
      <template #meta>
        <p class="legacy-masthead__meta" data-legacy-current>
          <span>{{ stage.name }}</span>
          <span>第 {{ currentLife }} 世</span>
          <span>宿慧 {{ insight }}</span>
        </p>
      </template>
      <template #visual>
        <LegacyWheel
          :life="currentLife"
          :stage-mark="stage.name.slice(0, 1)"
          :stage-ratio="stageMeter.ratio"
          :lore-ratio="loreCoverage.ratio"
          :fate-ratio="fateMeter.ratio"
        />
      </template>
    </FolioPageHeader>

    <div class="legacy-page folio-span-all">
      <section
        class="legacy-profile"
        data-legacy-profile
        :data-state="profile ? 'formed' : 'unformed'"
      >
        <span class="legacy-profile__seal" aria-hidden="true">{{ profile ? "象" : "待" }}</span>
        <div class="legacy-profile__identity">
          <p class="legacy-profile__eyebrow">修行画像 · {{ endgame.marks.length }} 则道痕</p>
          <template v-if="profile">
            <p class="legacy-profile__verdict">「{{ profile.verdict }}」</p>
            <div class="legacy-profile__traits">
              <span>风险 {{ profile.riskText }}</span>
              <span>{{ profile.buildTendency }}</span>
              <span>常用 {{ profile.favoriteBuild }}</span>
              <span v-if="profile.favoritePacts.length">
                常契 {{ profile.favoritePacts.join(" / ") }}
              </span>
              <span v-if="profile.bestWorld">擅长 {{ profile.bestWorld }}</span>
              <span v-if="profile.weakWorld">薄弱 {{ profile.weakWorld }}</span>
            </div>
          </template>
          <template v-else>
            <p class="legacy-profile__verdict">
              「道痕未满{{ cnNumber(PROFILE_MIN_MARKS) }}则，画像尚不成形。」
            </p>
            <p class="legacy-profile__copy">
              画像只从真实道痕归纳；再走几程，风险、流派与擅长世界自会显出轮廓。
            </p>
          </template>
        </div>
        <div v-if="profile" class="legacy-profile__shares" aria-label="道途分布">
          <p v-for="d in profile.daoShares" :key="d.name" class="legacy-profile__share">
            <span>{{ d.name }}</span>
            <span class="legacy-profile__track">
              <span :style="{ width: `${Math.max(0, Math.min(100, d.pct))}%` }" />
            </span>
            <strong class="tabular">{{ formatPercent(d.pct / 100) }}</strong>
          </p>
        </div>
      </section>

      <InkTabs v-model="tab" :tabs="TABS" />

      <section
        v-if="tab === 'samsara'"
        class="legacy-tab"
        role="tabpanel"
        aria-label="轮回"
        data-legacy-tab="samsara"
      >
        <section class="legacy-ledger" data-legacy-samsara>
          <LedgerHeader
            seal="轮"
            eyebrow="本世总案"
            title="宿慧与随身所知"
            description="轮回阶只开见识；灵材、丹方、器谱与敌手路数才是跨世不灭的底账。"
            score-label="第"
            :score-value="currentLife"
            score-suffix="世"
          />

          <div class="legacy-ledger__grid legacy-ledger__grid--three">
            <article class="legacy-panel" data-legacy-stage>
              <p class="legacy-panel__label">
                宿慧阶梯
                <span>{{ stage.name }}</span>
              </p>
              <p class="legacy-panel__line">
                <strong>{{ stage.name }}</strong>
                <span>宿慧 {{ insight }}</span>
              </p>
              <p class="legacy-panel__copy">{{ stage.desc }}</p>
              <ProgressBar
                class="mt-2"
                :value="stageMeter.ratio"
                color="var(--color-cinnabar)"
                :height="3"
              />
              <p v-if="nextStage" class="legacy-panel__gap tabular">
                尚差 {{ stageMeter.remaining }} 宿慧入「{{ nextStage.name }}」
              </p>
              <p v-else class="legacy-panel__complete">此道已至尽头，宿慧仍可继续累积。</p>
            </article>

            <article class="legacy-panel" data-legacy-lore>
              <p class="legacy-panel__label">
                随身所知
                <span>不随转世清零</span>
              </p>
              <div class="legacy-lore">
                <div
                  v-for="row in loreRows"
                  :key="row.key"
                  class="legacy-lore__row"
                  :data-legacy-lore-row="row.key"
                >
                  <span class="legacy-lore__mark" aria-hidden="true">{{ row.mark }}</span>
                  <span class="legacy-lore__name">{{ row.name }}</span>
                  <span class="legacy-lore__value tabular">
                    {{ row.value }} / {{ row.total }} {{ row.unit }}
                  </span>
                  <span class="legacy-lore__track">
                    <span :style="{ width: `${row.meter.ratio * 100}%` }" />
                  </span>
                </div>
              </div>
              <p class="legacy-panel__copy">
                睁眼即识 {{ stage.knownMaterialRank }} 阶以下 · 已辨识
                {{ lore.knownMaterialCount }} 味，通晓用法 {{ lore.masteredMaterialCount }} 味。
              </p>
            </article>

            <article class="legacy-panel" data-legacy-vow>
              <p class="legacy-panel__label">
                此世命题
                <span v-if="vowTheme" :data-state="vowState">{{ vowStateLabel }}</span>
                <span v-else>未立</span>
              </p>
              <template v-if="vowTheme">
                <p class="legacy-panel__line">
                  <strong>「{{ vowTheme.vow }}」</strong>
                  <span>{{ vowStateLabel }}</span>
                </p>
                <p class="legacy-panel__copy">{{ vowTheme.goal }}</p>
                <ProgressBar
                  v-if="vowMeter"
                  class="mt-2"
                  :value="vowMeter.ratio"
                  :color="
                    vowBroken
                      ? 'var(--color-amber-ink)'
                      : vowDone
                        ? 'var(--color-jade)'
                        : 'var(--color-cinnabar)'
                  "
                  :height="3"
                />
                <p v-if="vowProg" class="legacy-panel__gap tabular">
                  {{ Math.floor(vowProg.cur) }} / {{ vowProg.need }}
                  <span v-if="vowMeter && !vowMeter.complete">
                    · 尚差 {{ Math.max(0, vowProg.need - Math.floor(vowProg.cur)) }}
                  </span>
                </p>
              </template>
              <template v-else>
                <p class="legacy-panel__line"><strong>这一世尚未立题</strong></p>
                <p class="legacy-panel__copy">
                  兵解转世时可择一题而行；命题只判这一世，不追认前尘。
                </p>
              </template>
            </article>
          </div>

          <footer class="legacy-ledger__foot">
            <p v-for="stat in overviewStats" :key="stat.key" class="legacy-stat">
              <span>{{ stat.label }}</span>
              <strong class="tabular">{{ stat.value }}</strong>
            </p>
          </footer>
        </section>

        <section
          class="legacy-ledger legacy-history"
          :data-life-total="lifeRows.length"
          :data-life-shown="lifePage.shown"
          :data-life-start="lifePage.start"
        >
          <LedgerHeader
            variant="index"
            eyebrow="旧世归档"
            title="历世履历"
            :meta="
              lifeRows.length
                ? `现看 ${lifePage.start + 1}–${lifePage.shown} · 共 ${lifeRows.length} 世`
                : '初世'
            "
          />

          <div class="legacy-history__list">
            <template v-if="lifeRows.length">
              <article
                v-for="l in lifePage.visible"
                :key="l.index"
                :data-life-row="l.index"
                tabindex="-1"
                class="legacy-history__row"
              >
                <span class="legacy-history__index tabular">第{{ l.index }}世</span>
                <div class="legacy-history__copy">
                  <p class="legacy-history__line">
                    <strong>{{ l.realmLabel }}</strong>
                    <span>寿 {{ l.age }} 载</span>
                  </p>
                  <p v-if="l.themeName" class="legacy-history__theme" :class="l.resultColor">
                    {{ l.themeName }} · {{ l.resultText }}
                  </p>
                  <p v-else class="legacy-history__quiet">此世未立命题</p>
                </div>
                <span class="legacy-history__insight tabular">宿慧 +{{ l.insight }}</span>
              </article>
              <div v-if="lifePage.start > 0 || lifePage.hidden > 0" class="legacy-pager">
                <button
                  v-if="lifePage.start > 0"
                  type="button"
                  data-life-prev
                  class="chip-ink !whitespace-normal text-center text-note leading-relaxed text-ink-soft active:scale-95"
                  :aria-label="previousLifeText()"
                  @click="showPreviousLives"
                >
                  {{ previousLifeText() }}
                </button>
                <button
                  v-if="lifePage.hidden > 0"
                  type="button"
                  data-life-more
                  class="chip-ink !whitespace-normal text-center text-note leading-relaxed text-cinnabar active:scale-95"
                  :aria-label="moreLifeText()"
                  :data-promised="Math.min(LIFE_RENDER_BATCH, lifePage.hidden)"
                  @click="showMoreLives"
                >
                  {{ moreLifeText() }}
                </button>
              </div>
            </template>
            <p v-else class="legacy-empty">此为初世。你尚未死过一次，也就还没有什么可以回忆。</p>
          </div>
        </section>
      </section>

      <section
        v-else-if="tab === 'journey'"
        class="legacy-tab"
        role="tabpanel"
        aria-label="征程"
        data-legacy-tab="journey"
      >
        <section class="legacy-ledger" data-legacy-journey>
          <LedgerHeader
            seal="程"
            eyebrow="跨世行迹"
            title="修行节点与宿敌"
            description="节点是首次破界留下的路标；宿敌只记败过三次以上的对手，雪耻后仍留名。"
            score-label="节点"
            :score-value="milestoneRows.length"
            :score-suffix="`/ ${MILESTONE_DEFS.length}`"
          />

          <div class="legacy-ledger__grid">
            <article class="legacy-panel">
              <p class="legacy-panel__label">
                修行节点
                <span>{{ milestoneRows.length }} / {{ MILESTONE_DEFS.length }}</span>
              </p>
              <div v-if="milestoneRows.length" class="legacy-timeline">
                <article
                  v-for="row in milestoneRows"
                  :key="row.id"
                  class="legacy-timeline__row"
                  :data-legacy-milestone="row.id"
                >
                  <span class="legacy-timeline__mark tabular">{{ row.life }}</span>
                  <div class="legacy-timeline__copy">
                    <p class="legacy-panel__line">
                      <strong>{{ row.name }}</strong>
                      <span>第 {{ row.life }} 世</span>
                    </p>
                    <p class="legacy-panel__copy">{{ row.desc }}</p>
                  </div>
                </article>
              </div>
              <p v-else class="legacy-empty">此录尚白。天界之行，自会留名。</p>
            </article>

            <article class="legacy-panel">
              <p class="legacy-panel__label">
                征战录
                <span>宿敌 {{ nemesisRows.length }} 位</span>
              </p>
              <div v-if="nemesisRows.length" class="legacy-duels">
                <article
                  v-for="n in nemesisRows"
                  :key="n.enemyId"
                  class="legacy-duel"
                  :data-state="n.avengedAt ? 'avenged' : 'active'"
                  :data-legacy-nemesis="n.enemyId"
                >
                  <span class="legacy-duel__mark" aria-hidden="true">
                    {{ n.avengedAt ? "雪" : "仇" }}
                  </span>
                  <div class="legacy-duel__copy">
                    <p class="legacy-panel__line">
                      <strong>{{ n.enemyName }}</strong>
                      <span>{{ n.regionName }} · 败我 {{ n.lossCount }} 次</span>
                    </p>
                    <p class="legacy-duel__state">
                      {{ n.avengedAt ? "已雪耻，旧名仍在册" : "尚为宿敌，下一战可雪耻" }}
                    </p>
                  </div>
                </article>
              </div>
              <p v-else class="legacy-empty">尚无宿敌。此录待你的血与道来填。</p>
            </article>
          </div>
        </section>
      </section>

      <section
        v-else-if="tab === 'fate'"
        class="legacy-tab"
        role="tabpanel"
        aria-label="缘迹"
        data-legacy-tab="fate"
      >
        <section class="legacy-ledger" data-legacy-fate>
          <LedgerHeader
            seal="缘"
            eyebrow="未了之缘"
            title="奇缘录"
            description="只有起了头的缘才在此露面；已了与缘断都留结局，不把旧选择一笔抹掉。"
            score-label="未了"
            :score-value="unfinishedChains"
            score-suffix="条"
          />

          <div v-if="chainRows.length" class="legacy-fate__list">
            <article
              v-for="c in chainRows"
              :key="c.id"
              class="legacy-fate__row"
              :data-state="c.broken ? 'broken' : c.finished ? 'finished' : 'open'"
            >
              <span class="legacy-fate__mark" aria-hidden="true">
                {{ c.broken ? "断" : c.finished ? "了" : "续" }}
              </span>
              <div class="legacy-fate__copy">
                <p class="legacy-panel__line">
                  <strong>{{ c.name }}</strong>
                  <span>
                    {{
                      c.broken ? "缘断" : c.finished ? "已了" : `第 ${c.stage + 1}/${c.total} 程`
                    }}
                  </span>
                </p>
                <p class="legacy-panel__copy">
                  {{ c.broken ? "缘断，不复再续" : c.hint }}
                </p>
              </div>
            </article>
          </div>
          <p v-else class="legacy-empty">尚无未了之缘。缘起于路上，不在名录里。</p>
        </section>

        <section
          class="legacy-ledger legacy-loss"
          :data-loss-total="lossTotal"
          :data-loss-shown="lossPage.shown"
          :data-loss-start="lossPage.start"
        >
          <LedgerHeader
            variant="index"
            eyebrow="世界回响"
            title="行迹录"
            :meta="
              lossTotal
                ? `现看 ${lossPage.start + 1}–${lossPage.shown} · 共 ${lossTotal} 则`
                : '尚无回响'
            "
          />

          <div class="legacy-loss__list">
            <template v-if="lossRows.length">
              <article
                v-for="l in lossPage.visible"
                :key="l.eventId + l.at"
                :data-loss-row="l.eventId"
                tabindex="-1"
                class="legacy-loss__row"
              >
                <span class="legacy-loss__date tabular">{{ formatDate(l.at) }}</span>
                <div class="legacy-loss__copy">
                  <p class="legacy-panel__line">
                    <strong>{{ l.eventName }}</strong>
                  </p>
                  <p class="legacy-panel__copy">{{ l.note }}</p>
                </div>
              </article>
              <div v-if="lossPage.start > 0 || lossPage.hidden > 0" class="legacy-pager">
                <button
                  v-if="lossPage.start > 0"
                  type="button"
                  data-loss-prev
                  class="chip-ink !whitespace-normal text-center text-note leading-relaxed text-ink-soft active:scale-95"
                  :aria-label="previousLossText()"
                  @click="showPreviousLoss"
                >
                  {{ previousLossText() }}
                </button>
                <button
                  v-if="lossPage.hidden > 0"
                  type="button"
                  data-loss-more
                  class="chip-ink !whitespace-normal text-center text-note leading-relaxed text-cinnabar active:scale-95"
                  :aria-label="moreLossText()"
                  :data-promised="Math.min(LOSS_RENDER_BATCH, lossPage.hidden)"
                  @click="showMoreLoss"
                >
                  {{ moreLossText() }}
                </button>
              </div>
            </template>
            <p v-else class="legacy-empty">
              世界尚未记住你的足迹。此录待你行过此世，自会留下回响。
            </p>
          </div>
        </section>
      </section>

      <section v-else class="legacy-tab" role="tabpanel" aria-label="纪录" data-legacy-tab="record">
        <section class="legacy-ledger" data-legacy-record>
          <LedgerHeader
            seal="极"
            eyebrow="只与过去的自己比"
            title="极境纪录"
            description="每一格都记破界那一刻的实值；未立不是零，只表示还没走到可比较的一战。"
            score-label="已立"
            :score-value="recordCount"
            :score-suffix="`/ ${RECORD_DEFS.length}`"
          />

          <div class="legacy-record__list">
            <article
              v-for="r in recordRows"
              :key="r.id"
              class="legacy-record__row"
              :data-state="r.record ? 'set' : 'empty'"
              :data-legacy-record-row="r.id"
            >
              <span class="legacy-record__mark" aria-hidden="true">{{
                r.record ? "极" : "待"
              }}</span>
              <div class="legacy-record__copy">
                <p class="legacy-panel__line">
                  <strong>{{ r.name }}</strong>
                  <span v-if="r.record">第{{ r.record.life }}世 · {{ r.record.note }}</span>
                  <span v-else>尚未立纪录</span>
                </p>
                <p class="legacy-panel__copy">
                  {{ r.record ? "此项已记入跨世极境，后续只接受更好的结果。" : r.emptyCopy }}
                </p>
              </div>
              <strong class="legacy-record__value tabular">{{ r.valueText }}</strong>
            </article>
          </div>
          <footer class="legacy-ledger__foot legacy-record__foot">
            <ProgressBar
              class="min-w-0 flex-1"
              :value="recordMeter.ratio"
              color="var(--color-gold-ink)"
              :height="3"
            />
            <p class="legacy-panel__copy">
              已立 {{ recordCount }} / {{ RECORD_DEFS.length }} 项；纪录只增不减，跨世保留。
            </p>
          </footer>
        </section>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import "@/styles/pages/legacy.css";
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
import { MATERIALS } from "@/data/materials";
import { PILLS } from "@/data/pills";
import { EQUIPMENT_TEMPLATES } from "@/data/equipment";
import { ENEMIES } from "@/data/enemies";
import { isNemesis } from "@/core/worldMemory";
import { chainProgressRows } from "@/core/eventEngine";
import {
  firstNewVisibleIndex,
  listWindow,
  nextListLimit,
  previousListLimit,
  previousListStep,
} from "@/core/listRender";
import { legacyCoverage, legacyMeter, legacyStageMeter } from "@/ui/legacyDesk";
import { formatDate } from "@/utils/time";
import FolioPageHeader from "@/components/common/FolioPageHeader.vue";
import LegacyWheel from "@/components/common/LegacyWheel.vue";
import InkTabs from "@/components/common/InkTabs.vue";
import LedgerHeader from "@/components/common/LedgerHeader.vue";
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
const RECIPE_TOTAL = PILLS.filter((pill) => pill.recipe).length;

const insight = computed(() => totalInsight());
const stage = computed(() => currentStage());
const currentLife = computed(() => player.reincarnation.count + 1);
const nextStage = computed(() => nextStageAfter(insight.value));
const stageMeter = computed(() =>
  legacyStageMeter(insight.value, stage.value.insight, nextStage.value?.insight ?? null),
);

const vowTheme = computed(() => {
  const vow = player.reincarnation.vow;
  return vow ? (lifeThemeDef(vow.themeId) ?? null) : null;
});
const vowProg = computed(() => vowProgress());
const vowMeter = computed(() =>
  vowProg.value ? legacyMeter(vowProg.value.cur, vowProg.value.need) : null,
);
const vowBroken = computed(() => vowResult() === "broken");
const vowDone = computed(() => vowResult() === "done");
const vowState = computed(() => (vowBroken.value ? "broken" : vowDone.value ? "done" : "open"));
const vowStateLabel = computed(() => (vowBroken.value ? "已破" : vowDone.value ? "已成" : "在途"));

const loreRows = computed(() =>
  [
    {
      key: "material",
      mark: "材",
      name: "认得灵材",
      value: lore.knownMaterialCount,
      total: MATERIALS.length,
      unit: "味",
    },
    {
      key: "recipe",
      mark: "方",
      name: "通晓丹方",
      value: lore.masteredRecipeCount,
      total: RECIPE_TOTAL,
      unit: "张",
    },
    {
      key: "blueprint",
      mark: "谱",
      name: "读通器谱",
      value: lore.masteredBlueprintCount,
      total: EQUIPMENT_TEMPLATES.length,
      unit: "张",
    },
    {
      key: "enemy",
      mark: "敌",
      name: "洞悉敌手",
      value: lore.masteredEnemyCount,
      total: ENEMIES.length,
      unit: "种",
    },
  ].map((row) => ({ ...row, meter: legacyMeter(row.value, row.total) })),
);
const loreCoverage = computed(() => legacyCoverage(loreRows.value));

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
const activeNemeses = computed(() => nemesisRows.value.filter((n) => !n.avengedAt).length);

/** 行迹录:事件余波(世界记忆的最近完成) */
const lossRows = computed(() =>
  Object.values(adventure.eventMemories)
    .filter((m) => m.times >= 2)
    .map((m) => ({
      eventId: m.eventId,
      at: m.lastAt,
      eventName: eventDef(m.eventId)?.title ?? m.eventId,
      note: `${m.times} 次际遇后，此地已别有风貌`,
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
const fateMeter = computed(() => legacyMeter(unfinishedChains.value, chainRows.value.length));

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
    const record = endgame.records[def.id];
    return {
      id: def.id,
      name: def.name,
      record: record ?? null,
      valueText: record
        ? def.unit === "×"
          ? `×${record.value}`
          : `${record.value} ${def.unit}`
        : "未立",
      emptyCopy:
        def.id === "fastest_world"
          ? "首次破界后，会记下最短回合数。"
          : def.id === "highest_pact"
            ? "带着逆旅契破界后，会记下最高风险倍率。"
            : def.id === "biggest_reward"
              ? "首次拿到破界道源后，会记下单程最厚之赏。"
              : "完成挑战书并领赏后，会记下最高赏格。",
    };
  }),
);
const recordCount = computed(() => recordRows.value.filter((r) => r.record !== null).length);
const recordMeter = computed(() => legacyMeter(recordCount.value, RECORD_DEFS.length));

const overviewStats = computed(() => [
  { key: "lives", label: "旧世", value: lifeRows.value.length },
  { key: "insight", label: "宿慧", value: insight.value },
  { key: "nemesis", label: "宿敌", value: activeNemeses.value },
  { key: "chains", label: "未了缘", value: unfinishedChains.value },
]);
</script>
