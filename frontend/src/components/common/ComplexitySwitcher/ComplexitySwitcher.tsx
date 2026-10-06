/**
 * ComplexitySwitcher（Phase 2 P2-T5）
 *
 * 三档复杂度分段控件：只切换披露程度，不删除任何数据。
 * 键盘/读屏可用（radiogroup + 方向键），无 emoji，图标全部为 Lucide 名。
 */

import { useCallback, useRef } from 'react';
import { LayoutList, Network, PenLine, type LucideIcon } from 'lucide-react';

import {
  COMPLEXITY_CAPABILITIES,
  COMPLEXITY_DESCRIPTIONS,
  COMPLEXITY_LABELS,
  COMPLEXITY_LEVELS,
  type ComplexityCapabilities,
  type ComplexityLevel,
} from './types';

const LEVEL_ICONS: Record<ComplexityLevel, LucideIcon> = {
  sketch: PenLine,
  structure: LayoutList,
  sandbox: Network,
};

export interface ComplexitySwitcherProps {
  value: ComplexityLevel;
  onChange: (level: ComplexityLevel) => void;
  /** 只用于提示当前能力；不传则读取默认矩阵 */
  capabilities?: ComplexityCapabilities;
  className?: string;
  disabled?: boolean;
}

export const ComplexitySwitcher = ({
  value,
  onChange,
  capabilities,
  className = '',
  disabled = false,
}: ComplexitySwitcherProps) => {
  const groupRef = useRef<HTMLDivElement>(null);
  const activeCapabilities = capabilities ?? COMPLEXITY_CAPABILITIES[value];

  const move = useCallback(
    (direction: 1 | -1) => {
      const index = COMPLEXITY_LEVELS.indexOf(value);
      const next =
        COMPLEXITY_LEVELS[
          (index + direction + COMPLEXITY_LEVELS.length) % COMPLEXITY_LEVELS.length
        ];
      onChange(next);
      const buttons = groupRef.current?.querySelectorAll<HTMLButtonElement>(
        '[role="radio"]'
      );
      buttons?.[COMPLEXITY_LEVELS.indexOf(next)]?.focus();
    },
    [value, onChange]
  );

  return (
    <div
      ref={groupRef}
      role="radiogroup"
      aria-label="复杂度"
      className={`inline-flex items-center gap-0.5 rounded-lg border border-border/60 bg-card/40 p-0.5 ${className}`}
      onKeyDown={(event) => {
        if (disabled) return;
        if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
          event.preventDefault();
          move(1);
        } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
          event.preventDefault();
          move(-1);
        }
      }}
    >
      {COMPLEXITY_LEVELS.map((level) => {
        const Icon = LEVEL_ICONS[level];
        const isActive = level === value;
        return (
          <button
            key={level}
            type="button"
            role="radio"
            aria-checked={isActive}
            tabIndex={isActive ? 0 : -1}
            disabled={disabled}
            onClick={() => onChange(level)}
            title={COMPLEXITY_DESCRIPTIONS[level]}
            className={`
              flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs transition-colors
              focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60
              disabled:cursor-not-allowed disabled:opacity-50
              ${
                isActive
                  ? 'bg-primary/15 text-primary'
                  : 'text-muted-foreground hover:bg-accent/30 hover:text-foreground'
              }
            `}
          >
            <Icon className="h-3.5 w-3.5" />
            <span className="font-medium">{COMPLEXITY_LABELS[level]}</span>
          </button>
        );
      })}
      <span className="sr-only">
        {COMPLEXITY_DESCRIPTIONS[value]}；关联面板
        {activeCapabilities.linkPanel ? '已启用' : '未启用'}
      </span>
    </div>
  );
};
