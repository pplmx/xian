/**
 * 器魂阶的形意章 —— 六阶也得有形状线索。
 *
 * ## 缺口:六阶只有颜色与名字这一个区分
 *
 * `ui/qualityTier` 写死的规矩是「稀有档另有角章作形状线索 —— 色弱玩家不靠颜色也能分档」。
 * 库里各处都照做了:装备格、功法书目、法宝行卡、候选件、坊市货架、灵兽谱、九佩。
 *
 * **器魂没有**。它在 `views/SoulsView.vue` 里只有两样东西:
 *
 *   行内   `:style="{ color: soulGradeDef(grade).color }"` + 阶名(朦胧 → 化真)
 *   详情   `soulColor(soul)` 同一个色 + 阶名
 *
 * 于是色弱玩家在器魂页读不出「这一缕是几阶」—— 而器魂恰恰是**最需要**的一处:
 * 它有六阶、且六阶的倍率是 1.0 → 2.3(化真比朦胧多 130%),不是可以忽略的差别。
 *
 * ## 与九档品质分开量,但同一条纪律
 *
 * 九档那边 `isRareQuality` 只给天/仙/神盖章 —— 那是九档里「稀有段」的界。
 * 器魂只有六阶,没有「稀有段」这回事:六阶本身就是它全部的分档。
 * 故界不同,纪律相同:**颜色之外要有第二条线索**。
 *
 * ## 章写什么
 *
 * 写阶名的首字(朦胧 → 朦、清晰 → 清 …),与 `QualitySeal` 同一套阴文口径
 * (纸底 + 阶色字 + 细边)。理由与那边一致:阶色不全是深色,拿它当底压不住纸字;
 * 而阶色当字色的对比度全库已由 AA 判据保证。
 *
 * ## 判据守什么
 *
 * 三件事:
 *   一 器魂页真的渲染这枚章(不是只算了变量);
 *   二 它用的界与 `SOUL_GRADES` 同源,不在视图里手写 rank 阈值;
 *   三 每一阶都盖 —— 与九档那边「只有稀有段盖」不同,这里是六阶全覆盖。
 */
import { describe, expect, it } from "vite-plus/test";
import { readSource } from "@/test/readSource";
import { SOUL_GRADES, soulGradeDef } from "@/data/souls";

describe("器魂阶 · 形状线索", () => {
  it("六阶每一阶都取得到一个首字作章 —— 没有空章", () => {
    const blank = SOUL_GRADES.filter((g) => !g.name || g.name.length === 0).map((g) => g.rank);
    expect(blank, "这些阶的阶名是空的,章会印出空白").toEqual([]);
    // 首字两两不同:六阶若有两个同首字,章就分不出那一档
    const heads = SOUL_GRADES.map((g) => g.name.charAt(0));
    expect(new Set(heads).size, `六阶的首字撞了:${heads.join(" / ")}`).toBe(heads.length);
  });

  it("器魂页渲染了这枚章 —— 不是只算了个变量", () => {
    const view = readSource("src/views/SoulsView.vue");
    expect(view, "要有阶章的落点供真浏览器复核").toContain("data-soul-grade-seal");
  });

  it("三处「这是几阶」都要盖 —— 三席、闲置行、凝炼预览", () => {
    const view = readSource("src/views/SoulsView.vue");
    const seals = view.match(/data-soul-grade-seal/g) ?? [];
    // 三席 + 闲置形意弹窗 + 凝炼台预览(另加详情面板),至少三处
    expect(seals.length, "器魂的三处都该盖这枚章").toBeGreaterThanOrEqual(3);
  });

  it("阶名首字由共享函数给出,不在任何界面里手写一套", () => {
    // 首字取自 data/souls 的 soulGradeSeal —— 组件与视图都不许自己切字符串
    const seal = readSource("src/components/common/SoulGradeSeal.vue");
    expect(seal, "章要读共享的 soulGradeSeal,不自己铺一遍阶名表").toContain("soulGradeSeal(");
    // 六阶名不许在任何界面文件里被抄第二份
    const view = readSource("src/views/SoulsView.vue");
    for (const g of SOUL_GRADES) {
      expect(
        view.includes(`"${g.name}"`),
        `视图里抄了一份阶名「${g.name}」—— 改表那天它就开始撒谎`,
      ).toBe(false);
    }
  });

  it("界与 SOUL_GRADES 同源:视图里不手写 rank 阈值", () => {
    const view = readSource("src/views/SoulsView.vue");
    expect(view, "阶的判定要复用共享谓词/函数").not.toMatch(/grade\s*>=\s*[3-9]/);
  });

  it("反空转:确实有六阶,且化真与朦胧拉得开", () => {
    expect(SOUL_GRADES.length, "只有一两阶就谈不上分档").toBeGreaterThan(3);
    const lo = soulGradeDef(0);
    const hi = soulGradeDef(SOUL_GRADES.length - 1);
    expect(hi.mult / lo.mult, "顶阶与底阶的倍率差太小,分不分档没区别").toBeGreaterThan(1.5);
  });
});
