/**
 * 提示条的去处 —— 拾得高品之物那条要能点开看。
 *
 * 判据五组:
 *   一 只认两种目标:装备与法宝,写坏的 kind / 空 id 一律当没有;
 *   二 不填就没有:去路是显式给的,不给不会凭空长出可点区域;
 *   三 落点真的存下来:带目标的那条提示,目标随它一起进队列;
 *   四 点开即到:按目标把对应的全局浮层打开,并收起提示;
 *   五 真接线:拾得装备那条带上自己的 uid,器评帖有稳定落点。
 */
import { describe, expect, it } from "vite-plus/test";
import { createPinia, setActivePinia } from "pinia";
import { beforeEach } from "vite-plus/test";
import { readSource } from "@/test/readSource";
import { useUiStore } from "@/stores/ui";
import { toastTargetOf } from "./toastTarget";
import { notify, setNotifier } from "@/core/notify";

beforeEach(() => setActivePinia(createPinia()));

describe("提示条去处 · 只认两种目标", () => {
  it("装备与法宝各认", () => {
    expect(toastTargetOf({ kind: "equipment", id: "u1" })).toEqual({
      kind: "equipment",
      id: "u1",
    });
    expect(toastTargetOf({ kind: "artifact", id: "a_chaos" })).toEqual({
      kind: "artifact",
      id: "a_chaos",
    });
  });

  it("空 id / 空 kind / 认不得的 kind 一律当没有", () => {
    expect(toastTargetOf(null)).toBeNull();
    expect(toastTargetOf(undefined)).toBeNull();
    expect(toastTargetOf({ kind: "equipment", id: "" })).toBeNull();
    expect(toastTargetOf({ kind: "equipment" } as never)).toBeNull();
    expect(toastTargetOf({ kind: "pill", id: "p1" } as never)).toBeNull();
    expect(toastTargetOf({ id: "u1" } as never)).toBeNull();
  });
});

describe("提示条去处 · 落点", () => {
  it("带目标的提示把目标一起存下来", () => {
    const ui = useUiStore();
    ui.toast("拾得", "rare", "heaven", { kind: "equipment", id: "u9" });
    const last = ui.toasts.at(-1)!;
    expect(last.target).toEqual({ kind: "equipment", id: "u9" });
  });

  it("不填去路的提示没有 target —— 绝大多数提示走这条路", () => {
    const ui = useUiStore();
    ui.toast("灵石 +3");
    expect(ui.toasts.at(-1)!.target).toBeUndefined();
  });

  it("写坏的去路不进队列:宁可点掉,也不要一条点了没反应的提示", () => {
    const ui = useUiStore();
    ui.toast("坏去路", "info", undefined, { kind: "nope", id: "x" } as never);
    expect(ui.toasts.at(-1)!.target).toBeUndefined();
  });
});

describe("提示条去处 · 点开即到", () => {
  it("装备目标打开器评帖并收起提示", () => {
    const ui = useUiStore();
    ui.toast("拾得", "rare", "heaven", { kind: "equipment", id: "u9" });
    const id = ui.toasts.at(-1)!.id;
    ui.openToastTarget(id);
    expect(ui.equipDetailUid).toBe("u9");
    expect(
      ui.toasts.some((t) => t.id === id),
      "点开之后那条提示该收了",
    ).toBe(false);
  });

  it("法宝目标打开法宝详情并收起提示", () => {
    const ui = useUiStore();
    ui.toast("天降机缘", "rare", "divine", { kind: "artifact", id: "a_chaos" });
    const id = ui.toasts.at(-1)!.id;
    ui.openToastTarget(id);
    expect(ui.artifactDetailId).toBe("a_chaos");
    expect(ui.toasts.some((t) => t.id === id)).toBe(false);
  });

  it("没有去路的提示被「点开」时只收起自己,不打开任何浮层", () => {
    const ui = useUiStore();
    ui.equipDetailUid = null;
    ui.toast("灵石 +3");
    const id = ui.toasts.at(-1)!.id;
    ui.openToastTarget(id);
    expect(ui.equipDetailUid).toBeNull();
    expect(ui.artifactDetailId).toBeNull();
    expect(ui.toasts.some((t) => t.id === id)).toBe(false);
  });

  it("认不得的提示 id 不抛,也不动浮层", () => {
    const ui = useUiStore();
    ui.equipDetailUid = null;
    ui.openToastTarget(999999);
    expect(ui.equipDetailUid).toBeNull();
  });
});

describe("提示条去处 · 真接线", () => {
  it("端口转发器不吞第四个参数 —— 去路要真的走到落点", () => {
    /*
     * 这条守的是一个**栽过两次**的坑:转发器写成 `(text, kind, seal) => toast(...)`,
     * 类型完全合法(多出来的实参被静默丢掉),于是 core 传了去路、落点却永远收不到。
     * 上一轮漏的是 seal,这一轮漏的是 target —— 同样的形状,只是多了一枚参数。
     * 故判据直接走端口,并且顺带钉住转发器用的是 `...args`(涨参数时不会再漏)。
     */
    const ui = useUiStore();
    setNotifier({ toast: (...args) => ui.toast(...args) });
    notify("走后端", "rare", "heaven", { kind: "equipment", id: "u_from_port" });
    const last = ui.toasts.at(-1)!;
    expect(last.seal, "印要跟着走").toBe("heaven");
    expect(last.target, "去路也要跟着走").toEqual({ kind: "equipment", id: "u_from_port" });
    setNotifier(null);
    // 落点那一侧也不许写成定长参数表
    const src = readSource("src/stores/ui.ts");
    expect(src, "转发器要用 ...args,别再数参数").toMatch(/toast: \(\.\.\.args\)/);
  });

  it("界面按 target 决定「点掉」还是「点开」", () => {
    const host = readSource("src/components/common/ToastHost.vue");
    expect(host, "提示条要按是否有去路分流").toContain("openToastTarget(");
    expect(host, "要有稳定落点供真浏览器复核").toContain(":data-toast-target=");
  });

  it("拾得装备那一条带上自己的 uid", () => {
    const loot = readSource("src/core/loot.ts");
    /*
     * 判据锚在**语义**上,不锚字面格式:上一次改动把一次调用折成三行之后,
     * 一条写死了空格与换行的正则就红了 —— 而它守的那件事(去路指向这一件自己)
     * 一个字都没错。改为「去掉空白之后再找这串」,格式怎么排都认。
     */
    const flat = loot.replace(/\s+/g, " ");
    expect(flat, "拾得高品时要给出去路").toContain('{ kind: "equipment", id: inst.uid }');
    // 出现几次就该有几条拾得路径(强留 / 常规两条)
    const hits = flat.split('{ kind: "equipment", id: inst.uid }').length - 1;
    expect(hits, "两条拾得路径都该带去路").toBeGreaterThanOrEqual(2);
  });

  it("法宝入手那一条带上自己的 id", () => {
    const flat = readSource("src/core/loot.ts").replace(/\s+/g, " ");
    // 尾逗号跟着格式化走(单行时省略、多行时保留),判据不该把它算成语义
    expect(flat, "法宝入手要给出去路").toMatch(/\{ kind: "artifact", id: defId,? \}/);
  });
});
