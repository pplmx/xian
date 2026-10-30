<template>
  <div class="folio-page folio-page--stack stagger-in world-page">
    <template v-if="view">
      <!--
        地界志先读此世之名，再把命数、所钟与换界摊在卷首。
        路线状态不在这里猜：正文仍由 worldView / mortalStageStatuses 同源翻译。
      -->
      <FolioPageHeader class="world-masthead" :title="view.title" :subtitle="view.summary" featured>
        <template #backdrop>
          <svg
            class="pointer-events-none absolute inset-x-0 bottom-0 h-28 w-full text-[color:var(--world-mountain)] opacity-8"
            viewBox="0 0 400 110"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            <path
              d="M0 110 L52 48 L86 76 L132 32 L174 79 L216 55 L264 88 L318 38 L360 70 L400 45 L400 110 Z"
              fill="currentColor"
            />
            <path
              d="M0 110 L42 84 L93 103 L142 74 L188 101 L238 82 L290 104 L337 79 L400 96 L400 110 Z"
              fill="currentColor"
              opacity="0.5"
            />
          </svg>
        </template>

        <template #meta>
          <p class="world-masthead__meta" data-world-shape>
            <span>
              <span>地界</span>
              <strong class="tabular">{{ view.stages }}</strong>
            </span>
            <span>
              <span>层级</span>
              <strong class="tabular">{{ tierRangeText }}</strong>
            </span>
            <span>
              <span>已行</span>
              <strong class="tabular">{{ meter.cleared }} / {{ meter.total }}</strong>
            </span>
          </p>
        </template>

        <template #visual>
          <div class="world-masthead__atlas">
            <WorldAtlas
              :statuses="stageStatuses"
              :cleared="meter.cleared"
              :total="meter.total"
              :mark="meter.atlasMark"
              :tier-text="view.tierText"
            />
          </div>
        </template>

        <div class="world-masthead__brief">
          <div class="world-masthead__law">
            <p class="world-masthead__rule text-body">
              <span class="text-cinnabar">此世命数:</span>
              <strong>{{ view.ruleText }}</strong>
            </p>
            <p class="world-masthead__note text-note">
              这条命数只参与成形时的难度校准,不改写历练里的战斗。
            </p>
            <!--
              资源偏向必须写明兑现方式:摘要里那句「矿脉深厚之地」若没有数字跟着,
              玩家会把它当纯flavor —— 而它现在真的乘在玄铁掉率上(见 core/mortalBias)。
            -->
            <p v-if="view.biasText" class="world-masthead__bias text-note">
              <span>此地所钟</span>
              <strong>{{ view.biasText }}</strong>
            </p>
          </div>

          <!--
            道果出口之一:换一方天地。发的是选择权,不是数值 —— 出口的发放物不得属于
            StatMods 命名空间(见 core/fruitOutlets.spec 的结论)。不够时把差多少写出来。
          -->
          <div class="world-masthead__reroll">
            <button
              class="world-reroll__button"
              :disabled="!canRerollWorld"
              data-world-reroll
              @click="rerollConfirm = true"
            >
              换一方天地({{ rerollCost }} 道果{{ rerollBlockText }})
            </button>
            <!--
              换界的代价必须写在按钮下面:setMortalWorld 会把本世路线进度清零。
              只说价、不说会清进度,等于让玩家在不知情的情况下丢掉已经走过的路。
            -->
            <p>
              换界即换路:<span class="text-ink-soft"
                >已走的本世路线会清零,所钟与地貌构成重新掷定。</span
              >
            </p>
          </div>
        </div>
      </FolioPageHeader>

      <BaseModal :open="rerollConfirm" title="换一方天地" @close="rerollConfirm = false">
        <p class="t-body leading-relaxed">
          耗 <span class="text-cinnabar tabular">{{ rerollCost }}</span> 枚道果,
          <span class="text-ink">本世路线进度清零</span>,所钟与地貌重掷。
        </p>
        <p class="mt-1 text-body text-ink-faint">
          现有 {{ player.reincarnation.daoFruit }} 枚 · 换完剩
          {{ Math.max(0, player.reincarnation.daoFruit - rerollCost) }} 枚。 这一步不可逆 ——
          走过的地界要重新走。
        </p>
        <div class="mt-3 flex justify-end gap-2">
          <button class="btn-ghost min-h-[32px] !px-3 text-body" @click="rerollConfirm = false">
            再想想
          </button>
          <button
            class="btn-primary min-h-[32px] !px-4 text-body"
            data-world-reroll-confirm
            @click="confirmReroll"
          >
            换
          </button>
        </div>
      </BaseModal>

      <section class="world-ledger folio-span-all" data-world-desk>
        <header class="world-ledger__head">
          <span class="world-ledger__seal text-section" aria-hidden="true">山</span>
          <div class="world-ledger__identity">
            <p class="world-ledger__eyebrow text-note">本世山河案</p>
            <h2 class="world-ledger__title text-heading">山河行旅</h2>
            <p class="world-ledger__desc">
              {{ currentRouteText }} · 余 <span class="tabular">{{ meter.remaining }}</span> 程
            </p>
          </div>
          <p class="world-ledger__score tabular">
            <span>已行</span>
            <strong>{{ meter.cleared }}</strong>
            <span>/ {{ meter.total }}</span>
          </p>
        </header>

        <div class="world-ledger__body">
          <MortalRouteMap
            :places="view.places"
            :statuses="stageStatuses"
            :tier-text="view.tierText"
          />

          <section class="world-route" aria-labelledby="world-route-list-heading">
            <header class="world-route__head">
              <div class="min-w-0">
                <p id="world-route-list-heading" class="world-route__label text-title">本世地界</p>
                <p class="world-route__current">{{ currentRouteText }}</p>
              </div>
              <span class="world-route__count tabular">{{ meter.cleared }} 程已行</span>
            </header>

            <ol class="world-route__list">
              <li
                v-for="(p, routeIndex) in view.places"
                :key="p.nodeId"
                class="world-stage"
                :class="stageStateClass(routeIndex)"
                :data-stage-state="stageStatuses[routeIndex]?.state"
                :data-stage-index="routeIndex + 1"
                :data-stage-can-depart="canDepart(p.regionId)"
                :data-world-current="isCurrentStage(routeIndex) ? '' : undefined"
              >
                <div class="world-stage__rail">
                  <span class="world-stage__marker" :class="stageMarkerClass(routeIndex)">
                    <GameIcon
                      :name="
                        canDepart(p.regionId) ? (regionDef(p.regionId)?.icon ?? 'mountain') : 'lock'
                      "
                      :size="15"
                    />
                    <span
                      v-if="isCurrentStage(routeIndex)"
                      class="world-stage__pulse animate-breathe"
                      aria-hidden="true"
                    />
                  </span>
                  <span class="world-stage__ordinal tabular">{{ routeIndex + 1 }}</span>
                </div>

                <div class="world-stage__body">
                  <div class="world-stage__heading">
                    <span class="world-stage__name">{{ p.name }}</span>
                    <span class="world-stage__terrain">{{ p.terrain }}</span>
                    <span v-if="cleared(p.nodeId)" class="world-stage__state text-jade">已通</span>
                    <span
                      v-else-if="isCurrentStage(routeIndex)"
                      class="world-stage__state text-qing"
                    >
                      眼下可往
                    </span>
                    <!-- 旧链已开、路线尚未轮到的中段:进度仍按路线走,但入口不能假装上锁 -->
                    <span v-else-if="canDepart(p.regionId)" class="world-stage__state text-qing">
                      旧路可往
                    </span>
                  </div>

                  <p class="world-stage__guard">
                    <span>镇守 {{ p.bossName }}</span>
                    <span class="world-stage__density" aria-hidden="true">
                      <span v-for="n in p.eventLevel" :key="n" />
                    </span>
                  </p>

                  <!-- 锁住的地界要给一句「为什么现在去不了」,而不是只画把锁 -->
                  <p
                    v-if="!canDepart(p.regionId)"
                    class="world-stage__lock"
                    :class="{ 'is-next': isNextLocked(routeIndex) }"
                  >
                    {{ lockedHint(routeIndex) }}
                  </p>

                  <div class="world-stage__actions">
                    <span>{{ canDepart(p.regionId) ? "此路可入" : "前路未开" }}</span>
                    <!-- 已通的段落照样能再去 —— 「已通」是记号,不是封路 -->
                    <button
                      v-if="canDepart(p.regionId)"
                      class="btn-seal world-stage__depart"
                      @click="depart(p.regionId)"
                    >
                      出 发
                    </button>
                  </div>
                </div>
              </li>
            </ol>
          </section>
        </div>

        <!--
          换界规则必须与按钮同源:道果重掷与兵解转世都能另开天地,
          两条路都会清空本世路线进度。规则存在却不告诉玩家,和没有规则一样糟。
        -->
        <details class="world-origin">
          <summary>
            <span>此界从何而来</span>
            <span>成形 · 换界 · 转世</span>
          </summary>
          <div class="world-origin__body">
            <p>
              你睁眼时,天地已成此形。所历地界、途中缓急、镇守之物皆随此世而定,
              <span class="text-ink-soft">此形既成,不主动换界就不会再变。</span>
            </p>
            <p>
              舍 <span class="text-cinnabar">道果</span>
              可立即换一方天地,清空本世路线进度; 待
              <span class="text-violet-ink">兵解转世</span>
              ,也会另开一片天地—— 与此世不同的地界、不同的路、不同的规矩。
            </p>
            <p>
              此外诸界仍在,可回 <span class="text-qing">历练</span>
              处另择他地,不必只走此路。
            </p>
          </div>
        </details>
      </section>

      <section
        v-if="historyRows.length"
        class="world-ledger world-ledger--history folio-span-all"
        data-world-history-section
      >
        <header class="world-ledger__head">
          <span class="world-ledger__seal world-ledger__seal--past text-section" aria-hidden="true"
            >旧</span
          >
          <div class="world-ledger__identity">
            <p class="world-ledger__eyebrow text-note">前尘山河</p>
            <h2 class="world-ledger__title text-heading">最近 {{ historyRows.length }} 世</h2>
            <p class="world-ledger__desc">近世在前；世界名、段数与气象仍走同一套翻译。</p>
          </div>
          <p class="world-ledger__score tabular">
            <span>历世</span>
            <strong>{{ historyRows.length }}</strong>
          </p>
        </header>

        <div class="world-history" data-world-history>
          <article
            v-for="(h, i) in historyRows"
            :key="h.seed"
            class="world-history__row"
            :data-world-history-row="i + 1"
          >
            <span class="world-history__ordinal" data-world-history-label>{{
              pastWorldLabel(i)
            }}</span>
            <div class="world-history__body">
              <p class="world-history__heading">
                <span class="world-history__title" data-world-history-title>{{ h.title }}</span>
                <span class="world-history__stages tabular" data-world-history-stages
                  >{{ h.stages }} 段</span
                >
              </p>
              <p class="world-history__summary">{{ h.summary }}</p>
              <p class="world-history__meta">
                <span>{{ h.tierText }}</span>
                <span class="text-cinnabar">命数 {{ h.ruleText }}</span>
                <span v-if="h.biasText" class="text-qing">所钟 {{ h.biasText }}</span>
              </p>
            </div>
          </article>
        </div>
      </section>
    </template>

    <p v-else class="empty-note text-center text-body text-ink-faint">
      此世气象尚未凝成。天地未就,不妨先去历练,待此世凝成再来。
    </p>
  </div>
