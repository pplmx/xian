/**
 * 山水景 —— 全站「画什么山」的唯一一份出处。
 *
 * ## 现状：十七册里没有一页有画,只有同一道山
 *
 * 玩家反馈「如果能加一些画面就完美了,不仅仅是纯文字」。翻一遍界面,输入进去的是:
 * 首页、修行卷首、地界志、行旅图各有一道远山 —— 而那道山**处处一样**:
 * 两道折线 ridge、一个 fill、一个透明度,从人间界一路画到混沌海。
 *
 * 山是这一作最便宜的画面:水墨里画山水只用一个 fill 的两条折线与几笔点景,
 * 却能让人一眼认出「这是雪岭」「这是江边」「这是残破的古战场」。同一道折线
 * 摆在四处,读起来不是画面,是水印。
 *
 * ## 做什么
 *
 * 把「这个地方长什么样」收成一份纯数据:九个**地形**(山岳 / 林麓 / 江海 / 火域 /
 * 遗迹 / 宫阙 / 星野 / 雪原 / 虚空),每个地形给两条 ridge 的 path 与几笔点景
 * (月、日、鸟、松、塔、水纹、舟、云、雪点、碎晶)。调用方只交身份(世界 id、
 * 地界图标、事件标签),这里回一份可直接画的东西。
 *
 * ## 为什么是纯函数、不带 store 与 core
 *
 * 它是**装饰层**:不提示、不奖励、不判定。与 `ui/weatherSky` 同一条纪律 ——
 * 不 import store、不 import core,只认传进来的字符串。这样它可以在任何一页被
 * 复用,也不会因为挂上它就拖进一整套 Pinia。
 *
 * ## 为什么不用随机
 *
 * 出图脚本(`scripts/shots.mjs`)与判据都要可复现:同一处地界两次打开必须是同一座山,
 * 否则每次截图都在变、每次都像回归。点景的位置写死在表里,不掷骰。
 *
 * ## 表里不留闲地形
 *
 * 九个地形每一个都得至少被一种真实身份选中(世界 / 地界图标 / 事件标签),
 * 否则它就是「画了没人看得见」的第二种语言 —— 与 `inkIcons` 的「族类表里不留闲族」
 * 同一条判据。反过来,每一个出现的图标与标签也必须有归处:认不出的落在默认地形上,
 * 而「落在默认」与「有归处」读出来是同一个值,故另开 `sceneTerrainKnows` 一只眼。
 */

/** 地形 —— 名字只给判据与 data 锚用,不进读屏、不给玩家看 */
export const SCENE_TERRAINS = [
  "peaks",
  "forest",
  "water",
  "flame",
  "ruin",
  "palace",
  "sky",
  "frost",
  "void",
] as const;
export type SceneTerrain = (typeof SCENE_TERRAINS)[number];

/**
 * 点景的一笔。
 *
 * `d` 是**局部坐标**里的一段笔路(原点在落点上),由组件平移到 `x / y` 再按 `scale`
 * 缩放。几何留在这一份表里,组件只负责把它画出来 —— 这样「这个地形有哪些笔」是可测的,
 * 而不是藏在模板里的一串坐标。
 */
export interface SceneAccent {
  /** 点景名目,只决定用哪一档颜色(CSS 的 is-<kind>) */
  kind:
    | "moon"
    | "orb"
    | "bird"
    | "pine"
    | "pagoda"
    | "wave"
    | "boat"
    | "cloud"
    | "flake"
    | "shard"
    | "ember"
    | "ruinTower"
    | "ruinColumn";
  /** 落点(viewBox 420×160) */
  x: number;
  y: number;
  scale: number;
  /** 局部坐标的笔路;圆形的点景(月/日)也写成 path,组件不必分两种画法 */
  d: string;
}

export interface SceneShape {
  terrain: SceneTerrain;
  /** 远处的山骨 —— 更淡的那一道 */
  far: string;
  /** 近处的山骨 —— 压在下缘的那一道 */
  near: string;
  accents: readonly SceneAccent[];
}

/**
 * 一笔点景的几何 —— 每个形状只写一次,地形表按引用拼。
 *
 * 坐标系与画布同源(420×160),局部原点即落点;`scale` 由地形给。笔路都做小
 * (十几像素量级):它们是「看一眼就懂」的记号,不是主角。画在山脊之上时先画点景、
 * 后画山骨 —— 月与鸟落在天上,不该被山挡住。
 */
