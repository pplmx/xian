/**
 * 存档夹具 —— 自检与出图共用的「造一份存档」。
 *
 * 存档是**按 store 分片**加密后落在 localStorage 里的(见 utils/storage.ts 的
 * persistConfig):每个 store 一枚键 `xuanshu.<storeId>`,值是 AES 加密后的 JSON。
 * 这里照同一套格式造一份,供真浏览器在启动前注入 —— 用于「要看到后期/终局界面」
 * 的场景(排版自检的后期档、界面冒烟的 --late、文档截图)。
 *
 * ⚠ 这是自检夹具,不是作弊入口:密钥本就写在包里(见 utils/crypto 的注释),
 * 别据此以为存档不可改,也别把它当推荐玩法。
 */
import CryptoJS from "crypto-js";
import { SAVE_PREFIX } from "../../src/utils/storage.ts";
import { RULESET_VERSION } from "../../src/data/ruleset.ts";
import { ACHIEVEMENTS } from "../../src/data/achievements.ts";

const SAVE_SECRET = "yunyin-xiuxian::dao-in-the-clouds::v1";

/** 把一份明文切片加密成落盘形态 */
export function encryptSlice(slice) {
  return CryptoJS.AES.encrypt(JSON.stringify(slice), SAVE_SECRET).toString();
}

/** 把落盘的密文还原成明文(解不开或空串返回 "") —— 判据要读盘上的真值时才需要它 */
export function decryptSlice(cipher) {
  return CryptoJS.AES.decrypt(String(cipher ?? ""), SAVE_SECRET).toString(CryptoJS.enc.Utf8);
}

/**
 * 把若干切片注入 context 的 localStorage(启动前)。带一次性守卫:同一条导航
 * 不重复注入,免得把游戏自己写回的进度又盖掉。
 */
export async function seedSave(context, slices, guard = "__fixtureSeeded") {
  const data = Object.fromEntries(
    Object.entries(slices).map(([k, v]) => [`${SAVE_PREFIX}${k}`, encryptSlice(v)]),
  );
  await context.addInitScript(
    ({ payload, flag }) => {
      if (localStorage.getItem(flag)) return;
      for (const [k, v] of Object.entries(payload)) localStorage.setItem(k, v);
      localStorage.setItem(flag, "1");
    },
    { payload: data, flag: guard },
  );
}

const gn = (m, e) => ({ m, e });

/**
 * 「后期档」夹具 —— 神人境 + 成套装备,给 ui-smoke --late 覆盖终局界面。
 * 与「展品档」的分工:展品档为出图('看得好看'),这一份为冒烟('点得动、不出 NaN'),
 * 故数值取到后期极限、装备铺满词条,把终局的每条分支都逼出来。
 */
