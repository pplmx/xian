/**
 * 法宝的主动神通 —— 两件神品不该共用同一招。
 *
 * ## 复现:混沌开天斧 与 鸿蒙尺 的主动都叫「开天」
 *
 * 把 46 件法宝的 `active.name` 摊开数一遍,45 个名字里有**一个重复**:
 *
 * ```text
 * 开天  ← 混沌开天斧(神品 · t31 · 208% 伤害)
 *      ← 鸿蒙尺    (神品 · t31 · 210% 伤害)
 * ```
 *
 * 两件的说明文字也几乎同构 ——「每 3 回合开天一击,造成 20x% 攻击伤害」。
 * 差别只剩一个图标与两个百分点。
 *
 * ## 为什么这一处特别要紧
 *
 * 神品是全作**最该有辨识度**的一档。玩家好不容易凑齐两件神兵,同时带在身上,
 * 战斗里看到的却是同一个招式名、同一句说明 —— 那正是「高级感」最不该塌的地方:
 * 名头该多重就多重,招式却讲不出一件神宾与另一件的分别。
 *
 * 而 `data/artifacts.ts` 的文件头自己写着这条精神:
 *
 *   > 名头该多重就多重 —— 混沌钟、造化玉碟、盘古斧(混沌开天斧)、鸿蒙尺、神魔镜,
 *   > 生而神品
 *
 * 五件神品被并列点名,它们显然应该是**五件不同的东西**。
 *
 * ## 判据守什么
 *
 * 只说一件事:**主动神通的名不许撞**。它不规定叫什么、什么效果、几回合一次 ——
 * 那是内容设计的事。撞名本身就是缺陷:玩家读到的两行字几乎一样,
 * 而它们本该是两件不同的神物。
 *
 * 顺带守第二条:**同名的两件说明也不许同构**(万一将来真要做同名系列)。
 * 这一条现在是空的(不撞名就没有同构),它是给将来留的 —— 但若有人为了绕开
 * 第一条而把名字改掉、description 照抄,这一条会当场把他拦下。
 */
import { describe, expect, it } from "vite-plus/test";
import { ARTIFACTS } from "@/data/artifacts";

describe("法宝主动神通 · 名头不撞", () => {
  it("法宝的主动神通名两两不同", () => {
    // 标题里不写件数:那个数会随内容变化而过期(第 52 轮补到 49 件时它就已经是错的了)
    const byName = new Map<string, string[]>();
    for (const def of ARTIFACTS) {
      const name = def.active.name;
      byName.set(name, [...(byName.get(name) ?? []), `${def.name}(${def.quality})`]);
    }
    const dupes = [...byName.entries()]
      .filter(([, who]) => who.length > 1)
      .map(([name, who]) => `「${name}」← ${who.join(" / ")}`);
    expect(
      dupes,
      `这些法宝的主动神通撞名 —— 同时带在身上时,战斗里看到的是同一个招式:\n  ${dupes.join("\n  ")}`,
    ).toEqual([]);
  });

  it("神品之间尤其不许撞 —— 那一档最该讲得出分别", () => {
    const divine = ARTIFACTS.filter((a) => a.quality === "divine");
    const names = divine.map((a) => a.active.name);
    expect(new Set(names).size, `神品法宝的主动神通有重名:${names.join(" / ")}`).toBe(names.length);
  });

  it("神品的主动说明也不许只差数字 —— 那一档最该讲得出分别", () => {
    /*
     * 「只差数字」的机械代理:把数字抹掉之后逐字相同。
     *
     * 混沌开天斧与鸿蒙尺原来就是这一类 ——「每 3 回合开天一击,造成 208% / 210%
     * 攻击伤害」,说明只差两个百分点,名字还撞了。神品是全作最该有辨识度的一档,
     * 故这一条只量**神品之间**。
     *
     * 为什么不扩到全表:普通法宝的主动本来就共用少数几种写法(回复 / 护盾 / 伤害),
     * 那是**同一族效果的正常措辞** —— 后面跟着不同的数值与不同的触发节拍。
     * 扩到全表会把四组正常的同族措辞判成缺陷,而它们各自靠数值与节拍分得开
     * (梯度由 artifactLadder 守着)。与「两件神品读起来像同一件」是两回事。
     */
    const norm = (s: string) => s.replace(/[\d.]+/g, "#");
    const divine = ARTIFACTS.filter((a) => a.quality === "divine");
    const byShape = new Map<string, string[]>();
    for (const def of divine) {
      const shape = norm(def.active.desc);
      byShape.set(shape, [...(byShape.get(shape) ?? []), def.name]);
    }
    const same = [...byShape.entries()]
      .filter(([, who]) => who.length > 1)
      .map(([shape, who]) => `${who.join(" / ")} 的主动说明只差数字:«${shape}»`);
    expect(same, `这些神品法宝的主动说明一模一样(只差数值):\n  ${same.join("\n  ")}`).toEqual([]);
  });

  it("反空转:确实量到了法宝与它们的主动", () => {
    expect(ARTIFACTS.length, "一件法宝都没量到").toBeGreaterThan(10);
    const named = ARTIFACTS.filter((a) => a.active.name.length > 0).length;
    expect(named, "有法宝没有主动名 —— 判据会空转").toBe(ARTIFACTS.length);
  });
});