const STROKE = {
  /** 两只雀:一笔一顿,中点即身 */
  bird: "M-9 0 C-6 -3.4 -3 -3.4 0 0 C3 -3.4 6 -3.4 9 0",
  /**
   * 松:一干 + 三角树冠。
   *
   * 原先写的是「一干三针」—— 三条人字叠起来。真渲染出来那是一支**朝上的箭头**,
   * 不是树:人字叠是「羽毛/箭镞」的形状语言,针叶树要的是一整个三角的剪影。
   * 改成闭合三角形加一横(树冠下缘),远看就是一棵杉。
   */
  pine: "M0 1.6 V-3.4 M-6.6 -3.4 L0 -14 L6.6 -3.4 Z M-3.6 -8.6 H3.6",
  /** 塔:三层檐加一条地平 —— 宫阙与天门共用 */
  pagoda: "M-11 0 H11 M-8.5 -4 C-5.5 -7.6 5.5 -7.6 8.5 -4 M-6 -7.6 H6 M-4 -11.4 H4",
  /** 水纹:一道轻卷 */
  wave: "M-13 0 C-9 -3.2 -4.4 -3.2 0 0 C4.4 3.2 9 3.2 13 0",
  /** 舟:一叶加一桅 */
  boat: "M-9 0 C-5.6 3.4 5.6 3.4 9 0 M0 0 V-7.4 L5.2 -2.4 H0",
  /** 云气:一笔起伏 */
  cloud: "M-14 0 C-10 -3.4 -5 2.6 0 0 C5 -2.6 10 2.4 14 0",
  /** 月牙:两道弧扣出弯月(圆形画法看不出「月牙」,故用笔路) */
  moon: "M-4.6 -5.4 C-1.4 -3.4 0.6 0 -0.2 3.4 C-1 6.6 -3.6 8 -6 7.2 C-3.4 4.6 -2.6 0.6 -4.6 -5.4 Z",
  /** 日轮:一片薄圆 */
  orb: "M0 -4.6 A4.6 4.6 0 1 1 -0.1 -4.6 Z",
  /** 雪点:一粒 */
  flake: "M0 -1.1 A1.1 1.1 0 1 1 -0.1 -1.1 Z",
  /** 碎晶:一块斜立的虚空残片 */
  shard: "M0 4 L3.2 -6 L7.2 1 Z",
  /**
   * 断塔:塔身只到一半,顶上缺一角 —— 「曾是一座塔」比「一座塔」说得更多。
   * 宫阙用完整的 pagoda,遗迹用这一个;两者同在画面上时必须一眼分得开。
   */
  ruinTower: "M-9 0 H9 M-6.5 -4 V-9 M-3.5 -4 V-11 M3 -4 V-9 M6.5 -4 V-6.5 M-6.5 -9 L-3.5 -11",
  /** 断柱:一根立着、一根歪倒 */
  ruinColumn: "M0 0 V-13 M-2.6 -13 H2.6 M-2.6 -9 H2.6 M7 0 H15 M7 0 L9.4 -6 H14 L15 0",
  /** 火星:一粒上扬的灰 */
  ember: "M0 1.4 C-1.6 -0.6 -0.8 -3.4 1 -4.6 C1.8 -2 1.6 0 0 1.4 Z",
} as const;

type AccentSeed = {
  kind: SceneAccent["kind"];
  x: number;
  y: number;
  scale?: number;
};

/**
 * 点景的**整体倍率** —— 表里的笔路按「一整张画」的原稿尺寸写,而真渲染时这一幅常只
 * 有 54~74px 高(卷首底、战局底、际遇帖)。按原尺寸 1:1 画,一颗 12 单位的松落在
 * 54px 的条里只有 4px,读出来是一根短线 —— 玩家看到的还是「没有画」。
 *
 * 故倍率只调一次:表里仍按原稿写(改山骨与改点景是两种活,混在一个数里就没法读),
 * 出图时统一放大。实测值见 docs/design.md。
 */
const ACCENT_UNIT = 1.9;

/** 把「名目 + 落点」摊成可画的笔:geometry 只在 STROKE 一处 */
function accents(seeds: readonly AccentSeed[]): SceneAccent[] {
  return seeds.map((seed) => ({
    kind: seed.kind,
    x: seed.x,
    y: seed.y,
    scale: (seed.scale ?? 1) * ACCENT_UNIT,
    d: STROKE[seed.kind],
  }));
}

