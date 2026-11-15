/**
 * 事件选项不许退化 —— 每个选择都得真的有得选
 *
 * ## 为什么这条判据此前不存在
 *
 * `core/` 下已有四个守着事件的 spec:
 *
 * ```text
 *   eventTier.spec          历练三档触发
 *   eventSupplyCurve.spec   按境界的供给（换池不是断层）
 *   eventTagSupply.spec     标签供给跟得上抽取频率
 *   eventProse.spec         正文不重复、长度够讲故事
 * ```
 *
 * 它们管的是**事件本身**：数量、供给、文字。而**选项之间**没有人管。
 *
 * ## 量出来的现状（第 375 轮）
 *
 * ```text
 *   事件 129 条 · 选项 293 个 · 每条事件都有 ≥2 个选项
 *   两个选项完全相同的事件      0 条   ← 这一条现在是干净的
 *   多选项但每条都是"必得"的    8 条   ← 其中 6 条是一次性神兽发放
 *   只有 1 个有效选项的        32 条   ← 全是「做 / 离开」型，是设计
 * ```
 *
 * 那 8 条与 32 条**都不是缺陷**:
 *
 * ```text
 *   一次性神兽发放（once:true）  同一只神兽不能发两次，故选项是"哪一只"或"悟道点"
 *   做 / 离开型                 玩家在"参不参与"上做选择，那是设计
 *   冥灯渡夜 / 一步一声钟        灵兽 vs 悟道点，两个都有真价值
 * ```
 *
 * ## 所以这条判据守什么
 *
 * 只守一件事:**同一事件里，不许有两个选项在数值上完全相同**。
 *
 * 那是唯一确定无疑的退化:玩家看到两个选项、效果一样，那个"选择"就是假的 ——
 * 而他还要为此花一次判断。现在 0 条，但没有任何东西拦着它变成 1 条。
 *
 * ## 为什么不守"每档都有随机性"
 *
 * 曾经想立一条「多选项事件必须至少有一个带随机性的选项」。量完放弃:
 *
 * ```text
 *   带随机的选项占比很高，但确有 8 条合理例外（神兽发放 / 灵兽 vs 悟道点）
 *   于是那条判据要靠一张 8 条的豁免名单才成立 —— 而豁免名单本身是负债:
 *     将来新增一条"合理例外"时，最容易的做法是往名单里塞，而不是想清楚
 * ```
 *
 * 判据要窄到**不需要豁免名单**才值得立。这一条做到了。
 */
import { describe, expect, it } from "vite-plus/test";
import { EVENTS } from "@/data/events";

interface EffectLike {
  type: string;
  id?: string;
  amount?: number;
  secs?: number;
}
interface OutcomeLike {
  weight?: number;
  effects?: EffectLike[];
}
interface ChoiceLike {
  label?: string;
  outcomes?: OutcomeLike[];
}

/**
 * 一个选项的「数值签名」——只看效果与权重，不看文案。
 *
 * 文案不同而效果全同，正是最该抓的那一种:玩家读了两句不一样的话，
 * 拿到手的东西一模一样。
 */
export function signature(choice: ChoiceLike): string {
  const outcomes = (choice.outcomes ?? []).map((o) => ({
    weight: o.weight ?? 1,
    effects: (o.effects ?? [])
      .map((f) => `${f.type}:${f.id ?? ""}:${f.amount ?? ""}:${f.secs ?? ""}`)
      .sort(),
  }));
  // 按权重排序:同一组后果写成两个不同的行序，算同一个签名
  return JSON.stringify(outcomes.sort((a, b) => a.weight - b.weight));
}

/**
 * 找出同一事件里效果完全相同的两个选项 —— 纯函数，判据与自证都调它。
 *
 * 抽出来是因为第一版把逻辑写在 `it` 里，于是"判据抓不抓得到问题"只能靠改真实数据
 * 来试；而改真实数据的一次尝试失败了（正则没对上多行格式），判据却照样显示绿 ——
 * **那说明那时我并不知道它能不能抓到东西**。
 */
