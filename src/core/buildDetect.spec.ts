import { describe, expect, it } from "vite-plus/test";
import {
  BUILD_STYLES,
  STYLE_EMERGENCE_AFFINITY,
  STYLE_MATURE_AFFINITY,
  buildAffinityRows,
  detectBuild,
} from "./buildDetect";

describe("流派识别(Build 面板数据层)", () => {
  it("无相关词条时不识别", () => {
    expect(detectBuild({})).toBeNull();
    expect(detectBuild({ attackPct: 0.5, critRate: 0.1 })).toBeNull();
  });

  it("罡盾构筑被正确识别并给出契合度", () => {
    const d = detectBuild({ shieldOnStart: 0.2, shieldPower: 0.25, attackPct: 0.3 });
    expect(d).not.toBeNull();
    expect(d!.style.id).toBe("gangdun");
    expect(d!.affinity).toBeGreaterThan(0.6);
    expect(d!.stageName).toBe("成形");
    expect(d!.coreValues.length).toBe(2);
  });

  it("多路数并存时取契合度最高者", () => {
    const d = detectBuild({ lowHpDamage: 0.5, lowHpReduction: 0.3, comboRate: 0.1 });
    expect(d!.style.id).toBe("beishui");
    expect(d!.stageName).toBe("大成");
  });

  it("雏形阈值:低于 25% 契合不显示", () => {
    expect(detectBuild({ comboRate: 0.05 })).toBeNull();
    const d = detectBuild({ comboRate: 0.3 });
    expect(d!.style.id).toBe("lianji");
    expect(d!.stageName).toBe("雏形");
  });

  it("混合流派:主副体系并存,展示复合名号", () => {
    const d = detectBuild({
      shieldOnStart: 0.25,
      shieldPower: 0.3,
      counterRate: 0.15,
      counterDamage: 0.25,
    })!;
    expect(d.style.id).toBe("gangdun");
    expect(d.secondary?.style.id).toBe("fanzhen");
    expect(d.displayName).toBe("罡盾·反震");
  });

  it("纯派不显示副体系", () => {
    const d = detectBuild({ shieldOnStart: 0.25, shieldPower: 0.3 })!;
    expect(d.secondary).toBeUndefined();
    expect(d.displayName).toBe("罡盾流");
  });

  it("六大流派定义完整且核心词条均有参考值", () => {
    expect(BUILD_STYLES.length).toBe(6);
    for (const s of BUILD_STYLES) {
      expect(Object.keys(s.core).length).toBeGreaterThan(1);
      expect(s.seal.length).toBe(1);
    }
  });

  it("道途未成时六路都摊开：空词条不伪造契合，顺序稳定", () => {
    const rows = buildAffinityRows({ attackPct: 0.5 });
    expect(rows.map((row) => row.style.id)).toEqual(BUILD_STYLES.map((style) => style.id));
    expect(rows.every((row) => row.affinity === 0)).toBe(true);
    expect(rows.every((row) => row.activeTerms === 0)).toBe(true);
    expect(rows[0]!.terms.map((term) => term.key)).toEqual(Object.keys(BUILD_STYLES[0]!.core));
  });

  it("发现页与识别同源：排序第一、契合度与雏形门限逐位一致", () => {
    const mods = { shieldOnStart: 0.2, shieldPower: 0.25, counterRate: 0.02 };
    const rows = buildAffinityRows(mods);
    const detected = detectBuild(mods)!;

    expect(rows[0]!.style.id).toBe(detected.style.id);
    expect(rows[0]!.affinity).toBe(detected.affinity);
    expect(rows[0]!.affinity).toBeGreaterThanOrEqual(STYLE_EMERGENCE_AFFINITY);
    expect(rows[0]!.activeTerms).toBe(2);
    expect(
      rows
        .find((row) => row.style.id === "fanzhen")!
        .terms.find((term) => term.key === "counterRate")!.ratio,
    ).toBeCloseTo(0.02 / 0.3);
  });

  it("核心词条按参考值折算，排序读的是同一份平均值", () => {
    const rows = buildAffinityRows({ shieldOnStart: 0.125, shieldPower: 0.15 });
    const gangdun = rows.find((row) => row.style.id === "gangdun")!;

    expect(gangdun.affinity).toBe(0.5);
    expect(gangdun.terms.map((term) => term.ratio)).toEqual([0.5, 0.5]);
    expect(rows[0]!.style.id).toBe("gangdun");
  });
});