/**
 * 九个地形。
 *
 * 山骨一律收在画布下缘(`V160`)并封底 —— 未封底时下缘会露出一条硬边切口
 * (`DongfuAtlas` 曾栽在「山脚齐平」上,见 docs/design.md 的观象一节)。
 */
const SHAPES: Record<SceneTerrain, SceneShape> = {
  /*
   * 山岳:一道主峰、两道侧峰,不是一排锯齿。
   *
   * 折线版(每 40px 一个尖)在真渲染里读成「三角形的齿」—— 那是图表,不是山。
   * 水墨的山是一笔**主势**带两道远近:峰头一尖,两侧长长地缓下去。
   * 故改用二次贝塞尔:每一笔从山脚起、过峰、落回山脚,段间用 C 连成起伏。
   */
  peaks: {
    terrain: "peaks",
    far: "M0 160 L40 104 C56 76 72 58 92 58 C112 58 126 84 146 108 C168 134 186 128 210 104 C232 82 246 46 268 46 C292 46 302 78 322 106 C342 132 358 122 382 100 C398 86 410 78 420 74 L420 160 Z",
    near: "M0 160 L64 140 C104 148 140 136 184 144 C228 152 268 140 312 146 C356 152 392 144 420 148 L420 160 Z",
    accents: accents([
      { kind: "moon", x: 322, y: 30, scale: 1.5 },
      { kind: "bird", x: 132, y: 44, scale: 0.8 },
      { kind: "bird", x: 158, y: 35, scale: 0.6 },
      { kind: "cloud", x: 76, y: 66, scale: 1.3 },
    ]),
  },
  // 林麓:山势压平,松成排 —— 松是这一档最认得出的一笔
  forest: {
    terrain: "forest",
    far: "M0 160 L48 132 C72 116 96 110 122 112 C150 114 168 130 196 132 C226 134 244 112 272 110 C300 108 318 128 346 130 C376 132 396 120 420 114 L420 160 Z",
    near: "M0 160 L58 148 C110 154 150 144 198 150 C246 156 288 146 336 152 C372 156 400 150 420 152 L420 160 Z",
    accents: accents([
      { kind: "pine", x: 72, y: 130, scale: 1.1 },
      { kind: "pine", x: 100, y: 138, scale: 0.86 },
      { kind: "pine", x: 290, y: 132, scale: 1.2 },
      { kind: "pine", x: 318, y: 140, scale: 0.78 },
      { kind: "bird", x: 210, y: 52, scale: 0.7 },
      { kind: "cloud", x: 344, y: 42, scale: 1 },
    ]),
  },
  // 江海:水面压到天际线,人字形的山退到两边,水纹与舟是这一档的记号
  water: {
    terrain: "water",
    far: "M0 160 L52 122 C74 104 98 98 124 104 C154 110 172 126 200 128 C232 130 252 110 280 106 C310 102 332 122 360 126 C388 130 404 122 420 116 L420 160 Z",
    near: "M0 160 L420 160 L420 146 C356 152 300 140 240 147 C180 154 120 142 60 149 C40 151 20 153 0 152 Z",
    accents: accents([
      { kind: "moon", x: 338, y: 34, scale: 1.4 },
      { kind: "boat", x: 196, y: 134, scale: 1.2 },
      { kind: "wave", x: 96, y: 145, scale: 1 },
      { kind: "wave", x: 300, y: 149, scale: 0.9 },
      { kind: "bird", x: 136, y: 56, scale: 0.7 },
    ]),
  },
  // 火域:峰头像火舌一样外撇,火星乱飞
  flame: {
    terrain: "flame",
    far: "M0 160 L36 130 C56 112 66 86 82 78 C96 92 100 118 116 126 C134 136 142 104 158 88 C172 104 178 128 196 136 C214 144 222 108 240 92 C254 108 260 132 278 140 C296 148 306 112 322 98 C334 112 344 132 362 138 C380 144 396 128 420 122 L420 160 Z",
    near: "M0 160 L52 148 C104 156 148 144 196 151 C244 158 288 146 336 152 C372 156 400 150 420 152 L420 160 Z",
    accents: accents([
      { kind: "ember", x: 62, y: 92, scale: 1.1 },
      { kind: "ember", x: 132, y: 62, scale: 0.9 },
      { kind: "ember", x: 224, y: 78, scale: 1.2 },
      { kind: "ember", x: 322, y: 58, scale: 1 },
      { kind: "ember", x: 392, y: 84, scale: 0.8 },
    ]),
  },
  // 遗迹:断柱与半座塔 —— 古战场与秘境的记号
  ruin: {
    terrain: "ruin",
    far: "M0 160 L44 128 C68 112 92 106 118 110 C146 114 164 128 192 130 C222 132 240 112 268 110 C296 108 314 128 342 130 C372 132 394 122 420 116 L420 160 Z",
    near: "M0 160 L420 160 L420 148 C360 143 302 152 244 147 C186 142 126 151 68 147 C46 145 22 148 0 149 Z",
    accents: accents([
      { kind: "ruinTower", x: 96, y: 130, scale: 1.3 },
      { kind: "ruinColumn", x: 168, y: 132, scale: 1 },
      { kind: "ruinColumn", x: 268, y: 128, scale: 1.15 },
      { kind: "bird", x: 190, y: 44, scale: 0.72 },
      { kind: "moon", x: 352, y: 26, scale: 1.1 },
    ]),
  },
  // 宫阙:三层檐的塔成群,山只做台地
  palace: {
    terrain: "palace",
    far: "M0 160 L48 130 C72 114 96 108 122 112 C150 116 168 130 196 132 C226 134 244 114 272 112 C300 110 318 130 346 132 C374 134 398 124 420 120 L420 160 Z",
    near: "M0 160 L420 160 L420 152 C356 147 296 155 236 151 C176 147 116 156 56 152 C38 151 18 153 0 154 Z",
    accents: accents([
      { kind: "pagoda", x: 118, y: 128, scale: 1.5 },
      { kind: "pagoda", x: 214, y: 118, scale: 1.1 },
      { kind: "pagoda", x: 306, y: 130, scale: 1.7 },
      { kind: "cloud", x: 70, y: 62, scale: 1.6 },
      { kind: "cloud", x: 350, y: 50, scale: 1.3 },
    ]),
  },
  // 星野:天上来客 —— 云海压平,点景是薄日与浮云
  sky: {
    terrain: "sky",
    far: "M0 160 L40 134 C64 122 88 118 114 122 C142 126 160 138 188 140 C216 142 234 124 262 122 C290 120 308 136 336 138 C364 140 392 132 420 126 L420 160 Z",
    near: "M0 160 L420 160 L420 152 C352 148 288 156 224 152 C160 148 92 158 28 154 L0 155 Z",
    accents: accents([
      { kind: "orb", x: 300, y: 32, scale: 1.3 },
      { kind: "cloud", x: 92, y: 56, scale: 1.7 },
      { kind: "cloud", x: 214, y: 38, scale: 1.2 },
      { kind: "cloud", x: 352, y: 68, scale: 1.1 },
      { kind: "bird", x: 56, y: 30, scale: 0.6 },
    ]),
  },
  // 雪原:峰更锐、雪线更低,雪点落在半空
  frost: {
    terrain: "frost",
    far: "M0 160 L34 112 C52 92 68 66 86 62 C104 58 116 88 132 112 C150 138 166 128 186 106 C204 86 214 60 232 58 C250 56 260 84 276 108 C294 134 310 124 330 104 C348 86 360 68 376 66 C394 64 408 92 420 108 L420 160 Z",
    near: "M0 160 L54 146 C110 154 152 142 204 150 C256 158 300 145 350 151 C384 155 404 149 420 151 L420 160 Z",
    accents: accents([
      { kind: "moon", x: 92, y: 30, scale: 1.2 },
      { kind: "flake", x: 66, y: 58, scale: 1 },
      { kind: "flake", x: 148, y: 40, scale: 0.8 },
      { kind: "flake", x: 236, y: 54, scale: 1.1 },
      { kind: "flake", x: 322, y: 36, scale: 0.9 },
      { kind: "flake", x: 388, y: 62, scale: 1 },
    ]),
  },
  // 虚空:山骨只留一线,碎晶悬在半空 —— 混沌海与「界外」的记号
  void: {
    terrain: "void",
    far: "M0 160 L56 140 C92 130 128 136 168 138 C210 140 244 130 284 132 C324 134 360 142 420 138 L420 160 Z",
    near: "M0 160 L420 160 L420 152 C336 148 258 156 180 152 C120 149 60 154 0 153 Z",
    accents: accents([
      { kind: "shard", x: 92, y: 54, scale: 1.5 },
      { kind: "shard", x: 188, y: 30, scale: 1.1 },
      { kind: "shard", x: 286, y: 58, scale: 1.8 },
      { kind: "shard", x: 356, y: 26, scale: 1 },
      { kind: "flake", x: 44, y: 92, scale: 0.8 },
      { kind: "flake", x: 240, y: 88, scale: 0.7 },
    ]),
  },
};

