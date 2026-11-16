/* oxlint-disable no-console */
/**
 * 诸界总览「出发」的必要性审计
 *
 * 路线自带解锁之后,历练页上存在两条出发路径。只回答一个问题:
 *
 *   **在已有本世路线的前提下,总览出发是否仍提供不可替代的功能?**
 *
 * 判据不靠感觉:比较两条路径在同一个区域上能拿到什么。
 * 若总览拿到的一切路线都能给,且不含路线给不了的东西,它就是重复入口。
 */
import { describe, expect, it, beforeEach } from "vite-plus/test";
import { createPinia, setActivePinia } from "pinia";
import {
  OVERVIEW_ROLES,
  REGIONS,
  capabilities,
  caseFacts,
  escapeRouteNeeded,
  recommend,
  rolesNeedingDepart,
  sameCombatSource,
} from "./overviewNecessity";
import { generateMortalWorld } from "./mortalWorldGen";
import { canEnterNode } from "./mortalWorldService";
import { useAdventureStore } from "@/stores/adventure";

const WORLD = generateMortalWorld(20260904);

beforeEach(() => {
  setActivePinia(createPinia());
});

describe("总览必要性 · 三种情形", () => {
  // 审计报告(只打印,不断言):A/B/C 三情形的事实陈列;
  // 「B 是纯重复入口」「A 是绕过而非退路」等结论由本文件其余用例断言。
  it("逐情形的事实", () => {
    const LABEL = {
      routeLocked: "A 路线未开放",
      routeOpen: "B 路线已覆盖",
      offRoute: "C 不在路线内",
    };
    console.log("\n情形            路线可进  总览可进  总览有增量");
    for (const c of caseFacts()) {
      console.log(
        `${LABEL[c.case].padEnd(14)} ${(c.viaRoute ? "是" : "否").padStart(8)} ` +
          `${(c.viaOverview ? "是" : "否").padStart(9)} ${(c.overviewAdds ? "是" : "否").padStart(11)}`,
      );
      console.log(`    ${c.note}`);
    }
  });

  it("B 情形是纯重复入口:两条路径进同一区域、同一批敌人、同一份奖励", () => {
    const b = caseFacts().find((c) => c.case === "routeOpen")!;
    expect(b.viaRoute).toBe(true);
    expect(b.viaOverview).toBe(true);
    expect(b.overviewAdds).toBe(false);
    // 战斗数据同源是「重复」的硬证据
    const caps = capabilities(WORLD, REGIONS.length);
    expect(sameCombatSource(caps)).toBe(true);
    console.log("\n两条路径的战斗数据都取自 REGIONS —— 差别只在准入条件,不在内容");
  });

  it("A 情形的「增量」是绕过,不是退路", () => {
    const a = caseFacts().find((c) => c.case === "routeLocked")!;
    expect(a.overviewAdds).toBe(true);
    // 但它增的是「跳过本世路线的推进顺序」
    expect(a.note).toContain("绕过");
    console.log(
      "\n总览确实能进入路线尚未开放的区域 —— 但这是绕过推进顺序。" +
        "\n老存档解锁越多,绕得越远:全解锁存档可以直接跳到第六段对应的地界",
    );
  });

  it("实测:全解锁老存档能用总览绕过整条路线", () => {
    const adventure = useAdventureStore();
    adventure.unlocked = REGIONS.map((r) => r.id);
    adventure.setMortalWorld(WORLD);
    // 路线上除首段外全部未开放
    const routeLocked = WORLD.chain.slice(1).filter((p) => !canEnterNode(p.nodeId));
    expect(routeLocked.length).toBe(WORLD.chain.length - 1);
    // 但这些地界在总览里全部可出发
    const overviewOpen = routeLocked.filter((p) => adventure.unlocked.includes(p.fromId));
    expect(overviewOpen.length).toBe(routeLocked.length);
    console.log(
      `\n本世路线锁着 ${routeLocked.length} 段,而这 ${overviewOpen.length} 段在总览里全都能直接出发。` +
        "\n「本世路线决定本世可达性」这条原则被总览整条绕开",
    );
  });

  it("C 情形:路线之外的区域确实只有总览能去", () => {
    const c = caseFacts().find((x) => x.case === "offRoute")!;
    expect(c.viaRoute).toBe(false);
    expect(c.viaOverview).toBe(true);
    const offRoute = REGIONS.filter((r) => !WORLD.chain.some((p) => p.fromId === r.id));
    console.log(
      `\n本世 ${WORLD.chain.length} 段之外还有 ${offRoute.length} 处地界。` +
        "\n但「这一世走不到那里」本就是世界的一部分 —— 若都能去,世界就没有边界了",
    );
    expect(offRoute.length).toBeGreaterThan(0);
  });
});

