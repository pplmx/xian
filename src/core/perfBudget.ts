/**
 * 运行时帧预算的**判定** —— 从 `scripts/perf-profile.mjs` 里抽出来的纯函数。
 *
 * ## 为什么值得单独成模块
 *
 * 原先这些判定埋在脚本里的一长串 `else if` 链上:
 *
 * ```js
 * if (r.crashed) failures.push(...)
 * else if (r.max > BUDGET.maxFrameMs) failures.push(...)
 * else if (r.over50ms > BUDGET.longFramesMax) failures.push(...)
 * ...
 * ```
 *
 * 于是「这条判据有没有真的生效」只能靠**正则扫脚本文本**来判断 —— 而文本扫描认的是
 * 「这串字符在不在」,不是「它有没有生效」。实测踩到两次:在前面加 `false && `
 * 让条件恒假,以及把 `failures.push(...)` 换成一行注释,两次都**照样绿**。
 * 判据无法自证的时候,它守的东西就是没人看着的。
 *
 * 抽成纯函数之后,「哪种读数该红」可以直接用用例回答,不必去猜脚本长什么样。
 *
 * ## 两段为什么分开判
 *
 * 静置段量的是「页面自己不动时别卡」;交互段量的是「点了之后别卡」。混成一段的话,
 * 交互那几拍的尖峰会被几百帧静置稀释掉,永远红不了 —— 而交互恰恰是玩家最容易
 * 感觉到 jank 的时刻(静置时页面本来就不太动,帧率必然好看)。
 */
/** 一段帧采样的汇总(静置段与交互段用同一套字段) */
export interface FrameStats {
  /** 采样到的帧数 —— 0 表示这一段没量到,不是「很快」 */
  frames: number;
  max: number;
  p95: number;
  median: number;
  over50ms: number;
}

/** 运行时帧预算。默认值是实测读数的数倍余量 —— 这是**回归门**不是基准。 */
export interface PerfBudget {
  /** 静置段:单视图最差帧间隔上限(ms)。无头 ~60fps 基准是 16-17ms。 */
  maxFrameMs: number;
  /** 静置段:>50ms 长帧数量上限 */
  longFramesMax: number;
  /**
   * 滚动段:最差帧上限(ms)。
   *
   * 比静置宽、比交互窄。滚动本身只走合成(不含列表重渲染),正常应该贴着 17ms;
   * 实测六个长页(可滚 231~1093px)来回滚 16 次,全部 17ms / 零长帧。
   * 留 3 倍余量是因为无头机型的合成器差异 —— 这条拦的是「滚起来掉帧」这类回潮,
   * 比如给滚动容器挂了个每帧重算的监听。
   */
  scrollMaxFrameMs: number;
  /**
   * 交互段:最差帧上限(ms)。
   *
   * 比静置宽得多,因为交互必然更贵:它包含首次把一个册页的内容渲染出来(法宝 45 条长账、
   * 词条转移候选等),那一拍的浏览器侧布局与合成不归应用代码管。实测(背包页四种最重的
   * 交互,跑三遍):静置恒 17ms / 0 长帧;交互 100 / 117 / 267ms、2 / 2 / 8 帧 >50ms;
   * 其余 16 个视图交互段 ≤34ms。摆动这么大是因为取决于那一次是否赶上完整重排,故
   * 这条只拦**量级回潮**。
   */
  interactiveMaxFrameMs: number;
}

/** 一个视图的运行时读数(帧 + DOM 峰值 + 交互段) */
export interface PerfReading {
  name: string;
  /** 静置段 */
  max: number;
  over50ms: number;
  /** 交互段;没有交互流程的视图为 null */
  interactive: FrameStats | null;
  /** 滚动段;页面不够长(可滚 <80px)时为 null —— 那是「没量」不是「很快」 */
  scroll?: FrameStats | null;
  /** 崩溃原因(有就短路其余判定) */
  crashed?: string;
  /** 页面异常 */
  errors?: readonly string[];
  /** 深清单(候选 / 长账)峰值 DOM;四类密清单各自守 1100 */
  peakDom?: { label: string; nodes: number; limit: number }[];
}

/** 判定结果:一串人话失败原因(空数组 = 这条视图过了) */
export function judgePerf(r: PerfReading, budget: PerfBudget, gate = true): string[] {
  if (r.crashed) return [`${r.name}: 崩溃 (${r.crashed})`];
  if (r.errors?.length) return [`${r.name}: 页面异常 (${r.errors[0]!.slice(0, 80)})`];
  if (!gate) return [];

  const failures: string[] = [];
  if (r.max > budget.maxFrameMs) {
    failures.push(`${r.name}: 最差帧 ${r.max}ms > ${budget.maxFrameMs}ms`);
  }
  if (r.over50ms > budget.longFramesMax) {
    failures.push(`${r.name}: ${r.over50ms} 帧 >50ms 长帧 > ${budget.longFramesMax}`);
  }
  /*
   * 交互段:**没有交互流程的视图不参与**(frames === 0)。那不是「很快」,是「没量」——
   * 把「没量」当成通过,等于让判据在没采到数时静默变绿(这个仓库栽过:首屏门拿
   * `fontSwap ?? Infinity` 把「没量到」算成「无穷晚」,详见 development.md)。
   */
  const inter = r.interactive;
  if (inter && inter.frames > 0 && inter.max > budget.interactiveMaxFrameMs) {
    failures.push(
      `${r.name}: 交互段最差帧 ${inter.max}ms > ${budget.interactiveMaxFrameMs}ms —— 翻批/开弹窗是不是又变成一次渲染几百条了`,
    );
  }
  /*
   * 滚动段:同样把「没量」与「很快」分开 —— frames === 0 不参与判定。
   */
  const scroll = r.scroll;
  if (scroll && scroll.frames > 0 && scroll.max > budget.scrollMaxFrameMs) {
    failures.push(
      `${r.name}: 滚动段最差帧 ${scroll.max}ms > ${budget.scrollMaxFrameMs}ms —— 滚动容器是不是挂了每帧重算的东西`,
    );
  }
  for (const deep of r.peakDom ?? []) {
    if (deep.nodes > deep.limit) {
      failures.push(`${r.name}: ${deep.label} DOM ${deep.nodes} > ${deep.limit}`);
    }
  }
  return failures;
}
