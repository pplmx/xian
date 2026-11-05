/**
 * 名号页的灵兽谱也该有「曾相伴」—— 图鉴有四档,名册只有三档。
 *
 * ## 缺口:同一段相伴史,两本书各抄了一半
 *
 * `quests.petCompanions` 的注释写得很明确:「灵兽册『曾相伴/相伴中』档的
 * **唯一来源**。由 player.setPet 唤伴时记档;暂别/换伴都不除名,
 * 册上留的是『此世同行过』。」
 *
 * 图鉴那边**照做了**(`ui/codex` 的 `petStage` 收 `wasCompanion`,四档:
 * 未录 / 已结缘 / 曾相伴 / 相伴中)。
 *
 * 而名号页的灵兽谱**没读它**:`ui/titlesDesk` 的 `petEntryState` 只收
 * `{ owned, active }`,于是只有三档(相伴中 / 已结缘 / 未结缘)。
 *
 * 结果:一只你唤作伴、后来换了别的伙伴的灵兽,在名号页上仍是「已结缘」——
 * 与一只从没相伴过的灵兽长得一模一样。那段同行在名册里不存在。
 *
 * 更别扭的是名号页自己的分组提示写着「**相伴置顶** · 已契次之 · 品阶降序」——
 * 排序键里只有 `active`,一只"曾经相伴、此刻不随行"的灵兽既不置顶,
 * 也没有任何地方说明它曾相伴过。
 *
 * ## 做法:让名册与图鉴读同一份
 *
 * `petEntryState` 加收 `wasCompanion`,档位与 `PET_STAGE_NAMES` 对齐
 * (只是名册不需要"未录"那一档,它本来就把未结缘的写「未结缘」)。
 * 排序也跟着「相伴中 → 曾相伴 → 已结缘 → 未结缘」—— 与提示语一致。这条深浅梯子在
 * `core/petFateOrder` 按命途聚排之后仍然作数,只是挪到了**段内**那一根键上(见
 * `PET_ENTRY_DEPTH` 下面的用例):同一种走法里,同行深一点的先浮上来。
 *
 * 两本书从此读同一处 `quests.petCompanions`,不再各抄一半。
 */
import { describe, expect, it } from "vite-plus/test";
import { readSource } from "@/test/readSource";
import { petEntryState, PET_ENTRY_DEPTH } from "./titlesDesk";

describe("名号页灵兽态 · 四档与图鉴对齐", () => {
  it("仍在相伴 —— 最高一档", () => {
    const s = petEntryState({ owned: true, active: true, wasCompanion: true });
    expect(s.state).toBe("active");
    expect(s.label).toBe("相伴中");
  });

  it("曾经相伴、此刻不随行 —— 必须说出来", () => {
    const s = petEntryState({ owned: true, active: false, wasCompanion: true });
    expect(s.label, "曾相伴是一段真发生过的同行,不该落回「已结缘」").toBe("曾相伴");
  });

  it("结缘但从未相伴 —— 仍是已结缘", () => {
    const s = petEntryState({ owned: true, active: false, wasCompanion: false });
    expect(s.state).toBe("owned");
    expect(s.label).toBe("已结缘");
  });

  it("未结缘 —— 哪怕旧档里留着相伴标记,也不发明一段相遇", () => {
    const s = petEntryState({ owned: false, active: false, wasCompanion: true });
    expect(s.state, "没结的缘不认相伴标记,与 codex 的 petStage 同一条底线").toBe("locked");
    expect(s.label).toBe("未结缘");
  });

  it("此刻正伴着、但曾相伴标记缺失 —— 不落回「已结缘」", () => {
    const s = petEntryState({ owned: true, active: true, wasCompanion: false });
    expect(s.state).toBe("active");
    expect(s.label).toBe("相伴中");
  });
});

