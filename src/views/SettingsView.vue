<template>
  <div class="folio-page folio-page--stack stagger-in settings-page">
    <FolioPageHeader
      class="settings-masthead"
      title="天机匣"
      subtitle="声息、观照与存续"
      back-to="home"
      back-label="返回"
      featured
    >
      <template #meta>
        <p class="settings-masthead__meta" data-settings-current>
          <span data-settings-sound>{{ soundReadout.label }}</span>
          <span>{{ themeReadout.label }} · 战报 ×{{ settings.battleSpeed }}</span>
          <span
            data-settings-backup
            :data-state="backupReadout.state"
            :class="backupReadout.state === 'fresh' ? 'text-qing' : 'text-cinnabar'"
          >
            {{ backupReadout.label }}
          </span>
        </p>
      </template>
      <template #visual>
        <SettingsCompass
          :sound-level="soundReadout.level"
          :sight-level="themeReadout.level"
          :keep-level="backupReadout.level"
          :quiet="soundReadout.quiet"
          :backup-state="backupReadout.state"
        />
      </template>
    </FolioPageHeader>

    <article
      class="settings-register folio-span-all"
      data-settings-register
      data-settings-folio
      data-settings-console
    >
      <section
        class="settings-register__chapter settings-register__chapter--sound"
        data-settings-chapter="sound"
        data-settings-group="sound"
      >
        <header class="settings-register__head" data-folio-chapter-head>
          <span class="settings-register__ordinal" aria-hidden="true">壹</span>
          <span class="settings-register__identity">
            <span class="settings-register__eyebrow">入耳 · 即时</span>
            <h2 class="settings-register__title">声息</h2>
          </span>
          <span class="settings-register__state tabular">{{ soundReadout.label }}</span>
        </header>

        <div class="settings-register__body">
          <div class="settings-control">
            <div class="settings-control__head">
              <span class="settings-control__label">背景音乐</span>
              <span class="settings-control__value tabular">
                {{ settings.musicOn ? `开 · ${soundReadout.music}` : "静音" }}
              </span>
            </div>
            <InkChoice
              label="背景音乐开关"
              name="music"
              :model-value="settings.musicOn ? 'on' : 'off'"
              :options="AUDIO_OPTIONS"
              @update:model-value="settings.musicOn = $event === 'on'"
            />
            <!--
              min-w-0:range 的原生宽度(约 129px)是它作为可替换元素的自动最小尺寸,
              光有 grow 压不下去 —— 200% 字号(布局视口 195px)下整行会被它顶出去 6px。
            -->
            <div v-if="settings.musicOn" class="settings-level">
              <span class="settings-level__edge">轻</span>
              <input
                v-model.number="settings.musicVol"
                type="range"
                min="0"
                max="100"
                aria-label="背景音乐音量"
                class="settings-range min-w-0"
                :style="{ '--settings-level': `${soundReadout.music}%` }"
              />
              <span class="settings-level__value tabular">{{ soundReadout.music }}</span>
            </div>
          </div>

          <div class="settings-control">
            <div class="settings-control__head">
              <span class="settings-control__label">音效</span>
              <span class="settings-control__value tabular">
                {{ settings.sfxOn ? `开 · ${soundReadout.sfx}` : "静音" }}
              </span>
            </div>
            <InkChoice
              label="音效开关"
              name="sfx"
              :model-value="settings.sfxOn ? 'on' : 'off'"
              :options="AUDIO_OPTIONS"
              @update:model-value="settings.sfxOn = $event === 'on'"
            />
            <div v-if="settings.sfxOn" class="settings-level">
              <span class="settings-level__edge">轻</span>
              <input
                v-model.number="settings.sfxVol"
                type="range"
                min="0"
                max="100"
                aria-label="音效音量"
                class="settings-range min-w-0"
                :style="{ '--settings-level': `${soundReadout.sfx}%` }"
              />
              <span class="settings-level__value tabular">{{ soundReadout.sfx }}</span>
            </div>
          </div>
          <p class="settings-register__note">声音开关只影响播放，不改变修行结算。</p>
        </div>
      </section>

      <section
        class="settings-register__chapter settings-register__chapter--sight"
        data-settings-chapter="sight"
        data-settings-group="sight"
      >
        <header class="settings-register__head" data-folio-chapter-head>
          <span class="settings-register__ordinal" aria-hidden="true">贰</span>
          <span class="settings-register__identity">
            <span class="settings-register__eyebrow">入眼 · 即时</span>
            <h2 class="settings-register__title">观照</h2>
          </span>
          <span class="settings-register__state tabular">
            {{ themeReadout.mark }} · ×{{ settings.battleSpeed }}
          </span>
        </header>

        <div class="settings-register__body">
          <div class="settings-control">
            <div class="settings-control__head">
              <span class="settings-control__label">夜间模式</span>
              <span class="settings-control__value">{{ themeReadout.label }}</span>
            </div>
            <InkChoice
              label="夜间模式"
              name="theme"
              :model-value="settings.theme"
              :options="THEME_OPTIONS"
              @update:model-value="setTheme"
            />
          </div>

          <div class="settings-control">
            <div class="settings-control__head">
              <span class="settings-control__label">战报速度</span>
              <span class="settings-control__value tabular">×{{ settings.battleSpeed }}</span>
            </div>
            <InkChoice
              label="战报速度"
              name="battle-speed"
              :model-value="String(settings.battleSpeed)"
              :options="SPEED_OPTIONS"
              @update:model-value="setBattleSpeed"
            />
          </div>
        </div>
      </section>

      <section
        class="settings-register__chapter settings-register__chapter--conduct"
        data-settings-chapter="conduct"
        data-settings-group="conduct"
      >
        <header class="settings-register__head" data-folio-chapter-head>
          <span class="settings-register__ordinal" aria-hidden="true">叁</span>
          <span class="settings-register__identity">
            <span class="settings-register__eyebrow">入行 · 即时</span>
            <h2 class="settings-register__title">行止</h2>
          </span>
          <span class="settings-register__state">
            {{ settings.reduceMotion ? "动效静" : "动效开" }} ·
            {{ settings.dndEvents ? "勿扰" : "照常" }}
          </span>
        </header>

        <div class="settings-register__body">
          <div class="settings-control">
            <div class="settings-control__head">
              <span class="settings-control__label">减少动效</span>
              <span class="settings-control__value">
                {{ settings.reduceMotion ? "动效静" : "动效开" }}
              </span>
            </div>
            <InkChoice
              label="动效开关"
              name="motion"
              :model-value="settings.reduceMotion ? 'reduced' : 'full'"
              :options="MOTION_OPTIONS"
              @update:model-value="settings.reduceMotion = $event === 'reduced'"
            />
            <p class="settings-control__hint">
              入场、进度与战报回放少走过场，需要结果的步骤直接给结果。
            </p>
          </div>

          <div class="settings-control">
            <div class="settings-control__head">
              <span class="settings-control__label">遇事勿扰</span>
              <span class="settings-control__value">
                {{ settings.dndEvents ? "勿扰" : "照常" }}
              </span>
            </div>
            <InkChoice
              label="遇事开关"
              name="dnd"
              :model-value="settings.dndEvents ? 'quiet' : 'normal'"
              :options="DND_OPTIONS"
              @update:model-value="settings.dndEvents = $event === 'quiet'"
            />
            <!--
              功能 hint:这开关开着是「静默的」(际遇自动结清、弹窗永不出现),只留一个勾
              玩家会以为是际遇没了 —— 历练页有开着时的完整提示与就地关掉(见 explorationDnd
              与 AdventureView),这里把压缩成一句,两页通气。
            -->
            <p class="settings-control__hint">
              历练撞见际遇不再弹窗，按默认好愿当场结清，奖励照拿；历练页会提醒开着，可就地关。
            </p>
          </div>
          <p class="settings-register__note">改动即时写入本机设置，不另立一套修行结算。</p>
        </div>
      </section>

      <div class="settings-register__afterword" data-settings-afterword>
        <section
          class="settings-register__chapter settings-register__chapter--archive settings-archive"
          data-settings-chapter="archive"
          data-settings-archive
          :data-backup="backupReadout.state"
        >
          <header class="settings-register__head" data-folio-chapter-head>
            <span class="settings-register__ordinal" aria-hidden="true">肆</span>
            <span class="settings-register__identity">
              <span class="settings-register__eyebrow">本机存档</span>
              <h2 class="settings-register__title">存续</h2>
            </span>
            <span
              class="settings-register__state tabular"
              :class="backupReadout.state === 'fresh' ? 'text-qing' : 'text-cinnabar'"
            >
              {{ backupReadout.mark }} · 存档版本 v{{ SAVE_VERSION }}
            </span>
          </header>

          <div class="settings-register__body">
            <p class="settings-register__rule">
              导出是唯一能带走的一份；导入会整体替换当前进度，确认前先摊清底细。
            </p>

            <div class="settings-archive__ledger">
              <div class="settings-archive__stat" data-settings-save-stat="duration">
                <span>修行时长</span>
                <strong class="tabular">{{ formatDuration(game.totalPlaySec) }}</strong>
              </div>
              <div class="settings-archive__stat" data-settings-save-stat="export">
                <span>上次导出备份</span>
                <strong class="tabular">{{ backupReadout.detail }}</strong>
              </div>
              <div class="settings-archive__stat" data-settings-save-stat="backup">
                <span>备份状态</span>
                <strong
                  :class="backupReadout.state === 'fresh' ? 'text-qing' : 'text-cinnabar'"
                  class="tabular"
                >
                  {{ backupReadout.label }}
                </strong>
              </div>
            </div>

            <div v-if="backupPrompt" class="settings-archive__notice" data-backup-prompt>
              <span class="settings-archive__notice-mark" aria-hidden="true">备</span>
              <p>
                <strong>建议导出一份。</strong>
                安卓清应用数据、iOS 七天不打开，都可能把进度带走。
              </p>
            </div>

            <!-- 写盘失败时这里必须说话:玩家可能正玩得兴起,却不知道进度没进档 -->
            <p v-if="saveFailed" class="settings-archive__danger">
              上次写入存档失败 ——
              浏览器存储可能已满。请先「导出存档」留一份，再清理浏览器数据或换设备导入。
              腾出空间后会自动重试，成功时这条自己消失。
            </p>

            <!--
              坏掉的分片只说一次(启动时一条 2.4 秒的提示)是不够的:
              玩家多半是先发现「我的灵石怎么没了」,再回来找原因。
              故这里常驻一条:哪一片坏了、原档还在哪儿、以及最该做的那件事(导入备份)。
            -->
            <div v-if="corruptedNotice.length" class="settings-archive__danger">
              <p>
                启动时发现 {{ corruptedNotice.length }} 个存档分片损坏，已跳过损坏内容：{{
                  corruptedNotice.map((id) => STORE_NAMES[id] ?? id).join("、")
                }}。损坏的原档没有删除，仍在本机。备份键：<span class="break-all">{{
                  corruptKeys
                }}</span
                >；备份失败时仍在原键：<span class="break-all">{{ sourceKeys }}</span
                >。同一片多次损坏时，后续原文会追加 .1/.2。若手上还有导出的备份，可在此导入恢复。
              </p>
              <button
                class="settings-archive__acknowledge"
                type="button"
                @click="ui.corruptedNotice = []"
              >
                知道了
              </button>
            </div>

            <div class="settings-archive__actions">
              <button class="btn-seal !text-body" type="button" @click="onExport">导出存档</button>
              <button class="btn-ghost !text-body" type="button" @click="triggerImport">
                导入存档
              </button>
              <input
                ref="fileInput"
                type="file"
                accept="application/json,.save"
                class="hidden"
                @change="onFilePicked"
              />
            </div>

            <button
              class="settings-archive__reset btn-ghost !text-body"
              type="button"
              @click="openReset"
            >
              散尽修为，重入轮回（清空存档）
            </button>

            <!-- iOS 专属:装到主屏幕才躲得过系统清存储(非 iOS 不显示,见组件注释) -->
            <InstallToHomeNotice permanent class="settings-register__install" />
          </div>
        </section>

        <!--
          诊断:异常留档。

          从前全局异常只 toast 一句「出现异常,已记录」—— 手机上根本没有控制台,
          那句「已记录」无处可查。这里把它坐实:最近 20 条、可复制、也随「导出存档」一起走。
        -->
        <section
          class="settings-register__chapter settings-register__chapter--trail settings-trail"
          data-settings-chapter="trail"
          data-settings-trail
          :data-state="diagReadout.state"
        >
          <header class="settings-register__head" data-folio-chapter-head>
            <span class="settings-register__ordinal" aria-hidden="true">伍</span>
            <span class="settings-register__identity">
              <span class="settings-register__eyebrow">本机留痕</span>
              <h2 class="settings-register__title">留痕</h2>
            </span>
            <span
              class="settings-register__state tabular"
              :class="diagReadout.state === 'clear' ? 'text-qing' : 'text-cinnabar'"
            >
              {{ diagReadout.label }}
            </span>
          </header>

          <div class="settings-register__body">
            <p class="settings-register__rule">
              最多留 {{ DIAG_MAX }} 条，只存本机，也随导出带走。
            </p>
            <div class="settings-trail__body">
              <p class="settings-trail__copy">
                <template v-if="diag.errors.length">
                  最近记录了 {{ diag.errors.length }} 条异常（最多留 {{ DIAG_MAX }} 条）。
                </template>
                <template v-else>
                  未记录到异常。真出问题时这里会自动留一条，可连同「导出存档」一起发给我们。
                </template>
              </p>

              <p v-if="latestError" class="settings-trail__latest">
                <span class="tabular text-ink-faint">{{ formatClock(latestError.at) }}</span>
                <span v-if="latestError.count > 1" class="ml-1 text-ink-faint"
                  >×{{ latestError.count }}</span
                >
                <span class="ml-1 break-all">{{ latestError.message }}</span>
                <span v-if="latestError.route" class="ml-1 text-ink-faint">{{
                  latestError.route
                }}</span>
              </p>

              <div v-if="diag.errors.length" class="settings-trail__actions">
                <button class="btn-ghost !text-body" type="button" @click="copyDiag">
                  复制异常记录
                </button>
                <button class="btn-ghost !text-body" type="button" @click="diag.clear()">
                  清空记录
                </button>
              </div>
            </div>
          </div>
        </section>

        <section
          class="settings-register__chapter settings-register__chapter--index"
          data-settings-chapter="index"
        >
          <header class="settings-register__head" data-folio-chapter-head>
            <span class="settings-register__ordinal" aria-hidden="true">陆</span>
            <span class="settings-register__identity">
              <span class="settings-register__eyebrow">卷外三页</span>
              <h2 class="settings-register__title">卷末</h2>
            </span>
            <span class="settings-register__state">关于 · 隐私 · 数值</span>
          </header>

          <div class="settings-index" data-settings-index>
            <button
              class="settings-index__row"
              type="button"
              data-settings-about
              @click="aboutOpen = true"
            >
              <span class="settings-index__ordinal" aria-hidden="true">壹</span>
              <span class="settings-index__copy">
                <strong>关于此作</strong>
                <span>版本、作者与开源致谢</span>
              </span>
              <span class="settings-index__action">展卷 →</span>
            </button>
            <button
              class="settings-index__row"
              type="button"
              data-settings-privacy
              @click="privacyOpen = true"
            >
              <span class="settings-index__ordinal" aria-hidden="true">贰</span>
              <span class="settings-index__copy">
                <strong>隐私政策</strong>
                <span>本地存档与零外域请求</span>
              </span>
              <span class="settings-index__action">展卷 →</span>
            </button>
            <button
              class="settings-index__row"
              type="button"
              data-settings-progression
              @click="progressionOpen = true"
            >
              <span class="settings-index__ordinal" aria-hidden="true">叁</span>
              <span class="settings-index__copy">
                <strong>数值体系</strong>
                <span>复利倍率、净耗时与积余</span>
              </span>
              <span class="settings-index__action">展卷 →</span>
            </button>
          </div>
        </section>
      </div>
    </article>

    <!-- 关于我们 -->
    <AboutDialog :open="aboutOpen" @close="aboutOpen = false" />

    <!-- 隐私政策 -->
    <PrivacyDialog :open="privacyOpen" @close="privacyOpen = false" />

    <!-- 数值体系(可解释性:各数值轴的复利倍率 / 净耗时 / 积余 / 命名出处) -->
    <ProgressionDialog :open="progressionOpen" @close="progressionOpen = false" />

    <!-- 重置确认(弹窗期间引擎暂停) -->
    <BaseModal :open="resetConfirm" title="重置游戏" @close="closeReset">
      <p class="text-title leading-relaxed text-ink-soft">
        此举将
        <span class="text-cinnabar">彻底抹去</span>
        本机的一切修行痕迹,包括转世收获,且无法恢复。
      </p>
      <template #footer>
        <div class="flex gap-2">
          <button class="btn-ghost flex-1" @click="closeReset">再想想</button>
          <button class="btn-seal flex-1 !bg-cinnabar-deep" @click="confirmReset">道心已决</button>
        </div>
      </template>
    </BaseModal>

    <!-- 导入确认(与重置同一条确认纪律:这份备份会整体替换当前进度,不可逆) -->
    <BaseModal :open="importConfirm" title="导入存档" @close="closeImport">
      <p class="text-title leading-relaxed text-ink-soft">
        这份备份将
        <span class="text-cinnabar">整体替换</span>
        本机当前的修行进度 —— 之后的收获会回到备份那一刻,且无法撤销。
      </p>
      <!-- 备份是谁的、什么版本、什么时间导的:整体替换前先摊个底细(决策前摊数字契约) -->
      <div v-if="importInspect" class="mt-3 rounded-[2px] bg-paper-deep/60 px-3 py-2 t-body">
        <p class="flex flex-wrap items-baseline gap-x-2 text-ink">
          <span class="font-kai text-title">{{ importInspect.name }}</span>
          <span class="text-ink-faint">{{ importInspect.realmLabel }}</span>
        </p>
        <p
          class="mt-0.5 flex flex-wrap gap-x-2 tabular text-note"
          :class="importInspect.tooNew ? 'text-cinnabar' : 'text-ink-faint'"
        >
          <span>备份 v{{ importInspect.version }}</span>
          <span>导出 {{ formatClock(importInspect.exportedAt) }}</span>
          <span v-if="importInspect.tooNew">高于当前 v{{ SAVE_VERSION }},无法导入</span>
        </p>
        <p
          v-if="importInspect.skipped.length || importInspect.missingCritical"
          class="mt-1 t-note text-cinnabar"
        >
          <template v-if="importInspect.missingCritical">
            这份备份缺少「{{
              importInspect.skipped.map((id) => STORE_NAMES[id] ?? id).join("、")
            }}」;关键分片缺失,这份备份无法导入。
          </template>
          <template v-else>
            这份备份缺少「{{
              importInspect.skipped.map((id) => STORE_NAMES[id] ?? id).join("、")
            }}」;导入后这些部分会回到默认值。
          </template>
        </p>
      </div>
      <template #footer>
        <div class="flex gap-2">
          <button class="btn-ghost flex-1" @click="closeImport">再想想</button>
          <button
            class="btn-seal flex-1"
            :disabled="importInspect?.tooNew === true || importInspect?.missingCritical === true"
            @click="confirmImport"
          >
            {{
              importInspect?.missingCritical === true
                ? "无法导入(关键分片缺失)"
                : importInspect?.tooNew === true
                  ? "无法导入(版本过高)"
                  : "用这份替换"
            }}
          </button>
        </div>
      </template>
    </BaseModal>
  </div>
