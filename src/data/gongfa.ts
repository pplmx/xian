/**
 * 功法库 —— 82 部:主修 34 / 辅修 30 / 秘术 18,每境都有新东西可参
 *
 * ## 品阶分布(与实物同源,由 core/gongfaQualityLadder.spec 钉住)
 *
 *   凡品 8 · 良品 13 · 精品 7 · 灵品 9 · 玄品 9 · 地品 2 · 天品 7 · 仙品 13 · 神品 14
 *
 * 地品那一格此前是**空的**:玄品(rank 4)与天品(rank 6)之间没有任何一部功法,
 * 玩家从玄品一路参悟上来,会在中间撞上一段没有东西可参的路。
 * 灵兽那边跳过凡/良是文件头明写的取舍(按神话谱系收,不硬凑);功法这边从来没有
 * 一句「地品留空」的说法。而地品是**中间那一档**,不是尾巴 —— 断在中间不叫取舍。
 *
 * 补的两门落在**玄品已退场、天品还没接上**的那一段。实测各档的准入境界范围:
 *
 *   玄品(rank 4)3~5 境 · 地品(rank 5)此前为空 · 天品(rank 6)6~8 境
 *
 *   · 合体(6)主修「玄牝合真经」—— 合体此前只有《混沌一气功》一门主修,而主修席
 *     唯一,玩家的选择数就是 1;补上才是 2。
 *   · 大乘(7)辅修「流云遁空篇」—— 把辅修席那一路从「只有修速与悟性两条轴」
 *     补上第三条(闪避与历练速度),配上去是一种走法而不是一处数值。
 *
 * 两门各带两条悟道分支(见 data/gongfaBranches),不把任何已有功法往上抬一档。
 */
import type { GongfaDef, GongfaType, QualityId, StatMods } from "@/types";

function g(
  id: string,
  name: string,
  type: GongfaType,
  quality: QualityId,
  minRealm: number,
  desc: string,
  baseMods: StatMods,
  perLevelMods: StatMods,
  opts: { element?: GongfaDef["element"]; maxLevel?: number; skill?: GongfaDef["skill"] } = {},
): GongfaDef {
  return {
    id,
    name,
    type,
    quality,
    minRealm,
    desc,
    baseMods,
    perLevelMods,
    maxLevel: opts.maxLevel ?? (type === "secret" ? 3 : 9),
    element: opts.element,
    skill: opts.skill,
  };
}

