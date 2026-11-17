/**
 * 图鉴来源说「强敌与首领更易出」—— 而「强敌」这个东西不存在。
 *
 * ## 由来（第 514 轮）
 *
 * 上一轮的教训是「搜要搜结论，不要搜实现」。这一轮就照着「结论」搜:
 * 界面里那些**定性的来源说明**。
 *
 * ```text
 *   CODEX_SOURCES.equip     「来源:历练掉落 —— 强敌与首领更易出」
 *   CODEX_SOURCES.artifact  「来源:历练掉落 —— 高阶地界才出得上品」
 * ```
 *
 * 而 `core/loot` 里只有一档倍数:
 *
 * ```text
 *   isBoss ? 2.5 : 1     装备
 *   isBoss ? 3   : 1     丹药
 *   isBoss ? 6   : 1     法宝
 *   isBoss ? 4   : 1     材料
 * ```
 *
 * **只有「首领」有倍数。** 而「强敌」/「精锐」这些词在 src 下零命中 ——
 * 这个游戏里没有那一档敌人。故那句话的后半是真的、前半是假的。
 *
 * ## 为什么 `codexSource.spec` 没抓到
 *
 * 它核的是**路径**（「说历练掉落，就得真有一处在历练里 collect」），
 * 不核**额度**（「说强敌更易出，就得真有强敌那一档的倍数」）。
 * 两者是不同的问题:前者问「去哪儿拿」，后者问「拿多少」。
 *
 * ## 判据
 *
 * ① 来源说明里提到的每一档「更易出」的东西，代码里都得有对应的倍数;
 * ② 反差:泛指的「历练掉落」这类**路径词**不在此列 —— 它说的是去哪，不是给多少;
 * ③ 反差:首领那一档确实存在（否则连「首领」也不能写）。
 */
import { describe, expect, it } from "vite-plus/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { CODEX_SOURCES } from "@/ui/codex";

const LOOT_SRC = readFileSync(resolve(__dirname, "loot.ts"), "utf8");

/**
 * 界面说「X 更易出」时，X 必须在代码里有对应的一档倍数。
 *
 * 现行只认三档:
 *   isBoss     首领
 *   rewardMult 强敌/精英这类难度倍率（若哪天加进来，这里要跟着改）
 */
const KNOWN_TIERS = [{ word: "首领", src: LOOT_SRC, pattern: /isBoss\s*\?/ }] as const;

describe("图鉴来源 · 说的那一档得真的存在", () => {
  it("① 说「更易出」的那一档，代码里必须有对应倍数", () => {
    /*
     * 判法:把说明里「X 与 Y 更易出」拆出 X、Y，逐个查它在代码里有没有一档。
     * 只查 `CODEX_SOURCES` 里出现「更易出 / 更易」的那几条。
     */
    const offenders: string[] = [];
    for (const [key, text] of Object.entries(CODEX_SOURCES)) {
      if (!/更易/.test(text)) continue;
      /* 取「—— A 与 B 更易出」里的 A、B */
      const m = text.match(/——\s*(.+?)更易/);
      if (!m) continue;
      const subjects = m[1]!
        .split(/[与和、]/)
        .map((s) => s.trim())
        .filter(Boolean);
      for (const s of subjects) {
        const known = KNOWN_TIERS.find((t) => t.word === s);
        if (!known) {
          offenders.push(`${key}: 说「${s}更易出」，而代码里没有「${s}」这一档倍数`);
          continue;
        }
        expect(known.src, `${key}: 「${s}」的那一档倍数不见了`).toMatch(known.pattern);
      }
    }
    expect(offenders, "这些来源说明提到的档位不存在：" + offenders.join("；")).toEqual([]);
  });

  it("② 反差：路径词不在此列", () => {
    /*
     * 「历练掉落」「丹房照方炼出」「结缘而非猎取」说的是**去哪儿**，不是**给多少**。
     * 它们不需要对应的倍数 —— 这一条守的是①的边界。
     */
    expect(CODEX_SOURCES.pet, "「结缘而非猎取」这类路径说法被误判了").toMatch(/结缘/);
    expect(CODEX_SOURCES.pill, "「三处」这类路径说法被误判了").toMatch(/三处/);
  });

  it("④ 说明里写的倍数，就是代码里那一个", () => {
    /*
     * ## 这一条防的是「两本账」
     *
     * 改了文案之后，我把「×2.5」写了进去 —— 而这个数**同时**活在 `core/loot` 里:
     *
     * ```ts
     *   chance: EQUIP_DROP_CHANCE * rewardMult * (…) * (isBoss ? 2.5 : 1)
     * ```
     *
     * 两处各写一遍，改一处另一处就撒谎。故判据要把它们绑起来:
     * 说明里的倍数必须等于代码里的那个数。
     */
    const text = CODEX_SOURCES.equip;
    const m = text.match(/×([\d.]+)/);
    expect(m, "说明里没写出倍数 —— 那它又变回了一个形容词").toBeTruthy();
    const claimed = Number(m![1]);
    const inCode = LOOT_SRC.match(/isBoss\s*\?\s*([\d.]+)\s*:/);
    expect(inCode, "代码里找不到装备那一档的 isBoss 倍数").toBeTruthy();
    expect(claimed, `说明写 ×${claimed}，而代码里是 ×${inCode![1]} —— 两本账`).toBe(
      Number(inCode![1]),
    );
  });

  it("③ 反差：首领那一档确实存在", () => {
    expect(LOOT_SRC, "loot.ts 里没有 isBoss 的三元倍数 —— 那「首领更易出」也是假的").toMatch(
      /isBoss\s*\?\s*[\d.]+\s*:/,
    );
  });
});
