/**
 * 类型检查的配置守卫 —— 「增量到底有没有生效」这件事没人看着。
 *
 * ## 本轮踩到的事
 *
 * `bun run build` 是 `vue-tsc -b && vp build`。实测它要 25 秒,而拆开看是
 * 类型检查 16.4s + 构建 9.9s —— 类型检查反而是大头。
 *
 * 更糟的是**它每次都是全量**:清掉 `tsbuildinfo` 后连跑两次 `vue-tsc -b`,
 * 16.71s / 16.59s,一分没省。原因是 `tsconfig.app.json` 缺 `composite: true`:
 * `-b` 模式的增量依赖这个开关,缺了它 `tsbuildinfo` 只存文件清单(不含检查结果),
 * 于是每次都重算同一批 1100 个文件。
 *
 * 补上之后:17.8s(首次)/ 1.68s / 1.67s —— 快 10 倍。类型错误照旧检得出来。
 *
 * ## 判据守什么
 *
 * ① `tsconfig.app.json` 必须有 `composite: true`(删了就是静默退回全量);
 * ② 根 `tsconfig.json` 必须用项目引用(`-b` 才有目标可建);
 * ③ spec 里 import 的夹具目录必须在 `include` 里 —— `composite` 会严格化文件清单,
 *    漏一个就报 TS6307 而不是"悄悄不管"(本轮就是这么发现 `scripts/lib` 漏了的)。
 *
 * 这几条都**不会**让 type-check 本身变红,只会让它悄悄变慢或悄悄漏检,
 * 故必须单独钉住。
 */
import { describe, expect, it } from "vite-plus/test";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";

const ROOT = resolve(__dirname, "../..");
const APP = readFileSync(join(ROOT, "tsconfig.app.json"), "utf8");
const ROOT_CFG = readFileSync(join(ROOT, "tsconfig.json"), "utf8");

describe("类型检查配置 · 增量要真的生效", () => {
  it("tsconfig.app.json 开着 composite —— 缺了它 -b 只是「每次全量」", () => {
    // 只认未注释的那一行:`/* composite: true */` 之类不算
    const live = APP.split("\n")
      .map((l) => l.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/, ""))
      .join("\n");
    expect(live, "composite 被删了 —— vue-tsc -b 会退回每次全量(实测 16.6s → 1.68s)").toMatch(
      /"composite"\s*:\s*true/,
    );
  });

  it("根 tsconfig 用项目引用 —— -b 得有目标可建", () => {
    expect(ROOT_CFG, "根 tsconfig 不再用 references").toContain("references");
    expect(ROOT_CFG, "没有指向 tsconfig.app.json").toContain("tsconfig.app.json");
  });

  it("spec 里 import 的夹具目录在 include 里", () => {
    /*
     * `composite` 要求「项目必须列出所有文件」,故实现上它自己会报 TS6307 ——
     * 这条判据的价值是**在更快的地方**给出同样的结论(不用等 17 秒的类型检查),
     * 并且指名该往 include 里加什么。
     */
    const fixtures = APP.split("scripts/lib").length > 1;
    expect(fixtures, "include 里少了 scripts/lib —— spec 引用的夹具不进编译单元").toBe(true);
  });
});
