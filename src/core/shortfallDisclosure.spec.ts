/**
 * 付不起的按钮必须报出**还差多少**。
 *
 * ## 规矩出自哪里
 *
 * `AGENTS.md` 的「改动纪律」写着:
 *
 * > **决策信息完整**:按钮「付不起 / 不可行」要置灰,灰的同时把差多少列出来
 * > (尚差 灵石 X · 尘 Y);给决策前把数字摊开……
 *
 * 这条规矩说得明白,而它**此前没有任何判据在守**。
 *
 * ## 缺口是什么(第 84 轮实测)
 *
 * `EquipmentDetailDialog` 页脚的「强 化」钮灰着的时候,`upCost` 只在 `v-if` 里
 * 用过一次 —— **从来没进过玩家视野**。注释说「主文的价签在 `EquipUpgradePanel`」,
 * 但那块面板在另一个页面;玩家在详情弹窗里按下这个灰按钮时,只看得到「不许」。
 *
 * 已补 `title`(与 `EquipSealPanel` 的封存钮同一写法:能付就不显示,付不起才报)。
 *
 * ## 判据
 *
 * 扫所有 `.vue`,找 `:disabled` 表达式里带**资源判定语义**
 * (`affordable` / `canPay` / `enough` / `afford`)的按钮,
 * 要求同一个 `<button>` 标签内或紧邻的上下文中出现 `title` / `aria-label` / `尚差` / `还差`。
 *
 * ## 这是**结构性判据**,不是数值判据
 *
 * 它不判断「差多少算合理」,只判断「有没有说出差多少」。
 * 所以它不会因为调数值而红 —— 只会在有人新加一个灰按钮而不写理由时红。
 */
import { describe, expect, it } from "vite-plus/test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { ROOT } from "@/test/readSource";

/**
 * 已知不需要报差额的按钮 —— 它们灰掉的原因是**结构性**的,不是资源不足。
 *
 * - `上一程` / `下一程`:第一程没有上一步,是导航边界,旁边已有「第 N / M 程」读数
 */
const STRUCTURAL_DISABLE = new Set([
  "currentChallengeStepIndex === 0",
  "currentChallengeStepIndex === CHALLENGE_STEPS.length - 1",
]);

function collectVue(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name === "tp") continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) collectVue(full, out);
    else if (entry.name.endsWith(".vue")) out.push(full);
  }
  return out;
}

describe("付不起的按钮 · 必须报出还差多少", () => {
  it("带资源判定的 :disabled 按钮都有差额说明", () => {
    const files = [
      ...collectVue(join(ROOT, "src/components")),
      ...collectVue(join(ROOT, "src/views")),
    ];
    expect(files.length, "一个 .vue 都没扫到 —— 路径变了").toBeGreaterThan(80);

    const bare: string[] = [];
    let checked = 0;
    for (const full of files) {
      const rel = full.slice(ROOT.length + 1);
      const src = readFileSync(full, "utf8");
      for (const m of src.matchAll(/<button\b[^>]*:disabled="([^"]+)"[^>]*>/g)) {
        const expr = m[1]!;
        /*
         * 只看「付不起 / 装不下」这一类 —— 结构性禁用(如「上一程」)不算。
         *
         * ## 词表原来只有一半（第 401 轮）
         *
         * 原先只认 `afford|canPay|enough` 三个词。而仓里表达同一件事的写法还有:
         *
         * ```text
         *   r.shortHerb || r.shortStone      （BrewingDialog 的「炼制」）
         *   stoneShort > 0 / daoShort > 0    （FurnaceDialog / ExpeditionPanel）
         *   currentPillOverflow === 'full'   （InventoryView 的「服用」）
         *   !row.affordable10                （HerbShopDialog 的「买 10」）
         * ```
         *
         * 这些按钮当时**每一条都有说明**（「尚差 N 石」「药力已顶满——这一颗将白费」
         * 「· 灵草坊可补 ›」），但它们从来没被这条判据看过一眼 ——
         * 一旦哪天有人删掉那些说明，这里不会红。
         *
         * 故把词表补全。**宁可粗,不要漏**:这一层要回答的是「这类按钮有没有被看过」,
         * 至于说明写在哪一处，下面那段 ±1500 的窗口负责。
         */
        if (!/(afford|canPay|enough|short|overflow|full)/i.test(expr)) continue;
        if (STRUCTURAL_DISABLE.has(expr)) continue;
        checked += 1;

        /*
         * 说明可能在三处:
         * ① 同一 <button> 标签内(title / aria-label)
         * ② 按钮内部的插值文案(如 payText(r) —— SecretRealmCard 就是这种)
         * ③ 按钮所在区块的相邻行(如 AffixTransferPanel 在上方报「尚差 器灵尘」)
         *
         * 窗口取 ±2000 字。第一版用 ±900,误报了四处(`ArtifactPanel` / `HerbShopDialog`
         * / `SoulsView`),它们其实都把差额写在按钮块**上方**的一个信息行里 ——
         * 那是 Volar 模板里一个 `<p>` 到 `<button>` 的正常距离。
         *
         * 再宽就会把整个文件都算进去,反而失去意义(任何文件都含有「尚差」)。
         */
        const at = m.index ?? 0;
        const near = src.slice(Math.max(0, at - 1500), at + 2000);
        if (/尚差|还差|shortfall|shortText|payText|title=|aria-label/.test(near)) continue;
        bare.push(`${rel}: :disabled="${expr}"`);
      }
    }

    /*
     * 防空转:真的量到了资源型按钮。
     *
     * 阈值从 8 提到 14 —— 第 401 轮补全词表后实测从 11 涨到 18(多看到 7 个
     * 用 `short` / `overflow` / `full` 表达的按钮)。取 14 是为了留一点余量:
     * 若哪天有人把词表改回去,checked 会掉回 11 附近,这里立刻红。
     */
    expect(checked, "量到的资源型禁用按钮太少 —— 词表被改窄了(补全后实测 18 个)").toBeGreaterThan(
      14,
    );

    expect(
      bare,
      "这些按钮付不起时只说不许、不说差多少 —— 补 title / aria-label / 邻近读数:" +
        bare.join(" / "),
    ).toEqual([]);
  });

  it("反空转:确实扫到了带差额说明的按钮", () => {
    /*
     * 若哪天所有人都把差额说明删了,上面那条会红;但若说明全改成了别的措辞,
     * 上面那条也会红(假阳性)。这条用「至少有几处真的在报差」来确认
     * 词表还没过期。
     */
    const all = [
      ...collectVue(join(ROOT, "src/components")),
      ...collectVue(join(ROOT, "src/views")),
    ]
      .map((f) => readFileSync(f, "utf8"))
      .join("\n");
    const hits = (all.match(/尚差/g) ?? []).length;
    expect(hits, "全仓一次「尚差」都没有了 —— 上面那条的词表该重写").toBeGreaterThan(5);
  });
});
