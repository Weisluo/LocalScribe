/**
 * 名录批量字段条（Phase 4 P4-T9；politics_ui_design §4.4.5）
 *
 * 多选后出现：等级 / 状态批量填写 + 时间批量平移（天）。
 * 所有写入走 politics.updateEntity（由 Roster 统一执行），本组件只收集意图。
 *
 * 等级 / 状态是受控 select，应用后立刻复位到占位项：这样连续两次选择同一个值
 * 也会再次触发 onChange（非受控 defaultValue 在值不变时不会再触发，表现为「点了没反应」）。
 */

import { useEffect, useState } from 'react';
import { X } from 'lucide-react';

import type { LevelDef, StatusDef } from '../../shared/moduleConfig';
import { fieldClass } from '../tone';
import { UNSET_LABEL } from './rosterSupport';

export interface BulkBarProps {
  selectedCount: number;
  levels: LevelDef[];
  statuses: StatusDef[];
  canEdit: boolean;
  busy: boolean;
  onSetLevel: (level: string) => void;
  onSetStatus: (status: string) => void;
  onShiftDays: (days: number) => void;
  onClear: () => void;
}

export const BulkBar = ({
  selectedCount,
  levels,
  statuses,
  canEdit,
  busy,
  onSetLevel,
  onSetStatus,
  onShiftDays,
  onClear,
}: BulkBarProps) => {
  const [days, setDays] = useState('0');
  const [levelPick, setLevelPick] = useState('');
  const [statusPick, setStatusPick] = useState('');

  // 选择集变化（应用完成 / 清空选择）后复位，避免把上一次的意图带进下一批
  useEffect(() => {
    setLevelPick('');
    setStatusPick('');
  }, [selectedCount]);

  return (
    <div
      data-testid="roster-bulk-bar"
      className="flex flex-wrap items-center gap-2 rounded-xl border border-primary/40 bg-primary/5 px-3 py-2"
    >
      <span className="text-sm font-medium text-foreground">已选 {selectedCount} 项</span>

      <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
        等级
        <select
          value={levelPick}
          disabled={!canEdit || busy || levels.length === 0}
          title={
            !canEdit
              ? '当前档位不可写实体'
              : levels.length === 0
                ? '还没有等级定义：先在模块配置里添加等级'
                : '选择后立即应用到已选项，可重复选择同一个值'
          }
          onChange={(event) => {
            const next = event.target.value;
            setLevelPick('');
            if (next) onSetLevel(next);
          }}
          aria-label="批量设置等级"
          className={`${fieldClass} w-28`}
        >
          <option value="">{levels.length === 0 ? '还没有等级定义' : '批量设置...'}</option>
          {levels.map((def) => (
            <option key={def.id} value={def.id}>
              {def.label}
            </option>
          ))}
        </select>
      </label>

      <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
        状态
        <select
          value={statusPick}
          disabled={!canEdit || busy || statuses.length === 0}
          title={
            !canEdit
              ? '当前档位不可写实体'
              : statuses.length === 0
                ? '还没有状态定义：先在模块配置里添加状态'
                : '选择后立即应用到已选项，可重复选择同一个值'
          }
          onChange={(event) => {
            const next = event.target.value;
            setStatusPick('');
            if (next) onSetStatus(next);
          }}
          aria-label="批量设置状态"
          className={`${fieldClass} w-28`}
        >
          <option value="">{statuses.length === 0 ? '还没有状态定义' : '批量设置...'}</option>
          {statuses.map((def) => (
            <option key={def.id} value={def.id}>
              {def.label}
            </option>
          ))}
        </select>
      </label>

      <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
        时间平移
        <input
          type="number"
          value={days}
          disabled={!canEdit || busy}
          onChange={(event) => setDays(event.target.value)}
          aria-label="时间平移天数"
          className={`${fieldClass} w-20`}
        />
        天
      </label>
      <button
        type="button"
        disabled={!canEdit || busy}
        onClick={() => {
          const parsed = Number(days);
          if (!Number.isFinite(parsed) || parsed === 0) return;
          onShiftDays(parsed);
        }}
        className="rounded-lg border border-border/50 bg-muted/40 px-3 py-1.5 text-xs font-medium text-muted-foreground transition-all duration-200 hover:border-accent/30 hover:bg-accent/10 hover:text-foreground disabled:opacity-50"
      >
        应用平移
      </button>
      <span className="text-xs text-muted-foreground">
        （{UNSET_LABEL}的值不会被覆盖；无法解析的写法保留原样）
      </span>

      <button
        type="button"
        onClick={onClear}
        className="ml-auto flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-accent/10 hover:text-foreground"
      >
        <X className="h-3.5 w-3.5" aria-hidden="true" />
        清空选择
      </button>
    </div>
  );
};

export default BulkBar;
