/**
 * 静态导入环 —— 只许减,不许增。
 *
 * ## 为什么值得一条判据
 *
 * 循环依赖在 ESM 里**不是错误**:两个模块可以互相 import,只要能保证不在模块顶层
 * 用到对方还没初始化的绑定。本仓当前有 5 个环,全部属于这一类 —— 读写都发生在
 * 函数体内,故从来没炸过。
 *
 * 但它是**脆的**:一旦谁在顶层写一句 `const x = otherThing()`,加载顺序就决定
 * 成败,而失败形态是 `ReferenceError: Cannot access 'X' before initialization`
 * —— 报错点在无关的模块上,查起来极慢。更常见的是它让「这个模块到底依赖谁」
 * 变得不可回答:环上的每一处都可能是对方的因。
 *
 * ## 这条判据守什么
 *
 * 不是「消灭所有环」(那要动 5 处架构,收益与风险不成比例),而是**不许新增**:
 * 把当前的环记成基线,新出现的环立刻红。和 `layeringAudit` 的 `STATEFUL_CORE`
 * 同一套做法 —— 存量清点清楚,增量当场拦下。
 *
 * ## 什么算一个环
 *
 * 只算**静态** import / export-from。动态 `import()` 是懒加载,不参与启动期的
 * 求值顺序,不构成传统意义的环(lazy 环在两边都是函数体调用时才出现,已经安全)。
 * 环用文件路径的**集合**表示并归一化(按字典序 + 固定起点)——
 * 同一个环从不同节点出发会得到不同序列,不归一化就会把 1 个环数成 N 个。
 */
import { describe, expect, it } from "vite-plus/test";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";

const ROOT = resolve(__dirname, "../..");
const SRC = join(ROOT, "src");

/** src 下的全部非用例源文件(.ts / .vue) */
function sourceFiles(): string[] {
  const out: string[] = [];
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (/\.(ts|vue)$/.test(entry.name) && !entry.name.endsWith(".spec.ts")) out.push(full);
    }
  };
  walk(SRC);
  return out.sort();
}

/** 把一句 import 的说明符解析成 src 下的真实文件;解析不到(外部包)返回 null */
function resolveSpecifier(from: string, spec: string, files: Set<string>): string | null {
  let base: string;
  if (spec.startsWith("@/")) base = join(SRC, spec.slice(2));
  else if (spec.startsWith(".")) base = resolve(dirname(from), spec);
  else return null; // 裸包名(wanxiang-engine / vue / …)不在本判据范围内
  for (const candidate of [base, `${base}.ts`, `${base}.vue`, join(base, "index.ts")]) {
    if (files.has(candidate)) return candidate;
  }
  return null;
}

/** 静态 import / export-from 的依赖图 */
function importGraph(): Map<string, Set<string>> {
  const files = sourceFiles();
  const fileSet = new Set(files);
  const graph = new Map<string, Set<string>>();
  for (const file of files) {
    const text = readFileSync(file, "utf8");
    const deps = new Set<string>();
    /*
     * 只取行首的 import / export…from;`import(` 动态导入不匹配这个形态。
     *
     * **`import type` / `export type` 要排除** —— 类型导入在编译后被完全擦除,
     * 不参与运行时求值顺序,构不成传统意义的环。原先没排除,于是把
     * `stores/player.ts` 里那句 `import type { FortuneChoice } from "@/core/fortuneChain"`
     * 也算成了依赖,凭空多出「fortuneChain ↔ player」这个环(实测排除后环数 5 → 4)。
     *
     * 这种误报的代价是实打实的:它让人以为有一处架构问题要解,而那里根本不存在 ——
     * 一个只读类型的单向依赖,任何时候都不会出问题。
     */
    for (const m of text.matchAll(
      /^\s*(?:import|export)\s+(?!type\b)[^;]*?from\s+["']([^"']+)["']/gm,
    )) {
      const target = resolveSpecifier(file, m[1]!, fileSet);
      if (target && target !== file) deps.add(target);
    }
    graph.set(file, deps);
  }
  return graph;
}

