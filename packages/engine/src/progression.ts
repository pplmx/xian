/**
 * 成长体检 —— "我这套曲线跑起来是什么手感"。
 *
 * `economy.ts` 回答"哪个资源是瓶颈";这一层回答**数值侧**的同一个问题:
 * 沿等级阶梯走一遍,把**每一格的跳变**量出来 —— 需求涨了几倍、面板涨了几倍、
 * 玩家和内容谁在碾压谁,以及**跨界那一下**和别人有什么不同。
 *
 * 为什么值得单独一层:这一套口径是从一款在运营的作品里攒出来的,起因是三条玩家反馈 ——
 * "金丹后升级过快""炼虚就能推完全图""真仙入天界还是一脚踹死"。三条症状指向同一件事:
 * **成长曲线与内容曲线脱节**,而不是"数值绝对值偏高"。所以这里只**度量**,不改任何数值:
 * 先把膨胀来源量化出来,再谈调参。
 *
 * 四条约定(与库里其它层同一条思路:引擎不认识你的题材,只按你给的函数走):
 *
 *   一 **"强度"由调用方给**。引擎不知道你的战力怎么算 —— 给一个 `power(major, layer)`
 *      就行(可以用 `realms.baseStats` + 属性系统,也可以是你自己的公式);
 *   二 **"内容强度"也是调用方给**。给了才做碾压判定(玩家 ÷ 内容 ≥ `crushRatio`,
 *      默认 3 —— 那是"一脚踹死"的实测口径);不给就只报跳变;
 *   三 **跳变看的是相邻格**,不是绝对值。"第 21 境要 1e18 修为"本身说明不了什么,
 *      "第 20 境到第 21 境涨了 40 倍"才有手感含义;
 *   四 **跨界单独报**。世界与世界的交界处本来就该跳一档(寿元、需求、面板同时跳),
 *      混在"最大跳变"里会让正常的跨界看起来像事故 —— 所以 `worldSteps` 单列。
 *
 * 引擎在 0.x 期间不承诺"曲线一定合理",承诺的是**读数口径一致**:同一份配置,
 * 谁跑都给同一张表;换题材只换内容,表就跟着变。
 */
import type { RealmSystem } from './realms.js'
import { numberNumeric, type Numeric } from './numeric.js'

export interface ProgressionAuditConfig<T = number> {
  /** 要体检的那张等级表 */
  realms: RealmSystem<T>
  /**
   * 玩家在这一格的**强度**(战力 / 总需求 / 你能想到的任何可比量)。
   * 不给时用等级表自己的面板之和(`baseStats` 的所有键相加)——那只是个保底口径,
   * 真做体检建议接上属性系统,把装备与词条一起算进去。
   */
  power?: (major: number, layer: number) => number
  /**
   * 内容在这一格的强度(该层敌人 / 该区域的推荐战力)。
   * **不给就不做碾压判定** —— 宁可少报,不要瞎报。
   */
  contentPower?: (major: number, layer: number) => number
  /** 碾压阈值:玩家 ÷ 内容 ≥ 这个数算"内容被碾"(默认 3,与源工程的 `CRUSH_RATIO` 同口径) */
  crushRatio?: number
  /** 自定义"这一格要多少"的读数(默认 `expCost`);返回普通数字即可,读数是给人看的 */
  costOf?: (major: number, layer: number) => number
}

export interface ProgressionStep {
  major: number
  layer: number
  label: string
  /** 走完这一步就跨大境界 */
  isMajorStep: boolean
  /** 走完这一步就换世界(界域) */
  isWorldStep: boolean
  /**
   * **这一格是新世界的头一格**(跳变都落在它身上)。
   *
   * 与 `isWorldStep` 一对:那个说的是"走完上一格就换界",这个说的是"我已经在新界里了" ——
   * 读表时真正要看的是这一格,因为**需求与面板的跳变都记在落点上**。
   */
  isWorldEntry: boolean
  /** 这一格的价格(默认修为需求) */
  cost: number
  /** 与上一格的倍数(第一格为 1) */
  costStep: number
  /** 玩家在这一格的强度 */
  power: number
  /** 与上一格的倍数(第一格为 1) */
  powerStep: number
  /** 玩家 ÷ 内容;没给 `contentPower` 时是 `undefined` */
  ratio?: number
  /** 碾压判定:只在给了 `contentPower` 时有值 */
  verdict?: 'crush' | 'even' | 'wall'
}

export interface WorldStep {
  label: string
  costStep: number
  powerStep: number
}

export interface ProgressionSummary {
  steps: number
  /** 需求涨得最狠的那一格(跨界格单独看,不混进来) */
  biggestCostStep: ProgressionStep
  /** 面板涨得最狠的那一格(同上) */
  biggestPowerStep: ProgressionStep
  /** 每一处跨界的跳变 */
  worldSteps: WorldStep[]
  /** 玩家第一次碾压内容的那一格;一次都没有就是 `undefined` */
  firstCrush?: ProgressionStep
  /** 被碾压的格数 */
  crushing: number
}

/**
 * 一段的读数 —— **"这一境(或这一界)总共涨了多少倍"**。
 *
 * 逐格跳变回答"哪一步最陡",段读数回答"这一段整体有多长/多陡" —— 后者才是内容作者
 * 排期时真正问的问题("前 3 境要多久、后面每境涨多少")。段可以按**大境界**切(默认),
 * 也可以按**界域**切(多界域题材:人间界整段涨了多少)。
 */
