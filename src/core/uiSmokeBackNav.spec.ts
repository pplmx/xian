/**
 * 界面冒烟每页要真的点到按钮，而不是被第一个「← 返回」带离。
 *
 * ## 由来（第 221 轮，跑脚本时读出来的）
 *
 * 跑了两次 `scripts/ui-smoke.mjs`（默认 depth 12 与 `--depth 25`），两次的输出里都有同一行:
 *
 * ```text
 * 中途离页 12 页(点了导航钮,旧页余下按钮不再点):
 *   /codex、/souls、/titles、/settings、/build、/collection、
 *   /legacy、/dongfu、/world、/celestial、/market、/apprentice
 * ```
 *
 * 17 页里有 12 页。去查那几页的按钮清单:
 *
 * ```text
 * /codex    [button:← 人物] [a:历练] [a:人间] [button:典籍] [button:周易] …
 * /titles   [button:← 人物] [a:天界] [a:构筑] [button:名称] [button:轮回] …
 * /souls    [button:← 天界] [a:行囊] [a:藏珍] [button:器魂] [button:去开炉] …
 * ```
 *
 * **`← 人物` 是第 0 个按钮。** 点它 → hash 变了 → `leftPage = true` → `break`。
 * 于是那 12 页实际只点了一两次，`--depth 25` 也没用（限制的是「取前 N 个」，
 * 而第 1 个就把循环掐了）。
 *
 * ## 为什么这算缺陷
 *
 * 冒烟脚本的价值**全在于它点到了多少按钮**。12 页各少点十来个，
 * 就是一百多次点击的覆盖缺口 —— 而报告里那一行读起来像「正常的读数」。
 *
 * ## 这条判据守什么
 *
 * ① 脚本要在**点击之前**就认出「这是一枚会换页的导航钮」并跳过它（而不是点了再 break）;
 * ② 那个跳过要覆盖 `←` 开头的返回钮（那几页的第 0 个都是它）。
 *
 * 不钉它的实现细节 —— 只核「脚本里存在一个在点击前排除返回钮的判据」。
 *
 * ## 故障注入
 *
 * 把循环里那行 `if (BACK_NAV.test(text)) continue;` 删掉 → 第二条红。
 * 把 `BACK_NAV` 常量删掉（连带那行）→ 第二条红。
 * 删掉离页守卫 → 第三条红。
 */
import { describe, expect, it } from "vite-plus/test";
import { readSource } from "@/test/readSource";
import { stripComments } from "@/test/stripComments";

const SMOKE = "scripts/ui-smoke.mjs";

describe("界面冒烟 · 返回钮不该把整页的遍历带离", () => {
  it("判据的前提还在 —— 那个循环与离页守卫", () => {
    const src = stripComments(readSource(SMOKE));
    expect(src, "找不到按钮循环").toMatch(/for \(const b of buttons/);
    expect(src, "找不到离页守卫").toContain("leftPage = true");
  });

  it("点击之前就排除返回钮，而不是点了再离页", () => {
    const src = stripComments(readSource(SMOKE));
    /*
     * 判那件事:循环体里，在 `b.click()` 之前有一个「这是返回钮吗」的判据。
     *
     * 认法:找 `SKIP.test(text)` 那一行附近是否出现了对 `←` 的判断，
     * 或者 SKIP 里是否收了返回钮。两者取一即可。
     */
    /*
     * 判「它被**用**了」，不是「它被**声明**了」。
     *
     * 第一版只找 `BACK_NAV` 这个名字，于是把循环里那行 `if (BACK_NAV.test(text)) continue;`
     * 删掉之后判据照样绿（常量还在，只是没人用）。这是假阳性 —— 实测到的。
     */
    const at = src.indexOf("for (const b of buttons");
    const end = src.indexOf("\n  }", at);
    const loop = src.slice(at, end);
    /*
     * 只认「循环体里真的调了它」。第二版还留了 `|| /BACK_NAV/.test(loop)` 与
     * `|| /SKIP…←/.test(src)` 两条退路，结果同样被绕过：常量定义里就带着 `←`，
     * 删掉调用行之后那两条仍能匹配（实测两次都没红）。
     */
    const hasBackGuard = /BACK_NAV\.test\s*\(/.test(loop);
    expect(
      hasBackGuard,
      "脚本没有在点击前排除「← 返回」类导航钮 —— 那 12 页的第 0 个按钮就是它，" +
        "点了就离页、余下十来个按钮一个都不点，而报告里那行读起来像正常读数",
    ).toBe(true);
  });

  it("离页守卫本身仍在（跳过返回钮不等于取消这道守卫）", () => {
    const src = stripComments(readSource(SMOKE));
    const at = src.indexOf("for (const b of buttons");
    const end = src.indexOf("\n  }", at);
    const body = src.slice(at, end);
    expect(
      /location\.hash[\s\S]{0,120}?leftPage = true/.test(body),
      "离页守卫没了 —— 那是另一道防线（真有别的按钮改了 hash 时仍要停下）",
    ).toBe(true);
  });
});
