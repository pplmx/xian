/**
 * 弹窗栈 —— 「最上面那一层」的唯一出处。
 *
 * 两个消费者:Escape(BaseModal 的模块级监听)与安卓实体返回键(ExitConfirmDialog)。
 * 从前这套栈是 BaseModal.vue 里的模块内私有数组,只有 Esc 够得着 —— 返回键因此只能
 * 看见自己那扇确认框,详情弹窗开着按返回会叠出一层「暂别修行」,弹窗永远关不掉。
 *
 * 压栈/出栈由 BaseModal 负责(它是全库唯一的浮层原语);关闭动作经 `close` 回调交回
 * 宿主组件,本模块不认识任何具体弹窗。`closable=false` 的层(必须作答的结果框)在
 * 顶层时**挡住**这一下返回,而不是被跳过 —— 越过它去关下一层,玩家看到的是别的窗消失。
 */
export type ModalEntry = {
  /** 这一层现在给不给关(宿主可以中途改:例如提交中禁止关闭) */
  closable: boolean;
  /** 关掉它 —— 通常是宿主 emit("close") */
  close: () => void;
};

const activeModals: ModalEntry[] = [];

export function pushModal(entry: ModalEntry): void {
  activeModals.push(entry);
}

/** 出栈;不在栈里(已关、或卸载路径重复调用)时静默返回 */
export function removeModal(entry: ModalEntry): void {
  const i = activeModals.indexOf(entry);
  if (i >= 0) activeModals.splice(i, 1);
}

/** 关掉最上面那层;关到了返回 true。栈空、或顶层不可关时返回 false */
export function closeTopModal(): boolean {
  const top = activeModals[activeModals.length - 1];
  if (!top?.closable) return false;
  top.close();
  return true;
}
