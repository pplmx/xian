<template>
  <div class="folio-page folio-page--stack stagger-in">
    <FolioPageHeader
      class="titles-masthead"
      title="名号与灵兽"
      subtitle="一印佩名 · 一契伴行"
      back-to="character"
      back-label="人物"
      featured
    />

    <NameBeastSwitch v-model="tab" :choices="nameBeastChoices" class="folio-span-all" />

    <article class="name-beast-register folio-span-all" data-name-beast-register>
      <section
        v-show="tab === 'title'"
        id="title-panel"
        class="name-beast-tab"
        role="tabpanel"
        aria-labelledby="title-tab"
      >
        <section
          class="name-beast-register__chapter name-beast-ledger name-beast-focus"
          data-name-beast-chapter="focus"
          data-title-ledger
          data-name-beast-focus
          data-name-beast-book="title-focus"
          data-kind="title"
        >
          <FolioChapterHead
            data-name-beast-chapter-head
            index="壹"
            eyebrow="名号 · 当前与可追"
            title="此刻佩印"
            hint="佩印一枚入行藏 · 下一印按成就进度"
            :fact="`已藏 ${titleMeter.owned}/${titleMeter.total}`"
          />

          <div class="name-beast-focus__panels">
            <article class="name-beast-focus__panel" data-title-current>
              <span class="name-beast-focus__index" aria-hidden="true">今</span>
              <div class="name-beast-focus__content">
                <p class="name-beast-focus__label">
                  佩在身上
                  <span>{{ wornTitle?.state.label ?? "待佩" }}</span>
                </p>
                <template v-if="wornTitle">
                  <p class="name-beast-focus__line">
                    <strong>{{ wornTitle.def.name }}</strong>
                  </p>
                  <p class="name-beast-focus__copy">{{ wornTitle.def.desc }}</p>
                  <p v-if="wornTitle.modText" class="name-beast-focus__effect tabular">
                    {{ wornTitle.modText }}
                  </p>
                  <!--
                    得它的那一刻:与图鉴页脚同一份道历。此前称号只有个 id 数组,
                    玩家有一排功名,却分不出哪个是刚才得的、哪个是上一世挂着的。
                  -->
                  <p
                    v-if="wornTitle.momentText"
                    class="name-beast-focus__moment tabular"
                    data-title-moment
                  >
                    {{ wornTitle.momentText }}
                  </p>
                </template>
                <template v-else>
                  <p class="name-beast-focus__line"><strong>尚未佩印</strong></p>
                  <p class="name-beast-focus__copy">从名号谱里择一枚佩上，行藏只取当前这一印。</p>
                </template>
              </div>
            </article>

            <article v-if="nextTitle" class="name-beast-focus__panel" data-title-guide>
              <span class="name-beast-focus__index" aria-hidden="true">次</span>
              <div class="name-beast-focus__content">
                <p class="name-beast-focus__label">
                  下一顶名号
                  <span>按成就进度</span>
                </p>
                <p class="name-beast-focus__line">
                  <strong>{{ nextTitle.def.name }}</strong>
                  <span class="name-beast-focus__state">{{ nextTitle.progress.label }}</span>
                </p>
                <p class="name-beast-focus__copy">
                  名号获自「{{ nextTitle.source.name }}」 · {{ nextTitle.source.desc }}
                </p>
                <ProgressBar
                  class="name-beast-focus__progress"
                  :value="nextTitle.progress.ratio"
                  color="var(--color-cinnabar)"
                  :height="2"
                />
                <p v-if="nextTitle.progress.gap !== null" class="name-beast-focus__gap tabular">
                  尚差 {{ nextTitle.progress.gap }} —— 进度来自成就，不另算一套
                </p>
              </div>
            </article>

            <article v-else class="name-beast-focus__panel" data-title-guide>
              <span class="name-beast-focus__index" aria-hidden="true">次</span>
              <div class="name-beast-focus__content">
                <p class="name-beast-focus__label">下一顶名号</p>
                <p class="name-beast-focus__line"><strong>名号尽收</strong></p>
                <p class="name-beast-focus__copy">
                  {{ TITLES.length }} 顶名号皆已入谱，余下只在这一世的名下。
                </p>
              </div>
            </article>
          </div>
        </section>

        <section
          class="name-beast-register__chapter name-beast-ledger name-ledger"
          data-name-beast-chapter="index"
          data-name-beast-book="title-index"
          data-kind="title"
          :data-title-total="titleRows.length"
          :data-title-shown="titlePage.shown"
          :data-title-start="titlePage.start"
        >
          <FolioChapterHead
            data-name-beast-chapter-head
            index="贰"
            eyebrow="佩印与旧藏"
            title="名号谱"
            hint="佩印置顶 · 已藏次之 · 未得照写来路"
            :fact="`现看 ${titlePage.start + 1}–${titlePage.shown} · 共 ${titleRows.length} 顶`"
          />

          <div class="name-ledger__list">
            <article
              v-for="row in titlePage.visible"
              :key="row.def.id"
              :data-title-row="row.def.id"
              :data-title-state="row.state.state"
              tabindex="-1"
              class="name-ledger__entry name-ledger__entry--title"
            >
              <span class="name-ledger__mark" :data-state="row.state.state" aria-hidden="true">
                {{ row.state.mark }}
              </span>
              <div class="name-ledger__copy">
                <p class="name-ledger__line">
                  <span class="name-ledger__name">{{ row.def.name }}</span>
                  <span class="name-ledger__state">{{ row.state.label }}</span>
                </p>
                <p class="name-ledger__desc">{{ row.def.desc }}</p>
                <p v-if="row.owned && row.modText" class="name-ledger__effect tabular">
                  {{ row.modText }}
                </p>
                <p class="name-ledger__source">
                  名号获自「{{ row.source.name }}」<template v-if="!row.owned">
                    · {{ titleSourceProgressText(row) }}</template
                  >
                </p>
                <ProgressBar
                  v-if="!row.owned && row.progress.target !== null"
                  class="mt-1"
                  :value="row.progress.ratio"
                  color="var(--color-cinnabar)"
                  :height="1"
                />
              </div>
              <button
                v-if="row.owned"
                class="btn-ghost name-ledger__action shrink-0 !px-2.5 !py-1.5 !text-body"
                :aria-pressed="row.worn"
                @click="toggleTitle(row.def.id)"
              >
                {{ row.worn ? "卸下" : "佩戴" }}
              </button>
            </article>
          </div>

          <div v-if="titlePage.start > 0 || titlePage.hidden > 0" class="name-beast-pager">
            <button
              v-if="titlePage.start > 0"
              type="button"
              data-title-prev
              class="chip-ink !whitespace-normal text-center t-note text-ink-soft active:scale-95"
              :aria-label="previousTitleText()"
              @click="showPreviousTitles"
            >
              {{ previousTitleText() }}
            </button>
            <button
              v-if="titlePage.hidden > 0"
              type="button"
              data-title-more
              class="chip-ink !whitespace-normal text-center t-note text-cinnabar active:scale-95"
              :aria-label="moreTitleText()"
              :data-promised="titlePromise"
              @click="showMoreTitles"
            >
              {{ moreTitleText() }}
            </button>
          </div>
        </section>
      </section>

      <section
        v-show="tab === 'pet'"
        id="pet-panel"
        class="name-beast-tab"
        role="tabpanel"
        aria-labelledby="pet-tab"
      >
        <section
          class="name-beast-register__chapter name-beast-ledger name-beast-focus"
          data-name-beast-chapter="focus"
          data-pet-ledger
          data-name-beast-focus
          data-name-beast-book="pet-focus"
          data-kind="pet"
        >
          <FolioChapterHead
            data-name-beast-chapter-head
            index="壹"
            eyebrow="灵兽 · 同行与结缘"
            title="此刻相伴"
            hint="相伴一只入总案 · 加成取人物明细真值"
            :fact="`已契 ${petMeter.owned}/${petMeter.total}`"
          />

          <div class="name-beast-focus__panels">
            <article class="name-beast-focus__panel" data-pet-current>
              <span class="name-beast-focus__index" aria-hidden="true">伴</span>
              <div class="name-beast-focus__content">
                <p class="name-beast-focus__label">
                  身边这一只
                  <span>{{ activePet?.state.label ?? "无伴" }}</span>
                </p>
                <template v-if="activePet">
                  <p class="name-beast-focus__line">
                    <span
                      class="name-beast-focus__pet-icon"
                      :style="{ color: qualityDef(activePet.def.quality).color }"
                    >
                      <GameIcon :name="activePet.def.icon" :size="17" />
                    </span>
                    <!--
                      天品起盖一枚品阶阴文章 —— 与功法书目、法宝行卡、装备格同一枚
                      (见 ui/qualityTier 的注释:「稀有档另有 QualitySeal 角章作形状线索」)。
                      颜色是顺序标尺、章是离散标记:前者要比较,后者扫一眼就有。
                    -->
                    <strong>{{ activePet.def.name }}</strong>
                    <QualitySeal
                      v-if="isRareQuality(activePet.def.quality)"
                      :quality="activePet.def.quality"
                      :size="14"
                      class="shrink-0"
                      data-pet-quality-seal="active"
                    />
                    <span class="name-beast-focus__state">{{
                      qualityDef(activePet.def.quality).name
                    }}</span>
                  </p>
                  <p class="name-beast-focus__copy">{{ activePet.def.desc }}</p>
                  <!--
                    契语 —— 它对你说的那一句(见 data/petVows)。与上一行 flavor 分工不同:
                    上一行答「它是什么」,这一行答「它对你是什么样」。没登记契语的灵兽整段不出。
                  -->
                  <p v-if="activePet.vow" class="name-beast-focus__vow" data-pet-vow>
                    {{ activePet.vow }}
                  </p>
                  <p v-if="activePet.modText" class="name-beast-focus__effect tabular">
                    {{ activePet.modText }}
                  </p>
                  <p class="name-beast-focus__trait">
                    {{ activePet.personalityName }}
                    <span>{{ activePet.personalityDesc }}</span>
                    <template v-if="activePet.traitText">
                      · <span class="tabular">{{ activePet.traitText }}</span>
                    </template>
                  </p>
                </template>
                <template v-else>
                  <p class="name-beast-focus__line"><strong>尚无灵兽相伴</strong></p>
                  <p class="name-beast-focus__copy">从灵兽谱唤来一只，相伴加成随即进入人物总案。</p>
                </template>
              </div>
            </article>

            <article class="name-beast-focus__panel">
              <span class="name-beast-focus__index" aria-hidden="true">谱</span>
              <div class="name-beast-focus__content">
                <p class="name-beast-focus__label">结缘册</p>
                <p class="name-beast-focus__line">
                  <strong>{{ ownedPetCount }} / {{ PETS.length }}</strong>
                  <span>只已结缘</span>
                </p>
                <p class="name-beast-focus__copy">{{ CODEX_SOURCES.pet }}</p>
                <p v-if="!petsAllOwned" class="name-beast-focus__gap tabular">
                  尚余 {{ PETS.length - ownedPetCount }} 只未结缘
                </p>
                <p v-else class="name-beast-focus__gap name-beast-focus__gap--done">
                  灵兽尽收 · {{ cnNumber(PETS.length) }}只俱已结缘
                </p>
              </div>
            </article>
          </div>
        </section>

        <section
          class="name-beast-register__chapter name-beast-ledger name-ledger"
          data-name-beast-chapter="index"
          data-name-beast-book="pet-index"
          data-kind="pet"
          :data-pet-total="petRows.length"
          :data-pet-shown="petPage.shown"
          :data-pet-start="petPage.start"
        >
          <FolioChapterHead
            data-name-beast-chapter-head
            index="贰"
            eyebrow="已契与未逢"
            title="灵兽谱"
            hint="相伴置顶 · 已契次之 · 品阶降序"
            :fact="`现看 ${petPage.start + 1}–${petPage.shown} · 共 ${petRows.length} 只`"
          />

          <div class="name-ledger__list">
            <article
              v-for="row in petPage.visible"
              :key="row.def.id"
              :data-pet-row="row.def.id"
              :data-pet-state="row.state.state"
              tabindex="-1"
              class="name-ledger__entry pet-ledger__entry flex items-start justify-between gap-3 tinylens:flex-col tinylens:items-stretch tinylens:gap-2"
            >
              <div class="flex min-w-0 grow items-start gap-3">
                <span class="pet-ledger__mark" :data-state="row.state.state" aria-hidden="true">
                  <GameIcon
                    v-if="row.owned"
                    :name="row.def.icon"
                    :size="18"
                    :style="{ color: qualityDef(row.def.quality).color }"
                  />
                  <GameIcon v-else name="lock" :size="14" />
                </span>
                <div class="name-ledger__copy">
                  <template v-if="row.owned">
                    <p class="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                      <!-- 稀有档的形状线索:四十只同屏滚动,颜色相近的邻行挨得最近 -->
                      <QualitySeal
                        v-if="isRareQuality(row.def.quality)"
                        :quality="row.def.quality"
                        :size="14"
                        class="shrink-0"
                        data-pet-quality-seal="row"
                      />
                      <span
                        class="name-ledger__name"
                        :style="{ color: qualityDef(row.def.quality).color }"
                        >{{ row.def.name }}</span
                      >
                      <!-- 品阶文字:数值按品阶重配过,名字旁的「神品/仙品…」让品质与效果一眼可对(见 petQuality.spec 两条不变量) -->
                      <span
                        class="text-note tracking-[0.2em]"
                        :style="{ color: qualityDef(row.def.quality).color }"
                        >{{ qualityDef(row.def.quality).name }}</span
                      >
                      <span class="name-ledger__state">{{ row.state.label }}</span>
                    </p>
                    <p class="name-ledger__desc">{{ row.def.desc }}</p>
                    <p v-if="row.modText" class="name-ledger__effect tabular">
                      {{ row.modText }}
                    </p>
                    <!--
                      结缘的那一刻 —— 与称号「得它的那一刻」同一份道历(见 ui/codexMoment)。
                      转世会把灵兽清零,故谱上每一只都是这一世结的缘;但没有时间读数时,
                      二十只并排就分不出哪只是刚遇见的。
                    -->
                    <p v-if="row.momentText" class="name-ledger__moment tabular" data-pet-moment>
                      {{ row.momentText }}
                    </p>
                    <!-- 性格 + 数值并一行:定性的话之外还要给数(换不换这只伙伴,靠「更容易」三个字算不出来) -->
                    <p class="name-beast-ledger__trait">
                      {{ row.personalityName }}
                      <span>{{ row.personalityDesc }}</span>
                      <template v-if="row.traitText">
                        · <span class="tabular">{{ row.traitText }}</span>
                      </template>
                    </p>
                  </template>
                  <template v-else>
                    <p class="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                      <span class="name-ledger__name text-ink-faint">???</span>
                      <span class="name-ledger__state">尚未结缘</span>
                    </p>
                    <p class="name-ledger__desc">尚未结缘 · 来路见上方「结缘册」</p>
                  </template>
                </div>
              </div>
              <button
                v-if="row.owned"
                class="btn-ghost min-h-7 shrink-0 whitespace-nowrap !px-2.5 !py-1.5 !text-body tinylens:w-full"
                :aria-pressed="row.active"
                @click="togglePet(row.def.id)"
              >
                {{ row.active ? "暂别" : "唤来" }}
              </button>
            </article>
          </div>

          <div v-if="petPage.start > 0 || petPage.hidden > 0" class="name-beast-pager">
            <button
              v-if="petPage.start > 0"
              type="button"
              data-pet-prev
              class="chip-ink !whitespace-normal text-center t-note text-ink-soft active:scale-95"
              :aria-label="previousPetText()"
              @click="showPreviousPets"
            >
              {{ previousPetText() }}
            </button>
            <button
              v-if="petPage.hidden > 0"
              type="button"
              data-pet-more
              class="chip-ink !whitespace-normal text-center t-note text-cinnabar active:scale-95"
              :aria-label="morePetText()"
              :data-promised="petPromise"
              @click="showMorePets"
            >
              {{ morePetText() }}
            </button>
          </div>
        </section>
      </section>
    </article>
  </div>
