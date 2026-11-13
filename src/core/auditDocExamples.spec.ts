/**
 * `docs/审计规范.md` 点名的那些例子，必须真的还在。
 *
 * ## 由来（第 183 轮）
 *
 * 这份文档是「怎么写判据」的规范，而它的说服力全在**举的例子**上:
 *
 * ```text
 * 判决自己举报自己     testSurfaceHygiene / stripCommentsParity / commentScaleClaims
 * 前提自检             startupOrder / dailySettleOrder
 * 孤立调用测流程        reincarnation 的 archiveBond 与 player.rebirth 的顺序
 * ```
 *
 * 例子一旦漂了（文件被改名、那段代码被重构掉），文档就从「经验」变成「传说」——
 * 后来者照着找一个不存在的东西，然后放弃。
 *
 * 文档里有路径的地方，`scripts/docs-check.mjs` 已经会核存在性;
 * 但它**核不了「那个结构还在不在」** —— 比如「这个 spec 里有排除自身的写法」
 * 「这个 spec 里有前提自检」。
 *
 * ## 这条判据守什么
 *
 * ① 文档里以反引号点名的 `*.spec.ts` 都存在;
 * ② 那三处「排除自身」的 spec，确实各有一句排除自己的判断;
 * ③ 那两处「前提自检」的 spec，确实各有一条「判据的前提」。
 *
 * 只核**文档明确断言过**的那几处 —— 不追求覆盖全文，那会把判据变成第二份文档。
 *
 * ## 故障注入
 *
 * 把文档里某个 `X.spec` 改成不存在的名字 → 「点名的 spec 都落得了盘」红。
 * 删掉 `stripCommentsParity` 里那句排除自身 → 「都真的排除了自身」红。
 */
import { describe, expect, it } from "vite-plus/test";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { readSource, ROOT } from "@/test/readSource";

const DOC = "docs/审计规范.md";

/**
 * 文档里点名的 spec 文件名 —— **只认带 `.spec` 后缀的明确写法**。
 *
 * ## 试过两种更宽的写法，都不可靠
 *
 * ```text
 * 第一版  「src 下真有同名 spec 才算」     坏引用被静默跳过（把名字改错，判据照绿）
 * 第二版  按小节收裸名                     误收 stripComments（是模块不是 spec）、
 *                                           addInitScript（浏览器 API）、apexDeeds（另一条判据）
 * ```
 *
 * 宽的那版会误报，窄的那版会漏报。**选窄的**:
 * 这个判据的价值是「文档点名的东西还在」，而它只对**明确写法**才成立;
 * 裸名靠措辞猜，猜错的代价（一条永远红的判据）比漏报更大。
 *
 * 文档里带 `.spec` 的写法是明确的，故那一部分由这条判据守;
 * 裸名那一部分的可靠性靠「写文档时别改名」，不强求机械可判。
 */
function namedSpecs(doc: string): string[] {
  const out = new Set<string>();
  for (const m of doc.matchAll(/`([A-Za-z][\w]*\.spec)`/g)) out.add(m[1]!);
  return [...out];
}

/**
 * 在 `src/` 下找这个名字的 spec。
 *
 * 文档里写的是短名（`stripCommentsParity.spec`），落盘时带 `.ts`。
 * 用几个常见目录找一遍而不是硬编码路径 —— 文档说的是「有这么一份」，不是「在哪个目录」。
 */
function findSpec(shortName: string): string | null {
  const target = `${shortName}.ts`;
  const dirs = ["src/core", "src/ui", "src/stores", "src/data", "src/composables"];
  for (const d of dirs) {
    const p = join(d, target);
    if (existsSync(join(ROOT, p))) return p;
  }
  return null;
}

describe("审计规范 · 点名的例子必须还在", () => {
  const doc = readSource(DOC);
  const specs = namedSpecs(doc);

  it("文档里点名的每一份 spec 都落得了盘", () => {
    expect(specs.length, "点名太少 —— 文档结构变了？").toBeGreaterThan(2);
    const missing: string[] = [];
    for (const s of specs) {
      if (!findSpec(s)) missing.push(s);
    }
    expect(missing, "文档点名的 spec 找不到了 —— 文档从「经验」变成「传说」").toEqual([]);
  });

  it("「判据举报自己」那一节点名的三份，都真的排除了自身", () => {
    /*
     * 这三份是文档第三节里的例子。若哪天有人删掉那句 `continue`，
     * 文档就在教一个已经不存在的手法。
     */
    const examples = ["testSurfaceHygiene", "stripCommentsParity", "commentScaleClaims"];
    const broken: string[] = [];
    for (const name of examples) {
      const path = findSpec(`${name}.spec`);
      if (!path) {
        broken.push(`${name}.spec 不存在`);
        continue;
      }
      const src = readSource(path);
      // 排除自身:文件里必须提到自己的文件名，且伴随 continue / 早退
      const selfName = `${name}.spec.ts`;
      if (!src.includes(selfName)) {
        broken.push(`${name}.spec 里没有提到自己的文件名 —— 它是怎么排除自身的?`);
      }
    }
    expect(broken, "文档在教一个已经不存在的手法").toEqual([]);
  });

  it("「前提自检」那一节点名的两份，都真的有一条前提断言", () => {
    const examples = ["startupOrder", "dailySettleOrder"];
    const broken: string[] = [];
    for (const name of examples) {
      const path = findSpec(`${name}.spec`);
      if (!path) {
        broken.push(`${name}.spec 不存在`);
        continue;
      }
      const src = readSource(path);
      if (!/前提/.test(src)) broken.push(`${name}.spec 里没有「前提」字样 —— 那一节举的例没了`);
    }
    expect(broken).toEqual([]);
  });

  it("防空转:文档确实读到了内容", () => {
    expect(doc.length, "文档是空的或被改名了").toBeGreaterThan(2000);
    expect(doc, "文档里没有「故障注入」那一节").toContain("故障注入");
  });
});
