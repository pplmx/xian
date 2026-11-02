<template>
  <div class="folio-page folio-page--stack stagger-in collection-page">
    <FolioPageHeader
      title="藏 珍"
      subtitle="功名入榜 · 九柜纳珍"
      back-to="character"
      back-label="人物"
      featured
    />

    <!--
      双阁门取代原来的横页签：功名榜先报最近三策，藏珍阁直接打开九柜。
      两扇门仍与 ?tab= 同源，玄枢图里的「成就 / 收藏」原叫法藏在读屏里。
    -->
    <nav
      class="collection-gates folio-span-all"
      role="tablist"
      aria-label="藏珍双阁"
      @keydown="onGateKeydown"
    >
      <button
        v-for="gate in gateRows"
        :key="gate.id"
        ref="gateEls"
        type="button"
        role="tab"
        class="collection-gate"
        :class="{ 'is-active': tab === gate.id }"
        :data-collection-gate="gate.id"
        :aria-selected="tab === gate.id"
        :tabindex="tab === gate.id ? 0 : -1"
        @click="tab = gate.id"
      >
        <span class="collection-gate__mark" aria-hidden="true">{{ gate.mark }}</span>
        <span class="collection-gate__copy">
          <span class="collection-gate__title text-section">
            {{ gate.label }}<span class="sr-only">，{{ gate.short }}</span>
          </span>
          <span class="collection-gate__hint text-note">{{ gate.hint }}</span>
        </span>
        <span class="collection-gate__fact tabular" data-collection-gate-fact>{{ gate.fact }}</span>
        <span v-if="gate.dot" class="collection-gate__dot" aria-hidden="true" />
        <span v-if="gate.dot" class="sr-only">有新得</span>
      </button>
    </nav>

    <!--
      功名与藏珍各收成一册两章。960 宽起，行动章与墙/柜章左右并读；
      手机仍按同一顺序单列，所有按钮都落在柜面或榜牌上。
    -->
    <article class="collection-register folio-span-all" data-collection-register>
      <template v-if="tab === 'achievement'">
        <section
          class="collection-register__chapter achievement-briefing"
          data-collection-chapter="lead"
          data-achievement-hero
        >
          <FolioChapterHead
            data-collection-chapter-head
            index="壹"
            eyebrow="功名状 · 按完成比例"
            title="眼下可追"
            :hint="achievementLeadDescription"
            :fact="
              nearestAchievements.length > 0 ? `${nearestAchievements.length} 枚候追` : '全谱已成'
            "
          />

          <div v-if="nearestAchievements.length" class="achievement-briefing__targets">
            <button
              v-for="(row, index) in nearestAchievements"
              :key="row.def.id"
              type="button"
              class="achievement-target"
              :data-achievement-jump="row.def.id"
              :data-achievement-jump-direction="row.direction"
              :aria-label="`${row.def.name}，${row.def.desc}，${row.label}，查看并定位功名榜`"
              @click="revealAchievement(row)"
            >
              <span class="achievement-target__ordinal" aria-hidden="true">
                {{ String(index + 1).padStart(2, "0") }}
              </span>
              <span class="achievement-target__copy">
                <span class="achievement-target__line">
                  <strong class="text-title">{{ row.def.name }}</strong>
                  <span class="achievement-target__progress tabular">{{ row.label }}</span>
                </span>
                <span class="achievement-target__desc">{{ row.def.desc }}</span>
              </span>
              <span class="achievement-target__arrow" aria-hidden="true">›</span>
            </button>
          </div>
          <p v-else class="achievement-briefing__empty">全谱已成，往后的路只看你怎么走。</p>
        </section>

        <section
          class="collection-register__chapter achievement-volumes"
          data-collection-chapter="volumes"
          data-achievement-volumes
        >
          <FolioChapterHead
            data-collection-chapter-head
            index="贰"
            eyebrow="功名墙 · 按方向收榜"
            title="功名榜"
            hint="点一枚榜牌，展开这一路的条件、进度与达成赏"
            :fact="`${achievementGroups.length} 路 · ${doneCount}/${ACHIEVEMENTS.length}`"
          />

          <div class="achievement-wall" role="list" aria-label="功名方向榜">
            <button
              v-for="(g, gi) in achievementGroups"
              :key="g.direction"
              type="button"
              class="achievement-plaque"
              :class="{ 'is-open': isGroupOpen(g.direction), 'is-complete': g.done === g.total }"
              :data-achievement-group-toggle="g.direction"
              :aria-expanded="isGroupOpen(g.direction)"
              :aria-controls="groupBodyId(gi)"
              @click="toggleGroup(g.direction)"
            >
              <span class="achievement-plaque__seal" aria-hidden="true">
                {{ achievementDirectionMark(g.direction) }}
              </span>
              <span class="achievement-plaque__name">{{ g.direction }}</span>
              <span class="achievement-plaque__count tabular">{{ g.done }}/{{ g.total }}</span>
              <span class="achievement-plaque__track" aria-hidden="true">
                <span :style="{ width: `${g.total > 0 ? (g.done / g.total) * 100 : 0}%` }" />
              </span>
              <span class="achievement-plaque__nearest">
                {{
                  g.done === g.total
                    ? "此路已尽"
                    : g.nearest
                      ? `${g.nearest.def.name} · ${g.nearest.label}`
                      : "尚无可量化目标"
                }}
              </span>
            </button>
          </div>

          <div class="achievement-scrolls">
            <template v-for="(g, gi) in achievementGroups" :key="g.direction">
              <section
                v-show="isGroupOpen(g.direction)"
                :id="groupBodyId(gi)"
                :data-achievement-group-body="g.direction"
                class="achievement-scroll"
              >
                <template v-if="isGroupOpen(g.direction)">
                  <header class="achievement-scroll__head">
                    <span class="achievement-scroll__seal" aria-hidden="true">
                      {{ achievementDirectionMark(g.direction) }}
                    </span>
                    <span class="achievement-scroll__copy">
                      <strong>{{ g.direction }}</strong>
                      <span>{{
                        g.done === g.total
                          ? "此路已尽，展开回看每一枚功名"
                          : g.nearest
                            ? `最近：${g.nearest.def.name} · ${g.nearest.label}`
                            : "尚无可量化目标"
                      }}</span>
                    </span>
                    <span class="achievement-scroll__count tabular"
                      >{{ g.done }}/{{ g.total }}</span
                    >
                  </header>

                  <article
                    v-for="row in g.rows"
                    :key="row.def.id"
                    :data-achievement-id="row.def.id"
                    class="achievement-entry"
                  >
                    <span
                      class="achievement-entry__state"
                      :class="{
                        'is-done': row.done,
                        'is-live': !row.done && row.target !== null,
                      }"
                    >
                      {{ row.done ? "成" : row.percent === null ? "未" : `${row.percent}%` }}
                    </span>
                    <div class="achievement-entry__copy">
                      <div class="achievement-entry__line">
                        <p class="text-body" :class="row.done ? 'text-ink' : 'text-ink-soft'">
                          {{ row.def.name }}
                        </p>
                        <span
                          class="achievement-entry__progress tabular"
                          :class="row.done ? 'text-gold-ink' : 'text-qing'"
                          >{{ row.label }}</span
                        >
                      </div>
                      <p class="achievement-entry__desc">{{ row.def.desc }}</p>
                      <ProgressBar
                        v-if="!row.done && row.target !== null"
                        class="achievement-entry__meter"
                        :value="row.ratio"
                        color="var(--color-cinnabar)"
                        :height="2"
                      />
                      <!-- 达成才现赏:名目成时、所获同露 —— 称号是成就赏的大头,一颗不漏 -->
                      <p
                        v-if="row.done && row.rewardText"
                        class="achievement-entry__reward tabular"
                      >
                        {{ row.rewardText }}
                      </p>
                    </div>
                  </article>
                </template>
              </section>
            </template>
            <p v-if="achievementGroups.length === 0" class="collection-page__empty">
              功名谱尚空，先去历练里留下第一笔。
            </p>
          </div>

          <p class="collection-page__footnote">
            未达成也写明条件；榜牌只开一路，最近三策可直接落到对应条目。
          </p>
        </section>
      </template>

      <template v-else>
        <section
          class="collection-register__chapter collection-briefing"
          data-collection-chapter="lead"
          data-collection-hero
        >
          <FolioChapterHead
            data-collection-chapter-head
            index="壹"
            eyebrow="藏珍阁 · 新得先开"
            :title="collectionLeadTitle"
            :hint="collectionLeadDescription"
            :fact="collectionLeadFact"
          />

          <CollectionCabinet
            :cells="collectionCabinetCells"
            :selected-key="selectedCollectionKey"
            :achievement-done="doneCount"
            :achievement-total="ACHIEVEMENTS.length"
            :collection-known="collectionOverview.known"
            :collection-total="collectionOverview.total"
            @select="setCollectionCategoryOpen($event, true)"
          />
        </section>

        <section
          class="collection-register__chapter collection-shelves"
          data-collection-chapter="volumes"
          data-collection-shelves
        >
          <FolioChapterHead
            data-collection-chapter-head
            index="贰"
            eyebrow="开柜查验"
            :title="collectionTrayTitle"
            :hint="collectionTrayHint"
            :fact="collectionTrayFact"
          />

          <div class="collection-trays">
            <template v-for="cat in visibleCats" :key="cat.key">
              <section
                v-show="isCollectionCategoryOpen(cat.key)"
                :id="collectionCategoryBodyId(cat.key)"
                :data-collection-category-body="cat.key"
                :data-collection-start="cat.knownStart"
                :data-collection-shown="cat.knownShown"
                :data-collection-total="cat.knownTotal"
                data-collection-tray
                class="collection-tray"
              >
                <template v-if="isCollectionCategoryOpen(cat.key)">
                  <header class="collection-tray__head">
                    <span
                      class="collection-tray__seal"
                      :class="{ 'is-complete': progressOf(cat.key).complete }"
                      aria-hidden="true"
                    >
                      {{ collectionCategoryMark(cat.key) }}
                    </span>
                    <div class="collection-tray__copy">
                      <p class="collection-tray__eyebrow">此柜来路</p>
                      <p v-if="catComplete(cat)" class="collection-tray__source is-complete">
                        <span>尽收</span>
                        此目已无未识之物 —— 见之者皆入册
                      </p>
                      <p v-else class="collection-tray__source">{{ cat.source }}</p>
                    </div>
                    <span class="collection-tray__count tabular"
                      >{{ progressOf(cat.key).known }}/{{ progressOf(cat.key).total }}</span
                    >
                  </header>

                  <div class="collection-tray__entries">
                    <template v-for="entry in cat.knownVisible" :key="entry.id">
                      <button
                        class="collection-token"
                        :style="{ color: entry.color }"
                        :data-codex-entry="cat.key"
                        :data-codex-id="entry.id"
                        @click="openDetail(cat, entry)"
                      >
                        <GameIcon v-if="entry.icon" :name="entry.icon" :size="11" />
                        <span class="collection-token__name">{{ entry.name }}</span>
                        <span v-if="entry.badge" class="collection-token__badge">{{
                          entry.badge
                        }}</span>
                        <span
                          v-if="quests.isEntryNew(cat.key, entry.id)"
                          class="collection-token__new animate-new-pop"
                          >新</span
                        >
                      </button>
                    </template>

                    <div
                      v-if="cat.knownStart > 0 || cat.hiddenKnown > 0"
                      class="collection-tray__paging"
                    >
                      <button
                        v-if="cat.knownStart > 0"
                        type="button"
                        class="collection-paging"
                        :data-collection-prev="cat.key"
                        :aria-label="previousKnownLabel(cat)"
                        @click="showPreviousKnown(cat)"
                      >
                        {{ previousKnownLabel(cat) }}
                      </button>
                      <button
                        v-if="cat.hiddenKnown > 0"
                        type="button"
                        class="collection-paging is-more"
                        :data-collection-more="cat.key"
                        :data-promised="nextRevealCount(cat.hiddenKnown, COLLECTION_RENDER_BATCH)"
                        :aria-label="moreKnownLabel(cat)"
                        @click="showMoreKnown(cat)"
                      >
                        {{ moreKnownLabel(cat) }}
                      </button>
                    </div>

                    <template v-for="entry in cat.unknownVisible" :key="entry.id">
                      <span class="collection-token is-unknown" :title="`尚未收录 · ${cat.source}`"
                        >???</span
                      >
                    </template>
                    <span
                      v-if="cat.hiddenUnknown"
                      class="collection-token is-unknown is-more"
                      :title="`尚有 ${cat.hiddenUnknown} 件未收录`"
                      >…+{{ cat.hiddenUnknown }}</span
                    >
                  </div>
                </template>
              </section>
            </template>
            <div v-if="!selectedCollectionCat" class="collection-tray collection-tray--closed">
              <p class="collection-tray__closed-mark" aria-hidden="true">柜</p>
              <p>柜屉合着。从左侧点一枚柜格，抽开看这一册的来源与条目。</p>
            </div>
          </div>

          <p class="collection-page__footnote">
            每柜一次只抽开一屉；已收条目按批前后翻看，未识条目只铺一截问号墙。
          </p>
        </section>
      </template>
    </article>

    <!-- 图鉴详情 -->
    <BaseModal :open="detail !== null" :title="detail?.entry.name ?? ''" @close="detail = null">
      <div v-if="detail" class="collection-detail">
        <div
          v-if="detail.entry.icon"
          class="mb-3 grid h-12 w-12 place-items-center rounded-[2px] bg-ink/5"
        >
          <GameIcon
            :name="detail.entry.icon"
            :size="24"
            :style="{ color: detail.entry.color ?? 'var(--color-ink-soft)' }"
          />
        </div>
        <div class="collection-detail__meta">
          <span
            class="collection-detail__category"
            :style="{ color: detail.entry.color ?? 'var(--color-ink-soft)' }"
          >
            {{ detail.catName }}
          </span>
          <span v-if="detail.entry.stageName" class="collection-detail__stage">{{
            detail.entry.stageName
          }}</span>
          <span v-if="detail.entry.meta" class="collection-detail__line">{{
            detail.entry.meta
          }}</span>
        </div>
        <p class="collection-detail__desc">
          {{ detail.entry.desc || "此物玄妙,难以言表。" }}
        </p>
        <p v-if="detail.entry.hint" class="collection-detail__hint">
          {{ detail.entry.hint }}
        </p>
        <div class="ink-divider-mark my-3" />
        <p class="collection-detail__foot">
          <span>{{ detail.entry.foot.label }}</span>
          <span class="tabular">{{ detail.entry.foot.value }}</span>
        </p>
      </div>
    </BaseModal>
  </div>
