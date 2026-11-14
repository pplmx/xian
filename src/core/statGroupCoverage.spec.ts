/**
 * 人物页的属性分组，要把 `AnyStatKey` 的每一个键都摆出来。
 *
 * ## 由来（第 232 轮，查「玩家能发现吗」）
 *
 * 人物页有一份 `STAT_GROUPS`（`ui/characterDesk`），把词条折成四组:
 * 修行 / 历练 / 斗法 / 技艺。它列出 **39 个**键。
 *
 * 而 `AnyStatKey = PercentStatKey | SpecialKey` 一共 **45 个**。差六个:
 *
 * ```text
 * alchemyYield    炼丹双成率      useBrewing / engineCraft 在用
 * craftExpGain    炼丹心得        useBrewing / pillService 在用
 * craftSalvage    定心护料        useBrewing / engineCraft 在用
 * forgeDiscount   炼器省耗        forge / salvage 在用
 * qiCapPct        灵气上限        buffs / fruitOutlets 在用
 * beastPct        灵兽属性效果    affixes / buffs 在用
 * ```
 *
 * **六个全都在生效**（不是死词条），六条中文名也都在 `data/statNames` 里，
 * 而在任何 `.vue` 里都搜不到 —— 也就是说玩家拿到这些词条之后，
 * **界面上一个字都看不到它**。
 *
 * ## 为什么这算缺陷
 *
 * 这一仓的纪律里有一条:
 *
 * > **让看不见的机制可见**:技艺进度、buff 叠加份数、合并真值、一次服药的上限
 * > —— 该露的都要露进界面，不许只活在注释或 README 里。
 *
 * 而「灵气上限」「炼丹双成率」「炼器省耗」这三样，玩家是会主动去堆的:
 * 堆了半天，人物页上找不到它，只能凭感觉。
 *
 * ## 这条判据守什么
 *
 * `AnyStatKey` 的每个键都必须出现在 `STAT_GROUPS` 的某个 `keys` 里。
 * 新增一个词条而不给它分组，会立刻红。
 *
 * ## 一次自己造成的误判（第二十六次）
 *
 * 第一版的 `listedKeys()` 只认多行数组（`^\s{6}"(\w+)",$`），而「百艺」那一组是
 * **单行六键**（`keys: ["alchemyYield", …]`）—— 整组被漏掉，判据于是报出六个
 * 「没去处」的词条。**它们本来就在那儿。**
 *
 * 改成按 `keys: [...]` 整段取引号里的名字（两种写法通吃）才对。
 *
 * ## 故障注入
 *
 * 往 `SpecialKey` 里加一个 `"probeStat"` → 第二条红，点名它。
 */
import { describe, expect, it } from "vite-plus/test";
import { readSource } from "@/test/readSource";
import { stripComments } from "@/test/stripComments";

/** 从某个 `type X = "a" | "b"` 里取出全部字面量 */
function literalUnion(src: string, name: string): string[] {
  const at = src.indexOf(`type ${name}`);
  if (at < 0) return [];
  const end = src.indexOf(";", at);
  return [...src.slice(at, end).matchAll(/"(\w+)"/g)].map((m) => m[1]!);
}

/**
 * 从 `STAT_GROUPS` 里取出被列进各组 `keys` 的全部键。
 *
 * **两种写法都要认**：`keys` 可以写成多行（每行一个）也可以写成单行数组。
 * 第一版只匹配多行的 `^\s{6}"(\w+)",$`，于是把「百艺」那一组（单行六个键）
 * 整组漏掉了 —— 判据因此报出六个「没去处」的词条，而它们其实就在那儿。
 */
function listedKeys(desk: string): string[] {
  const out: string[] = [];
  for (const m of desk.matchAll(/keys:\s*\[([\s\S]*?)\]/g)) {
    for (const k of m[1]!.matchAll(/"(\w+)"/g)) out.push(k[1]!);
  }
  return out;
}

describe("人物页 · 每一个词条都要有去处", () => {
  it("扫到了足够多的词条与分组（防空转）", () => {
    const types = stripComments(readSource("src/types/index.ts"));
    const keys = new Set([
      ...literalUnion(types, "PercentStatKey"),
      ...literalUnion(types, "SpecialKey"),
    ]);
    expect(keys.size, "`AnyStatKey` 的键太少 —— 扫错地方了").toBeGreaterThan(30);
    expect(listedKeys(stripComments(readSource("src/ui/characterDesk.ts"))).length).toBeGreaterThan(
      20,
    );
  });

  it("`AnyStatKey` 的每个键都在某个分组里", () => {
    const types = stripComments(readSource("src/types/index.ts"));
    const all = new Set([
      ...literalUnion(types, "PercentStatKey"),
      ...literalUnion(types, "SpecialKey"),
    ]);
    const listed = new Set(listedKeys(stripComments(readSource("src/ui/characterDesk.ts"))));
    const missing = [...all].filter((k) => !listed.has(k));
    expect(
      missing,
      "这些词条会生效，却没有出现在人物页的任何分组里 —— 玩家拿到它之后在界面上看不见。" +
        "（这一仓的纪律：「该露的都要露进界面，不许只活在注释里」）:" +
        missing.join(" / "),
    ).toEqual([]);
  });

  it("每个列出来的键都有中文名（否则面板上会露出英文键名）", () => {
    const names = stripComments(readSource("src/data/statNames.ts"));
    const listed = listedKeys(stripComments(readSource("src/ui/characterDesk.ts")));
    const unnamed = listed.filter((k) => !new RegExp(`^\\s{2}${k}\\s*:`, "m").test(names));
    expect(unnamed, "这些键没有中文名 —— 面板上会露出英文键名:" + unnamed.join(" / ")).toEqual([]);
  });
});
