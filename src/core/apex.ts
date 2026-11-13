/**
 * 终局 —— 「已至大道尽头」之后,这一世还剩下什么。
 *
 * ## 这个模块存在的理由
 *
 * 上一轮修到顶的显示时发现:`atMaxRealm` 在整个仓库里**只有那几处「改口」在引用**
 * (`breakthrough` 的 targetLabel、`goal` 的突破目标、`cultivationStage`、破境卡)。
 * 没有任何内容、入口或形态是到顶才有的 —— 终局只是一堆「没有了」,不是一个阶段。
 *
 * 玩家走到混沌道祖·圆满之后,看到的仍是**一整套为突破准备的版式**:破境卡占着
 * 视觉中心、闭关与观象列在它下面、首页的长期道途还指着某个早已过去的境界。
 * 而实际上这一刻能做的事一点不少(天界四册、器魂两处门径、三生录、转世),
 * 没有一处告诉他。
 *
 * 本模块把「终局是一些什么」收成一份可判据的读数,UI 只负责画:
 *
 *   · **终点读数**(`apexRecord`)—— 这一世到底走到了哪里、用了多久、破了几个界;
 *   · **还能做什么**(`apexPursuits`)—— 到此刻仍然开着的去处,按「还差多少」排;
 *   · **终局印记**(`APEX_MILESTONE`)—— 到顶这一刻该被记下的那一枚。
 *
 * ## 一条纪律:读数不另算
 *
 * 这里出现的每个数都有既有来源 —— 世数取 `player.reincarnation.count`、
 * 境界取 `player.major/sub`、里程碑与道痕取 endgame store、转世门槛取
 * `MANUAL_REBIRTH_MIN_MAJOR`。本模块**不持第二份账**,只做「到顶时的取景与排序」。
 */
import { MAX_MAJOR, realmDef, realmLabel } from "@/data/realms";
import { DAO_PATHS, TRIALS } from "@/data/endgame";
import { MILESTONE_TOTAL, PROFILE_MIN_MARKS } from "@/core/identity";

export interface ApexRecord {
  /** 当前境界名(「混沌道祖·圆满」) */
  realmLabel: string;
  /** 这一世是第几世 */
  life: number;
  /** 跨过了几个界域(人间 / 仙 / 神 / 混沌) */
  worldsCrossed: number;
  /** 一生到过多少处地界以外的东西:道痕则数 */
  marks: number;
  /** 已达成里程碑数 / 全部里程碑数 */
  milestones: { done: number; total: number };
  /** 修行画像是否已成形(不足 PROFILE_MIN_MARKS 则不成形) */
  profileFormed: boolean;
}

/** 这一世的终点读数 —— 只取既有来源,不另算 */
export function apexRecord(input: {
  major: number;
  sub: number;
  life: number;
  marks: number;
  milestonesDone: number;
}): ApexRecord {
  return {
    realmLabel: realmLabel(input.major, input.sub),
    life: input.life,
    /*
     * 跨界数读**境界表**而不是写死 4:人间 / 仙界 / 神界 / 混沌海四界是按
     * `worldOf(major)` 分段的,将来加界不用回来改这一句。
     */
    worldsCrossed: new Set(
      Array.from({ length: input.major + 1 }, (_, m) => Math.min(MAX_MAJOR, m)).map(
        (m) => realmDef(m).world,
      ),
    ).size,
    marks: input.marks,
    milestones: { done: input.milestonesDone, total: MILESTONE_TOTAL },
    profileFormed: input.marks >= PROFILE_MIN_MARKS,
  };
}

/**
 * 到顶之后仍然开着的去处。
 *
 * 这不是「所有入口」的清单 —— 只收**终局玩家真正还能推进**的那几处,
 * 每一条都要能回答「去了之后做什么」。排序按「离做完还差多少」:
 * 已经全做完的沉底(它们仍然可以回看,但不再是待办)。
 */
export interface ApexPursuit {
  id: "dao" | "expedition" | "trial" | "soul" | "legacy" | "rebirth";
  /** 去处名(「道途与门径」) */
  name: string;
  /** 一句话:去了之后做什么 */
  hint: string;
  /** 进度读数(「0/8 道」);无进度概念时为 null */
  progress: string | null;
  /** 还没做完 */
  pending: boolean;
  /** 去哪(路由) */
  route: string;
}

export function apexPursuits(input: {
  daoChosen: string | null;
  clearedTrials: number;
  trialTotal: number;
  soulsEquipped: number;
  marks: number;
  canRebirth: boolean;
}): ApexPursuit[] {
  const out: ApexPursuit[] = [
    {
      id: "dao",
      name: "道途与门径",
      hint: input.daoChosen
        ? "此世道途已定 —— 去天界看它的代价、章法与剑意"
        : "八条道途各有一得、各有一失;此世只择其一,选定不可改",
      progress: input.daoChosen ? "已定" : `${DAO_PATHS.length} 道待择`,
      pending: !input.daoChosen,
      route: "/celestial?tab=dao",
    },
    {
      id: "trial",
      name: "天道试炼",
      hint: "八门试炼与四程挑战书 —— 这一世打不完,道痕却会留下",
      progress: `${input.clearedTrials}/${input.trialTotal} 门`,
      pending: input.clearedTrials < input.trialTotal,
      route: "/celestial?tab=trial",
    },
    {
      id: "expedition",
      name: "远征诸界",
      hint: "踏破特殊规则世界,每一界都是一次不同的规则拷问",
      progress: null,
      pending: true,
      route: "/celestial?tab=exped",
    },
    {
      id: "soul",
      name: "器魂",
      hint: "凡器承不住天道 —— 凝炼器魂,另开一炉",
      progress: input.soulsEquipped > 0 ? `${input.soulsEquipped} 枚在席` : "尚未凝炼",
      pending: input.soulsEquipped === 0,
      route: "/souls",
    },
    {
      id: "legacy",
      name: "三生录",
      hint: "这一世的道痕、画像与历世卷 —— 走完了才有得看",
      progress: `${input.marks} 则道痕`,
      pending: false,
      route: "/legacy",
    },
  ];
  /*
   * 转世排在最末:它是「这一世结束」而不是「这一世还能做什么」。
   * 与天界、器魂并列,不抢占视觉中心(玩家可能想先把那些逛完)。
   */
  if (input.canRebirth) {
    out.push({
      id: "rebirth",
      name: "兵解转世",
      hint: "这一世已到尽头 —— 带走道果与宿慧,另开一世",
      progress: null,
      pending: false,
      route: "/character",
    });
  }
  // 待办在前、已做完在后;同组内保持声明顺序(那是「先看什么」的设计)
  return [...out.filter((p) => p.pending), ...out.filter((p) => !p.pending)];
}

/** 试炼总数 —— 与 `data/endgame` 的 TRIALS 同源,界面不另写 8 */
export const TRIAL_TOTAL = TRIALS.length;
