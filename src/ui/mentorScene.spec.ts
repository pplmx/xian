/**
 * 择师谱 —— 四脉各有自己的形象,而谱上只有四枚首字。
 *
 * ## 现状
 *
 * 师承弹窗在未拜师时是「择师谱」:四脉同列,MentorDialog 992 行,一脉签一条。
 * 每一签的"画面"是一枚楷体**首字**(剑 / 丹 / 阵 / 猎)加一段行为轴。
 *
 * 而 `data/mentors` 里每一脉都写着自己的形象:
 *
 *   剑修 · 一剑破万法 · 擅长单体爆发、命中、暴击 · 师尊青松剑叟
 *   丹修 · 草木通神   · 擅长丹药、恢复、炼丹     · 师尊百草婆婆
 *   阵修 · 定鼎乾坤   · 擅长护盾、控制、减伤     · 师尊玄机子
 *   猎修 · 踏遍山河   · 擅长历练、掉落、异兽     · 师尊哮天翁
 *
 * 四脉是**四种完全不同的活法**:剑是锋、丹是草木、阵是格局、猎是山河。
 * 这是一屏「择一而事之」的地方,而四签看起来只有字不同。
 *
 * ## 判据守什么
 *
 *   一 四脉各有各的画,不许共用一张底;
 *   二 已定师承那一帖也画同一片(它是同一件事的后半截);
 *   三 画落在**签内**(不是整谱一张底):四脉要能并排比较,一张底就分不出谁是谁。
 */
import { describe, expect, it } from "vite-plus/test";
import { readSource } from "@/test/readSource";
import { MENTORS } from "@/data/mentors";
import { SCENE_TERRAINS, sceneTerrainOfMentor, type SceneTerrain } from "@/ui/sceneTerrain";

const DLG = "src/components/character/MentorDialog.vue";

describe("择师谱 · 四脉各一副形象", () => {
  it("四脉各有各的画 —— 不许共用一张底", () => {
    const seen = new Map<SceneTerrain, string>();
    for (const m of MENTORS) {
      const terrain = sceneTerrainOfMentor(m.id);
      expect(SCENE_TERRAINS, `${m.name} 落到一个不存在的地形`).toContain(terrain);
      const clash = seen.get(terrain);
      expect(clash, `${m.name} 与 ${clash} 画成了同一片(${terrain})`).toBeUndefined();
      seen.set(terrain, m.name);
    }
    expect(seen.size, "四脉该有四副长相").toBe(MENTORS.length);
  });

  it("认不出的师承落到山岳兜底,不是空白", () => {
    /*
     * 与道侣那条相反:师承是**门内**的四脉,一定属于某处山门。
     * 认不出时给山岳(山门本就立在山上),而不是 null —— 这里没有
     * 「随处可遇」那种答案。
     */
    expect(sceneTerrainOfMentor(null)).toBe("peaks");
    expect(sceneTerrainOfMentor("no-such-mentor")).toBe("peaks");
  });

  it("择师谱每一签都画,已定师承那一帖也画", () => {
    const dlg = readSource(DLG);
    expect(dlg, "择师谱仍是纯文字 —— 四签只有四枚首字不同").toContain("<InkScene");
    /*
     * 两处都要:谱上四签各一条(并排比较),契后那一帖一条(同一个身份)。
     * 只做一处的话,同一件事的前后半截会一半有画一半没有。
     */
    const count = (dlg.match(/<InkScene/g) ?? []).length;
    expect(count, `只接了 ${count} 处画 —— 择师谱与师承帖都要有`).toBeGreaterThanOrEqual(2);
    expect(dlg, "取景要读这一脉的 id").toMatch(/sceneTerrainOfMentor\(/);
  });

  it("画落在签内 —— 四脉并排比较,一张底就分不出谁是谁", () => {
    const dlg = readSource(DLG);
    /*
     * 若把 InkScene 放在 `v-for` 外面(整谱一张底),四签共用同一片天,
     * 这一屏就还是「四个色块加四行字」。故画必须在那条 `v-for` 的循环体内。
     */
    const loop = dlg.match(/v-for="\(m, index\) in choices"[\s\S]*?<\/button>/)?.[0] ?? "";
    expect(loop, "定位不到四签的循环 —— 判据会空转").not.toBe("");
    expect(loop, "四签的画要落在每一签里").toContain("<InkScene");
  });
});
