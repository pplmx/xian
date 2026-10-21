/**
 * 坊市悬赏板 store —— 当前一版订单与刷新时刻(持久化,须带 sanitize)。
 *
 * 订单按墙钟走,到期换新;每张交货一次即盖「已交」。交货即验货扣存货/交装,价由
 * core/bountyService(纯)现算,这里只管入账翻身。
 */
import { defineStore } from "pinia";
import { ref } from "vue";
import type { QualityId } from "@/types";
import { persistConfig } from "@/utils/storage";
import { usePlayerStore } from "@/stores/player";
import { useResourcesStore } from "@/stores/resources";
import { useInventoryStore } from "@/stores/inventory";
import { qualityDef } from "@/data/qualities";
import { BOUNTY_REFRESH_SECONDS, type BountyKind, type BountySlot } from "@/data/bounty";
import { equipBountyReward, generateBounty } from "@/core/bountyService";
import { asArray, asFiniteNumber, asNonNegInt, asPrice } from "@/utils/saveShape";

export type BountyClaimResult =
  | "ok"
  | "claimed"
  | "insufficient"
  | "nobag"
  | "missing"
  /**
   * 点下去的那一瞬正好跨过换版窗口:订单已整版换新,`idx` 指的是另一张单。
   * 单靠 idx 认单的话,这时会**拿玩家没看过的单成交**:扣的是玩家手里的货,
   * 收货与赏格却是新单的 —— 宁可不成,让他按新单再点。
   */
  | "expired";

function isKind(v: unknown): v is BountyKind {
  return v === "herb" || v === "ore" || v === "pill" || v === "equip";
}

/** 交一柄兵刃入账:现算灵石器尘(按所交之品的品质);贡器四路共用,价随实交 */
function deliverEquip(eq: { uid: string; tier: number; quality: QualityId }): void {
  const r = equipBountyReward(eq.tier, qualityDef(eq.quality).rank);
  useInventoryStore().removeEquipment(eq.uid);
  const resources = useResourcesStore();
  resources.addStone(r.stone);
  if (r.dust > 0) resources.addSmall("dust", r.dust);
}

export const useBountyStore = defineStore(
  "bounty",
  () => {
    const orders = ref<BountySlot[]>([]);
    const bountyAt = ref(0);

    /** 存档修复:订单逐纸修形,烂纸丢弃;时刻夹回非负(归零会即时换新) */
    function sanitize(): void {
      bountyAt.value = Math.max(0, asFiniteNumber(bountyAt.value, 0));
      const clean: BountySlot[] = [];
      for (const raw of asArray<unknown>(orders.value)) {
        if (!raw || typeof raw !== "object" || !("kind" in raw) || !isKind(raw.kind)) continue;
        clean.push({
          // 占位:shape 过滤完统一重排 —— 坏档两张同号会让第二张永远交不了
          idx: clean.length,
          kind: raw.kind,
          kindId: "kindId" in raw && typeof raw.kindId === "string" ? raw.kindId : "",
          target: Math.max(1, asNonNegInt("target" in raw ? raw.target : 1, 1)),
          tier: asNonNegInt("tier" in raw ? raw.tier : 0, 0),
          reward: asPrice("reward" in raw ? raw.reward : undefined),
          extra: Math.max(0, asNonNegInt("extra" in raw ? raw.extra : 0, 0)),
          claimed: "claimed" in raw && raw.claimed === true,
        });
      }
      // 单号统一重排 0..n-1:idx 只是这一版的格号,顺序即身份 —— 重排后每张单都交得了
      orders.value = clean.map((o, i) => ({ ...o, idx: i }));
    }

    /** 订单空、或已过刷新窗口则换新一版(此刻的订单不动,交货中的不打断) */
    function sync(now: number): void {
      if (orders.value.length > 0 && now < bountyAt.value + BOUNTY_REFRESH_SECONDS * 1000) return;
      const player = usePlayerStore();
      orders.value = generateBounty(player.major, now);
      bountyAt.value = now;
    }

    /** 交货第 idx 单;验货→扣货→入账;贡器按所交之品的品质现算价 */
    function claim(idx: number): BountyClaimResult {
      const now = Date.now();
      const before = orders.value;
      sync(now);
      // 换版了:idx 现在指的是另一张单,不能替玩家交给他没看过的那张
      if (before.length > 0 && orders.value !== before) return "expired";
      const slot = orders.value.find((s) => s.idx === idx);
      if (!slot) return "missing";
      if (slot.claimed) return "claimed";
      const resources = useResourcesStore();
      const inventory = useInventoryStore();

      if (slot.kind === "herb" || slot.kind === "ore") {
        if (slot.kindId === "ore") {
          if (!resources.hasSmall("ore", slot.target)) return "insufficient";
          resources.spendSmall("ore", slot.target);
        } else if (!resources.spendHerbsAll(slot.target)) {
          return "insufficient";
        }
        resources.addStone(slot.reward);
      } else if (slot.kind === "pill") {
        if ((inventory.pills[slot.kindId] ?? 0) < slot.target) return "insufficient";
        inventory.spendPill(slot.kindId, slot.target);
        resources.addStone(slot.reward);
        if (slot.extra > 0) resources.addSmall("wudao", slot.extra);
      } else {
        const eq = inventory.bagItems.find((e) => e.tier >= slot.tier);
        if (!eq) return "nobag";
        deliverEquip(eq);
      }
      slot.claimed = true;
      return "ok";
    }

    /** 交货一柄玩家点选的够格兵刃(不再自动取第一件) */
    function claimEquip(idx: number, uid: string): BountyClaimResult {
      const now = Date.now();
      const before = orders.value;
      sync(now);
      // 换版同防:点选的 uid 是对着旧单挑的,新单的门槛未必还认它
      if (before.length > 0 && orders.value !== before) return "expired";
      const slot = orders.value.find((s) => s.idx === idx);
      if (!slot || slot.kind !== "equip") return "missing";
      if (slot.claimed) return "claimed";
      const eq = useInventoryStore().bagItems.find((e) => e.uid === uid);
      if (!eq) return "missing";
      if (eq.tier < slot.tier) return "insufficient";
      deliverEquip(eq);
      slot.claimed = true;
      return "ok";
    }

    return { orders, bountyAt, sanitize, sync, claim, claimEquip };
  },
  { persist: persistConfig("bounty") },
);
