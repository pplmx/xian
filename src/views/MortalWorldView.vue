<template>
  <div class="stagger-in space-y-4 px-4 pb-6 pt-4">
    <template v-if="view">
      <!-- 世界身份占据第一视觉位:标题是这一世的名字,不是通用标签 -->
      <div>
        <h1 class="font-kai text-[19px] tracking-[0.12em] text-ink">{{ view.title }}</h1>
        <p class="mt-1 t-body text-ink-faint">本世之界 · {{ view.summary }}</p>
        <!-- 路线形状的一句话:几段、层级跨度多大 —— 概览里先给结论,细节留给下面的路线图 -->
        <p class="mt-0.5 text-[11px] text-ink-faint" data-world-shape>
          {{ view.stages }} 段地界 · {{ view.tierText }} · 已过 {{ view.clearedStages }}/{{
            view.stages
          }}
        </p>
        <p class="mt-0.5 text-[11px] text-cinnabar">
          此世命数:{{ view.ruleText
          }}<span class="text-ink-faint"
            >（此世气象之名:成形时用它校准难度,但它不改写历练里的战斗）</span
          >
        </p>
        <!--
          资源偏向必须写明兑现方式:摘要里那句「矿脉深厚之地」若没有数字跟着,
          玩家会把它当纯flavor —— 而它现在真的乘在玄铁掉率上(见 core/mortalBias)。
        -->
        <p v-if="view.biasText" class="mt-0.5 text-[11px] text-ink-faint">
          此地所钟:{{ view.biasText }}
        </p>
        <!--
          道果出口之一:换一方天地。发的是**选择权**,不是数值 —— 出口的发放物不得属于
          StatMods 命名空间(见 core/fruitOutlets.spec 的结论)。不够时把差多少写出来。
        -->
        <button
          class="btn-ghost mt-2 min-h-[28px] !px-3 !py-1 text-[11px]"
          :disabled="!canRerollWorld"
          data-world-reroll
          @click="rerollConfirm = true"
        >
          换一方天地({{ rerollCost }} 道果{{ canRerollWorld ? "" : ` · 尚差 ${shortfall} 枚` }})
        </button>
        <!--
          换界的代价必须写在按钮下面:setMortalWorld 会把本世路线进度清零(「换界即换路」)。
          只说价、不说会清进度,等于让玩家在不知情的情况下丢掉已经走过的路。
        -->
        <p class="mt-1 text-[10px] leading-relaxed text-ink-faint">
          换界即换路:已走的本世路线会清零,所钟与地貌构成随之更换。
        </p>

        <BaseModal :open="rerollConfirm" title="换一方天地" @close="rerollConfirm = false">
          <p class="t-body leading-relaxed">
            耗 <span class="text-cinnabar tabular">{{ rerollCost }}</span> 枚道果,
            <span class="text-ink">本世路线进度清零</span>,所钟与地貌重掷。
          </p>
          <p class="mt-1 text-[11px] text-ink-faint">
            现有 {{ player.reincarnation.daoFruit }} 枚 · 换完剩
            {{ Math.max(0, player.reincarnation.daoFruit - rerollCost) }} 枚。 这一步不可逆 ——
            走过的地界要重新走。
          </p>
          <div class="mt-3 flex justify-end gap-2">
            <button class="btn-ghost min-h-[32px] !px-3 text-[11px]" @click="rerollConfirm = false">
              再想想
            </button>
            <button
              class="btn-primary min-h-[32px] !px-4 text-[11px]"
              data-world-reroll-confirm
              @click="confirmReroll"
            >
              换
            </button>
          </div>
        </BaseModal>
      </div>

      <!-- 路线全貌:高低即层级,横距即路程,点大即事多 -->
      <div class="card-ink px-3 py-2">
        <svg
          :viewBox="`0 0 ${VIEW_W} ${VIEW_H}`"
          class="h-16 w-full"
          role="img"
          aria-label="本世路线"
        >
          <polyline
            :points="polyline"
            fill="none"
            stroke="currentColor"
            stroke-width="1"
            class="text-ink/15"
          />
          <circle
            v-for="p in view.places"
            :key="p.nodeId"
            :cx="p.x"
            :cy="p.y"
            :r="p.r"
            :class="
              cleared(p.nodeId) ? 'text-jade' : unlocked(p.nodeId) ? 'text-qing' : 'text-ink-faint'
            "
            fill="currentColor"
            :fill-opacity="unlocked(p.nodeId) ? 0.85 : 0.35"
          />
        </svg>
        <p class="mt-0.5 text-center text-[10px] text-ink-faint">
          高处境深 · 远处路长 · 点大处事多
        </p>
      </div>

      <SectionTitle title="本世地界" hint="这一世的路,按段而行" />
      <div class="space-y-2">
        <div
          v-for="p in view.places"
          :key="p.nodeId"
          class="card-ink flex items-center gap-3 px-3 py-2.5"
          :class="{ 'border-dashed border-ink/15': !unlocked(p.nodeId) }"
        >
          <span
            class="grid h-9 w-9 shrink-0 place-items-center rounded-md"
            :class="unlocked(p.nodeId) ? 'bg-qing/6 text-qing' : 'bg-ink/6 text-ink-faint'"
          >
            <GameIcon
              :name="unlocked(p.nodeId) ? (regionDef(p.regionId)?.icon ?? 'mountain') : 'lock'"
              :size="16"
            />
          </span>
          <div class="min-w-0 grow">
            <p class="flex items-baseline gap-1.5">
              <span class="truncate font-kai text-[14px] text-ink">{{ p.name }}</span>
              <span class="shrink-0 text-[11px] text-qing">{{ p.terrain }}</span>
              <span v-if="cleared(p.nodeId)" class="shrink-0 text-[10px] text-jade">已通</span>
            </p>
            <p class="mt-0.5 flex items-center gap-2 text-[10px] text-ink-faint">
              <span class="truncate">镇守 {{ p.bossName }}</span>
              <span class="flex shrink-0 gap-0.5">
                <span
                  v-for="n in p.eventLevel"
                  :key="n"
                  class="h-1 w-1 rounded-full bg-gold-ink/60"
                />
              </span>
            </p>
            <!-- 锁住的地界要给一句"为什么现在去不了",而不是只画把锁 -->
            <p v-if="!unlocked(p.nodeId)" class="mt-0.5 text-[10px] leading-relaxed text-cinnabar">
              {{ blockReason(p.regionId) ?? "此境未开,须先走完这一世的来时路" }}
            </p>
          </div>
          <!-- 已通的段落照样能再去 —— 「已通」是记号,不是封路 -->
          <button
            v-if="unlocked(p.nodeId)"
            class="btn-seal shrink-0 !px-3 !py-1.5 !text-[11px]"
            @click="depart(p.regionId)"
          >
            出 发
          </button>
        </div>
      </div>

      <!--
        换界规则必须写明:目前唯一的换界时机是兵解转世,玩家没有主动手段。
        规则存在却不告诉玩家,和没有规则一样糟
      -->
      <div class="card-ink px-4 py-3">
        <p class="font-kai text-[14px] tracking-widest text-ink-soft">此界从何而来</p>
        <p class="mt-1.5 t-body text-ink-faint">
          你睁眼时,天地已成此形。所历地界、途中缓急、镇守之物皆随此世而定,
          <!-- 标点跟着前一句走:单独成行会在窄屏上被折成孤零零一个句号 -->
          <span class="text-ink-soft">这一世之内不会再变。</span>
        </p>
        <p class="mt-1 t-body text-ink-faint">
          唯有
          <span class="text-violet-ink">兵解转世</span>
          ,方另开一片天地—— 与此世不同的地界、不同的路、不同的规矩。
        </p>
        <p class="mt-1 t-body text-ink-faint">
          此外诸界仍在,可回
          <span class="text-qing">历练</span>
          处另择他地,不必只走此路。
        </p>
      </div>
    </template>
    <p v-else class="empty-note text-center text-[11px] text-ink-faint">
      此世气象尚未凝成。天地未就,不妨先去历练,待此世凝成再来。
    </p>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { useRouter } from "vue-router";