export interface ProgressionSegment {
  /** 段首那一格 */
  from: ProgressionStep
  /** 段末那一格 */
  to: ProgressionStep
  /** 段名(按大境界切是境界名,按界域切是界域名) */
  name: string
  /** 段内格数 */
  cells: number
  /** 段首 → 段末的需求倍数(段内只有一格时为 1) */
  costSpan: number
  /** 段首 → 段末的面板倍数(同上) */
  powerSpan: number
  /** **跨进这一段**那一步的倍数(第一段为 1) */
  entryCostStep: number
  /** 段内单步最大的需求跳变(不含跨进来的那一步) */
  maxCostStep: number
}

const stepOf = (value: number, previous: number | undefined): number =>
  previous === undefined || previous === 0 ? 1 : value / previous

export function createProgressionAudit<T = number>(
  config: ProgressionAuditConfig<T>,
  numeric: Numeric<T> = numberNumeric as unknown as Numeric<T>
) {
  const crushRatio = config.crushRatio ?? 3
  const sys = config.realms

  /** 面板之和:没给 `power` 时的保底口径(键名不参与,只求和 —— 引擎不认识它们) */
  const panelSum = (major: number, layer: number): number =>
    Object.values(sys.baseStats(major, layer)).reduce<number>((sum, value) => sum + numeric.toNumber(value as T), 0)

  const powerAt = config.power ?? panelSum
  const costAt = config.costOf ?? ((major: number, layer: number) => numeric.toNumber(sys.expCost(major, layer)))

  const steps: ProgressionStep[] = []
  let prevCost: number | undefined
  let prevPower: number | undefined
  for (let major = 0; major <= sys.maxMajor; major += 1) {
    for (let layer = 0; layer <= sys.maxLayerOf(major); layer += 1) {
      const cost = costAt(major, layer)
      const power = powerAt(major, layer)
      const row: ProgressionStep = {
        major,
        layer,
        label: sys.label(major, layer),
        isMajorStep: sys.isMajorStep(major, layer),
        isWorldStep: sys.isWorldStep(major, layer),
        isWorldEntry: layer === 0 && sys.isWorldEntry(major),
        cost,
        costStep: stepOf(cost, prevCost),
        power,
        powerStep: stepOf(power, prevPower)
      }
      if (config.contentPower) {
        const content = config.contentPower(major, layer)
        row.ratio = content > 0 ? power / content : Number.POSITIVE_INFINITY
        row.verdict = row.ratio >= crushRatio ? 'crush' : row.ratio >= 1 ? 'even' : 'wall'
      }
      steps.push(row)
      prevCost = cost
      prevPower = power
    }
  }

  /** 读数小结:最狠的两处跳变、每处跨界、以及第一次碾压 */
  const summary = (): ProgressionSummary => {
    // 换界那一格本来就该跳一档,所以"最大跳变"只在普通格里挑 —— 否则它会把结论带偏。
    // 注意挑的是**落点**(跳变记在新世界的头一格上),不是"走完就换界"的那一格。
    const plain = steps.slice(1).filter(step => !step.isWorldEntry)
    const biggest = (key: 'costStep' | 'powerStep'): ProgressionStep =>
      plain.reduce((best, step) => (step[key] > best[key] ? step : best), plain[0] ?? steps[0]!)
    const crushing = steps.filter(step => step.verdict === 'crush')
    return {
      steps: steps.length,
      biggestCostStep: biggest('costStep'),
      biggestPowerStep: biggest('powerStep'),
      worldSteps: steps
        .filter(step => step.isWorldEntry)
        .map(step => ({ label: step.label, costStep: step.costStep, powerStep: step.powerStep })),
      firstCrush: crushing[0],
      crushing: crushing.length
    }
  }

  /** 一行一格的读数(界面 / 控制台都能直接用) */
  const lines = (opts: { onlySteps?: boolean } = {}): string[] =>
    steps
      .filter(step => !opts.onlySteps || step.costStep > 1.5 || step.powerStep > 1.5)
      .map(step => {
        const tail = step.verdict === undefined ? '' : ` · 玩家/内容 ${step.ratio!.toFixed(2)}(${step.verdict})`
        return `${step.label.padEnd(12, ' ')} 需求 ×${step.costStep.toFixed(2)} · 面板 ×${step.powerStep.toFixed(2)}${tail}`
      })

  /**
   * 按段读数:`by='major'` 每大境界一段(默认),`by='world'` 每界域一段。
   *
   * 两处口径写死在这里,免得每个人自己数一遍:
   *   · `costSpan` 是**段末 ÷ 段首**(段内一格就是 1)—— 与"境内涨了多少倍"同一个意思;
   *   · `entryCostStep` 单独给:**跨进这一段**那一步(跨大境界或换界),不算进 `maxCostStep` ——
   *     否则每一段的最大跳变都会变成"进门那一下",段内谁最陡就看不出来了。
   */
  const segments = (by: 'major' | 'world' = 'major'): ProgressionSegment[] => {
    const groups = new Map<string, ProgressionStep[]>()
    for (const step of steps) {
      const key = by === 'world' ? sys.worldOf(step.major).id : String(step.major)
      const list = groups.get(key)
      if (list) list.push(step)
      else groups.set(key, [step])
    }
    return [...groups.values()].map(list => {
      const from = list[0]!
      const to = list[list.length - 1]!
      const inner = list.slice(1)
      return {
        from,
        to,
        name: by === 'world' ? sys.worldOf(from.major).name : sys.realmAt(from.major).name,
        cells: list.length,
        costSpan: from.cost === 0 ? 1 : stepOf(to.cost, from.cost),
        powerSpan: stepOf(to.power, from.power),
        entryCostStep: from.costStep,
        maxCostStep: inner.length === 0 ? 1 : Math.max(...inner.map(step => step.costStep))
      }
    })
  }

  return { steps, summary, lines, segments, crushRatio }
}

export type ProgressionAudit = ReturnType<typeof createProgressionAudit>
