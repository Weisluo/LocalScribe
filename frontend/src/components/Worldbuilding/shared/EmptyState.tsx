/**
 * EmptyState（Phase 3 P3-T1/P3-T9；races_ui_design §9、systems_ui_design §9）
 *
 * 三种空态共用：模块空、筛选无结果、局部空（compact）。
 * 不展示推荐模板、示例内容或世界观类型选择器；图标只用 Lucide。
 *
 * 视觉对齐 ui_style_alignment §4.10 富空态：渐变图标托盘 + 标题/描述 + 动作区 + 入场动效。
 * 接口冻结（种族 / 体系界面直接依赖）：
 *   props 仍为 { icon, title, description, actions, compact, className }
 *   EmptyStateAction 仍为 { label, onClick, icon?, variant?, disabled? }
 *   data-testid="empty-state" 保留；disabled 时置灰 + aria-busy 行为保留。
 */

import { motion } from 'framer-motion';
import type { LucideIcon } from 'lucide-react';
import { viewItemVariants, viewSpring } from './motion';

export interface EmptyStateAction {
  label: string;
  onClick: () => void;
  icon?: LucideIcon;
  variant?: 'primary' | 'secondary';
  /** 进行中（如正在创建模块）：置灰并阻止重复触发，避免并发写 */
  disabled?: boolean;
}

export interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  actions?: EmptyStateAction[];
  /** 局部空（面板内区块）用紧凑排版 */
  compact?: boolean;
  className?: string;
}

export const EmptyState = ({
  icon: Icon,
  title,
  description,
  actions = [],
  compact = false,
  className = '',
}: EmptyStateProps) => (
  <motion.div
    variants={viewItemVariants}
    initial="hidden"
    animate="visible"
    className={`flex flex-col items-center justify-center text-center ${
      compact ? 'gap-2 px-3 py-6' : 'gap-3 px-6 py-12'
    } ${className}`}
    data-testid="empty-state"
  >
    <motion.div
      initial={{ scale: 0.85, rotate: -8 }}
      animate={{ scale: 1, rotate: 0 }}
      transition={viewSpring}
      className={`relative inline-flex items-center justify-center ${
        compact ? 'h-12 w-12' : 'h-20 w-20'
      }`}
    >
      <div className="absolute inset-0 rounded-full bg-gradient-to-br from-primary/20 via-accent/15 to-primary/20" />
      <div className="absolute inset-1 rounded-full bg-gradient-to-br from-primary/10 via-accent/10 to-primary/10" />
      <div
        className={`relative rounded-full bg-gradient-to-br from-primary via-primary/90 to-accent shadow-lg shadow-primary/25 ${
          compact ? 'flex h-8 w-8 items-center justify-center' : 'flex h-12 w-12 items-center justify-center'
        }`}
      >
        <Icon
          className={`${compact ? 'h-4 w-4' : 'h-6 w-6'} text-primary-foreground`}
          aria-hidden="true"
        />
      </div>
    </motion.div>
    <div className={`${compact ? 'text-sm' : 'text-lg'} font-semibold text-foreground`}>
      {title}
    </div>
    {description && (
      <p className="max-w-md text-xs text-muted-foreground">{description}</p>
    )}
    {actions.length > 0 && (
      <div className="mt-1 flex flex-wrap items-center justify-center gap-3">
        {actions.map((action) => {
          const ActionIcon = action.icon;
          const primary = (action.variant ?? 'primary') === 'primary';
          const disabled = action.disabled === true;
          const size = compact ? 'px-3 py-1.5 text-xs' : 'px-5 py-2.5 text-sm';
          return (
            <motion.button
              key={action.label}
              type="button"
              onClick={action.onClick}
              disabled={disabled}
              aria-busy={disabled || undefined}
              whileHover={disabled ? undefined : { scale: primary ? 1.02 : 1.01 }}
              whileTap={disabled ? undefined : { scale: primary ? 0.98 : 0.99 }}
              className={`flex items-center gap-1.5 rounded-lg font-medium transition-all duration-200 ${size} ${
                disabled
                  ? 'cursor-not-allowed border border-border bg-muted/40 text-muted-foreground opacity-60'
                  : primary
                    ? 'bg-gradient-to-br from-primary to-primary/90 font-semibold text-primary-foreground shadow-sm hover:shadow-md hover:shadow-primary/20'
                    : 'border border-border/50 bg-muted/40 text-muted-foreground hover:border-accent/30 hover:bg-accent/10 hover:text-foreground'
              }`}
            >
              {ActionIcon && <ActionIcon className="h-4 w-4" />}
              {action.label}
            </motion.button>
          );
        })}
      </div>
    )}
  </motion.div>
);
