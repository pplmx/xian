/**
 * 素行之向 —— 契合里那一份「来自你是谁」，结算与界面读同一处。
 *
 * ## 缺口（本轮实测确认）
 *
 * `data/bondEvents` 的 `resolveChoice` 把契合拆成两份：
 *
 * ```text
 *   选项那份   选项体现的道途 vs 她的道途       +6 / -8 / -2
 *   素行那份   玩家一贯的道途 vs 她的道途       +3 / -5 / -1 / 0
 * ```
 *
 * 同行帖把第一份摊得很干净（每个选项上「契 +8」，还有「触碰底线」「站在她那边」
 * 两类旗），而**第二份没有任何界面出口**。实测：`playerLean()` 全仓只有两个
 * 调用点（结算处与本轮的读数处），`LEAN_NAMES` 只在同行帖的标题拼接里用过一次
 * —— 也就是说玩家从来看不见自己是哪一道。
 *
 * 后果很具体：一位杀伐道的玩家对长生道的云舒做任何事，契合都额外 -5。
 * 他不知道自己是杀伐道，于是把这条 -5 算到选项、随机、或「这游戏对我不友好」上。
 *
 * ## 判据守什么
 *
 * ① 四档判定本身（同道 / 相左 / 无涉 / 未成）与 `LEAN_TENSION` 对称；
 * ② **结算真的走这条函数** —— 否则界面报的 -5 与结算扣的不是同一个数；
 * ③ 界面的「哪一道」不叠字（「器道」→ 不是「器道道」）；
 * ④ 报的是行为，不是权重与归一化倍数。
 */
import { describe, expect, it } from "vite-plus/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  BOND_EVENTS,
  LEAN_COUNTERS,
  LEAN_STANCE_SHIFT,
  LEAN_STANCE_TEXT,
  leanFromCounters,
  leanShiftOf,
  leanStanceOf,
  resolveChoice,
  type LeanStance,
} from "@/data/bondEvents";
import { DAOLU, LEAN_NAMES, LEAN_TENSION, leanFullName, type DaoLean } from "@/data/daolu";
import { bondLeanAxes, bondLeanSummary, leanBehaviors } from "@/ui/bondLeanAxes";

const LEANS = Object.keys(LEAN_NAMES) as DaoLean[];
const DATA = readFileSync(resolve(__dirname, "../data/bondEvents.ts"), "utf8");
const CODE = DATA.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");

describe("素行 · 一：四档判定", () => {
  it("同道给正、相左给负、无涉给一点负、未成为零", () => {
    // 取她的素行:enum 里每一项都要在某一档上取到数
    for (const her of LEANS) {
      expect(leanStanceOf(her, her), `${her} 自己对着自己不是同道`).toBe("aligned");
      expect(leanShiftOf(her, her), `${her} 同道不给正`).toBeGreaterThan(0);
    }
    expect(LEAN_STANCE_SHIFT.unknown, "尚未走出素行不该扣分 —— 那是「还没有」不是「走反了」").toBe(
      0,
    );
    expect(LEAN_STANCE_SHIFT.apart, "无涉扣得比相左还重?那相左就没有意义了").toBeGreaterThan(
      LEAN_STANCE_SHIFT.opposed,
    );
    expect(
      LEAN_STANCE_SHIFT.apart,
      "无涉必须是负的 —— 否则「随便走走」与「与她同道」同价",
    ).toBeLessThan(0);
  });

  it("四档都有说法,且说法互不相同", () => {
    const stances: LeanStance[] = ["aligned", "opposed", "apart", "unknown"];
    for (const s of stances) {
      expect(LEAN_STANCE_TEXT[s], `${s} 没有说法`).toBeTruthy();
      expect(LEAN_STANCE_TEXT[s].length, `${s} 的说法是一两个字的占位`).toBeGreaterThan(1);
    }
    expect(new Set(stances.map((s) => LEAN_STANCE_TEXT[s])).size, "两档说法一样").toBe(
      stances.length,
    );
  });

  it("`LEAN_TENSION` 必须对称 —— 否则「谁先查谁」决定结果", () => {
    /*
     * 判定处直接查这张表（`LEAN_TENSION[herLean] === playerLean`）。
     * 若只写了一半（slaughter→longevity 而没有反向），那么
     * 「杀伐玩家 × 长生道的她」算相左，而「长生玩家 × 杀伐道的她」算无涉 ——
     * 同一对关系，方向反了就换个答案。
     */
    for (const [a, b] of Object.entries(LEAN_TENSION) as [DaoLean, DaoLean][]) {
      expect(LEAN_TENSION[b], `${a} → ${b} 写了,而 ${b} → ${a} 没写`).toBe(a);
    }
  });

  it("每一对素行都判得出来,不抛错、不留 undefined", () => {
    for (const her of LEANS) {
      for (const me of [...LEANS, null]) {
        const stance = leanStanceOf(her, me);
        expect(stances(), `${her} × ${me} 判出了表外的档:${stance}`).toContain(stance);
        expect(Number.isFinite(leanShiftOf(her, me)), `${her} × ${me} 的增减不是有限数`).toBe(true);
      }
    }
  });

  function stances(): string[] {
    return Object.keys(LEAN_STANCE_TEXT);
  }
});

