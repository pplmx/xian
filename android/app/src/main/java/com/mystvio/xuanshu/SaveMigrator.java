package com.mystvio.xuanshu;

import android.content.Context;
import android.content.SharedPreferences;
import android.os.Handler;
import android.os.Looper;
import android.util.Log;
import android.webkit.JavascriptInterface;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

import fi.iki.elonen.NanoHTTPD;

/**
 * 一次性存档迁移器：从旧版 http://localhost:8080 读取 localStorage，
 * 注入到 Capacitor 的 https://localhost WebView 中。
 */
public class SaveMigrator {

    private static final String TAG = "SaveMigrator";
    private static final String PREFS_NAME = "save_migration";
    private static final String KEY_DONE = "migration_done_v2";
    private static final int OLD_PORT = 8080;
    /**
     * 旧 WebView 的 localStorage 键域。
     *
     * 这不是当前游戏读的键。迁移时必须把 `yunyinxiang_save_player` 改写成
     * `xuanshu.player`；原名搬过去只会得到一组主程序永远不看的死键。
     */
    private static final String LEGACY_ANDROID_SAVE_PREFIX = "yunyinxiang_save_";
    /** 与 src/utils/storage.ts 的 SAVE_PREFIX 同一份账（跨语言判据见 saveMigratorContract.spec）。 */
    private static final String CURRENT_SAVE_PREFIX = "xuanshu.";
    /** 更名前那一代前缀；当前 WebView 里若已有它，也不能被旧 Android 档覆盖。 */
    private static final String REBRAND_SAVE_PREFIX = "yunyin.";
    /**
     * 当前真正参与持久化的 store id。
     *
     * 不能拿 `xuanshu.` 前缀一刀切：主题首帧键也叫这个前缀，却会在正常启动时写入；
     * 若把它当已有档，玩家设过主题后旧档就永远迁不进来。
     */
    private static final String[] CURRENT_SAVE_STORE_IDS = {
        "game",
        "player",
        "resources",
        "inventory",
        "cultivation",
        "dongfu",
        "adventure",
        "quests",
        "settings",
        "loadouts",
        "endgame",
        "lore",
        "pacing",
        "diag",
        "market",
        "bounty",
        "apprentice"
    };

    private final Context context;
    private final Handler handler = new Handler(Looper.getMainLooper());
    private MigrationServer server;
    private WebView hiddenWebView;
    private final ConcurrentHashMap<String, String> collectedSaves = new ConcurrentHashMap<>();
    private OnMigrationListener listener;
    private boolean finished = false;

    public interface OnMigrationListener {
        void onMigrationComplete(Map<String, String> saves);
        void onMigrationSkipped(String reason);
    }

    public SaveMigrator(Context context) {
        this.context = context;
    }

    /** 检查是否需要迁移 */
    public boolean needsMigration() {
        SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        return !prefs.getBoolean(KEY_DONE, false);
    }

    /** 标记迁移完成 */
    public static void markDone(Context context) {
        context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            .edit().putBoolean(KEY_DONE, true).apply();
    }

    /** 启动迁移流程 */
    public void migrate(OnMigrationListener listener) {
        this.listener = listener;

        if (!needsMigration()) {
            listener.onMigrationSkipped("已迁移过，跳过");
            return;
        }

        Log.d(TAG, "开始存档迁移...");
        showToast("正在检测旧版存档...");

        try {
            // 启动 NanoHTTPD，提供迁移页面
            server = new MigrationServer(OLD_PORT);
            server.start();
            Log.d(TAG, "迁移服务器启动在端口 " + OLD_PORT);

            // 创建隐藏 WebView 访问旧 origin
            handler.post(() -> {
                hiddenWebView = new WebView(context);
                WebSettings settings = hiddenWebView.getSettings();
                settings.setJavaScriptEnabled(true);
                settings.setDomStorageEnabled(true);

                hiddenWebView.addJavascriptInterface(new MigrationBridge(), "MigrationBridge");
                hiddenWebView.setWebViewClient(new WebViewClient() {
                    @Override
                    public void onPageFinished(WebView view, String url) {
                        Log.d(TAG, "迁移页面加载完成: " + url);
                    }

                    @Override
                    public void onReceivedError(WebView view, int errorCode,
                                                String description, String failingUrl) {
                        Log.e(TAG, "迁移页面加载失败: " + description);
                        finish("页面加载失败: " + description);
                    }
                });

                hiddenWebView.loadUrl("http://localhost:" + OLD_PORT + "/migration");
            });

            // 10秒超时保护
            handler.postDelayed(() -> {
                if (!finished) {
                    Log.w(TAG, "迁移超时，跳过");
                    finish("迁移超时");
                }
            }, 10000);

        } catch (Exception e) {
            Log.e(TAG, "迁移启动失败", e);
            finish("服务器启动失败: " + e.getMessage());
        }
    }