export const GONGFA: GongfaDef[] = [
  // ---- 主修功法 ----
  g(
    "m_taixuan",
    "太玄引气诀",
    "main",
    "mortal",
    0,
    "大道至简的入门功法,胜在中正平和",
    { cultivationSpeed: 0.1 },
    { cultivationSpeed: 0.02 },
    { skill: { name: "太玄一气", mult: 1.5, rate: 0.2 } },
  ),
  g(
    "m_qingmu",
    "青木长生功",
    "main",
    "fine",
    0,
    "取青木生生不息之意,养身养气",
    { cultivationSpeed: 0.12, maxHpPct: 0.06 },
    { cultivationSpeed: 0.02, maxHpPct: 0.01 },
    { element: "wood", skill: { name: "木灵缠绕", mult: 1.4, rate: 0.2 } },
  ),
  g(
    "m_lihuo",
    "离火焚天诀",
    "main",
    "fine",
    0,
    "心火即离火,一念可焚天",
    { cultivationSpeed: 0.1, attackPct: 0.08 },
    { cultivationSpeed: 0.02, attackPct: 0.012 },
    { element: "fire", skill: { name: "焚天火", mult: 1.7, rate: 0.22 } },
  ),
  g(
    "m_kunhuang",
    "坤黄厚土诀",
    "main",
    "fine",
    0,
    "地厚以载,万古承重",
    { cultivationSpeed: 0.1, defensePct: 0.1 },
    { cultivationSpeed: 0.02, defensePct: 0.015 },
    { element: "earth", skill: { name: "厚土镇", mult: 1.5, rate: 0.2 } },
  ),
  g(
    "m_xuanshui",
    "玄水凝真经",
    "main",
    "fine",
    0,
    "上善若水,以柔克刚",
    { cultivationSpeed: 0.1, defensePct: 0.08, qiRegen: 0.08 },
    { cultivationSpeed: 0.02, defensePct: 0.012 },
    { element: "water", skill: { name: "寒潮", mult: 1.5, rate: 0.2 } },
  ),
  /*
   * 五系在低品质段各只有一部,而 `ice` / `dark` **低品质段一部都没有**
   * (它们各自唯一那部在灵品 / 玄品)。
   *
   * 元素不是装饰:`core/gongfaService` 用它算同源灵根的参悟权重
   * (`gongfaAffinity`),所以一个玩家开局若灵根偏冰或偏暗,前期**没有一部同源功法**可期。
   * 补四部,把凡品 / 良品段的五系铺齐。
   *
   * 量级照同品质同类型的邻居取:良品主修 `cultivationSpeed 0.1` 起,
   * 招式倍率 1.4~1.7(见青木 / 离火 / 坤黄 / 玄水那几部)。
   */
  g(
    "m_hanbing",
    "寒冰引气诀",
    "main",
    "fine",
    0,
    "寒气自涌泉起,一线直上泥丸",
    { cultivationSpeed: 0.1, defensePct: 0.06, critRate: 0.01 },
    { cultivationSpeed: 0.02, defensePct: 0.012 },
    { element: "ice", skill: { name: "寒霜指", mult: 1.45, rate: 0.2 } },
  ),
  g(
    "m_youquan",
    "幽泉噬灵功",
    "main",
    "fine",
    0,
    "泉下有物,饮血而生;修之者,亦近于物",
    { cultivationSpeed: 0.1, attackPct: 0.07, lifesteal: 0.015 },
    { cultivationSpeed: 0.02, attackPct: 0.012 },
    { element: "dark", skill: { name: "幽泉噬", mult: 1.55, rate: 0.21 } },
  ),
  g(
    "m_cuiwei",
    "翠微养荣经",
    "main",
    "fine",
    0,
    "草木有本心,一岁一枯荣 —— 养的是那口气",
    { cultivationSpeed: 0.1, maxHpPct: 0.06, regenPerRound: 0.01 },
    { cultivationSpeed: 0.02, maxHpPct: 0.012 },
    { element: "wood", skill: { name: "回春引", mult: 1.4, rate: 0.19 } },
  ),
  g(
    "m_lieyan",
    "烈炎搬运法",
    "main",
    "fine",
    0,
    "以身为炉,以息为风 —— 搬的是自己这团火。不求势大,求一击到底",
    /*
     * 与同境界同品阶的「离火焚天诀」必须**各有立足点**:
     * 离火是 `attackPct 0.08` 的纯攻势,这条就压攻击、抬暴击伤害 ——
     * 若两边攻击相同而这条多一条 `critDamage`,它就全面压过离火,
     * 而主修席只有一格,那一格就没理由留给离火了(判据 `gongfaEffectAudit` 会红)。
     */
    { cultivationSpeed: 0.1, attackPct: 0.05, critDamage: 0.12 },
    { cultivationSpeed: 0.02, attackPct: 0.008, critDamage: 0.012 },
    { element: "fire", skill: { name: "烈焰掌", mult: 1.5, rate: 0.2 } },
  ),
  g(
    "m_canghai",
    "沧海纳流诀",
    "main",
    "fine",
    0,
    "百川归海,不择细流 —— 气机愈蓄愈深",
    { cultivationSpeed: 0.1, maxHpPct: 0.05, qiRegen: 0.1 },
    { cultivationSpeed: 0.02, maxHpPct: 0.01 },
    { element: "water", skill: { name: "沧浪叠", mult: 1.45, rate: 0.2 } },
  ),
  g(
    "m_gengjin",
    "庚金剑典",
    "main",
    "excellent",
    1,
    "庚金主杀伐,剑修之上选",
    { cultivationSpeed: 0.14, attackPct: 0.12, critRate: 0.02 },
    { cultivationSpeed: 0.02, attackPct: 0.015 },
    { element: "metal", skill: { name: "庚金剑气", mult: 1.9, rate: 0.25 } },
  ),
  g(
    "m_houtu",
    "厚土不动明王功",
    "main",
    "excellent",
    1,
    "不动如山,万法难侵",
    { cultivationSpeed: 0.12, defensePct: 0.14, maxHpPct: 0.1 },
    { cultivationSpeed: 0.02, defensePct: 0.015, maxHpPct: 0.012 },
    { element: "earth", skill: { name: "山岳压顶", mult: 1.6, rate: 0.22 } },
  ),
  g(
    "m_zixiao",
    "紫霄神雷诀",
    "main",
    "spirit",
    2,
    "引九天神雷淬体炼魂",
    { cultivationSpeed: 0.18, attackPct: 0.14, speed: 0.05 },
    { cultivationSpeed: 0.025, attackPct: 0.018 },
    { element: "thunder", skill: { name: "紫霄神雷", mult: 2.2, rate: 0.25 } },
  ),
  g(
    "m_gangfeng",
    "罡风渡虚法",
    "main",
    "spirit",
    2,
    "身化罡风,来去无踪",
    { cultivationSpeed: 0.16, dodgeRate: 0.04, explorationSpeed: 0.1 },
    { cultivationSpeed: 0.025, dodgeRate: 0.005 },
    { element: "wind", skill: { name: "风刃千重", mult: 1.9, rate: 0.28 } },
  ),
  g(
    "m_xuanbing",
    "玄冰道典",
    "main",
    "spirit",
    3,
    "心如玄冰,道心通明",
    { cultivationSpeed: 0.18, defensePct: 0.12, damageReduction: 0.04 },
    { cultivationSpeed: 0.025, defensePct: 0.015 },
    // ×2.0 → ×2.3:境 3 的顶原先低于境 2 的紫霄神雷(×2.2)—— 招式越练越弱。
    // 判据 gongfaEffectAudit 按「每境最高招式」比,这条回落当场红。
    { element: "ice", skill: { name: "冰封千里", mult: 2.3, rate: 0.24 } },
  ),
  g(
    "m_guangming",
    "大光明普照经",
    "main",
    "profound",
    4,
    "光明所照,诸邪辟易",
    { cultivationSpeed: 0.22, maxHpPct: 0.16, breakthroughRate: 0.02 },
    { cultivationSpeed: 0.03, maxHpPct: 0.02 },
    { element: "light", skill: { name: "大光明拳", mult: 2.3, rate: 0.25 } },
  ),
  g(
    "m_youming",
    "幽冥噬魂录",
    "main",
    "profound",
    4,
    "噬魂夺魄,亦正亦邪",
    { cultivationSpeed: 0.22, attackPct: 0.18, lifesteal: 0.03 },
    { cultivationSpeed: 0.03, attackPct: 0.02 },
    { element: "dark", skill: { name: "噬魂", mult: 2.2, rate: 0.26 } },
  ),
  g(
    "m_hundun",
    "混沌一气功",
    "main",
    "heaven",
    6,
    "万法归一,一气化混沌",
    { cultivationSpeed: 0.3, attackPct: 0.12, defensePct: 0.12, maxHpPct: 0.12 },
    { cultivationSpeed: 0.04, attackPct: 0.015, defensePct: 0.015 },
    { element: "chaos", skill: { name: "混沌一击", mult: 2.8, rate: 0.25 } },
  ),
  g(
    "m_dujie",
    "九霄渡劫经",
    "main",
    "heaven",
    8,
    "引九霄雷气淬身,劫数亦成道基",
    { cultivationSpeed: 0.3, attackPct: 0.16, tribulationResist: 0.18 },
    { cultivationSpeed: 0.04, attackPct: 0.018 },
    { element: "thunder", skill: { name: "九霄雷劫", mult: 3.0, rate: 0.26 } },
  ),
  g(
    "m_taixu",
    "太虚炼神篇",
    "main",
    "profound",
    5,
    "炼神返虚,虚室生白 —— 神全则形不敝",
    { cultivationSpeed: 0.2, defensePct: 0.12, qiRegen: 0.1 },
    { cultivationSpeed: 0.03, defensePct: 0.014 },
    { skill: { name: "炼神返虚", mult: 2.4, rate: 0.24 } },
  ),
  g(
    "m_wuliang",
    "无量寿光经",
    "main",
    "heaven",
    7,
    "取无量寿之意,光所照处,寿与道同长",
    { cultivationSpeed: 0.32, maxHpPct: 0.2, lifespanPct: 0.08 },
    { cultivationSpeed: 0.04, maxHpPct: 0.02, lifespanPct: 0.01 },
    { element: "light", skill: { name: "无量寿光", mult: 2.9, rate: 0.25 } },
  ),
  /*
   * 地品(rank 5)—— 九档里此前唯独这一档是空的(见文件头的品阶分布表)。
   *
   * 写在**玄品已退场、天品还没接上**的第 6 境,而不是给已有档位再添一门:
   * 合体此前只有《混沌一气功》一门主修,而主修席唯一 —— 玩家在这一境的选择数
   * 就是 1。补上之后才是 2。
   *
   * 数值夹在玄品与天品同族之间(玄品修速 0.20~0.22、天品 0.30~0.32;玄品气血 0.12、
   * 天品 0.20),取中 —— 地品在九档里正好是「玄之上、天之下」那一格。
   * 先手判定没给:这一族加成的步长是 5%(见 core/speedGranularity),
   * 给 3~4% 跨不过任何一档,等于没给。
   */
  g(
    "m_xuanpin",
    "玄牝合真经",
    "main",
    "earth",
    6,
    "谷神不死,是谓玄牝 —— 以柔养刚,形与神合于一处",
    { cultivationSpeed: 0.26, maxHpPct: 0.16, defensePct: 0.1, qiRegen: 0.08 },
    { cultivationSpeed: 0.035, maxHpPct: 0.018, defensePct: 0.012 },
    { skill: { name: "玄牝守一", mult: 2.6, rate: 0.25 } },
  ),
  // ---- 辅修功法 ----
  g(
    "s_tuna",
    "龟灵吐纳术",
    "sub",
    "mortal",
    0,
    "一吐一纳,绵绵不绝",
    { cultivationSpeed: 0.06 },
    { cultivationSpeed: 0.012 },
  ),
  g(
    "s_lianti",
    "百炼锻体术",
    "sub",
    "mortal",
    0,
    "肉身为炉,千锤百炼",
    { maxHpPct: 0.08, defensePct: 0.04 },
    { maxHpPct: 0.012, defensePct: 0.008 },
  ),
  /*
   * 辅修与秘术此前**一部带元素的都没有**(25 + 16 全空),而主修 34 部里 28 部有元素。
   *
   * `core/gongfaService` 抽功法时按 `gongfaAffinity(g.element, elements)` 加权 ——
   * `element` 缺省时 `affinityMult` 返回 1(无倾向)。所以这不是错误,是缺内容:
   * 灵根偏冰的玩家在辅修席上永远遇不到「冰系辅修」,倾向只作用在主修那一条线上。
   *
   * 补五部带元素的辅修,量级照同品质的邻居走(辅修凡品 / 良品都在
   * `cultivationSpeed 0.06` 上下)。秘术席不动 —— 它是"占辅修席但效果更怪"的一类,
   * 不挂元素反而更贴它的定位。
   */
  g(
    "s_hanxi",
    "寒息诀",
    "sub",
    "mortal",
    0,
    "吸一口寒气入肺,呼出来的已是白霜",
    { cultivationSpeed: 0.06, defensePct: 0.02 },
    { cultivationSpeed: 0.012 },
    { element: "ice" },
  ),
  g(
    "s_muyin",
    "沐阴引",
    "sub",
    "mortal",
    0,
    "阴处生苔,苔上有气 —— 引之入脉,无声无息",
    { cultivationSpeed: 0.06, lifesteal: 0.008 },
    { cultivationSpeed: 0.012 },
    { element: "dark" },
  ),
  g(
    "s_qingya",
    "青芽吐纳",
    "sub",
    "mortal",
    0,
    "一芽破土,先要顶开自己上面那层土",
    { cultivationSpeed: 0.06, maxHpPct: 0.03 },
    { cultivationSpeed: 0.012 },
    { element: "wood" },
  ),
  g(
    "s_yanxi",
    "炎息法",
    "sub",
    "mortal",
    0,
    "息自肺出,过处皆焦 —— 练的是把火养在里头",
    { cultivationSpeed: 0.06, attackPct: 0.03 },
    { cultivationSpeed: 0.012 },
    { element: "fire" },
  ),
  g(
    "s_chaoxi",
    "潮汐坐忘",
    "sub",
    "mortal",
    0,
    "潮来则息,潮去则止 —— 坐忘的人,身上有涨落",
    { cultivationSpeed: 0.06, qiRegen: 0.04 },
    { cultivationSpeed: 0.012 },
    { element: "water" },
  ),
  g(
    "s_qiti",
    "淬体养息诀",
    "sub",
    "fine",
    0,
    "以息养体,气血渐盈",
    { qiRegen: 0.1, maxHpPct: 0.06 },
    { qiRegen: 0.016, maxHpPct: 0.008 },
  ),
  g(
    "s_yufeng",
    "御风步",
    "sub",
    "fine",
    0,
    "踏风而行,身轻如燕",
    { speed: 0.05, explorationSpeed: 0.06 },
    { speed: 0.008, explorationSpeed: 0.01 },
  ),
  g(
    "s_lianxi",
    "敛息诀",
    "sub",
    "fine",
    1,
    "敛尽气机,祸事不近身",
    { dodgeRate: 0.03, luck: 0.03 },
    { dodgeRate: 0.004, luck: 0.005 },
  ),
  g(
    "s_juling",
    "聚灵阵法初解",
    "sub",
    "fine",
    1,
    "布下小型聚灵阵辅助修行",
    { qiRegen: 0.12 },
    { qiRegen: 0.02 },
  ),
  g(
    "s_mingxin",
    "明心见性篇",
    "sub",
    "excellent",
    1,
    "观己心,见本性",
    { expGain: 0.08, breakthroughRate: 0.01 },
    { expGain: 0.015, breakthroughRate: 0.002 },
  ),
  g(
    "s_tiegu",
    "铁骨铮铮功",
    "sub",
    "excellent",
    2,
    "骨如玄铁,宁折不弯",
    { defensePct: 0.1, damageReduction: 0.03 },
    { defensePct: 0.015, damageReduction: 0.005 },
  ),
  g(
    "s_lingxi",
    "灵犀一指",
    "sub",
    "excellent",
    2,
    "指出灵犀,直指要害",
    { critRate: 0.03, critDamage: 0.1 },
    { critRate: 0.004, critDamage: 0.02 },
  ),
  g(
    "s_dianshi",
    "点石成金术",
    "sub",
    "spirit",
    3,
    "沙里淘金,点石成宝",
    { spiritStoneGain: 0.15, dropRate: 0.06 },
    { spiritStoneGain: 0.025, dropRate: 0.01 },
  ),
  g(
    "s_guixi",
    "龟息养寿功",
    "sub",
    "spirit",
    3,
    "息心止念,寿与天齐",
    { lifespanPct: 0.06, maxHpPct: 0.08 },
    { lifespanPct: 0.012, maxHpPct: 0.012 },
  ),
  /*
   * 元婴境(4)此前一部辅修、一部秘术都没有 —— 那一境只有两部**主修**,
   * 而主修席唯一,于是「参悟」在元婴境其实没有选择可言。
   * 补这一部,正是 data/gongfa 里那句注释认定的缺陷:
   * 「主修只此一部、辅修只此一部的时候,参悟这件事就没有选择可言」。
   */
  g(
    "s_yuanying",
    "元神灵动篇",
    "sub",
    "profound",
    4,
    "元婴初成,神魂未凝,正当以静养之",
    { cultivationSpeed: 0.11, breakthroughRate: 0.02 },
    { cultivationSpeed: 0.018, breakthroughRate: 0.004 },
  ),
  g(
    "s_zhoutian",
    "周天星辰图",
    "sub",
    "profound",
    5,
    "以身为宇,以窍为星",
    { cultivationSpeed: 0.12, qiRegen: 0.1 },
    { cultivationSpeed: 0.02, qiRegen: 0.02 },
  ),
  g(
    "s_wanjian",
    "万剑归宗图",
    "sub",
    "profound",
    5,
    "万剑朝宗,杀伐无双",
    { attackPct: 0.15, comboRate: 0.04 },
    { attackPct: 0.02, comboRate: 0.006 },
  ),
  g(
    "s_budong",
    "不动如山章",
    "sub",
    "excellent",
    1,
    "身如山岳,盾罡不息",
    { shieldOnStart: 0.06, shieldPower: 0.08 },
    { shieldOnStart: 0.01, shieldPower: 0.015 },
  ),
  g(
    "s_xingshen",
    "形神合一诀",
    "sub",
    "heaven",
    6,
    "身与道合,伤处自弥 —— 形神从此不再两分",
    { maxHpPct: 0.2, defensePct: 0.12, regenPerRound: 0.012 },
    { maxHpPct: 0.022, defensePct: 0.014 },
  ),
  g(
    "s_puti",
    "菩提明镜功",
    "sub",
    "heaven",
    7,
    "心如明镜台,时时勤拂拭 —— 悟得快,劫也渡得稳",
    { expGain: 0.12, breakthroughRate: 0.02, luck: 0.06 },
    { expGain: 0.018, breakthroughRate: 0.003, luck: 0.008 },
  ),
  /*
   * 地品(rank 5)辅修,第 8 境(渡劫)。
   *
   * 渡劫此前只有一门主修《九霄渡劫经》与一门秘术《九霄劫印》—— 两部都在讲
   * 「怎么扛住那道雷」,辅修席一部可配的都没有。补一门**不硬扛**的路数:
   * 遁空而行,劫来时走在前面。这不是把同一条轴抬高,而是给这一境第二种答法。
   *
   * 与玄品辅修(《元神灵动篇》修速、《周天星辰图》修速 + 灵气)相比,
   * 这一门给的是另一条轴。
   *
   * 门槛定在渡劫而不是大乘(7):大乘的三门已把「修速 / 悟性 / 气运」占满,
   * 而渡劫的辅修席是空着的 —— 空着的那一席才是缺口。
   */
  g(
    "s_liuyun",
    "流云遁空篇",
    "sub",
    "earth",
    8,
    "云无心以出岫,身随云去 —— 打不着的东西才最难败",
    { dodgeRate: 0.05, explorationSpeed: 0.12, speed: 0.06 },
    { dodgeRate: 0.006, explorationSpeed: 0.02 },
  ),
  // ---- 秘术 ----
  g(
    "x_tianyan",
    "天眼通",
    "secret",
    "excellent",
    2,
    "开天眼,窥机缘",
    { luck: 0.06, eventLuck: 0.08 },
    { luck: 0.02, eventLuck: 0.03 },
  ),
  /*
   * 同上:元婴境缺一部秘术。秘术占辅修席(见 AGENTS.md「secret 装配时也占辅修席」),
   * 故它与上面那部辅修一样,给的是"主修之外还能装什么"。
   */
  g(
    "x_yuanying",
    "婴火炼神术",
    "secret",
    "profound",
    4,
    "以婴火温养神识,神完则形不亏",
    { maxHpPct: 0.1, cultivationSpeed: 0.08 },
    { maxHpPct: 0.018, cultivationSpeed: 0.012 },
  ),
  g(
    "x_jingang",
    "金刚不坏身",
    "secret",
    "spirit",
    3,
    "法身金刚,不坏不灭",
    { damageReduction: 0.08, lowHpReduction: 0.15 },
    { damageReduction: 0.02, lowHpReduction: 0.05 },
  ),
  g(
    "x_jianxin",
    "剑心通明",
    "secret",
    "spirit",
    3,
    "剑心澄澈,料敌先机",
    { critRate: 0.05, critDamage: 0.2 },
    { critRate: 0.01, critDamage: 0.06 },
  ),
  g(
    "x_xiangsi",
    "向死而生诀",
    "secret",
    "spirit",
    2,
    "置之死地,而后方生",
    { lowHpDamage: 0.2, lowHpReduction: 0.1 },
    { lowHpDamage: 0.06, lowHpReduction: 0.03 },
  ),
  g(
    "x_fanzhen",
    "天罡反震诀",
    "secret",
    "spirit",
    3,
    "以彼之力,还施彼身",
    { counterRate: 0.08, counterDamage: 0.25 },
    { counterRate: 0.02, counterDamage: 0.08 },
  ),
  g(
    "x_sanqing",
    "一气化三清",
    "secret",
    "profound",
    5,
    "一气化三,修行三倍",
    { cultivationSpeed: 0.2 },
    { cultivationSpeed: 0.06 },
  ),
  g(
    "x_shuangjia",
    "霜甲凝身诀",
    "secret",
    "profound",
    3,
    "寒气护体,皮骨俱坚",
    { defensePct: 0.08, maxHpPct: 0.06 },
    { defensePct: 0.02, maxHpPct: 0.02 },
  ),
  g(
    "x_woxuan",
    "斡旋造化",
    "secret",
    "heaven",
    6,
    "窃天地造化为己用",
    { breakthroughRate: 0.04, breakRefund: 0.1 },
    { breakthroughRate: 0.01, breakRefund: 0.04 },
  ),
  g(
    "x_nitian",
    "逆天改命经",
    "secret",
    "immortal",
    7,
    "我命由我不由天",
    { luck: 0.1, breakthroughRate: 0.05, lifespanPct: 0.1 },
    { luck: 0.03, breakthroughRate: 0.012, lifespanPct: 0.03 },
  ),
  g(
    "x_jiuxiao",
    "九霄劫印",
    "secret",
    "heaven",
    8,
    "把九重雷劫缩成一枚印 —— 劫来则印出,以劫淬身",
    { tribulationResist: 0.2, damageReduction: 0.06, breakthroughRate: 0.03 },
    { tribulationResist: 0.05, breakthroughRate: 0.008 },
  ),
  // ---- 仙界及以上(准入境界 9-20)----
  g(
    "m_yuxu",
    "御虚仙典",
    "main",
    "immortal",
    9,
    "御虚而行,仙光护体,一步一重天",
    { cultivationSpeed: 0.34, attackPct: 0.16, defensePct: 0.14, maxHpPct: 0.14 },
    { cultivationSpeed: 0.045, attackPct: 0.018, defensePct: 0.016 },
    { element: "wind", skill: { name: "御虚仙光", mult: 3.0, rate: 0.26 } },
  ),
  g(
    "s_xianling",
    "仙灵淬体术",
    "sub",
    "immortal",
    10,
    "以仙灵之气淬炼肉身,脱胎换骨",
    { maxHpPct: 0.18, defensePct: 0.14, regenPerRound: 0.012 },
    { maxHpPct: 0.022, defensePct: 0.015 },
  ),
  g(
    "x_xianji",
    "仙机通玄",
    "secret",
    "immortal",
    11,
    "仙机在握,福祸先知",
    { luck: 0.12, eventLuck: 0.16, dropRate: 0.12 },
    { luck: 0.035, eventLuck: 0.045, dropRate: 0.03 },
  ),
  /*
   * 秘术席在境界 9、10 是**断档**:`data/gongfa.ts` 表头写着「每境都有新东西可参」,
   * 而按席位摊开,秘术有 9 个境界没有新增(主修 21/21 全覆盖,辅修断 5 处)。
   * 累计数够用(境 9 有 11 部可装配),所以不是"没得选",而是那句话不成立。
   *
   * 补两部仙品秘术,把 9、10 两境填上 —— 仙界初期的秘术任选也是数据文件自己
   * 在补仙界时立过的规矩(「参悟这件事就没有选择可言」是缺陷)。
   */
  g(
    "x_yunqi",
    "云气化形",
    "secret",
    "immortal",
    9,
    "云本无形,借一气便能成形 —— 形是什么,看借气的人",
    { dodgeRate: 0.06, damageReduction: 0.06, maxHpPct: 0.06 },
    { dodgeRate: 0.018, damageReduction: 0.018 },
  ),
  g(
    "x_xingluo",
    "星罗棋布",
    "secret",
    "immortal",
    10,
    "诸星各安其位,起手之前,胜负已在盘上",
    { critRate: 0.04, eventLuck: 0.12, dropRate: 0.1 },
    { critRate: 0.012, eventLuck: 0.03 },
  ),
  g(
    "x_taiyi",
    "太乙金华",
    "secret",
    "immortal",
    12,
    "回光守中,神气合于一处",
    { cultivationSpeed: 0.3, qiRegen: 0.2 },
    { cultivationSpeed: 0.06, qiRegen: 0.04 },
  ),
  g(
    "m_daluo",
    "大罗天章",
    "main",
    "immortal",
    13,
    "大罗天上,万法归真",
    /*
     * 境 13 的仙品主修。此前它**既无 skill 也无 cultivationSpeed** ——
     * 29 部主修里唯一的两样皆无:戴上之后既不能加速进阶,也打不出功法招式。
     *
     * 补的是招式,不是修速。修速先加过一版(+18%),后来又撤了 ——
     * 因为**主修从境 11 起是严格二选一**:纯战斗向(金阙玉章 0/38%、太乙 0/0、
     * 天关 0/45%、神王 0/48%、神帝 0/52%、神魔 0/54%)与纯进阶向
     * (玄仙御气经 72/0%、神霄九变 80/38%、混元无极 98/44%)。
     * 中间塞一个「修速 34% + 攻击 48%」的双高,等于在二选一的格局里开了一个
     * 没有代价的例外 —— 那比原来「什么都没有」更糟。
     *
     * 现在它站纯战斗向那一边:攻击 48.4% + 气血 36% + 减伤 8% + 招式「大罗天章」×3.4
     * (境 12 太乙金光 ×3.3 → 境 13 ×3.4,阶梯不断)。
     */
    { attackPct: 0.26, maxHpPct: 0.2, damageReduction: 0.08 },
    { attackPct: 0.028, maxHpPct: 0.02 },
    { element: "light", skill: { name: "大罗天章", mult: 3.4, rate: 0.26 } },
  ),
  g(
    "m_shenxiao",
    "神霄九变",
    "main",
    "divine",
    14,
    "九变通神,雷动九天",
    { cultivationSpeed: 0.4, attackPct: 0.2, defensePct: 0.16, maxHpPct: 0.16 },
    { cultivationSpeed: 0.05, attackPct: 0.022, defensePct: 0.017 },
    { element: "thunder", skill: { name: "神霄神雷", mult: 3.4, rate: 0.26 } },
  ),
  g(
    "s_shenjiang",
    "神将兵符",
    "sub",
    "divine",
    15,
    "执神兵以行天罚,进退皆合军律",
    { attackPct: 0.26, defensePct: 0.22, critRate: 0.04 },
    { attackPct: 0.028, defensePct: 0.022 },
  ),
  g(
    "s_shenlianti",
    "神炼不灭身",
    "sub",
    "divine",
    16,
    "神火炼体,身成不灭",
    { damageReduction: 0.1, maxHpPct: 0.2, lowHpReduction: 0.4 },
    { damageReduction: 0.022, maxHpPct: 0.024 },
  ),
  g(
    "m_hunyuan",
    "混元无极经",
    "main",
    "divine",
    18,
    "混元一体,无极而生,万法归一",
    { cultivationSpeed: 0.5, attackPct: 0.24, defensePct: 0.22, maxHpPct: 0.22 },
    { cultivationSpeed: 0.06, attackPct: 0.025, defensePct: 0.021 },
    { element: "chaos", skill: { name: "混元一炁", mult: 3.8, rate: 0.28 } },
  ),
  g(
    "s_hundunti",
    "混沌体术",
    "sub",
    "divine",
    19,
    "以混沌之气淬体,身与道同,不增不减",
    { maxHpPct: 0.24, defensePct: 0.2, damageReduction: 0.08 },
    { maxHpPct: 0.026, defensePct: 0.018 },
  ),
  g(
    "x_shenji",
    "神机衍数",
    "secret",
    "divine",
    17,
    "推演天机,行止皆在算中",
    { luck: 0.12, dropRate: 0.12, explorationSpeed: 0.12 },
    { luck: 0.035, dropRate: 0.03, explorationSpeed: 0.03 },
  ),
  g(
    "x_daoyin",
    "道音玄章",
    "secret",
    "divine",
    20,
    "大道之音不绝于耳,闻之者道基自厚",
    { cultivationSpeed: 0.32, breakthroughRate: 0.05, luck: 0.08 },
    { cultivationSpeed: 0.09, breakthroughRate: 0.015 },
  ),
  // 仙界其余四境各补一部 —— 此前 10-13 境的人只有一件本境功法可参,
  // 「主修只此一部、辅修只此一部」的时候,参悟这件事就没有选择可言。
  g(
    "s_xianguang",
    "仙光护体诀",
    "sub",
    "immortal",
    9,
    "仙光绕身三尺,刀兵未至先折其锋",
    { shieldOnStart: 0.1, shieldPower: 0.12, damageReduction: 0.05 },
    { shieldOnStart: 0.016, shieldPower: 0.02 },
  ),
  g(
    "m_xuanxian",
    "玄仙御气经",
    "main",
    "immortal",
    10,
    "御气而行,一息千里 —— 玄仙之「玄」,玄在气机不竭",
    { cultivationSpeed: 0.36, qiRegen: 0.18, defensePct: 0.14 },
    { cultivationSpeed: 0.045, defensePct: 0.015 },
    { skill: { name: "玄仙一气", mult: 3.1, rate: 0.26 } },
  ),
  g(
    "m_jinque",
    "金阙玉章",
    "main",
    "immortal",
    11,
    "玉京金阙之上刻着的章句,读之如读万剑之诀",
    { attackPct: 0.2, defensePct: 0.16, critRate: 0.02 },
    { attackPct: 0.022, defensePct: 0.016 },
    { element: "metal", skill: { name: "金阙剑气", mult: 3.2, rate: 0.26 } },
  ),
  g(
    "m_taiyijiu",
    "太乙救苦经",
    "main",
    "immortal",
    12,
    "太乙救苦,一诵经则伤者自起",
    { maxHpPct: 0.22, regenPerRound: 0.018, damageReduction: 0.06 },
    { maxHpPct: 0.022, damageReduction: 0.012 },
    // ×3.0 → ×3.3:境 12 的顶原先低于境 11 的金阙剑气(×3.2),同上。
    { element: "light", skill: { name: "太乙金光", mult: 3.3, rate: 0.25 } },
  ),
  g(
    "s_luotian",
    "罗天星辰诀",
    "sub",
    "immortal",
    13,
    "罗天星海尽在诀中,星君所执即我执",
    { accuracy: 0.06, critRate: 0.04, critDamage: 0.2 },
    { critRate: 0.005, critDamage: 0.02 },
  ),
  // 神界四境
  g(
    "x_miaogushe",
    "藐姑射神章",
    "secret",
    "divine",
    14,
    "藐姑射之山有神人居焉,不食五谷,吸风饮露",
    { damageReduction: 0.1, maxHpPct: 0.16, dodgeRate: 0.04 },
    { damageReduction: 0.02, maxHpPct: 0.022 },
  ),
  g(
    "m_tianguan",
    "天关神兵诀",
    "main",
    "divine",
    15,
    "神兵列于天关,进退皆合军律",
    { attackPct: 0.24, defensePct: 0.2, armorPen: 0.06 },
    { attackPct: 0.026, defensePct: 0.02 },
    { element: "metal", skill: { name: "天关神兵", mult: 3.5, rate: 0.27 } },
  ),
  g(
    "m_shenwang",
    "神王御极经",
    "main",
    "divine",
    16,
    "神域之主,御极临下,言出法随",
    { attackPct: 0.26, maxHpPct: 0.22, executeDamage: 0.1 },
    { attackPct: 0.028, maxHpPct: 0.022 },
    { skill: { name: "神王御极", mult: 3.6, rate: 0.27 } },
  ),
  g(
    "m_shendi",
    "神帝临尘章",
    "main",
    "divine",
    17,
    "神帝临尘,众神俯首 —— 一念即法度",
    { attackPct: 0.28, speed: 0.08, stunRate: 0.04 },
    { attackPct: 0.03, speed: 0.008 },
    { skill: { name: "神帝临尘", mult: 3.7, rate: 0.28 } },
  ),
  // 混沌海三境
  g(
    "s_zhenling",
    "真灵不昧诀",
    "sub",
    "divine",
    18,
    "混沌初开,一点真灵不昧;守着它,万劫不迷",
    { cultivationSpeed: 0.34, breakthroughRate: 0.05, luck: 0.08 },
    { cultivationSpeed: 0.045, breakthroughRate: 0.012 },
  ),
  g(
    "m_shenmo",
    "神魔开天经",
    "main",
    "divine",
    19,
    "神魔一体,以身开界 —— 打的是命,换的是界",
    { attackPct: 0.3, maxHpPct: 0.24, lifesteal: 0.03 },
    { attackPct: 0.03, maxHpPct: 0.022 },
    { element: "chaos", skill: { name: "开天一击", mult: 3.9, rate: 0.28 } },
  ),
  g(
    "m_daozu",
    "道祖本源经",
    "main",
    "divine",
    20,
    "道生一,一生万 —— 这部经从头到尾只讲一个字",
    { cultivationSpeed: 0.5, attackPct: 0.26, defensePct: 0.24, maxHpPct: 0.24 },
    { cultivationSpeed: 0.06, attackPct: 0.026, defensePct: 0.022 },
    { element: "chaos", skill: { name: "本源一炁", mult: 4.0, rate: 0.29 } },
  ),
];

const BY_ID = new Map(GONGFA.map((x) => [x.id, x]));

export function gongfaDef(id: string): GongfaDef | undefined {
  return BY_ID.get(id);
}

export const GONGFA_TYPE_NAMES: Record<GongfaType, string> = {
  main: "主修",
  sub: "辅修",
  secret: "秘术",
};