/**
 * 这一笔点景画在山骨**之前**还是之后。
 *
 * 月、日、雀、云、雪、碎晶落在天上,得先画,否则被山脊整块盖住;松、塔、水纹、舟、
 * 火星是**地上的东西**,得压在山骨之上,否则看起来像陷进山里。这不是审美偏好:
 * 两批如果画在同一层,总有一半是错的。
 */
const IN_FRONT: ReadonlySet<SceneAccent["kind"]> = new Set([
  "pine",
  "pagoda",
  "wave",
  "boat",
  "ember",
  // 遗迹的断塔与断柱立在地上,与塔同层
  "ruinTower",
  "ruinColumn",
]);

/** 该笔点景是否压在山骨之上 */
export function sceneAccentInFront(kind: SceneAccent["kind"]): boolean {
  return IN_FRONT.has(kind);
}

/** 取一份地形的画法;认不出的名字落到山岳(与 `skyOfWeather` 同一条兜底纪律) */
export function sceneOf(terrain: SceneTerrain | undefined | null): SceneShape {
  if (!terrain) return SHAPES.peaks;
  return SHAPES[terrain] ?? SHAPES.peaks;
}

/**
 * 世界 → 地形。
 *
 * 四界各给自己的一片地:人间是山岳,仙界是星野,神界是宫阙,混沌海是虚空。
 * 这样跨界那一下,除了换天时与换山色,连「地长什么样」也换了 —— 飞升最该有的
 * 体感正在这里。
 */
