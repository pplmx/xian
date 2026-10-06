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

const SAVE_SECRET = "yunyin-xiuxian::dao-in-the-clouds::v1";

/** 把一份明文切片加密成落盘形态 */
export function encryptSlice(slice) {
  return CryptoJS.AES.encrypt(JSON.stringify(slice), SAVE_SECRET).toString();
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
        lives: [],
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
        lives: [],
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
      pills: {},
      artifacts: [],
      equippedArtifacts: [],
    },
    endgame: { daoPath: "sword", daoSource: 1200, souls: [], equippedSouls: [] },
    // 修行志早已推过前半程;资格名号也收了一批,免得首页还挂着开局的「主线 1/32」
    quests: {
      counters: {},
      achieved: [],
      mainIdx: 22,
      daily: { date: "", base: {}, done: [] },
      titlesOwned: [],
      collections: {
        equip: [],
        gongfa: [],
        pill: [],
        artifact: [],
        pet: [],
        event: [],
        talent: [],
      },
      collectedAt: {},
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
