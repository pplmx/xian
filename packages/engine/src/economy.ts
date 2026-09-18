/**
 * 经济读数 —— "这个资源是紧了还是烂在手里"。
 *
 * 有一本账(`resources`)之后,下一个问题总是同一个:**哪一样不对劲**。
 * 这一层把"读数"从"账"里分出来,只做三件事,而三件事都有踩过的坑:
 *
 *   一 **比值而不是绝对值**:每小时进多少、出多少,`进 / 出` 才是可比的量。
 *      出为 0 时比值是**无穷**(东西只进不出 = 烂在手里),不是 1 ——
 *      这一条写错,任何"没有出口"的资源都会显示成"刚刚好";
 *   二 **判词分档,阈值归作品**:默认 0.7 / 3 / 10 来自一款在运营作品的实测口径
 *      (低了是瓶颈、高了是过剩、再高就是纯噪音),但阈值与判词名都可换;
 *   三 **没把握就明说**:模型没覆盖到的出口(本作是界外的悟道点)要带一句 `note`,
 *      既不许算成健康,也不许算成事故 —— 审计的红线是"不许假装知道"。
 *
 * 分期(按层级 / 赛季 / 版本)读数是同一个口径跑多组输入,用于回答"哪一段失衡"。
 */

export interface FlowInput {
  /** 资源键(与 `resources` 的键名对齐) */
  key: string
  /** 同一时间口径的流入(例如每小时) */
  income: number
  /** 同一时间口径的流出 */
  sink: number
  /** 模型没把握时的一句话说明(见文件头第三条) */
  note?: string
}

export interface FlowReading extends FlowInput {
  /** 进 / 出;出为 0 时是无穷(只进不出) */
  ratio: number
  /** 判词(界面直接显示;默认等于档位 id,可用 `labels` 换成作品自己的说法) */
  verdict: string
  /** 档位 id(程序内比较用:`verdict` 可能是中文) */
  verdictId: EconomyVerdict
}

export type EconomyVerdict = 'tight' | 'healthy' | 'surplus' | 'idle'

export interface EconomyConfig {
  /**
   * 分档阈值:比值 `< tight` 是瓶颈,`≤ healthy` 健康,`≤ surplus` 过剩,再高是闲置。
   * 默认 0.7 / 3 / 10 —— 来自一款在运营作品的实测口径。
   */
  bands?: Partial<{ tight: number; healthy: number; surplus: number }>
  /** 判词名(默认就是档位 id:tight / healthy / surplus / idle) */
  labels?: Partial<Record<EconomyVerdict, string>>
}

export interface EconomyPeriod {
  label: string
  flows: readonly FlowInput[]
}

export interface PeriodReading {
  label: string
  flows: FlowReading[]
  /** 这一段里的瓶颈资源键 */
  tight: string[]
  /** 这一段里烂在手里的资源键 */
  idle: string[]
}

export function createEconomyReadings(config: EconomyConfig = {}) {
  const bands = { tight: 0.7, healthy: 3, surplus: 10, ...config.bands }
  const labels: Record<EconomyVerdict, string> = {
    tight: config.labels?.tight ?? 'tight',
    healthy: config.labels?.healthy ?? 'healthy',
    surplus: config.labels?.surplus ?? 'surplus',
    idle: config.labels?.idle ?? 'idle'
  }

  /** 进 / 出;出为 0 时是无穷 —— "只进不出"与"刚刚好"必须分得开 */
  const ratioOf = (income: number, sink: number): number => (sink > 0 ? income / sink : Number.POSITIVE_INFINITY)

  const verdictOf = (ratio: number): EconomyVerdict => {
    if (ratio < bands.tight) return 'tight'
    if (ratio <= bands.healthy) return 'healthy'
    if (ratio <= bands.surplus) return 'surplus'
    return 'idle'
  }

  const read = (flows: readonly FlowInput[]): FlowReading[] =>
    flows.map(flow => {
      const ratio = ratioOf(flow.income, flow.sink)
      const verdictId = verdictOf(ratio)
      return { ...flow, ratio, verdictId, verdict: labels[verdictId] }
    })

  /** 按期读:同一个口径跑多组(哪一段失衡一眼看得出来) */
  const series = (periods: readonly EconomyPeriod[]): PeriodReading[] =>
    periods.map(period => {
      const readings = read(period.flows)
      return {
        label: period.label,
        flows: readings,
        tight: readings.filter(r => r.verdictId === 'tight').map(r => r.key),
        idle: readings.filter(r => r.verdictId === 'idle').map(r => r.key)
      }
    })

  /** 体检小结:各档各有哪些资源,以及哪些读数"没把握"(带 note 的那些) */
  const summary = (readings: readonly FlowReading[]) => ({
    tight: readings.filter(r => r.verdictId === 'tight').map(r => r.key),
    healthy: readings.filter(r => r.verdictId === 'healthy').map(r => r.key),
    surplus: readings.filter(r => r.verdictId === 'surplus').map(r => r.key),
    idle: readings.filter(r => r.verdictId === 'idle').map(r => r.key),
    noted: readings.filter(r => r.note !== undefined).map(r => r.key)
  })

  return { bands, labels, ratioOf, verdictOf, read, series, summary }
}

export type EconomyReadings = ReturnType<typeof createEconomyReadings>
