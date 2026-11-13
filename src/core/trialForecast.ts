/**
 * 试炼之前先看这一场 —— 「这一门我打不打得过」。
 *
 * ## 由来（第 156 轮）
 *
 * 天界试炼要押 **15 道源**入场，而界面上只写着「道源 15 · 首破得 52」。
 * 打不打得过、会止步第几战，玩家在付钱**之前**一个字都看不到 —— 付完才在战报里
 * 读到「止步第 4 战」。这与上一轮历练出行窗那个坑是同一个形状:
 * **报代价、报赏格，不报把握。**
 *
 * 更值得记的是：天机道的 `deepText` 明写着「天机透视:远征启程前，可窥见敌人招式
 * 明细与此战胜算」，而 `previewFight` 只接了**远征**（`ExpeditionPanel` 三处），
 * 试炼一处都没有 —— 一条已经写在道途章法里的承诺，在试炼这一册上是空的。
 *
 * ## 为什么这里可以报**精确**结果，而不是估计
 *
 * 试炼的种子是定死的：
 *
 * ```ts
 * const trialRng = new RandomService(mulberry32(seedOf(trial.id, 0)));
 * ```
 *
 * （见 `core/endgameService` 的 `challengeTrial` —— 押道源的战斗都按「打的是哪一场」
 * 定种，「同界同契同变数」重打两次结果必须一致。实测连打两次，`fightsWon` 与
 * `totalRounds` 逐位相同。）
 *
 * 所以预览**不是**「估算胜率」，而是把同一套输入在同一个种子上跑一遍：
 * 会止步第几战、打掉几回合，与真打**逐位相同**。这一点必须说清楚 ——
 * 报「约七成胜算」是估，报「止步第 4 战」是事实，两者的可信度不是一回事。
 *
 * ## 一条纪律:预览与真打必须同源，且这一层**不碰 store**
 *
 * 这里**不复制** `challengeTrial` 的组装逻辑，而是把两者共同的那一段抽出来
 * (`trialLineup`) —— 敌人序列、逐胜叠层、种子，一处定义两处用。
 * 若各自写一份，改平衡那天预览与真打就分叉，而分叉的方向是玩家吃亏。
 *
 * 但**读 store 的那一半留在调用方**：`core` 有一条分层纪律（`core/layeringAudit.spec`）
 * ——core 里 import store 的模块要点名登记，且只许减不许增。第一版这里直接读了
 * `usePlayerStore` / `useEndgameStore`，当场被那三条判据按住（新增模块、新增处数、
 * 还牵出一个 `endgameService` 与 `trialForecast` 之间的静态导入环）。
 *
 * 这其实是那条纪律**替我做对了一个决定**：预览的输入（玩家三维、道途、当前规则）
 * 全部可以由调用方给，纯模块因此可测、也能被两处共用而不反向依赖。
 * 故 `trialLineup` 收的是**值**而不是 store。
 */
import type { CombatRules, CombatantSnap, StatMods } from "@/types";
import { mulberry32, RandomService } from "@/utils/random";
import { TRIAL_FOES, trialDef } from "@/data/endgame";
import type { TrialDef } from "@/types";
import { runGauntlet } from "./gauntlet";
import { celestialJudgement, worldFoeSnap, type ReferenceStats } from "./gauntlet";
import { SWORD_PER_WIN, SLAUGHTER_PER_WIN } from "./daoDepth";

/**
 * 一场试炼的完整输入 —— 预览与真打共用这一份。
 *
 * @returns 试炼不存在时返回 `null`（调用方据此不渲染，而不是印一个空的预览）
 */
export function trialLineup(input: {
  trialId: string;
  /** 玩家天界三维（`player.celestialStats`）—— 由调用方取 */
  ref: ReferenceStats;
  /** 玩家天界词条（同上） */
  mods: StatMods;
  playerMajor: number;
  /** 已择道途 id（`endgame.daoPath`） */
  daoPath: string | null;
}): {
  trial: TrialDef;
  foes: CombatantSnap[];
  perWinPlayerMods: StatMods | undefined;
  seed: number;
} | null {
  const trial = trialDef(input.trialId);
  if (!trial) return null;
  const judgement = celestialJudgement(input.mods, input.playerMajor, trial.anchorTier);
  const foes: CombatantSnap[] = [];
  for (let i = 0; i < trial.fights; i += 1) {
    foes.push(
      worldFoeSnap(
        TRIAL_FOES[i % TRIAL_FOES.length]!,
        input.ref,
        Math.pow(trial.escalation, i),
        judgement,
      ),
    );
  }
  const perWin =
    input.daoPath === "sword"
      ? SWORD_PER_WIN
      : input.daoPath === "slaughter"
        ? SLAUGHTER_PER_WIN
        : undefined;
  return { trial, foes, perWinPlayerMods: perWin, seed: seedOf(trial.id, 0) };
}

