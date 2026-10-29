<script setup lang="ts">
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
import { isRareQuality, qualityTierStyle } from "@/ui/qualityTier";
import QualitySeal from "@/components/common/QualitySeal.vue";
import FolioPageHeader from "@/components/common/FolioPageHeader.vue";
import SectionTitle from "@/components/common/SectionTitle.vue";
import BaseModal from "@/components/common/BaseModal.vue";
import InkTabs from "@/components/common/InkTabs.vue";

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
  market.sellMaterial(matId, player.major);
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
  <div class="stagger-in space-y-4 px-4 pb-6 pt-4">
    <FolioPageHeader
      title="坊市"
      subtitle="灵石换机缘 · 时来运转"
      back-to="dongfu"
      back-label="返回"
    >
      <template #action>
        <span
          class="inline-flex items-center gap-1 rounded-sm border border-ink/10 px-2 py-1 text-[10px] tabular text-ink-faint tinylens:w-full tinylens:justify-between"
          :title="headerClock.title"
        >
          {{ headerClock.label }}
          <span class="countdown-slot">{{ headerClock.text }}</span>
        </span>
      </template>
    </FolioPageHeader>

    <!-- 卷首先报此刻:三册各有多少当下可做,页签只负责带路。 -->
    <div
      class="card-ink grid grid-cols-3 divide-x divide-ink/10 px-2 py-2 text-center"
      data-market-pulse
    >
      <p>
        <span class="block text-[10px] text-ink-faint">可买</span>
        <span class="block text-[11px] tabular text-ink-soft" data-market-pulse-goods
          >{{ marketPulse.availableGoods }} 件</span
        >
      </p>
      <p>
        <span class="block text-[10px] text-ink-faint">可交</span>
        <span
          class="block text-[11px] tabular"
          :class="marketPulse.claimableBounties > 0 ? 'text-cinnabar' : 'text-ink-soft'"
          data-market-pulse-bounties
          >{{ marketPulse.claimableBounties }} 单</span
        >
      </p>
      <p>
        <span class="block text-[10px] text-ink-faint">寄售</span>
        <span class="block text-[11px] tabular text-ink-soft" data-market-pulse-consign
          >{{ marketPulse.consignCount }}/{{ MARKET_CONSIGN_SLOTS }}</span
        >
      </p>
    </div>

    <InkTabs v-model="marketTab" :tabs="marketTabRows" />

    <!-- 货架 -->
    <section v-show="marketTab === 'shelf'">
      <SectionTitle title="货架" hint="时辰一到自会换新" />
      <div class="mt-2 space-y-2">
        <div
          v-for="slot in market.stock"
          :key="slot.idx"
          class="flex items-center gap-2 rounded-lg border border-ink/10 bg-paper-deep/60 px-3 py-2 tinylens:flex-wrap"
          :class="{ 'border-dashed border-ink/15': slot.sold }"
          :style="shelfTier(slot)"
        >
          <!--
            极窄档(≤220 CSS px)这一段要占满整行:三段横排时名称块只剩 4px 宽、副题
            折成 10 行(实测行高 140px)。放开成两行后名称块 137px / 4 行,行高 86px;
            320 / 390 两档读数不动。
          -->
          <div class="min-w-0 flex-1 text-[11px] tinylens:basis-full">
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
              <!--
                货架上一件兵刃的主标题该是「它是什么」,不是「它多好」。
                原先这里印的是「精品·9 层 品质底档精品」—— 品阶名打头、末尾又复述一遍,
                真正的物件反而没有名字,玩家买完才知道拿的是什么。
                改成:装备名(品阶色) · 品阶 · 阶数;底档降为副行的一句附注。
                天/仙/神在名前盖品阶阴文章(与背包格/候选行同一条形状线索)。
              -->
              <p class="truncate">
                <QualitySeal
                  v-if="previews[slot.idx]?.rare"
                  :quality="previews[slot.idx]!.quality"
                  :size="12"
                  class="mr-1 align-[-2px]"
                />
                <span
                  class="font-kai"
                  :style="{ color: previews[slot.idx]?.color ?? 'var(--color-ink)' }"
                  >{{ previews[slot.idx]?.name ?? "兵刃" }}</span
                >
                <span class="text-ink-faint"
                  >· {{ previews[slot.idx]?.qualityName ?? "" }}{{ slot.tier }}阶</span
                >
              </p>
              <p class="text-[10px] text-ink-faint">
                一件已定兵刃,到手即用 · 底档{{
                  QUALITIES[(slot as { minQualityRank: number }).minQualityRank]?.name ?? ""
                }}
              </p>
            </template>
          </div>
          <span class="text-[11px] tabular text-cinnabar">{{ formatGN(slot.price) }} 灵石</span>
          <!-- min-h-[28px] 触达下限:此前的 !py-1 小钮实测只有 24.5px(排版自检尺子) -->
          <button
            class="btn-seal min-h-[28px] !px-3 !py-1 text-[11px]"
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
        <p v-if="market.stock.length === 0" class="py-3 text-center text-[11px] text-ink-faint">
          货架空着 —— 时辰一到自会换新。
        </p>
      </div>
    </section>

    <!-- 悬赏板:商号收购 -->
    <section v-show="marketTab === 'bounty'">
      <!-- 极窄档(≤220 CSS px)同一行塞不下「标题 + 一键领取 + 换新倒计时」:标题被压到
           19px 一字一行 —— 改成纵向堆叠,320 / 390 两档不动。 -->
      <div
        class="flex items-center justify-between pr-1 tinylens:flex-col tinylens:items-start tinylens:gap-1"
      >
        <SectionTitle title="悬赏板" />
        <div class="flex items-center gap-2">
          <button
            v-if="autoClaimable.length"
            class="btn-seal min-h-[28px] !px-2.5 !py-1 text-[11px] whitespace-nowrap"
            @click="claimAllAuto()"
          >
            一键领取({{ autoClaimable.length }})
          </button>
          <span
            class="text-[10px] text-ink-faint"
            :title="`${BOUNTY_REFRESH_SECONDS / 3600} 小时一版`"
            >换新
            <span class="countdown-slot">{{
              formatCountdown(bountyRemainingSec(bounty.bountyAt, now))
            }}</span></span
          >
        </div>
      </div>
      <div class="mt-1 space-y-2">
        <div
          v-for="o in bounty.orders"
          :key="o.idx"
          class="flex items-center gap-2 rounded-lg border border-ink/10 bg-paper-deep/60 px-3 py-2 tinylens:flex-wrap"
          :class="{ 'border-dashed border-ink/15': o.claimed }"
        >
          <div class="min-w-0 flex-1 text-[11px] tinylens:basis-full">
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
              <p v-else class="text-[10px] text-ink-faint">
                另得{{ RESOURCE_LABELS.wudao }}×{{ o.extra }}
              </p>
            </template>
            <template v-else>
              <p class="leading-relaxed">贡一柄 ≥{{ o.tier }} 阶兵刃</p>
              <p v-if="bountyShort(o)" class="text-[10px] text-cinnabar">
                {{ bountyShort(o) }}
              </p>
              <p v-else class="text-[10px] text-ink-faint">价随所交之品质现算</p>
            </template>
          </div>
          <span class="text-[11px] tabular text-cinnabar">
            {{
              o.kind === "equip"
                ? `≥ ${formatGN(equipBountyReward(o.tier, 0).stone)} 石 + ${equipBountyReward(o.tier, 0).dust} 尘`
                : `${formatGN(o.reward)} 灵石`
            }}
          </span>
          <button
            :data-bounty-equip="o.kind === 'equip' ? o.idx : undefined"
            class="btn-seal min-h-[28px] !px-3 !py-1 text-[11px]"
            :disabled="o.claimed || !bountyReady(o)"
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
      <div
        class="space-y-1"
        :data-market-candidate-total="equipCandidates.length"
        :data-market-candidate-start="equipCandidatePage.start"
      >
        <button
          v-for="it in equipCandidatePage.visible"
          :key="it.uid"
          :data-equip-candidate="it.uid"
          class="flex w-full items-center justify-between gap-2 rounded border border-ink/10 px-3 py-2 text-left text-[11px] hoverable:hover:border-cinnabar"
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
            <span class="font-kai" :style="{ color: qualityDef(it.quality).color }">
              {{ equipmentTemplate(it.templateId)?.name ?? "无名法器" }}
            </span>
            <span class="ml-1 text-ink-faint"
              >{{ qualityDef(it.quality).name }} · {{ it.tier }}阶</span
            >
          </span>
          <span class="ml-1 shrink-0 text-[11px] text-ink-faint tabular"
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
            class="btn-ghost min-h-[28px] flex-1 !py-1 text-[10px]"
            :aria-label="equipCandidatePrevLabel"
            @click="showPreviousEquipCandidates"
          >
            {{ equipCandidatePrevLabel }}
          </button>
          <button
            v-if="equipCandidatePage.hidden > 0"
            data-market-more="equip"
            :data-promised="Math.min(INVENTORY_RENDER_BATCH, equipCandidatePage.hidden)"
            class="btn-ghost min-h-[28px] flex-1 !py-1 text-[10px]"
            :aria-label="equipCandidateMoreLabel"
            @click="showMoreEquipCandidates"
          >
            {{ equipCandidateMoreLabel }}
          </button>
        </div>
        <p v-if="equipCandidates.length === 0" class="text-[11px] text-ink-faint">没有够阶的兵刃</p>
      </div>
    </BaseModal>

    <!-- 售出:寄卖装备 + 即时售丹/料 -->
    <section v-show="marketTab === 'sell'">
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
        <div
          class="rounded-lg border border-ink/10 bg-paper-deep/40 px-3 py-2"
          :data-market-consign-total="inventory.bagItems.length"
          :data-market-consign-start="consignPage.start"
        >
          <p class="mb-1 text-[10px] text-ink-faint">
            寄卖一件背包装备({{ MARKET_CONSIGN_SLOTS }} 格,约
            {{ MARKET_CONSIGN_SECONDS / 60 }} 分自售入账,离包即定)
          </p>
          <template v-if="market.consign.length < MARKET_CONSIGN_SLOTS">
            <div class="scroll-pane flex gap-1 overflow-x-auto">
              <!--
                这一枚是「挑一件去寄售」的候选。原先印的是 {{ it.quality }} —— 品阶的
                **id**（excellent / profound / earth），玩家看到的是英文枚举，不是品阶名。
                而且整枚只有「品阶·阶数·价格」,没有装备名 —— 同一阶数的两件根本分不出。
                改成:装备名(带品阶色) · 品阶名 · 阶数 · 价。
              -->
              <button
                v-for="it in consignPage.visible"
                :key="it.uid"
                :data-consign-uid="it.uid"
                class="inline-flex min-h-[28px] shrink-0 items-center rounded border border-ink/10 px-2 py-1 text-[10px] hoverable:hover:border-cinnabar"
                @click="consign(it.uid)"
              >
                <QualitySeal
                  v-if="isRareQuality(it.quality)"
                  :quality="it.quality"
                  :size="12"
                  class="mr-1"
                />
                <span class="font-kai" :style="{ color: qualityDef(it.quality).color }">{{
                  equipmentTemplate(it.templateId)?.name ?? "?"
                }}</span>
                <span class="text-ink-faint"
                  >· {{ qualityDef(it.quality).name }}{{ it.tier }}阶 ·
                  {{ formatGN(consignPrice(it.tier, qualityDef(it.quality).rank)) }} 石</span
                >
              </button>
              <span v-if="inventory.bagItems.length === 0" class="text-[10px] text-ink-faint"
                >行囊空空 —— 去历练中寻些机缘吧</span
              >
            </div>
            <div v-if="consignPage.hidden > 0 || consignPage.start > 0" class="mt-1 flex gap-1">
              <button
                v-if="consignPage.start > 0"
                data-market-prev="consign"
                class="btn-ghost min-h-[28px] flex-1 !py-1 text-[10px]"
                :aria-label="consignPrevLabel"
                @click="showPreviousConsign"
              >
                {{ consignPrevLabel }}
              </button>
              <button
                v-if="consignPage.hidden > 0"
                data-market-more="consign"
                :data-promised="Math.min(INVENTORY_RENDER_BATCH, consignPage.hidden)"
                class="btn-ghost min-h-[28px] flex-1 !py-1 text-[10px]"
                :aria-label="consignMoreLabel"
                @click="showMoreConsign"
              >
                {{ consignMoreLabel }}
              </button>
            </div>
          </template>
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
            class="inline-flex min-h-[28px] items-center rounded border border-ink/10 px-2 py-1 text-[10px] hoverable:hover:border-cinnabar"
            @click="sellPill(p.id)"
          >
            售{{ p.def?.name ?? p.id }}(现持 {{ p.count }}) · 每颗得
            {{ formatGN(pillSellPrice(p.id)) }} 石
          </button>
          <button
            class="inline-flex min-h-[28px] items-center rounded border border-ink/10 px-2 py-1 text-[10px] hoverable:hover:border-cinnabar"
            :disabled="!resources.hasSmall('herb', MARKET_MAT_COUNT)"
            @click="sellMat('herb')"
          >
            {{
              herbSellShort > 0
                ? `尚差 ${herbSellShort} 灵草`
                : `售灵草×${MARKET_MAT_COUNT} · 得 ${formatGN(materialSellPrice(player.major))} 石`
            }}
          </button>
          <button
            class="inline-flex min-h-[28px] items-center rounded border border-ink/10 px-2 py-1 text-[10px] hoverable:hover:border-cinnabar"
            :disabled="!resources.hasSmall('ore', MARKET_MAT_COUNT)"
            @click="sellMat('ore')"
          >
            {{
              oreSellShort > 0
                ? `尚差 ${oreSellShort} 玄铁`
                : `售玄铁×${MARKET_MAT_COUNT} · 得 ${formatGN(materialSellPrice(player.major))} 石`
            }}
          </button>
          <span v-if="sellablePills.length === 0" class="text-[10px] text-ink-faint"
            >并无即时可售的丹药 —— 历练所得,自能入市</span
          >
        </div>
      </div>
    </section>
  </div>
</template>
