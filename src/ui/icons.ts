/** 图标注册表 —— 数据层用字符串键引用,统一在此映射 */
import type { Component } from 'vue'
import { INK_ICONS } from './inkIcons'
import {
  Bell,
  Castle,
  CircleDot,
  Cloud,
  Crown,
  Download,
  Droplets,
  Fish,
  FlaskConical,
  Footprints,
  Ghost,
  Leaf,
  Link,
  Lock,
  Moon,
  RefreshCw,
  Scroll,
  Shield,
  ShieldCheck,
  Shirt,
  Sunset,
  Sword,
  Trash2,
  Trees,
  Unlock,
  Upload,
  User,
  Watch,
  Waves,
  X,
  Umbrella
} from 'lucide-vue-next'

export const ICONS: Record<string, Component> = {
  bell: Bell,
  castle: Castle,
  'circle-dot': CircleDot,
  cloud: Cloud,
  crown: Crown,
  download: Download,
  droplets: Droplets,
  fish: Fish,
  flask: FlaskConical,
  footprints: Footprints,
  ghost: Ghost,
  leaf: Leaf,
  link: Link,
  lock: Lock,
  moon: Moon,
  refresh: RefreshCw,
  scroll: Scroll,
  shield: Shield,
  /** 镇压中的地界签用的是 'shield-check',此前没登记,于是静静显示成一枚星芒 */
  'shield-check': ShieldCheck,
  shirt: Shirt,
  sunset: Sunset,
  sword: Sword,
  trash: Trash2,
  trees: Trees,
  unlock: Unlock,
  upload: Upload,
  user: User,
  watch: Watch,
  waves: Waves,
  x: X,
  umbrella: Umbrella,
  /*
   * 水墨那八枚(底部导航五项 + 顶栏三项)在末尾铺进来,与上面的 lucide 图标同网格、
   * 同线宽、同圆头圆角 —— 换的是形与笔,不是语言。同名键不在这里重复登记:
   * 一个图标名只许有一个来源(详见 inkIcons.ts)。
   */
  ...INK_ICONS
}

export function iconOf(name: string): Component {
  // 兜底那枚也是水墨的星芒:认不出的图标名会静静落到它身上,不该在这里露出另一套语言
  return ICONS[name] ?? INK_ICONS.sparkles!
}
