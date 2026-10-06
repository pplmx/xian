/**
 * 器魂服务的编排 —— 两重代价下不许手滑
 *
 * 凝炼要**销毁原器**且**耗道源**,两重代价让「凝哪件」成为真决策。既有单测覆盖的是
 * soulForge(纯生成)与 data/souls(数据),唯独「refuse 时不改状态、成功时两道代价
 * 都真扣、装配槽位封顶」这层编排没有直接判据 —— 而这层一旦漏,玩家丢的是实物。
 *
 * 判据四组:
 *   ① 锁定 / 已装配 / 白板(无形意)/ 道源不足 —— 四条拒绝路径都不许动装备与道源;
 *   ② 成功 —— 扣道源、销毁原器、得器魂,三件事同时发生;
 *   ③ 装配封顶 —— 第 SOUL_SLOTS+1 枚装不上;
 *   ④ 卸下与散去 —— 散去要从持有与装配两处同时消失。
 */
import { afterEach, beforeEach, describe, expect, it } from "vite-plus/test";
import { createPinia, setActivePinia } from "pinia";
import type { EquipmentInstance } from "@/types";
import { SOUL_SLOTS } from "@/data/souls";
import { equipmentTemplate } from "@/data/equipment";
import { setNotifier } from "./notify";
import {
  SOUL_REFINE_COST,
  dissolveSoul,
  refineEquipment,
  removeSoul,
  wearSoul,
} from "./soulService";
import { useEndgameStore } from "@/stores/endgame";
import { useInventoryStore } from "@/stores/inventory";

/** 一件「有路数」的器:带 crit 词条(判定为锋魂),模板真实存在 */
const weapon = (uid: string): EquipmentInstance => ({
  uid,
  templateId: "w_zidian",
  quality: "heaven",
  tier: 9,
  level: 0,
  affixes: [{ id: "crit3", roll: 1 }],
});

/** 一件白板:没有任何判定词条 —— 凝不出器魂 */
const blank = (uid: string): EquipmentInstance => ({
  uid,
  templateId: "b_qingyun",
  quality: "heaven",
  tier: 3,
  level: 0,
  affixes: [],
});

const fakeSoul = (uid: string, fromName = "测试") =>
  ({ uid, type: "fengmang" as const, grade: 3, fromName }) as const;

let inv: ReturnType<typeof useInventoryStore>;
let end: ReturnType<typeof useEndgameStore>;
let msgs: string[];

beforeEach(() => {
  setActivePinia(createPinia());
  inv = useInventoryStore();
  end = useEndgameStore();
  msgs = [];
  setNotifier({ toast: (text) => void msgs.push(text) });
});

afterEach(() => {
  setNotifier(null);
});

describe("器魂凝炼 · 拒绝路径不许改状态", () => {
  it("锁定 / 已装配 / 白板:装备都还在,道源不动,也凝不出器魂", () => {
    inv.addEquipment({ ...weapon("a"), locked: true });
    inv.addEquipment(blank("b"));
    inv.addEquipment(weapon("c"));
    inv.equip("c", "weapon");
    end.daoSource = 100;

    expect(refineEquipment("a"), "锁定的件不该被凝").toBe(false);
    expect(refineEquipment("b"), "白板件凝不出器魂").toBe(false);
    expect(refineEquipment("c"), "身上之物不该被凝").toBe(false);

    expect(inv.findItem("a")).toBeTruthy();
    expect(inv.findItem("b")).toBeTruthy();
    expect(inv.findItem("c")).toBeTruthy();
    expect(end.daoSource).toBe(100);
    expect(end.soulList).toHaveLength(0);
  });

  it("道源不足:不扣、不毁、无魂,提示写清楚差多少", () => {
    inv.addEquipment(weapon("d"));
    end.daoSource = SOUL_REFINE_COST - 1;

    expect(refineEquipment("d")).toBe(false);
    expect(end.daoSource).toBe(SOUL_REFINE_COST - 1);
    expect(inv.findItem("d"), "拒绝时原器必须还在").toBeTruthy();
    expect(end.soulList).toHaveLength(0);
    expect(msgs.some((m) => m.includes(String(SOUL_REFINE_COST)))).toBe(true);
  });
});

describe("器魂凝炼 · 成功时两道代价都真扣", () => {
  it("扣道源、销毁原器、得器魂,三件事同时发生", () => {
    inv.addEquipment(weapon("e"));
    end.daoSource = SOUL_REFINE_COST + 7;

    expect(refineEquipment("e")).toBe(true);
    expect(inv.findItem("e"), "原器应已销毁").toBeUndefined();
    expect(end.daoSource).toBe(7);
    expect(end.soulList).toHaveLength(1);
    // 形意记得它从哪件来(器魂铭记原器名)
    expect(end.soulList[0]!.fromName).toBe(equipmentTemplate("w_zidian")?.name);
  });
});

describe("器魂装配 · 槽位封顶", () => {
  it(`第 ${SOUL_SLOTS + 1} 枚装不上`, () => {
    const ids: string[] = [];
    for (let i = 0; i < SOUL_SLOTS; i += 1) {
      const soul = fakeSoul(`s${i}`);
      end.addSoul(soul);
      expect(wearSoul(soul.uid)).toBe(true);
      ids.push(soul.uid);
    }
    const extra = fakeSoul("sx");
    end.addSoul(extra);

    expect(wearSoul(extra.uid)).toBe(false);
    expect(end.activeSouls).toHaveLength(SOUL_SLOTS);
    expect(end.activeSouls.map((s) => s.uid)).toEqual(ids);
  });
});

describe("器魂卸下与散去", () => {
  it("卸下:仍持有,只是不装配", () => {
    end.addSoul(fakeSoul("y"));
    expect(wearSoul("y")).toBe(true);
    removeSoul("y");
    expect(end.activeSouls).toHaveLength(0);
    expect(end.soulList).toHaveLength(1);
  });

  it("散去:持有与装配两处同时消失(不可逆)", () => {
    end.addSoul(fakeSoul("z"));
    expect(wearSoul("z")).toBe(true);
    dissolveSoul("z");
    expect(end.soulList).toHaveLength(0);
    expect(end.activeSouls).toHaveLength(0);
  });
});