describe("素行 · 二：结算真的走这一处", () => {
  it("源码层:resolveChoice 不再自带一份素行增减", () => {
    /*
     * 这是本轮的**根因守卫**。改动前 `resolveChoice` 内部既写着那张张力表
     * （`const tension: … = {...}`），也直接写着三个数：
     *
     * ```ts
     * if (playerLean === def.lean) leanShift += 3;
     * else if (tension[def.lean] === playerLean) leanShift -= 5;
     * else leanShift -= 1;
     * ```
     *
     * 若哪天有人为了「这里改一下就好」把它抄回来，界面那侧就与结算分家了 ——
     * 而两边都能跑，只有玩家读到 -5、实际扣 -1 时才会发现。
     *
     * ## 第一版这条判据漏了（故障注入抓到的）
     *
     * 第一版只写 `expect(CODE).toContain("leanShiftOf(")` —— 而那句在
     * **函数定义**那一行就命中了。于是「把三个数内联回 resolveChoice」这个
     * 完全等价于回退的改动，判据全绿。改成按**函数体**取 resolveChoice 再查。
     */
    const body = functionBody(CODE, "resolveChoice");
    expect(body.length, "取不到 resolveChoice 的函数体 —— 判据会空转").toBeGreaterThan(200);
    expect(body, "张量表被抄回 resolveChoice 里了").not.toContain("const tension");
    expect(body, "素行那三个数被内联回结算里了 —— 界面报的就不是它扣的").toContain("leanShiftOf(");
    // 三个数本身也不许再出现在结算里（它们的唯一出处是 LEAN_STANCE_SHIFT）
    expect(body, "结算里又出现了字面量 3/5/1 —— 那是 LEAN_STANCE_SHIFT 的活").not.toMatch(
      /leanShift\s*[-+]=\s*[351]\b/,
    );
  });

  it("行为层:同一个选择,两种素行给出不同契合,且差额正好是两档之差", () => {
    const def = DAOLU.find((d) => d.id === "dl_yunshu")!; // 长生道
    const ev = BOND_EVENTS.find((e) => e.id === "be_spare")!;
    const leave = ev.choices.find((c) => c.id === "leave")!; // 不涉道途的中性选项
    const asLongevity = resolveChoice(def, leave, "longevity");
    const asSlaughter = resolveChoice(def, leave, "slaughter");
    const asNull = resolveChoice(def, leave, null);
    expect(asLongevity.accord, "同道与相左给出同一个契合 —— 素行那一份算了等于没算").not.toBe(
      asSlaughter.accord,
    );
    /*
     * 中性选项的 lean 是 null，故 leanShift 只剩素行那一份。
     * 三档的差必须精确等于 LEAN_STANCE_SHIFT 的差 —— 界面报的就是这三个数。
     */
    expect(asLongevity.leanShift).toBe(LEAN_STANCE_SHIFT.aligned);
    expect(asSlaughter.leanShift).toBe(LEAN_STANCE_SHIFT.opposed);
    expect(asNull.leanShift).toBe(LEAN_STANCE_SHIFT.unknown);
    expect(asLongevity.accord - asSlaughter.accord).toBe(
      LEAN_STANCE_SHIFT.aligned - LEAN_STANCE_SHIFT.opposed,
    );
  });

  it("每一位道侣都有与她相左的那一道,或注明没有", () => {
    /*
     * 只报「无涉」不报「相左」的道侣（器道 / 问心）是允许的 —— 但那条事实要说出来:
     * 她们的玩家拿到的增减与「毫无关系的第三道」完全相同。这里把两条都量出来,
     * 而不是假设每一位都有对头。
     */
    const rows = DAOLU.map((d) => ({
      name: d.name,
      lean: d.lean,
      opposed: LEANS.filter((me) => leanStanceOf(d.lean, me) === "opposed"),
    }));
    const without = rows.filter((r) => r.opposed.length === 0).map((r) => r.name);
    // 器道与问心没有对头（LEAN_TENSION 只两对）；其余四道各有一位对头
    for (const r of rows) {
      if (r.lean === "artifice" || r.lean === "truth") expect(r.opposed).toEqual([]);
      else expect(r.opposed.length, `${r.name}（${r.lean}）没有对头`).toBe(1);
    }
    expect(without.length, "没有任何一位「无对头」—— 那张表被改宽了,这条判据要跟着改").toBe(
      DAOLU.filter((d) => d.lean === "artifice" || d.lean === "truth").length,
    );
  });
});

