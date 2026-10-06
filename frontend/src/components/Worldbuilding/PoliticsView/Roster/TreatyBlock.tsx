/**
 * 条约折叠区块（Phase 4 P4-T9；politics_ui_design §4.4.3/§4.6.4）
 *
 * 条约不是第四类平级卡片：在名录底部收成 36px 的次级区块，默认折叠；
 * 展开后进入条约簿表形态（名称 / 类型 / 缔约方 / 生效 / 状态 / 条款 / 修订 / 关联），
 * 完整的检索与批量维护由次级抽屉负责（onOpenTreatyBook）。
 * 缔约方来自 politics.signatory_of 投影（row.parties），本层不读也不写 politics.treaty_between。
 */

import { ChevronDown, ChevronRight, PenLine, Plus, SquareArrowOutUpRight } from 'lucide-react';

import { EmptyState } from '../../shared/EmptyState';
import { politicsKindDef } from '../config';
import type { RosterTreatyRow, UsePoliticsResult } from '../hooks';
import { toneTextClass } from '../tone';
import { ORPHAN_LABEL, rosterRowHeight, shortStamp } from './rosterSupport';
import { TREATY_STATUS_LABELS, readTreatyMeta, type TreatyStatus } from '../types';

/** 状态色只做辅助，文字标签始终同时出现（§4.6.5 颜色不单独承载语义） */
const treatyStatusTextClass = (status: TreatyStatus): string => {
  if (status === 'active') return 'text-emerald-700 dark:text-emerald-300';
  if (status === 'suspended') return 'text-destructive';
  return 'text-muted-foreground';
};

export interface TreatyBlockProps {
  politics: UsePoliticsResult;
  rows: RosterTreatyRow[];
  /** 模块内条约总数：区分「还没有条约」与「筛选无结果」 */
  totalCount: number;
  open: boolean;
  canEdit: boolean;
  onToggle: () => void;
  onOpenTreatyBook: () => void;
  onOpen: (entityId: string) => void;
  onCreate: () => void;
}

export const TreatyBlock = ({
  politics,
  rows,
  totalCount,
  open,
  canEdit,
  onToggle,
  onOpenTreatyBook,
  onOpen,
  onCreate,
}: TreatyBlockProps) => (
  <section data-testid="roster-treaty-block" className="border-t border-border/40">
    <div
      className="flex items-center gap-2 bg-muted/20 px-2"
      style={{ height: rosterRowHeight('treaty') }}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        aria-label={open ? '收起条约簿区块' : '展开条约簿区块'}
        className="flex min-w-0 flex-1 items-center gap-1.5 text-left"
      >
        {open ? (
          <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
        )}
        <PenLine className={`h-3.5 w-3.5 shrink-0 ${toneTextClass('green')}`} aria-hidden="true" />
        <span className="text-[11px] font-semibold text-foreground">
          条约簿（{rows.length}）
        </span>
        <span className="truncate text-[10px] text-muted-foreground">
          次级区块 · 默认折叠 · 不与三个主视图并列
        </span>
      </button>
      <button
        type="button"
        onClick={onOpenTreatyBook}
        className="shrink-0 rounded-md border border-border px-2 py-0.5 text-[10px] text-foreground hover:bg-accent/30"
      >
        打开条约簿
      </button>
      <button
        type="button"
        onClick={onCreate}
        disabled={!canEdit}
        className="flex shrink-0 items-center gap-1 rounded-md border border-border px-2 py-0.5 text-[10px] text-foreground hover:bg-accent/30 disabled:opacity-50"
      >
        <Plus className="h-3 w-3" aria-hidden="true" />
        发起条约
      </button>
    </div>

    {open &&
      (totalCount === 0 ? (
        <EmptyState
          compact
          icon={PenLine}
          title="还没有条约"
          description="缔约方是政权的 signatory_of 边，条款写在条约的 items 里。"
          actions={canEdit ? [{ label: '发起第一个条约', onClick: onCreate }] : undefined}
        />
      ) : rows.length === 0 ? (
        <div className="px-3 py-3 text-[11px] text-muted-foreground">
          没有符合条件的条约（清除顶部筛选后查看全部）。
        </div>
      ) : (
        <div className="overflow-x-auto">
          <div className="flex min-w-[880px] items-center gap-2 border-b border-border/30 bg-card/60 px-2 py-1 text-[10px] font-medium text-muted-foreground">
            <span className="min-w-0 flex-1">名称</span>
            <span className="w-24 shrink-0">类型</span>
            <span className="w-48 shrink-0">缔约方</span>
            <span className="w-24 shrink-0">生效</span>
            <span className="w-20 shrink-0">状态</span>
            <span className="w-10 shrink-0 text-right">条款</span>
            <span className="w-10 shrink-0 text-right">修订</span>
            <span className="w-16 shrink-0 text-right">关联</span>
            <span className="w-10 shrink-0 text-right">打开</span>
          </div>
          {rows.map((row) => {
            const meta = readTreatyMeta(row.treaty.meta);
            const typeLabel = meta.treatyTypeId
              ? politicsKindDef(politics.config, meta.treatyTypeId)?.label ?? meta.treatyTypeId
              : ORPHAN_LABEL;
            const effective = shortStamp(meta.effectiveAt ?? meta.time?.start) || ORPHAN_LABEL;
            return (
              <div
                key={row.treaty.id}
                data-testid="roster-treaty-row"
                data-entity-id={row.treaty.id}
                style={{ height: rosterRowHeight('treaty') }}
                className="flex min-w-[880px] items-center gap-2 border-b border-border/20 px-2 hover:bg-accent/20"
              >
                <button
                  type="button"
                  onClick={() => onOpen(row.treaty.id)}
                  className="min-w-0 flex-1 truncate text-left text-[11px] font-medium text-foreground hover:text-primary"
                >
                  {row.treaty.name}
                </button>
                <span className="w-24 shrink-0 truncate text-[10px] text-muted-foreground" title={typeLabel}>
                  {typeLabel}
                </span>
                <span className="w-48 shrink-0 truncate text-[10px] text-foreground" title={row.parties.map((p) => p.label).join('、')}>
                  {row.parties.length === 0
                    ? '还没有缔约方'
                    : `${row.parties.slice(0, 3).map((p) => p.label).join('、')}${
                        row.parties.length > 3 ? ` 等 ${row.parties.length} 方` : ''
                      }`}
                </span>
                <span className="w-24 shrink-0 truncate text-[10px] text-muted-foreground">{effective}</span>
                <span className={`w-20 shrink-0 truncate text-[10px] ${treatyStatusTextClass(row.status)}`}>
                  {TREATY_STATUS_LABELS[row.status]}
                </span>
                <span className="w-10 shrink-0 text-right text-[10px] text-muted-foreground">{row.termCount}</span>
                <span className="w-10 shrink-0 text-right text-[10px] text-muted-foreground">
                  {row.amendmentCount}
                </span>
                <span className="w-16 shrink-0 text-right text-[10px] text-muted-foreground">
                  出{row.counts.out}/入{row.counts.in}
                </span>
                <span className="flex w-10 shrink-0 justify-end">
                  <button
                    type="button"
                    onClick={() => onOpen(row.treaty.id)}
                    aria-label={`打开条约 ${row.treaty.name}`}
                    title="打开条约详情"
                    className="rounded p-1 text-muted-foreground hover:bg-accent/40 hover:text-foreground"
                  >
                    <SquareArrowOutUpRight className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                </span>
              </div>
            );
          })}
        </div>
      ))}
  </section>
);

export default TreatyBlock;
