/* oxlint-disable no-console */
/**
 * 因果可感知性审计(Phase 34.1 收尾)
 *
 * 34.1 已经解决了「系统内部有因果」:意图由经历催生,不由阈值触发。
 * 但那回答的是**她为什么会开口**,而玩家真正会问的是另一句:
 *
 *   **她为什么在这一刻开口?**
 *
 * 这两个问题必须分开。前者是代码正确性,后者是体验可理解性 ——
 * 后者不能靠「speakIntent 有没有被调用」来验证。
 *
 * ## 三级判据
 *
 *   可追溯  玩家从近期经历中很容易想起:「她一直在找那个东西」
 *   可推断  玩家需要翻道侣资料才能明白:「原来她之前提过」
 *   突兀    玩家几乎无法知道:「为什么偏偏现在?」
 *
 * 判定依据是**玩家可见的信息**,不是代码里有没有那个变量。
 * 内部记着 sparks 序列,玩家看不到,就不算足迹。
 *
 * 本模块只度量,不改任何东西。
 */
import { describe, expect, it } from "vite-plus/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { SPARK_NAMES, SPARK_WEIGHT, TEMPER_RESERVE } from "@/data/bondIntent";
import type { BondIntent } from "@/data/bondIntent";
import { footprintsOf } from "@/data/bondFootprints";
import { BOND_EVENTS, TRIGGER_NAMES } from "@/data/bondEvents";
import { DAOLU } from "@/data/daolu";

// 拆分后道侣弹窗(「因何而起」的所在)归 BondDialog,判据随本体改指子面板
const VIEW = readFileSync(resolve(__dirname, "../components/character/BondDialog.vue"), "utf-8");

/** 玩家能否回溯到事件的原因 */
type Traceability = "traceable" | "inferable" | "abrupt";

interface CausalLink {
  /** 玩家收到的东西 */
  surface: string;
  /** 系统内部的真实原因 */
  cause: string;
  /** 玩家在收到之前/当时能看到的证据 */
  evidence: string[];
  /** 原因累积期间玩家收到过几次提示 */
  footprints: number;
  level: Traceability;
}

/**
 * 判级规则。
 *
 * 关键是 footprints:原因在暗中累积时,玩家有没有收到过任何征兆。
 * 一次都没有 → 事件只能靠当场那句话解释自己 → 至多「可推断」
 */
function levelOf(evidence: string[], footprints: number): Traceability {
  if (footprints >= 2) return "traceable";
  if (evidence.length > 0) return "inferable";
  return "abrupt";
}

/**
 * 当前各条因果链的实际状态。
 *
 * evidence 只填**玩家真的能看到**的东西 —— 界面上有的、
 * 提示里出现过的。内部字段(sparks / ripeness / opportunities)一律不算
 */
/**
 * 「她开口」那条链的足迹数 —— **实测，不是手写**（第 409 轮改）。
 *
 * 原先这里是 `footprints: 0` 一个常量。那个 0 是本轮之前的事实，
 * 而它被写死在 spec 里之后就不再跟着产品走了：本轮补上足迹机制，
 * 这个常量仍然说 0，于是「没有任何一条达到可追溯」那条判据会继续绿着 ——
 * 一条**记录缺口的判据**，在缺口被补上之后反而变成了假绿的来源。
 *
 * 现在它从 `footprintsOf` 真的数一遍：沿一条完整的酝酿之路走一遍，
 * 数出她开口之前玩家能读到几句。
 */
function measuredFootprints(): number {
  /*
   * 取一位真实道侣的所求，沿酝酿从 0.05 扫到门槛之前，
   * 记下出现过的**不同句子**数 —— 同一句重复出现不算新足迹。
   */
  const d = DAOLU[0]!;
  const bar = TEMPER_RESERVE[d.temper];
  const seen = new Set<string>();
  for (let r = 0.05; r < bar; r += 0.05) {
    const intent = {
      daoluId: d.id,
      wish: d.pursuit,
      line: "",
      ripeness: r,
      sparks: [],
      raised: 0,
      responses: [],
      settled: false,
    } satisfies BondIntent;
    for (const f of footprintsOf(intent, d.temper)) seen.add(f.text);
  }
  return seen.size;
}

const MEASURED_FOOTPRINTS = measuredFootprints();

