<template>
  <div class="stagger-in space-y-4 px-4 pb-6 pt-4">
    <div class="flex items-center gap-2">
      <RouterLink
        to="/character"
        class="-my-1.5 py-1.5 text-[11px] text-ink-faint active:text-ink-soft"
        >← 人物</RouterLink
      >
      <span class="text-[11px] text-ink-faint">·</span>
      <span class="text-[11px] text-ink-soft">流派</span>
    </div>
    <SectionTitle title="流派" hint="道路由构筑自然成形" />
    <div class="card-ink px-4 py-3">
      <template v-if="build">
        <div class="flex items-center gap-3">
          <span
            class="grid h-11 w-11 shrink-0 place-items-center rounded-md bg-cinnabar/90 font-kai text-[22px] text-paper shadow"
          >
            {{ build.style.seal }}
          </span>
          <div class="min-w-0 grow">
            <!-- 极窄档(≤220 CSS px):流派名 + 阶段 + 契合度一行塞不下,流派名被压到
                 22px 宽一字一行 —— 允许换行,名字 itself 锁一行。320 / 390 两档不动。 -->
            <p class="flex flex-wrap items-baseline gap-2">
              <span class="font-kai whitespace-nowrap text-[16px] tracking-widest text-ink">{{
                build.displayName
              }}</span>
              <span class="text-[11px] text-cinnabar">{{ build.stageName }}</span>
              <span class="ml-auto tabular text-[11px] text-ink-soft"
                >契合 {{ formatPercent(build.affinity, 0) }}</span
              >
            </p>
            <ProgressBar
              class="mt-1.5"
              :value="build.affinity"
              :height="5"
              color="var(--color-cinnabar)"
            />
            <p class="mt-0.5 text-[10px] text-ink-faint tabular">{{ stageGapText }}</p>
            <p v-if="build.secondary" class="mt-1 text-[10px] text-ink-faint tabular">
              副体系:{{ build.secondary.style.name }}
              {{ formatPercent(build.secondary.affinity, 0) }} —— 修行无职业,道路可以不纯
            </p>
          </div>
        </div>
        <p class="mt-2 t-body text-ink-faint">{{ build.style.desc }}</p>
        <div class="mt-2 space-y-1">
          <p v-for="cv in build.coreValues" :key="cv.key" class="flex justify-between text-[11px]">
            <span class="text-ink-soft">{{ STAT_NAMES[cv.key] }}</span>
            <span class="tabular text-violet-ink">+{{ formatPercent(cv.value) }}</span>
          </p>
        </div>
        <p
          v-if="buildSourceNames.length"
          class="mt-2 flex flex-wrap gap-x-2 gap-y-1 text-[11px] text-ink-faint"
        >
          <span>成路于:</span>
          <span v-for="name in buildSourceNames" :key="name" class="text-qing">{{ name }}</span>
        </p>
        <!-- 五维评级(Phase 30.2):读懂构筑"形状",不看战力总数 -->
        <div class="mt-2.5 rounded-md bg-paper-deep/60 px-3 py-2">
          <p class="text-[10px] text-ink-faint">
            {{ cnNumber(powerRating.labels.length) }}维评级 —— 读的是形状,不是排名
          </p>
          <div class="mt-1 grid grid-cols-1 gap-0.5">
            <!-- 每维可点开:星级是结果,词条才是原因 -->
            <button
              v-for="l in powerRating.labels"
              :key="l.key"
              class="w-full min-h-8 -my-1 py-1.5 text-left active:opacity-60"
              :aria-expanded="dimKey === l.key"
              :aria-controls="`build-dim-panel-${l.key}`"
              @click="toggleDim(l.key)"
            >
              <span class="flex items-center justify-between text-[11px]">
                <span class="text-ink-soft">{{ l.name }}</span>
                <span class="tabular tracking-widest text-gold-ink">{{
                  ratingStars(l.stars)
                }}</span>
              </span>
              <span
                v-if="dimKey === l.key"
                :id="`build-dim-panel-${l.key}`"
                class="mt-1 block rounded-md bg-paper/70 px-2 py-1.5"
              >
                <span class="block text-[10px] text-ink-soft">
                  {{ l.name }}得分 {{ l.score.toFixed(2) }} · 跨
                  {{ powerRating.thresholds[l.key].join(" / ") }} 逐级加星
                </span>
                <span
                  v-for="t in l.terms"
                  :key="t.label"
                  class="mt-0.5 flex justify-between text-[10px]"
                >
                  <span class="text-ink-faint">{{ t.label }}</span>
                  <span class="tabular text-qing">+{{ t.contribution.toFixed(2) }}</span>
                </span>
                <span v-if="!l.terms.length" class="block text-[10px] text-ink-faint"
                  >这一维还没有词条撑着。</span
                >
                <span class="mt-1 block text-[10px] leading-relaxed text-ink-faint">
                  贡献之和就是得分 —— 星级只看得分跨过哪一档。
                </span>
              </span>
            </button>
          </div>
          <p class="mt-1 text-[10px] text-ink-faint">点一维看它由哪些词条凑出来。</p>
          <p class="mt-1 text-[10px] leading-relaxed text-ink-faint">
            同一星级的两个构筑谁更强,由环境与相性决定 —— 所以这里给的是形状,不是名次。
          </p>
        </div>
        <!-- 组合技:两条道路交汇处的一式神通 -->
        <div
          v-if="comboInfo"
          class="mt-2.5 rounded-md px-3 py-2"
          :class="comboInfo.active ? 'bg-violet-ink/6' : 'bg-ink/4'"
        >
          <p class="flex items-center gap-2">
            <span
              class="font-kai text-[14px]"
              :class="comboInfo.active ? 'text-violet-ink' : 'text-ink-faint'"
            >
              组合技「{{ comboInfo.art.name }}」
            </span>
            <span class="text-[10px]" :class="comboInfo.active ? 'text-jade' : 'text-ink-faint'">
              {{
                comboInfo.active
                  ? "已成"
                  : `副体系至 ${formatPercent(COMBO_SECONDARY_MIN, 0)} 契合可成`
              }}
            </span>
          </p>
          <p
            class="mt-0.5 text-[11px] leading-relaxed"
            :class="comboInfo.active ? 'text-ink-soft' : 'text-ink-faint'"
          >
            {{ comboInfo.art.desc }}
          </p>
          <p class="mt-0.5 text-[10px] text-cinnabar">代价:{{ comboInfo.art.costText }}</p>
        </div>
        <!-- 构筑韧性:主派被封后还剩什么 -->
        <div v-if="resilience" class="mt-2.5 rounded-md bg-ink/4 px-3 py-2">
          <!--
            标签与取值各成一格并允许换行:窄屏上「构筑韧性(主派核心封印之下)」会把
            右边那串胜率挤成两行(「胜率 100% →」/「100%」)。副题拆成独立一格,
            换行时整串胜率一起落到下一行(nowrap 保证它自己不裂)。
          -->
          <p class="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-[11px]">
            <span class="font-kai whitespace-nowrap text-ink-soft">构筑韧性</span>
            <span class="text-[10px] text-ink-faint">(主派核心封印之下)</span>
            <span
              class="ml-auto shrink-0 whitespace-nowrap tabular"
              :class="resilience.retention >= 0.45 ? 'text-jade' : 'text-cinnabar'"
            >
              胜率 {{ formatPercent(resilience.normal, 0) }} →
              {{ formatPercent(resilience.sealed, 0) }}
            </span>
          </p>
          <p class="mt-0.5 text-[10px] text-ink-faint">{{ resilienceText(resilience) }}</p>
        </div>
        <!--
          本世对局:七类本世实敌挨个对打,短板一面先入眼。
          玩家早在四处踩坑,却看不到「到底输在哪一类」 —— 胜率面把最吃亏的那面摆在前头。
        -->
        <div v-if="matchupRows" class="mt-2.5 rounded-md bg-ink/4 px-3 py-2">
          <p class="text-[10px] text-ink-faint">
            本世对局 —— 与当下构筑对打七类实敌,估其胜率,短板在前
          </p>
          <div class="mt-1.5 space-y-1">
            <div v-for="row in matchupSorted" :key="row.id" class="flex items-center gap-2">
              <span class="w-9 shrink-0 truncate text-[11px] text-ink-soft">{{ row.name }}</span>
              <span
                v-if="row.wall"
                class="shrink-0 rounded bg-cinnabar/6 px-1 py-0.5 text-[10px] leading-none text-cinnabar"
                >墙</span
              >
              <span class="track-ink h-1.25 min-w-0 flex-1 overflow-hidden rounded-full">
                <span
                  class="bar-fill h-full rounded-full"
                  :class="winBarCls(row.winRate)"
                  :style="{ width: `${row.winRate * 100}%` }"
                />
              </span>
              <span
                class="w-9 shrink-0 text-right tabular text-[11px]"
                :class="winTextCls(row.winRate)"
              >
                {{ formatPercent(row.winRate, 0) }}
              </span>
            </div>
          </div>
          <p class="mt-1.5 text-[10px] leading-relaxed text-ink-faint">
            每类各打 {{ MATCHUP_SAMPLE_RUNS }} 场估算,读的是「哪面吃亏」的方向,不是精确胜率;四墙
            (首领 / 高爆发 / 真伤 / 疾影)通吃,才称万金油。
          </p>
        </div>
      </template>
      <p v-else class="empty-note t-body text-center text-ink-faint">
        道途尚未成路。凑齐同一路数的词条、功法与法宝,自成一派——
        <br />
        <span class="text-ink-faint"
          >{{ STYLE_SHORT_NAMES.join(" / ") }},各有克制,亦各有天敌。</span
        >
      </p>
    </div>

    <!-- 构筑快照 -->
    <SectionTitle title="构筑快照" :hint="`已存 ${loadouts.list.length}/${MAX_LOADOUTS} 套`" />
    <div class="card-ink px-4 py-3">
      <p class="mb-1.5 flex items-center justify-between">
        <span class="text-[11px] text-ink-faint"
          >把顺手的整套功法 / 法宝 / 装备存起来,一键切换</span
        >
        <!-- 320 窄窗:按钮不许被左侧说明挤折(「+ 存当前构 / 筑」)。
             按钮 shrink-0 + 不断行,说明文字先让位。 -->
        <button
          class="tap-row -my-1 shrink-0 py-1.5 text-[11px] text-cinnabar active:opacity-60 disabled:text-ink-faint"
          :disabled="loadoutsFull"
          @click="openSave"
        >
          {{ loadoutsFull ? "快照已满" : "+ 存当前构筑" }}
        </button>
      </p>
      <div v-if="loadouts.list.length" class="space-y-1.5">
        <div
          v-for="lo in loadouts.list"
          :key="lo.id"
          class="flex items-center gap-2 rounded-md bg-paper-deep/70 px-2.5 py-1.5"
        >
          <span
            class="grid h-6 w-6 shrink-0 place-items-center rounded bg-cinnabar/85 font-kai text-[11px] text-paper"
          >
            {{ lo.seal }}
          </span>
          <span class="min-w-0 grow truncate font-kai text-[11px] text-ink">{{ lo.name }}</span>
          <button class="btn-ghost !px-2.5 !py-1 !text-[11px]" @click="applyLoadout(lo.id)">
            换装
          </button>
          <!-- 删除二步确认:一套构筑是心血,误触垃圾桶不该直接没 -->
          <template v-if="confirmDelete !== lo.id">
            <button
              class="-m-1.5 flex min-h-[28px] min-w-[28px] items-center justify-center p-1.5 text-ink-faint active:text-cinnabar"
              aria-label="删除构筑"
              @click="confirmDelete = lo.id"
            >
              <GameIcon name="trash" :size="12" />
            </button>
          </template>
          <template v-else>
            <button class="btn-seal !px-2 !py-0.5 !text-[10px]" @click="doDeleteLoadout(lo.id)">
              确认删除
            </button>
            <button
              class="text-[10px] text-ink-faint active:text-ink"
              @click="confirmDelete = null"
            >
              再想想
            </button>
          </template>
        </div>
      </div>
      <p v-else class="empty-note text-center text-[11px] text-ink-faint">
        尚无快照,存一套后可在此与各区域间从容切换。
      </p>
    </div>

    <!-- 双构筑对照:让实验成为研究(真仙可用) -->
    <template v-if="compareCandidates.length">
      <SectionTitle title="构筑对照" hint="分环境论短长,不宣布谁胜" />
      <div class="card-ink px-4 py-3">
        <p class="text-[11px] text-ink-faint">
          以当前构筑,对照道痕中冻结的一套过往构筑,看四天局面各有何异。
        </p>
        <div
          class="mt-2 flex flex-wrap gap-1.5"
          :data-compare-total="compareRows.length"
          :data-compare-shown="comparePage.shown"
        >
          <button
            v-for="c in compareCandidates"
            :key="c.at"
            type="button"
            :data-compare-candidate="c.at"
            class="chip-ink"
            :class="
              compareAt === c.at ? 'border-cinnabar text-cinnabar' : 'border-ink/25 text-ink-faint'
            "
            :aria-pressed="compareAt === c.at"
            @click="pickCompare(c.at)"
          >
            第{{ c.life }}世·{{ c.buildName }}
          </button>
        </div>
        <button
          v-if="comparePage.hidden > 0"
          type="button"
          data-compare-more
          class="chip-ink mt-1.5 border-cinnabar/50 text-[10px] text-cinnabar active:scale-95"
          :aria-label="compareMoreText"
          @click="showMoreCompare"
        >
          {{ compareMoreText }}
        </button>
        <template v-if="compareResult">
          <div class="mt-2 space-y-0.5" :data-compare-result="compareAt">
            <p
              v-for="row in compareResult.rows"
              :key="row.worldName"
              class="flex justify-between text-[11px]"
            >
              <span class="text-ink-faint">{{ row.worldName }}</span>
              <span class="tabular">
                <span class="text-ink-soft">今 {{ row.aText }}</span>
                <span class="mx-1 text-ink-faint">|</span>
                <span
                  :class="
                    row.trend === 'down'
                      ? 'text-jade'
                      : row.trend === 'up'
                        ? 'text-cinnabar'
                        : 'text-ink-faint'
                  "
                >
                  彼 {{ row.bText }}
                </span>
              </span>
            </p>
          </div>
          <p v-if="compareResult.diffLines.length" class="mt-1 text-[10px] text-qing tabular">
            彼相对于今:{{ compareResult.diffLines.join(" · ") }}
          </p>
          <p class="mt-0.5 text-[10px] text-ink-faint">两套方案各有其境,取舍在你。</p>
        </template>
      </div>
    </template>

    <!-- 保存构筑 -->
    <BaseModal :open="saveOpen" title="存为构筑" @close="saveOpen = false">
      <p class="text-[11px] text-ink-faint">
        将当前功法 / 法宝 / 整身装备存为一套,可随时一键切换。
      </p>
      <input
        v-model="saveName"
        maxlength="8"
        aria-label="给这套构筑起个名字"
        class="mt-2 w-full rounded-md border border-ink/20 bg-paper-deep/60 px-3 py-2 text-[16px] outline-none focus:border-cinnabar/50 t-card"
        placeholder="给这套构筑起个名字"
      />
      <template #footer>
        <p v-if="loadoutsFull" class="mb-1 text-center text-[10px] text-cinnabar">
          快照已满({{ loadouts.list.length }}/{{ MAX_LOADOUTS }}),先删一套再存
        </p>
        <button class="btn-seal w-full" :disabled="loadoutsFull" @click="confirmSave">
          {{ loadoutsFull ? "快照已满" : "存 入" }}
        </button>
      </template>
    </BaseModal>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, ref } from "vue";