/**
 * 找出全部环,每个环归一化成一个可比较的字符串。
 *
 * 归一化:环上节点按字典序排,并以字典序最小的那个为起点 —— 同一个环不论从哪
 * 个节点开始 DFS,出来的键都一样。
 */
function findCycles(graph: Map<string, Set<string>>): string[][] {
  const WHITE = 0;
  const GRAY = 1;
  const BLACK = 2;
  const color = new Map<string, number>([...graph.keys()].map((k) => [k, WHITE]));
  const stack: string[] = [];
  const seen = new Set<string>();
  const cycles: string[][] = [];

  const dfs = (node: string): void => {
    color.set(node, GRAY);
    stack.push(node);
    for (const next of graph.get(node) ?? []) {
      const c = color.get(next);
      if (c === GRAY) {
        const cycle = stack.slice(stack.indexOf(next));
        // 归一化:取字典序最小者作起点
        const min = [...cycle].sort()[0]!;
        const at = cycle.indexOf(min);
        const rotated = [...cycle.slice(at), ...cycle.slice(0, at)];
        const key = rotated.map((p) => relative(ROOT, p)).join(" → ");
        if (!seen.has(key)) {
          seen.add(key);
          cycles.push(rotated.map((p) => relative(ROOT, p)));
        }
      } else if (c === WHITE) {
        dfs(next);
      }
    }
    stack.pop();
    color.set(node, BLACK);
  };

  for (const node of graph.keys()) if (color.get(node) === WHITE) dfs(node);
  return cycles;
}

/**
 * 当前存在的 **4 个环** —— 基线,只许减。
 *
 * 每一条都是「读写都在函数体内」的安全环,但都该在下次动到相关模块时顺手解开。
 * 解开一个就从这里删一条;新出现一个立刻红。
 */
const BASELINE = [
  "src/core/engineCraft.ts → src/core/pillService.ts",
  "src/core/weather.ts → src/stores/player.ts",
  "src/stores/dongfu.ts → src/stores/player.ts → src/stores/resources.ts",
  "src/stores/player.ts → src/stores/quests.ts",
];

describe("静态导入环 · 只许减不许增", () => {
  const graph = importGraph();
  const cycles = findCycles(graph);

  it("扫得到依赖 —— 图不能是空的", () => {
    // 防空转:解析规则写错(比如别名换了)会让整张图空掉,后面两条就永远绿
    expect(graph.size, "一个源文件都没扫到").toBeGreaterThan(100);
    const withDeps = [...graph.values()].filter((d) => d.size > 0).length;
    expect(withDeps, "没有任何文件解析出依赖 —— 解析规则可能失效了").toBeGreaterThan(100);
  });

  it("环的集合与基线一致 —— 新增的环立刻红", () => {
    const actual = new Set<string>();
    for (const cycle of cycles) {
      /*
       * 输出成「首尾同节点的闭合路径」会随起点变;这里统一成
       * 「按字典序最小的节点开头、回到它之前」的开放序列,便于与基线逐一比对。
       */
      actual.add([...cycle].sort().join(" , "));
    }
    const expected = new Set(BASELINE.map((line) => line.split(" → ").sort().join(" , ")));
    const added = [...actual].filter((k) => !expected.has(k));
    const removed = [...expected].filter((k) => !actual.has(k));
    expect(
      added.map((k) => k.replace(/ , /g, " → ")).slice(0, 8),
      "新增了静态导入环 —— 环上的模块在加载顺序上互相牵制,顶层求值一旦交叉就会" +
        "Cannot access before initialization。解开它,或确认安全后加进 BASELINE",
    ).toEqual([]);
    /*
     * 减了也要报:基线比实际多,说明有人解开了环却忘了删基线 —— 下次同一个环
     * 再长出来时会被当成"已知",判据就守不住了。
     */
    expect(
      removed.map((k) => k.replace(/ , /g, " → ")),
      "基线里的环已经不存在了 —— 从 BASELINE 删掉它,否则它再出现时判据认不出来",
    ).toEqual([]);
  });
});
