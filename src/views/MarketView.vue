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
import { herbGradeOfMajor } from "@/data/herbGrades";
import { formatCountdown, formatGN } from "@/utils/format";
import { toNum } from "@/utils/gnum";
import type { GNum } from "@/types";
import {
  MARKET_CONSIGN_SECONDS,
  MARKET_CONSIGN_SLOTS,
  MARKET_MAT_COUNT,
  MARKET_REFRESH_SECONDS,
} from "@/data/market";
import type { BountySlot } from "@/data/bounty";
import { marketEquipInstance, marketRemainingSec } from "@/core/marketService";
import { bountyRemainingSec } from "@/core/bountyService";
import { notify } from "@/core/notify";
import { BOUNTY_REFRESH_SECONDS } from "@/data/bounty";
import { qualityDef } from "@/data/qualities";
import { equipmentTemplate } from "@/data/equipment";
import SectionTitle from "@/components/common/SectionTitle.vue";
import BaseModal from "@/components/common/BaseModal.vue";

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

/**
 * 货架装备预览(确定性实例,只取品质,不落库)。缓成 per-slot 表:
 * 只随货架 / 上货时刻重算,不再随每秒的倒计时重掷整件装备(避免每个 tick 生成 6 次)。
 */
const previews = computed<Record<number, string>>(() => {
  const m: Record<number, string> = {};
  for (const s of market.stock) {
    if (s.kind === "equipment") m[s.idx] = marketEquipInstance(s, market.stockedAt).quality;
  }
  return m;
});

const sellablePills = computed(() =>
  Object.entries(inventory.pills)
    .filter(([, n]) => n > 0)
    .map(([id, n]) => ({ id, count: n, def: pillDef(id) }))
    .filter((p) => p.def?.recipe?.stoneBase),
);

function buySlot(idx: number): void {
  const r = market.buy(idx);
  if (r === "poor") notify("灵石不足,购入不成", "warn");
}