import { usePlayerStore } from "@/stores/player";
import {
  detectBuild,
  buildSources,
  STYLE_SHORT_NAMES,
  STYLE_MATURE_AFFINITY,
  STYLE_MASTER_AFFINITY,
} from "@/core/buildDetect";
import { ratePower, ratingStars, type PowerDimKey } from "@/core/powerRating";
import { matchComboArt, COMBO_SECONDARY_MIN } from "@/data/comboArts";
import { measureResilience, resilienceText } from "@/core/resilience";
import { playerMatchups, MATCHUP_SAMPLE_RUNS } from "@/core/playerMatchup";
import { buildPlayerSnap } from "@/core/playerSnap";
import { compareSnaps, type CompareReport } from "@/core/compare";
import { endgameUnlocked, snapFromReplay } from "@/core/endgameService";
import { useEndgameStore } from "@/stores/endgame";
import { applyLoadout, captureLoadout, deleteLoadout } from "@/core/loadoutService";
import { useLoadoutsStore, MAX_LOADOUTS } from "@/stores/loadouts";
import { cnNumber, formatPercent } from "@/utils/format";
import { firstNewVisibleIndex, listWindow, nextListLimit } from "@/core/listRender";
import { STAT_NAMES } from "@/data/statNames";
import SectionTitle from "@/components/common/SectionTitle.vue";
import GameIcon from "@/components/common/GameIcon.vue";
import BaseModal from "@/components/common/BaseModal.vue";
import ProgressBar from "@/components/common/ProgressBar.vue";

