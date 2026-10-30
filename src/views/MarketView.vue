<script setup lang="ts">
import "@/styles/pages/market.css";
/**
 * 坊市 —— 灵石换机缘之地。货架买卖(购丹/续料/购兵刃)+ 售出(寄卖装备、即时售丹/料)。
 * 货架按墙钟刷新,离线照走;寄卖到时辰自售入账。判据与价签全在
 * core/marketService(纯)与 stores/market(编排),本页只做展示与点击。
 */
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from "vue";
import { useMarketStore } from "@/stores/market";
import { useBountyStore } from "@/stores/bounty";
import { useInventoryStore } from "@/stores/inventory";
import { usePlayerStore } from "@/stores/player";
import { useResourcesStore } from "@/stores/resources";
import { pillDef } from "@/data/pills";
import { RESOURCE_LABELS } from "@/data/resourceNames";
import { formatCountdown, formatGN } from "@/utils/format";
import { add, gn, toNum } from "@/utils/gnum";
import type { EquipmentInstance, GNum, QualityId } from "@/types";
import {
  MARKET_CONSIGN_SECONDS,
  MARKET_CONSIGN_SLOTS,
  MARKET_MAT_COUNT,
  MARKET_REFRESH_SECONDS,
} from "@/data/market";
import type { BountySlot } from "@/data/bounty";
import {
  marketEquipInstance,
  marketRemainingSec,
  consignPrice,
  pillSellPrice,
  materialSellPrice,
} from "@/core/marketService";
import {
  INVENTORY_RENDER_BATCH,
  MARKET_RENDER_WINDOW,
  inventoryWindow,
  nextInventoryLimit,
  previousInventoryLimit,
} from "@/core/inventoryRender";
import { firstNewVisibleIndex, previousListStep } from "@/core/listRender";
import { bountyRemainingSec, equipBountyReward } from "@/core/bountyService";
import { bountyStatus, marketOverview } from "@/core/marketOverview";
import { notify } from "@/core/notify";
import { BOUNTY_REFRESH_SECONDS } from "@/data/bounty";
import { qualityDef, QUALITIES } from "@/data/qualities";
import { equipmentTemplate } from "@/data/equipment";
import { colorWithAlpha } from "@/ui/colorVar";
import { isRareQuality, qualityTextColor, qualityTierStyle } from "@/ui/qualityTier";
import QualitySeal from "@/components/common/QualitySeal.vue";
import FolioPageHeader from "@/components/common/FolioPageHeader.vue";
import LedgerHeader from "@/components/common/LedgerHeader.vue";
import SectionTitle from "@/components/common/SectionTitle.vue";
import BaseModal from "@/components/common/BaseModal.vue";
import InkTabs from "@/components/common/InkTabs.vue";
import MarketArcade from "@/components/market/MarketArcade.vue";

const market = useMarketStore();
const bounty = useBountyStore();
const inventory = useInventoryStore();
const player = usePlayerStore();
const resources = useResourcesStore();

const now = ref(Date.now());
let timer: number | undefined;

