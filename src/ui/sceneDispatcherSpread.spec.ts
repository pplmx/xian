/**
 * 每个取景分派都要**铺得开** —— 一张只落一种地形的表等于没有分派。
 *
 * ## 为什么要有这一条
 *
 * 全站十九个 `sceneTerrainOfXxx`,每个都配了一条自己的判据(丹 / 席 / 劫 / 秘境 /
 * 九柜 / 器物 / 心法 / 玄枢图 / 洞府七作 …)。那些判据各管一件事:这一档取到的
 * 地形对不对、两两是否不同、兜底落到哪。**没有一条问过**:
 * 「这张表真的铺开了吗?」
 *
 * 而"没铺开"正是最容易悄悄发生的那种退化 —— 往表里补一个键却复制了上一行的值,
 * 判据照旧全绿(它对每个键只查"取得到"),玩家看到的却是所有东西长在一片地上。
 * 本作已经踩过一次同类:地界与事件共用的那两张表,曾因 `forest` 与 `palace`
 * 的天空几乎一样,55px 的条上只差 0.9% 的像素。
 *
 * ## 这一条钉什么
 *
 * 每张映射表:(a) 覆盖面与真实数据对得上;(b) 产出的地形种数 ≥ min(表键数, 9)
 * 与 2 的较小者 —— 也就是**不许退化成一两种**。
 *
 * 不要求"一键一地形":地只有九种,而秘境有十五处,必然有共用
 * (设计上共享的那一对是 `jinglei`/`zhuifeng` 的「天上的事」,见 docs/design.md)。
 * 要钉的是"别整张表都落在同一片地上"。
 */
import { describe, expect, it } from "vite-plus/test";
import {
  SCENE_TERRAINS,
  sceneTerrainOfBuilding,
  sceneTerrainOfCelestial,
  sceneTerrainOfCollection,
  sceneTerrainOfDao,
  sceneTerrainOfHerbGrade,
  sceneTerrainOfPill,
  sceneTerrainOfQuality,
  sceneTerrainOfSecretRealm,
  sceneTerrainOfSlot,
  sceneTerrainOfTrial,
  sceneTerrainOfVolume,
  type SceneTerrain,
} from "@/ui/sceneTerrain";

/** 一张表:名字 + 全部真实键 + 取景 */
interface Spread {
  name: string;
  keys: readonly string[];
  pick: (key: string) => SceneTerrain | null;
}

const SPREADS: Spread[] = [
  {
    name: "丹(按药效)",
    keys: ["exp", "qi", "lifespan", "wudao", "buff"],
    pick: (k) => sceneTerrainOfPill(k),
  },
  {
    name: "席(十处装配位)",
    /* 真实键见 sceneTerrain 的 SLOT_TERRAIN —— 别按常见 RPG 的叫法猜(wrist/belt/boots 不是 waist/legs/feet) */
    keys: [
      "weapon",
      "head",
      "body",
      "wrist",
      "belt",
      "boots",
      "necklace",
      "ring",
      "artifact",
      "talisman",
    ],
    pick: (k) => sceneTerrainOfSlot(k),
  },
  {
    name: "品阶",
    keys: ["1", "2", "3", "4", "5", "6", "7", "8", "9"],
    pick: (k) => sceneTerrainOfQuality(Number(k)),
  },
  {
    name: "灵草品阶",
    keys: ["1", "2", "3", "4", "5"],
    pick: (k) => sceneTerrainOfHerbGrade(Number(k)),
  },
  {
    name: "九柜",
    keys: ["equip", "gongfa", "branch", "pill", "material", "artifact", "pet", "event", "talent"],
    pick: (k) => sceneTerrainOfCollection(k),
  },
  {
    name: "五卷",
    keys: ["practice", "estate", "journey", "belongings", "fate"],
    pick: (k) => sceneTerrainOfVolume(k),
  },
  {
    name: "洞府七作",
    keys: ["mansion", "array", "alchemy", "forge", "field", "library", "beast"],
    pick: (k) => sceneTerrainOfBuilding(k),
  },
  {
    name: "八道",
    keys: ["sword", "zhenyue", "longevity", "fate", "slaughter", "lianzhu", "xuehe", "jieshi"],
    pick: (k) => sceneTerrainOfDao(k),
  },
  {
    name: "五界",
    keys: ["chiyan", "xingyun", "wanren", "wusheng", "wuxiang"],
    pick: (k) => sceneTerrainOfCelestial(k),
  },
  {
    name: "十炼",
    keys: [
      "qisha",
      "yixian",
      "wuhui",
      "zhaoying",
      "jinglei",
      "zhuifeng",
      "juejing",
      "xiaomo",
      "chengxin",
      "zhongmo",
    ],
    pick: (k) => sceneTerrainOfTrial(k),
  },
  {
    name: "十五秘境",
    keys: [
      "sr_kurong",
      "sr_jianzhong",
      "sr_kuye",
      "sr_fengyin",
      "sr_tiebi",
      "sr_chiyan",
      "sr_yunxing",
      "sr_qingming",
      "sr_wanyao",
      "sr_xingchen",
      "sr_guixu",
      "sr_leize",
      "sr_minghe",
      "sr_xuanyuan",
      "sr_zhuxian",
    ],
    pick: (k) => sceneTerrainOfSecretRealm(k),
  },
];