</template>

<script setup lang="ts">
import "@/styles/pages/collection.css";
import { computed, nextTick, onUnmounted, ref, useTemplateRef, watch } from "vue";
import { useQuestsStore } from "@/stores/quests";
import { useInventoryStore } from "@/stores/inventory";
import { usePlayerStore } from "@/stores/player";
import { ACHIEVEMENTS } from "@/data/achievements";
import { qualityDef } from "@/data/qualities";
import { collectionCodex, type CodexCat, type CodexEntry } from "@/ui/codex";
import { achievementDirection } from "@/ui/achievementHint";
import {
  achievementProgressRows,
  nearestAchievementRows,
  type AchievementProgressRow,
} from "@/core/achievementProgress";
import {
  collectionProgressOverviewFromCodex,
  type CollectionProgressRow,
} from "@/core/collectionProgress";
import { rewardTextAtTier } from "@/core/progress";
import {
  firstNewVisibleIndex,
  listWindow,
  nextListLimit,
  nextRevealCount,
  previousListLimit,
  previousListStep,
} from "@/core/listRender";
import {
  achievementDirectionMark,
  collectionCabinetCells as buildCollectionCabinetCells,
  collectionCategoryMark,
} from "@/ui/collectionDesk";
import ProgressBar from "@/components/common/ProgressBar.vue";
import FolioPageHeader from "@/components/common/FolioPageHeader.vue";
import CollectionCabinet from "@/components/common/CollectionCabinet.vue";
import FolioChapterHead from "@/components/common/FolioChapterHead.vue";
import BaseModal from "@/components/common/BaseModal.vue";
import GameIcon from "@/components/common/GameIcon.vue";
import { useRouteTab } from "@/composables/useRouteTab";
import { COLLECTION_CHAPTERS } from "@/ui/navigation";

