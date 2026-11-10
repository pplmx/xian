/**
 * 战斗分析(Phase 18)—— 从战斗遥测推导「为什么输 / 表现如何」
 * 原则:解释原因、给方向,不替玩家做决定
 */
import type { CombatResult, CombatSideStats, FoeOrigin, GNum } from "@/types";
import { ratio } from "@/utils/gnum";
import { formatGN, formatPercent } from "@/utils/format";
import { BUILD_STYLES } from "./buildDetect";

export interface AnalysisFinding {
  text: string;
  /** 该问题指向的流派方向(styleId 列表,按相关度排序) */
  styleHints: string[];
}

export interface BattleAnalysis {
  headline: string;
  findings: AnalysisFinding[];
  /** 可借力的方向(排除当前主流派,至多 2 条) */
  directions: { styleName: string; reason: string }[];
  /** 硬核数据行 */
  dataRows: { label: string; value: string }[];
}

/*
 * 胜利归因的阈值。
 *
 * 与战败那边分两套:败局的阈值问「哪里出了问题」,胜局的阈值问「赢在哪」——
 * 同一个数在两侧含义不同(承伤 30% 在败局里是隐患,在胜局里是「扛得住」)。
 * 唯 `LONG_FIGHT_ROUNDS` 两侧共用:它是「鏖战」这个词的定义,不该有两个。
 */
/** 战后气血在这之上算赢得从容 */
const COMFORTABLE_HP = 0.6;
/** 战后气血在这之下算惨胜 */
const NARROW_HP = 0.25;
/** 这几回合内结束算速杀 */
const QUICK_WIN_ROUNDS = 4;
/** 闪避到这个次数值得单说 */
const DODGE_WIN_WARN = 3;
/** 暴击到这个次数值得单说 */
const CRIT_WIN_WARN = 5;

const PIERCE_SHARE_WARN = 0.35;
const MISS_RATE_WARN = 0.28;
const BIG_HIT_WARN = 0.38;
const LONG_FIGHT_ROUNDS = 30;
const LOW_HEAL_SHARE = 0.12;
const STUN_WARN = 3;

/** 有没有账可报 —— 也含「比这一层该有的还薄」这种反向的账 */
function hasAccount(o: FoeOrigin): boolean {
  return o.parts.some((p) => p.ratio !== 1) || o.damageBonus > 0 || o.damageReduction > 0;
}

/** 敌人是不是真的占了便宜(更厚、或增伤减伤不为零)—— 决定要不要在败因里点名 */
function hasEdge(o: FoeOrigin): boolean {
  return o.ratio > 1 || o.damageBonus > 0 || o.damageReduction > 0;
}

/**
 * 归因原文截一句,给方向引用。
 *
 * 归因有时很长(「敌之加成(道之理解):道之理解 ×1.42;境界压制 增伤 +25%;判定随你的
 * 厚度与境界而来……」),整句搬到方向里会把那一栏撑爆。取第一个分句即可 ——
 * 它通常就是那条病因的骨架,后半段是解释与劝告。
 */
function clipEvidence(text: string): string {
  const head = text.split(/[;:。]/)[0] ?? text;
  return head.length > 28 ? `${head.slice(0, 28)}…` : head;
}

/** 倍数用两位小数:1.113^20 这种数写成 1.9 与写成 1.87 对玩家是两回事 */
const ratioText = (n: number): string => `×${(Math.round(n * 100) / 100).toFixed(2)}`;

function originPartText(part: FoeOrigin["parts"][number]): string {
  const effects: string[] = [];
  if ((part.damageBonus ?? 0) > 0) effects.push(`增伤 +${Math.round(part.damageBonus! * 100)}%`);
  if ((part.damageReduction ?? 0) > 0)
    effects.push(`减伤 +${Math.round(part.damageReduction! * 100)}%`);
  return `${part.label} ${ratioText(part.ratio)}${effects.length ? `(${effects.join(" · ")})` : ""}`;
}

