/**
 * 大道熔真 —— 满级之后修为往哪里去。
 *
 * 守的是这条路的**存在**与**不白给**:满级修为原先被 `subClamp` 夹死,
 * 引擎每秒仍算 `cultPerSec`(末境 5.7e13/秒)却什么也不产生 —— 主循环在终点
 * 不是放缓,是断掉。这条把它接进天界熔炉的经济。
 */
import { describe, expect, it, beforeEach } from "vite-plus/test";
import { dailyTasksFor } from "@/data/quests";
import { readSource } from "@/test/readSource";
import { MAX_MAJOR } from "@/data/realms";
import { SUB_LEVELS } from "@/data/constants";
import { baseCultPerSec, expRequirement } from "@/core/formulas";
import {
  APEX_CULT_TO_DAO_RATIO,
  apexCultivationTick,
  apexFurnaceEta,
  resetApexCultRemainder,
} from "./apexCultivation";

describe("大道熔真 · 判据只有一处", () => {
  it("不另立第二个到顶判据 —— 只读 player.atMaxRealm", () => {
    /*
     * 一开始这里导出过一个 `atApexOf(major, sub)`,但接进来之后除用例之外
     * 没有任何调用方(deadExportAudit 当场报红),说明真正的判据一直就在
     * store 上。两处各写一遍只会在边界上分叉 —— 故删掉,只读那一条。
     */
    const wire = readSource("src/stores/apexCultivation.ts");
    expect(wire, "接线那一层要走 player.atMaxRealm").toContain("player.atMaxRealm");
    // 纯算法那一层不许认识 store —— 这正是它被拆出去的理由
    const pure = readSource("src/core/apexCultivation.ts");
    expect(pure, "纯算法不该 import store").not.toContain("@/stores/");
  });
});

describe("大道熔真 · 折算", () => {
  beforeEach(() => resetApexCultRemainder());

  it("攒满一份 expReq 换 APEX_CULT_TO_DAO_RATIO 枚道源", () => {
    expect(apexCultivationTick(100, 100)).toBe(APEX_CULT_TO_DAO_RATIO);
    resetApexCultRemainder();
    expect(apexCultivationTick(200, 100)).toBe(2 * APEX_CULT_TO_DAO_RATIO);
  });

  it("不到一份就没有 —— 不四舍五入", () => {
    resetApexCultRemainder();
    /*
     * 「一份」= expReq。ratio > 1 时一份换多枚,故「不到一份」的判据要按
     * 常量推:差一点点(99/100)得到的是 `floor(0.99 × ratio)`,而不是 0。
     * 判据不能写死 ratio=1 —— 那样调标定就会误报。
     */
    expect(apexCultivationTick(99, 100)).toBe(Math.floor(0.99 * APEX_CULT_TO_DAO_RATIO));
    resetApexCultRemainder();
    expect(apexCultivationTick(0, 100)).toBe(0);
  });

  it("非法输入一律 0,不抛", () => {
    expect(apexCultivationTick(Infinity, 100)).toBe(0);
    expect(apexCultivationTick(-1, 100)).toBe(0);
    expect(apexCultivationTick(100, 0)).toBe(0);
    expect(apexCultivationTick(NaN, 100)).toBe(0);
  });
});

describe("大道熔真 · 余数不许被吃掉", () => {
  beforeEach(() => resetApexCultRemainder());

  it("末境一拍只涨 expReq 的百万分之一 —— 不留余数就永远产不出", () => {
    /*
     * 这是这条路最容易写错的地方:末境修速 5.7e13/秒,而 expReq ≈ 1.1e20,
     * 单拍只到一份的 5e-7。每次向下取整就是恒 0 —— 判据全绿、玩家一无所得。
     */
    const expReq = 1.1e20;
    const perTick = 5.7e13;
    expect(apexCultivationTick(perTick, expReq), "单拍确实不足一枚").toBe(0);
    // 靠余数累积,约 22 天的秒数之后该出第一枚
    const secsForOne = expReq / perTick;
    let total = 0;
    for (let i = 0; i < Math.ceil(secsForOne); i += 1)
      total += apexCultivationTick(perTick, expReq);
    expect(total, "攒够一份该出一枚").toBeGreaterThanOrEqual(1);
  });

  it("余数不在 tick 之间丢失 —— 两次半份等于一份", () => {
    const expReq = 100;
    // ratio 为奇数时,半份各自 floor 会丢一点;两份合计必须等于一份
    const half = apexCultivationTick(50, expReq);
    const rest = apexCultivationTick(50, expReq);
    expect(half + rest, "两次半份合起来该是一份").toBe(APEX_CULT_TO_DAO_RATIO);
  });

  it("reset 之后余数清零 —— 转世不该把上辈子的零头带过去", () => {
    apexCultivationTick(99, 100);
    resetApexCultRemainder();
    // 清零后重来一次,结果必须与「第一次就只跑这一下」相同
    expect(apexCultivationTick(99, 100)).toBe(Math.floor(0.99 * APEX_CULT_TO_DAO_RATIO));
  });
});

