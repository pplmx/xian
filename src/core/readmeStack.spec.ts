/**
 * README 的技术栈表 —— 它是门面,而门面最容易停在旧版本上。
 *
 * ## 缺口(第 138 轮实测)
 *
 * 第 105~137 这三十三轮里,README 只在「671 个 spec」那一处被 `docs-check` 扫到过
 * (spec 文件数是它唯一核的数字)。其余内容从没被系统核过 —— 而它列着**十项技术的版本**:
 *
 * ```text
 *   Vue 3.5 / TypeScript 6.0 / Vite 8 / Pinia 3 / Tailwind 3.4
 *   Vue Router 5 / Tone.js 15 / CryptoJS 4 / Vitest 5 / Electron 44 · Capacitor 8
 * ```
 *
 * 这轮逐条核:**十项全对**。但其中一项藏着一个 README 里看不出的事实 ——
 *
 * ```text
 *   package.json:  "vite": "catalog:" → npm:@voidzero-dev/vite-plus-core@1.4.0
 *   vp toolchain:  vite-plus@1.4.0 → bundles vite@8.3.5
 * ```
 *
 * **本仓不直接依赖 Vite**,它由 Vite+ 捆绑提供。而技术栈表只写「Vite | 8」,
 * 读者会以为 `bun add vite` 就能对上一份。已在该行补上这层说明。
 *
 * ## 判据
 *
 * ① 表里每一行的「主版本」与 `package.json`(或 `catalog`)里的实际版本一致;
 * ② 有版本落在 catalog / 间接依赖里的,表里要说明它是怎么来的。
 *
 * ② 看起来琐碎,但它守的正是这轮发现的那一件事:**「表里写着 Vite 8」与
 * 「仓库里有一个 vite 8」是两回事** —— 后者可能来自任何一层。
 */
import { describe, expect, it } from "vite-plus/test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ROOT } from "@/test/readSource";

const README = readFileSync(join(ROOT, "README.md"), "utf8");
const PKG = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8")) as {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  catalog?: Record<string, string>;
  packageManager?: string;
  engines?: { node?: string };
};

const DEPS = { ...PKG.dependencies, ...PKG.devDependencies };

/** 取版本串里的主版本号:`^3.5.44` → `3` */
function majorOf(spec: string): string | null {
  // 表里可能写 `3.5`(Vue)也可能只写 `3`(Pinia)—— 两种都要认
  const m = /(\d+)(?:\.\d+)?/.exec(spec);
  return m ? m[1]! : null;
}

/** README 技术栈表里的一行:`| Vue 3 | 3.5 | … |` */
function tableRow(label: string): string | null {
  const re = new RegExp(`^\\|\\s*${label}[^|]*\\|\\s*([^|]+)\\|`, "m");
  return re.exec(README)?.[1]?.trim() ?? null;
}