const WORLD_TERRAIN: Record<string, SceneTerrain> = {
  mortal: "peaks",
  immortal: "sky",
  god: "palace",
  chaos: "void",
};

/**
 * 地界图标 → 地形。
 *
 * 图标是地界**已经有的**身份(`RegionDef.icon`,十八种),地形只是把那个身份画成
 * 山水。分派读的是「它在哪一种地方」,不是图标长什么样:`sword` / `skull` 归遗迹,
 * 因为剑冢与万骨坟都是古战场;`droplets` / `waves` 归江海;`castle` / `crown` 归宫阙。
 */
const ICON_TERRAIN: Record<string, SceneTerrain> = {
  mountain: "peaks",
  sunset: "peaks",
  gem: "peaks",
  trees: "forest",
  leaf: "forest",
  droplets: "water",
  waves: "water",
  flame: "flame",
  zap: "flame",
  sword: "ruin",
  skull: "ruin",
  scroll: "ruin",
  shield: "ruin",
  castle: "palace",
  crown: "palace",
  sparkles: "sky",
  star: "sky",
  cloud: "sky",
};

/**
 * 「路由标签」—— 它们说的是**这条内容怎么被抽到**,不是「这个地方长什么样」。
 *
 * `general` 是到处都可能,`chain` 是奇缘的阶段事件(只有 `pickChainStageEvent`
 * 请得出来,任何区域都不许引用它)。两者都不指向地形,是设计而非漏项:
 * 给它们硬派一座山,等于替内容编一个它没有的身份。
 *
 * 不给它们兜底成山岳,而是让 `sceneTerrainOfTags` 回 null —— 这样「这类标签本来
 * 就没有地形」与「这个标签没有归处」在读出来时**分得开**,判据才立得住。
 */
const ROUTING_TAGS: ReadonlySet<string> = new Set(["general", "chain"]);

/**
 * 事件/地界标签 → 地形(标签两处共用:`RegionDef.eventTags` 与 `EventDef.tags`)。
 *
 * `general` 是「到处都可能」的那一类,不指向任何地形 —— 它排在最后,
 * 任何一条符合地形的标签都优先于它。
 */
