/**
 * 初次相逢 —— 头一回遇见的凶物,该有一枚标记。
 *
 * ## 缺口
 *
 * 一百四十个敌人(`data/enemies`),而战斗界面上没有任何地方记得"这是头一回"。
 *
 * 世界里其实**已经有敌人的认知系统**(`core/loreService` 的 `noteEnemy`):
 * 打赢记一份、打输也记一点,攒够门槛提示「你摸清了它的招式」「你已洞悉它的路数」。
 * 那套是关于**熟识**的 —— 见过很多次之后你懂它了。
 *
 * 而「第一次」这件事,它没有。玩家第一次遇见山魈,与第十次看到的界面完全一样。
 *
 * ## 为什么不能直接查照面次数
 *
 * `lore.enemySeenOf(id)` 看着正好能用:等于 0 就是没见过。但它**记在写战报之后** ——
 * `exploration` 里先 `adventure.recordBattle(view)`,后 `noteEnemy(...)`。
 * 战斗界面读的是那份战报,那时候照面次数已经 +1 了,拿它判"初见"永远得到 false。
 *
 * 故判定必须在**结算那一刻**取,并把结果记进战报(`LastBattleView.firstSight`)。
 * 这也是这一轮唯一需要动结构的地方:一个可选字段。
 *
 * ## 这份账是跨世的
 *
 * `lore.enemySeen` 随神魂带走(见核心注释「这份认知随神魂转世不灭」)。故「初见」说的是
 * **生生世世头一回**,不是"这一世头一回"。那更强,也更值得标记 ——
 * 它意味着这个凶物从此进入你的认识了。
 *
 * ## 不做整套图鉴
 *
 * 一整套凶物志要新增藏品类别、页面、迁移与分页,而且要让一百四十个敌人都有一句写好的条目
 * (否则图鉴里全是「???」)。那是整整一轮的事。
 *
 * 而「初见」这一枚章:
 *
 *   不动任何既有结构   只往战报上加一个可选布尔
 *   每个敌人都有内容   它只需要"之前没见过"这一条事实
 *   立刻可感           第一次遇见某只凶物时,战斗界面多一枚「初见」章
 *
 * 图鉴那一层可以在此之上再做(有一套"见过哪些"就列得出来),但那是下一件事。
 */
import { describe, expect, it } from "vite-plus/test";
import { readSource } from "@/test/readSource";

describe("初次相逢 · 判定是纯的", () => {
  it("照面次数为 0 或没记过,算初见", async () => {
    const { isFirstSight } = await import("@/ui/firstSight");
    expect(isFirstSight(0)).toBe(true);
    expect(isFirstSight(undefined)).toBe(true);
  });

  it("见过一次就不算了 —— 胜负都算见过", async () => {
    const { isFirstSight } = await import("@/ui/firstSight");
    expect(isFirstSight(1)).toBe(false);
    expect(isFirstSight(3)).toBe(false);
    // 打输时只记一点(ENEMY_LORE_LOSS_WEIGHT),但那是正数,照样算见过
    expect(isFirstSight(0.5)).toBe(false);
  });

  it("坏值不冒认初见 —— 印错了比不印更糟", async () => {
    const { isFirstSight } = await import("@/ui/firstSight");
    for (const bad of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
      expect(isFirstSight(bad), `${bad} 被判成了初见`).toBe(false);
    }
  });

  it("判定与登记分开 —— 判定那侧不碰 store", () => {
    /*
     * 若把判定写成"查一下、顺便记一笔",任何在渲染期调用它的地方都会在渲染中写存档。
     * 故判定纯、登记留在 core(那里本来就有一处 noteEnemy)。
     */
    const src = readSource("src/ui/firstSight.ts")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^\s*\/\/.*$/gm, "");
    expect(src).not.toMatch(/from ["']@\/stores\//);
    expect(src).not.toMatch(/from ["']@\/core\//);
  });
});

describe("初次相逢 · 取值的时机", () => {
  it("战报上带得下这个事实", () => {
    const types = readSource("src/types/index.ts");
    const at = types.indexOf("export interface LastBattleView");
    expect(at, "类型要还在").toBeGreaterThan(0);
    const block = types.slice(at, types.indexOf("\n}", at));
    expect(block, "要有 firstSight").toContain("firstSight");
    expect(block, "它该是可选的 —— 旧档的战报没有这一栏").toMatch(/firstSight\?:/);
  });

  it("在记照面**之前**取 —— 顺序反了永远判不出初见", () => {
    /*
     * 这一条守的是顺序,不是字面:recordBattle 必须在那句取值之后、noteEnemy 之前。
     * 顺序若反了,读到的照面次数已经 +1,初见永远不成立 —— 而单测与类型都不会报错。
     */
    const src = readSource("src/core/exploration.ts");
    const firstSightAt = src.indexOf("firstSight: isFirstSight(");
    const recordAt = src.indexOf("adventure.recordBattle(view)", firstSightAt);
    const noteAt = src.indexOf("noteEnemy(eDef.id", firstSightAt);
    expect(firstSightAt, "要取这个值").toBeGreaterThan(0);
    expect(recordAt, "取值要在 recordBattle 之前").toBeGreaterThan(firstSightAt);
    expect(noteAt, "取值要在 noteEnemy 之前").toBeGreaterThan(firstSightAt);
  });
});

describe("初次相逢 · 真接线", () => {
  it("战斗界面挂那枚章,且有稳定落点", () => {
    const panel = readSource("src/components/adventure/CombatPanel.vue");
    expect(panel, "该读战报上的那个字段").toContain("firstSight");
    expect(panel, "要有落点").toContain("data-combat-first-sight");
  });

  it("不再重复造一份敌人名册 —— 照面次数只有 lore 一处", () => {
    /*
     * 这一轮开头差点做成第二本账:往 adventure 里加一个 seenEnemies 数组,
     * 还起了个叫 markEnemySeen 的入口 —— 那个名字 lore store 里已经有了。
     * 判据钉住:adventure 侧不许出现第二份敌人名册。
     */
    const adv = readSource("src/stores/adventure.ts");
    expect(adv, "不许再开第二本敌人账").not.toContain("seenEnemies");
  });
});