</template>

<script setup lang="ts">
import "@/styles/pages/world.css";
import { computed, ref } from "vue";
import { useRouter } from "vue-router";
import FolioPageHeader from "@/components/common/FolioPageHeader.vue";
import GameIcon from "@/components/common/GameIcon.vue";
import MortalRouteMap from "@/components/world/MortalRouteMap.vue";
import WorldAtlas from "@/components/world/WorldAtlas.vue";
import { useAdventureStore } from "@/stores/adventure";
import { usePlayerStore } from "@/stores/player";
import { useUiStore } from "@/stores/ui";
import BaseModal from "@/components/common/BaseModal.vue";
import { rerollWorldByFruit, worldRerollQuote } from "@/core/worldReroll";
import { rollMortalWorld } from "@/core/mortalWorldService";
import { enemyDef } from "@/data/enemies";
import { regionDef } from "@/data/regions";
import { cnNumber } from "@/utils/format";
import {
  canEnterRegion,
  ensureMortalWorld,
  isNodeCleared,
  mortalStageStatuses,
  worldHistoryRows,
  worldView,
} from "@/core/mortalWorldService";
import { worldDeskMeter } from "@/ui/worldDesk";

const adventure = useAdventureStore();
const player = usePlayerStore();
const ui = useUiStore();
/** 换界按钮与结算共用同一条门槛:价、短差与主拦截只算一次 */
const rerollQuote = computed(() =>
  worldRerollQuote(player.reincarnation.daoFruit, adventure.sessionActive),
);
const rerollCost = computed(() => rerollQuote.value.cost);
const canRerollWorld = computed(() => rerollQuote.value.blockedBy === null);
/** 禁用不能只灰不说:历练中与缺道果同时成立时,两个原因都写出来 */
const rerollBlockText = computed(() => {
  const quote = rerollQuote.value;
  const reasons: string[] = [];
  if (quote.blockedBy === "busy") reasons.push("历练中");
  if (quote.shortfall > 0) reasons.push(`尚差 ${quote.shortfall} 枚`);
  return reasons.length > 0 ? ` · ${reasons.join(" · ")}` : "";
});
const rerollConfirm = ref(false);