export function lateSlices(theme = "dark") {
  const now = Date.now();
  return {
    /**
     * 时间戳用"现在":夹具若写 1970,离线结算会去补算半个世纪的挂机收益 ——
     * 冒烟脚本每翻一页都要重算一次,一轮要跑十分钟(实测)。
     */
    game: {
      started: true,
      saveVersion: 2,
      createdAt: now,
      lastActiveAt: now,
      totalPlaySec: 0,
      createRerolls: 8,
      createProfile: null,
    },
    player: {
      name: "冒烟自检",
      major: 14,
      sub: 0,
      exp: gn(0, 0),
      age: 3000,
      lifespanBonusYears: 0,
      dead: false,
      reincarnation: {
        count: 2,
        daoFruit: 12,
        talents: [],
        insight: 400,
        /*
         * 三生录的「行年」要靠历世归档才排得出旧世那一卷;空数组时那一册只剩此世,
         * 于是「旧世 / 此世分卷」这条判据永远量不到。留一世真实的终局即可。
         */
        lives: [
          {
            index: 1,
            major: 8,
            realmLabel: "炼虚境",
            age: 1460,
            themeId: null,
            themeResult: null,
            insight: 46,
            at: now,
          },
        ],
        vow: null,
        trial: null,
        bonds: [],
      },
      linggen: {
        roots: [
          { element: "fire", aptitude: 88 },
          { element: "water", aptitude: 70 },
        ],
        gradeName: "双灵根",
        growthMult: 1.4,
      },
    },
    resources: {
      spiritStone: gn(9, 12),
      qi: 5000,
      wudao: 800,
      herb: 900,
      ore: 900,
      page: 300,
      dust: 500,
    },
    /**
     * 装备两件「背水」词条 —— 攒出一路流派。没有这一步,流派页的成路界面
     * (五维评级 / 组合技 / 成路来源)在冒烟里根本不会渲染,等于没测。
     * 槽位用真实名(weapon / body):从前写的是 `armor` —— 那个槽位不存在,
     * 件被 sanitize 静默丢掉,于是「两件」其实只装上了一件,成路界面根本没被覆盖。
     */
    inventory: {
      items: [
        {
          uid: "smoke_w",
          templateId: "w_chensha",
          quality: "heaven",
          tier: 14,
          level: 0,
          affixes: [{ id: "bs3", roll: 1 }],
        },
        {
          uid: "smoke_b",
          templateId: "b_xingluo",
          quality: "heaven",
          tier: 14,
          level: 0,
          affixes: [{ id: "low2", roll: 1 }],
        },
      ],
      equipped: { weapon: "smoke_w", body: "smoke_b" },
      pills: {},
      artifacts: [],
      equippedArtifacts: [],
    },
    endgame: { daoPath: "sword", daoSource: 1200, souls: [], equippedSouls: [] },
    settings: {
      privacyAccepted: true,
      sfxOn: false,
      musicOn: false,
      musicVol: 0,
      sfxVol: 0,
      reduceMotion: true,
      battleSpeed: 4,
      decomposeRanks: [],
      smartKeep: { enabled: true, minQuality: 3, keepCoreAffix: true, keepComboPiece: true },
      theme,
    },
  };
}

/** 一件装备的落盘形态(与 inventory store 的 items 条目同形) */
const item = (uid, templateId, quality, affixes, level = 0) => ({
  uid,
  templateId,
  quality,
  tier: 9,
  level,
  affixes,
});
const af = (...ids) => ids.map((id) => ({ id, roll: 1 }));

/** 道痕满卷夹具:60 则都带忆战快照,把每行的动作与旧纪标记一起逼出来。 */
export const FULL_MARKS_COUNT = 60;

/**
 * 展品档已解锁的成就与名号。
 *
 * 真仙九层、三亿灵石、天品以上装备与过万寿元已经满足这些累计事实;若仍把
 * achieved/titlesOwned 留空,启动补扫会当场改档,截图还会出现「尚差 0 · 未获得」
 * 这种只属于坏夹具的死路。这里只列当前存档实际满足的条目,不伪造全成就。
 */
const SHOWCASE_MAJOR = 9;
const SHOWCASE_ACHIEVED = [
  ...ACHIEVEMENTS.filter(
    (achievement) => achievement.cond.type === "realm" && achievement.cond.major <= SHOWCASE_MAJOR,
  ).map((achievement) => achievement.id),
  "a_lianqi_full",
  "a_lifespan",
  "a_rich",
  "a_q4",
  "a_q6",
  "a_q7",
];

const SHOWCASE_TITLES = ACHIEVEMENTS.filter(
  (achievement) => SHOWCASE_ACHIEVED.includes(achievement.id) && achievement.reward?.titleId,
).map((achievement) => achievement.reward.titleId);

const SHOWCASE_TIERS = Object.fromEntries(
  SHOWCASE_ACHIEVED.map((id) => {
    const achievement = ACHIEVEMENTS.find((row) => row.id === id);
    if (achievement?.cond.type === "realm") return [id, achievement.cond.major * 2 + 1];
    if (achievement?.cond.type === "custom" && achievement.cond.key === "realm_0_9") return [id, 2];
    return [id, SHOWCASE_MAJOR * 2 + 1];
  }),
);

