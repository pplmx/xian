/**
 * 终局四处落点 —— 结构判据。
 *
 * 上一轮修到顶的显示时发现:`atMaxRealm` 在整个仓库里只被那几处「改口」引用,
 * **没有任何内容、入口或形态是到顶才有的** —— 终局只是一堆「没有了」。
 *
 * 这一轮把终局做成了一个阶段,落在四处:
 *
 *   一 **修行页**「下一步」整章换成「大道尽头」(`ApexSeal`);
 *   二 **首页**那一格「今日一步 / 当前道途」换成终局屏(`ApexBriefing`);
 *   三 **天界道途**择道之前先看自己(`celestial-dao__prelude`)与相性标注;
 *   四 **三生录**当世的终笔(`legacy-apex`)。
 *
 * 这四条都必须在源码层钉住落点 —— 终局是玩家走得最远才见到的一屏,
 * 它坏了没有任何常规巡页抓得到(夹具默认在真仙四层)。
 */
import { describe, expect, it } from "vite-plus/test";
import { readSource } from "@/test/readSource";

describe("终局 · 修行页整章换形", () => {
  const view = readSource("src/views/CultivationView.vue");

  it("到顶走「大道尽头」那一章,未到顶走原来的「下一步」", () => {
    expect(view, "要按 atMaxRealm 分叉").toContain('v-if="player.atMaxRealm"');
    expect(view, "终局章节本身要有落点").toContain('data-cultivation-chapter="apex"');
    expect(view, "终局印记要挂在终局那一支里").toContain("<ApexSeal");
    // 未到顶那一支仍是原来的「下一步」,不许被这一轮改没
    expect(view, "未到顶那一支要还在").toContain('data-cultivation-chapter="next"');
    // 印记内部的落点在子组件上
    const seal = readSource("src/components/cultivation/ApexSeal.vue");
    expect(seal, "终局印记要有稳定落点").toContain("data-cultivation-apex-mark");
  });

  it("到顶时不再挂破境卡 —— 突破不可能发生,那张卡没有意义", () => {
    /*
     * 破境卡只在 `v-else`(未到顶)那一支里。若把 `<BreakthroughCard />` 挪到
     * 两支共用的位置,到顶玩家会又看到一张「准备破境」的表 —— 那正是这一轮修的病。
     */
    const apexAt = view.indexOf("<ApexSeal");
    const nextAt = view.indexOf('data-cultivation-chapter="next"');
    const cardAt = view.indexOf("<BreakthroughCard />");
    expect(apexAt).toBeGreaterThan(-1);
    expect(cardAt, "破境卡要在").toBeGreaterThan(-1);
    expect(cardAt, "破境卡跑到终局那一支里了").toBeGreaterThan(nextAt);
    expect(apexAt, "终局这一支要在破境之前(它是 v-if 那一半)").toBeLessThan(nextAt);
  });

  it("终局印记报的四笔都来自 core/apex,不在视图里另算", () => {
    const seal = readSource("src/components/cultivation/ApexSeal.vue");
    expect(seal, "读数要走 apexRecord").toContain("apexRecord(");
    expect(seal, "去要走 apexPursuits").toContain("apexPursuits(");
    // 视图里另起一份「第几世 / 几则道痕」的拼装就是第二本账
    expect(seal).not.toContain("reincarnation.count + 2");
  });
});

describe("终局 · 首页那一格换口", () => {
  const home = readSource("src/views/HomeView.vue");
  const brief = readSource("src/components/common/ApexBriefing.vue");

  it("到顶换成终局屏,未到顶仍是今日一步 / 当前道途", () => {
    expect(home, "首页要按 atMaxRealm 分叉").toContain("player.atMaxRealm");
    expect(home, "终局屏要有落点").toContain("<ApexBriefing");
    expect(home, "今日一步那一支要还在").toContain('v-else-if="firstStep"');
    expect(home, "当前道途那一支要还在").toContain("data-home-goal");
  });

  it("终局屏自己报出「还能去哪」,不只报一句判词", () => {
    expect(brief, "要有稳定落点").toContain("data-home-apex");
    expect(brief, "要给出处").toContain("home-deck__apex-actions");
    expect(brief, "读数要走 apexRecord").toContain("apexRecord(");
  });

  it("道途报道名不报内部 id —— `sword` 这种键不许漏到界面上", () => {
    // 实测踩过:直接把 endgame.daoPath 插进文案,页面显示「此世行「sword」」
    expect(brief, "道途名要走 daoPathDef").toContain("daoPathDef(");
  });
});

