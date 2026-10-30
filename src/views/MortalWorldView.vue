<template>
  <div class="folio-page folio-page--stack stagger-in">
    <template v-if="view">
      <!-- 世界身份是这一页的卷首:先读此世之名,再读路怎么走 -->
      <FolioPageHeader :title="view.title" :subtitle="view.summary" featured>
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
        <template #action>
          <span
            class="grid h-10 w-10 place-items-center rounded-sm border border-cinnabar/45 font-kai text-section text-cinnabar"
            aria-hidden="true"
            >界</span
          >
        </template>

        <div class="grid grid-cols-3 border-y border-ink/10 py-2" data-world-shape>
          <div class="min-w-0 border-r border-ink/10 pr-2">
            <p class="text-note text-ink-faint">地界</p>
            <p class="mt-0.5 font-kai text-section text-ink tabular">{{ view.stages }}</p>
          </div>
          <div class="min-w-0 border-r border-ink/10 px-2">
            <p class="text-note text-ink-faint">层级</p>
            <p class="mt-0.5 font-kai text-section text-ink tabular">{{ tierRangeText }}</p>
          </div>
          <div class="min-w-0 pl-2">
            <p class="text-note text-ink-faint">已行</p>
            <p class="mt-0.5 font-kai text-section text-ink tabular">
              {{ view.clearedStages
              }}<span class="text-note text-ink-faint"> / {{ view.stages }}</span>
            </p>
          </div>
        </div>

        <p class="mt-2 text-body">
          <span class="text-cinnabar">此世命数:</span>
          <span class="ml-1 font-kai text-title text-ink">{{ view.ruleText }}</span>
        </p>
        <p class="mt-0.5 text-note leading-relaxed text-ink-faint">
          这条命数只参与成形时的难度校准,不改写历练里的战斗。
        </p>
        <!--
            资源偏向必须写明兑现方式:摘要里那句「矿脉深厚之地」若没有数字跟着,
            玩家会把它当纯flavor —— 而它现在真的乘在玄铁掉率上(见 core/mortalBias)。
          -->
        <p v-if="view.biasText" class="mt-1 text-body text-ink-faint">
          <span class="text-qing">此地所钟</span> · {{ view.biasText }}
        </p>
        <!--
            道果出口之一:换一方天地。发的是**选择权**,不是数值 —— 出口的发放物不得属于
            StatMods 命名空间(见 core/fruitOutlets.spec 的结论)。不够时把差多少写出来。
          -->
        <button
          class="btn-ghost mt-3 min-h-[28px] max-w-full !px-3 !py-1 text-body"
          :disabled="!canRerollWorld"
          data-world-reroll
          @click="rerollConfirm = true"
        >
          换一方天地({{ rerollCost }} 道果{{ rerollBlockText }})
        </button>
        <!--
            换界的代价必须写在按钮下面:setMortalWorld 会把本世路线进度清零(「换界即换路」)。
            只说价、不说会清进度,等于让玩家在不知情的情况下丢掉已经走过的路。
          -->
        <p class="mt-1 text-note leading-relaxed text-ink-soft">
          换界即换路:已走的本世路线会清零,所钟与地貌构成重新掷定。
        </p>
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

      <MortalRouteMap :places="view.places" :statuses="stageStatuses" :tier-text="view.tierText" />

      <SectionTitle title="本世地界" :hint="`${view.clearedStages}/${view.stages} 程已行`" />
      <ol class="space-y-2">
        <li
          v-for="(p, routeIndex) in view.places"
          :key="p.nodeId"
          class="card-ink relative overflow-hidden px-3 py-3"
          :class="stageCardClass(routeIndex)"
          :data-stage-state="stageStatuses[routeIndex]?.state"
          :data-stage-index="routeIndex + 1"
          :data-stage-can-depart="canDepart(p.regionId)"
        >
          <div class="flex items-start gap-3">
            <div class="flex w-9 shrink-0 flex-col items-center">
              <span
                class="relative grid h-9 w-9 place-items-center rounded-md border"
                :class="stageMarkerClass(routeIndex)"
              >
                <GameIcon
                  :name="
                    canDepart(p.regionId) ? (regionDef(p.regionId)?.icon ?? 'mountain') : 'lock'
                  "
                  :size="16"
                />
                <span
                  v-if="isCurrentStage(routeIndex)"
                  class="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-qing animate-breathe"
                  aria-hidden="true"
                />
              </span>
              <span class="mt-1 text-note text-ink-faint tabular">{{ routeIndex + 1 }}</span>
            </div>

            <div class="min-w-0 flex-1">
              <div class="flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5">
                <span class="min-w-0 truncate font-kai text-title tracking-[0.14em] text-ink">{{
                  p.name
                }}</span>
                <span class="shrink-0 text-body text-qing">{{ p.terrain }}</span>
                <span v-if="cleared(p.nodeId)" class="shrink-0 text-note text-jade">已通</span>
                <span v-else-if="isCurrentStage(routeIndex)" class="shrink-0 text-note text-qing">
                  眼下可往
                </span>
                <!-- 旧链已开、路线尚未轮到的中段:进度仍按路线走,但入口不能假装上锁 -->
                <span v-else-if="canDepart(p.regionId)" class="shrink-0 text-note text-qing">
                  旧路可往
                </span>
              </div>
              <p class="mt-1 flex items-center gap-2 text-note text-ink-faint">
                <span class="truncate">镇守 {{ p.bossName }}</span>
                <span class="flex shrink-0 gap-0.5" aria-hidden="true">
                  <span
                    v-for="n in p.eventLevel"
                    :key="n"
                    class="h-1 w-1 rounded-full bg-gold-ink/60"
                  />
                </span>
              </p>
              <!-- 锁住的地界要给一句"为什么现在去不了",而不是只画把锁 -->
              <p
                v-if="!canDepart(p.regionId)"
                class="mt-1 text-note leading-relaxed"
                :class="isNextLocked(routeIndex) ? 'text-cinnabar' : 'text-ink-faint'"
              >
                {{ lockedHint(routeIndex) }}
              </p>
              <!-- 已通的段落照样能再去 —— 「已通」是记号,不是封路 -->
              <div v-if="canDepart(p.regionId)" class="mt-2 flex justify-end">
                <button
                  class="btn-seal min-h-[28px] !px-4 !py-1 !text-body"
                  @click="depart(p.regionId)"
                >
                  出 发
                </button>
              </div>
            </div>
          </div>
        </li>
      </ol>

      <!--
        换界规则必须与按钮同源:道果重掷与兵解转世都能另开天地,
        两条路都会清空本世路线进度。规则存在却不告诉玩家,和没有规则一样糟。
      -->
      <div class="card-ink px-4 py-3">
        <p class="font-kai text-title tracking-widest text-ink-soft">此界从何而来</p>
        <p class="mt-1.5 t-body text-ink-faint">
          你睁眼时,天地已成此形。所历地界、途中缓急、镇守之物皆随此世而定,
          <!-- 标点跟着前一句走:单独成行会在窄屏上被折成孤零零一个句号 -->
          <span class="text-ink-soft">此形既成,不主动换界就不会再变。</span>
        </p>
        <p class="mt-1 t-body text-ink-faint">
          舍
          <span class="text-cinnabar">道果</span>
          可立即换一方天地,清空本世路线进度; 待
          <span class="text-violet-ink">兵解转世</span>
          ,也会另开一片天地—— 与此世不同的地界、不同的路、不同的规矩。
        </p>
        <p class="mt-1 t-body text-ink-faint">
          此外诸界仍在,可回
          <span class="text-qing">历练</span>
          处另择他地,不必只走此路。
        </p>
      </div>

      <template v-if="historyRows.length">
        <SectionTitle title="前尘山河" :hint="`最近 ${historyRows.length} 世`" />
        <div class="card-ink divide-y divide-ink/6 px-4" data-world-history>
          <div
            v-for="(h, i) in historyRows"
            :key="h.seed"
            class="py-2.5"
            :data-world-history-row="i + 1"
          >
            <p class="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
              <span class="shrink-0 text-note text-ink-faint tabular" data-world-history-label>{{
                pastWorldLabel(i)
              }}</span>
              <span
                class="min-w-0 font-kai text-title tracking-[0.1em] text-ink"
                data-world-history-title
                >{{ h.title }}</span
              >
              <span
                class="ml-auto shrink-0 text-note text-ink-faint tabular"
                data-world-history-stages
                >{{ h.stages }} 段</span
              >
            </p>
            <p class="mt-0.5 text-note leading-relaxed text-ink-faint">{{ h.summary }}</p>
            <p class="mt-1 flex flex-wrap gap-x-2 gap-y-0.5 text-note">
              <span class="text-ink-faint">{{ h.tierText }}</span>
              <span class="text-cinnabar">命数 {{ h.ruleText }}</span>
              <span v-if="h.biasText" class="text-qing">所钟 {{ h.biasText }}</span>
            </p>
          </div>
        </div>
      </template>
    </template>
    <p v-else class="empty-note text-center text-body text-ink-faint">
      此世气象尚未凝成。天地未就,不妨先去历练,待此世凝成再来。
    </p>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { useRouter } from "vue-router";
import FolioPageHeader from "@/components/common/FolioPageHeader.vue";
import SectionTitle from "@/components/common/SectionTitle.vue";
import GameIcon from "@/components/common/GameIcon.vue";
import MortalRouteMap from "@/components/world/MortalRouteMap.vue";
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

function stageCardClass(index: number): string {
  const state = stageStatuses.value[index]?.state;
  if (state === "current") return "border-qing/45 bg-qing/4";
  if (state === "cleared") return "border-jade/25";
  return "border-dashed border-ink/15";
}

function stageMarkerClass(index: number): string {
  const state = stageStatuses.value[index]?.state;
  if (state === "cleared") return "border-jade/35 bg-jade/6 text-jade";
  if (state === "current") return "border-qing/45 bg-qing/6 text-qing";
  return "border-ink/15 bg-ink/4 text-ink-faint";
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