const quests = useQuestsStore();
const inventory = useInventoryStore();
const player = usePlayerStore();

const tab = useRouteTab(COLLECTION_CHAPTERS, "achievement");
// 「新得」清账时机 = 离开藏珍阁那一刻；直接深链进收藏也要算看过。
const sawCollectionTab = ref(false);
watch(
  tab,
  (next) => {
    if (next === "collection") sawCollectionTab.value = true;
  },
  { immediate: true },
);
onUnmounted(() => {
  if (sawCollectionTab.value) quests.markCollectionSeen();
});

const gateEls = useTemplateRef<HTMLButtonElement[]>("gateEls");

type AchievementRow = AchievementProgressRow & { direction: string; rewardText: string };

/** 品质型成就的进度只看当前持有最高品质；它是 "现持" 口径，不是历史最高记录。 */
const maxQualityRank = computed(() =>
  inventory.items.reduce((max, item) => Math.max(max, qualityDef(item.quality).rank), 0),
);

/**
 * 成就谱不再把未达成者遮成「???」:名称、条件与可量化进度全部摊开。
 * 达成与否仍只读 quests.achieved,这里只补 "离目标还有多远" 的派生读数。
 */
const achievementRows = computed<AchievementRow[]>(() =>
  achievementProgressRows(ACHIEVEMENTS, {
    achieved: quests.achieved,
    counters: quests.counters,
    major: player.major,
    maxQualityRank: maxQualityRank.value,
  }).map((row) => ({
    ...row,
    direction: achievementDirection(row.def.cond),
    // 达成才现赏:按「达成时 tier」折实(实发额,不再随当前层级漂移);含称号。
    rewardText:
      row.done && row.def.reward
        ? rewardTextAtTier(row.def.reward, quests.achievedTiers[row.def.id] ?? 1)
        : "",
  })),
);