</template>

<script setup lang="ts">
import "@/styles/pages/titles.css";
import { focusListRow } from "@/composables/useListFocus";
import { computed, nextTick, ref } from "vue";
import { useInventoryStore } from "@/stores/inventory";
import { usePlayerStore } from "@/stores/player";
import { useQuestsStore } from "@/stores/quests";
import { ACHIEVEMENTS } from "@/data/achievements";
import { TITLES } from "@/data/titles";
import { codexMomentText } from "@/ui/codexMoment";
import { PETS, petDef } from "@/data/pets";
import { petVow } from "@/data/petVows";
import { notify } from "@/core/notify";
import { PERSONALITY_NAMES, personalityDesc } from "@/core/petPersonality";
import type { StatMods } from "@/types";
import { petTraitText } from "@/ui/itemText";
import { qualityDef } from "@/data/qualities";
import { modsText } from "@/data/statNames";
import { CODEX_SOURCES } from "@/ui/codex";
import { cnNumber } from "@/utils/format";
import {
  firstNewVisibleIndex,
  listWindow,
  nextListLimit,
  nextRevealCount,
  previousListLimit,
  previousListStep,
} from "@/core/listRender";
import {
  nearestTitleProgressRows,
  titleProgressRows,
  type TitleProgressRow,
} from "@/core/titleProgress";
import FolioPageHeader from "@/components/common/FolioPageHeader.vue";
import ProgressBar from "@/components/common/ProgressBar.vue";
import GameIcon from "@/components/common/GameIcon.vue";
import QualitySeal from "@/components/common/QualitySeal.vue";
import { isRareQuality } from "@/ui/qualityTier";
import NameBeastSwitch from "@/components/common/NameBeastSwitch.vue";
import FolioChapterHead from "@/components/common/FolioChapterHead.vue";
import {
  nameBeastMeter,
  petEntryState,
  titleEntryState,
  type NameBeastChoice,
} from "@/ui/titlesDesk";
import { useRouteTab } from "@/composables/useRouteTab";
import { TITLES_CHAPTERS } from "@/ui/navigation";

