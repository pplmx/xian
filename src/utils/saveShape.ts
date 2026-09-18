/**
 * 存档形状修复 —— 实现已搬进公共库(见 packages/engine 的 saveShape)。
 *
 * 这些判据与具体游戏无关:凡是"从外部读回来的数据"(存档、导入、云同步)都要过一遍。
 * 故它们在库里实现与自测,本文件只做转出 —— 各 store 的 import 一行不用改。
 */
export {
  asArray,
  asFiniteNumber,
  asNumberRecord,
  asObjectOrNull,
  asRecord,
  asRecordOf,
  asStringArray
} from '@engine/index'