const doneCount = computed(() => achievementRows.value.filter((row) => row.done).length);
const nearestAchievements = computed(() => nearestAchievementRows(achievementRows.value, 3));
const achievementLeadDescription = computed(() =>
  nearestAchievements.value.length > 0
    ? "先做最近的一枚；点它，落到对应功名榜牌与条目。"
    : "全谱已成，往后的路只看你怎么走。",
);

/**
 * 成就按「方向」分组:组头先报这一路的进度与最近一枚,组内未达成者按完成比例
 * 置顶,已达成者落到后面回看。组序先把还没走完的路放前面,再按最近完成比例排。
 */
const achievementGroups = computed(() => {
  const map = new Map<string, { direction: string; rows: typeof achievementRows.value }>();
  for (const row of achievementRows.value) {
    const g = map.get(row.direction) ?? { direction: row.direction, rows: [] };
    g.rows.push(row);
    map.set(row.direction, g);
  }
  return [...map.values()]
    .map((g) => {
      const rows = [...g.rows].sort(
        (a, b) =>
          Number(a.done) - Number(b.done) ||
          b.ratio - a.ratio ||
          (a.gap ?? Number.MAX_SAFE_INTEGER) - (b.gap ?? Number.MAX_SAFE_INTEGER) ||
          a.def.id.localeCompare(b.def.id),
      );
      return {
        direction: g.direction,
        rows,
        done: rows.filter((row) => row.done).length,
        total: rows.length,
        nearest: nearestAchievementRows(rows, 1)[0] ?? null,
      };
    })
    .sort(
      (a, b) =>
        Number(a.done === a.total) - Number(b.done === b.total) ||
        (b.nearest?.ratio ?? -1) - (a.nearest?.ratio ?? -1) ||
        b.done - a.done ||
        b.total - a.total,
    );
});

