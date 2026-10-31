<template>
  <div class="folio-page folio-page--stack stagger-in collection-page">
    <FolioPageHeader
      title="藏 珍"
      subtitle="功名入谱 · 九册纳珍"
      back-to="character"
      back-label="人物"
      featured
    >
      <template #visual>
        <CollectionCabinet
          :cells="collectionCabinetCells"
          :achievement-done="doneCount"
          :achievement-total="ACHIEVEMENTS.length"
          :collection-known="collectionOverview.known"
          :collection-total="collectionOverview.total"
        />
      </template>
    </FolioPageHeader>

    <!-- 页签(看过的「收藏」才挂新得点,见 tabRows) -->
    <InkTabs v-model="tab" :tabs="tabRows" />

    <!-- 功名:一张卷首账 + 按方向收起的功名卷 -->
    <template v-if="tab === 'achievement'">
      <section class="achievement-briefing" data-achievement-hero>
        <LedgerHeader
          seal="名"
          eyebrow="功名状"
          title="成就谱"
          description="名称与条件不再藏着；做成一枚，记一枚。"
          :score-value="doneCount"
          :score-suffix="`/${ACHIEVEMENTS.length}`"
        />

        <div class="achievement-briefing__meter">
          <ProgressBar
            :value="doneCount / ACHIEVEMENTS.length"
            color="var(--color-jade)"
            :height="3"
          />
        </div>

        <div class="achievement-briefing__label">
          <p class="text-body">眼下可追</p>
          <span class="text-note">按完成比例</span>
        </div>

        <div v-if="nearestAchievements.length" class="achievement-briefing__targets">
          <button
            v-for="(row, index) in nearestAchievements"
            :key="row.def.id"
            type="button"
            class="achievement-target"
            :data-achievement-jump="row.def.id"
            :data-achievement-jump-direction="row.direction"
            :aria-label="`查看成就 ${row.def.name}`"
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

        <footer class="achievement-briefing__foot">
          <span>一路只开一卷</span>
          <span>点最近一枚，可落到目标卷目</span>
        </footer>
      </section>

      <section class="achievement-volumes">
        <SectionTitle title="功名卷目" hint="按方向收卷 · 条件全开" />
        <div class="achievement-volumes__list">
          <section
            v-for="(g, gi) in achievementGroups"
            :key="g.direction"
            class="achievement-volume"
            :data-achievement-group="g.direction"
          >
            <button
              type="button"
              class="achievement-volume__head"
              :data-achievement-group-toggle="g.direction"
              :aria-expanded="isGroupOpen(g.direction)"
              :aria-controls="groupBodyId(gi)"
              @click="toggleGroup(g.direction)"
            >
              <span class="achievement-volume__seal" aria-hidden="true">
                {{ achievementDirectionMark(g.direction) }}
              </span>
              <span class="achievement-volume__copy">
                <span class="achievement-volume__line">
                  <strong class="text-title">{{ g.direction }}</strong>
                  <span class="tabular">{{ g.done }}/{{ g.total }}</span>
                </span>
                <ProgressBar
                  :value="g.total > 0 ? g.done / g.total : 0"
                  color="var(--color-jade)"
                  :height="2"
                />
                <span class="achievement-volume__summary">
                  {{
                    g.done === g.total
                      ? "此路已尽，点开回看"
                      : g.nearest
                        ? `最近：${g.nearest.def.name} · ${g.nearest.label}`
                        : "尚无可量化目标"
                  }}
                </span>
              </span>
              <span
                class="achievement-volume__toggle"
                :class="{ 'is-open': isGroupOpen(g.direction) }"
                aria-hidden="true"
                >▾</span
              >
            </button>

            <div
              v-if="isGroupOpen(g.direction)"
              :id="groupBodyId(gi)"
              :data-achievement-group-body="g.direction"
              class="achievement-volume__body"
            >
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
                  <!-- 达成才现赏:名目成时、所获同露 —— 称号是成就赏的大头,一颗不漏(见 rewardText 含 titleId) -->
                  <p v-if="row.done && row.rewardText" class="achievement-entry__reward tabular">
                    {{ row.rewardText }}
                  </p>
                </div>
              </article>
            </div>
          </section>
        </div>
        <p class="collection-page__footnote">未达成也写明条件；卷目按方向收着，点开可逐条对账</p>
      </section>
    </template>

    <!-- 藏珍:先给九册总谱,再把册目收成可逐册翻看的藏珍格 -->
    <template v-else>
      <section class="collection-briefing" data-collection-hero>
        <LedgerHeader
          seal="珍"
          eyebrow="九册总谱"
          title="藏珍谱"
          :description="
            collectionOverview.newCount > 0
              ? `${collectionOverview.newRows.length} 册有新得，已展 ${openedNewCount} 册${
                  collectionOverview.newRows.length > openedNewCount
                    ? `；余 ${collectionOverview.newRows.length - openedNewCount} 册可展开。`
                    : '。'
                }`
              : collectionOverview.known > 0
                ? '先看将满的一册；余册收着，点开再翻。'
                : '九册尚未开册；点开一册，看来源与收录进度。'
          "
          :score-value="collectionOverview.known"
          :score-suffix="`/${collectionOverview.total}`"
        />

        <div class="collection-briefing__meter">
          <ProgressBar
            :value="
              collectionOverview.total > 0 ? collectionOverview.known / collectionOverview.total : 0
            "
            color="var(--color-jade)"
            :height="3"
          />
        </div>

        <div class="collection-briefing__label">
          <p class="text-body">{{ collectionOverview.newCount > 0 ? "眼下新得" : "将满之册" }}</p>
          <span class="text-note">
            {{
              collectionOverview.newCount > 0
                ? `${collectionOverview.newCount} 枚待看`
                : "按已录比例"
            }}
          </span>
        </div>

        <template v-if="collectionHighlights.length">
          <div
            class="collection-briefing__highlights grid grid-cols-[repeat(auto-fit,minmax(96px,1fr))]"
          >
            <button
              v-for="row in collectionHighlights"
              :key="row.key"
              type="button"
              class="collection-highlight"
              :class="{ 'is-new': row.newCount > 0, 'is-complete': row.complete }"
              :data-collection-jump="row.key"
              :aria-label="
                row.newCount > 0
                  ? `${row.name}，新得 ${row.newCount} 枚，已录 ${row.known}/${row.total}，点开查看`
                  : `${row.name}，已录 ${row.known}/${row.total}，还差 ${row.remaining} 枚，点开查看`
              "
              @click="revealCollectionCategory(row.key)"
            >
              <span class="collection-highlight__top">
                <span class="collection-highlight__mark" aria-hidden="true">
                  {{ collectionCategoryMark(row.key) }}
                </span>
                <span class="collection-highlight__name text-title">{{ row.name }}</span>
                <span class="collection-highlight__arrow" aria-hidden="true">›</span>
              </span>
              <span class="collection-highlight__reading">
                <span v-if="row.newCount > 0" class="is-new tabular">新 {{ row.newCount }}</span>
                <span v-else class="is-short tabular">还差 {{ row.remaining }}</span>
                <span class="tabular">{{ row.known }}/{{ row.total }}</span>
              </span>
              <ProgressBar
                :value="row.ratio"
                :color="row.newCount > 0 ? 'var(--color-cinnabar)' : 'var(--color-qing)'"
                :height="2"
              />
            </button>
          </div>
          <button
            v-if="collectionMoreNewCount > 0"
            type="button"
            class="collection-briefing__more"
            data-collection-more-new
            :aria-expanded="collectionMoreNewOpen"
            :aria-label="
              collectionMoreNewOpen
                ? `另有 ${collectionMoreNewCount} 册新得已展开，点按收起`
                : `另有 ${collectionMoreNewCount} 册新得未列于此，点按一并展开`
            "
            :aria-controls="
              collectionMoreNewRows.map((row) => collectionCategoryBodyId(row.key)).join(' ')
            "
            @click="toggleRemainingNewCategories"
          >
            <span>
              {{
                collectionMoreNewOpen
                  ? `另有 ${collectionMoreNewCount} 册新得已展开`
                  : `另有 ${collectionMoreNewCount} 册新得未列于此`
              }}
            </span>
            <span class="is-action">
              {{ collectionMoreNewOpen ? "收起余册" : "展开余册 →" }}
            </span>
          </button>
        </template>
        <p v-else-if="collectionOverview.known > 0" class="collection-briefing__empty is-jade">
          已开之册皆尽收，余册待你从历练、炼丹与奇缘里启封。
        </p>
        <p v-else class="collection-briefing__empty">
          先从历练、炼丹与奇缘里带回第一件，九册会自己亮起来。
        </p>

        <footer class="collection-briefing__foot">
          <span>新得先看</span>
          <span>无新得时，先翻将满之册</span>
        </footer>
      </section>

      <section class="collection-shelves">
        <SectionTitle
          title="九册藏珍"
          :hint="`${collectionOverview.known}/${collectionOverview.total} 已录`"
        />
        <div class="collection-shelves__list">
          <section
            v-for="cat in visibleCats"
            :key="cat.key"
            class="collection-volume"
            :data-collection-category="cat.key"
            :data-collection-start="cat.knownStart"
            :data-collection-shown="cat.knownShown"
            :data-collection-total="cat.knownTotal"
          >
            <button
              type="button"
              class="collection-volume__head"
              :data-collection-category-toggle="cat.key"
              :aria-expanded="isCollectionCategoryOpen(cat.key)"
              :aria-controls="collectionCategoryBodyId(cat.key)"
              @click="toggleCollectionCategory(cat.key)"
            >
              <span
                class="collection-volume__seal"
                :class="{ 'is-complete': progressOf(cat.key).complete }"
                aria-hidden="true"
              >
                {{ collectionCategoryMark(cat.key) }}
              </span>
              <span class="collection-volume__copy">
                <span class="collection-volume__line">
                  <span class="collection-volume__name text-title">
                    {{ cat.name }}
                    <span
                      v-if="progressOf(cat.key).newCount > 0"
                      class="collection-volume__new tabular"
                      >新 {{ progressOf(cat.key).newCount }}</span
                    >
                  </span>
                  <span class="collection-volume__count tabular">
                    {{ progressOf(cat.key).known }}/{{ progressOf(cat.key).total }}
                  </span>
                </span>
                <ProgressBar
                  :value="progressOf(cat.key).ratio"
                  :color="
                    progressOf(cat.key).complete ? 'var(--color-jade)' : 'var(--color-cinnabar)'
                  "
                  :height="2"
                />
                <span class="collection-volume__summary">
                  {{ collectionCategorySummary(cat.key) }}
                </span>
              </span>
              <span
                class="collection-volume__toggle"
                :class="{ 'is-open': isCollectionCategoryOpen(cat.key) }"
                aria-hidden="true"
                >▾</span
              >
            </button>

            <div :id="collectionCategoryBodyId(cat.key)" :data-collection-category-body="cat.key">
              <div v-if="isCollectionCategoryOpen(cat.key)" class="collection-volume__body">
                <!--
                  未收录的条目只是一片「???」—— 得告诉玩家去哪儿找,否则这一册只能干瞪眼。
                  全收齐的那一目,「去哪儿找」就没了意义,替换成石绿的「尽收」完成感。
                -->
                <p v-if="catComplete(cat)" class="collection-volume__source is-complete">
                  <span>尽收</span>
                  此目已无未识之物 —— 见之者皆入册
                </p>
                <p v-else class="collection-volume__source">
                  {{ cat.source }}
                </p>

                <div class="collection-volume__entries">
                  <template v-for="entry in cat.knownVisible" :key="entry.id">
                    <button
                      class="collection-token"
                      :style="{ color: entry.color }"
                      :data-codex-entry="cat.key"
                      :data-codex-id="entry.id"
                      @click="openDetail(cat, entry)"
                    >
                      <!-- 灵兽册这类带 icon 的条目,已收录的 chip 前置一枚小章 —— 图鉴终于有貌 -->
                      <GameIcon v-if="entry.icon" :name="entry.icon" :size="11" />
                      <span class="collection-token__name">{{ entry.name }}</span>
                      <span v-if="entry.badge" class="collection-token__badge">{{
                        entry.badge
                      }}</span>
                      <!--
                        新得:收录时刻在「上次打开图鉴」之后才露这一枚(判据在 quests store,见 quests.spec)。
                        刻意不覆盖的两类:灵材谱(认知深浅)与悟道录(分支阶段)不经 quests.collect(),
                        collectedAt 无其时间戳、恒不挂 —— 它们是「深浅/已择」语义不是「新收录」,别误当漏标。
                      -->
                      <span
                        v-if="quests.isEntryNew(cat.key, entry.id)"
                        class="collection-token__new animate-new-pop"
                        >新</span
                      >
                    </button>
                  </template>

                  <!--
                    已收条目也会长到几百枚。每册先摆一批,余下的由玩家自己续开 ——
                    未识的 ??? 仍只铺 UNKNOWN_CAP,不跟着续开变成一堵无信息的问号墙。
                  -->
                  <div
                    v-if="cat.knownStart > 0 || cat.hiddenKnown > 0"
                    class="collection-volume__paging"
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
                      :data-promised="Math.min(COLLECTION_RENDER_BATCH, cat.hiddenKnown)"
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

                  <!--
                    未识者至多铺 UNKNOWN_CAP 枚:装备图鉴有 288 个模板,全铺出来是二十屏的「?」墙 ——
                    而每个 ? 都不带一点信息(名字、品阶全遮着),只等于同一个数重复画。多出来的折成一枚计数章。
                  -->
                  <span
                    v-if="cat.hiddenUnknown"
                    class="collection-token is-unknown is-more"
                    :title="`尚有 ${cat.hiddenUnknown} 件未收录`"
                    >…+{{ cat.hiddenUnknown }}</span
                  >
                </div>
              </div>
            </div>
          </section>
        </div>
        <p class="collection-page__footnote">
          点册目展开来源与条目;每册按批翻看,「再看 / 前一批」前后可达 —— 灵材与悟道另分深浅,愈用愈明
        </p>
      </section>
    </template>

    <!-- 图鉴详情 -->
    <BaseModal :open="detail !== null" :title="detail?.entry.name ?? ''" @close="detail = null">
      <div v-if="detail" class="collection-detail">
        <!-- 详情同查一件收录物,却有 icon 的条目(灵兽册等)只在收集 chip 上有、详情里整块丢了 ——
             补一枚色章做视觉锚(有 icon 才渲染,与丹房/材料详情同构) -->
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
import { computed, nextTick, onUnmounted, ref, watch } from "vue";
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
  COLLECTION_INITIAL_OPEN_MAX,
  collectionProgressOverviewFromCodex,
  type CollectionProgressRow,
} from "@/core/collectionProgress";
import { rewardTextAtTier } from "@/core/progress";
import {
  firstNewVisibleIndex,
  listWindow,
  nextListLimit,
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
import InkTabs from "@/components/common/InkTabs.vue";
import LedgerHeader from "@/components/common/LedgerHeader.vue";
import SectionTitle from "@/components/common/SectionTitle.vue";
import CollectionCabinet from "@/components/common/CollectionCabinet.vue";
import BaseModal from "@/components/common/BaseModal.vue";
import GameIcon from "@/components/common/GameIcon.vue";
import { useRouteTab } from "@/composables/useRouteTab";
import { COLLECTION_CHAPTERS } from "@/ui/navigation";

const quests = useQuestsStore();
const inventory = useInventoryStore();
const player = usePlayerStore();

const tab = useRouteTab(COLLECTION_CHAPTERS, "achievement");
// 「新得」清账时机 = 离开图鉴那一刻(与背包「新」同款:挂载清会把首帧「新」立刻抹掉)。
// 但默认页签是「成就」,「新得」角标只画在「收藏」页签里 —— 只看成就就离开的人
// 没看过收藏,界不该推进,否则收藏页从未亮过的「新」被整批抹平(评审 MEDIUM-1)。
// 故只有「这一进来切到过收藏页签」才在离开时记账。
const sawCollectionTab = ref(false);
watch(tab, (t) => {
  if (t === "collection") sawCollectionTab.value = true;
});
onUnmounted(() => {
  if (sawCollectionTab.value) quests.markCollectionSeen();
});
const TABS = COLLECTION_CHAPTERS;

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

/** 九册的唯一装配在 ui/codex；本页只做展开、分批与呈现。 */
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
 * 每册只先摆一批已收条目。九册全收是 809 枚 chip,首帧全铺实测 1326 DOM;
 * 九册各给 24 枚能把首帧压进预算;可见窗口最多两批,继续前翻时滑掉最早一批,
 * 九册都翻到末页也不会让 DOM 随点击数无限增长,整份清单仍可前后逐批到达。
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
const collectionCabinetCells = computed(() =>
  buildCollectionCabinetCells(collectionOverview.value.rows),
);
const collectionProgressByKey = computed(
  () => new Map(collectionOverview.value.rows.map((row) => [row.key, row])),
);
const collectionHighlights = computed<CollectionProgressRow[]>(() => {
  const rows =
    collectionOverview.value.newRows.length > 0
      ? collectionOverview.value.newRows
      : collectionOverview.value.nearestRows;
  return rows.slice(0, COLLECTION_INITIAL_OPEN_MAX);
});
const collectionMoreNewRows = computed(() =>
  collectionOverview.value.newRows.slice(COLLECTION_INITIAL_OPEN_MAX),
);
const collectionMoreNewCount = computed(() => collectionMoreNewRows.value.length);

const openCollectionKeys = ref<Set<string>>(new Set());
const openedNewCount = computed(
  () =>
    collectionOverview.value.newRows.filter((row) => openCollectionKeys.value.has(row.key)).length,
);
const collectionMoreNewOpen = computed(
  () =>
    collectionMoreNewRows.value.length > 0 &&
    collectionMoreNewRows.value.every((row) => openCollectionKeys.value.has(row.key)),
);
const collectionStateReady = ref(false);
watch(
  collectionOverview,
  (overview) => {
    const valid = new Set(overview.rows.map((row) => row.key));
    if (!collectionStateReady.value) {
      openCollectionKeys.value = new Set(overview.initialOpenKeys);
      collectionStateReady.value = true;
      return;
    }
    openCollectionKeys.value = new Set(
      [...openCollectionKeys.value].filter((key) => valid.has(key)),
    );
  },
  { immediate: true },
);

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
  return openCollectionKeys.value.has(key);
}