/** 各项来源摊成一行:「层级补偿 ×1.90 · 境界压制 ×1.24(增伤 +32% · 减伤 +12%)」 */
export function foeOriginPartsText(origin: FoeOrigin): string {
  return origin.parts
    .filter((p) => p.ratio !== 1)
    .map(originPartText)
    .join(" · ");
}

/**
 * 敌人加成的账目 —— 哪几件事、各乘了多少。
 *
 * 与「先手判定」同一条纪律:把式子摊开,而不是给一句「敌人很强」。
 * 空数组表示这只敌人身上没有额外加成(中性),调用方据此决定要不要占字数。
 */
export function foeOriginLines(origin: FoeOrigin | undefined): string[] {
  if (!origin || !hasAccount(origin)) return [];
  const lines: string[] = [];
  for (const p of origin.parts) {
    if (p.ratio === 1) continue;
    lines.push(originPartText(p));
  }
  const partDamageBonus = origin.parts.reduce((sum, p) => sum + Math.max(0, p.damageBonus ?? 0), 0);
  const partDamageReduction = origin.parts.reduce(
    (sum, p) => sum + Math.max(0, p.damageReduction ?? 0),
    0,
  );
  if (origin.damageBonus - partDamageBonus > 1e-9)
    lines.push(`${origin.label} 增伤 +${Math.round(origin.damageBonus * 100)}%`);
  if (origin.damageReduction - partDamageReduction > 1e-9)
    lines.push(`${origin.label} 减伤 +${Math.round(origin.damageReduction * 100)}%`);
  if (origin.note) lines.push(origin.note);
  return lines.length > 0 ? lines : [`${origin.label} ${ratioText(origin.ratio)}`];
}

/** 一行读数:「三维 ×1.87(层级补偿 ×1.90 · 危地 ×0.98)」 */
export function foeOriginRow(origin: FoeOrigin): { label: string; value: string } {
  if (!hasAccount(origin)) return { label: "敌之加成", value: "无" };
  const detail = foeOriginPartsText(origin);
  const extras: string[] = [];
  const partDamageBonus = origin.parts.reduce((sum, p) => sum + Math.max(0, p.damageBonus ?? 0), 0);
  const partDamageReduction = origin.parts.reduce(
    (sum, p) => sum + Math.max(0, p.damageReduction ?? 0),
    0,
  );
  if (origin.damageBonus - partDamageBonus > 1e-9)
    extras.push(`增伤 +${Math.round(origin.damageBonus * 100)}%`);
  if (origin.damageReduction - partDamageReduction > 1e-9)
    extras.push(`减伤 +${Math.round(origin.damageReduction * 100)}%`);
  const head = `三维 ${ratioText(origin.ratio)}${detail ? `(${detail})` : ""}`;
  return { label: "敌之加成", value: [head, ...extras].join(" · ") };
}

function share(part: GNum, whole: GNum): number {
  if (whole.m === 0) return 0;
  return Math.max(0, Math.min(1, ratio(part, whole)));
}

/** 硬核数据面板行(胜负皆可看) */
export function battleDataRows(result: CombatResult): { label: string; value: string }[] {
  const s = result.stats;
  if (!s) return [];
  const p = s.player;
  const attempts = p.hitsLanded + p.missedHits;
  const rows: { label: string; value: string }[] = [
    // 先手放第一行:它决定了整场的节奏,而且是一条**阈值**判定 —— 两个数摆出来,玩家才知道自己差在哪
    ...(result.firstMove ? [firstMoveRow(result)] : []),
    // 敌之加成紧随其后:它解释的是「这一场为什么比上一场难」,与先手同属"战前就定下的数"
    ...(result.foeOrigin ? [foeOriginRow(result.foeOrigin)] : []),
    // 战局中渐涨的那一个:与上面两行不同,它是"打着打着变难"——单独一行,别混进战前的账
    ...(atkRampRow(result) ? [atkRampRow(result)!] : []),
    { label: "总输出", value: formatGN(p.dealt) },
    { label: "总承伤", value: formatGN(p.taken) },
    { label: "真伤承伤占比", value: formatPercent(share(p.pierceTaken, p.taken)) },
    { label: "单次最大承伤", value: formatGN(p.biggestHitTaken) },
    { label: "治疗量", value: formatGN(p.healed) },
    { label: "护盾吸收", value: formatGN(p.shieldAbsorbed) },
    { label: "命中 / 落空", value: `${p.hitsLanded} / ${p.missedHits}` },
    { label: "暴击 / 连击 / 反击", value: `${p.crits} / ${p.combos} / ${p.counters}` },
    { label: "神通 / 法宝触发", value: `${p.skillCasts} / ${p.artifactProcs}` },
  ];
  if (attempts === 0) return rows.slice(0, 6);
  return rows;
}

