/**
 * 这一趟历练**能走多远** —— 出行决策窗上那个「整趟约 N 件」的前提。
 *
 * ## 由来（第 155 轮，真浏览器里量出来的一个断崖）
 *
 * 出行模式窗四个档位各报「整趟约 装备 N 件 · 丹药 N 枚 · 材料 N 件」。这些数本身
 * 是对的（每场期望 × 场次，见 `core/explorationPlan`），但它们全都建立在
 * **「这一趟的 N 场全都打」**这个前提上 —— 而 `runBattle` 里写得很清楚:
 *
 * ```text
 * } else {
 *   cultivation.addBuff("injury", now);
 *   ...
 *   stopExploration("defeat");      ← 输一场，整趟当场结束
 * }
 * ```
 *
 * 于是一个刚建号的玩家在青云山麓看到的是:
 *
 * ```text
 * 深入探寻  1小时  约 247 场  收益 ×1.4 · 敌势 ×1.45
 *          整趟约 装备 107 件 · 丹药 27.8 枚 · 材料 445 件
 * ```
 *
 * 实测（同境界、同一地界、每档各 200 场）:
 *
 * ```text
 * major=0  寻常 99.5% | 深入 0.0% | 涉险 0.0% | 长线 0.0%
 * major=2  寻常  100% | 深入 29.5% | 涉险 0.0% | 长线 0.0%
 * major=5  寻常  100% | 深入  100% | 涉险 0.0% | 长线 0.0%
 * ```
 *
 * 也就是说:那个「107 件」在**第一场就打不过**的时候照样印在按钮上。玩家按下
 * 去，几十秒后收到一条「你身负重伤，不得不中断历练归来疗伤;此行胜 0 场…」——
 * 而窗里一句提示都没有。这不是数值问题，是**决策信息缺了一半**:
 * 「能拿多少」说了，「拿得到吗」没说。
 *
 * ## 口径
 *
 * 报两件事，都从**真实战斗**里推出来，不另写公式:
 *
 * - `surviveChance`：这一趟**打满全程**的概率。每场按同一份敌人（同地界、同危险
 *   因子、同规则）取样，胜率 p；打满 n 场的概率是 p^n（每场独立，与结算的独立掷点一致）。
 * - `expectedBattles`：**期望能打几场** —— 这是玩家真正会拿到的场次。
 *   第 k 场还活着的概率是 p^(k−1)，故期望 = Σ p^(k−1) = (1 − p^n) / (1 − p)。
 *
 * 这两件事正是「整趟约 N 件」与真值之间的换算系数:真值 ≈ 期望场次 ÷ 计划场次 × 计划产出。
 *
 * ## 为什么是纯函数、为什么抽样
 *
 * 战斗本身有随机（暴击、闪避、连击），任何解析近似都会与真打对不上。故直接调
 * `resolveCombat` —— 与 `runBattle` 同一个函数、同一份 `explorationRules()`。
 * 但**不读全局 rng**:固定种子，同一构筑两遍读数一致，且不消耗玩家进度的随机流。
 * 采样 24 场已能把「0% / 95%」这样的判断分开（该项的唯一用途就是回答
 * 「这一档我打不打得过」），而代价是每次开窗几毫秒（实测 100 场 22ms）。
 */
import type { CombatantSnap } from "@/types";
import { mulberry32, RandomService } from "@/utils/random";
import { resolveCombat } from "./combat";
import { EXPLORE_BOSS_AFTER_WINS } from "@/data/constants";

/** 每档取样场数 —— 够分开「打不过 / 勉强 / 稳」，又不至于让开窗卡顿 */
const TRIP_PROBE_SAMPLES = 24;

export interface TripViability {
  /** 普通战的单场胜率（取样值，0..1）—— 与首领分开报，两者不是一个量级 */
  battleWinRate: number;
  /** 区域之主的单场胜率；这一趟打不到第 10 胜时为 `null` */
  bossWinRate: number | null;
  /** 这一趟计划打几场（来自规模账） */
  plannedBattles: number;
  /** 期望真正被排到几场 —— 输一场就收工，故它比计划少 */
  expectedBattles: number;
  /**
   * 期望**赢**几场 —— 掉落与修为只在胜局结算（`afterWin`），故它才是
   * 「整趟约 N 件」的正确乘子。
   *
   * 与 `expectedBattles` 差一层：被排到 1 场却输了，这一趟就是 0 胜。
   * 第一版把「期望场次」当成乘子，p=0 时算出「能打 1 场」，而实际该拿 0 件东西 ——
   * 判据里那条「单场必败 → 期望 0」当场把它抓了出来。
   */
  expectedWins: number;
  /** 打满全程的概率 */
  surviveChance: number;
  /** 折算系数：真值 ≈ 计划产出 × retention = expectedWins / plannedBattles */
  retention: number;
  /**
   * 卡在哪一关 —— `boss` 表示「小怪打得过，首领打不过」。
   *
   * 这一栏是给读数用的：只报「96%」会把「首领必死」藏在一个很好看的数字后面，
   * 而玩家真实遭遇的是「打到第 10 胜就断」。
   */
  blocker: "none" | "mob" | "boss";
}