const openDirection = ref<string | null>(null);
const groupStateReady = ref(false);
watch(
  achievementGroups,
  (groups) => {
    if (!groupStateReady.value) {
      const nearestId = nearestAchievements.value[0]?.def.id;
      openDirection.value =
        groups.find((group) => group.nearest?.def.id === nearestId)?.direction ??
        groups[0]?.direction ??
        null;
      groupStateReady.value = true;
      return;
    }
    if (openDirection.value && !groups.some((group) => group.direction === openDirection.value)) {
      openDirection.value = groups[0]?.direction ?? null;
    }
  },
  { immediate: true },
);

function isGroupOpen(direction: string): boolean {
  return openDirection.value === direction;
}

function toggleGroup(direction: string): void {
  openDirection.value = openDirection.value === direction ? null : direction;
}

function groupBodyId(index: number): string {
  return `achievement-group-body-${index}`;
}

function revealAchievement(row: AchievementRow): void {
  openDirection.value = row.direction;
  void nextTick(() => {
    const target = document.querySelector<HTMLElement>(`[data-achievement-id="${row.def.id}"]`);
    target?.scrollIntoView({ block: "center", behavior: "smooth" });
  });
}

/** 九册的唯一装配在 ui/codex；本页只做柜屉、分批与呈现。 */
const collectionCats = computed<CodexCat[]>(() => collectionCodex());