describe("素行 · 三：界面报什么", () => {
  it("「器道」不叠成「器道道」—— 全站唯一的拼接点", () => {
    /*
     * `LEAN_NAMES.artifice` 是「器道」，而界面统一在短名后补一个「道」字，
     * 于是同行帖上真的印出过「惜物 · 器道道」（那条样例句至今留在 BondDialog 的注释里）。
     */
    expect(leanFullName("artifice")).toBe("器道");
    expect(leanFullName("slaughter")).toBe("杀伐道");
    for (const lean of LEANS) {
      const name = leanFullName(lean);
      expect(name.endsWith("道"), `${lean} 的全名不带「道」`).toBe(true);
      expect(/道道/.test(name), `${lean} 的全名叠字了:${name}`).toBe(false);
    }
  });

  it("视图不再自己拼「道」—— 拼接只走 leanFullName", () => {
    const dlg = readFileSync(resolve(__dirname, "../components/character/BondDialog.vue"), "utf8");
    expect(dlg, "同行帖还在自己拼「}}道」—— 那正是器道道的来源").not.toMatch(
      /LEAN_NAMES\[[^\]]*\]\}\}道/,
    );
    expect(dlg, "同行帖没走 leanFullName").toContain("leanFullName(");
  });

  it("报行为,不报权重,也不报归一化倍数", () => {
    /*
     * `LEAN_SCALE` 里的 400 / 300 / 30 是内部归一化 — 改平衡时会动，
     * 而「这一道靠斩妖除魔与斩落妖王走出来」不会动。界面只许报后者。
     */
    const axes = bondLeanAxes("longevity", "slaughter");
    const text = bondLeanSummary(axes);
    for (const n of ["400", "300", "30", "0.15"]) {
      expect(text, `读数里印出了内部归一化倍数 ${n}`).not.toContain(n);
    }
    expect(text, "读数里没说出「你是哪一道」").toContain("杀伐道");
    expect(text, "读数里没说出「她是哪一道」").toContain("长生道");
  });

  it("玩法真的在变:斩得多了,这一行自己从「尚未走出」变成「杀伐道」", () => {
    /*
     * `playerLean()` 读的是行为计数,故这一块**不是一张静态说明**：
     * 玩家不做任何事时它是「尚未走出素行」，斩过一阵之后它自己会说话。
     * 这里直接调 core 的推断函数（与结算同一个），不另造一份判断。
     */
    const counts: Record<string, number> = {};
    const counter = (k: string) => counts[k] ?? 0;
    // 未动:两处都该是「尚未」
    expect(leanBehaviors(null)).toEqual([]);
    const idle = bondLeanAxes("longevity", null);
    expect(idle.stance).toBe("unknown");
    expect(bondLeanSummary(idle), "没有行迹时没说明为什么").toMatch(/尚未走出素行/);
    // 斩 400 之后
    counts.kills = 400;
    expect(
      leanFromCounters((k) => counter(k)),
      "斩 400 之后仍判不出杀伐道",
    ).toBe("slaughter");
  });

  it("这一道由哪些行为推出来 —— 直接读 LEAN_COUNTERS,不另写一份", () => {
    for (const lean of LEANS) {
      const behaviors = leanBehaviors(lean);
      expect(behaviors.length, `${lean} 没有行为说法`).toBe(LEAN_COUNTERS[lean].length);
      for (const b of behaviors) {
        expect(b, `${lean} 的行为说成了键名`).not.toMatch(/^[a-z][A-Za-z]*$/);
      }
    }
  });

  it("相左那档的增减是负的,同道那档是正的 —— 界面与结算同一个数", () => {
    const opposed = bondLeanAxes("longevity", "slaughter");
    const aligned = bondLeanAxes("longevity", "longevity");
    expect(opposed.shift).toBeLessThan(0);
    expect(aligned.shift).toBeGreaterThan(0);
    expect(opposed.stance).toBe("opposed");
    expect(opposed.stanceText).toBe(LEAN_STANCE_TEXT.opposed);
  });
});