/**
 * 流派表的不变式 —— 上面那组测的是 `detectBuild` 的**行为**,
 * 这组守的是 `BUILD_STYLES` 这张表**本身**的数据形状。
 *
 * ## 为什么两组都要
 *
 * `detectBuild` 的测试用的是「给定词条 → 期望识别出哪个流派」,
 * 它只用到表里**被喂到的那几个流派**。若某个流派的名字空了、印章与别人重了、
 * 或核心词条的参考值跑到 (0,1] 之外,行为测试一个都不会红 ——
 * 那个流派在这次调用里根本没被选中。
 *
 * 第 87 轮扫「导出函数没被任何 spec 提到」时把 `buildSources` 排在第一,
 * 顺手核了一遍表,发现这些形状此前无人守。
 *
 * 文件头自己记着一次同类事故:
 *
 * > 曾经这里是 `id: string`,于是**写错一个不存在的流派 id 编译器不会吭声** ——
 * > `battleAnalysis` 里三处 `styleHints: ["cangfeng"]` 就是这么活下来的……
 * > 一旦有人让胜局也给方向,`BUILD_STYLES.find(...)!` 就会在读取 `.name` 时抛错。
 *
 * 那次事故已经被类型收紧了(`BuildStyleId` 联合类型),但**数据本身的不变式**仍需人守。
 */
describe("流派表 · 数据形状", () => {
  it("六个流派一个不多一个不少", () => {
    expect(
      BUILD_STYLES.map((s) => s.id).sort(),
      "BUILD_STYLES 的成员与 BuildStyleId 联合类型不一致 —— 加/删流派时两处要一起改",
    ).toEqual(["beishui", "fengmang", "fanzhen", "gangdun", "lianji", "muze"].sort());
  });

  it("id 与印章都不重复", () => {
    const dupIds = BUILD_STYLES.map((s) => s.id).filter((id, i, a) => a.indexOf(id) !== i);
    expect(dupIds, "流派 id 重复 —— 按 id 建索引的地方会静默丢掉后一个").toEqual([]);
    const dupSeals = BUILD_STYLES.map((s) => s.seal).filter((x, i, a) => a.indexOf(x) !== i);
    expect(dupSeals, "印章单字重复 —— 界面上两枚印会长得一模一样").toEqual([]);
  });

  it("每个流派都有名字、说明、印章与至少一条核心词条", () => {
    const bad: string[] = [];
    for (const s of BUILD_STYLES) {
      if (!s.name.trim()) bad.push(`${s.id} 没有名字`);
      if (!s.desc.trim()) bad.push(`${s.id} 没有说明`);
      if (!s.seal.trim()) bad.push(`${s.id} 没有印章`);
      if (Object.keys(s.core).length === 0) bad.push(`${s.id} 没有核心词条 —— 它永远识别不出来`);
    }
    expect(bad, bad.join("、")).toEqual([]);
  });

  it("核心词条的满契合参考值都在 (0, 1]", () => {
    /*
     * 这些值是「满契合」的参考分母(`modOf(mods, key) / core[key]`)。
     * 分母 ≤ 0 会让契合度变成 `Infinity` 或负数;> 1 则任何构筑都摸不到「满」。
     */
    const bad: string[] = [];
    for (const s of BUILD_STYLES) {
      for (const [key, value] of Object.entries(s.core)) {
        if (value === undefined) continue;
        if (!(value > 0) || value > 1) bad.push(`${s.id}.${key} = ${value}`);
      }
    }
    expect(
      bad,
      "核心词条的参考值越界 —— 契合度会算出 Inf 或永远到不了满:" + bad.join("、"),
    ).toEqual([]);
  });

  it("两档门槛的次序不乱:雏形 < 成形", () => {
    /*
     * `STYLE_EMERGENCE_AFFINITY`(雏形)与 `STYLE_MATURE_AFFINITY`(成形)是两个档,
     * 而 `daoDepth` 的纯度判据直接报 `STYLE_MATURE_AFFINITY` 的百分比。
     * 若雏形线高过成形线,`stageName` 的判定顺序就会自相矛盾。
     */
    expect(
      STYLE_EMERGENCE_AFFINITY,
      "雏形门槛不低于成形门槛 —— stageName 的判定顺序会自相矛盾",
    ).toBeLessThan(STYLE_MATURE_AFFINITY);
    expect(STYLE_MATURE_AFFINITY, "成形门槛太低 —— 任何构筑都算成形").toBeGreaterThan(0.3);
    expect(STYLE_MATURE_AFFINITY, "成形门槛太高 —— 永远到不了").toBeLessThanOrEqual(0.9);
  });
});
