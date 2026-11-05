<template>
  <!--
    观象 —— compact 卷首把那块装饰性主视觉(圆环 / 山门图 / 法球)收进这里。
    用全站共享的 BaseModal:焦点管理、Esc、role=dialog、读屏语义一并继承,
    不自己铺一层 fixed 浮层(本仓吃过那个亏,见 EnlightenmentModal 的注释)。

    为什么不直接写在 FolioPageHeader 里:那条「弹窗同族刻度」判据的扫描面是
    「凡 components/ 下用了 BaseModal 的文件」—— 卷首一旦自带弹框,它的匾额字
    (19 / 18px)就会被卷进弹窗刻度去核,而卷首根本不是弹窗。抽成独立组件,
    两条判据各扫各的,谁也不牵连谁。
  -->
  <BaseModal :open="open" :title="title" @close="emit('close')">
    <div class="folio-visual-folio" data-folio-visual-body>
      <slot />
    </div>
    <p v-if="description" class="mt-3 t-body text-ink-soft" data-folio-visual-desc>
      {{ description }}
    </p>
  </BaseModal>
</template>

<script setup lang="ts">
import BaseModal from "./BaseModal.vue";

/**
 * 卷首的「观象」弹框 —— 只装两样:主视觉槽,与那句「这一页是关于什么」的副题。
 *
 * 副题放在这里而不留在首屏,是因为它与 meta 读数分工不同:
 *   description —— 本页**是什么**(根骨、灵根与道途)
 *   meta        —— 本页**现在怎么样**(境界、灵根、构筑)
 * 首屏留给后者;前者玩家要看时点「观」就有。
 */
defineProps<{
  open: boolean;
  title: string;
  description?: string;
}>();
const emit = defineEmits<{ close: [] }>();
</script>