const player = usePlayerStore();
const loadouts = useLoadoutsStore();
/** 快照存满:存入口该置灰(满额存不进,别让玩家点到弹窗里才吃闭门羹) */
const loadoutsFull = computed(() => loadouts.list.length >= MAX_LOADOUTS);

const build = computed(() => detectBuild(player.finalStats.mods));
/** 距下一形态还差多少契合:读判定线常量(60%/90%,与 stageName 同源),进度不许空转 */
const stageGapText = computed(() => {
  const aff = build.value?.affinity;
  if (aff === undefined) return "";
  if (aff >= STYLE_MASTER_AFFINITY) return "已至大成";
  const target = aff >= STYLE_MATURE_AFFINITY ? STYLE_MASTER_AFFINITY : STYLE_MATURE_AFFINITY;
  return `距${aff >= STYLE_MATURE_AFFINITY ? "大成" : "成形"}还差 ${formatPercent(target - aff, 0)} 契合`;
});
/** 五维评级:进攻/生存/身法/恢复/机制 —— 让玩家读懂构筑形状而非只盯战力总数 */
const powerRating = computed(() => ratePower(player.finalStats));

/** 点开哪一维看它的来路 —— 与人物页属性明细同一条规矩:明细之和 = 那一维的得分 */
const dimKey = ref<PowerDimKey | null>(null);
function toggleDim(key: PowerDimKey): void {
  dimKey.value = dimKey.value === key ? null : key;
}
const buildSourceNames = computed(() => (build.value ? buildSources(build.value.style) : []));

