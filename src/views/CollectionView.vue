<template>
  <div class="folio-page folio-page--stack stagger-in collection-page">
    <!--
      compact:藏珍是全站正文最长的一页(实测 1485 字 / 3.3 屏)。
      卷首没有主视觉槽,故这一档在这里只起「副题收起」的作用 —— 那句
      「功名入榜 · 九柜纳珍」答的是「这一页是什么」,首屏先让给两扇门与柜面。
    -->
    <FolioPageHeader
      title="藏 珍"
      subtitle="功名入榜 · 九柜纳珍"
      back-to="character"
      back-label="人物"
      featured
      compact
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

          <!--
            这 16 路按什么排 —— 排序规则一直只在代码注释里,页上一个字没说。
            章首写着「按方向收榜」、榜牌上写着每路进度,可玩家看不出**方向之间**
            的顺序从哪来,那 16 枚读起来就是一堵墙。

            三条与 achievementGroups 的 sort 逐条对应(未走完的在前 → 最近完成比例
            高者在前 → 已成多者在前),不是另写一份说法。与门规、历练三档同归
            FolioNote:默认合着,要查时点开。
          -->
          <FolioNote name="collection-order" label="注 · 这十六路按什么排">
            <p class="collection-order__copy">
              先看还没走完的路，再按最近一枚的完成比例从高到低；已成多者在前。
              此路已尽的落到最后——那一行是回看，不是待办。
            </p>
          </FolioNote>

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

                  <AchievementEntry v-for="row in activeRowsOf(g)" :key="row.def.id" :row="row" />

                  <!--
                    一组只先铺一批「在追」。

                    此前是整组一次铺开:境界精进那组 21 行,新号打开藏珍页就有 19 行
                    同时进 DOM —— 那一组的第一行是「金丹得道」,而玩家还在炼气。
                    实测新号 `/collection` 2550px(3.02 屏),是全站最长的一页,
                    而这 1260px 里绝大多数是同一屏里互相挤位的「以后再说」。

                    与九柜、名号谱、法宝册同一条:先给一批,玩家显式续开再放下一批,
                    排序与整份清单仍留在数据层。收的是版面,不是内容 ——
                    逐行的条件、进度与赏格一条不少,只是不再同时铺在屏上。
                  -->
                  <button
                    v-if="groupHiddenOf(g) > 0"
                    type="button"
                    class="achievement-scroll__more"
                    :data-achievement-more="g.direction"
                    :data-promised="nextGroupBatchOf(g)"
                    @click="showMoreGroup(g)"
                  >
                    再看 {{ nextGroupBatchOf(g) }} 枚 · 余 {{ groupHiddenOf(g) }}
                  </button>

                  <!--
                    已达成收成一叠,默认合着。

                    一组里「在追」与「已成」原是同一条长队:境界精进那组 21 行,
                    其中 10 行是档案。玩家展开一组是来看「还差什么」,不是来数
                    已经拿过什么 —— 档案默认收起来,要看赏格再点开这一叠。
                    收的是版面,不是内容:每一行的条件、进度与赏格一项不少。
                  -->
                  <button
                    v-if="g.done > 0"
                    type="button"
                    class="achievement-scroll__done"
                    :aria-expanded="doneDirection === g.direction"
                    :aria-controls="doneBodyId(gi)"
                    data-achievement-done-toggle
                    @click="toggleDone(g.direction)"
                  >
                    <span class="achievement-scroll__done-count text-body tabular"
                      >已达成 {{ g.done }} 枚</span
                    >
                    <span class="achievement-scroll__done-hint">赏格与达成记录收在这一叠</span>
                    <span class="achievement-scroll__done-arrow" aria-hidden="true">{{
                      doneDirection === g.direction ? "▾" : "▸"
                    }}</span>
                  </button>
                  <div
                    v-show="doneDirection === g.direction"
                    :id="doneBodyId(gi)"
                    class="achievement-scroll__done-list"
                    data-achievement-done-list
                  >
                    <AchievementEntry v-for="row in doneRowsOf(g)" :key="row.def.id" :row="row" />
                  </div>
                </template>
              </section>
            </template>
            <p v-if="achievementGroups.length === 0" class="collection-page__empty">
              功名谱尚空，先去历练里留下第一笔。
            </p>
          </div>

          <p class="collection-page__footnote">
            未达成也写明条件；榜牌只开一路，最近三策可直接落到对应条目；已达成收成一叠，点开回看赏格。
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

          <!--
            九柜检索 —— 这一页的条目在千条以上（际遇一册就有 191 则），
            玩家要找「某件东西在哪一册」时此前只有一条路：逐册翻。

            检索**只搜已识条目**（见 ui/codexSearch）——未识的若能被搜出来，
            等于把「还没见过什么」提前告诉玩家，泄漏的是整个收集目标。
            命中后点一枚结果就直接打开那一册，不另做一张跨册混列表：
            这一页的版式是「选柜 → 开屉」，混列表会让玩家失去册的上下文。
          -->
          <div class="collection-search" data-collection-search>
            <label class="collection-search__label" for="collection-search-input">寻一名目</label>
            <input
              id="collection-search-input"
              v-model="searchQuery"
              type="search"
              class="collection-search__input text-[16px]"
              data-collection-search-input
              placeholder="输入名字或描述，如「寒潭」"
              autocomplete="off"
            />
            <p
              v-if="searchActive"
              class="collection-search__summary"
              data-collection-search-summary
            >
              <template v-if="searchHits.length">
                九柜里命中 {{ searchTotal }} 条，散在 {{ searchHits.length }} 册 —— 点一枚直开那册
              </template>
              <template v-else>九柜里没有已识的名目合得上「{{ searchQuery.trim() }}」。</template>
            </p>
            <ul
              v-if="searchHits.length"
              class="collection-search__hits"
              data-collection-search-hits
            >
              <li v-for="hit in searchHits" :key="hit.key">
                <button
                  type="button"
                  class="collection-search__hit tap-row"
                  :data-collection-search-hit="hit.key"
                  @click="jumpToSearchHit(hit)"
                >
                  <span class="collection-search__hit-cat">{{ hit.title }}</span>
                  <span class="collection-search__hit-count tabular">{{ hit.count }} 条</span>
                  <span class="collection-search__hit-names">{{
                    hit.entries
                      .slice(0, 3)
                      .map((e) => e.name)
                      .join(" · ")
                  }}</span>
                </button>
              </li>
            </ul>
          </div>

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
          <!-- 品评 —— 这一档凭什么(见 data/qualityVerdicts);只在对得上品质的册目里出 -->
          <span v-if="detailVerdict" class="collection-detail__verdict" data-codex-verdict>{{
            detailVerdict
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
import { usePlayerStore } from "@/stores/player";
import { ACHIEVEMENTS } from "@/data/achievements";
import { peakQualityFromStores } from "@/ui/qualityPeakStores";
import { qualityVerdict } from "@/data/qualityVerdicts";
import { collectionCodex, type CodexCat, type CodexEntry } from "@/ui/codex";
import { searchCodex } from "@/ui/codexSearch";
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
import FolioPageHeader from "@/components/common/FolioPageHeader.vue";
import CollectionCabinet from "@/components/common/CollectionCabinet.vue";
import FolioChapterHead from "@/components/common/FolioChapterHead.vue";
import FolioNote from "@/components/common/FolioNote.vue";
import BaseModal from "@/components/common/BaseModal.vue";
import GameIcon from "@/components/common/GameIcon.vue";
import AchievementEntry from "@/components/collection/AchievementEntry.vue";
import { useRouteTab } from "@/composables/useRouteTab";
import { COLLECTION_CHAPTERS } from "@/ui/navigation";

const quests = useQuestsStore();
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
/*
 * 品质读数 —— 「持有过最高的那一件」,不是「此刻包里最高的那一件」。
 * 分解会把那一件从 items 里拿掉,就地 reduce 会让进度条倒退;
 * 而成就一旦解锁不会掉回,同一屏就会出现「已达成」与「0/6 尚未达成」并存。
 * 四类(装备/法宝/灵兽/功法)一起算,见 core/qualityPeak。
 */
const maxQualityRank = computed(() => peakQualityFromStores());

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

/**
 * 「已达成」那一叠的展开态 —— 与方向卷目分开记账。
 *
 * 展开一组是来看「还差什么」的:达成行是档案,默认合着;换一组时也不继承
 * 上一组的展开态,免得点开另一路时底下忽然多出十几行旧账。
 */
const doneDirection = ref<string | null>(null);

type AchievementGroupRow = {
  direction: string;
  rows: AchievementRow[];
  done: number;
  total: number;
  nearest: AchievementRow | null;
};

/**
 * 一组「在追」的分批窗口。
 *
 * 与九柜(COLLECTION_RENDER_BATCH)同一条纪律:一次只铺一批,玩家显式续开再放下一批。
 * 展开态换组时把窗口也归零 —— 换一路是来看**那一路**还差什么,不该继承上一路翻到第几批。
 */
const ACHIEVEMENT_GROUP_BATCH = 8;
const groupLimits = ref<Record<string, number>>({});

function activeRowsOf(group: AchievementGroupRow): AchievementRow[] {
  const active = group.rows.filter((row) => !row.done);
  const limit = groupLimits.value[group.direction] ?? ACHIEVEMENT_GROUP_BATCH;
  return active.slice(0, Math.max(ACHIEVEMENT_GROUP_BATCH, limit));
}

/** 这一组还有多少枚在追的没铺出来 */
function groupHiddenOf(group: AchievementGroupRow): number {
  return group.rows.filter((row) => !row.done).length - activeRowsOf(group).length;
}

/** 续开一次放几枚 —— 与一批同宽,不让末次开出一个奇怪的零头 */
function nextGroupBatchOf(group: AchievementGroupRow): number {
  return Math.min(ACHIEVEMENT_GROUP_BATCH, groupHiddenOf(group));
}

function showMoreGroup(group: AchievementGroupRow): void {
  const now = groupLimits.value[group.direction] ?? ACHIEVEMENT_GROUP_BATCH;
  groupLimits.value = {
    ...groupLimits.value,
    [group.direction]: now + ACHIEVEMENT_GROUP_BATCH,
  };
}

function doneRowsOf(group: AchievementGroupRow): AchievementRow[] {
  return group.rows.filter((row) => row.done);
}

function toggleDone(direction: string): void {
  doneDirection.value = doneDirection.value === direction ? null : direction;
}

function doneBodyId(index: number): string {
  return `achievement-done-body-${index}`;
}

function toggleGroup(direction: string): void {
  openDirection.value = openDirection.value === direction ? null : direction;
  doneDirection.value = null;
  // 换一路就回到首批 —— 展开一组是来看那一路还差什么,不是接着上一路翻
  groupLimits.value = {};
}

function groupBodyId(index: number): string {
  return `achievement-group-body-${index}`;
}

function revealAchievement(row: AchievementRow): void {
  openDirection.value = row.direction;
  doneDirection.value = null;
  /*
   * 跳过去之前先把窗口开到**那一行确实在 DOM 里**。
   *
   * 一组只先铺一批(ACHIEVEMENT_GROUP_BATCH),而「最近三策」可能指向第 9 行以后 ——
   * 那时 `[data-achievement-id]` 根本没渲染,scrollIntoView 拿 null 静默跳过,
   * 玩家点了「02 金丹得道」却什么都没发生,而且**没有任何报错**。
   * 故先按目标行在本组「在追」里的位次把窗口放大到够它出现,再滚过去。
   */
  const group = achievementGroups.value.find((g) => g.direction === row.direction);
  if (group) {
    const active = group.rows.filter((r) => !r.done);
    const index = active.findIndex((r) => r.def.id === row.def.id);
    if (index >= (groupLimits.value[row.direction] ?? ACHIEVEMENT_GROUP_BATCH)) {
      // 开窗开到这个位次上取整的那一批边界,不逐枚 +1 地开
      const batch = Math.ceil((index + 1) / ACHIEVEMENT_GROUP_BATCH) * ACHIEVEMENT_GROUP_BATCH;
      groupLimits.value = { ...groupLimits.value, [row.direction]: batch };
    }
  }
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
 * 每柜只先摆一批已收条目。九册全收是 835 枚 chip(装备 288 + 悟道 155 + 事件 115
 * + 功法 70 + 丹药 69 + 法宝 46 + 灵兽 42 + 天赋 34 + 材料 16),首帧全铺实测 1326 DOM;
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

/**
 * 九柜检索 —— 装配好的九柜原样交给纯函数,视图只做接线。
 *
 * 输入用 `collectionCats`(已含 stage),故「只搜已识」这条口径只写在
 * `ui/codexSearch` 一处。
 */
const searchQuery = ref("");
const searchActive = computed(() => searchQuery.value.trim().length > 0);
const searchHits = computed(() => searchCodex(collectionCats.value, searchQuery.value));
const searchTotal = computed(() => searchHits.value.reduce((sum, hit) => sum + hit.count, 0));

/**
 * 点一枚结果 → 直接打开那一册。
 *
 * 不另做跨册混列表:这一页的版式是「选柜 → 开屉」,混列表会让玩家失去
 * 「这是哪一册」这个上下文,也就没法回到那一册继续看。
 */
function jumpToSearchHit(hit: { key: string }): void {
  selectedCollectionKey.value = hit.key;
}
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

/**
 * 藏珍详情的品评 —— 只在这条目真带品阶时出。
 *
 * `CodexEntry.quality` 是可选:九册里只有装备/法宝/丹药/灵兽/功法与悟道分支有档,
 * 灵材、见闻、成就没有。没有档的册子整句不出 —— 宁可少一行,
 * 也不要给「见闻志」硬安一句「山野之物」。
 */
const detailVerdict = computed(() => {
  const quality = detail.value?.entry.quality;
  return quality ? qualityVerdict(quality) : "";
});

function openDetail(cat: CodexCat, entry: CodexEntry): void {
  detail.value = { catName: cat.name, entry };
}
</script>