/**
 * 取一个函数的**函数体** —— 跳过参数表与返回类型，再按括号配对找结尾。
 *
 * ## 两版都栽过，故都记下来
 *
 * ```text
 * 第一版   code.indexOf("{", start)                 → 撞上返回类型里的 `{ leanShift: number }`
 * 第二版   只配对花括号                              → 同一个坑（返回类型也是一对花括号）
 * ```
 *
 * 正解要**先越过参数表的右括号**：`resolveChoice(` 之后配对圆括号，那一格是参数表的
 * 结尾；返回类型（若有）紧随其后，再往后的第一个 `{` 才是函数体。
 *
 * 这与本仓 `assertionLiveness.spec` 里那段注释是同一个教训：摘取边界，
 * 不能靠「找一个看着像的符号」。
 */
function functionBody(code: string, name: string): string {
  const start = code.indexOf(`export function ${name}(`);
  if (start < 0) return "";
  // 越过参数表：从 `(` 起配对圆括号
  const paramsOpen = code.indexOf("(", start);
  if (paramsOpen < 0) return "";
  let depth = 0;
  let afterParams = -1;
  for (let i = paramsOpen; i < code.length; i += 1) {
    if (code[i] === "(") depth += 1;
    else if (code[i] === ")") {
      depth -= 1;
      if (depth === 0) {
        afterParams = i + 1;
        break;
      }
    }
  }
  if (afterParams < 0) return "";
  // 返回类型里可能还有一对花括号（`& { leanShift: number }`）——
  // 找到第一个**成对**的花括号块之后继续，直到遇到「后面没有类型标记」的那个
  const braceRe = /\{/g;
  braceRe.lastIndex = afterParams;
  let m: RegExpExecArray | null;
  while ((m = braceRe.exec(code))) {
    const open = m.index;
    let d = 0;
    let close = -1;
    for (let i = open; i < code.length; i += 1) {
      if (code[i] === "{") d += 1;
      else if (code[i] === "}") {
        d -= 1;
        if (d === 0) {
          close = i;
          break;
        }
      }
    }
    if (close < 0) return "";
    // 返回类型的花括号后面紧跟的是 `)` 或 `&`；函数体后面跟的是换行 + 语句
    const next = code.slice(close + 1, close + 3);
    if (/^\s*\n/.test(next)) return code.slice(open, close + 1);
    braceRe.lastIndex = close + 1;
  }
  return "";
}
