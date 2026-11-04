/**
 * 丹方阶位 —— 同一个字段不许有两种意思。
 *
 * 判据五组:
 *   一 门槛只有两道:境界与阶位,炉子等级不参与;
 *   二 补账与「藏经阁翻方」同一条判据 —— 新档老档看到同一批方;
 *   三 边界:境界差一、阶位差一各自卡住;
 *   四 坏值一律够不着(不因为 NaN 而把全库方子送出去);
 *   五 真接线:seedLoreIfNeeded 真的改用它。
 */
import { describe, expect, it } from "vite-plus/test";
import { readSource } from "@/test/readSource";
import { recipeReachable } from "./recipeGate";

describe("丹方阶位 · 只有两道门槛", () => {
  it("境界够、阶位够 → 够得着", () => {
    expect(recipeReachable({ minRealm: 2, rank: 3 }, { major: 2, ceiling: 3 })).toBe(true);
  });

  it("境界差一 → 够不着", () => {
    expect(recipeReachable({ minRealm: 3, rank: 3 }, { major: 2, ceiling: 9 })).toBe(false);
  });

  it("阶位差一 → 够不着", () => {
    expect(recipeReachable({ minRealm: 0, rank: 4 }, { major: 9, ceiling: 3 })).toBe(false);
  });

  it("炉子等级不是门槛 —— 这里根本没有那枚参数", () => {
    /*
     * 去注释再查:本模块的文件头正当解释着「alchemyLevel 在别处有两种读法」,
     * 把它当违规打红就成了「注释越诚实越容易挂」—— 这个仓库已经栽过四次。
     */
    const src = readSource("src/core/recipeGate.ts")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^\s*\/\/.*$/gm, "");
    expect(src, "不该读丹炉等级").not.toContain("alchemyLevel");
    expect(src, "也不该够到洞府 store").not.toContain("useDongfuStore");
  });
});

describe("丹方阶位 · 补账与翻方同一批", () => {
  const catalog = [
    { id: "a", minRealm: 0, rank: 1 },
    { id: "b", minRealm: 1, rank: 3 },
    { id: "c", minRealm: 5, rank: 4 },
    { id: "d", minRealm: 2, rank: 9 },
  ];

  it("按同一组门槛筛出的就是那一批", () => {
    const got = catalog
      .filter((r) => recipeReachable(r, { major: 2, ceiling: 4 }))
      .map((r) => r.id);
    expect(got).toEqual(["a", "b"]);
  });

  it("境界涨了,够得着的只增不减", () => {
    let prev = 0;
    for (let major = 0; major <= 6; major += 1) {
      const n = catalog.filter((r) => recipeReachable(r, { major, ceiling: 4 })).length;
      expect(n, `境界 ${major} 时反而更少`).toBeGreaterThanOrEqual(prev);
      prev = n;
    }
  });
});

describe("丹方阶位 · 坏值", () => {
  it("NaN 门槛一律够不着 —— 不能因为算不出来就把全库送出去", () => {
    expect(recipeReachable({ minRealm: Number.NaN, rank: 1 }, { major: 9, ceiling: 9 })).toBe(
      false,
    );
    expect(recipeReachable({ minRealm: 0, rank: Number.NaN }, { major: 9, ceiling: 9 })).toBe(
      false,
    );
    expect(recipeReachable({ minRealm: 0, rank: 1 }, { major: Number.NaN, ceiling: 9 })).toBe(
      false,
    );
    expect(recipeReachable({ minRealm: 0, rank: 1 }, { major: 9, ceiling: Number.NaN })).toBe(
      false,
    );
  });

  it("空表给空结果", () => {
    expect([].filter((r: never) => recipeReachable(r, { major: 0, ceiling: 1 }))).toEqual([]);
  });
});

describe("丹方阶位 · 真接线", () => {
  it("补账按**旧口径**读炉子等级 —— 它不是矛盾,是一次性迁移", () => {
    /*
     * 这一条曾经被我写成「补账也该用共享判据」,测试当场把前提打红:
     * `loreService.spec` 的「金丹期挂机终能翻出灵乳的方子」断言补账之后该方仍是 0 ——
     * 因为补账要补的是「旧版游戏里凭炉子够级就能炼、却没记成掌握度」的那些方子,
     * 不是「现在够得着的全部」。改成共享判据会把当前境界够得着的新方子一并折成 0.7,
     * 那等于白送。
     *
     * 故这条守的是**两种读法各自成立**:翻方看阶位,补账看旧口径的炉子等级。
     */
    const src = readSource("src/core/loreService.ts");
    const seedAt = src.indexOf("function seedLoreIfNeeded");
    expect(seedAt, "补账函数要还在").toBeGreaterThan(0);
    const block = src.slice(seedAt, src.indexOf("\nexport function", seedAt + 10));
    expect(block, "补账按旧口径读炉子等级").toContain("dongfu.alchemyLevel");
    expect(block, "补账不该改用翻方的判据").not.toContain("recipeReachable(");
  });

  it("翻方那侧读阶位,本模块的判据与它同源", () => {
    const src = readSource("src/core/loreService.ts");
    const studiableAt = src.indexOf("export function studiableRecipes");
    expect(studiableAt, "藏经阁翻方那一段要还在").toBeGreaterThan(0);
    const block = src.slice(studiableAt, src.indexOf("\nexport function", studiableAt + 10));
    expect(block, "翻方按阶位上限筛").toContain("bearableRank(major)");
    expect(block, "翻方不看炉子等级").not.toContain("alchemyLevel");
  });
});
