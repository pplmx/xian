<template>
  <div class="stagger-in space-y-4 px-4 pb-6 pt-4">
    <div class="flex items-center gap-2">
      <RouterLink
        to="/character"
        class="-my-1.5 py-1.5 text-[11px] text-ink-faint active:text-ink-soft"
        >← 人物</RouterLink
      >
      <span class="text-[11px] text-ink-faint">·</span>
      <!-- 抬头与人物页入口同名(藏珍与成就):这一页含「成就」一册,只叫「图鉴」就少了一半 -->
      <span class="text-[11px] text-ink-soft">藏珍与成就</span>
    </div>
    <!-- 页签(看过的「收藏」才挂新得点,见 tabRows) -->
    <InkTabs v-model="tab" :tabs="tabRows" />

    <!-- 成就 -->
    <template v-if="tab === 'achievement'">
      <!--
        卷首先报「此刻」:整体走到哪、眼下哪三枚最近。
        名称与条件全部摊开,玩家才知道该往哪使劲;不再用一整墙「???」代替目标。
      -->
      <div class="card-ink mt-2 px-4 py-3" data-achievement-hero>
        <div class="flex items-end justify-between gap-3">
          <div class="min-w-0">
            <p class="font-kai text-[14px] tracking-[0.2em] text-ink">成就谱</p>
            <p class="mt-1 text-[10px] leading-relaxed text-ink-faint">
              名称与条件不再藏着；做成一枚，记一枚。
            </p>
          </div>
          <p class="shrink-0 font-kai text-[18px] text-cinnabar tabular">
            {{ doneCount
            }}<span class="text-[11px] text-ink-faint">/{{ ACHIEVEMENTS.length }}</span>
          </p>
        </div>
        <ProgressBar
          class="mt-2"
          :value="doneCount / ACHIEVEMENTS.length"
          color="var(--color-jade)"
          :height="3"
        />
        <div class="ink-divider-mark my-3" />
        <div class="flex items-baseline justify-between gap-2">
          <p class="font-kai text-[11px] tracking-widest text-ink-soft">眼下可追</p>
          <p class="text-[10px] text-ink-faint">按完成比例</p>
        </div>
        <div v-if="nearestAchievements.length" class="mt-1.5 space-y-1">
          <button
            v-for="row in nearestAchievements"
            :key="row.def.id"
            type="button"
            class="flex min-h-8 w-full items-start gap-2 rounded px-1.5 py-1.5 text-left active:bg-ink/5"
            :data-achievement-jump="row.def.id"
            :data-achievement-jump-direction="row.direction"
            :aria-label="`查看成就 ${row.def.name}`"
            @click="revealAchievement(row)"
          >
            <span
              class="mt-1 h-1.5 w-1.5 shrink-0 rounded-full"
              :class="row.ratio > 0 ? 'bg-cinnabar' : 'bg-ink/20'"
            />
            <span class="min-w-0 flex-1">
              <span
                class="flex items-baseline justify-between gap-2 tinylens:flex-col tinylens:items-start tinylens:gap-0"
              >
                <span class="truncate font-kai text-[11px] text-ink">{{ row.def.name }}</span>
                <span class="shrink-0 tabular text-[10px] text-qing">{{ row.label }}</span>
              </span>
              <span class="mt-0.5 block truncate text-[10px] text-ink-faint">{{
                row.def.desc
              }}</span>
            </span>
            <span class="mt-0.5 shrink-0 text-[10px] text-ink-faint" aria-hidden="true">›</span>
          </button>
        </div>
        <p v-else class="mt-2 text-[10px] text-jade">全谱已成，往后的路只看你怎么走。</p>
      </div>

      <div class="mt-3 space-y-2">
        <section
          v-for="(g, gi) in achievementGroups"
          :key="g.direction"
          class="card-ink overflow-hidden"
          :data-achievement-group="g.direction"
        >
          <button
            type="button"
            class="flex w-full items-start gap-3 px-4 py-3 text-left active:bg-ink/5"
            :data-achievement-group-toggle="g.direction"
            :aria-expanded="isGroupOpen(g.direction)"
            :aria-controls="groupBodyId(gi)"
            @click="toggleGroup(g.direction)"
          >
            <span class="min-w-0 flex-1">
              <span class="flex items-baseline justify-between gap-2">
                <span class="font-kai text-[14px] tracking-[0.2em] text-ink">{{
                  g.direction
                }}</span>
                <span class="shrink-0 tabular text-[11px] text-ink-faint"
                  >{{ g.done }}/{{ g.total }}</span
                >
              </span>
              <ProgressBar
                class="mt-1.5"
                :value="g.total > 0 ? g.done / g.total : 0"
                color="var(--color-jade)"
                :height="2"
              />
              <span class="mt-1 block truncate text-[10px] text-ink-faint">
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
              class="mt-0.5 shrink-0 text-[11px] transition-transform"
              :class="isGroupOpen(g.direction) ? 'rotate-180 text-cinnabar' : 'text-ink-faint'"
              aria-hidden="true"
              >▾</span
            >
          </button>
          <div
            v-if="isGroupOpen(g.direction)"
            :id="groupBodyId(gi)"
            :data-achievement-group-body="g.direction"
            class="border-t border-ink/6"
          >
            <div
              v-for="row in g.rows"
              :key="row.def.id"
              :data-achievement-id="row.def.id"
              class="flex items-start gap-3 border-b border-ink/6 px-4 py-2.5 last:border-b-0"
            >
              <span
                class="grid h-6 w-6 shrink-0 place-items-center rounded-full border text-[10px] font-kai"
                :class="
                  row.done
                    ? 'border-gold-ink text-gold-ink'
                    : row.target !== null
                      ? 'border-cinnabar/40 text-cinnabar'
                      : 'border-ink/15 text-ink-faint'
                "
              >
                {{ row.done ? "成" : row.percent === null ? "未" : `${row.percent}%` }}
              </span>
              <div class="min-w-0 flex-1">
                <div
                  class="flex items-baseline justify-between gap-2 tinylens:flex-col tinylens:items-start tinylens:gap-0.5"
                >
                  <p class="font-kai text-[11px]" :class="row.done ? 'text-ink' : 'text-ink-soft'">
                    {{ row.def.name }}
                  </p>
                  <span
                    class="shrink-0 tabular text-[10px]"
                    :class="row.done ? 'text-gold-ink' : 'text-qing'"
                    >{{ row.label }}</span
                  >
                </div>
                <p class="mt-0.5 text-[10px] leading-relaxed text-ink-faint">
                  {{ row.def.desc }}
                </p>
                <ProgressBar
                  v-if="!row.done && row.target !== null"
                  class="mt-1.5"
                  :value="row.ratio"
                  color="var(--color-cinnabar)"
                  :height="2"
                />
                <!-- 达成才现赏:名目成时、所获同露 —— 称号是成就赏的大头,一颗不漏(见 rewardText 含 titleId) -->
                <p v-if="row.done && row.rewardText" class="mt-0.5 text-[10px] text-qing tabular">
                  {{ row.rewardText }}
                </p>
              </div>
            </div>
          </div>
        </section>
      </div>
      <p class="text-center text-[10px] text-ink-faint">
        未达成也写明条件；卷目按方向收着，点开可逐条对账
      </p>
    </template>

    <!-- 收藏图鉴 -->
    <template v-else>
      <!--
        卷首先回答「哪一册值得现在打开」:有新得就最多先展开三册;
        没有新得就只展开最接近收齐的一册。余册收成题头,不再九册同时铺开。
      -->
      <div class="card-ink mt-2 px-4 py-3" data-collection-hero>
        <div class="flex items-end justify-between gap-3">
          <div class="min-w-0">
            <p class="font-kai text-[14px] tracking-[0.2em] text-ink">藏珍谱</p>
            <p class="mt-1 text-[10px] leading-relaxed text-ink-faint">
              {{
                collectionOverview.newCount > 0
                  ? `${collectionOverview.newRows.length} 册有新得，先展开 ${collectionOverview.initialOpenKeys.length} 册；余册收着。`
                  : collectionOverview.known > 0
                    ? "先看将满的一册；余册收着，点开再翻。"
                    : "九册尚未开册；点开一册，看来源与收录进度。"
              }}
            </p>
          </div>
          <p class="shrink-0 font-kai text-[18px] text-cinnabar tabular">
            {{ collectionOverview.known
            }}<span class="text-[11px] text-ink-faint">/{{ collectionOverview.total }}</span>
          </p>
        </div>
        <ProgressBar
          class="mt-2"
          :value="
            collectionOverview.total > 0 ? collectionOverview.known / collectionOverview.total : 0
          "
          color="var(--color-jade)"
          :height="3"
        />
        <div class="ink-divider-mark my-3" />
        <div class="flex items-baseline justify-between gap-2">
          <p class="font-kai text-[11px] tracking-widest text-ink-soft">
            {{ collectionOverview.newCount > 0 ? "眼下新得" : "将满之册" }}
          </p>
          <p class="text-[10px] text-ink-faint">
            {{
              collectionOverview.newCount > 0
                ? `${collectionOverview.newCount} 枚待看`
                : "按已录比例"
            }}
          </p>
        </div>
        <template v-if="collectionHighlights.length">
          <div class="mt-1.5 grid grid-cols-[repeat(auto-fit,minmax(96px,1fr))] gap-1.5">
            <button
              v-for="row in collectionHighlights"
              :key="row.key"
              type="button"
              class="flex min-h-[76px] min-w-0 flex-col rounded-md border border-ink/10 bg-paper-deep/40 px-2.5 py-2 text-left active:bg-ink/5"
              :data-collection-jump="row.key"
              :aria-label="
                row.newCount > 0
                  ? `${row.name}，新得 ${row.newCount} 枚，已录 ${row.known}/${row.total}，点开查看`
                  : `${row.name}，已录 ${row.known}/${row.total}，还差 ${row.remaining} 枚，点开查看`
              "
              @click="revealCollectionCategory(row.key)"
            >
              <span class="flex min-w-0 items-start justify-between gap-1">
                <span class="truncate font-kai text-[11px] tracking-[0.08em] text-ink">{{
                  row.name
                }}</span>
                <span class="mt-0.5 shrink-0 text-[10px] text-ink-faint" aria-hidden="true">›</span>
              </span>
              <span class="mt-auto flex min-w-0 items-baseline justify-between gap-1 pt-2">
                <span v-if="row.newCount > 0" class="shrink-0 tabular text-[10px] text-cinnabar"
                  >新 {{ row.newCount }}</span
                >
                <span v-else class="truncate tabular text-[10px] text-qing"
                  >还差 {{ row.remaining }}</span
                >
                <span class="shrink-0 tabular text-[10px] text-ink-faint">
                  {{ row.known }}/{{ row.total }}
                </span>
              </span>
              <ProgressBar
                class="mt-1.5"
                :value="row.ratio"
                :color="row.newCount > 0 ? 'var(--color-cinnabar)' : 'var(--color-qing)'"
                :height="2"
              />
            </button>
          </div>
          <button
            v-if="collectionMoreNewCount > 0"
            type="button"
            class="mt-2 flex w-full items-center justify-between gap-2 rounded-md border border-cinnabar/25 bg-cinnabar/5 px-2.5 py-2 text-left text-[10px] text-ink-faint active:bg-cinnabar/10"
            data-collection-more-new
            :aria-expanded="collectionMoreNewOpen"
            :aria-label="
              collectionMoreNewOpen
                ? `另有 ${collectionMoreNewCount} 册新得已展开，点按回到第一册`
                : `另有 ${collectionMoreNewCount} 册新得未列于此，点按一并展开`
            "
            :aria-controls="
              collectionMoreNewRows.map((row) => collectionCategoryBodyId(row.key)).join(' ')
            "
            @click="revealRemainingNewCategories"
          >
            <span>
              {{
                collectionMoreNewOpen
                  ? `另有 ${collectionMoreNewCount} 册新得已展开`
                  : `另有 ${collectionMoreNewCount} 册新得未列于此`
              }}
            </span>
            <span class="shrink-0 text-cinnabar">
              {{ collectionMoreNewOpen ? "已展开" : "展开 →" }}
            </span>
          </button>
        </template>
        <p v-else-if="collectionOverview.known > 0" class="mt-2 text-[10px] text-jade">
          已开之册皆尽收，余册待你从历练、炼丹与奇缘里启封。
        </p>
        <p v-else class="mt-2 text-[10px] text-ink-faint">
          先从历练、炼丹与奇缘里带回第一件，九册会自己亮起来。
        </p>
      </div>

      <div class="mt-3 space-y-2">
        <section
          v-for="cat in visibleCats"
          :key="cat.key"
          class="card-ink overflow-hidden"
          :data-collection-category="cat.key"
          :data-collection-start="cat.knownStart"
          :data-collection-shown="cat.knownShown"
          :data-collection-total="cat.knownTotal"
        >
          <button
            type="button"
            class="flex w-full items-start gap-3 px-4 py-3 text-left active:bg-ink/5"
            :data-collection-category-toggle="cat.key"
            :aria-expanded="isCollectionCategoryOpen(cat.key)"
            :aria-controls="collectionCategoryBodyId(cat.key)"
            @click="toggleCollectionCategory(cat.key)"
          >
            <span class="min-w-0 flex-1">
              <span class="flex items-baseline justify-between gap-2">
                <span class="flex min-w-0 items-center gap-1.5">
                  <span class="truncate font-kai text-[14px] tracking-[0.2em] text-ink">{{
                    cat.name
                  }}</span>
                  <span
                    v-if="progressOf(cat.key).newCount > 0"
                    class="chip-ink shrink-0 border-cinnabar/50 text-[10px] text-cinnabar"
                    >新 {{ progressOf(cat.key).newCount }}</span
                  >
                </span>
                <span class="shrink-0 tabular text-[11px] text-ink-faint">
                  {{ progressOf(cat.key).known }}/{{ progressOf(cat.key).total }}
                </span>
              </span>
              <ProgressBar
                class="mt-1.5"
                :value="progressOf(cat.key).ratio"
                :color="
                  progressOf(cat.key).complete ? 'var(--color-jade)' : 'var(--color-cinnabar)'
                "
                :height="2"
              />
              <span class="mt-1 block truncate text-[10px] text-ink-faint">
                {{ collectionCategorySummary(cat.key) }}
              </span>
            </span>
            <span
              class="mt-0.5 shrink-0 text-[11px] transition-transform"
              :class="
                isCollectionCategoryOpen(cat.key) ? 'rotate-180 text-cinnabar' : 'text-ink-faint'
              "
              aria-hidden="true"
              >▾</span
            >
          </button>
          <div :id="collectionCategoryBodyId(cat.key)" :data-collection-category-body="cat.key">
            <div v-if="isCollectionCategoryOpen(cat.key)" class="border-t border-ink/6">
              <!--
                未收录的条目只是一片「???」—— 得告诉玩家去哪儿找,否则这一册只能干瞪眼。
                全收齐的那一目,「去哪儿找」就没了意义,替换成石绿的「尽收」完成感。
              -->
              <p v-if="catComplete(cat)" class="px-4 pt-3 text-[10px] text-jade">
                <span class="chip-ink border-jade/60 text-[10px] text-jade">尽收</span>
                此目已无未识之物 —— 见之者皆入册
              </p>
              <p v-else class="px-4 pt-3 text-[10px] leading-relaxed text-ink-faint">
                {{ cat.source }}
              </p>
              <div class="flex flex-wrap gap-1.5 px-3.5 py-3">
                <template v-for="entry in cat.knownVisible" :key="entry.id">
                  <button
                    class="chip-ink flex items-center gap-1 active:scale-95"
                    :style="{ color: entry.color }"
                    :data-codex-entry="cat.key"
                    :data-codex-id="entry.id"
                    @click="openDetail(cat, entry)"
                  >
                    <!-- 灵兽册这类带 icon 的条目,已收录的 chip 前置一枚小章 —— 图鉴终于有貌 -->
                    <GameIcon v-if="entry.icon" :name="entry.icon" :size="11" />
                    {{ entry.name }}
                    <span v-if="entry.badge" class="text-[10px] text-ink-faint">{{
                      entry.badge
                    }}</span>
                    <!--
                      新得:收录时刻在「上次打开图鉴」之后才露这一枚(判据在 quests store,见 quests.spec)。
                      刻意不覆盖的两类:灵材谱(认知深浅)与悟道录(分支阶段)不经 quests.collect(),
                      collectedAt 无其时间戳、恒不挂 —— 它们是「深浅/已择」语义不是「新收录」,别误当漏标。
                    -->
                    <span
                      v-if="quests.isEntryNew(cat.key, entry.id)"
                      class="text-[10px] text-cinnabar animate-new-pop"
                      >新</span
                    >
                  </button>
                </template>
                <!--
                  已收条目也会长到几百枚。每册先摆一批,余下的由玩家自己续开 ——
                  未识的 ??? 仍只铺 UNKNOWN_CAP,不跟着续开变成一堵无信息的问号墙。
                -->
                <div v-if="cat.knownStart > 0 || cat.hiddenKnown > 0" class="flex gap-1">
                  <button
                    v-if="cat.knownStart > 0"
                    type="button"
                    class="chip-ink border-ink/25 !whitespace-normal text-center text-[10px] leading-relaxed text-ink-soft active:scale-95"
                    :data-collection-prev="cat.key"
                    :aria-label="previousKnownLabel(cat)"
                    @click="showPreviousKnown(cat)"
                  >
                    {{ previousKnownLabel(cat) }}
                  </button>
                  <button
                    v-if="cat.hiddenKnown > 0"
                    type="button"
                    class="chip-ink border-cinnabar/50 !whitespace-normal text-center text-[10px] leading-relaxed text-cinnabar active:scale-95"
                    :data-collection-more="cat.key"
                    :data-promised="Math.min(COLLECTION_RENDER_BATCH, cat.hiddenKnown)"
                    :aria-label="moreKnownLabel(cat)"
                    @click="showMoreKnown(cat)"
                  >
                    {{ moreKnownLabel(cat) }}
                  </button>
                </div>
                <template v-for="entry in cat.unknownVisible" :key="entry.id">
                  <span
                    class="chip-ink border-ink/15 text-ink-faint"
                    :title="`尚未收录 · ${cat.source}`"
                    >???</span
                  >
                </template>
                <!--
                  未识者至多铺 UNKNOWN_CAP 枚:装备图鉴有 288 个模板,全铺出来是二十屏的「?」墙 ——
                  而每个 ? 都不带一点信息(名字、品阶全遮着),只等于同一个数重复画。多出来的折成一枚计数章。
                -->
                <span
                  v-if="cat.hiddenUnknown"
                  class="chip-ink border-ink/15 text-ink-faint"
                  :title="`尚有 ${cat.hiddenUnknown} 件未收录`"
                  >…+{{ cat.hiddenUnknown }}</span
                >
              </div>
            </div>
          </div>
        </section>
      </div>
      <p class="text-center text-[10px] text-ink-faint">
        点册目展开来源与条目;每册按批翻看,「再看 / 前一批」前后可达 —— 灵材与悟道另分深浅,愈用愈明
      </p>
    </template>

    <!-- 图鉴详情 -->
    <BaseModal :open="detail !== null" :title="detail?.entry.name ?? ''" @close="detail = null">
      <div v-if="detail">
        <!-- 详情同查一件收录物,却有 icon 的条目(灵兽册等)只在收集 chip 上有、详情里整块丢了 ——
             补一枚色章做视觉锚(有 icon 才渲染,与丹房/材料详情同构) -->
        <div
          v-if="detail.entry.icon"
          class="mb-3 grid h-12 w-12 place-items-center rounded-md bg-ink/5"
        >
          <GameIcon
            :name="detail.entry.icon"
            :size="24"
            :style="{ color: detail.entry.color ?? 'var(--color-ink-soft)' }"
          />
        </div>
        <p class="flex flex-wrap items-center gap-2">
          <span
            class="chip-ink border-current"
            :style="{ color: detail.entry.color ?? 'var(--color-ink-soft)' }"
          >
            {{ detail.catName }}
          </span>
          <span v-if="detail.entry.stageName" class="chip-ink border-ink/20 text-ink-faint">{{
            detail.entry.stageName
          }}</span>
          <span v-if="detail.entry.meta" class="text-[11px] text-ink-faint">{{
            detail.entry.meta
          }}</span>
        </p>
        <p class="mt-3 whitespace-pre-line text-[14px] leading-relaxed text-ink-soft">
          {{ detail.entry.desc || "此物玄妙,难以言表。" }}
        </p>
        <p v-if="detail.entry.hint" class="mt-2 text-[11px] text-ink-faint">
          {{ detail.entry.hint }}
        </p>
        <div class="ink-divider-mark my-3" />
        <p class="flex justify-between text-[11px]">
          <span class="text-ink-faint">{{ detail.entry.foot.label }}</span>
          <span class="tabular text-ink-soft">{{ detail.entry.foot.value }}</span>
        </p>
      </div>
    </BaseModal>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onUnmounted, ref, watch } from "vue";
