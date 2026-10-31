<template>
  <div class="opening-page opening-page--gate stagger-in" data-opening-gate>
    <OpeningBackdrop variant="gate" />

    <div class="opening-page__inner">
      <header class="opening-gate__brand">
        <div class="opening-gate__seal" role="img" aria-label="玄枢录印">
          <span class="font-kai text-[46px] leading-none text-paper">道</span>
        </div>
        <div class="opening-gate__wordmark">
          <p class="opening-gate__eyebrow">万象归枢 · 一念入道</p>
          <h1 class="font-kai text-[40px] leading-none text-ink">玄枢录</h1>
          <p class="opening-gate__motto">玄之又玄 · 众妙之门</p>
        </div>
        <span class="opening-gate__folio">卷一 · 入世</span>
      </header>

      <div class="opening-gate__layout">
        <section class="opening-gate__threshold">
          <p class="opening-gate__kicker">
            <span aria-hidden="true" />
            山门未闭
          </p>
          <h2>从一介凡身，走入万象之枢</h2>
          <p class="opening-gate__lead">
            此世没有开局即定的天命。你从引气一层起，择功法、铸道途、渡天劫；
            每一次转世都带走一点前世的答案。
          </p>

          <dl class="opening-gate__measure">
            <div>
              <dt>界</dt>
              <dd class="tabular">{{ cnNumber(WORLDS.length) }} 方</dd>
            </div>
            <div>
              <dt>境</dt>
              <dd class="tabular">{{ cnNumber(REALMS.length) }} 重</dd>
            </div>
            <div>
              <dt>世</dt>
              <dd>可轮回</dd>
            </div>
          </dl>

          <button
            class="btn-seal animate-glow-pulse opening-gate__enter tracking-[0.3em] whitespace-nowrap tinylens:tracking-normal"
            data-opening-enter
            @click="onStart"
          >
            <span>启封入山</span>
            <span class="opening-gate__enter-mark" aria-hidden="true">入</span>
          </button>
          <p class="opening-gate__oath">无需账号 · 进度只在本机 · 不加载外部脚本</p>
        </section>

        <aside class="opening-gate__ledger">
          <header>
            <div>
              <p>本作所守</p>
              <span>三则</span>
            </div>
            <span class="opening-gate__ledger-seal" aria-hidden="true">枢</span>
          </header>
          <ol>
            <li v-for="(line, index) in highlights" :key="line">
              <span class="opening-gate__ordinal tabular">{{ cnNumber(index + 1) }}</span>
              <p>{{ line }}</p>
            </li>
          </ol>
          <footer class="tinylens:flex-wrap tinylens:justify-center">
            <button
              class="-my-1.5 shrink-0 py-1.5 whitespace-nowrap active:text-ink-soft min-h-[28px]"
              @click="privacyOpen = true"
            >
              隐私政策
            </button>
            <span aria-hidden="true">·</span>
            <button
              class="-my-1.5 shrink-0 py-1.5 whitespace-nowrap active:text-ink-soft min-h-[28px]"
              @click="importOpen = true"
            >
              导入存档
            </button>
            <span aria-hidden="true">·</span>
            <button
              class="-my-1.5 shrink-0 py-1.5 whitespace-nowrap active:text-ink-soft min-h-[28px]"
              @click="aboutOpen = true"
            >
              关于此作
            </button>
          </footer>
        </aside>
      </div>
    </div>

    <input
      ref="fileInput"
      type="file"
      accept="application/json,.save"
      class="hidden"
      @change="onFilePicked"
    />

    <BaseModal :open="importOpen" title="导入存档" @close="importOpen = false">
      <p class="t-body text-ink-faint">从设置页导出的存档文件可在此恢复。</p>
      <template #footer>
        <div class="flex gap-2">
          <button class="btn-ghost flex-1" @click="importOpen = false">再想想</button>
          <button class="btn-seal flex-1" @click="triggerImport">选择存档文件</button>
        </div>
      </template>
    </BaseModal>

    <AboutDialog :open="aboutOpen" @close="aboutOpen = false" />
    <PrivacyDialog :open="privacyOpen" @close="privacyOpen = false" />

    <OpeningPact :open="agreeOpen" @close="agreeOpen = false" @confirm="confirmStart" />

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
import OpeningBackdrop from "@/components/opening/OpeningBackdrop.vue";
import OpeningPact from "@/components/opening/OpeningPact.vue";
import { REALMS, WORLDS } from "@/data/realms";
import { cnNumber } from "@/utils/format";

const router = useRouter();
const settings = useSettingsStore();
const ui = useUiStore();

