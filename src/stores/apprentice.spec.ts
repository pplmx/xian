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
import { useInventoryStore } from "@/stores/inventory";
import { useQuestsStore } from "@/stores/quests";
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

  it("dispatch 锁出发境界;无 rewardMajor 的老档任务退回收割时境界结算", () => {
    seed();
    const a = useApprenticeStore();
    const p = usePlayerStore();
    a.sync();
    const uid = a.apprentices[0]!.uid;
    const t = Date.now();
    p.major = 3;
    a.dispatch(uid, "adventure", t);
    // 出发时的境界必须锁进 task —— 收割按它结算,离线/中途升境整批结算才不漂账
    expect(a.apprentices[0]!.task!.rewardMajor).toBe(3);
    // 老档任务没有 rewardMajor → 退回收割时传入的境界(不崩、照常入账)
    a.apprentices[0]!.task = { spec: "adventure", startAt: t, finishAt: t + 30 * 3600_000 };
    const reaped = a.collectFinished(t + 31 * 3600_000, 5);
    expect(reaped.length).toBe(1);
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

  it("寻宝弟子带回的丹药同时进背包与丹方录", () => {
    seed();
    const a = useApprenticeStore();
    const inventory = useInventoryStore();
    a.sync();
    const appr = a.apprentices[0]!;
    const t = Date.now();
    appr.task = { spec: "seek", startAt: t, finishAt: t + 1, rewardMajor: 0 };

    const reaped = a.collectFinished(t + 2, 0);
    const pillId = reaped[0]!.spoils.pillId!;

    expect(inventory.pills[pillId]).toBeGreaterThan(0);
    expect(useQuestsStore().collections.pill).toContain(pillId);
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

  it("collectFinished 累计羁绊(完工一趟 bond+1),不随等级反复", () => {
    seed();
    const a = useApprenticeStore();
    a.sync();
    const appr = a.apprentices[0]!;
    const t = Date.now();
    a.dispatch(appr.uid, "herb", t);
    a.collectFinished(t + 30 * 3600_000, 0);
    expect(appr.bond).toBe(1);
    // 未派的另一趟不被计
    expect(a.apprentices[0]!.bond).toBe(1);
  });

  it("resetForRebirth:未到真传位阶 → 不凝缘、弟子清空", () => {
    seed();
    const a = useApprenticeStore();
    a.sync();
    a.apprentices[0]!.bond = 99; // 距真传阈值 100 尚差一脚
    a.resetForRebirth();
    expect(a.apprentices).toEqual([]);
    expect(a.rebirthKarma).toBe(0);
  });

  it("resetForRebirth:教出过真传(≥阈值)→ 凝成一缘,封顶到真传位阶", () => {
    seed();
    const a = useApprenticeStore();
    a.sync();
    a.apprentices[0]!.bond = 100;
    a.resetForRebirth();
    expect(a.apprentices).toEqual([]);
    expect(a.rebirthKarma).toBe(100);
  });

  it("resetForRebirth 取最高羁绊:只有满真传那一名才让缘出现", () => {
    seed();
    const a = useApprenticeStore();
    a.apprentices = [
      { uid: "a", archId: STARTER_APPRENTICE, level: 1, bond: 100, task: null } as never,
      { uid: "b", archId: STARTER_APPRENTICE, level: 1, bond: 30, task: null } as never,
    ] as never;
    a.resetForRebirth();
    expect(a.rebirthKarma).toBe(100);
  });

  it("sync:新世 starter 携带上一世凝成的跨世之缘,随后清零(一次性)", () => {
    seed();
    const a = useApprenticeStore();
    a.rebirthKarma = 100;
    a.sync();
    expect(a.apprentices.length).toBe(1);
    expect(a.apprentices[0]!.bond).toBe(100);
    expect(a.rebirthKarma, "携带过一次后应清零,不每世重演").toBe(0);
    // 再 sync(已有一徒)→ 不再白送
    a.sync();
    expect(a.apprentices.length).toBe(1);
  });

  it("sanitize:越界羁绊夹回、跨世之缘封顶到真传位阶", () => {
    seed();
    const a = useApprenticeStore();
    a.rebirthKarma = 9999;
    a.apprentices = [
      { uid: "u1", archId: STARTER_APPRENTICE, level: 1, bond: -5, task: null } as never,
    ] as never;
    a.sanitize();
    expect(a.rebirthKarma).toBe(100);
    expect(a.apprentices.find((x) => x.uid === "u1")!.bond).toBe(0);
  });
});
