/**
 * 出行方式窗的**账目文案** —— 从「这一趟有多久」到「这一趟大概带回来什么」。
 *
 * ## 由来:单位错了两个数量级
 *
 * 原先窗里每个档位写着四行:
 *
 * ```text
 * 30分
 * 预计材料 ≈ 1.9 件
 * 装备 约 3.2 趟一件 · 丹药 约 12.5 趟一枚
 * 收益 ×1 · 敌势 ×1
 * ```
 *
 * 那三个期望值来自 `core/loot` 的 `expectedMaterialsPerRun` 等,算的是**一场胜战**
 * 的掉落(它们读的 `dropEntriesFor` 就是 `afterWin` 用的那张表)。可它们摆在一个
 * 时长旁边、措辞用「趟」,读起来是「整趟所得」。而一场「寻常游历」的整趟是
 * **126 场战斗**(见 `core/explorationPlan` 的规模账)——
 *
 * * 材料:1.9 件 vs 整趟约 240 件;
 * * 装备:「约 3.2 趟一件」让玩家以为跑三趟才出一件,实际一趟出三十来件;
 * * 丹药:同理,一趟十来枚而不是十二趟一枚。
 *
 * 差的不是四舍五入,是**把每场当成了整趟**。放在出行决策窗里,这直接改变了
 * 「值不值得多花时间」这个判断。
 *
 * ## 现在的写法
 *
 * 先报这一趟的**规模**(几场、每场间隔),再分两层报产出:每场与整趟。
 * 玩家要算的是「多花一倍时间,多拿多少」,那就得让「多拿多少」是整趟的数。
 *
 * 口径:凡「场」都指交战,际遇单独报(它不交战、掉落另算)。
 */
import { EXPLORE_MODES } from "@/data/constants";
import type { ExploreMode } from "@/types";
import type { ExploreTripPlan } from "@/core/explorationPlan";
import { formatDuration } from "@/utils/format";

/**
 * 期望读数的位数:**小数量留一位,大数量取整**。坏数写「—」,不把 NaN 递到屏上。
 *
 * 「整趟约 311.2 件装备」的那个 `.2` 是假精度 —— 它来自一个本身就有 ±20% 抖动的
 * 掉落表,写成三位有效数字只会让人以为精确到件。件数跨过 100 之后取整,
 * 10 以下才保留一位(「约 3.2 场一件」这种换算率要那一位)。
 */
function countText(v: number): string {
  if (!Number.isFinite(v)) return "—";
  if (Math.abs(v) >= 100) return String(Math.round(v));
  return String(Math.round(v * 10) / 10);
}

/** 期望「几场一次」转成「整趟约几件/几枚」;命中率为 0(给不出期望)时不编数 */
function perTrip(count: number | null, battles: number): string {
  if (count === null || !Number.isFinite(count) || count <= 0) return "—";
  return countText(battles / count);
}

