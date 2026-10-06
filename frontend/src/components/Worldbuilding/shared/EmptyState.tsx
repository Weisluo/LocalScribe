/**
 * EmptyState（Phase 3 P3-T1/P3-T9；races_ui_design §9、systems_ui_design §9）
 *
 * 三种空态共用：模块空、筛选无结果、局部空（compact）。
 * 不展示推荐模板、示例内容或世界观类型选择器；图标只用 Lucide。
 */

import type { LucideIcon } from 'lucide-react';

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
  <div
    className={`flex flex-col items-center justify-center text-center ${
      compact ? 'gap-2 px-3 py-6' : 'gap-3 px-6 py-12'
    } ${className}`}
    data-testid="empty-state"
  >
    <Icon
      className={`${compact ? 'h-8 w-8' : 'h-12 w-12'} text-muted-foreground/40`}
      aria-hidden="true"
    />
    <div className={`${compact ? 'text-sm' : 'text-base'} font-medium text-foreground`}>
      {title}
    </div>
    {description && (
      <p className="max-w-md text-xs text-muted-foreground">{description}</p>
    )}
    {actions.length > 0 && (
      <div className="mt-1 flex flex-wrap items-center justify-center gap-2">
        {actions.map((action) => {
          const ActionIcon = action.icon;
          const primary = (action.variant ?? 'primary') === 'primary';
          const disabled = action.disabled === true;
          return (
            <button
              key={action.label}
              type="button"
              onClick={action.onClick}
              disabled={disabled}
              aria-busy={disabled || undefined}
              className={
                disabled
                  ? 'flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs text-muted-foreground opacity-60'
                  : primary
                    ? 'flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs text-primary-foreground transition-colors hover:bg-primary/90'
                    : 'flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs text-foreground transition-colors hover:bg-accent/30'
              }
            >
              {ActionIcon && <ActionIcon className="h-3.5 w-3.5" />}
              {action.label}
            </button>
          );
        })}
      </div>
    )}
  </div>
);
