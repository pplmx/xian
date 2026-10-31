/**
 * 弹窗栈 —— Esc 与安卓返回键共用的「最上面那一层」。
 *
 * 由来:这套栈原是 BaseModal.vue 的模块内私有数组,只有 Esc 够得着。安卓实体返回键
 * 由 ExitConfirmDialog 接管,它只看自己那扇确认框 —— 于是详情弹窗开着按返回,叠出来
 * 的是「暂别修行」,再按一次关掉确认框,第三次又叠一层:弹窗永远关不掉,也退不出游戏。
 * 把栈挪成独立模块,返回键才问得出「上面还有一层吗」。
 */
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { closeTopModal, hasOpenModal, pushModal, removeModal, type ModalEntry } from "./modalStack";

const pushed: ModalEntry[] = [];

function push(closable = true): ModalEntry {
  const entry: ModalEntry = { closable, close: vi.fn() };
  pushModal(entry);
  pushed.push(entry);
  return entry;
}

afterEach(() => {
  // 栈是模块级单例:自己压的自己在收,别漏给下一条用例
  for (const entry of pushed.splice(0)) removeModal(entry);
});

describe("弹窗栈 · 只关最上面那一层", () => {
  it("后开的在上层,关的是它", () => {
    const lower = push();
    const upper = push();
    expect(closeTopModal()).toBe(true);
    expect(upper.close, "最上面那层要真的被关").toHaveBeenCalledTimes(1);
    expect(lower.close, "下面那层不许被顺手关掉").not.toHaveBeenCalled();
  });

  it("栈空时没人可关:返回 false,调用方接着走自己的返回逻辑", () => {
    expect(hasOpenModal()).toBe(false);
    expect(closeTopModal()).toBe(false);
  });

  it("不可关的顶层挡住下面的层 —— 不跳过它去关下一层", () => {
    const lower = push(true);
    expect(hasOpenModal(), "有弹窗时全局命令要让位").toBe(true);
    const blocked = push(false);
    expect(closeTopModal(), "不可关的弹窗在顶层时,这一下返回不该被吃掉").toBe(false);
    expect(blocked.close).not.toHaveBeenCalled();
    expect(
      lower.close,
      "越过顶层去关下一层是最坏的结果:玩家看见的是别的窗消失",
    ).not.toHaveBeenCalled();
    // 挡路的那层撤掉之后,下一按才轮到它下面这层
    removeModal(blocked);
    expect(closeTopModal()).toBe(true);
    expect(lower.close).toHaveBeenCalledTimes(1);
  });

  it("移除中间一层不影响上下两层的顺序", () => {
    const a = push();
    const b = push();
    const c = push();
    removeModal(b);
    expect(closeTopModal()).toBe(true);
    expect(c.close, "关掉的仍是最上面那层").toHaveBeenCalledTimes(1);
    expect(a.close).not.toHaveBeenCalled();
  });

  it("同一层重复移除是安全的(卸载路径可能走两次)", () => {
    const a = push();
    removeModal(a);
    removeModal(a);
    expect(closeTopModal(), "栈已空,没人可关").toBe(false);
    expect(a.close).not.toHaveBeenCalled();
  });
});