const privacyOpen = ref(false);
const agreeOpen = ref(false);
const importOpen = ref(false);
const aboutOpen = ref(false);
const fileInput = useTemplateRef<HTMLInputElement>("fileInput");
const warpRef = useTemplateRef<InstanceType<typeof WarpPortal>>("warpRef");

/**
 * 首屏三则都对应本作真有的机制:
 *   ① 境界与界域数直接读 REALMS / WORLDS;
 *   ② 本地存档与零外域请求和隐私政策同口径;
 *   ③ 转世继承道果与天赋,跨世保留。
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
  warpRef.value?.show({ title: "云深不知处", subtitle: "一念修行 · 仙路自此始" });
  setTimeout(() => {
    void router.push("/create");
  }, 2500);
}

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
      engine.resume();
      return;
    }
    ui.toast("存档导入成功,即将重入仙途", "success");
    sealStorageWrites();
    setTimeout(reloadGame, 800);
  };
  reader.readAsText(file);
  if (fileInput.value) fileInput.value.value = "";
}
</script>

<style scoped>
.opening-page {
  position: relative;
  min-height: 100%;
  isolation: isolate;
  overflow: hidden;
  padding: clamp(1.35rem, 4.8vw, 4rem);
}

.opening-page__inner {
  position: relative;
  z-index: 1;
  width: min(100%, 64rem);
  margin-inline: auto;
}

.opening-gate__brand {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 0.9rem 1.1rem;
  border-bottom: 1px solid rgb(var(--color-ink-rgb) / 0.12);
  padding-bottom: 1rem;
}

.opening-gate__seal {
  display: grid;
  width: 4.5rem;
  height: 4.5rem;
  place-items: center;
  border: 1px solid rgb(var(--color-cinnabar-deep-rgb) / 0.46);
  background:
    linear-gradient(135deg, rgb(255 255 255 / 0.08), transparent 52%), var(--color-cinnabar);
  box-shadow:
    inset 0 0 0 0.34rem rgb(var(--color-cinnabar-rgb) / 0.32),
    0.35rem 0.35rem 0 rgb(var(--color-ink-rgb) / 0.035);
}

.opening-gate__wordmark {
  min-width: 0;
}

.opening-gate__eyebrow,
.opening-gate__folio,
.opening-gate__motto,
.opening-gate__kicker,
.opening-gate__oath,
.opening-gate__ledger header p,
.opening-gate__ledger header span,
.opening-gate__ledger footer {
  font-size: var(--type-note);
}

.opening-gate__eyebrow {
  color: var(--color-ink-faint);
  letter-spacing: 0.18em;
}

.opening-gate__wordmark h1 {
  margin-top: 0.22rem;
  letter-spacing: 0.24em;
}

.opening-gate__motto {
  margin-top: 0.34rem;
  color: var(--color-ink-soft);
  letter-spacing: 0.32em;
}

.opening-gate__folio {
  align-self: start;
  border-left: 1px solid rgb(var(--color-cinnabar-rgb) / 0.34);
  padding-left: 0.65rem;
  color: var(--color-cinnabar);
  letter-spacing: 0.12em;
  white-space: nowrap;
}

.opening-gate__layout {
  display: grid;
  min-width: 0;
  grid-template-columns: minmax(0, 1fr);
  gap: 1.35rem;
  margin-top: 1.35rem;
}

.opening-gate__threshold {
  min-width: 0;
  padding: 0.15rem 0 0.35rem;
}

.opening-gate__kicker {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  color: var(--color-cinnabar);
  letter-spacing: 0.18em;
}

.opening-gate__kicker span {
  width: 1.8rem;
  height: 1px;
  background: currentColor;
}

.opening-gate__threshold h2 {
  max-width: 18em;
  margin-top: 0.72rem;
  color: var(--color-ink);
  font-family: var(--font-kai);
  font-size: var(--type-heading);
  font-weight: 400;
  letter-spacing: 0.08em;
  line-height: 1.42;
}

.opening-gate__lead {
  max-width: 34rem;
  margin-top: 0.62rem;
  color: var(--color-ink-soft);
  font-size: var(--type-body);
  line-height: 1.8;
}

.opening-gate__measure {
  display: grid;
  max-width: 31rem;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  margin-top: 1rem;
  border-block: 1px solid rgb(var(--color-ink-rgb) / 0.11);
}

.opening-gate__measure div {
  display: grid;
  gap: 0.18rem;
  padding: 0.58rem 0.55rem;
}

.opening-gate__measure div + div {
  border-left: 1px solid rgb(var(--color-ink-rgb) / 0.08);
}

.opening-gate__measure dt {
  color: var(--color-ink-faint);
  font-size: var(--type-note);
  letter-spacing: 0.18em;
}

.opening-gate__measure dd {
  color: var(--color-ink);
  font-family: var(--font-kai);
  font-size: var(--type-title);
  line-height: 1.35;
}

.opening-gate__enter {
  display: flex;
  width: min(100%, 22rem);
  min-height: 3.4rem;
  align-items: center;
  justify-content: space-between;
  margin-top: 1.1rem;
  padding: 0.65rem 0.7rem 0.65rem 1.1rem;
  text-align: left;
}

.opening-gate__enter-mark {
  display: grid;
  width: 2rem;
  height: 2rem;
  place-items: center;
  border: 1px solid rgb(255 255 255 / 0.28);
  font-size: var(--type-body);
  letter-spacing: 0;
}

.opening-gate__oath {
  margin-top: 0.55rem;
  color: var(--color-ink-faint);
  letter-spacing: 0.04em;
  line-height: 1.6;
}

.opening-gate__ledger {
  align-self: start;
  min-width: 0;
  border: 1px solid rgb(var(--color-ink-rgb) / 0.14);
  border-top: 2px solid var(--color-qing);
  background:
    linear-gradient(145deg, rgb(var(--color-qing-rgb) / 0.045), transparent 48%),
    rgb(var(--color-paper-lifted-rgb) / 0.72);
  box-shadow: 0.28rem 0.28rem 0 rgb(var(--color-ink-rgb) / 0.025);
}

.opening-gate__ledger > header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.8rem;
  border-bottom: 1px solid rgb(var(--color-ink-rgb) / 0.1);
  padding: 0.85rem 0.9rem 0.72rem;
}

.opening-gate__ledger header p {
  color: var(--color-ink);
  font-family: var(--font-kai);
  font-size: var(--type-title);
  letter-spacing: 0.14em;
}

.opening-gate__ledger header span {
  color: var(--color-ink-faint);
}

.opening-gate__ledger-seal {
  display: grid;
  width: 2.1rem;
  height: 2.1rem;
  place-items: center;
  border: 1px solid rgb(var(--color-qing-rgb) / 0.34);
  color: var(--color-qing);
  font-family: var(--font-kai);
  font-size: var(--type-section);
  line-height: 1;
}

.opening-gate__ledger ol {
  display: grid;
}

.opening-gate__ledger li {
  display: grid;
  grid-template-columns: 2rem minmax(0, 1fr);
  gap: 0.62rem;
  border-top: 1px solid rgb(var(--color-ink-rgb) / 0.075);
  padding: 0.72rem 0.9rem;
}

.opening-gate__ledger li:first-child {
  border-top: 0;
}

.opening-gate__ordinal {
  display: grid;
  width: 1.65rem;
  height: 1.65rem;
  place-items: center;
  border: 1px solid rgb(var(--color-cinnabar-rgb) / 0.28);
  color: var(--color-cinnabar);
  font-family: var(--font-kai);
  font-size: var(--type-note);
}

.opening-gate__ledger li p {
  color: var(--color-ink-soft);
  font-size: var(--type-note);
  line-height: 1.7;
}

.opening-gate__ledger footer {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.35rem 0.55rem;
  border-top: 1px solid rgb(var(--color-ink-rgb) / 0.1);
  padding: 0.72rem 0.9rem 0.82rem;
  color: var(--color-ink-faint);
}

.opening-gate__ledger footer button {
  color: var(--color-ink-soft);
}

@media (min-width: 820px) {
  .opening-gate__layout {
    grid-template-columns: minmax(0, 1.16fr) minmax(18rem, 0.84fr);
    align-items: start;
    gap: 2rem;
    margin-top: 1.8rem;
  }

  .opening-gate__threshold {
    padding-top: 0.45rem;
  }
}

@media (max-width: 520px) {
  .opening-gate__brand {
    grid-template-columns: auto minmax(0, 1fr);
  }

  .opening-gate__folio {
    grid-column: 2;
    justify-self: start;
    border-left: 0;
    padding-left: 0;
  }
}

@media (max-width: 220px) {
  .opening-page {
    padding-inline: 0.75rem;
  }

  .opening-gate__brand {
    gap: 0.65rem;
  }

  .opening-gate__seal {
    width: 3.4rem;
    height: 3.4rem;
  }

  .opening-gate__wordmark h1 {
    letter-spacing: 0.08em;
  }

  .opening-gate__motto {
    letter-spacing: 0.12em;
  }

  .opening-gate__measure {
    grid-template-columns: minmax(0, 1fr);
  }

  .opening-gate__measure div + div {
    border-top: 1px solid rgb(var(--color-ink-rgb) / 0.08);
    border-left: 0;
  }

  .opening-gate__ledger > header,
  .opening-gate__ledger li,
  .opening-gate__ledger footer {
    padding-inline: 0.62rem;
  }
}
</style>
