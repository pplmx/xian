/**
 * 术语一致性 —— 「品质」与「品阶」是本仓两个不同的东西。
 *
 * ## 两者各指什么
 *
 * ```text
 *   quality    凡品→神品,rank 0~8   装备 / 法宝 / 灵兽 / 功法共用   → 称「品质」
 *   品阶       朦胧→化真,六阶         器魂的 SOUL_GRADES            → 称「品阶」
 * ```
 *
 * `data/souls.ts` 把这件事说得很清楚:「器魂品阶(六阶)。装备品质 rank 0~8 映射到此」。
 * 代码里也分得干净:`quality` / `SOUL_GRADES`。
 *
 * ## 但中文译文混了
 *
 * 第 83 轮扫全仓发现:`品阶` 141 次 / `品质` 147 次,而且同一段里时常混用:
 *
 * ```text
 *   data/pets.ts     「品阶纪律:品质更高,总词条预算…」  ← 同一句两个词指一件事
 *   core/notify.ts   「品阶印的载荷 —— 只带品质 id」        ← 印叫「品阶」,载荷叫「品质」
 *   docs/usage.md    「品阶印…色与单字都取自品质表」        ← 同上
 *   core/qualityPeak 「法宝、灵兽、功法各有品阶」           ← 它们的字段是 quality
 * ```
 *
 * 已统一:`quality` 一律称「品质」,「品阶」只留给器魂。
 *
 * ## 判据
 *
 * 扫 `src/` 与 `docs/` 的中文文本,找**同一行里两个词同时出现**的地方。
 * 允许白名单:那里确实在对比两个概念(如 `souls.ts` 的映射说明)。
 *
 * 这条不会判断「用词对不对」——它判断「有没有人在一句话里把两件事混成一件」。
 */
import { describe, expect, it } from "vite-plus/test";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { ROOT } from "@/test/readSource";

/**
 * 允许两个词同行的位置 —— 那里**确实在对比**这两个概念。
 *
 * 加进来的每一条都要说明为什么;不是「这里红了就加进来」。
 */
const ALLOWED: readonly { file: string; why: string }[] = [
  { file: "src/data/souls.ts", why: "器魂品阶与装备品质的映射说明,本来就要同时提两个词" },
  { file: "src/data/pets.ts", why: "注释末尾专门解释两者区别,同时出现是对的" },
  { file: "src/core/terminologyConsistency.spec.ts", why: "本文件自身" },
  { file: "src/core/notify.ts", why: "注释里点名「品质 vs 品阶」的区别,是在立规矩" },
  { file: "src/core/soulForge.ts", why: "「品阶由品质决定」——器魂阶由装备品质映射,必须同时提" },
  { file: "src/core/souls.spec.ts", why: "器魂品阶跨度与装备品质跨度对比读数" },
  {
    file: "src/data/artifacts.ts",
    why: "「品质倍率」与 `ARTIFACT_QUALITY_EXP` 的注释里对照了 quality",
  },
  {
    file: "docs/usage.md",
    why: "术语说明段,写的是「原先叫品阶印而正文写品质表」——在讲这段历史",
  },
  { file: "docs/design.md", why: "品质章里两处都在说明「品质不是装备独有」,要与器魂品阶对照" },
  { file: "docs/development.md", why: "开发笔记记录这次术语统一的来龙去脉" },
];

/** 递归收集 .ts / .vue / .md */
function collect(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name === "tp") continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) collect(full, out);
    else if (/\.(ts|vue|md)$/.test(entry.name)) out.push(full);
  }
  return out;
}

describe("术语 · 品质与品阶不许一句话里混用", () => {
  it("没有哪一行同时提「品质」和「品阶」(白名单除外)", () => {
    const files = [...collect(join(ROOT, "src")), ...collect(join(ROOT, "docs"))];
    expect(files.length, "一个文件都没扫到 —— 路径变了").toBeGreaterThan(100);

    const allowed = new Set(ALLOWED.map((a) => a.file));
    const offenders: string[] = [];
    for (const full of files) {
      const rel = full.slice(ROOT.length + 1);
      if (allowed.has(rel)) continue;
      // 跳过 spec 文件里被本判据点名的历史说明
      const lines = readFileSync(full, "utf8").split("\n");
      for (let i = 0; i < lines.length; i += 1) {
        const line = lines[i]!;
        if (line.includes("品阶") && line.includes("品质")) {
          offenders.push(`${rel}:${i + 1} ${line.trim().slice(0, 60)}`);
        }
      }
    }
    expect(
      offenders,
      "这些行同时提「品质」与「品阶」—— 若在说同一件事就是混用,若真在对比请加进 ALLOWED:" +
        offenders.slice(0, 6).join(" / "),
    ).toEqual([]);
  });

  it("反空转:两个词都真的在仓库里出现过", () => {
    /*
     * 若哪天全仓统一成了单一名词(比如把器魂那六阶改名),这条判据就失去意义了。
     * 那时它会红,提醒重写 —— 而不是悄悄通过。
     */
    const all = collect(join(ROOT, "src"))
      .map((f) => readFileSync(f, "utf8"))
      .join("\n");
    expect(all.includes("品质"), "仓库里一次「品质」都没有了 —— 判据在空转").toBe(true);
    expect(all.includes("品阶"), "仓库里一次「品阶」都没有了 —— 判据在空转").toBe(true);
  });

  it("白名单里的文件都还在", () => {
    // 防「文件改名了,白名单条目变成永不放行的死条目」
    for (const { file, why } of ALLOWED) {
      const text = readFileSync(join(ROOT, file), "utf8");
      expect(text.length, `白名单里的 ${file} 是空的(${why})`).toBeGreaterThan(0);
    }
  });
});
