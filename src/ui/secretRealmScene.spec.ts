/**
 * 秘境名录 —— 十五处各有各的地界,而名录上只有八行字。
 *
 * ## 现状
 *
 * 历练页的秘境卡片在未入时列一张名录:每行一个名、一句 desc、「入 境 →」。
 * 344 行模板里一个 `<svg>` 都没有。
 *
 * ## 身份是现成的,而且写得很足
 *
 * `data/secretRealms` 的十五条 `SECRET_REALMS` 每一条的 desc 都把那一处写清楚了:
 *
 *   枯荣古境「草木枯而复荣」        苦海渡舟「一叶渡苦海」
 *   剑冢幻境「万剑横空」            风吟孤岛「孤岛薄雾,风里都是虚招」
 *   铁壁万壑「万壑铁壁,万军难摧」  赤焰石窟「地火奔涌的石窟」
 *   陨星荒原「万界陨星坠落的荒原」  青冥古渡「古渡千年,冥气侵体」
 *   万妖谷  「万妖奔涌,攻如连珠」  星辰古殿「殿中星轨自行流转」
 *   归墟之眼「万流归墟,视之如渊」  雷泽天渊「雷海万道」
 *   冥河渡  「冥河幽渡,饮血者众」  轩辕剑冢「十万残剑,择主而鸣」
 *   筑仙台  「登台者众,成仙者稀」
 *
 * ## 判据守什么
 *
 *   一 十五处各有各的画(九种地形装十五处,必有多对共用 —— 但**九种得用满**,
 *      且每一处都得有个说法);
 *   二 取景读**这一处秘境**(`r.id`),不是玩家脚下的地;
 *   三 画不占布局:那一行是按钮,画占布局会把「入 境 →」挤走。
 */
import { describe, expect, it } from "vite-plus/test";
import { readSource } from "@/test/readSource";
import { SECRET_REALMS } from "@/data/secretRealms";
import { SCENE_TERRAINS, sceneTerrainOfSecretRealm, type SceneTerrain } from "@/ui/sceneTerrain";

const CARD = "src/components/adventure/SecretRealmCard.vue";

describe("秘境名录 · 这一处是什么地界", () => {
  it("九种地形全用上 —— 十五处不许挤在一两种里", () => {
    const byTerrain = new Map<SceneTerrain, string[]>();
    for (const r of SECRET_REALMS) {
      const terrain = sceneTerrainOfSecretRealm(r.id);
      expect(SCENE_TERRAINS, `${r.name} 落到一个不存在的地形`).toContain(terrain);
      byTerrain.set(terrain, [...(byTerrain.get(terrain) ?? []), r.name]);
    }
    expect(byTerrain.size, `十五处只用到 ${byTerrain.size} 种地形 —— 九种该用满`).toBe(
      SCENE_TERRAINS.length,
    );
    /*
     * 光「九种用满」不够:把某一处从 A 挪到**已被别的处占着**的 B,A 仍被剩下那些
     * 撑着,九种照样满 —— 实测把「枯荣古境」从林麓挪到遗迹,这条判据绿着。
     *
     * 故再钉**每一处的落点**:id 与地形的逐一对应。改表可以,但要连着改这张
     * 期望表 —— 那正是「写得出理由」的意思(改的人必须交代为什么这一处换了地方)。
     */
    const expected: Record<string, SceneTerrain> = {
      sr_kurong: "forest",
      sr_jianzhong: "ruin",
      sr_kuye: "water",
      sr_fengyin: "sky",
      sr_tiebi: "peaks",
      sr_chiyan: "flame",
      sr_yunxing: "frost",
      sr_qingming: "water",
      sr_wanyao: "forest",
      sr_xingchen: "sky",
      sr_guixu: "void",
      sr_leize: "flame",
      sr_minghe: "void",
      sr_xuanyuan: "ruin",
      sr_zhuxian: "palace",
    };
    const actual = Object.fromEntries(
      SECRET_REALMS.map((r) => [r.id, sceneTerrainOfSecretRealm(r.id)]),
    );
    expect(actual, "有一处的落点变了 —— 改表请连着改这张期望表并写明理由").toEqual(expected);
  });

  it("每一处都分得到画,且认不出的有兜底", () => {
    for (const r of SECRET_REALMS) {
      expect(SCENE_TERRAINS).toContain(sceneTerrainOfSecretRealm(r.id));
    }
    /*
     * 秘境都是**某一处地界**,没有「无处」这一档 —— 故认不出落回山岳,
     * 不回 null(与道侣那条不同:那里空表本身是一个答案,这里不是)。
     */
    expect(sceneTerrainOfSecretRealm(null)).toBe("peaks");
    expect(sceneTerrainOfSecretRealm("no-such-realm")).toBe("peaks");
  });

  it("名录真接上了画,且按这一处取景", () => {
    const src = readSource(CARD);
    expect(src, "秘境名录仍是纯文字 —— 344 行模板里一个 svg 都没有").toContain("<InkScene");
    const call = src.match(/sceneTerrainOfSecretRealm\(([^)]*)\)/)?.[1] ?? "";
    expect(call, "定位不到取景那一处 —— 判据会空转").not.toBe("");
    expect(call, "取景要读这一处").toMatch(/\br\b|secretRealm/);
    expect(src, "不许退化成玩家脚下那片地").not.toMatch(
      /<InkScene[^>]*:world-id="player\.world\.id"/,
    );
  });

  it("画落在名录那一条按钮里,且不占布局", () => {
    const src = readSource(CARD);
    /*
     * 画必须在 `v-for="r in visibleList"` 那一条按钮里 —— 十五处若共用一张底,
     * 这名录就还是八行字。
     */
    const row = src.match(/v-for="r in visibleList"[\s\S]*?<\/button>/)?.[0] ?? "";
    expect(row, "定位不到名录那一条 —— 判据会空转").not.toBe("");
    expect(row, "画要落在每一条里").toContain("<InkScene");
    const css = readSource("src/styles/pages/adventure.css");
    /*
     * 不钉缩进:样式表里的缩进是格式化工具的事(`vp fmt` 会把顶层规则拉回第 0 列,
     * 而同一段规则在 `@layer` 里时是两格)—— 钉缩进的判据会被一次格式化打红,
     * 而 CSS 的语义与缩进无关。故按「选择器起到下一个右花括号」取,再自己剥缩进。
     */
    const rule =
      (src.match(/\.adventure-secret__scene\s*\{[\s\S]*?\n\s*\}/)?.[0] ?? "") ||
      (css.match(/\.adventure-secret__scene\s*\{[\s\S]*?\n\}/)?.[0] ?? "");
    expect(rule, "定位不到 .adventure-secret__scene —— 判据会空转").not.toBe("");
    expect(rule, "画要脱离流").toMatch(/position:\s*absolute/);
    expect(rule, "画不接指针").toMatch(/pointer-events:\s*none/);
  });
});
