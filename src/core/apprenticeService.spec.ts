/**
 * 收徒产出 —— 纯计算判据(apprenticeSpoils / taskDone)。
 *
 * 守三件事:
 *   · 天赋门类产出 ×APPRENTICE_TALENT_BONUS(数值字段 floor);
 *   · 寻宝给整数枚丹药,天赋加成用 ceil(否则 1 枚基座 floor 后天赋整场失活,
 *     开局白送的 ap_lingtong 正是 talent='seek' —— 见 ISS 修为/寻宝);
 *   · 任务完工只看墙钟 finishAt。
 */
import { readFileSync } from "node:fs";
import type { QualityId } from "@/types";
import { resolve } from "node:path";
import {
  APPRENTICES,
  APPRENTICE_QUALITY_BONUS,
  APPRENTICE_TALENT_BONUS,
  STARTER_APPRENTICE,
  apprenticeYieldMult,
} from "@/data/apprentices";
import { describe, expect, it } from "vite-plus/test";
import {
  apprenticeOverview,
  apprenticeRoster,
  apprenticeSpoils,
  apprenticeTaskProgress,
  taskDone,
  type OwnedApprentice,
} from "./apprenticeService";

function apprentice(over: Partial<OwnedApprentice> = {}): OwnedApprentice {
  return {
    uid: "u",
    archId: "ap_lingtong",
    level: 1,
    bond: 0,
    task: null,
    ...over,
  };
}

describe("apprenticeSpoils 天赋加成", () => {
  it("数值类天赋门类 ×1.25 取 floor:采药灵童采药 Lv1 得 7 草", () => {
    // ap_luanniao talent=herb;herb 基础 4 + level*2 = 6;6×1.25=7.5 → floor 7
    const s = apprenticeSpoils("ap_luanniao", "herb", 0, 1);
    expect(s.herb).toBe(7);
  });

  it("非天赋门类照基础:采药灵童采矿 Lv1 得 5 铁", () => {
    // ore 基础 3 + 2 = 5;mult=1
    const s = apprenticeSpoils("ap_luanniao", "ore", 0, 1);
    expect(s.ore).toBe(5);
  });

  it("寻宝天赋(寻宝灵童)在 1 枚基座上用 ceil 显出差值:得 2 枚而非常规 1 枚", () => {
    // ap_lingtong talent=seek;寻宝基础 pillCount=1;ceil(1×1.25)=2
    const talented = apprenticeSpoils("ap_lingtong", "seek", 0, 1);
    expect(talented.pillCount).toBe(2);
    // 非寻宝天赋(采药灵童)照旧 1 枚
    const plain = apprenticeSpoils("ap_luanniao", "seek", 0, 1);
    expect(plain.pillCount).toBe(1);
  });
});

describe("taskDone", () => {
  it("按墙钟 finishAt 判完工", () => {
    const a = apprentice({
      task: { spec: "seek", startAt: 1000, finishAt: 2000 },
    });
    expect(taskDone(a, 1000)).toBe(false);
    expect(taskDone(a, 2000)).toBe(true);
  });
});

describe("门庭今日", () => {
  it("在途、闲置与最近归期只从弟子列表算一次", () => {
    const overview = apprenticeOverview([
      apprentice({ uid: "idle" }),
      apprentice({
        uid: "later",
        task: { spec: "herb", startAt: 0, finishAt: 5000 },
      }),
      apprentice({
        uid: "sooner",
        task: { spec: "study", startAt: 0, finishAt: 3000 },
      }),
    ]);

    expect(overview).toEqual({
      total: 3,
      idle: 1,
      away: 2,
      nextReturnAt: 3000,
      nextReturnSpec: "study",
    });
  });

  it("空门庭不编造归期", () => {
    expect(apprenticeOverview([])).toEqual({
      total: 0,
      idle: 0,
      away: 0,
      nextReturnAt: null,
      nextReturnSpec: null,
    });
  });

  it("值日簿候差在前,在途按归期从近到远,同刻保留原序", () => {
    const roster = apprenticeRoster([
      apprentice({
        uid: "later",
        task: { spec: "herb", startAt: 0, finishAt: 9000 },
      }),
      apprentice({ uid: "idle-a" }),
      apprentice({
        uid: "sooner",
        task: { spec: "study", startAt: 0, finishAt: 3000 },
      }),
      apprentice({ uid: "idle-b" }),
      apprentice({
        uid: "same-time",
        task: { spec: "ore", startAt: 0, finishAt: 3000 },
      }),
    ]);

    expect(roster.map((row) => [row.apprentice.uid, row.away])).toEqual([
      ["idle-a", false],
      ["idle-b", false],
      ["sooner", true],
      ["same-time", true],
      ["later", true],
    ]);
  });
});

