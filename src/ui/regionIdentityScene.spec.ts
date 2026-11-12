/**
 * 地界该按**它自己是什么**取景,不只是按图标那一个格子。
 *
 * ## 这两条路此前走岔了
 *
 * 历练页卷首读 `sceneTerrainOfPlace({ icon: currentRegion.icon })` ——
 * 只喂图标。而图标是**通用符号**(mountain / gem / trees …),一个图标要服务
 * 好几种地界,于是:
 *
 *   青云山麓 mountain → 山岳     ← 对
 *   昆仑雪岭 mountain → 山岳     ← 它是「万古冰封的圣山」,雪原明明存在
 *   不朽金渊 gem      → 山岳     ← 它是「一渊金气沉如渊海」
 *   万神殿堂 gem      → 山岳     ← 它是「一万尊神像并列成堂」
 *   道祖悟道崖 mountain → 山岳   ← 它是「混沌道祖坐了三万年的崖」
 *
 * 五处走成同一片山。而它们的描述里各自写着是什么地方 —— 那是**这一处自己的身份**,
 * 比通用图标近一层。
 *
 * ## 判据怎么落
 *
 * 给地界加一条按 id 的取景(single source 仍在 `sceneTerrain` 一处),
 * 优先于图标;判据钉三件事:
 *   一 那五处不再共用山岳;
 *   二 按 id 的取景必须**有据** —— 每一处都要能在它自己的描述里找到落点词的依据
 *      (`docs/design.md` 记着映射理由),这一条靠下面那句注释与名单守;
 *   三 没在名单里的地界仍然走图标,行为不变。
 */
import { describe, expect, it } from "vite-plus/test";
import { REGIONS } from "@/data/regions";
import {
  REGION_TERRAIN_OVERRIDE,
  sceneTerrainOfPlace,
  sceneTerrainOfRegion,
  SCENE_TERRAINS,
} from "@/ui/sceneTerrain";

const 名单 = ["kunlun", "jinyuan", "wanshendian", "wudaoya", "qingyun"];

describe("地界按它自己是什么取景", () => {
  it("这五处不再共用山岳", () => {
    const seen = new Map<string, string>();
    for (const id of 名单) {
      const r = REGIONS.find((x) => x.id === id)!;
      const t = sceneTerrainOfRegion({ regionId: id, icon: r.icon });
      expect(SCENE_TERRAINS, `${id} 落到不存在的地形`).toContain(t);
      const clash = seen.get(t);
      expect(clash, `${id} 与 ${clash} 还是同一片(${t})`).toBeUndefined();
      seen.set(t, id);
    }
  });

  it("名单里的每一处都真的在数据里,不许写错 id", () => {
    for (const id of Object.keys(REGION_TERRAIN_OVERRIDE)) {
      expect(
        REGIONS.some((r) => r.id === id),
        `映射表里写了 ${id},但地界表里没有这一处 —— id 写错了`,
      ).toBe(true);
    }
  });

  it("每一条覆盖都真的带来区分 —— 不许白写一条", () => {
    /*
     * 原先这一条写的是「名单外不许加」(只准五处)。那个数字在下一轮就被正当推翻了:
     * 全表摊开数发现 66% 的地界挤在三片天上,于是按各处的描述又收了十二条。
     * 钉一个数字,挡的是"改",不是"改错" —— 而真正要防的是**白写**:
     * 某条覆盖的值若与它本来就会落到的地形一样,那条覆盖什么也没做。
     *
     * 故改成钉实质:每一条 `id → 地形` 都必须与「这一处按图标取景会落到的地形」不同。
     * (唯一例外是 qingyun —— 它显式在册,是为了让「山麓归山岳」有据可查,
     * 下面单独给它一条豁免并写明理由。)
     */
    const 显式在册 = new Set(["qingyun"]);
    const 白写: string[] = [];
    for (const [id, terrain] of Object.entries(REGION_TERRAIN_OVERRIDE)) {
      if (显式在册.has(id)) continue;
      const region = REGIONS.find((r) => r.id === id);
      if (!region) continue;
      const byIcon = sceneTerrainOfPlace({ icon: region.icon });
      if (byIcon === terrain) {
        白写.push(`${id} 覆盖成 ${terrain},而它按图标本来就落 ${byIcon} —— 这条覆盖什么也没做`);
      }
    }
    expect(白写, "这些覆盖没带来任何区分 —— 要么删掉,要么改成真正对得上描述的那片地").toEqual([]);
  });
});
