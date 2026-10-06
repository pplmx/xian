<template>
  <div class="stagger-in space-y-4 px-4 pb-6 pt-4">
    <div class="flex items-center gap-2">
      <RouterLink
        to="/character"
        class="-my-1.5 py-1.5 text-[12px] text-ink-faint active:text-ink-soft"
        >← 人物</RouterLink
      >
      <span class="text-[11px] text-ink-faint">·</span>
      <!-- 抬头与人物页入口同名(名号与灵兽):同一处地方,只许一个名字 -->
      <span class="text-[12px] text-ink-soft">名号与灵兽</span>
    </div>
    <!-- 页签 -->
    <InkTabs v-model="tab" :tabs="TABS" />

    <!-- 名号:成就式列表,全量陈列 -->
    <template v-if="tab === 'title'">
      <SectionTitle title="名号" :hint="`${ownedCount}/${TITLES.length} · 佩一枚`" />
      <!--
        名号尽收的完成感:三十顶全齐也只显一个计数,「追寻这一路的名号」的终点
        没有任何表示。与图鉴「尽收」同族 —— 判据读同一个 ownedCount(与标题
        计数同源),全收后给一行「名号尽收」,把圆满说出来。
      -->
      <p v-if="titlesAllOwned" class="mt-2 flex items-center gap-1.5 px-1 text-[11px] text-jade">
        <span class="chip-ink border-jade/60 text-[10px] text-jade">名号尽收</span>
        三十顶名号皆入囊中 —— 这一世的名,走到头了
      </p>
      <div class="card-ink divide-y divide-ink/6 px-4">
        <div v-for="row in titleRows" :key="row.def.id" class="flex items-center gap-3 py-2.5">
          <span
            class="grid h-6 w-6 shrink-0 place-items-center rounded-full border text-[11px] font-kai"
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
            <p class="font-kai text-[13px]" :class="row.owned ? 'text-ink' : 'text-ink-faint'">
              {{ row.def.name }}
            </p>
            <p class="truncate text-[10px] text-ink-faint">{{ row.def.desc }}</p>
            <p v-if="row.owned && row.modText" class="text-[10px] text-qing tabular">
              {{ row.modText }}
            </p>
          </div>
          <button
            v-if="row.owned"
            class="btn-ghost shrink-0 !px-2.5 !py-1.5 !text-[11px]"
            @click="toggleTitle(row.def.id)"
          >
            {{ row.worn ? "卸下" : "佩戴" }}
          </button>
        </div>
      </div>
    </template>

    <!-- 灵兽:全册陈列(未结缘者盖成「???」+ 出处)—— 与图鉴的灵兽册同一套披露 -->
    <template v-else>
      <SectionTitle title="灵兽" :hint="`已结缘 ${ownedPetCount}/${PETS.length} · 伴一只`" />
      <!--
        从前这里只列**已结缘**的几只,未结缘的整只不出现 ——
        抬头写着「3/14」却看不到另外 11 只是什么、去哪儿遇,这一册也就无从追。
        改成与图鉴同款:全册都在,未结缘盖成「???」,并给出处。
      -->
      <p v-if="petsAllOwned" class="mt-1 text-[10px] text-jade">
        <span class="chip-ink border-jade/60 text-[9px] text-jade">尽收</span>
        {{ cnNumber(PETS.length) }}只灵兽俱已结缘 —— 山野之间再无生客
      </p>
      <p v-else class="mt-1 text-[10px] text-ink-faint">{{ CODEX_SOURCES.pet }}</p>
      <div class="card-ink mt-2 divide-y divide-ink/6 px-4">
        <div v-for="row in petRows" :key="row.def.id" class="flex items-center gap-3 py-2.5">
          <template v-if="row.owned">
            <GameIcon
              :name="row.def.icon"
              :size="18"
              :style="{ color: qualityDef(row.def.quality).color }"
            />
            <div class="min-w-0 grow">
              <p class="flex items-center gap-2">
                <span
                  class="font-kai text-[13px]"
                  :style="{ color: qualityDef(row.def.quality).color }"
                  >{{ row.def.name }}</span
                >
                <!-- 品阶文字:数值按品阶重配过,名字旁的「神品/仙品…」让品质与效果一眼可对(见 petQuality.spec 两条不变量) -->
                <span
                  class="text-[9px] tracking-[0.2em]"
                  :style="{ color: qualityDef(row.def.quality).color }"
                  >{{ qualityDef(row.def.quality).name }}</span
                >
                <span v-if="row.active" class="text-[10px] text-jade">相伴中</span>
              </p>
              <p class="truncate text-[10px] text-ink-faint">{{ row.def.desc }}</p>
              <p v-if="row.modText" class="text-[10px] text-qing tabular">{{ row.modText }}</p>
              <!-- 性格 + 数值并一行:定性的话之外还要给数(换不换这只伙伴,靠「更容易」三个字算不出来) -->
              <p class="text-[10px] text-violet-ink">
                {{ row.personalityName }}
                <span class="text-ink-faint">{{ row.personalityDesc }}</span>
                <template v-if="row.traitText">
                  · <span class="text-qing tabular">{{ row.traitText }}</span></template
                >
              </p>
            </div>
            <button
              class="btn-ghost shrink-0 !px-2.5 !py-1 !text-[11px]"
              @click="togglePet(row.def.id)"
            >
              {{ row.active ? "暂别" : "唤来" }}
            </button>
          </template>
          <template v-else>
            <span class="grid h-6 w-6 shrink-0 place-items-center text-ink-faint">
              <GameIcon name="lock" :size="14" />
            </span>
            <div class="min-w-0 grow">
              <p class="font-kai text-[13px] text-ink-faint">???</p>
              <p class="truncate text-[10px] text-ink-faint">尚未结缘</p>
            </div>
          </template>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { usePlayerStore } from "@/stores/player";
