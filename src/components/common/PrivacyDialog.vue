<template>
  <BaseModal :open="open" title="隐私政策" top @close="emit('close')">
    <article class="privacy-ledger" data-privacy-ledger>
      <header class="privacy-ledger__masthead">
        <div>
          <p class="privacy-ledger__eyebrow">一页读懂</p>
          <h4>此作只守本机</h4>
          <p>没有账号，没有远端档案，也没有偷偷发出去的使用记录。</p>
        </div>
        <span class="privacy-ledger__seal tinylens:!hidden" aria-hidden="true">隐</span>
      </header>

      <dl class="privacy-ledger__facts tinylens:!grid-cols-1">
        <div data-privacy-fact>
          <dt>存档</dt>
          <dd>本机</dd>
        </div>
        <div data-privacy-fact>
          <dt>联网</dt>
          <dd>零请求</dd>
        </div>
        <div data-privacy-fact>
          <dt>第三方</dt>
          <dd>不接入</dd>
        </div>
      </dl>

      <div class="privacy-ledger__sections">
        <section class="privacy-ledger__section" data-privacy-section>
          <span class="privacy-ledger__ordinal" aria-hidden="true">一</span>
          <div>
            <h4>简介</h4>
            <p>
              《玄枢录》是一款纯单机网页游戏。我们尊重并保护你的隐私,本政策说明游戏如何处理你的数据。
            </p>
          </div>
        </section>

        <section class="privacy-ledger__section" data-privacy-section>
          <span class="privacy-ledger__ordinal" aria-hidden="true">二</span>
          <div>
            <h4>数据收集</h4>
            <p>游戏仅在你的浏览器本地保存以下数据:</p>
            <ul>
              <li>游戏进度(角色、境界、装备、成就等)</li>
              <li>游戏设置(音量、动效、战报速度等)</li>
            </ul>
          </div>
        </section>

        <section class="privacy-ledger__section" data-privacy-section>
          <span class="privacy-ledger__ordinal" aria-hidden="true">三</span>
          <div>
            <h4>数据存储</h4>
            <p>
              所有数据仅存储在你的浏览器 localStorage
              中,不会上传到任何服务器。清除浏览器缓存会删除存档,请在设置中定期导出备份。
            </p>
          </div>
        </section>

        <section class="privacy-ledger__section" data-privacy-section>
          <span class="privacy-ledger__ordinal" aria-hidden="true">四</span>
          <div>
            <h4>游戏本体不联网</h4>
            <p>
              游戏玩法完全在本机运行,不与任何服务器通信,存档不上传。页面<span
                class="privacy-ledger__ink"
                >不加载任何外部脚本、不发任何外部请求</span
              >
              —— 断网与联网的表现完全一致。
            </p>
            <p>
              Android 首次启动只在本机回环地址迁移旧存档;系统自动备份已关闭,换设备请使用「导出 /
              导入」。
            </p>
          </div>
        </section>

        <section class="privacy-ledger__section" data-privacy-section>
          <span class="privacy-ledger__ordinal" aria-hidden="true">五</span>
          <div>
            <h4>不接入任何第三方</h4>
            <p>
              没有流量统计、没有广告与推送 SDK、没有用户画像。要知道使用情况的话,只可能是<span
                class="privacy-ledger__ink"
                >保存在你本机</span
              >的计数(在存档里,不上传)。
            </p>
          </div>
        </section>

        <section class="privacy-ledger__section" data-privacy-section>
          <span class="privacy-ledger__ordinal" aria-hidden="true">六</span>
          <div>
            <h4>数据控制</h4>
            <p>你对自己的数据拥有完全控制权:</p>
            <ul>
              <li>随时在设置中导出存档文件</li>
              <li>随时导入之前导出的存档</li>
              <li>随时在设置中清空全部数据</li>
            </ul>
          </div>
        </section>

        <section class="privacy-ledger__section" data-privacy-section>
          <span class="privacy-ledger__ordinal" aria-hidden="true">七</span>
          <div>
            <h4>联系我们</h4>
            <p>
              若有疑问,可通过
              <!-- 同上:行内链接的命中区要够拇指点,不能只有字体那十几 px -->
              <a
                href="https://github.com/pplmx/xian/issues"
                target="_blank"
                rel="noopener noreferrer"
                class="privacy-ledger__link"
              >
                GitHub Issues
              </a>
              反馈。
            </p>
          </div>
        </section>
      </div>
    </article>
    <template #footer>
      <button class="btn-seal w-full" @click="emit('close')">知道了</button>
    </template>
  </BaseModal>
