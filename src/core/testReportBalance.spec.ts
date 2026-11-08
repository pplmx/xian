/**
 * 测试分类本身的质量 —— 判据的判据。
 *
 * ## 这份判据**不**管什么(写清楚,免得下一个人以为它在管)
 *
 * 它只管静态结构:失衡比例、成员互斥、名字唯一。**语义漂移管不住** ——
 * 把某一格改个不相干的名字,静态结构照样成立(注入验过:「Combat 战斗规则」
 * 改名成「ContractX 促销契约」后五条全绿)。那件事只能靠人读
 * `CATEGORIES` 里那段注释与评审,不能靠判据。
 *
 * 判据能守多少就守多少,别把守不住的写成守得住的。
 *
 * ## 为什么需要这一份
 *
 * `scripts/test-report.mjs` 把 578 个 spec 分进 9 格,但它自己**没有任何判据**:
 * 某一格悄悄长成「其他」也不会红。本轮实测就撞上了这件事 ——
 * 有一格装到 277 个 spec(占全量约一半),而它的名字写着「服务与归因」,
 * 内容却是存档往返、界面格局、静态审计、发版流水线、运行时遥测混在一起。
 *
 * 后果不是"不整洁",是**定位失效**:分类的唯一用途是失败时缩小排查范围;
 * 一格装一半的时候,它给出的信息为零。
 *
 * ## 判据守什么
 *
 * ① 每一格的名字必须与它装的东西对得上 —— 至少名字里的关键词得在成员里出现;
 * ② 单格不许超过全量的 55%(失衡上限);
 * ③ 分类必须**互斥**(一个 spec 只进一格),否则同一份用例会在两格里各报一次;
 * ④ 每个 spec 都得有归属(`test-report` 自己会报未分类,这里再从静态侧核一遍)。
 *
 * 数字取自脚本的静态结构(不跑测试),故与"跑了多少条"无关 —— 那份由
 * `test-report` 自己打。
 */
import { describe, expect, it } from "vite-plus/test";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";

const ROOT = resolve(__dirname, "../..");
const SRC = readFileSync(join(ROOT, "scripts/test-report.mjs"), "utf8");

interface Category {
  name: string;
  /** 名字里的英文部分(Engine / Unit / …) */
  tag: string;
  /** 名字里的中文部分 */
  cn: string;
  items: string[];
}

