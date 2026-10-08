/**
 * 收徒 store —— 白送入门弟子、派活、归来收割、坏档修形。
 *
 * 结算在 core/apprenticeService(纯);这里守编排:
 *   · sync 白送一名入门弟子(仅一次);
 *   · dispatch 忙/无则派不动;
 *   · collectFinished 按墙钟收割已完工弟子,入账 + 升级;
 *   · sanitize 坏位丢弃、任务形状不对当归闲置。
 */
import { describe, expect, it, beforeEach } from "vite-plus/test";
import { setActivePinia, createPinia } from "pinia";
import { useApprenticeStore } from "./apprentice";
import { usePlayerStore } from "@/stores/player";
import { useResourcesStore } from "@/stores/resources";
import { STARTER_APPRENTICE, APPRENTICE_MAX_LEVEL } from "@/data/apprentices";

function seed(): void {
  const p = usePlayerStore();
  p.initCharacter("测试道友", { roots: [] } as never);
}

describe("收徒 store", () => {
  beforeEach(() => setActivePinia(createPinia()));

  it("sync:开局白送一名入门弟子,且仅此一次", () => {
    seed();
    const a = useApprenticeStore();
    a.sync();
    expect(a.apprentices.length).toBe(1);
    expect(a.apprentices[0]!.archId).toBe(STARTER_APPRENTICE);
  });

  it("dispatch:派活成功;忙着的派不动", () => {
    seed();
    const a = useApprenticeStore();
    a.sync();
    const uid = a.apprentices[0]!.uid;
    const t = Date.now();
    expect(a.dispatch(uid, "herb", t)).toBe(true);
    expect(a.apprentices[0]!.task?.spec).toBe("herb");
    expect(a.dispatch(uid, "ore", t + 1), "忙着的弟子不应能再派").toBe(false);
  });

  it("collectFinished:到时辰收割入账并升级,未到不动", () => {
    seed();
    const a = useApprenticeStore();
    const res = useResourcesStore();
    a.sync();
    const appr = a.apprentices[0]!;
    const t = Date.now();
    a.dispatch(appr.uid, "herb", t);
    const herbBefore = res.herb;
    // 未到 → 不收
    expect(a.collectFinished(t + 1, 0).length).toBe(0);
    // 早已到(多钟头后)→ 收
    const reaped = a.collectFinished(t + 30 * 3600_000, 0);
    expect(reaped.length).toBe(1);
    expect(appr.task).toBeNull();
    expect(a.apprentices[0]!.level).toBe(2);
    expect(res.herb).toBeGreaterThan(herbBefore);
  });

  it("sanitize:坏位丢弃、坏任务当归闲置、越界等级夹回", () => {
    seed();
    const a = useApprenticeStore();
    a.apprentices = [
      { uid: "u1", archId: STARTER_APPRENTICE, level: 999, task: null } as never,
      { archId: "ghost" } as never,
      {
        uid: "u2",
        archId: STARTER_APPRENTICE,
        level: 1,
        task: { spec: "nope", startAt: 1, finishAt: 2 },
      } as never,
    ];
    a.sanitize();
    expect(a.apprentices.length).toBe(2); // ghost 丢弃
    const u1 = a.apprentices.find((x) => x.uid === "u1")!;
    expect(u1.level).toBe(APPRENTICE_MAX_LEVEL); // 夹回上限
    const u2 = a.apprentices.find((x) => x.uid === "u2")!;
    expect(u2.task).toBeNull(); // 坏规格任务 → 闲置
  });
});
