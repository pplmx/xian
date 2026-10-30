<template>
  <div class="folio-page folio-page--stack stagger-in">
    <FolioPageHeader title="名号与灵兽" back-to="character" back-label="人物" />
    <!-- 页签 -->
    <InkTabs v-model="tab" :tabs="TABS" />

    <!-- 名号:完整清单留在数据层,当前窗口入 DOM -->
    <template v-if="tab === 'title'">
      <SectionTitle
        title="名号"
        :hint="`${ownedCount}/${TITLES.length} · 现看 ${titlePage.start + 1}–${titlePage.shown} · 佩一枚`"
      />
      <!-- 收集进度可视化:数字要读,条是扫一眼(与图鉴成就页同一把尺、同一色) -->
      <ProgressBar
        class="mt-2"
        :value="TITLES.length > 0 ? ownedCount / TITLES.length : 0"
        color="var(--color-jade)"
        :height="3"
      />
      <!--
        名号尽收的完成感:全齐也只显一个计数,「追寻这一路的名号」的终点
        没有任何表示。与图鉴「尽收」同族 —— 判据读同一个 ownedCount(与标题
        计数同源),全收后给一行「名号尽收」,把圆满说出来。
      -->
      <p v-if="titlesAllOwned" class="mt-2 flex items-center gap-1.5 px-1 text-body text-jade">
        <span class="chip-ink border-jade/60 text-note text-jade">名号尽收</span>
        {{ TITLES.length }} 顶名号皆入囊中 —— 这一世的名,走到头了
      </p>
      <div v-if="nextTitle" class="card-ink mt-2 px-4 py-3" data-title-guide>
        <div class="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <p class="font-kai text-body tracking-widest text-ink-soft">下一顶名号</p>
          <p class="text-note text-ink-faint">按成就进度</p>
        </div>
        <div class="mt-1.5 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <p class="min-w-0 font-kai text-title text-ink">{{ nextTitle.def.name }}</p>
          <p class="shrink-0 text-note text-cinnabar tabular">
            {{ nextTitle.progress.label }}
          </p>
        </div>
        <p class="mt-0.5 text-note leading-relaxed text-ink-faint">
          名号获自「{{ nextTitle.source.name }}」 · {{ nextTitle.source.desc }}
        </p>
        <ProgressBar
          class="mt-1.5"
          :value="nextTitle.progress.ratio"
          color="var(--color-cinnabar)"
          :height="2"
        />
        <p v-if="nextTitle.progress.gap !== null" class="mt-1 text-note text-cinnabar tabular">
          尚差 {{ nextTitle.progress.gap }} —— 进度来自成就，不另算一套
        </p>
      </div>
      <div
        class="card-ink divide-y divide-ink/6 px-4"
        :data-title-total="titleRows.length"
        :data-title-shown="titlePage.shown"
        :data-title-start="titlePage.start"
      >
        <!-- 极窄档(≤220 CSS px):左侧徽章 + 名字/描述/词条三行 + 右侧佩/藏按钮,中间那块
             被压到 35px(「修炼速度 +2%」一字一行)—— 允许换行。320 / 390 两档不动。 -->
        <div
          v-for="row in titlePage.visible"
          :key="row.def.id"
          :data-title-row="row.def.id"
          tabindex="-1"
          class="flex flex-wrap items-center gap-3 py-2.5"
        >
          <span
            class="grid h-6 w-6 shrink-0 place-items-center rounded-full border text-body font-kai"
            :class="
              row.worn
                ? 'border-cinnabar text-cinnabar'
                : row.owned
                  ? 'border-gold-ink text-gold-ink'
                  : 'border-ink/15 text-ink-faint'
            "
          >
            {{ row.worn ? "佩" : row.owned ? "藏" : "未" }}
          </span>
          <div class="min-w-0 grow">
            <p class="font-kai text-title" :class="row.owned ? 'text-ink' : 'text-ink-faint'">
              {{ row.def.name }}
            </p>
            <p class="truncate text-note text-ink-faint">{{ row.def.desc }}</p>
            <p v-if="row.owned && row.modText" class="text-note text-qing tabular">
              {{ row.modText }}
            </p>
            <p class="mt-0.5 text-note leading-relaxed text-ink-faint">
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
            class="btn-ghost shrink-0 !px-2.5 !py-1.5 !text-body"
            @click="toggleTitle(row.def.id)"
          >
            {{ row.worn ? "卸下" : "佩戴" }}
          </button>
        </div>
        <!-- 分页动作放在读完之后:读完当前批就往下继续,不必再滚回册首找「再看」。 -->
        <div v-if="titlePage.start > 0 || titlePage.hidden > 0" class="flex flex-wrap gap-1 py-2">
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
      </div>
    </template>

    <!-- 灵兽:完整清单留在数据层,当前窗口入 DOM;未结缘者仍盖成「???」+ 出处 -->
    <template v-else>
      <SectionTitle
        title="灵兽"
        :hint="`已结缘 ${ownedPetCount}/${PETS.length} · 现看 ${petPage.start + 1}–${petPage.shown} · 伴一只`"
      />
      <!-- 收集进度可视化:灵兽册刚扩到四十只,「还差多少」给一根条(与名号同一把尺) -->
      <ProgressBar
        class="mt-2"
        :value="PETS.length > 0 ? ownedPetCount / PETS.length : 0"
        color="var(--color-jade)"
        :height="3"
      />
      <!--
        从前这里只列**已结缘**的几只,未结缘的整只不出现 ——
        抬头写着「3/14」却看不到另外 11 只是什么、去哪儿遇,这一册也就无从追。
        改成与图鉴同款:全册都在,未结缘盖成「???」,并给出处。
      -->
      <p v-if="petsAllOwned" class="mt-1 text-note text-jade">
        <span class="chip-ink border-jade/60 text-note text-jade">尽收</span>
        {{ cnNumber(PETS.length) }}只灵兽俱已结缘 —— 山野之间再无生客
      </p>
      <p v-else class="mt-1 text-note text-ink-faint">{{ CODEX_SOURCES.pet }}</p>
      <div
        class="card-ink mt-2 divide-y divide-ink/6 px-4"
        :data-pet-total="petRows.length"
        :data-pet-shown="petPage.shown"
        :data-pet-start="petPage.start"
      >
        <div
          v-for="row in petPage.visible"
          :key="row.def.id"
          :data-pet-row="row.def.id"
          tabindex="-1"
          class="flex items-start justify-between gap-3 py-2.5 tinylens:flex-col tinylens:items-stretch tinylens:gap-2"
        >
          <div class="flex min-w-0 grow items-start gap-3">
            <template v-if="row.owned">
              <GameIcon
                class="shrink-0"
                :name="row.def.icon"
                :size="18"
                :style="{ color: qualityDef(row.def.quality).color }"
              />
              <div class="min-w-0 grow">
                <p class="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                  <span
                    class="font-kai text-title"
                    :style="{ color: qualityDef(row.def.quality).color }"
                    >{{ row.def.name }}</span
                  >
                  <!-- 品阶文字:数值按品阶重配过,名字旁的「神品/仙品…」让品质与效果一眼可对(见 petQuality.spec 两条不变量) -->
                  <span
                    class="text-note tracking-[0.2em]"
                    :style="{ color: qualityDef(row.def.quality).color }"
                    >{{ qualityDef(row.def.quality).name }}</span
                  >
                  <span v-if="row.active" class="text-note text-jade">相伴中</span>
                </p>
                <p class="truncate text-note text-ink-faint">{{ row.def.desc }}</p>
                <p v-if="row.modText" class="text-note text-qing tabular">{{ row.modText }}</p>
                <!-- 性格 + 数值并一行:定性的话之外还要给数(换不换这只伙伴,靠「更容易」三个字算不出来) -->
                <p class="text-note text-violet-ink">
                  {{ row.personalityName }}
                  <span class="text-ink-faint">{{ row.personalityDesc }}</span>
                  <template v-if="row.traitText">
                    · <span class="text-qing tabular">{{ row.traitText }}</span></template
                  >
                </p>
              </div>
            </template>
            <template v-else>
              <span class="grid h-6 w-6 shrink-0 place-items-center text-ink-faint">
                <GameIcon name="lock" :size="14" />
              </span>
              <div class="min-w-0 grow">
                <p class="font-kai text-title text-ink-faint">???</p>
                <p class="truncate text-note text-ink-faint">尚未结缘</p>
              </div>
            </template>
          </div>
          <button
            v-if="row.owned"
            class="btn-ghost min-h-7 shrink-0 whitespace-nowrap !px-2.5 !py-1.5 !text-body tinylens:w-full"
            @click="togglePet(row.def.id)"
          >
            {{ row.active ? "暂别" : "唤来" }}
          </button>
        </div>
        <div v-if="petPage.start > 0 || petPage.hidden > 0" class="flex flex-wrap gap-1 py-2">
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
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
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
import SectionTitle from "@/components/common/SectionTitle.vue";
import FolioPageHeader from "@/components/common/FolioPageHeader.vue";
import ProgressBar from "@/components/common/ProgressBar.vue";
import InkTabs from "@/components/common/InkTabs.vue";
import GameIcon from "@/components/common/GameIcon.vue";

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
    .map((row) => ({
      ...row,
      owned: ownedSet.has(row.def.id),
      worn: player.titleId === row.def.id,
      modText: modsText(row.def.mods),
    }))
    .sort((a, b) => Number(b.worn) - Number(a.worn) || Number(b.owned) - Number(a.owned));
});

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

/** 全册陈列:当前相伴 → 已结缘 → 品阶降序;未结缘者也占位(盖成「???」) */
const petRows = computed(() =>
  PETS.map((def) => ({
    def,
    owned: ownedPetIds.value.has(def.id),
    active: player.petId === def.id,
    // 相伴中的显示放大后的真值(灵兽园 × 安抚,与人物页属性明细同源 —— 都是 finalStats 的「灵兽」行);
    // 其余仍为基础值 —— 按表里数字决定"该换哪只"不会与实战打架
    modText: modsText(def.id === player.petId ? (activePetMods.value ?? def.mods) : def.mods),
    personalityName: PERSONALITY_NAMES[def.personality],
    personalityDesc: personalityDesc(def.personality),
    traitText: petTraitText(def),
  })).sort(
    (a, b) =>
      Number(b.active) - Number(a.active) ||
      Number(b.owned) - Number(a.owned) ||
      qualityDef(b.def.quality).rank - qualityDef(a.def.quality).rank,
  ),
);

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