const player = usePlayerStore();
const inventory = useInventoryStore();
const quests = useQuestsStore();

const tab = useRouteTab(TITLES_CHAPTERS, "title");

// ---- 名号 ----
const ownedCount = computed(
  () => TITLES.filter((def) => quests.titlesOwned.includes(def.id)).length,
);
/** 名号尽收:全齐才算(与标题计数同源,不另起一套判据) */
const titlesAllOwned = computed(() => ownedCount.value === TITLES.length && TITLES.length > 0);
const titleMeter = computed(() => nameBeastMeter(ownedCount.value, TITLES.length));

const maxQualityRank = computed(() =>
  inventory.items.reduce((max, item) => Math.max(max, qualityDef(item.quality).rank), 0),
);
const titleProgress = computed(() =>
  titleProgressRows(TITLES, ACHIEVEMENTS, {
    achieved: quests.achieved,
    counters: quests.counters,
    major: player.major,
    maxQualityRank: maxQualityRank.value,
  }),
);
const nextTitle = computed(
  () => nearestTitleProgressRows(titleProgress.value, new Set(quests.titlesOwned), 1)[0] ?? null,
);

/** 全量陈列:佩戴中 > 已拥有 > 未获得 */
const titleRows = computed(() => {
  const ownedSet = new Set(quests.titlesOwned);
  return titleProgress.value
    .map((row) => {
      const owned = ownedSet.has(row.def.id);
      const worn = player.titleId === row.def.id;
      return {
        ...row,
        owned,
        worn,
        modText: modsText(row.def.mods),
        state: titleEntryState({ owned, worn }),
        /*
         * 得它的那一刻 —— 与图鉴同一份道历(见 ui/codexMoment)。
         * 未到手的称号没有这一刻;旧档里已到手的也没有,那时 codexMomentText
         * 会照实说「早年收录」,不假装是这一世得的。
         */
        momentText: owned ? codexMomentText(quests.titleMoments[row.def.id]) : "",
      };
    })
    .sort((a, b) => Number(b.worn) - Number(a.worn) || Number(b.owned) - Number(a.owned));
});
const wornTitle = computed(() => titleRows.value.find((row) => row.worn) ?? null);