describe("差事进度", () => {
  it("按墙钟在起止之间推进,并把越界值夹在 0~1", () => {
    const task = { startAt: 1000, finishAt: 5000 };
    expect(apprenticeTaskProgress(task, 1000)).toBe(0);
    expect(apprenticeTaskProgress(task, 3000)).toBe(0.5);
    expect(apprenticeTaskProgress(task, 9000)).toBe(1);
  });

  it("零时长与坏值都不泄漏 NaN", () => {
    expect(apprenticeTaskProgress({ startAt: 1000, finishAt: 1000 }, 999)).toBe(0);
    expect(apprenticeTaskProgress({ startAt: 1000, finishAt: 1000 }, 1000)).toBe(1);
    expect(apprenticeTaskProgress({ startAt: Number.NaN, finishAt: 1000 }, 1000)).toBe(1);
  });
});

/**
 * 品质必须真的影响产出 —— 否则它只是个染色字段。
 *
 * ## 缺口
 *
 * `ApprenticeArchetype.quality` 定义了六个原型的品质(mortal / fine / excellent / spirit),
 * 界面上按它给名字上色(`qualityText`),而**产出公式完全不看它**:
 *
 * ```ts
 * const mult = def && def.talent === spec ? APPRENTICE_TALENT_BONUS : 1;
 * ```
 *
 * 于是「凡品采药童子」与「灵品寻宝灵童」的产出只差天赋那 1.25 倍,
 * 品质在玩法上等于不存在。玩家收到高品弟子时,除了名字换个颜色之外
 * 没有任何实质变化 —— 而品质在全仓别处(`QualityDef.mult`)都是个真数值。
 *
 * ## 判据守什么
 *
 * 一 同一个天赋门类下,品质越高产出越高(`apprenticeYieldMult` 严格单调);
 * 二 品质加成与天赋加成**相乘**,不是取其一;
 * 三 倍率只有一个来源:结算与界面预览都调 `apprenticeYieldMult`,
 *    不许再在 service 里就地拼一份。
 */
