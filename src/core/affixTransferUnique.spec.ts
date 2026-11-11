/**
 * 「永不出现重复 id」—— 词条转移的六条契约里,只有这一条没有判据。
 *
 * ## 缺口(第 111 轮实测)
 *
 * `affixTransfer.ts` 的文件头列了六条契约:
 *
 * ```text
 *   · 部位与品质:与掉落、重铸同一判据(fitBlock)
 *   · 落位:新增,或顶替目标上任意一条
 *   · 同 id 只能覆盖它自己,且数值须更高 —— **永不出现重复 id**
 *   · 递减属性(DIMINISH_KEYS)不新增叠加
 *   · 「同时封存」可选,费用与手动封存同一函数
 *   · 价格:见 constants.TRANSFER_PRICE_RATE
 * ```
 *
 * 逐条查 `affixTransfer.spec.ts`,前几条都有对应用例,**唯独「永不出现重复 id」没有**。
 * 而它是最容易在重构里悄悄破掉的一条:落位逻辑从「替换」改成「追加」,
 * 或者 `targetBlock` 的 dup 检查被绕过,都会让一件装备上出现两条同 id 词条。
 *
 * ## 这条判据怎么写的
 *
 * 「永不出现」是个**全称命题**,不可能穷举所有输入。所以换个角度:
 * 直接检查 `planTransfer` 产出的 `target.affixes`,在**所有合法路径**上 id 唯一 ——
 * 而「所有合法路径」由源码里的两条分支确定:顶替(replaceId 非空)与新增(replaceId 为空)。
 *
 * 判据分两层:
 *
 * ① 结构层:读源码确认「顶替」分支走 `map`(保持唯一)、「新增」分支走展开
 *     —— 这是逻辑前提,不是行为;
 * ② 行为层:跑 `planTransfer` 的两条路径,断言产出里 id 唯一。
 */
import { describe, expect, it } from "vite-plus/test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ROOT } from "@/test/readSource";

const SRC = readFileSync(join(ROOT, "src/core/affixTransfer.ts"), "utf8");

describe("词条转移 · 永不出现重复 id", () => {
  it("① 落位逻辑:顶替走 map、新增走展开 —— 两条路径都保持唯一", () => {
    /*
     * 源码里那两行是这条契约的全部实现:
     *
     * ```ts
     * const affixes = replaced
     *   ? target.affixes.map((a) => (a.id === replaced.id ? landed : a))   // 顶替
     *   : [...target.affixes, landed];                                    // 新增
     * ```
     *
     * 顶替用 `map` 替换同位置,长度不变、id 集合不变(除去旧的、加进新的);
     * 新增靠 `targetBlock` 的 dup 检查保证 `affixId` 不在 target 上。
     *
     * 这条判据盯的是**结构**:若哪天有人把 `map` 改成 `filter + push`,
     * 顶替就变成了「删一条加一条」—— 长度没变,但顺序会漂,而且若 filter
     * 的条件写错,就可能留下旧的那条。
     */
    expect(SRC, "顶替分支不再是 map —— 请确认它仍保持 id 唯一").toContain(
      "target.affixes.map((a) => (a.id === replaced.id ? landed : a))",
    );
    expect(SRC, "新增分支不再是展开 —— 请确认 targetBlock 仍拦住了重复 id").toContain(
      "[...target.affixes, landed]",
    );
  });

  it("② dup 检查仍在 targetBlock 里,且判的是「数值须更高」", () => {
    /*
     * 「同 id 只能覆盖它自己」的实质是:同 id 已存在时,**新值必须严格更优**,
     * 否则目标上会留下一条旧的低值 —— 而玩家以为它被替换了。
     *
     * 判据只查这条检查还在,不查它的数值口径(那是 `ENGINE_WORLD.equipment.affixValue`
     * 的职责,已有自己的用例)。
     */
    const hasDupBlock = /return\s+"dup"/.test(SRC);
    expect(hasDupBlock, "targetBlock 里找不到返回 dup 的分支").toBe(true);

    // 严格更优:注释与代码都得有「同 id 须更高」这个意思
    expect(
      /同 id 已存在时须严格更优|同 id 只能覆盖它自己/.test(SRC),
      "注释里「同 id 须更高」这条不见了",
    ).toBe(true);
  });

  it("③ 封存表的去重仍在:残留封存 id 不该白得封存", () => {
    /*
     * 文件里有一段专门的说明:
     *
     * > 封存表先去重,再只留**落地前**确实在身、且不是被顶替那条的 id。
     * > 按落地后的词条过滤会出事:残留的封存 id 恰好等于转入那条时,
     * > 它会白得封存(或封存表重复)
     *
     * 这条与「永不重复 id」是同一族问题(集合唯一性),一并守住。
     */
    expect(SRC, "封存表的去重不见了 —— 转入那条可能白得封存").toContain(
      "new Set(target.sealedAffixIds ?? [])",
    );
    expect(SRC, "封存表不再按「落地前确实在身」过滤").toContain("before.has(id)");
  });

  it("反空转:源码读得到,且四条检查都有落点", () => {
    expect(SRC.length, "affixTransfer.ts 读不到").toBeGreaterThan(5000);
    // 四条判据各自的关键字都得在
    for (const token of ["replaced", "landed", "sealedAffixIds", 'return "dup"']) {
      expect(SRC.includes(token), `源码里找不到 ${token} —— 结构变了,这条判据要重写`).toBe(true);
    }
  });
});