/**
 * 先手判定的读数与差额。
 *
 * 一律用**显示出来的那两个数**算差额(先各留两位再相减):显示 1.02 与 1.10 却报「还差 9%」
 * 会让人对着数字算不明白 —— 浮点误差不该出现在玩家读的那句话里。
 */
function firstMoveReadout(result: CombatResult): {
  playerSpeed: number;
  enemySpeed: number;
  gapPct: number;
  text: string;
} {
  const f = result.firstMove!;
  const playerSpeed = Math.round(f.playerSpeed * 100) / 100;
  const enemySpeed = Math.round(f.enemySpeed * 100) / 100;
  const gapPct = Math.max(0, Math.round((enemySpeed - playerSpeed) * 100));
  return {
    playerSpeed,
    enemySpeed,
    gapPct,
    text: f.playerFirst
      ? `你抢先 ${playerSpeed.toFixed(2)} ≥ 敌 ${enemySpeed.toFixed(2)}`
      : `敌先动(你 ${playerSpeed.toFixed(2)} < 敌 ${enemySpeed.toFixed(2)})`,
  };
}

/** 先手判定的读数行:「你 1.06 ≥ 敌 1.05」比「出手速度 +6%」诚实得多 */
function firstMoveRow(result: CombatResult): { label: string; value: string } {
  return { label: "先手", value: firstMoveReadout(result).text };
}

/**
 * 「每隔 N 回合」把敌人攻势抬到了几倍。
 *
 * 与先手判定同一条纪律(见 `foeOriginLines` 的注释:把式子摊开,而不是给一句
 * 「敌人很强」)。这条规则在 `core/combat` 里真的乘进了伤害
 * (`dmg = attack × factor × atkRamp`),但那个值此前从不带出战斗 ——
 * 玩家只能从战报里一句「敌人杀意亦涨」去猜涨了多少。
 *
 * 长战里它可能到 1.5 倍以上(实测 6 回合的对局触发 3 次 × 每印 +15% = 1.45 倍),
 * 而玩家读到的是同一句「医气与护盾俱增;敌人杀意亦涨」—— 涨到几倍没有数字。
 */
function atkRampRow(result: CombatResult): { label: string; value: string } | null {
  const r = result.atkRamp;
  if (!r || r.procs <= 0) return null;
  // 倍率留两位:显示与算式同一个数(与 firstMoveReadout 同一条口径)
  const factor = Math.round(r.factor * 100) / 100;
  return {
    label: "敌势渐涨",
    value: `${formatPercent(factor - 1, 0)} 伤害(触发 ${r.procs} 次,累计 ×${factor.toFixed(2)})`,
  };
}

/**
 * 被抢先时给一条**可行动**的解释:还差多少能跨过对手那一线。
 *
 * 「出手速度 +6%」这种写法会让人以为多打一点就多赚一点;真相是差一点就完全没有。
 * 故这里把差额直接换算成词条还差几个百分点 —— 解释原因、给方向,不替玩家做决定。
 */
function firstMoveFinding(result: CombatResult): AnalysisFinding[] {
  const f = result.firstMove;
  if (!f || f.playerFirst) return [];
  const { playerSpeed, enemySpeed, gapPct: gap } = firstMoveReadout(result);
  if (gap <= 0) return [];
  return [
    {
      text: `先手判定是一条阈值:你 ${playerSpeed.toFixed(2)} < 敌 ${enemySpeed.toFixed(2)},被对手抢了先。先手类词条再凑 ${gap}% 即可跨过这条线(跨过即抢先,不必堆更多)。`,
      styleHints: ["fengmang"],
    },
  ];
}

