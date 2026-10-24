<template>
  <!-- 功法 -->
  <section>
    <SectionTitle title="功法" :hint="`残页 ${resources.page}`" />
    <div class="mt-2 space-y-2">
      <!-- 主修 -->
      <button
        v-if="mainDef"
        class="card-ink flex w-full items-center gap-3 px-3.5 py-3 text-left active:scale-99"
        @click="ui.gongfaDetailId = mainDef.id"
      >
        <span
          class="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-cinnabar/6 font-kai text-cinnabar"
          >主</span
        >
        <span class="min-w-0 grow">
          <span class="block truncate font-kai text-[14px] text-ink">{{ mainDef.name }}</span>
          <span class="flex items-center gap-1.5">
            <span class="shrink-0 text-[11px] text-ink-faint tabular">
              第 {{ cultivation.learned[mainDef.id] }} 层 · {{ qualityDef(mainDef.quality).name }}
            </span>
            <span
              v-if="branchName(mainDef.id)"
              class="min-w-0 truncate rounded bg-gold-ink/6 px-1.5 py-0.5 text-[10px] text-gold-ink"
              >{{ branchName(mainDef.id) }}</span
            >
            <span
              v-else-if="canEnlighten(mainDef.id)"
              class="shrink-0 rounded bg-qing/6 px-1.5 py-0.5 text-[10px] text-qing"
              >待悟道</span
            >
            <span
              v-if="mainCanUpgrade"
              class="shrink-0 rounded bg-jade/6 px-1.5 py-0.5 text-[10px] text-jade"
              >可升层</span
            >
          </span>
        </span>
        <GameIcon name="flame" :size="15" class="text-cinnabar" />
      </button>

      <!--
        一门一册:签与书目同卡,选中签是 6% 朱砂底上的墨字,不铺三色印面。
        窄屏只留印章与部数,门名在读屏标签里。行分两行,名字不再被层数和席位挤扁。
      -->
      <div class="card-ink overflow-hidden">
        <div
          class="flex gap-1 border-b border-ink/10 p-1"
          role="tablist"
          aria-label="功法门类"
          @keydown="onGongfaCatKeydown"
        >
          <button
            v-for="g in gongfaCategories"
            :key="g.type"
            type="button"
            role="tab"
            :id="`gongfa-cat-tab-${g.type}`"
            :aria-controls="`gongfa-cat-panel-${g.type}`"
            :aria-selected="gongfaCat === g.type"
            :aria-label="`${GONGFA_TYPE_NAMES[g.type]} ${g.items.length} 部`"
            :tabindex="gongfaCat === g.type ? 0 : -1"
            class="flex flex-1 items-center justify-center gap-1 rounded-md py-1.5 font-kai text-[14px] tracking-[0.14em]"
            :class="
              gongfaCat === g.type
                ? 'bg-cinnabar/6 text-ink'
                : 'text-ink-faint active:text-ink-soft'
            "
            @click="gongfaCat = g.type"
          >
            <span
              class="font-kai text-[11px]"
              :class="gongfaCat === g.type ? 'text-cinnabar' : 'text-ink-faint'"
              >{{ gongfaSeal(g.type) }}</span
            >
            <span class="hidden min-[360px]:inline">{{ GONGFA_TYPE_NAMES[g.type] }}</span>
            <span class="tabular text-[10px] text-ink-faint">{{ g.items.length }}</span>
          </button>
        </div>

        <p
          v-if="gongfaPoolLeft[gongfaCat] > 0"
          class="border-b border-ink/7 px-3 py-1.5 text-[11px] text-ink-faint"
        >
          此门已习 {{ activeGongfaItems.length }} 部 · 参悟池尚余 {{ gongfaPoolLeft[gongfaCat] }} 部
        </p>
        <p v-else class="border-b border-ink/7 px-3 py-1.5 text-[11px] text-ink-faint">
          此门已收全,待更高境界再探
        </p>

        <div
          class="scroll-pane max-h-72 overflow-y-auto"
          :class="activeGongfaItems.length ? 'divide-y divide-ink/7' : ''"
          role="tabpanel"
          :id="`gongfa-cat-panel-${gongfaCat}`"
          :aria-labelledby="`gongfa-cat-tab-${gongfaCat}`"
          :aria-label="GONGFA_TYPE_NAMES[gongfaCat]"
        >
          <button
            v-for="def in activeGongfaItems"
            :key="def.id"
            class="flex w-full flex-col gap-1 px-3 py-2.5 text-left active:bg-ink/4"
            @click="ui.gongfaDetailId = def.id"
          >
            <span class="flex min-w-0 items-baseline justify-between gap-3">
              <!--
                书目行只靠名色传品阶(行内没有品阶名文字),天/仙/神在名前补一枚
                12px 阴文章 —— 第二条形状线索,色弱也分得出高档(同源 qualityTier)。
                行是整宽的,章不挤;不高档的部目不留章,密度可控。
              -->
              <span class="flex min-w-0 items-center gap-1.5">
                <QualitySeal
                  v-if="isRareQuality(def.quality)"
                  :quality="def.quality"
                  :size="12"
                  class="shrink-0"
                />
                <span
                  class="min-w-0 truncate font-kai text-[14px] leading-none"
                  :style="{ color: qualityDef(def.quality).color }"
                  >{{ def.name }}</span
                >
              </span>
              <span class="shrink-0 tabular text-[10px] text-ink-faint"
                >第 {{ cultivation.learned[def.id] }} 层</span
              >
            </span>
            <span class="flex min-w-0 items-center gap-1.5">
              <span
                v-if="branchName(def.id)"
                class="min-w-0 truncate rounded bg-gold-ink/6 px-1.5 py-0.5 text-[10px] text-gold-ink"
              >
                {{ branchName(def.id) }}
              </span>
              <span
                v-else-if="canEnlighten(def.id)"
                class="shrink-0 rounded bg-qing/6 px-1.5 py-0.5 text-[10px] text-qing"
                >待悟道</span
              >
              <span v-else-if="isFull(def.id)" class="shrink-0 text-[10px] text-ink-faint"
                >圆满</span
              >
              <span v-else class="shrink-0 text-[10px] text-ink-faint">修习中</span>
              <span
                class="ml-auto shrink-0 text-[10px]"
                :class="equipStateOf(def.id) ? 'text-qing' : 'text-ink-faint'"
              >
                {{ equipStateOf(def.id) || "未装配" }}
              </span>
            </span>
          </button>
          <p
            v-if="activeGongfaItems.length === 0"
            class="empty-note px-4 py-6 text-center t-body text-ink-faint"
          >
            <span
              class="mx-auto mb-2 grid h-7 w-7 place-items-center rounded-md bg-cinnabar/6 font-kai text-[14px] text-cinnabar"
              aria-hidden="true"
              >{{ gongfaSeal(gongfaCat) }}</span
            >
            <template v-if="learnedCount === 0">
              尚无一部习得之法 —— 于下方藏经阁参悟,点亮道途
            </template>
            <template v-else>此门尚无习得。藏经阁参悟之后,会出现在这里。</template>
          </p>
        </div>
      </div>

      <!--
        参悟池还剩几部也报出来:藏经阁是「花残页赌一部没见过的」,
        玩家看不到池子还有多大,就无从判断这一注值不值。
      -->
      <!--
        btn-ghost 是 inline-flex:主文与后面那句「· 尚差 N 残页」在同一行挤着放。
        200% 缩放档(195 CSS px)下那一句只剩 31px 宽,一字一行(实测 45px 高)——
        加 flex-wrap 让它在放不下时整块落到第二行。320 / 390 两档不动。
      -->
      <button
        class="btn-ghost w-full flex-wrap"
        :disabled="!canComprehend"
        @click="comprehendGongfa()"
      >
        于藏经阁参悟功法(残页×{{ COMPREHEND_PAGE_COST }})
        <span v-if="comprehendLeft === 0" class="ml-1 text-[10px] text-ink-faint"
          >· 此境功法已尽数参悟</span
        >
        <span v-else-if="pageShort > 0" class="ml-1 text-[10px] text-ink-faint"
          >· 尚差 {{ pageShort }} 残页</span
        >
        <span v-else class="ml-1 text-[10px] text-ink-faint"
          >· 池中尚有 {{ comprehendLeft }} 部未参</span
        >
      </button>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { usePlayerStore } from "@/stores/player";