const TAG_TERRAIN: Record<string, SceneTerrain> = {
  mountain: "peaks",
  forest: "forest",
  water: "water",
  fire: "flame",
  ruin: "ruin",
  sword: "ruin",
  ice: "frost",
  thunder: "sky",
  sky: "sky",
  immortal: "sky",
  god: "palace",
  chaos: "void",
  dark: "void",
};

/**
 * 一处地方长什么样 —— 世界定底子,地界图标优先,标签最后。
 *
 * 顺序是刻意的:图标是**这一处**自己的身份,比世界的底子更近;标签是「这一带是
 * 山野还是水乡」,最泛。三者都没有时落回世界底子,世界也没有时落回山岳。
 */
export function sceneTerrainOfPlace(place: {
  worldId?: string | null;
  icon?: string | null;
  tags?: readonly string[] | null;
}): SceneTerrain {
  const byIcon = place.icon ? ICON_TERRAIN[place.icon] : undefined;
  if (byIcon) return byIcon;
  for (const tag of place.tags ?? []) {
    if (ROUTING_TAGS.has(tag)) continue;
    const byTag = TAG_TERRAIN[tag];
    if (byTag) return byTag;
  }
  const byWorld = place.worldId ? WORLD_TERRAIN[place.worldId] : undefined;
  return byWorld ?? "peaks";
}

/**
 * 一条事件的标签 → 地形。路由标签(见 ROUTING_TAGS)不指向某一种地,直接跳过。
 *
 * 一路都不指向时落回山岳 —— 与 `sceneTerrainOfPlace` 同一条兜底纪律。
 */
export function sceneTerrainOfTags(tags: readonly string[] | null | undefined): SceneTerrain {
  for (const tag of tags ?? []) {
    if (ROUTING_TAGS.has(tag)) continue;
    const byTag = TAG_TERRAIN[tag];
    if (byTag) return byTag;
  }
  return "peaks";
}

/**
 * 天劫 → 地形。
 *
 * 五种劫各有一副"长相",不共用一个底:雷鸣是雷雨天(星野),逆流是灵气倒灌的江海,
 * 裂魂是神魂被撼的虚空,铁躯是层层碾落的宫阙之压,重压是起手两道重击的悬空雷池。
 *
 * 这是**这一屏自己的身份**,与玩家站哪片地界无关 —— 渡劫那一刻的戏眼是天上落下
 * 的那一道,不是脚下的山。故它不进 `sceneTerrainOfPlace`,单独一支。
 */
const TRIBULATION_TERRAIN: Record<string, SceneTerrain> = {
  thunder: "sky",
  counterflow: "water",
  soulrend: "void",
  ironbody: "palace",
  heavyrush: "flame",
};

/** 一场天劫长什么样;认不出的劫名落到虚空(最不像「寻常风景」的那一种) */
export function sceneTerrainOfTribulation(kind: string | null | undefined): SceneTerrain {
  return (kind && TRIBULATION_TERRAIN[kind]) || "void";
}

/**
 * 天界六界 → 地形。
 *
 * 这六界既不是地界(`RegionDef`,没有 icon),也不在 `WORLDS` 那四界里 ——
 * 它们是**天界自己的一层世界**,id 只在 `data/endgame` 的 `CELESTIAL_WORLDS` 里。
 * 故与天劫那一支同一条做法:单开一份表,不塞进 `sceneTerrainOfPlace` 的三级分派。
 *
 * 每一界按它**自己的那句话**取景,这是判据一直逼着的那件事 ——
 * 六界共用一片天,那一栏就还是六个色块加六行字:
 *
 *   赤炎天「天穹燃烧,雷火贯体」        → 火域
 *   星陨天「星斗倾颓,陨石如雨」        → 星野
 *   万刃天「亿万飞刃永不停歇」          → 遗迹(断刃与断柱是同一件东西的两面)
 *   无生天「此界拒绝生机」              → 雪原(冻住的,不长东西的那种白)
 *   无相天「万物无相,出手落空」        → 虚空
 *
 * 六界只有五副现成长相,故「无生天」与「无相天」不能都落虚空 —— 前者是**冻死的**,
 * 后者是**空的**,雪原与虚空正好分得开。
 */
