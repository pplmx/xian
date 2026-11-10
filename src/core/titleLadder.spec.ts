/* oxlint-disable no-console -- 阶梯读数是要给人看的 */
/**
 * 境界称号的梯子 —— 每一大境界都得有一顶
 *
 * 称号此前零散地挂在几个境界上(0~3、9、14、20),中间十余境走完连个名字都没留下:
 * 荣誉是这套游戏里最便宜的"里程碑"表达,却只在两头有。这条判据把它补齐并钉住:
 *
 *   一 每个「突破某境」的成就(a_rN)都得给一顶称号 —— 缺了谁就点名;
 *   二 每顶称号都得真实存在(TITLES 里查得到),且两境不共用一顶;
 *   三 称号不能是空壳(至少给一条词条)—— 荣誉也得有实感。
 *
 * 故障注入:去掉任一 a_rN 的 titleId,或让两境指向同一顶称号,本文件立刻红。
 */
import { describe, expect, it } from "vite-plus/test";
import { ACHIEVEMENTS } from "@/data/achievements";
import { TITLES, titleDef } from "@/data/titles";
import { REALMS, MAX_MAJOR } from "@/data/realms";
import { budgetOfMods } from "./ruleBudget";

/** 「突破某境」的成就:条件类型是 realm */
const REALM_ACHIEVEMENTS = ACHIEVEMENTS.filter((a) => a.cond.type === "realm");

describe("境界称号 · 每一境都有一顶", () => {
  it("每个「突破某境」的成就都给一顶称号", () => {
    const missing: string[] = [];
    for (const a of REALM_ACHIEVEMENTS) {
      if (!a.reward?.titleId) missing.push(`a_r${(a.cond as { major: number }).major}(${a.name})`);
    }
    expect(
      missing,
      `这些境界的成就没给称号 —— 玩家过完这一境,什么名分也没留下:${missing.join("、")}`,
    ).toEqual([]);
  });

  it("21 个大境界一个不落(0~20 各有其境成就与称号)", () => {
    const byMajor = new Map(
      REALM_ACHIEVEMENTS.map((a) => [(a.cond as { major: number }).major, a]),
    );
    const missingRealms: string[] = [];
    for (let m = 0; m <= MAX_MAJOR; m++) {
      if (!byMajor.get(m)?.reward?.titleId) missingRealms.push(`${m} ${REALMS[m]!.name}`);
    }
    expect(missingRealms, `这些大境界没有境界称号:${missingRealms.join("、")}`).toEqual([]);
  });

  it("称号真实存在、两境不共用,且不是空壳", () => {
    const used = new Map<string, number>();
    for (const a of REALM_ACHIEVEMENTS) {
      const id = a.reward?.titleId;
      if (!id) continue;
      const major = (a.cond as { major: number }).major;
      expect(titleDef(id), `a_r${major} 指向了不存在的称号 ${id}`).toBeDefined();
      expect(
        used.has(id),
        `称号「${titleDef(id)!.name}」被两个境界共用(${used.get(id)} 与 ${major})`,
      ).toBe(false);
      used.set(id, major);
      expect(
        Object.keys(titleDef(id)!.mods).length,
        `称号「${titleDef(id)!.name}」是空壳,不给任何属性`,
      ).toBeGreaterThan(0);
    }
    expect(used.size, "境界称号数量与境界数对不上").toBe(MAX_MAJOR + 1);
    expect(TITLES.length).toBeGreaterThanOrEqual(used.size);
  });

  /**
   * **荣誉阶梯不许回落** —— 玩家能佩戴一枚,所以"后一境的称号更弱"是直接可见的荒谬:
   * 换来换去,发现证道混沌道祖那顶还比不上开天神魔。
   *
   * 实测(修前)的断口:
   *   元婴大能(境3)0.3 < 金丹老祖(境2)0.4
   *   万道之祖(境20)0.4 < 开天神魔(境19)0.6、神帝独尊 0.6
   * 修法沿用保守方向:按境界 +0.02 预算一档,**只抬低于阶梯的**,已发出去的称号不削弱。
   * 判据用"复杂度预算"(ruleBudget)当尺子,容差取它的取整粒度 0.1。
   */
  it('境界称号的预算随境界不降(只抬不削)+ 顶端配得上"证道道祖"', () => {
    const rows = REALM_ACHIEVEMENTS.map((a) => ({
      major: (a.cond as { major: number }).major,
      def: titleDef(a.reward!.titleId!)!,
    })).sort((x, y) => x.major - y.major);
    console.log("\n—— 境界称号阶梯(预算;容差 0.1 为取整粒度) ——");
    for (const r of rows) {
      console.log(
        `  境${String(r.major).padStart(2)} ${REALMS[r.major]!.name.padEnd(5)} ${r.def.name.padEnd(6)} ${budgetOfMods(r.def.mods).toFixed(1)}`,
      );
    }
    for (let i = 1; i < rows.length; i += 1) {
      const prev = budgetOfMods(rows[i - 1]!.def.mods);
      const cur = budgetOfMods(rows[i]!.def.mods);
      expect(
        cur,
        `${REALMS[rows[i]!.major]!.name}的称号「${rows[i]!.def.name}」(${cur})弱于前一境「${rows[i - 1]!.def.name}」(${prev})`,
      ).toBeGreaterThanOrEqual(prev - 0.1 - 1e-9);
    }
    const top = budgetOfMods(rows[rows.length - 1]!.def.mods);
    expect(top, "全境之极的称号不该比中段还轻").toBeGreaterThanOrEqual(0.7);
  });
});

