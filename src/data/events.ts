/** 随机事件库 —— 159 个随机事件(含 21 个奇缘阶段) + 19 条机缘,数据驱动,按区域标签 + 境界带匹配 */
import type { EventChoice, EventDef, EventEffect, EventOutcome } from "@/types";
import { MAX_MAJOR, WORLD_BREAK_MAJOR } from "./realms";
import { CHAIN_EVENTS } from "./chains";

function o(weight: number, text: string, ...effects: EventEffect[]): EventOutcome {
  return { weight, text, effects: effects.length ? effects : [{ type: "nothing" }] };
}

function c(
  label: string,
  outcomes: EventOutcome[],
  opts: Partial<Omit<EventChoice, "label" | "outcomes">> = {},
): EventChoice {
  return { label, outcomes, ...opts };
}

function ev(
  id: string,
  title: string,
  text: string,
  tags: string[],
  choices: EventChoice[],
  opts: Partial<Pick<EventDef, "minRealm" | "maxRealm" | "once" | "weight" | "element">> = {},
): EventDef {
  return {
    id,
    title,
    text,
    tags,
    choices,
    weight: opts.weight ?? 100,
    minRealm: opts.minRealm,
    maxRealm: opts.maxRealm,
    once: opts.once,
    element: opts.element,
  };
}

const leave = (text = "你摇了摇头,转身离去。") => c("离开", [o(1, text)], { isDefault: true });

/**
 * 境界带 · 上限怎么取
 *
 * 标签(tags)回答的是「在哪种地方」,境界带回答的是「在哪一境还说得通」——
 * 两者是**与**的关系。没有上限时,一条写在乡野尺度上的事件会跟着 'general'
 * 标签一路漏到道祖的池子里(元婴修士被一窝蚂蚁咬成重伤,就是这么来的)。
 *
 * 上限按这条事件**自身的规模**取,不按它有多稀有:
 *
 *   1   筑基     山野小物   —— 蚁穴藏珍(一窝灵蚁能咬伤的只有筑基)
 *   2   金丹     凡俗乡野   —— 乞丐、小和尚、山下集市、路边赌石、倾覆货车
 *   3~4 元婴~化神 散修之间   —— 商人的仙缘、无主药园、宗门弟子遇袭、藏宝图
 *   5~7 炼虚~大乘 上古遗迹   —— 千年灵芝、黑市、地火炉窟、寒冰棺椁、骨刻经文
 *   8   渡劫     通天之物   —— 无字石门、观星台、仙田遗种;人间界的尽头
 *   —   不设     天地自然   —— 灵泉、流星、深谷琴音,与心魔、问道石、隐世高人:
 *                            它们的规模不随境界变,写在任何境界都成立
 *
 * 界外(仙界起)另有一池自己的内容(ev_xianmen_yize 起,minRealm 9+),
 * 故人间界的事件一律收在 8 以内:**境界带的两头都要堵**,
 * 只堵住"神界机缘漏进炼气期"那半边不算数。
 */
const MORTAL_END = WORLD_BREAK_MAJOR - 1; // 8 渡劫

