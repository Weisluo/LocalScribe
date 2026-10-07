/**
 * 政权主行（Phase 4 P4-T9；politics_ui_design §4.4/§2.1）
 *
 * 名录的权重落点：政权是唯一「高行距 + 字段最全 + 可原地展开」的行（56px），
 * 等级 / 状态直接以行内 select 改写（updateEntity），名称与存续进编辑态后行内改写。
 * 地图未接入：首府只显示 meta.capitalLabel 文本，不给任何地图入口或占位（§6.7）。
 */

import { useState } from 'react';
import {
  Check,
  ChevronDown,
  ChevronRight,
  Landmark,
  Pencil,
  SquareArrowOutUpRight,
} from 'lucide-react';

import { lucideIcon } from '../../shared/lucideIcon';
import { politicsKindDef } from '../config';
import type { UsePoliticsResult } from '../hooks';
import { fieldClass } from '../tone';
import { toneTextClass } from '../tone';
import { POLITY_KIND, readPolityMeta, type PolityEntity } from '../types';
import type { RosterPolityRow } from '../hooks';
import {
  ORPHAN_LABEL,
  UNSET_LABEL,
  dateInputValue,
  formatTimeSpan,
  formatUpdatedAt,
  rosterRowHeight,
} from './rosterSupport';
import { useRosterSave } from './useRosterSave';

/** 列宽在此集中定义，表头与各形态行共用（组织 40px / 人物 32px 用同一套左列） */
export const PolityRowHeader = () => (
  <div className="sticky top-0 z-10 flex items-center gap-2 border-b border-border/40 bg-card/95 px-2 py-1.5 text-xs font-medium text-muted-foreground backdrop-blur">
    <span className="w-4 shrink-0" aria-hidden="true" />
    <span className="w-5 shrink-0" aria-hidden="true" />
    <span className="h-4 w-4 shrink-0" aria-hidden="true" />
    <span className="min-w-0 flex-1">名称</span>
    <span className="hidden w-20 shrink-0 sm:block">等级</span>
    <span className="w-20 shrink-0">状态</span>
    <span className="hidden w-32 shrink-0 md:block">存续</span>
    <span className="hidden w-20 shrink-0 lg:block">政体</span>
    <span className="hidden w-20 shrink-0 xl:block">首府</span>
    <span className="hidden w-8 shrink-0 text-right sm:block">卫星</span>
    <span className="hidden w-8 shrink-0 text-right sm:block">人物</span>
    <span className="w-16 shrink-0 text-right">关系</span>
    <span className="hidden w-28 shrink-0 xl:block">更新</span>
    <span className="w-24 shrink-0 text-right">操作</span>
  </div>
);

export interface PolityRowProps {
  politics: UsePoliticsResult;
  row: RosterPolityRow;
  canEdit: boolean;
  focused: boolean;
  expanded: boolean;
  hasChildren: boolean;
  selected: boolean;
  dragging: boolean;
  dropTarget: boolean;
  /** 行拖拽排序（§4.4.5） */
  onDragStart: () => void;
  onDragEnd: () => void;
  /** 键盘等价排序：方向键上下交换相邻政权顺序 */
  onMoveToPreviousPolity: () => void;
  onMoveToNextPolity: () => void;
  onDragOver: () => void;
  onDrop: () => void;
  onToggleExpand: () => void;
  onSelect: (next: boolean) => void;
  onOpen: () => void;
  onEditForm: (entity: PolityEntity) => void;
}

