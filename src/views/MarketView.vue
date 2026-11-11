<script setup lang="ts">
import "@/styles/pages/market.css";
import { focusListRow } from "@/composables/useListFocus";
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
import type { EquipmentInstance, GNum } from "@/types";
import {
  MARKET_CONSIGN_SECONDS,
  MARKET_CONSIGN_SLOTS,
  MARKET_MAT_COUNT,
  MARKET_REFRESH_SECONDS,
  type MarketSlot,
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
import { firstNewVisibleIndex, nextRevealCount, previousListStep } from "@/core/listRender";
import { bountyRemainingSec, equipBountyReward } from "@/core/bountyService";
import { bountyStatus, marketOverview } from "@/core/marketOverview";
import { notify } from "@/core/notify";
import { BOUNTY_REFRESH_SECONDS } from "@/data/bounty";
import { qualityDef } from "@/data/qualities";
import { equipmentTemplate } from "@/data/equipment";
import { setCounts } from "@/core/equipSet";
import { colorWithAlpha } from "@/ui/colorVar";
import { isRareQuality, qualityTextColor, qualityTierStyle } from "@/ui/qualityTier";
import { marketEquipView, type MarketEquipView } from "@/ui/marketShelf";
import QualitySeal from "@/components/common/QualitySeal.vue";
import GameIcon from "@/components/common/GameIcon.vue";
import FolioPageHeader from "@/components/common/FolioPageHeader.vue";
import LedgerPulse from "@/components/common/LedgerPulse.vue";
import LedgerHeader from "@/components/common/LedgerHeader.vue";
import BaseModal from "@/components/common/BaseModal.vue";
import MarketArcade from "@/components/market/MarketArcade.vue";
import MarketChapterRail from "@/components/market/MarketChapterRail.vue";
import { useRouteTab } from "@/composables/useRouteTab";
import { MARKET_CHAPTERS } from "@/ui/navigation";
import { clampPercent } from "@/utils/unitRatio";

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

const marketTab = useRouteTab(MARKET_CHAPTERS, "shelf");

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
    /*
     * 这一格不再复述换货时钟 —— 账首(货架章)已经在同一屏报了同一个数,
     * 两处相距 59px、文案一字不差,首屏等于把同一个「换货 01:59」说了两遍
     * (页头时钟之外的第二、第三遍)。
     *
     * 改报这一摊**独有**的另一半:几件已经卖掉了。`value/total` 只说「还剩几件可买」,
     * 「卖掉几件」是同一件事的另一面,却是备货与补货时真正要看的那个数。
     * 判据 `[390-market] 三摊册口没有并排报出真值` 要求三格都报非空事实,
     * 这一格不能留空。
     */
    detail:
      marketPulse.value.goodsTotal - marketPulse.value.availableGoods > 0
        ? `已售罄 ${marketPulse.value.goodsTotal - marketPulse.value.availableGoods} 件`
        : "一架未动",
  },
  {
    id: "bounty" as const,
    mark: "赏",
    label: "悬赏",
    value: marketPulse.value.claimableBounties,
    total: marketPulse.value.openBounties,
    unit: "单可交",
    /*
     * 换榜时钟同样归账首报(第贰册)。这里改报该摊**独有**的一件事:
     * 有几单能一键交 —— 那是「现在点进去能得到什么」,总账摘要就该答这个,
     * 而且与 `marketLead` 的「其中 N 单可一键交」同一份数据。
     */
    detail:
      marketPulse.value.autoClaimableBounties > 0
        ? `${marketPulse.value.autoClaimableBounties} 单可一键交`
        : "",
  },
  {
    id: "sell" as const,
    mark: "寄",
    label: "售出",
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
  return clampPercent((1 - left / total) * 100);
}

/**
 * 货架装备预览(确定性实例,只取它与品质,不落库)。缓成 per-slot 表:
 * 只随货架 / 上货时刻 / 当前佩戴重算,不再随每秒的倒计时重掷整件装备。
 *
 * 预览不只给名字与品阶,还把本件战力、当前同槽对照、平铺三围、词条全文、
 * 固有与共鸣一起摊开 —— 买前能看懂的账,不能等买回行囊才补。
 */
