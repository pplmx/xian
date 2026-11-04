/**
 * 这一世的名号 —— 一生回顾里该有你叫什么。
 *
 * ## 缺口
 *
 * 转世的「回照」那一屏,已经写得很细:第几世、什么境界、活了多少载、立的什么命题、
 * 得的什么宿慧 —— 一份完整的一生回顾。
 *
 * 唯独**没有名字**。
 *
 * 玩家给自己起了道号(创建页八个字),转世时还会重掷一个,确认页可以改。
 * 这个世界却从没在叙事里叫过他的名字:存档里有、设置页能改、转世时会问 ——
 * 而"你刚刚过完的这一生"那一屏,只写「元婴 · 八百六十载」。
 *
 * ## 为什么这一处最该有
 *
 * 一生回顾是整本书里最郑重的一屏。而一个人的一生,总该有名字。
 * 「元婴 · 八百六十载」是**档案**的写法;「清虚子 · 元婴 · 八百六十载」才是**碑**的写法。
 *
 * ## 做什么
 *
 * 把这一世的名号记进 `LifeReview`,在回照那一屏的境界之前摆出来。
 *
 * 两处要注意:
 *
 *   一 **是这一世的名号,不是现在的**。玩家在确认页改了新名号之后,回照那一屏
 *      若读 `player.name` 就会印成新名字 —— 而那是"下一世的名"。故必须**存进 review**,
 *      与 `index`/`age` 一样是那一刻的快照。
 *   二 空名不印。旧档可能没有名字(见 save.ts 的「无名散修」兜底),那时这一行整行不出,
 *      不留一个空的「」。
 */
import { describe, expect, it } from "vite-plus/test";
import { readSource } from "@/test/readSource";

describe("这一世的名号 · 存进回顾里", () => {
  it("LifeReview 上有 name,且是那一刻的快照", () => {
    const types = readSource("src/types/index.ts");
    const at = types.indexOf("export interface LifeReview");
    expect(at, "类型要还在").toBeGreaterThan(0);
    const block = types.slice(at, types.indexOf("\n}", at));
    expect(block, "要有这一世的名号").toMatch(/name:\s*string/);
  });

  it("reviewLastLife 记的是当下的 player.name", () => {
    const src = readSource("src/core/reincarnation.ts");
    const at = src.indexOf("function reviewLastLife(");
    expect(at, "那个函数要还在").toBeGreaterThan(0);
    const block = src.slice(at, src.indexOf("\n}", at));
    expect(block, "要记下名号").toContain("name:");
    expect(block, "从玩家身上取").toContain("player.name");
  });

  it("不能在展示时读 player.name —— 那时可能已经被改成下一世的名号了", () => {
    /*
     * 这条守的是"快照"这件事:确认页会让玩家掷/改新道号(见 reincarnation.ts 的
     * nextName),若那一屏读的是 player.name,回照就会印出新名字 ——
     * 而回照说的是**刚过完的这一生**。
     */
    const dlg = readSource("src/components/character/ReincarnationDialog.vue");
    expect(dlg, "该读 review 上的快照").toContain("review.name");
    /*
     * 只看那一行落点附近 —— 整份文件里远处自有别的地方读 player.name(改下一世道号),
     * 那些是对的。范围收在落点前后各 300 字,只查这一处。
     */
    const at = dlg.indexOf("data-reincarnation-name");
    const near = dlg.slice(Math.max(0, at - 300), at + 300);
    expect(near, "这一处不该读当下玩家的名字").not.toContain("player.name");
  });
});

describe("这一世的名号 · 摆出来", () => {
  it("回照那一屏有位子,且有稳定落点", () => {
    const dlg = readSource("src/components/character/ReincarnationDialog.vue");
    expect(dlg, "要有落点").toContain("data-reincarnation-name");
  });

  it("空名整行不出 —— 不留一个空的「」", () => {
    const dlg = readSource("src/components/character/ReincarnationDialog.vue");
    const at = dlg.indexOf("data-reincarnation-name");
    expect(at, "落点要还在").toBeGreaterThan(0);
    // 出现条件里要判非空
    const before = dlg.slice(Math.max(0, at - 260), at);
    expect(before, "条件里要判非空").toMatch(/v-if="[^"]*(name|trim)/);
  });
});
