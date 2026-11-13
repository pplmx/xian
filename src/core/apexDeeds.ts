/**
 * 此世功业 —— 走到大道尽头之后,「这一世到底修成了什么」。
 *
 * ## 它补的是什么
 *
 * 满级玩家打开任何一个页面,看到的都是**分散的读数**:攻击多少、道痕几则、
 * 试炼通了几门、功法学了几部、器谱读通几张。每一个数都在自己那一页,
 * 而「我把这一世修成了什么」这件事**没有任何一处回答**。
 *
 * 而终局玩家最想知道的恰恰是这个:一世的终点值不值得。三生录报的是画像
 * (你是哪种人),修行页报的是去处(还能做什么),**没有一处报功业**(你成了什么)。
 *
 * ## 为什么不做成新玩法
 *
 * 这一块**只读**已发生的事实,不引入任何新资源、新产出、新阈值。
 * 理由:终局已经连着补了两条经济线(修为与灵气的去处),再加一条产出会让
 * 终局重新变成「刷数字」。功业这一层的作用是**把已有的东西收成一份可读的证明**,
 * 让玩家知道「我走到这里了」,而不是再给他一个要刷的进度条。
 *
 * 故本模块是纯取景:每条功业读一个既有来源,不新算任何东西。
 */

/** 一条功业 */
export interface ApexDeed {
  id: string;
  /** 名目（「试炼」） */
  label: string;
  /** 读数（「10/10 门」） */
  value: string;
  /** 这一条算不算「已满」—— 满的不是已完成,只是给界面一个分层 */
  full: boolean;
}

/** 功业的原料 —— 全部来自既有 store,本模块只排序与格式化 */
export interface ApexDeedInput {
  /** 通了几门试炼 / 共几门 */
  trialsCleared: number;
  trialsTotal: number;
  /** 道痕则数 / 上限 */
  marks: number;
  marksCap: number;
  /** 跨了几个界域 */
  worldsCrossed: number;
  worldsTotal: number;
  /** 学了几部功法 / 共几部 */
  gongfaLearned: number;
  gongfaTotal: number;
  /** 图鉴:认得多少种敌手 */
  enemiesKnown: number;
  /** 读通几张器谱 */
  blueprintsMastered: number;
  /** 破界几次（远征通关总数） */
  worldClears: number;
  /** 达到过的最高里程碑数 / 共几枚 */
  milestonesDone: number;
  milestonesTotal: number;
}

/**
 * 把原料排成功业榜。
 *
 * 排序按**完成度**降序 —— 玩家先看到他最接近圆满的那几项,再看差距大的。
 * 这条排序是刻意的:终局玩家的心理是「我还差什么」,而不是「我有什么」,
 * 故把最满的放前面,让他先看到成就,再看到余地。
 */
export function apexDeeds(input: ApexDeedInput): ApexDeed[] {
  const ratio = (a: number, b: number): number => (b > 0 ? a / b : 0);
  const rows: (ApexDeed & { key: number })[] = [
    {
      id: "trial",
      label: "试炼",
      value: `${input.trialsCleared}/${input.trialsTotal} 门`,
      full: input.trialsCleared >= input.trialsTotal,
      key: ratio(input.trialsCleared, input.trialsTotal),
    },
    {
      id: "milestone",
      label: "碑记",
      value: `${input.milestonesDone}/${input.milestonesTotal} 枚`,
      full: input.milestonesDone >= input.milestonesTotal,
      key: ratio(input.milestonesDone, input.milestonesTotal),
    },
    {
      id: "world",
      label: "界域",
      value: `${input.worldsCrossed}/${input.worldsTotal} 界`,
      full: input.worldsCrossed >= input.worldsTotal,
      key: ratio(input.worldsCrossed, input.worldsTotal),
    },
    {
      id: "mark",
      label: "道痕",
      value: `${input.marks}/${input.marksCap} 则`,
      full: input.marks >= input.marksCap,
      key: ratio(input.marks, input.marksCap),
    },
    {
      id: "gongfa",
      label: "功法",
      value: `${input.gongfaLearned}/${input.gongfaTotal} 部`,
      full: input.gongfaLearned >= input.gongfaTotal,
      key: ratio(input.gongfaLearned, input.gongfaTotal),
    },
    /*
     * 图鉴与器谱没有「总数」的可靠口径(敌手按区域生成、器谱按装备模板),
     * 报绝对数而不报比例 —— 编一个分母比不报更糟。
     */
    {
      id: "enemy",
      label: "敌手",
      value: `认得 ${input.enemiesKnown} 种`,
      full: false,
      key: 0.5,
    },
    {
      id: "blueprint",
      label: "器谱",
      value: `读通 ${input.blueprintsMastered} 张`,
      full: false,
      key: 0.5,
    },
    {
      id: "clear",
      label: "破界",
      value: `${input.worldClears} 次`,
      full: false,
      key: 0.5,
    },
  ];
  return rows.sort((a, b) => b.key - a.key).map(({ key: _key, ...deed }) => deed);
}

/** 功业里满了几条 —— 给终局印记报一句「N 条已满」 */
export function apexDeedSummary(deeds: ApexDeed[]): { done: number; total: number } {
  return { done: deeds.filter((d) => d.full).length, total: deeds.length };
}
