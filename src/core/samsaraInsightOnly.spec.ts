/**
 * 「轮回阶只开见识」—— 这是本作最重的一条设计取舍,却没人守着。
 *
 * ## 断言在哪里
 *
 * 界面上(`LegacyView` 卷首)写着:
 *
 * ```text
 * 轮回阶只开见识;灵材、丹方、器谱与敌手路数才是跨世不灭的底账。
 * ```
 *
 * `data/samsara.ts` 的头注说得更重:
 *
 * > 属性收益仍走道果与天赋的老路(见 core/formulas.ts),此处**一分不加** ——
 * > 这是本 Phase 的核心取舍:永久继承的重心从「+攻击」移到「你知道什么」。
 *
 * ## 缺口
 *
 * `core/samsara.spec` 有十条用例:门槛递增、能力只增不减、顶阶覆盖全部灵材……
 * 但**没有一条**守着「轮回阶不加属性」。
 *
 * 而这一条恰恰是最容易被一次「顺手」改掉的:往后某个版本想给轮回阶一点实惠,
 * 最自然的写法就是往 `SamsaraStageDef` 上加一个 `mods?: StatMods`,然后在这个
 * 字段上挂几行代码。那一刻界面上那句承诺与文件头那段设计取舍同时变成假话,
 * 而十条既有用例全绿 —— 它们守的是「见识开了多少」,不是「属性有没有多」。
 *
 * ## 判据守什么
 *
 * 一条:轮回阶的定义里**不许出现属性字段**,且它开的能力全部是见识型的。
 *
 * 这是「用形状守语义」:不去逐条读实现,而是钉住那份定义不得长出加成。
 */
import { describe, expect, it } from "vite-plus/test";
import { readSource } from "@/test/readSource";
import { SAMSARA_STAGES } from "@/data/samsara";

/** 允许出现在轮回阶定义上的能力字段 —— 全是「知道什么」 */
const INSIGHT_KEYS = new Set([
  "index",
  "id",
  "name",
  "insight",
  "desc",
  "knownMaterialRank",
  "enemyInsight",
  "heavenInsight",
  "themeFreeChoice",
  "keepOneGongfa",
]);

describe("轮回阶 · 只开见识,不加属性", () => {
  it("每一阶的字段都落在「见识」这一族里", () => {
    for (const stage of SAMSARA_STAGES) {
      const extra = Object.keys(stage).filter((k) => !INSIGHT_KEYS.has(k));
      expect(
        extra,
        `「${stage.name}」多出了非见识字段:${extra.join(", ")} —— 轮回阶只开见识,属性收益走道果与天赋`,
      ).toEqual([]);
    }
  });

  it("源文件里的阶定义不许传见识以外的键", () => {
    /*
     * 光看运行时形状是**假绿**的 —— 实测过:`s()` 是个只返回固定 10 个字段的工厂,
     * 往 caps 里塞 `{ mods: {...} }` 会被它静默丢掉,于是上面那条运行时判据照绿。
     * 真正要守的是**源码里传了什么**:那是后来的人动手的地方。
     */
    const src = readSource("src/data/samsara.ts")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/.*$/gm, "");
    // 抓所有 `s(...)` 调用里最后那个对象字面量
    const offenders: string[] = [];
    for (const m of src.matchAll(/\bs\([\s\S]{0,400}?\{\s*([\s\S]{0,200}?)\}\s*,?\s*\)/g)) {
      const body = m[1] ?? "";
      for (const key of body.matchAll(/(\w+)\s*:/g)) {
        if (!INSIGHT_KEYS.has(key[1]!)) offenders.push(key[1]!);
      }
    }
    expect(
      [...new Set(offenders)],
      `阶定义里传了见识以外的键:${[...new Set(offenders)].join(", ")} —— 工厂会静默丢掉它,但意图已经写在那里了`,
    ).toEqual([]);
  });

  it("定义文件里不出现 StatMods 一类的加成类型", () => {
    const src = readSource("src/data/samsara.ts")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/.*$/gm, "");
    // 注释里提「属性收益走别处」是正当的,代码里出现才是漏
    expect(src, "轮回阶定义里出现了 StatMods —— 那是往「加多少」这条老路上退").not.toMatch(
      /StatMods|\.mods\b/,
    );
  });

  it("反空转:见识字段确实在被使用(不是一群死字段)", () => {
    // 至少有一阶真的开了某一项见识,否则上面两条会因为它「本来就空」而假绿
    const opened = SAMSARA_STAGES.filter(
      (s) =>
        s.knownMaterialRank > 0 ||
        s.enemyInsight ||
        s.heavenInsight ||
        s.themeFreeChoice ||
        s.keepOneGongfa,
    );
    expect(opened.length, "没有一阶开了见识 —— 判据会空转").toBeGreaterThanOrEqual(3);
  });
});
