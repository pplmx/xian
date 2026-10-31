<template>
  <BaseModal
    :open="open"
    title="入山契"
    size="wide"
    :closable="false"
    aria-label="入山契与隐私确认"
  >
    <article class="opening-pact" data-opening-pact>
      <header class="opening-pact__lead">
        <div class="opening-pact__seal tinylens:!hidden" aria-hidden="true">契</div>
        <div class="min-w-0">
          <p class="opening-pact__eyebrow">立约 · 三事</p>
          <p class="opening-pact__intro">山门只与你订三件事。读毕署印，方入此世。</p>
        </div>
      </header>

      <ol class="opening-pact__terms">
        <li class="opening-pact__term">
          <div class="opening-pact__term-row">
            <span class="opening-pact__ordinal" aria-hidden="true">壹</span>
            <div>
              <h4>档只留本机</h4>
              <p>角色、境界、设置与成就算在浏览器的 localStorage 里，不上传，也不跨设备同步。</p>
            </div>
          </div>
        </li>
        <li class="opening-pact__term">
          <div class="opening-pact__term-row">
            <span class="opening-pact__ordinal" aria-hidden="true">贰</span>
            <div>
              <h4>断网仍可修行</h4>
              <p>
                页面不加载外部脚本、不发外部请求；断网与联网的玩法一致。Android 只在本机迁移旧档。
              </p>
            </div>
          </div>
        </li>
        <li class="opening-pact__term">
          <div class="opening-pact__term-row">
            <span class="opening-pact__ordinal" aria-hidden="true">叁</span>
            <div>
              <h4>去留由你</h4>
              <p>随时导出、导入或清空存档。换设备请走「导出 / 导入」，系统自动备份已关闭。</p>
            </div>
          </div>
        </li>
      </ol>

      <p class="opening-pact__fineprint">以上为契首摘要，完整条款以《隐私政策》为准。</p>

      <div class="opening-pact__oath">
        <input
          id="opening-pact-consent"
          v-model="agreed"
          data-opening-pact-agree
          type="checkbox"
          class="opening-pact__checkbox"
        />
        <label for="opening-pact-consent" class="opening-pact__oath-label"> 我已阅读并同意 </label>
        <button
          type="button"
          class="opening-pact__policy whitespace-nowrap"
          @click="privacyOpen = true"
        >
          《隐私政策》
        </button>
      </div>
    </article>

    <template #footer>
      <div>
        <p v-if="!agreed" id="opening-pact-hint" class="opening-pact__hint">
          勾选并同意后，署印键可用
        </p>
        <div class="grid grid-cols-2 gap-2">
          <button
            class="btn-ghost tinylens:!px-1 tinylens:text-note tinylens:tracking-normal"
            @click="closePact"
          >
            再想想
          </button>
          <button
            class="btn-seal tinylens:!px-1 tinylens:text-note tinylens:tracking-normal"
            :disabled="!agreed"
            :aria-describedby="!agreed ? 'opening-pact-hint' : undefined"
            @click="confirmPact"
          >
            署印入山
          </button>
        </div>
      </div>
    </template>
  </BaseModal>

  <PrivacyDialog :open="privacyOpen" top @close="privacyOpen = false" />
</template>

<script setup lang="ts">
import { ref, watch } from "vue";
import BaseModal from "@/components/common/BaseModal.vue";
import PrivacyDialog from "@/components/common/PrivacyDialog.vue";

const props = defineProps<{ open: boolean }>();
const emit = defineEmits<{ close: []; confirm: [] }>();

const agreed = ref(false);
const privacyOpen = ref(false);

watch(
  () => props.open,
  (open) => {
    if (open) agreed.value = false;
  },
);

function closePact(): void {
  agreed.value = false;
  emit("close");
}

function confirmPact(): void {
  if (!agreed.value) return;
  agreed.value = false;
  emit("confirm");
}
</script>

<style scoped>
.opening-pact {
  --opening-pact-rule: rgb(var(--color-ink-rgb) / 0.12);
}

.opening-pact__lead {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  align-items: center;
  gap: 0.8rem;
}

