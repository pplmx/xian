/**
 * 心魔不该和伤势共用一条化解路径 —— 它不是外伤
 *
 * ## 现状
 *
 * `心魔缠身`（`curse_xinmo`）是 `injury` 分类下的一个 600 秒负面状态:
 * 修速 -30%、进阶成功率 -10%。玩家只有两条路:
 *
 * ```text
 *   等它自己散    600 秒，什么都不做
 *   灵气静养      repairWithQi() 一次把伤势与心魔一起清掉
 * ```
 *
 * 而 `repairWithQi` 把两者当成同一件事 —— 它的提示语是
 * 「伤势与心魔尽复」。**这在修仙题材里说不通:伤势是皮囊上的，心魔是道心上的。**
 * 引灵气能把伤口养好，不能把执念养没。
 *
 * ## 为什么这是一个真缺口（而不只是"文案不贴切"）
 *
 * 心魔不是渡劫失败产生的（那条给的是 `injury`），它来自**事件**:
 *
 * ```text
 *   data/events.ts    水里那个对你笑 / 棋局心神难拔 / 塔中阴气缠身
 *   data/chains.ts    荒坟前灯灭
 * ```
 *
 * 也就是说:玩家撞见一件邪事，染上心魔，然后**付灵气就没了**。
 * 它在玩法上等价于"掉了点血"，而在叙事上它是「心魔」——
 * 两者之间那一大段空白，正是这个游戏最该有戏的地方。
 *
 * ## 这一轮补的那一半
 *
 * 给心魔一条**自己的路**:面壁破执。
 *
 * ```text
 *   静养（旧）  灵气  →  心魔没了            快，但道心不长
 *   面壁（新）  更多灵气 + 更久  →  心魔没了，且得一段「道心通明」
 * ```
 *
 * 复用的是**已有内容**:`enlighten_cult_strong`（道心通明，修速 +35%，300 秒）——
 * 它本来就是顿悟的选项之一，语义与「破执之后一念无滞」完全对得上。
 * 不新造一套数值。
 *
 * ## 判据守什么
 *
 * 一 心魔有一条自己的化解路径，且它与静养**不是同一个函数**;
 * 二 面壁的代价比静养高（否则人人面壁，那条路就没有取舍）;
 * 三 破执给的是**已有的**那个 buff，不新立一个同义的状态;
 * 四 既有的「静养同时清伤势与心魔」契约不破（`engineBuffsParity` 那条照旧）。
 */
import { describe, expect, it } from "vite-plus/test";
import { readSource } from "@/test/readSource";
import { buffDef } from "@/data/buffs";
import { FACE_WALL_QI_MULT, faceWallView, FACEWALL_REWARD_BUFF } from "./faceWall";

const SRC = readSource("src/core/faceWall.ts");
const REPAIR = readSource("src/core/qiRepair.ts");

describe("心魔 · 面壁破执", () => {
  it("面壁与静养不是同一个函数 —— 两条路各有各的代价", () => {
    expect(SRC, "面壁模块没有自己的入口").toMatch(/export function faceWallWithQi/);
    expect(REPAIR, "静养那个函数被面壁抢走了 —— 两条路就合并成一条").not.toContain("faceWall");
  });

  it("面壁比静养贵 —— 否则那条路没有取舍", () => {
    /*
     * 若面壁和静养一样贵，玩家永远选面壁（它多给一个增益）。
     * 贵的倍数写在 `FACE_WALL_QI_MULT`，判据只钉它确实更贵。
     */
    expect(FACE_WALL_QI_MULT, "面壁不比静养贵 —— 那它就不是取舍，是白送").toBeGreaterThan(1);
  });

  it("破执给的是已有的那个增益，不新立同义状态", () => {
    /*
     * 「道心通明」本来就在 `data/buffs`（顿悟选项之一）。给它另立一个新 id，
     * 玩家就会在两个名字下看到同一件事 —— 那正是本仓反复修的那种分叉。
     */
    expect(FACEWALL_REWARD_BUFF, "破执的报酬换了 id").toBe("enlighten_cult_strong");
    const def = buffDef(FACEWALL_REWARD_BUFF);
    expect(def, "那个 buff 不存在 —— 面壁会静默给不出东西").toBeTruthy();
    expect(def!.name, "复用错了 buff").toBe("道心通明");
  });

  it("心里没有心魔时，面壁这条路要说清「无可破」而不是静默成功", () => {
    /*
     * `faceWallView` 是给界面读的一份读数（能不能点、要多少灵气）。
     * 它必须能回答"身上没有心魔"，否则界面会画一个点了没反应的按钮。
     */
    const view = faceWallView({ hasHeartDemon: false, qi: 99999, cost: 100 });
    expect(view.canFace, "没有心魔却可以面壁").toBe(false);
    expect(view.reason, "没有心魔时没说原因").toBeTruthy();
  });

  it("灵气不够时也不算能点 —— 与静养同一条纪律（付不起就置灰并说差多少）", () => {
    const view = faceWallView({ hasHeartDemon: true, qi: 0, cost: 100 });
    expect(view.canFace, "灵气为 0 却可以面壁").toBe(false);
    expect(view.shortfall, "没说差多少灵气").toBeGreaterThan(0);
  });
});
