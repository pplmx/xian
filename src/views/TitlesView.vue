<template>
  <div class="folio-page folio-page--stack stagger-in">
    <FolioPageHeader
      class="titles-masthead"
      title="名号与灵兽"
      subtitle="一印佩名 · 一契伴行"
      back-to="character"
      back-label="人物"
      featured
    >
      <template #visual>
        <NameBeastAtlas
          :title-name="wornTitle?.def.name ?? '未佩'"
          :title-count="`${ownedCount}/${TITLES.length}`"
          :title-ratio="titleMeter.ratio"
          :pet-name="activePet?.def.name ?? '未伴'"
          :pet-count="`${ownedPetCount}/${PETS.length}`"
          :pet-ratio="petMeter.ratio"
        />
      </template>
    </FolioPageHeader>

    <div class="name-beast-page folio-span-all">
      <InkTabs v-model="tab" :tabs="TABS" />

      <section v-if="tab === 'title'" class="name-beast-tab" role="tabpanel" aria-label="名号">
        <section class="name-beast-ledger" data-title-ledger data-kind="title">
          <header class="name-beast-ledger__head">
            <span class="name-beast-ledger__seal" aria-hidden="true">名</span>
            <div class="name-beast-ledger__identity">
              <p class="name-beast-ledger__eyebrow">名下之印</p>
              <h2 class="name-beast-ledger__title">名号总案</h2>
              <p class="name-beast-ledger__desc">
                一枚佩在身上，其余收进谱中；下一顶仍从成就进度里算。
              </p>
            </div>
            <p class="name-beast-ledger__score tabular">
              <span>已藏</span>
              <strong>{{ ownedCount }}</strong>
              <span>/ {{ TITLES.length }}</span>
            </p>
          </header>

          <div class="name-beast-ledger__grid">
            <article class="name-beast-ledger__panel" data-title-current>
              <p class="name-beast-ledger__label">此刻佩印</p>
              <template v-if="wornTitle">
                <p class="name-beast-ledger__line">
                  <strong>{{ wornTitle.def.name }}</strong>
                  <span>{{ wornTitle.state.label }}</span>
                </p>
                <p class="name-beast-ledger__copy">{{ wornTitle.def.desc }}</p>
                <p v-if="wornTitle.modText" class="name-beast-ledger__effect tabular">
                  {{ wornTitle.modText }}
                </p>
              </template>
              <template v-else>
                <p class="name-beast-ledger__line"><strong>未佩名号</strong></p>
                <p class="name-beast-ledger__copy">
                  从名号谱里择一枚佩上，行藏只取当前佩印这一份。
                </p>
              </template>
            </article>

            <article v-if="nextTitle" class="name-beast-ledger__panel" data-title-guide>
              <p class="name-beast-ledger__label">
                下一顶名号
                <span>按成就进度</span>
              </p>
              <p class="name-beast-ledger__line">
                <strong>{{ nextTitle.def.name }}</strong>
                <span>{{ nextTitle.progress.label }}</span>
              </p>
              <p class="name-beast-ledger__copy">
                名号获自「{{ nextTitle.source.name }}」 · {{ nextTitle.source.desc }}
              </p>
              <ProgressBar
                class="mt-2"
                :value="nextTitle.progress.ratio"
                color="var(--color-cinnabar)"
                :height="2"
              />
              <p v-if="nextTitle.progress.gap !== null" class="name-beast-ledger__gap tabular">
                尚差 {{ nextTitle.progress.gap }} —— 进度来自成就，不另算一套
              </p>
            </article>

            <article v-else class="name-beast-ledger__panel">
              <p class="name-beast-ledger__label">下一顶名号</p>
              <p class="name-beast-ledger__line"><strong>此谱已尽</strong></p>
              <p class="name-beast-ledger__copy">名号都已入谱，余下只在这一世的名下。</p>
            </article>
          </div>

          <footer class="name-beast-ledger__foot">
            <div class="min-w-0 flex-1">
              <ProgressBar
                :value="titleMeter.ratio"
                :color="titlesAllOwned ? 'var(--color-jade)' : 'var(--color-cinnabar)'"
                :height="3"
              />
              <p class="name-beast-ledger__foot-copy">
                已藏 {{ ownedCount }} / {{ TITLES.length }} 顶
                <template v-if="!titlesAllOwned">
                  · 尚余 {{ TITLES.length - ownedCount }} 顶
                </template>
              </p>
            </div>
            <p v-if="titlesAllOwned" class="name-beast-ledger__complete">
              <span>名号尽收</span>
              {{ TITLES.length }} 顶名号皆入囊中 —— 这一世的名，走到头了
            </p>
          </footer>
        </section>

        <section
          class="name-beast-ledger name-ledger"
          data-kind="title"
          :data-title-total="titleRows.length"
          :data-title-shown="titlePage.shown"
          :data-title-start="titlePage.start"
        >
          <header class="name-ledger__head">
            <div>
              <p class="name-ledger__eyebrow">佩印与旧藏</p>
              <h2 class="name-ledger__title">名号谱</h2>
            </div>
            <p class="name-ledger__window tabular">
              现看 {{ titlePage.start + 1 }}–{{ titlePage.shown }} · 共 {{ titleRows.length }} 顶
            </p>
          </header>

          <div class="name-ledger__list">
            <article
              v-for="row in titlePage.visible"
              :key="row.def.id"
              :data-title-row="row.def.id"
              :data-title-state="row.state.state"
              tabindex="-1"
              class="name-ledger__entry flex flex-wrap items-center gap-3"
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
              class="chip-ink !whitespace-normal text-center text-note leading-relaxed text-ink-soft active:scale-95"
              :aria-label="previousTitleText()"
              @click="showPreviousTitles"
            >
              {{ previousTitleText() }}
            </button>
            <button
              v-if="titlePage.hidden > 0"
              type="button"
              data-title-more
              class="chip-ink !whitespace-normal text-center text-note leading-relaxed text-cinnabar active:scale-95"
              :aria-label="moreTitleText()"
              :data-promised="Math.min(TITLE_RENDER_BATCH, titlePage.hidden)"
              @click="showMoreTitles"
            >
              {{ moreTitleText() }}
            </button>
          </div>
        </section>
      </section>

      <section v-else class="name-beast-tab" role="tabpanel" aria-label="灵兽">
        <section class="name-beast-ledger" data-pet-ledger data-kind="pet">
          <header class="name-beast-ledger__head">
            <span class="name-beast-ledger__seal" aria-hidden="true">兽</span>
            <div class="name-beast-ledger__identity">
              <p class="name-beast-ledger__eyebrow">同行之契</p>
              <h2 class="name-beast-ledger__title">灵契总案</h2>
              <p class="name-beast-ledger__desc">
                一兽相伴，其余结缘在册；出战加成读人物页同一份终值。
              </p>
            </div>
            <p class="name-beast-ledger__score tabular">
              <span>已结缘</span>
              <strong>{{ ownedPetCount }}</strong>
              <span>/ {{ PETS.length }}</span>
            </p>
          </header>

          <div class="name-beast-ledger__grid">
            <article class="name-beast-ledger__panel" data-pet-current>
              <p class="name-beast-ledger__label">此刻相伴</p>
              <template v-if="activePet">
                <p class="name-beast-ledger__line">
                  <span
                    class="name-beast-ledger__pet-icon"
                    :style="{ color: qualityDef(activePet.def.quality).color }"
                  >
                    <GameIcon :name="activePet.def.icon" :size="17" />
                  </span>
                  <strong>{{ activePet.def.name }}</strong>
                  <span>{{ qualityDef(activePet.def.quality).name }}</span>
                </p>
                <p class="name-beast-ledger__copy">{{ activePet.def.desc }}</p>
                <p v-if="activePet.modText" class="name-beast-ledger__effect tabular">
                  {{ activePet.modText }}
                </p>
                <p class="name-beast-ledger__trait">
                  {{ activePet.personalityName }}
                  <span>{{ activePet.personalityDesc }}</span>
                  <template v-if="activePet.traitText">
                    · <span class="tabular">{{ activePet.traitText }}</span>
                  </template>
                </p>
              </template>
              <template v-else>
                <p class="name-beast-ledger__line"><strong>尚无灵兽相伴</strong></p>
                <p class="name-beast-ledger__copy">
                  已结缘的灵兽可从灵兽谱里唤来一只，相伴加成随即进入人物总案。
                </p>
              </template>
            </article>

            <article class="name-beast-ledger__panel">
              <p class="name-beast-ledger__label">结缘册</p>
              <p class="name-beast-ledger__line">
                <strong>{{ ownedPetCount }} / {{ PETS.length }}</strong>
                <span>只已结缘</span>
              </p>
              <p class="name-beast-ledger__copy">{{ CODEX_SOURCES.pet }}</p>
              <p v-if="!petsAllOwned" class="name-beast-ledger__gap tabular">
                尚余 {{ PETS.length - ownedPetCount }} 只未结缘
              </p>
            </article>
          </div>

          <footer class="name-beast-ledger__foot">
            <div class="min-w-0 flex-1">
              <ProgressBar
                :value="petMeter.ratio"
                :color="petsAllOwned ? 'var(--color-jade)' : 'var(--color-qing)'"
                :height="3"
              />
              <p class="name-beast-ledger__foot-copy">
                已结缘 {{ ownedPetCount }} / {{ PETS.length }} 只
                <template v-if="!petsAllOwned">
                  · 尚余 {{ PETS.length - ownedPetCount }} 只
                </template>
              </p>
            </div>
            <p v-if="petsAllOwned" class="name-beast-ledger__complete">
              <span>灵兽尽收</span>
              {{ cnNumber(PETS.length) }}只灵兽俱已结缘 —— 山野之间再无生客
            </p>
          </footer>
        </section>

        <section
          class="name-beast-ledger name-ledger"
          data-kind="pet"
          :data-pet-total="petRows.length"
          :data-pet-shown="petPage.shown"
          :data-pet-start="petPage.start"
        >
          <header class="name-ledger__head">
            <div>
              <p class="name-ledger__eyebrow">已契与未逢</p>
              <h2 class="name-ledger__title">灵兽谱</h2>
            </div>
            <p class="name-ledger__window tabular">
              现看 {{ petPage.start + 1 }}–{{ petPage.shown }} · 共 {{ petRows.length }} 只
            </p>
          </header>

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
                    <p class="name-ledger__desc">尚未结缘 · 来路见卷首「结缘册」</p>
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
              class="chip-ink !whitespace-normal text-center text-note leading-relaxed text-ink-soft active:scale-95"
              :aria-label="previousPetText()"
              @click="showPreviousPets"
            >
              {{ previousPetText() }}
            </button>
            <button
              v-if="petPage.hidden > 0"
              type="button"
              data-pet-more
              class="chip-ink !whitespace-normal text-center text-note leading-relaxed text-cinnabar active:scale-95"
              :aria-label="morePetText()"
              :data-promised="Math.min(PET_RENDER_BATCH, petPage.hidden)"
              @click="showMorePets"
            >
              {{ morePetText() }}
            </button>
          </div>
        </section>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import "@/styles/pages/titles.css";