const TITLE_RENDER_BATCH = 12;
const TITLE_RENDER_WINDOW = TITLE_RENDER_BATCH * 2;
const titleLimit = ref(TITLE_RENDER_BATCH);
const titlePage = computed(() =>
  listWindow(titleRows.value, titleLimit.value, TITLE_RENDER_WINDOW),
);
/** 这一批真正放出多少件 —— 按钮文案与 data-promised 共用,不许各算一遍 */
const titlePromise = computed(() => nextRevealCount(titlePage.value.hidden, TITLE_RENDER_BATCH));

function moreTitleText(): string {
  const next = titlePromise.value;
  return `再看 ${next} 顶 · 余 ${titlePage.value.hidden}`;
}

function previousTitleText(): string {
  const step = previousListStep(titlePage.value.shown, titleRows.value.length, TITLE_RENDER_BATCH);
  return `前一批 ${step} 顶`;
}

function titleSourceProgressText(row: TitleProgressRow): string {
  const gap = row.progress.gap;
  return gap === null
    ? row.source.desc
    : `${row.source.desc} · ${row.progress.label} · 尚差 ${gap}`;
}

function showMoreTitles(): void {
  const shownBefore = titlePage.value.shown;
  const shownAfter = nextListLimit(shownBefore, titleRows.value.length, TITLE_RENDER_BATCH);
  titleLimit.value = shownAfter;
  focusListRow(
    "[data-title-row]",
    firstNewVisibleIndex(shownBefore, shownAfter, TITLE_RENDER_WINDOW),
  );
}

