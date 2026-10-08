/**
 * 坊市 store —— 货架(买)与寄卖(卖)两块,随存档持久化。
 *
 * 货架生成与定价在 core/marketService(纯逻辑,不 import store);本文件只做
 * 「读存量 → 判 → 扣付 → 入账」的编排。坏档/旧档由 sanitize 逐格修形,烂格整格丢弃。
 */
import { defineStore } from "pinia";
import { ref } from "vue";
import { persistConfig } from "@/utils/storage";
import { rng } from "@/utils/random";
import { usePlayerStore } from "@/stores/player";
import { useResourcesStore } from "@/stores/resources";
import { useInventoryStore } from "@/stores/inventory";
import { pillDef } from "@/data/pills";
import { equipmentTemplate } from "@/data/equipment";
import { qualityDef } from "@/data/qualities";
import {
  consignPrice,
  generateMarketStock,
  marketEquipInstance,
  materialSellPrice,
  pillSellPrice,
} from "@/core/marketService";
import {
  MARKET_CONSIGN_SECONDS,
  MARKET_CONSIGN_SLOTS,
  MARKET_MAT_COUNT,
  MARKET_REFRESH_SECONDS,
  type ConsignPost,
  type MarketSlot,
} from "@/data/market";
import { asArray, asFiniteNumber, asNonNegInt, asPrice } from "@/utils/saveShape";

export type MarketBuyResult = "ok" | "sold" | "poor" | "bagfull" | "missing";

