/**
 * 主线任务链的三条契约 —— 文件头列了,此前没有一条判据。
 *
 * ## 文件头原文
 *
 * > 这里定三件事:
 * > · **一次结算最多推 5 节**(迁移前的 `while (guard < 5)` 守卫原样保留):条件恒真时
 * >   没有守卫的循环会一帧跳完整条链,撞到上限也要能说出来(`capped`);
 * > · 判据由调用方给 —— 本作是 `progress.evalCond`(与界面进度读数同一份),故这一层
 * >   不 import progress,免得绕成环;
 * > · 结果换算回本作的内容定义,调用方直接拿去发赏与提示。
 *
 * 第 87~88 轮扫「导出函数没被任何 spec 提到」时,`mainQuestAt` / `mainQuestDefById`
 * 都在名单里,而这个模块**连 spec 文件都没有**。
 *
 * ## 最要紧的是第 1 条
 *
 * 32 节主线,若没有守卫,条件恒真的那一帧会**一次跳完整条链**:
 * 玩家一口气领完 32 节赏、界面从「第一节」直接翻到「全通」——
 * 而每一节的播报都来不及出。`capped` 这个字段就是给那种情况留的话头。
 */
import { describe, expect, it } from "vite-plus/test";
import { MAIN_QUESTS } from "@/data/quests";
import {
  MAIN_CHAIN_MAX_STEPS,
  advanceMainChain,
  mainQuestAt,
  mainQuestDefById,
} from "./engineChain";

describe("主线链 · 三条契约", () => {
  it("① 一次结算最多推 5 节 —— 条件恒真也不许一帧跳完整条链", () => {
    // 先确认链真的比守卫长,否则这条判据在空转
    expect(
      MAIN_QUESTS.length,
      `主线只有 ${MAIN_QUESTS.length} 节,不比守卫 ${MAIN_CHAIN_MAX_STEPS} 长 —— 判据量不出上限`,
    ).toBeGreaterThan(MAIN_CHAIN_MAX_STEPS);

    const out = advanceMainChain(0, () => true);
    expect(
      out.advanced.length,
      `条件恒真时推进了 ${out.advanced.length} 节 —— 没有守卫会一帧跳完整条链`,
    ).toBe(MAIN_CHAIN_MAX_STEPS);
    expect(out.capped, "撞到上限却没报 capped —— 调用方不知道还有下一节在等着").toBe(true);
    expect(out.atEnd, "还有几十节没走却说到了链尾").toBe(false);
    expect(out.index, "推进 5 节后下标不是 5").toBe(MAIN_CHAIN_MAX_STEPS);
  });

  it("① 的边界:条件恒假时一节都不推", () => {
    const out = advanceMainChain(0, () => false);
    expect(out.advanced, "条件恒假却推进了").toEqual([]);
    expect(out.index, "条件恒假却动了下标").toBe(0);
    expect(out.capped, "条件恒假也报 capped").toBe(false);
    expect(out.atEnd, "起点就报到了链尾").toBe(false);
  });

  it("② 判据由调用方给 —— 同一个 index 配不同判据,推进结果不同", () => {
    /*
     * 这一层不 import progress(免得绕成环),判据完全由 `done` 决定。
     * 若哪天有人在里面偷偷读了全局状态,这条就会红。
     */
    let calls = 0;
    const counting = advanceMainChain(0, () => {
      calls += 1;
      return false;
    });
    expect(counting.advanced, "判据返回 false 却推进了").toEqual([]);
    expect(calls, "判据一次都没被调用 —— done 参数没接上").toBeGreaterThan(0);

    // 只有前两节算达成:应当停在第 2 节
    const twoOnly = advanceMainChain(0, (node) =>
      MAIN_QUESTS.slice(0, 2).some((q) => q.id === node.id),
    );
    expect(
      twoOnly.advanced.length,
      "只有前两节达成,却推进了 " + twoOnly.advanced.length + " 节",
    ).toBe(2);
    expect(twoOnly.index).toBe(2);
    expect(twoOnly.capped, "只推进 2 节却报 capped —— 那一节本来就不满足,不是撞上限").toBe(false);
  });

  it("③ 结果换算回本作的内容定义 —— 推进出来的都是真 QuestDef", () => {
    const out = advanceMainChain(0, () => true);
    expect(out.advanced.length).toBeGreaterThan(0);
    for (const q of out.advanced) {
      expect(q.id, "换算出来的条目没有 id").toBeTruthy();
      expect(q.name, `${q.id} 没有名字 —— 播报会念不出来`).toBeTruthy();
      // 必须是 MAIN_QUESTS 里的那一份(同一对象或至少同 id)
      expect(
        MAIN_QUESTS.some((m) => m.id === q.id),
        `${q.id} 不在 MAIN_QUESTS 里 —— 换算错了表`,
      ).toBe(true);
    }
  });

  it("③ 的顺序:推进出来的顺序就是链上顺序", () => {
    const out = advanceMainChain(0, () => true);
    const declared = MAIN_QUESTS.slice(0, out.advanced.length).map((q) => q.id);
    expect(
      out.advanced.map((q) => q.id),
      "推进顺序与声明顺序不一致 —— 播报会倒着出",
    ).toEqual(declared);
  });

  it("下标越界时安全:不动、不崩、报 atEnd", () => {
    const out = advanceMainChain(MAIN_QUESTS.length + 10, () => true);
    expect(out.advanced, "越界下标竟然推了节数").toEqual([]);
    expect(out.atEnd, "越界下标没报 atEnd").toBe(true);
  });

  it("mainQuestAt / mainQuestDefById 与 MAIN_QUESTS 同源", () => {
    for (let i = 0; i < MAIN_QUESTS.length; i += 1) {
      const q = MAIN_QUESTS[i]!;
      expect(mainQuestAt(i)?.id, `mainQuestAt(${i}) 与 MAIN_QUESTS[${i}] 不一致`).toBe(q.id);
      expect(mainQuestDefById(q.id)?.id, `按 id 找 ${q.id} 找错了`).toBe(q.id);
    }
    expect(mainQuestAt(-1), "负下标返回了任务").toBeUndefined();
    expect(mainQuestAt(MAIN_QUESTS.length), "越界下标返回了任务").toBeUndefined();
    expect(mainQuestDefById("不存在的id"), "未知 id 返回了任务").toBeUndefined();
  });

  it("反空转:链有足够多节、id 唯一", () => {
    expect(MAIN_QUESTS.length, "主线链太短,测不出守卫").toBeGreaterThan(MAIN_CHAIN_MAX_STEPS);
    const ids = MAIN_QUESTS.map((q) => q.id);
    expect(new Set(ids).size, "主线任务 id 有重复 —— 按 id 建索引会静默丢条目").toBe(ids.length);
  });
});