/**
 * 押道源的战斗的种子 —— 与 `core/endgameService` 的 `seedOf` **同一个算法**。
 *
 * 抽到这里是因为预览也要用它:两边各写一份、改了一边,预览就会开始说
 * 「止步第 4 战」而真打止步第 3 战 —— 那种分叉玩家会当成「预览在骗人」。
 * 判据 `trialPreview.spec` 逐位比对两边的结果来钉住这一点。
 */
export function seedOf(targetId: string, life: number): number {
  let h = 0x5eed;
  for (let i = 0; i < targetId.length; i += 1) {
    h = Math.imul(h ^ targetId.charCodeAt(i), 2654435761);
  }
  return (h ^ Math.imul(life + 1, 0x9e3779b1)) >>> 0;
}

export interface TrialForecast {
  cleared: boolean;
  /** 打赢了几场 */
  fightsWon: number;
  /** 共几场 */
  fights: number;
  /** 通过时要打几回合（未通过时为已打出的回合） */
  totalRounds: number;
  /** 止步于第几战（通过时为 null） */
  lostAt: number | null;
  /** 首破道源（未破过时），已破过则为 0 —— 与 `challengeTrial` 的发赏口径一致 */
  firstClearReward: number;
}

/**
 * 试炼预览 —— 在**同一个种子**上把同一套输入跑一遍。
 *
 * 纯函数:输入由调用方给（玩家快照、规则、道途、是否已破），故它既不读 store
 * 也不写 store —— 不扣道源、不记战绩、不发赏。
 */
export function forecastTrial(input: {
  trialId: string;
  /** 玩家天界快照 —— `buildPlayerSnap(true)`，由调用方取 */
  playerSnap: CombatantSnap;
  ref: ReferenceStats;
  mods: StatMods;
  playerMajor: number;
  daoPath: string | null;
  /** 与真打同一份规则（道途 × 试炼）—— 由调用方从 `currentDaoRules` 合成 */
  rules: CombatRules | undefined;
  /** 这一门是否已经破过 —— 首破赏只在没破过时给 */
  alreadyCleared: boolean;
}): TrialForecast | null {
  const lineup = trialLineup(input);
  if (!lineup) return null;
  const rng = new RandomService(mulberry32(lineup.seed));
  const report = runGauntlet(
    input.playerSnap,
    lineup.foes,
    input.rules,
    lineup.trial.healBetweenPct,
    rng,
    {
      perWinPlayerMods: lineup.perWinPlayerMods,
    },
  );
  return {
    cleared: report.cleared,
    fightsWon: report.fightsWon,
    fights: lineup.trial.fights,
    totalRounds: report.totalRounds,
    lostAt: report.cleared ? null : report.fightsWon + 1,
    firstClearReward: report.cleared && !input.alreadyCleared ? lineup.trial.rewardDaoSource : 0,
  };
}

/**
 * 把预览读成一句话。
 *
 * 三档，与历练出行窗那条读数同一族：**先答「过得去吗」，再答多少**。
 * 返回 `null` 表示没有结论可说（试炼不存在），调用方据此不渲染。
 */
export function trialForecastText(f: TrialForecast): string | null {
  if (f.cleared) {
    return `照此刻的构筑：可破 —— ${f.fights} 战全胜，约 ${f.totalRounds} 回合`;
  }
  /*
   * 止步第几战必须说。那是玩家唯一能据以改构筑的读数:
   * 「止步第 4 战」意味着前三战都过得了,差的是后段;只写「打不过」等于没说。
   */
  return `照此刻的构筑：止步第 ${f.lostAt} 战（${f.fights} 战中过 ${f.fightsWon} 战）—— 道源照扣`;
}
