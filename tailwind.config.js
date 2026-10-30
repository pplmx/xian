/** @type {import('tailwindcss').Config} */

/**
 * 颜色统一走「RGB 通道值变量 + <alpha-value>」模式。
 *
 * 为什么不能直接写 var(--color-ink):Tailwind 的斜杠透明度(bg-ink/10)是把
 * 颜色塞进 rgb(<通道> / <alpha>) 里合成的,变量若是 #292722 这种完整颜色,
 * 合成出来就是非法的 rgb(#292722 / 0.1),整条声明被浏览器丢弃。
 * 所以变量存裸通道值 "41 39 34",由这里的函数补上 rgb() 与 alpha。
 *
 * 与 style.css 的分工:那边定义 --color-ink-rgb(通道值)并派生出
 * --color-ink(完整颜色,供 color-mix 和模板里的 var(--color-*) 使用),
 * 暗色主题只需覆盖通道值一处,两条路径同时换肤。
 */
const withAlpha = (variable) => `rgb(var(${variable}) / <alpha-value>)`;

export default {
  content: ["./index.html", "./src/**/*.{vue,js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        paper: {
          DEFAULT: withAlpha("--color-paper-rgb"),
          deep: withAlpha("--color-paper-deep-rgb"),
          dark: withAlpha("--color-paper-dark-rgb"),
        },
        ink: {
          DEFAULT: withAlpha("--color-ink-rgb"),
          soft: withAlpha("--color-ink-soft-rgb"),
          faint: withAlpha("--color-ink-faint-rgb"),
        },
        cinnabar: {
          DEFAULT: withAlpha("--color-cinnabar-rgb"),
          deep: withAlpha("--color-cinnabar-deep-rgb"),
        },
        qing: withAlpha("--color-qing-rgb"),
        "indigo-ink": withAlpha("--color-indigo-ink-rgb"),
        "gold-ink": withAlpha("--color-gold-ink-rgb"),
        jade: withAlpha("--color-jade-rgb"),
        "violet-ink": withAlpha("--color-violet-ink-rgb"),
        "amber-ink": withAlpha("--color-amber-ink-rgb"),
        zheshi: withAlpha("--color-zheshi-rgb"),
        tenghuang: withAlpha("--color-tenghuang-rgb"),
        bise: withAlpha("--color-bise-rgb"),
        he: withAlpha("--color-he-rgb"),
        cangqing: withAlpha("--color-cangqing-rgb"),
        tianqing: withAlpha("--color-tianqing-rgb"),
      },
      fontFamily: {
        /*
         * 只做「utility 名 → 变量」这一步;字体栈本体在 style.css 的 --font-kai / --font-song。
         *
         * 原来这里另抄了一份完整字体栈,而 style.css 里 `.font-kai{font-family:var(--font-kai)}`
         * 在产物中排在它后面、把它整个盖掉 —— 于是改这里不生效(改字号字体时真被坑过一次:
         * 配置改了、产物里纹丝不动)。同一样东西两处维护迟早对不上,故只留这一层转发,
         * 事实源归 style.css 一处。
         */
        kai: ["var(--font-kai)"],
        song: ["var(--font-song)"],
      },
      /*
       * 页面阅读字阶只认这六个名字。
       *
       * 以前模板里直接写 text-[10px] / text-[11px] / text-[14px] 等裸值，手机看着刚好，
       * 到 1280 桌面仍原样放大留白，整页像一张被摊开的手机截图。现在字号值本身仍由
       * style.css 的 --type-* 定义：手机维持原刻度，960px 以上由同一组变量整体抬一档。
       * display 只给卷首题字，不参与正文五档。
       */
      fontSize: {
        note: "var(--type-note)",
        body: "var(--type-body)",
        title: "var(--type-title)",
        section: "var(--type-section)",
        heading: "var(--type-heading)",
        display: "var(--type-display)",
      },
      /* v4 的 @theme 按需生成任意数值,v3 只有固定 scale,缺的须显式补齐。
         v4 的 spacing 公式是 calc(0.25rem * N),下面的值据此换算。
         maxWidth 不必单列:v3.4 的 maxWidth 默认已继承 theme.spacing */
      spacing: {
        0.75: "0.1875rem",
        1.25: "0.3125rem",
        5.25: "1.3125rem",
        35: "8.75rem",
        90: "22.5rem",
        100: "25rem",
        107.5: "26.875rem",
      },
      /* 弹窗遮罩层级,v3 默认 zIndex 到 50 为止 */
      zIndex: {
        60: "60",
        70: "70",
      },
      /* 按压回弹幅度,v3 默认 scale 在 95 与 100 之间没有档位 */
      scale: {
        97: ".97",
        98: ".98",
        99: ".99",
      },
      /* 斜杠透明度走 theme.opacity,v3.4 默认是步长 5(0/5/10/…/100),
         这几档更淡的底色和分隔线不在其中,须补 */
      opacity: {
        4: "0.04",
        6: "0.06",
        7: "0.07",
        8: "0.08",
      },
      /* @keyframes 本体保留在 style.css(标准 CSS,v3 直接识别),这里只做
         「工具类名 → animation 简写」的映射,避免同一份帧定义两处维护 */
      animation: {
        mist: "mist 26s ease-in-out infinite alternate",
        "mist-slow": "mist 40s ease-in-out infinite alternate-reverse",
        breathe: "breathe 4.5s ease-in-out infinite",
        "float-dmg": "float-dmg 0.9s ease-out forwards",
        "float-crit": "float-crit 0.9s ease-out forwards",
        "ink-pop": "ink-pop 0.35s cubic-bezier(0.22, 1, 0.36, 1)",
        "new-pop": "new-pop 0.42s cubic-bezier(0.22, 1, 0.36, 1) both",
        "glow-pulse": "glow-pulse 2.4s ease-in-out infinite",
        "seal-breathe": "seal-breathe 2.8s ease-in-out infinite",
      },
    },
  },
  /*
   * short: —— 高度断点(横屏手机、桌面矮窗)
   *
   * Tailwind 只有宽度断点,而「上下两栏把屏幕吃掉四分之一」这个毛病是按**高度**
   * 现形的:844×390 横屏下内容区只剩 289px,占屏 26%,两栏吃掉 102px。
   *
   * 这里没有走 theme.screens 的 { raw: … } 写法 —— 那条路 Tailwind 会当场警告
   * 「min-* / max-* 变体不可用」,等于为了一个高度断点把任意宽度断点(min-[340px]:)
   * 全废掉;addVariant 只加一个变体,两边都不耽误。
   *
   * hoverable: —— 「真悬停设备」守卫
   *
   * 触屏上 hover 是个死状态:点一下之后它一直黏着不散(坊市「售丹/售料/寄卖」
   * 那排最明显,点完还亮着,像「已选中」)。桌面测不出来 —— 鼠标一移开就退。
   * 故凡是**只在悬停时给的反馈**,一律写成 hoverable:hover:xxx:这条变体在
   * @media (hover: hover) and (pointer: fine) 之外根本不生成,触屏上一片安静。
   *
   * 不用 theme 里覆盖 hover 本身的写法:内置 hover 还有人(以及 group-hover)
   * 在用,而这里要的是「逐处挑选」—— 加变体不改内置行为,两边都不耽误。
   *
   * tinylens: —— 「极窄档」(布局视口 ≤220 CSS px)
   *
   * 这个数是 390 宽的机型按 200% 放大后的 195(量的是**缩放档**,不是宽度档,见
   * docs/design.md 第四十一条)与最小的真机宽度 320 之间的一道缝。凡是「这一处格子
   * 常态正好、极窄档要放开列数」都走它。
   *
   * 为什么不各处写 max-[220px]:那等于把同一个阈值抄成几份字面量(Tailwind 的 JIT
   * 扫不到 `max-[${X}px]` 这类拼接,拼出来会**静默不生成**那条媒体查询,类名也就
   * 从没生效过)。两处各写一个数就是两本账 —— 改一处另一处不动,同一台 200% 的机器上
   * 一处放开一处不放开,而排版自检只判溢出/越界,看不出这是"两本账"而不是"没坏"。
   * 收成具名变体后,阈值只住这一行。
   */
  plugins: [
    ({ addVariant }) => {
      addVariant("short", "@media (max-height: 560px)");
      addVariant("hoverable", "@media (hover: hover) and (pointer: fine)");
      addVariant("tinylens", "@media (max-width: 220px)");
    },
  ],
};
