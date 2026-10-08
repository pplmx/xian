<script setup lang="ts">
/**
 * 坊市 —— 灵石换机缘之地。货架买卖(购丹/续料/购兵刃)+ 售出(寄卖装备、即时售丹/料)。
 * 货架按墙钟刷新,离线照走;寄卖到时辰自售入账。判据与价签全在
 * core/marketService(纯)与 stores/market(编排),本页只做展示与点击。
 */
import { computed, onMounted, onUnmounted, ref } from "vue";
import { useRouter } from "vue-router";
import { goBack } from "@/router/goBack";
import { useMarketStore } from "@/stores/market";
import { useBountyStore } from "@/stores/bounty";
import { useInventoryStore } from "@/stores/inventory";
import { usePlayerStore } from "@/stores/player";
import { useResourcesStore } from "@/stores/resources";
import { pillDef } from "@/data/pills";
import { formatGN } from "@/utils/format";
import {
  MARKET_CONSIGN_SECONDS,
  MARKET_MAT_COUNT,
  MARKET_REFRESH_SECONDS,
  type MarketSlot,
} from "@/data/market";
import { marketEquipInstance, marketRemainingSec } from "@/core/marketService";
import { bountyRemainingSec } from "@/core/bountyService";
import { BOUNTY_REFRESH_SECONDS } from "@/data/bounty";

const router = useRouter();
const market = useMarketStore();
const bounty = useBountyStore();
const inventory = useInventoryStore();
const player = usePlayerStore();
const resources = useResourcesStore();

const now = ref(Date.now());
let timer: number | undefined;

onMounted(() => {
  market.sync(Date.now());
  market.collectConsign(Date.now());
  timer = window.setInterval(() => {
    const t = Date.now();
    now.value = t;
    // 到刷新窗口就重上一架/换一版悬赏、到时辰就收寄卖;其余时间不动架内货
    if (now.value >= market.stockedAt + MARKET_REFRESH_SECONDS * 1000) market.sync(t);
    market.collectConsign(t);
    if (now.value >= bounty.bountyAt + BOUNTY_REFRESH_SECONDS * 1000) bounty.sync(t);
  }, 1000);
  // 防在挂载时因窗口过期而屏内全空:过期即重上
  if (market.stockedAt > 0 && marketRemainingSec(market.stockedAt, Date.now()) <= 0) {
    market.sync(Date.now());
  }
});
onUnmounted(() => {
  if (timer !== undefined) window.clearInterval(timer);
});

const remainingSec = computed(() => marketRemainingSec(market.stockedAt, now.value));
const remainingText = computed(() => {
  const s = Math.floor(remainingSec.value);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h > 0 ? `${h}时${m}分` : `${m}分${s % 60}秒`;
});

/** 预览一件货架装备(确定性实例,不落库) */
function previewEquip(slot: MarketSlot) {
  if (slot.kind !== "equipment") return null;
  return marketEquipInstance(slot, market.stockedAt);
}

const sellablePills = computed(() =>
  Object.entries(inventory.pills)
    .filter(([, n]) => n > 0)
    .map(([id, n]) => ({ id, count: n, def: pillDef(id) }))
    .filter((p) => p.def?.recipe?.stoneBase),
);

function buySlot(idx: number): void {
  market.buy(idx);
}
function consign(uid: string): void {
  market.consignEquip(uid, Date.now());
}
function sellPill(id: string): void {
  market.sellPill(id);
}
function sellMat(matId: "herb" | "ore"): void {
  market.sellMaterial(matId, player.major);
}

const bountyRemainingText = computed(() => {
  const s = Math.floor(bountyRemainingSec(bounty.bountyAt, now.value));
  return `${Math.floor(s / 3600)}时${Math.floor((s % 3600) / 60)}分`;
});

function claimBounty(idx: number): void {
  bounty.claim(idx);
}
</script>

