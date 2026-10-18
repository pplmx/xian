<template>
  <div class="stagger-in flex min-h-full flex-col items-center justify-center px-8 py-10">
    <!--
      首屏印面 —— 原先是一个 rounded-2xl 的圆角方块装着一个「道」字:
      那是任何一款 App 的图标语言,与这一作的印面/篆意不是一回事。
      改成方印:方角、内框一道、朱砂底墨字,左右各留一道空(印文的边) ——
      方印在纸上是不裁圆角的,圆角一上去就变成了软件图标。
    -->
    <div class="relative">
      <div
        class="grid h-24 w-24 place-items-center bg-cinnabar shadow-lg shadow-cinnabar/30"
        role="img"
        aria-label="玄枢录印"
      >
        <!-- 内框:篆刻的边栏,比外框矮一档、细一分 -->
        <div class="grid h-[76px] w-[76px] place-items-center border border-paper/45">
          <span class="font-kai text-[46px] leading-none text-paper">道</span>
        </div>
      </div>
    </div>

    <!-- 游戏名 -->
    <h1 class="mt-6 font-kai text-[40px] leading-tight tracking-[0.3em] text-ink">玄枢录</h1>
    <p class="mt-2 text-[11px] tracking-[0.5em] text-ink-faint">玄之又玄 · 众妙之门</p>

    <!-- 开始按钮:首屏主钮 —— 一缕柔辉呼吸着请玩家按(与突破就绪的朱砂辉光同族,
         只动 box-shadow 合层,reduce-motion 全局兜) -->
    <button
      class="btn-seal animate-glow-pulse mt-10 w-full max-w-72 !py-3.5 text-[17px] tracking-[0.3em]"
      @click="onStart"
    >
      开 始 游 戏
    </button>

    <!-- 底部:隐私政策 / 导出导入恢复 / 关于 -->
    <!-- 三枚底链是全站 28px 触点族的一员:裸 text-[11px] 的命中区只有字高 16.5px
         (排版自检「开局前两页」任务首检即红),-my-1.5 py-1.5 把行盒撑到 28px 一族 -->
    <div class="mt-5 flex items-center gap-3 text-[11px] text-ink-faint">
      <button class="-my-1.5 py-1.5 active:text-ink-soft" @click="privacyOpen = true">
        隐私政策
      </button>
      <span class="text-ink/15">·</span>
      <button class="-my-1.5 py-1.5 active:text-ink-soft" @click="importOpen = true">
        导入存档
      </button>
      <span class="text-ink/15">·</span>
      <button class="-my-1.5 py-1.5 active:text-ink-soft" @click="aboutOpen = true">
        关于此作
      </button>
    </div>

    <!--
      首屏到这儿原本就断在留白里 —— 而这一屏正是最该说「这是个什么游戏」的地方。
      补三句本作的对照(每句都是真的差异,不是广告词),用「·」起头排成一列,
      字号压到 10px 的淡字:它是脚注,不抢主钮。

      用 px-6 左右等高留白、整块占满宽度再居中,而不是 w-fit:
      w-fit 时容器左缘由最长那行决定,三行长短不一时看着像整块偏了位。
    -->
    <div class="mt-10 w-full max-w-80 px-6">
      <ul class="space-y-1.5">
        <li
          v-for="line in highlights"
          :key="line"
          class="flex gap-1.5 text-[10px] leading-relaxed text-ink-faint"
        >
          <span class="shrink-0 text-ink-faint/60">·</span>
          <span>{{ line }}</span>
        </li>
      </ul>
    </div>
    <input
      ref="fileInput"
      type="file"
      accept="application/json,.save"
      class="hidden"
      @change="onFilePicked"
    />

    <!-- 导入存档:确认文案 -->
    <BaseModal :open="importOpen" title="导入存档" @close="importOpen = false">
      <p class="t-body text-ink-faint">从设置页导出的存档文件可在此恢复。</p>
      <template #footer>
        <div class="flex gap-2">
          <button class="btn-ghost flex-1" @click="importOpen = false">再想想</button>
          <button class="btn-seal flex-1" @click="triggerImport">选择存档文件</button>
        </div>
      </template>
    </BaseModal>

    <!-- 关于我们 -->
    <AboutDialog :open="aboutOpen" @close="aboutOpen = false" />

    <!-- 隐私政策全文 -->
    <PrivacyDialog :open="privacyOpen" @close="privacyOpen = false" />

    <!-- 开始前的同意确认 -->
    <BaseModal :open="agreeOpen" title="进入前请确认" :closable="false">
      <p class="t-body text-ink-faint">
        游戏数据仅保存在你的浏览器本地,不上传服务器,也不接入任何第三方服务——页面不加载外部脚本、不发任何外部请求(详见隐私政策)。继续游玩前,请阅读并同意隐私政策。
      </p>
      <label class="mt-3 flex items-center gap-2">
        <input v-model="agreed" type="checkbox" class="h-4 w-4 accent-cinnabar" />
        <!--
          外层 span 从 inline 改成 flex:行内盒按父级行高分配空间,
          会把里面的 inline-flex 按钮压到 26.3px(即使它声明了 min-height:28px,
          layout-check 实测「声明 28px 却只有 26.3px」)。
          父级一旦是 flex,子项就按自己的盒子尺寸排,min-height 才真正算数。
        -->
        <span class="flex flex-wrap items-center gap-x-1 text-[11px] text-ink-soft">
          我已阅读并同意
          <!--
            这一枚按钮的高度在这条路径上试过 inline-flex + min-h、flex 父级、
            shrink-0 三种写法,实测都停在 26.3px —— 行盒对行内级盒子的分配
            在这里比我们更强势。
            最后改用 flex(块级)容器 + 明确 min-h:块级子项的尺寸由自己的盒子决定,
            行盒插不上手。命中区该由「手指要多大」决定,而不是由行高间接推。
          -->
          <button
            class="flex min-h-[28px] items-center text-qing active:opacity-60"
            @click.prevent="privacyOpen = true"
          >
            《隐私政策》
          </button>
        </span>
      </label>
      <template #footer>
        <div class="flex gap-2">
          <button class="btn-ghost flex-1" @click="agreeOpen = false">再想想</button>
          <button class="btn-seal flex-1" :disabled="!agreed" @click="confirmStart">
            同意并开始
          </button>
        </div>
      </template>
    </BaseModal>

    <!-- 开始前穿梭传送门特效(同意并开始后播放,播完进建号页) -->
    <WarpPortal ref="warpRef" />
  </div>