import { useResourcesStore } from "@/stores/resources";
import { useCultivationStore } from "@/stores/cultivation";
import { useUiStore } from "@/stores/ui";
import { comprehendGongfa, gongfaUpgradeCost } from "@/core/gongfaService";
import { GONGFA, GONGFA_TYPE_NAMES, gongfaDef } from "@/data/gongfa";
import type { GongfaDef, GongfaType } from "@/types";
import { canEnlighten as canEnlightenGongfa, gongfaBranchDef } from "@/data/gongfaBranches";
import { COMPREHEND_PAGE_COST } from "@/data/constants";
import { qualityDef } from "@/data/qualities";
import { isRareQuality } from "@/ui/qualityTier";
import SectionTitle from "@/components/common/SectionTitle.vue";
import QualitySeal from "@/components/common/QualitySeal.vue";
import GameIcon from "@/components/common/GameIcon.vue";

const player = usePlayerStore();
const resources = useResourcesStore();
const cultivation = useCultivationStore();
const ui = useUiStore();

const GONGFA_CAT_ORDER: GongfaType[] = ["main", "sub", "secret"];

function gongfaSeal(type: GongfaType): string {
  if (type === "secret") return "秘";
  if (type === "main") return "主";
  return "辅";
}

/** 已习得按门分组。栏内品阶降序,同品按准入境界、再按功法名。默认停在主修,不因空门改签。 */
const gongfaCategories = computed(() => {
  const byType: Partial<Record<GongfaType, GongfaDef[]>> = {};
  for (const id of Object.keys(cultivation.learned)) {
    const def = gongfaDef(id);
    if (!def) continue;
    (byType[def.type] ??= []).push(def);
  }
  // 当前装配(主修/占辅修席)的置顶,其后保持原降序 —— 判定与 equipStateOf 口径一致
  const equipFlag = (id: string) => (isEquippedGongfa(id) ? 0 : 1);
  const sortItems = (a: GongfaDef, b: GongfaDef) =>
    equipFlag(a.id) - equipFlag(b.id) ||
    qualityDef(b.quality).rank - qualityDef(a.quality).rank ||
    a.minRealm - b.minRealm ||
    a.name.localeCompare(b.name, "zh");
  return GONGFA_CAT_ORDER.map((type) => ({
    type,
    items: (byType[type] ?? []).sort(sortItems),
  }));
});