describe("名号页灵兽态 · 与图鉴共享那条底线", () => {
  /*
   * 两份实现**不**逐格相等,而且不该相等 —— 它们回答的是两个问题:
   *
   *   codex.petStage  —— 图鉴的**深度**(我把它记到多深)。故「相伴中」要求
   *                     曾相伴标记真记过档:current 单独撑不起最深的档
   *                     (见 codex 里那条注释:怕的是存档缺标记就当满了)。
   *   petEntryState   —— 名册的**当下事实**(它此刻与我是哪一态)。
   *                     正伴着就是「相伴中」,不需要再查历史标记。
   *
   * 硬把两者拉齐会把其中一边改错。真正必须共享的是**底线**:
   * 没结的缘,两边都不认相伴标记 —— 别凭空发明一段相遇。
   */
  it("没结的缘:两边都不认相伴标记", async () => {
    const { petStage } = await import("./codex");
    expect(petStage({ collected: false, wasCompanion: true, current: false })).toBe(0);
    expect(petEntryState({ owned: false, active: false, wasCompanion: true }).label).toBe("未结缘");
  });

  it("记过档的曾相伴:两边都认得出这一段同行", async () => {
    const { petStage } = await import("./codex");
    expect(petStage({ collected: true, wasCompanion: true, current: false })).toBe(2);
    expect(petEntryState({ owned: true, active: false, wasCompanion: true }).label).toBe("曾相伴");
  });

  it("名册认得出的四种情形,图鉴都有对应档 —— 名册不多造一档", async () => {
    const { PET_STAGE_NAMES } = await import("./codex");
    const names = new Set<string>(PET_STAGE_NAMES as readonly string[]);
    for (const c of [
      { owned: true, active: true, wasCompanion: true },
      { owned: true, active: false, wasCompanion: true },
      { owned: true, active: false, wasCompanion: false },
      { owned: false, active: false, wasCompanion: false },
    ] as const) {
      const label = petEntryState(c).label;
      // 「未结缘」与图鉴的「未录」是同一件事的两种说法(名册在讲缘分,图鉴在讲收录)
      const normalized = label === "未结缘" ? "未录" : label;
      expect(names.has(normalized), `名册说「${label}」,图鉴没有这一档`).toBe(true);
    }
  });
});

describe("名号页灵兽态 · 只是状态文案", () => {
  it("不 import store / core / DOM —— 与其余读法同一条纪律", () => {
    const src = readSource("src/ui/titlesDesk.ts")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^\s*\/\/.*$/gm, "");
    expect(src).not.toMatch(/from ["']@\/stores\//);
    expect(src).not.toMatch(/from ["']@\/core\//);
  });

  it("真接线:名册把曾相伴标记递进去,不再只传两个布尔", () => {
    const view = readSource("src/views/TitlesView.vue");
    expect(view, "名册要读 quests.petCompanions").toContain("petCompanions");
    expect(view, "要把 wasCompanion 递给 petEntryState").toContain("wasCompanion");
  });
});

describe("灵兽谱段内排序用的深浅刻度 —— 与图鉴同一把尺", () => {
  it("四态的数值序 = 图鉴 PET_STAGE_NAMES 的下标序", async () => {
    const { PET_STAGE_NAMES } = await import("./codex");
    const ladder = [
      ["locked", "未录"],
      ["owned", "已结缘"],
      ["companion", "曾相伴"],
      ["active", "相伴中"],
    ] as const;
    ladder.forEach(([state, stageName], i) => {
      // 名册说「未结缘」、图鉴说「未录」—— 同一件事的两种说法,刻度必须是同一个数
      expect(PET_STAGE_NAMES[i], `图鉴第 ${i} 档不是「${stageName}」了`).toBe(stageName);
      expect(
        PET_ENTRY_DEPTH[state],
        `刻度「${state}」应为 ${i}(与图鉴第 ${i} 档对齐)—— 灵兽谱段内排序就靠这把尺`,
      ).toBe(i);
    });
  });

  it("刻度四档齐备且严格递增 —— 漏一档就是视图取不到值", () => {
    const values = Object.values(PET_ENTRY_DEPTH);
    expect(values).toHaveLength(4);
    expect([...values].sort((a, b) => a - b)).toEqual([0, 1, 2, 3]);
  });
});
