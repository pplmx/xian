<template>
  <!-- 修行画像弹窗(Phase 31.2)—— 自 CharacterView 迁入 -->
  <BaseModal
    :open="open"
    :title="`修行画像 · 「${identity?.epithet ?? '玄枢散人'}」`"
    @close="emit('close')"
  >
    <div v-if="identity" class="space-y-2.5">
      <p class="t-body text-ink-soft">{{ identity.narrative }}</p>
      <!--
        四项目录:有值的写值,没值的把「未定」压成淡字。

        原先四处一律 text-ink-soft —— 「师承 未定」「悟道 未定」与「道途 剑道」
        看起来一样重。扫一眼分不出哪半是空的,而这四行唯一的作用就是告诉你
        「这条路你已经走过哪几段」。未定的那几项现在是淡的、且不带标点,
        眼睛自然先落在有字的那几项上。
      -->
      <div class="grid grid-cols-2 gap-x-4 gap-y-1 text-body">
        <p v-for="r in identityRoots" :key="r.label" class="flex justify-between gap-2">
          <span class="shrink-0 text-ink-faint">{{ r.label }}</span
          ><span class="truncate" :class="r.value ? 'text-ink-soft' : 'text-ink-faint'">{{
            r.value || "—"
          }}</span>
        </p>
      </div>
      <p v-if="identity.roots.fortunes.length" class="text-body text-ink-faint">
        机缘印记:{{ identity.roots.fortunes.map((f) => f.title).join(" · ") }}
      </p>
      <p class="text-note leading-relaxed text-ink-faint">
        画像基于真实选择归纳——你玩成了什么样,它便描述什么。
      </p>
    </div>
    <template #footer>
      <button class="btn-seal w-full" @click="emit('close')">收 卷</button>
    </template>
  </BaseModal>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { buildIdentity } from "@/core/identityService";
import BaseModal from "@/components/common/BaseModal.vue";

/**
 * 修行画像弹窗(自 CharacterView 迁入)。
 *
 * identity 在宿主与本组件各算一份:buildIdentity() 是纯 core 调用
 * (宿主入口卡的「玄枢散人」副行要读它,弹窗正文也要读),无逻辑漂移面,
 * 不为此穿 prop —— 与刀三 mentorVer 同一归属口径。
 * identityRoots(四项目录)只有弹窗用,随迁。
 */
const props = defineProps<{ open: boolean }>();
const emit = defineEmits<{ close: [] }>();

const identity = computed(() => buildIdentity());

/**
 * 画像弹窗里那四项目录。
 *
 * 空的统一记成空串,由模板落成一道「—」:此前四处写死「未定 / 未立 / 未成」
 * 各自的说法,可它们表达的是同一件事(这一项还没有值),四种说法只会让人以为
 * 四件事的「空」不同。真正该区分的是「有值 / 没值」,不是编四个词。
 */
const identityRoots = computed(() => {
  const r = identity.value?.roots;
  return [
    { label: "师承", value: r?.mentor?.name ?? "" },
    { label: "道途", value: r?.daoPath ?? "" },
    { label: "流派", value: r?.build ?? "" },
    { label: "悟道", value: r?.branches.join("、") ?? "" },
  ];
});
</script>
