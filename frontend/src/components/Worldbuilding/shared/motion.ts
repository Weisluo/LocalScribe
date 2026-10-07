/**
 * 共享动效常量（ui_style_alignment §5）
 *
 * 各子视图（种族 / 体系 / 政治 / 经济 / 共享外壳）统一从这里取动效曲线，
 * 不再各自发明一套。历史界面自身的 HistoryView/config.ts 保持不动。
 *
 * 注意：不复制 filter: blur()（大列表逐卡片模糊会掉帧），
 * 交错入场只给首屏卡片网格，详情见规范 §5。
 */

import type { Transition, Variants } from 'framer-motion';

export const viewSpring: Transition = { type: 'spring', stiffness: 280, damping: 28, mass: 0.85 };

export const viewSpringSnappy: Transition = { type: 'spring', stiffness: 380, damping: 26, mass: 0.8 };

export const viewEaseOut: Transition = { duration: 0.28, ease: [0.33, 1, 0.68, 1] };

export const viewItemVariants: Variants = {
  hidden: { opacity: 0, y: 16, scale: 0.98 },
  visible: { opacity: 1, y: 0, scale: 1, transition: viewSpring },
  exit: { opacity: 0, scale: 0.97, y: -10, transition: { duration: 0.22, ease: [0.4, 0, 1, 1] } },
};

export const viewStagger: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.05, delayChildren: 0.1 } },
};
