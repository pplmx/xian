/**
 * engine*Parity / engine*Ablation 对账族的**共享样板**(零业务断言)。
 *
 * 这一族每一份 spec 都各自冻结了**一段不同的**迁移前旧口径(`ref*`/`legacy*`,
 * 按系统逐字对齐 —— 各文件的实体互不相同,故不在此重复导出),但它们共享同一个
 * 机械样板:**每个用例都从一份全新的 Pinia 世界出发**。这里只放这一段可证相同的
 * 世界重建工厂,避免 15+ 份 spec 各自 `import { createPinia, setActivePinia }`。
 *
 * 注意:本文件**不含任何断言语义** —— 把对账断言搬进公共文件会让人以为"算法守
 * 卫在别处",守卫就必须留在各 spec 自己体内。
 */
import { createPinia, setActivePinia } from "pinia";

/**
 * 重建一份干净的 Pinia 世界:每个对账用例都要从同一份空档出发,
 * 否则前一个用例写进 store 的状态会漏进下一个(顺序敏感、假绿)。
 */
export function resetWorld(): void {
  setActivePinia(createPinia());
}
