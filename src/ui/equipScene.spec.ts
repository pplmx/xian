/**
 * 器评帖 —— 十处装配席位,而帖上只有一枚图标。
 *
 * ## 现状
 *
 * 器评帖(`EquipmentDetailDialog`)是全作**内容最多的一扇浮层**:器性、词条、
 * 换装流派、工坊四块。它在 1280 宽下的卷身深度是 1.232 屏,**离 1.5 屏上限只剩
 * 约 130px** —— 添任何占布局的东西都危险。
 *
 * 而整帖的"画面"是器首左上一枚 30px 图标。`data/equipment` 的 `EQUIP_SLOT_NAMES`
 * 有十个席位(武器 / 头冠 / 衣袍 / 护腕 / 腰带 / 鞋履 / 项链 / 戒指 / 法宝 / 灵符),
 * 一件「雾隐长枪」与一件「星罗法衣」在帖上几乎读不出差别 —— 都是同一枚图标
 * 加一行「武器 / 衣袍」的小字。
 *
 * ## 做什么
 *
 * 按**这一件是哪一席**取景。席位是装备最稳定的身份:同席的件才互相抢,
 * 而玩家点开器评帖,第一件要知道的事就是「这是哪个部位的」。
 *
 * ## 判据守什么
 *
 *   一 十席各有各的画,不许共用一张底;
 *   二 取景读**这一件的席位**,不是玩家脚下那片地;
 *   三 **不占布局** —— 这一帖离 1.5 屏上限只剩约 130px,
 *      画必须是背景层(绝对定位、不接指针),否则器评帖会越过上限。
 */
import { describe, expect, it } from "vite-plus/test";
import { readSource } from "@/test/readSource";
import { EQUIP_SLOT_NAMES } from "@/data/equipment";
import { SCENE_TERRAINS, sceneTerrainOfSlot, type SceneTerrain } from "@/ui/sceneTerrain";

const DLG = "src/components/equipment/EquipmentDetailDialog.vue";
const CSS = "src/styles/pages/inventory.css";

describe("器评帖 · 这一件是哪一席", () => {
  it("十席把九种地形用满 —— 唯一那一对共用必须写得出理由", () => {
    /*
     * 九种地形装十个席位,必有**一对**共用 —— 这一条不能假装它们全不同。
     * 故钉两件事:
     *   一 九种地形**全都用上**(留一种空着,等于十席里有一对白白挤在同一片);
     *   二 共用的那一对只能是表里写明的那一对(护腕 / 腰带 —— 同一条工序的两件:
     *      缠手与束腰),换了别的对子就说明表被随手改了。
     */
    const byTerrain = new Map<SceneTerrain, string[]>();
    for (const [slot, name] of Object.entries(EQUIP_SLOT_NAMES)) {
      const terrain = sceneTerrainOfSlot(slot);
      expect(SCENE_TERRAINS, `${name} 落到一个不存在的地形`).toContain(terrain);
      byTerrain.set(terrain, [...(byTerrain.get(terrain) ?? []), slot]);
    }
    expect(byTerrain.size, `十席只用到 ${byTerrain.size} 种地形 —— 九种该用满`).toBe(
      SCENE_TERRAINS.length,
    );
    const shared = [...byTerrain.entries()].filter(([, slots]) => slots.length > 1);
    expect(shared.length, "十席九地形,只该有一对共用").toBe(1);
    expect(shared[0]![1].sort(), "共用的必须是护腕与腰带 —— 同一条工序的两件").toEqual([
      "belt",
      "wrist",
    ]);
  });

  it("认不出的席位落到山岳兜底", () => {
    expect(sceneTerrainOfSlot(null)).toBe("peaks");
    expect(sceneTerrainOfSlot("no-such-slot")).toBe("peaks");
  });

  it("器评帖真接上了画,且按这一件的席位取景", () => {
    const src = readSource(DLG);
    expect(src, "器评帖仍是纯文字 —— 整帖的画面是器首左上那枚 30px 图标").toContain("<InkScene");
    const call = src.match(/sceneTerrainOfSlot\(([^)]*)\)/)?.[1] ?? "";
    expect(call, "定位不到取景那一处 —— 判据会空转").not.toBe("");
    expect(call, "取景要读这一件的席位").toContain("slot");
    expect(src, "不许退化成玩家脚下那片地").not.toMatch(
      /<InkScene[^>]*:world-id="player\.world\.id"/,
    );
  });

  it("画不占布局 —— 这一帖离 1.5 屏上限只剩约 130px", () => {
    /*
     * `scripts/layout-check` 的「桌面浮层的卷身深度」量过:器评帖在 1280 宽下
     * 卷身 1.232 屏,上限 1.5。占布局的画会把它推过去 —— 而那一条判据是
     * 「浮层是读一小块的地方,不该比读整页还累」。
     *
     * 故这里是**背景层**:绝对定位、不接指针。样式落在 inventory.css
     * (器评帖的版面本来就在那一个文件里)。
     */
    const css = readSource(CSS);
    const rule = css.match(/\.equip-dossier__scene\s*\{[\s\S]*?\n  \}/)?.[0] ?? "";
    expect(rule, "定位不到 .equip-dossier__scene —— 判据会空转").not.toBe("");
    expect(rule, "画要脱离布局").toMatch(/position:\s*absolute/);
    expect(rule, "画不接指针").toMatch(/pointer-events:\s*none/);
    /*
     * 「不占布局」的具体含义是**脱离文档流**(absolute),不是"不许写 height":
     * 绝对定位的盒子本来就要自己给高度,写 height 不会把任何一节往下推。
     * 这里不钉 height —— 钉了会逼下一个人给一个绝对定位的盒子去掉高度,
     * 那样画会塌成 0。
     *
     * 真正要钉的是它不出现在两栏流里:器评帖在桌面是 `columns: 2`,
     * 一旦画带 `column-span` 或进了流,整帖的行就重排了。
     */
    expect(rule, "画不许参与两栏流").not.toMatch(/column-span/);
    /*
     * 高度必走 `--ink-scene-h` 而不是 `height`:这一层同时就是 `.ink-scene` 本身,
     * 而它自带 `height: var(--ink-scene-h, 100%)`(组件内的 scoped 规则带 data-v,
     * 特指度更高)。直接写 `height: 7rem` 会被那条盖过 ——
     * 实测那一刻画撑满整帖、盖住词条与工坊两节。
     */
    expect(rule, "高度要走 --ink-scene-h").toMatch(/--ink-scene-h:/);
    expect(rule, "别直接写 height —— 会被组件内那条盖过").not.toMatch(/(^|\n)\s*height:\s*[0-9]/);
  });
});