export const EVENTS: EventDef[] = [
  // 奇缘的阶段事件:一律带 chain 标签,只有 pickChainStageEvent 能把它们请出来
  ...CHAIN_EVENTS,
  ev(
    "ev_jade_slip",
    "古老玉简",
    "你在山洞深处发现一枚古老玉简,其上灵光隐现。",
    ["general"],
    [
      c("拾取", [
        o(50, "玉简中记载着一门功法残篇,你如获至宝。", { type: "gongfa" }),
        o(30, "玉简早已破损,只余几页残卷。", { type: "material", id: "page", amount: 8 }),
        o(20, "玉简竟是他人设下的饵,灵力反噬,你受了些内伤。", { type: "buff", id: "injury" }),
      ]),
      c(
        "观察",
        [
          o(70, "你仔细端详,悟出几分道韵。", { type: "exp", secs: 30 }),
          o(30, "看不出所以然,你随手收起了几页残卷。", { type: "material", id: "page", amount: 3 }),
        ],
        { isDefault: true },
      ),
      leave(),
    ],
    { maxRealm: 4 },
  ),
  ev(
    "ev_xipan_fumu",
    "溪畔浮木",
    "暴雨过后,溪畔搁浅了一截焦黑的浮木,隐约透出暖意。",
    ["general", "forest"],
    [
      c("仔细察看", [
        o(60, "浮木竟是一段火灵残枝,你收下这点灵性。", { type: "material", id: "herb", amount: 6 }),
        o(40, "木心沁水,只余朽渣。", { type: "nothing" }),
      ]),
      leave("一根朽木而已,你不以为意,转身离去。"),
    ],
    { maxRealm: 1 },
  ),
  ev(
    "ev_yedu_mijin",
    "野渡迷津",
    "山雨欲来,你行至一处野渡。渡船无人,只有一叶扁舟横在水上。",
    ["general"],
    [
      c("解缆自渡", [
        o(60, "你凭修为稳稳渡过江面,对岸空无一人。", { type: "exp", secs: 40 }),
        o(40, "湍流暗涌,你呛了几口水,狼狈上岸。", { type: "buff", id: "injury" }),
      ]),
      leave("君子不临深水,你另寻他途,绕道而行。"),
    ],
    { maxRealm: 2 },
  ),
  ev(
    "ev_huangmiao_zhong",
    "荒庙孤钟",
    "半山废庙中悬着一口孤钟,钟面刻满无名经文,夜风过时低鸣不止。",
    ["ruin"],
    [
      c("叩钟问经", [
        o(60, "钟鸣如雷,经文随声入心,你仿佛听见一角真意。", { type: "exp", secs: 60 }),
        o(40, "钟声太烈,你气血翻涌,忙撤步后退。", { type: "buff", id: "injury" }),
      ]),
      c("细察经文", [
        o(70, "经文残破,但你还是拓下几行。", { type: "material", id: "page", amount: 10 }),
        o(30, "字迹断断续续,你一无所获。", { type: "nothing" }),
      ]),
      leave("庙是别人的庙,钟是别人的钟,你合掌一礼,转身离去。"),
    ],
    { maxRealm: 4 },
  ),
  ev(
    "ev_spring",
    "灵泉",
    "一汪清泉自石缝中涌出,泉水灵气氤氲。",
    ["general", "mountain"],
    [
      c(
        "饮下泉水",
        [
          o(75, "泉水甘冽,灵气涌入四肢百骸。", { type: "exp", secs: 60 }),
          o(25, "泉水中竟蕴含微量灵毒,你连忙运功逼出。", { type: "buff", id: "injury" }),
        ],
        { isDefault: true },
      ),
      c("采集泉边灵草", [
        o(1, "你在泉边采得数株灵草。", { type: "material", id: "herb", amount: 6 }),
      ]),
    ],
  ),
  ev(
    "ev_merchant",
    "游方商人",
    "一位背着大葫芦的游方商人拦住你,神秘兮兮地要与你做笔买卖。",
    ["general"],
    [
      c(
        '买下他的"仙缘"',
        [
          o(
            40,
            "你花了灵石,换来两枚品相不俗的丹药。",
            { type: "stone", tierAmount: -30 },
            { type: "pill", count: 2 },
          ),
          o(
            35,
            "竟真是好东西!一件灵光流转的法器。",
            { type: "stone", tierAmount: -30 },
            { type: "equipment", minQualityRank: 2 },
          ),
          o(25, "打开一看,不过是块顽石。你被骗了。", { type: "stone", tierAmount: -30 }),
        ],
        { hint: "需要灵石", cond: { type: "stone", tierAmount: 30 } },
      ),
      c("婉拒", [o(1, "商人耸耸肩,吹着口哨走远了。")], { isDefault: true }),
    ],
    { maxRealm: 3 },
  ),
  ev(
    "ev_old_man",
    /*
     * 标题原为「青石上的老者」—— 与奇缘链第一节 `old_man_stone_1` 重名。
     * 两条内容不同（那条是石上老者开口问路，这条身旁放着酒葫芦在打盹），
     * 但玩家先后遇到时只会记得「这个我看过」。标题是记住一次际遇的唯一线索，
     * 故按它自己的画面改作「青石醉叟」。判据见 core/eventTitleUnique.spec。
     */
    "青石醉叟",
    "一位老者坐在青石上打盹,身旁放着一个酒葫芦,气息深不可测。",
    ["general"],
    [
      c(
        "上前行礼",
        [
          o(55, "老者睁开一只眼,指点了你几句,字字珠玑。", { type: "exp", secs: 60 }),
          o(30, "老者哈哈一笑,赠你一颗丹药,转眼不见踪影。", { type: "pill", count: 1 }),
          o(15, "老者递来酒葫芦,你饮下一口,只觉道韵加身。", { type: "buff", id: "bless_daoyun" }),
        ],
        { isDefault: true },
      ),
      c("悄悄绕开", [o(1, "你不欲多事,悄然离去。")]),
    ],
  ),
  ev(
    "ev_beast_corpse",
    "妖兽尸骸",
    "一头妖兽的尸骸横在路旁,死去不久,周围隐有血腥气。",
    ["general", "forest"],
    [
      c("剥取材料", [
        o(
          70,
          "你剥下有用之物,收获颇丰。",
          { type: "material", id: "herb", amount: 4 },
          { type: "material", id: "ore", amount: 3 },
        ),
        o(
          30,
          "杀死它的凶手去而复返!你且战且退,受了点伤。",
          { type: "buff", id: "injury" },
          { type: "material", id: "ore", amount: 2 },
        ),
      ]),
      leave("血腥气太重,你决定绕道而行。"),
    ],
    { maxRealm: 4 },
  ),
  ev(
    "ev_formation",
    "残破阵法",
    "前方隐约有阵法波动,阵纹已残,似乎护着什么。",
    ["general", "ruin"],
    [
      c("破阵而入", [
        o(45, "阵中是一处前人洞府,灵石俯拾皆是。", { type: "stone", tierAmount: 60 }),
        o(30, "阵中只余一具枯骨与一件遗物。", { type: "equipment", minQualityRank: 1 }),
        o(25, "阵法突然反噬,你狼狈退出。", { type: "buff", id: "injury" }),
      ]),
      c(
        "研究阵纹",
        [o(1, "你临摹阵纹,于阵道小有所悟。", { type: "material", id: "wudao", amount: 4 })],
        { isDefault: true },
      ),
    ],
    { maxRealm: MORTAL_END },
  ),
  ev(
    "ev_lost_monk",
    "迷路的小和尚",
    "一个小和尚坐在路边哭,说自己找不到回寺的路了。",
    ["general"],
    [
      c(
        "送他回去",
        [
          o(70, "老方丈连声道谢,赠你一串开过光的念珠。", { type: "equipment", minQualityRank: 1 }),
          o(30, "小和尚半路却化作一缕青烟——原是山灵考验人心。你只觉神清气爽。", {
            type: "buff",
            id: "bless_qingfeng",
          }),
        ],
        { isDefault: true },
      ),
      c("指个方向便走", [o(1, "小和尚道了声谢,一步三回头地走了。")]),
    ],
    { maxRealm: 2 },
  ),
  ev(
    "ev_gamble",
    "路边赌石",
    "几个修士围着一堆灵石原石叫嚷,说是能开出宝贝。",
    ["general"],
    [
      c(
        "赌一把",
        [
          o(
            30,
            "石开!一团精纯灵气扑面而来!",
            { type: "stone", tierAmount: -25 },
            { type: "stone", tierAmount: 90 },
          ),
          o(
            20,
            "石中竟藏着一株灵药!",
            { type: "stone", tierAmount: -25 },
            { type: "material", id: "herb", amount: 12 },
          ),
          o(50, "石头开了,里面什么都没有。", { type: "stone", tierAmount: -25 }),
        ],
        { hint: "需要灵石", cond: { type: "stone", tierAmount: 25 } },
      ),
      c("看看热闹", [o(1, "你围观半晌,看破了庄家的手法,悄然离去。")], { isDefault: true }),
    ],
    { maxRealm: 3 },
  ),
  ev(
    "ev_thunder_bath",
    "雷雨夜",
    "暴雨骤至,雷霆在头顶炸开。有胆大的修士借雷淬体。",
    ["general", "thunder"],
    [
      c("引雷淬体", [
        o(55, "雷霆入体,气血奔涌,你只觉浑身通透!", { type: "exp", secs: 60 }),
        o(45, "你高估了自己,被雷劈得外焦里嫩。", { type: "buff", id: "injury" }),
      ]),
      c("避雨静修", [o(1, "你寻了处山洞打坐,听雨声入定。", { type: "exp", secs: 30 })], {
        isDefault: true,
      }),
    ],
  ),
  /*
   * 雷泽 / 剑冢 / 昆仑雪岭:三个地域各只有一个专属事件。
   *
   * 抽事件的口径是「境内标签 + general 一池合并抽」,而 general 那池有 70 余条 ——
   * 于是这三处**地方特色只占 1/(72+1) ≈ 1.4%**:玩家在雷泽待上几十次,
   * 也未必撞得到那条「雷雨夜」。地域标签写了,却没有内容支撑它。
   *
   * 各补两条,让三处各自至少有 3 条能说得上是「此地才有的」遭遇。
   * 境界带按地域门槛给(雷泽 tier11 = 境界 4 起,剑冢 12、昆仑 13),
   * 上限放开 —— 这些地方后期仍可去,不必强行关掉。
   */
  ev(
    "ev_leize_ming",
    "雷泽雷鸣",
    "雷泽深处,雷云压得极低。一株通体银白的雷竹自焦土里长出,竹节间仍有细小的电光游走。",
    ["general", "thunder"],
    [
      c("砍取雷竹", [
        o(55, "雷竹应声而断,你以灵力裹手收下,掌心酥麻良久。", {
          type: "material",
          id: "ore",
          amount: 30,
        }),
        o(
          35,
          "竹身炸开一团电弧,你被震得退了半步,但也收下了几节。",
          {
            type: "material",
            id: "ore",
            amount: 12,
          },
          { type: "buff", id: "injury" },
        ),
        o(10, "雷竹在你出手的刹那自毁成灰 —— 它宁折不弯。", { type: "nothing" }),
      ]),
      c(
        "坐听雷音",
        [
          o(65, "你盘膝于雷云之下,听那万钧轰鸣里的一声「静」,若有所悟。", {
            type: "exp",
            secs: 75,
          }),
          o(35, "雷声太盛,你只坐得心神不宁,草草起身。"),
        ],
        { isDefault: true },
      ),
      leave("你绕开雷云,不愿为一株竹子赌上性命。"),
    ],
    { minRealm: 4, maxRealm: 8 },
  ),
  /*
   * 雷泽此前只有 2 条专属事件,是全仓最薄的一处(第 29 轮从 1 条补到 2 条仍垫底)。
   * 再补两条,让这一处的雷意有点层次 —— 一条讲炼体、一条讲渡劫前的观望。
   */
  ev(
    "ev_leize_duanlei",
    "断雷台",
    "雷泽中央有一座半塌的石台,台面焦黑,刻痕里积着化不开的雷浆,踩上去膝盖会发软。",
    ["general", "thunder"],
    [
      c("登台受雷", [
        o(50, "九道雷接连落在身上,你的筋骨发出金石相击之声 —— 熬过来了。", {
          type: "exp",
          secs: 70,
        }),
        o(30, "第七道雷把你掀下石台,半边身子焦黑。", { type: "buff", id: "injury" }),
        o(20, "雷浆在你脚下凝住了,一道也没落下来。你在台上站了很久,什么也没发生。", {
          type: "nothing",
        }),
      ]),
      c(
        "台下打坐",
        [
          o(1, "雷声在头顶滚了一整夜。你听着听着,忽然不再怕它了。", {
            type: "exp",
            secs: 80,
          }),
        ],
        { isDefault: true },
      ),
    ],
    { minRealm: 5, maxRealm: 8 },
  ),
  ev(
    "ev_leize_jiaomu",
    "焦木逢春",
    "雷泽边缘有一片被雷火烧尽的林子,焦黑的树桩间却抽出一枝新芽,嫩得刺眼。",
    ["general", "thunder"],
    [
      c("取新芽入药", [
        o(60, "新芽离枝时淌出一滴青汁,你收在玉瓶里。", {
          type: "material",
          id: "herb",
          amount: 12,
        }),
        o(25, "新芽一触即枯,原来那点绿是雷泽最后的春意。", { type: "nothing" }),
        o(15, "树桩底下窜出一道余雷,你急忙缩手,仍被灼了下。", { type: "buff", id: "injury" }),
      ]),
      c(
        "挪土护住它",
        [
          o(1, "你搬来几块石头挡住风。这一点绿长不长得成,你不知道,但你做了。", {
            type: "material",
            id: "wudao",
            amount: 12,
          }),
        ],
        { isDefault: true },
      ),
    ],
    { minRealm: 4, maxRealm: 8 },
  ),
  /*
   * `sword` / `ice` 两个标签各只有 2 条事件,而它们在凡界路线上被抽中
   * **400 次 / 300 世** —— 玩家会反复撞见同一条。
   * 实测(300 世):sword 401 次 / 池 2 条,ice 345 次 / 池 2 条;
   * 对比 general 221 次 / 池 81 条。供给严重不均。
   *
   * 这里各补两条,让它们到 4 条(thunder / fire 是 5 条,同量级)。
   */
  ev(
    "ev_jianxiu_duanren",
    "剑修断刃",
    "山道旁坐着个断了右臂的剑修,膝上横着半截剑。他抬眼:「替我看看,这剑还能不能出鞘。」",
    ["general", "sword", "mountain", "ruin"],
    [
      c("接过断刃细看", [
        o(45, "刃口虽有崩缺,剑脊仍直。你说「能」,他笑了,把剑推给你:「那就送你。」", {
          type: "equipment",
          minQualityRank: 5,
        }),
        o(35, "你看了许久,只看出「可惜」两个字。他也不恼,收剑起身走了。", {
          type: "exp",
          secs: 50,
        }),
        o(20, "断刃入手极沉,剑意反冲,你虎口崩裂。", { type: "buff", id: "injury" }),
      ]),
      c(
        "问他为何断臂",
        [
          o(60, "「换了一剑」。他说得轻描淡写。你觉得这四个字里有些东西,比剑谱值钱。", {
            type: "exp",
            secs: 90,
          }),
          o(40, "他摇头不答,只把剑插回背上,慢慢走远了。", { type: "nothing" }),
        ],
        { isDefault: true },
      ),
      leave("你没有停步。萍水相逢,不必都问到底。"),
    ],
    { minRealm: 5, maxRealm: MORTAL_END },
  ),
  ev(
    "ev_shijian_zhi",
    "试剑之石",
    "谷中立着一块青石,石上密布深浅不一的刻痕 —— 那是历代剑修试锋留下的。",
    ["general", "sword", "mountain"],
    [
      c("全力一斩", [
        o(40, "石屑纷飞,你的刻痕比大多数人深。你忽然明白自己的剑到了哪一步。", {
          type: "exp",
          secs: 85,
        }),
        o(40, "剑锋滑开,只留下一道浅白。你盯着它看了很久。", { type: "nothing" }),
        o(20, "剑身反震,你手腕一麻,剑脱了手。", { type: "buff", id: "injury" }),
      ]),
      c(
        "看别人的刻痕",
        [
          o(55, "最深的那一道旁刻着一行小字:「三十七岁,方知此石不必破」。你读了三遍。", {
            type: "exp",
            secs: 70,
          }),
          o(45, "刻痕太多,看久了只觉得眼花。", { type: "nothing" }),
        ],
        { isDefault: true },
      ),
      leave("你绕石而过。"),
    ],
    { minRealm: 4, maxRealm: MORTAL_END },
  ),
  ev(
    "ev_bingbi_cangfeng",
    "冰壁藏锋",
    "寒潭尽头的冰壁里冻着一柄剑。剑身澄澈,连剑穗都停在半空中。",
    ["general", "ice", "water"],
    [
      c("凿冰取剑", [
        o(40, "冰壁应声而裂,剑落入手中 —— 冷的不是剑,是你的掌心。", {
          type: "equipment",
          minQualityRank: 5,
        }),
        o(35, "凿到一半,冰壁里映出你自己的脸。你停了手,把冰屑拂回去。", {
          type: "exp",
          secs: 60,
        }),
        o(25, "整块冰壁坍下来,你被压在下面,好容易才挣出来。", {
          type: "buff",
          id: "injury",
        }),
      ]),
      c(
        "隔冰观剑",
        [
          o(60, "你看了一整个下午。剑没动,但你回去之后,出手比从前慢了一线 —— 也准了一线。", {
            type: "exp",
            secs: 95,
          }),
          o(40, "什么也没看出来。冰壁冷得刺骨,你走了。", { type: "nothing" }),
        ],
        { isDefault: true },
      ),
      leave("你没有碰那块冰。"),
    ],
    { minRealm: 6, maxRealm: MORTAL_END },
  ),
  ev(
    "ev_hanquan_jie",
    "寒泉解冻",
    "泉眼在雪下,凿开一个洞,水汽腾起来,暖得不像这个季节。",
    ["general", "ice", "water", "forest"],
    [
      c("掬一捧喝", [
        o(50, "入口先是刺骨,随即全身发暖 —— 你多年的旧伤竟轻了些。", {
          type: "pill",
          id: "p_huichun",
          count: 1,
        }),
        o(50, "寒热交攻,你打了个寒噤,只好作罢。", { type: "nothing" }),
      ]),
      c(
        "取水炼丹",
        [
          o(45, "你把水收进玉瓶。这东西在丹炉里比在嘴里值钱。", {
            type: "material",
            id: "herb",
            amount: 18,
          }),
          o(55, "泉眼在你伸手时缩了回去,只剩一地湿痕。", { type: "nothing" }),
        ],
        { isDefault: true },
      ),
      leave("你把手缩回袖里。"),
    ],
    { minRealm: 6, maxRealm: MORTAL_END },
  ),
  ev(
    "ev_jianzhong_ming",
    "剑冢低鸣",
    "剑冢之内,千万柄断剑插在赭红的土里。你走过时,其中一柄忽然发出极细的鸣声。",
    ["general", "ruin", "sword"],
    [
      c("拔起此剑", [
        o(50, "剑身虽断,剑意却完整 —— 它认了你。", { type: "equipment", minQualityRank: 5 }),
        o(30, "剑鸣骤停,断剑在你手中化为齑粉。你握了一手铁锈。", { type: "nothing" }),
        o(20, "剑气未消,反噬而来,你左臂见了血。", { type: "buff", id: "injury" }),
      ]),
      c(
        "以剑意相和",
        [
          o(60, "你不去拔它,只以自身剑意与之相和。一炷香后,那鸣声止了,你的剑意却更利。", {
            type: "exp",
            secs: 75,
          }),
          o(40, "你的剑意太浅,断剑振了一声便沉寂下去,像是在嘲笑。"),
        ],
        { isDefault: true },
      ),
      leave("你不愿惊动这片沉默的剑冢。"),
    ],
    { minRealm: 5, maxRealm: 8 },
  ),
  ev(
    "ev_kunlun_bing",
    "雪岭冰壁",
    "昆仑雪岭的一处冰壁上,封着一个不知多少万年前的人形。冰层清澈,能看清他握剑的姿势。",
    ["general", "mountain", "ice"],
    [
      c("凿开冰壁", [
        o(45, "冰屑散尽,那人形早已成空,只留下一柄完好如初的剑。", {
          type: "equipment",
          minQualityRank: 5,
        }),
        o(35, "你凿开一半便停了 —— 冰里的人没有脸,只有一身道袍。你取走了道袍上的护符。", {
          type: "material",
          id: "dust",
          amount: 9,
        }),
        o(20, "冰壁内封着的是活物。你凿开的刹那,它睁开了眼,又在你退开时重新阖上。", {
          type: "buff",
          id: "injury",
        }),
      ]),
      c(
        "隔冰观剑",
        [
          o(70, "你看那握剑的姿势看得入了神,回过神来,雪已落满肩头。剑理明了几分。", {
            type: "exp",
            secs: 75,
          }),
          o(30, "冰壁太过澄澈,反而什么都看不真切。你摇了摇头,继续赶路。"),
        ],
        { isDefault: true },
      ),
      leave("雪岭太冷,你不愿在此多留。"),
    ],
    { minRealm: 5, maxRealm: 8 },
  ),
  ev(
    "ev_herb_garden",
    "无主药园",
    "你发现一处荒废的药园,灵草虽杂,却也不少。",
    ["general", "forest", "mountain"],
    [
      c("仔细采摘", [o(1, "你采得满满一篓灵草。", { type: "material", id: "herb", amount: 10 })], {
        isDefault: true,
      }),
      c("翻找园主遗物", [
        o(40, "你在小屋里找到一本泛黄的丹方笔记。", { type: "material", id: "wudao", amount: 6 }),
        o(35, "床底藏着一小袋灵石。", { type: "stone", tierAmount: 40 }),
        o(25, "什么都没有,只有满屋灰尘。"),
      ]),
    ],
    { maxRealm: 3 },
  ),
  ev(
    "ev_sword_stone",
    "插剑石",
    "一柄古剑插在巨石中,剑身布满铭文,无数人拔之不动。",
    ["general", "sword", "ruin"],
    [
      c("尝试拔剑", [
        o(15, "古剑轻鸣,竟应手而出!", { type: "equipment", minQualityRank: 4 }),
        o(45, "剑纹一闪,一段剑道感悟涌入脑海。", { type: "exp", secs: 60 }),
        o(40, "纹丝不动,你的手却被剑气所伤。", { type: "buff", id: "injury" }),
      ]),
      c("参悟剑铭", [o(1, "你静观铭文,若有所思。", { type: "material", id: "wudao", amount: 5 })], {
        isDefault: true,
      }),
    ],
    { maxRealm: 5 },
  ),
  ev(
    "ev_moon_lake",
    "月下湖泊",
    "月圆之夜,湖面浮起点点银辉,灵气随月光沉入水中。",
    ["general", "water"],
    [
      c("湖畔吐纳", [o(1, "月华入体,修为悄然精进。", { type: "exp", secs: 60 })], {
        isDefault: true,
      }),
      c("潜入湖底", [
        o(40, "湖底沉着一只锈迹斑斑的铁盒。", { type: "equipment", minQualityRank: 2 }),
        o(35, "你摸到几块温润的月华石。", { type: "material", id: "ore", amount: 8 }),
        o(25, "湖底暗流涌动,你差点没能上来。", { type: "buff", id: "injury" }),
      ]),
    ],
    { maxRealm: 5 },
  ),
  /*
   * 蜃楼幻海(tier15 · 境界6)只带 `water` 一个附加标签,而水里那些事大多写在
   * 人间界的低境(月下湖泊 maxRealm 5、寒潭系列更早)—— 境界 6 只够得着 2 条。
   * 补两条,让这一处的「真真幻幻」有点内容。
   */
  ev(
    "ev_shenlou_yanyu",
    "蜃楼烟屿",
    "海面上浮起一座岛,岛上有城;你朝它走了半个时辰,城还在原处,一步也没近。",
    ["general", "water"],
    [
      c("转身离开", [
        o(55, "你一转身,那座城忽然就到了身后 —— 原来它一直在追着你走。", {
          type: "material",
          id: "wudao",
          amount: 18,
        }),
        o(30, "走出很远回头看,海面空空荡荡,像什么都没发生过。", { type: "nothing" }),
        o(15, "脚下忽然一软 —— 你踩的原来是水。", { type: "buff", id: "injury" }),
      ]),
      c(
        "继续朝它走",
        [
          o(1, "你走了整整一日。天黑时那座城散成雾,而你发现自己站在来时的岸边。", {
            type: "exp",
            secs: 65,
          }),
        ],
        { isDefault: true },
      ),
    ],
    { minRealm: 5, maxRealm: 8 },
  ),
  ev(
    "ev_shenlou_jingzhong",
    "幻海镜中",
    "幻海的水面像一面没有边框的镜子。你低头看,水里的那个人也低头看 —— 但它比你慢了半拍。",
    ["general", "water"],
    [
      c("等它抬起头", [
        o(50, "水里的你先抬了头,然后才是你。那一瞬间,你看见了自己往后十年的样子。", {
          type: "exp",
          secs: 75,
        }),
        o(30, "它始终没有抬头。你盯着水面看到眼睛发酸,只好站直身子。", { type: "nothing" }),
        o(20, "水里的那个忽然对你笑了一下 —— 而你没有。", { type: "buff", id: "curse_xinmo" }),
      ]),
      c(
        "打碎水面",
        [
          o(1, "你一脚踏碎镜像,水花溅了满身。倒影散成千万片,每一片都在往岸上爬。", {
            type: "material",
            id: "dust",
            amount: 8,
          }),
        ],
        { isDefault: true },
      ),
    ],
    { minRealm: 6, maxRealm: 8 },
  ),
  ev(
    "ev_beggar",
    "褴褛乞丐",
    "一个乞丐伸手拦你:「小友,赏口饭吃,老朽必有厚报。」",
    ["general"],
    [
      c(
        "赠他灵石",
        [
          o(
            45,
            "乞丐眨眼消失,你手中多了一颗温热的丹药。",
            { type: "stone", tierAmount: -15 },
            { type: "pill", count: 1 },
          ),
          o(
            30,
            "乞丐郑重一拜:「善心可贵。」你只觉气运隆盛。",
            { type: "stone", tierAmount: -15 },
            { type: "buff", id: "bless_jiyuan" },
          ),
          o(25, "乞丐千恩万谢地走了,什么也没发生。", { type: "stone", tierAmount: -15 }),
        ],
        { hint: "需要灵石", cond: { type: "stone", tierAmount: 15 } },
      ),
      c("置之不理", [o(1, "你径直走过。修行路上,各安天命。")], { isDefault: true }),
    ],
    { maxRealm: 2 },
  ),
  ev(
    "ev_cave_in",
    "塌方",
    "前方山道突然塌方,烟尘中露出半截洞口。",
    ["general", "mountain", "ruin"],
    [
      c("进洞探查", [
        o(40, "洞中是一条矿脉!你挖得兴起。", { type: "material", id: "ore", amount: 12 }),
        o(35, "洞里蛛网密布,你只找到些破铜烂铁。", { type: "material", id: "dust", amount: 6 }),
        o(25, "二次塌方!你仓皇逃出,灰头土脸。", { type: "buff", id: "injury" }),
      ]),
      leave("山体不稳,你不敢久留。"),
    ],
    { maxRealm: 5 },
  ),
  ev(
    "ev_chess",
    "石桌残局",
    "凉亭石桌上摆着一副残局,黑白胶着,似有玄机。",
    ["general"],
    [
      c("推演棋局", [
        o(50, "一子落定,满盘皆活!你于变化之道大有所悟。", {
          type: "material",
          id: "wudao",
          amount: 8,
        }),
        o(30, "棋局暗藏杀伐之意,你悟出几分战斗真谛。", { type: "exp", secs: 30 }),
        o(20, "你陷入棋局心神难拔,醒来时已过许久,心浮气躁。", { type: "buff", id: "curse_xinmo" }),
      ]),
      leave("你看了两眼,自知棋力不济,一笑而去。"),
    ],
  ),
  ev(
    "ev_wounded_beast",
    "受伤的灵兽",
    "一只毛色雪白的小兽倒在草丛里,后腿受了伤,正瑟瑟发抖。",
    ["general", "forest"],
    [
      c(
        "为它疗伤",
        [
          o(25, "小兽舔了舔你的手心,竟愿追随于你!", { type: "pet" }),
          o(45, "小兽伤愈后衔来一株灵草相赠,消失在林中。", {
            type: "material",
            id: "herb",
            amount: 8,
          }),
          o(30, "小兽的母亲赶到,误会了你!一番纠缠后你才脱身。", { type: "buff", id: "injury" }),
        ],
        { isDefault: true },
      ),
      c("取其内丹", [
        o(60, "你心一横下了手,取得一颗灵气充盈的内丹。", { type: "exp", secs: 60 }),
        o(40, "你刚出手,一声兽吼震彻山林——它的母亲来了!", { type: "buff", id: "injury" }),
      ]),
    ],
    { maxRealm: 4 },
  ),
  ev(
    "ev_night_talk",
    "夜遇同道",
    "篝火旁,一位同道修士邀你共坐,谈起各自的修行见闻。",
    ["general"],
    [
      c(
        "彻夜长谈",
        [
          o(60, "他山之石可以攻玉,你收获良多。", { type: "material", id: "wudao", amount: 5 }),
          o(40, "谈至兴起,他赠你一份不外传的心得。", { type: "exp", secs: 30 }),
        ],
        { isDefault: true },
      ),
      c("保持警惕", [
        o(70, "你敷衍几句便告辞,平安无事。", { type: "material", id: "wudao", amount: 3 }),
        o(30, "那修士见你戒备,冷笑一声化作黑雾散去——竟是心魔所化!", {
          type: "buff",
          id: "bless_qingfeng",
        }),
      ]),
    ],
  ),
  ev(
    "ev_falling_star",
    "流星坠地",
    "一道流光划破夜空,坠落在不远处的山谷。",
    ["general", "sky"],
    [
      c(
        "前去查看",
        [
          o(45, "坠落的是一块陨铁,尚有余温。", { type: "material", id: "ore", amount: 15 }),
          o(30, "陨石中竟嵌着一件古物!", { type: "equipment", minQualityRank: 3 }),
          o(25, "你赶到时,已有捷足先登者,只剩一地碎石。", {
            type: "material",
            id: "dust",
            amount: 4,
          }),
        ],
        { isDefault: true },
      ),
      c("原地观星", [o(1, "你夜观天象,若有所悟。", { type: "material", id: "wudao", amount: 3 })]),
    ],
  ),
  ev(
    "ev_hot_spring",
    "灵雾温泉",
    "山间温泉腾起灵雾,泡上一泡想必极为舒坦。",
    ["general", "mountain", "fire"],
    [
      c(
        "入泉沐浴",
        [
          o(80, "暖流洗去疲惫,你神完气足。", { type: "buff", id: "bless_qingfeng" }),
          o(20, "泉底竟沉着前人的储物袋!", { type: "stone", tierAmount: 50 }),
        ],
        { isDefault: true },
      ),
      leave("修行要紧,你没有停留。"),
    ],
    { maxRealm: 5 },
  ),
  ev(
    "ev_broken_cart",
    "倾覆的货车",
    "一辆商队货车翻在路边,货物散落,不见人影。",
    ["general"],
    [
      c("搬走货物", [
        o(55, "车上多是凡俗货物,但也翻出些值钱的。", { type: "stone", tierAmount: 35 }),
        o(25, "货箱夹层里藏着一瓶丹药!", { type: "pill", count: 2 }),
        o(20, "商队护卫去而复返,你被当成劫匪一顿好打。", { type: "buff", id: "injury" }),
      ]),
      c(
        "寻找幸存者",
        [
          o(60, "你救起昏迷的商人,他以灵石相谢。", { type: "stone", tierAmount: 45 }),
          o(40, "四下无人,只有风声。你留下标记便离开了。"),
        ],
        { isDefault: true },
      ),
    ],
    { maxRealm: 2 },
  ),
  ev(
    "ev_mirage_tower",
    "雾中高塔",
    "浓雾中隐约立着一座高塔,塔门半开,里面漆黑一片。",
    ["general", "ruin", "dark"],
    [
      c("登塔", [
        o(
          35,
          "塔中每层皆有传承刻文,你受益匪浅。",
          { type: "exp", secs: 60 },
          { type: "material", id: "wudao", amount: 5 },
        ),
        o(30, "顶层供着一件蒙尘的法器。", { type: "equipment", minQualityRank: 3 }),
        o(35, "塔中阴气缠身,你逃出时脸色发白。", { type: "buff", id: "curse_xinmo" }),
      ]),
      leave("塔影幢幢,你压下好奇心,绕塔而行。"),
    ],
    { maxRealm: 7 },
  ),
  ev(
    "ev_immortal_dream",
    "仙人入梦",
    "午夜小憩,你梦见一位白衣仙人在云端讲道。",
    ["general"],
    [
      c(
        "凝神听讲",
        [
          o(60, "醒来后口齿留香,道音犹在耳畔。", { type: "exp", secs: 60 }),
          o(30, "仙人抛下一卷经书,梦醒时它竟真在你怀中!", { type: "gongfa" }),
          o(10, "仙人回眸一笑:「有缘人,赠你一场造化。」", { type: "buff", id: "bless_daoyun" }),
        ],
        { isDefault: true },
      ),
      c("强行醒来", [o(1, "你警觉这或是心魔幻境,强行醒转,一身冷汗。")]),
    ],
    { weight: 60, maxRealm: MORTAL_END },
  ),
  ev(
    "ev_ant_nest",
    "蚁穴藏珍",
    "你注意到一队灵蚁正搬运着闪光的碎屑进入巢穴。",
    ["general", "forest"],
    [
      c("挖开蚁穴", [
        o(60, "蚁穴深处堆着不少灵石碎屑。", { type: "stone", tierAmount: 30 }),
        o(40, "蚁后震怒,万蚁齐出!你被啃出几处伤口,狼狈退出。", { type: "buff", id: "injury" }),
      ]),
      c(
        "跟踪来源",
        [o(1, "你顺藤摸瓜,找到了灵蚁的采集地。", { type: "material", id: "ore", amount: 6 })],
        { isDefault: true },
      ),
    ],
    { maxRealm: 1 },
  ),
  ev(
    "ev_rain_shelter",
    "破庙避雨",
    "大雨滂沱,你躲进一座破败的山神庙。神像的眼睛似乎动了一下。",
    ["general", "dark", "ruin"],
    [
      c(
        "上香祭拜",
        [
          o(55, "香烟笔直升起,山神显灵,庇佑于你。", { type: "buff", id: "bless_jiyuan" }),
          o(45, "神像轰然倒塌,露出里面藏着的小盒子。", { type: "equipment", minQualityRank: 1 }),
        ],
        { isDefault: true },
      ),
      c("拆神像取宝", [
        o(40, "神像腹中果然有前人藏的灵石!", { type: "stone", tierAmount: 55 }),
        o(60, "你刚动手,一道阴风卷过,你被摄去了一缕精气。", { type: "buff", id: "curse_xinmo" }),
      ]),
    ],
    { maxRealm: 5 },
  ),
  ev(
    "ev_qin_sound",
    "深谷琴音",
    "幽谷中传来断断续续的琴声,时而杀伐,时而缥缈。",
    ["general", "mountain"],
    [
      c("循声而去", [
        o(50, "抚琴的是位隐士,一曲终了,你如醍醐灌顶。", {
          type: "material",
          id: "wudao",
          amount: 10,
        }),
        o(30, "琴声戛然而止,石上只留一张琴谱。", { type: "gongfa" }),
        o(20, "琴音入耳化作杀伐之意,你心神受创。", { type: "buff", id: "curse_xinmo" }),
      ]),
      c("远远聆听", [o(1, "你在谷口听完一曲,心境平和。", { type: "buff", id: "bless_qingfeng" })], {
        isDefault: true,
      }),
    ],
  ),
  ev(
    "ev_treasure_map",
    "残缺藏宝图",
    "你从一具枯骨手中发现半张藏宝图,标记就在附近。",
    ["general", "ruin"],
    [
      c(
        "按图索骥",
        [
          o(
            40,
            "掘地三尺,果然挖出一个储物匣!",
            { type: "stone", tierAmount: 70 },
            { type: "material", id: "dust", amount: 5 },
          ),
          o(30, "宝藏早被人取走,只剩一个空坑和一件遗落的物件。", {
            type: "equipment",
            minQualityRank: 2,
          }),
          o(30, "图是假的,你白挖了半天,腰酸背痛。"),
        ],
        { isDefault: true },
      ),
      c("焚图祭亡者", [
        o(1, "你将图纸烧予枯骨:「宝物随缘,前辈安息。」心境圆融少许。", {
          type: "material",
          id: "wudao",
          amount: 4,
        }),
      ]),
    ],
    { maxRealm: 4 },
  ),
  ev(
    "ev_yaodan_auction",
    "黑市拍卖",
    "一处隐秘的黑市正在拍卖一颗成色极好的妖丹。",
    ["general", "dark"],
    [
      c(
        "参与竞拍",
        [
          o(
            50,
            "你拍下妖丹,炼化后修为大涨。",
            { type: "stone", tierAmount: -60 },
            { type: "exp", secs: 90 },
          ),
          o(
            30,
            "有人恶意抬价,你多花了不少,好在妖丹货真价实。",
            { type: "stone", tierAmount: -80 },
            { type: "exp", secs: 90 },
          ),
          o(20, "拍到手才发现是颗赝品,黑市早已人去楼空。", { type: "stone", tierAmount: -60 }),
        ],
        { hint: "需要较多灵石", cond: { type: "stone", tierAmount: 80 } },
      ),
      leave("黑市水深,你转了一圈便离开了。"),
    ],
    { maxRealm: 6 },
  ),
  ev(
    "ev_face_wall",
    "面壁人影",
    "崖壁前盘坐着一道人影,一动不动,已在此面壁不知多少年。",
    ["general", "mountain"],
    [
      c(
        "静坐相陪",
        [
          o(60, "你陪坐三日,起身时只觉道心通透。", { type: "material", id: "wudao", amount: 8 }),
          o(40, "人影忽然散去——那只是一道残留的道韵。你若有所失,又若有所得。", {
            type: "exp",
            secs: 60,
          }),
        ],
        { isDefault: true },
      ),
      c("出声询问", [
        o(50, "人影缓缓道出一句偈语,便再无声息。", { type: "material", id: "wudao", amount: 5 }),
        o(50, "人影蓦然回首,双目如电!你被吓得不轻。", { type: "buff", id: "curse_xinmo" }),
      ]),
    ],
  ),
  ev(
    "ev_lingzhi",
    "千年灵芝",
    "峭壁之上,一株千年灵芝迎风轻晃,下方是万丈深渊。",
    ["mountain", "forest"],
    [
      c("攀崖采摘", [
        o(55, "有惊无险,灵芝到手!", { type: "material", id: "herb", amount: 20 }),
        o(25, "灵芝下竟压着前人的遗物。", { type: "equipment", minQualityRank: 2 }),
        o(20, "手一滑,你摔下数丈,幸被古藤接住。", { type: "buff", id: "injury" }),
      ]),
      leave("君子不立危墙之下,你按捺住贪念。"),
    ],
    { maxRealm: 5 },
  ),
  ev(
    "ev_mine_vein",
    "裸露矿脉",
    "山洪冲刷后,一条玄铁矿脉裸露在外,矿石泛着乌光。",
    ["mountain", "ruin"],
    [
      c(
        "放手开采",
        [
          o(70, "你采得大量玄铁,满载而归。", { type: "material", id: "ore", amount: 18 }),
          o(
            30,
            "采矿声惊动了附近的妖兽,你且采且战。",
            { type: "material", id: "ore", amount: 10 },
            { type: "buff", id: "injury" },
          ),
        ],
        { isDefault: true },
      ),
      c("只取表层", [
        o(1, "你浅尝辄止,取了些浮矿便走。", { type: "material", id: "ore", amount: 7 }),
      ]),
    ],
    { maxRealm: 5 },
  ),
  ev(
    "ev_hantan_bei",
    "寒潭古碑",
    "你于寒潭深处寻得一方古碑,碑文以剑意刻就,历万古而不灭。",
    ["ruin"],
    [
      c("临碑参悟", [
        o(60, "剑意自碑中涌来,你依样运剑,修为为之一振。", { type: "exp", secs: 60 }),
        o(40, "剑意凌厉,你强行参悟,气息紊乱。", { type: "buff", id: "injury" }),
      ]),
      c("拓下碑文", [
        o(70, "你拓下碑文,换得几页残卷,或另有他用。", { type: "material", id: "page", amount: 2 }),
        o(30, "碑文剑威逼人,拓印时伤了心神。", { type: "buff", id: "injury" }),
      ]),
      leave("剑意非强求所得,你按捺住心思,转身离去。"),
    ],
    { minRealm: 5, maxRealm: 7 },
  ),
  ev(
    "ev_jiuxiao_stone",
    "九霄孤石",
    "一块自九霄坠落的孤石砸入山坳,裂面处道纹天成,灵光流转。",
    ["ruin"],
    [
      c("观石悟道", [
        o(60, "道纹入心,你仿佛触到天外遁去的一角。", { type: "exp", secs: 60 }),
        o(40, "道纹繁复,你看得目眩神驰,气息微乱。", { type: "buff", id: "injury" }),
      ]),
      c("叩石听音", [
        o(70, "金石之声铿锵,灵性自石中渗出。", { type: "material", id: "ore", amount: 20 }),
        o(30, "叩击过猛,裂纹扩大,你只拣得几块碎屑。", { type: "material", id: "ore", amount: 8 }),
      ]),
      leave("天外之物,非强求可得,你压下心神离去。"),
    ],
    { maxRealm: MORTAL_END },
  ),
  ev(
    "ev_god_tree",
    "参天神木",
    "一棵需百人合抱的神木立于林心,树洞中隐有灵光。",
    ["forest"],
    [
      c("探入树洞", [
        o(
          45,
          '树洞中是历代鸟兽衔来的"收藏",琳琅满目。',
          { type: "stone", tierAmount: 45 },
          { type: "material", id: "herb", amount: 8 },
        ),
        o(30, "一枚温润的果实静静躺在洞底。", { type: "pill", count: 1 }),
        o(25, "树洞的主人回来了——一只暴躁的妖猿!", { type: "buff", id: "injury" }),
      ]),
      c("树下打坐", [o(1, "神木灵气庇护,你修炼事半功倍。", { type: "exp", secs: 60 })], {
        isDefault: true,
      }),
    ],
    { maxRealm: 6 },
  ),
  ev(
    "ev_firebird",
    "浴火之羽",
    "一根燃烧的羽毛自天际飘落,火光中隐有凤鸣。",
    ["fire", "sky"],
    [
      c("伸手接住", [
        o(50, "羽毛化作一缕真火没入体内,气血如沸!", { type: "exp", secs: 60 }),
        o(30, "羽毛落地化作一枚赤红丹丸。", { type: "pill", count: 1 }),
        o(20, "真火灼手,你被烫得不轻。", { type: "buff", id: "injury" }),
      ]),
      c(
        "目送其落",
        [o(1, "羽毛落地即熄,只余一小撮暖灰。", { type: "material", id: "dust", amount: 5 })],
        { isDefault: true },
      ),
    ],
    { maxRealm: 7 },
  ),
  ev(
    "ev_lava_forge",
    "地火炉窟",
    "你发现一处天然地火喷口,火苗精纯,是炼器的绝佳之地。",
    ["fire", "ruin"],
    [
      c("借火炼器", [
        o(60, "地火淬炼,你随手打造的器胚都不同凡响。", { type: "equipment", minQualityRank: 2 }),
        o(40, "火候失控,器胚炸裂,你被崩了一脸灰。", { type: "material", id: "dust", amount: 8 }),
      ]),
      c(
        "采集火髓",
        [o(1, "你在喷口边缘刮取了些许火髓精华。", { type: "material", id: "ore", amount: 10 })],
        { isDefault: true },
      ),
    ],
    { maxRealm: 6 },
  ),
  ev(
    "ev_drift_bottle",
    "漂流玉瓶",
    "一只玉瓶随波漂来,瓶口以符纸封着。",
    ["water"],
    [
      c("开瓶", [
        o(45, "瓶中是前人求救的遗书与报酬——如今物归有缘人。", { type: "stone", tierAmount: 50 }),
        o(30, "瓶中封着一缕精魄,它道谢后散去,留予你一场造化。", {
          type: "buff",
          id: "bless_jiyuan",
        }),
        o(25, "瓶中冲出一股怨气,缠上了你!", { type: "buff", id: "curse_xinmo" }),
      ]),
      leave("来历不明之物,你没有妄动。"),
    ],
    { maxRealm: 6 },
  ),
  ev(
    "ev_turtle",
    "驮碑老龟",
    "一只背驮石碑的老龟浮出水面,人言道:「小辈,可愿听老朽讲个故事?」",
    ["water"],
    [
      c(
        "洗耳恭听",
        [
          o(70, "老龟讲了一段上古秘辛,你听得如痴如醉。", {
            type: "material",
            id: "wudao",
            amount: 10,
          }),
          o(30, "故事讲罢,老龟从背上的碑文里抖落一页古篆。", { type: "gongfa" }),
        ],
        { isDefault: true },
      ),
      c("婉言谢绝", [o(1, "老龟叹了口气,缓缓沉入水中。")]),
    ],
  ),
  ev(
    "ev_pearl",
    "蚌中明珠",
    "浅滩上一只巨蚌微张,珠光自缝隙中透出。",
    ["water"],
    [
      c("取珠", [
        o(55, "明珠到手,温润生辉。", { type: "stone", tierAmount: 65 }),
        o(45, "巨蚌猛然合拢,差点夹断你的手!", { type: "buff", id: "injury" }),
      ]),
      leave("取珠伤蚌,非修道人所为。你转身离去,心境澄明。"),
    ],
    { maxRealm: 2 },
  ),
  ev(
    "ev_ghost_lantern",
    "引路鬼灯",
    "夜色中一盏青灯悬在半空,缓缓向密林深处飘去。",
    ["dark"],
    [
      c("跟随灯火", [
        o(
          40,
          "青灯引你至一处遗冢,陪葬之物犹在。",
          { type: "equipment", minQualityRank: 2 },
          { type: "material", id: "dust", amount: 4 },
        ),
        o(30, "灯下坐着一位等了百年的魂灵,托你了却尘缘后消散,留下谢礼。", {
          type: "stone",
          tierAmount: 55,
        }),
        o(30, "灯火骤灭,阴风四起!你且战且退。", { type: "buff", id: "injury" }),
      ]),
      leave("子不语怪力乱神,你目不斜视地走过。"),
    ],
    { maxRealm: 6 },
  ),
  ev(
    "ev_bone_scripture",
    "骨刻经文",
    "一具盘坐的枯骨前散落着骨片,其上刻满细密经文。",
    ["dark", "ruin"],
    [
      c("拾骨参读", [
        o(
          50,
          "经文玄奥,你抄录下来细细参悟。",
          { type: "material", id: "wudao", amount: 8 },
          { type: "material", id: "page", amount: 6 },
        ),
        o(25, "这竟是一部散佚的功法!", { type: "gongfa" }),
        o(25, "经文中藏着前人的执念,读之心魔暗生。", { type: "buff", id: "curse_xinmo" }),
      ]),
      c(
        "葬骨立碑",
        [
          o(1, "你将枯骨安葬。尘归尘,土归土,你只觉因果两清。", {
            type: "buff",
            id: "bless_jiyuan",
          }),
        ],
        { isDefault: true },
      ),
    ],
    { maxRealm: 7 },
  ),
  ev(
    "ev_starfall_pool",
    "星辉池",
    "荒原凹地积起一汪池水,倒映的星光竟不随云动。",
    ["sky"],
    [
      c(
        "掬水而饮",
        [
          o(60, "星辉入腹,神魂为之一清。", { type: "exp", secs: 60 }),
          o(40, "池水冰寒刺骨,你打了个激灵,灵台空明。", {
            type: "material",
            id: "wudao",
            amount: 6,
          }),
        ],
        { isDefault: true },
      ),
      c("池底摸索", [
        o(50, "池底沉着几块陨落的星髓。", { type: "material", id: "ore", amount: 14 }),
        o(50, "你搅碎了满池星光,什么也没捞到。"),
      ]),
    ],
    { maxRealm: MORTAL_END },
  ),
  ev(
    "ev_void_crack",
    "虚空裂缝",
    "空气中悬着一道细小的裂缝,深处传来若有若无的呼唤。",
    ["sky", "dark"],
    [
      c("探手其中", [
        o(35, "你摸到一件冰凉的古物!", { type: "artifact" }),
        o(35, "一股精纯之气顺着手臂涌入体内。", { type: "exp", secs: 60 }),
        o(30, "裂缝猛然收缩!你抽手不及,受了伤。", { type: "buff", id: "injury" }),
      ]),
      leave("虚空凶险,你退避三舍。"),
    ],
    { weight: 60, maxRealm: MORTAL_END },
  ),
  ev(
    "ev_fairy_field",
    "仙田遗种",
    "一小片荒芜的仙田里,竟还有一株灵植倔强地活着。",
    ["sky", "ruin"],
    [
      c(
        "小心移栽",
        [
          o(60, "灵植在你手中焕发生机,结出几枚灵果。", {
            type: "material",
            id: "herb",
            amount: 16,
          }),
          o(40, "移栽失败,灵植枯萎,你惋惜地收起残叶。", {
            type: "material",
            id: "herb",
            amount: 5,
          }),
        ],
        { isDefault: true },
      ),
      c("原地培育", [
        o(
          1,
          "你守着仙田数日,灵植开花结果。",
          { type: "material", id: "herb", amount: 10 },
          { type: "material", id: "wudao", amount: 3 },
        ),
      ]),
    ],
    { maxRealm: MORTAL_END },
  ),
  /*
   * 暗系四则（第 484 轮）。
   *
   * 前三轮补了冰 / 剑 / 火，用的是「标签摊到每处地界几则」这把尺。
   * 这一轮换成同一个量法重排之后，最少的是 `dark`:
   *
   * ```text
   *   dark     9 则 / 5 处地界 = 1.8
   *   thunder  5 则 / 2 处地界 = 2.5
   * ```
   *
   * 而 `dark` 横跨幽冥海（tier 8）到神魔古祭（tier 31）—— 玩家一路上反复经过它。
   * 故这四则按**层级**分开写:人间界两则写阴冷与溃散，界外两则写侵蚀与低语。
   */
  ev(
    "ev_youming_dukou",
    "幽冥渡口",
    "海面无风，却有一道一道的浪自远处推来。渡口边泊着一条船，船上没人。",
    ["dark", "water"],
    [
      c("上船", [
        o(40, "船自己动了。你不知漂了多久，靠岸时怀里多了一块冰凉的石头。", {
          type: "material",
          id: "ore",
          amount: 10,
        }),
        o(35, "船行至半途忽然停住。水里有东西在看你，你不敢回头。", {
          type: "exp",
          secs: 100,
        }),
        o(25, "船翻了。你在黑水里泡了很久才摸回岸边。", { type: "buff", id: "injury" }),
      ]),
      c("在岸边等", [
        o(55, "潮水退去，滩上留下一层细白的盐。你收了半袋。", {
          type: "material",
          id: "herb",
          amount: 7,
        }),
        o(45, "等了半夜，船不见了。风还在吹。", { type: "nothing" }),
      ]),
      leave("你转身离开。这处渡口不该有活人。"),
    ],
    { minRealm: 2, maxRealm: MORTAL_END },
  ),
  ev(
    "ev_jiuyou_huizhao",
    "九幽回照",
    "渊底有一面水，水面朝上，映的却是天空 —— 而这渊深不见底。",
    ["dark"],
    [
      c("俯身细看", [
        o(45, "你看见自己的倒影在对你笑。你确认过，你没有在笑。", {
          type: "material",
          id: "wudao",
          amount: 18,
        }),
        o(35, "水里映的是很多年前的这一处。你记住了那个样子。", { type: "exp", secs: 110 }),
        o(20, "你看得太久。回过神时，手已经伸进水里，冻得没了知觉。", {
          type: "buff",
          id: "injury",
        }),
      ]),
      c("投石试水", [
        o(60, "石头落下去，没有声。水纹散开，映出的天空裂了一道。", {
          type: "nothing",
        }),
        o(40, "水面把石头弹了回来，砸在你脚边。", { type: "buff", id: "injury" }),
      ]),
    ],
    { minRealm: 2, maxRealm: MORTAL_END },
  ),
  ev(
    "ev_yunshen_canqi",
    "陨神残旗",
    "荒原上插着半面旗，旗面早烂成絮，旗杆却是整的。风过时它不响。",
    ["dark"],
    [
      c("拔旗", [
        o(40, "旗杆入手极沉。你走了几步就明白，它不是凡铁。", {
          type: "equipment",
          minQualityRank: 5,
        }),
        o(60, "旗杆纹丝不动。你松手时，掌心一道血痕。", { type: "buff", id: "injury" }),
      ]),
      c("在旗下坐一会儿", [
        o(50, "风停了。你听见极远处有人在点兵，一声一声，很齐。", { type: "exp", secs: 115 }),
        o(50, "什么也没听见。荒原很静。", { type: "nothing" }),
      ]),
    ],
    { minRealm: 2, maxRealm: MORTAL_END },
  ),
  ev(
    "ev_shenmo_yuyin",
    "神魔低语",
    "祭坛上什么都没有。可你一靠近，耳边就响起一串听不懂的话，像在报一个名字。",
    ["dark"],
    [
      c("听下去", [
        o(35, "那名字报完了。你忽然知道自己该往哪走 —— 虽然从没人告诉过你。", {
          type: "material",
          id: "wudao",
          amount: 12,
        }),
        o(40, "听不清。声音越来越远，最后只剩自己的心跳。", { type: "nothing" }),
        o(25, "你听懂了其中一个音节。那之后有三天，你不敢闭眼。", {
          type: "buff",
          id: "injury",
        }),
      ]),
      c("掩耳退开", [o(1, "你退出祭坛。声音在坛边停住，没有跟出来。", { type: "nothing" })], {
        isDefault: true,
      }),
    ],
    { minRealm: 2, maxRealm: MORTAL_END },
  ),
  /*
   * 剑系与火系各三则（第 483 轮）。
   *
   * 第 482 轮给冰系补了三则（4 → 7）之后，最薄的两处变成 `sword`（4 则 / 1 处地界）
   * 与 `fire`（5 则 / 1 处）。而那是剑冢（tier 10）与赤炎火域（tier 7）——
   * 两个玩家会反复去的中高阶地界。
   *
   * 一律**不带 `general`**:带了就能出现在全图 44 处,那只是给通用池添乱。
   */
  ev(
    "ev_jianzhong_wendao",
    "剑冢问道",
    "万剑成冢,断刃朝天。你站在其中,忽觉有一股极细的意从脚底升上来 —— 不是杀气。",
    ["sword"],
    [
      c("静立感剑", [
        o(45, "那股利意顺着经脉走了一圈。你睁眼时,手心多了一层薄汗。", {
          type: "material",
          id: "wudao",
          amount: 15,
        }),
        o(35, "什么也没感到。冢中只有风穿过断刃的声音。", { type: "nothing" }),
        o(20, "意太盛,反噬心神。你退出剑冢时,耳中还在响。", { type: "buff", id: "injury" }),
      ]),
      c("随剑而舞", [
        o(40, "你拾起一柄无主之刃,随手挥了两下 —— 竟与冢中剑气合了拍。", {
          type: "exp",
          secs: 105,
        }),
        o(60, "剑太重。你舞了半刻,肩头酸了三天。", { type: "nothing" }),
      ]),
      leave("你退了出去。这地方不适合久留。"),
    ],
    { minRealm: 2, maxRealm: MORTAL_END },
  ),
  ev(
    "ev_duanjian_chonglian",
    "断剑重炼",
    "冢边有个老炉,炉膛里还留着余火。炉旁横着一柄断剑 —— 断口很新。",
    ["sword"],
    [
      c("接剑入炉", [
        o(45, "断处接得严丝合缝。你把它带走了。", { type: "equipment", minQualityRank: 4 }),
        o(55, "铁与铁之间终究差着一线。剑废了,炉也裂了。", { type: "buff", id: "injury" }),
      ]),
      c("只取残片", [
        o(70, "你敲下剑柄上的一小块,揣进怀里。", { type: "material", id: "ore", amount: 10 }),
        o(30, "残片碎成粉末。风一吹就散了。", { type: "nothing" }),
      ]),
    ],
    { minRealm: 2, maxRealm: MORTAL_END },
  ),
  ev(
    "ev_jianqi_chenghe",
    "剑气成河",
    "夜半,冢中无数断刃同时嗡鸣。那些声音连成一条线,听起来像水。",
    ["sword"],
    [
      c("以身试河", [
        o(35, "剑气过体,不伤血肉,只把经脉里淤着的东西冲散了。", { type: "exp", secs: 110 }),
        o(40, "你被冲得倒退七步,背抵断碑才停住。", { type: "nothing" }),
        o(25, "太利。你在原地站了很久才缓过来。", { type: "buff", id: "injury" }),
      ]),
      c("退出冢外", [o(1, "你在冢外坐到天明,声音才歇。", { type: "nothing" })], {
        isDefault: true,
      }),
    ],
    { minRealm: 2, maxRealm: MORTAL_END },
  ),
  ev(
    "ev_huoyu_duanshi",
    "火域锻石",
    "地缝里翻出的石头发着暗红的光,握久了烫手。",
    ["fire"],
    [
      c("取石入炉", [
        o(50, "石头在炉里化了,凝成一小块赤红的料子。", {
          type: "material",
          id: "ore",
          amount: 12,
        }),
        o(50, "石头炸开了。飞溅的碎屑在你手背上留下几个泡。", {
          type: "buff",
          id: "injury",
        }),
      ]),
      c("就地埋回去", [
        o(60, "你把它推回地缝。红光暗下去之前,你看清里面似乎有别的东西。", {
          type: "nothing",
        }),
        o(40, "石缝深处有余热涌上来。你在那儿烤了很久。", { type: "exp", secs: 95 }),
      ]),
    ],
    { minRealm: 2, maxRealm: MORTAL_END },
  ),
  ev(
    "ev_dihuo_wenlu",
    "地火问路",
    "前方火墙拦路。墙里隐约有一条窄道 —— 也可能只是火焰的形状。",
    ["fire"],
    [
      c("穿火而过", [
        o(45, "你冲过去,衣角烧掉一半,人没事。对面是一片没被烧过的地。", {
          type: "exp",
          secs: 100,
        }),
        o(55, "你冲到一半退了回来。眉头与手臂都焦了。", { type: "buff", id: "injury" }),
      ]),
      c("绕行", [o(1, "你绕着走了大半天,多费了些工夫,倒也平安。", { type: "nothing" })], {
        isDefault: true,
      }),
    ],
    { minRealm: 2, maxRealm: MORTAL_END },
  ),
  ev(
    "ev_huizhong_jiushi",
    "灰中拾石",
    "火域边缘的灰烬里,散着几粒没烧尽的东西。",
    ["fire"],
    [
      c("翻找灰烬", [
        o(55, "你捡出一小把暗色的颗粒,捻在指间有金属的凉。", {
          type: "material",
          id: "ore",
          amount: 8,
        }),
        o(45, "底下的灰还是烫的。你甩着手跳开,掌心一片通红。", {
          type: "buff",
          id: "injury",
        }),
      ]),
      c("拂灰静坐", [
        o(70, "灰很软。你在这儿坐了半日,心里那点火气下去了些。", { type: "exp", secs: 85 }),
        o(30, "静不下来。风一起,灰全扑在脸上。", { type: "nothing" }),
      ]),
    ],
    { minRealm: 2, maxRealm: MORTAL_END },
  ),
  /*
   * 冰系三则（第 482 轮）。
   *
   * 补的理由不是「缺」——`contentReachabilityAudit` 早就证明每个标签都可达。
   * 理由是 `ice` 的密度最低:三处地界（寒潭幽窟 / 昆仑雪岭 / 冰原）只有一个标签，
   * 而全库只给了它四则事件。同一个地界待久了，四则会撞完。
   *
   * 三则各写一个冰的侧面:湿冷侵骨、冰下有声、雪里有人。
   */
  ev(
    "ev_hanchao_diaobing",
    "寒潮钓冰",
    "寒潮过境,河面冻成一面青灰色的镜子。冰下有东西在动 —— 也可能是水声。",
    ["ice", "water"],
    [
      c("凿洞垂钓", [
        o(45, "钓上来一尾通体透明的鱼,鳞片像碎冰。你没舍得吃,收进行囊。", {
          type: "material",
          id: "herb",
          amount: 6,
        }),
        o(35, "钓了半天,只钓上来一截冻僵的旧绳。倒也不是全无用处。", {
          type: "material",
          id: "page",
          amount: 2,
        }),
        o(20, "冰面裂开,你半条腿陷进水里。那股冷,过了好几天才散。", {
          type: "buff",
          id: "injury",
        }),
      ]),
      c("破冰下水", [
        o(40, "你咬牙下去,在冰层下的暗流里摸到一块温热的石头。", {
          type: "material",
          id: "ore",
          amount: 8,
        }),
        o(30, "水下极静,你听见很远的地方有人在敲什么东西。上岸后耳鸣了半个时辰。", {
          type: "exp",
          secs: 80,
        }),
        o(30, "寒气直往骨头缝里钻。你爬上来时,嘴唇已经发紫。", {
          type: "buff",
          id: "injury",
        }),
      ]),
      leave("你在岸边站了很久,到底没有下去。"),
    ],
    { minRealm: 1, maxRealm: MORTAL_END },
  ),
  ev(
    "ev_bingpo_wenxin",
    "冰魄问心",
    "冰崖深处悬着一枚拳头大的冰魄,映出你此刻的模样 —— 那模样比你自己以为的苍老些。",
    ["ice", "mountain"],
    [
      c("以心问冰", [
        o(50, "冰魄里那道人影忽然睁开眼,与你对视。那一瞬,你想通了一件很久没想通的事。", {
          type: "material",
          id: "wudao",
          amount: 12,
        }),
        o(50, "什么也没有发生。你离开时,雪又开始下了。", { type: "nothing" }),
      ]),
      c("叩碎冰魄", [
        o(35, "冰魄碎成一把霜,落地时凝成一件东西的形状。", {
          type: "equipment",
          minQualityRank: 4,
        }),
        o(65, "碎冰溅了你一脸。等你擦干净,崖上已经什么都不剩了。", {
          type: "buff",
          id: "injury",
        }),
      ]),
      leave(),
    ],
    { minRealm: 2, maxRealm: MORTAL_END },
  ),
  ev(
    "ev_xueji_yinshi",
    "雪迹隐士",
    "雪地上有一行脚印,一直通到山壁里面去 —— 山壁上并没有门。",
    ["ice", "mountain"],
    [
      c("循迹而入", [
        o(40, "山壁后是一间石室,有人在里面煮过雪。炉边留着一卷旧书。", {
          type: "material",
          id: "page",
          amount: 8,
        }),
        o(35, "石室里空无一人,只墙上刻着两句诗。你记住了其中一句。", {
          type: "exp",
          secs: 120,
        }),
        o(25, "石室塌了一半,你被埋在雪里爬了很久。", { type: "buff", id: "injury" }),
      ]),
      c("在门口静候", [
        o(60, "雪下了一整夜。天亮时脚印还在,人没出来。你起身走了。", {
          type: "nothing",
        }),
        o(40, "天亮前,门帘掀开一线。有人递出一杯热的东西,没说话。", {
          type: "exp",
          secs: 115,
        }),
      ]),
    ],
    { minRealm: 2, maxRealm: MORTAL_END },
  ),
  ev(
    "ev_ice_coffin",
    "寒冰棺椁",
    "万年玄冰中封着一具棺椁,棺中人容颜如生。",
    ["ice", "ruin"],
    [
      c(
        "叩拜离去",
        [
          o(1, "你郑重三拜。冥冥中似有一道目光注视着你,片刻后隐去。", {
            type: "buff",
            id: "bless_jiyuan",
          }),
        ],
        {
          isDefault: true,
        },
      ),
      c("破冰探棺", [
        o(40, "棺旁陪葬着一件保存完好的古物。", { type: "equipment", minQualityRank: 3 }),
        o(30, "棺中人指间夹着一页玉笺,似是留给后来者。", { type: "gongfa" }),
        o(30, "寒气反噬!你冻得嘴唇发紫。", { type: "buff", id: "injury" }),
      ]),
    ],
    { maxRealm: 7 },
  ),
  ev(
    "ev_heart_demon",
    "心魔叩关",
    "静修时,一个与你一模一样的身影在识海中冷笑:「你修的道,是真的吗?」",
    ["general"],
    [
      c("直面心魔", [
        o(75, '你与"自己"对峙三日,道心愈发坚定。', { type: "material", id: "wudao", amount: 12 }),
        o(25, "心魔狡诈,你落了下风,道行受损。", { type: "buff", id: "curse_xinmo" }),
      ]),
      c(
        "置之不理",
        [
          o(70, "你不闻不问,心魔自讨没趣地散了。"),
          o(30, "心魔趁虚而入,扰你清修。", { type: "buff", id: "curse_xinmo" }),
        ],
        {
          isDefault: true,
        },
      ),
    ],
    { minRealm: 2 },
  ),
  ev(
    "ev_dao_stone",
    "问道石",
    "一块古碑立于路旁,上书两个古字:「问道」。据说触碑者可得一问。",
    ["general"],
    [
      c("以手触碑", [
        o(50, "古碑微光流转,你心中一个困惑已久的关隘豁然贯通。", { type: "exp", secs: 90 }),
        o(30, "碑中传出一声轻叹,一页古老的纸卷飘落。", {
          type: "material",
          id: "page",
          amount: 10,
        }),
        o(20, "古碑纹丝不动。或许,你的问题还不够格。"),
      ]),
      leave("道在己身,不假外求。你笑了笑,继续赶路。"),
    ],
    { minRealm: 3, weight: 60 },
  ),
  ev(
    "ev_pill_furnace",
    "无主丹炉",
    "崖洞中一尊丹炉犹自温热,炉主人却已不知去向。",
    ["general", "ruin", "fire"],
    [
      c("开炉取丹", [
        o(45, "炉中一炉丹药刚好炼成!", { type: "pill", count: 3 }),
        o(30, "丹已成灰,但炉底结着一层精纯丹髓。", { type: "material", id: "herb", amount: 12 }),
        o(25, "开炉瞬间药力冲腾,你吸入过量药气,头晕目眩。", { type: "buff", id: "injury" }),
      ]),
      leave("丹炉主人恐有不测,你不愿沾染因果。"),
    ],
    { maxRealm: 6 },
  ),
  ev(
    "ev_wine_immortal",
    "醉卧仙人",
    "一位酒气冲天的邋遢道人醉卧道旁,怀里的酒葫芦滚到了你脚边。",
    ["general"],
    [
      c(
        "拾葫芦归还",
        [
          o(50, "道人眯眼一笑,请你共饮一口。入喉如吞云霞!", { type: "exp", secs: 60 }),
          o(30, "道人打个酒嗝:「有心了。」随手赏你一物。", { type: "artifact" }),
          o(20, "道人呼呼大睡,你把葫芦放回他怀里,悄然离去。", {
            type: "buff",
            id: "bless_qingfeng",
          }),
        ],
        { isDefault: true },
      ),
      c("偷喝一口", [
        o(40, "仙酿入喉,妙不可言!", { type: "exp", secs: 60 }),
        o(60, "「小贼!」道人眼皮都没抬,一个酒嗝把你熏得七荤八素。", { type: "buff", id: "injury" }),
      ]),
    ],
    { weight: 70 },
  ),
  ev(
    "ev_market_day",
    "山下集市",
    "恰逢山下小镇赶集,人声鼎沸,烟火气扑面而来。",
    ["general"],
    [
      c(
        "入市闲逛",
        [
          o(50, "你在旧货摊上淘到一件被当作凡物的宝贝。", { type: "equipment", minQualityRank: 1 }),
          o(
            30,
            "你帮镇民驱走了捣乱的野兽,收获一堆谢礼。",
            { type: "stone", tierAmount: 30 },
            { type: "material", id: "herb", amount: 5 },
          ),
          o(20, "你尝遍小吃,红尘烟火,亦是修行。", { type: "buff", id: "bless_qingfeng" }),
        ],
        { isDefault: true },
      ),
      c("过门不入", [
        o(1, "红尘滚滚,你心如止水地走过。", { type: "material", id: "wudao", amount: 2 }),
      ]),
    ],
    { maxRealm: 2 },
  ),
  ev(
    "ev_ancient_gate",
    "无字石门",
    "半山腰嵌着一扇巨大的石门,无锁无缝,门前刻着一行小字:「有缘者入」。",
    ["general", "ruin"],
    [
      c("推门", [
        o(
          30,
          "石门轰然开启!门后小殿中供着前人留下的传承。",
          { type: "gongfa" },
          { type: "stone", tierAmount: 40 },
        ),
        o(40, "石门纹丝不动,但门上道纹让你若有所悟。", {
          type: "material",
          id: "wudao",
          amount: 6,
        }),
        o(30, "石门震出一股罡气,你被推得连退数步。", { type: "buff", id: "injury" }),
      ]),
      leave("缘分未到,强求无益。"),
    ],
    { weight: 70, minRealm: MORTAL_END, maxRealm: MORTAL_END },
  ),
  ev(
    "ev_rescue_disciple",
    "遇袭的弟子",
    "前方打斗声起,一名宗门弟子正被数只妖兽围攻,险象环生。",
    ["general", "forest", "mountain"],
    [
      c(
        "出手相救",
        [
          o(65, "你击退妖兽。弟子感激涕零,以宗门丹药相谢。", { type: "pill", count: 2 }),
          o(
            35,
            "救人成功,你却也挂了彩。弟子留下谢礼匆匆离去。",
            { type: "stone", tierAmount: 40 },
            { type: "buff", id: "injury" },
          ),
        ],
        { isDefault: true },
      ),
      c("静观其变", [
        o(50, "弟子自行突围而去,你捡了点妖兽掉落之物。", {
          type: "material",
          id: "ore",
          amount: 5,
        }),
        o(
          50,
          "弟子力竭陨落。你叹了口气,收敛其遗物,立坟安葬。",
          { type: "equipment", minQualityRank: 1 },
          { type: "buff", id: "curse_xinmo" },
        ),
      ]),
    ],
    { maxRealm: 4 },
  ),
  ev(
    "ev_border_stall",
    "云雾茶摊",
    "山道旁不知何时支起一座茶摊,摊主是位笑眯眯的老妪,茶香远远飘来。",
    ["general"],
    [
      c(
        "坐下喝碗茶",
        [
          o(60, "一碗粗茶下肚,连日疲惫一扫而空。", { type: "buff", id: "bless_qingfeng" }),
          o(25, "老妪多看了你两眼:「小娃娃面相不俗。」赠你一包晒干的灵草。", {
            type: "material",
            id: "herb",
            amount: 8,
          }),
          o(15, "茶汤入喉竟有道韵流转——这哪里是凡茶!待你回神,茶摊已消失无踪。", {
            type: "buff",
            id: "bless_daoyun",
          }),
        ],
        { isDefault: true },
      ),
      c(
        "付双倍茶钱",
        [
          o(
            70,
            "老妪眉开眼笑,往你茶碗里多添了一勺蜜。你只觉气运都顺了几分。",
            { type: "stone", tierAmount: -10 },
            { type: "buff", id: "bless_jiyuan" },
          ),
          o(30, "老妪摆摆手不肯多收,只道:「出门在外,与人为善。」", {
            type: "material",
            id: "wudao",
            amount: 3,
          }),
        ],
        { hint: "需要灵石", cond: { type: "stone", tierAmount: 10 } },
      ),
    ],
    { maxRealm: 2 },
  ),
  ev(
    "ev_stargazer",
    "观星台残址",
    "断崖上立着半座残破的观星台,石盘上的星图仍在缓缓流转。",
    ["general", "ruin", "sky"],
    [
      c("推演星图", [
        o(55, "星轨入目,你于命数一道略有所悟。", { type: "material", id: "wudao", amount: 7 }),
        o(25, "星图深处竟藏着一段观想法门!", { type: "gongfa" }),
        o(20, "星光刺目,你双眼酸胀,险些迷了心神。", { type: "buff", id: "curse_xinmo" }),
      ]),
      leave("天机莫测,你看了两眼便移开目光。"),
    ],
    { maxRealm: MORTAL_END },
  ),
  // ============ 仙界及以上际遇(准入境界 9-20)============
  /**
   * 第 9~11 境原本只有 3 / 2 / 2 个界外独占事件(第 136 轮 `eventSupplyCurve.spec` 量出),
   * 而第 14 境起每境都有 4~9 个 —— 刚飞升那三境最薄。这里各补两个,把曲线接上。
   *
   * 三境各写一件事,不重复后面的「云海 / 神域 / 混沌」三类意象:
   * 第 9 境写**初到**的不适应,第 10 境写**仙凡之别**,第 11 境写**旧物**。
   */
  ev(
    "ev_poyun_ta",
    "破云塔",
    "云海下浮着一座倒悬的塔,塔尖朝下扎进雾里。你踏上去时,它缓缓转正 —— 像是等你很久了。",
    ["general", "sky", "immortal"],
    [
      c(
        "登塔",
        [
          o(60, "塔中一层悬着一面旧镜,照见你入门时的样子。镜面碎开,落下几片灵光。", {
            type: "material",
            id: "wudao",
            amount: 18,
          }),
          o(40, "走到第九层便再上不去,塔顶那片天不属于你。你在阶上坐了很久。", {
            type: "exp",
            secs: 90,
          }),
        ],
        { isDefault: true },
      ),
      c("绕塔而行", [
        o(1, "塔基刻着一圈看不懂的字,你拓了一页下来。", {
          type: "material",
          id: "page",
          amount: 2,
        }),
      ]),
    ],
    { minRealm: 9 },
  ),
  ev(
    "ev_liuyun_ji",
    "流云寄",
    "一封未拆的信落在云上,封口压着仙门旧印。收信人的名字被云抹去了,只余一个字。",
    ["general", "sky", "immortal"],
    [
      c(
        "拆开",
        [
          o(50, "信里是一句极短的交代,末尾写着「不必回」。你读了三遍。", {
            type: "exp",
            secs: 120,
          }),
          o(30, "信纸一触即散,只留下一缕气机钻进你经脉。", {
            type: "buff",
            id: "bless_qingfeng",
          }),
          o(20, "信是假的 —— 封口那道印在你拆的瞬间反噬,掌心焦了一小块。", {
            type: "buff",
            id: "injury",
          }),
        ],
        { isDefault: true },
      ),
      c("原样放回云里", [
        o(1, "你把信放回原处,云很快把它带走了。", { type: "material", id: "dust", amount: 30 }),
      ]),
    ],
    { minRealm: 9 },
  ),
  ev(
    "ev_tianhe_du",
    "天河渡口",
    "一条看不见对岸的河横在面前,渡口立着一块碑:「过者不留名」。船在,人不在。",
    ["general", "water", "immortal"],
    [
      c(
        "上船",
        [
          o(55, "船自己动了。到岸时你身上少了一样本该带走的东西,却记不起是什么。", {
            type: "material",
            id: "wudao",
            amount: 24,
          }),
          o(45, "船到河心停住,水面映出你在凡间的最后一夜。船轻轻靠回原岸。", {
            type: "exp",
            secs: 100,
          }),
        ],
        { isDefault: true },
      ),
      c("沿河走", [
        o(1, "走了半日,河仍在。你在岸边捡到一块被水磨圆的铁。", {
          type: "material",
          id: "ore",
          amount: 30,
        }),
      ]),
    ],
    { minRealm: 10 },
  ),
  ev(
    "ev_jiebei_ling",
    "界碑铃",
    "仙界与人间的界碑上系着一枚小铃。你靠近时它响了 —— 而四下无风。",
    ["general", "immortal"],
    [
      c(
        "解下小铃",
        [
          o(50, "铃音散开的一瞬,你听见了很远的地方有人在唤你的道号。", {
            type: "buff",
            id: "bless_jiyuan",
          }),
          o(50, "铃上积的是一层旧尘,擦净之后什么也没有。", {
            type: "material",
            id: "dust",
            amount: 40,
          }),
        ],
        { isDefault: true },
      ),
      c("摇一摇", [
        o(70, "铃声一起,界碑后浮出一段路 —— 通往你此前没走过的一处。", {
          type: "exp",
          secs: 100,
        }),
        o(30, "铃声空落落地散在风里,没有回应。", { type: "nothing" }),
      ]),
    ],
    { minRealm: 10 },
  ),
  ev(
    "ev_jiuxian_canju",
    "旧仙残局",
    "石桌上一局未收的棋,黑白都已化石。你伸手时,一枚子自己挪了半格。",
    ["general", "mountain", "immortal"],
    [
      c(
        "落子",
        [
          o(45, "棋盘活了。你下了三十几手,最后输了半目 —— 却比来时明白多了。", {
            type: "exp",
            secs: 110,
          }),
          o(35, "一枚子落在你该落的地方。石桌裂开,底下是一小袋灵材。", {
            type: "material",
            id: "herb",
            amount: 25,
          }),
          o(20, "你落了子,盘上却没有任何变化。对手早就走了。", { type: "nothing" }),
        ],
        { isDefault: true },
      ),
      c("收走棋子", [
        o(1, "棋子入手极沉,不像石,也不像铁。", { type: "material", id: "ore", amount: 45 }),
      ]),
    ],
    { minRealm: 11 },
  ),
  ev(
    "ev_guanshan_jing",
    "关山镜",
    "山壁上嵌着一面大镜,里面照的不是你,是你还在凡间时住过的那间屋子。",
    ["general", "mountain", "immortal"],
    [
      c(
        "看进去",
        [
          o(50, "屋里的灯还亮着,桌上有半碗没吃完的饭。你站着看了一夜。", {
            type: "exp",
            secs: 105,
          }),
          o(30, "镜中有人抬头看你 —— 你看不清他的脸,却觉得他知道你成了。", {
            type: "buff",
            id: "bless_daoyun",
          }),
          o(20, "镜里的屋子早已塌了。你看了很久才认出那是同一处地方。", {
            type: "nothing",
          }),
        ],
        { isDefault: true },
      ),
      c("背过身去", [
        o(1, "你没有再看第二眼。山风从背后吹过,很干净。", {
          type: "material",
          id: "wudao",
          amount: 15,
        }),
      ]),
    ],
    { minRealm: 11 },
  ),
  ev(
    "ev_xianmen_yize",
    "仙门遗泽",
    "云海深处,一座废弃仙门的匾额半悬。门内灵光未散,似有传承静候有缘。",
    ["general", "sky", "immortal"],
    [
      c(
        "拜入仙门",
        [
          o(55, "门后灵光化形,一头生翼四爪的神兽自光中踏出,俯首于你。", {
            type: "pet",
            id: "pet_yinglong",
          }),
          o(30, "传承是你早已通晓的仙典,你仍添了几分体悟。", { type: "exp", secs: 60 }),
          o(15, "禁制仍在,你被反震出数丈,气血翻涌。", { type: "buff", id: "injury" }),
        ],
        { isDefault: true },
      ),
      c("取匾额残金", [
        o(1, "匾额由仙金铸成,你敲下一块。", { type: "material", id: "ore", amount: 40 }),
      ]),
    ],
    { minRealm: 9 },
  ),
  /**
   * 仙界 / 神界各补一只灵兽。
   *
   * 灵兽位只有一个 —— 一个界域只给一只,「带哪只」这个选择就根本不存在,
   * 与法宝那条「件数要多于槽位数」是同一条理由(contentDensity 的判据已改为每界 ≥2)。
   */
  ev(
    "ev_qingluan_yun",
    "云海青鸾",
    "云海之上,一只青鸾绕着仙门的断柱盘旋,羽色如洗。它落在你肩头,像是认了你。",
    ["general", "sky", "immortal"],
    [
      c(
        "与之结缘",
        [
          o(60, "青鸾自此随行,云海之上再无迷途。", { type: "pet", id: "pet_qingluan" }),
          o(40, "青鸾啄了啄你的衣袖便飞远了,只留下一句清越的鸣声在耳。", { type: "exp", secs: 30 }),
        ],
        { isDefault: true },
      ),
      c("不惊仙禽", [
        o(1, "你远远绕开,不愿扰它清净。", { type: "material", id: "wudao", amount: 12 }),
      ]),
    ],
    { minRealm: 10 },
  ),
  ev(
    "ev_yaochi_xianpai",
    "瑶池仙桃",
    "一株仙桃横斜于瑶池之畔,果香沁入神魂——只是树下盘着一条守苑仙蟒。",
    ["general", "immortal"],
    [
      c(
        "摘取仙桃",
        [
          // 界外的寿元以亿载计:一株仙桃写的必须是「当前境界寿元的几成」,
          // 不是「八百年」—— 对一位金仙来说,八百年连一次吐纳都算不上。
          o(60, "你摘下仙桃,一口入腹,寿元大增。", { type: "lifespan", pct: 0.05 }),
          o(
            40,
            "仙蟒骤然发难,你夺桃而走,却也受了些伤。",
            { type: "lifespan", pct: 0.02 },
            { type: "buff", id: "injury" },
          ),
        ],
        { isDefault: true },
      ),
      c("不扰仙苑", [o(1, "机缘在前而能不取,你心境反而更明。", { type: "exp", secs: 30 })]),
    ],
    { minRealm: 11 },
  ),
  /*
   * 仙界四处(谪仙古渡 / 瑶池仙苑 / 不朽金渊 / 玄机道场)只带 `immortal` 一个附加标签,
   * 而纯 immortal 的事件此前只有 3 条 —— 这四处境界 9~12,把它们能撞到的地方特色
   * 压到了个位数。带 `sky` 的另六处还有 10 条 sky 事件兜底,这四处没有。
   *
   * 补三条,让纯 immortal 的池从 3 条变 6 条。
   * 境界带按四处的最低门槛给(minRealm 9),上限不设 —— 仙界各层都还说得通。
   */
  ev(
    "ev_duchuan_canpai",
    "古渡残牌",
    "古渡的渡口立着半截石碑,碑上刻满名字,大多已经磨平,只剩最上面一行还看得清。",
    ["general", "immortal"],
    [
      c("拓下那行名字", [
        o(55, "你以神识拓下那行字,恍惚间看见一个背影正踏水而去。", {
          type: "material",
          id: "wudao",
          amount: 30,
        }),
        o(25, "石碑在你触碰的刹那碎成沙,那行名字也散了。", { type: "nothing" }),
        o(20, "碑上残留的念力反冲识海,你后退两步,额角渗汗。", { type: "buff", id: "injury" }),
      ]),
      c(
        "在碑前坐一会儿",
        [
          o(1, "你只是坐着,看渡口的水一遍遍涨落。忽然明白自己为何还要走这一趟。", {
            type: "exp",
            secs: 70,
          }),
        ],
        { isDefault: true },
      ),
    ],
    { minRealm: 9 },
  ),
  ev(
    "ev_jinyuan_tie",
    "金渊铁胎",
    "不朽金渊的渊壁上,一块金属胎衣嵌在岩里,表皮被岁月磨得发乌,敲上去却仍是实心。",
    ["general", "immortal"],
    [
      c("凿取铁胎", [
        o(50, "铁胎入手沉得离奇,你几乎要动用真元才拿得稳。", {
          type: "material",
          id: "ore",
          amount: 60,
        }),
        o(
          30,
          "凿口崩裂,一块碎屑弹起划破你的手臂。",
          { type: "buff", id: "injury" },
          {
            type: "material",
            id: "ore",
            amount: 24,
          },
        ),
        o(20, "铁胎里竟是空心的 —— 不知多少年前就被掏空了。", { type: "nothing" }),
      ]),
      c(
        "观其纹路",
        [
          o(1, "铁胎表面的纹路像是一套锻法,你看得入神,记下了几分。", {
            type: "material",
            id: "wudao",
            amount: 24,
          }),
        ],
        { isDefault: true },
      ),
    ],
    { minRealm: 10 },
  ),
  ev(
    "ev_xuanji_pan",
    "玄机残盘",
    "道场中央摆着一副残破的星盘,少了两根针,盘面却仍在缓慢地转。",
    ["general", "immortal"],
    [
      c("拨动星盘", [
        o(45, "你把剩下那根针拨了半圈,盘面掠过一道光 —— 某个答案落进心里。", {
          type: "exp",
          secs: 75,
        }),
        o(30, "针尖划破你的指尖,血珠落在盘上,星盘停了。", { type: "buff", id: "injury" }),
        o(25, "星盘转得太慢,你等了许久,什么也没发生。", { type: "nothing" }),
      ]),
      c(
        "不碰它",
        [
          o(1, "你看着它转了很久。有些答案,不知道比知道好。", {
            type: "material",
            id: "dust",
            amount: 14,
          }),
        ],
        { isDefault: true },
      ),
    ],
    { minRealm: 11 },
  ),
  /*
   * 太乙雷池(tier24 · 境界12)只带 `thunder` + `immortal` 两个附加标签。
   * 但现存的 `thunder` 事件全是人间界的(境界 4~8,服务雷泽),一条也够不到境界 12 ——
   * **名为「雷池」,实际一条雷系际遇都抽不到**,能抽到的 7 条全是 immortal 那一路。
   *
   * 补一条仙界雷系,境界带对准雷池(minRealm 12)。
   */
  ev(
    "ev_leichi_xianlei",
    "雷池仙雷",
    "雷池的水面浮着一层极薄的白光,每隔一阵,池底会升起一道极细的雷电 —— 不炸响,只静静地立在那里。",
    ["general", "thunder", "immortal"],
    [
      c("引那道雷入体", [
        o(50, "雷丝顺着经脉走完一圈,沿途烧掉了些说不清的东西。", {
          type: "exp",
          secs: 75,
        }),
        o(
          30,
          "雷太细,反而更难承受。你退开时指间仍在发麻。",
          { type: "buff", id: "injury" },
          { type: "material", id: "wudao", amount: 40 },
        ),
        o(20, "那道雷在池面立了很久,最后自己散进水里,像没打算给谁。", {
          type: "nothing",
        }),
      ]),
      c(
        "在池边等",
        [
          o(1, "你坐在池边看了一整日的雷起雷落。它不催,你也不急。", {
            type: "material",
            id: "wudao",
            amount: 45,
          }),
        ],
        { isDefault: true },
      ),
    ],
    { minRealm: 12, maxRealm: 13 },
  ),
  /*
   * 谪仙古渡(tier21 · 境界9)只带 `immortal` 一个附加标签,而纯粹够得上境界 9 的
   * immortal 事件只有 2 条(仙门遗泽、古渡残牌;瑶池仙桃要境界 11、云海青鸾要 10)。
   * 补一条,让这一处「渡」的意象多一点。
   */
  ev(
    "ev_duchuan_zhouzi",
    "无舟渡头",
    "渡头拴着一条船。你解绳上船,船却不曾靠岸 —— 它一直停在原处,而岸在往后退。",
    ["general", "immortal"],
    [
      c("弃船上岸", [
        o(55, "你跳回岸上,那船立刻漂远了 —— 它本来就不打算渡人,只是在等你上钩。", {
          type: "material",
          id: "wudao",
          amount: 32,
        }),
        o(45, "岸已经退得看不见了。你站在空船上,直到它自己停下来。", {
          type: "buff",
          id: "injury",
        }),
      ]),
      c(
        "坐在船头等",
        [
          o(1, "你不急也不问,只坐在船头。不知过了多久,岸又慢慢回来了。", {
            type: "exp",
            secs: 70,
          }),
        ],
        { isDefault: true },
      ),
    ],
    { minRealm: 9, maxRealm: 11 },
  ),
  /*
   * 法宝三则（第 492 轮）。
   *
   * 上一轮补了寿元（2 → 7）之后，最少的一处是 `artifact`（2 处）。
   * 而法宝有 **49 件**、每件 9 级祭炼 —— 内容量仅次于装备，却只有两条事件能送出来:
   * 虚空裂缝「探手其中」35%、酒仙「拾葫芦归还」30%。
   *
   * 三条各自落在不同的地界类型上（遗迹 / 火域 / 天象），不挤在通用池里。
   */
  ev(
    "ev_gujing_canbao",
    "古井沉宝",
    "废庙后院有一口井，井口盖着石板。石板上刻着「勿启」两个字 —— 刻得很深，像是刻的人自己也不信。",
    ["ruin"],
    [
      c("挪开石板", [
        o(30, "井底没有水。你摸到一件用油布裹着的东西，布已经朽了。", {
          type: "artifact",
        }),
        o(45, "井底只有淤泥与一枚锈死的铜钱。那两个字你倒想了很久。", {
          type: "material",
          id: "wudao",
          amount: 6,
        }),
        o(25, "石板滑落，砸在小腿上。你在井边坐了很久才站起来。", {
          type: "buff",
          id: "injury",
        }),
      ]),
      c(
        "把石板盖回原位",
        [
          o(1, "你把石板重新盖好。「勿启」那两个字朝上 —— 到底是为什么，你想了一路。", {
            type: "material",
            id: "wudao",
            amount: 12,
          }),
        ],
        {
          isDefault: true,
        },
      ),
    ],
    { minRealm: 2, maxRealm: MORTAL_END },
  ),
  ev(
    "ev_jiangren_yizhen",
    "匠人遗镇",
    "火域边缘有间塌了半边的铺子，炉子还是热的。炉边坐着一个人形的灰烬。",
    ["fire"],
    [
      c("翻找炉后的架子", [
        o(35, "架子最下层有个铁匣，匣子里的东西还带着匠人的手温。", { type: "artifact" }),
        o(40, "架上全是废料。你挑了半天，只挑出一块能用的铁。", {
          type: "material",
          id: "ore",
          amount: 12,
        }),
        o(25, "你一碰架子，整排连炉子一起塌了下来。火苗窜到眉毛。", {
          type: "buff",
          id: "injury",
        }),
      ]),
      c("替他把炉火封上", [
        o(70, "你封了火，把那堆灰烬扫到墙角。走的时候心里松了一块。", {
          type: "exp",
          secs: 95,
        }),
        o(30, "火封不住。你试了三次，看懂了那炉子为什么一直不灭。", {
          type: "material",
          id: "wudao",
          amount: 5,
        }),
      ]),
    ],
    { minRealm: 2, maxRealm: MORTAL_END },
  ),
  ev(
    "ev_xingxiu_yiwu",
    "星宿遗物",
    "星陨过后，荒原上留下一道浅坑。坑底有件东西在慢慢转，像还没想好要不要停下来。",
    ["sky", "immortal"],
    [
      c("伸手去接", [
        o(32, "它落在你掌心里，比看上去沉。", { type: "artifact" }),
        o(43, "它在指尖一寸处停住，然后碎了。碎屑很凉。", { type: "nothing" }),
        o(25, "它转得太快，割开了你的手。伤好之后留下道白痕。", {
          type: "buff",
          id: "injury",
        }),
      ]),
      c("等它自己停", [
        o(60, "你等了三天。它没停，你走了。", { type: "nothing" }),
        o(40, "第三天夜里它忽然落下，正砸在你身边。你把它捡了起来。", {
          type: "material",
          id: "dust",
          amount: 10,
        }),
      ]),
    ],
    { minRealm: 8, maxRealm: MAX_MAJOR },
  ),
  /*
   * 寿元四则（第 491 轮）。
   *
   * 152 个事件里只有三处能改寿元 —— 而寿元是这部作品最核心的压力:
   * 「一世」就是以它计的。故补四则。
   *
   * **两个刻度不能混**（数据文件上方那条注释讲过）:
   *   人间界   寿元以年计     → 写 years
   *   界外     寿元以亿载计   → 写 pct（对金仙来说八百年连一次吐纳都算不上）
   */
  ev(
    "ev_shouyan_zhi",
    "寿宴之纸",
    "村里在办寿宴。主家把一张写了字的红纸递到你手上 —— 那是一份「借寿」的字据。",
    ["general"],
    [
      c("收下字据", [
        o(50, "字据入袖，你觉得身子轻了些。", { type: "lifespan", years: 12 }),
        o(30, "字据上那句话你琢磨了半宿 —— 借寿者，先要肯活。", {
          type: "material",
          id: "wudao",
          amount: 5,
        }),
        o(20, "夜里你梦见有人在数自己的岁数，一声一声，数到天亮。", {
          type: "buff",
          id: "injury",
        }),
      ]),
      c("把字据还回去", [
        o(60, "主家愣了一下，随即笑着收下。那顿饭你吃得很踏实。", {
          type: "exp",
          secs: 60,
        }),
        /*
         * 这一条给的是悟道而不是寿元:选项的价值不必与事件主题一致 ——
         * 「把字据还回去」换来的是一句受用的话,那比十二年寿数更像是这个选择该有的回报。
         * 同时它让这一则不至于在悟道供给上稀释本就稀薄的那一格(见 economySim 的偏离判据)。
         */
        o(1, "席散时主家送你出门,说了一句「活着比什么都好」。你记了很多年。", {
          type: "material",
          id: "wudao",
          amount: 6,
        }),
        o(40, "主家不肯收。你只好把字据压在碗底下走了。", { type: "nothing" }),
      ]),
    ],
    { minRealm: 0, maxRealm: MORTAL_END },
  ),
  ev(
    "ev_xushi_canpian",
    "续世残篇",
    "洞窟深处有一卷残篇，只余半页。上面的字认不全，但「续」那个字很清楚。",
    ["general", "ruin"],
    [
      c("照着残篇调息", [
        o(45, "你按那几个字的意思调了三个月息。出关时，鬓角的白发少了几根。", {
          type: "lifespan",
          years: 25,
        }),
        o(35, "调岔了。你在洞窟里吐了半宿血。", { type: "buff", id: "injury" }),
        o(20, "没什么效果。但那半页上的字，你琢磨了很久。", {
          type: "material",
          id: "wudao",
          amount: 7,
        }),
      ]),
      c("只抄不练", [
        o(70, "抄下来的那半页，往后或许用得上。", { type: "material", id: "page", amount: 8 }),
        o(30, "抄到一半，纸就碎了。", { type: "nothing" }),
      ]),
    ],
    { minRealm: 2, maxRealm: MORTAL_END },
  ),
  ev(
    "ev_jiedan_tingyan",
    "解丹听验",
    "丹成出炉。老丹师捏起一枚对着光看了很久，说：这一炉，能添几年。",
    ["general"],
    [
      c("当场服下", [
        o(55, "药力化开，你觉得筋骨里那点旧伤都松了。", { type: "lifespan", years: 40 }),
        o(25, "药性太烈，你在床上躺了三天。", { type: "buff", id: "injury" }),
        o(20, "丹是好丹，只是你此刻虚不受补。", { type: "nothing" }),
      ]),
      c("收起来，留到要紧时", [
        o(1, "你把它收进最里层的匣子。老丹师那句话，你记了很多年。", {
          type: "material",
          id: "wudao",
          amount: 8,
        }),
      ]),
    ],
    { minRealm: 5, maxRealm: MORTAL_END },
  ),
  ev(
    "ev_xianren_xushou",
    "仙人续寿",
    "白衣人在云头坐下，指了指你。他没说话，但你知道他在问：「还想活多久」",
    ["sky", "immortal"],
    [
      c("答「够用就好」", [
        o(50, "他点了点头。你身上的旧疲忽然散了。", { type: "lifespan", pct: 0.06 }),
        o(50, "他笑了一下，什么也没给，转身走了。", { type: "nothing" }),
      ]),
      c("答「越久越好」", [
        o(40, "他伸手在你眉心一点。你觉得有什么东西被拉长了。", {
          type: "lifespan",
          pct: 0.12,
        }),
        o(60, "他摇头。那一指落下时，你听见自己体内有什么断了。", {
          type: "buff",
          id: "injury",
        }),
      ]),
    ],
    { minRealm: 10, maxRealm: MAX_MAJOR },
  ),
  /*
   * 天象四则（第 486 轮）。
   *
   * `sky` 一直是「每处地界摊到几则」最低的那一处（15 则 / 10 处 = 1.5），
   * 前四轮特意留到现在补 —— 因为它与冰/剑/火/暗都不同:
   *
   * ```text
   *   sky   10 处地界，tier 17~32，minRealm 7~20
   *         从星陨荒原一路铺到鸿蒙本源，跨三个界域
   * ```
   *
   * 故这四则按**层级**分开:两则写「天象本身」（星、天外），两则写「天上留下的东西」
   * （星潮、鸿蒙之音）。一律不带 `general`。
   */
  ev(
    "ev_xingyun_shi",
    "星陨石",
    "荒原上散着一层细碎的光。走过去才发现，那是不久前落下来的星屑，还温着。",
    ["sky", "immortal"],
    [
      c("拾取星屑", [
        o(50, "星屑入手很轻。你收了一把。", { type: "material", id: "wudao", amount: 16 }),
        o(30, "屑末在指间化成光，什么也没剩下。", { type: "nothing" }),
        o(20, "有几粒还烫。你缩回手，指尖起了泡。", { type: "buff", id: "injury" }),
      ]),
      c("在原地看着", [
        o(55, "又落了一阵。你看清了它们下来的方向。", { type: "exp", secs: 105 }),
        o(45, "天很干净，什么都没再落。", { type: "nothing" }),
      ]),
    ],
    { minRealm: 7, maxRealm: MAX_MAJOR },
  ),
  ev(
    "ev_tianwaitian_jing",
    "天外天镜",
    "天尽头悬着一面镜，镜面朝下。它映的不是你，是你在很远的地方做过的某件事。",
    ["sky", "immortal"],
    [
      c("看下去", [
        o(45, "你看见了那道很久没想起的背影。回过神来，天色已暗。", {
          type: "material",
          id: "wudao",
          amount: 20,
        }),
        o(35, "镜里一片模糊。你看了很久，也没认出那是谁。", { type: "nothing" }),
        o(20, "镜面忽然一翻，光直射进眼。你捂着脸退了很远。", {
          type: "buff",
          id: "injury",
        }),
      ]),
      c("背过身去", [o(1, "你没有看。有些事过去就过去了。", { type: "nothing" })], {
        isDefault: true,
      }),
    ],
    { minRealm: 9, maxRealm: MAX_MAJOR },
  ),
  ev(
    "ev_luotian_xingchao",
    "罗天星潮",
    "星海涨潮了。无数光点从低处涌上来，一层一层，无声地漫过你的脚踝。",
    ["sky", "immortal"],
    [
      c("迎潮而立", [
        o(40, "光点穿过身体，没有重量，却把它们经过的每一处都点亮了。", {
          type: "exp",
          secs: 118,
        }),
        o(35, "潮水漫过肩头，你在其中站不住，退了出来。", { type: "nothing" }),
        o(25, "潮里有东西是硬的。你被撞得退了半步，站定后发现它在手里。", {
          type: "equipment",
          minQualityRank: 5,
        }),
      ]),
      c("退到高处看", [
        o(60, "整片星海在你脚下涨落。你看懂了一点它的节律。", {
          type: "material",
          id: "wudao",
          amount: 24,
        }),
        o(40, "太高了，看不清。只听见风。", { type: "nothing" }),
      ]),
    ],
    { minRealm: 13, maxRealm: MAX_MAJOR },
  ),
  ev(
    "ev_hongmeng_zhiyin",
    "鸿蒙之音",
    "什么都没有的地方，却一直有一个声音。它不像从哪里传来，更像本来就一直在。",
    ["sky", "chaos"],
    [
      c("静听", [
        o(40, "听到深处，那个声音不再是声音。你说不清那是什么。", {
          type: "material",
          id: "wudao",
          amount: 28,
        }),
        o(35, "听着听着就忘了时间。醒来时不知过了多久。", { type: "exp", secs: 120 }),
        o(25, "声音太满。你抱着头蹲下去，很久才起身。", { type: "buff", id: "injury" }),
      ]),
      c("开口应它", [
        o(45, "你只应了一声。那声音停了。之后很久，什么都听不见。", {
          type: "nothing",
        }),
        o(55, "应了之后，声音里多了一线回音 —— 那是你自己的。", {
          type: "material",
          id: "wudao",
          amount: 18,
        }),
      ]),
    ],
    { minRealm: 20, maxRealm: MAX_MAJOR },
  ),
  /*
   * 界外六则（第 485 轮）。
   *
   * 按「每处地界摊到几则」重排，最薄的三处全在界外:
   *
   * ```text
   *   sky       12 则 / 10 处 = 1.2
   *   god       10 则 /  8 处 = 1.3
   *   immortal  14 则 / 10 处 = 1.4
   * ```
   *
   * 这一轮补 god 与 immortal（sky 留待下一轮 —— 它跨三个界域，症状不同）。
   *
   * **一律不带 `general`**:界外内容混进通用池会一路漏到人间界,那与
   * 「界外另有界外的池子」这条纪律正相反。
   */
  ev(
    "ev_shenji_luori",
    "神迹落日",
    "落日停在半空,已经很多年了。据说那一日有神在此驻留,光便再没落下去。",
    ["god", "sky"],
    [
      c("攀上光柱", [
        o(40, "光柱里有极细的经文在流转。你伸手,它们绕上指节就散了。", {
          type: "material",
          id: "wudao",
          amount: 26,
        }),
        o(35, "爬到一半你就明白了:那不是光,是极慢的燃烧。", { type: "exp", secs: 110 }),
        o(25, "光柱烫得不像光。你在半空松了手。", { type: "buff", id: "injury" }),
      ]),
      c("在光下打坐", [
        o(55, "这一坐不知多久。睁眼时落日开始动了,极慢。", { type: "exp", secs: 115 }),
        o(45, "什么也没坐出来。光在头顶,不动。", { type: "nothing" }),
      ]),
    ],
    { minRealm: 9, maxRealm: MAX_MAJOR },
  ),
  ev(
    "ev_tiangong_yiwang",
    "天宫遗网",
    "空中的宫殿只剩骨架,檐角垂着一张网,网眼里结着已经僵住的光。",
    ["god", "sky"],
    [
      c("收网", [
        o(45, "网一收,那些光碎成粉末。你捧了满手。", {
          type: "material",
          id: "dust",
          amount: 15,
        }),
        o(55, "网线一碰就断。断口处幽幽发光,慢慢暗下去。", { type: "nothing" }),
      ]),
      c("顺网而上", [
        o(40, "网的尽头系着一间小殿,殿里没人,案上有一件旧物。", {
          type: "equipment",
          minQualityRank: 6,
        }),
        o(60, "爬到一半,整张网散了。你落了很久才落地。", { type: "buff", id: "injury" }),
      ]),
    ],
    { minRealm: 11, maxRealm: MAX_MAJOR },
  ),
  ev(
    "ev_shenge_jiumeng",
    "神阁旧盟",
    "阁楼里悬着一卷盟书,墨迹已淡。落款处有很多印,最末一处空着。",
    ["god"],
    [
      c("捺下自己的印", [
        o(40, "墨迹落纸的瞬间,你听见远处有谁在应。", { type: "material", id: "wudao", amount: 30 }),
        o(60, "印捺上去,什么也没发生。你已经不是第一次了。", { type: "nothing" }),
      ]),
      c("读完盟书", [
        o(50, "你记住了那上面的每一条。往后会用得上。", { type: "exp", secs: 118 }),
        o(50, "字迹太淡。读到一半,后面全糊了。", { type: "nothing" }),
      ]),
    ],
    { minRealm: 13, maxRealm: MAX_MAJOR },
  ),
  ev(
    "ev_xianmen_shouye",
    "仙门守夜",
    "山门无人,灯却亮着。守夜的人本该在，也可能就是我。",
    ["immortal", "mountain"],
    [
      c("替他守这一夜", [
        o(50, "夜里来了三拨客。你都拦下了。天亮时灯自己灭了。", { type: "exp", secs: 100 }),
        o(30, "什么都没有来。你在门口坐了一夜,想通了一点东西。", {
          type: "material",
          id: "wudao",
          amount: 18,
        }),
        o(20, "第三拨不是人。你打退了它,肩膀脱了力。", { type: "buff", id: "injury" }),
      ]),
      c("吹灯离去", [
        o(60, "灯灭了。山下的人该能睡个好觉。", { type: "nothing" }),
        o(40, "灯吹不灭。你回头看,那一豆光在夜里很稳。", { type: "exp", secs: 95 }),
      ]),
    ],
    { minRealm: 9, maxRealm: MAX_MAJOR },
  ),
  ev(
    "ev_yunhai_canzhao",
    "云海残照",
    "云海的边缘泛着旧金。那不是什么祥瑞,只是上一场落日照下来的余温。",
    ["immortal", "sky"],
    [
      c("走入余温", [
        o(45, "云里暖得不像话。你在其中站了很久,身上那点寒气全散了。", {
          type: "exp",
          secs: 112,
        }),
        o(55, "云太薄。你走了几步就踩空,好在只是惊了一场。", { type: "nothing" }),
      ]),
      c("背对余温", [
        o(50, "不回头看的人,走得更远些。", { type: "material", id: "wudao", amount: 20 }),
        o(50, "你还是回头了。金光散了,云也散了。", { type: "nothing" }),
      ]),
    ],
    { minRealm: 10, maxRealm: MAX_MAJOR },
  ),
  ev(
    "ev_jinyu_wupai",
    "金阙玉牌",
    "金阙前插着一排玉牌,每一枚都刻着一个名字。空位还剩三处。",
    ["immortal"],
    [
      c("取一枚空白玉牌", [
        o(40, "玉牌入袖,你听见金阙深处传来一声很轻的响。", {
          type: "equipment",
          minQualityRank: 5,
        }),
        o(60, "玉牌取不下来。你使出全力,它也纹丝不动。", { type: "buff", id: "injury" }),
      ]),
      c("看牌上的名字", [
        o(60, "里面有几个你认得。有些是几百年前的,有些是最近才刻的。", {
          type: "exp",
          secs: 108,
        }),
        o(40, "牌子太密。你看了很久,只记住两三个陌生的名字。", { type: "nothing" }),
      ]),
    ],
    { minRealm: 12, maxRealm: MAX_MAJOR },
  ),
  ev(
    "ev_shenyu_zhen",
    "神域奇珍",
    "神域边陲的乱石滩上,一枚法则碎片半埋沙中,微光吞吐不定。",
    ["general", "god"],
    [
      c(
        "纳碎片入体",
        [
          o(55, "碎片化入经脉,你对法则的认知更深一层。", {
            type: "material",
            id: "wudao",
            amount: 40,
          }),
          o(45, "碎片竟是一头麒麟的内丹所化,神兽残魂认你为主。", { type: "pet", id: "pet_qilin" }),
        ],
        { isDefault: true },
      ),
      c("收归宗门", [
        o(1, "你以重器封存碎片,带回宗门换得灵石。", { type: "stone", tierAmount: 220 }),
      ]),
    ],
    { minRealm: 14 },
  ),
  ev(
    "ev_baize_duanbei",
    "断碑白泽",
    "混沌之滨的断碑旁卧着一头白泽。它睁眼看你,碑上残字竟自行浮起,一笔一笔拼出你的名字。",
    /*
     * 白泽是**神品**,而神品一律不收进 god 带(见本段上方的境界带纪律)。
     * 它此前挂在 minRealm 15 / god 上,是规则收紧后没被回头清理的一处 ——
     * 神界就能开出神品,「混沌海才有的东西」这层稀缺就没了。
     * 预算上它本就是最低的神品(1.64,比最高的仙品还低),挪到混沌海不改变任何曲线。
     * 判据见 core/petWorldBand.spec。
     */
    ["general", "chaos"],
    [
      c(
        "听其言",
        [
          o(55, "白泽把碑上残篇念了一遍,你于道途上少走了十年弯路。", {
            type: "pet",
            id: "pet_baize",
          }),
          o(45, "残篇太长,你只听懂三成,神思却已清明许多。", {
            type: "material",
            id: "wudao",
            amount: 45,
          }),
        ],
        { isDefault: true },
      ),
      c("躬身不问", [o(1, "你拱手一礼,不去惊扰它读碑。", { type: "exp", secs: 30 })]),
    ],
    { minRealm: 18 },
  ),
  ev(
    "ev_shenbing_canfeng",
    "神兵残锋",
    "一柄折断的神兵插在巨岩之中,断口处仍有神威流转,震得周身气血翻腾。",
    ["general", "god"],
    [
      c(
        "硬撼拔之",
        [
          o(60, "神兵被你拔起,一件材宝随之而出。", { type: "equipment", minQualityRank: 6 }),
          o(
            40,
            "神威反噬,你被震退,只截下一段锋铁。",
            { type: "material", id: "ore", amount: 60 },
            { type: "buff", id: "injury" },
          ),
        ],
        { isDefault: true },
      ),
      c("绕行", [o(1, "你记下此处方位,转身离去。")]),
    ],
    { minRealm: 15 },
  ),
  ev(
    "ev_kunpeng_hua",
    "北冥化鹏",
    "混沌之滨,一头巨鲲正于虚无之海中蜕变。它望向你,眼中似有询问。",
    ["general", "chaos"],
    [
      c(
        "助其化鹏",
        [
          o(60, "鲲鹏化形既成,振翅冲天,而后折返,愿随你同行。", { type: "pet", id: "pet_kunpeng" }),
          o(40, "化形之劫余波扫过,你护住己身,却也见识了大道一角。", { type: "exp", secs: 60 }),
        ],
        { isDefault: true },
      ),
      c("静观天道", [o(1, "观鲲鹏化形,若有所悟。", { type: "material", id: "wudao", amount: 30 })]),
    ],
    { minRealm: 18 },
  ),
  ev(
    "ev_taotie_xiong",
    "混沌凶兽",
    "虚无凶影之后,一头饕餮踏混沌而来,张口便要吞噬你周身气机。",
    ["general", "chaos", "dark"],
    [
      c(
        "以力降之",
        [
          o(55, "一番恶战,饕餮竟俯首,摄于你的威势。", { type: "pet", id: "pet_taotie" }),
          o(45, "饕餮之威远超预估,你负伤遁走。", { type: "buff", id: "injury" }),
        ],
        { isDefault: true },
      ),
      c("避其锋芒", [o(1, "你收敛气机,悄然绕开。")]),
    ],
    { minRealm: 19 },
  ),
  ev(
    "ev_hongmeng_benyuan",
    "鸿蒙本源",
    "万道之源静悬于此。伸手可及的,是开天辟地的第一缕本源。",
    ["general", "chaos", "sky"],
    [
      c(
        "纳本源入道",
        [
          o(50, "本源入体,你窥见大道真容。", { type: "material", id: "wudao", amount: 80 }),
          o(30, "本源太过浩瀚,你只摄得一缕,却也修为大涨。", { type: "exp", secs: 90 }),
          o(20, "本源反噬,你道基震荡。", { type: "buff", id: "injury" }),
        ],
        { isDefault: true },
      ),
      c(
        "凝本源为一丹",
        [
          o(
            1,
            "你以本源凝成一枚丹药,收于袖中。",
            { type: "stone", tierAmount: -300 },
            { type: "pill", id: "p_daoyuan", count: 1 },
          ),
        ],
        { cond: { type: "stone", tierAmount: 300 } },
      ),
    ],
    { minRealm: 20, weight: 60 },
  ),
  ev(
    "ev_ancient_battle",
    "古战场回声",
    "残月如钩,一处古战场的虚影在你眼前缓缓重现,喊杀声穿林而来。",
    ["general"],
    [
      c(
        "踏入战阵",
        [
          o(55, "你拾起一柄残兵,依稀还残留着昔日的锋锐。", {
            type: "equipment",
            minQualityRank: 2,
          }),
          o(30, "你在阵中捕到一缕亡者残存的悟道,受益匪浅。", { type: "exp", secs: 60 }),
          o(15, "战魂乍然围攻,你且战且退,受了些轻伤。", { type: "buff", id: "injury" }),
        ],
        { isDefault: true },
      ),
      c("绕道而行", [o(1, "你避开这片煞气冲天的所在。")]),
    ],
    { maxRealm: 6 },
  ),
  ev(
    "ev_storm_bridge",
    "暴雨石桥",
    "骤雨倾盆,一座石桥被水半淹,桥下浊浪翻涌,几根桥板已朽。",
    ["general"],
    [
      c(
        "涉水而过",
        [
          o(60, "你扶住桥栏稳稳渡过,对岸空无一人。", { type: "exp", secs: 30 }),
          o(40, "桥板朽烂,你一脚踏空,呛了几口浊水。", { type: "buff", id: "injury" }),
        ],
        { isDefault: true },
      ),
      c("绕路而行", [o(1, "你顺河岸绕行,虽费时却也安稳。")]),
    ],
    { maxRealm: 2 },
  ),
  ev(
    "ev_cliff_herb",
    "峭壁灵草",
    "一处峭壁石缝中闪着微光,似有一株难得的灵草在风中摇曳。",
    ["general"],
    [
      c(
        "攀壁去采",
        [
          o(55, "你身手矫健,攀上峭壁采得灵草。", { type: "material", id: "herb", amount: 8 }),
          o(30, "石壁湿滑,你只抓到几片叶,却也聊胜于无。", {
            type: "material",
            id: "herb",
            amount: 3,
          }),
          o(15, "手一滑,你摔落山涧,蹭破了些皮。", { type: "buff", id: "injury" }),
        ],
        { isDefault: true },
      ),
      c("转身离开", [o(1, "终究是身外之物,你摇摇头走开。")]),
    ],
    { maxRealm: 4 },
  ),
  ev(
    "ev_river_sacrifice",
    "河神祭",
    "河畔香火缭绕,乡民正朝河中投下祭品,求个风调雨顺。",
    ["general"],
    [
      c(
        "驻足观看",
        [
          o(60, "你嗅到水底隐有灵物,便顺水捞起一件旧祭品。", {
            type: "material",
            id: "herb",
            amount: 6,
          }),
          o(40, "浪头一涌,你只合了个空。", { type: "nothing" }),
        ],
        { isDefault: true },
      ),
      c("转身离开", [o(1, "凡间香火,你无意沾惹。")]),
    ],
    { maxRealm: 5 },
  ),
  ev(
    "ev_dengta",
    "古塔夜话",
    "一座无人古塔夜半亮起孤灯,隐约有人影临窗而坐。",
    ["general"],
    [
      c(
        "登塔一叙",
        [
          o(55, "灯下是一位老翁,与你谈经论道,受益良多。", { type: "exp", secs: 70 }),
          o(30, "塔中无人,只余一灯一几,你静坐片刻,心有所悟。", {
            type: "material",
            id: "wudao",
            amount: 20,
          }),
          o(15, "忽有阴风穿堂,你惊觉此塔非善地,疾退而下。", { type: "buff", id: "injury" }),
        ],
        { isDefault: true },
      ),
      c("转身离开", [o(1, "深夜孤塔,你不想多惹是非。")]),
    ],
    { maxRealm: 8 },
  ),
  // ============ 仙品灵兽发放(神界:minRealm 14-17,标签 god)============
  /**
   * 仙界及以上 13 只灵兽的发放事件 —— 每一只都**点名**给。
   *
   * 起因:eventEngine 的随机池硬性排除 immortal / divine(见其 pet 分支),
   * 于是这两档的每一只都必须有事件亲口点名,漏一只就是图鉴里一个永锁的格子。
   * 从前的可达性判据只硬编码了四只,玄冥玄武因此一直没有发放路径而无人察觉。
   *
   * 两种合法形态(判据:`!ev.once || ch.outcomes.length === 1`):
   *   A. once 事件 + 该选项唯一结局(必得,且整局只此一次)
   *   B. 可重复事件(但同一只灵兽只会入账一次,引擎侧 owned 已挡)
   * 本批 r7 全走 B、r8 全走 A:仙品是「神界常客」,神品是「一辈子一次的相遇」。
   *
   * 境界带纪律:r7 收在 14-17(god),r8 收在 18-20(chaos)。
   * 神品**一律不收进 god 带** —— 否则神界就能开出 0.76 预算的镇岳尊。
   */
  ev(
    "ev_zijinpi_ku",
    "只进不出",
    "神域边陲的废库中,一头貔伏在空箱堆上。箱箱皆空,它的腹却圆得反常。",
    ["general", "god"],
    [
      c(
        "以灵石换它一诺",
        [
          o(
            1,
            "你倾出一囊灵石,它一口吞尽,随即伏在你脚边 —— 往后你赚的,它替你守着。",
            { type: "stone", tierAmount: -40 },
            { type: "pet", id: "pet_zijinpi" },
          ),
        ],
        { hint: "需要灵石", cond: { type: "stone", tierAmount: 40 } },
      ),
      c("撬开它的腹囊", [
        o(65, "腹囊应声而开,金气扑面 —— 它却在你伸手时穿墙遁走了。", {
          type: "stone",
          tierAmount: 60,
        }),
        o(35, "腹囊是活的,一口咬住你的手,你带伤退开。", { type: "buff", id: "injury" }),
      ]),
      leave("你看了看那一地空箱,转身走了。貔也不抬头。"),
    ],
    { minRealm: 14, maxRealm: 17, weight: 80 },
  ),
  ev(
    "ev_moyanya_bi",
    "判生死一笔",
    "陨神战场的骨堆上立着一只墨羽鸦,低头在一具神骸的额上画着什么。它抬眼,笔锋转向你。",
    ["general", "god", "dark"],
    [
      c(
        "与它论这一笔",
        [
          o(1, "你把自己的名字递上去。鸦落笔,写下的却是「未」—— 死期未定。此后它随你而行。", {
            type: "pet",
            id: "pet_moyanya",
          }),
        ],
        { hint: "它要的不是命,是一个还没写完的名字", isDefault: true },
      ),
      c("先夺其笔", [
        o(60, "一番恶斗,你将那支墨羽从它爪中打落 —— 鸦盘旋三匝,竟落下肩头。", {
          type: "pet",
          id: "pet_moyanya",
        }),
        o(40, "笔锋划过,你只觉生机被划去一线。", { type: "buff", id: "injury" }),
      ]),
      leave("你不去争那一笔。鸦收回目光,继续在那具神骸上写下去。"),
    ],
    { minRealm: 15, maxRealm: 17, weight: 80 },
  ),
  ev(
    "ev_mingshuijiao_deng",
    "冥灯渡夜",
    "夜里的冥水之上漂着一盏灯,灯后一条蛟缓缓随行。它在渡什么,谁也说不清。",
    ["general", "god", "water"],
    [
      c(
        "下水替它扶灯",
        [
          o(1, "灯焰一稳,长夜骤然退去三千里。蛟衔灯回望,从此为你照路。", {
            type: "pet",
            id: "pet_mingshuijiao",
          }),
        ],
        { isDefault: true },
      ),
      c("守在岸上,只看不动", [
        o(1, "你守到灯灭,长夜未散,却把「渡」字想透了一层。", {
          type: "material",
          id: "wudao",
          amount: 60,
        }),
      ]),
    ],
    { minRealm: 14, maxRealm: 16, weight: 80 },
  ),
  ev(
    "ev_yuepoju_wang",
    "月下旧网",
    "神域边陲的月轮低了三分,一张蛛网横在林间 —— 网丝上没有虫,只挂着许多旧梦的碎影。",
    ["general", "god"],
    [
      c(
        "入网取回自己的梦",
        [
          o(1, "你在网里认出自己的一段旧梦。取回它时,网的主人自月光里垂了下来。", {
            type: "pet",
            id: "pet_yuepoju",
          }),
        ],
        { isDefault: true },
      ),
      c("焚网", [
        o(70, "网一烧即散,月魄如雨落了一身,你于道途更明一分。", {
          type: "material",
          id: "wudao",
          amount: 70,
        }),
        o(30, "火光里窜出无数旧影,缠得你心神不宁。", { type: "buff", id: "curse_xinmo" }),
      ]),
      leave("你不去碰别人的梦。蛛在月光里一动不动,像也没看见你。"),
    ],
    { minRealm: 15, maxRealm: 17, weight: 80 },
  ),
  ev(
    "ev_guyuexi_bu",
    "一步一声钟",
    "有东西自远山走来,一步一顿。走近才看清:是一头犀,背上驮着半截断碑,碑上无字。",
    ["general", "god", "mountain"],
    [
      c(
        "替它扶正背上的碑",
        [
          o(1, "碑扶正的一刻,四下齐鸣如钟。犀低头,把这半截古碑连同自己一并交给了你。", {
            type: "pet",
            id: "pet_guyuexi",
          }),
        ],
        { hint: "需修为足够才托得住那半截碑", cond: { type: "realm", min: 16 }, isDefault: true },
      ),
      c("随它走一程", [
        o(1, "你随它走到山脚。它站住不动了 —— 路到头了,你也到了。", {
          type: "material",
          id: "wudao",
          amount: 55,
        }),
      ]),
      leave("你让开道。它一步一顿地过去,钟声在身后响了很多年。"),
    ],
    { minRealm: 16, maxRealm: 17, weight: 80 },
  ),

  /*
   * 神域七处(神域边陲 / 神迹荒原 / 神兵天关 / 神王圣殿 / 万神殿堂 / 神帝天宫 / 帝阙天阶)
   * 只带 `god` 一个附加标签,而纯 god 的事件此前只有 7 条 —— 玩家在神域从境界 14 走到 17,
   * 一直在这 7 条里打转。带 `dark` 的陨神战场另有兜底,那七处没有。
   *
   * 补三条,让纯 god 的池从 7 条变 10 条。境界带按神域最低门槛 14 起、收在 17
   * (再往上就进混沌海了)。**神品灵兽一律不进 god 带** —— 见上方白泽那条注释,
   * 「混沌海才有的东西」这层稀缺不能提前漏出来。
   */
  ev(
    "ev_shenji_henji",
    "荒原神迹",
    "荒原上散落着一道巨大的手印,五指张开扣进地里,掌心的土至今还是温的。",
    ["general", "god"],
    [
      c("按掌印对坐", [
        o(60, "你把手按进那道掌印里,一时竟分不清是自己的手还是它的。", {
          type: "exp",
          secs: 70,
        }),
        o(
          25,
          "掌印里的余威顺着手臂冲上来,你倒退数步,指节发麻。",
          { type: "buff", id: "injury" },
          { type: "material", id: "wudao", amount: 45 },
        ),
        o(15, "土早已凉透。你在掌印里坐了半天,什么也没等到。", { type: "nothing" }),
      ]),
      c(
        "量它的深浅",
        [
          o(1, "你绕着掌印走了三圈。有些东西只要看过,往后就有了尺度。", {
            type: "material",
            id: "wudao",
            amount: 40,
          }),
        ],
        { isDefault: true },
      ),
    ],
    { minRealm: 14, maxRealm: 17 },
  ),
  ev(
    "ev_shenguang_yin",
    "圣殿余音",
    "圣殿里没有神官,只有一段诵念停在半空 —— 念到一半,声音断了,也没再续上。",
    ["general", "god"],
    [
      c("接上那段诵念", [
        o(55, "你顺着断处往下念。念到第三句时,声音自己接了上来,把你带到了尽头。", {
          type: "exp",
          secs: 75,
        }),
        o(30, "你的法则与它对不上,声音在你口中碎成一串无意义的音节。", { type: "nothing" }),
        o(15, "断处之后是无尽的空 —— 你念着念着,忽然听不见自己的声音了。", {
          type: "buff",
          id: "curse_xinmo",
        }),
      ]),
      c(
        "听它断在那里",
        [
          o(1, "断得正好。你忽然明白,有些话不该由旁人来接。", {
            type: "material",
            id: "wudao",
            amount: 50,
          }),
        ],
        { isDefault: true },
      ),
    ],
    { minRealm: 15, maxRealm: 17 },
  ),
  ev(
    "ev_wanshen_xiang",
    "万神残像",
    "天堂里一万尊神像,每一尊的脸都不见了。断口平整,像是同一时刻被削去的。",
    ["general", "god"],
    [
      c("找那尊属于自己的", [
        o(50, "你走到第九千余尊时停住 —— 那尊的断口是新的,还有石粉在往下掉。", {
          type: "exp",
          secs: 75,
        }),
        o(35, "一万尊走完,你谁也没认出来。倒是把自己这些年的路重新走了一遍。", {
          type: "material",
          id: "wudao",
          amount: 55,
        }),
        o(15, "某一尊像忽然转向了你 —— 它的脸被人从背面削去了。", {
          type: "buff",
          id: "curse_xinmo",
        }),
      ]),
      c(
        "不找",
        [
          o(1, "一万张空白的脸同时朝着堂中。你退了出去,觉得胸口轻了些。", {
            type: "exp",
            secs: 60,
          }),
        ],
        { isDefault: true },
      ),
    ],
    { minRealm: 16, maxRealm: 17 },
  ),

  // ============ 神品灵兽发放(混沌海:minRealm 18-20,标签 chaos)============
  ev(
    "ev_xuanwu_fuming",
    "玄冥负甲",
    "幽滩真灵浮沉,忽有一物自渊底升起:玄龟负甲,甲上有纹,纹如万法自溃。",
    ["general", "chaos", "water"],
    [
      c(
        "以己道替它一甲",
        [
          o(
            1,
            "你剖出一段修为刻上甲纹。玄武收下,沉入渊底;再浮起时,甲纹已成,它驮着你的道与你同行。",
            { type: "pet", id: "pet_xuanwu" },
          ),
        ],
        { isDefault: true },
      ),
      c("只观其甲", [
        o(1, "你看了莫大的甲纹一整夜。甲不动,你懂了「不动」两个字。", {
          type: "material",
          id: "wudao",
          amount: 120,
        }),
      ]),
    ],
    { minRealm: 18, maxRealm: 19, once: true, weight: 70 },
  ),
  ev(
    "ev_zhulong_zhengji",
    "一睁一闭",
    "天地无端一暗。无昼夜之分,无四时之序 —— 有东西在极远处睁了眼。",
    ["general", "chaos", "sky"],
    [
      c(
        "迎那双眼睛走进去",
        [
          o(1, "你立于它的瞳中。一睁,万界皆白;一闭,万界皆黑。它认得你了。", {
            type: "pet",
            id: "pet_zhulong",
          }),
        ],
        { hint: "先把满身修为押上去", cond: { type: "realm", min: 19 }, isDefault: true },
      ),
      leave("你退回亮处。天光重开,你已不知方才暗了多久。"),
    ],
    { minRealm: 19, maxRealm: 20, once: true, weight: 70 },
  ),
  ev(
    "ev_jinwu_jiuri",
    "九日栖枝",
    "混沌之滨长出过一株枯木,枝上栖着九日。走近时九日同鸣,一界皆明。",
    ["general", "chaos", "fire"],
    [
      c("入火受灼", [
        o(
          1,
          "九日之气贯体,灼得你几乎散去形骸;而目光越过九日,那鸟认了你 —— 它敛去八日,只留一日栖在肩上,从此你行处无暗。",
          { type: "buff", id: "injury" },
          { type: "pet", id: "pet_jinwu" },
        ),
      ]),
      c("屏息远避", [
        o(1, "你退至枯木之外,遥望一界通明,竟也悟出一分暖意。", {
          type: "material",
          id: "wudao",
          amount: 120,
        }),
      ]),
      leave("九日仍鸣。你没敢靠近。"),
    ],
    { minRealm: 18, maxRealm: 20, once: true, weight: 70 },
  ),
  ev(
    "ev_haiwujing_cheng",
    "背上生城",
    "海上起了大雾。雾散时,一座城浮在水面 —— 城下有鳍。",
    ["general", "chaos", "water"],
    [
      c(
        "登城走一遍",
        [
          o(1, "城中无一人,街巷却齐整如新。你走完最后一条街,城塌回鲸背;海蜃鲸浮起,载你入混沌。", {
            type: "pet",
            id: "pet_haiwujing",
          }),
        ],
        { isDefault: true },
      ),
      c("在城外看它散去", [
        o(1, "城散时,你数清了它有多少条街。这份眼力,后来救过你数次。", {
          type: "material",
          id: "wudao",
          amount: 100,
        }),
      ]),
    ],
    { minRealm: 18, maxRealm: 20, once: true, weight: 70 },
  ),
  ev(
    "ev_qilinbi_busha",
    "蹄下生灵",
    "草叶倒伏而不折,一条笔直的旧路自混沌里伸出来。路的那头,有什么踩着草尖过来,一株芝生在它蹄窝里。",
    ["general", "chaos"],
    [
      c(
        "退到路边,把道让开",
        [
          o(1, "你退开半步。它自你面前走过,蹄不曾落向你 —— 走过后转身,与你并行。", {
            type: "pet",
            id: "pet_qilinbi",
          }),
        ],
        { hint: "它只踩不伤人和虫,也只看不争不让的路", isDefault: true },
      ),
      c("抢先踏平这条道", [
        o(1, "你踏平了那条旧路,只为换它回头一顾 —— 换到了,也踏碎了沿路的一窝灵虫。", {
          type: "stone",
          tierAmount: 120,
        }),
      ]),
      leave("你不动,它也不停。擦身时你闻见芝香,然后它就远了。"),
    ],
    { minRealm: 18, maxRealm: 19, once: true, weight: 70 },
  ),
  ev(
    "ev_wangchuan_wang",
    "忘了在修行",
    "川上无舟。水里有东西浮起来照了你一眼 —— 那一眼之后,你想不起自己为何要修这一世。",
    ["general", "chaos", "dark"],
    [
      c(
        "把名字刻回自己身上",
        [
          o(
            1,
            "你以指尖在腕上刻下自己的名字。再看它时,它已立在岸上等你。忘川渡不了记得自己的人。",
            {
              type: "pet",
              id: "pet_wangchuan",
            },
          ),
        ],
        { hint: "需修为足够深才刻得下这三个字", cond: { type: "realm", min: 19 }, isDefault: true },
      ),
      c("任它忘了这一段", [
        o(1, "你由着那一世沉进水里,竟觉前所未有的轻 —— 空出来的地方,被道填满了。", {
          type: "exp",
          secs: 120,
        }),
        o(1, "名字一忘,连修为也忘了。你站在川边很久,才想起要呼吸。", {
          type: "material",
          id: "wudao",
          amount: 60,
        }),
      ]),
      leave("你低下头,不去看水里的倒影。它便也沉了回去。"),
    ],
    { minRealm: 19, maxRealm: 20, once: true, weight: 70 },
  ),
  ev(
    "ev_zaohualu_tou",
    "投之以废铁",
    "神魔渊底立着一座炉,炉门无火。炉前堆着无数断兵、碎甲、无用的道果 —— 炉里传出敲打声。",
    ["general", "chaos"],
    [
      c(
        "投废铁入炉",
        [
          o(1, "炉口一开,断兵碎甲尽数飞入,炉身轻颤,像识了主人 —— 你只需想炼什么,不必再问火。", {
            type: "pet",
            id: "pet_zaohualu",
          }),
        ],
        {
          hint: "它吃的是法宝:投三件,换一座能自己开火的炉",
          cond: { type: "stone", tierAmount: 200 },
        },
      ),
      c("在炉前问一句", [
        o(1, "炉里传来一声闷响,像是应了你什么,又像什么都没说。", {
          type: "material",
          id: "wudao",
          amount: 110,
        }),
      ]),
      leave("你绕开那座炉。走出很远,敲打声仍跟着你。"),
    ],
    { minRealm: 18, maxRealm: 20, once: true, weight: 70 },
  ),
  ev(
    "ev_zhenyuezun_budong",
    "山不移,它不移",
    "前路的山被人搬空了。只剩一股势还立在那里,势中有一尊东西,一步也没有挪。",
    ["general", "chaos", "mountain"],
    [
      c(
        "与它同时站定",
        [
          o(1, "你站着不动,它也站着不动。站到第十七日,山移之势散去;它收了势,认你为镇。", {
            type: "pet",
            id: "pet_zhenyuezun",
          }),
        ],
        { isDefault: true },
      ),
      c("偏要过这一关", [
        o(1, "你顶着那股势过了山。它不动,你也过去了 —— 从此你知道了什么能推、什么不该推。", {
          type: "material",
          id: "wudao",
          amount: 90,
        }),
      ]),
      leave("你选了下山路。势在你身后一寸一寸落回山里。"),
    ],
    { minRealm: 19, maxRealm: 20, once: true, weight: 70 },
  ),
];