export const useMarketStore = defineStore(
  "market",
  () => {
    const stock = ref<MarketSlot[]>([]);
    const stockedAt = ref(0);
    const consign = ref<ConsignPost[]>([]);

    /** 存档修复:货架逐格修形,烂格整格丢弃(少一件货好过白屏);时刻夹回非负 */
    function sanitize(): void {
      stockedAt.value = Math.max(0, asFiniteNumber(stockedAt.value, 0));
      const clean: MarketSlot[] = [];
      for (const raw of asArray<unknown>(stock.value)) {
        if (!raw || typeof raw !== "object" || !("kind" in raw)) continue;
        const kind = raw.kind;
        if (kind !== "pill" && kind !== "material" && kind !== "equipment") continue;
        const sold = "sold" in raw && raw.sold === true;
        const idx = asNonNegInt("idx" in raw ? raw.idx : undefined, clean.length);

        if (kind === "pill") {
          if (!("pillId" in raw) || typeof raw.pillId !== "string" || !pillDef(raw.pillId))
            continue;
          clean.push({
            kind,
            idx,
            pillId: raw.pillId,
            count: Math.max(1, Math.floor(Number("count" in raw ? raw.count : 1) || 1)),
            price: asPrice("price" in raw ? raw.price : undefined),
            sold,
          });
        } else if (kind === "material") {
          const matId = "matId" in raw ? raw.matId : undefined;
          if (matId !== "herb" && matId !== "ore") continue;
          clean.push({
            kind,
            idx,
            matId,
            count: Math.max(1, Math.floor(Number("count" in raw ? raw.count : 1) || 1)),
            price: asPrice("price" in raw ? raw.price : undefined),
            sold,
          });
        } else {
          clean.push({
            kind,
            idx,
            tier: Math.max(0, Math.floor(Number("tier" in raw ? raw.tier : 0) || 0)),
            minQualityRank: Math.max(
              0,
              Math.floor(Number("minQualityRank" in raw ? raw.minQualityRank : 0) || 0),
            ),
            price: asPrice("price" in raw ? raw.price : undefined),
            sold,
          });
        }
      }
      stock.value = clean;

      const posts: ConsignPost[] = [];
      for (const raw of asArray<unknown>(consign.value)) {
        if (!raw || typeof raw !== "object" || !("finishAt" in raw)) continue;
        const finishAt = Number.isFinite(raw.finishAt)
          ? Math.max(0, Math.floor(raw.finishAt as number))
          : -1;
        if (finishAt < 0) continue;
        posts.push({
          slot: Math.max(0, Math.floor(Number("slot" in raw ? raw.slot : posts.length) || 0)),
          tier: Math.max(0, Math.floor(Number("tier" in raw ? raw.tier : 0) || 0)),
          qualityRank: Math.max(
            0,
            Math.floor(Number("qualityRank" in raw ? raw.qualityRank : 0) || 0),
          ),
          price: asPrice("price" in raw ? raw.price : undefined),
          finishAt,
          name: "name" in raw && typeof raw.name === "string" ? raw.name : "",
        });
      }
      consign.value = posts;
    }

    /** 货架空、或已过刷新窗口则重上一架;此刻的架内货不动 */
    function sync(now: number): void {
      if (stock.value.length > 0 && now < stockedAt.value + MARKET_REFRESH_SECONDS * 1000) return;
      const player = usePlayerStore();
      const gen = generateMarketStock(player.major, rng, now);
      stock.value = gen.goods;
      stockedAt.value = gen.stockedAt;
    }

    /** 买下第 idx 格;装备先验行囊满否、再扣灵石,次序错了会「花了钱没拿到货」 */
    function buy(idx: number): MarketBuyResult {
      const now = Date.now();
      sync(now);
      const slot = stock.value.find((s) => s.idx === idx);
      if (!slot) return "missing";
      if (slot.sold) return "sold";
      const inventory = useInventoryStore();
      if (slot.kind === "equipment" && inventory.bagFull) return "bagfull";
      const resources = useResourcesStore();
      if (!resources.spendStone(slot.price)) return "poor";
      if (slot.kind === "pill") {
        inventory.addPill(slot.pillId, slot.count);
      } else if (slot.kind === "material") {
        resources.addSmall(slot.matId, slot.count);
      } else {
        inventory.addEquipment(marketEquipInstance(slot, stockedAt.value));
      }
      slot.sold = true;
      return "ok";
    }

    /** 寄卖一件背包装备;离包即定,一到时辰自售入账,不可撤回 */
    function consignEquip(uid: string, now: number): "ok" | "full" | "missing" {
      if (consign.value.length >= MARKET_CONSIGN_SLOTS) return "full";
      const inventory = useInventoryStore();
      const eq = inventory.bagItems.find((it) => it.uid === uid);
      if (!eq) return "missing";
      const name = equipmentTemplate(eq.templateId)?.name ?? "一件兵刃";
      const slot = consign.value.reduce((max, p) => Math.max(max, p.slot + 1), 0);
      consign.value.push({
        slot: Math.min(slot, MARKET_CONSIGN_SLOTS - 1),
        tier: eq.tier,
        qualityRank: qualityDef(eq.quality).rank,
        price: consignPrice(eq.tier, qualityDef(eq.quality).rank),
        finishAt: now + MARKET_CONSIGN_SECONDS * 1000,
        name,
      });
      inventory.removeEquipment(uid);
      return "ok";
    }

    /** 收割已售出的寄卖:入账灵石,清掉到期的格子,回售出名 */
    function collectConsign(now: number): string[] {
      const credits: string[] = [];
      const resources = useResourcesStore();
      for (const p of consign.value) {
        if (p.finishAt <= now) {
          resources.addStone(p.price);
          if (p.name) credits.push(p.name);
        }
      }
      // 荡平已售出,把余下格子的 slot 规整回 0..n-1
      const keep = consign.value
        .filter((p) => p.finishAt > now)
        .sort((a, b) => a.slot - b.slot)
        .map((p, i) => ({ ...p, slot: i }));
      consign.value = keep;
      return credits;
    }

    /** 即时售一枚丹药(仅限可炼丹;无丹方的事件丹无价,不当白给) */
    function sellPill(pillId: string): boolean {
      const def = pillDef(pillId);
      const inventory = useInventoryStore();
      if (!def?.recipe?.stoneBase || (inventory.pills[pillId] ?? 0) < 1) return false;
      inventory.spendPill(pillId, 1);
      useResourcesStore().addStone(pillSellPrice(pillId));
      return true;
    }

    /** 即时售一批材料(与货架购入同单位数) */
    function sellMaterial(matId: "herb" | "ore", major: number): boolean {
      const resources = useResourcesStore();
      if (!resources.hasSmall(matId, MARKET_MAT_COUNT)) return false;
      resources.spendSmall(matId, MARKET_MAT_COUNT);
      resources.addStone(materialSellPrice(major));
      return true;
    }

    return {
      stock,
      stockedAt,
      consign,
      sanitize,
      sync,
      buy,
      consignEquip,
      collectConsign,
      sellPill,
      sellMaterial,
    };
  },
  { persist: persistConfig("market") },
);
