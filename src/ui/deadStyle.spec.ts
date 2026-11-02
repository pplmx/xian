/**
 * 死样式判据 —— 样式表里每一条类选择器都必须有人用。
 *
 * 由来:一轮 UI 重构把 `.card-charged` 从修炼页摘掉、把书首位置签换成
 * `folio-head__position`,但样式与 `@keyframes card-glow` / `drift` 留在原地;
 * `atlas-trigger__mark` 的「枢」字被换成册次数字后,那条规则也还挂着。
 * 它们**不会报错**:CSS 不认识「没人用」,构建也不查;只是往后每一次读样式、
 * 每一次改版式,都要先花时间判断它是不是活的 —— 而它早已是尸体。
 *
 * 判据范围与口径:
 *   · 只看**含连字符的类名**(本项目自己的命名):`min-w-0`、`flex` 这类
 *     Tailwind 工具类不在此文件核对(它们由构成本身按需生成);
 *   · 引用面 = 全部 .vue/.ts/.mjs 的源码文本(含动态拼接的模板字面量);
 *   · Vue 过渡类(`fade-enter-active` 等)由 `<Transition name="fade">` 生成,
 *     源码里不会出现全名 —— 它们与 `is-*` / `--变体` 一起走白名单,白名单
 *     必须逐条写明为什么,写不出的就是该删的。
 */
import { describe, expect, it } from "vite-plus/test";
import { ROOT, isSourceOrScript, walkFiles } from "@/test/readSource";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { readStyleCss } from "@/test/readStyleCss";

/**
 * 由框架或模板字面量生成的类名 —— 源码里查不到全名,但它们确实是活的。
 *
 * 每一项都要写清「谁生成它」。新增条目等于承认「这里有一条代码看不见的绑定」,
 * 因此宁可收窄白名单,也不要为了绿灯把真尸体挪进来。
 */
const GENERATED: { pattern: RegExp; why: string }[] = [
  // Vue <Transition name="page-fade"> 会拼出 page-fade-enter-active / -from / -to 等
  {
    pattern:
      /^(page-fade|modal-fade|veil-fade|toast-slide|folio-turn-forward|folio-turn-back|folio-turn-cross|trial-dossier)-(enter|leave)-(active|from|to)$/,
    why: "Vue <Transition name> 自动生成的过渡类",
  },
  // `is-${tone}` / `is-${state}` 这类拼接
  { pattern: /^is-[\w-]+$/, why: "模板里以 `is-${...}` 拼接的状态类" },
  // `legacy-wheel__arc--life` / `settings-compass__arc--keep` 这类 BEM 变体
  { pattern: /__(arc|node)--[\w-]+$/, why: "BEM 变体以 `--${key}` 拼接" },
];

/**
 * 排版角色词表 —— 与「死样式」不同:它们不是某个组件留下的残迹,
 * 而是 `src/style.css` 里那一节给**下一张卡片**准备的名字(卡名 / 入口名 /
 * 条目名 / 正文 / 脚注),由 `typeScale.spec` 与 `uiLayering.spec` 守着定义。
 *
 * 之所以不在上面那条判据里要求「每个都有站点」:词表的用途正是「还没有站点时
 * 先有个名字」—— 逼它先被用上,等于把系统退回「每张卡凭印象抄一遍」。但这条
 * 豁免只给这五个,而且**必须有判据守着它们真在样式里定义着**(见下一条)。
 */
const ROLE_VOCAB = new Set(["t-card", "t-entry", "t-item", "t-body", "t-note"]);

function generated(name: string): boolean {
  return ROLE_VOCAB.has(name) || GENERATED.some((g) => g.pattern.test(name));
}

/** 全部会被读到的源码文本:src 下的源码 + scripts 下的自检脚本(它们也查选择器) */
function consumerText(): string {
  const files = [
    ...walkFiles(resolve(ROOT, "src"), isSourceOrScript),
    ...walkFiles(resolve(ROOT, "scripts"), isSourceOrScript),
  ];
  return files.map((f) => readFileSync(f, "utf8")).join("\n");
}

/** 样式表里的类名(去注释、去 @keyframes 里的百分比等噪声) */
function classNames(css: string): string[] {
  const clean = css.replace(/\/\*[\s\S]*?\*\//g, "");
  const names = new Set<string>();
  for (const m of clean.matchAll(/\.([a-zA-Z][\w-]*)/g)) {
    const name = m[1]!;
    // 只核本项目自己的命名:带连字符、且不是纯数字后缀的原子写法
    if (!name.includes("-")) continue;
    names.add(name);
  }
  return [...names];
}

const CONSUMERS = consumerText();
const UNUSED = classNames(readStyleCss())
  .filter((name) => !generated(name))
  .filter((name) => !CONSUMERS.includes(name));

describe("样式表里没有没人用的类", () => {
  it("每条类选择器都在模板、脚本或自检脚本里被提到", () => {
    expect(
      UNUSED,
      "这些类没有任何引用 —— 要么接回界面,要么删掉样式(别让下一个人去猜它活没活)",
    ).toEqual([]);
  });

  it("判据确实扫得到东西(防空转)", () => {
    // 若 readStyleCss 拼装方式变了、类名一个都抽不到,上面那条会因「违例为空」假绿
    expect(classNames(readStyleCss()).length).toBeGreaterThan(500);
    expect(CONSUMERS.length).toBeGreaterThan(100000);
  });

  it("认得出死样式,也不把过渡类误判", () => {
    const sample = ".dead-thing { color: red } .page-fade-enter-active { opacity: 0 }";
    const names = classNames(sample);
    expect(names).toEqual(["dead-thing", "page-fade-enter-active"]);
    expect(names.filter(generated), "过渡类是生成的,不该算死").toEqual(["page-fade-enter-active"]);
    expect(generated("dead-thing"), "普通类名不该被白名单放过").toBe(false);
  });

  /**
   * 排版角色词的豁免是有代价的:它们可以「暂时没有站点」,但不许**一直**没有。
   * 五个角色里若连一个都无人使用,那一整节就该跟着退场 —— 否则它就是
   * 一份写着「给下一张卡准备的名字」、却谁也不认的公告板。
   */
  it("排版角色词至少还得有人用(不许整节变成公告板)", () => {
    const used = [...ROLE_VOCAB].filter((name) => CONSUMERS.includes(name));
    expect(used.length, "五个排版角色一个都没在用").toBeGreaterThanOrEqual(1);
  });
});