/** 主副体系凑对时展示组合技(未达门槛也展示,作为构筑目标) */
const comboInfo = computed(() => {
  const b = build.value;
  if (!b?.secondary) return null;
  const art = matchComboArt(b.style.id, b.secondary.style.id);
  if (!art) return null;
  return { art, active: b.secondary.affinity >= COMBO_SECONDARY_MIN };
});

/** 构筑韧性:主派封印后的战力保持(120 场等比敌采样) */
const resilience = computed(() => (build.value ? measureResilience(buildPlayerSnap()) : null));

/** 本世对局:七类实敌挨个对打,短板一面先入眼(固定种子,不随刷新跳) */
const matchupRows = computed(() =>
  build.value ? playerMatchups(buildPlayerSnap(), MATCHUP_SAMPLE_RUNS) : null,
);
const matchupSorted = computed(() =>
  [...(matchupRows.value ?? [])].sort((a, b) => a.winRate - b.winRate),
);
function winBarCls(rate: number): string {
  return rate >= 0.7 ? "bg-jade" : rate >= 0.45 ? "bg-amber-ink" : "bg-cinnabar";
}
function winTextCls(rate: number): string {
  return rate >= 0.7 ? "text-jade" : rate >= 0.45 ? "text-amber-ink" : "text-cinnabar";
}