const LINKS: CausalLink[] = [
  {
    surface: "她开口提出自己的事",
    cause: "共历 / 支持 / 未了之事的征兆累积到酝酿度上限",
    // 弹窗里常驻「她所求」,故玩家翻一下能明白她为什么想去
    evidence: [
      "道侣弹窗常驻「她所求」",
      "开口那句话本身点明了方向",
      // 第 409 轮补上：开口之前她自己的那几句征兆（data/bondFootprints）
      "开口前「此刻」那一行逐层浮现的三句征兆",
    ],
    footprints: MEASURED_FOOTPRINTS,
    level: levelOf(
      [
        "道侣弹窗常驻「她所求」",
        "开口那句话本身点明了方向",
        "开口前「此刻」那一行逐层浮现的三句征兆",
      ],
      MEASURED_FOOTPRINTS,
    ),
  },
  {
    surface: "共同事件出现",
    cause: "历练情境(踏入新地界 / 首胜 / 击破首领 / 濒死)+ 机会点冷却",
    evidence: ["事件文本描述了当下的场景", "弹窗里写明她的诉求与底线"],
    footprints: 0,
    level: "abrupt",
  },
  {
    surface: "途中遇见一个人",
    cause: "每场战斗 6% 概率 + 本世地貌筛选候选",
    evidence: ["提示语「途中遇见一人」"],
    footprints: 0,
    level: "abrupt",
  },
  {
    surface: "她离你而去",
    cause: "选项直接导致,或信任与契合双双跌破阈值",
    evidence: ["三维进度条常驻可见", "此前每次选择都有她的反应文本"],
    footprints: 0,
    level: "abrupt",
  },
].map((l) => ({ ...l, level: levelOf(l.evidence, l.footprints) }));

describe("因果可感知 · 现状", () => {
  it("「她开口」这一条已经补到可追溯，其余三条停在可推断", () => {
    /*
     * 第 409 轮之前：四条链的足迹数全为 0。
     * 本轮补上 `data/bondFootprints` 之后，「她开口」那条有了三句征兆。
     *
     * 这一条从「记录一个缺口」改成「钉住补上之后的分布」：
     * 至少一条可追溯，且剩下的仍列得清楚 —— 免得以后有人以为全好了。
     */
    const traceable = LINKS.filter((l) => l.level === "traceable");
    expect(traceable.length, "一条可追溯的都没有 —— 足迹机制是不是被摘掉了？").toBeGreaterThan(0);
    /*
     * 其余三条是 `inferable` 而不是 `abrupt`：它们没有过程足迹，
     * 但弹窗里常驻的说明让玩家翻一下能想明白。这两个档位别混为一谈 ——
     * `abrupt` 是「怎么都想不到」，`inferable` 是「要翻一下」。
     */
    const stillAbrupt = LINKS.filter((l) => l.level === "abrupt").map((l) => l.surface);
    const inferable = LINKS.filter((l) => l.level === "inferable").map((l) => l.surface);
    console.log(
      `\n可追溯 ${traceable.length} 条：${traceable.map((l) => l.surface).join("、")}` +
        `\n可推断 ${inferable.length} 条（有说明、无过程足迹）：${inferable.join("、")}` +
        `\n突兀 ${stillAbrupt.length} 条：${stillAbrupt.join("、") || "—"}`,
    );
    /*
     * 「她开口」必须在可追溯那一边 —— 这是本轮的直接产物，
     * 若它掉回去，说明 bondFootprints 与界面的接线断了。
     */
    expect(
      LINKS.find((l) => l.surface === "她开口提出自己的事")?.level,
      "「她开口」这一条掉回了突兀 —— 足迹没接上界面",
    ).toBe("traceable");
  });

  it("内部记着原因,界面上也确实能看到(本轮补上了这条展示)", () => {
    // sparks 逐条记录了催生意图的经历序列
    console.log("\n内部记录的经历类型:");
    for (const [k, v] of Object.entries(SPARK_NAMES)) {
      console.log(
        `  ${v.padEnd(24)} ${SPARK_WEIGHT[k as keyof typeof SPARK_WEIGHT] > 0 ? "+" : ""}${SPARK_WEIGHT[k as keyof typeof SPARK_WEIGHT]}`,
      );
    }
    /**
     * 曾经这里断言的是「界面不含 sparks」—— 那条缺口本轮补上了:
     * 道侣弹窗里「她开的口」下面多了一行「因何而起」(SPARK_NAMES)。
     * 于是本条从"记录缺口"改成"钉住接口":记录的因,界面上必须真看得到。
     */
    expect(VIEW, "界面应呈现 sparks 与 SPARK_NAMES").toMatch(/sparks/);
    expect(VIEW).toMatch(/SPARK_NAMES/);
    expect(VIEW).not.toMatch(/ripeness/);
    console.log(
      "\n界面已呈现 sparks(因何而起),仍不含 ripeness(酝酿度)——" +
        "\n前者是玩家该知道的因果,后者是引擎内部的账。",
    );
  });
});