    /** 完成迁移并清理资源 */
    private synchronized void finish(String skipReason) {
        if (finished) return;
        finished = true;
        cleanup();
        if (listener != null) {
            if (skipReason != null || collectedSaves.isEmpty()) {
                String reason = skipReason != null ? skipReason : "旧版本无存档数据";
                Log.d(TAG, "迁移跳过: " + reason);
                // 只有确认无数据时才标记完成，错误/超时不标记，下次启动重试
                if ("旧版本无存档数据".equals(reason)) {
                    markDone(context);
                }
                showToast("未发现旧版存档（" + reason + "）");
                listener.onMigrationSkipped(reason);
            } else {
                // 找到旧存档，但不在这里 markDone()
                // markDone 由 injectSaves 在真正注入成功后调用
                Log.d(TAG, "迁移成功，共 " + collectedSaves.size() + " 条存档");
                showToast("发现 " + collectedSaves.size() + " 个旧版存档，正在迁移...");
                listener.onMigrationComplete(collectedSaves);
            }
        }
    }

    /** 显示 Toast 提示 */
    private void showToast(String message) {
        handler.post(() -> Toast.makeText(context, message, Toast.LENGTH_LONG).show());
    }

    /** 清理资源 */
    public void cleanup() {
        if (server != null) {
            server.stop();
            server = null;
        }
        handler.post(() -> {
            if (hiddenWebView != null) {
                hiddenWebView.destroy();
                hiddenWebView = null;
            }
        });
    }

    /** NanoHTTPD 迁移服务器，只返回一个迁移 HTML 页面 */
    private static class MigrationServer extends NanoHTTPD {
        MigrationServer(int port) {
            // NanoHTTPD(port) 会把服务绑到通配地址；回环迁移不能顺带暴露给局域网。
            super("localhost", port);
        }

        @Override
        public Response serve(IHTTPSession session) {
            String html = "<!DOCTYPE html><html><body><script>"
                + "try {"
                + "  var saves = {};"
                + "  for (var i = 0; i < localStorage.length; i++) {"
                + "    var key = localStorage.key(i);"
                + "    if (key.indexOf('" + LEGACY_ANDROID_SAVE_PREFIX + "') === 0) {"
                + "      saves[key] = localStorage.getItem(key);"
                + "    }"
                + "  }"
                + "  var keys = Object.keys(saves);"
                + "  if (keys.length === 0) {"
                + "    MigrationBridge.onNoData();"
                + "  } else {"
                + "    for (var j = 0; j < keys.length; j++) {"
                + "      MigrationBridge.onSaveData(keys[j], saves[keys[j]]);"
                + "    }"
                + "    MigrationBridge.onComplete(keys.length);"
                + "  }"
                + "} catch(e) {"
                + "  MigrationBridge.onError(e.message);"
                + "}"
                + "</script></body></html>";

            return newFixedLengthResponse(Response.Status.OK, "text/html", html);
        }
    }

    /** JS Bridge，接收旧 origin 的存档数据 */
    private class MigrationBridge {
        @JavascriptInterface
        public void onSaveData(String key, String value) {
            if (key == null || value == null) return;
            Log.d(TAG, "收到存档: " + key + " (" + value.length() + " 字符)");
            String currentKey = currentSaveKey(key);
            if (currentKey == null) {
                Log.w(TAG, "忽略无法映射到当前存档域的旧键: " + key);
                return;
            }
            collectedSaves.put(currentKey, value);
        }

        @JavascriptInterface
        public void onComplete(int count) {
            Log.d(TAG, "迁移读取完成，共 " + count + " 个存档");
            handler.post(() -> finish(null));
        }

        @JavascriptInterface
        public void onNoData() {
            Log.d(TAG, "旧 origin 无存档数据");
            handler.post(() -> finish("旧版本无存档数据"));
        }

        @JavascriptInterface
        public void onError(String message) {
            Log.e(TAG, "迁移 JS 错误: " + message);
            handler.post(() -> finish("JS错误: " + message));
        }
    }

    /**
     * 检查新版是否已有存档，没有才注入旧存档并刷新页面
     */
    public static void injectSaves(WebView webView, Map<String, String> saves, Context context) {
        if (saves == null || saves.isEmpty()) return;

        webView.evaluateJavascript(injectionScript(saves), result -> {
            // evaluateJavascript 的字符串返回值带引号，如 "\"has_data\""
            if ("\"has_data\"".equals(result)) {
                Log.d(TAG, "新版已有存档，跳过迁移注入，避免覆盖");
                showToast(context, "新版已有存档，跳过旧版迁移");
                return;
            }
            if ("\"ok\"".equals(result)) {
                markDone(context);
                Log.d(TAG, "存档注入并逐键读回成功，共 " + saves.size() + " 条，准备重新加载");
                showToast(context, "旧版存档已迁移，正在重新载入");
                webView.reload();
                return;
            }
            Log.e(TAG, "存档注入失败，未标记完成: " + result);
            showToast(context, "旧版存档写入失败，已清理半成品，下次启动会重试");
        });
    }

