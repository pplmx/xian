/**
 * 同源审计 —— 同一件事只许有一处算法(读源码文本)
 *
 * 本仓库反复踩的坑(见 HYP-015):同一件事写两遍,改一处必漏一处 ——
 * 界面手抄一份结算常数、在线离线各写一个门槛、会话另算一份收益。
 *
 * 这类缺陷**行为测试看不见**:界面自己又算一遍时,数值照样"对",直到有人调了那半边。
 * 故这里直接读源码文本,把「谁都不许再抄一遍」写成断言。
 */
import { describe, expect, it } from "vite-plus/test";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

const SOURCES = import.meta.glob(
  [
    "../views/AdventureView.vue",
    "../components/adventure/CombatPanel.vue",
    "../core/exploration.ts",
    "../core/offline.ts",
    "../core/engineWorld.ts",
  ],
  { query: "?raw", import: "default", eager: true },
) as Record<string, string>;

/**
 * 取某文件源码。按**文件名**取,不按路径 ——
 * glob 的键是相对本文件的路径('../views/…' 与 './exploration.ts' 两种形状混在一起),
 * 按路径匹配会漏掉同目录的那两个,漏了就会在空字符串上假绿。
 */
function readSrc(fileName: string): string {
  const hit = Object.entries(SOURCES).find(([path]) => path.split("/").pop() === fileName);
  if (!hit) throw new Error(`审计读不到 ${fileName} —— glob 没匹配上,断言会假绿`);
  return hit[1];
}

const SRC = resolve(__dirname, "..");

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.(ts|vue)$/.test(entry) && !entry.endsWith(".spec.ts")) out.push(full);
  }
  return out;
}