describe("弟子产出 · 品质必须参与", () => {
  it("同一天赋门类下,品质越高产出越高", () => {
    // 按品质档次给同一门类各挑一个原型(用工坊里的真实数据,不造假家伙)
    const byQuality = new Map<string, string>();
    for (const arch of APPRENTICES) {
      if (!byQuality.has(arch.quality)) byQuality.set(arch.quality, arch.id);
    }
    // 只比较 harvest 门类:所有原型都能派,故倍率可横向比
    const rows = [...byQuality.entries()]
      .map(([quality, id]) => ({ quality, id, mult: apprenticeYieldMult(id, "herb") }))
      .sort((a, b) => a.mult - b.mult);
    expect(rows.length, "原型覆盖的品质档位太少,这条比较没有意义").toBeGreaterThanOrEqual(3);
    /*
     * 严格单调:排序后的倍率不许有相等项 —— 相等说明「换了品质产出不变」,
     * 正是这条要抓的那件事。注意排除同一个原型被重复计入的情况。
     */
    for (let i = 1; i < rows.length; i += 1) {
      expect(
        rows[i]!.mult,
        `品质 ${rows[i - 1]!.quality} 与 ${rows[i]!.quality} 的产出倍率相同(${rows[i]!.mult})—— 品质没起作用`,
      ).toBeGreaterThan(rows[i - 1]!.mult);
    }
  });

  it("品质加成与天赋加成相乘,不是取其一", () => {
    /*
     * 天资匹配时应当拿到「天赋 × 品质」;不匹配时只有品质。
     * 若实现误写成取其一,匹配/不匹配的比值会等于 1 或等于品质倍率,不是 1.25。
     */
    const arch = APPRENTICES.find((a) => a.talent === "study")!;
    const matched = apprenticeYieldMult(arch.id, "study");
    const mismatched = apprenticeYieldMult(arch.id, "herb");
    const ratio = matched / mismatched;
    expect(
      Math.abs(ratio - APPRENTICE_TALENT_BONUS),
      `天赋匹配/不匹配的比值该是 ${APPRENTICE_TALENT_BONUS}(天赋那 1.25),实际 ${ratio.toFixed(3)}` +
        " —— 品质与天赋没有相乘",
    ).toBeLessThan(1e-9);
  });

  it("倍率只有一个来源:结算调 apprenticeYieldMult", () => {
    /*
     * 源码层:service 里不许再就地写「talent === spec ? BONUS : 1」这种算式 ——
     * 那正是品质被漏掉的地方,也是「两本账」的开端。
     */
    const raw = readFileSync(resolve(__dirname, "./apprenticeService.ts"), "utf8");
    const src = raw.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
    expect(src, "结算该调统一的倍率函数").toContain("apprenticeYieldMult(");
    expect(src, "service 里又就地拼了天赋算式 —— 那是品质被漏掉的原始写法").not.toMatch(
      /APPRENTICE_TALENT_BONUS/,
    );
  });

  it("产出确实按品质拉开:高品弟子采的比凡品多", () => {
    // 行为侧:真算一次产出,不只看倍率函数
    const mortal = APPRENTICES.find((a) => a.quality === "mortal" && a.talent === "herb")!;
    const spirit = APPRENTICES.find((a) => a.quality === "spirit")!;
    const low = apprenticeSpoils(mortal.id, "herb", 20, 10).herb ?? 0;
    const high = apprenticeSpoils(spirit.id, "herb", 20, 10).herb ?? 0;
    expect(low, "凡品采药童子在采药门应有产出").toBeGreaterThan(0);
    expect(
      high,
      `灵品弟子的采药产出(${high})没有超过凡品(${low})—— 品质在结算里没生效`,
    ).toBeGreaterThan(low);
  });
});

/**
 * 界面那一行倍率标签也要把品质写出来。
 *
 * 产出变了但标签只写「·天赋×1.25」时,玩家仍是「看到名字颜色不同、
 * 看不出数值不同」—— 那等于把刚接上的品质加成又藏回去。
 */
