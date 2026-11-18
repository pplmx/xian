/**
 * 开炉弹窗里那两处折叠 —— 技艺与丹方章。
 *
 * ## 为什么这两处都要收
 *
 * 这一窗此前把**所有东西**摊在同一屏上:九项技艺(每项还带一根进度条)占半屏,
 * 丹方是一张张 142px 的卡片(代价、成品、把握、双成、存货、短板与两枚动作全在行里),
 * 一屏只看三张。两处加起来,玩家要在那一窗里滚过七屏才够得着最后一境。
 *
 * 用户原话:
 *
 * ```text
 *   技艺默认折叠，点击再弹框出来，他只是额外知识
 *   丹方默认只显示一个名字就够了
 *   丹方应该排队，从低到高，还可以不同阶段的分组，默认折叠，点击才展开
 * ```
 *
 * ## 判据守什么
 *
 * ① **技艺默认合着** —— 初值是 false,正文用 v-if/v-show 挂在它上面;
 * ② **章默认只开一章** —— 不是全合着(看不见自己在哪),也不是全展开(回到平面长清单);
 * ③ **两处折叠钮都排在它自己展开的正文之前** —— `docs/design.md:1080` 的硬约束。
 *    秘境名录栽过 384px、成就谱栽过 151px、工坊的自动重铸栽过一次:
 *    钮若在正文之后,一按它自己就被自己放出来的内容顶下去。
 * ④ **读屏知道可开可合** —— `aria-expanded` 与 `aria-controls` 指向的 id 真的挂着;
 * ⑤ 反空转:两处折叠钮都还在(不是把折叠功能删掉换成了别的写法)。
 */
import { describe, expect, it } from "vite-plus/test";
import { readSource } from "@/test/readSource";
import { stripComments } from "@/test/stripComments";

const DIALOG = "src/components/inventory/BrewingDialog.vue";

/** 去掉注释再看模板 —— 注释里写着「折叠钮排在正文之前」不算数 */
const SRC = stripComments(readSource(DIALOG));

describe("开炉弹窗 · 两处折叠都收得住", () => {
  it("① 技艺默认合着", () => {
    expect(SRC, "技艺的开合状态初值不是 false —— 一进弹窗就摊开,等于没收").toMatch(
      /const skillsOpen = ref\(false\)/,
    );
    /*
     * 正文挂在这个状态上。v-show 与 v-if 都能守「默认不见」;
     * 判据只管「它真的挂着」,不规定用哪一个 —— 具体用哪个是版面权衡。
     */
    expect(SRC, "技艺正文没有挂在开合状态上").toMatch(
      /v-(?:show|if)="skillsOpen"[\s\S]{0,200}?data-brew-skills-body/,
    );
  });

  it("② 丹方章一次只开一章 —— 由 core 给出「玩家此刻那一境」", () => {
    /*
     * 一次只开一章,与藏珍的「每柜一次只抽开一屉」同一条规矩。
     * 二十一境全摊开就是一个平面长清单:实测 77 行 + 21 条章首全进 DOM,
     * 峰值 1143 越过那一档 1100 的预算(见 scripts/perf-profile 的数值注释)。
     */
    expect(SRC, "开章状态应是一个可空的单值,不是一个集合 —— 集合就会同时开好几章").toMatch(
      /const openMajor = ref<number \| null>\(null\)/,
    );
    expect(SRC, "点同一章应当收回(再点一次 = 全合上)").toMatch(
      /openMajor\.value = openMajor\.value === major \? null : major/,
    );
    expect(SRC, "默认展开的那一章要读 core 给的 defaultMajor,界面不许自己猜").toMatch(
      /openMajor\.value = recipeMeter\.value\.defaultMajor;/,
    );
    expect(SRC, "开炉即复位:关掉再开不该继承上一次的开合残态").toMatch(
      /watch\(\s*\(\) => props\.open[\s\S]{0,600}?resetGroupState\(\)/,
    );
    expect(SRC, "换搜索词也要复位开合 —— 一次搜索不该把二十一章全留在开着").toMatch(
      /watch\(recipeQuery, \(\) => \{\s*resetGroupState\(\);\s*\}\)/,
    );
  });

  it("③ 技艺折叠钮排在它自己展开的正文之前", () => {
    const toggleAt = SRC.indexOf("data-brew-skills-toggle");
    const bodyAt = SRC.indexOf("data-brew-skills-body");
    expect(toggleAt, "找不到技艺折叠钮 —— 判据会空转").toBeGreaterThan(-1);
    expect(bodyAt, "找不到技艺正文 —— 判据会空转").toBeGreaterThan(-1);
    expect(toggleAt, "技艺折叠钮跑到了它自己展开的正文后面 —— 一按它自己就被顶下去").toBeLessThan(
      bodyAt,
    );
  });

  it("③ 章首折叠钮排在它自己展开的正文之前", () => {
    const toggleAt = SRC.indexOf("data-recipe-group-toggle");
    const bodyAt = SRC.indexOf("data-recipe-group-body");
    expect(toggleAt, "找不到章首折叠钮 —— 判据会空转").toBeGreaterThan(-1);
    expect(bodyAt, "找不到章身 —— 判据会空转").toBeGreaterThan(-1);
    expect(toggleAt, "章首折叠钮跑到了它自己展开的正文后面").toBeLessThan(bodyAt);
  });

  it("④ 两处折叠读屏都知道可开可合,且 aria-controls 指向真的 id", () => {
    expect(SRC, "技艺缺 aria-expanded").toMatch(/:aria-expanded="skillsOpen"/);
    expect(SRC, "技艺缺 aria-controls").toMatch(/:aria-controls="SKILLS_BODY_ID"/);
    expect(SRC, "aria-controls 指向的 id 没挂在技艺正文上").toMatch(/:id="SKILLS_BODY_ID"/);

    expect(SRC, "章首缺 aria-expanded").toMatch(/:aria-expanded="isGroupOpen\(g\)"/);
    expect(SRC, "章首缺 aria-controls").toMatch(/:aria-controls="groupBodyId\(g\.major\)"/);
    expect(SRC, "aria-controls 指向的 id 没挂在章身上").toMatch(/:id="groupBodyId\(g\.major\)"/);
  });

  it("⑤ 反空转:两处折叠钮都还在", () => {
    expect(SRC).toContain("data-brew-skills-toggle");
    expect(SRC).toContain("data-recipe-group-toggle");
  });
});