/**
 * 称号的说明句不许是境界说明句的复印件。
 *
 * ## 缺口
 *
 * 29 顶称号里有 **14 顶(48%)** 的 `desc` 与对应境界的 `desc` **逐字相同**:
 * 玩家在名号页读到「神王御宇 —— 神域之主,言出法随」,翻到界域志同一句又出现。
 * 称号本该答「**我凭什么荣誉**」,却答成了「**我处在什么境界**」——
 * 而后者名号谱上方已经用境界名说过了。
 *
 * 这属于跨页重复,`layout-check` 的首屏判据结构上管不到(它只量单屏 `main` 内可见叶子)。
 * 故在数据层用集合交集拦:两表 desc 不许有交集。开销极小,且可证伪
 * —— 修之前它会红 14 处。
 *
 * ## 另一半:名分的归属
 *
 * 数据里还有一处**比重复更严重**的错位:称号「神域之主」挂在神人境(境 14)的成就下,
 * 而 `realms.ts` 的神王 lore 明写「神域之主为神王」,任务 `q_shenwang` 也叫这个名。
 * 于是玩家在名号谱上先以神人境自称神域之主,翻两格又读到神王自称同一句。
 * 这条判据守的是「同名同句不许属于两个档位」:同一句 desc 只能有一处主人。
 */
describe("称号 · 说明句不许复述境界", () => {
  it("称号 desc 与境界 desc 无交集(跨表复读)", () => {
    const realmDescs = new Map(REALMS.map((r) => [r.desc, r.name]));
    const copied = TITLES.filter((t) => realmDescs.has(t.desc)).map(
      (t) => `${t.name}「${t.desc}」= 境界「${realmDescs.get(t.desc)}」`,
    );
    expect(
      copied,
      "这些称号的说明句与境界说明句逐字相同 —— 称号该答「凭什么」,不复述「我是什么」:" +
        copied.join("、"),
    ).toEqual([]);

    // 防空转:两表都真的读到了东西
    expect(TITLES.length, "一顶称号都没读到 —— 判据会空转").toBeGreaterThan(20);
    expect(REALMS.length, "一个境界都没读到 —— 判据会空转").toBeGreaterThan(10);
  });

  it("称号 desc 两两不同 —— 29 顶不许共用一句", () => {
    const seen = new Map<string, string>();
    const dup: string[] = [];
    for (const t of TITLES) {
      const prev = seen.get(t.desc);
      if (prev) dup.push(`${prev} 与 ${t.name} 共用「${t.desc}」`);
      else seen.set(t.desc, t.name);
    }
    expect(dup, "这些称号共用同一句说明:" + dup.join("、")).toEqual([]);
  });

  it("「神域之主」这名分归神王,不归神人境的称号", () => {
    /*
     * 两侧都量:
     *   ① 神王境(境 16)的称号说明句里要有「神域」—— 名分在它手上;
     *   ② 神人境(境 14)那顶称号的名字里不许出现「神域之主」—— 不许先自称。
     * 只核一边会漏掉「两边都叫」这种更坏的情形。
     */
    const byMajor = new Map(
      ACHIEVEMENTS.filter((a) => a.cond.type === "realm").map((a) => [
        (a.cond as { major: number }).major,
        a,
      ]),
    );
    const shenwang = titleDef(byMajor.get(16)!.reward!.titleId!);
    const shenren = titleDef(byMajor.get(14)!.reward!.titleId!);
    expect(shenwang, "神王境的称号查不到 —— 判据会空转").toBeDefined();
    expect(shenren, "神人境的称号查不到 —— 判据会空转").toBeDefined();
    expect(shenwang!.desc, "神王的称号该守着「神域」这个名分").toContain("神域");
    expect(shenren!.name, "神人境的称号又叫「神域之主」—— 那是神王的名分").not.toBe("神域之主");
    // 而且给出的名字必须真是它的名字(不是留空糊过去)
    expect(shenren!.name.length, "称号名不许留空").toBeGreaterThan(2);
  });
});
