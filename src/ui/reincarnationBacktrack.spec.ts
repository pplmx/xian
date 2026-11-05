/**
 * 往生三程 —— 「此前都可停下」这句承诺,得有一条真的退路。
 *
 * ## 复现:文案承诺了,代码没兑现
 *
 * 第一程的承诺写得很明确(`ReincarnationDialog` 的 death 阶段):
 *
 * > 下一屏只作回照,核对此生带得走什么、放得下什么;**尚未写入轮回**。
 * > 真正不可撤回的落子,是三程末的「踏入轮回」。
 *
 * 第二程的引言又补了一遍:
 *
 * > 下一屏只作回照,核对此生带得走什么、放得下什么;尚未写入轮回。
 *
 * 这两句话都在说同一件事:**到第三程末之前,一切都还没落定。**
 *
 * 而代码里 `step` 只有一条单向赋值:
 *
 * ```ts
 * @click="step = 'choice'"     // review → choice
 * ```
 *
 * **没有任何一处写回 `step = 'review'`。** 三程又全是 `:closable="false"` ——
 * 玩家进了第二程就再也看不到第一程,进了第三程就再也回不到第二程:
 * 想改天赋、想再看一眼回照账,都没有入口,只能一路按到「踏入轮回」。
 *
 * ## 为什么这一处要紧
 *
 * 这是本作**最贵的一次不可逆操作**(转世清掉洞府、灵脉、灵兽、弟子,只留随魂)。
 * 前后 1718 行的界面反复说「还来得及」「尚未写入」,把玩家的心理预期调成
 * 「我可以先看看,最后再决定」—— 而实际上从第二程起就没有回头路。
 *
 * 期望与事实的落差,比一开始就说「不可取消」更伤人。
 *
 * ## 判据守什么
 *
 * 一条:文案说「此前都还来得及」,那就必须有**回退入口**。
 *
 * 不规定退路长什么样(按钮 / 链接 / 长按),只要求 `step` 能往回到过。
 * 若将来把文案改成「一经进入不可回头」,那时这条判据该跟着改 —— 二者必须一致,
 * 不许一个说「来得及」、另一个不给退路。
 */
import { describe, expect, it } from "vite-plus/test";
import { readSource } from "@/test/readSource";

const DLG = "src/components/character/ReincarnationDialog.vue";

describe("往生三程 · 承诺的退路要真的存在", () => {
  it("step 能退回 review,不只是单向向前", () => {
    const src = readSource(DLG);
    // 向前那一条(参照点):review → choice
    expect(src, "定位不到向前那一条 —— 判据会空转").toContain(`step = 'choice'`);
    // 退回:必须有把 step 写回 review 的地方
    const backs = (src.match(/step\s*=\s*['"]review['"]/g) ?? []).length;
    expect(
      backs,
      "文案写着「尚未写入轮回,真正不可撤回的是三程末」,但 step 只有向前的赋值 —— 进了第三程就没有回头路",
    ).toBeGreaterThan(0);
  });

  it("退路在第三程(择生)里 —— 那才是真正要改主意的位置", () => {
    /*
     * 第二程是纯回顾(只读),第三程才是玩家点选天赋 / 姓名 / 命题的地方 ——
     * 想改主意也只会发生在这里。退路必须落在 choice 那一屏。
     */
    const src = readSource(DLG);
    const choice = src.slice(src.indexOf(`data-reincarnation-stage="choice"`));
    expect(choice, "定位不到第三程 —— 判据会空转").not.toBe("");
    expect(choice, "第三程要有回退到第二程的入口 —— 玩家在这里才可能改主意").toContain(
      `step = 'review'`,
    );
  });

  it("反空转:三程仍不可用 Esc 关掉 —— 寿终是必须处理的事", () => {
    const src = readSource(DLG);
    const closable = (src.match(/:closable="false"/g) ?? []).length;
    expect(closable, "三程都该是 closable=false(不许 Esc 跳过)").toBeGreaterThanOrEqual(3);
  });
});
