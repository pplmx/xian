/**
 * 名字里断言了单位，实现就必须是那个单位。
 *
 * ## 由来（第 416 轮那次事故）
 *
 * `useGameNow()` 的返回值曾被命名为 `gameNowSec`，而它返回的是**毫秒**。有人
 * （第 412 轮的我）信了那个名字，写下：
 *
 * ```text
 *   enlightenmentCooldownMs(gameNowSec.value * 1000)
 *   真实 now 1794838638298 → 传进去 1794838638298000 → 剩余 ≈ −1.79e15
 *   → 夹成 0 → v-if 恒假 → 那一行从没出现过
 * ```
 *
 * 而当时五条判据全绿 —— 它们查「有没有那一行」「插值形态对不对」「用没用那个变量」，
 * **没有一条查那个数在物理上说不说得通**。
 *
 * ## 判据怎么才不吵
 *
 * 「函数返回什么单位」机器判不了 —— 同一个 `number` 可以是秒、毫秒、比例、倍数。
 * 故这条判据**不猜**,只钉三件能机械判定的事:
 *
 * ```text
 * ① Sec / Seconds 结尾的导出 → 函数体里必须出现 / 1000 或来自一个已知的秒常量
 * ② Ms 结尾的导出            → 函数体里必须出现 * 1000，或直接返回毫秒差
 * ③ 名字里带 Sec/Ms 的**局部变量**，其右侧必须是一个单位明确的来源
 * ```
 *
 * ② 与 ③ 是第 416 轮的直接产物。① 覆盖面最窄（很多函数直接返回秒常量），
 * 故它只做一个**存在性**检查:函数体里至少有一条与秒有关的线索。
 *
 * ## 为什么不是「跑一遍看返回值」
 *
 * 那需要造状态、起 Pinia、控制时钟 —— `layeringAudit` 不允许 core spec 随便带 Pinia,
 * 而带了的那些也要维护。**静态判据在这里够用**:单位错误必然是「算式里没有那次换算」,
 * 而那正是可以看出来的。
 */
import { describe, expect, it } from "vite-plus/test";
import { readSource, walkFiles, isSourceFile } from "@/test/readSource";
import { stripComments } from "@/test/stripComments";

/** 取一个函数的完整函数体（靠花括号配对，跳过参数表里的花括号） */
function bodyOf(src: string, startAt: number): string {
  // 先越过参数表:找到第一个 `(`，配平到它的 `)`
  const paren = src.indexOf("(", startAt);
  if (paren < 0) return "";
  let depth = 0;
  let afterParams = -1;
  for (let i = paren; i < src.length; i += 1) {
    if (src[i] === "(") depth += 1;
    else if (src[i] === ")") {
      depth -= 1;
      if (depth === 0) {
        afterParams = i + 1;
        break;
      }
    }
  }
  if (afterParams < 0) return "";
  // 花括号体
  const open = src.indexOf("{", afterParams);
  if (open < 0) {
    // 箭头函数简写体：取到分号
    const semi = src.indexOf(";", afterParams);
    return semi < 0 ? src.slice(afterParams) : src.slice(afterParams, semi + 1);
  }
  let d = 0;
  for (let i = open; i < src.length; i += 1) {
    if (src[i] === "{") d += 1;
    else if (src[i] === "}") {
      d -= 1;
      if (d === 0) return src.slice(open, i + 1);
    }
  }
  return "";
}

