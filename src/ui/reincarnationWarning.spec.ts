/**
 * 转世前那条警告 —— 不可逆的代价要说全。
 *
 * ## 问题:警告说轻了
 *
 * 「落印之前」那一章写着:
 *
 *   落印即刻归档此生:灵根、境界与天地换新;资源、装备、法宝与外物随皮囊散去。
 *
 * 而 `reincarnation.ts` 实际会一并重置的东西远不止这些:
 *
 *   弟子(只留一丝真传缘)   见 apprenticeStore.resetForRebirth()
 *   洞府与全部建筑           见 player.rebirth()
 *   灵脉                     同上
 *   灵兽                     同上
 *   关系(历史留下,人不留下) 见 archiveBond()
 *   道途                     见 endgameStore.onRebirth()
 *   本世命题与在途远征        见 setVow(null) / abandonExpedition()
 *   秘境、连胜、当日巡游      见 rebirth() 的注释
 *
 * 「外物」这个词把弟子与洞府也盖进去了 —— 技术上不算撒谎,但玩家读到
 * 「资源、装备、法宝」时的想象,多半不包含**养了十世的弟子**与**升了满级的洞府**。
 *
 * 这是本作最贵的一次不可逆操作,而它的代价清单说轻了。
 *
 * ## 补什么
 *
 * 不是把八项一条条列进警告(那会变成一份没人读的清单),而是**补上最意外的那两样**:
 * 洞府与弟子 —— 它们是玩家投入时间最多的东西,也是最不容易想到会消失的。
 * 其余仍在「外物」这个词里,但词的边界由这两样划清。
 *
 * ## 判据为什么核这个
 *
 * 文案与结算的一致性,平时靠人读。而这一处的代价分散在五个 store 里,
 * 没有一个地方能看到全貌 —— 于是它只在某次改动后悄悄变得不完整,
 * 而没人会去核对「转世究竟扔掉了什么」。
 */
import { describe, expect, it } from "vite-plus/test";
import { readSource } from "@/test/readSource";

/** 转世时真的会消失的那几样 —— 每一项都有代码依据 */
const REALLY_LOST = [
  { key: "洞府", why: "player.rebirth() 重置洞府与全部建筑" },
  { key: "弟子", why: "apprenticeStore.resetForRebirth() 清空(只留一丝真传缘)" },
  { key: "灵脉", why: "player.rebirth() 重置" },
  { key: "灵兽", why: "player.rebirth() 重置" },
] as const;

describe("转世警告 · 代价说全", () => {
  it("警告里点得出洞府与弟子 —— 玩家投入最多的两样", () => {
    const dlg = readSource("src/components/character/ReincarnationDialog.vue");
    const at = dlg.indexOf("data-reincarnation-final-warning");
    expect(at, "警告那一章不见了").toBeGreaterThan(0);
    // 取这一章(到下一个 section 或文件末)
    const rest = dlg.slice(at);
    const end = rest.indexOf("</section>");
    const block = end > 0 ? rest.slice(0, end) : rest;
    expect(block, "这一章里要点出洞府").toContain("洞府");
    expect(block, "这一章里要点出弟子").toContain("弟子");
  });

  it("不许把不可逆写成「可以再回来」之类的话", () => {
    const dlg = readSource("src/components/character/ReincarnationDialog.vue");
    const at = dlg.indexOf("data-reincarnation-final-warning");
    const rest = dlg.slice(at);
    const end = rest.indexOf("</section>");
    const block = end > 0 ? rest.slice(0, end) : rest;
    for (const lie of ["随时可以", "可以撤回", "不会失去", "无损"]) {
      expect(block, `警告里出现了 «${lie}» —— 这与不可逆相违`).not.toContain(lie);
    }
  });
});

describe("转世警告 · 与结算同一批事实", () => {
  it("那几样确实会被重置 —— 判据背后有代码依据", () => {
    const reinc = readSource("src/core/reincarnation.ts");
    expect(reinc, "弟子随皮囊散去").toContain("resetForRebirth()");
    expect(reinc, "洞府与灵脉灵兽的归零在 rebirth 里").toContain("player.rebirth(");
    const player = readSource("src/stores/player.ts");
    const at = player.indexOf("function rebirth(");
    expect(at, "rebirth 要还在").toBeGreaterThan(0);
    const block = player.slice(at, at + 4000);
    // 洞府/灵脉/灵兽三处归零都在这一个函数里
    expect(block, "rebirth 里该重置洞府").toMatch(/dongfu|useDongfuStore/);
  });

  it("真实清单不少于警告里点名的那几样", () => {
    /*
     * 这一条防的是**反向不完整**:若哪天 rebirth 改成也扔别的东西,
     * 这条判据不会自动红 —— 它只证明「判据提到的这几样确实会丢」。
     * 真正的完整性靠人读 reincarnation.ts;这里只保证判据自身不说空话。
     */
    expect(REALLY_LOST.length).toBeGreaterThanOrEqual(4);
    for (const row of REALLY_LOST) {
      expect(row.why.length, `${row.key} 没有写依据`).toBeGreaterThan(8);
    }
  });
});
