import { describe, expect, it } from "vite-plus/test";
import type { EquipmentInstance } from "@/types";
import { SOUL_REFINE_COST, SOUL_TYPES, type SoulInstance } from "@/data/souls";
import { CELESTIAL_BASE_DEPTH } from "./gauntlet";
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

  it("合计深度 —— 三席合起来有多深，与 souls.spec 同一把量尺", () => {
    /*
     * ## 为什么要报它（第 562 轮）
     *
     * `souls.spec` 用「满配器魂合计深度 1.52」当量尺，而界面上没有一处说这个数。
     * 玩家看得到每枚器魂的名字与品阶，却看不到「这三枚合起来有多深」——
     * 而单看一枚「化真」说不出什么，三枚加起来 1.52 对基准 2.6 才是那一句话。
     */
    const soul = (uid: string, type: string, grade: number): SoulInstance => ({
      uid,
      type: type as SoulInstance["type"],
      grade,
      fromName: "神品",
    });
    const two = soulOverview({
      activeSouls: [soul("a", SOUL_TYPES[0]!.id, 0), soul("b", SOUL_TYPES[1]!.id, 0)],
      soulList: [],
      items: [],
      equippedUids: new Set(),
      daoSource: 0,
    });
    expect(two.totalDepth, "两枚零阶器魂的深度该 > 0").toBeGreaterThan(0);
    expect(two.baseDepth, "基准深度要报出来 —— 单看一个数没有参照").toBe(CELESTIAL_BASE_DEPTH);

    /* 一枚都没上 → 0（空席不贡献） */
    const none = soulOverview({
      activeSouls: [],
      soulList: [],
      items: [],
      equippedUids: new Set(),
      daoSource: 0,
    });
    expect(none.totalDepth, "一席空着时不该有深度").toBe(0);

    /* 上满三席比两席深 —— 单调 */
    const three = soulOverview({
      activeSouls: [
        soul("a", SOUL_TYPES[0]!.id, 0),
        soul("b", SOUL_TYPES[1]!.id, 0),
        soul("c", SOUL_TYPES[2]!.id, 0),
      ],
      soulList: [],
      items: [],
      equippedUids: new Set(),
      daoSource: 0,
    });
    expect(three.totalDepth, "多上一枚该更深").toBeGreaterThan(two.totalDepth);
  });
});