describe("单位断言 · 名字说了什么，实现就得是什么", () => {
  it("Ms 结尾的导出，函数体里确实在做毫秒运算", () => {
    const offenders: string[] = [];
    let checked = 0;
    for (const f of walkFiles("src", isSourceFile)) {
      if (f.endsWith(".spec.ts")) continue;
      const src = stripComments(readSource(f));
      for (const m of src.matchAll(/^export function (\w*Ms)\(/gm)) {
        checked += 1;
        const body = bodyOf(src, m.index!);
        /*
         * 毫秒函数的四种合法写法:
         *   · 乘 1000（由秒折算）
         *   · 直接减两个毫秒时刻（Date.now() / gameNow()）
         *   · 读一个名字里带 ms/at/endsAt/expiresAt 的字段
         *   · 返回本模块里一个**以毫秒为单位**的常量表
         *
         * 第四条是 `toastLifeMs` 那种:它按档返回 `TOAST_LIFE.base` 等，
         * 而那张表是 2600 / 4200 / 5200 / 5600 —— 毫秒。
         * 初版判据不认这种写法，于是把它算成「体里找不到毫秒运算」（实测）。
         *
         * 判据**不猜**常量表的值域，只要求：函数体里引用的那个全大写常量，
         * 名字里能看出是时间（LIFE / DURATION / TIME / MS）。
         */
        const ok =
          /\*\s*1000/.test(body) ||
          /Date\.now\(\)|gameNow\(\)/.test(body) ||
          /\b\w*(ms|Ms|At)\b/.test(body) ||
          /\b[A-Z][A-Z0-9_]*(LIFE|DURATION|TIME|MS|DELAY)[A-Z0-9_]*\b/.test(body);
        if (!ok) offenders.push(`${f}: ${m[1]} —— 体里找不到毫秒运算`);
      }
    }
    expect(checked, "一个 Ms 结尾的导出都没扫到 —— 判据在空转").toBeGreaterThan(2);
    expect(
      offenders,
      "这些函数名字说返回毫秒，而函数体里看不到任何毫秒运算:" + offenders.join(" / "),
    ).toEqual([]);
  });

  it("名字里带 Sec / Second 的局部变量，不许接毫秒来源", () => {
    /*
     * 第 416 轮那次事故的正身:`const gameNowSec = useGameNow()`，
     * 而 `useGameNow` 返回毫秒。这一条只钉**那一个来源** —— 它已经改名为
     * `gameNowMs`，若有人再写成 Sec，说明改回去了。
     *
     * 不扫所有 `*Sec` 变量:仓里大量 `remainSec` / `cooldownSec` 是真的秒，
     * 逐个判定会变成猜。**只钉那些「名字说了 Sec、来源却是毫秒」的组合。**
     */
    const offenders: string[] = [];
    for (const f of walkFiles("src", isSourceFile)) {
      if (f.endsWith(".spec.ts")) continue;
      const src = stripComments(readSource(f));
      for (const m of src.matchAll(
        /const\s+(\w*(?:Sec|Seconds|Secs)\w*)\s*=\s*(useGameNow|gameNowMs|gameNow)\(/g,
      )) {
        offenders.push(`${f}: ${m[1]} = ${m[2]}()`);
      }
    }
    expect(
      offenders,
      "这些变量的名字说自己是秒，而右边的来源是毫秒 —— 下一个读它的人会信名字:" +
        offenders.join(" / "),
    ).toEqual([]);
  });

  it("反差：名字说秒而来源是毫秒时，本判据真的会红", () => {
    /*
     * 判据自证：拿一段写坏的源码片段喂给同一个正则，确认它命得中。
     * 不注入真文件（那会让上面两条红），只验扫描规则本身。
     */
    const bad = "const cooldownSec = useGameNow();";
    const hit = [
      ...bad.matchAll(
        /const\s+(\w*(?:Sec|Seconds|Secs)\w*)\s*=\s*(useGameNow|gameNowMs|gameNow)\(/g,
      ),
    ];
    expect(hit.length, "自证失败:写坏的片段没有被那条正则命中").toBe(1);
    // 而写对的片段不该命中
    const good = "const cooldownMs = useGameNow();";
    expect(
      [
        ...good.matchAll(
          /const\s+(\w*(?:Sec|Seconds|Secs)\w*)\s*=\s*(useGameNow|gameNowMs|gameNow)\(/g,
        ),
      ].length,
      "自证失败:写对的片段被误命中",
    ).toBe(0);
  });
});
