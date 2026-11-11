/**
 * 同行帖 —— 道侣全身上下的辨识物,只有一枚开头第一个字。
 *
 * ## 现状
 *
 * 同行帖(「道侣」弹窗)是人物页里笔墨最重的一帖:1334 行,摊开此刻要答的事、
 * 她对你的所求、缘分的四道刻度、同行履历与历世旧人。文字一格没错。
 *
 * 但整帖的"画面"是一枚楷体的**姓名首字**——十位道侣里有两位都姓「沈」时,
 * 那枚字是一样的。而这一帖讲的恰恰是"这个人是谁"。
 *
 * ## 身份是现成的,只是从没被读出来
 *
 * `DaoluDef.terrains`(见 `data/daolu`)写着"她会在哪一种地貌遇见":
 *
 *   沈青璃 —— 林泽、山岳       (寡言的女修,袖口常沾着药渣)
 *   赵砚   —— 废墟、山岳       (背一柄未开锋的铁剑)
 *   厉孤   —— 火域、废墟
 *   苍冥   —— 幽冥、天象
 *
 * 这份表一直被 `exploration` 用来决定"在这片地上能不能遇见她",
 * 界面上一个字都没露过。而它正好是「这一帖该配哪片天」的答案 ——
 * 与 `sceneTerrainOfPlace` 同一条纪律:取景读身份,不随手给一张底。
 *
 * ## 判据守什么
 *
 *   一 同行帖要有画;
 *   二 画的是**她**的那片地(读 `terrains`),不是玩家脚下的地 ——
 *      十个人若都画成玩家所在的那一界,这个弹窗就还是十枚一样的字;
 *   三 她「随处可遇」时(terrains 为空)不许硬凑一片 —— 空表是有意义的答案。
 */
import { describe, expect, it } from "vite-plus/test";
import { readSource } from "@/test/readSource";
import { DAOLU } from "@/data/daolu";
import { SCENE_TERRAINS, sceneTerrainOfAxis, type SceneTerrain } from "@/ui/sceneTerrain";

const DLG = "src/components/character/BondDialog.vue";

describe("同行帖 · 她那片地", () => {
  it("六种地貌轴都有归处,且落在真实地形上", () => {
    for (const axis of ["山岳", "林泽", "火域", "天象", "废墟", "幽冥"] as const) {
      expect(SCENE_TERRAINS, `${axis} 落到一个不存在的地形`).toContain(sceneTerrainOfAxis(axis));
    }
  });

  it("她「随处可遇」时整块不出 —— 空表是答案,不是缺数据", () => {
    /*
     * `terrains` 为空的道侣(慕烟:「走遍此世每一处地界」)不属于任何一片地。
     * 此时画必须整块不出 —— 只靠 `sceneTerrainOfAxis` 回 null 是不够的:
     * `:terrain` 收到 null 会落回 InkScene 自己的默认地形,**照画一片山**。
     * 兜底值与正常值读出来是同一个结果,正是这一条要分开的那件事。
     */
    const dlg = readSource(DLG);
    const tag = dlg.match(/<InkScene[\s\S]*?\/>/)?.[0] ?? "";
    expect(tag, "定位不到 InkScene —— 判据会空转").not.toBe("");
    expect(tag, "她随处可遇时不该硬画一片地").toMatch(/v-if="/);
  });

  it("认不出的地貌轴给 null —— 不硬凑一片", () => {
    /*
     * 「随处可遇」的她在 `terrains` 里是空数组。空表不是"没数据",是**答案**:
     * 这个人不属于任何一片地。给它兜底成山岳,就等于替玩家编一个她的故乡。
     */
    expect(sceneTerrainOfAxis(null)).toBeNull();
    expect(sceneTerrainOfAxis("")).toBeNull();
    expect(sceneTerrainOfAxis("没有这块地方")).toBeNull();
  });

  it("十位道侣的画不止一张 —— 不许十个人共用一片天", () => {
    const seen = new Map<SceneTerrain, string>();
    let withTerrain = 0;
    for (const who of DAOLU) {
      const terrain = sceneTerrainOfAxis(who.terrains[0]);
      if (!terrain) continue;
      withTerrain += 1;
      seen.set(terrain, `${seen.get(terrain) ?? ""}${who.name} `);
    }
    expect(withTerrain, "十位道侣里该有人知道自己属于哪种地貌").toBeGreaterThan(5);
    /*
     * 不要求十个人十张画(六种轴只有六副长相),但要真的分开:
     * 只落在一两种地形上,等于这一帖还是同一片底。
     */
    expect(
      seen.size,
      `十位道侣只落在 ${seen.size} 种地形上:${[...seen].map(([t, n]) => `${t}(${n.trim()})`).join("、")}`,
    ).toBeGreaterThanOrEqual(5);
  });

  it("同行帖真接上了画,且按她的地貌取景", () => {
    const dlg = readSource(DLG);
    expect(dlg, "同行帖仍是纯文字 —— 一整帖的辨识物只有一枚姓名首字").toContain("<InkScene");
    /*
     * 取景必须读**她**的地貌,不是玩家脚下的地。
     * 写死 `player.world.id` 会让十位道侣共用一片天 —— 那正是这一帖原来的毛病。
     *
     * 量的是「`:terrain` 绑的那个值最终出自 `bondDef.terrains`」,不钉写法:
     * 内联写 `sceneTerrainOfAxis(bondDef.terrains[0])` 与抽成 `herTerrain` 计算属性
     * 是同一个意思 —— 后者还多一句「为什么只取第一轴」的说明。钉写法会逼下一个人
     * 为了过判据把说明删掉。
     */
    const bound = dlg.match(/<InkScene[\s\S]*?\/>/)?.[0] ?? "";
    expect(bound, "定位不到 InkScene —— 判据会空转").not.toBe("");
    const name = bound.match(/:terrain="(\w+)"/)?.[1] ?? "";
    expect(name, "取景要绑一个名字,不绑字面量").not.toBe("");
    const src = dlg.match(new RegExp(`const ${name} = computed\\(([\\s\\S]*?)\\);`))?.[1] ?? "";
    expect(src, `找不到 ${name} 的定义 —— 判据会空转`).not.toBe("");
    expect(src, "取景要读她的地貌").toContain("sceneTerrainOfAxis");
    expect(src, "取景要读她的地貌").toContain("bondDef");
    expect(src, "取景要读她的地貌").toContain("terrains");
    expect(dlg, "不许退化成玩家脚下那片地").not.toMatch(
      /<InkScene[^>]*:world-id="player\.world\.id"/,
    );
  });
});