export function duplicateChoices(
  events: readonly { title?: string; choices?: ChoiceLike[] }[],
): string[] {
  const offenders: string[] = [];
  for (const event of events) {
    const seen = new Map<string, string>();
    for (const c of (event.choices ?? []) as ChoiceLike[]) {
      const sig = signature(c);
      const prev = seen.get(sig);
      if (prev !== undefined) {
        offenders.push(
          `「${event.title}」:选项「${prev}」与「${c.label}」效果完全相同 —— 那个选择是假的`,
        );
      } else {
        seen.set(sig, c.label ?? "(无标签)");
      }
    }
  }
  return offenders;
}

describe("事件选项 · 不许退化", () => {
  it("扫得到选项 —— 防空转", () => {
    const total = EVENTS.reduce((n, e) => n + (e.choices?.length ?? 0), 0);
    expect(total, "一个选项都没扫到 —— 正则或数据形状变了").toBeGreaterThan(200);
  });

  it("同一事件里不许有两个数值完全相同的选项", () => {
    const offenders = duplicateChoices(
      EVENTS as unknown as { title?: string; choices?: ChoiceLike[] }[],
    );
    expect(
      offenders,
      "同一事件里的两个选项给出完全一样的后果 —— 玩家读了两句不同的话，拿到一样的东西:\n" +
        offenders.join("\n"),
    ).toEqual([]);
  });

  it("文案不同、效果相同 —— duplicateChoices 真的抓得到", () => {
    /*
     * 自证。第一版这一段只验证了 `signature` 两个值相等，**没有验证判据本身抓得到** ——
     * 而当时我拿去改真实数据的那次注入失败了，判据却照样绿。那种绿什么也不能证明。
     */
    const fake = [
      {
        title: "自证",
        choices: [
          { label: "甲", outcomes: [{ weight: 1, effects: [{ type: "stone", amount: 5 }] }] },
          { label: "乙", outcomes: [{ weight: 1, effects: [{ type: "stone", amount: 5 }] }] },
        ],
      },
    ];
    const hits = duplicateChoices(fake as never);
    expect(hits.length, "两个说法不同、给的东西一样的选项没有被抓到").toBe(1);
    expect(hits[0], "抓到了但没说清是哪两个").toContain("甲");
    expect(hits[0], "抓到了但没说清是哪两个").toContain("乙");
  });

  it("真有区别的选项不会被误判", () => {
    // 反向自证:差一个 amount，就是两个不同的选项，不许报
    const fake = [
      {
        title: "自证二",
        choices: [
          { label: "甲", outcomes: [{ weight: 1, effects: [{ type: "stone", amount: 5 }] }] },
          { label: "乙", outcomes: [{ weight: 1, effects: [{ type: "stone", amount: 9 }] }] },
        ],
      },
    ];
    expect(duplicateChoices(fake as never), "只差数值的选项被当成了重复").toEqual([]);
  });

  it("权重顺序不同但后果相同，算同一个签名", () => {
    /*
     * 同一组后果按不同顺序写出来，在游戏里是同一件事（掷到哪条后果不改总账）。
     * 若签名对顺序敏感，判据会漏掉这一类。
     */
    const one: ChoiceLike = {
      outcomes: [
        { weight: 60, effects: [{ type: "exp", secs: 30 }] },
        { weight: 40, effects: [{ type: "material", id: "ore", amount: 1 }] },
      ],
    };
    const two: ChoiceLike = {
      outcomes: [
        { weight: 40, effects: [{ type: "material", id: "ore", amount: 1 }] },
        { weight: 60, effects: [{ type: "exp", secs: 30 }] },
      ],
    };
    expect(signature(one), "权重顺序不同被当成了不同选项").toBe(signature(two));
  });
});
