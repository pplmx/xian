/**
 * 宿敌那一枚章 —— 只写「宿敌」两个字,不够。
 *
 * ## 现状
 *
 * 战斗界面里,同一个敌人把玩家打败三次之后会挂一枚「宿敌」小章
 * (见 `core/worldMemory.isNemesis`,阈值为 3)。这是对的。
 *
 * 但那枚章只写两个字。玩家看得到「宿敌」,看不到:
 *
 *   **输给它几次了**     `NemesisRecord.lossCount` 就在那儿,界面上一次没用过
 *   **雪耻了没有**       打赢一次会写 `avengedAt`,而那之后章直接消失 ——
 *                        玩家不会知道自己刚刚雪耻了
 *
 * ## 为什么这两条都值得露
 *
 * 「宿敌」是一条**跨世的账**(它随神魂带走,见转世保留清单)。玩家在第三世又被
 * 同一个名字打败时,界面上只说「宿敌」—— 而"三"与"五"在他心里是完全不同的两个数:
 * 一个是"刚结的怨",一个是"缠了我很久的东西"。
 *
 * 雪耻更甚:打赢的那一刻章消失了,玩家看到的是"什么都没发生"。而
 * `core/worldMemory` 那边已经把 `avengedAt` 记上了,还会产出「残魂」形态 ——
 * 世界记得,界面不说。
 *
 * ## 补什么
 *
 * 把那一枚章写全:**「宿敌 · 已败三次」**,雪耻后的那一次交手写 **「旧仇已雪」**。
 * 两句话都从 `NemesisRecord` 里取,不新存东西。
 *
 * ## 为什么不在章里写「第五次」
 *
 * 那会变成一章变长的读数。`lossCount` 的值域是 3 到 ∞,章撑不住。
 * 故写的是**门槛值**(三次)—— 它说明"够格称宿敌"这件事,而具体次数留给
 * 传承页那张宿敌表(那里有地方)。
 *
 * 待确认:若某次改动让 `NEMESIS_THRESHOLD` 变了,这句话要跟着变 —— 由判据守住。
 */
import { describe, expect, it } from "vite-plus/test";
import { readSource } from "@/test/readSource";

describe("宿敌那一枚章 · 写全", () => {
  it("章上带得出结怨的深浅,不只是两个字", () => {
    /*
     * 静态判据:战斗面板里那枚宿敌章要读 `lossCount` 或它派生出的文案,
     * 不能只写死「宿敌」两个字。
     */
    const panel = readSource("src/components/adventure/CombatPanel.vue");
    expect(panel, "宿敌章该由共享函数给出文案").toContain("nemesisChipText(");
    expect(panel, "不许再写死两个字").not.toMatch(/>\s*宿敌\s*</);
  });

  it("雪耻之后另有一句 —— 章消失不等于无声", () => {
    const panel = readSource("src/components/adventure/CombatPanel.vue");
    expect(panel, "雪耻态要能显示").toContain("nemesisAvengedText(");
  });
});

describe("宿敌那一枚章 · 文案怎么算", () => {
  it("未雪耻:说得出「已败 N 次」,且 N 取门槛值而不是实际次数", async () => {
    const { nemesisChipText } = await import("@/ui/nemesisChip");
    const text = nemesisChipText({ lossCount: 7, avengedAt: undefined });
    /*
     * 写汉字而不是阿拉伯数字:这一枚章与「首领」并排,是叙事标签不是读数
     * (见 data/events 的文案口径)。门槛是 3,故写「三次」而不是「七次」——
     * 章撑不住任意次数,实际次数留给传承页那张宿敌表。
     */
    expect(text).toContain("三次");
    expect(text, "实际次数不该进章里").not.toContain("七");
  });

  it("雪耻之后:说得出「旧仇已雪」", async () => {
    const { nemesisAvengedText } = await import("@/ui/nemesisChip");
    expect(nemesisAvengedText({ lossCount: 3, avengedAt: 123 })).toContain("雪");
  });

  it("未雪耻时没有「已雪」那句 —— 两者互斥", async () => {
    const { nemesisAvengedText } = await import("@/ui/nemesisChip");
    expect(nemesisAvengedText({ lossCount: 3, avengedAt: undefined })).toBe("");
  });

  it("门槛值取自 core,不在文案里另写一个 3", () => {
    const src = readSource("src/ui/nemesisChip.ts");
    expect(src, "要读共享常数").toContain("NEMESIS_THRESHOLD");
  });
});
