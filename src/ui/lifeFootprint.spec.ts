/**
 * 历世足迹 —— 十世履历摆成一条线,才看得出「我这一路走到哪」
 *
 * ## 缺口:每一世都记了,但没有一处把它们连起来看
 *
 * `LifeRecord` 里每一世都记着终点大境界、终寿、本世宿慧。修仙录把这些**逐行**
 * 排成履历,于是玩家读到的是十组彼此独立的数。
 *
 * 而放置游戏里最自然的一个问题恰好需要横向看:**「我的路有没有在变长」** ——
 * 上一世走到元婴就寿尽了,这一世到合体,下一世能不能再深一层?十行逐条读要自己
 * 比较十次,而这件事有现成的答案:终点境界的走向、终寿是否贴着上限、宿慧的累积。
 *
 * ## 只报「走向」,不报「好坏」
 *
 * 本作没有「这一世打得不好」这种评价 —— 转世是主动选择,短命的一世可能是为了
 * 早点换一手灵根。故这一层只给**事实**:最高走到哪一境、那一世是第几世、
 * 平均终寿多少、宿慧累计。一个「评分」「评级」都不给。
 *
 * ## 老存档只有 `at` 与 `index` 也要能画
 *
 * `LifeRecord` 的字段里 `major` / `age` / `insight` 都是必填,但老存档里可能被
 * sanitize 成 0 或缺失。故每个读数都要**先判可用**:读不出就不进那一条统计,
 * 不拿 0 冒充(0 境 = 凡人,0 岁 = 没活过,两个都是会被误读的数)。
 */
import { describe, expect, it } from "vite-plus/test";
import { lifeFootprint } from "./lifeFootprint";
import type { LifeRecord } from "@/data/samsara";
import { LIFE_TRIALS } from "@/data/lifeTrials";

const life = (
  index: number,
  major: number,
  age: number,
  insight: number,
  extra: Partial<LifeRecord> = {},
): LifeRecord =>
  ({
    index,
    major,
    realmLabel: `境${major}`,
    age,
    themeId: null,
    themeResult: null,
    insight,
    at: 1000 + index,
    ...extra,
  }) as LifeRecord;