/** 确认之后才真的花道果、换界 —— 与种子那份列表上的价钱是同一处算出来的 */
function confirmReroll(): void {
  rerollConfirm.value = false;
  rerollWorld();
}

function rerollWorld(): void {
  const r = rerollWorldByFruit({
    daoFruit: player.reincarnation.daoFruit,
    spendFruit: (n) => player.spendDaoFruit(n),
    reroll: () => rollMortalWorld(),
    commit: (next) => adventure.setMortalWorld(next),
    sessionActive: adventure.sessionActive,
  });
  if (r === "ok") ui.toast("此方天地已换 —— 又是一条没走过的路", "rare");
  else if (r === "poor") ui.toast("道果不够换一方天地", "warn");
  else if (r === "busy") ui.toast("先把这趟历练走完,再换天地", "warn");
  else ui.toast("此界掷不出新的天地 —— 一分未扣", "warn");
}
const router = useRouter();

/** 本世之界;首次进入本页时凝成 */
const view = computed(() => {
  const w = adventure.mortalWorld ?? ensureMortalWorld();
  if (!w) return null;
  return worldView(w, (id) => enemyDef(id)?.name ?? id, cleared);
});

const tierRangeText = computed(() => view.value?.tierText.replace(/^层级\s*/, "") ?? "");
const stageStatuses = computed(() =>
  mortalStageStatuses(view.value?.places.map((p) => p.nodeId) ?? [], adventure.mortalCleared),
);
/** 卷首山图、本世总账与路线标题共用这一份阶段读数 */
const meter = computed(() => worldDeskMeter(view.value?.places ?? [], stageStatuses.value));
const currentRouteText = computed(() =>
  meter.value.currentIndex >= 0
    ? `${meter.value.currentOrdinal} · ${meter.value.currentName}`
    : meter.value.currentName,
);
/** 前尘只留最近几世;倒序让玩家先看见刚走过的上一世 */
const historyRows = computed(() =>
  worldHistoryRows(adventure.mortalWorldHistory, (id) => enemyDef(id)?.name ?? id),
);

