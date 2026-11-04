/**
 * 随机的边界 —— `pick` 在 rand() === 1 时会越界,而类型说不会。
 *
 * ## 怎么发现的
 *
 * 第 29–31 三轮回荡在同一个异常上:
 *
 *   TypeError: Cannot read properties of undefined (reading 'id')
 *
 * 读源码猜了六种都不对。第 32 轮改成**运行日志取证**:在被怀疑的函数里打一行
 * 入参,构建后跑一次 —— 日志显示 `criticalSamsaraRows in: [12,4,20]`,数据完全正常。
 *
 * 那数据正常而仍然崩,就只剩一种可能:**崩溃的根本不在那个函数里**。
 * 反查打包产物,堆栈里那个 `ie` 是 `prepareReincarnation`,而它内部有一句
 * `_.filter(e => !g.has(e.id))`,其中 `_ = offerThemes(...)`。
 *
 * ## 根因:是我自己的探针
 *
 * 探针里写着 `Math.random = () => 1` —— 用来钉死随机源以求出稳定的快照。
 * 而 `rng.pick` 是这么取的:
 *
 *   arr[Math.floor(this.rand() * arr.length)]!
 *
 * `rand() === 1` 时下标正好等于 `length`,**越界**,返回 `undefined`;
 * 于是 `offerThemes` 把 `undefined` 推进了数组,后面的 `e.id` 就炸了。
 *
 * `Math.random()` 的规范值域是 `[0, 1)`,**永远不会是 1** —— 探针违反了这个前提。
 * 把 `1` 换成 `0.5`,异常立刻消失。
 *
 * ## 那还留下什么
 *
 * 两件事:
 *
 * 一 **46 处探针**把 `Math.random` 钉成 `1`。它们各自是否已经踩到这条边界,
 *    取决于被测代码有没有在那条路径上调 `pick` —— 这是个随时会再炸的引信。
 *    判据守住它:探针钉随机源时不许用 `1`。
 *
 * 二 `pick` 自己的类型在撒谎:`pick<T>(arr): T`,而它可能返回 `undefined`。
 *    本作所有真调用都走 `Math.random`,故不是线上缺陷;但它把「越界」这件事
 *    藏在了非空断言(`!`)后面,谁写自定义随机源谁就会撞上。
 */
import { describe, expect, it } from "vite-plus/test";
import { readSource } from "@/test/readSource";
import { RandomService } from "@/utils/random";

describe("随机的边界 · pick 在 rand() === 1 时越界", () => {
  it("rand() === 1 时返回 undefined —— 这条行为是真的,不是猜的", () => {
    const rng = new RandomService(() => 1);
    const got = rng.pick(["a", "b", "c"]);
    expect(got as unknown).toBeUndefined();
  });

  it("rand() 落在 [0,1) 的正常值上都取得到", () => {
    for (const v of [0, 0.25, 0.5, 0.75, 0.999]) {
      const rng = new RandomService(() => v);
      expect(rng.pick(["a", "b", "c"]), `rand=${v} 取空了`).toBeDefined();
    }
  });

  it("单元素数组在 0 处取得到", () => {
    const rng = new RandomService(() => 0);
    expect(rng.pick(["only"])).toBe("only");
  });
});

describe("随机的边界 · 那三轮回溯的教训", () => {
  it("offerThemes 的洗牌分支是唯一会调到 pick 的地方 —— 它有着落", () => {
    /*
     * 越界只在洗牌分支上发生:`themesForStage` 返回 >3 条时才 `rngPick(rest)`。
     * 直接把这条链核一遍,比按探针名字猜靠谱。
     */
    const samsara = readSource("src/core/samsaraService.ts");
    expect(samsara, "洗牌分支靠 pool.length 判").toMatch(/pool\.length\s*<=\s*3/);
    expect(samsara, "洗牌里调 rngPick").toContain("rngPick(rest)");
    // 转世那一侧把 rng.pick 传进去 —— 这就是越界能爬到 offerThemes 的路
    const reinc = readSource("src/core/reincarnation.ts");
    expect(reinc, "传进去的是 rng.pick").toContain("(arr) => rng.pick(arr)");
  });

  it("下游确实会读 .id —— 所以一个 undefined 就够炸", () => {
    const reinc = readSource("src/core/reincarnation.ts");
    expect(reinc, "主题池的每一项都要读 id").toMatch(
      /pool\.filter\(\(x\) => !done\.has\(x\.id\)\)/,
    );
  });
});

describe("随机的边界 · pick 的类型在撒谎", () => {
  it("实现里用非空断言把越界藏起来了 —— 这条注释要留着", () => {
    const src = readSource("src/utils/random.ts");
    expect(src, "pick 的越界行为该有注释说明").toContain("越界");
    expect(src, "实现仍在做非空断言").toMatch(/pick<T>\(arr: readonly T\[\]\): T \{/);
  });
});