export interface ExploreModeRow {
  id: ExploreMode;
  name: string;
  /** 风险词(安稳/小险/大凶/极险)—— 与档位同源,不在这里另判 */
  risk: string;
  /** 这一趟的实发时长(已含灵兽性格);「30分」会变成「33分」 */
  durationText: string;
  /** 整趟交手场次 */
  battles: number;
  /** 整趟际遇次数 */
  events: number;
  /** 遭遇间隔:「约每 12 秒一场」 */
  cadenceText: string;
  /** 整趟的材料期望件数 */
  materialsPerTrip: string;
  /** 整趟的装备期望件数 */
  equipPerTrip: string;
  /**
   * 这一趟的装备期望**超过行囊能装多少** —— 超出部分当场折成器灵尘。
   *
   * 光报「整趟约 814 件」是半句话:行囊只有 120 格,而且装备进门还要过
   * 收纳裁决(自动回收 / 腾位 / 满包折算,见 core/loot 的 EQUIP_INTAKE)。
   * 玩家看到 814 会以为背包里会多出 814 件 —— 实际绝大多数变成尘进了资源账,
   * 而「变成尘」这件事此前只活在 core/loot 的注释里。
   *
   * 为 0 时不渲染这一句(短档本来装得下,加一句只是噪音)。
   */
  equipOverflow: number;
  /** 整趟的丹药期望枚数 */
  pillPerTrip: string;
  /** 每场材料期望(保留一位小数)—— 与上面同源,只是换个分母 */
  materialsPerBattle: string;
  rewardMult: number;
  dangerMult: number;
  /**
   * 这一档在**当前地界与灵兽之性**下的实发敌势总数。
   *
   * `dangerMult` 只是档位自己的倍率(normal 1 / deep 1.45 / risky 2.1),
   * 而真正落到战场上的还要乘灵兽之性与区域事件(见 `dangerFactorFor`)。
   * 从前界面把 `dangerMult` 写成「敌势 ×N」—— 带着「好战」灵兽时它恒小于实发值,
   * 玩家按 ×2.1 估算风险,实际是 ×2.42。
   */
  dangerTotal: number;
  /**
   * 敌势的来源 —— 与本次选择有关的那几项(档位 / 灵兽之性 / 区域事件)。
   *
   * `dangerMult` 是个**笼统的乘数**:玩家看到一个 ×2.1,不知道它从哪来、
   * 哪几项是自己改得动的(换档位能改,妖潮只能等)。这一栏把那笔乘法摊开。
   * 已过滤掉 ×1 的项:没做的事不必占字数。空数组表示这一档敌势没有额外来源。
   */
  foeParts: string[];
  /**
   * 「这一档我打不打得过」—— 整趟产出那些数的**前提**（见 `core/tripViability`）。
   *
   * 第 155 轮实测:新号在青云山麓选「深入探寻」,单场胜率 **0%**,
   * 而窗上仍写着「整趟约 装备 107 件」。玩家按下去几十秒后收到
   * 「你身负重伤…此行胜 0 场」—— 窗里一句提示都没有。
   *
   * 印在产出**之前**:先回答「拿得到吗」，再回答「能拿多少」。
   * `null` 表示无从估计（没有敌源可取样），此时不印这一行 ——
   * 印一句「未知」比不印更糟。
   */
  viabilityText: string | null;
  /**
   * 这一档是不是「多半走不完 / 必败」—— 模板据此把它画成朱砂色。
   *
   * 不带这个布尔，模板就得去正则匹配自己刚拼出来的那句话（「几乎必败」），
   * 那是把文案当数据用；改一个字就静默失效。
   */
  viabilityHopeless: boolean;
}

/**
 * 模式窗的四行账。
 *
 * `bucket` 是这一档的**每场**期望(= 核心那三个函数的结果,它们本来就是每场的),
 * `battles` 来自规模账 —— 两者的乘积/之比才是这一趟的读数。
 */
export function exploreModeRow(input: {
  plan: ExploreTripPlan;
  /** 每场材料期望件数 */
  materialsPerBattle: number;
  /** 每场出装备的期望「场数之一」—— 即「约 N 场一件」的那个 N */
  equipBattlesPerPiece: number | null;
  /** 每场出丹药的期望「场数之一」 */
  pillBattlesPerPiece: number | null;
  risk: string;
  /** 行囊还能再装几件(只算包里的,不算已穿在身上的) */
  bagFree: number;
  /** 敌势来源:档位 / 灵兽之性 / 区域事件 —— 已摊好的文案,空的表示都不扰动 */
  foeParts?: string[];
  /**
   * 实发敌势总数 —— 档位 × 灵兽之性 × 区域事件(与 `dangerFactorFor` 同一份乘法)。
   * 不给则退回档位自己的倍率(旧行为)。
   */
  dangerTotal?: number;
  /**
   * 这一档「打不打得过」的读数 —— 由调用方从 `core/tripViability` 算好传进来。
   *
   * 不给（或不传 `viability`）时退回旧行为:不印这一行。这样排行/文案之外的
   * 调用点（例如将来别处的预览）不会因为多了一个必填参数而一起漂。
   */
  viabilityText?: string | null;
  /** 这一档是否「多半走不完 / 必败」—— 由 `core/tripViability` 的读数给出 */
  viabilityHopeless?: boolean;
}): ExploreModeRow {
  const { plan } = input;
  const mode = EXPLORE_MODES[plan.mode];
  return {
    id: plan.mode,
    name: mode.name,
    risk: input.risk,
    foeParts: input.foeParts ?? [],
    durationText: formatDuration(plan.durationSec),
    battles: plan.battles,
    events: plan.events,
    cadenceText: `约每 ${countText(plan.cadenceSec)} 秒一场`,
    materialsPerBattle: countText(input.materialsPerBattle),
    materialsPerTrip: countText(input.materialsPerBattle * plan.battles),
    equipPerTrip: perTrip(input.equipBattlesPerPiece, plan.battles),
    equipOverflow: Math.max(
      0,
      Math.round(
        (input.equipBattlesPerPiece ? plan.battles / input.equipBattlesPerPiece : 0) -
          Math.max(0, input.bagFree),
      ),
    ),
    pillPerTrip: perTrip(input.pillBattlesPerPiece, plan.battles),
    rewardMult: mode.rewardMult,
    dangerMult: mode.dangerMult,
    dangerTotal: input.dangerTotal ?? mode.dangerMult,
    viabilityText: input.viabilityText ?? null,
    /*
     * 「必败」与「多半走不完」都要上色：前者是「按下去一事无成」，
     * 后者是「上面那些数要打掉大半」—— 两种都该在扫视时被看见。
     * 判据放在这里而不是模板里，是为了让它读同一个字段（`battleWinRate`），
     * 而不是去匹配自己拼出来的句子。
     */
    viabilityHopeless: input.viabilityHopeless ?? false,
  };
}