export interface TripViabilityInput {
  playerSnap: CombatantSnap;
  /** 普通战的敌人快照 —— 从本世路线取（与 `runBattle` 的 `placeContent` 同源） */
  foes: readonly CombatantSnap[];
  /**
   * 区域之主的快照 —— **必须单独给**,不许并进 `foes`。
   *
   * 本作的首领节奏是「每 `EXPLORE_BOSS_AFTER_WINS` 场胜出一位，击败即通关、
   * 此后不再出」（见 `core/engineWorld` 的 `bossRhythm: "once"`）。它在一趟里
   * 出现的次数远少于小怪，强度也不是一个量级。
   *
   * 第一版把首领塞进小怪池轮着取 —— 新号在青云山麓量出「单场 75%」，
   * 而真打起来小怪 98~100%、首领 **0%**:那个 75% 既不描述小怪也不描述首领。
   */
  boss?: CombatantSnap | null;
  /** 这一趟计划交手的场次（`ExploreTripPlan.battles`） */
  plannedBattles: number;
  /** 与在线/离线同一份战斗规则（`explorationRules()`） */
  rules?: Parameters<typeof resolveCombat>[3];
  seed?: number;
  samples?: number;
}

/**
 * 一路算到第 `planned` 场 —— **逐场推进**,不对一个平均值求幂。
 *
 * 为什么必须逐场:首领只在**第 10 胜**出现一次,而它往往和小怪差着一个量级。
 * 若把「小怪 96% + 首领 0%」平均成一个 p 再算 p^124,会得出「还能赢 23 场」——
 * 而真实情形是打到第 10 场就被首领掐断。两个数差一个数量级,而它正是
 * 「这一档我该不该按下去」的答案。
 *
 * 状态只有两个游标:已打几场(`battles`)、已胜几场(`wins`)。胜率按各自的档取:
 *
 * ```text
 * 下一场是首领:已胜 + 1 === EXPLORE_BOSS_AFTER_WINS 且首领还没被打过
 * ```
 *
 * 每场都独立掷（与 `runBattle` 的独立结算一致），故「活到第 k 场」的概率是
 * 前面每一场胜率之积 —— 逐场累乘就是它的期望形式。
 */
function simulateTrip(input: { mobRate: number; bossRate: number | null; planned: number }): {
  expectedBattles: number;
  expectedWins: number;
  surviveChance: number;
  blocker: TripViability["blocker"];
} {
  const { mobRate, bossRate, planned } = input;
  let battles = 0;
  let wins = 0;
  let alive = 1; // 「活到这一场之前」的概率
  let expectedBattles = 0;
  let expectedWins = 0;
  let bossSeen = false;
  /** 死掉的那一场是首领还是小怪 */
  let diedAt: TripViability["blocker"] = "none";

  while (battles < planned && alive > 0) {
    const isBoss = bossRate !== null && !bossSeen && wins + 1 === EXPLORE_BOSS_AFTER_WINS;
    const rate = isBoss ? bossRate : mobRate;
    // 活到这一场的概率 = 之前全胜的概率；这一场本身的期望就从它算起
    expectedBattles += alive;
    if (isBoss) bossSeen = true;
    if (rate <= 0) {
      // 必败:这一场就是终点,赢了 0 场
      diedAt = isBoss ? "boss" : "mob";
      alive = 0;
      battles += 1;
      break;
    }
    expectedWins += alive * rate;
    alive *= rate;
    battles += 1;
    wins += 1; // 只累乘「活下来」的那一支；胜场统计走上面的期望
  }
  return {
    expectedBattles,
    expectedWins,
    surviveChance: alive,
    blocker: diedAt,
  };
}

/**
 * 按「同地界、同档位、同规则」的敌人取样，推这一趟能打多远。
 */
