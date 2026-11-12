/**
 * 卷首的画要**画得出来** —— `--ink-scene-ink` 有一个下限,不是想填多小都行。
 *
 * ## 这一条是量出来的
 *
 * `InkScene` 里有两层浓淡闸相乘:
 *   `.ink-scene__draw { opacity: var(--ink-scene-ink, 1) }` —— 调用方调的闸
 *   `.ink-scene__far  { opacity: 0.16 }`                —— 遥远那一档的固定值
 *
 * 于是 `--ink-scene-ink: 0.18` 的实际浓度是 **0.18 × 0.16 = 0.029**。
 * 真浏览器连乘整条链量过:洞府卷首的远山就是 0.0288 —— 那一片天玩家**看不见**。
 * 前几轮补的六处卷首底画全都照 0.18 写,写的时候以为「0.18 = 很淡所以安全」,
 * 而它其实是「淡到没有」。
 *
 * 0.18 当初是为了过像素门定下来的(人物页那行 11px `道途未成` 压在画正中,
 * 浓一点就掉到 4.48:1、差 0.02)。那一处的约束是真的,但它**只约束那一处** ——
 * 其余几处卷首底下没有 11px 淡字,不该跟着一起隐形。
 *
 * ## 判据守什么
 *
 * 凡卷首底画(`*__masthead__scene`),`--ink-scene-ink` 的实际浓度(× 0.16)
 * 不低于 0.06 —— 约等于可见的门槛。低于它的地方要**写清为什么**:
 * 目前只有人物页一处例外,它的豁免在下面点名。
 */
import { describe, expect, it } from "vite-plus/test";
import { readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

const PAGES_DIR = resolve(__dirname, "../styles/pages");

/** 远山那一档的固定浓度(见 InkScene 的 .ink-scene__far) */
const FAR = 0.16;
/** 可见下限:低于它,那片天在纸上只剩一层灰雾 */
const FLOOR = 0.06;

interface Found {
  cls: string;
  ink: number;
}

function mastheadScenes(): Found[] {
  /*
   * 读 `styles/pages/*.css` 全集,而不是 `readStyleCss()` —— 后者只拼它的 `PAGES`
   * 清单里那几份,实测漏掉 dongfu / character / legacy / market / apprentice
   * 五处(先扫到四处就当"够了",防空转那条也因此没抓住)。
   */
  const css = readdirSync(PAGES_DIR)
    .filter((n) => n.endsWith(".css"))
    .map((n) => readFileSync(join(PAGES_DIR, n), "utf8"))
    .join("\n");
  const found: Found[] = [];
  for (const m of css.matchAll(/\.([a-z][a-z0-9-]*-masthead__scene)\s*\{([^}]*)\}/g)) {
    const rule = m[2]!;
    const ink = Number(rule.match(/--ink-scene-ink:\s*([\d.]+)/)?.[1] ?? "1");
    found.push({ cls: m[1]!, ink });
  }
  return found;
}

describe("卷首的画要画得出来", () => {
  it("判据确实扫得到东西(防空转)", () => {
    const found = mastheadScenes();
    expect(
      found.length,
      "一处 `*__masthead__scene` 都没扫到 —— 正则改坏了,判据会空转",
    ).toBeGreaterThanOrEqual(4);
  });

  it("每一处卷首底画的实际浓度不低于可见下限", () => {
    /*
     * 人物页是**唯一**点名的例外:那一页的「道途未成」是 11px 淡字、压在画的正中,
     * 实测 0.22 时 4.48:1、0.3 时 4.46:1,都过不了 4.5 的像素门。
     * 它的画确实淡到几乎看不见 —— 这是已知的取舍,写在这里而不是让它悄悄混过去。
     */
    const EXEMPT = new Set(["character-masthead__scene"]);
    const dim: string[] = [];
    for (const { cls, ink } of mastheadScenes()) {
      if (EXEMPT.has(cls)) continue;
      const effective = ink * FAR;
      if (effective < FLOOR) {
        dim.push(
          `${cls}: --ink-scene-ink ${ink} → 实际浓度 ${effective.toFixed(3)}(下限 ${FLOOR})`,
        );
      }
    }
    expect(dim, "这几处卷首的画淡到看不见 —— 写了等于没写").toEqual([]);
  });

  it("人物页的例外要一直有理由 —— 它的画确实被 11px 淡字压着", () => {
    /*
     * 豁免不能是"当年写下的一个名单":哪天人物页把那行淡字挪走或加重,
     * 这一条会提醒把豁免也撤掉。此处只钉"豁免仍在起作用",
     * 即它的浓度**确实**低于下限(否则说明已经调上去了,豁免该删)。
     */
    const ch = mastheadScenes().find((s) => s.cls === "character-masthead__scene");
    expect(ch, "人物页卷首不见了 —— 豁免名单过期").toBeTruthy();
    expect(
      ch!.ink * FAR,
      "人物页的画已经浓到可见 —— 那条豁免该删掉了(它只对「压着 11px 淡字」成立)",
    ).toBeLessThan(FLOOR);
  });
});
