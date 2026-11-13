/**
 * 文档覆盖总表 —— 哪一份文档、由哪条判据守着、守的是什么。
 *
 * ## 为什么要有这张表
 *
 * 第 105~107 三轮逐份核了文档里的数字,每轮补一两条判据。三轮下来有 8 个 spec
 * 各看一部分:
 *
 * ```text
 *   usageDocCounts.spec     usage.md       数字对数据源
 *   dataHeaderAudit.spec    usage.md       表头规模与文档对账
 *   docShotsFresh.spec      usage.md       截图是否过期
 *   designDocCounts.spec    design.md      两处现状陈述
 *   docConstants.spec       design/development   常量与文档对账
 *   docCrossCheck.spec      alchemy/engine 「N 味状态丹」与引用条数
 *   progressionDoc.spec     (公式与文案)   每境 ×N
 *   tribulationDoc.spec     superpowers/specs   历史口径冻结
 * ```
 *
 * 分散本身没错 —— 每条判据守一类性质,混在一起会变成一锅。问题是**没有一张总表**:
 * 新来的人(或三个月后的我)想知道「`deployment.md` 有没有人看」,只能逐个 grep。
 *
 * 这张表不重复那些判据的逻辑,它只回答一个问题:
 * **`docs/` 下的每一份文档,是否至少有一条判据在管它。**
 *
 * ## 三类文档,三种命运
 *
 * ```text
 *   规范性(usage / design / alchemy / engine)  该说**当前事实** —— 必须有判据
 *   编年史(development / superpowers / release-notes)  该说**当时事实** —— 不要求数字对账,
 *                                                        但 release-notes 有另一层纪律
 *                                                        (见下)
 * ```
 *
 * 把编年史按当前值钉死是错的(第 106/107 两轮都撞过这个),所以这条判据**只要求
 * 规范性文档被覆盖**,并**显式列出**哪些是编年史、为什么可以不对账。
 */
import { describe, expect, it } from "vite-plus/test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { ROOT } from "@/test/readSource";

/**
 * `docs/` 下的每一份 `.md`,以及它的性质。
 *
 * `guard` 只在规范性文档上要求 —— 编年史写 `null` 并给出理由。
 */
const DOC_MAP: readonly {
  file: string;
  kind: "normative" | "chronicle";
  /** 守它的 spec(相对 src/);编年史可为 null */
  guard: string | null;
  /** 守的是什么 / 为什么不需要守 */
  note: string;
}[] = [
  {
    file: "usage.md",
    kind: "normative",
    guard: "core/usageDocCounts.spec.ts",
    note: "面向玩家:每个结构数都等于真实条数",
  },
  {
    file: "design.md",
    kind: "normative",
    guard: "core/designDocCounts.spec.ts",
    note: "现状陈述(法宝/灵兽/功法件数与功法三分类)对数据源",
  },
  {
    file: "审计规范.md",
    kind: "normative",
    /*
     * 守它的是**它自己的存在性** —— 这份文档被 `contentReachabilityAudit.spec`
     * 的文件头点名,而此前一直不存在(第 168 轮才发现)。
     * `docRefExistence.spec` 验的就是「源码点名的文档必须真实存在」,
     * 对这份文档来说,那条判据既是它的守卫也是它存在的理由。
     */
    guard: "core/docRefExistence.spec.ts",
    note: "判据自身的编写规范:每条都要能被打红;由 docRefExistence 守着存在性",
  },
  {
    file: "alchemy.md",
    kind: "normative",
    guard: "core/docCrossCheck.spec.ts",
    note: "「N 味状态丹」等具体说法对数据源",
  },
  {
    file: "engine.md",
    kind: "normative",
    guard: "core/docCrossCheck.spec.ts",
    note: "库引用条数由脚本现算,不写死",
  },
  {
    file: "deployment.md",
    kind: "normative",
    guard: "core/gateWiring.spec.ts",
    note: "部署与门的接线 —— 由 gateWiring 验命令可达",
  },
  {
    file: "development.md",
    kind: "chronicle",
    guard: null,
    note: "工程日志:按轮次记当时发生了什么,数字是快照,不对账是对的",
  },
];

/** `docs/` 下真实存在的 .md(只取顶层) */
function realDocs(): string[] {
  return readdirSync(join(ROOT, "docs"))
    .filter((f) => f.endsWith(".md"))
    .sort();
}

describe("文档覆盖总表", () => {
  it("`docs/` 顶层每一份 .md 都在表里,且性质写明", () => {
    const listed = new Set(DOC_MAP.map((d) => d.file));
    const missing = realDocs().filter((f) => !listed.has(f));
    expect(
      missing,
      "这些文档不在覆盖总表里 —— 新增文档时请登记它属于规范性还是编年史:" + missing.join("、"),
    ).toEqual([]);
  });

  it("表里的每一份都真实存在", () => {
    const real = new Set(realDocs());
    const ghosts = DOC_MAP.filter((d) => !real.has(d.file)).map((d) => d.file);
    expect(ghosts, "表里登记了不存在的文档:" + ghosts.join("、")).toEqual([]);
  });

  it("规范性文档都有判据,且那个 spec 真的读它", () => {
    const problems: string[] = [];
    for (const { file, kind, guard } of DOC_MAP) {
      if (kind !== "normative") continue;
      if (!guard) {
        problems.push(`${file} 是规范性文档却没有 guard`);
        continue;
      }
      const specPath = join(ROOT, "src", guard);
      let specText: string;
      try {
        specText = readFileSync(specPath, "utf8");
      } catch {
        problems.push(`${file} 登记的 guard ${guard} 不存在`);
        continue;
      }
      // guard 必须真的提到这份文档的文件名,否则它守的是别的
      if (!specText.includes(file)) {
        problems.push(`${file} 登记的 guard ${guard} 里找不到「${file}」`);
      }
    }
    expect(problems, "规范性文档的判据接线有问题:" + problems.join(" / ")).toEqual([]);
  });

  it("编年史都写明了为什么不需要对账", () => {
    const vague = DOC_MAP.filter(
      (d) => d.kind === "chronicle" && (!d.guard === false || d.note.trim().length < 10),
    ).map((d) => d.file);
    expect(vague, "这些编年史没写清为什么可以不对账:" + vague.join("、")).toEqual([]);
  });

  it("反空转:两类文档都存在,表不是空的", () => {
    expect(DOC_MAP.length, "总表空了").toBeGreaterThanOrEqual(5);
    expect(
      DOC_MAP.filter((d) => d.kind === "normative").length,
      "规范性文档一条都没有 —— 表被掏空了",
    ).toBeGreaterThanOrEqual(4);
    expect(realDocs().length, "docs/ 下没扫到 .md").toBeGreaterThanOrEqual(5);
  });
});
