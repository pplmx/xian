<template>
  <div class="stagger-in space-y-4 px-4 pb-6 pt-4">
    <div class="flex items-center gap-2">
      <RouterLink
        to="/character"
        class="-my-1.5 py-1.5 text-[12px] text-ink-faint active:text-ink-soft"
        >← 人物</RouterLink
      >
      <span class="text-[11px] text-ink-faint">·</span>
      <!-- 抬头与人物页入口同名(藏珍与成就):这一页含「成就」一册,只叫「图鉴」就少了一半 -->
      <span class="text-[12px] text-ink-soft">藏珍与成就</span>
    </div>
    <!-- 页签(看过的「收藏」才挂新得点,见 tabRows) -->
    <InkTabs v-model="tab" :tabs="tabRows" />

    <!-- 成就 -->
    <template v-if="tab === 'achievement'">
      <SectionTitle
        title="成就"
        :hint="`${achievementCounts(achievementStateOf(quests.achieved)).done}/${ACHIEVEMENTS.length}`"
      />
      <div class="card-ink divide-y divide-ink/6 px-4">
        <div v-for="row in achievementRows" :key="row.id" class="flex items-center gap-3 py-2.5">
          <span
            class="grid h-6 w-6 shrink-0 place-items-center rounded-full border text-[11px] font-kai"
            :class="row.done ? 'border-gold-ink text-gold-ink' : 'border-ink/15 text-ink-faint'"
          >
            {{ row.done ? "成" : "未" }}
          </span>
          <div class="min-w-0">
            <p class="font-kai text-[12px]" :class="row.done ? 'text-ink' : 'text-ink-faint'">
              {{ row.name }}
            </p>
            <p class="truncate text-[10px] text-ink-faint">{{ row.desc }}</p>
            <!-- 达成才现赏:名目成时、所获同露 —— 称号是成就赏的大头,一颗不漏(见 rewardText 含 titleId) -->
            <p v-if="row.done && row.rewardText" class="text-[10px] text-qing tabular">
              {{ row.rewardText }}
            </p>
          </div>
        </div>
      </div>
      <p class="text-center text-[10px] text-ink-faint">功成之日,名目自现</p>
    </template>

    <!-- 收藏图鉴 -->
    <template v-else>
      <section v-for="cat in visibleCats" :key="cat.key">
        <SectionTitle :title="cat.name" :hint="cat.hint" />
        <!--
          未收录的条目只是一片「???」—— 得告诉玩家去哪儿找,否则这一册只能干瞪眼。
          全收齐的那一目,「去哪儿找」就没了意义,替换成石绿的「尽收」完成感
          —— 收集的圆满是这册自己该说的话。
        -->
        <p v-if="catComplete(cat)" class="mt-1 text-[10px] text-jade">
          <span class="chip-ink border-jade/60 text-[9px] text-jade">尽收</span>
          此目已无未识之物 —— 见之者皆入册
        </p>
        <p v-else class="mt-1 text-[10px] text-ink-faint">{{ cat.source }}</p>
        <div class="card-ink mt-2 flex flex-wrap gap-1.5 px-3.5 py-3">
          <template v-for="entry in cat.shown" :key="entry.id">
            <button
              v-if="entry.stage >= 1"
              class="chip-ink flex items-center gap-1 active:scale-95"
              :style="{ color: entry.color }"
              @click="openDetail(cat, entry)"
            >
              <!-- 灵兽册这类带 icon 的条目,已收录的 chip 前置一枚小章 —— 图鉴终于有貌 -->
              <GameIcon v-if="entry.icon" :name="entry.icon" :size="11" />
              {{ entry.name }}
              <span v-if="entry.badge" class="text-[9px] opacity-70">{{ entry.badge }}</span>
              <!--
                新得:收录时刻在「上次打开图鉴」之后才露这一枚(判据在 quests store,见 quests.spec)。
                刻意不覆盖的两类:灵材谱(认知深浅)与悟道录(分支阶段)不经 quests.collect(),
                collectedAt 无其时间戳、恒不挂 —— 它们是「深浅/已择」语义不是「新收录」,别误当漏标。
              -->
              <span
                v-if="quests.isEntryNew(cat.key, entry.id)"
                class="text-[9px] text-cinnabar animate-new-pop"
                >新</span
              >
            </button>
            <span
              v-else
              class="chip-ink border-ink/15 text-ink-faint"
              :title="`尚未收录 · ${cat.source}`"
              >???</span
            >
          </template>
          <!--
            未识者至多铺 UNKNOWN_CAP 枚:装备图鉴有 288 个模板,全铺出来是二十屏的「?」墙 ——
            而每个 ? 都不带一点信息(名字、品阶全遮着),只等于同一个数重复画。【多出来的折成一枚计数章。
          -->
          <span
            v-if="cat.hiddenUnknown"
            class="chip-ink border-ink/15 text-ink-faint"
            :title="`尚有 ${cat.hiddenUnknown} 件未收录`"
            >…+{{ cat.hiddenUnknown }}</span
          >
        </div>
      </section>
      <p class="text-center text-[10px] text-ink-faint">
        点已收录的条目可看详情 —— 灵材与悟道另分深浅,愈用愈明
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
        <p class="mt-3 whitespace-pre-line text-[13px] leading-relaxed text-ink-soft">
          {{ detail.entry.desc || "此物玄妙,难以言表。" }}
        </p>
        <p v-if="detail.entry.hint" class="mt-2 text-[11px] text-ink-faint">
          {{ detail.entry.hint }}
        </p>
        <div class="ink-divider my-3" />
        <p class="flex justify-between text-[11px]">
          <span class="text-ink-faint">{{ detail.entry.foot.label }}</span>
          <span class="tabular text-ink-soft">{{ detail.entry.foot.value }}</span>
        </p>
      </div>
    </BaseModal>
  </div>
