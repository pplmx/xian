/**
 * 规则纪元 —— 史表、比较、与「变了什么」的三条契约。
 *
 * ## 缺口(第 121 轮实测)
 *
 * 前一轮扫 `scripts/` 里的数字时想到:数据表里还有一类**面向玩家的辅助文本**
 * (`hint` / `note` / `tip`),它既不是 `desc` 也不是文档。这轮扫下来只有两处带数字:
 *
 * ```text
 *   ruleset.ts:10   超时判负 · 护盾上限 50% · 模拟预算守恒
 *   ruleset.ts:11   同词条多来源 100/75/50/25 递减
 * ```
 *
 * 两处都对得上实现(`SHIELD_CAP_RATIO = 0.5`、`DIMINISH_WEIGHTS = [1,0.75,0.5,0.25]`)。
 *
 * 但顺着查下去发现 `data/ruleset.ts` **没有 spec**,而它有三个容易写歪的地方:
 *
 * ```text
 * ① 纪元比较 rulesetBefore  —— 只认点号分段数字,不引 semver
 * ② 陈旧判定 isStaleRuleset —— undefined 不算陈旧(远古战录不知道录于何时)
 * ③ 变更列表 rulesetChangesSince —— 「不含该纪元本身」,但不是「不含当前版本」
 * ```
 *
 * ③ 最容易搞错。实测确认过:从 19.0 查出来是 19.5 / 20.0 / 21.0 / **25.0**,
 * 而 25.0 就是 `RULESET_VERSION` —— 这是**对的**:玩家查一条旧纪道痕,
 * 该看到「此后天道改了这些」,包括如今这一版。
 */
import { describe, expect, it } from "vite-plus/test";
import {
  RULESET_CHANGELOG,
  RULESET_VERSION,
  isStaleRuleset,
  rulesetBefore,
  rulesetChangesSince,
} from "./ruleset";

