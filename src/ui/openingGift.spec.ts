/**
 * 开局赠礼 —— 新玩家第一天的五件东西,缺一件就会卡住。
 *
 * ## 为什么值得钉
 *
 * `CreateView` 的 `begin()` 在把玩家送进游戏之前做了五件事:
 *
 * ```ts
 * player.initCharacter(finalName, profile);
 * learnGongfa("m_taixuan");
 * cultivation.equipMain("m_taixuan");
 * const starter = generateEquipment(1, random, { slot: "weapon" });
 * acquireEquipment(starter, { quiet: true, forceKeep: true });
 * inventory.equip(starter.uid, tpl.slot);
 * acquirePill("p_jvqisan", 3);
 * ```
 *
 * 这五件的每一件都对应玩家第一天必须做的事:
 *
 *   · **一部主修功法** —— 没有它,「功法」页是空的,而修炼速度靠它;
 *   · **主修已装上主修席** —— 只学不装等于没学(装配是独立一步,见 AGENTS
 *     「主 / 辅 / 秘是装配规则」);
 *   · **一件武器** —— 第一天要去历练,没武器打得过谁;
 *   · **武器已穿上** —— 进货不穿上,面板上还是赤手;
 *   · **三枚聚气散** —— 第一次「以药辅道」的引子,也是炼丹的入口。
 *
 * 而这些调用**没有一条判据守着**。删掉其中任何一行,静态门全绿、测试全绿 ——
 * 只有真跑一遍开局才看得出来,而那一刻玩家已经进来了。
 *
 * ## 判据守什么
 *
 * 两条:
 *   一 `start()` 里这五件事都在(按调用点钉,不按顺序 —— 顺序由视图决定);
 *   二 `game.markStarted()` 在它们**之后** —— 先标记开始再发东西,中途报错就会
 *      留下「已开局但一无所有」的存档。
 */
import { describe, expect, it } from "vite-plus/test";
import { readSource } from "@/test/readSource";

const VIEW = "src/views/CreateView.vue";

/** 取 begin() 的函数体 —— 别的函数里出现同名字样不算数 */
function startBody(): string {
  const src = readSource(VIEW).replace(/<!--[\s\S]*?-->/g, "");
  const m = src.match(/function begin\(\)[\s\S]*?\n\}/);
  return m?.[0] ?? "";
}

describe("开局赠礼 · 新玩家第一天的五件东西", () => {
  it("五件事都在 begin() 里", () => {
    const body = startBody();
    expect(body, "定位不到 begin() —— 判据会空转").not.toBe("");
    const required: [string, string][] = [
      ["learnGongfa(", "要送一部主修功法"],
      ["equipMain(", "学到的主修要真的装上主修席"],
      ["generateEquipment(", "要送一件武器"],
      ["acquireEquipment(", "武器要真进货"],
      ["inventory.equip(", "武器要真的穿上 —— 进货不穿等于赤手"],
      ["acquirePill(", "要送聚气散"],
    ];
    const missing = required.filter(([call]) => !body.includes(call)).map(([, why]) => why);
    expect(missing, `begin() 里少了:${missing.join(" / ")} —— 新玩家第一天会卡住`).toEqual([]);
  });

  it("markStarted 在发东西之后 —— 不许「已开局但一无所有」", () => {
    const body = startBody();
    const started = body.indexOf("markStarted(");
    expect(started, "begin() 里没有 markStarted —— 定位不对").toBeGreaterThan(-1);
    const after = ["learnGongfa(", "acquireEquipment(", "acquirePill("];
    const early = after.filter((call) => {
      const at = body.indexOf(call);
      return at > -1 && at > started;
    });
    expect(
      early,
      `这些调用排在 markStarted 之后:${early.join(" / ")} —— 中途抛错会留下「已开局但一无所有」的存档`,
    ).toEqual([]);
  });

  it("反空转:送的那部功法和那味药都真实存在", () => {
    const body = startBody();
    const gongfaId = body.match(/learnGongfa\("([^"]+)"\)/)?.[1] ?? "";
    const pillId = body.match(/acquirePill\("([^"]+)"/)?.[1] ?? "";
    expect(gongfaId, "开局功法要从数据表里取,不手抄名字").not.toBe("");
    expect(pillId, "开局丹药要给出 id").not.toBe("");
  });
});