describe("终局 · 道途择道仪式", () => {
  const view = readSource("src/views/CelestialView.vue");

  it("择道之前先摆出玩家自己的画像", () => {
    expect(view, "要有画像栏").toContain("data-celestial-dao-prelude");
    expect(view, "画像要复用三生录那一份").toContain("cultivatorProfile(");
    expect(view, "画像未成形时要直说,不装作有结论").toContain("PROFILE_MIN_MARKS");
  });

  it("每条道途标出与惯用打法的相性", () => {
    expect(view, "要有相性标注").toContain("data-dao-affinity");
    expect(view, "相性要走 core/daoAffinity").toContain("affinityFor(");
  });

  it("八条道途仍在同一支里渲染 —— 不许被画像栏挤掉", () => {
    /*
     * 实测踩过一次:`<aside v-if>` 插在 `<article v-if="currentDao">` 与
     * `<div v-else>` 之间,把 v-if/v-else 链断开,八张卡一张都不渲染。
     * 这一条钉的是「画像栏与卡片在同一支 v-else 内」。
     */
    const preludeAt = view.indexOf("data-celestial-dao-prelude");
    const choicesAt = view.indexOf("celestial-dao__choices");
    expect(preludeAt).toBeGreaterThan(-1);
    expect(choicesAt).toBeGreaterThan(preludeAt);
    // 两者之间不许再出现一个 v-if(那会把链条断开)
    const between = view.slice(preludeAt, choicesAt);
    expect(between, "画像栏与卡片之间又插了 v-if,会把 v-else 链断开").not.toMatch(
      /\sv-if="(?!.*daoProfile)/,
    );
    expect(view, "八条道途要遍历 DAO_PATHS").toContain('v-for="dao in DAO_PATHS"');
  });
});

describe("终局 · 三生录的当世终笔", () => {
  const view = readSource("src/views/LegacyView.vue");
  const identity = readSource("src/core/identity.ts");

  it("到顶时出现「此世终笔」,未到顶不出现", () => {
    expect(view, "要按 atMaxRealm 分叉").toContain('v-if="player.atMaxRealm"');
    expect(view, "终笔要有稳定落点").toContain("data-legacy-apex");
    expect(view, "读数要走 apexRecord").toContain("apexRecord(");
  });

  it("「大道尽头」那一枚碑记查得到文案 —— 不在静态表里,但不能漏出内部 id", () => {
    /*
     * 它只在真走到那一刻才记,故不在 MILESTONE_DEFS 里;界面若用 milestoneDef
     * 去查,查不到就退回内部 id `first_apex`,玩家会看到一串英文键。
     */
    expect(identity, "要有统一的取文案入口").toContain("milestoneRowOf");
    expect(identity, "终局那一枚要有定义").toContain("APEX_MILESTONE");
    expect(identity, "总数要含它").toContain("MILESTONE_TOTAL");
    expect(view, "三生录要能查到终局那一枚").toContain("milestoneRowOf(");
  });

  it("分母用 MILESTONE_TOTAL,不用静态表长度", () => {
    expect(view, "分母要含终局那一枚").toContain("MILESTONE_TOTAL");
    expect(view, "分母不许再读静态表长度").not.toContain("MILESTONE_DEFS.length");
  });
});

describe("终局 · 碑记真的要记下来", () => {
  it("突破成功且到顶时记一枚", () => {
    const core = readSource("src/core/breakthrough.ts");
    expect(core, "要有到顶判据").toContain("player.atMaxRealm");
    expect(core, "要记下终局那一枚").toContain("recordMilestone(APEX_MILESTONE.id)");
  });
});

/*
 * 满级之后,卷首那三格都要改口 —— 它们原先报的每一句都失效了。
 *
 * 「此刻行速」:修为走熔真了,那个数不再进修为。
 * 「灵气 +充盈后修炼 +15%」:加成落在一条已经封顶的线上,毫无意义。
 * 「本境 圆满」:原先配一句「还需过某一关」,现在该说「大道已尽」。
 *
 * 三格里任何一格不改口,玩家就会看到「数字在跳、什么也没发生」——
 * 那正是终局主循环看起来在转、其实断了的样子。
 */
describe("终局 · 卷首三格都改口", () => {
  const view = readSource("src/views/CultivationView.vue");

  it("修速那一格:满级改成「大道熔真」并报 ETA", () => {
    expect(view, "要按 atMaxRealm 分叉").toContain("player.atMaxRealm");
    expect(view, "要改口成大道熔真").toContain("大道熔真");
    expect(view, "要报「还差多久得一枚」").toContain("apexFurnaceEtaText");
  });

  it("灵气那一格:满级改成「满溢入炉」,不再说修炼加成", () => {
    expect(view, "要判存满").toContain("qiAtBankCap");
    expect(view, "要改口").toContain("满溢炼作道源");
  });

  it("未满级时三格仍是原口径 —— 改口不许波及绝大多数玩家", () => {
    expect(view, "未满级仍报此刻行速").toContain("此刻行速");
    expect(view, "未满级仍报充盈加成").toContain("QI_RICH_BONUS");
  });
});
