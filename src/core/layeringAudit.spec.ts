/* oxlint-disable no-console -- 分层审计的产出是给人看的清单 */
/**
 * 分层审计 —— core 对 store 的依赖只许减,不许增
 *
 * 由来:本仓的取向是「core 是逻辑、stores 是状态、views 只做薄接线」,但 core 里
 * 已经有一批模块直接 import store,而且散在十几个 store 上 —— 「测一个数值函数」
 * 因此要先建一整套 Pinia,「把这段逻辑搬去别处复用」也搬不动。彻底解耦是大工程
 * (逐系统迁移,不是一刀切);在那之前,先立一条**只许向下**的红线:新加一处
 * core → store 的依赖,这里会红,逼人当场想清楚 —— 这份状态该由调用方传进来,
 * 还是真该从全局读?
 *
 * 判据两条:
 *   一 core 里 import store 的**文件数**与**处数**都不超过基线(只许减);
 *   二 utils 是更底的一层,不许 import core / stores(当前为 0,直接锁死)。
 *
 * 故障注入:在任一 core 模块里加一句 `import { usePlayerStore } from "@/stores/player"`,
 * 第一条红;在 src/utils 里加一句对 core/store 的 import,第二条红。
 *
 * 基线怎么改:只在**真的迁移完一摊**、数字降下来时改小;要往上抬,先想清楚为什么
 * 这一个模块值得破例(并把它记进 decision),别顺手把数改了让门变绿。
 */
import { describe, expect, it } from "vite-plus/test";
import { readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";

const CORE = resolve(__dirname);
const UTILS = resolve(__dirname, "../utils");

/** core 里「import 了某个 store」的一句话。只认这个别名路径,与全仓口径一致。 */
const STORE_IMPORT = /from\s+"@\/stores\/[A-Za-z]+"/g;
const CORE_STORE_FILES = 51;
const CORE_STORE_SITES = 156;

function sources(dir: string): { name: string; text: string }[] {
  return readdirSync(dir)
    .filter((f) => f.endsWith(".ts") && !f.endsWith(".spec.ts"))
    .map((f) => ({ name: f, text: readFileSync(join(dir, f), "utf8") }));
}

describe("分层 · core 对 store 的依赖只许减", () => {
  const core = sources(CORE);
  const withStore = core
    .map((f) => ({ name: f.name, hits: f.text.match(STORE_IMPORT) ?? [] }))
    .filter((f) => f.hits.length > 0);
  const sites = withStore.reduce((n, f) => n + f.hits.length, 0);

  it("扫描到了 core 源码(防空转)", () => {
    expect(core.length).toBeGreaterThan(50);
  });

  it("import store 的文件数不超过基线", () => {
    if (withStore.length > CORE_STORE_FILES) {
      console.log(`\ncore → store 的新增依赖(基线 ${CORE_STORE_FILES},现在 ${withStore.length}):`);
      for (const f of withStore) console.log(`  ${f.name}  ×${f.hits.length}`);
    }
    expect(withStore.length).toBeLessThanOrEqual(CORE_STORE_FILES);
  });

  it("import store 的处数不超过基线", () => {
    if (sites > CORE_STORE_SITES) {
      const per = new Map<string, number>();
      for (const f of withStore) {
        for (const hit of f.hits) {
          const store = hit.replace(/^.*@\/stores\//, "").replace(/"$/, "");
          per.set(store, (per.get(store) ?? 0) + 1);
        }
      }
      console.log(
        `\ncore → store 的引用分布(基线 ${CORE_STORE_SITES},现在 ${sites}):` +
          [...per.entries()]
            .sort((a, b) => b[1] - a[1])
            .map(([k, v]) => `\n  ${k} ×${v}`)
            .join(""),
      );
    }
    expect(sites).toBeLessThanOrEqual(CORE_STORE_SITES);
  });

  it("utils 不依赖 core / stores —— 最底层只认自己与标准库", () => {
    const bad = sources(UTILS).filter((f) => /from\s+"@\/(core|stores)\//.test(f.text));
    expect(bad.map((f) => f.name)).toEqual([]);
  });
});