describe("README 技术栈表", () => {
  it("① 表里的主版本与 package.json 一致", () => {
    /*
     * label 是表里那一格的开头文本,dep 是 package.json 的键 —— 两者不必同名
     * (表里写「Vue 3」,键是 `vue`)。
     */
    const pairs: { label: string; dep: string }[] = [
      { label: "Vue", dep: "vue" },
      { label: "TypeScript", dep: "typescript" },
      { label: "Pinia", dep: "pinia" },
      { label: "Tailwind CSS", dep: "tailwindcss" },
      { label: "Vue Router", dep: "vue-router" },
      { label: "Tone\\.js", dep: "tone" },
      { label: "CryptoJS", dep: "crypto-js" },
      /*
       * Electron 与 Capacitor 在**同一行**:`| Electron / Capacitor | 44 / 8 |`。
       * 故这一对单独验,版本格按 `/` 拆成两段。
       */
    ];
    const wrong: string[] = [];
    for (const { label, dep } of pairs) {
      const cell = tableRow(label);
      expect(cell, `技术栈表里找不到「${label}」那一行`).not.toBeNull();
      const declared = majorOf(cell!);
      expect(declared, `「${label}」那行的版本格读不出主版本:${cell}`).not.toBeNull();

      const depSpec = DEPS[dep];
      expect(depSpec, `package.json 里找不到依赖 ${dep}`).toBeDefined();
      const actual = majorOf(depSpec!);
      if (declared !== actual) {
        wrong.push(`${label}:README 写 ${declared},package.json 是 ${depSpec}`);
      }
    }
    /*
     * Electron 与 Capacitor 共用一行,版本格是 `44 / 8` —— 拆开各自比。
     */
    const bothRow = tableRow("Electron");
    expect(bothRow, "技术栈表里找不到 Electron / Capacitor 那一行").not.toBeNull();
    const parts = bothRow!.split("/").map((x) => x.trim());
    expect(parts.length, "Electron / Capacitor 那一行不再是一行两版").toBe(2);
    const pairs2: { name: string; cell: string; dep: string }[] = [
      { name: "Electron", cell: parts[0]!, dep: "electron" },
      { name: "Capacitor", cell: parts[1]!, dep: "@capacitor/core" },
    ];
    for (const { name, cell, dep } of pairs2) {
      const declared = majorOf(cell);
      const actual = majorOf(DEPS[dep]!);
      if (declared !== actual) wrong.push(`${name}:README 写 ${declared},实际 ${DEPS[dep]}`);
    }

    expect(
      wrong,
      "README 的技术栈表与 package.json 对不上 —— 门面停在了旧版本上:" + wrong.join("、"),
    ).toEqual([]);
  });

  it("② catalog / 间接依赖的那几项,表里要说明它是怎么来的", () => {
    /*
     * `vite` 与 `vite-plus` 走的是 Bun 的 catalog(`"vite": "catalog:"`)。
     * 若 README 只写「Vite | 8」,读者会以为仓库直接依赖 vite@8 —— 而实际是
     * `vite-plus-core` 捆进来的。故这两行必须在说明栏里提一句。
     */
    const viteRow = README.split("\n").find((l) => /^\|\s*Vite\s*\|/.test(l));
    expect(viteRow, "技术栈表里找不到 Vite 那一行").toBeDefined();
    expect(
      /vite-plus|catalog|捆绑|经 Vite\+/.test(viteRow!),
      "Vite 那一行没说明它是经 Vite+ 提供的 —— 读者会以为仓库直接依赖 vite@8",
    ).toBe(true);

    // 反向:package.json 里 vite 确实不经直接声明
    expect(
      PKG.catalog?.["vite"] ?? DEPS["vite"],
      "vite 的依赖形态变了 —— 这条判据的前提要重看",
    ).toBeDefined();
  });

  it("③ README 里声明的 spec 规模与真实文件数一致", () => {
    /*
     * 这一条 `docs-check` 已经守着(它核对「全量 N 个 spec」),这里只做一个**交叉确认**:
     * 若哪天有人改了那一句而 docs-check 的匹配式没跟上,这条会红。
     */
    const all = /\*\*全量 ([\d,]+) 个 spec/.exec(README) ?? /全量 ([\d,]+) 个 spec/.exec(README);
    expect(all, "README 里找不到「全量 N 个 spec」").not.toBeNull();
    expect(Number(all![1]!.replace(/,/g, "")), "spec 总数不是正数").toBeGreaterThan(100);
  });

  it("④ 运行时策略那一节的三个角色都还在", () => {
    /*
     * 「Bun / Node / 浏览器各管一段」那节解释了一个容易被误读的组合:
     * `engines.node >= 24` 与 `packageManager: bun@1.4.3` 并存不矛盾。
     * 那两个字段若哪天变了,这一节的说法也要跟着变。
     */
    expect(PKG.packageManager, "packageManager 不见了").toMatch(/^bun@\d+\.\d+\.\d+$/);
    /*
     * README 的写法是 `[Bun](https://bun.sh) 1.4.3` —— 链接标签与版本号之间隔着 markdown,
     * 故不查「Bun 1」这种连写,改查**完整版本号**是否出现(它比主版本更严格)。
     */
    const bunVer = /bun@(\d+\.\d+\.\d+)/.exec(PKG.packageManager!)![1]!;
    expect(README, `README 里没写 Bun ${bunVer}`).toContain(bunVer);

    expect(PKG.engines?.node, "engines.node 不见了").toBeDefined();
    const nodeMajor = /(\d+)/.exec(PKG.engines!.node!)![1]!;
    expect(README, `README 里没写 Node ≥ ${nodeMajor}`).toMatch(
      new RegExp(`Node[^\\n]{0,6}${nodeMajor}`),
    );

    expect(README, "运行时策略那一节不见了").toContain("## 运行时策略");
  });

  it("反空转:README 读得到,技术栈表真的存在", () => {
    expect(README.length, "README 太短").toBeGreaterThan(3000);
    expect(README, "找不到技术栈那一节").toContain("## 技术栈");
    const rows = README.split("\n").filter((l) => /^\|\s*[A-Z]/.test(l) && /\|/.test(l));
    expect(rows.length, "技术栈表一行都没解析出来").toBeGreaterThan(5);
  });
});