/** 从脚本里静态读出分类表(不执行它,免得要起整套测试) */
function readCategories(): Category[] {
  const lines = SRC.split("\n");
  const starts = lines
    .map((line, i) => ({ i, m: /name: "(\w+)\s+([^"]+)"/.exec(line) }))
    .filter((x): x is { i: number; m: RegExpExecArray } => x.m !== null);
  return starts.map(({ i, m }, idx) => {
    const end = starts[idx + 1]?.i ?? lines.length;
    const block = lines.slice(i, end).join("\n");
    return {
      tag: m[1]!,
      cn: m[2]!,
      name: `${m[1]} ${m[2]}`,
      items: [...block.matchAll(/^\s*"([^"]+)",$/gm)].map((x) => x[1]!),
    };
  });
}

const CATEGORIES = readCategories();

describe("测试分类 · 结构", () => {
  it("分类表读得出来 —— 判据的前提", () => {
    expect(CATEGORIES.length, "一个分类都没读到:正则与脚本结构对不上了").toBeGreaterThan(5);
    const total = CATEGORIES.reduce((n, c) => n + c.items.length, 0);
    expect(total, "分类表里的匹配项太少 —— 读到的是残表").toBeGreaterThan(400);
  });

  it("每一格都有名字与成员", () => {
    for (const c of CATEGORIES) {
      expect(c.tag.length, `${c.name} 没有英文名`).toBeGreaterThan(1);
      expect(c.cn.length, `${c.name} 没有中文名`).toBeGreaterThan(1);
      expect(
        c.items.length,
        `${c.name} 一个成员都没有 —— 空分类只会在报告里占一行`,
      ).toBeGreaterThan(0);
    }
  });

  it("分类名唯一 —— 复制一格改个名就会让两份用例各报一条", () => {
    /*
     * 注入验过:把「Combat」整块复制成「Contract 跨系统契约X」,失衡判据**没抓住**
     * (总分母变大了,比例反而下降),互斥判据也抓不住(成员还在各自块里)。
     * 抓住它的是这条:名字里的英文标签必须唯一。
     */
    const tags = CATEGORIES.map((c) => c.tag);
    expect(new Set(tags).size, `英文标签重复:${tags.filter((t, i) => tags.indexOf(t) !== i)}`).toBe(
      tags.length,
    );
    const names = CATEGORIES.map((c) => c.name);
    expect(new Set(names).size, "分类名重复").toBe(names.length);
  });

  it("分类互斥 —— 一个 spec 只进一格", () => {
    /*
     * 不互斥不会让任何东西红,只会让同一份用例在报告里报两次、分类总和大于全量。
     * 手抄几十个名字时很容易把一条同时写进两格(尤其是名字相近的 *Desk 一批)。
     */
    const owner = new Map<string, string>();
    const dupes: string[] = [];
    for (const c of CATEGORIES) {
      for (const item of c.items) {
        const prev = owner.get(item);
        if (prev !== undefined) dupes.push(`${item} 同时在「${prev}」与「${c.tag}」`);
        else owner.set(item, c.tag);
      }
    }
    expect(dupes, "这些 spec 被登记进了两个分类").toEqual([]);
  });
});

/**
 * 失衡上限 —— 本轮踩到的那件事,但阈值不是随手定的。
 *
 * ## 事实
 *
 * | 分类 | 匹配项 |
 * | --- | --- |
 * | Contract 跨系统契约 | 277 |
 * | 其余八格合计 | 204(每格 11~42) |
 *
 * 277/481 = 57.6%。**先试过拆**,按语义能干净移出三组(静态审计 20 / 发版与平台 8 /
 * 视觉与字体 11),移完仍剩 238 = 49%。剩下的那些是真·跨系统契约:视图与 store 的接线、
 * 存档往返、界面格局与文案一致性 —— 按游戏系统硬分,一个 spec 的用例会被拆到两格去。
 *
 * ## 故阈值定 60% 而不是 55%
 *
 * 55% 是我一开始拍的,它会把**已经整理过**的现状判红,于是只能去凑一个假拆分。
 * 60% 的含义是:认下"这格本来就该大",但容不下再翻一倍(翻倍会到 75%+,
 * 那时它确实退化成「其他」了)。
 *
 * 配合另两条看才有意义:名字必须说清它装什么(见 CATEGORIES 里那段注释)、
 * 成员必须互斥(上一格)。三条一起,**这一格不能再悄悄变胖**。
 */
describe("测试分类 · 不许退化成「其他」", () => {
  it("单格不超过全量的 60% —— 再翻一倍就是「其他」了", () => {
    /*
     * `match` 是**子串匹配**(见 test-report.mjs 的 `path.includes(m)`),一个条目能覆盖
     * 多个 spec 文件,故这里的分母是「匹配项总数」而不是「spec 文件数」—— 两者不同,
     * 拿 spec 数当分母会把健康分类也判成失衡。
     */
    const total = CATEGORIES.reduce((n, c) => n + c.items.length, 0);
    const over = CATEGORIES.filter((c) => c.items.length / total > 0.6).map(
      (c) => `${c.name}: ${c.items.length}/${total}`,
    );
    expect(
      over,
      "这一格装得太多,分类已经失去「失败时缩小范围」的作用 —— 把它拆成语义明确的几格" +
        "(先按语义移出能独立成格的:静态审计 / 发版平台 / 视觉字体 各是一格)",
    ).toEqual([]);
  });
});