/**
 * 主动**说明**也不许只差数字 —— 同名的查过了,同形的没查过。
 *
 * ## 缺口是什么(第 66 轮实测)
 *
 * 上面几条守的是「主动神通**名**不重复」。但说明文字是另一回事:
 *
 * ```text
 * shield 族:  玄天镜「每 4 回合获得 18% 生命护盾」
 *             定海珠「每 4 回合获得 22% 生命护盾」
 *             千机伞「每 4 回合获得 26% 生命护盾」
 *             太虚镜「每 4 回合获得 32% 生命护盾」
 * ```
 *
 * 四件法宝跨 t3 / t8 / t10 / t17 四个层级,**说明只差一个数字**。而同族的
 * 本源莲台写的是「每 4 回合**本源护持**,获得 19.5% 生命护盾」—— 有专属的意象。
 *
 * 名字不同、效果不同,但玩家在战斗日志里看到的是同一句话的四份拷贝。
 *
 * ## 判据
 *
 * 把说明里的数字抹成 `N` 之后,**同一效果族内不许出现两份相同的形状**。
 * 只查族内(heal 与 shield 之间允许同形 —— 它们本来就在说不同的事)。
 *
 * 上限设 1:一族里出现两份同形就红。这条比「名字不重复」严,因为说明是给玩家读的。
 */
describe("法宝主动说明 · 同族内不许只差数字", () => {
  it("每个效果族里,把数字抹平后的说明形状两两不同", () => {
    const byFamily = new Map<string, Map<string, string[]>>();
    for (const def of ARTIFACTS) {
      const family = def.active.effect.type;
      const shape = def.active.desc.replace(/[\d.]+/g, "N");
      const shapes = byFamily.get(family) ?? new Map<string, string[]>();
      shapes.set(shape, [...(shapes.get(shape) ?? []), def.name]);
      byFamily.set(family, shapes);
    }
    // 防空转:真的量到了几个族
    expect(byFamily.size, "一个效果族都没量到 —— 判据在空转").toBeGreaterThanOrEqual(4);

    const dupes: string[] = [];
    for (const [family, shapes] of byFamily) {
      for (const [shape, who] of shapes) {
        if (who.length > 1) {
          dupes.push(`${family}: ${who.join(" / ")} 的说明只差数字 —— «${shape}»`);
        }
      }
    }
    expect(
      dupes,
      "这些法宝的主动说明同形 —— 战斗日志里看到的是同一句话的几份拷贝:" + dupes.join("、"),
    ).toEqual([]);
  });
});
