/**
 * 模块覆盖 —— 哪些 `core` 模块完全没有判据碰过。
 *
 * ## 这份清单怎么来的,以及它差点是怎么来的
 *
 * 第 87~89 轮一直在找「没有判据的模块」。前两轮用的探针是:
 *
 * ```text
 *   列 src/core/*.ts,看有没有同名 .spec.ts
 *   → 46 个模块「没有同名 spec」
 * ```
 *
 * 于是我以为有 46 个缺口。第 89 轮换了个问法(**「有没有任何 spec 导入过它」**)
 * 才发现:
 *
 * ```text
 *   无同名 spec:  46
 *   其中实际有覆盖: 40   ← 87% 是误报
 *   真正零覆盖:     6
 * ```
 *
 * `core/offline` 是最好的例子:它有 893 行、14 处强约束,却「没有同名 spec」——
 * 因为它的覆盖在 `offlineScope` / `offlineParity` / `offlineLedger` / `offlineCap`
 * 四个文件里。**「按文件名配对」是一种偷懒的覆盖判断**。
 *
 * ## 剩下这 6 个为什么可以被接受
 *
 * ```text
 *   diagnostics       运行诊断端口 —— core 只上报,不依赖 Pinia / 设置页
 *   uiPort            视图模型端口 —— core 里「该给界面看什么」不再直接够到 ui store
 *   kaiLateFaces      楷体「其余片」的 @font-face —— 在正文可读之后才挂上
 *   inventoryRender   背包每批件数 —— 是 `listRender` 的薄封装,那边已有四条判据
 *   engineCodex       图鉴层对库的定制 —— 逻辑在 packages/engine 的 codex
 *   engineMemory      世界记忆档位对库的定制 —— 逻辑在 packages/engine 的 memory
 * ```
 *
 * 六个都是**端口层或薄封装**:它们不含本作的判定逻辑,只是把库的形状接过来。
 * 端口层没有判据不是缺陷 —— 它没有可判定的行为。
 *
 * ## 判据
 *
 * 钉住**这个集合本身**:哪天有人往这六个模块里塞了真逻辑,或者新增了一个
 * 零覆盖模块,这条就会红,逼人把新模块移出清单(补判据)或写明为什么它也算端口层。
 */
import { describe, expect, it } from "vite-plus/test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { ROOT } from "@/test/readSource";

/**
 * 允许零覆盖的模块 —— 全部是端口层或薄封装。
 *
 * 每一条都写明它不含什么本作逻辑。
 */
const PORT_ONLY: readonly { module: string; why: string }[] = [
  { module: "diagnostics", why: "运行诊断端口,只上报不判定" },
  { module: "uiPort", why: "视图模型端口,把 core 的读数递给界面" },
  { module: "kaiLateFaces", why: "字体 @font-face 表,纯声明" },
  { module: "inventoryRender", why: "listRender 的薄封装,判据在那边" },
  { module: "engineCodex", why: "图鉴层对引擎的定制,逻辑在 packages/engine/codex" },
  { module: "engineMemory", why: "世界记忆档位对引擎的定制,逻辑在 packages/engine/memory" },
];

/** 收集所有 spec 文件(含 ui / data / stores)的正文 */
function allSpecText(): string {
  const out: string[] = [];
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.name === "node_modules" || entry.name === "tp") continue;
      const full = join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name.endsWith(".spec.ts")) out.push(readFileSync(full, "utf8"));
    }
  };
  for (const sub of [
    "src/core",
    "src/ui",
    "src/data",
    "src/stores",
    "src/views",
    "src/components",
  ]) {
    try {
      walk(join(ROOT, sub));
    } catch {
      // 目录不存在就跳过
    }
  }
  return out.join("\n");
}

describe("模块覆盖 · 零覆盖清单", () => {
  it("除清单外,每个 core 模块都被某个 spec 导入过", () => {
    const specText = allSpecText();
    expect(specText.length, "一个 spec 都没扫到 —— 路径变了").toBeGreaterThan(100_000);

    const portOnly = new Set(PORT_ONLY.map((p) => p.module));
    const orphans: string[] = [];
    for (const file of readdirSync(join(ROOT, "src/core"))) {
      if (!file.endsWith(".ts") || file.endsWith(".spec.ts")) continue;
      const mod = file.replace(/\.ts$/, "");
      if (portOnly.has(mod)) continue;
      // 「被导入过」的四种写法:相对路径、绝对别名、core 前缀
      const imported =
        specText.includes(`./${mod}"`) ||
        specText.includes(`@/core/${mod}"`) ||
        specText.includes(`/core/${mod}"`) ||
        specText.includes(`"./${mod}";`);
      if (!imported) orphans.push(mod);
    }
    expect(
      orphans,
      "这些 core 模块没有任何 spec 导入过 —— 要么补判据,要么加进 PORT_ONLY 并写明它为什么是端口层:" +
        orphans.join("、"),
    ).toEqual([]);
  });

  it("清单里的模块真的还不含可判定逻辑(行数上限)", () => {
    /*
     * 端口层应该很短。若某个「端口层」长到几百行,说明它已经有真逻辑了 ——
     * 那时它就不再是端口,该有自己的判据。
     */
    const tooBig: string[] = [];
    for (const { module, why } of PORT_ONLY) {
      const text = readFileSync(join(ROOT, `src/core/${module}.ts`), "utf8");
      const lines = text.split("\n").length;
      if (lines > 120) tooBig.push(`${module}(${lines} 行,${why})`);
    }
    expect(
      tooBig,
      "这些「端口层」已经长到不像端口了 —— 要么补判据,要么重新论证它是端口:" + tooBig.join("、"),
    ).toEqual([]);
  });

  it("反空转:清单规模合理,且每条都指向真实文件", () => {
    expect(PORT_ONLY.length, "清单空了 —— 那就该零覆盖,不该放行").toBeGreaterThan(0);
    expect(PORT_ONLY.length, "清单太长 —— 端口层不该有这么多").toBeLessThanOrEqual(10);
    for (const { module, why } of PORT_ONLY) {
      const text = readFileSync(join(ROOT, `src/core/${module}.ts`), "utf8");
      expect(text.length, `${module}.ts 是空的(${why})`).toBeGreaterThan(50);
    }
  });
});