onMounted(() => {
  market.sync(Date.now());
  bounty.sync(Date.now());
  // 挂载一拍自然售出的寄卖,给一声(开页回城不该只盯着数字变;此后每秒定时器里的递进又自可见)
  const sold = market.collectConsign(Date.now());
  if (sold.length) notify(`「${sold.join("、")}」已自售,灵石到账`, "success");
  /*
   * 墙钟域,**不走** useGameClock(暂停冻结):货架换新 / 悬赏换版 / 寄卖自售
   * 都按墙钟结算 —— 离线照算,App.vue「归来一拍即收」也是墙钟口径。重置/导入
   * 确认开着的几分钟,不该让货架晚一点换新、寄卖晚一步入账;故这里保留手写
   * Date.now() 的 interval,不收进游戏钟(口径见 composables/useGameClock 注释)。
   */
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

type MarketTab = "shelf" | "bounty" | "sell";
const MARKET_TABS: { id: MarketTab; label: string }[] = [
  { id: "shelf", label: "货架" },
  { id: "bounty", label: "悬赏" },
  { id: "sell", label: "售出" },
];
const marketTab = ref<MarketTab>("shelf");

const bountyHoldings = computed(() => ({
  herbs: resources.herb,
  ore: resources.ore,
  pills: inventory.pills,
  bagTiers: inventory.bagItems.map((item) => item.tier),
}));

/** 卷首市况与页签朱点共用这一份真值，避免「亮着可交、点进去却缺货」。 */
const marketPulse = computed(() =>
  marketOverview(market.stock, bounty.orders, bountyHoldings.value, market.consign.length),
);
const marketTabRows = computed(() =>
  MARKET_TABS.map((t) => ({
    ...t,
    dot:
      (t.id === "bounty" && marketPulse.value.claimableBounties > 0) ||
      (t.id === "sell" && marketPulse.value.consignCount > 0),
  })),
);

// 在长货架底部换册时，内容区会继承旧的 scrollTop；新册较短时便落在半截。
watch(marketTab, () => {
  void nextTick(() => {
    const host = document.querySelector<HTMLElement>("main");
    if (host) host.scrollTop = 0;
  });
});

/** 顶栏只报当前这一册的时钟；切到悬赏后仍挂货架倒计时会像另一本账。 */
const headerClock = computed(() => {
  if (marketTab.value === "bounty") {
    return {
      label: "换榜",
      text: formatCountdown(bountyRemainingSec(bounty.bountyAt, now.value)),
      title: `${BOUNTY_REFRESH_SECONDS / 3600} 小时一版`,
    };
  }
  if (marketTab.value === "sell") {
    return {
      label: "寄售",
      text: `${marketPulse.value.consignCount}/${MARKET_CONSIGN_SLOTS}`,
      title: `${MARKET_CONSIGN_SECONDS / 60} 分钟自售入账`,
    };
  }
  return {
    label: "换货",
    text: formatCountdown(remainingSec.value),
    title: `${MARKET_REFRESH_SECONDS / 3600} 小时一换`,
  };
});

/** 最近一件寄售的归账时刻；卷首只报这一件，逐件倒计时仍在售出册里。 */
const nextConsign = computed(() => {
  const next = [...market.consign].sort((a, b) => a.finishAt - b.finishAt)[0];
  if (!next) return { text: "暂无寄卖", at: null };
  const sec = Math.max(0, Math.ceil((next.finishAt - now.value) / 1000));
  return { text: `最近 ${formatCountdown(sec)} 后入账`, at: next.finishAt };
});

/**
 * 卷首总账与市桥图共用这一份行市读数。三册都可从这里直接落位，
 * 不再让玩家先看一组漂亮数字、再自己猜该翻哪一册。
 */
const marketLedgerRows = computed(() => [
  {
    id: "shelf" as const,
    mark: "货",
    label: "货架",
    value: marketPulse.value.availableGoods,
    total: marketPulse.value.goodsTotal,
    unit: "件可买",
    detail: `换货 ${formatCountdown(remainingSec.value)}`,
  },
  {
    id: "bounty" as const,
    mark: "赏",
    label: "悬赏",
    value: marketPulse.value.claimableBounties,
    total: marketPulse.value.openBounties,
    unit: "单可交",
    detail: `换榜 ${formatCountdown(bountyRemainingSec(bounty.bountyAt, now.value))}`,
  },
  {
    id: "sell" as const,
    mark: "寄",
    label: "寄卖",
    value: marketPulse.value.consignCount,
    total: MARKET_CONSIGN_SLOTS,
    unit: "格在用",
    detail: nextConsign.value.text,
  },
]);

/** 眼下最先能落手的一件事；只读同一份市况，不再另算一套「看起来可做」。 */
const marketLead = computed(() => {
  const p = marketPulse.value;
  if (p.claimableBounties > 0) {
    return {
      tab: "bounty" as const,
      mark: "先收",
      title: `${p.claimableBounties} 单悬赏已备齐`,
      detail:
        p.autoClaimableBounties > 0
          ? `其中 ${p.autoClaimableBounties} 单可一键交，贡器单另挑一件`
          : "贡器单要点开挑一件，价随品质现算",
    };
  }
  if (p.availableGoods > 0) {
    return {
      tab: "shelf" as const,
      mark: "先看",
      title: `${p.availableGoods} 件货仍在本架`,
      detail: `换货前还有 ${formatCountdown(remainingSec.value)}，灵石 ${formatGN(resources.spiritStone)}`,
    };
  }
  if (p.consignCount > 0) {
    return {
      tab: "sell" as const,
      mark: "等售",
      title: `${p.consignCount} 件寄卖正在等时辰`,
      detail: nextConsign.value.text,
    };
  }
  return {
    tab: "shelf" as const,
    mark: "候市",
    title: "这一市暂无现成可做",
    detail: `下一架货在 ${formatCountdown(remainingSec.value)} 后换新`,
  };
});

function consignProgress(finishAt: number): number {
  const left = Math.max(0, finishAt - now.value);
  const total = MARKET_CONSIGN_SECONDS * 1000;
  return Math.max(0, Math.min(100, (1 - left / total) * 100));
}

/**
 * 货架装备预览(确定性实例,只取它与品质,不落库)。缓成 per-slot 表:
 * 只随货架 / 上货时刻重算,不再随每秒的倒计时重掷整件装备(避免每个 tick 生成 6 次)。
 *
 * **这里返回结构化对象而不是一个字符串**,是这次修 bug 的关键:
 * 原先它返回 `generateEquipment(...).quality` —— 那是品阶的 **id**("excellent"),
 * 而字典类型是 `Record<number, string>`:QualityId 与 name 都是 string,
 * TypeScript 看不出区别,英文枚举于是就这样印到了货架上。
 * 现在只有 `qualityName`(中文名)与 `name`(装备名),想印 id 得先绕过类型。
 */
interface EquipPreview {
  name: string;
  qualityName: string;
  color: string;
  textColor: string;
  quality: QualityId;
  /** 天/仙/神 —— 该盖品阶章的那批(同源 qualityTier,与背包格一份账) */
  rare: boolean;
}
const previews = computed<Record<number, EquipPreview>>(() => {
  const m: Record<number, EquipPreview> = {};
  for (const s of market.stock) {
    if (s.kind !== "equipment") continue;
    const inst = marketEquipInstance(s, market.stockedAt);
    const q = qualityDef(inst.quality);
    m[s.idx] = {
      name: equipmentTemplate(inst.templateId)?.name ?? "兵刃",
      qualityName: q.name,
      color: q.color,
      textColor: qualityTextColor(inst.quality),
      quality: inst.quality,
      rare: isRareQuality(inst.quality),
    };
  }
  return m;
});

/**
 * 货架售品卡的品阶晕染(仅兵刃行):边框随档加深(qualityTier 同源),
 * 天/仙/神另有角章 —— 档位线索不靠颜色单打。丹/料没有品阶档,保持墨色中性底。
 *
 * 底色**固定 6%**(不随档):货架卡是多行文字密卡(品阶/描述/价格 10-11px),
 * 进阶档的 10% 底会把文字对比度压破 AA(layout-check 像素采样实测 4.35:1)——
 * 档位线索由边框与角章承担,底色退回弱晕。
 */
function shelfTier(slot: (typeof market.stock)[number]): Record<string, string> | undefined {
  if (slot.kind !== "equipment") return undefined;
  const p = previews.value[slot.idx];
  if (!p) return undefined;
  const t = qualityTierStyle(p.quality);
  return {
    borderColor: colorWithAlpha(p.color, t.border),
    background: colorWithAlpha(p.color, 0.06),
  };
}

const sellablePills = computed(() =>
  Object.entries(inventory.pills)
    .filter(([, n]) => n > 0)
    .map(([id, n]) => ({ id, count: n, def: pillDef(id) }))
    .filter((p) => p.def?.recipe?.stoneBase),
);

function buySlot(idx: number): void {
  const r = market.buy(idx);
  if (r === "poor") notify("灵石不足,购入不成", "warn");
  else if (r === "bagfull") notify("行囊已满,灵石已退回", "warn");
  else if (r === "expired") notify("货架刚换新,请按新货再买", "warn");
}

/** 购入短差:买得起念全价,付不起换口「尚差 X 石」 */
function stoneShort(cost: GNum): number {
  return Math.max(0, toNum(cost) - toNum(resources.spiritStone));
}
function consign(uid: string): void {
  const item = inventory.bagItems.find((it) => it.uid === uid);
  const name = item ? (equipmentTemplate(item.templateId)?.name ?? "兵刃") : "兵刃";
  const r = market.consignEquip(uid, Date.now());
  if (r === "ok") notify(`已将「${name}」交去寄卖`, "success");
  else if (r === "full") notify(`寄卖已满 ${MARKET_CONSIGN_SLOTS} 格,等一件到时再来`, "warn");
  else notify("这件已不在行囊里,换一件再寄卖", "warn");
}
function sellPill(id: string): void {
  const sold = market.sellPill(id);
  const name = pillDef(id)?.name ?? id;
  if (sold) notify(`已售 1 颗「${name}」,得 ${formatGN(pillSellPrice(id))} 石`, "success");
  else notify(`「${name}」已无量可售`, "warn");
}
function sellMat(matId: "herb" | "ore"): void {
  const label = matId === "herb" ? "灵草" : "玄铁";
  const sold = market.sellMaterial(matId, player.major);
  if (sold)
    notify(
      `已售 ${MARKET_MAT_COUNT} ${label}，得 ${formatGN(materialSellPrice(player.major))} 石`,
      "success",
    );
  else notify(`${label}不足 ${MARKET_MAT_COUNT}，这一批卖不成`, "warn");
}

/** 即时售短差:不足售不出去时与悬赏「需 N X,缺 M」同源,直列差几份 */
const herbSellShort = computed(() => Math.max(0, MARKET_MAT_COUNT - resources.herb));
const oreSellShort = computed(() => Math.max(0, MARKET_MAT_COUNT - resources.ore));

function claimBounty(idx: number): void {
  const slot = bounty.orders.find((o) => o.idx === idx);
  // 贡器要选交哪一件,不能悄悄拿走行囊里顺着序排在第一件的够格兵刃
  // (可能正是刚重铸/升级过的心头好) —— 点开挑一件,再交。
  if (slot && slot.kind === "equip") {
    equipCandidateLimit.value = INVENTORY_RENDER_BATCH;
    equipPick.value = idx;
    return;
  }
  const r = bounty.claim(idx);
  if (r === "insufficient") notify("材料或丹药不足,交不了货", "warn");
  else if (r === "nobag") notify("行囊里没有够阶的兵刃", "warn");
  else if (r === "expired") notify("悬赏已换新单,请按新单再交", "warn");
}

/** 正在点选交付兵刃的那单悬赏(idx;null = 未在挑) */
const equipPick = ref<number | null>(null);

/**
 * 能一键自动交的单(草药 / 玄铁 / 丹药)。**贡器单不放进来** —— 那得挑一件
 * 够格的兵刃,不能悄悄拿走行囊里顺着序排在第一件的心头好(见 claimBounty 的注释)。
 */
const autoClaimable = computed(() =>
  bounty.orders.filter((o) => !o.claimed && o.kind !== "equip" && bountyReady(o)),
);

/** 一键交掉所有现成可交的非贡器单:逐单走 store 的 claim,合一条总账汇报 */
function claimAllAuto(): void {
  const ready = autoClaimable.value;
  if (!ready.length) return;
  let count = 0;
  let stone = gn(0);
  let wudao = 0;
  for (const o of ready) {
    const r = bounty.claim(o.idx);
    if (r !== "ok") continue;
    count += 1;
    stone = add(stone, o.reward);
    if (o.extra > 0) wudao += o.extra;
  }
  if (!count) return;
  const parts = [`已交货 ${count} 单`];
  if (toNum(stone) > 0) parts.push(`得灵石 ${formatGN(stone)}`);
  if (wudao > 0) parts.push(`悟道 +${wudao}`);
  notify(parts.join(" · "), "success");
}

/** 贡器单可交付的够格行囊兵刃(与 claim 的找回谓词同源:阶 ≥ 订单要求) */
const equipCandidates = computed(() => {
  if (equipPick.value === null) return [];
  const slot = bounty.orders.find((o) => o.idx === equipPick.value);
  if (!slot || slot.kind !== "equip" || slot.claimed) return [];
  return inventory.bagItems.filter((e) => e.tier >= slot.tier);
});

/**
 * 贡器候选与寄卖横条都可能对着整只行囊。两者都只先铺一批,余件用显式续开补到
 * 同一份完整清单里 —— 既保住「整包都寄得出去」,也不让 120 行候选一次压进首帧。
 */
const equipCandidateLimit = ref(INVENTORY_RENDER_BATCH);
const equipCandidatePage = computed(() =>
  inventoryWindow(equipCandidates.value, equipCandidateLimit.value, MARKET_RENDER_WINDOW),
);
const equipCandidateMoreLabel = computed(() => {
  const next = Math.min(INVENTORY_RENDER_BATCH, equipCandidatePage.value.hidden);
  return `再看 ${next} 件 · 余 ${equipCandidatePage.value.hidden}`;
});
const equipCandidatePrevLabel = computed(
  () =>
    `前一批 ${previousListStep(
      equipCandidatePage.value.shown,
      equipCandidates.value.length,
      INVENTORY_RENDER_BATCH,
    )} 件`,
);
function showMoreEquipCandidates(): void {
  const shownBefore = equipCandidatePage.value.shown;
  const shownAfter = nextInventoryLimit(shownBefore, equipCandidates.value.length);
  equipCandidateLimit.value = shownAfter;
  focusItem(
    "button[data-equip-candidate]",
    firstNewVisibleIndex(shownBefore, shownAfter, MARKET_RENDER_WINDOW),
  );
}
function showPreviousEquipCandidates(): void {
  equipCandidateLimit.value = previousInventoryLimit(
    equipCandidatePage.value.shown,
    equipCandidates.value.length,
  );
  focusItem("button[data-equip-candidate]");
}

const consignLimit = ref(INVENTORY_RENDER_BATCH);
const consignPage = computed(() =>
  inventoryWindow(inventory.bagItems, consignLimit.value, MARKET_RENDER_WINDOW),
);
const consignMoreLabel = computed(() => {
  const next = Math.min(INVENTORY_RENDER_BATCH, consignPage.value.hidden);
  return `再看 ${next} 件 · 余 ${consignPage.value.hidden}`;
});
const consignPrevLabel = computed(
  () =>
    `前一批 ${previousListStep(
      consignPage.value.shown,
      inventory.bagItems.length,
      INVENTORY_RENDER_BATCH,
    )} 件`,
);
function showMoreConsign(): void {
  const shownBefore = consignPage.value.shown;
  const shownAfter = nextInventoryLimit(shownBefore, inventory.bagItems.length);
  consignLimit.value = shownAfter;
  focusItem(
    "button[data-consign-uid]",
    firstNewVisibleIndex(shownBefore, shownAfter, MARKET_RENDER_WINDOW),
  );
}
function showPreviousConsign(): void {
  consignLimit.value = previousInventoryLimit(consignPage.value.shown, inventory.bagItems.length);
  focusItem("button[data-consign-uid]");
}

/** 续开送到新露出首件,回翻送到当前页首件;焦点不留在已消失的按钮上。 */
function focusItem(selector: string, index = 0): void {
  void nextTick(() => {
    const items = document.querySelectorAll<HTMLElement>(selector);
    items[Math.min(Math.max(0, index), items.length - 1)]?.focus();
  });
}

// 换版瞬间收起点选窗:挑单是**对着旧单**挑的,新单同号未必还是贡器单 ——
// equipCandidates 会因此空掉,窗口就挂成一张空列表;收掉让玩家按新单再点。
watch(equipCandidates, (rows) => {
  if (equipPick.value !== null && rows.length === 0) equipPick.value = null;
});

function deliverPicked(uid: string): void {
  if (equipPick.value === null) return;
  const r = bounty.claimEquip(equipPick.value, uid);
  equipPick.value = null;
  if (r === "insufficient") notify("这件不够阶,换一件", "warn");
  else if (r === "expired") notify("悬赏已换新单,请按新单再交", "warn");
}

/** 贡这柄可得(随所交之品现算,与交货结算同源 —— 交哪件前先亮价) */
function equipBountyText(it: EquipmentInstance): string {
  const r = equipBountyReward(it.tier, qualityDef(it.quality).rank);
  return `${formatGN(r.stone)} 石 · ${r.dust} 尘`;
}

/** 逐单交货短差:够交回 null,不够列「需 N X,缺 M」(与「尚差 N 石」同一纪律) */
function bountyShort(o: BountySlot): string | null {
  return bountyStatus(o, bountyHoldings.value).shortText;
}

function bountyReady(o: BountySlot): boolean {
  return bountyStatus(o, bountyHoldings.value).ready;
}
</script>

<template>
  <div class="folio-page folio-page--stack stagger-in market-page">
    <FolioPageHeader
      title="坊市"
      subtitle="灵石换机缘 · 时来运转"
      back-to="dongfu"
      back-label="返回"
      featured
    >
      <template #visual>
        <MarketArcade
          :goods="marketPulse.availableGoods"
          :goods-total="marketPulse.goodsTotal"
          :bounties="marketPulse.claimableBounties"
          :bounties-total="marketPulse.openBounties"
          :consign="marketPulse.consignCount"
          :consign-slots="MARKET_CONSIGN_SLOTS"
          :active="marketTab"
        />
      </template>

      <template #action>
        <span
          class="market-clock inline-flex items-center gap-1 rounded-sm border border-ink/10 px-2 py-1 text-note tabular text-ink-faint tinylens:w-full tinylens:justify-between"
          :title="headerClock.title"
        >
          {{ headerClock.label }}
          <span class="countdown-slot">{{ headerClock.text }}</span>
        </span>
      </template>

      <!-- 卷首先报此刻，再让三册账目各自成为入口。 -->
      <div class="market-pulse" data-market-pulse>
        <LedgerHeader
          :seal="marketLead.mark"
          eyebrow="今日行市"
          :title="marketLead.title"
          :description="marketLead.detail"
        >
          <template #actions>
            <button
              type="button"
              class="market-pulse__jump hoverable:hover:border-cinnabar"
              @click="marketTab = marketLead.tab"
            >
              去看{{
                marketLead.tab === "shelf" ? "货架" : marketLead.tab === "bounty" ? "悬赏" : "寄卖"
              }}
            </button>
          </template>
        </LedgerHeader>

        <div class="market-pulse__tallies">
          <button
            v-for="row in marketLedgerRows"
            :key="row.id"
            type="button"
            class="market-pulse__tally"
            :class="{ 'is-active': marketTab === row.id }"
            @click="marketTab = row.id"
          >
            <span class="market-pulse__mark" aria-hidden="true">{{ row.mark }}</span>
            <span class="market-pulse__label">{{ row.label }}</span>
            <span class="market-pulse__value">
              <strong
                :data-market-pulse-goods="row.id === 'shelf' ? row.value : undefined"
                :data-market-pulse-bounties="row.id === 'bounty' ? row.value : undefined"
                :data-market-pulse-consign="row.id === 'sell' ? row.value : undefined"
                >{{ row.value }}</strong
              >
              <span class="market-pulse__total">/{{ row.total }}</span>
            </span>
            <span class="market-pulse__unit">{{ row.unit }}</span>
            <span class="market-pulse__detail">{{ row.detail }}</span>
          </button>
        </div>
      </div>
    </FolioPageHeader>

    <InkTabs v-model="marketTab" :tabs="marketTabRows" />

    <!-- 货架：每一格都是一张摊签，名称、品阶、价格与买不买得起同屏。 -->
    <section v-show="marketTab === 'shelf'" class="market-book" data-market-book="shelf">
      <div class="market-book__head">
        <SectionTitle title="货架" hint="时辰一到自会换新" />
        <span class="market-book__clock">换货 {{ formatCountdown(remainingSec) }}</span>
      </div>
      <div class="market-goods">
        <article
          v-for="slot in market.stock"
          :key="slot.idx"
          class="market-good"
          :class="{ 'is-sold': slot.sold }"
          :style="shelfTier(slot)"
        >
          <span class="market-good__mark" aria-hidden="true">
            {{ slot.kind === "pill" ? "丹" : slot.kind === "material" ? "料" : "兵" }}
          </span>
          <div class="market-good__body">
            <template v-if="slot.kind === 'pill'">
              <p class="market-good__name">
                {{ pillDef(slot.pillId)?.name ?? slot.pillId }}
                <span class="market-good__count">×{{ slot.count }}</span>
              </p>
              <p class="market-good__note">一枚丹方之味 · 免去集草开炉</p>
            </template>
            <template v-else-if="slot.kind === 'material'">
              <p class="market-good__name">
                {{ slot.matId === "herb" ? "灵草" : "玄铁" }} ×{{ MARKET_MAT_COUNT }}
              </p>
              <p class="market-good__note">续洞府生产之料 · 当场入账</p>
            </template>
            <template v-else>
              <p class="market-good__name">
                <QualitySeal
                  v-if="previews[slot.idx]?.rare"
                  :quality="previews[slot.idx]!.quality"
                  :size="12"
                  class="mr-1 align-[-2px]"
                />
                <span
                  class="font-kai"
                  :style="{ color: previews[slot.idx]?.textColor ?? 'var(--color-ink)' }"
                  >{{ previews[slot.idx]?.name ?? "兵刃" }}</span
                >
                <span class="market-good__quality"
                  >· {{ previews[slot.idx]?.qualityName ?? "" }}{{ slot.tier }}阶</span
                >
              </p>
              <p class="market-good__note">
                一件已定兵刃，到手即用 · 底档{{
                  QUALITIES[(slot as { minQualityRank: number }).minQualityRank]?.name ?? ""
                }}
              </p>
            </template>
          </div>
          <div class="market-good__trade">
            <span class="market-good__price">{{ formatGN(slot.price) }}</span>
            <span class="market-good__price-unit">灵石</span>
            <button
              class="btn-seal market-good__action min-h-[28px] !px-3 !py-1 text-body hoverable:hover:border-cinnabar"
              :disabled="
                slot.sold ||
                (slot.kind === 'equipment' && inventory.bagFull) ||
                !resources.hasStone(slot.price)
              "
              @click="buySlot(slot.idx)"
            >
              {{
                slot.sold
                  ? "已售"
                  : slot.kind === "equipment" && inventory.bagFull
                    ? "行囊已满"
                    : resources.hasStone(slot.price)
                      ? "购入"
                      : `尚差 ${formatGN(stoneShort(slot.price))} 石`
              }}
            </button>
          </div>
        </article>
        <p v-if="market.stock.length === 0" class="market-book__empty">
          货架空着 —— 时辰一到自会换新。
        </p>
      </div>
    </section>

    <!-- 悬赏板：先看总账，再逐单摊开要什么、缺多少、交得掉多少。 -->
    <section v-show="marketTab === 'bounty'" class="market-book" data-market-book="bounty">
      <div
        class="market-book__head market-book__head--bounty justify-between pr-1 tinylens:flex-col tinylens:items-start tinylens:gap-1"
      >
        <SectionTitle title="悬赏板" hint="商号收购 · 交货即得" />
        <div class="market-book__tools">
          <button
            v-if="autoClaimable.length"
            class="btn-seal min-h-[28px] !px-2.5 !py-1 text-body whitespace-nowrap"
            @click="claimAllAuto()"
          >
            一键领取({{ autoClaimable.length }})
          </button>
          <span class="market-book__clock" :title="`${BOUNTY_REFRESH_SECONDS / 3600} 小时一版`">
            换新
            <span class="countdown-slot">{{
              formatCountdown(bountyRemainingSec(bounty.bountyAt, now))
            }}</span>
          </span>
        </div>
      </div>

      <div class="market-bounties">
        <article
          v-for="o in bounty.orders"
          :key="o.idx"
          class="market-bounty"
          :class="{ 'is-claimed': o.claimed, 'is-ready': bountyReady(o) }"
        >
          <span class="market-bounty__mark" aria-hidden="true">赏</span>
          <div class="market-bounty__body">
            <template v-if="o.kind === 'herb' || o.kind === 'ore'">
              <p class="market-bounty__name">
                募 {{ o.kind === "herb" ? "灵草" : "玄铁" }} ×{{ o.target }}
              </p>
              <p v-if="bountyShort(o)" class="market-bounty__short">{{ bountyShort(o) }}</p>
              <p v-else class="market-bounty__note">交货即得灵石</p>
            </template>
            <template v-else-if="o.kind === 'pill'">
              <p class="market-bounty__name">
                {{ pillDef(o.kindId)?.name ?? o.kindId }} ×{{ o.target }}
              </p>
              <p v-if="bountyShort(o)" class="market-bounty__short">{{ bountyShort(o) }}</p>
              <p v-else class="market-bounty__note">
                另得{{ RESOURCE_LABELS.wudao }}×{{ o.extra }}
              </p>
            </template>
            <template v-else>
              <p class="market-bounty__name leading-relaxed">贡一柄 ≥{{ o.tier }} 阶兵刃</p>
              <p v-if="bountyShort(o)" class="market-bounty__short">{{ bountyShort(o) }}</p>
              <p v-else class="market-bounty__note">价随所交之品质现算</p>
            </template>
          </div>
          <div class="market-bounty__reward">
            <span class="market-bounty__reward-label">酬</span>
            <span class="market-bounty__reward-value">
              {{
                o.kind === "equip"
                  ? `≥ ${formatGN(equipBountyReward(o.tier, 0).stone)} 石 + ${equipBountyReward(o.tier, 0).dust} 尘`
                  : `${formatGN(o.reward)} 灵石`
              }}
            </span>
          </div>
          <button
            :data-bounty-equip="o.kind === 'equip' ? o.idx : undefined"
            class="btn-seal market-bounty__action min-h-[28px] !px-3 !py-1 text-body hoverable:hover:border-cinnabar"
            :disabled="o.claimed || !bountyReady(o)"
            @click="claimBounty(o.idx)"
          >
            {{ o.claimed ? "已交" : "交货" }}
          </button>
        </article>
        <p v-if="bounty.orders.length === 0" class="market-book__empty">
          悬赏板空着 —— 商号还没挂单，下个时辰自会换新。
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
      <p class="mb-2 text-body text-ink-faint">
        交付就没了 —— 挑一件你舍得交的。价随所交之品质现算。
      </p>
      <div
        class="space-y-1"
        :data-market-candidate-total="equipCandidates.length"
        :data-market-candidate-start="equipCandidatePage.start"
      >
        <button
          v-for="it in equipCandidatePage.visible"
          :key="it.uid"
          :data-equip-candidate="it.uid"
          class="flex w-full items-center justify-between gap-2 rounded-[2px] border border-ink/10 px-3 py-2 text-left text-body hoverable:hover:border-cinnabar"
          @click="deliverPicked(it.uid)"
        >
          <span class="min-w-0 truncate">
            <!-- 天/仙/神名前盖章:候选行与背包格同一条品阶形状线索(见 qualityTier) -->
            <QualitySeal
              v-if="isRareQuality(it.quality)"
              :quality="it.quality"
              :size="12"
              class="mr-1 align-[-2px]"
            />
            <span class="font-kai" :style="{ color: qualityTextColor(it.quality) }">
              {{ equipmentTemplate(it.templateId)?.name ?? "无名法器" }}
            </span>
            <span class="ml-1 text-ink-faint"
              >{{ qualityDef(it.quality).name }} · {{ it.tier }}阶</span
            >
          </span>
          <span class="ml-1 shrink-0 text-body text-ink-faint tabular"
            >收 {{ equipBountyText(it) }}
          </span>
          <span class="shrink-0 text-cinnabar">交付</span>
        </button>
        <div
          v-if="equipCandidatePage.hidden > 0 || equipCandidatePage.start > 0"
          class="flex gap-1"
        >
          <button
            v-if="equipCandidatePage.start > 0"
            data-market-prev="equip"
            class="btn-ghost min-h-[28px] flex-1 !py-1 text-note"
            :aria-label="equipCandidatePrevLabel"
            @click="showPreviousEquipCandidates"
          >
            {{ equipCandidatePrevLabel }}
          </button>
          <button
            v-if="equipCandidatePage.hidden > 0"
            data-market-more="equip"
            :data-promised="Math.min(INVENTORY_RENDER_BATCH, equipCandidatePage.hidden)"
            class="btn-ghost min-h-[28px] flex-1 !py-1 text-note"
            :aria-label="equipCandidateMoreLabel"
            @click="showMoreEquipCandidates"
          >
            {{ equipCandidateMoreLabel }}
          </button>
        </div>
        <p v-if="equipCandidates.length === 0" class="text-body text-ink-faint">没有够阶的兵刃</p>
      </div>
    </BaseModal>

    <!-- 售出：寄卖架先看在架，即时柜再处理丹药与材料。 -->
    <section v-show="marketTab === 'sell'" class="market-book" data-market-book="sell">
      <div class="market-book__head">
        <SectionTitle title="售出" hint="寄卖到时自售 · 即时售即入账" />
        <span class="market-book__clock"
          >寄卖 {{ market.consign.length }}/{{ MARKET_CONSIGN_SLOTS }}</span
        >
      </div>

      <div class="market-sell-grid">
        <section class="market-consign">
          <div class="market-consign__head">
            <p class="market-consign__title">寄卖架</p>
            <p class="market-consign__note">
              {{ MARKET_CONSIGN_SLOTS }} 格 · 约 {{ MARKET_CONSIGN_SECONDS / 60 }} 分自售入账 ·
              离包即定
            </p>
          </div>

          <div v-if="market.consign.length" class="market-consign__active">
            <div v-for="p in market.consign" :key="p.slot" class="market-consign__row">
              <span class="market-consign__mark" aria-hidden="true">寄</span>
              <div class="market-consign__body">
                <p class="market-consign__name">{{ p.name }}</p>
                <p class="market-consign__price">售出得 {{ formatGN(p.price) }} 灵石</p>
                <span class="market-consign__track" aria-hidden="true">
                  <span :style="{ width: `${consignProgress(p.finishAt)}%` }" />
                </span>
              </div>
              <span class="market-consign__eta">
                <span class="countdown-slot">{{
                  formatCountdown(Math.max(0, Math.ceil((p.finishAt - now) / 1000)))
                }}</span>
                后入账
              </span>
            </div>
          </div>
          <p v-else class="market-consign__empty">寄卖架空着 —— 挑一件行囊里舍得的兵刃上架。</p>

          <div
            class="market-consign__picker"
            :data-market-consign-total="inventory.bagItems.length"
            :data-market-consign-start="consignPage.start"
          >
            <template v-if="market.consign.length < MARKET_CONSIGN_SLOTS">
              <div class="market-consign__candidates">
                <button
                  v-for="it in consignPage.visible"
                  :key="it.uid"
                  :data-consign-uid="it.uid"
                  class="market-consign__candidate hoverable:hover:border-cinnabar"
                  @click="consign(it.uid)"
                >
                  <QualitySeal
                    v-if="isRareQuality(it.quality)"
                    :quality="it.quality"
                    :size="12"
                    class="mr-1"
                  />
                  <span class="font-kai" :style="{ color: qualityTextColor(it.quality) }">{{
                    equipmentTemplate(it.templateId)?.name ?? "?"
                  }}</span>
                  <span class="text-ink-faint"
                    >· {{ qualityDef(it.quality).name }}{{ it.tier }}阶 ·
                    {{ formatGN(consignPrice(it.tier, qualityDef(it.quality).rank)) }} 石</span
                  >
                </button>
                <span v-if="inventory.bagItems.length === 0" class="market-consign__empty">
                  行囊空空 —— 去历练中寻些机缘吧
                </span>
              </div>
              <div
                v-if="consignPage.hidden > 0 || consignPage.start > 0"
                class="market-consign__pager"
              >
                <button
                  v-if="consignPage.start > 0"
                  data-market-prev="consign"
                  class="btn-ghost min-h-[28px] flex-1 !py-1 text-note"
                  :aria-label="consignPrevLabel"
                  @click="showPreviousConsign"
                >
                  {{ consignPrevLabel }}
                </button>
                <button
                  v-if="consignPage.hidden > 0"
                  data-market-more="consign"
                  :data-promised="Math.min(INVENTORY_RENDER_BATCH, consignPage.hidden)"
                  class="btn-ghost min-h-[28px] flex-1 !py-1 text-note"
                  :aria-label="consignMoreLabel"
                  @click="showMoreConsign"
                >
                  {{ consignMoreLabel }}
                </button>
              </div>
            </template>
            <p v-else class="market-consign__empty">
              已上满 {{ MARKET_CONSIGN_SLOTS }} 格，待手头一张空闲。
            </p>
          </div>
        </section>

        <section class="market-counter">
          <div class="market-consign__head">
            <p class="market-consign__title">即时柜</p>
            <p class="market-consign__note">丹药一颗一颗卖，材料一批一批卖，点下即入账。</p>
          </div>

          <div class="market-counter__pills">
            <button
              v-for="p in sellablePills"
              :key="p.id"
              class="market-counter__item hoverable:hover:border-cinnabar"
              @click="sellPill(p.id)"
            >
              <span class="market-counter__mark" aria-hidden="true">丹</span>
              <span class="market-counter__copy">
                <span>售{{ p.def?.name ?? p.id }}(现持 {{ p.count }})</span>
                <span class="market-counter__price"
                  >每颗得 {{ formatGN(pillSellPrice(p.id)) }} 石</span
                >
              </span>
            </button>
            <span v-if="sellablePills.length === 0" class="market-consign__empty">
              并无即时可售的丹药 —— 历练所得，自能入市
            </span>
          </div>

          <div class="market-counter__materials">
            <button
              class="market-counter__item hoverable:hover:border-cinnabar"
              :disabled="!resources.hasSmall('herb', MARKET_MAT_COUNT)"
              @click="sellMat('herb')"
            >
              <span class="market-counter__mark" aria-hidden="true">草</span>
              <span class="market-counter__copy">
                <span>{{
                  herbSellShort > 0 ? `尚差 ${herbSellShort} 灵草` : `售灵草×${MARKET_MAT_COUNT}`
                }}</span>
                <span class="market-counter__price"
                  >得 {{ formatGN(materialSellPrice(player.major)) }} 石</span
                >
              </span>
            </button>
            <button
              class="market-counter__item hoverable:hover:border-cinnabar"
              :disabled="!resources.hasSmall('ore', MARKET_MAT_COUNT)"
              @click="sellMat('ore')"
            >
              <span class="market-counter__mark" aria-hidden="true">铁</span>
              <span class="market-counter__copy">
                <span>{{
                  oreSellShort > 0 ? `尚差 ${oreSellShort} 玄铁` : `售玄铁×${MARKET_MAT_COUNT}`
                }}</span>
                <span class="market-counter__price"
                  >得 {{ formatGN(materialSellPrice(player.major)) }} 石</span
                >
              </span>
            </button>
          </div>
        </section>
      </div>
    </section>
  </div>
</template>