/**
 * 未识的「???」至多铺这么多枚。
 *
 * 装备图鉴有 288 个模板 —— 全铺出来是二十屏的「?」墙,而每个 ? 都不带一点信息
 * (名字/品阶/描述全遮着),多铺一枚与少铺一枚读到的东西完全一样。故已收录的按批续开,
 * 未识的只铺前 UNKNOWN_CAP 枚(留出「还有很多格空着」的感觉),其余折成一枚「…+N」。
 */
const UNKNOWN_CAP = 24;
/**
 * 每柜只先摆一批已收条目。九册全收是 809 枚 chip,首帧全铺实测 1326 DOM;
 * 九柜各给 24 枚能把首帧压进预算;可见窗口最多两批,继续前翻时滑掉最早一批,
 * 九柜都翻到末页也不会让 DOM 随点击数无限增长,整份清单仍可前后逐批到达。
 */
const COLLECTION_RENDER_BATCH = 24;
const COLLECTION_RENDER_WINDOW = COLLECTION_RENDER_BATCH * 2;
const knownLimits = ref<Record<string, number>>({});
const visibleCats = computed(() =>
  collectionCats.value.map((cat) => {
    const known = cat.entries.filter((e) => e.stage >= 1);
    const unknown = cat.entries.filter((e) => e.stage < 1);
    const knownPage = listWindow(
      known,
      knownLimits.value[cat.key] ?? COLLECTION_RENDER_BATCH,
      COLLECTION_RENDER_WINDOW,
    );
    const hiddenNew = known
      .slice(knownPage.shown)
      .filter((entry) => quests.isEntryNew(cat.key, entry.id)).length;
    return {
      ...cat,
      knownVisible: knownPage.visible,
      unknownVisible: unknown.slice(0, UNKNOWN_CAP),
      knownStart: knownPage.start,
      knownShown: knownPage.shown,
      knownTotal: known.length,
      hiddenKnown: knownPage.hidden,
      hiddenNew,
      hiddenUnknown: Math.max(0, unknown.length - UNKNOWN_CAP),
    };
  }),
);

