export interface CultivationStageInput {
  expFull: boolean;
  breakthroughReady: boolean;
  breakthroughReason: string;
  retreating: boolean;
  injured: boolean;
  /**
   * 已至大道尽头。
   *
   * `breakthroughReason` 在到顶时也是「已至大道尽头」——它填的是**为什么不能破**,
   * 不是「还差哪一关」。原先这里把 reason 直接当关卡名拼进 `还需过「${reason}」这一关`,
   * 于是终局玩家读到「还需过「已至大道尽头」这一关」:把终局状态当成了一道门。
   */
  atMaxRealm?: boolean;
}

export interface CultivationStage {
  key: "gate" | "full" | "injured" | "retreat" | "flow";
  label: string;
  hint: string;
}

/**
 * 修行页卷首只报一个当前阶段。
 *
 * 优先级按玩家真正能做的事排：已能破境 > 修为已满但条件未齐 > 带伤行功 >
 * 闭关加速 > 普通吐纳。闭关与伤势可能同时存在，但修为圆满时再讲加速没有意义。
 */
export function cultivationStageOf(input: CultivationStageInput): CultivationStage {
  if (input.expFull && input.breakthroughReady) {
    return {
      key: "gate",
      label: "关隘已开",
      hint: "修为圆满，破境条件已齐 —— 下一步就在下方。",
    };
  }
  if (input.expFull) {
    /*
     * 到顶和「差一关」是两件事:`breakthroughReason` 在到顶时同样有值(「已至大道尽头」),
     * 但它说的是**为什么不能破**,不是「还差哪一道门」。原先不区分,终局玩家会读到
     * 「还需过「已至大道尽头」这一关」—— 把终点当关卡。
     */
    if (input.atMaxRealm) {
      return {
        key: "full",
        label: "大道已尽",
        hint: "本境已是大道尽头，再无可破之境 —— 这一世的修行到此为止。",
      };
    }
    const reason = input.breakthroughReason.trim();
    return {
      key: "full",
      label: "修为已满",
      hint: reason
        ? `修为已到本境尽头；还需过「${reason}」这一关。`
        : "修为已到本境尽头，等待破境条件齐全。",
    };
  }
  if (input.injured) {
    return {
      key: "injured",
      label: "带伤行功",
      hint: "伤势正拖慢修炼速度，可在下方引气静养。",
    };
  }
  if (input.retreating) {
    return {
      key: "retreat",
      label: "闭关中",
      hint: "封洞静坐，闭关带来的修炼加速正在计时。",
    };
  }
  return {
    key: "flow",
    label: "吐纳中",
    hint: "修为正按此刻行速持续入账。",
  };
}
