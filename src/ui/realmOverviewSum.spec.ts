/**
 * 界域志卷首 —— 「已渡 9 境 · 尚余 11 境」加起来不是 21。
 *
 * ## 复现:一段话里两个数,做减法对不上
 *
 * `RealmCodexView` 卷首写着:
 *
 * ```text
 * 已至「真仙」 · 已渡 9 境 · 尚余 11 境
 * ```
 *
 * 而全作共 21 境。9 + 11 = 20,少了一个。
 *
 * 两个数各自都对,只是**口径不同**:
 *
 *   · `passed = current.index` —— 当前境是第 10 境,index 从 0 起,故「已渡」= 9
 *     (已经走完的那 9 境,不含脚下这一境);
 *   · `remaining = total - current.globalPosition` —— globalPosition 从 1 起,
 *     故「尚余」= 11(**含**脚下这一境)。
 *
 * 于是同一句话里,前一段不含当前境、后一段含当前境,两者相加差一。
 *
 * ## 为什么这一处值得修
 *
 * 玩家读到一段并列的数字,会下意识做一次减法 —— 然后发现对不上,再怀疑是不是
 * 有 bug。这一屏是**界域志的卷首**,玩家来这里正是要弄清「我走到哪了、还剩多远」。
 *
 * 而同一屏还有第三个数:「全路 10 / 21」(含当前境)。三个数并排,两个口径,
 * 读者无法从字面上分清哪个含当前、哪个不含。
 *
 * ## 判据守什么
 *
 * 一条:卷首那句话里,**「已渡」与「尚余」必须能闭合成总数**。
 *
 * 两种改法都合规:
 *   · 让「已渡」含当前境(9 → 10),与「尚余 11」相加正好 21;
 *   · 或者把话说清(「已渡 9 境 · 脚下第 10 境 · 尚余 11 境」)。
 *
 * 判据只钉「+ 起来能对上」这件事,不规定用哪一种说法。
 */
import { describe, expect, it } from "vite-plus/test";
import { readSource } from "@/test/readSource";

const DESK = "src/ui/realmCodexDesk.ts";

describe("界域志卷首 · 已渡 + 尚余要能闭合", () => {
  it("卷首要给出「脚下这一境」,让三个数能闭合", () => {
    const src = readSource(DESK);
    const body = src.match(/export function realmCodexOverview[\s\S]*?\n\}/)?.[0] ?? "";
    expect(body, "定位不到 realmCodexOverview —— 判据会空转").not.toBe("");
    /*
     * passed 不含脚下、remaining 也不含脚下,两者相加是 total - 1。
     * 中间那一个正是玩家此刻站着的境 —— 卷首必须把它说出来,
     * 否则玩家验算「已渡 + 尚余」会发现差一(实测界域志卷首曾写
     * 「已渡 9 境 · 尚余 11 境」,而全作 21 境)。
     */
    expect(body, "overview 要给出脚下这一境的序号").toMatch(/position:\s*current\.globalPosition/);
    // 视图那侧真的把它念出来
    const view = readSource("src/views/RealmCodexView.vue");
    expect(view, "卷首要把「脚下第 N 境」念出来").toMatch(/realmOverview\.position/);
  });

  it("反空转:overview 仍要给出这四个数", () => {
    const src = readSource(DESK);
    for (const key of ["passed", "total", "remaining"]) {
      expect(src, `overview 少了 ${key}`).toContain(`${key}:`);
    }
  });
});