const CELESTIAL_TERRAIN: Record<string, SceneTerrain> = {
  chiyan: "flame",
  xingyun: "sky",
  wanren: "ruin",
  wusheng: "frost",
  wuxiang: "void",
};

/**
 * 一个天界世界长什么样。
 *
 * 认不出的 id 落到**虚空**而不是山岳:这一层世界里没有「寻常山水」这一档,
 * 虚界之门(程序生成、id 不在常量表里)正该是虚空。落回山岳会让「虚界」看起来
 * 像青云山麓 —— 而兜底值与正常值读出同一个结果,正是判据最反对的那件事。
 */
export function sceneTerrainOfCelestial(worldId: string | null | undefined): SceneTerrain {
  return (worldId && CELESTIAL_TERRAIN[worldId]) || "void";
}

/**
 * 地貌轴(`core/mortalIdentity` 的 `TerrainAxis`)→ 地形。
 *
 * 这六轴是**世界生成**用的词汇(山岳 / 林泽 / 火域 / 天象 / 废墟 / 幽冥),
 * 与 `SceneTerrain` 那九种按说不是一回事:前者是"这一带的地貌构成",
 * 后者是"这一屏该画哪片天"。两套词汇各说各的,直接混用会让下一个人
 * 以为它们等价 —— 故这里明确是一张**翻译表**。
 *
 * 它的用处是把 `DaoluDef.terrains` 读出来:十位道侣各自写着"她会在哪一种
 * 地貌遇见",而这份表至今只被 `exploration` 用来决定"这片地上能不能遇见她",
 * 界面上一个字都没露过。
 */
const AXIS_TERRAIN: Record<string, SceneTerrain> = {
  山岳: "peaks",
  林泽: "forest",
  火域: "flame",
  天象: "sky",
  废墟: "ruin",
  幽冥: "void",
};

/**
 * 一处地貌轴长什么样;**认不出给 null**,不给兜底地形。
 *
 * 与 `sceneTerrainOfPlace` / `sceneTerrainOfCelestial` 的兜底纪律不同,这一处
 * 必须回 null:调用方要回答的是"这个人属于哪片地",而 `terrains` 为空是
 * 「随处可遇」——那不是缺数据,是**答案**。兜底成山岳等于替玩家编一个她的故乡。
 */
export function sceneTerrainOfAxis(axis: string | null | undefined): SceneTerrain | null {
  return (axis && AXIS_TERRAIN[axis]) || null;
}

/**
 * 师承四脉 → 地形。
 *
 * 四脉是**四种完全不同的活法**,`data/mentors` 里每一脉都写着自己的形象与师尊:
 *
 *   剑修「一剑破万法」师尊青松剑叟   → 山岳(剑修立在山门上,青松二字就是那处)
 *   丹修「草木通神」  师尊百草婆婆   → 林麓(草木为本)
 *   阵修「定鼎乾坤」  师尊玄机子     → 宫阙(阵是构筑出来的格局,不是野地)
 *   猎修「踏遍山河」  师尊哮天翁     → 星野(他望的是路与远处,不是某一处山门)
 *
 * 四脉各占一种,不重叠 —— 择师谱是一屏「择一而事之」的地方,
 * 两脉画成同一片就等于那一屏只有三个选项。
 */
const MENTOR_TERRAIN: Record<string, SceneTerrain> = {
  swordsman: "peaks",
  alchemist: "forest",
  arraymaster: "palace",
  hunter: "sky",
};

/**
 * 一位师尊那一脉长什么样。
 *
 * 认不出时落回**山岳**:师承是门内的四脉,一定属于某处山门 ——
 * 这与 `sceneTerrainOfAxis` 回 null 不矛盾,那一处要回答的是「她随处可遇」,
 * 而这里没有那种答案。
 */
export function sceneTerrainOfMentor(mentorId: string | null | undefined): SceneTerrain {
  return (mentorId && MENTOR_TERRAIN[mentorId]) || "peaks";
}

