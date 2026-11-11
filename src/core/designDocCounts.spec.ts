/**
 * `docs/design.md` 里的当前状态数字 —— 不许悄悄地过期。
 *
 * ## 缺口(第 106 轮实测)
 *
 * 第 105 轮把 `usage.md` 的 28 处数字声明对了一遍账,找到 1 处漂移并补了白名单。
 * 这轮接着核 `design.md` —— 它有 62 处数字声明,而**此前没有任何判据覆盖它**。
 * (`dataHeaderAudit` 只看 `usage.md`,`usageDocCounts` 也只看 `usage.md`。)
 *
 * 实测漂了五处:
 *
 * ```text
 *   功法 70 部(主修 29 / 辅修 25 / 秘术 16)   → 92 部(34 / 35 / 23)
 *   69 枚丹药全部有 desc                       → 75 枚
 *   法宝 46 件(两处)                           → 49 件
 *   全库 44 件的节拍分布…实际是 46/27/18/1      → 49/30/18/1
 *   constants.ts 里 156 个常量                  → 159
 * ```
 *
 * ## 与 `usage.md` 的判据不一样,因为文档性质不一样
 *
 * `usage.md` 是**面向玩家的说明书**,里面每个数字都该是当前值 —— 所以
 * `usageDocCounts` 用白名单把每一条都钉死。
 *
 * `design.md` 是**设计决策的编年史**,里面有大量「当时量的是什么」的记录。
 * 把那些也按当前值钉死,等于要求作者每次改数据都回头重写历史 —— 那不现实,
 * 也会把文档变成一份没有时间维度的东西。
 *
 * 所以这条守的是 **「已经在讲当前事实的那几句」**,做法是:
 *
 * ① 只检查**明确的两组**——「法宝 N 件 / 灵兽 N 只 / 功法 N 部各有品阶」
 *    与「N 部功法分成三类:主修 a / 辅修 b / 秘术 c」。这两句是**在陈述现状**,
 *    不是在回忆某次审计。
 * ② 历史叙述允许存在,但有**格式要求**:写成「当日」「当时」「此后」这类字样,
 *    或者给出当前值作对照。判据不去猜哪句是历史,只钉住上面那两句的形态。
 *
 * 这比「全量对账」窄得多,但**窄的判据不会误伤**,而宽的判据会逼人改掉本来对的句子。
 */
import { describe, expect, it } from "vite-plus/test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ROOT } from "@/test/readSource";
import { ARTIFACTS } from "@/data/artifacts";
import { PETS } from "@/data/pets";
import { GONGFA } from "@/data/gongfa";

const DESIGN = readFileSync(join(ROOT, "docs/design.md"), "utf8");

describe("design.md · 当前状态的数字", () => {
  it("「法宝 N 件、灵兽 N 只、功法 N 部各有品阶」与表一致", () => {
    const m = DESIGN.match(/法宝\s*(\d+)\s*件、灵兽\s*(\d+)\s*只、功法\s*(\d+)\s*部各有品阶/);
    expect(
      m,
      "design.md 里找不到「法宝 N 件、灵兽 N 只、功法 N 部各有品阶」这句 —— 若改写了,连这条判据一起改",
    ).not.toBeNull();

    expect(Number(m![1]), `design.md 写法宝 ${m![1]} 件,实际 ${ARTIFACTS.length} 件`).toBe(
      ARTIFACTS.length,
    );
    expect(Number(m![2]), `design.md 写灵兽 ${m![2]} 只,实际 ${PETS.length} 只`).toBe(PETS.length);
    expect(Number(m![3]), `design.md 写功法 ${m![3]} 部,实际 ${GONGFA.length} 部`).toBe(
      GONGFA.length,
    );
  });

  it("「N 部功法分成三类:主修 a / 辅修 b / 秘术 c」总数与分项都一致", () => {
    const m = DESIGN.match(
      /`data\/gongfa` 里\s*(\d+)\s*部功法\*\*分成三类\*\*:主修\s*(\d+)\s*\/\s*辅修\s*(\d+)\s*\/\s*秘术\s*(\d+)/,
    );
    expect(m, "design.md 里找不到功法分类那句 —— 若改写了,连这条判据一起改").not.toBeNull();

    const total = Number(m![1]);
    const main = Number(m![2]);
    const sub = Number(m![3]);
    expect(total, `总数写 ${m![1]},实际 ${GONGFA.length}`).toBe(GONGFA.length);

    const real = { main: 0, sub: 0, secret: 0 };
    for (const g of GONGFA) real[g.type] += 1;
    expect(main, `主修写 ${m![2]},实际 ${real.main}`).toBe(real.main);
    expect(sub, `辅修写 ${m![3]},实际 ${real.sub}`).toBe(real.sub);
    expect(Number(m![4]), `秘术写 ${m![4]},实际 ${real.secret}`).toBe(real.secret);
    // 三档之和必须等于总数 —— 44+27+18+1 那类自相矛盾从此会被抓住
    expect(real.main + real.sub + real.secret, "三类之和 ≠ 功法总数 —— 表里出现了第四种 type").toBe(
      total,
    );
  });

  it("反空转:这三张表都非空,且 design.md 真的读到了", () => {
    expect(ARTIFACTS.length).toBeGreaterThan(30);
    expect(PETS.length).toBeGreaterThan(30);
    expect(GONGFA.length).toBeGreaterThan(60);
    expect(DESIGN.length, "design.md 是空的").toBeGreaterThan(100_000);
  });
});