describe("大道熔真 · 接进天界经济", () => {
  it("一枚道源 = 一份修为,量级远低于转世 —— 不许让转世显得亏", () => {
    /*
     * 转世一次(修到末境)给 696 道果,而 1 道果 = 100 道源(见 DAO_SOURCE_PER_FRUIT)。
     * 这里约 22 天才 1 枚道源 —— 远低于转世。修速读 `baseCultPerSec`(纯函数),
     * 不必起一个 store 就为了拿这一个数。
     */
    const expReq = toNumSafe(expRequirement(MAX_MAJOR, SUB_LEVELS - 1));
    const perSec = baseCultPerSec(MAX_MAJOR, SUB_LEVELS - 1);
    const secsForOne = expReq / perSec;
    const daysForOne = secsForOne / 86400;
    expect(daysForOne, "一枚道源不该快到一天").toBeGreaterThan(1);
    expect(daysForOne, "一枚道源也不该慢到一辈子").toBeLessThan(365);
  });
});

function toNumSafe(v: unknown): number {
  const g = v as { m: number; e: number };
  return g.m * Math.pow(10, g.e ?? 0);
}

/*
 * 满级之后,日课里不许再有「做不到」的那一条。
 *
 * 「每日破境」要求今日尝试突破 2 次,而到顶之后破境卡整张都不渲染
 * (`BreakthroughCard` 那支被 `atMaxRealm` 拦掉)—— 8 条固定板里这一条
 * 会永远停在 0/2,玩家每天打开首页都看到一次「你做不到」,且没有办法做掉。
 */
describe("大道熔真 · 满级日课没有做不到的那一条", () => {
  it("满级那一档不含「突破」类目标", () => {
    const apex = dailyTasksFor(true);
    const breakOnes = apex.filter((t) => t.counterKey === "breakthroughs");
    expect(
      breakOnes.map((t) => t.name),
      "满级玩家做不到突破,这一类日课要么换掉、要么移除",
    ).toEqual([]);
  });

  it("其余七条原样保留 —— 满级玩家仍在斩妖、服药、历练、炼丹、强化、斩将、鉴器", () => {
    const apex = dailyTasksFor(true);
    const base = dailyTasksFor(false);
    expect(apex.length, "条数不变(换一条,不是删一条)").toBe(base.length);
    const apexIds = new Set(apex.map((t) => t.id));
    // 只有被替换的那一条 id 不同
    const changed = base.filter((t) => !apexIds.has(t.id));
    expect(
      changed.map((t) => t.id),
      "只该换掉那一条",
    ).toEqual(["d_break"]);
  });

  it("未满级那一档照旧 —— 替换不该波及绝大多数玩家", () => {
    const base = dailyTasksFor(false);
    expect(
      base.some((t) => t.counterKey === "breakthroughs"),
      "未满级仍要每日破境",
    ).toBe(true);
    expect(
      base.some((t) => t.id === "d_trib"),
      "未满级不该看到满级那条",
    ).toBe(false);
  });

  it("替换项的计数器是真会被推高的那种 —— 不是编一个没人 inc 的键", () => {
    /*
     * 反例:随便换个计数器,而没有任何代码 `track(那个键)`,那条日课同样做不掉,
     * 只是换了个名字继续骗人。
     */
    const apex = dailyTasksFor(true).find((t) => t.id === "d_trib")!;
    const src = readSource("src/core/breakthrough.ts");
    expect(src, `满级日课读 ${apex.counterKey},但没有人 track 它`).toContain(
      `track("${apex.counterKey}")`,
    );
  });
});

/*
 * 定标的第一要求是**可感知**:一天之内玩家必须看得见回报。
 *
 * 这条判据来自一次踩坑:第一版把折算率定成 1,算下来 21 天才出一枚道源。
 * 纯逻辑用例全绿(折算、余数、边界都对),而玩家挂一整天什么都看不到 ——
 * 那等于这条路不存在。把「一天能出几枚」写成判据,标定改坏时才会红。
 */
describe("大道熔真 · 一天之内必须看得见", () => {
  it("末境挂一天,至少出一枚道源", () => {
    const expReq = toNumSafe(expRequirement(MAX_MAJOR, SUB_LEVELS - 1));
    const perSec = baseCultPerSec(MAX_MAJOR, SUB_LEVELS - 1);
    const perDay = (perSec / expReq) * APEX_CULT_TO_DAO_RATIO * 86400;
    expect(
      perDay,
      `挂一天只出 ${perDay.toFixed(2)} 枚 —— 玩家看不见,等于没有`,
    ).toBeGreaterThanOrEqual(1);
  });

  it("也不能快到一天换出一枚道果 —— 那会把转世与天界熔炉一起冲掉", () => {
    const expReq = toNumSafe(expRequirement(MAX_MAJOR, SUB_LEVELS - 1));
    const perSec = baseCultPerSec(MAX_MAJOR, SUB_LEVELS - 1);
    const perDay = (perSec / expReq) * APEX_CULT_TO_DAO_RATIO * 86400;
    // 1 道果 = 100 道源(DAO_SOURCE_PER_FRUIT)。一天出 1 道果 = 一天 100 道源。
    expect(perDay, `一天 ${perDay.toFixed(0)} 枚,已经快到一天一枚道果`).toBeLessThan(100);
  });

  it("ETA 文案报得出天数之外的量级 —— 不让玩家对着一个空字符串", () => {
    const expReq = toNumSafe(expRequirement(MAX_MAJOR, SUB_LEVELS - 1));
    const perSec = baseCultPerSec(MAX_MAJOR, SUB_LEVELS - 1);
    const eta = apexFurnaceEta(perSec, expReq);
    expect(eta, "满级必须报得出「还差多久得一枚」").toBeTruthy();
    expect(eta.length).toBeGreaterThan(1);
  });
});