import { useQuestsStore } from "@/stores/quests";
import { useInventoryStore } from "@/stores/inventory";
import { usePlayerStore } from "@/stores/player";
import type { CollectionCategory } from "@/types";
import { ACHIEVEMENTS } from "@/data/achievements";
import { GONGFA } from "@/data/gongfa";
import { EVENTS } from "@/data/events";
import { chainOfEvent } from "@/data/chains";
import { TALENTS, TALENT_GRADE_COLORS } from "@/data/talents";
import { qualityDef } from "@/data/qualities";
import {
  CODEX_SOURCES,
  artifactCodex,
  branchCodex,
  collectedTimeText,
  equipCodex,
  materialCodex,
  petCodex,
  pillCodex,
  type CodexCat,
  type CodexEntry,
} from "@/ui/codex";
import { gongfaFuncText, gongfaMetaText } from "@/ui/itemText";
import { achievementDirection } from "@/ui/achievementHint";
import {
  achievementProgressRows,
  nearestAchievementRows,
  type AchievementProgressRow,
} from "@/core/achievementProgress";
import {
  COLLECTION_INITIAL_OPEN_MAX,
  collectionProgressOverview,
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
import ProgressBar from "@/components/common/ProgressBar.vue";
import InkTabs from "@/components/common/InkTabs.vue";
import BaseModal from "@/components/common/BaseModal.vue";
import GameIcon from "@/components/common/GameIcon.vue";

const quests = useQuestsStore();
const inventory = useInventoryStore();
const player = usePlayerStore();

type Tab = "achievement" | "collection";
const tab = ref<Tab>("achievement");
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
const TABS: { id: Tab; label: string }[] = [
  { id: "achievement", label: "成就" },
  { id: "collection", label: "收藏" },
];

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

/**
 * 原有七类只有"收没收录"两态,在此补齐 CodexEntry 的深度字段:
 * stage 1 即已收录,不设更深的层。深浅之别是灵材谱与悟道录才有的事。
 */
function makeCat(
  key: CollectionCategory,
  name: string,
  ownedIds: string[],
  defs: { id: string; name: string; desc?: string; meta?: string; color?: string; rank?: number }[],
): CodexCat {
  const owned = new Set(ownedIds);
  // 默认从好到差:品质 rank 降序(有品阶的一类喂 rank)→ 已收录置顶 → 原序
  // (没喂 rank 的一类同级里保住手排的叙事序,不按名字打乱)
  const rows = defs
    .map((d, idx) => ({
      idx,
      rank: d.rank ?? 0,
      entry: {
        id: d.id,
        name: d.name,
        desc: d.desc ?? "",
        meta: d.meta ?? "",
        color: d.color,
        stage: owned.has(d.id) ? 1 : 0,
        stageName: "",
        badge: "",
        hint: "",
        foot: { label: "收录时间", value: collectedTimeText(quests.collectedAt[`${key}:${d.id}`]) },
      },
    }))
    .sort((a, b) => b.rank - a.rank || b.entry.stage - a.entry.stage || a.idx - b.idx);
  const entries = rows.map((r) => r.entry);
  const known = entries.filter((e) => e.stage >= 1).length;
  return { key, name, hint: `${known}/${defs.length}`, source: CODEX_SOURCES[key], entries };
}

/**
 * 九类图鉴的排布。
 *
 * 悟道录紧随功法阁、灵材谱紧随丹方录 —— 各自与所属的那条线挨在一处,
 * 翻到功法就看得见它的岔路,翻到丹药就看得见炼它的料。
 */
const collectionCats = computed<CodexCat[]>(() => {
  const c = quests.collections;
  return [
    // 装备/法宝/丹药三类走带深浅的派生视图(见 ui/codex:收录深度一节),
    // 其余四类仍是「收没收录」两态,故共用 makeCat
    equipCodex(),
    makeCat(
      "gongfa",
      "功法阁",
      c.gongfa,
      GONGFA.map((g) => ({
        id: g.id,
        name: g.name,
        desc: [g.desc, gongfaFuncText(g)].filter(Boolean).join("\n"),
        meta: gongfaMetaText(g),
        color: qualityDef(g.quality).color,
        rank: qualityDef(g.quality).rank,
      })),
    ),
    branchCodex(),
    pillCodex(),
    materialCodex(),
    artifactCodex(),
    // 灵兽册走深浅派生视图:结缘之外还有「曾相伴/相伴中」两档相伴史(见 ui/codex 灵兽册)
    petCodex(),
    makeCat(
      "event",
      "见闻志",
      c.event,
      // 奇缘的阶段事件与普通际遇同表,但在见闻志里得各归各的名 ——
      // 奇缘标「奇缘」、普通际遇标「历练际遇」,免得玩家以为那条缘也能随便撞见
      EVENTS.map((e) => ({
        id: e.id,
        name: e.title,
        desc: e.text,
        meta: chainOfEvent(e.id) ? "奇缘" : "历练际遇",
      })),
    ),
    makeCat(
      "talent",
      "天赋鉴",
      c.talent,
      TALENTS.map((t) => ({
        id: t.id,
        name: t.name,
        desc: t.desc,
        meta: "先天之姿",
        color: TALENT_GRADE_COLORS[t.grade],
        rank: t.grade,
      })),
    ),
  ];
});

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
      newTotal: known.filter((entry) => quests.isEntryNew(cat.key, entry.id)).length,
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
  collectionProgressOverview(
    visibleCats.value.map((cat) => ({
      key: cat.key,
      name: cat.name,
      known: cat.knownTotal,
      total: cat.entries.length,
      newCount: cat.newTotal,
    })),
  ),
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

function revealRemainingNewCategories(): void {
  const rows = collectionMoreNewRows.value;
  if (rows.length === 0) return;
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