import SectionTitle from "@/components/common/SectionTitle.vue";
import GameIcon from "@/components/common/GameIcon.vue";
import { useAdventureStore } from "@/stores/adventure";
import { usePlayerStore } from "@/stores/player";
import { useUiStore } from "@/stores/ui";
import BaseModal from "@/components/common/BaseModal.vue";
import { rerollWorldByFruit, worldRerollCost } from "@/core/worldReroll";
import { rerollMortalWorld } from "@/core/mortalWorldService";
import { enemyDef } from "@/data/enemies";
import { regionDef } from "@/data/regions";
import {
  VIEW_H,
  VIEW_W,
  canEnterNode,
  ensureMortalWorld,
  entryBlockReason,
  isNodeCleared,
  worldView,
} from "@/core/mortalWorldService";

const adventure = useAdventureStore();
const player = usePlayerStore();
const ui = useUiStore();
/** 换一方天地的按钮态:不够时按钮置灰,并把差多少写出来 */
/** 这一次换世界的价(按余额抽成,见 core/worldReroll 的口径) */
const rerollCost = computed(() => worldRerollCost(player.reincarnation.daoFruit));
const canRerollWorld = computed(
  () => player.reincarnation.daoFruit >= rerollCost.value && !adventure.sessionActive,
);
const shortfall = computed(() => Math.max(0, rerollCost.value - player.reincarnation.daoFruit));
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
    reroll: () => rerollMortalWorld(),
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

/** 路线折线 —— 纵向绑定层级,故回落看得见 */
const polyline = computed(() =>
  view.value ? view.value.places.map((p) => `${p.x},${p.y}`).join(" ") : "",
);

function unlocked(nodeId: string): boolean {
  return canEnterNode(nodeId);
}

function cleared(nodeId: string): boolean {
  return isNodeCleared(nodeId);
}

function blockReason(regionId: string): string | null {
  return entryBlockReason(regionId);
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