</template>

<script setup lang="ts">
import "@/styles/pages/settings.css";
import { computed, ref, useTemplateRef, onUnmounted } from "vue";
import { useSettingsStore } from "@/stores/settings";
import { useGameStore } from "@/stores/game";
import { useUiStore } from "@/stores/ui";
import { engine } from "@/core/engine";
import {
  importSaveText,
  importRejectReason,
  resetGame,
  reloadGame,
  sealStorageWrites,
  inspectImportText,
} from "@/core/save";
import { exportSaveToDevice } from "@/core/savePlatform";
import { shouldPromptBackup } from "@/core/saveBackup";
import { formatDuration } from "@/utils/format";
import {
  SAVE_VERSION,
  STORE_NAMES,
  saveWriteFailure,
  storageKey,
  subscribeSaveWriteFailure,
} from "@/utils/storage";
import FolioPageHeader from "@/components/common/FolioPageHeader.vue";
import BaseModal from "@/components/common/BaseModal.vue";
import PrivacyDialog from "@/components/common/PrivacyDialog.vue";
import AboutDialog from "@/components/common/AboutDialog.vue";
import ProgressionDialog from "@/components/common/ProgressionDialog.vue";
import InstallToHomeNotice from "@/components/common/InstallToHomeNotice.vue";
import SettingsCompass from "@/components/common/SettingsCompass.vue";
import InkChoice from "@/components/common/InkChoice.vue";
import { DIAG_MAX, useDiagStore } from "@/stores/diag";
import { backupDesk, diagDesk, soundDesk, themeDesk } from "@/ui/settingsDesk";