</template>

<script setup lang="ts">
import { ref, useTemplateRef } from "vue";
import { useRouter } from "vue-router";
import { useSettingsStore } from "@/stores/settings";
import { useUiStore } from "@/stores/ui";
import { importSaveText, reloadGame, sealStorageWrites } from "@/core/save";
import { engine } from "@/core/engine";
import BaseModal from "@/components/common/BaseModal.vue";
import PrivacyDialog from "@/components/common/PrivacyDialog.vue";
import AboutDialog from "@/components/common/AboutDialog.vue";
import WarpPortal from "@/components/common/WarpPortal.vue";
import { REALMS, WORLDS } from "@/data/realms";
import { cnNumber } from "@/utils/format";

const router = useRouter();
const settings = useSettingsStore();
const ui = useUiStore();

const privacyOpen = ref(false);
const agreeOpen = ref(false);
const agreed = ref(false);
const importOpen = ref(false);
const aboutOpen = ref(false);
const fileInput = useTemplateRef<HTMLInputElement>("fileInput");
const warpRef = useTemplateRef<InstanceType<typeof WarpPortal>>("warpRef");

/**
 * 首屏那三句 —— 每一句都对应本作真有的机制,不是广告词:
 *   ① 二十一境四界:REALMS / WORLDS 的长度,改境界表这行跟着变;
 *   ② 本地存档、零外域请求:与隐私政策同口径(审计脚本也真在数外域请求);
 *   ③ 转世继承:道果与天赋跨世保留(见 reincarnation)。
 * 数目一律读常量,不手写「21 境」—— 手写的数会在改表时成为唯一不跟的那处。
 */
const highlights = [
  `${cnNumber(REALMS.length)}境${cnNumber(WORLDS.length)}界,自炼气一路走到混沌道祖`,
  "进度只存在你自己的浏览器里,不联网、不接入任何第三方",
  "转世带得走道果与天赋 —— 这一世的取舍,下一世还在",
];

function onStart(): void {
  if (settings.privacyAccepted) {
    void router.push("/create");
    return;
  }
  agreeOpen.value = true;
}

function confirmStart(): void {
  settings.privacyAccepted = true;
  agreeOpen.value = false;
  // 穿梭传送门:播放约 2.5s 后进入建号页
  warpRef.value?.show({ title: "云深不知处", subtitle: "一念修行 · 仙路自此始" });
  setTimeout(() => {
    void router.push("/create");
  }, 2500);
}

// ---- 导入存档(与设置页同流程:先停引擎,导完重载) ----
function triggerImport(): void {
  fileInput.value?.click();
}

function onFilePicked(e: Event): void {
  const file = (e.target as HTMLInputElement).files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    const text = String(reader.result ?? "");
    engine.pause();
    const err = importSaveText(text);
    if (err) {
      ui.toast(err, "warn");
      engine.resume(); // 导入失败时恢复引擎
      return;
    }
    ui.toast("存档导入成功,即将重入仙途", "success");
    // 导入已写盘,立即封存:阻止 persist 插件把欢迎页旧内存(started=false)回写覆盖
    sealStorageWrites();
    setTimeout(reloadGame, 800);
  };
  reader.readAsText(file);
  if (fileInput.value) fileInput.value.value = "";
}
</script>
