/**
 * 重置确认必须把「会失去什么」列出来 —— 一句「彻底抹去」不够。
 *
 * ## 由来（第 290 轮）
 *
 * `SettingsView.vue` 的重置弹窗里写着:
 *
 * ```html
 * <p>此举将 <span class="text-cinnabar">彻底抹去</span>
 *    本机的一切修行痕迹，包括转世收获，且无法恢复。</p>
 * ```
 *
 * 而紧接的注释记着为什么只有那句话不够:
 *
 * > 摊开「会失去什么」……重置比导入**更彻底**（导入至少还有备份可回头），
 * > 却只有一句定性的话。
 * >
 * > 更要紧的是**它出现在设置页** —— 那一列开关大多是「改了还能改回来」的，
 * > 在一列可逆开关中间放一个不可逆的重磅动作、只给一句形容词，
 * > **玩家很容易按设置页的常规节奏滑过去**。
 *
 * 故它把三项摊开:已历世数、此世境界、随魂道果。
 *
 * ## 为什么需要判据
 *
 * 这份摊开挂在 `v-if="saveSnapshot"` 上，**没有任何东西保证它不被删掉**:
 *
 * ```text
 * 类型系统      模板里的 v-if，类型系统不管
 * 浏览器巡游    ui-smoke 不会去点「重置」——那是不可逆的
 * 既有判据      零（本条之前，`data-reset-loses` 全仓只有一处出现，就是它自己）
 * ```
 *
 * 而它守的东西是**不可逆**的:玩家点下去，存档就没了。这块说明一旦被重构掉，
 * 没有任何门会红，直到某个玩家在设置页顺手按了过去。
 *
 * ## 判据
 *
 * ① 那段说明还在（`data-reset-loses` 与「这一按会抹掉」都在）;
 * ② 三项都还在（已历世数 / 此世境界 / 随魂道果）;
 * ③ 三项的取值都接真数据（`saveSnapshot` 的三个字段），不是写死的字;
 * ④ 防空转:弹窗标题与那句「彻底抹去」也还在 —— 说明找对了这一段。
 */
import { describe, expect, it } from "vite-plus/test";
import { readSource } from "@/test/readSource";

const SRC = readSource("src/views/SettingsView.vue");

/** 只取重置弹窗那一段，避免误命中同页其它文案。 */
function resetBlock(): string {
  const start = SRC.indexOf('title="重置游戏"');
  expect(start, "找不到重置弹窗的标题 —— 文案变了").toBeGreaterThan(0);
  const end = SRC.indexOf("</BaseModal>", start);
  expect(end, "找不到重置弹窗的结束 —— 解析会越界").toBeGreaterThan(start);
  return SRC.slice(start, end);
}

describe("重置确认 · 会失去什么必须摊开", () => {
  it("弹窗与「彻底抹去」都还在（防空转）", () => {
    const block = resetBlock();
    expect(block.length, "重置弹窗这一段太短 —— 截错位置了").toBeGreaterThan(500);
    expect(block, "「彻底抹去」不见了 —— 弹窗可能被重写").toContain("彻底抹去");
  });

  it("「这一按会抹掉」那段说明还在", () => {
    const block = resetBlock();
    expect(block, "data-reset-loses 不见了 —— 损失清单被删了").toContain("data-reset-loses");
    expect(block, "「这一按会抹掉」那句话不见了").toContain("这一按会抹掉");
  });

  it("三项损失都在：已历世数 · 此世境界 · 随魂道果", () => {
    const block = resetBlock();
    const missing = ["已历世数", "此世境界", "随魂道果"].filter((label) => !block.includes(label));
    expect(missing, "这些损失项不见了 —— 玩家会在设置页顺手按过去:" + missing.join(" / ")).toEqual(
      [],
    );
  });

  it("三项的值都接真数据，不是写死的字", () => {
    const block = resetBlock();
    const fields = ["lifeText", "realmText", "fruitText"].filter(
      (f) => !block.includes(`saveSnapshot.${f}`),
    );
    expect(
      fields,
      "这些项没有接 saveSnapshot 的真值 —— 会显示成写死的字:" + fields.join(" / "),
    ).toEqual([]);
  });
});
