/**
 * 杀伐道「速战之赏」的**读数** —— 把 core 算好的档位摊成一句人话。
 *
 * ## 缺口
 *
 * 机制一直在跑(`core/daoDepth` 的三档 + `core/expedition` 的结算),而玩家侧
 * **零读数**:在途面板报「已历 N 战 · 沿途道源 +X · 携血 Y% · 杀意 N 层」,
 * 不报总回合、不报当前档位。玩家打完只知道 toast 尾巴多了一句
 * 「(含杀伐速战之赏)」,永远不知道**自己差几回合能跳下一档**。
 *
 * 这是「给决策前把数字摊开」的直接违反:速战之赏是杀伐道最值钱的一档,
 * 而它的判定输入(总回合)玩家看不见,也就无法据此决定「这一重要不要硬闯」。
 *
 * ## 为什么放在 ui 而不是视图里
 *
 * 档位阈值与赏格必须与判定同源(`SLAUGHTER_SPEED_TIERS`),视图只做接线。
 * 拼句子是展示层的事,故纯函数放这里,可直接测。
 *
 * ## 三条口径
 *
 * - **只报已进档 + 离下一档的差**,不报「还有几档」这种不可执行的信息;
 * - **差多少要能看懂**:报「每场均 N.N 回合」而不是总回合数 —— 玩家能直接影响的是
 *   每一场打多快,总回合还取决于已经打了多少场;
 * - **最高档时说「已至最速」**,不编一个「下一档 0」。
 */
import type { WorldRunState } from "@/types";
import { slaughterSpeedTierOf } from "@/core/daoDepth";

export interface SpeedTierReadout {
  /** 每场均回合数(界面要报它,玩家才知道差多少) */
  perFight: number;
  /** 当前档的赏格(0 = 一档未进) */
  bonus: number;
  /** 一句话:当前档 + 离下一档还差多少 */
  text: string;
  /** 是否已是最高档 */
  maxed: boolean;
}

/** 一位小数,去掉无意义的 `.0` */
function round1(n: number): string {
  return (Math.round(n * 10) / 10).toString();
}

/**
 * 速战之赏的读数一句话。
 *
 * `run` 为进行中的远征(要有 `totalRounds`);场数从调用方给 ——
 * 那是 `EXPEDITION_RUN_FIGHTS`,由 data 层单源提供,不在这里再写一遍。
 *
 * 非杀伐道返回 `null`:这条赏格只属于那一道,别的道途不该看到一行空读数。
 */
export function speedTierReadout(
  run: Pick<WorldRunState, "totalRounds"> | null | undefined,
  fights: number,
  daoPath: string | null | undefined,
): SpeedTierReadout | null {
  if (daoPath !== "slaughter") return null;
  if (!run) return null;
  const total = Number.isFinite(run.totalRounds) ? run.totalRounds : 0;
  const tier = slaughterSpeedTierOf(total, fights);
  if (!tier) return null;

  const perFightText = round1(tier.perFight);
  const pct = (v: number) => `${Math.round(v * 100)}%`;

  if (tier.bonus > 0) {
    // 已进档:已是最高档就没有「下一档」
    if (!tier.next) {
      return {
        perFight: tier.perFight,
        bonus: tier.bonus,
        maxed: true,
        text: `速战 ${pct(tier.bonus)}(每场均 ${perFightText} 回合,已至最速)`,
      };
    }
    return {
      perFight: tier.perFight,
      bonus: tier.bonus,
      maxed: false,
      /*
       * 报「压到 N 回合以内」。用 `<` 而不是 `≤`:判定写的是
       * `perFight < maxPerFight`,差 0.1 回合也算没过线 —— 与判定同一个不等号。
       */
      text: `速战 ${pct(tier.bonus)}(每场均 ${perFightText} 回合)· 压到 ${tier.next.maxPerFight} 回合内可至 ${pct(tier.next.bonus)}`,
    };
  }
  return {
    perFight: tier.perFight,
    bonus: 0,
    maxed: false,
    text:
      tier.next === null
        ? `速战未入档(每场均 ${perFightText} 回合)`
        : `速战未入档(每场均 ${perFightText} 回合)· 压到 ${tier.next.maxPerFight} 回合内可至 ${pct(tier.next.bonus)}`,
  };
}
