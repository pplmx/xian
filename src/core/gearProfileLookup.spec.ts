/**
 * 装备档位查不到时**抛错**，不静默退回默认档。
 *
 * ## 这个缺口是第 396 轮我自己踩出来的
 *
 * `inflationAudit.gearProfile(id)` 原先是：
 *
 * ```ts
 * return GEAR_PROFILES.find((p) => p.id === id) ?? GEAR_PROFILES[1]!;
 * ```
 *
 * 我拿三个想当然的 id（`poor` / `mid` / `rich`）跑 `contentCoverageAudit`，
 * 得到三行**逐位相同**的输出：
 *
 * ```text
 *   [poor] 死亡点 境-1
 *     境0:100% 境1:80% 境2:86% …
 *   [mid]  死亡点 境-1
 *     境0:100% 境1:80% 境2:86% …      ← 一字不差
 *   [rich] 死亡点 境-1
 *     境0:100% 境1:80% 境2:86% …
 * ```
 *
 * 我据此写下「贫穷与富裕装备下压制率完全一样 —— 这显然不对」，差点把它当缺陷。
 * 真正的原因：**三次都退回了同一个默认档**。真实 id 是
 * `casual` / `typical` / `optimized`。
 *
 * ## 它为什么是这一族里最该修的一个
 *
 * `AGENTS.md` 点过这一族的名字：
 *
 * ```text
 *   一个「键」没有类型约束（裸 string）
 *   + 一条查不到时的兜底（?? 默认值）
 *   = 配错了不会报错，只会静默地少一件事
 * ```
 *
 * 而这个函数的返回值决定「**玩家穿什么装备**」这个口径 —— 整个膨胀审计的
 * 每一条结论都建立在这一个参数上。它静默退到「常规」，意味着一个写错的调用
 * 会照着另一个档位出数，**而读数的人以为自己在看别的档**。
 *
 * 更麻烦的是它的失败**看起来像产品结论**：不同档位出同一组数，读起来是
 * 「装备投入没有区别」，而不是「你参数写错了」。我自己就被它骗了十几分钟。
 *
 * ## 判据守什么
 *
 * ① 三个真实 id 都取得到；
 * ② 不存在的 id **抛错**，且错误里点出现有 id（不给还得回去翻源码的错）；
 * ③ 三个档位取到的确实是**不同的对象** —— 这一条防的是「都指向同一个档」这种
 *    更隐蔽的坏法（比如有人把 find 改成 `[0]`）；
 * ④ 三个档位在审计读数上确实**分得开** —— 这一条直接对应我踩的那一坑：
 *    若三档真的出同一组数，那么无论 id 对不对，这个档位维度都是死的。
 */
import { describe, expect, it } from "vite-plus/test";
import { GEAR_PROFILES, contentCoverageAudit, gearProfile, modelPlayer } from "./inflationAudit";
import { toNum } from "@/utils/gnum";

describe("装备档位 · 查不到就抛，不静默退回默认", () => {
  it("三个真实 id 都取得到，且取到的是各自那一个", () => {
    for (const p of GEAR_PROFILES) {
      const got = gearProfile(p.id);
      expect(got, `档位 ${p.id} 取回来的不是它自己`).toBe(p);
    }
    // 三个是**不同对象** —— 防「都指向同一个档」这种更隐蔽的坏法
    const taken = GEAR_PROFILES.map((p) => gearProfile(p.id));
    expect(new Set(taken).size, "三个 id 取回了同一个档位对象").toBe(GEAR_PROFILES.length);
  });

  it("不存在的 id 抛错，且把现有 id 列出来", () => {
    /*
     * 这一条就是我踩的那个坑的正反面:同一行代码，
     * 改前返回「常规」档，改后抛错。
     */
    for (const bogus of ["poor", "mid", "rich", "", "TYPICAL"]) {
      expect(
        () => gearProfile(bogus),
        `gearProfile("${bogus}") 没有抛错 —— 它静默退回了某个默认档，` +
          "而读数的人会以为自己在看别的档",
      ).toThrow();
    }
    /*
     * 错误里必须点出现有 id。一个只说「not found」的错，
     * 读者还得回去翻 `GEAR_PROFILES` 的源码 —— 而这条判据的价值
     * 一半在于「写错时马上知道自己该写什么」。
     */
    let message = "";
    try {
      gearProfile("poor");
    } catch (e) {
      message = (e as Error).message;
    }
    expect(message, "抛的错里没写清是哪个 id").toContain("poor");
    for (const p of GEAR_PROFILES) {
      expect(message, `抛的错里没列出现有 id「${p.id}」 —— 读者还得去翻源码`).toContain(p.id);
    }
  });

  it("三个档位在实际审计读数上确实分得开", () => {
    /*
     * 前两条管的是 id 解析；这一条管的是**这个维度本身还活着没有**。
     * 它直接对应我踩的那一坑:若三档在读数上完全一样，那么即便 id 全写对，
     * 「装备投入差多少」这个问题也答不出来 —— 而审计会照旧打印三份一样的表。
     *
     * 用 5 境圆满的模型战力作读数:它同时吃到品质分位、强化斜率与「其他来源」斜率。
     */
    const powers = GEAR_PROFILES.map((p) => toNum(modelPlayer(5, 9, p).stats.power));
    const uniq = new Set(powers.map((v) => v.toFixed(6)));
    expect(
      uniq.size,
      `三个档位在同境界算出了${uniq.size === 1 ? "同一个" : "重复的"}战力(${powers.map((v) => v.toExponential(3)).join(" / ")}) —— ` +
        "「随缘 / 常规 / 极限」这个维度是死的",
    ).toBe(GEAR_PROFILES.length);
    // 且方向对：极限 > 常规 > 随缘
    const sorted = [...powers].sort((a, b) => a - b);
    expect(powers, "档位之间的强弱顺序不对（随缘应当最弱、极限最强）").toEqual(sorted);
  });

  it("压制率也随档位单调 —— 穿得越好，能压的区越多", () => {
    /*
     * 补一条跨模块的:压制率是审计真正打印给人看的那个数。
     * 我在误导性输出里看到的三档「完全相同」正是在这里 ——
     * 故把它作为最后一个落点钉住。
     */
    const avg = GEAR_PROFILES.map((p) => {
      const rows = contentCoverageAudit(p);
      return rows.reduce((s, r) => s + r.crushRatio, 0) / rows.length;
    });
    for (let i = 1; i < avg.length; i += 1) {
      expect(
        avg[i]!,
        `第 ${i + 1} 档的平均压制率(${(avg[i]! * 100).toFixed(1)}%)低于第 ${i} 档` +
          `(${(avg[i - 1]! * 100).toFixed(1)}%) —— 穿得更好反而压不动内容`,
      ).toBeGreaterThanOrEqual(avg[i - 1]! - 1e-9);
    }
  });
});