export function makeFullMarks(now = Date.now()) {
  return Array.from({ length: FULL_MARKS_COUNT }, (_, i) => ({
    life: 80 - i,
    daoPathId: "sword",
    targetId: `mark-fixture-${i + 1}`,
    targetName: `道痕试炼${i + 1}`,
    cleared: i % 3 !== 0,
    rounds: 24 + i,
    buildName: `旧构筑${i + 1}`,
    powerText: "1万",
    at: now - i * 1000,
    ruleset: i % 5 === 0 ? "0.0.1" : RULESET_VERSION,
    replay: {
      mods: {},
      attack: { m: 1200 + i * 80, e: 0 },
      defense: { m: 700 + i * 40, e: 0 },
      maxHp: { m: 22000 + i * 600, e: 0 },
      speed: 2,
      skills: [],
      artifacts: [],
      pactId: null,
    },
  }));
}

/**
 * 「展品」存档 —— 给文档截图用:真仙(仙界)一线,资源充裕、装备成套、法宝在身、
 * 道途已择。数值取到「看得见规模又不至于刷屏」的档位,各页都有内容可看。
 */
export function showcaseSlices(theme = "light") {
  const now = Date.now();
  return {
    game: {
      started: true,
      saveVersion: 2,
      createdAt: now - 120 * 86400000,
      lastActiveAt: now,
      totalPlaySec: 3600 * 42,
      createRerolls: 8,
      createProfile: null,
    },
    player: {
      name: "萧听雪",
      major: 9,
      sub: 3,
      exp: gn(4, 7),
      age: 320,
      lifespanBonusYears: 0,
      dead: false,
      reincarnation: {
        count: 2,
        daoFruit: 12,
        talents: [],
        insight: 260,
        // 同上:行年那一册要真排得出旧世卷,截图与排版门才有东西可看
        lives: [
          {
            index: 1,
            major: 6,
            realmLabel: "化神境",
            age: 980,
            themeId: null,
            themeResult: null,
            insight: 32,
            at: now,
          },
        ],
        vow: null,
        trial: null,
        bonds: [],
      },
      linggen: {
        roots: [
          { element: "water", aptitude: 63 },
          { element: "wood", aptitude: 44 },
        ],
        gradeName: "真灵根",
        growthMult: 1.2,
      },
    },
    resources: {
      spiritStone: gn(3, 8),
      qi: 5000,
      wudao: 800,
      herb: 360,
      ore: 420,
      page: 180,
      dust: 900,
    },
    inventory: {
      // 九部位成套(真仙一档的沼行套),外加几件散落在行囊的收获 —— 背包页要有得看
      items: [
        item("shot_w", "w_zidian", "immortal", af("atk4", "crit3", "cdmg4"), 12),
        item("shot_h", "h_miwu", "heaven", af("hp3"), 8),
        item("shot_b", "b_zhaoze", "immortal", af("def4", "hp4"), 10),
        item("shot_wr", "wr_zhaoteng", "heaven", af("atk3"), 7),
        item("shot_bl", "bl_nizhao", "heaven", af("def3"), 9),
        item("shot_bo", "bo_shezhao", "earth", af("hp2"), 6),
        item("shot_n", "n_wuzhu", "earth", af("hp3"), 5),
        item("shot_r", "r_mizong", "heaven", af("crit2"), 8),
        item("shot_tl", "tl_wulei", "profound", af("bs3"), 4),
        item("bag_w", "w_xuantie", "immortal", af("atk4", "bs3"), 11),
        item("bag_b", "b_hantan", "heaven", af("def3", "hp3"), 7),
        item("bag_r", "r_xuanguang", "heaven", af("crit3"), 6),
        item("bag_n", "n_lingyu", "earth", af("hp2"), 3),
        item("bag_h", "h_xuantie", "heaven", af("def2"), 5),
        item("bag_bo", "bo_taxia", "excellent", af("hp1"), 2),
      ],
      equipped: {
        weapon: "shot_w",
        head: "shot_h",
        body: "shot_b",
        wrist: "shot_wr",
        belt: "shot_bl",
        boots: "shot_bo",
        necklace: "shot_n",
        ring: "shot_r",
        talisman: "shot_tl",
      },
      // 丹匣要摆出各品质档:ItemCell 的染色按品质走(tone=qualityDef().color),
      // 展品档从前 pills 为空,丹匣永远空态 —— 染色分支从未被任何截图验证过。
      // 五档(凡/良/精/玄/天)把 tone 的档位差摆上货架,数量也拉开(存量 foot 才有戏)。
      pills: {
        p_jvqisan: 12,
        p_huichun: 6,
        p_juling: 4,
        p_dahuan: 2,
        p_jiuzhuan: 1,
      },
      /*
       * 法宝册要真有货:此前这里恒为空数组,于是法宝册在**所有**截图与排版门里
       * 都是空态 —— 行卡上的被动、神通节拍、下一重、何时得来,一个分支都没被量到。
       * 取一件神品(混沌钟)+ 一件凡品(墨玉葫芦),高档与低档的行卡都在场。
       */
      artifacts: [
        { defId: "af_hundun", level: 3 },
        { defId: "af_muyu", level: 1 },
      ],
      equippedArtifacts: ["af_hundun"],
    },
    endgame: { daoPath: "sword", daoSource: 1200, souls: [], equippedSouls: [] },
    // 长期道途早已推过前半程;资格名号也收了一批,免得首页还挂着开局的「主线 1/32」
    quests: {
      counters: {},
      achieved: SHOWCASE_ACHIEVED,
      achievedTiers: SHOWCASE_TIERS,
      mainIdx: 22,
      daily: { date: "", base: {}, done: [] },
      titlesOwned: SHOWCASE_TITLES,
      /*
       * 图鉴要真有收录:行年那一册的道历只在「这一条真在册上」时才留得住
       * (stores/quests 的 sanitize 按 collections 裁 collectedMoment)。
       * 从前这里全是空数组,于是夹具里没有任何收录 —— 图鉴与行年都只剩空态,
       * 「满册怎么排」这件事从来没有被任何一道门量到。
       */
      collections: {
        equip: ["w_zhuqing"],
        gongfa: ["m_taixuan"],
        pill: [],
        artifact: ["af_hundun", "af_muyu"],
        pet: [],
        event: [],
        talent: [],
      },
      collectedAt: {
        "equip:w_zhuqing": now,
        "gongfa:m_taixuan": now,
        "artifact:af_hundun": now,
        "artifact:af_muyu": now,
      },
      /*
       * 三生录「行年」的三张道历表。空着也能渲染,但那一册就只剩一句「尚白」——
       * 排版门量不到行、空态与满态也分不开。种几条**真内容 id**(名字才解析得出来),
       * 两世都有,「旧世 / 此世分卷」才量得到。
       */
      collectedMoment: {
        "gongfa:m_taixuan": { life: 3, age: 21 },
        "equip:w_zhuqing": { life: 3, age: 37 },
        // 法宝那一行要真读得出道历(旧档没有读数时才会退成「早年收录」)
        "artifact:af_hundun": { life: 2, age: 140 },
        "artifact:af_muyu": { life: 3, age: 8 },
      },
      titleMoments: {
        [SHOWCASE_TITLES[0] ?? "ti_churu"]: { life: 2, age: 96 },
      },
      petMoments: {},
      lastCollectionViewAt: now,
      petCompanions: [],
    },
    // 洞府已营数座、灵脉也有投入,否则洞府页是一片「未启用」
    dongfu: {
      levels: { mansion: 6, array: 5, alchemy: 5, forge: 4, field: 5, library: 4, beast: 3 },
      frac: { herb: 0, ore: 0, wudao: 0 },
      veinMain: "gather",
      veinPoints: { gather: 36, craft: 18, alchemy: 12, insight: 24 },
    },
    settings: {
      privacyAccepted: true,
      sfxOn: false,
      musicOn: false,
      musicVol: 0,
      sfxVol: 0,
      reduceMotion: false,
      battleSpeed: 2,
      decomposeRanks: [],
      smartKeep: { enabled: true, minQuality: 3, keepCoreAffix: true, keepComboPiece: true },
      theme,
    },
  };
}