function setCollectionCategoryOpen(key: string, open: boolean): void {
  const next = new Set(openCollectionKeys.value);
  if (open) next.add(key);
  else next.delete(key);
  openCollectionKeys.value = next;
}

function toggleCollectionCategory(key: string): void {
  setCollectionCategoryOpen(key, !isCollectionCategoryOpen(key));
}

function revealCollectionCategory(key: string): void {
  setCollectionCategoryOpen(key, true);
  void nextTick(() => {
    const target = document.querySelector<HTMLElement>(
      `[data-collection-category-toggle="${CSS.escape(key)}"]`,
    );
    target?.scrollIntoView({ block: "center", behavior: "smooth" });
  });
}

function toggleRemainingNewCategories(): void {
  const rows = collectionMoreNewRows.value;
  if (rows.length === 0) return;
  if (collectionMoreNewOpen.value) {
    const next = new Set(openCollectionKeys.value);
    for (const row of rows) next.delete(row.key);
    openCollectionKeys.value = next;
    void nextTick(() => {
      document.querySelector<HTMLElement>("[data-collection-more-new]")?.focus();
    });
    return;
  }
  openCollectionKeys.value = new Set([...openCollectionKeys.value, ...rows.map((row) => row.key)]);
  void nextTick(() => {
    const target = document.querySelector<HTMLElement>(
      `[data-collection-category-toggle="${CSS.escape(rows[0]!.key)}"]`,
    );
    target?.scrollIntoView({ block: "center", behavior: "smooth" });
    target?.focus({ preventScroll: true });
  });
}