describe("总览必要性 · 退路的前提是否成立", () => {
  it("首段天然可进入,故不存在「路线一段都进不去」的状态", () => {
    const adventure = useAdventureStore();
    adventure.unlocked = [];
    adventure.cleared = [];
    adventure.setMortalWorld(WORLD);
    expect(canEnterNode(WORLD.chain[0]!.nodeId)).toBe(true);
    expect(escapeRouteNeeded(WORLD)).toBe(false);
    console.log(
      "\n旧链清空也能进首段 —— 「脱困退路」的前提不成立。" +
        "\n\n【事后更正】这条结论被玩家实测证伪,原因是本条判据没测它宣称要测的东西:" +
        "\n它验的是「首段谓词是否为真」,而不是「玩家是否走得动」。" +
        "\n首段确实可进,但历练页按旧解锁链截断可见范围,首段常排在截断线之外 ——" +
        "\n可进却不可见,玩家看到的是整页 0 个出发按钮,以及一串" +
        "\n「进甲要先通乙、进乙要先通丙」的推诿。" +
        "\n\n据此结论定下的「路线内只认段序、堵在守卫层」已被推翻:" +
        "\n现在 canEnterRegion 会回落旧解锁链(见 mortalRouteAccess.spec.ts)。" +
        "\n可达性判据必须连同**可见性**一起验,只验谓词会漏掉这一整类死锁",
    );
  });

  it("唯一残留情形是首段打不过,但那是难度问题", () => {
    // 用旧区域刷等级再回来,等于绕过世界的难度设计
    console.log(
      "\n首段太难 → 去旧区域刷等级 → 回来打首段。" +
        "\n这条路径存在,但它绕过的是**世界的难度曲线**," +
        "\n与「本世路线决定本世可玩什么」直接冲突。" +
        "\n真要解决,应调首段难度,而不是保留一张平行地图",
    );
    expect(escapeRouteNeeded(WORLD)).toBe(false);
  });
});

describe("总览必要性 · 其余职责是否需要出发", () => {
  it("职责表", () => {
    // 只打印,不断言 —— 这一段出的是给人复核的读数,判断在对应的阈值用例里
    console.log("\n职责            需要出发按钮");
    for (const r of OVERVIEW_ROLES) {
      console.log(`${r.name.padEnd(14)} ${r.needsDepart ? "是" : "否"}`);
      console.log(`    ${r.evidence}`);
    }
  });

  it("索引、历史、镇压三项全是只读", () => {
    const readOnly = OVERVIEW_ROLES.filter((r) => !r.needsDepart).map((r) => r.name);
    expect(readOnly).toContain("世界知识索引");
    expect(readOnly).toContain("历世足迹");
    expect(readOnly).toContain("区域镇压状态");
    console.log(`\n只读职责:${readOnly.join("、")} —— 这些不需要「出发」`);
  });

  it("唯一需要出发的职责(脱困退路)前提已被证伪", () => {
    const needs = rolesNeedingDepart();
    expect(needs).toHaveLength(1);
    expect(needs[0]!.id).toBe("escape");
    expect(escapeRouteNeeded(WORLD)).toBe(false);
    console.log("\n需要出发的只有「脱困退路」一项,而它的前提(路线进不去)不成立");
  });
});

describe("总览必要性 · 结论", () => {
  it("这条建议已被推翻:总览出发保留了下来", () => {
    /*
     * ## 这条测试改过一次（第 454 轮）
     *
     * 它原来说「建议:保留总览,取消常规出发」,并 assert `disposition === "demote"`。
     *
     * 而那个建议**没有采纳**,理由就写在本文件第 105 行那条「事后更正」里:
     *
     * ```text
     *   它验的是「首段谓词是否为真」,而不是「玩家是否走得动」。
     *   首段确实可进,但历练页按旧解锁链截断可见范围,首段常排在截断线之外 ——
     *   可进却不可见,玩家看到的是整页 0 个出发按钮。
     * ```
     *
     * 产品现在的做法:MortalWorldView 的 `depart()` 跳回历练页（带 go 查询参数）,
     * 出发资格读 `canEnterRegion` —— 与历练守卫同一个谓词。
     *
     * 故这条测试从「提出建议」改成「记录建议为何被推翻」。
     * `recommend()` 的那份读数仍然有价值 —— 它说明**单看谓词会得出什么**,
     * 而更正说明**为什么那个读数不够**。
     */
    const rec = recommend(WORLD);
    /*
     * 读数本身不变（它量的就是「若只看谓词与职责表,会得出什么」）——
     * 变的是我们拿它做什么。保留这条断言，是为了防止有人以为
     * recommend() 的实现被悄悄改过。
     */
    expect(rec.disposition).toBe("demote");
    console.log(`\n(recommend 的读数,仅供参考)处置:${rec.disposition}`);
    console.log(`(recommend 的读数,仅供参考)理由:${rec.reason}`);
    console.log(
      "\n但这条建议**已被推翻**,产品保留了总览出发 —— 见本文件第 105 行的「事后更正」:" +
        "\n  它只验了「首段谓词为真」,没验「玩家走不走得动」。" +
        "\n  可进却不可见时,玩家看到的是整页 0 个出发按钮。",
    );
  });

  it("这条审计的前提本身是错的 —— 它量的是谓词,该量的是可见性", () => {
    /*
     * 原来说「本结论的唯一前提:canEnterNode 对 route[0] 恒为 true;
     * 若将来首段也加条件,结论会失效」。
     *
     * 那个前提**一直成立**,结论却仍然错了 —— 因为错的不是前提,是**量错了东西**:
     *
     * ```text
     *   它量的     canEnterNode(route[0]) 是否为真
     *   该量的     玩家在历练页能不能看到一个可点的出发按钮
     * ```
     *
     * 两者在「按旧解锁链截断可见范围」时分离 —— 谓词为真而按钮不可见。
     * 故真正该守住的前提是那条:**可达性判据必须连同可见性一起验**。
     */
    const adventure = useAdventureStore();
    adventure.setMortalWorld(WORLD);
    expect(canEnterNode(WORLD.chain[0]!.nodeId)).toBe(true);
    console.log(
      "\n谓词前提仍然成立:canEnterNode(route[0]) 恒为 true。" +
        "\n但这个前提成立并不保证玩家走得动 —— 那是这条审计最初搞错的地方。" +
        "\n真正要守的:mortalRouteAccess.spec 里那条「可达性必须连同可见性一起验」。",
    );
  });
});
