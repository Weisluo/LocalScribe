/**
 * 人物紧凑行（Phase 4 P4-T9；politics_ui_design §4.4.2/§4.3）
 *
 * 最高只到 32px：头像 + 政治身份 + 当前任职（任职来自 row.figures 的边投影）。
 * 点击行打开轻量侧栏（onOpen -> FocusPanel 的人物面板），不进入大卡片；
 * 未绑定全局角色时按 §9.2 给「尚未绑定角色」提示，并提供绑定后的跨模块跳转。
 */

import { Crown, UserRound } from 'lucide-react';

import type { EntityRef } from '@/services/worldbuildingApi';
import type { UsePoliticsResult } from '../hooks';
import { readFigureMeta, type FigureEntity } from '../types';
import { ORPHAN_LABEL, formatTimeSpan, rosterRowHeight } from './rosterSupport';

export interface FigureRowProps {
  politics: UsePoliticsResult;
  figure: FigureEntity;
  /** 当前任职（行内展示；未传表示该人物没有挂到任何政权下） */
  office?: string;
  start?: string;
  end?: string;
  isPrimary?: boolean;
  /** 缩进在所属政权下（§4.4 层级） */
  indented?: boolean;
  focused?: boolean;
  onOpen: () => void;
  onNavigateToEntity: (ref: EntityRef) => void;
}

export const FigureRow = ({
  politics,
  figure,
  office,
  start,
  end,
  isPrimary,
  indented = false,
  focused = false,
  onOpen,
  onNavigateToEntity,
}: FigureRowProps) => {
  const meta = readFigureMeta(figure.meta);
  const characterRef: EntityRef | undefined = meta.characterId
    ? { module: 'character', kind: 'character', id: meta.characterId }
    : undefined;
  const character = politics.refs.lookup(characterRef);
  const displayName = character?.name ?? figure.name;
  const initial = displayName.trim().slice(0, 1) || '人';
  const officeText = office?.trim();
  const tenure = formatTimeSpan(start || end ? { start, end } : undefined);

  return (
    <div
      data-testid="roster-figure-row"
      data-entity-id={figure.id}
      aria-current={focused ? 'true' : undefined}
      role="button"
      tabIndex={0}
      aria-label={`打开人物 ${displayName} 的聚焦详情`}
      onClick={onOpen}
      onKeyDown={(event) => {
        // Enter / Space 与点击等价；内层按钮的键盘事件不会冒泡到这里（它们自己处理）
        if (event.key === 'Enter' || event.key === ' ' || event.key === 'Spacebar') {
          event.preventDefault();
          onOpen();
        }
      }}
      style={{ height: rosterRowHeight('figure') }}
      className={`flex cursor-pointer items-center gap-2 border-b border-border/10 pr-2 transition-colors motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-primary/60 ${
        indented ? 'pl-14' : 'pl-7'
      } ${focused ? 'bg-primary/5' : 'hover:bg-accent/20'}`}
    >
      <span
        className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-500/10 text-[10px] font-semibold text-slate-700 dark:text-slate-300"
        aria-hidden="true"
      >
        {characterRef ? initial : <UserRound className="h-3 w-3" aria-hidden="true" />}
      </span>
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          onOpen();
        }}
        title={`${displayName}（点击打开轻量侧栏）`}
        className="min-w-0 max-w-[9rem] shrink-0 truncate text-left text-[11px] font-medium text-foreground hover:text-primary"
      >
        {displayName}
      </button>
      <span className="hidden max-w-[7rem] min-w-0 shrink-0 truncate text-[10px] text-muted-foreground sm:block">
        {meta.identityLabel || ORPHAN_LABEL}
      </span>
      <span className="flex min-w-0 flex-1 items-center gap-1 truncate text-[10px] text-foreground">
        {isPrimary && <Crown className="h-3 w-3 shrink-0 text-amber-600 dark:text-amber-300" aria-hidden="true" />}
        <span className="truncate">{officeText || '还没有任职'}</span>
      </span>
      <span className="hidden w-32 shrink-0 truncate text-right text-[10px] text-muted-foreground md:block">
        {officeText ? tenure : ORPHAN_LABEL}
      </span>
      {characterRef ? (
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onNavigateToEntity(characterRef);
          }}
          aria-label={`打开全局角色 ${displayName}`}
          title="打开全局角色"
          className="shrink-0 rounded border border-border/50 px-1 py-0.5 text-[10px] text-muted-foreground hover:text-foreground"
        >
          角色
        </button>
      ) : (
        <span
          className="shrink-0 rounded-full border border-border/50 px-1 py-0.5 text-[10px] text-muted-foreground"
          title="该政治人物尚未绑定全局角色"
        >
          尚未绑定角色
        </span>
      )}
    </div>
  );
};

export default FigureRow;
