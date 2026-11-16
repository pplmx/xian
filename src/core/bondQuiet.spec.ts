/**
 * 同行帖的空白处 —— 「此刻没有未了之言」其实是四种处境。
 *
 * ## 缺口（本轮实测确认）
 *
 * `BondDialog` 的 `bond-quiet` 在「没有待答的事」时一句说尽，副文永远是:
 *
 * ```text
 * 多走几处地界，新的相遇会自己找上来。
 * ```
 *
 * 而那个 `v-else` 至少四件事共用。第 ② 种是本轮量出来的:
 *
 * ```text
 * 七件共同事件全历尽之后:
 *   这一世还开着几件                 = 0
 *   offerBondEvent 四次情境位        = null / null / null / null
 *   meet("dl_zhaoyan")              = false   （已有同行者，新的人进不来）
 * ```
 *
 * 于是那一档上玩家读到的是一条**永远做不到的建议** ——
 * 走多少地界都不会再有新的共同事件，也不会有「新的相遇」。
 *
 * 这与 `docs/usage.md` 那句「终点不该被写成中转站」是同一个形状:
 * 世界到顶之后，指引还在说「再往前走」。仓里已经为境界做过一次
 * （`core/goal` 的 `atApex` 分支），道侣这一处是同一件事的第二次。
 *
 * ## 判据守什么
 *
 * ① 四种处境各说各的，不许两档同一句；
 * ② 「历尽」那一档**不许**出现「多走走 / 新的相遇」这类还会再来的指引；
 * ③ 判尽的边界是 `done >= total`，而 `total === 0`（内容表空了）不算历尽 ——
 *    那是配置坏了，不能包装成设计；
 * ④ 死与散优先于「没事说」—— 人不在了，「多走走」自然也不成立；
 * ⑤ 视图真的读这一份，而不是还在模板里写三元。
 */
import { describe, expect, it } from "vite-plus/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { bondQuietLine, type BondQuietKind } from "./bondQuiet";
import { BOND_EVENTS } from "@/data/bondEvents";
import { stripComments } from "@/test/stripComments";

const DLG_RAW = readFileSync(resolve(__dirname, "../components/character/BondDialog.vue"), "utf8");
/**
 * 去掉注释再扫。
 *
 * 本轮加的那段注释里**引用了旧的那句原文**（否则读者不知道改的是什么）——
 * 而「模板里不许再留着这句」的判据若扫全文，会被自己的注释判红。
 * 注释里引用旧文案是正当的，代码里留一份才是分叉。
 */
const DLG = stripComments(DLG_RAW);
const KINDS: BondQuietKind[] = ["idle", "exhausted", "fallen", "departed"];

/**
 * 「历尽」那档不许出现的，是**可执行的方向** —— 叫玩家去某个地方换出新东西。
 *
 * ## 第一版写宽了，当场误伤
 *
 * 第一版是 `/多走|新的相遇|自己找上来|还会|再有/`，
 * 而我写的文案是「往后的路，你们只并肩，不再有新的事」——
 * **「不再有新的事」里的「再有」被判成了「承诺还会有」**。
 *
 * 那不是文案的错，是判据读不懂否定句。判据该禁的是「去吧，那里有新的」，
 * 不是「不会再有新的」这一个说法本身。故收成三条可执行的方向，
 * 并把「有没有说出终局」交给下面那条独立的断言。
 */
const PROMISES_MORE = /多走|多去|新的相遇|自己找上来|另有/;

/** 「历尽」那档必须说穿「已经走完了」这件事 */
const SAYS_DONE = /全部走过|已尽|走完|到头/;

