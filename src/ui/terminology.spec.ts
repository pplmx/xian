/**
 * 术语一致性 —— 同一个东西,全仓不该有两个叫法。
 *
 * ## 缺口(第 128 轮实测)
 *
 * 「找不对称」这条线走到第三轮时想到:前两轮比的是**同一屏上的两处**(技艺的道、
 * 丹药与 buff 的 desc),这轮该比的是**同一概念的两种叫法**。
 *
 * 扫下来两处:
 *
 * ```text
 *   草药   只有 1 处 —— MarketView.vue 的注释,而界面一律叫「灵草」
 *   灵宠   有 11 处 —— 全在注释里,而界面一律叫「灵兽」(270 处)
 * ```
 *
 * 两处都是**注释与界面用词不一致**。注释不给玩家看,但它给下一个改代码的人看:
 * 照着注释搜「草药」会一无所获,照着它写新文案会写出「灵宠」。
 *
 * 已统一成「灵草」「灵兽」。
 *
 * ## 判据
 *
 * 只钉**已经发现过异名的那两组**,不试图做全量同义词识别(那不可判定)。
 *
 * ① 全仓(源码 + 文档)不许出现「草药」;
 * ② 「灵宠」只在它确实指另一件事时允许 —— 目前它不指任何别的事,故一律不许。
 *
 * ② 留一个白名单:若将来真有需要区分的一天,把那个文件加进 `ALLOW` 并写明理由。
 * 空白名单本身也是判据的一部分 —— **加白名单要留下痕迹**,不能悄悄加。
 */
import { describe, expect, it } from "vite-plus/test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { ROOT } from "@/test/readSource";

/** 「灵宠」允许出现的文件(目前为空,理由见下) */
const ALLOW: readonly string[] = [];

/** 收集源码与文档 */
function texts(): { file: string; text: string }[] {
  const out: { file: string; text: string }[] = [];
  const walk = (d: string, accept: (n: string) => boolean): void => {
    for (const entry of readdirSync(d, { withFileTypes: true })) {
      if (entry.name === "node_modules" || entry.name === "tp" || entry.name === "dist") continue;
      const full = join(d, entry.name);
      if (entry.isDirectory()) {
        walk(full, accept);
        continue;
      }
      if (!accept(entry.name)) continue;
      out.push({
        file: full.replace(ROOT, "").replace(/^\/+/, ""),
        text: readFileSync(full, "utf8"),
      });
    }
  };
  walk(join(ROOT, "src"), (n) => /\.(ts|vue|css)$/.test(n) && !n.endsWith("terminology.spec.ts"));
  /*
   * 文档只扫**规范性**那几份,跳过编年史。
   *
   * `development.md` 会为了记录一次术语统一而写下「草药」「灵宠」——
   * 那是历史事实,不该被当成现状。第 107 轮与第 109 轮都在这里栽过:
   * 判据扫到了「记录这个错误的文字本身」。
   */
  walk(join(ROOT, "docs"), (n) => n.endsWith(".md") && n !== "development.md");
  return out;
}

describe("术语一致性", () => {
  it("① 全仓不许出现「草药」—— 界面一律叫「灵草」", () => {
    const bad: string[] = [];
    for (const { file, text } of texts()) {
      const n = (text.match(/草药/g) ?? []).length;
      if (n > 0) bad.push(`${file}(${n} 处)`);
    }
    expect(
      bad,
      "「草药」与界面用的「灵草」是同一个东西的两个叫法 —— 照注释搜「草药」会一无所获:" +
        bad.join("、"),
    ).toEqual([]);

    // 反向:确认「灵草」真的在用,否则这条判据可能只是在守一个空概念
    const herbCount = texts().reduce((n, t) => n + (t.text.match(/灵草/g) ?? []).length, 0);
    expect(herbCount, "全仓找不到「灵草」—— 术语换名了,这条判据要跟着改").toBeGreaterThan(20);
  });

  it("② 「灵宠」不许出现 —— 界面一律叫「灵兽」", () => {
    const bad: string[] = [];
    for (const { file, text } of texts()) {
      if (ALLOW.includes(file)) continue;
      const n = (text.match(/灵宠/g) ?? []).length;
      if (n > 0) bad.push(`${file}(${n} 处)`);
    }
    expect(
      bad,
      "「灵宠」与界面用的「灵兽」是同一个东西的两个叫法:" +
        bad.join("、") +
        "。若某处确实指别的东西,把它加进 ALLOW 并写明理由",
    ).toEqual([]);

    const petCount = texts().reduce((n, t) => n + (t.text.match(/灵兽/g) ?? []).length, 0);
    expect(petCount, "全仓找不到「灵兽」").toBeGreaterThan(100);
  });

  it("③ 白名单里的每一项都必须真的有「灵宠」—— 空挂的白名单是假的记录", () => {
    /*
     * 白名单若写着某个文件、而那个文件里其实没有「灵宠」,
     * 说明它已经不需要豁免了(或从来就不需要) —— 那是一条假记录,要删掉。
     */
    const byFile = new Map(texts().map((t) => [t.file, t.text]));
    for (const file of ALLOW) {
      const text = byFile.get(file);
      expect(text, `白名单里的 ${file} 不存在`).toBeDefined();
      expect(text!.includes("灵宠"), `白名单里的 ${file} 其实没有「灵宠」—— 这条豁免该删了`).toBe(
        true,
      );
    }
  });

  it("反空转:真的扫到了源码与文档", () => {
    const all = texts();
    expect(
      all.filter((t) => t.file.startsWith("src/")).length,
      "一个源码文件都没扫到",
    ).toBeGreaterThan(300);
    expect(
      all.filter((t) => t.file.startsWith("docs/")).length,
      "一份文档都没扫到",
    ).toBeGreaterThan(5);
  });
});