describe("规则纪元 · 三条契约", () => {
  it("① 纪元比较只认点号分段数字", () => {
    expect(rulesetBefore("19.0", "19.5")).toBe(true);
    expect(rulesetBefore("19.5", "19.0")).toBe(false);
    expect(rulesetBefore("19.0", "19.0")).toBe(false);
    // 主版本号优先:20.0 比 19.5 晚,所以「20.0 早于 19.5」是 false
    expect(rulesetBefore("20.0", "19.5"), "主版本号没有优先于次版本号").toBe(false);
    expect(rulesetBefore("19.5", "20.0"), "19.5 应早于 20.0").toBe(true);
    /*
     * 段数不同时要按缺省 0 比:19.0 与 19 等价,19 < 19.5。
     * 这一条是「不引 semver」的代价 —— 自己实现就得自己守。
     */
    expect(rulesetBefore("19", "19.5")).toBe(true);
    expect(rulesetBefore("19", "19")).toBe(false);
    // 不可解析的段按 0 处理,不抛错
    expect(() => rulesetBefore("x.y", "19.0")).not.toThrow();
  });

  it("② undefined 不算陈旧 —— 远古战录不知道录于何时,就不装作知道", () => {
    expect(isStaleRuleset(undefined), "无纪元被当成陈旧 —— 会让远古战录误报「天道已变」").toBe(
      false,
    );
    expect(isStaleRuleset(RULESET_VERSION), "当前版本被当成陈旧").toBe(false);
    expect(isStaleRuleset("19.0"), "旧纪元没有被判成陈旧").toBe(true);
  });

  it("③ 「不含该纪元本身」,但可以含当前版本", () => {
    // 传入的版本本身必须被排除
    for (const { version } of RULESET_CHANGELOG) {
      expect(
        rulesetChangesSince(version).some((c) => c.version === version),
        `rulesetChangesSince("${version}") 把该纪元本身也算进去了`,
      ).toBe(false);
    }

    /*
     * 当前版本**可以**出现在结果里 —— 玩家查旧纪道痕时,该看到「此后改了这些」,
     * 包括如今这一版。这条不是「也允许」,而是**必须**:若把当前版本排除,
     * 最新的那次规则变更就永远不会显示给任何人。
     */
    const fromOld = rulesetChangesSince("19.0");
    expect(
      fromOld.some((c) => c.version === RULESET_VERSION),
      "从旧纪元查变更时,当前版本不在结果里 —— 最新那次规则变更没人看得到",
    ).toBe(true);

    // 无纪元 → 空(不装作知道)
    expect(rulesetChangesSince(undefined), "无纪元却报出了变更").toEqual([]);
    // 当前版本 → 空(之后没有变更)
    expect(rulesetChangesSince(RULESET_VERSION), "当前版本之后还有变更?").toEqual([]);
  });

  it("④ 史表自洽:版本号唯一、当前版本在表里、note 都非空", () => {
    const versions = RULESET_CHANGELOG.map((c) => c.version);
    expect(new Set(versions).size, "史表里有重复版本号").toBe(versions.length);
    expect(versions, "当前版本不在史表里 —— 它自己的变更就无从记录").toContain(RULESET_VERSION);

    for (const { version, note } of RULESET_CHANGELOG) {
      expect(note.trim(), `${version} 的 note 是空的`).not.toBe("");
      expect(note.length, `${version} 的 note 太短,说不清改了什么`).toBeGreaterThan(4);
    }

    // 史表按版本升序 —— 变更列表依赖这个顺序
    for (let i = 1; i < RULESET_CHANGELOG.length; i += 1) {
      expect(
        rulesetBefore(RULESET_CHANGELOG[i - 1]!.version, RULESET_CHANGELOG[i]!.version),
        `史表顺序乱了:${RULESET_CHANGELOG[i - 1]!.version} 应早于 ${RULESET_CHANGELOG[i]!.version}`,
      ).toBe(true);
    }
  });

  it("⑤ note 里的数字与实现同源", () => {
    /*
     * 史表那两条带数字的 note,写的是**机制参数**:
     *
     * ```text
     *   超时判负 · 护盾上限 50%          → SHIELD_CAP_RATIO = 0.5
     *   同词条多来源 100/75/50/25 递减    → DIMINISH_WEIGHTS = [1, 0.75, 0.5, 0.25]
     * ```
     *
     * 这两条是「改常数就撒谎」的典型位置 —— note 写在史表里,常数写在 constants 里,
     * 改一处不改另一处,玩家看到的规则变迁就成了假话。
     *
     * 这里用**字面断言**而不是读常量比对:史表说的是「某一版改成了什么」,
     * 那是历史事实,不该跟着今天的常数变。真正要保的是**它与今天仍然一致**
     * —— 若哪天常数变了,这条会红,提醒回去确认「是历史记录还是现状说明」。
     */
    const shieldNote = RULESET_CHANGELOG.find((c) => c.note.includes("护盾上限"));
    expect(shieldNote, "找不到「护盾上限」那条 note").toBeDefined();
    expect(shieldNote!.note, "护盾上限的百分比与 SHIELD_CAP_RATIO=0.5 不符").toContain("50%");

    const diminishNote = RULESET_CHANGELOG.find((c) => c.note.includes("递减"));
    expect(diminishNote, "找不到「递减」那条 note").toBeDefined();
    expect(diminishNote!.note, "递减档位与 DIMINISH_WEIGHTS=[1,0.75,0.5,0.25] 不符").toContain(
      "100/75/50/25",
    );
  });

  it("反空转:史表非空,当前版本可解析", () => {
    expect(RULESET_CHANGELOG.length, "史表空了").toBeGreaterThanOrEqual(3);
    expect(RULESET_VERSION, "当前版本号为空").toMatch(/^\d+(\.\d+)*$/);
    expect(RULESET_CHANGELOG.length, "史表太短 —— 判据量不出顺序").toBeGreaterThan(2);
  });
});