function showPreviousTitles(): void {
  titleLimit.value = previousListLimit(
    titlePage.value.shown,
    titleRows.value.length,
    TITLE_RENDER_BATCH,
  );
  focusListRow("[data-title-row]");
}

function toggleTitle(id: string): void {
  const unloading = player.titleId === id;
  player.setTitle(unloading ? null : id);
  titleLimit.value = TITLE_RENDER_BATCH;
  if (unloading) focusListRow("[data-title-row]");
  else focusListRowById("data-title-row", id);
}

// ---- 灵兽 ----
/** 相伴真值:read finalStats.breakdown 的「灵兽」行 —— 与人物页明细同源,不在本页另算一遍 */
const activePetMods = computed<StatMods | null>(() => {
  const row = player.finalStats.breakdown.find((r) => r.name === "灵兽");
  return row ? row.mods : null;
});

/** 已结缘的灵兽 id */
const ownedPetIds = computed(() => new Set(quests.collections.pet));
const ownedPetCount = computed(() => PETS.filter((p) => ownedPetIds.value.has(p.id)).length);
/** 全册尽收(与抬头计数同源) */
const petsAllOwned = computed(() => PETS.length > 0 && ownedPetCount.value === PETS.length);
const petMeter = computed(() => nameBeastMeter(ownedPetCount.value, PETS.length));