describe("每个取景分派都要铺得开", () => {
  it("每张表产出的地形不少于「键数」封顶九", () => {
    const flat: string[] = [];
    for (const s of SPREADS) {
      const got = new Set<SceneTerrain | null>();
      for (const k of s.keys) {
        const t = s.pick(k);
        if (t) got.add(t);
      }
      /*
       * 下限取 `min(键数, 9)` —— 地只有九种,十五处秘境必然有共用;
       * 但至少不能整张表只落一两种。
       */
      const floor = Math.min(s.keys.length, SCENE_TERRAINS.length);
      if (got.size < floor) {
        flat.push(`${s.name}:${s.keys.length} 键只铺开 ${got.size} 种地形(至少要 ${floor} 种)`);
      }
    }
    expect(flat, "这些表退化了 —— 表里每一项都取得到,但都长在同一片地上").toEqual([]);
  });

  it("判据自己的键名不是猜的 —— 每个键都真的被表认得", () => {
    /*
     * 这一条是**自省**:第一版把席位键写成 waist / legs / feet / amulet(常见 RPG 叫法),
     * 而本作的实际键是 belt / boots / necklace —— 于是那条判据报「十席只铺开七种」,
     * 报的是一个**不存在的问题**。判据的键名一旦靠猜,它给出的红与绿都不可信。
     *
     * 认不出的键会落到兜底地形;故这里换个角度验:一个**明显不存在的键**
     * 必须与某个真实键取到不同结果 —— 若两者相同,说明这张表按前缀/模糊匹配,
     * 那前面那条判据就是在拿兜底值互相比较。
     */
    const suspicious: string[] = [];
    for (const s of SPREADS) {
      const real = s.keys.map((k) => s.pick(k));
      const ghost = s.pick("__definitely_not_a_key__");
      if (real.every((t) => t === ghost)) {
        suspicious.push(`${s.name}:真实键与不存在的键取到同一结果(${String(ghost)})`);
      }
    }
    expect(suspicious, "这些表的判据键可能全是猜的 —— 红绿都不可信").toEqual([]);
  });

  it("没有一张表整片落在兜底地形上", () => {
    /*
     * 兜底(山岳)是「认不出时」的去处。若一张表**全部**落到它,说明表键与数据的
     * 口径对不上(例如把对象当字符串传进去)—— 那种错在界面上表现为「一切照旧」,
     * 没有任何报错。实测差点踩到:给丹药分派传整个 `effect` 对象,七十五味丹全落山岳。
     */
    const allPeaks: string[] = [];
    for (const s of SPREADS) {
      const got = s.keys.map((k) => s.pick(k));
      if (got.every((t) => t === "peaks"))
        allPeaks.push(`${s.name}:${s.keys.length} 项全落兜底山岳`);
    }
    expect(allPeaks, "这些表的键与数据口径对不上 —— 分派形同虚设").toEqual([]);
  });
});
