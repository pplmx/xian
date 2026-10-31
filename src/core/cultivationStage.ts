export interface CultivationStageInput {
  expFull: boolean;
  breakthroughReady: boolean;
  breakthroughReason: string;
  retreating: boolean;
  injured: boolean;
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