const collectionOverview = computed(() =>
  collectionProgressOverviewFromCodex(collectionCats.value, (key, id) =>
    quests.isEntryNew(key, id),
  ),
);
const collectionHasNew = computed(() => collectionOverview.value.newCount > 0);
const collectionCabinetCells = computed(() => {
  const byKey = new Map(visibleCats.value.map((cat) => [cat.key, cat]));
  return buildCollectionCabinetCells(collectionOverview.value.rows).map((cell) => {
    const cat = byKey.get(cell.key);
    return {
      ...cell,
      knownStart: cat?.knownStart ?? 0,
      knownShown: cat?.knownShown ?? 0,
      knownTotal: cat?.knownTotal ?? cell.known,
    };
  });
});
const collectionProgressByKey = computed(
  () => new Map(collectionOverview.value.rows.map((row) => [row.key, row])),
);

const gateRows = computed(() => [
  {
    id: "achievement" as const,
    mark: "名",
    label: "功名榜",
    short: "成就",
    hint: "最近三策、方向榜与达成赏",
    fact: `${doneCount.value}/${ACHIEVEMENTS.length}`,
    dot: false,
  },
  {
    id: "collection" as const,
    mark: "珍",
    label: "藏珍阁",
    short: "收藏",
    hint: "九柜、来源、条目与新得",
    fact:
      collectionOverview.value.newCount > 0
        ? `新 ${collectionOverview.value.newCount}`
        : `${collectionOverview.value.known}/${collectionOverview.value.total}`,
    dot: collectionHasNew.value,
  },
]);

function focusGate(index: number): void {
  const gate = gateRows.value[index];
  if (!gate) return;
  tab.value = gate.id;
  gateEls.value?.[index]?.focus();
}

function onGateKeydown(event: KeyboardEvent): void {
  const count = gateRows.value.length;
  const active = Math.max(
    0,
    gateRows.value.findIndex((gate) => gate.id === tab.value),
  );
  let target = -1;
  if (event.key === "ArrowRight") target = (active + 1) % count;
  else if (event.key === "ArrowLeft") target = (active - 1 + count) % count;
  else if (event.key === "Home") target = 0;
  else if (event.key === "End") target = count - 1;
  if (target < 0) return;
  event.preventDefault();
  focusGate(target);
}

const collectionAllComplete = computed(
  () =>
    collectionOverview.value.total > 0 &&
    collectionOverview.value.known >= collectionOverview.value.total,
);
const collectionLeadTitle = computed(() => {
  if (collectionOverview.value.newCount > 0) return "眼下新得";
  if (collectionOverview.value.known === 0) return "九柜待启";
  if (collectionAllComplete.value) return "九柜尽收";
  return "将满之柜";
});
const collectionLeadDescription = computed(() => {
  const overview = collectionOverview.value;
  if (overview.newCount > 0) {
    return `${overview.newRows.length} 柜有新得，共 ${overview.newCount} 枚；柜面朱记就是未看的那一格。`;
  }
  if (overview.total > 0 && overview.known >= overview.total) {
    return "九柜已无未识之物；抽开任一柜，回看这一路的来处。";
  }
  if (overview.known > 0) {
    return "先抽开将满的一柜；余柜的缺口与新得都写在柜面。";
  }
  return "先从历练、炼丹与奇缘里带回第一件，九柜会自己亮起来。";
});
const collectionLeadFact = computed(() =>
  collectionOverview.value.newCount > 0
    ? `${collectionOverview.value.newCount} 枚待看`
    : `${collectionOverview.value.known}/${collectionOverview.value.total} 已录`,
);

const selectedCollectionKey = ref<string | null>(null);
const collectionStateReady = ref(false);
watch(
  collectionOverview,
  (overview) => {
    const valid = new Set(overview.rows.map((row) => row.key));
    if (!collectionStateReady.value) {
      selectedCollectionKey.value = overview.initialOpenKeys[0] ?? overview.rows[0]?.key ?? null;
      collectionStateReady.value = true;
      return;
    }
    if (selectedCollectionKey.value && !valid.has(selectedCollectionKey.value)) {
      selectedCollectionKey.value = overview.initialOpenKeys[0] ?? overview.rows[0]?.key ?? null;
    }
  },
  { immediate: true },
);