</template>

<script setup lang="ts">
import BaseModal from "@/components/common/BaseModal.vue";

defineProps<{ open: boolean }>();

const emit = defineEmits<{ close: [] }>();
</script>

<style scoped>
.privacy-ledger {
  --privacy-ledger-rule: rgb(var(--color-ink-rgb) / 0.11);
  color: var(--color-ink-faint);
  font-size: var(--type-body);
  line-height: 1.7;
}

.privacy-ledger__masthead {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: start;
  gap: 0.75rem;
  border-top: 2px solid var(--color-qing);
  background:
    linear-gradient(128deg, rgb(var(--color-qing-rgb) / 0.055), transparent 58%),
    rgb(var(--color-paper-lifted-rgb) / 0.52);
  padding: 0.82rem 0.78rem 0.76rem;
}

.privacy-ledger__eyebrow {
  color: var(--color-qing);
  font-size: var(--type-note);
  letter-spacing: 0.2em;
}

.privacy-ledger__masthead h4 {
  margin-top: 0.2rem;
  color: var(--color-ink);
  font-family: var(--font-kai);
  font-size: var(--type-title);
  font-weight: 400;
  letter-spacing: 0.1em;
  line-height: 1.35;
}

.privacy-ledger__masthead p:last-child {
  margin-top: 0.3rem;
  color: var(--color-ink-soft);
  font-size: var(--type-note);
  line-height: 1.6;
}

.privacy-ledger__seal {
  display: grid;
  width: 2.2rem;
  height: 2.2rem;
  place-items: center;
  border: 1px solid rgb(var(--color-qing-rgb) / 0.38);
  color: var(--color-qing);
  font-family: var(--font-kai);
  font-size: var(--type-section);
  line-height: 1;
}

.privacy-ledger__facts {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.4rem;
  margin-top: 0.55rem;
}

.privacy-ledger__facts > div {
  min-width: 0;
  border: 1px solid var(--privacy-ledger-rule);
  background: rgb(var(--color-paper-rgb) / 0.34);
  padding: 0.42rem 0.5rem;
}

.privacy-ledger__facts dt {
  color: var(--color-ink-faint);
  font-size: var(--type-note);
  letter-spacing: 0.12em;
}

.privacy-ledger__facts dd {
  margin-top: 0.08rem;
  color: var(--color-qing);
  font-family: var(--font-kai);
  font-size: var(--type-title);
  line-height: 1.35;
}

.privacy-ledger__sections {
  margin-top: 0.72rem;
  border-top: 1px solid var(--privacy-ledger-rule);
}

.privacy-ledger__section {
  display: grid;
  grid-template-columns: 1.55rem minmax(0, 1fr);
  gap: 0.62rem;
  border-bottom: 1px solid var(--privacy-ledger-rule);
  padding: 0.72rem 0;
}

.privacy-ledger__ordinal {
  display: grid;
  width: 1.55rem;
  height: 1.55rem;
  place-items: center;
  border: 1px solid rgb(var(--color-qing-rgb) / 0.3);
  color: var(--color-qing);
  font-family: var(--font-kai);
  font-size: var(--type-note);
  line-height: 1;
}

.privacy-ledger__section h4 {
  color: var(--color-ink);
  font-family: var(--font-kai);
  font-size: var(--type-section);
  font-weight: 400;
  letter-spacing: 0.08em;
  line-height: 1.4;
}

.privacy-ledger__section p {
  margin-top: 0.22rem;
}

.privacy-ledger__section p + p {
  margin-top: 0.5rem;
}

.privacy-ledger__section ul {
  margin-top: 0.28rem;
  padding-left: 1rem;
  list-style: disc;
}

.privacy-ledger__section li + li {
  margin-top: 0.18rem;
}

.privacy-ledger__ink {
  color: var(--color-ink);
}

.privacy-ledger__link {
  display: inline-flex;
  min-height: 28px;
  align-items: center;
  color: var(--color-qing);
}

.privacy-ledger__link:active {
  color: var(--color-ink-soft);
}
</style>
