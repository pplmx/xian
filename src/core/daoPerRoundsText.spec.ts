/**
 * 「每五回合得一印」—— `perRounds` 这条规则必须在章法里说出来。
 *
 * ## 由来（第 169 轮）
 *
 * 长生道的 `rules` 里有一项 `perRounds`:
 *
 * ```ts
 * perRounds: { interval: 5, playerHealPct: 0.04, playerShieldPct: 0.04, enemyAtkGrowth: 0.06 }
 * ```
 *
 * 它是这条道途**最核心的机制** —— 每五回合回一次气血、凝一次护盾，同时敌方攻击
 * 也涨一次。「长生不怕鏖战，最怕爆发」这句定性的话，靠的就是这个数。
 *
 * 而 `daoPathCoverage.spec` 已有的两条判据:
 *
 * - 「章法里每个百分数都能在该道途的数值里找到」 —— 守的是 `<pct>%`;
 * - 「中文数词承诺也要核」 —— 守的是「至多 N 层」那类**层数**承诺。
 *
 * 两条都不管 `interval`。它是**回合数**，既不是百分数也不是层数。
 * 实测 `longevity` 的章法里写着「每五回合得一印」—— 用的是中文数词「五」，
 * 而判据若写成 `每\s*5\s*回合` 就永远匹配不到。
 *
 * ## 这条判据守什么
 *
 * 不守「文案长什么样」，守**「这个数必须出现在章法里」**：
 * 把 `interval` 从 5 改成 4，章法若还写「五」，玩家据以选路的字就撒谎了。
 *
 * 数字与中文数词都要认 —— 这不是宽容，是这一页真实的写法（全站章法走中文数词）。
 */
import { describe, expect, it } from "vite-plus/test";
import { DAO_PATHS } from "@/data/endgame";

/** 0~99 的中文数词 —— 章法里写的是「五」而不是「5」 */
const CN_DIGITS = ["零", "一", "二", "三", "四", "五", "六", "七", "八", "九"];

function cnNumber(n: number): string | null {
  if (!Number.isInteger(n) || n < 0 || n > 99) return null;
  if (n < 10) return CN_DIGITS[n]!;
  const tens = Math.floor(n / 10);
  const ones = n % 10;
  return `${tens === 1 ? "" : CN_DIGITS[tens]}十${ones === 0 ? "" : CN_DIGITS[ones]}`;
}

describe("道途章法 · perRounds 的回合数必须说出来", () => {
  it("每一条带 perRounds 的道途，章法里都点明了那个回合间隔", () => {
    const missing: string[] = [];
    let checked = 0;
    for (const path of DAO_PATHS) {
      const per = path.rules?.perRounds;
      if (!per) continue;
      checked += 1;
      const n = per.interval;
      const arabic = new RegExp(`每\\s*${n}\\s*回合`);
      const chinese = cnNumber(n);
      const cnHit = chinese ? new RegExp(`每\\s*${chinese}\\s*回合`) : null;
      const text = [...path.ruleText, ...path.deepText].join(" ");
      if (!arabic.test(text) && !(cnHit && cnHit.test(text))) {
        missing.push(`${path.name}: 章法里没有「每${n}回合」（阿拉伯数字或中文数词都行）`);
      }
    }
    expect(checked, "没有任何道途带 perRounds —— 判据空转").toBeGreaterThan(0);
    expect(
      missing,
      "perRounds 是这条道途最核心的机制，章法却不提它 —— 玩家据以选路的字少了一半",
    ).toEqual([]);
  });

  it("中文数词转换本身是对的（判据自己的地基）", () => {
    // 这一层若错了，上一条会静默放过所有中文写法
    expect(cnNumber(3)).toBe("三");
    expect(cnNumber(5)).toBe("五");
    expect(cnNumber(10)).toBe("十");
    expect(cnNumber(12)).toBe("十二");
    expect(cnNumber(20)).toBe("二十");
    expect(cnNumber(35)).toBe("三十五");
    expect(cnNumber(-1), "越界返回 null，不编一个假的").toBeNull();
  });

  it("实测:长生道的章法确实写着「每五回合」", () => {
    const longevity = DAO_PATHS.find((d) => d.id === "longevity")!;
    expect(longevity.rules?.perRounds?.interval, "间隔仍是 5").toBe(5);
    const text = [...longevity.ruleText, ...longevity.deepText].join(" ");
    expect(text, "章法要说到这个间隔").toMatch(/每\s*五?\s*回合/);
  });
});