// ---- 双构筑对照 ----
const endgame = useEndgameStore();
const compareAt = ref<number | null>(null);
const compareResult = ref<CompareReport | null>(null);
const COMPARE_BATCH = 8;
const compareLimit = ref(COMPARE_BATCH);

const compareRows = computed(() =>
  endgameUnlocked()
    ? endgame.marks
        .filter((m) => m.replay !== undefined)
        .map((m) => ({ at: m.at, life: m.life, buildName: m.buildName }))
    : [],
);
const comparePage = computed(() => listWindow(compareRows.value, compareLimit.value));
const compareCandidates = computed(() => comparePage.value.visible);
const compareMoreText = computed(() => {
  const next = Math.min(COMPARE_BATCH, comparePage.value.hidden);
  return `再看 ${next} 则 · 余 ${comparePage.value.hidden}`;
});

function focusCompare(index = 0): void {
  void nextTick(() => {
    const candidates = document.querySelectorAll<HTMLButtonElement>(
      "button[data-compare-candidate]",
    );
    candidates[Math.min(Math.max(0, index), candidates.length - 1)]?.focus();
  });
}

function showMoreCompare(): void {
  const shownBefore = comparePage.value.shown;
  const shownAfter = nextListLimit(
    comparePage.value.shown,
    compareRows.value.length,
    COMPARE_BATCH,
  );
  compareLimit.value = shownAfter;
  focusCompare(firstNewVisibleIndex(shownBefore, shownAfter, shownAfter));
}

function pickCompare(at: number): void {
  compareAt.value = at;
  const mark = endgame.marks.find((m) => m.at === at);
  if (!mark?.replay) return;
  compareResult.value = compareSnaps(buildPlayerSnap(), snapFromReplay("彼时构筑", mark.replay));
}

const saveOpen = ref(false);
const saveName = ref("");
/** 等待二次确认删除的构筑 id。删构筑不可逆(一套心血),走两步武装确认:
 *  确认词「确认+动词」、取消词一律「再想想」(确认模式分级见 EquipDecomposePanel 文件头) */
const confirmDelete = ref<string | null>(null);

function openSave(): void {
  saveName.value = build.value?.style.name ?? "";
  saveOpen.value = true;
}

function doDeleteLoadout(id: string): void {
  deleteLoadout(id);
  confirmDelete.value = null;
}

function confirmSave(): void {
  if (captureLoadout(saveName.value)) saveOpen.value = false;
}
</script>