/**
 * 八条道途 → 地形。
 *
 * 「修行画像」那一屏讲的不是「你在哪」,是「**你是谁**」—— 而道途就是那个答案。
 * `data/endgame` 的每条 `DAO_PATHS` 都写着一种活法,八条是八种完全不同的东西,
 * 故这里逐条取景,一条不许与另一条重合:
 *
 *   剑道  「极致的锋锐,换走厚重的余地」        → 雪原(峰更锐、雪线更低)
 *   镇岳道「以身为岳,先立于不败」              → 山岳
 *   长生道「不争一时之胜,只求万世长存」        → 林麓(活着、慢慢长的那种)
 *   天机道「窥破天机,亦被天机所窥」            → 星野
 *   杀伐道「以战证道。你我皆利刃,先断者输」    → 遗迹
 *   连珠道「一击连着一击,流水不复」            → 江海
 *   血河道「残血见真章,越残越凶」              → 火域
 *   借势道「以守为攻,不先出手」                → 宫阙(守是构筑出来的,不是野地)
 *
 * 九种地形里只有虚空没被用:虚空是「什么都没有」,而八条道途都是**一种活法** ——
 * 「什么都没有」不属于这八条里的任何一条。
 */
const DAO_TERRAIN: Record<string, SceneTerrain> = {
  sword: "frost",
  zhenyue: "peaks",
  longevity: "forest",
  fate: "sky",
  slaughter: "ruin",
  lianzhu: "water",
  xuehe: "flame",
  jieshi: "palace",
};

/**
 * 一条道途长什么样。
 *
 * 未定道途(或认不出)落回**山岳**:修士未择道时就在山门里,
 * 画像总要画点什么 —— 这与 `sceneTerrainOfAxis` 回 null 不矛盾,
 * 那一处「随处可遇」本身是一个答案,这里「还没选」不是。
 */
export function sceneTerrainOfDao(daoId: string | null | undefined): SceneTerrain {
  return (daoId && DAO_TERRAIN[daoId]) || "peaks";
}

/**
 * 限时机缘卷 —— 两种缘起、洞府五处地点 → 地形。
 *
 * 这一卷有一个倒计时在走、几签只能择一、选定即生效 —— 它做的**恰恰是一个
 * 来不及细读的决定**。那种屏上,画比字先到:玩家先看见「这是修行里的事」还是
 * 「这是丹房里的事」,再决定要不要读下去。
 *
 * 两档分开写而不是一张表,因为它们是两个层次的身份:
 *   · `kind` 是**这件事从哪来**(顿悟在修行里 / 巡游在洞府某处);
 *   · `place` 只在洞府那一路才有,是**洞府里的哪一处**。
 * 混成一张表会让「library」这种地点名与「enlightenment」这种缘起名平起平坐,
 * 下一个人读不出哪一层管哪一层。
 */
const OPPORTUNITY_KIND_TERRAIN: Record<string, SceneTerrain> = {
  /** 顿悟:修行里忽然亮起来的那一瞬 —— 星野(天光落在一个人身上) */
  enlightenment: "sky",
  /** 洞府巡游:在自己这一亩地里走动 —— 兜底给林麓(洞府坐落在山中) */
  cave: "forest",
};

/**
 * 洞府五处 —— 每一处是**一种不同的活计**,故五副长相不重叠。
 *
 *   灵田   —— 种(笔直成行的那种地)          → 山岳:梯田沿坡开
 *   丹炉   —— 火                          → 火域
 *   藏经阁 —— 存(层层叠起来的书)            → 宫阙
 *   聚灵阵 —— 构(地上画出来的圈与线)        → 星野(阵纹亮起时像天上的图)
 *   灵兽园 —— 养(有活物在里头)              → 林麓
 *
 * 这五种正好把九种地形里最"人间"的五种用掉,一处不与另一处重合。
 */
const CAVE_PLACE_TERRAIN: Record<string, SceneTerrain> = {
  field: "peaks",
  furnace: "flame",
  library: "palace",
  array: "sky",
  garden: "forest",
};

/**
 * 一张限时机缘卷长什么样。
 *
 * 认不出的地点落回**这一档自己的兜底**(洞府 → 林麓,顿悟 → 星野),
 * 不回 null:这一卷必须有画,倒计时在走,画是唯一一眼能认的东西。
 */
export function sceneTerrainOfOpportunity(
  kind: string | null | undefined,
  place: string | null | undefined,
): SceneTerrain {
  if (kind === "cave") {
    return (place && CAVE_PLACE_TERRAIN[place]) || OPPORTUNITY_KIND_TERRAIN.cave!;
  }
  return OPPORTUNITY_KIND_TERRAIN[kind ?? ""] ?? OPPORTUNITY_KIND_TERRAIN.enlightenment!;
}
