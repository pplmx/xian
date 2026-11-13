/**
 * 道侣共同事件的**每一个触发点**都必须在探索流程里接上。
 *
 * ## 由来（第 176 轮）
 *
 * 七条道侣共同事件（遗府 / 让物 / 引路 / 代价 / 别离 / 救援 / 结契）各自绑着
 * 一个 `triggers` 数组。遍历下来用了四个触发点:
 *
 * ```text
 * enterPlace     踏入新地界
 * firstVictory   首胜之后
 * nearDeath      濒死之际
 * bossDefeated   击破首领
 * ```
 *
 * 实测四个都在 `core/exploration` 里接了（138 / 404 / 406 / 563 行）。
 *
 * **但这件事没有判据守着。** 加一条事件、给它一个新触发点（比如 `levelUp`），
 * 而探索流程里忘了调 `offerBondEvent("levelUp")` —— 那条事件就永远不出现，
 * 而且**不会有任何报错**:它只是静静地待在数据表里。
 *
 * `contentReachabilityAudit` 已经守了十二个维度（丹方 / 灵材 / 敌人 / 区域链 /
 * 灵兽 / 法宝 / 功法 / 技艺 / 炼器…），**唯独没有这一维**。
 *
 * ## 判据
 *
 * ① 数据表里出现过的每一个触发点，都必须在 `core/exploration`（或别处）里
 *    真的写过 `offerBondEvent("<那个点>")`;
 * ② 反向也要:代码里调用的触发点必须是 `BondTrigger` 联合类型里有的
 *    （写错一个字符串，类型会拦住 —— 但字面量若绕过类型，这里兜一层）;
 * ③ 每条事件至少能被一个已接的触发点触发到。
 */
import { describe, expect, it } from "vite-plus/test";
import { walkFiles, isSourceFile, readSource } from "@/test/readSource";
import { stripComments } from "@/test/stripComments";
import { BOND_EVENTS } from "@/data/bondEvents";

/** 源码里真的调用过的触发点 */
function wiredTriggers(): Set<string> {
  const out = new Map<string, string>();
  for (const f of walkFiles("src", isSourceFile)) {
    /*
     * **先抹注释**。第一条故障注入就是这么漏的:把那一行注释掉，
     * 我的正则照样在注释里匹配到它、判据照绿 —— 而产品其实已经不再触发了。
     * 这正是 `docs/审计规范.md` 第三节那条「注释不是正文」。
     */
    const src = stripComments(readSource(f));
    for (const m of src.matchAll(/offerBondEvent\(\s*"([\w]+)"/g)) {
      out.set(m[1]!, f);
    }
  }
  return new Set(out.keys());
}

/** 数据表里声明的触发点（每条事件可有多个） */
function declaredTriggers(): Set<string> {
  const out = new Set<string>();
  for (const ev of BOND_EVENTS) {
    for (const t of (ev as unknown as { triggers?: string[] }).triggers ?? []) out.add(t);
  }
  return out;
}

describe("道侣事件 · 触发点必须真的接上", () => {
  it("数据表里声明的每个触发点都在源码里被调用过", () => {
    const declared = declaredTriggers();
    const wired = wiredTriggers();

    expect(declared.size, "一条触发点都没读到 —— 数据结构改了?").toBeGreaterThan(2);
    expect(wired.size, "一处 offerBondEvent 都没扫到 —— 判据空转").toBeGreaterThan(2);

    const dead = [...declared].filter((t) => !wired.has(t));
    expect(
      dead,
      "这些触发点被事件声明了，但探索流程里从没调用过 —— 那几条事件永远不会出现，" +
        "而且不会有任何报错",
    ).toEqual([]);
  });

  it("每条事件都至少能被一个已接的触发点触发到", () => {
    const wired = wiredTriggers();
    const orphans: string[] = [];
    for (const ev of BOND_EVENTS) {
      const ts = (ev as unknown as { triggers?: string[] }).triggers ?? [];
      if (ts.length === 0) {
        orphans.push(`${ev.id}: 没有 triggers`);
        continue;
      }
      if (!ts.some((t) => wired.has(t)))
        orphans.push(`${ev.id}: 它的触发点 ${ts.join("/")} 一个都没接`);
    }
    expect(orphans, "这些道侣事件永远等不到").toEqual([]);
  });

  it("代码里调用的触发点都在声明的集合里（反向）", () => {
    /*
     * 反向检查:若代码里写了一个数据表没有的触发点，那次调用什么也抽不到 ——
     * 静默无效。TypeScript 的 `BondTrigger` 联合会拦，但字面量绕过类型时
     * （比如从一个变量拼出来）就拦不住。
     */
    const declared = declaredTriggers();
    const wired = wiredTriggers();
    const unknown = [...wired].filter((t) => !declared.has(t));
    expect(unknown, "代码里调用了数据表没有的触发点 —— 那次调用什么也抽不到").toEqual([]);
  });

  it("判据自己认得出那四个触发点（地基）", () => {
    const declared = declaredTriggers();
    // 实测四个都在用；少一个说明数据结构改了，判据该跟着改
    for (const t of ["enterPlace", "firstVictory", "nearDeath", "bossDefeated"]) {
      expect(declared.has(t), `数据表里没有触发点 ${t}`).toBe(true);
    }
  });
});