describe("因果可感知 · 缺的是什么", () => {
  it("该做的不是解释文本,而是过程中的足迹 —— 而那些足迹已经做了", () => {
    // 反例:把因果写进弹窗会把游戏做成系统说明
    const badExample = "因为你已与她同行十六次,并且之前支持过她两次,所以她……";
    expect(VIEW).not.toContain("同行十六次");
    console.log(
      `\n不该做的:「${badExample}」` +
        "\n这会把关系变成系统日志。" +
        "\n\n该做的是在累积途中留下轻量记忆,让玩家自己把节点串起来 —— " +
        "这件事第 409 轮已经做了(data/bondFootprints),这四条正是它的样子:" +
        "\n  「她又问起北境的消息。」" +
        "\n  「你注意到她仍在留意北方。」" +
        "\n  「她终于停下脚步。」" +
        "\n  「往北那条路……我想去看看。」",
    );
  });

  it("素材已经就位,而且机制也已经做了", () => {
    /*
     * ## 这条措辞改过一次（第 453 轮）
     *
     * 它原来说「足迹文本可由 pursuit 派生 —— **缺的是机制,不是内容**」。
     * 而机制早就在了:第 409 轮补的 `data/bondFootprints` 按 ripeness 分三档吐句子,
     * 第 410 轮经 `useBondOverview.latestFootprintLine` 接进 `BondDialog`。
     *
     * 同一份文件里第 178 行那条判据一直在守「她开口」不掉回突兀 ——
     * **判据是新的，而这段说明没跟上**。这两处说的本是同一件事，
     * 一处已更新、一处没更新，读起来就自相矛盾。
     */
    for (const d of DAOLU) expect(d.pursuit.length).toBeGreaterThan(0);
    console.log(
      "\n十位道侣各有所求,足迹文本由它派生 —— 而机制也已就位:" +
        "\n  data/bondFootprints 按 ripeness 三档吐句子,经 useBondOverview 接进道侣弹窗",
    );
    for (const d of DAOLU.slice(0, 3)) console.log(`  ${d.name}:${d.pursuit}`);
  });

  it("共同事件的情境已经写明,但发生前同样没有铺垫", () => {
    console.log("\n事件      发生于");
    for (const e of BOND_EVENTS) {
      console.log(`${e.title.padEnd(8)} ${e.triggers.map((t) => TRIGGER_NAMES[t]).join("、")}`);
    }
    // 事件文本描述了当下场景,故比意图稍好 —— 但仍无「之前」
    const eventLink = LINKS.find((l) => l.surface === "共同事件出现")!;
    expect(eventLink.evidence.length).toBeGreaterThan(0);
    expect(eventLink.footprints).toBe(0);
    console.log("\n每个事件都说清了「此刻在哪」,但没有一个说得清「此前发生过什么」");
  });
});

describe("因果可感知 · 本轮的边界", () => {
  it("这份判级是我的判断,不是玩家实测", () => {
    // evidence 列的是「界面上有什么」,level 是据此推的。
    // 玩家会不会真的回想起来,只有真人玩几世才知道
    expect(LINKS.length).toBeGreaterThan(0);
    console.log(
      "\n判级依据是「界面上玩家能看到什么」,属于可核对的事实;" +
        "\n但「玩家会不会真的把因果串起来」是行为问题,本审计给不出答案。" +
        "\n\n真正的验收标准是玩家能否自己说出:" +
        "\n「她之前一直在找师父,所以这次她想往北走。」",
    );
  });

  it("结论:代码层的因果已经稳了,而足迹也已经长出一条", () => {
    /*
     * 34.1 的 907 项测试证明系统内部有因果。
     * 本审计原先证明「这些因果没有留下玩家可见的足迹」——
     * 第 409 轮补上 `bondFootprints` 之后，其中一条有了。
     *
     * 剩下的三条仍靠「弹窗常驻的说明」让玩家能推断，而不是靠过程中的痕迹。
     * 这条判据不改写成「全都好了」——它钉住现状：原因都有，足迹有一条。
     */
    expect(
      LINKS.every((l) => l.cause.length > 0),
      "有链讲不出原因 —— 那不是视觉问题",
    ).toBe(true);
    const withFootprints = LINKS.filter((l) => l.footprints > 0);
    expect(
      withFootprints.length,
      "一条有足迹的都没有 —— bondFootprints 的接线断了",
    ).toBeGreaterThan(0);
    console.log(
      `\n每条链都有真实原因(代码层已验证);其中 ${withFootprints.length}/${LINKS.length} 条` +
        "\n在过程中留下了玩家可见的足迹。其余仍靠弹窗里的常驻说明供人推断。",
    );
  });
});
