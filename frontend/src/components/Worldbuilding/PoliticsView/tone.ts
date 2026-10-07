/**
 * 政治领域色调映射（Phase 4 P4-T1；politics_ui_design §4.1/§7.5）
 *
 * 颜色不单独承载语义：任何色块旁边都必须有文字标签（§4.9 可访问性）。
 * 这里只把契约 §6.5 的领域色名折算成 Tailwind 类，不引入新颜色语义。
 */

import { POLITICS_TONE_CLASSES } from './config';

/** 契约色名（gold / red / slate / green ...）-> 边框 + 文字类 */
export const toneTextClass = (tone?: string): string =>
  POLITICS_TONE_CLASSES[tone ?? 'neutral'] ?? POLITICS_TONE_CLASSES.neutral;

/** 领域色名 -> 低饱和底色类（卡片背景、卫星 chip） */
export const toneSurfaceClass = (tone?: string): string => {
  switch (tone) {
    case 'gold':
      return 'bg-amber-500/10';
    case 'red':
      return 'bg-red-500/10';
    case 'green':
    case 'emerald':
      return 'bg-emerald-500/10';
    case 'blue':
      return 'bg-blue-500/10';
    case 'pink':
      return 'bg-pink-500/10';
    case 'teal':
      return 'bg-teal-500/10';
    case 'violet':
      return 'bg-violet-500/10';
    case 'slate':
      return 'bg-slate-500/10';
    default:
      return 'bg-muted/40';
  }
};

/** 状态降噪：终端状态在画布降为低饱和幽灵节点，但不消失（§2.1 补充规则 2） */
export const TERMINAL_NODE_CLASS = 'opacity-50 saturate-50';

/** 聚焦降噪：非相关节点 / 边降到 20% / 10% 透明度（§4.2.6、§4.7.5） */
export const DIM_NODE_CLASS = 'opacity-20';
export const DIM_EDGE_OPACITY = 0.1;

/** 缎带 / 边状态色（有效性表达，始终伴随文字，§4.6.5） */
export const EDGE_STATUS_CLASS: Record<string, string> = {
  active: 'opacity-100',
  expired: 'opacity-45',
  suspended: 'opacity-100 underline decoration-destructive/60 decoration-dashed',
  unknown: 'opacity-60',
};

export const fieldClass =
  'w-full rounded-xl border border-border/40 bg-muted/30 px-3 py-2 text-sm transition-all duration-200 placeholder:text-muted-foreground/50 focus:border-primary/40 focus:bg-background focus:outline-none focus:ring-2 focus:ring-primary/15';

export const labelClass = 'text-xs font-medium text-muted-foreground';

export const sectionTitleClass =
  'flex items-center gap-2 text-sm font-semibold text-foreground';

/** §4.7 筛选 chip（kind / 状态过滤）：选中 / 未选中两态由调用方补领域色或 primary */
export const chipClass =
  'inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-medium transition-all duration-200 motion-reduce:transition-none';