/**
 * 敌人加成的归因 —— 败北时把「它凭什么这么难」摊开讲。
 *
 * 这解释的是**战前就定下的数**,不是临场失手:故与先手判定同列在最前,
 * 且**只在真有加成时出现**(中性判定不占字数,更不该替玩家的败因背锅)。
 */
function foeOriginFinding(result: CombatResult): AnalysisFinding[] {
  const o = result.foeOrigin;
  // 只报「敌人占了便宜」的那一半:比该有的还薄是好事,不必占败因的字数
  if (!o || !hasEdge(o)) return [];
  const lines = foeOriginLines(o);
  if (lines.length === 0) return [];
  /*
   * 天界的判定要带**方向**,不能只带病因。
   *
   * 「道之理解」是按玩家的**厚度**加厚敌人(`celestialDepthScale` 越厚倍率越大),
   * 「境界压制」是按境界差增伤 —— 两者都有明确的出路:前者对薄、后者破境。
   * 那句话本来就在 `origin.note` 里(`JUDGEMENT_DIRECTION`),于是它被
   * `foeOriginLines` 拼进了这一条的**正文**,混在「病因」的语气里。
   *
   * 而界面把 `findings` 当病因段渲染(`BattleIntelPanel` 用 · 起头一行行排),
   * 方向另有专门一段(标题写着「可借力的方向(非唯一解)」)。结果是:
   * 玩家在天界败局里读到的最后一句其实是劝告,却没有「这是劝告」的标签 ——
   * 而 `directions` 那一栏在天界场景下几乎永远是空的。
   *
   * 故这里把方向**同时**挂到 `styleHints`(走专门的 directions 段)——
   * 薄构筑那一侧:背水(以伤换力)、沐泽(久战不衰)都不靠堆厚度取胜。
   * 文案本身仍留在 findings 里:删掉它会让「只读病因段」的人失去那句解释。
   */
  const judged = o.label.includes("判定") || o.note?.includes("判定随你的厚度");
  return [
    {
      text: `敌之加成(${o.label}):${lines.join(";")}`,
      styleHints: judged ? ["beishui", "muze"] : [],
    },
  ];
}

/**
 * 胜利归因 —— 赢了也要说清「靠什么赢的」。
 *
 * ## 为什么胜利也要归因
 *
 * 战败时玩家自己会去翻分析(他要找原因);胜利时他没这个动机,而这恰恰是
 * **最该学到东西的一刻**:这一场靠什么赢下来的,下一场换个地界还能不能这么打。
 * 同一个面板,败了有归因、赢了只有一句「此战 N 回合而胜」,读起来像「赢了没什么好说的」。
 *
 * ## 每一条都由读数支撑
 *
 * 不许写「你很稳」这种形容词 —— 那谁都会说。每条都落到 `result` 里现成的事实上:
 * 回合数、战后气血、承伤占比、有没有被抢先、闪避与暴击次数。读不出支撑就干脆不写,
 * 宁可少一条也不编。
 *
 * ## 与战败归因同一套形状
 *
 * 只填 `text` 与 `styleHints`(界面已按 `findings` 渲染),不新增字段、不改界面。
 */
