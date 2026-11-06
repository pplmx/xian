/**
 * 离线归来的际遇回执 —— 千载难逢的那一次,和路边小事长得一样。
 *
 * ## 缺口:三档稀有度,在归来卷轴上全塌平了
 *
 * 历练途中的际遇分三档,这一作把它做得很清楚:
 *
 * ```text
 * 际遇  路上撞见的事,常来            约每 9 程一次
 * 奇缘  你这条缘的下一程              约每 20 程一次
 * 机缘  千载难逢的大机遇到           约每 450 程一次
 * ```
 *
 * 三档各有自己的名字、颜色与提示(见 `core/eventTier`),历练页上看得见。
 *
 * 但**离线归来**时,这些回执被装进 `OfflineEventReceipt`,而它只有三个字段:
 *
 * ```ts
 * interface OfflineEventReceipt {
 *   title: string;
 *   lines: string[];
 *   count: number;
 * }
 * ```
 *
 * 没有档位。于是归来卷轴上,一次千载难逢的「机缘」与一次路边「际遇」并排摆着,
 * 同一个星形图标、同一个「际遇结果」小标题 —— 玩家离线八小时,恰好撞上了那一次
 * 每 450 程才有的大机遇,回来却看不出来。
 *
 * ## 为什么这一处值得修
 *
 * 这一作在别处都为"稀有度要被看见"做了事:品阶有五感分层、成就按品阶盖印、
 * 连提示条停多久都随档走。唯独**离线归来**这一屏 —— 恰恰是玩家最可能错过内容的
 * 地方(他不在的时候发生的一切,只有这一屏能告诉他)—— 把三档塌成了一档。
 *
 * ## 判据守什么
 *
 * 一条:`OfflineEventReceipt` 要带事件档位,且由 `eventTierOf` 从事件 id 推出
 * (不另写一份「ft_ 开头是机缘」的判据),卷首也真把它显示出来。
 */
import { describe, expect, it } from "vite-plus/test";
import { readSource } from "@/test/readSource";

const TYPES = "src/types/index.ts";
const ENGINE = "src/core/eventEngine.ts";
const DIALOG = "src/components/offline/OfflineRewardDialog.vue";

describe("离线归来的际遇回执 · 要说得出是哪一档", () => {
  it("回执带着事件档位", () => {
    const src = readSource(TYPES);
    const iface = src.match(/export interface OfflineEventReceipt \{[\s\S]*?\n\}/)?.[0] ?? "";
    expect(iface, "定位不到 OfflineEventReceipt —— 判据会空转").not.toBe("");
    expect(iface, "OfflineEventReceipt 没有档位 —— 归来卷轴上「机缘」与「际遇」长得一样").toMatch(
      /tier/i,
    );
  });

  it("档位由 eventTierOf 推出,不另写一份判据", () => {
    const eng = readSource(ENGINE);
    expect(eng, "事件结算要把档位记进回执").toMatch(/eventTierOf\(/);
    /*
     * 守的是「不许用事件 id 的字面前缀去决定档位」——而不是「不许出现 ft_」。
     * 实测撞过这个坑:eventEngine 里另有一处 `if (def.id.startsWith("ft_"))`,
     * 那是记「机缘链」的选择(取/弃影响未来),与档位无关。按前缀一刀切会误伤它。
     *
     * 故判据盯的是「前缀 → 档位判定」这个组合:同一行里既有前缀判断、
     * 又给档位/档名/颜色赋值,那才是另立了一份口径。
     */
    const lines = eng.split("\n");
    const offenders = lines.filter(
      (l) => /startsWith\(\s*["']ft_/.test(l) && /(Tier|tier|机缘|奇缘|际遇)/.test(l),
    );
    expect(offenders, "不许用事件 id 前缀去判档位 —— 那个口径只在 core/eventTier").toEqual([]);
  });

  it("归来卷轴真的把档位显示出来", () => {
    const dialog = readSource(DIALOG).replace(/<!--[\s\S]*?-->/g, "");
    expect(dialog, "卷轴要显示回执的档位").toMatch(/receipt\.tier|tierName|tierDef/);
  });

  it("反空转:回执仍要保留标题与逐行明细", () => {
    const src = readSource(TYPES);
    const iface = src.match(/export interface OfflineEventReceipt \{[\s\S]*?\n\}/)?.[0] ?? "";
    expect(iface, "标题不能丢").toContain("title");
    expect(iface, "逐行明细不能丢").toContain("lines");
  });
});