export const PolityRow = ({
  politics,
  row,
  canEdit,
  focused,
  expanded,
  hasChildren,
  selected,
  dragging,
  dropTarget,
  onDragStart,
  onDragEnd,
  onMoveToPreviousPolity,
  onMoveToNextPolity,
  onDragOver,
  onDrop,
  onToggleExpand,
  onSelect,
  onOpen,
  onEditForm,
}: PolityRowProps) => {
  const polity = row.polity;
  const meta = readPolityMeta(polity.meta);
  const levels = politics.levels ?? [];
  const statuses = politics.statuses ?? [];
  const statusDef = statuses.find((def) => def.id === meta.status);
  const kindDef = politicsKindDef(politics.config, POLITY_KIND);
  const KindIcon = lucideIcon(kindDef?.icon) ?? Landmark;

  const [editing, setEditing] = useState(false);
  const [draftName, setDraftName] = useState(polity.name);
  const { saving, save } = useRosterSave(politics);

  const commitName = async () => {
    const next = draftName.trim();
    if (!next) {
      setDraftName(polity.name);
      setEditing(false);
      return;
    }
    if (next !== polity.name) await save(polity.id, { name: next });
    setEditing(false);
  };

  const commitTime = (key: 'start' | 'end', value: string) =>
    void save(polity.id, { time: { ...meta.time, [key]: value || undefined } });

  return (
    <div
      data-testid="roster-polity-row"
      data-entity-id={polity.id}
      aria-current={focused ? 'true' : undefined}
      draggable={canEdit && !editing}
      onDragStart={(event) => {
        event.dataTransfer.effectAllowed = 'move';
        event.dataTransfer.setData('text/plain', polity.id);
        onDragStart();
      }}
      onDragEnd={onDragEnd}
      onKeyDown={(event) => {
        // 键盘等价于拖拽排序：输入框 / 下拉里的方向键不劫持
        if (!canEdit || editing) return;
        const target = event.target as HTMLElement | null;
        if (target && ['INPUT', 'SELECT', 'TEXTAREA'].includes(target.tagName)) return;
        if (event.key === 'ArrowUp') {
          event.preventDefault();
          onMoveToPreviousPolity();
          return;
        }
        if (event.key === 'ArrowDown') {
          event.preventDefault();
          onMoveToNextPolity();
        }
      }}
      onDragOver={(event) => {
        if (!canEdit) return;
        event.preventDefault();
        onDragOver();
      }}
      onDrop={(event) => {
        event.preventDefault();
        onDrop();
      }}
      style={{ height: rosterRowHeight('polity') }}
      className={`group flex items-center gap-2 border-b border-border/30 px-2 transition-colors motion-reduce:transition-none ${
        focused ? 'bg-primary/5' : 'hover:bg-accent/20'
      } ${dragging ? 'opacity-40' : ''} ${dropTarget ? 'ring-1 ring-inset ring-primary/60' : ''}`}
    >
      <input
        type="checkbox"
        checked={selected}
        disabled={!canEdit}
        onChange={(event) => onSelect(event.target.checked)}
        aria-label={`选择政权 ${polity.name}`}
        className="h-3.5 w-3.5 shrink-0"
      />

      {hasChildren ? (
        <button
          type="button"
          onClick={onToggleExpand}
          aria-expanded={expanded}
          aria-label={expanded ? `收起 ${polity.name} 的下属` : `展开 ${polity.name} 的下属`}
          className="flex h-5 w-5 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent/10 hover:text-foreground"
        >
          {expanded ? (
            <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
          )}
        </button>
      ) : (
        <span className="w-5 shrink-0" aria-hidden="true" />
      )}

      <KindIcon
        className={`h-4 w-4 shrink-0 ${toneTextClass(kindDef?.color)}`}
        aria-hidden="true"
      />

      <div className="flex min-w-0 flex-1 items-center gap-1.5">
        {editing ? (
          <>
            <input
              autoFocus
              value={draftName}
              onChange={(event) => setDraftName(event.target.value)}
              onBlur={() => void commitName()}
              onKeyDown={(event) => {
                if (event.key === 'Enter') void commitName();
                if (event.key === 'Escape') {
                  setDraftName(polity.name);
                  setEditing(false);
                }
              }}
              aria-label="政权名称"
              className={`${fieldClass} max-w-[16rem]`}
            />
            <button
              type="button"
              onClick={() => void commitName()}
              aria-label="完成名称编辑"
              className="rounded-lg p-1 text-primary transition-colors hover:bg-primary/10"
            >
              <Check className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={onOpen}
              title={`${polity.name}（点击打开详情）`}
              className="min-w-0 truncate text-left text-base font-semibold text-foreground transition-colors hover:text-primary"
            >
              {polity.name}
            </button>
            {row.terminal && (
              <span className="shrink-0 rounded-full border border-border/60 px-1.5 py-0.5 text-[10px] text-muted-foreground">
                已终结
              </span>
            )}
          </>
        )}
      </div>

      <span className="hidden w-20 shrink-0 sm:block">
        {levels.length === 0 ? (
          <span className="text-xs text-muted-foreground" title="还没有等级定义">
            {UNSET_LABEL}
          </span>
        ) : (
          <select
            value={meta.level ?? ''}
            disabled={!canEdit || saving}
            onChange={(event) => void save(polity.id, { level: event.target.value })}
            aria-label={`${polity.name} 等级`}
            className="w-full rounded-lg border border-border/40 bg-muted/30 px-1.5 py-1 text-xs text-foreground transition-colors focus:border-primary/40 focus:outline-none"
          >
            <option value="">{UNSET_LABEL}</option>
            {levels.map((def) => (
              <option key={def.id} value={def.id}>
                {def.label}
              </option>
            ))}
          </select>
        )}
      </span>

      <span className="w-20 shrink-0">
        {statuses.length === 0 ? (
          <span className="text-xs text-muted-foreground" title="还没有状态定义">
            {UNSET_LABEL}
          </span>
        ) : (
          <select
            value={meta.status ?? ''}
            disabled={!canEdit || saving}
            onChange={(event) => void save(polity.id, { status: event.target.value })}
            aria-label={`${polity.name} 状态`}
            className={`w-full rounded-lg border border-border/40 bg-muted/30 px-1.5 py-1 text-xs transition-colors focus:border-primary/40 focus:outline-none ${
              statusDef ? toneTextClass(statusDef.color) : 'text-foreground'
            }`}
          >
            <option value="">{UNSET_LABEL}</option>
            {statuses.map((def) => (
              <option key={def.id} value={def.id}>
                {def.label}
              </option>
            ))}
          </select>
        )}
      </span>

      <span className="hidden w-32 shrink-0 md:block">
        {editing ? (
          <span className="flex items-center gap-1">
            <input
              type="date"
              value={dateInputValue(meta.time?.start)}
              onChange={(event) => commitTime('start', event.target.value)}
              aria-label={`${polity.name} 存续起点`}
              className="w-[4.75rem] rounded-lg border border-border/40 bg-muted/30 px-1 py-1 text-xs"
            />
            <input
              type="date"
              value={dateInputValue(meta.time?.end)}
              onChange={(event) => commitTime('end', event.target.value)}
              aria-label={`${polity.name} 存续终点`}
              className="w-[4.75rem] rounded-lg border border-border/40 bg-muted/30 px-1 py-1 text-xs"
            />
          </span>
        ) : (
          <span className="block truncate text-xs text-muted-foreground" title={formatTimeSpan(meta.time)}>
            {formatTimeSpan(meta.time)}
          </span>
        )}
      </span>

      <span className="hidden w-20 shrink-0 truncate text-xs text-foreground lg:block">
        {meta.governmentFormLabel || ORPHAN_LABEL}
      </span>

      {/* 地图未接入：首府只读展示，不给入口（§6.7） */}
      <span className="hidden w-20 shrink-0 truncate text-xs text-foreground xl:block">
        {meta.capitalLabel || ORPHAN_LABEL}
      </span>

      <span className="hidden w-8 shrink-0 text-right text-xs text-muted-foreground sm:block">
        {row.satelliteCount}
      </span>
      <span className="hidden w-8 shrink-0 text-right text-xs text-muted-foreground sm:block">
        {row.figureCount}
      </span>
      <span className="w-16 shrink-0 text-right text-xs text-muted-foreground">
        出{row.counts.out}/入{row.counts.in}
      </span>
      <span className="hidden w-28 shrink-0 truncate text-xs text-muted-foreground xl:block">
        {formatUpdatedAt(polity.updated_at)}
      </span>

      <span className="flex w-24 shrink-0 items-center justify-end gap-1">
        <button
          type="button"
          onClick={() => {
            setDraftName(polity.name);
            setEditing((prev) => !prev);
          }}
          disabled={!canEdit}
          aria-label={`行内编辑 ${polity.name}`}
          title="行内编辑名称与存续时间"
          className="rounded-lg p-1 text-muted-foreground transition-colors hover:bg-accent/20 hover:text-foreground disabled:opacity-40"
        >
          <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={onOpen}
          aria-label={`打开 ${polity.name}`}
          title="打开聚焦详情"
          className="rounded-lg p-1 text-muted-foreground transition-colors hover:bg-accent/20 hover:text-foreground"
        >
          <SquareArrowOutUpRight className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={() => onEditForm(polity)}
          disabled={!canEdit}
          aria-label={`编辑 ${polity.name} 完整表单`}
          title="完整表单（详情字段）"
          className="rounded-lg px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-accent/20 hover:text-foreground disabled:opacity-40"
        >
          表单
        </button>
      </span>
    </div>
  );
};

export default PolityRow;