/**
 * 遭遇间隔 —— 四个档位共用一个数,故在列表上方报**一次**。
 *
 * 它只取决于历练速度词条(`EXPLORE_BATTLE_INTERVAL / speed`),与档位无关;
 * 写进每一行就是同一件事说四遍(见「同一件事不在首屏说三遍」)。
 * 它同时是「这一趟有多密」的换算率:玩家看到「30 分 ≈ 132 场」再看到
 * 「约每 11.2 秒一场」,两句话互相验证。
 */
export function tripCadenceText(row: ExploreModeRow): string {
  return row.cadenceText;
}

/**
 * 整趟产出的**分段**形式 —— 给模板逐段渲染用。
 *
 * 极窄档(≤220 CSS px,即 390 宽机型按 200% 放大后的 195)上,卷身只有 147px:
 * 一整句「整趟约 装备 814 件 · 丹药 203 枚 · 材料 2116 件」必然折行,
 * 而默认的折法会在「约 132 / 场」这种地方把数与量词拆开 —— 读起来是两个数。
 *
 * 故文案层给出**分句**,模板按段各占一格、各自 nowrap:折只折在「·」处。
 * 宽档仍是一行(分段之间用中点连),所以两档读到的是同一份数、
 * 同一份措辞,只是断行位置不同 —— 不是两套文案。
 */
export function tripHaulParts(row: ExploreModeRow): string[] {
  return [
    "整趟约",
    `装备 ${row.equipPerTrip} 件`,
    `丹药 ${row.pillPerTrip} 枚`,
    `材料 ${row.materialsPerTrip} 件`,
  ];
}

/**
 * 「行囊装不下」那一句 —— 整趟装备期望超过余位时才有话要说。
 *
 * 光报「整趟约 814 件」是半句话:行囊只有 120 格,装备进门还要过收纳裁决
 * (`core/loot` 的 EQUIP_INTAKE:自动回收 / 腾位 / 满包折算)。玩家看到 814
 * 会以为包里会多出 814 件,实际绝大多数当场折成器灵尘进了资源账 ——
 * 而「变成尘」这件事此前只活在 core/loot 的注释里。
 *
 * 报**差额**而不是「会折多少」:折尘数取决于品质分布(每档 1~256 尘),
 * 那是估计值,报出来就是假精度。差额是确定的减法。
 *
 * 为 0 时返回 null,模板不渲染 —— 短档本来装得下,加一句只是噪音。
 */
export function bagOverflowText(row: ExploreModeRow): string | null {
  /*
   * 差一两件不值得单独说一句 —— 那是「背包边缘」的正常摩擦,不是这一档的账:
   * 玩家自己挪一下就解决了,报出来只是噪音。197 / 700 这种量级才是真的
   * 「改档位才装得下」。
   */
  if (row.equipOverflow <= 3) return null;
  return `余 ${row.equipOverflow} 件装不下,当场折作器灵尘`;
}

/** 规模的分段形式(同上:给极窄档按句断行) */
export function tripScaleParts(row: ExploreModeRow): string[] {
  const parts = [`约 ${row.battles} 场`];
  if (row.events > 0) parts.push(`途中约 ${row.events} 次际遇`);
  return parts;
}
