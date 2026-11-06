/**
 * 习得功法时 —— 没说它占哪个席。
 *
 * ## 复现
 *
 * 习得一部功法,提示写的是:
 *
 * ```text
 * 习得功法《太玄引气诀》                     ← 奇遇给的
 * 残卷拼合,你参悟出《紫府玄功》              ← 藏经阁参悟
 * ```
 *
 * 而 `data/gongfa` 里 70 部功法**分成三类**:主修 29 / 辅修 25 / 秘术 16。
 *
 * ## 为什么这一处值得修
 *
 * 本仓 `AGENTS.md` 把这件事写成了硬契约:
 *
 * > 「`main`(主修,占唯一主修席)、`sub`(辅修,占辅修席)、`secret`(秘术,装配时也占
 * > **辅修席**)既是书目门类,也决定装配槽位。……文案要把席位说穿。」
 *
 * 而**习得的那一刻**恰恰是最该说穿的地方:玩家刚拿到它,第一个问题就是「这部能不能
 * 上身?占了什么?」—— 主修席只有一个,而主修有 29 部,拿错一部就意味着要卸掉原来那部。
 *
 * 现在这条提示只报名字与品阶,席位要到功法页里才知道。
 *
 * ## 判据守什么
 *
 * 一条:习得功法的报喜要说出它的门类,且门类名走 `GONGFA_TYPE_NAMES`(不另拼一份)。
 */
import { describe, expect, it } from "vite-plus/test";
import { readSource } from "@/test/readSource";

describe("习得功法 · 要说清它占哪个席", () => {
  it("奇遇给的功法,提示里带门类", () => {
    const src = readSource("src/core/eventEngine.ts")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/.*$/gm, "");
    const at = src.indexOf("习得功法");
    expect(at, "定位不到「习得功法」 —— 判据会空转").toBeGreaterThan(-1);
    const around = src.slice(Math.max(0, at - 600), at + 300);
    expect(
      around,
      "「习得功法」只报名字与品阶 —— 70 部功法分主修/辅修/秘术三类,占的席位不同,玩家读不到",
    ).toMatch(/GONGFA_TYPE_NAMES/);
  });

  it("藏经阁参悟那一条,同样带门类", () => {
    const src = readSource("src/core/gongfaService.ts")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/.*$/gm, "");
    const at = src.indexOf("参悟出");
    expect(at, "定位不到「参悟出」 —— 判据会空转").toBeGreaterThan(-1);
    const around = src.slice(Math.max(0, at - 600), at + 300);
    expect(around, "参悟出的功法也要说门类").toMatch(/GONGFA_TYPE_NAMES/);
  });

  it("门类名只有一处口径 —— 不在这里手写「主修/辅修/秘术」", () => {
    for (const f of ["src/core/eventEngine.ts", "src/core/gongfaService.ts"]) {
      const src = readSource(f)
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/\/\/.*$/gm, "");
      const at = Math.max(src.indexOf("习得功法"), src.indexOf("参悟出"));
      if (at < 0) continue;
      const around = src.slice(Math.max(0, at - 200), at + 400);
      expect(around, `${f} 手写了门类名 —— 该走 GONGFA_TYPE_NAMES`).not.toMatch(
        /["'`][^"'`]*(主修|辅修|秘术)[^"'`]*["'`]/,
      );
    }
  });

  it("反空转:名字与品阶印仍要报", () => {
    const eng = readSource("src/core/eventEngine.ts");
    expect(eng, "仍要报名字").toContain("习得功法");
    const svc = readSource("src/core/gongfaService.ts");
    expect(svc, "仍要盖品阶印").toMatch(/learnt\.quality/);
  });
});
