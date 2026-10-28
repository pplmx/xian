/**
 * Android 原生存档导出 —— 首次导出时「文档/Export」目录还不存在。
 *
 * Capacitor Filesystem 的 recursive 默认是 false。少了它，writeFile 会在创建
 * 父目录时失败，玩家看到的是「存档导出失败」；而移动端恰恰是最需要备份的一侧。
 */
import { describe, expect, it, vi, beforeEach } from "vite-plus/test";

const mocks = vi.hoisted(() => ({
  writeFile: vi.fn().mockResolvedValue({ uri: "out.save" }),
  requestPermissions: vi.fn().mockResolvedValue({ publicStorage: "granted" }),
  exportSaveSnapshot: vi.fn().mockReturnValue({ text: '{"game":"xuanshu"}', skipped: [] }),
  notify: vi.fn(),
}));

vi.mock("@capacitor/filesystem", () => ({
  Filesystem: { writeFile: mocks.writeFile, requestPermissions: mocks.requestPermissions },
  Directory: { Documents: "DOCUMENTS" },
  Encoding: { UTF8: "utf8" },
}));

vi.mock("@capacitor/core", async () => {
  const actual = await vi.importActual<typeof import("@capacitor/core")>("@capacitor/core");
  return {
    ...actual,
    Capacitor: {
      ...actual.Capacitor,
      isNativePlatform: () => true,
    },
  };
});

vi.mock("./save", () => ({ exportSaveSnapshot: mocks.exportSaveSnapshot }));
vi.mock("./notify", () => ({ notify: mocks.notify }));
vi.mock("file-saver", () => ({ saveAs: vi.fn() }));

describe("savePlatform(Android 原生分支)", () => {
  beforeEach(() => {
    mocks.writeFile.mockClear();
    mocks.requestPermissions.mockClear();
    mocks.exportSaveSnapshot.mockClear();
    mocks.notify.mockClear();
  });

  it("首次导出会递归创建 Documents/Export,而不是因父目录不存在失败", async () => {
    const { exportSaveToDevice } = await import("./savePlatform");

    await expect(exportSaveToDevice()).resolves.toBeNull();

    expect(mocks.writeFile).toHaveBeenCalledTimes(1);
    const options = mocks.writeFile.mock.calls[0]?.[0];
    expect(options).toMatchObject({
      directory: "DOCUMENTS",
      encoding: "utf8",
      recursive: true,
    });
    expect(options.path).toMatch(/^Export\/xuanshu-\d{4}-\d{2}-\d{2}\.save$/);
    expect(mocks.notify).toHaveBeenCalledWith(
      expect.stringMatching(/Documents\/Export|xuanshu-/),
      "success",
    );
  });
});