function pastWorldLabel(index: number): string {
  return `前${cnNumber(index + 1)}世`;
}

/**
 * 出发资格只认历练守卫同一个谓词。
 *
 * 本世路线管的是阶段进度;旧链已开的地界仍可先行,不能在这里又画一把锁。
 */
function canDepart(regionId: string): boolean {
  return canEnterRegion(regionId);
}

function cleared(nodeId: string): boolean {
  return isNodeCleared(nodeId);
}

function isCurrentStage(index: number): boolean {
  return stageStatuses.value[index]?.state === "current";
}

function stageStateClass(index: number): string {
  const state = stageStatuses.value[index]?.state;
  if (state === "current") return "is-current";
  if (state === "cleared") return "is-cleared";
  return "is-blocked";
}

function stageMarkerClass(index: number): string {
  const state = stageStatuses.value[index]?.state;
  if (state === "cleared") return "is-cleared";
  if (state === "current") return "is-current";
  return "is-blocked";
}

function isNextLocked(index: number): boolean {
  const status = stageStatuses.value[index];
  return status?.state === "blocked" && status.waitsFor !== null;
}

function lockedHint(index: number): string {
  const status = stageStatuses.value[index];
  if (status?.state !== "blocked" || !status.waitsFor) return "尚在前路之后";
  const wait = view.value?.places.find((p) => p.nodeId === status.waitsFor);
  return wait ? `须先通「${wait.name}」` : "尚在前路之后";
}

/**
 * 出发 —— 带着地界回历练页选出行方式。
 *
 * 模式弹窗连着适配预览与流派推荐,只应有一处实现;
 * 在这里重做一遍等于把同一段逻辑养成两份
 */
function depart(regionId: string): void {
  router.push({ path: "/adventure", query: { go: regionId } });
}
</script>
