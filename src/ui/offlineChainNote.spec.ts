/**
 * 奇缘只能在线推进 —— 挂机等不到它，这件事得说出来
 *
 * ## 缺口:「离线不做替选」是有意设计,但没有玩家侧的解释
 *
 * `core/offline.ts` 的注释写得很清楚:
 *
 * ```text
 *   机缘/奇缘那类带代价选择的不做离线替选(在线可拒,离线不能替玩家拍板)
 * ```
 *
 * 理由充分 —— 奇缘的选择常常不可逆(救人 / 不救、履约 / 不履约),替玩家拍板
 * 等于替他做一个不能反悔的决定。**但玩家侧一个字都没有。**
 *
 * 而上一轮刚补的奇缘榜会写「待续第 2 段」,玩家挂机一天回来看到进度没动,
 * 最自然的解读是「坏了」。这条说明必须贴着那块榜写,不能藏在文档里。
 *
 * ## 说清楚的是「哪一半不打折」,不是「离线很差」
 *
 * 离线本来就一直在推进别的:修为、灵气、材料、钻研、历练场次与普通际遇。
 * 若这一句写成「离线不推进」,反而说反了 —— 玩家会以为挂机毫无意义。
 * 故这一句的落点是「**奇缘这一种要你在场**」,而不是「离线没用」。
 *
 * ## 判据要防的是「说了但说不清」
 *
 * 只查「有没有一句话」不够:那句话可能写成「离线有时不结算」这种既不确定、
 * 也不告诉玩家该怎么办的废话。故判据要求三件事:
 *   一 明确指出**奇缘**(不是泛指事件)需要在线;
 *   二 不说反话(不能让人读成「离线什么都不给」);
 *   三 给出可操作的结果(在线走一趟才算)。
 */
import { describe, expect, it } from "vite-plus/test";
import { readSource } from "@/test/readSource";
import { offlineChainNote } from "./offlineChainNote";

const view = () => readSource("src/views/AdventureView.vue");

describe("奇缘的离线口径 · 纯函数", () => {
  it("指出是「奇缘」要人在场,不是泛指所有事件", () => {
    const note = offlineChainNote();
    expect(note, "要说清是奇缘这一类").toContain("奇缘");
  });

  it("明说离线不推进它 —— 不含糊其辞", () => {
    const note = offlineChainNote();
    expect(note, "离线不推进奇缘,这句话要明确").toMatch(/离线[\s\S]{0,8}(不|不能)/);
  });

  it("说出理由 —— 「不能替你拍板」,不是一句空规定", () => {
    /*
     * 光说「离线不推进」会让玩家觉得是被克扣。理由是**选择有代价、且不可逆**,
     * 替玩家选等于替他做一个不能反悔的决定。这一句是把「限制」说成「替你留着」。
     */
    const note = offlineChainNote();
    expect(note, "要给出理由").toMatch(/抉择|选择|拍板|代你|替你/);
  });

  it("不说反话 —— 不能让人读成「离线什么都不给」", () => {
    const note = offlineChainNote();
    for (const banned of ["离线无收益", "离线不结算", "挂机无用"]) {
      expect(note, `把离线说成了一无所有(「${banned}」)`).not.toContain(banned);
    }
  });

  it("给出可操作的结果 —— 在线走一趟才算", () => {
    const note = offlineChainNote();
    expect(note, "要告诉玩家怎么办").toMatch(/在线|亲自|走一趟|在场上/);
  });
});

describe("历练页 · 把口径接在奇缘榜上", () => {
  it("奇缘榜那一块里有离线说明,且给出稳定落点", () => {
    const src = view();
    const deskAt = src.indexOf("data-adventure-chain-desk");
    expect(deskAt, "找不到奇缘榜 —— 判据会空转").toBeGreaterThan(0);
    const noteAt = src.indexOf("data-adventure-chain-offline");
    expect(noteAt, "奇缘榜上要说明离线不推进").toBeGreaterThan(deskAt);
    /*
     * 看**落点之后**的一小段,不看那一块的开头:开头是一大段注释,
     * 截太宽只会读到注释(实测踩过 —— 判据报「没走纯函数」,其实走了)。
     */
    const near = src.slice(noteAt, noteAt + 400);
    expect(near, "要走那个纯函数").toContain("offlineChainNote(");
  });

  it("说明贴在榜内,不是飘到页面别处", () => {
    const src = view();
    const deskAt = src.indexOf("data-adventure-chain-desk");
    const noteAt = src.indexOf("data-adventure-chain-offline");
    expect(noteAt, "说明要在页面上").toBeGreaterThan(0);
    expect(noteAt, "说明要排在奇缘榜之后(同一块内)").toBeGreaterThan(deskAt);
  });
});