const selectedCollectionCat = computed(
  () => visibleCats.value.find((cat) => cat.key === selectedCollectionKey.value) ?? null,
);
const collectionTrayTitle = computed(() => selectedCollectionCat.value?.name ?? "柜屉未开");
const collectionTrayHint = computed(() => {
  const cat = selectedCollectionCat.value;
  if (!cat) return "从左侧柜面点一枚柜格，抽开看这一册的来源与条目。";
  if (catComplete(cat)) return "此目已无未识之物 —— 见之者皆入册。";
  return cat.source;
});
const collectionTrayFact = computed(() => {
  const cat = selectedCollectionCat.value;
  if (!cat) return `${collectionOverview.value.known}/${collectionOverview.value.total} 已录`;
  const row = progressOf(cat.key);
  return row.complete ? "此柜尽收" : `还差 ${row.remaining} 枚`;
});

function progressOf(key: string): CollectionProgressRow {
  return (
    collectionProgressByKey.value.get(key) ?? {
      key,
      name: key,
      known: 0,
      total: 0,
      newCount: 0,
      ratio: 0,
      remaining: 0,
      complete: false,
    }
  );
}

function collectionCategoryBodyId(key: string): string {
  return `collection-category-body-${key}`;
}

function isCollectionCategoryOpen(key: string): boolean {
  return selectedCollectionKey.value === key;
}

function setCollectionCategoryOpen(key: string, open: boolean): void {
  if (open) selectedCollectionKey.value = key;
  else if (selectedCollectionKey.value === key) selectedCollectionKey.value = null;
}

function moreKnownLabel(cat: { hiddenKnown: number; hiddenNew: number }): string {
  const next = nextRevealCount(cat.hiddenKnown, COLLECTION_RENDER_BATCH);
  const fresh = cat.hiddenNew > 0 ? ` · 含新得 ${cat.hiddenNew}` : "";
  return `再看 ${next} 件 · 余 ${cat.hiddenKnown}${fresh}`;
}

function previousKnownLabel(cat: { knownShown: number; knownTotal: number }): string {
  return `前一批 ${previousListStep(cat.knownShown, cat.knownTotal, COLLECTION_RENDER_BATCH)} 件`;
}

function focusKnown(key: string, index = 0): void {
  void nextTick(() => {
    const entries = document.querySelectorAll<HTMLButtonElement>(
      `button[data-codex-entry="${key}"]`,
    );
    entries[Math.min(Math.max(0, index), entries.length - 1)]?.focus();
  });
}

function showMoreKnown(cat: { key: string; knownShown: number; knownTotal: number }): void {
  const shownBefore = cat.knownShown;
  const shownAfter = nextListLimit(shownBefore, cat.knownTotal, COLLECTION_RENDER_BATCH);
  knownLimits.value = {
    ...knownLimits.value,
    [cat.key]: shownAfter,
  };
  focusKnown(cat.key, firstNewVisibleIndex(shownBefore, shownAfter, COLLECTION_RENDER_WINDOW));
}

function showPreviousKnown(cat: { key: string; knownShown: number; knownTotal: number }): void {
  knownLimits.value = {
    ...knownLimits.value,
    [cat.key]: previousListLimit(cat.knownShown, cat.knownTotal, COLLECTION_RENDER_BATCH),
  };
  focusKnown(cat.key);
}

/**
 * 「这一目集齐了」:所有条目都至少到 stage 1(收没收藏 / 知没知道)。
 * 灵材谱(认知深浅)与悟道录(分支)也是同一把尺 —— 全体 entry.stage >= 1
 * 即「都认得/都见过」,对它们同样是圆满。空目不算集齐。
 */
function catComplete(cat: CodexCat): boolean {
  return cat.entries.length > 0 && cat.entries.every((e) => e.stage >= 1);
}

// ---- 详情弹窗 ----
// 脚注各类口径不同(旧七类记收录时日、灵材记照面回数、悟道记所属功法),
// 故由条目自带 foot,此处不再拼装
const detail = ref<{ catName: string; entry: CodexEntry } | null>(null);

function openDetail(cat: CodexCat, entry: CodexEntry): void {
  detail.value = { catName: cat.name, entry };
}
</script>
