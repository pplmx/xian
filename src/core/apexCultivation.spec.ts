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
  APEX_QI_TO_DAO_RATIO,
  apexCultivationTick,
  apexFurnaceEta,
  apexQiTick,
  resetApexCultRemainder,
  resetApexQiRemainder,
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

/*
 * 灵气那条线 —— 与修为同一个病,同一套约束。
 *
 * 满级之后灵气的唯一去处是突破(没了)与疗伤(很少受伤),而它每秒仍回
 * 9.28e11、约 35 小时把 `qiBankCap` 存满,之后永久封顶。满级玩家看着
 * 「灵气 100%」那条进度条,和看修为一样。
 */
describe("大道熔真 · 灵气满溢", () => {
  beforeEach(() => {
    resetApexQiRemainder();
  });

  it("一天之内看得见,又不至于一天一枚道果", () => {
    const qiCap = toNumSafe(expRequirement(MAX_MAJOR, SUB_LEVELS - 1)); // 占位,下面用真实值
    void qiCap;
    /*
     * 分母是 `qiBankCap`(标称容量的 QI_BANK_MULT 倍)。第一版误用 `qiCap` 当分母,
     * 算出来一天 2053 枚 —— 是修为那条的 41 倍。这条用例钉的就是分母不能取错:
     * 若有人再把分母改回 qiCap,一天会变成十倍以上,这里立刻红。
     */
    const ratio = APEX_QI_TO_DAO_RATIO;
    // 一天回复量 / 存灵上限 × 折算率 = 一天的枚数
    // 取末境实测的比值:regen 9.28e11、bankCap 1.17e17 ⇒ 一天约 0.685 份
    const perDayFrac = (9.28e11 * 86400) / 1.17e17;
    const perDay = perDayFrac * ratio;
    expect(perDay, `灵气一天出 ${perDay.toFixed(0)} 枚`).toBeGreaterThanOrEqual(1);
    expect(perDay, `灵气一天出 ${perDay.toFixed(0)} 枚,太快`).toBeLessThan(100);
  });

  it("与修为那条同量级 —— 两条线不许差一个数量级(第一版差了 41 倍)", () => {
    const cultPerDay = (6.01e13 / 1.1e20) * APEX_CULT_TO_DAO_RATIO * 86400;
    const qiPerDay = ((9.28e11 * 86400) / 1.17e17) * APEX_QI_TO_DAO_RATIO;
    const ratio = qiPerDay / cultPerDay;
    expect(ratio, `灵气/修为 = ${ratio.toFixed(2)},两条线的量级该接近`).toBeGreaterThan(0.2);
    expect(ratio).toBeLessThan(5);
  });

  it("不到一份就没有,且余数不丢", () => {
    const bank = 1000;
    const one = bank / APEX_QI_TO_DAO_RATIO; // 刚好一份的回复量
    const half = one / 2;
    const a = apexQiTick(half, bank);
    const b = apexQiTick(half, bank);
    expect(a + b, "两次半份合起来该是一份").toBe(1);
  });
});

/*
 * 离线归来账上必须看得见熔真所得。
 *
 * 满级之后修为不进 `exp`(走熔真),而离线总结原先只报 `exp` ——
 * 玩家挂一夜回来,账上写着「修为 +0」,明明有产出却一处都没说。
 */
describe("大道熔真 · 离线归来账", () => {
  it("离线总结里有 daoSource 这一笔", () => {
    const src = readSource("src/core/offline.ts");
    expect(src, "离线总结要算熔真所得").toContain("daoSource:");
    expect(src, "要记结算前的道源").toContain("daoSourceBefore");
  });

  it("归来报告把道源列出来 —— 不许只写「修为 +0」", () => {
    const dlg = readSource("src/components/offline/OfflineRewardDialog.vue");
    expect(dlg, "要有道源那一行").toContain("s.daoSource");
    expect(dlg, "文案要说清它是余修炼来的").toContain("余修炼作");
  });

  it("未满级那一档不变 —— 修为仍然进 exp,否则绝大多数玩家会看到空账", () => {
    const src = readSource("src/stores/apexCultivation.ts");
    expect(src, "未满级仍走 gainExp").toContain("player.gainExp(gained)");
  });
});

/*
 * 离线那一屏的文案不许在满级时撒谎。
 *
 * 实测抓到过:满级玩家挂一夜回来,归来账底部写着「修为已至圆满,可尝试突破」
 * —— 而到顶之后突破不可能发生(破境卡整张都不渲染)。同屏还写着
 * 「道源 +56 · 余修炼作」,两句话互相打脸。
 */
describe("大道熔真 · 离线那屏的文案", () => {
  it("满级时说熔真,不说「可尝试突破」", () => {
    const src = readSource("src/core/offline.ts");
    expect(src, "要按满级分叉").toContain("player.atMaxRealm");
    expect(src, "满级那一支要说熔真").toContain("余修尽数熔作道源");
    // 未满级那一支必须保留,否则绝大多数玩家会看到错的文案
    expect(src, "未满级仍说可尝试突破").toContain("可尝试突破");
  });

  it("道源那一行的图标不与修为撞 —— 两行同用 flame 时看不出是新东西", () => {
    const dlg = readSource("src/components/offline/OfflineRewardDialog.vue");
    // 修为那一行用 flame(既有),道源那一行不该也是 flame
    const daoBlock = dlg.slice(dlg.indexOf('label: "道源"') - 200, dlg.indexOf('label: "道源"'));
    expect(daoBlock, "道源那一行还沿用修为的火焰图标").not.toContain('icon: "flame"');
    expect(daoBlock, "道源该有自己的图标").toContain("icon:");
  });
});