function collectionCategorySummary(key: string): string {
  const row = progressOf(key);
  if (row.complete) return "此册已尽，点开回看";
  if (row.newCount > 0) return `新得 ${row.newCount} 枚 · 点开先看这一册`;
  if (row.known === 0) return "尚未开册 · 点开看来源";
  return `还差 ${row.remaining} 枚 · 点开看来源`;
}

function moreKnownLabel(cat: { hiddenKnown: number; hiddenNew: number }): string {
  const next = Math.min(COLLECTION_RENDER_BATCH, cat.hiddenKnown);
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

/** 收藏册里还有「新得」没看过 —— 图鉴默认落在「成就」页,不切进去也看不见有货,门口先亮一点 */
const collectionHasNew = computed(() =>
  collectionCats.value.some((cat) => cat.entries.some((e) => quests.isEntryNew(cat.key, e.id))),
);

/**
 * 「这一目集齐了」:所有条目都至少到 stage 1(收没收藏 / 知没知道)。
 * 灵材谱(认知深浅)与悟道录(分支)也是同一把尺 —— 全体 entry.stage >= 1
 * 即「都认得/都见过」,对它们同样是圆满。空目不算集齐。
 */
function catComplete(cat: CodexCat): boolean {
  return cat.entries.length > 0 && cat.entries.every((e) => e.stage >= 1);
}
/** 页签行:在「收藏」上挂新得点(呼吸提醒),看过则隐 —— 与 CelestialView 的 exped 同款 */
const tabRows = computed(() =>
  TABS.map((t) => ({ ...t, dot: t.id === "collection" && collectionHasNew.value })),
);

// ---- 详情弹窗 ----
// 脚注各类口径不同(旧七类记收录时日、灵材记照面回数、悟道记所属功法),
// 故由条目自带 foot,此处不再拼装
const detail = ref<{ catName: string; entry: CodexEntry } | null>(null);

function openDetail(cat: CodexCat, entry: CodexEntry): void {
  detail.value = { catName: cat.name, entry };
}
</script>