describe("历世足迹 · 纯函数", () => {
  it("一世都没有 → 整块不出", () => {
    const fp = lifeFootprint([]);
    expect(fp.state).toBe("none");
    expect(fp.lives).toBe(0);
  });

  it("给出最高那一世与总世数 —— 「我这一路走到哪」的两个答案", () => {
    const fp = lifeFootprint([life(1, 3, 120, 10), life(2, 7, 300, 40), life(3, 5, 200, 25)]);
    expect(fp.state).toBe("ready");
    expect(fp.lives).toBe(3);
    expect(fp.best?.index, "最高那一世是第 2 世").toBe(2);
    expect(fp.best?.major).toBe(7);
    expect(fp.best?.realmLabel).toBe("境7");
  });

  it("最高那一世打平时取**更早**的那一世 —— 先到先得", () => {
    const fp = lifeFootprint([life(1, 6, 100, 5), life(2, 6, 200, 8)]);
    expect(fp.best?.index, "同一境界,先到的那一世先算").toBe(1);
  });

  it("平均终寿按**读得出**的世算,不拿 0 冒充", () => {
    const fp = lifeFootprint([
      life(1, 3, 120, 10),
      life(2, 4, 180, 20),
      // 老档缺终寿:0 岁不该进平均
      { ...life(3, 5, 0, 30) } as LifeRecord,
    ]);
    expect(fp.averageAge, "(120 + 180) / 2,不含那个 0").toBe(150);
    expect(fp.ageSamples, "只有两世真的读得出终寿").toBe(2);
  });

  it("宿慧累计把所有可读的世加起来 —— 它是跨世资产,不是平均", () => {
    const fp = lifeFootprint([life(1, 3, 120, 10), life(2, 4, 180, 25), life(3, 5, 200, 15)]);
    expect(fp.insightTotal).toBe(50);
  });

  it("按世序升序排 —— 履历本身是倒排的", () => {
    const fp = lifeFootprint([life(3, 5, 200, 15), life(1, 3, 120, 10), life(2, 4, 180, 25)]);
    expect(fp.points.map((p) => p.index)).toEqual([1, 2, 3]);
  });

  it("终点境界的走向:最近一世比首世更深就是 up", () => {
    const fp = lifeFootprint([life(1, 3, 120, 10), life(2, 5, 200, 20)]);
    expect(fp.majorDelta, "末世 5 减首世 3").toBe(2);
    expect(fp.trend, "一路在变深").toBe("up");
    expect(fp.trendText, "走向要有一句人话").toBe("比首世深 2 境");
  });

  it("走向也可以是 down —— 后来的世走得更浅是合法结果,不夹成 up", () => {
    const fp = lifeFootprint([life(1, 7, 300, 10), life(2, 4, 150, 5)]);
    expect(fp.majorDelta).toBe(-3);
    expect(fp.trend).toBe("down");
    expect(fp.trendText).toBe("比首世浅 3 境");
  });

  it("持平就是 flat,不是 up", () => {
    const fp = lifeFootprint([life(1, 5, 200, 10), life(2, 5, 210, 12)]);
    expect(fp.trend).toBe("flat");
    // 持平说「同一境」而不说「深 0 境」—— 后者像是没读到数
    expect(fp.trendText).toBe("与首世同一境");
  });

  it("只有一世时没有「走向」可言 —— trend 为 null", () => {
    const fp = lifeFootprint([life(1, 5, 200, 10)]);
    expect(fp.state).toBe("single");
    expect(fp.trend).toBeNull();
    expect(fp.majorDelta).toBeNull();
  });

  it("坏世序(负数 / 非数)不进足迹 —— 与历世履历同一套口径", () => {
    const fp = lifeFootprint([
      { ...life(1, 3, 100, 10), index: -2 } as LifeRecord,
      { ...life(2, 4, 150, 20), index: Number.NaN } as LifeRecord,
      life(3, 5, 200, 30),
    ]);
    expect(fp.points.map((p) => p.index)).toEqual([3]);
    expect(fp.lives).toBe(1);
  });

  it("读不出终点境界的世仍算一世,只是不进「最高」与走向", () => {
    /*
     * `major` 缺失(老档 sanitize 成 undefined)时,那一世照样是一世 ——
     * 它不该被整条剔掉(那会少算一世),只是不能参与「最高走到哪」。
     */
    const fp = lifeFootprint([
      life(1, 3, 120, 10),
      { ...life(2, 4, 180, 20), major: Number.NaN } as LifeRecord,
    ]);
    expect(fp.lives, "两世都要算").toBe(2);
    expect(fp.points).toHaveLength(2);
    expect(fp.best?.index, "最高只在读得出的世里挑").toBe(1);
  });

  it("终寿走向 —— 与境界走向同一条口径:首末两端,缺一不猜", () => {
    /*
     * ## 为什么单列一格（第 556 轮）
     *
     * 「平均终寿」答的是「这些年大概活多久」，却没答「越活越久还是越来越短」。
     * 后者才是十世回望时会看的那一眼。
     *
     * 它与境界走向共用同一条纪律:**用首末两端算，任一端缺值就不给走向** ——
     * 用一个缺值的端点算出来的差值会撒谎。
     */
    const up = lifeFootprint([
      {
        index: 1,
        major: 2,
        realmLabel: "筑基",
        age: 120,
        themeId: null,
        themeResult: null,
        insight: 0,
        at: 0,
      },
      {
        index: 2,
        major: 3,
        realmLabel: "金丹",
        age: 240,
        themeId: null,
        themeResult: null,
        insight: 0,
        at: 0,
      },
    ]);
    expect(up.ageDelta, "活得更久却没算出来").toBe(120);
    expect(up.ageTrendText, "走向没成句").toBe("比首世多活了 120 载");

    const down = lifeFootprint([
      {
        index: 1,
        major: 3,
        realmLabel: "金丹",
        age: 300,
        themeId: null,
        themeResult: null,
        insight: 0,
        at: 0,
      },
      {
        index: 2,
        major: 2,
        realmLabel: "筑基",
        age: 90,
        themeId: null,
        themeResult: null,
        insight: 0,
        at: 0,
      },
    ]);
    expect(down.ageDelta, "活得更短却没算出来 —— 短也是合法结果").toBe(-210);
    expect(down.ageTrendText).toBe("比首世少活 210 载");

    /* 首端缺值 → 不给走向，而不是拿 0 去减 */
    const missing = lifeFootprint([
      {
        index: 1,
        major: 2,
        realmLabel: "筑基",
        age: 0,
        themeId: null,
        themeResult: null,
        insight: 0,
        at: 0,
      },
      {
        index: 2,
        major: 3,
        realmLabel: "金丹",
        age: 240,
        themeId: null,
        themeResult: null,
        insight: 0,
        at: 0,
      },
    ]);
    expect(missing.ageDelta, "首端读不出却仍给了一个差值 —— 那会撒谎").toBeNull();
    expect(missing.ageTrendText).toBe("");
  });

  it("签过几份逆旅契 —— 汇总的数要与明细对得上", () => {
    /*
     * ## 为什么要汇总它（第 561 轮）
     *
     * `lifeTrialArchive` 把每一世的契翻成一行印在履历上，而历世足迹里没有一处
     * 说「你一共签过几份」。而契约唯一的回报就是「被记住」——
     * 不在汇总里说这个数，等于「被记住」这件事没兑现。
     *
     * 口径与履历行同一条:走 `lifeTrialArchive`，认得出的才算。
     * 认不出的 id（老档 / 数据改名）不计 —— 那时界面那一行也出不来，
     * 汇总与明细必须一致。
     */
    const trial = LIFE_TRIALS[0]!;
    const fp = lifeFootprint([
      {
        index: 1,
        major: 2,
        realmLabel: "筑基",
        age: 120,
        themeId: null,
        themeResult: null,
        insight: 0,
        at: 1,
        trialId: trial.id,
      },
      {
        index: 2,
        major: 3,
        realmLabel: "金丹",
        age: 240,
        themeId: null,
        themeResult: null,
        insight: 0,
        at: 2,
        trialId: null,
      },
      {
        index: 3,
        major: 4,
        realmLabel: "元婴",
        age: 360,
        themeId: null,
        themeResult: null,
        insight: 0,
        at: 3,
        trialId: trial.id,
      },
    ]);
    expect(fp.trialLives, "两世签过契，却没数对").toBe(2);

    /* 认不出的 id 不计 —— 与履历行同一条 */
    const unknown = lifeFootprint([
      {
        index: 1,
        major: 2,
        realmLabel: "筑基",
        age: 120,
        themeId: null,
        themeResult: null,
        insight: 0,
        at: 1,
        trialId: "no_such_trial",
      },
    ]);
    expect(unknown.trialLives, "认不出的契不该计入 —— 明细里它也不出一行").toBe(0);

    /* 一世都没签过 → 0，不是空 */
    expect(lifeFootprint([]).trialLives).toBe(0);
  });

  it("跨过几界 —— 与「走多深」是另一个轴", () => {
    /*
     * ## 为什么单独一格（第 564 轮）
     *
     * 历世足迹已经答了「走多深 · 活多久 · 快不快」，而那三是**同一轴上的读数**。
     * 「跨了几界」是另一个轴:境界数字到 19 与「到过混沌海」不是一件事 ——
     * 前者是进度，后者是「到过哪」。
     *
     * 而它此前只出现在 `apexRecord`（终局之后），历世足迹对任何玩家都可见。
     */
    /* 人间界是 0~8，仙界 9~13 */
    const mortalOnly = lifeFootprint([
      {
        index: 1,
        major: 3,
        realmLabel: "金丹",
        age: 200,
        themeId: null,
        themeResult: null,
        insight: 0,
        at: 1,
      },
      {
        index: 2,
        major: 7,
        realmLabel: "大乘",
        age: 400,
        themeId: null,
        themeResult: null,
        insight: 0,
        at: 2,
      },
    ]);
    expect(mortalOnly.worldsCrossed, "两世都在人间界，该只算一界").toBe(1);

    const two = lifeFootprint([
      {
        index: 1,
        major: 7,
        realmLabel: "大乘",
        age: 400,
        themeId: null,
        themeResult: null,
        insight: 0,
        at: 1,
      },
      {
        index: 2,
        major: 11,
        realmLabel: "玄仙",
        age: 900,
        themeId: null,
        themeResult: null,
        insight: 0,
        at: 2,
      },
    ]);
    expect(two.worldsCrossed, "人间界 + 仙界 = 两界").toBe(2);

    /* 读不出境界的世不参与 —— 否则会凭空多算 */
    const dirty = lifeFootprint([
      {
        index: 1,
        major: Number.NaN,
        realmLabel: "",
        age: 0,
        themeId: null,
        themeResult: null,
        insight: 0,
        at: 1,
      },
      {
        index: 2,
        major: 3,
        realmLabel: "金丹",
        age: 200,
        themeId: null,
        themeResult: null,
        insight: 0,
        at: 2,
      },
    ]);
    expect(dirty.worldsCrossed, "读不出境界的那一世不该被算成一界").toBe(1);
  });
});