<template>
  <div class="stagger-in space-y-4 px-4 pb-6 pt-4">
    <!-- 抬头 -->
    <div class="card-ink flex items-center justify-between gap-2 px-4 py-3">
      <button
        class="-my-1.5 py-1.5 text-left text-[12px] text-ink-faint active:text-ink-soft"
        @click="goBack(router, { name: 'dongfu' })"
      >
        ← 返回
      </button>
      <div class="min-w-0 text-center">
        <p class="font-kai text-[15px] tracking-[0.3em] text-ink">坊市</p>
        <p class="text-[10px] text-ink-faint">灵石换机缘 · 时来运转</p>
      </div>
      <span
        class="rounded-md border border-ink/10 px-1.5 py-0.5 text-[10px] tabular text-ink-faint"
        :title="`${MARKET_REFRESH_SECONDS / 3600} 小时一换`"
      >
        刷新 {{ remainingText }}
      </span>
    </div>

    <!-- 货架 -->
    <section>
      <p class="mb-2 px-1 font-kai text-[13px] tracking-[0.2em] text-ink">货架</p>
      <div class="space-y-2">
        <div
          v-for="slot in market.stock"
          :key="slot.idx"
          class="flex items-center gap-2 rounded-lg border border-ink/10 bg-surface/60 px-3 py-2"
          :class="slot.sold ? 'opacity-50' : ''"
        >
          <div class="min-w-0 flex-1 text-[12px]">
            <template v-if="slot.kind === 'pill'">
              <p class="truncate">
                {{ pillDef(slot.pillId)?.name ?? slot.pillId }}
                <span class="text-ink-faint">×{{ slot.count }}</span>
              </p>
              <p class="text-[10px] text-ink-faint">一枚丹方之味</p>
            </template>
            <template v-else-if="slot.kind === 'material'">
              <p class="truncate">
                {{ slot.matId === "herb" ? "灵草" : "玄铁" }} ×{{ MARKET_MAT_COUNT }}
              </p>
              <p class="text-[10px] text-ink-faint">续洞府生产之料</p>
            </template>
            <template v-else>
              <p class="truncate">
                {{ previewEquip(slot)?.quality }} 阶·{{ player.major }} 层
                <span class="text-ink-faint">
                  品质底档{{ (slot as { minQualityRank: number }).minQualityRank }}
                </span>
              </p>
              <p class="text-[10px] text-ink-faint">一件已定兵刃,到手即用</p>
            </template>
          </div>
          <span class="text-[12px] tabular text-cinnabar">{{ formatGN(slot.price) }}灵石</span>
          <button
            class="btn-seal !px-3 !py-1 text-[11px]"
            :disabled="slot.sold"
            @click="buySlot(slot.idx)"
          >
            {{ slot.sold ? "已售" : "购入" }}
          </button>
        </div>
        <p v-if="market.stock.length === 0" class="py-3 text-center text-[11px] text-ink-faint">
          货架空着 —— 时辰一到自会换新。
        </p>
      </div>
    </section>

    <!-- 悬赏板:商号收购 -->
    <section>
      <p class="mb-2 px-1 font-kai text-[13px] tracking-[0.2em] text-ink">
        悬赏板
        <span
          class="text-[10px] tracking-normal text-ink-faint"
          :title="`${BOUNTY_REFRESH_SECONDS / 3600} 小时一版`"
        >
          换新 {{ bountyRemainingText }}
        </span>
      </p>
      <div class="space-y-2">
        <div
          v-for="o in bounty.orders"
          :key="o.idx"
          class="flex items-center gap-2 rounded-lg border border-ink/10 bg-surface/60 px-3 py-2"
          :class="o.claimed ? 'opacity-50' : ''"
        >
          <div class="min-w-0 flex-1 text-[12px]">
            <template v-if="o.kind === 'herb' || o.kind === 'ore'">
              <p class="truncate">募 {{ o.kind === "herb" ? "灵草" : "玄铁" }} ×{{ o.target }}</p>
              <p class="text-[10px] text-ink-faint">交货即得灵石</p>
            </template>
            <template v-else-if="o.kind === 'pill'">
              <p class="truncate">{{ pillDef(o.kindId)?.name ?? o.kindId }} ×{{ o.target }}</p>
              <p class="text-[10px] text-ink-faint">另得悟道×{{ o.extra }}</p>
            </template>
            <template v-else>
              <p class="truncate">贡一柄 ≥{{ o.tier }} 阶兵刃</p>
              <p class="text-[10px] text-ink-faint">价随所交之品质现算</p>
            </template>
          </div>
          <span class="text-[12px] tabular text-cinnabar">{{ formatGN(o.reward) }}灵石</span>
          <button
            class="btn-seal !px-3 !py-1 text-[11px]"
            :disabled="o.claimed"
            @click="claimBounty(o.idx)"
          >
            {{ o.claimed ? "已交" : "交货" }}
          </button>
        </div>
        <p v-if="bounty.orders.length === 0" class="py-3 text-center text-[11px] text-ink-faint">
          悬赏板空着 —— 商号还没挂单。
        </p>
      </div>
    </section>

    <!-- 售出:寄卖装备 + 即时售丹/料 -->
    <section>
      <p class="mb-2 px-1 font-kai text-[13px] tracking-[0.2em] text-ink">售出</p>

      <!-- 寄卖中的 -->
      <div v-if="market.consign.length" class="mb-2 space-y-1">
        <div
          v-for="p in market.consign"
          :key="p.slot"
          class="flex items-center gap-2 rounded-md border border-ink/10 bg-surface/40 px-3 py-1.5 text-[11px]"
        >
          <span class="flex-1 truncate">{{ p.name }}</span>
          <span class="tabular text-ink-faint">
            {{ Math.max(0, Math.ceil((p.finishAt - now) / 1000 / 60)) }}分后自售 ·
            {{ formatGN(p.price) }}
          </span>
        </div>
      </div>

      <!-- 寄卖入口:挑一件背包装备上架 -->
      <div class="rounded-lg border border-ink/10 bg-surface/40 px-3 py-2">
        <p class="mb-1 text-[10px] text-ink-faint">
          寄卖一件背包装备(2 格,约 {{ MARKET_CONSIGN_SECONDS / 60 }} 分自售入账,离包即定)
        </p>
        <div v-if="market.consign.length < 2" class="flex gap-1 overflow-x-auto">
          <button
            v-for="it in inventory.bagItems.slice(0, 12)"
            :key="it.uid"
            class="shrink-0 rounded border border-ink/10 px-2 py-1 text-[10px] hover:border-cinnabar"
            @click="consign(it.uid)"
          >
            {{ it.quality }}·{{ it.tier }}阶
          </button>
          <span v-if="inventory.bagItems.length === 0" class="text-[10px] text-ink-faint"
            >行囊空空</span
          >
        </div>
        <p v-else class="text-[10px] text-ink-faint">已上满 2 格,待手头一张空闲</p>
      </div>

      <!-- 即时售 -->
      <div
        class="mt-2 flex flex-wrap items-center gap-2 rounded-lg border border-ink/10 bg-surface/40 px-3 py-2"
      >
        <button
          v-for="p in sellablePills"
          :key="p.id"
          class="rounded border border-ink/10 px-2 py-1 text-[10px] hover:border-cinnabar"
          :disabled="!p.def?.recipe?.stoneBase"
          @click="sellPill(p.id)"
        >
          售{{ p.def?.name ?? p.id }}({{ p.count }})
        </button>
        <button
          class="rounded border border-ink/10 px-2 py-1 text-[10px] hover:border-cinnabar"
          :disabled="!resources.hasSmall('herb', MARKET_MAT_COUNT)"
          @click="sellMat('herb')"
        >
          售灵草×{{ MARKET_MAT_COUNT }}
        </button>
        <button
          class="rounded border border-ink/10 px-2 py-1 text-[10px] hover:border-cinnabar"
          :disabled="!resources.hasSmall('ore', MARKET_MAT_COUNT)"
          @click="sellMat('ore')"
        >
          售玄铁×{{ MARKET_MAT_COUNT }}
        </button>
        <span v-if="sellablePills.length === 0" class="text-[10px] text-ink-faint"
          >无可即时售出的丹药</span
        >
      </div>
    </section>
  </div>
</template>