/** 购入短差:买得起念全价,付不起换口「尚差 X 石」 */
function stoneShort(cost: GNum): number {
  return Math.max(0, toNum(cost) - toNum(resources.spiritStone));
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

function claimBounty(idx: number): void {
  const slot = bounty.orders.find((o) => o.idx === idx);
  // 贡器要选交哪一件,不能悄悄拿走行囊里顺着序排在第一件的够格兵刃
  // (可能正是刚重铸/升级过的心头好) —— 点开挑一件,再交。
  if (slot && slot.kind === "equip") {
    equipPick.value = idx;
    return;
  }
  const r = bounty.claim(idx);
  if (r === "insufficient") notify("材料或丹药不足,交不了货", "warn");
  else if (r === "nobag") notify("行囊里没有够阶的兵刃", "warn");
}

/** 正在点选交付兵刃的那单悬赏(idx;null = 未在挑) */
const equipPick = ref<number | null>(null);

/** 贡器单可交付的够格行囊兵刃(与 claim 的找回谓词同源:阶 ≥ 订单要求) */
const equipCandidates = computed(() => {
  if (equipPick.value === null) return [];
  const slot = bounty.orders.find((o) => o.idx === equipPick.value);
  if (!slot || slot.kind !== "equip" || slot.claimed) return [];
  return inventory.bagItems.filter((e) => e.tier >= slot.tier);
});

function deliverPicked(uid: string): void {
  if (equipPick.value === null) return;
  const r = bounty.claimEquip(equipPick.value, uid);
  equipPick.value = null;
  if (r === "insufficient") notify("这件不够阶,换一件", "warn");
}

/** 逐单交货短差:够交回 null,不够列「需 N X,缺 M」(与「尚差 N 石」同一纪律) */
function bountyShort(o: BountySlot): string | null {
  if (o.claimed) return null;
  if (o.kind === "herb" || o.kind === "ore") {
    const isHerb = o.kind === "herb";
    const have = isHerb ? resources.herbs[herbGradeOfMajor(player.major)] : resources.ore;
    if (have >= o.target) return null;
    return `需 ${o.target} ${isHerb ? "灵草" : "玄铁"},缺 ${o.target - have}`;
  }
  if (o.kind === "pill") {
    const have = inventory.pills[o.kindId] ?? 0;
    if (have >= o.target) return null;
    return `需 ${o.target} ${pillDef(o.kindId)?.name ?? o.kindId},缺 ${o.target - have}`;
  }
  const have = inventory.bagItems.filter((e) => e.tier >= o.tier).length;
  if (have > 0) return null;
  return `缺一件 ≥${o.tier} 阶兵刃`;
}
</script>

<template>
  <div class="stagger-in space-y-4 px-4 pb-6 pt-4">
    <!-- 抬头 -->
    <div class="card-ink flex items-center justify-between gap-2 px-4 py-3">
      <button
        class="tap-row -my-1.5 py-1.5 text-left text-[12px] text-ink-faint active:text-ink-soft"
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
        刷新
        <span class="countdown-slot">{{ formatCountdown(remainingSec) }}</span>
      </span>
    </div>

    <!-- 货架 -->
    <section>
      <SectionTitle title="货架" hint="时辰一到自会换新" />
      <div class="mt-2 space-y-2">
        <div
          v-for="slot in market.stock"
          :key="slot.idx"
          class="flex items-center gap-2 rounded-lg border border-ink/10 bg-paper-deep/60 px-3 py-2"
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
                {{ previews[slot.idx] }}·{{ slot.tier }} 层
                <span class="text-ink-faint"
                  >品质底档{{ (slot as { minQualityRank: number }).minQualityRank }}</span
                >
              </p>
              <p class="text-[10px] text-ink-faint">一件已定兵刃,到手即用</p>
            </template>
          </div>
          <span class="text-[12px] tabular text-cinnabar">{{ formatGN(slot.price) }}灵石</span>
          <button
            class="btn-seal !px-3 !py-1 text-[11px]"
            :disabled="slot.sold || !resources.hasStone(slot.price)"
            @click="buySlot(slot.idx)"
          >
            {{
              slot.sold
                ? "已售"
                : resources.hasStone(slot.price)
                  ? "购入"
                  : `尚差 ${formatGN(stoneShort(slot.price))} 石`
            }}
          </button>
        </div>
        <p v-if="market.stock.length === 0" class="py-3 text-center text-[11px] text-ink-faint">
          货架空着 —— 时辰一到自会换新。
        </p>
      </div>
    </section>

    <!-- 悬赏板:商号收购 -->
    <section>
      <div class="flex items-center justify-between pr-1">
        <SectionTitle title="悬赏板" />
        <span
          class="text-[10px] text-ink-faint"
          :title="`${BOUNTY_REFRESH_SECONDS / 3600} 小时一版`"
          >换新
          <span class="countdown-slot">{{
            formatCountdown(bountyRemainingSec(bounty.bountyAt, now))
          }}</span></span
        >
      </div>
      <div class="mt-1 space-y-2">
        <div
          v-for="o in bounty.orders"
          :key="o.idx"
          class="flex items-center gap-2 rounded-lg border border-ink/10 bg-paper-deep/60 px-3 py-2"
          :class="o.claimed ? 'opacity-50' : ''"
        >
          <div class="min-w-0 flex-1 text-[12px]">
            <template v-if="o.kind === 'herb' || o.kind === 'ore'">
              <p class="truncate">募 {{ o.kind === "herb" ? "灵草" : "玄铁" }} ×{{ o.target }}</p>
              <p v-if="bountyShort(o)" class="text-[10px] text-cinnabar">
                {{ bountyShort(o) }}
              </p>
              <p v-else class="text-[10px] text-ink-faint">交货即得灵石</p>
            </template>
            <template v-else-if="o.kind === 'pill'">
              <p class="truncate">{{ pillDef(o.kindId)?.name ?? o.kindId }} ×{{ o.target }}</p>
              <p v-if="bountyShort(o)" class="text-[10px] text-cinnabar">
                {{ bountyShort(o) }}
              </p>
              <p v-else class="text-[10px] text-ink-faint">另得悟道×{{ o.extra }}</p>
            </template>
            <template v-else>
              <p class="truncate">贡一柄 ≥{{ o.tier }} 阶兵刃</p>
              <p v-if="bountyShort(o)" class="text-[10px] text-cinnabar">
                {{ bountyShort(o) }}
              </p>
              <p v-else class="text-[10px] text-ink-faint">价随所交之品质现算</p>
            </template>
          </div>
          <span class="text-[12px] tabular text-cinnabar">{{ formatGN(o.reward) }}灵石</span>
          <button
            class="btn-seal !px-3 !py-1 text-[11px]"
            :disabled="o.claimed || !!bountyShort(o)"
            @click="claimBounty(o.idx)"
          >
            {{ o.claimed ? "已交" : "交货" }}
          </button>
        </div>
        <p v-if="bounty.orders.length === 0" class="py-3 text-center text-[11px] text-ink-faint">
          悬赏板空着 —— 商号还没挂单,下个时辰自会换新。
        </p>
      </div>
    </section>

    <!-- 贡器点选:挑一件交付,价随所交之品质现算,交了就没了 -->
    <BaseModal
      :open="equipPick !== null"
      title="贡一件兵刃"
      aria-label="交付兵刃"
      @close="equipPick = null"
    >
      <p class="mb-2 text-[11px] text-ink-faint">
        交付就没了 —— 挑一件你舍得交的。价随所交之品质现算。
      </p>
      <div class="space-y-1">
        <button
          v-for="it in equipCandidates"
          :key="it.uid"
          class="flex w-full items-center justify-between gap-2 rounded border border-ink/10 px-3 py-2 text-left text-[12px] hover:border-cinnabar"
          @click="deliverPicked(it.uid)"
        >
          <span class="min-w-0 truncate">
            <span class="font-kai" :style="{ color: qualityDef(it.quality).color }">
              {{ equipmentTemplate(it.templateId)?.name ?? "无名法器" }}
            </span>
            <span class="ml-1 text-ink-faint"
              >{{ qualityDef(it.quality).name }} · {{ it.tier }}阶</span
            >
          </span>
          <span class="shrink-0 text-cinnabar">交付</span>
        </button>
        <p v-if="equipCandidates.length === 0" class="text-[11px] text-ink-faint">没有够阶的兵刃</p>
      </div>
    </BaseModal>

    <!-- 售出:寄卖装备 + 即时售丹/料 -->
    <section>
      <SectionTitle title="售出" />
      <div class="mt-2">
        <!-- 寄卖中的 -->
        <div v-if="market.consign.length" class="mb-2 space-y-1">
          <div
            v-for="p in market.consign"
            :key="p.slot"
            class="flex items-center gap-2 rounded-md border border-ink/10 bg-paper-deep/40 px-3 py-1.5 text-[11px]"
          >
            <span class="flex-1 truncate">{{ p.name }}</span>
            <span class="tabular text-ink-faint">
              <span class="countdown-slot">{{
                formatCountdown(Math.max(0, (p.finishAt - now) / 1000))
              }}</span>
              后自售 · {{ formatGN(p.price) }}
            </span>
          </div>
        </div>

        <!-- 寄卖入口:挑一件背包装备上架 -->
        <div class="rounded-lg border border-ink/10 bg-paper-deep/40 px-3 py-2">
          <p class="mb-1 text-[10px] text-ink-faint">
            寄卖一件背包装备({{ MARKET_CONSIGN_SLOTS }} 格,约
            {{ MARKET_CONSIGN_SECONDS / 60 }} 分自售入账,离包即定)
          </p>
          <div
            v-if="market.consign.length < MARKET_CONSIGN_SLOTS"
            class="flex gap-1 overflow-x-auto"
          >
            <button
              v-for="it in inventory.bagItems.slice(0, 12)"
              :key="it.uid"
              class="shrink-0 rounded border border-ink/10 px-2 py-1 text-[10px] hover:border-cinnabar"
              @click="consign(it.uid)"
            >
              {{ it.quality }}·{{ it.tier }}阶
            </button>
            <span v-if="inventory.bagItems.length === 0" class="text-[10px] text-ink-faint"
              >行囊空空 —— 去历练中寻些机缘吧</span
            >
          </div>
          <p v-else class="text-[10px] text-ink-faint">
            已上满 {{ MARKET_CONSIGN_SLOTS }} 格,待手头一张空闲
          </p>
        </div>

        <!-- 即时售 -->
        <div
          class="mt-2 flex flex-wrap items-center gap-2 rounded-lg border border-ink/10 bg-paper-deep/40 px-3 py-2"
        >
          <button
            v-for="p in sellablePills"
            :key="p.id"
            class="rounded border border-ink/10 px-2 py-1 text-[10px] hover:border-cinnabar"
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
            >并无即时可售的丹药 —— 历练所得,自能入市</span
          >
        </div>
      </div>
    </section>
  </div>
</template>