function victoryFindings(
  p: CombatSideStats,
  e: CombatSideStats,
  rounds: number,
  hpPct: number,
  firstMoveLoss: boolean,
): AnalysisFinding[] {
  const findings: AnalysisFinding[] = [];

  /*
   * 战后气血是最硬的一条:它把「完胜」与「惨胜」分开。
   * 两档之间不留空档 —— 要么说赢得从容,要么说赢得惊险;中间那档不置评。
   */
  if (hpPct >= COMFORTABLE_HP) {
    findings.push({
      text: `战后气血 ${formatPercent(hpPct, 0)} —— 这一场没怎么伤到你`,
      styleHints: ["gangdun", "lianji"],
    });
  } else if (hpPct <= NARROW_HP) {
    findings.push({
      text: `战后只剩 ${formatPercent(hpPct, 0)} 气血 —— 险胜,下一场未必还有这份运气`,
      styleHints: ["beishui", "muze"],
    });
  }

  /*
   * 短战是「出手就被压住」的证据;长战则是另一种结论(靠耐打拖赢)。
   * 两个阈值与战败那边同一套常量,免得同一场战斗胜败两侧口径不一。
   */
  if (rounds <= QUICK_WIN_ROUNDS) {
    findings.push({
      text: `${rounds} 回合结束 —— 压制期里没给它翻身的机会`,
      styleHints: ["lianji", "cangfeng"],
    });
  } else if (rounds >= LONG_FIGHT_ROUNDS) {
    findings.push({
      text: `鏖战 ${rounds} 回合才拿下 —— 这一场是靠撑住赢的,不是靠速杀`,
      styleHints: ["gangdun", "beishui"],
    });
  }

  /*
   * 被抢先却还赢 —— 那是整场真正的翻盘点,比任何伤害占比都值得说。
   * (与战败那边 `firstMoveFinding` 同一个事实,只是结论相反。)
   */
  if (firstMoveLoss) {
    findings.push({
      text: `被抢先却还是赢了下来 —— 这一场的翻盘点在这里`,
      styleHints: ["lianji", "cangfeng"],
    });
  }

  // 闪避够多时把次数摆出来:它是「为什么战后气血还这么高」的一个具体解释
  if (p.dodges >= DODGE_WIN_WARN) {
    findings.push({
      text: `闪过 ${p.dodges} 次 —— 少挨的这几下换成了战后气血`,
      styleHints: ["cangfeng"],
    });
  }

  // 暴击够多同理:它是「为什么打得这么快」的解释
  if (p.crits >= CRIT_WIN_WARN) {
    findings.push({
      text: `暴击 ${p.crits} 次 —— 输出压在暴击上是这几回合解决的原因`,
      styleHints: ["lianji"],
    });
  }

  /*
   * 承伤里真伤占比高、却还是赢了:这是「护体挡不住,但你扛住了」——
   * 与战败那边同一读数,结论不同。只在占比高时才说,低占比不值一提。
   */
  const pierceShare = share(p.pierceTaken, p.taken);
  if (pierceShare >= PIERCE_SHARE_WARN) {
    findings.push({
      text: `真伤占了承伤的 ${formatPercent(pierceShare, 0)},护体没挡住的部分你硬吃了下来`,
      styleHints: ["gangdun", "beishui"],
    });
  }

  // 一次归因都没攒出来时不硬凑:空数组让界面整段不出
  void e;
  return findings;
}

function defeatFindings(p: CombatSideStats, maxHpProxy: GNum, rounds: number): AnalysisFinding[] {
  const findings: AnalysisFinding[] = [];
  const pierceShare = share(p.pierceTaken, p.taken);
  if (pierceShare >= PIERCE_SHARE_WARN) {
    findings.push({
      text: `真伤占总承伤 ${formatPercent(pierceShare, 0)},护盾与减伤被绕过`,
      styleHints: ["muze", "beishui"],
    });
  }
  const attempts = p.hitsLanded + p.missedHits;
  const missRate = attempts > 0 ? p.missedHits / attempts : 0;
  if (missRate >= MISS_RATE_WARN) {
    findings.push({
      text: `${p.missedHits} 次出手落空(落空率 ${formatPercent(missRate, 0)}),连击与暴击难以衔接`,
      styleHints: ["gangdun", "muze"],
    });
  }
  const bigShare = share(p.biggestHitTaken, maxHpProxy);
  if (bigShare >= BIG_HIT_WARN) {
    findings.push({
      text: `单次重击最高打掉你 ${formatPercent(bigShare, 0)} 气血,硬抗不是办法`,
      styleHints: ["gangdun", "lianji"],
    });
  }
  if (rounds >= LONG_FIGHT_ROUNDS && share(p.healed, p.taken) < LOW_HEAL_SHARE) {
    findings.push({
      text: `鏖战 ${rounds} 回合却几乎没有回复,久战无以为继`,
      styleHints: ["muze", "beishui"],
    });
  }
  if (p.stunnedTurns >= STUN_WARN) {
    findings.push({
      text: `${p.stunnedTurns} 个回合被震慑打断,节奏尽失`,
      styleHints: ["gangdun"],
    });
  }
  return findings;
}