.opening-pact__seal {
  display: grid;
  width: 3rem;
  height: 3rem;
  place-items: center;
  border: 1px solid rgb(var(--color-cinnabar-deep-rgb) / 0.42);
  background:
    linear-gradient(135deg, rgb(255 255 255 / 0.09), transparent 54%), var(--color-cinnabar);
  box-shadow: inset 0 0 0 0.24rem rgb(var(--color-cinnabar-rgb) / 0.3);
  color: var(--color-paper);
  font-family: var(--font-kai);
  font-size: var(--type-heading);
  line-height: 1;
}

.opening-pact__eyebrow {
  color: var(--color-cinnabar);
  font-size: var(--type-note);
  letter-spacing: 0.22em;
}

.opening-pact__intro {
  margin-top: 0.28rem;
  color: var(--color-ink-soft);
  font-family: var(--font-kai);
  font-size: var(--type-title);
  line-height: 1.55;
}

.opening-pact__terms {
  margin-top: 0.9rem;
  border-top: 1px solid var(--opening-pact-rule);
}

.opening-pact__term {
  border-bottom: 1px solid var(--opening-pact-rule);
  padding: 0.68rem 0;
}

.opening-pact__term-row {
  display: grid;
  grid-template-columns: 1.55rem minmax(0, 1fr);
  gap: 0.62rem;
}

.opening-pact__ordinal {
  display: grid;
  width: 1.55rem;
  height: 1.55rem;
  place-items: center;
  border: 1px solid rgb(var(--color-cinnabar-rgb) / 0.3);
  color: var(--color-cinnabar);
  font-family: var(--font-kai);
  font-size: var(--type-note);
  line-height: 1;
}

.opening-pact__term h4 {
  color: var(--color-ink);
  font-family: var(--font-kai);
  font-size: var(--type-section);
  font-weight: 400;
  letter-spacing: 0.1em;
  line-height: 1.35;
}

.opening-pact__term p {
  margin-top: 0.18rem;
  color: var(--color-ink-faint);
  font-size: var(--type-note);
  line-height: 1.65;
}

.opening-pact__fineprint {
  margin-top: 0.52rem;
  color: var(--color-ink-faint);
  font-size: var(--type-note);
  line-height: 1.55;
}

.opening-pact__oath {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.4rem 0.5rem;
  margin-top: 0.72rem;
  border: 1px solid rgb(var(--color-cinnabar-rgb) / 0.2);
  border-left: 2px solid var(--color-cinnabar);
  background: rgb(var(--color-cinnabar-rgb) / 0.035);
  padding: 0.58rem 0.65rem;
}

.opening-pact__checkbox {
  display: grid;
  width: 1.4rem;
  height: 1.4rem;
  flex: none;
  appearance: none;
  place-content: center;
  border: 1px solid rgb(var(--color-ink-rgb) / 0.32);
  border-radius: 1px;
  background: rgb(var(--color-paper-rgb) / 0.62);
  cursor: pointer;
}

.opening-pact__checkbox::before {
  content: "契";
  color: var(--color-cinnabar);
  font-family: var(--font-kai);
  font-size: var(--type-note);
  line-height: 1;
  transform: scale(0);
  transition: transform 0.14s ease;
}

.opening-pact__checkbox:checked {
  border-color: rgb(var(--color-cinnabar-rgb) / 0.62);
  background: rgb(var(--color-cinnabar-rgb) / 0.06);
}

.opening-pact__checkbox:checked::before {
  transform: scale(1);
}

.opening-pact__checkbox:focus-visible {
  outline: 2px solid rgb(var(--color-cinnabar-rgb) / 0.5);
  outline-offset: 2px;
}

.opening-pact__oath-label {
  color: var(--color-ink-soft);
  font-size: var(--type-body);
  line-height: 1.45;
  cursor: pointer;
}

.opening-pact__policy {
  display: inline-flex;
  min-height: 28px;
  align-items: center;
  color: var(--color-qing);
  font-size: var(--type-body);
  line-height: 1.45;
}

.opening-pact__policy:active {
  color: var(--color-ink-soft);
}

.opening-pact__hint {
  margin-bottom: 0.38rem;
  color: var(--color-ink-faint);
  font-size: var(--type-note);
  line-height: 1.45;
  text-align: center;
}

@media (prefers-reduced-motion: reduce) {
  .opening-pact__checkbox::before {
    transition-duration: 0.01ms;
  }
}
</style>
