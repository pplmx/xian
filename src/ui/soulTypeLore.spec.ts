/**
 * 器魂六类的形意来历 —— 六句话写了,却一个字都没进过界面。
 *
 * ## 复现:数据早就在,只是没人读
 *
 * `data/souls.ts` 的 `SOUL_TYPES` 每一类都带一句 `desc`,写的是这一缕形意**从哪来**:
 *
 *   > 此器生来向前,不曾回头——形意里只剩一往无前的那一分锐   (锋魂)
 *   > 挡过太多次,连魂里都是那道罡气的形状                     (盾魂)
 *   > 被劈砍得久了,便学会了把力还回去                         (棘魂)
 *   > 出手从来不止一次,这习惯连天道也抹不掉                   (连魂)
 *   > 养过太多伤,魂里存着一点不肯断的生机                     (泽魂)
 *   > 越是绝境越亮,这器物大约陪主人走过几回鬼门关             (背魂)
 *
 * 而 `grep 'soulTypeDef(' src --include=*.vue` 只命中两处:**取印章单字**与**取类型名**。
 * `desc` 一次都没被读过 —— 六句写好的叙事,玩家一个字也看不到。
 *
 * ## 为什么这一处特别值得补
 *
 * 器魂页**全部**的说明性文字,此前只有三样:类型名(锋魂/盾魂…)、阶名(朦胧/凝实…)、
 * 以及一行 `modsText` 的词条账。于是玩家看到的是「锋魂·通灵 · 暴击率 +7% 首回合伤害 +15.75%」
 * —— 一个编号加一串数,没有任何一句告诉他**形意是什么**。
 *
 * 而本仓对「让看不见的机制可见」的要求,不只是数值得可见:
 * 器铭、契语、道记、品评都回答「它是什么」,器魂这一类恰恰是**从别的器物上剥下来**的,
 * 「它原先属于什么样的主人」正是它最该有的那句话。
 *
 * ## 与别的文字的分工(同一屏会出现三句,不许说同一件事)
 *
 *   类型 desc  —— **它从哪来**(这只器物经历过什么)
 *   modsText   —— **它给你什么**(数值)
 *   阶名       —— **它有多浓**(朦胧 → 化真)
 *
 * 三句各答一件事,与灵兽「desc / 契语 / 词条」的分工同构。
 *
 * ## 判据守什么
 *
 *   一 六类都有一句形意来历(不是空串) —— 缺一类,那一类的详情就是干的;
 *   二 详情面板真的渲染它 —— 数据在而界面不读,正是这条判据要拦的那种;
 *   三 它不带数字 —— 与契语、铭文、品评同一条纪律(数字归 modsText,改常数那天文字就开始撒谎)。
 */
import { describe, expect, it } from "vite-plus/test";
import { readSource } from "@/test/readSource";
import { SOUL_TYPES } from "@/data/souls";

describe("器魂形意来历 · 六句话都要读得到", () => {
  it("六类各有一句形意来历", () => {
    const blank = SOUL_TYPES.filter((t) => !t.desc || t.desc.trim().length === 0).map(
      (t) => t.name,
    );
    expect(blank, `这些器魂类没有形意来历,详情面板会是干的:${blank.join(" / ")}`).toEqual([]);
  });

  it("每句都不带数字 —— 数字归 modsText", () => {
    for (const t of SOUL_TYPES) {
      expect(t.desc, `${t.name} 的形意来历带了数字`).not.toMatch(/[0-9０-９]/);
    }
  });

  it("六句两两不同 —— 六类若共用一句话,分类就成了摆设", () => {
    const seen = new Map<string, string>();
    for (const t of SOUL_TYPES) {
      expect(seen.has(t.desc), `${t.name} 的来历与 ${seen.get(t.desc)} 重复`).toBe(false);
      seen.set(t.desc, t.name);
    }
  });

  it("详情面板真的渲染它 —— 数据在而界面不读,正是这条要拦的", () => {
    const view = readSource("src/views/SoulsView.vue");
    expect(view, "器魂详情要读类型自带的形意来历").toContain("soulTypeDesc(");
    expect(view, "要有稳定落点供真浏览器复核").toContain("data-soul-type-lore");
  });

  it("凝炼预览也报「将凝出什么样的形意」—— 入炉之前就该知道", () => {
    const view = readSource("src/views/SoulsView.vue");
    // 预览里已有的那行「将凝出 X阶·Y魂」之外，同一屏还要有一句来历
    const loreHits = view.match(/soulTypeDesc\(/g) ?? [];
    expect(loreHits.length, "详情与凝炼预览两处都该读这一句").toBeGreaterThanOrEqual(2);
  });
});
