/**
 * 藏珍谱检索 —— 九柜一千余条目,得能按名字找
 *
 * ## 缺口:九册只能一册一册翻
 *
 * `collectionCodex()` 把图鉴装配成九柜(装备 / 功法 / 悟道 / 丹药 / 材料 / 法宝 /
 * 灵兽 / 际遇 / 天赋),条目总量在千条以上。玩家要找「某件东西在哪一册」时,
 * 现在只有一条路:逐册翻,或用页内滚动条盲找。
 *
 * 这不是「再加个搜索框」的装饰需求 —— 它是**这个体量下的必需**:
 * 一册 191 则际遇、53 类装备、70 门功法,翻到第三册就忘了第一册有没有。
 *
 * ## 只搜**已识**的条目,不搜「???」
 *
 * 图鉴的核心设计是「未识的只留一枚 `???`」(见 `UNKNOWN_CAP` 与 `stage` 语义)。
 * 若检索能搜到未识条目的名字,那等于把「还没见过什么」提前告诉玩家 ——
 * 泄漏的不只是名字,是整个收集目标。故检索只在 `stage >= 1` 的范围里做,
 * 与页面上能看见的那部分**同源**。
 *
 * ## 结果是「条目 + 它属于哪一册」,不是一个跨册混合列表
 *
 * 藏珍谱的版式是**九柜并列**,每一柜有自己的章首与计数。检索若把结果拍成一张
 * 混列表,玩家就失去了「这是哪一册」这个上下文,也就没法回到那一册继续看。
 * 故结果按**柜**分组,每组带该柜的名字,并说明「本柜命中 N 条」。
 *
 * ## 全是纯函数
 *
 * 检索只做字符串匹配与分组,不读 store —— 输入是已经装配好的 `CodexCat[]`
 * (那一步由 `ui/codex.collectionCodex()` 负责读 store)。这样判据不必搭 Pinia。
 */
import { describe, expect, it } from "vite-plus/test";
import { searchCodex, type CodexSearchInput } from "./codexSearch";

const entry = (id: string, name: string, desc = "", stage = 1) => ({
  id,
  name,
  desc,
  meta: "",
  color: "#000",
  rank: 0,
  stage,
});

const cat = (key: string, name: string, entries: ReturnType<typeof entry>[]) =>
  ({ key, name, entries }) as never;

const fixture = (): CodexSearchInput[] => [
  cat("equip", "藏器谱", [
    entry("e1", "寒潭甲", "取自寒潭深处"),
    entry("e2", "玄铁重剑", "重剑无锋"),
    entry("e3", "未识之物", "还没见过", 0),
  ]),
  cat("gongfa", "功法阁", [
    entry("g1", "太玄引气诀", "大道至简"),
    entry("g2", "寒潭心法", "潭水之气"),
  ]),
  cat("pill", "丹房", [entry("p1", "护心丹", "护住心脉")]),
];

describe("藏珍谱检索 · 纯函数", () => {
  it("按名字命中,并报出它属于哪一册", () => {
    const hits = searchCodex(fixture(), "寒潭");
    expect(hits.map((h) => h.key)).toEqual(["equip", "gongfa"]);
    expect(hits[0]!.title).toBe("藏器谱");
    expect(hits[0]!.entries.map((e) => e.id)).toEqual(["e1"]);
    expect(hits[1]!.entries.map((e) => e.id)).toEqual(["g2"]);
  });

  it("也搜 desc —— 玩家常记得的是描述不是名字", () => {
    const hits = searchCodex(fixture(), "无锋");
    expect(hits).toHaveLength(1);
    expect(hits[0]!.entries.map((e) => e.id)).toEqual(["e2"]);
  });

  it("**只搜已识条目** —— 未识的不许被搜出来", () => {
    /*
     * `e3` 的 stage 是 0(还没见过),它的名字里恰好有「未识」两个字。
     * 搜它能搜到,就等于把「还没见过什么」提前告诉玩家 ——
     * 泄漏的不只是名字,是整个收集目标。
     */
    const hits = searchCodex(fixture(), "未识");
    expect(hits, "未识条目被搜出来了 —— 图鉴只该留一枚 ???").toEqual([]);
  });

  it("空查询返回空 —— 不当成「全列一遍」", () => {
    for (const q of ["", "   ", "\t"]) {
      expect(searchCodex(fixture(), q), `「${q}」不该列出全部`).toEqual([]);
    }
  });

  it("没有命中的册整册不出 —— 不印一行空白标题", () => {
    const hits = searchCodex(fixture(), "护心");
    expect(hits).toHaveLength(1);
    expect(hits[0]!.key).toBe("pill");
  });

  it("一册里多条命中时按原序,不改图鉴的排法", () => {
    const hits = searchCodex(fixture(), "寒");
    expect(hits[0]!.entries.map((e) => e.id)).toEqual(["e1"]);
    const many = searchCodex(
      [cat("x", "某册", [entry("a", "甲一"), entry("b", "甲二"), entry("c", "甲三")])],
      "甲",
    );
    expect(
      many[0]!.entries.map((e) => e.id),
      "命中多条时不许重排",
    ).toEqual(["a", "b", "c"]);
  });

  it("大小写不该让人搜不到", () => {
    const withLatin = [cat("y", "某册", [entry("l1", "Sword of Dawn")])];
    expect(searchCodex(withLatin, "sword")).toHaveLength(1);
    expect(searchCodex(withLatin, "SWORD")).toHaveLength(1);
  });

  it("全角字符归一 —— 输入法打出来的全角英文也能搜到", () => {
    /*
     * 归一化用 `String.fromCharCode` 生成全角字符,源码里**不写全角字形**:
     * 楷体子集要覆盖源码里出现的每个字,源码里写一个全角字形就得往字体里塞它
     * (`kaiFontCoverage.spec` 会当场红 —— 实测踩过)。
     */
    const fullWidth = String.fromCharCode(
      ...[...("Sword" as string)].map((ch) => ch.charCodeAt(0) + 0xfee0),
    );
    const withLatin = [cat("y", "某册", [entry("l1", "Sword of Dawn")])];
    expect(searchCodex(withLatin, fullWidth), "全角 S 应与半角同命中").toHaveLength(1);
  });

  it("每组带命中数 —— 界面据此写「本柜命中 N 条」", () => {
    const hits = searchCodex(fixture(), "寒");
    expect(hits[0]!.count).toBe(1);
    expect(hits[1]!.count).toBe(1);
  });

  it("总数与逐册之和一致 —— 别让界面自己再数一遍", () => {
    const hits = searchCodex(fixture(), "寒");
    const total = hits.reduce((s, h) => s + h.count, 0);
    expect(total).toBe(2);
  });
});