/**
 * 战斗分析
 * @param currentStyleId 当前主流派(用于排除自荐)
 */
export function analyzeBattle(
  result: CombatResult,
  currentStyleId: string | null,
): BattleAnalysis | null {
  const s = result.stats;
  if (!s) return null;
  const dataRows = battleDataRows(result);
  if (result.win) {
    /*
     * 胜利也要归因 —— 赢了正是最该学到东西的一刻(战败时玩家自己会去翻原因,
     * 胜利时他没这个动机)。见 `victoryFindings` 的注释。
     *
     * 归因有据才写:`p` / `e` 都来自战报遥测,读不出就是空数组,界面整段不出。
     */
    const pw = s.player;
    const firstMoveLoss = result.firstMove ? !result.firstMove.playerFirst : false;
    return {
      headline: `此战 ${result.rounds} 回合而胜,战后气血 ${Math.round(result.playerHpPct * 100)}%`,
      findings: victoryFindings(pw, s.enemy, result.rounds, result.playerHpPct, firstMoveLoss),
      /*
       * 方向建议只在战败时给 —— 胜局没有「该改什么」的问题,
       * 硬推一条构筑建议等于劝玩家换掉一套刚赢下来的打法。
       */
      directions: [],
      dataRows,
    };
  }
  // 用 taken+healed 近似血量池(承伤超过血池才落败)
  const p = s.player;
  // 被抢先排在最前:它解释的是「整场节奏为什么在对方手里」,比逐项伤害占比更靠前
  const findings = [
    ...foeOriginFinding(result),
    ...firstMoveFinding(result),
    ...defeatFindings(p, p.taken, result.rounds),
  ];
  /*
   * 方向不是「换个流派试试」——**每条方向都要说清它是冲着哪条病因去的**。
   *
   * 此前 `reason` 直接取流派的固定 `desc`(「生生不息,久战不衰;惧雷霆一击」)。
   * 那是这条流派的自我介绍,不是「它为什么能解**你这一场**的困」:
   * 同一句 desc 在「被真伤打穿」和「被先手压制」两种败局里会出现两次,
   * 而它对这两个问题的相关性完全不同。玩家读到的是流派广告,不是处方。
   *
   * 现在把触发它的那条归因原文带上(截断到一句),方向就成了
   * 「背水流 —— 因为「真伤占总承伤 75%」」。`styleHints` 的第一位权重最高
   * (见下面的 `2 - idx`),那一份证据正是最该被引用的。
   */
  const hintCount = new Map<string, { score: number; evidence: string }>();
  for (const f of findings) {
    f.styleHints.forEach((id, idx) => {
      if (id === currentStyleId) return;
      const weight = 2 - idx;
      const prev = hintCount.get(id);
      if (!prev || weight > prev.score) {
        hintCount.set(id, { score: (prev?.score ?? 0) + weight, evidence: f.text });
      } else {
        prev.score += weight;
      }
    });
  }
  const directions = [...hintCount.entries()]
    .sort((a, b) => b[1].score - a[1].score)
    .slice(0, 2)
    .map(([id, info]) => {
      const style = BUILD_STYLES.find((x) => x.id === id)!;
      return {
        styleName: style.name,
        reason: `${style.desc} —— 冲着「${clipEvidence(info.evidence)}」去的`,
      };
    });
  return {
    headline: `败于第 ${result.rounds} 回合`,
    findings:
      findings.length > 0
        ? findings
        : [{ text: "并无明显短板,只是道行尚浅——修为与装备再进一步即可", styleHints: [] }],
    directions,
    dataRows,
  };
}
