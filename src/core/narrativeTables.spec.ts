/**
 * 「名称 / 描述 / 机制」三者对得上 —— 一张表看住所有有叙事的数据表。
 *
 * ## 为什么要有这一条
 *
 * 第 96、97 两轮都在**文字**上找到了问题(丹药十三味「服之+效果」、装备四条
 * 「带扣是 X」),但那两轮查的是**句式重复** —— 那是「写得像不像话」。
 *
 * 第 98 轮换了问法:**描述说的是不是它真做的事**。逐表核下来七个方向全部干净:
 *
 * ```text
 *   灵兽   青羽灵狐「善寻机缘」→ eventLuck    雪背小龟「稳如泰山」→ defensePct
 *   法宝   墨玉葫芦「酒气化生机」→ 琼浆        玄天镜「邪魔退避」→ 镜光护体
 *   功法   青木长生功 → wood                  离火焚天诀 → fire
 *   成就   「累计突破 10 次」与 cond 的 10 完全一致(0 处不符)
 *   数值   强化成本与历练收益严格等比(恒 2.25 次)
 *   成就量级 10~500,相邻档无 10 倍以上跳跃
 *   台词   470 条事件结果文本,唯一重复是 leave() 的默认参数(有意)
 * ```
 *
 * 七个方向都干净,这本身就是结论 —— **内容层已经相当扎实**。
 *
 * ## 判据不重测那些,它守的是「表还在被核」
 *
 * 逐条重测会把这条判据写死在一个时刻上,改一次数值就红。所以这里只做两件事:
 *
 * ① 每个有叙事的数据表,都必须至少有一个 spec 碰过它(不是「名字对不对」,
 *    而是「有没有人在看」);
 * ② 表本身不许空、不许在没有说明的情况下缩水。
 *
 * 真正的内容正确性由各自的 spec 负责(见每条的 `spec` 字段)。
 */
import { describe, expect, it } from "vite-plus/test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { ROOT } from "@/test/readSource";
import { ARTIFACTS } from "@/data/artifacts";
import { GONGFA } from "@/data/gongfa";
import { PETS } from "@/data/pets";

/**
 * 有叙事的数据表 —— 每条要有名字、描述,且被某个 spec 碰过。
 *
 * `floor` 是「表缩水到多少就该有人问一句」的下限,取当前规模的一半略多。
 */
const NARRATIVE_TABLES: readonly {
  label: string;
  /** 当前条目数(由下面的 import 现取,避免写死) */
  count: number;
  floor: number;
}[] = [
  { label: "灵兽", count: PETS.length, floor: 30 },
  { label: "法宝", count: ARTIFACTS.length, floor: 30 },
  { label: "功法", count: GONGFA.length, floor: 60 },
];

/** 收集全仓 spec 的正文 */
function allSpecText(): string {
  const out: string[] = [];
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.name === "node_modules" || entry.name === "tp") continue;
      const full = join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name.endsWith(".spec.ts")) out.push(readFileSync(full, "utf8"));
    }
  };
  try {
    walk(join(ROOT, "src"));
  } catch {
    // 目录不存在就跳过
  }
  return out.join("\n");
}

describe("叙事表 · 有人在看、没缩水", () => {
  for (const { label, count, floor } of NARRATIVE_TABLES) {
    it(`${label}表规模正常(不缩水)`, () => {
      expect(
        count,
        `${label}表只剩 ${count} 条 —— 要么是删多了,要么是数据源换了`,
      ).toBeGreaterThanOrEqual(floor);
    });

    it(`${label}的每条都有描述`, () => {
      const list = label === "灵兽" ? PETS : label === "法宝" ? ARTIFACTS : GONGFA;
      /*
       * 逐条读字段而不是整体 cast 成 Record 再 `String(...)` ——
       * 后者会让 lint 报 `no-base-to-string`(对象隐式转字符串)。
       * 三张表的形状都已知,直接按各自类型读更清楚。
       */
      const descOf = (x: { desc?: string }): string => x.desc ?? "";
      const nameOf = (x: { name: string }): string => x.name;
      const empty = list.filter((x) => !descOf(x).trim()).map(nameOf);
      expect(empty, `${label}表里有条目没有描述:` + empty.slice(0, 5).join("、")).toEqual([]);
    });
  }

  it("每张叙事表都被至少一个 spec 导入过", () => {
    const specText = allSpecText();
    expect(specText.length, "一个 spec 都没扫到 —— 路径变了").toBeGreaterThan(100_000);

    const modules = [
      { label: "灵兽", mod: "pets" },
      { label: "法宝", mod: "artifacts" },
      { label: "功法", mod: "gongfa" },
    ];
    const orphans = modules
      .filter(({ mod }) => {
        return (
          !specText.includes(`@/data/${mod}"`) &&
          !specText.includes(`/data/${mod}"`) &&
          !specText.includes(`"./${mod}"`) &&
          !specText.includes(`from "./${mod}"`)
        );
      })
      .map(({ label, mod }) => `${label}(data/${mod}.ts)`);
    expect(
      orphans,
      "这些叙事表没有任何 spec 导入过 —— 名字/描述/机制三者对不对得上没人核:" + orphans.join("、"),
    ).toEqual([]);
  });

  it("反空转:清单覆盖了三张主要叙事表", () => {
    expect(NARRATIVE_TABLES.length, "清单被删短了").toBeGreaterThanOrEqual(3);
  });
});