</template>

<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from "vue";
import { useQuestsStore } from "@/stores/quests";
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
import { achievementCounts, achievementStateOf } from "@/core/engineUnlocks";
import { rewardText } from "@/core/progress";
import SectionTitle from "@/components/common/SectionTitle.vue";
import InkTabs from "@/components/common/InkTabs.vue";
import BaseModal from "@/components/common/BaseModal.vue";
import GameIcon from "@/components/common/GameIcon.vue";

const quests = useQuestsStore();

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

/**
 * 成就一律先以「???」示人,达成之后才现名目。
 *
 * 既然未达成的全都遮住,原先的 hidden 标记(未达成时整行不列出)就没了着落 ——
 * 它与寻常未达成者长得一模一样,却害得计数的分母(50)对不上列出的行数(48)。
 * 故此处不再筛除,五十个位子一个不少。
 */
const achievementRows = computed(() =>
  ACHIEVEMENTS.map((a) => {
    const done = quests.hasAchieved(a.id);
    return {
      id: a.id,
      done,
      name: done ? a.name : "???",
      // 名字成时自现,但方向要给:六十多个「???」不给方向,这一页就是白纸
      desc: done ? a.desc : `尚未达成 · 方向:${achievementDirection(a.cond)}`,
      // 达成才现赏:与名称同一披露节奏;rewardText 含称号(29/63 的大头),与发赏同一套换算
      rewardText: done && a.reward ? rewardText(a.reward) : "",
    };
  }).sort((a, b) => Number(b.done) - Number(a.done)),
);

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
      // 一律写成「历练际遇」,玩家会以为那条缘也能在随便哪个地界撞见
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
 * (名字/品阶/描述全遮着),多铺一枚与少铺一枚读到的东西完全一样。故已收录的照旧全列,
 * 未识的只铺前 UNKNOWN_CAP 枚(留出「还有很多格空着」的感觉),其余折成一枚「…+N」。
 */
const UNKNOWN_CAP = 24;
const visibleCats = computed(() =>
  collectionCats.value.map((cat) => {
    const known = cat.entries.filter((e) => e.stage >= 1);
    const unknown = cat.entries.filter((e) => e.stage < 1);
    return {
      ...cat,
      shown: [...known, ...unknown.slice(0, UNKNOWN_CAP)],
      hiddenUnknown: Math.max(0, unknown.length - UNKNOWN_CAP),
    };
  }),
);

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
