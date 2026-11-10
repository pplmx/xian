/**
 * 「让看不见的机制可见」—— 这一条纪律的五个具体项,各自钉在某个界面上。
 *
 * ## 规矩出自哪里
 *
 * `AGENTS.md` 的「改动纪律」:
 *
 * > **让看不见的机制可见**:技艺进度、buff 叠加份数(「叠 N」)、合并真值
 * > (「现效合计」)、一次服药的上限(「至多可攒」/ 快捷卡「已顶」)、天时对渡劫
 * > 与产出的影响 —— 该露的都要露进界面,**不许只活在注释或 README 里**。
 *
 * ## 第 86 轮核过一遍
 *
 * 五项**全部实现了**,而且实现得不含糊:
 *
 * ```text
 *   技艺进度     BrewingDialog 的「技艺(按道分,做得多就精)」进度条
 *                EquipmentDetailDialog 的 forgeSkills(锻打/铭纹/器谱三行)
 *   buff 叠加份数 InventoryView:1079「已叠 N 份,服之续时」
 *                另有「药力已顶满——这一颗将白费」/「药力将触上限」两档
 *   合并真值     两处「现效合计」
 *   一次服药上限 InventoryView 的 overflow 三态 + 快捷卡「已顶」
 *   天时          CharacterView / RealmCodexView / HomeView / TribulationPanel
 * ```
 *
 * 这条纪律还被三处代码注释点名引用(`exploration.ts` / `offline.ts` /
 * `engineBuffs.ts`)—— 说明它真的在约束改动,不是一纸空文。
 *
 * ## 判据
 *
 * 它守的是**这五项不会悄悄消失**:每一面「该露的」都在某个 `.vue` 里有一处
 * 玩家可见的锚点。不检查措辞、不检查位置,只检查「还在不在」。
 *
 * 这比「扫描所有注释说该露的都露了」实在 —— 后者不可判定。
 */
import { describe, expect, it } from "vite-plus/test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { ROOT } from "@/test/readSource";

/** 五项「该露的机制」各自的锚点 */
const VISIBLE: readonly {
  item: string;
  /** 在哪些文件里找(任一命中即可) */
  files: readonly string[];
  /** 锚点文案(正则) */
  anchor: RegExp;
}[] = [
  {
    item: "技艺进度",
    files: [
      "src/components/inventory/BrewingDialog.vue",
      "src/components/equipment/EquipmentDetailDialog.vue",
    ],
    anchor: /技艺|forgeSkills/,
  },
  {
    item: "buff 叠加份数(「叠 N」)",
    files: ["src/views/InventoryView.vue"],
    anchor: /已叠\s*\$\{?stack|已叠/,
  },
  {
    item: "合并真值(「现效合计」)",
    files: ["src/views/CultivationView.vue", "src/components/cultivation/BuffDialog.vue"],
    anchor: /现效合计/,
  },
  {
    item: "一次服药的上限(「至多可攒」/「已顶」)",
    files: ["src/views/InventoryView.vue"],
    anchor: /至多可攒|已顶|药力已顶满/,
  },
  {
    item: "天时对渡劫与产出的影响",
    files: ["src/components/cultivation/TribulationPanel.vue", "src/views/CharacterView.vue"],
    anchor: /天时/,
  },
];

function collectVue(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name === "tp") continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) collectVue(full, out);
    else if (entry.name.endsWith(".vue")) out.push(full);
  }
  return out;
}

/** 全仓 .vue 的正文拼起来 —— 「现效合计」这类锚点可能搬了家,不该因为搬家就红 */
const ALL_VUE = collectVue(join(ROOT, "src"))
  .map((f) => readFileSync(f, "utf8"))
  .join("\n");

describe("看不见的机制 · 五项都在界面上露着", () => {
  for (const { item, files, anchor } of VISIBLE) {
    it(`${item} 有玩家可见的锚点`, () => {
      const found = files.some((rel) => {
        try {
          return anchor.test(readFileSync(join(ROOT, rel), "utf8"));
        } catch {
          return false; // 文件被搬走了 —— 退到全仓兜底
        }
      });
      /*
       * **不用全仓兜底**。第一版写的是 `found || anchor.test(ALL_VUE)`,
       * 而注入验证时把「已叠 ${stack} 份」删掉,判据照样绿 ——
       * 因为别的 `.vue` 里也有「已叠」二字,全仓兜底把缺陷吸收掉了。
       *
       * 判据要守的是「**这一项在它该在的那个界面上**」。搬家可以,
       * 但必须显式改 `files`,`files` 里找不到就红。
       */
      expect(
        found,
        `「${item}」在 ${files.join(" 或 ")} 里找不到了 —— AGENTS.md 要求它必须以界面形式存在,` +
          `不许只活在注释或 README 里。若搬了家,请把新位置写进 files。锚点:${anchor}`,
      ).toBe(true);
    });
  }

  it("反空转:五项都量到了,且全仓 .vue 数量正常", () => {
    expect(VISIBLE.length, "五项清单被删短了").toBeGreaterThanOrEqual(5);
    expect(ALL_VUE.length, "一个 .vue 都没扫到 —— 路径变了").toBeGreaterThan(100_000);
  });
});
