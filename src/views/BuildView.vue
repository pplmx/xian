<template>
  <div class="folio-page folio-page--stack stagger-in build-page">
    <FolioPageHeader
      class="build-masthead"
      title="流派"
      subtitle="六路不是职业，是你已经走出的形状"
      back-to="character"
      back-label="人物"
      featured
    >
      <template #meta>
        <p class="build-masthead__meta" data-build-current>
          <template v-if="build">
            <span>{{ build.displayName }}</span>
            <span>{{ build.stageName }}</span>
            <span>契合 {{ formatPercent(build.affinity, 0) }}</span>
          </template>
          <template v-else>
            <span>道途未成</span>
            <span>最近 {{ closest.style.name }}</span>
            <span>尚差 {{ formatPercent(closestGap, 0) }}</span>
          </template>
        </p>
      </template>
      <template #visual>
        <BuildAtlas
          :rows="buildPaths"
          :center-seal="build?.style.seal ?? '道'"
          :stage-label="stageMeter.stage"
          :active-id="build?.style.id"
        />
      </template>
    </FolioPageHeader>

    <div class="build-page__body folio-span-all">
      <section v-if="build" class="build-ledger" data-build-formed>
        <header class="build-ledger__head">
          <span class="build-ledger__seal" aria-hidden="true">{{ build.style.seal }}</span>
          <div class="build-ledger__identity">
            <p class="build-ledger__eyebrow">已成之路 · {{ build.stageName }}</p>
            <h2 class="build-ledger__title">{{ build.displayName }}</h2>
            <p class="build-ledger__desc">{{ build.style.desc }}</p>
          </div>
          <p class="build-ledger__score tabular">
            <span>契合</span>
            <strong class="text-heading">{{ formatPercent(build.affinity, 0) }}</strong>
          </p>
        </header>

        <div class="build-ledger__grid build-ledger__grid--three">
          <article class="build-panel" data-build-stage>
            <p class="build-panel__label">
              道途阶梯
              <span>{{ build.stageName }}</span>
            </p>
            <div class="build-stage">
              <p class="build-stage__line">
                <strong>{{ build.stageName }}</strong>
                <span class="tabular">{{ formatPercent(build.affinity, 0) }}</span>
              </p>
              <ProgressBar :value="stageMeter.ratio" color="var(--color-cinnabar)" :height="4" />
              <p class="build-panel__copy">{{ stageGapText }}</p>
              <div class="build-stage__marks" aria-label="成路识别线">
                <span
                  v-for="step in stageSteps"
                  :key="step.label"
                  :class="{ 'is-reached': build.affinity >= step.value }"
                >
                  <strong>{{ step.label }}</strong>
                  <small class="tabular">{{ formatPercent(step.value, 0) }}</small>
                </span>
              </div>
            </div>
            <p v-if="build.secondary" class="build-panel__aside">
              副体系「{{ build.secondary.style.name }}」
              {{ formatPercent(build.secondary.affinity, 0) }} · 修行无职业，道路可以不纯
            </p>
            <p v-if="buildSourceNames.length" class="build-source">
              <span>成路于</span>
              <strong v-for="name in buildSourceNames" :key="name">{{ name }}</strong>
            </p>
          </article>

          <article class="build-panel" data-build-shape>
            <p class="build-panel__label">
              {{ cnNumber(powerRating.labels.length) }}维形状
              <span>{{ strongDims }} 维四星以上</span>
            </p>
            <p class="build-panel__copy">读的是构筑形状，不是战力名次；点一维看词条来路。</p>
            <div class="build-rating">
              <button
                v-for="l in powerRating.labels"
                :key="l.key"
                type="button"
                class="build-rating__row"
                :aria-expanded="dimKey === l.key"
                :aria-controls="`build-dim-panel-${l.key}`"
                @click="toggleDim(l.key)"
              >
                <span class="build-rating__line">
                  <span>{{ l.name }}</span>
                  <span class="build-rating__stars tabular">{{ ratingStars(l.stars) }}</span>
                </span>
                <span class="build-rating__track" aria-hidden="true">
                  <span :style="{ width: `${(l.stars / 5) * 100}%` }" />
                </span>
                <span
                  v-if="dimKey === l.key"
                  :id="`build-dim-panel-${l.key}`"
                  class="build-rating__detail"
                >
                  <span class="build-rating__score">
                    {{ l.name }}得分 {{ l.score.toFixed(2) }} · 跨
                    {{ powerRating.thresholds[l.key].join(" / ") }} 逐级加星
                  </span>
                  <span v-for="t in l.terms" :key="t.label" class="build-rating__term">
                    <span>{{ t.label }}</span>
                    <span class="tabular">+{{ t.contribution.toFixed(2) }}</span>
                  </span>
                  <span v-if="!l.terms.length" class="build-rating__empty">
                    这一维还没有词条撑着。
                  </span>
                  <span class="build-rating__note">贡献之和就是得分，星级只看得分跨过哪一档。</span>
                </span>
              </button>
            </div>
          </article>

          <article class="build-panel" data-build-next>
            <p class="build-panel__label">
              下一步
              <span>{{ coreGaps.length ? `${coreGaps.length} 条缺口` : "核心已满" }}</span>
            </p>
            <p class="build-panel__line">
              <strong>{{ nextActionTitle }}</strong>
            </p>
            <p class="build-panel__copy">{{ nextActionCopy }}</p>
            <ul v-if="nextCoreGaps.length" class="build-core">
              <li v-for="gap in nextCoreGaps" :key="gap.key">
                <span class="build-core__name">{{ STAT_NAMES[gap.key] }}</span>
                <span class="build-core__track" aria-hidden="true">
                  <span :style="{ width: `${gap.ratio * 100}%` }" />
                </span>
                <span class="build-core__value tabular">
                  {{ formatPercent(gap.value, 0) }} / {{ formatPercent(gap.reference, 0) }}
                </span>
                <span class="build-core__gap tabular">尚差 {{ formatPercent(gap.gap, 0) }}</span>
              </li>
            </ul>
            <p v-else class="build-panel__aside">此路核心词条已全部留下，后续只看实战面与相性。</p>
            <div class="build-panel__actions">
              <RouterLink to="/cultivation" class="btn-ghost min-h-9">去修行配功法</RouterLink>
              <RouterLink to="/inventory" class="btn-ghost min-h-9">看行囊装备</RouterLink>
            </div>
          </article>
        </div>

        <footer class="build-ledger__foot">
          <p>
            <span>主路</span><strong>{{ build.style.name }}</strong>
          </p>
          <p>
            <span>副路</span><strong>{{ build.secondary?.style.name ?? "未成" }}</strong>
          </p>
          <p>
            <span>核心词条</span><strong class="tabular">{{ build.coreValues.length }} 条</strong>
          </p>
          <p>
            <span>四星维度</span
            ><strong class="tabular">{{ strongDims }} / {{ powerRating.labels.length }}</strong>
          </p>
        </footer>
      </section>

      <BuildDiscovery v-else :rows="buildPaths" />

      <section v-if="build" class="build-ledger build-ledger--field" data-build-battle>
        <header class="build-ledger__head">
          <span class="build-ledger__seal" aria-hidden="true">战</span>
          <div class="build-ledger__identity">
            <p class="build-ledger__eyebrow">实战面 · 只报方向</p>
            <h2 class="build-ledger__title">短板与第二套答案</h2>
            <p class="build-ledger__desc">
              七类本世实敌各打一轮估算；再把主派核心封掉，看看还剩多少胜率。
            </p>
          </div>
          <p class="build-ledger__score tabular">
            <span>最弱</span>
            <strong class="text-heading">{{
              formatPercent(weakestMatchup?.winRate ?? 0, 0)
            }}</strong>
          </p>
        </header>

        <div class="build-ledger__grid">
          <article class="build-panel build-matchups">
            <p class="build-panel__label">
              本世对局
              <span>短板在前</span>
            </p>
            <div class="build-matchup-list">
              <div
                v-for="row in matchupSorted"
                :key="row.id"
                class="build-matchup"
                :data-build-matchup="row.id"
              >
                <span class="build-matchup__name">
                  {{ row.name }}
                  <span v-if="row.wall" class="build-matchup__wall">墙</span>
                </span>
                <span class="build-matchup__track" aria-hidden="true">
                  <span
                    :class="winBarCls(row.winRate)"
                    :style="{ width: `${row.winRate * 100}%` }"
                  />
                </span>
                <span class="build-matchup__rate tabular" :class="winTextCls(row.winRate)">
                  {{ formatPercent(row.winRate, 0) }}
                </span>
              </div>
            </div>
            <p class="build-panel__copy">
              每类各打
              {{ MATCHUP_SAMPLE_RUNS }} 场估算，读的是「哪面吃亏」的方向，不是精确胜率；四墙 (首领 /
              高爆发 / 真伤 / 疾影)通吃，才称万金油。
            </p>
          </article>

          <article class="build-panel build-proof">
            <p class="build-panel__label">
              第二套答案
              <span>{{
                resilience ? `${formatPercent(resilience.retention, 0)} 留存` : "待测"
              }}</span>
            </p>
            <template v-if="resilience">
              <p class="build-proof__line">
                <strong>构筑韧性</strong>
                <span
                  class="tabular"
                  :class="resilience.retention >= 0.45 ? 'text-jade' : 'text-cinnabar'"
                >
                  {{ formatPercent(resilience.normal, 0) }} →
                  {{ formatPercent(resilience.sealed, 0) }}
                </span>
              </p>
              <p class="build-panel__copy">{{ resilienceText(resilience) }}</p>
            </template>

            <div v-if="comboInfo" class="build-combo">
              <p class="build-combo__title">
                组合技「{{ comboInfo.art.name }}」
                <span :class="comboInfo.active ? 'text-jade' : 'text-ink-faint'">
                  {{
                    comboInfo.active
                      ? "已成"
                      : `副体系至 ${formatPercent(COMBO_SECONDARY_MIN, 0)} 契合可成`
                  }}
                </span>
              </p>
              <p class="build-panel__copy">{{ comboInfo.art.desc }}</p>
              <p class="build-combo__cost">代价：{{ comboInfo.art.costText }}</p>
            </div>
            <p v-else class="build-panel__aside">主副两路尚未成对，组合技会在这里显形。</p>
          </article>
        </div>
      </section>

      <section class="build-ledger" data-build-loadouts>
        <header class="build-ledger__head">
          <span class="build-ledger__seal" aria-hidden="true">藏</span>
          <div class="build-ledger__identity">
            <p class="build-ledger__eyebrow">换装底账</p>
            <h2 class="build-ledger__title">构筑快照</h2>
            <p class="build-ledger__desc">
              把顺手的整套功法、法宝与装备存起来，按当前处境一键换装。
            </p>
          </div>
          <p class="build-ledger__score tabular">
            <span>已存</span>
            <strong class="text-heading">{{ loadouts.list.length }}</strong>
            <span>/ {{ MAX_LOADOUTS }}</span>
          </p>
        </header>

        <div class="build-loadout__toolbar">
          <p>快照只记当前整套装配，不替你重算词条。</p>
          <button
            class="chip-ink border-cinnabar/40 text-cinnabar disabled:border-ink/15 disabled:text-ink-faint"
            :disabled="loadoutsFull"
            @click="openSave"
          >
            {{ loadoutsFull ? "快照已满" : "+ 存当前构筑" }}
          </button>
        </div>

        <div v-if="loadouts.list.length" class="build-loadout__list">
          <article v-for="lo in loadouts.list" :key="lo.id" class="build-loadout__row">
            <span class="build-loadout__seal" aria-hidden="true">{{ lo.seal }}</span>
            <div class="build-loadout__copy">
              <strong>{{ lo.name }}</strong>
              <span>整套功法 / 法宝 / 装备</span>
            </div>
            <div class="build-loadout__actions">
              <button class="btn-ghost !px-2.5 !py-1 !text-body" @click="applyLoadout(lo.id)">
                换装
              </button>
              <template v-if="confirmDelete !== lo.id">
                <button
                  class="build-loadout__delete"
                  aria-label="删除构筑"
                  @click="confirmDelete = lo.id"
                >
                  <GameIcon name="trash" :size="12" />
                </button>
              </template>
              <template v-else>
                <button class="btn-seal !px-2 !py-0.5 !text-note" @click="doDeleteLoadout(lo.id)">
                  确认删除
                </button>
                <button
                  class="text-note text-ink-faint active:text-ink"
                  @click="confirmDelete = null"
                >
                  再想想
                </button>
              </template>
            </div>
          </article>
        </div>
        <p v-else class="build-ledger__empty">尚无快照，存一套后可在此与各区域间从容切换。</p>
      </section>

      <section v-if="compareCandidates.length" class="build-ledger" data-build-compare>
        <header class="build-ledger__head">
          <span class="build-ledger__seal" aria-hidden="true">照</span>
          <div class="build-ledger__identity">
            <p class="build-ledger__eyebrow">跨世校样</p>
            <h2 class="build-ledger__title">构筑对照</h2>
            <p class="build-ledger__desc">
              以当前构筑，对照道痕中冻结的一套过往构筑，看四天局面各有何异。
            </p>
          </div>
          <p class="build-ledger__score tabular">
            <span>旧样</span>
            <strong class="text-heading">{{ compareRows.length }}</strong>
            <span>则</span>
          </p>
        </header>

        <div class="build-compare__body">
          <div
            class="build-compare__choices"
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
                compareAt === c.at
                  ? 'border-cinnabar text-cinnabar'
                  : 'border-ink/25 text-ink-faint'
              "
              :aria-pressed="compareAt === c.at"
              @click="pickCompare(c.at)"
            >
              第{{ c.life }}世·{{ c.buildName }}
            </button>
            <button
              v-if="comparePage.hidden > 0"
              type="button"
              data-compare-more
              class="chip-ink border-cinnabar/50 text-note text-cinnabar active:scale-95"
              :aria-label="compareMoreText"
              @click="showMoreCompare"
            >
              {{ compareMoreText }}
            </button>
          </div>

          <template v-if="compareResult">
            <div class="build-compare__result" :data-compare-result="compareAt">
              <p v-for="row in compareResult.rows" :key="row.worldName" class="build-compare__row">
                <span>{{ row.worldName }}</span>
                <span class="tabular">
                  <span>今 {{ row.aText }}</span>
                  <span class="build-compare__divider">|</span>
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
            <p v-if="compareResult.diffLines.length" class="build-compare__diff tabular">
              彼相对于今：{{ compareResult.diffLines.join(" · ") }}
            </p>
            <p class="build-compare__note">两套方案各有其境，取舍在你。</p>
          </template>
        </div>
      </section>
    </div>

    <BaseModal :open="saveOpen" title="存为构筑" @close="saveOpen = false">
      <p class="text-body text-ink-faint">将当前功法 / 法宝 / 整身装备存为一套，可随时一键切换。</p>
      <input
        v-model="saveName"
        maxlength="8"
        aria-label="给这套构筑起个名字"
        class="mt-2 w-full rounded-md border border-ink/20 bg-paper-deep/60 px-3 py-2 text-[16px] outline-none focus:border-cinnabar/50 t-card"
        placeholder="给这套构筑起个名字"
      />
      <template #footer>
        <p v-if="loadoutsFull" class="mb-1 text-center text-note text-cinnabar">
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
import "@/styles/pages/build.css";
import { computed, nextTick, ref } from "vue";
import { usePlayerStore } from "@/stores/player";
import {
  buildAffinityRows,
  detectBuild,
  buildSources,
  STYLE_EMERGENCE_AFFINITY,
  STYLE_MASTER_AFFINITY,
  STYLE_MATURE_AFFINITY,
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
import { buildCoreGaps, buildStageMeter } from "@/ui/buildDesk";
import { STAT_NAMES } from "@/data/statNames";
import FolioPageHeader from "@/components/common/FolioPageHeader.vue";
import GameIcon from "@/components/common/GameIcon.vue";
import BaseModal from "@/components/common/BaseModal.vue";
import ProgressBar from "@/components/common/ProgressBar.vue";
import BuildAtlas from "@/components/build/BuildAtlas.vue";
import BuildDiscovery from "@/components/build/BuildDiscovery.vue";

const player = usePlayerStore();
const loadouts = useLoadoutsStore();
const loadoutsFull = computed(() => loadouts.list.length >= MAX_LOADOUTS);

const build = computed(() => detectBuild(player.finalStats.mods));
const buildPaths = computed(() => buildAffinityRows(player.finalStats.mods));
const closest = computed(() => buildPaths.value[0]!);
const closestGap = computed(() => Math.max(0, STYLE_EMERGENCE_AFFINITY - closest.value.affinity));
const stageMeter = computed(() => buildStageMeter(build.value?.affinity ?? closest.value.affinity));

const stageSteps = computed(() => [
  { label: "雏形", value: STYLE_EMERGENCE_AFFINITY },
  { label: "成形", value: STYLE_MATURE_AFFINITY },
  { label: "大成", value: STYLE_MASTER_AFFINITY },
]);

/** 距下一形态还差多少契合：读判定线常量，不在视图里另写门槛。 */
const stageGapText = computed(() => {
  const aff = build.value?.affinity;
  if (aff === undefined) return "";
  if (aff >= STYLE_MASTER_AFFINITY) return "已至大成，此路不再有新的识别门槛。";
  const target = aff >= STYLE_MATURE_AFFINITY ? STYLE_MASTER_AFFINITY : STYLE_MATURE_AFFINITY;
  return `距${aff >= STYLE_MATURE_AFFINITY ? "大成" : "成形"}还差 ${formatPercent(target - aff, 0)} 契合。`;
});

const powerRating = computed(() => ratePower(player.finalStats));
const strongDims = computed(
  () => powerRating.value.labels.filter((label) => label.stars >= 4).length,
);
const dimKey = ref<PowerDimKey | null>(null);
function toggleDim(key: PowerDimKey): void {
  dimKey.value = dimKey.value === key ? null : key;
}

const buildSourceNames = computed(() => (build.value ? buildSources(build.value.style) : []));
const activePath = computed(() =>
  build.value ? buildPaths.value.find((row) => row.style.id === build.value?.style.id) : undefined,
);
const coreGaps = computed(() => (activePath.value ? buildCoreGaps(activePath.value) : []));
const nextCoreGaps = computed(() => coreGaps.value.slice(0, 3));
const nextActionTitle = computed(() => {
  if (!build.value) return "";
  if (stageMeter.value.gap > 0) {
    const next = stageMeter.value.stage === "未成" ? "雏形" : "下一形态";
    return `再补 ${formatPercent(stageMeter.value.gap, 0)} 契合，推向${next}`;
  }
  return "此路已大成";
});
const nextActionCopy = computed(() => {
  if (!build.value) return "";
  if (nextCoreGaps.value.length) {
    return "优先补贡献最低的核心词条；词条名、当前值与参考值都按同一套流派定义现算。";
  }
  return "核心词条已全部留下；接下来读实战短板，不必继续追同一条路。";
});

const comboInfo = computed(() => {
  const current = build.value;
  if (!current?.secondary) return null;
  const art = matchComboArt(current.style.id, current.secondary.style.id);
  if (!art) return null;
  return { art, active: current.secondary.affinity >= COMBO_SECONDARY_MIN };
});

const resilience = computed(() => (build.value ? measureResilience(buildPlayerSnap()) : null));
const matchupRows = computed(() =>
  build.value ? playerMatchups(buildPlayerSnap(), MATCHUP_SAMPLE_RUNS) : null,
);
const matchupSorted = computed(() =>
  [...(matchupRows.value ?? [])].sort((a, b) => a.winRate - b.winRate),
);
const weakestMatchup = computed(() => matchupSorted.value[0]);

function winBarCls(rate: number): string {
  return rate >= 0.7 ? "bg-jade" : rate >= 0.45 ? "bg-amber-ink" : "bg-cinnabar";
}
function winTextCls(rate: number): string {
  return rate >= 0.7 ? "text-jade" : rate >= 0.45 ? "text-amber-ink" : "text-cinnabar";
}

const endgame = useEndgameStore();
const compareAt = ref<number | null>(null);
const compareResult = ref<CompareReport | null>(null);
const COMPARE_BATCH = 8;
const compareLimit = ref(COMPARE_BATCH);

const compareRows = computed(() =>
  endgameUnlocked()
    ? endgame.marks
        .filter((mark) => mark.replay !== undefined)
        .map((mark) => ({ at: mark.at, life: mark.life, buildName: mark.buildName }))
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
  const mark = endgame.marks.find((candidate) => candidate.at === at);
  if (!mark?.replay) return;
  compareResult.value = compareSnaps(buildPlayerSnap(), snapFromReplay("彼时构筑", mark.replay));
}

const saveOpen = ref(false);
const saveName = ref("");
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