/**
 * 机缘事件(Phase 31.0 S2)——— 极低概率、带代价选择、影响构筑方向
 * 与普通事件池分离:触发概率低,遇后必须面临"取 / 弃"的决策
 *
 * Phase 32.2:部分机缘带元素倾向,同源灵根更容易撞见。
 * 刻意留下无元素的中性机缘(妖兽认主 / 隐世高人)——
 * 若条条机缘都认灵根,灵根就从"倾向"变成了"分配职业"。
 *
 * 境界带:机缘按**界域**分池,各池写给各自那一界的人。
 * 前五条(剑痕/丹方/幼兽/高人/秘术)是人间界的机缘,收在 8(渡劫)以内 ——
 * 它们从前只认区域标签,而界外区域同样带 'general',于是道祖也会撞见
 * 「幼兽认主」「失传丹方」这类凡界尺度的事;界外三条界域各有自己的两条机缘
 * (仙门古琴/云端仙尊 · 神域王座/法则之心 · 混沌之种/鸿蒙先台),
 * 由 minRealm 或界域标签守住,故两头都不漏。
 */
export const FORTUNE_EVENTS: EventDef[] = [
  ev(
    "ft_sword_remnant",
    "上古剑痕",
    "荒山石壁上留着三道剑痕,每一道都深可没指,剑气未散。",
    ["general", "ruin"],
    [
      c("参悟剑痕", [
        o(65, "剑意入怀,你只觉得剑之一道豁然开朗。", { type: "gongfa", id: "s_lianxi" }),
        o(
          20,
          "剑气反噬,你吐出一口血,却记下了几分剑理。",
          { type: "buff", id: "injury" },
          { type: "material", id: "page", amount: 2 },
        ),
        o(15, "剑痕只是一道残影,你看罢两手空空。", { type: "nothing" }),
      ]),
      c("绕道而行", [o(1, "剑气凛冽,你压下好奇,转身离去。")], { isDefault: true }),
    ],
    { element: "metal", maxRealm: MORTAL_END },
  ),
  /*
   * 寒潭 / 赤炎 / 雷泽:三条机缘补上水域、火域与雷域的专属遭遇。
   *
   * 机缘池按标签 `some` 匹配(见 `packages/engine/src/deck.ts` 的 `entryAllowed`),
   * 而 `general` 是每个地域都有的标签 —— 于是带 `general` 的 6 条机缘处处可得,
   * 真正「只此一地」的要看非 general 标签。实测 44 个地域里,
   * 寒潭幽窟 / 赤炎火域 / 蜃楼幻海 / 雷泽 / 星陨荒原 / 天外天 / 鸿蒙裂隙
   * 这 7 处一条专属都没有 —— 而它们分属 water / fire / thunder / sky 四个标签,
   * 那四个标签在机缘池里根本没有条目。
   *
   * 机缘是 2% 概率的稀有内容,故不必每个地域都配;这里只补玩家停留最久的中前期三处。
   */
  ev(
    "ft_hantan_bingxin",
    "寒潭冰心",
    "潭水深处有一枚拳头大的冰晶,通体澄澈,细看能见到里面封着一缕极淡的白气在缓缓流转。",
    ["general", "water"],
    [
      c("取冰晶入怀", [
        o(55, "冰晶贴胸即化,一缕清寒顺着经脉走了一周天 —— 你忽觉心念从未如此澄明。", {
          type: "exp",
          secs: 70,
        }),
        o(
          25,
          "寒气太重,你半边身子僵了许久才缓过来。",
          { type: "buff", id: "injury" },
          { type: "material", id: "dust", amount: 9 },
        ),
        o(20, "冰晶在你掌心里碎成一捧凉水,什么都没留下。", { type: "nothing" }),
      ]),
      c(
        "静坐潭边",
        [
          o(1, "你听着潭水滴落的声音坐到日暮,神识反倒清了几分。", {
            type: "exp",
            secs: 60,
          }),
        ],
        { isDefault: true },
      ),
    ],
    { element: "water", minRealm: 1, maxRealm: MORTAL_END },
  ),
  ev(
    "ft_chiyan_huoling",
    "火域遗火",
    "赤炎火域的裂谷里,一簇火苗悬在半空烧了不知多少年 —— 没有柴,也没有风。",
    ["general", "fire"],
    [
      c("以神魂引火", [
        o(60, "火苗顺从地缠上你的指尖,烧尽了经脉里的杂质。", { type: "exp", secs: 65 }),
        o(25, "火苗忽然暴涨,你急退三步,衣袖已烧去半幅。", { type: "buff", id: "injury" }),
        o(15, "火苗只是幻影,你伸手过去,什么都没摸到。", { type: "nothing" }),
      ]),
      c(
        "绕开此火",
        [o(1, "你远远绕行,总觉得那火在看着你。", { type: "material", id: "ore", amount: 12 })],
        { isDefault: true },
      ),
    ],
    { element: "fire", minRealm: 2, maxRealm: MORTAL_END },
  ),
  ev(
    "ft_leize_leizhu",
    "雷泽雷竹",
    "雷泽深处一株雷竹通体银白,竹节间有细小的电光游走。传闻以雷竹为引,可淬炼神魂。",
    ["general", "thunder"],
    [
      c("折竹淬神", [
        o(55, "雷竹炸开一团电弧涌入眉心,你的神魂在剧痛中清了三分。", { type: "exp", secs: 70 }),
        o(
          30,
          "电弧太盛,你被震得倒退,却也收下了几节竹身。",
          { type: "material", id: "ore", amount: 26 },
          { type: "buff", id: "injury" },
        ),
        o(15, "雷竹宁折不弯 —— 在你出手的刹那自毁成灰。", { type: "nothing" }),
      ]),
      c(
        "远观雷意",
        [o(1, "你看那电光在竹节间游走,若有所悟。", { type: "material", id: "wudao", amount: 10 })],
        { isDefault: true },
      ),
    ],
    { element: "wood", minRealm: 4, maxRealm: MORTAL_END },
  ),
  ev(
    "ft_ancient_elixir",
    "失传丹方",
    "一座荒废丹房,案上摊着一卷泛黄的丹方,墨迹犹新。",
    ["general"],
    [
      c("记下丹方", [
        o(60, "丹方奥妙无穷,你逐字摹下,已得几分炼丹真意。", { type: "recipe" }),
        o(40, "丹方后半已被虫蛀,只得残缺几字。", { type: "material", id: "page", amount: 2 }),
      ]),
      c("放回原处", [o(1, "前人遗物,你不敢轻动,悄然离开。")], { isDefault: true }),
    ],
    { element: "wood", maxRealm: MORTAL_END },
  ),
  ev(
    "ft_beast_pledge",
    "妖兽认主",
    "一头通体雪白的幼兽从草丛探出头,竟不惧人,蹭着你的裤脚不放。",
    ["general", "forest"],
    [
      c("带它同行", [
        o(70, "幼兽灵气盎然,愿意追随于你——喜得一灵兽!", { type: "pet" }),
        o(30, "幼兽随了一段路便跑开了,你只留下一段记忆。", {
          type: "material",
          id: "herb",
          amount: 6,
        }),
      ]),
      c("轻轻放它离去", [o(1, "你摆摆手,幼兽一步三回头地走了。")], { isDefault: true }),
    ],
    { maxRealm: MORTAL_END },
  ),
  ev(
    "ft_reclusive_elder",
    "隐世高人",
    "竹屋前一位老翁在打坐,袈裟破旧,气息却深如渊海。",
    ["general", "mountain"],
    [
      c("上前叩拜", [
        o(55, "老翁抬眸只瞥了你一眼,一缕道韵没入你眉心。", { type: "exp", secs: 90 }),
        o(25, "老翁递来一枚丹药,转身已不见踪影。", { type: "pill", count: 2 }),
        o(20, "老翁摇摇头:「你缘未至。」你悻悻而返。", { type: "nothing" }),
      ]),
      c("不去打扰", [o(1, "高人清修,你静立片刻,悄然离去。")], { isDefault: true }),
    ],
    { maxRealm: MORTAL_END },
  ),
  /*
   * 早期地域(境界 1~3)每个细分标签只分摊到 1 条机缘 —— 黑风林/寒潭幽窟/万妖林
   * 各 1 条,古战场遗迹 1 条。机缘是 2% 概率的稀有内容,1 条也算够用,
   * 但早期恰恰是玩家最需要一个惊喜的地方。补两条给覆盖地域最多的两个标签。
   */
  ev(
    "ft_woodcutter",
    "山中樵语",
    "林间一个樵夫正歇脚,担子里除了柴,还压着几卷被雨打湿的书 —— 纸上的字是一种你从没见过的算经。",
    ["general", "forest"],
    [
      c("讨那几卷书", [
        o(60, "樵夫摆摆手:「拿去吧,我识不得字,留着也是压柴。」", {
          type: "material",
          id: "page",
          amount: 10,
        }),
        o(25, "樵夫不肯,却愿意让你抄一夜。抄到天亮,你记住了其中的算法。", {
          type: "exp",
          secs: 60,
        }),
        o(15, "书页一见风就烂成了泥,只剩下几笔残墨。", { type: "nothing" }),
      ]),
      c(
        "替他担一程",
        [
          o(1, "你把柴担挑到山下。樵夫塞给你一小袋灵草,说了句「好人自有好报」。", {
            type: "material",
            id: "herb",
            amount: 12,
          }),
        ],
        { isDefault: true },
      ),
    ],
    { maxRealm: MORTAL_END },
  ),
  ev(
    "ft_war_bones",
    "战骨拾遗",
    "古战场的土被风翻开,露出一具完整的骸骨。它的手还握着半截枪杆,指节扣得很紧。",
    ["general", "ruin"],
    [
      c("取走那半截枪", [
        o(50, "你一根一根掰开指节。枪入手极沉,枪尖上仍有一点未散的战意。", {
          type: "equipment",
          minQualityRank: 2,
        }),
        o(30, "你掰不动他的手。那具骸骨忽然整个塌成灰,枪也没了。", { type: "nothing" }),
        o(20, "指尖刚触到枪杆,一股杀意冲上来,你踉跄后退。", { type: "buff", id: "injury" }),
      ]),
      c(
        "覆土重新埋好",
        [
          o(1, "你花了半日把土盖回去。做完之后,这片战场似乎更静了些。", {
            type: "material",
            id: "wudao",
            amount: 10,
          }),
        ],
        { isDefault: true },
      ),
    ],
    { maxRealm: MORTAL_END },
  ),
  ev(
    "ft_blood_contract",
    "残缺秘术",
    "一块染血的龟甲横陈路中,上面的纹路似是一种秘术。",
    ["general", "dark"],
    [
      c("读取秘术", [
        o(
          50,
          "秘术艰深,你气血翻涌,却强记下来。",
          { type: "buff", id: "injury" },
          { type: "material", id: "wudao", amount: 12 },
        ),
        o(50, "龟甲上的血纹竟是一段禁法,你看了便心悸。", { type: "buff", id: "curse_xinmo" }),
      ]),
      c("掩埋龟甲", [o(1, "此物不祥,你掘土掩埋,心念一清。")], { isDefault: true }),
    ],
    { element: "dark", maxRealm: MORTAL_END },
  ),
  ev(
    "ft_meteor_iron",
    "天外陨铁",
    "山巅躺着一块天外陨铁,冰冷暗沉,锻之似有器韵内敛。",
    ["general", "mountain"],
    [
      c("拾取陨铁", [
        o(70, "你寻匠人将其回炉,炼成一缕明净器韵。", { type: "material", id: "ore", amount: 40 }),
        o(30, "陨铁沉重难移,你驮行半日,只取回一小半。", {
          type: "material",
          id: "ore",
          amount: 20,
        }),
      ]),
      c("转身离去", [o(1, "器道非你所长,你按捺住心思离去。")], { isDefault: true }),
    ],
    { maxRealm: MORTAL_END },
  ),

  // ============ 仙界及以上机缘(仅以界域标签出现,不会落到人间界)============
  /*
   * 星陨荒原 / 天外天 / 鸿蒙裂隙:三处都是 `sky` 标签的界外地界,共用同一批机缘。
   *
   * 上一轮补了 water / fire / thunder 三处之后,仍无专属机缘的地域只剩这三处 ——
   * 而它们的标签是 `sky`,机缘池里一条都没有。三处共用标签,故补两条即可全部覆盖。
   *
   * 境界带:`sky` 那几个地域(星陨荒原 tier17 / 天外天 18 / 仙人遗府 19 / 鸿蒙裂隙 20)
   * 虽然层级很高,但都归在 `MORTAL_REGIONS` 里、境界带是 7~8 —— 所以 `sky` 是**人间界标签**,
   * 必须声明 `maxRealm: MORTAL_END`,否则会一路漏到仙界/神界/混沌海
   * (界外区域同样带 `general`,标签挡不住)。见 `core/fortuneWorldGate.spec`。
   */
  ev(
    "ft_xingyi_zhujing",
    "星髓结晶",
    "荒原深处,一颗星辰坠落后留下的坑底凝着一枚半透明的结晶,里面像封着一小片夜空。",
    ["general", "sky"],
    [
      c("剖开结晶", [
        o(55, "结晶碎开时,那片夜空涌进你的识海 —— 你看见了自己的命星。", {
          type: "exp",
          secs: 80,
        }),
        o(
          25,
          "星髓太烈,你半边身子被灼得发烫,却也收下了一块。",
          { type: "material", id: "ore", amount: 40 },
          { type: "buff", id: "injury" },
        ),
        o(20, "结晶在你掌中化作一捧星尘,什么都没有留下。", { type: "nothing" }),
      ]),
      c(
        "仰观星河",
        [
          o(1, "你躺在坑边看了一夜星河,忽然觉得这一世的得失都轻了。", {
            type: "material",
            id: "wudao",
            amount: 14,
          }),
        ],
        { isDefault: true },
      ),
    ],
    { minRealm: 7, maxRealm: MORTAL_END },
  ),
  ev(
    "ft_tianwai_yin",
    "天外余音",
    "天外天的虚空中飘来一段极淡的声音,不像人语,也不像风 —— 它在你的识海里绕了很久。",
    ["general", "sky"],
    [
      c("循声而去", [
        o(60, "声音的源头是一枚漂泊的残破玉简,其上刻着某位大能未竟的道。", { type: "gongfa" }),
        o(25, "你循着声音走了很久,最后发现那只是虚空自己的回响。", { type: "nothing" }),
        o(
          15,
          "声音骤然尖锐,你七窍渗血,却也记住了其中一段。",
          { type: "buff", id: "injury" },
          { type: "material", id: "page", amount: 18 },
        ),
      ]),
      c(
        "守住心神",
        [
          o(1, "你闭目凝神,那声音渐渐远去 —— 能不被它带走,也是一种修为。", {
            type: "exp",
            secs: 60,
          }),
        ],
        { isDefault: true },
      ),
    ],
    { minRealm: 8, maxRealm: MORTAL_END },
  ),
  ev(
    "ft_xianmen_guqin",
    "仙门古琴",
    "废弃仙门的大殿中,一张古琴横陈案上。弦上无尘,似有人日日拂拭。",
    ["immortal"],
    [
      c("抚琴一曲", [
        o(45, "琴音入神,你于道之一途豁然开朗。", { type: "material", id: "wudao", amount: 35 }),
        o(
          35,
          "一曲未终,琴弦骤断,反震之力伤了你经脉。",
          { type: "buff", id: "injury" },
          { type: "exp", secs: 30 },
        ),
        o(20, "琴中封着一段仙诀,你将其记下。", { type: "gongfa" }),
      ]),
      c("拂尘而去", [o(1, "琴音未起,你却觉心中更静。")], { isDefault: true }),
    ],
  ),
  ev(
    "ft_yunduan_xianzun",
    "云端仙尊",
    "云海之上,一位仙尊负手而立,像是等了很久:「你来得比我算的晚了些。」",
    ["immortal"],
    [
      c("拜入门下", [
        o(55, "仙尊随手一点,你修为暴涨。", { type: "exp", secs: 60 }),
        o(30, "仙尊赐你一枚仙丹。", { type: "pill", id: "p_taichu", count: 1 }),
        o(15, "仙尊摇头:「道不同。」拂袖而去,只留你一人在云端。", { type: "nothing" }),
      ]),
      c("不拜", [o(1, "仙尊笑道:「罢了,各走各路。」")], { isDefault: true }),
    ],
    { element: "light" },
  ),
  ev(
    "ft_shenyu_wangzuo",
    "神域王座",
    "神域废墟中央悬着一座无主王座,坐上去的人,要么登临,要么被神威碾碎。",
    ["god"],
    [
      c("登座一试", [
        o(40, "神威认可了你,一件神兵自空中落下。", { type: "equipment", minQualityRank: 7 }),
        o(
          35,
          "王座上的神威压得你气血翻涌,你咬牙撑住,却落下一身伤。",
          { type: "buff", id: "injury" },
          { type: "material", id: "wudao", amount: 45 },
        ),
        o(25, "你被神威掀飞,却也摸到了这座神域的脉络。", {
          type: "material",
          id: "ore",
          amount: 70,
        }),
      ]),
      c("绕座而行", [o(1, "无主之物,未必无主之威。你选择绕行。")], { isDefault: true }),
    ],
  ),
  ev(
    "ft_faze_zhixin",
    "法则之心",
    "一枚跳动的光核悬于虚空,那是这方神域曾遵循过的、唯一的一条法则。",
    ["god"],
    [
      c("纳心入体", [
        o(50, "法则之心融入经脉,你的身体记住了它。", { type: "material", id: "wudao", amount: 55 }),
        o(
          35,
          "法则太过霸道,你只摄住一角,便已气血崩裂。",
          { type: "buff", id: "injury" },
          { type: "exp", secs: 60 },
        ),
        o(15, "光核竟再度跳动起来,认你为主。", { type: "buff", id: "buff_shenwei" }),
      ]),
      c("不动其心", [o(1, "你只是看,不去碰。有些法则,旁观亦是修行。")], { isDefault: true }),
    ],
    { element: "chaos" },
  ),
  ev(
    "ft_hundun_zhong",
    "混沌之种",
    "混沌之中,一粒种子悬浮不堕。它既是开始,也是某种未曾发生的结束。",
    ["chaos"],
    [
      c("吞种入腹", [
        o(45, "种子在你体内生根,修为随之奔涌。", { type: "exp", secs: 90 }),
        o(
          30,
          "混沌之气冲乱经脉,你强压下来,却留下暗伤。",
          { type: "buff", id: "injury" },
          { type: "material", id: "wudao", amount: 60 },
        ),
        o(25, "种子化开,一缕本源融入神魂。", { type: "buff", id: "buff_hundun" }),
      ]),
      c("将其埋回混沌", [o(1, "你将它埋回原处 —— 尚未发生的事,不该由你来催。")], {
        isDefault: true,
      }),
    ],
    { element: "chaos" },
  ),
  ev(
    "ft_hongmeng_xiantai",
    "鸿蒙先台",
    "万道未生之时,似有人在此立过一座台。台上无字,却刻着与你有关的那一笔。",
    ["chaos"],
    [
      c("登台观碑", [
        o(50, "碑上无字,你看见的却是自己此生的路。", { type: "material", id: "wudao", amount: 90 }),
        o(
          30,
          "石碑反噬,你神魂震荡,却也窥见大道一角。",
          { type: "buff", id: "injury" },
          { type: "exp", secs: 90 },
        ),
        o(20, "你于台上静立良久,再回神时,寿元已悄然厚了一层。", { type: "lifespan", pct: 0.02 }),
      ]),
      c("不登此台", [o(1, "你退开一步。那笔账,你还没打算现在就结。")], { isDefault: true }),
    ],
  ),
];
const FORTUNE_BY_ID = new Map(FORTUNE_EVENTS.map((x) => [x.id, x]));

const BY_ID = new Map(EVENTS.map((x) => [x.id, x]));

/**
 * 按 id 取事件 —— **普通事件与机缘同表**。
 *
 * 机缘(ft_)同样是 pickEventFor 选出来的,也会写进 adventure.pendingEventId。
 * 此前这个查表只搜 EVENTS,于是 EventDialog 查不到机缘 → 弹窗不开,
 * 会话卡到超时、自动结算又同样查不到 → 玩家白白丢掉一次机缘(2% 概率的静默空转)。
 */
export function eventDef(id: string): EventDef | undefined {
  return BY_ID.get(id) ?? FORTUNE_BY_ID.get(id);
}