const gongfaCat = ref<GongfaType>("main");
const activeGongfaItems = computed(
  () => gongfaCategories.value.find((g) => g.type === gongfaCat.value)?.items ?? [],
);
const learnedCount = computed(() => gongfaCategories.value.reduce((n, g) => n + g.items.length, 0));

/** 逐门参悟池余量 —— 与全局 comprehendLeft 同源,仅按门过滤:minRealm ≤ 当前 + 1 且未习得 */
const gongfaPoolLeft = computed<Record<GongfaType, number>>(() => {
  const out = {} as Record<GongfaType, number>;
  for (const t of GONGFA_CAT_ORDER) {
    out[t] = GONGFA.filter(
      (g) => g.type === t && g.minRealm <= player.major + 1 && !cultivation.learned[g.id],
    ).length;
  }
  return out;
});

function onGongfaCatKeydown(e: KeyboardEvent): void {
  if ((e.target as HTMLElement).getAttribute?.("role") !== "tab") return;
  let idx = GONGFA_CAT_ORDER.indexOf(gongfaCat.value);
  switch (e.key) {
    case "ArrowLeft":
      idx -= 1;
      break;
    case "ArrowRight":
      idx += 1;
      break;
    case "Home":
      idx = 0;
      break;
    case "End":
      idx = GONGFA_CAT_ORDER.length - 1;
      break;
    default:
      return;
  }
  idx = (idx + GONGFA_CAT_ORDER.length) % GONGFA_CAT_ORDER.length;
  e.preventDefault();
  const target = GONGFA_CAT_ORDER[idx];
  if (target === undefined) return;
  gongfaCat.value = target;
  (e.currentTarget as HTMLElement)
    .querySelectorAll<HTMLButtonElement>('[role="tab"]')
    [idx]?.focus();
}

const mainDef = computed(() =>
  cultivation.mainGongfa ? gongfaDef(cultivation.mainGongfa) : undefined,
);

/**
 * 主修能不能立升一层 —— 「可变强」的信号提到列表层。
 * 从前玩家攒够了悟道点与残页,列表上看不出哪部功法升得动,要一部部点开详情
 * 才知道。成本走 gongfaUpgradeCost 同源(含寒冥灵脉折扣),不另写一套;
 * 只做主修行 —— 书目行每行都亮会太密,详情层有完整账。
 */
const mainCanUpgrade = computed(() => {
  if (!mainDef.value) return false;
  const cost = gongfaUpgradeCost(mainDef.value.id);
  if (!cost) return false;
  return resources.hasSmall("wudao", cost.wudao) && resources.hasSmall("page", cost.page);
});

/** 参悟池里还剩几部 —— 与 comprehendGongfa 的池条件同源(minRealm ≤ 当前 + 1 且未习得) */
const comprehendLeft = computed(
  () => GONGFA.filter((g) => g.minRealm <= player.major + 1 && !cultivation.learned[g.id]).length,
);

/** 参悟还差几页残页 —— 与 comprehendGongfa 的消耗同源,付不起就置灰并写差 */
const pageShort = computed(() => Math.max(0, COMPREHEND_PAGE_COST - resources.page));

/** 池里还有货且残页够 —— 才能点参悟 */
const canComprehend = computed(
  () => comprehendLeft.value > 0 && resources.page >= COMPREHEND_PAGE_COST,
);

/** 当前装配:主修 或 占着辅修席(含秘术) */
function isEquippedGongfa(id: string): boolean {
  return cultivation.mainGongfa === id || cultivation.subGongfa.includes(id);
}

function equipStateOf(id: string): string {
  if (cultivation.mainGongfa === id) return "主修";
  if (cultivation.subGongfa.includes(id)) {
    // 秘术进的是辅修席,书目门类仍叫秘术,行上把席位说穿
    return gongfaDef(id)?.type === "secret" ? "在辅修席" : "辅修";
  }
  return "";
}

/** 功行是否已至顶层 */
function isFull(id: string): boolean {
  return (cultivation.learned[id] ?? 0) >= (gongfaDef(id)?.maxLevel ?? 9);
}

/** 是否真能悟道(判据取自 gongfaBranches,界面提示与实际可选项同源) */
function canEnlighten(id: string): boolean {
  return canEnlightenGongfa(id, cultivation.learned[id] ?? 0);
}

/** 已择分支的道名;未择、或旧存档留着一个已下线的分支 id,都算没有 */
function branchName(id: string): string | undefined {
  const branchId = cultivation.gongfaBranch[id];
  return branchId ? gongfaBranchDef(branchId)?.name : undefined;
}
</script>