    /**
     * 旧 key 只能映射到当前键域；映射后主程序才认识。
     * 后缀限制在 store id 的字符集，避免把旧 origin 里任意键带进当前存档域。
     */
    static String currentSaveKey(String legacyKey) {
        if (legacyKey == null || !legacyKey.startsWith(LEGACY_ANDROID_SAVE_PREFIX)) return null;
        String storeId = legacyKey.substring(LEGACY_ANDROID_SAVE_PREFIX.length());
        if (storeId.isEmpty()) return null;
        for (int i = 0; i < storeId.length(); i++) {
            char c = storeId.charAt(i);
            if (!((c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z')
                || (c >= '0' && c <= '9') || c == '_' || c == '-')) {
                return null;
            }
        }
        return CURRENT_SAVE_PREFIX + legacyKey.substring(LEGACY_ANDROID_SAVE_PREFIX.length());
    }

    private static String injectionScript(Map<String, String> saves) {
        StringBuilder js = new StringBuilder("(function(){");
        js.append("var currentKeys=[");
        for (int i = 0; i < CURRENT_SAVE_STORE_IDS.length; i++) {
            if (i > 0) js.append(',');
            js.append(jsString(CURRENT_SAVE_PREFIX + CURRENT_SAVE_STORE_IDS[i]));
        }
        js.append("];");
        js.append("for(var i=0;i<localStorage.length;i++){");
        js.append("var key=localStorage.key(i);");
        js.append("if(!key) continue;");
        js.append("if(key.indexOf(").append(jsString(REBRAND_SAVE_PREFIX))
            .append(")===0) return 'has_data';");
        js.append("for(var j=0;j<currentKeys.length;j++){");
        js.append("if(key===currentKeys[j]) return 'has_data';");
        js.append("}}");
        js.append("var entries=[");
        boolean first = true;
        for (Map.Entry<String, String> entry : saves.entrySet()) {
            if (!first) js.append(',');
            first = false;
            js.append('[').append(jsString(entry.getKey())).append(',')
                .append(jsString(entry.getValue())).append(']');
        }
        js.append("];var written=[];var ok=true;");
        js.append("try{");
        js.append("for(var i=0;i<entries.length;i++){");
        js.append("localStorage.setItem(entries[i][0],entries[i][1]);");
        js.append("written.push(entries[i][0]);");
        js.append("}");
        js.append("for(var j=0;j<entries.length;j++){");
        js.append("var key=entries[j][0];var value=entries[j][1];");
        js.append("if(localStorage.getItem(key) !== value){ok=false;break;}");
        js.append("}");
        js.append("}catch(e){ok=false;}");
        js.append("if(!ok){");
        js.append("for(var k=0;k<written.length;k++){");
        js.append("try{localStorage.removeItem(written[k]);}catch(ignore){}");
        js.append("}");
        js.append("return 'failed';");
        js.append("}");
        // 读回确认成功后才放行 reload；新文档会丢掉这个窗口级标记。
        js.append("window.__xuanshuSaveMigrationReload=true;");
        js.append("return 'ok';");
        js.append("})();");
        return js.toString();
    }

    private static void showToast(Context context, String message) {
        new Handler(Looper.getMainLooper()).post(() ->
            Toast.makeText(context, message, Toast.LENGTH_LONG).show()
        );
    }

    private static String jsString(String s) {
        return "'" + escapeJs(s) + "'";
    }

    /** 转义 JS 单引号字符串中的特殊字符 */
    private static String escapeJs(String s) {
        StringBuilder escaped = new StringBuilder(s.length() + 16);
        for (int i = 0; i < s.length(); i++) {
            char c = s.charAt(i);
            switch (c) {
                case '\\': escaped.append("\\\\"); break;
                case '\'': escaped.append("\\'"); break;
                case '\n': escaped.append("\\n"); break;
                case '\r': escaped.append("\\r"); break;
                case '\t': escaped.append("\\t"); break;
                case '\b': escaped.append("\\b"); break;
                case '\f': escaped.append("\\f"); break;
                case '\u2028': escaped.append("\\u2028"); break;
                case '\u2029': escaped.append("\\u2029"); break;
                default:
                    if (c < 0x20) {
                        escaped.append(String.format("\\u%04x", (int) c));
                    } else {
                        escaped.append(c);
                    }
            }
        }
        return escaped.toString();
    }
}