/** 全册陈列:当前相伴 → 已结缘 → 品阶降序;未结缘者也占位(盖成「???」) */
const petRows = computed(() =>
  PETS.map((def) => {
    const owned = ownedPetIds.value.has(def.id);
    const active = player.petId === def.id;
    return {
      def,
      owned,
      active,
      // 相伴中的显示放大后的真值(灵兽园 × 安抚,与人物页属性明细同源 —— 都是 finalStats 的「灵兽」行);
      // 其余仍为基础值 —— 按表里数字决定"该换哪只"不会与实战打架
      modText: modsText(def.id === player.petId ? (activePetMods.value ?? def.mods) : def.mods),
      /** 契语只在相伴面板露面,逐行长列表不铺(见 data/petVows 的注释) */
      vow: petVow(def.id),
      personalityName: PERSONALITY_NAMES[def.personality],
      personalityDesc: personalityDesc(def.personality),
      traitText: petTraitText(def),
      /** 结缘那一刻 —— 与称号同一份道历;未结缘的没有这一刻 */
      momentText: owned ? codexMomentText(quests.petMoments[def.id]) : "",
      state: petEntryState({ owned, active }),
    };
  }).sort(
    (a, b) =>
      Number(b.active) - Number(a.active) ||
      Number(b.owned) - Number(a.owned) ||
      qualityDef(b.def.quality).rank - qualityDef(a.def.quality).rank,
  ),
);
const activePet = computed(() => petRows.value.find((row) => row.active) ?? null);