export function tripViability(input: TripViabilityInput): TripViability {
  const planned = Math.max(0, Math.floor(input.plannedBattles));
  const hasFoes = input.foes.length > 0;
  const n = hasFoes ? Math.max(1, Math.floor(input.samples ?? TRIP_PROBE_SAMPLES)) : 0;
  const rng = new RandomService(mulberry32(input.seed ?? 20261114));
  const boss = input.boss ?? null;

  let wins = 0;
  for (let i = 0; i < n; i += 1) {
    const foe = input.foes[i % input.foes.length]!;
    // 每场传一份浅克隆：铁壁这类一次性保命会改写快照，连打会出现「第一场触发、之后失效」
    if (resolveCombat({ ...input.playerSnap }, { ...foe }, rng, input.rules).win) wins += 1;
  }
  const mobRate = n > 0 ? wins / n : 1;

  /*
   * 首领单独取样 —— 它的出场次数少,混进小怪的轮转里等于把它按小怪的频率加权。
   * 取样场数可比照小怪,因为这一项唯一的用途是「打不打得过它」这个二值判断。
   */
  let bossRate: number | null = null;
  if (boss && n > 0) {
    let bossWins = 0;
    for (let i = 0; i < n; i += 1) {
      if (resolveCombat({ ...input.playerSnap }, { ...boss }, rng, input.rules).win) bossWins += 1;
    }
    bossRate = bossWins / n;
  }

  const sim = simulateTrip({ mobRate, bossRate, planned });
  const survivalOfFull = planned === 0 ? 1 : sim.surviveChance;
  return {
    battleWinRate: mobRate,
    bossWinRate: bossRate,
    plannedBattles: planned,
    expectedBattles: Math.max(0, Math.min(planned, sim.expectedBattles)),
    expectedWins: Math.max(0, Math.min(planned, sim.expectedWins)),
    surviveChance: planned === 0 ? 1 : survivalOfFull,
    retention: planned === 0 ? 1 : Math.max(0, Math.min(1, sim.expectedWins / planned)),
    blocker:
      sim.blocker !== "none"
        ? sim.blocker
        : bossRate !== null
          ? mobRate <= 0.05
            ? "mob"
            : "none"
          : "none",
  };
}

/**
 * 把「能走多远」读成一句话 —— 决策窗上那一行。
 *
 * 三档，与 `ui/adventureText` 同一条纪律:**说结论，也说它意味着什么**。
 * 只写「胜率 0%」玩家不知道怎么用；只写「多半走不完」又不给数字。
 *
 * 返回 `null` 表示**没有结论可说**（无从估计），调用方据此不渲染这一行 ——
 * 印一句「未知」比不印更糟。
 */
export function tripViabilityText(v: TripViability): string | null {
  if (v.plannedBattles === 0) return null;
  const pct = Math.round(v.battleWinRate * 100);
  const wins = Math.max(0, Math.round(v.expectedWins));
  const planned = v.plannedBattles;

  /*
   * 文案长度是**排版约束**,不是文风偏好:它并进「收益 ×N · 敌势 ×N」那一行,
   * 而 390×844 上四档必须全部落在 637px 的卷身内。第一版每句都带档名
   * (「深入探寻：单场 96% · …」)—— 档名就在同一张卡的第一行,重复它既占宽度
   * 又占了唯一一个能把句子压在一行里的机会。实测因此把第三、四档推到 801px(卷身 776)。
   *
   * 故这一句只说**这一档没有说过的**那件事,且压在一行内。
   */

  /*
   * 小怪都打不过 —— 这是最该拦住玩家的一档。它是「按下去大概率一事无成」，
   * 而界面上其余数字（107 件 / 445 件）都还在往下印。
   */
  if (v.battleWinRate <= 0.05) {
    return `单场必败 · 整趟会在第一场结束`;
  }
  /*
   * 小怪打得过、首领打不过 —— 这一档最容易被数字骗过去:单场 96% 很好看,
   * 而真实结局是「攒到第 10 胜、撞上首领、当场结束」。
   */
  if (
    v.bossWinRate !== null &&
    v.bossWinRate <= 0.05 &&
    v.expectedWins <= EXPLORE_BOSS_AFTER_WINS
  ) {
    return `单场 ${pct}% · 打不过此地之主 · 攒到第 ${EXPLORE_BOSS_AFTER_WINS} 胜就断`;
  }
  if (v.surviveChance >= 0.5) {
    return `单场 ${pct}% · 打满全程 ${Math.round(v.surviveChance * 100)}%`;
  }
  /*
   * 「走不完」时把**期望胜场**说在前面：玩家要算的是「这一档我大概能拿多少」，
   * 而 surviveChance 很小时（例如 0.0001%）报出来只是噪音。
   */
  return `单场 ${pct}% · 多半走不完 · 预计只赢 ${wins}/${planned} 场`;
}