const settings = useSettingsStore();
const game = useGameStore();
const ui = useUiStore();
const diag = useDiagStore();

/** 写盘失败状态:进页面先读一次,之后随订阅翻转 */
const saveFailed = ref(saveWriteFailure() !== null);
/** 被隔离的分片(启动时 preflightScan 记下的那份) */
const corruptedNotice = computed<string[]>(() => ui.corruptedNotice);
/** 原档留在哪些备份键里 —— 说得出键名,玩家(或帮他的人)才找得回来 */
const corruptKeys = computed(() =>
  corruptedNotice.value.map((id) => `corrupt.${storageKey(id)}`).join("、"),
);
/** 备份写不进时,preflightScan 会保留原分片供下次重试 */
const sourceKeys = computed(() => corruptedNotice.value.map(storageKey).join("、"));

/** 最近一条异常(诊断块里只展示这一条,其余随复制/导出带走) */
const latestError = computed(() => diag.errors[diag.errors.length - 1] ?? null);

/** 复制用的全文:一条一行,带时间与路由,便于直接贴进聊天窗 */
const diagText = computed(() =>
  diag.errors
    .map(
      (e) =>
        `${formatClock(e.at)} · ${e.info || "异常"} · ${e.message}${e.count > 1 ? ` ×${e.count}` : ""}${e.route ? ` @${e.route}` : ""}`,
    )
    .join("\n"),
);