import { computed, nextTick, ref } from "vue";
import { useInventoryStore } from "@/stores/inventory";
import { usePlayerStore } from "@/stores/player";
import { useQuestsStore } from "@/stores/quests";
import { ACHIEVEMENTS } from "@/data/achievements";
import { TITLES } from "@/data/titles";
import { PETS } from "@/data/pets";
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
import InkTabs from "@/components/common/InkTabs.vue";
import GameIcon from "@/components/common/GameIcon.vue";
import NameBeastAtlas from "@/components/common/NameBeastAtlas.vue";
import { nameBeastMeter, petEntryState, titleEntryState } from "@/ui/titlesDesk";

const player = usePlayerStore();
const inventory = useInventoryStore();
const quests = useQuestsStore();

type Tab = "title" | "pet";
const tab = ref<Tab>("title");
const TABS: { id: Tab; label: string }[] = [
  { id: "title", label: "名号" },
  { id: "pet", label: "灵兽" },
];

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

function moreTitleText(): string {
  const next = Math.min(TITLE_RENDER_BATCH, titlePage.value.hidden);
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
      personalityName: PERSONALITY_NAMES[def.personality],
      personalityDesc: personalityDesc(def.personality),
      traitText: petTraitText(def),
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

const PET_RENDER_BATCH = 12;
const PET_RENDER_WINDOW = PET_RENDER_BATCH * 2;
const petLimit = ref(PET_RENDER_BATCH);
const petPage = computed(() => listWindow(petRows.value, petLimit.value, PET_RENDER_WINDOW));

function morePetText(): string {
  const next = Math.min(PET_RENDER_BATCH, petPage.value.hidden);
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

function focusListRow(selector: string, index = 0): void {
  void nextTick(() => {
    const rows = document.querySelectorAll<HTMLElement>(selector);
    rows[Math.min(Math.max(0, index), rows.length - 1)]?.focus();
  });
}

function togglePet(id: string): void {
  const parting = player.petId === id;
  player.setPet(parting ? null : id);
  petLimit.value = PET_RENDER_BATCH;
  if (parting) focusListRow("[data-pet-row]");
  else focusListRowById("data-pet-row", id);
}

function focusListRowById(attribute: "data-title-row" | "data-pet-row", id: string): void {
  void nextTick(() => {
    document.querySelector<HTMLElement>(`[${attribute}="${CSS.escape(id)}"]`)?.focus();
  });
}
</script>