describe("同行帖空白处 · 四种处境", () => {
  it("四种处境各说各的，两档不许同一句", () => {
    const lines = {
      idle: bondQuietLine({ fallen: false, departed: false, done: 0, total: 7 }),
      exhausted: bondQuietLine({ fallen: false, departed: false, done: 7, total: 7 }),
      fallen: bondQuietLine({ fallen: true, departed: false, done: 3, total: 7 }),
      departed: bondQuietLine({ fallen: false, departed: true, done: 3, total: 7 }),
    };
    expect(new Set(KINDS.map((k) => lines[k].title)).size, "有两档的标题是同一句").toBe(4);
    expect(new Set(KINDS.map((k) => lines[k].copy)).size, "有两档的副文是同一句").toBe(4);
    for (const k of KINDS) {
      expect(lines[k].kind, `${k} 的 kind 回错了`).toBe(k);
      expect(lines[k].title.length, `${k} 的标题太短`).toBeGreaterThan(2);
      expect(lines[k].copy.length, `${k} 的副文太短`).toBeGreaterThan(4);
    }
  });

  it("「历尽」那一档不许再承诺还会有新的 —— 那是本轮的缺陷本身", () => {
    /*
     * 这一条就是判据的全部意义。原句「多走几处地界，新的相遇会自己找上来」
     * 在 done === total 时是假的:没有事件可抽、也没有第二个人能被 meet。
     */
    const line = bondQuietLine({ fallen: false, departed: false, done: 7, total: 7 });
    expect(line.kind).toBe("exhausted");
    const text = line.title + line.copy;
    expect(
      PROMISES_MORE.test(text),
      `「历尽」那档还在给一条做不到的方向 —— «${line.title} / ${line.copy}»`,
    ).toBe(false);
    /*
     * 反方向的守:光把话删干净不够，那一档还要**说出已经走完**。
     * 只说「暂无」而不说「已尽」，玩家仍会以为是运气不好。
     */
    expect(
      SAYS_DONE.test(text),
      `「历尽」那档没说穿已经走完 —— «${line.title} / ${line.copy}»`,
    ).toBe(true);
  });

  it("「idle」那一档**该**保留那句指引 —— 它还成立时不要把它也删掉", () => {
    /*
     * 反方向的守:把四档都改写成「无事可说」是最省事的修法，而那会把
     * 正常状态下的指引一起弄丢。有事件可抽、人还在时，「多走走」是对的。
     */
    const line = bondQuietLine({ fallen: false, departed: false, done: 2, total: 7 });
    expect(line.kind).toBe("idle");
    expect(line.copy, "还有事件没走完，却不再告诉玩家去哪儿找").toMatch(/多走|地界/);
  });

  it("边界:done 恰好等于 total 才算历尽", () => {
    const at = (done: number, total: number) =>
      bondQuietLine({ fallen: false, departed: false, done, total }).kind;
    expect(at(6, 7)).toBe("idle");
    expect(at(7, 7)).toBe("exhausted");
    expect(at(8, 7), "超出总数（坏档）也该按历尽处理，不许退回 idle 去骗人").toBe("exhausted");
  });

  it("total 为 0 不算历尽 —— 内容表空了是配置问题，不是设计", () => {
    /*
     * 若 `BOND_EVENTS` 被误清空，`done >= total` 会当场成立（0 >= 0），
     * 于是界面说「此世的缘分已尽数走过」。那句话会把一次内容事故包装成设计。
     */
    expect(bondQuietLine({ fallen: false, departed: false, done: 0, total: 0 }).kind).toBe("idle");
  });

  it("死与散优先于「没事说」—— 人不在了,「多走走」也不成立", () => {
    // 即便事件全历尽，人若已殁，说的必须是殁
    expect(bondQuietLine({ fallen: true, departed: false, done: 7, total: 7 }).kind).toBe("fallen");
    expect(bondQuietLine({ fallen: false, departed: true, done: 7, total: 7 }).kind).toBe(
      "departed",
    );
  });

  it("title / copy 与 BondDialog 原本那四句同源 —— 不是另写一份", () => {
    /*
     * 死与散那两句在改动前就写在模板里。搬进 core 之后，模板里不该再留一份
     * 同样的字面量 —— 两份必然在下次改文案时分叉。
     */
    expect(DLG, "模板里还留着旧的三元文案 —— 它已经搬到 core/bondQuiet 了").not.toContain(
      "新的相遇会自己找上来",
    );
    expect(DLG, "模板里还留着旧的死/散文案").not.toContain("人不随转世回来");
  });
});

describe("同行帖空白处 · 视图真的读这一份", () => {
  it("模板读 quiet.title / quiet.copy，而不是自己判", () => {
    expect(DLG, "空态标题没走 quiet").toContain("quiet.title");
    expect(DLG, "空态副文没走 quiet").toContain("quiet.copy");
    // 那一块要带得出处境，判据与浏览器门才认得出量到的是哪一档
    expect(DLG, "空态没报出处境").toContain("data-bond-quiet-kind");
  });

  it("总数读内容表真实件数，不手写 7", () => {
    /*
     * 手写一个 7 会在加第 8 件事件之后立刻撒谎 —— 而那一档的文案正是
     * 「全部走过」。故 `total` 必须取 `BOND_EVENTS.length`。
     */
    expect(DLG, "total 没读 BOND_EVENTS.length").toContain("BOND_EVENTS.length");
    expect(BOND_EVENTS.length, "内容表为空 —— 上面那条判断会失去意义").toBeGreaterThan(0);
  });

  it("判尽用的是 doneEvents 的真实长度", () => {
    expect(DLG, "done 没读 doneEvents").toMatch(/done:\s*bond\.value\?\.doneEvents\.length/);
  });
});
