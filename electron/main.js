import { app, BrowserWindow, Tray, Menu, nativeImage, session, shell } from "electron";
import path from "node:path";
import fs from "node:fs";
import { pathToFileURL } from "node:url";
import pkg from "../package.json";
import {
  REMOTE_REQUEST_URL_FILTERS,
  isAppEntryUrl,
  isExternalWebUrl,
  isRemoteRequestUrl,
} from "../src/utils/shellUrlPolicy";

// 窗口标题与托盘提示（package.json 没有 title 字段，取 electron-builder 的 productName）
const APP_TITLE = pkg.build.productName;

// 应用根目录（开发时是项目根目录，打包后是 app.asar）
const appRoot = app.getAppPath();

// 构建产物路径（Vite 输出到 dist/）
const distPath = path.join(appRoot, "dist");
const appEntryUrl = pathToFileURL(path.join(distPath, "index.html")).href;

// 静态资源路径
const publicPath = path.join(appRoot, "public");

// 设置文件路径
const settingsPath = path.join(app.getPath("userData"), "settings.json");

// 默认设置
const defaultSettings = {
  closeToTray: false, // 关闭窗口时隐藏到托盘
  autoLaunch: false, // 开机自启动
};

// 读取设置
const loadSettings = () => {
  try {
    if (fs.existsSync(settingsPath)) {
      return { ...defaultSettings, ...JSON.parse(fs.readFileSync(settingsPath, "utf-8")) };
    }
  } catch (e) {
    console.error("Failed to load settings:", e);
  }
  return { ...defaultSettings };
};

// 保存设置
const saveSettings = (s) => {
  try {
    fs.writeFileSync(settingsPath, JSON.stringify(s, null, 2));
  } catch (e) {
    console.error("Failed to save settings:", e);
  }
};

let settings = loadSettings();
let win = null;
let tray = null;
let isQuitting = false;

const revealWindow = () => {
  if (!win) return false;
  if (win.isMinimized()) win.restore();
  win.show();
  win.focus();
  return true;
};

// 销毁托盘
const destroyTray = () => {
  if (tray) {
    tray.destroy();
    tray = null;
  }
};

// 设置开机自启动
const setAutoLaunch = (enable) => {
  app.setLoginItemSettings({
    openAtLogin: enable,
    path: app.getPath("exe"),
  });
};

// 创建托盘
const createTray = () => {
  if (tray) return;

  const iconPath = path.join(publicPath, "favicon.ico");
  const trayIcon = fs.existsSync(iconPath)
    ? nativeImage.createFromPath(iconPath)
    : nativeImage.createEmpty();

  tray = new Tray(trayIcon);
  tray.setToolTip(APP_TITLE);

  const contextMenu = Menu.buildFromTemplate([
    { label: "显示窗口", click: revealWindow },
    { type: "separator" },
    {
      label: "退出",
      click: () => {
        isQuitting = true;
        app.quit();
      },
    },
  ]);

  tray.setContextMenu(contextMenu);
  tray.on("double-click", revealWindow);
};

// 创建应用菜单
const createAppMenu = () => {
  const template = [
    {
      label: "设置",
      submenu: [
        {
          label: "关闭时最小化到托盘",
          type: "checkbox",
          checked: settings.closeToTray,
          click: (menuItem) => {
            settings.closeToTray = menuItem.checked;
            saveSettings(settings);
            if (settings.closeToTray) {
              createTray();
            } else {
              destroyTray();
            }
          },
        },
        {
          label: "开机自动启动",
          type: "checkbox",
          checked: settings.autoLaunch,
          click: (menuItem) => {
            settings.autoLaunch = menuItem.checked;
            saveSettings(settings);
            setAutoLaunch(settings.autoLaunch);
          },
        },
        {
          label: "退出游戏",
          accelerator: "CmdOrCtrl+Q",
          click: () => {
            isQuitting = true;
            app.quit();
          },
        },
      ],
    },
    {
      label: "开发",
      submenu: [
        {
          label: "开发者工具",
          accelerator: "F12",
          click: () => win?.webContents.toggleDevTools(),
        },
        {
          label: "重新加载",
          accelerator: "CmdOrCtrl+R",
          click: () => win?.webContents.reload(),
        },
      ],
    },
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
};

// 创建窗口
const createWindow = () => {
  win = new BrowserWindow({
    title: APP_TITLE,
    icon: path.join(publicPath, "favicon.ico"),
    width: 1024,
    height: 768,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false,
    },
  });

  createAppMenu();
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (isExternalWebUrl(url)) {
      void shell.openExternal(url).catch((err) => console.error("外部链接打开失败:", err));
    }
    return { action: "deny" };
  });
  const keepInApp = (event, url) => {
    if (!isAppEntryUrl(url, appEntryUrl)) event.preventDefault();
  };
  win.webContents.on("will-navigate", keepInApp);
  win.webContents.on("will-redirect", keepInApp);

  // loadFile 失败(如开发态没先 build 出 dist)要给一句实话,别让拒绝静默飘走
  win
    .loadFile(path.join(distPath, "index.html"))
    .catch((err) => console.error("主页面载入失败:", err));

  // 窗口关闭事件
  win.on("close", (e) => {
    if (settings.closeToTray && !isQuitting) {
      e.preventDefault();
      win.hide();
      createTray();
    }
  });
  win.on("closed", () => {
    win = null;
  });
};

// 两个实例会共用同一份 Chromium 存储,并发写盘只会把存档变成最后写入者的盲盒。
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (!revealWindow() && app.isReady()) createWindow();
  });

  // 引导期:就绪后再建窗。void 表明这是一条"点火后不再等"的链;引导失败要显式
  // 退出,不留一个没内容的半启动窗口挂着(玩家只会看到黑屏)
  void app
    .whenReady()
    .then(() => {
      // 会话只装一次；显式外链走系统浏览器，不经过这里。
      session.defaultSession.webRequest.onBeforeRequest(
        { urls: [...REMOTE_REQUEST_URL_FILTERS] },
        (details, callback) => callback(isRemoteRequestUrl(details.url) ? { cancel: true } : {}),
      );
      createWindow();

      // 如果启用了托盘功能，创建托盘
      if (settings.closeToTray) {
        createTray();
      }

      // 应用开机自启动设置
      setAutoLaunch(settings.autoLaunch);
    })
    .catch((err) => {
      console.error("应用启动失败:", err);
      app.quit();
    });
}

app.on("before-quit", () => {
  isQuitting = true;
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  if (!revealWindow()) createWindow();
});