describe("弟子界面 · 倍率标签要两半都写", () => {
  it("taskYield 的标签同时含天赋与品质", () => {
    const raw = readFileSync(resolve(__dirname, "../views/ApprenticeView.vue"), "utf8");
    const src = raw.replace(/<!--[\s\S]*?-->/g, "").replace(/\/\*[\s\S]*?\*\//g, "");
    expect(src, "标签该写天赋倍率").toContain("天赋×");
    expect(src, "标签该写品质倍率 —— 否则品质仍看不出来").toContain("品质×");
    expect(src, "品质倍率要读数据层那一份,不许就地写数").toContain("APPRENTICE_QUALITY_BONUS");
    // 只写一档噪声:凡品 + 天赋不匹配时倍率是 1,不该印「×1.00」
    expect(src, "倍率为 1 时不该印标签").toMatch(/qualityMult !== 1/);
  });
});

/**
 * 招募的多样性 —— 每个门类都得有得挑,而不是"还差哪个门类就收哪个"。
 *
 * ## 缺口
 *
 * 招募是随机抽(`rng.pick`),池子排除已收的原型。初版只有六个原型:
 * 采药/开矿/历练/寻宝各一名、参悟两名 —— 于是
 *
 * - **五个门类里四个永远只有一种选择**:接到第二个采药弟子是不可能的,
 *   你想要采药就只能是「采药童子」,想要开矿就只能是「开矿壮汉」;
 * - 品质也几乎不分化(凡品两个、下品两个、中品与上品各一个),
 *   抽到什么都不由运气决定,只由「还差哪个门类」决定。
 *
 * 现在每个门类两名、品质错开,抽取才有两件独立的事:抽到**哪个门类**,
 * 以及抽到**什么品质**。前者决定往哪派,后者决定划不划算。
 *
 * ## 判据守什么
 *
 * 一 每个门类至少两名(否则「这个门类只有一种人」);
 * 二 每个门类内部的品质不许全同(否则抽到哪个都一样);
 * 三 品质加成对**九个档位全部**配了值,且随档位单调递增 ——
 *    初版是 `Partial`,漏配四档会回落到 1,比低档还低。
 */
describe("招募 · 每个门类都得有得挑", () => {
  it("每个门类至少两名原型", () => {
    const byGate = new Map<string, number>();
    for (const arch of APPRENTICES) byGate.set(arch.talent, (byGate.get(arch.talent) ?? 0) + 1);
    const thin = [...byGate.entries()].filter(([, n]) => n < 2).map(([g, n]) => `${g}(${n})`);
    expect(
      thin,
      "这些门类只有一种原型 —— 玩家想要这个门类就没有第二个选择:" + thin.join("、"),
    ).toEqual([]);
    // 防空转:五个门类都得在
    expect(byGate.size, "门类数不对 —— 判据可能没扫到原型表").toBe(5);
  });

  it("同一门类里的品质不许全同 —— 否则抽到哪个都一样", () => {
    const byGate = new Map<string, Set<string>>();
    for (const arch of APPRENTICES) {
      if (!byGate.has(arch.talent)) byGate.set(arch.talent, new Set());
      byGate.get(arch.talent)!.add(arch.quality);
    }
    const flat = [...byGate.entries()].filter(([, q]) => q.size < 2).map(([g]) => g);
    expect(
      flat,
      "这些门类下的原型品质全都相同 —— 抽到哪个都是同一个产出,等于没有选择:" + flat.join("、"),
    ).toEqual([]);
  });

  it("品质加成九档配满且单调递增", () => {
    /*
     * 初版是 `Partial<Record<QualityId, number>>`,只配了五档 ——
     * profound / earth / immortal / divine 回落到 1,比灵品(1.3)与天品(1.4)还低。
     * 现在类型是完整 `Record`,但「值本身有没有乱序」类型管不了,故这里也核一遍。
     */
    const order: QualityId[] = [
      "mortal",
      "fine",
      "excellent",
      "spirit",
      "profound",
      "earth",
      "heaven",
      "immortal",
      "divine",
    ];
    for (const q of order) {
      expect(
        APPRENTICE_QUALITY_BONUS[q],
        `品质 ${q} 没配加成 —— 会回落到兜底值,可能比低档还低`,
      ).toBeGreaterThan(0);
    }
    for (let i = 1; i < order.length; i += 1) {
      expect(
        APPRENTICE_QUALITY_BONUS[order[i]!],
        `品质 ${order[i]} 的加成没有高于 ${order[i - 1]} —— 品质阶梯断了`,
      ).toBeGreaterThan(APPRENTICE_QUALITY_BONUS[order[i - 1]!]);
    }
  });

  it("招募池的可用原型会随已收变化 —— 收到的人不会重复", () => {
    /*
     * 本文件是**纯计算判据**(不引 store),故这里核的是池子的构造规则:
     * `recruit` 从 `APPRENTICES` 里排除「起始弟子」与「已收原型」后随机取一名。
     * 池子构造写在 store 里,这里只核两件静态事实:
     *   ① 可招募原型数 > 一个满槽阵容(否则收两人就必然撞池空);
     *   ② 排除起始弟子之后,每个门类仍有得挑。
     * 「抽到的确实不同」由 store 层的行为判据守(`stores/apprentice.spec` 里的收徒用例)。
     */
    const starter = STARTER_APPRENTICE;
    const pool = APPRENTICES.filter((x) => x.id !== starter);
    expect(
      pool.length,
      `可招募原型只有 ${pool.length} 个 —— 满槽 ${5} 人时池子会先枯,收到的人必然重复`,
    ).toBeGreaterThan(5);
    const gates = new Set(pool.map((x) => x.talent));
    expect(gates.size, "排除起始弟子后有门类没人可招").toBeGreaterThanOrEqual(4);
  });
});
