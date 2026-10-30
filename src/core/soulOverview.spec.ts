import { describe, expect, it } from "vite-plus/test";
import type { EquipmentInstance } from "@/types";
import { SOUL_REFINE_COST, type SoulInstance } from "@/data/souls";
import { soulOverview } from "./soulOverview";

const weapon = (
  uid: string,
  templateId = "w_zidian",
  affixes: EquipmentInstance["affixes"] = [{ id: "crit3", roll: 1 }],
) =>
  ({
    uid,
    templateId,
    quality: "heaven",
    tier: 9,
    level: 0,
    affixes,
  }) satisfies EquipmentInstance;

const soul = (uid: string): SoulInstance => ({
  uid,
  type: "fengmang",
  grade: 3,
  fromName: "测试",
});

describe("器魂卷首 · 可凝与道源同源", () => {
  it("只把未锁、未穿戴且真有形意的件算作可凝，并报出付不起的短差", () => {
    const overview = soulOverview({
      activeSouls: [soul("active")],
      soulList: [soul("active"), soul("idle")],
      items: [
        weapon("ready"),
        { ...weapon("locked"), locked: true },
        weapon("worn"),
        weapon("blank", "b_qingyun", []),
      ],
      equippedUids: new Set(["worn"]),
      daoSource: SOUL_REFINE_COST - 1,
    });

    expect(overview.activeCount).toBe(1);
    expect(overview.idleSouls.map((s) => s.uid)).toEqual(["idle"]);
    expect(overview.refinable.map((item) => item.uid)).toEqual(["ready"]);
    expect(overview.affordableRefines).toBe(0);
    expect(overview.shortfall).toBe(1);
  });

  it("道源够几件就只报几件此刻可凝，不把整册都写成能按", () => {
    const overview = soulOverview({
      activeSouls: [],
      soulList: [],
      items: [weapon("a"), weapon("b"), weapon("c")],
      equippedUids: new Set(),
      daoSource: SOUL_REFINE_COST * 2 + 7,
    });

    expect(overview.refinable).toHaveLength(3);
    expect(overview.affordableRefines).toBe(2);
    expect(overview.shortfall).toBe(0);
  });

  it("槽位满与空闲数从同一份器魂清单派生", () => {
    const active = [soul("a"), soul("b"), soul("c")];
    const overview = soulOverview({
      activeSouls: active,
      soulList: [...active, soul("d")],
      items: [],
      equippedUids: new Set(),
      daoSource: 0,
    });

    expect(overview.slotsFull).toBe(true);
    expect(overview.activeCount).toBe(overview.slotTotal);
    expect(overview.idleSouls.map((s) => s.uid)).toEqual(["d"]);
    expect(overview.refinable).toEqual([]);
  });

  it("下一步先装闲置、再取舍、再开炉,最后才回行囊找器", () => {
    const one = soul("one");
    const full = [soul("a"), soul("b"), soul("c")];
    const base = {
      soulList: [],
      items: [],
      equippedUids: new Set<string>(),
      daoSource: 0,
    };

    expect(
      soulOverview({
        ...base,
        activeSouls: [],
        soulList: [one],
      }).nextAction,
    ).toBe("wear");
    expect(
      soulOverview({
        ...base,
        activeSouls: full,
        soulList: [...full, one],
      }).nextAction,
    ).toBe("choose");
    expect(
      soulOverview({
        ...base,
        activeSouls: [],
        items: [weapon("ready")],
        daoSource: SOUL_REFINE_COST,
      }).nextAction,
    ).toBe("refine");
    expect(
      soulOverview({
        ...base,
        activeSouls: [],
        items: [weapon("ready")],
        daoSource: SOUL_REFINE_COST - 1,
      }).nextAction,
    ).toBe("short");
    expect(
      soulOverview({
        ...base,
        activeSouls: full,
        soulList: full,
      }).nextAction,
    ).toBe("settled");
    expect(
      soulOverview({
        ...base,
        activeSouls: [],
      }).nextAction,
    ).toBe("inventory");
  });
});