const nameBeastChoices = computed<NameBeastChoice<"title" | "pet">[]>(() => {
  const titleNote = titlesAllOwned.value
    ? "名号尽收 · 全谱可回看"
    : nextTitle.value
      ? nextTitle.value.progress.gap === null
        ? `下一印「${nextTitle.value.def.name}」 · ${nextTitle.value.progress.label}`
        : `下一印「${nextTitle.value.def.name}」 · 尚差 ${nextTitle.value.progress.gap}`
      : "名号谱已无待取之印";
  const petNote = petsAllOwned.value
    ? "灵兽尽收 · 全谱可回看"
    : `已结缘 ${petMeter.value.owned}/${petMeter.value.total} · 尚余 ${
        petMeter.value.total - petMeter.value.owned
      }`;

  return [
    {
      id: "title",
      label: "名号",
      mark: "名",
      eyebrow: "名号 · 佩印",
      currentName: wornTitle.value?.def.name ?? "未佩名号",
      count: titleMeter.value.owned,
      total: titleMeter.value.total,
      ratio: titleMeter.value.ratio,
      note: titleNote,
      complete: titleMeter.value.complete,
      dot: !titleMeter.value.complete,
    },
    {
      id: "pet",
      label: "灵兽",
      mark: "兽",
      eyebrow: "灵兽 · 灵契",
      currentName: activePet.value?.def.name ?? "未伴灵兽",
      count: petMeter.value.owned,
      total: petMeter.value.total,
      ratio: petMeter.value.ratio,
      note: petNote,
      complete: petMeter.value.complete,
      dot: !petMeter.value.complete,
    },
  ];
});

const PET_RENDER_BATCH = 12;
const PET_RENDER_WINDOW = PET_RENDER_BATCH * 2;
const petLimit = ref(PET_RENDER_BATCH);
const petPage = computed(() => listWindow(petRows.value, petLimit.value, PET_RENDER_WINDOW));
/** 这一批真正放出多少件 —— 按钮文案与 data-promised 共用,不许各算一遍 */
const petPromise = computed(() => nextRevealCount(petPage.value.hidden, PET_RENDER_BATCH));

function morePetText(): string {
  const next = petPromise.value;
  return `再看 ${next} 只 · 余 ${petPage.value.hidden}`;
}

function previousPetText(): string {
  const step = previousListStep(petPage.value.shown, petRows.value.length, PET_RENDER_BATCH);
  return `前一批 ${step} 只`;
}

function showMorePets(): void {
  const shownBefore = petPage.value.shown;
  const shownAfter = nextListLimit(shownBefore, petRows.value.length, PET_RENDER_BATCH);
  petLimit.value = shownAfter;
  focusListRow("[data-pet-row]", firstNewVisibleIndex(shownBefore, shownAfter, PET_RENDER_WINDOW));
}

function showPreviousPets(): void {
  petLimit.value = previousListLimit(petPage.value.shown, petRows.value.length, PET_RENDER_BATCH);
  focusListRow("[data-pet-row]");
}

function togglePet(id: string): void {
  const parting = player.petId === id;
  player.setPet(parting ? null : id);
  petLimit.value = PET_RENDER_BATCH;
  if (parting) focusListRow("[data-pet-row]");
  else focusListRowById("data-pet-row", id);
  /*
   * 唤来那一下,它应你一声 —— 契语(见 data/petVows)在换伴的此刻说出口,
   * 而不是塞进灵兽谱的每一行。暂别不响:它只是退开半步,不是无话可说。
   */
  if (!parting) {
    const def = petDef(id);
    const vow = petVow(id);
    if (def && vow) notify(`「${def.name}」${vow}`, "info");
  }
}

function focusListRowById(attribute: "data-title-row" | "data-pet-row", id: string): void {
  void nextTick(() => {
    document.querySelector<HTMLElement>(`[${attribute}="${CSS.escape(id)}"]`)?.focus();
  });
}
</script>
