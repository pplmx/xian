/**
 * Android 首启迁移 · 旧 origin 的键必须真的落进当前存档域。
 *
 * 旧 WebView 里留下的键是 `yunyinxiang_save_*`，当前 Pinia 只读
 * `xuanshu.*`（启动迁移还认 `yunyin.`）。此前 SaveMigrator 把这些键
 * 原名搬进新 origin，主程序根本不会再看它们；写盘回调也不复核，
 * 即使 WebView 静默吞写仍会标记完成。这个文件把跨语言契约钉在一起：
 *   · Java 里的旧前缀 / 当前前缀与 TS 单一事实源一致；
 *   · 注入前把旧键映射到当前域，而不是原名搬运；
 *   · 注入后逐键读回，失败清掉半成品且不写“已迁移”标记；
 *   · 界面不在异步写入回调前先报“迁移完成”。
 */
import { describe, expect, it } from "vite-plus/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  LEGACY_SAVE_PREFIX,
  PERSISTED_STORES,
  SAVE_MIGRATION_RELOAD_FLAG,
  SAVE_PREFIX,
} from "@/utils/storage";

const ROOT = resolve(__dirname, "../..");
const MIGRATOR = readFileSync(
  resolve(ROOT, "android/app/src/main/java/com/mystvio/xuanshu/SaveMigrator.java"),
  "utf8",
);
const ACTIVITY = readFileSync(
  resolve(ROOT, "android/app/src/main/java/com/mystvio/xuanshu/MainActivity.java"),
  "utf8",
);

describe("Android 首启迁移 · 旧键落进当前存档域", () => {
  it("Java 的旧前缀与当前/更名后前缀都跟 TS 同一份账", () => {
    expect(MIGRATOR).toContain('LEGACY_ANDROID_SAVE_PREFIX = "yunyinxiang_save_"');
    expect(MIGRATOR).toContain(`CURRENT_SAVE_PREFIX = "${SAVE_PREFIX}"`);
    expect(MIGRATOR).toContain(`REBRAND_SAVE_PREFIX = "${LEGACY_SAVE_PREFIX}"`);
  });

  it("收档时把 yunyinxiang_save_player 映射成 xuanshu.player", () => {
    expect(MIGRATOR, "旧键还在原样放进 collectedSaves").toContain(
      "collectedSaves.put(currentKey, value)",
    );
    expect(MIGRATOR).toContain("String currentKey = currentSaveKey(key)");
    expect(MIGRATOR, "映射逻辑没有接上当前前缀").toMatch(
      /CURRENT_SAVE_PREFIX\s*\+\s*legacyKey\.substring\(\s*LEGACY_ANDROID_SAVE_PREFIX\.length\(\)\s*\)/,
    );
  });

  it("只把真实存档分片当已有档，主题等旁路键不能拦住迁移", () => {
    const block = /CURRENT_SAVE_STORE_IDS\s*=\s*\{([\s\S]*?)\};/.exec(MIGRATOR)?.[1];
    expect(block, "Java 没有可核对的当前存档分片清单").toBeDefined();
    const javaIds = [...block!.matchAll(/"([a-zA-Z]+)"/g)].map((match) => match[1]);
    expect(javaIds, "Android 已有档检查与 PERSISTED_STORES 脱节").toEqual([...PERSISTED_STORES]);
    expect(MIGRATOR).toContain("var currentKeys=[");
    expect(MIGRATOR).toContain("if(key===currentKeys[j]) return 'has_data';");
    expect(MIGRATOR, "又退回了宽泛 xuanshu.* 前缀检查").not.toContain(
      "if(key.indexOf(prefixes[j])===0) return 'has_data';",
    );
  });

  it("注入后逐键读回；失败清半成品且不标记完成", () => {
    expect(MIGRATOR).toContain("localStorage.getItem(key) !== value");
    expect(MIGRATOR).toContain("localStorage.removeItem(written[k])");
    expect(MIGRATOR, "失败分支没有 return，会继续设置免刷盘标记").toMatch(
      /if\(!ok\)\{[\s\S]*?return 'failed';[\s\S]*?\}/,
    );
    expect(MIGRATOR, "成功重载前没挡住卸载刷盘").toContain(
      `window.${SAVE_MIGRATION_RELOAD_FLAG}=true;`,
    );
    expect(MIGRATOR, "markDone 必须在读回成功的分支里").toMatch(
      /if\s*\(\s*"\\"ok\\""\.equals\(result\)\s*\)\s*\{[\s\S]*?markDone\(context\);[\s\S]*?webView\.reload\(\);/,
    );
  });

  it("界面等写入回调确认后再报迁移完成", () => {
    expect(ACTIVITY).not.toContain("存档迁移完成！重新加载中...");
    expect(ACTIVITY).toContain("SaveMigrator.injectSaves(wv, saves, MainActivity.this)");
  });
});