const previews = computed<Record<number, MarketEquipView | null>>(() => {
  const m: Record<number, MarketEquipView | null> = {};
  const equippedSets = setCounts(inventory.equippedItems);
  for (const s of market.stock) {
    if (s.kind !== "equipment") continue;
    const inst = marketEquipInstance(s, market.stockedAt);
    const template = equipmentTemplate(inst.templateId);
    const occupantUid = template ? inventory.equipped[template.slot] : undefined;
    const occupant = occupantUid ? inventory.findItem(occupantUid) : undefined;
    const setCount = template?.set ? (equippedSets.get(template.set) ?? 0) : 0;
    m[s.idx] = marketEquipView(inst, occupant, setCount);
  }
  return m;
});

/** 当前展开验货的货格;换架时收起，避免旧货的展开态落到同号新货上。 */
const inspectedSlot = ref<number | null>(null);
watch(
  () => market.stockedAt,
  () => {
    inspectedSlot.value = null;
  },
);

function previewFor(slot: MarketSlot): MarketEquipView | null {
  return slot.kind === "equipment" ? (previews.value[slot.idx] ?? null) : null;
}

/** 平铺有几项就铺几栏：一围不空出两栏，三围仍并读；极窄档由 CSS 统一退单列。 */
function flatGridStyle(slot: MarketSlot): Record<string, string> {
  const count = Math.max(1, Math.min(3, previewFor(slot)?.flatRows.length ?? 1));
  return { "--market-flat-columns": String(count) };
}

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
 * 能一键自动交的单(灵草 / 玄铁 / 丹药)。**贡器单不放进来** —— 那得挑一件
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
/** 这一批真正放出多少件 —— 按钮文案与 data-promised 共用,不许各算一遍 */
const equipPromise = computed(() =>
  nextRevealCount(equipCandidatePage.value.hidden, INVENTORY_RENDER_BATCH),
);
const equipCandidateMoreLabel = computed(() => {
  const next = equipPromise.value;
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
  focusListRow(
    "button[data-equip-candidate]",
    firstNewVisibleIndex(shownBefore, shownAfter, MARKET_RENDER_WINDOW),
  );
}
function showPreviousEquipCandidates(): void {
  equipCandidateLimit.value = previousInventoryLimit(
    equipCandidatePage.value.shown,
    equipCandidates.value.length,
  );
  focusListRow("button[data-equip-candidate]");
}

const consignLimit = ref(INVENTORY_RENDER_BATCH);
const consignPage = computed(() =>
  inventoryWindow(inventory.bagItems, consignLimit.value, MARKET_RENDER_WINDOW),
);
/** 这一批真正放出多少件 —— 按钮文案与 data-promised 共用,不许各算一遍 */
const consignPromise = computed(() =>
  nextRevealCount(consignPage.value.hidden, INVENTORY_RENDER_BATCH),
);
const consignMoreLabel = computed(() => {
  const next = consignPromise.value;
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
  focusListRow(
    "button[data-consign-uid]",
    firstNewVisibleIndex(shownBefore, shownAfter, MARKET_RENDER_WINDOW),
  );
}
function showPreviousConsign(): void {
  consignLimit.value = previousInventoryLimit(consignPage.value.shown, inventory.bagItems.length);
  focusListRow("button[data-consign-uid]");
}

/** 续开送到新露出首件,回翻送到当前页首件;焦点不留在已消失的按钮上。 */

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
    </FolioPageHeader>

    <article class="market-register folio-span-all" data-market-register>
      <!-- 今日只报先手；三摊真值与切册都交给下面同一排册口。 -->
      <LedgerPulse
        class="market-pulse"
        data-market-pulse
        :seal="marketLead.mark"
        eyebrow="今日行市"
        :title="marketLead.title"
        :description="marketLead.detail"
      >
        <template #actions>
          <button
            type="button"
            class="folio-ledger-pulse__action"
            @click="marketTab = marketLead.tab"
          >
            去看{{
              marketLead.tab === "shelf" ? "货架" : marketLead.tab === "bounty" ? "悬赏" : "寄卖"
            }}
          </button>
        </template>
      </LedgerPulse>

      <MarketChapterRail v-model="marketTab" :tabs="marketLedgerRows" />

      <!-- 货架：每一格都是一张摊签，名称、品阶、价格与买不买得起同屏。 -->
      <section
        v-if="marketTab === 'shelf'"
        id="market-panel-shelf"
        class="market-book"
        role="tabpanel"
        aria-labelledby="market-tab-shelf"
        data-market-book="shelf"
        tabindex="0"
      >
        <LedgerHeader
          variant="index"
          data-market-book-head="shelf"
          eyebrow="第壹册 · 换货"
          title="本架货目"
          description="时辰一到自会换新；买不起或行囊满，都在摊签上列出差额。"
          score-label="可买"
          :score-value="marketPulse.availableGoods"
          :score-suffix="`/ ${marketPulse.goodsTotal} 件`"
          :meta="`换货 ${formatCountdown(remainingSec)}`"
          :data-market-book-value="marketPulse.availableGoods"
          :data-market-book-total="marketPulse.goodsTotal"
        />
        <div class="market-goods" data-market-book-body="shelf">
          <article
            v-for="slot in market.stock"
            :key="slot.idx"
            class="market-good"
            :class="{ 'is-sold': slot.sold, 'is-inspecting': inspectedSlot === slot.idx }"
            :style="shelfTier(slot)"
          >
            <span
              class="market-good__mark"
              :class="{ 'market-good__mark--equipment': slot.kind === 'equipment' }"
              aria-hidden="true"
            >
              <GameIcon
                v-if="slot.kind === 'equipment' && previewFor(slot)"
                :name="previewFor(slot)!.template.icon"
                :size="15"
                :style="{ color: previewFor(slot)!.textColor }"
              />
              <template v-else>{{
                slot.kind === "pill" ? "丹" : slot.kind === "material" ? "料" : "兵"
              }}</template>
            </span>

            <div v-if="slot.kind === 'pill'" class="market-good__body">
              <p class="market-good__name">
                {{ pillDef(slot.pillId)?.name ?? slot.pillId }}
                <span class="market-good__count">×{{ slot.count }}</span>
              </p>
              <!--
                这一格原先对所有丹药写同一句「一枚丹方之味 · 免去集草开炉」。
                而 data/pills 里每枚丹都有自己的话(万寿金丹「金丹光华内蕴,寿数绵长」、
                灵乳「万年钟乳凝成的灵液,一口涤尽枯竭」)—— 模板把那些话盖住了。

                更要紧的是这句讲的是**怎么得到它**,不讲**它有什么用**。而这两枚丹用途
                完全不同(一延寿、一回气),玩家掏 875 灵石之前唯一能读到的却是获取方式。
              -->
              <p v-if="pillDef(slot.pillId)?.desc" class="market-good__note">
                {{ pillDef(slot.pillId)!.desc }}
              </p>
            </div>
            <div v-else-if="slot.kind === 'material'" class="market-good__body">
              <p class="market-good__name">
                {{ slot.matId === "herb" ? "灵草" : "玄铁" }} ×{{ MARKET_MAT_COUNT }}
              </p>
              <p class="market-good__note">续洞府生产之料 · 当场入账</p>
            </div>
            <button
              v-else-if="previewFor(slot)"
              type="button"
              class="market-good__body market-good__body--inspect"
              data-market-equipment-toggle
              :data-market-equipment-index="slot.idx"
              :aria-expanded="inspectedSlot === slot.idx"
              :aria-controls="`market-inspect-${slot.idx}`"
              @click="inspectedSlot = inspectedSlot === slot.idx ? null : slot.idx"
            >
              <span class="market-good__name">
                <QualitySeal
                  v-if="previewFor(slot)!.rare"
                  :quality="previewFor(slot)!.quality"
                  :size="12"
                  class="mr-1 align-[-2px]"
                />
                <span class="font-kai" :style="{ color: previewFor(slot)!.textColor }">
                  {{ previewFor(slot)!.name
                  }}<template v-if="previewFor(slot)!.item.level > 0"
                    >+{{ previewFor(slot)!.item.level }}</template
                  >
                </span>
                <span class="market-good__quality">
                  · {{ previewFor(slot)!.qualityName }} · {{ slot.tier }}阶
                </span>
                <!-- 品评 —— 买之前就该知道这一档凭什么(见 data/qualityVerdicts) -->
                <span v-if="previewFor(slot)!.verdict" class="market-good__verdict">{{
                  previewFor(slot)!.verdict
                }}</span>
              </span>
              <span class="market-good__note">
                {{ previewFor(slot)!.meta }} · {{ previewFor(slot)!.desc }}
              </span>
              <span class="market-good__compare" data-market-equipment-compare>
                <span>{{ previewFor(slot)!.compareText }}</span>
                <strong class="tabular" :data-tone="previewFor(slot)!.tone">{{
                  previewFor(slot)!.deltaText
                }}</strong>
              </span>
              <span class="market-good__inspect-cue">
                {{ inspectedSlot === slot.idx ? "收起验货" : "展开验货" }}
                <span aria-hidden="true">{{ inspectedSlot === slot.idx ? "▾" : "▸" }}</span>
              </span>
            </button>
            <div v-else class="market-good__body">
              <p class="market-good__name">
                <span class="font-kai">兵刃</span>
                <span class="market-good__quality">· {{ slot.tier }}阶</span>
              </p>
              <p class="market-good__note">这件货的兵刃预览暂不可用。</p>
            </div>

            <div class="market-good__trade">
              <span class="market-good__price">{{ formatGN(slot.price) }}</span>
              <span class="market-good__price-unit">灵石</span>
              <button
                data-market-buy
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

            <section
              v-if="slot.kind === 'equipment' && inspectedSlot === slot.idx && previewFor(slot)"
              :id="`market-inspect-${slot.idx}`"
              class="market-good__inspection"
              data-market-equipment-preview
              :data-market-equipment-tone="previewFor(slot)!.tone"
            >
              <header class="market-good__inspection-head">
                <div>
                  <p class="market-good__inspection-eyebrow">验货签 · 器性全录</p>
                  <p class="market-good__inspection-verdict" data-market-equipment-preview-compare>
                    {{ previewFor(slot)!.compareText }}
                    <strong :data-tone="previewFor(slot)!.tone">{{
                      previewFor(slot)!.deltaText
                    }}</strong>
                  </p>
                </div>
                <p class="market-good__inspection-power" data-market-equipment-power>
                  <span>本件战力</span>
                  <strong class="tabular">{{ previewFor(slot)!.powerText }}</strong>
                  <small v-if="previewFor(slot)!.incumbentPowerText" class="tabular">
                    当前 {{ previewFor(slot)!.incumbentPowerText }}
                  </small>
                </p>
              </header>

              <p
                v-if="previewFor(slot)!.inscription"
                class="market-good__inscription"
                data-market-equipment-inscription
              >
                <span class="market-good__inscription-title font-kai">
                  「{{ previewFor(slot)!.inscription!.title }}」
                </span>
                <span>{{ previewFor(slot)!.inscription!.verse.text }}</span>
                <span class="market-good__inscription-temper tabular">
                  成色 {{ previewFor(slot)!.inscription!.temper }}/100{{
                    previewFor(slot)!.temperGrade ? ` · ${previewFor(slot)!.temperGrade}` : ""
                  }}
                </span>
              </p>

              <ul
                class="market-good__inspection-flats"
                data-market-equipment-flats
                :style="flatGridStyle(slot)"
              >
                <li v-for="row in previewFor(slot)!.flatRows" :key="row.label">
                  <span>{{ row.label }}</span>
                  <strong class="tabular">{{ row.value }}</strong>
                  <em v-if="row.diff" :data-tone="row.tone" class="tabular">{{ row.diff }}</em>
                </li>
              </ul>

              <section
                v-if="previewFor(slot)!.affixRows.length"
                class="market-good__affixes"
                data-market-equipment-affixes
              >
                <p class="market-good__inspection-label">
                  词条 {{ previewFor(slot)!.affixRows.length }} 条 · 按稀有度排
                </p>
                <ul>
                  <li
                    v-for="line in previewFor(slot)!.affixRows"
                    :key="line.id"
                    :style="{ borderLeftColor: line.color }"
                  >
                    <span class="font-kai" :style="{ color: line.color }">
                      「{{ line.name }}」
                    </span>
                    <small :style="{ color: line.color }">{{ line.rarityName }}</small>
                    <span>{{ line.desc }}</span>
                  </li>
                </ul>
              </section>

              <div
                v-if="previewFor(slot)!.fixedModsText || previewFor(slot)!.setText"
                class="market-good__inspection-notes"
                data-market-equipment-notes
              >
                <p v-if="previewFor(slot)!.fixedModsText">
                  <span>固有</span>{{ previewFor(slot)!.fixedModsText }}
                </p>
                <p v-if="previewFor(slot)!.setText">
                  <span>共鸣</span>{{ previewFor(slot)!.setText }}
                </p>
              </div>
            </section>
          </article>
          <p v-if="market.stock.length === 0" class="market-book__empty">
            货架空着 —— 时辰一到自会换新。
          </p>
        </div>
      </section>

      <!-- 悬赏板：先看总账，再逐单摊开要什么、缺多少、交得掉多少。 -->
      <section
        v-if="marketTab === 'bounty'"
        id="market-panel-bounty"
        class="market-book"
        role="tabpanel"
        aria-labelledby="market-tab-bounty"
        data-market-book="bounty"
        tabindex="0"
      >
        <LedgerHeader
          variant="index"
          data-market-book-head="bounty"
          eyebrow="第贰册 · 收榜"
          title="本期赏单"
          description="商号收购，交货即得；所需、缺口与酬劳逐单摊开。"
          score-label="可交"
          :score-value="marketPulse.claimableBounties"
          :score-suffix="`/ ${marketPulse.openBounties} 单`"
          :meta="`换榜 ${formatCountdown(bountyRemainingSec(bounty.bountyAt, now))}`"
          :data-market-book-value="marketPulse.claimableBounties"
          :data-market-book-total="marketPulse.openBounties"
        >
          <template #actions>
            <button
              v-if="autoClaimable.length"
              class="market-book__claim-all btn-seal min-h-[28px] !px-2.5 !py-1 text-body whitespace-nowrap"
              @click="claimAllAuto()"
            >
              一键领取({{ autoClaimable.length }})
            </button>
          </template>
        </LedgerHeader>

        <div class="market-bounties" data-market-book-body="bounty">
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
              :data-promised="equipPromise"
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
      <section
        v-if="marketTab === 'sell'"
        id="market-panel-sell"
        class="market-book"
        role="tabpanel"
        aria-labelledby="market-tab-sell"
        data-market-book="sell"
        tabindex="0"
        :data-market-consign-slots="MARKET_CONSIGN_SLOTS"
      >
        <LedgerHeader
          variant="index"
          data-market-book-head="sell"
          eyebrow="第叁册 · 归账"
          title="寄卖与即时柜"
          description="寄卖到时自售，即时售即入账；两路都不离本册。"
          score-label="寄卖"
          :score-value="marketPulse.consignCount"
          :score-suffix="`/ ${MARKET_CONSIGN_SLOTS} 格`"
          :meta="nextConsign.text"
          :data-market-book-value="marketPulse.consignCount"
          :data-market-book-total="MARKET_CONSIGN_SLOTS"
        />

        <div class="market-sell-grid" data-market-book-body="sell">
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
                    :data-promised="consignPromise"
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
    </article>
  </div>
</template>