/** 月-日 时:分 —— 诊断只需要定位到"哪一次",不需要秒 */
function formatClock(at: number): string {
  const d = new Date(at);
  const pad = (n: number): string => String(n).padStart(2, "0");
  return `${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

async function copyDiag(): Promise<void> {
  try {
    await navigator.clipboard.writeText(diagText.value);
    ui.toast("异常记录已复制", "success");
  } catch {
    // 剪贴板在非安全上下文(file:// 等)不可用 —— 说清退路,别让人以为记录丢了
    ui.toast("复制失败 —— 异常记录就在「导出存档」里,可整份发给我们", "warn");
  }
}
const unsubscribeSaveFailure = subscribeSaveWriteFailure((failure) => {
  saveFailed.value = failure !== null;
});

/**
 * 备份那一行用的「现在」。进页面取一次即可 —— 这一页不是秒表,而每渲染一次就算一次
 * Date.now() 反而会让 computed 不稳定。跨天挂着不动属于可接受的误差(重进页面即刷新)。
 */
const now = ref(Date.now());
const soundReadout = computed(() =>
  soundDesk(settings.musicOn, settings.musicVol, settings.sfxOn, settings.sfxVol),
);
const themeReadout = computed(() => themeDesk(settings.theme));
const backupReadout = computed(() => backupDesk(settings.lastExportAt, now.value));
const diagReadout = computed(() => diagDesk(diag.errors.length, DIAG_MAX));
/** 该不该说出「建议导出一份」(备份旧了 + 这一档攒够了天数,见 core/saveBackup.ts) */
const backupPrompt = computed(() =>
  shouldPromptBackup(settings.lastExportAt, game.createdAt, now.value),
);

type ChoiceOption = { value: string; label: string };

const AUDIO_OPTIONS: readonly ChoiceOption[] = [
  { value: "off", label: "静音" },
  { value: "on", label: "开声" },
] as const;

const THEME_OPTIONS: readonly ChoiceOption[] = [
  { value: "auto", label: "跟随系统" },
  { value: "light", label: "日间" },
  { value: "dark", label: "夜间" },
] as const;

const SPEED_OPTIONS: readonly ChoiceOption[] = [
  { value: "1", label: "×1" },
  { value: "2", label: "×2" },
  { value: "4", label: "×4" },
] as const;

const MOTION_OPTIONS: readonly ChoiceOption[] = [
  { value: "reduced", label: "减少" },
  { value: "full", label: "照常" },
] as const;

const DND_OPTIONS: readonly ChoiceOption[] = [
  { value: "normal", label: "照常" },
  { value: "quiet", label: "勿扰" },
] as const;

function setTheme(value: string): void {
  if (value === "auto" || value === "light" || value === "dark") settings.theme = value;
}

function setBattleSpeed(value: string): void {
  const speed = Number(value);
  if (speed === 1 || speed === 2 || speed === 4) settings.battleSpeed = speed;
}

const resetConfirm = ref(false);
const importConfirm = ref(false);
const pendingImport = ref<string | null>(null);
/** 这份待导入备份的身份与版本(确认前摊开):是谁的档、什么版本、何时导出、是否高于当前 */
const importInspect = ref<ReturnType<typeof inspectImportText> | null>(null);
const privacyOpen = ref(false);
const aboutOpen = ref(false);
const progressionOpen = ref(false);
const fileInput = useTemplateRef<HTMLInputElement>("fileInput");

/** 导出存档:Web/Electron 走浏览器下载,原生端写 Documents(见 savePlatform) */
function onExport(): void {
  // 两个平台各自会 toast 结果;这里再兜一层,免得异常冒成未捕获的 Promise。
  // 只有真的落盘了才记账(返回 null 即成功)—— 没导出成功却把时间戳往前推,
  // 等于用一行「今天」把玩家骗过去,那比不提醒更糟。
  void exportSaveToDevice()
    .then((err) => {
      if (!err) settings.lastExportAt = Date.now();
    })
    .catch(() => ui.toast("导出没能完成,请稍后再试", "warn"));
}

// ---- 重置流程:弹窗期间暂停心跳,取消则恢复 ----
function openReset(): void {
  resetConfirm.value = true;
  engine.pause();
}

function closeReset(): void {
  resetConfirm.value = false;
  engine.resume();
}

function confirmReset(): void {
  // 只读页(多标签后来者)清不了档:别让玩家以为点了没反应
  if (resetGame()) return; // 成功时页面立刻就重载了,收尾交给重载
  resetConfirm.value = false;
  engine.resume();
  ui.toast("清档没有执行 —— 本页可能只读,或浏览器拒绝改动存档。请刷新后重试。", "warn");
}

// 弹窗开着就离开页面时兜底恢复
onUnmounted(() => {
  unsubscribeSaveFailure();
  if (resetConfirm.value || importConfirm.value) engine.resume();
});

function triggerImport(): void {
  fileInput.value?.click();
}

function onFilePicked(e: Event): void {
  const file = (e.target as HTMLInputElement).files?.[0];
  if (!file) return;
  const reader = new FileReader();
  // 先暂停引擎,防止 Pinia persist 插件在导入后覆盖数据(与重置确认同款):
  // 读到文本就挂起,先把「这份备份会整体替换当前进度」摆给玩家确认,确认后才落库。
  engine.pause();
  reader.onload = () => {
    pendingImport.value = String(reader.result ?? "");
    importInspect.value = inspectImportText(pendingImport.value);
    /**
     * 检视不过就不进确认框 —— 那个框问的是「要用这份替换吗」,
     * 而一份不是本作的档 / 缺关键数据 / 已损坏的文件,没有可替换的东西。
     * 从前这里无论如何都开框:框里底细区整块不渲染,只剩一句「将整体替换」
     * 加一个可点的「用这份替换」,玩家点完才被告知"并非《玄枢录》的存档文件"。
     * 现在把原因当场说清 —— 用的就是导入路径那一句(同出 validateImportPayload)。
     */
    if (!importInspect.value) {
      ui.toast(importRejectReason(pendingImport.value) ?? "这份存档无法导入", "warn");
      pendingImport.value = null;
      engine.resume();
      return;
    }
    importConfirm.value = true;
  };
  // 读文件本身也可能失败(权限/磁盘)—— 静默就等于「点了没反应」;打开确认框前
  // 引擎还是暂停态,读失败要立刻恢复
  reader.onerror = () => {
    ui.toast("这个文件读不出来,换一个再试", "warn");
    engine.resume();
  };
  reader.readAsText(file);
  // 清空 input,允许重复选择同一文件
  if (fileInput.value) fileInput.value.value = "";
}

// ---- 导入确认流程:弹窗期间保持引擎暂停,确认才替换存档(与重置同一条确认纪律) ----
function closeImport(): void {
  importConfirm.value = false;
  pendingImport.value = null;
  engine.resume();
}

function confirmImport(): void {
  const text = pendingImport.value;
  if (text === null) return;
  const err = importSaveText(text);
  if (err) {
    ui.toast(err, "warn");
    importConfirm.value = false;
    pendingImport.value = null;
    engine.resume(); // 导入失败时恢复引擎
    return;
  }
  ui.toast("存档导入成功,即将重新入定", "success");
  importConfirm.value = false;
  pendingImport.value = null;
  // 导入已写盘,立即封存:阻止 persist 插件把旧内存回写覆盖
  sealStorageWrites();
  setTimeout(reloadGame, 800);
}
</script>