describe("同源审计 · 镇压速率", () => {
  it("历练页的镇压速率走 suppressRateFor,自己不许再算一遍 stoneByTier", () => {
    const src = readSrc("AdventureView.vue");
    expect(src, "界面必须用唯一那份速率实现").toContain("suppressRateLine");
    // 判「有没有再算一遍」而不是「有没有提到这个词」:注释里解释这件事本身是好事
    expect(src, "界面自己算一遍就等于第二份真相源(调常数时界面开始撒谎)").not.toMatch(
      /stoneByTier\s*\(/,
    );
  });
});

describe("同源审计 · 区域之主的门槛", () => {
  /**
   * 门槛搬家了:它现在是**公共库副本系统的一份配置**(见 core/engineWorld 的
   * bossProgress / bossRhythm),不再是两个模块各自比较一个常数。
   * 判据跟着搬家,但意图不变 —— 而且更严了:常数只许在一处出现。
   */
  it("在线与离线都走 winsUntilRegionBoss,谁都不许再自己比一遍门槛", () => {
    for (const fileName of ["exploration.ts", "offline.ts"]) {
      const src = readSrc(fileName);
      expect(src, `${fileName} 该走 winsUntilRegionBoss(门槛与节奏的唯一入口)`).toContain(
        "winsUntilRegionBoss",
      );
      expect(src, `${fileName} 不许再引用门槛常数 —— 它的唯一住处是公共库副本配置`).not.toContain(
        "EXPLORE_BOSS_AFTER_WINS",
      );
      expect(src, `${fileName} 里又出现了 wins >= 10 这种字面量`).not.toMatch(/wins\s*>=\s*10\b/);
    }
    expect(readSrc("engineWorld.ts"), "门槛常数的唯一住处:装配公共库副本系统的那一处").toContain(
      "EXPLORE_BOSS_AFTER_WINS",
    );
  });

  it("战斗页的头目提示走 winsUntilRegionBoss,不自己比门槛", () => {
    const src = readSrc("CombatPanel.vue");
    expect(src).toContain("winsUntilRegionBoss");
    expect(src, "提示自己比一遍门槛,改常数时提示就开始撒谎").not.toContain(
      "EXPLORE_BOSS_AFTER_WINS",
    );
  });
});

describe("同源审计 · 历练收益账", () => {
  it("会话收益取 afterWin 真实入账,不自己按层级另算,也不数文案行", () => {
    const src = readSrc("exploration.ts");
    expect(src, "会话该记 afterWin 报的 drops.stone / drops.exp / drops.items").toMatch(
      /drops\.(stone|exp|items)/,
    );
    expect(src, "自己按层级算一份灵石 = 与行囊对不上的第二套账").not.toMatch(/stoneByTier\s*\(/);
    expect(src, "items 属实物件数,不许拿文案行数充数").not.toMatch(/drops\.lines\.length/);
  });

  it("离线把挂机所得折进会话(回来接着打时面板不漏离线段)", () => {
    const src = readSrc("offline.ts");
    expect(src).toMatch(/stoneGain:\s*add\(current\.stoneGain/);
    expect(src).toMatch(/expGain:\s*add\(current\.expGain/);
  });
});

/**
 * 同源审计 · 收徒成本 —— 报价与扣费必须是同一个函数。
 *
 * 这一条是本轮补的:从前 store 的 recruit 里算一次
 * (`stoneByTier(major, APPRENTICE_RECRUIT_TIER_AMOUNT)`),弟子页又算一次,
 * 两处注释都写着"与另一边同源"。那不是同源,是**同一个公式的副本**:
 * 改了参数或公式,玩家看到的价格就和实际扣的灵石分家,而两边各自都"算对了"。
 *
 * 为什么 old 判据没抓到:SOURCES 的 glob 只列了 5 个文件,弟子页与弟子 store
 * 都不在其中。这条判据按**行为**钉,不按文件清单钉 —— 任何地方再自算一遍都红。
 */
describe("同源审计 · 收徒成本", () => {
  it("收徒成本只有一处实现:apprenticeRecruitCost", () => {
    const svcMod = import.meta.glob("../core/apprenticeService.ts", {
      query: "?raw",
      import: "default",
      eager: true,
    }) as Record<string, string>;
    const svc = Object.values(svcMod)[0] ?? "";
    expect(svc, "收徒成本的唯一实现应在这里").toContain("export function apprenticeRecruitCost");
    // 它自己是唯一允许写这条式子的地方
    expect(svc, "唯一实现里该读那个常量").toContain("APPRENTICE_RECRUIT_TIER_AMOUNT");
  });

  it("store 与弟子页都调它,谁都不许再写 stoneByTier(major, 收徒档)", () => {
    const mods = import.meta.glob(["../stores/apprentice.ts", "../views/ApprenticeView.vue"], {
      query: "?raw",
      import: "default",
      eager: true,
    }) as Record<string, string>;
    const files = Object.entries(mods);
    expect(files.length, "两份源码都要读到 —— 少一份这条判据就在空转").toBe(2);
    for (const [path, src] of files) {
      const name = path.split("/").pop();
      expect(src, `${name} 该调 apprenticeRecruitCost`).toContain("apprenticeRecruitCost");
      // 判「有没有再算一遍」,不判「有没有提到」—— 注释里解释这件事本身是好事
      expect(src, `${name} 自己又算了一遍收徒成本 = 报价与扣费会分家的第二份真相源`).not.toMatch(
        /stoneByTier\s*\(\s*major\s*,\s*APPRENTICE_RECRUIT_TIER_AMOUNT/,
      );
      expect(src, `${name} 不该再直接引用收徒档常量(它只该住在 service 那一处)`).not.toContain(
        "APPRENTICE_RECRUIT_TIER_AMOUNT",
      );
    }
  });

  it("自证:把式子写回去,这条判据必须红", () => {
    // 判据先证明它能被违反 —— 否则改成一条恒真断言也不会有声
    const bad = "const cost = stoneByTier(major, APPRENTICE_RECRUIT_TIER_AMOUNT);";
    expect(/stoneByTier\s*\(\s*major\s*,\s*APPRENTICE_RECRUIT_TIER_AMOUNT/.test(bad)).toBe(true);
    const good = "const cost = apprenticeRecruitCost(major);";
    expect(/stoneByTier\s*\(\s*major\s*,\s*APPRENTICE_RECRUIT_TIER_AMOUNT/.test(good)).toBe(false);
  });
});

/**
 * 同源审计 · 丹药获得
 *
 * 背包里的丹与丹方录的已录是同一笔获得事实。任何取丹路径绕过 `acquirePill` 直接
 * 写背包,都会造出「背包里有丹、图鉴仍显示未录」的第二本账。
 */
describe("同源审计 · 丹药获得", () => {
  it("生产代码只有 acquirePill 能直接写 inventory.addPill", () => {
    const hits = walk(SRC)
      .map(
        (file) =>
          [
            file.slice(SRC.length + 1),
            readFileSync(file, "utf8")
              .replace(/\/\*[\s\S]*?\*\//g, "")
              .replace(/\/\/.*$/gm, ""),
          ] as const,
      )
      .filter(([, src]) => /\.addPill\s*\(/.test(src))
      .map(([file]) => file);

    expect(hits).toEqual(["core/progress.ts"]);
  });

  it("自证:绕过漏斗的写法会被判红", () => {
    expect(/\.addPill\s*\(/.test("inventory.addPill(id, 1);")).toBe(true);
    expect(/\.addPill\s*\(/.test("acquirePill(id, 1);")).toBe(false);
  });
});

/**
 * 同源审计 · 功法习得
 *
 * 习得、图鉴收录与 `gongfaLearned` 计数是同一笔获得事实。除统一入口外直接调用
 * `cultivation.learn`,会造出「人物页已会、图鉴没录、任务不计数」的第二本账。
 */
describe("同源审计 · 功法习得", () => {
  const LEARN_CALL = /\bcultivation\.learn\s*\(/;

  it("生产代码只有 core/gongfaService.ts 能直接调用 cultivation.learn", () => {
    const hits = walk(SRC)
      .map(
        (file) =>
          [
            file.slice(SRC.length + 1),
            readFileSync(file, "utf8")
              .replace(/\/\*[\s\S]*?\*\//g, "")
              .replace(/\/\/.*$/gm, ""),
          ] as const,
      )
      .filter(([, src]) => LEARN_CALL.test(src))
      .map(([file]) => file);

    expect(hits).toEqual(["core/gongfaService.ts"]);
  });

  it("旧档补账接在引擎启动路径上,不是只在测试里可调", () => {
    const engine = readFileSync(join(SRC, "core/engine.ts"), "utf8");
    expect(engine, "启动时须补录旧档已习得但漏记的功法").toMatch(/syncLearnedGongfa\s*\(/);
  });

  it("自证:绕过统一入口的写法会被判红", () => {
    expect(LEARN_CALL.test('cultivation.learn("m_taixuan");')).toBe(true);
    expect(LEARN_CALL.test('learnGongfa("m_taixuan");')).toBe(false);
  });
});

/**
 * 同源审计 · 装备获得
 *
 * 入包只是获得装备的一部分:见闻、图鉴、获得计数与品质成就也必须一起落账。
 * 坊市等已付费路径可以要求「原样入包或失败」,但仍须走 acquireEquipment 的统一收口。
 */
describe("同源审计 · 装备获得", () => {
  it("生产代码只有 core/loot.ts 能直接写 inventory.addEquipment", () => {
    const hits = walk(SRC)
      .map(
        (file) =>
          [
            file.slice(SRC.length + 1),
            readFileSync(file, "utf8")
              .replace(/\/\*[\s\S]*?\*\//g, "")
              .replace(/\/\/.*$/gm, ""),
          ] as const,
      )
      .filter(([, src]) => /\.addEquipment\s*\(/.test(src))
      .map(([file]) => file);

    expect(hits).toEqual(["core/loot.ts"]);
  });

  it("自证:绕过漏斗直接加装备会被判红", () => {
    expect(/\.addEquipment\s*\(/.test("inventory.addEquipment(item);")).toBe(true);
    expect(/\.addEquipment\s*\(/.test("acquireEquipment(item, { keepExactly: true });")).toBe(
      false,
    );
  });
});