import { useQuestsStore } from "@/stores/quests";
import { TITLES } from "@/data/titles";
import { PETS } from "@/data/pets";
import { PERSONALITY_NAMES, personalityDesc } from "@/core/petPersonality";
import type { StatMods } from "@/types";
import { petTraitText } from "@/ui/itemText";
import { qualityDef } from "@/data/qualities";
import { modsText } from "@/ui/statNames";
import { CODEX_SOURCES } from "@/ui/codex";
import { cnNumber } from "@/utils/format";
import SectionTitle from "@/components/common/SectionTitle.vue";
import InkTabs from "@/components/common/InkTabs.vue";
import GameIcon from "@/components/common/GameIcon.vue";

const player = usePlayerStore();
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
/** 名号尽收:三十顶全齐才算(与标题计数同源,不另起一套判据) */
const titlesAllOwned = computed(() => ownedCount.value === TITLES.length && TITLES.length > 0);

/** 全量陈列:佩戴中 > 已拥有 > 未获得 */
const titleRows = computed(() => {
  const ownedSet = new Set(quests.titlesOwned);
  return TITLES.map((def) => ({
    def,
    owned: ownedSet.has(def.id),
    worn: player.titleId === def.id,
    modText: modsText(def.mods),
  })).sort((a, b) => Number(b.worn) - Number(a.worn) || Number(b.owned) - Number(a.owned));
});

function toggleTitle(id: string): void {
  player.setTitle(player.titleId === id ? null : id);
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

/** 全册陈列:已结缘者在前 → 品阶降序 → 当前相伴的置顶;未结缘者也占位(盖成「???」) */
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
      Number(b.owned) - Number(a.owned) ||
      qualityDef(b.def.quality).rank - qualityDef(a.def.quality).rank ||
      Number(b.active) - Number(a.active),
  ),
);

function togglePet(id: string): void {
  player.setPet(player.petId === id ? null : id);
}
</script>
