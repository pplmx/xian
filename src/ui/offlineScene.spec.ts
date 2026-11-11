/**
 * 离线归来 —— 挂了一夜回来,该看见自己是在**哪儿**过的这一夜。
 *
 * ## 现状
 *
 * 归来卷轴(`OfflineRewardDialog`)是玩家隔夜、出差、一周没开之后的第一眼。
 * 它把这一段的账摊得很清楚:修为 +1768兆 · 本境 30%、灵气 +10.32兆、寿元流逝 9 载、
 * 离线上限那一段折了几小时 —— 一句话都没少。
 *
 * 它唯一没说的一件事是**地点**。
 *
 * ## 为什么这一处值得补
 *
 * 这一作的历练是「在某一片地界挂一程」:雪山里砍狼、江边打鲛、古战场里掘剑。
 * 玩家回来时那趟历练通常还没收(`session` 还在),而卷轴上只有「在路上」三个字 ——
 * 既没有地名,也看不出这一夜是在雪岭还是在火域。
 *
 * 与上一轮同一条线索:玩家反馈「能加一些画面就完美了」。而全站画面都是按
 * **身份**取的(`ui/sceneTerrain`:世界 → 地界图标 → 事件标签)。这一屏缺的正是那个身份。
 *
 * ## 判据守什么
 *
 *   一 卷轴要有画面,且按**这一趟历练所在的地界**取,不是按玩家的世界兜底;
 *   二 没有在途历练时整块不出(挂机只是闭关,不在任何一片地上);
 *   三 取景的身份由 core 在造 summary 时带上,卷轴不自己查表 ——
 *      与 `BreakthroughView.kind` 同一条纪律(见 ui/breakthroughLore.spec)。
 */
import { describe, expect, it } from "vite-plus/test";
import { readSource } from "@/test/readSource";

const DLG = "src/components/offline/OfflineRewardDialog.vue";
const CORE = "src/core/offline.ts";
const TYPES = "src/types/index.ts";

describe("离线归来 · 要知道这一夜是在哪儿过的", () => {
  it("卷轴上有画面", () => {
    const dlg = readSource(DLG);
    expect(dlg, "归来卷轴仍是纯文字 —— 挂一夜回来抬头没有东西可看").toContain("<InkScene");
  });

  it("画面按这一趟历练所在的地界取,不按玩家的世界兜底", () => {
    const dlg = readSource(DLG);
    /*
     * 写死成 `:world-id="player.world.id"` 会让「仙界的一处雪岭」与「仙界的一处江海」
     * 共用同一张底 —— 而这一趟历练恰恰只发生在其中一处。故必须读 summary 上的
     * 地界身份。
     */
    expect(dlg, "底图要由这一趟历练的地界定").toMatch(/<InkScene[\s\S]{0,160}:icon="summary\./);
    /*
     * `worldId` 可以照样传:它是**兜底**的底子(图标认不出时才落回世界),
     * 不是取景的主据。要钉的是「图标那一路真接上了」—— 上面那条已经钉住。
     * 反过来,若只传 worldId 而删掉 icon,上面那条会当场红。
     */
  });

  it("没在途历练时整块不出 —— 闭关不在任何一片地上", () => {
    const dlg = readSource(DLG);
    const tag = dlg.match(/<InkScene[\s\S]*?\/>/)?.[0] ?? "";
    expect(tag, "定位不到 InkScene —— 判据会空转").not.toBe("");
    /*
     * 条件挂在**包住这一整块**(画 + 地名)的那一层上,而不是挂在 InkScene 自己身上:
     * 只 v-if 画的话,名字会剩一行悬在纸上;只 v-if 名字的话,画会给一个空地名配景。
     * 故量的是「这一块被一个 if 守住,且它里面既有画也有名」。
     */
    const block = dlg.match(/<template v-if="summary\.region">[\s\S]*?<\/template>/)?.[0] ?? "";
    expect(block, '没在途历练时不该画一片地 —— 见不到 v-if="summary.region" 这一层').not.toBe("");
    expect(block, "这一块里要有画").toContain("<InkScene");
    expect(block, "这一块里要有地名").toContain("summary.region.name");
  });

  it("取景的身份由 core 带上,卷轴不自己查地界表", () => {
    const types = readSource(TYPES);
    const iface = types.match(/export interface OfflineSummary \{[\s\S]*?\n\}/)?.[0] ?? "";
    expect(iface, "定位不到 OfflineSummary —— 判据会空转").not.toBe("");
    /*
     * 带上的是「名字 + 图标」而不是光一个 id:卷轴要在画旁边写出地名
     * (玩家见到「寒潭幽窟」四个字,与见到一枚水滴图标,分量不一样),
     * 而图标是取景唯一的身份。故两个字段都得在。
     */
    expect(iface, "OfflineSummary 要带上这一趟历练的地界身份").toMatch(
      /region:\s*\{\s*name:\s*string;\s*icon:\s*string\s*\}\s*\|\s*null/,
    );
    /*
     * 卷轴不许 import 地界表:两处各查一次表,「这一趟在哪儿」迟早一处按 id、
     * 一处按图标,两边说的不是同一件事。与 toRealmName / kind 同一条纪律。
     */
    expect(readSource(DLG), "卷轴不该自己 import 地界表").not.toMatch(
      /from ["']@\/data\/regions["']/,
    );
    expect(readSource(CORE), "core 要把地界身份带进 summary").toMatch(/region:\s*regionIdentity/);
  });
});
