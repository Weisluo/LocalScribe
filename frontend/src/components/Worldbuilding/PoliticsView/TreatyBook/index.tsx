/**
 * 条约簿（Phase 4 P4-T6；politics_ui_design §4.6.4/§4.6.5/§9.2）
 *
 * 次级抽屉：由 open 控制，不占三主视图的 Tab，打开后不改变画布状态。
 * 筛选：类型 / 状态 / 缔约方 / 搜索；表体：名称 / 类型 / 缔约方 / 生效 / 状态 / 条款数 / 修订数 / 关联 / 打开。
 * 缔约方集合一律来自 politics.signatory_of 投影（politics.rosterTreaties[].parties）；
 * 本层不创建也不读取 politics.treaty_between（旧数据由 types.ts 的展示层转换覆盖）。
 * 状态列始终带 TREATY_STATUS_LABELS 文字，颜色不单独承载语义（§4.6.5）。
 */

import { useMemo, useState } from 'react';
import { PenLine, Plus, SearchX, X } from 'lucide-react';

import { EmptyState } from '../../shared/EmptyState';
import { politicsKindDef } from '../config';
import { pendingLegacyTreatyEdges, type UsePoliticsResult } from '../hooks';
import { fieldClass, toneTextClass } from '../tone';
import { useFocusTrap } from '../FocusPanel/useFocusTrap';
import {
  ORPHAN_LABEL,
  shortStamp,
} from '../Roster/rosterSupport';
import { TREATY_STATUS_LABELS, readTreatyMeta, type TreatyStatus } from '../types';
import { refKey } from '../../types';
import type { EntityRef } from '@/services/worldbuildingApi';

/** 状态色只做辅助，文字标签始终同时出现（§4.6.5） */
const statusTextClass = (status: TreatyStatus): string => {
  if (status === 'active') return 'text-emerald-700 dark:text-emerald-300';
  if (status === 'suspended') return 'text-destructive';
  return 'text-muted-foreground';
};

export interface TreatyBookProps {
  open: boolean;
  politics: UsePoliticsResult;
  onClose: () => void;
  onOpenTreaty: (entityId: string) => void;
  onCreate: () => void;
  onNavigateToEntity: (ref: EntityRef) => void;
}

export const TreatyBook = ({
  open,
  politics,
  onClose,
  onOpenTreaty,
  onCreate,
  onNavigateToEntity,
}: TreatyBookProps) => {
  const [typeFilter, setTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [partyFilter, setPartyFilter] = useState('');
  const [search, setSearch] = useState('');

  /** 类型选项只从已有数据里取，不预置任何世界观类型（§7.6 空白世界） */
  const typeOptions = useMemo(() => {
    const ids = new Set<string>();
    for (const row of politics.rosterTreaties) {
      const id = readTreatyMeta(row.treaty.meta).treatyTypeId;
      if (id) ids.add(id);
    }
    return [...ids].map((id) => ({
      id,
      label: politicsKindDef(politics.config, id)?.label ?? id,
    }));
  }, [politics.config, politics.rosterTreaties]);

  /** 缔约方选项：signatory_of 投影出的对端集合 */
  const partyOptions = useMemo(() => {
    const map = new Map<string, { ref: EntityRef; label: string }>();
    for (const row of politics.rosterTreaties) {
      for (const party of row.parties) {
        const key = refKey(party.ref);
        if (!map.has(key)) map.set(key, { ref: party.ref, label: party.label });
      }
    }
    return [...map.values()].sort((a, b) => a.label.localeCompare(b.label, 'zh-Hans-CN'));
  }, [politics.rosterTreaties]);

  const rows = useMemo(
    () =>
      politics.rosterTreaties.filter((row) => {
        const meta = readTreatyMeta(row.treaty.meta);
        if (typeFilter && (meta.treatyTypeId ?? '') !== typeFilter) return false;
        if (statusFilter && row.status !== statusFilter) return false;
        if (partyFilter && !row.parties.some((party) => refKey(party.ref) === partyFilter)) {
          return false;
        }
        const keyword = search.trim().toLowerCase();
        if (!keyword) return true;
        const haystack = [
          row.treaty.name,
          row.treaty.description ?? '',
          meta.summary ?? '',
          meta.breachState ?? '',
          ...row.parties.map((party) => party.label),
        ]
          .join('\n')
          .toLowerCase();
        return haystack.includes(keyword);
      }),
    [partyFilter, politics.rosterTreaties, search, statusFilter, typeFilter]
  );

  const filterActive = !!typeFilter || !!statusFilter || !!partyFilter || !!search.trim();
  const clearFilters = () => {
    setTypeFilter('');
    setStatusFilter('');
    setPartyFilter('');
    setSearch('');
  };

  const sketchOnly = !politics.capabilities.treatyBook;
  const legacyPending = useMemo(() => pendingLegacyTreatyEdges(politics.links), [politics.links]);
  const statusCounts = useMemo(() => {
    const counts = new Map<TreatyStatus, number>();
    for (const row of politics.rosterTreaties) {
      counts.set(row.status, (counts.get(row.status) ?? 0) + 1);
    }
    return counts;
  }, [politics.rosterTreaties]);

  /** Esc 只关这一层：捕获阶段 + stopImmediatePropagation（§5.1.4） */
  const trapRef = useFocusTrap<HTMLDivElement>({ active: open, onEscape: onClose });

  if (!open) return null;

  return (
    <div
      ref={trapRef}
      role="dialog"
      aria-modal="true"
      aria-label="条约簿"
      data-testid="treaty-book"
      className="absolute inset-y-0 right-0 z-30 flex w-[560px] max-w-[95vw] flex-col border-l border-border bg-card shadow-lg"
    >
      <div className="flex items-center gap-2 border-b border-border/60 p-3">
        <PenLine className={`h-4 w-4 shrink-0 ${toneTextClass('green')}`} aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <div className="text-xs font-semibold text-foreground">
            条约簿（{rows.length}
            {filterActive ? ` / ${politics.rosterTreaties.length}` : ''}）
          </div>
          <div className="truncate text-[10px] text-muted-foreground">
            {sketchOnly
              ? '速写档：只做计数，升级到结构档后可检索与维护'
              : '次级抽屉 · 缔约方来自 politics.signatory_of 投影 · 打开不改变画布状态'}
          </div>
        </div>
        <button
          type="button"
          onClick={onCreate}
          disabled={!politics.canWriteEntities}
          title={politics.canWriteEntities ? '新建条约' : '当前档位不可写实体'}
          className="flex shrink-0 items-center gap-1 rounded-md bg-primary px-2 py-1 text-[11px] text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          <Plus className="h-3 w-3" aria-hidden="true" />
          新建条约
        </button>
        <button
          type="button"
          onClick={onClose}
          aria-label="关闭条约簿"
          data-testid="treaty-book-close"
          className="shrink-0 rounded-md p-1 text-muted-foreground hover:bg-accent/30 hover:text-foreground"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>

      {legacyPending.length > 0 ? (
        <div
          data-testid="treaty-book-legacy-warning"
          className="border-b border-amber-500/40 bg-amber-500/10 px-3 py-1.5 text-[10px] text-amber-700 dark:text-amber-300"
        >
          {legacyPending.length} 条旧条约边待转换（politics.treaty_between 无法投影为缎带，需要按缔约方改写成 politics.signatory_of）
        </div>
      ) : null}

      {sketchOnly ? (
        <div className="min-h-0 flex-1 space-y-2 overflow-auto p-3" data-testid="treaty-book-summary">
          <div className="rounded-md border border-border/50 bg-muted/10 p-2.5">
            <div className="text-[11px] font-medium text-foreground">
              条约 {politics.rosterTreaties.length}
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[10px] text-muted-foreground">
              {(Object.keys(TREATY_STATUS_LABELS) as TreatyStatus[]).map((key) => (
                <span key={key} className="rounded-full border border-border/60 px-1.5 py-0.5">
                  {TREATY_STATUS_LABELS[key]} {statusCounts.get(key) ?? 0}
                </span>
              ))}
            </div>
          </div>
          <div className="text-[10px] text-muted-foreground">
            速写档只显示条约计数与状态分布：类型 / 条款 / 修订的检索与维护在结构档及以上开放。
          </div>
          <div className="text-[10px] text-muted-foreground">
            需要检索与批量维护？把复杂度切到「结构」或「沙盘」档（升级到结构档）。
          </div>
          {politics.rosterTreaties.length > 0 ? (
            <div className="space-y-0.5">
              {politics.rosterTreaties.map((row) => (
                <button
                  key={row.treaty.id}
                  type="button"
                  onClick={() => onOpenTreaty(row.treaty.id)}
                  className="flex w-full items-center gap-2 rounded-md px-2 py-1 text-left text-[11px] text-foreground hover:bg-accent/20"
                >
                  <span className="min-w-0 flex-1 truncate">{row.treaty.name}</span>
                  <span className="shrink-0 text-[10px] text-muted-foreground">
                    {TREATY_STATUS_LABELS[row.status]}
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <EmptyState
              compact
              icon={PenLine}
              title="还没有条约"
              description="条约是边载荷：先选缔约方（政权 / 组织），再写条款。"
              actions={
                politics.canWriteEntities
                  ? [{ label: '发起第一个条约', onClick: onCreate }]
                  : undefined
              }
            />
          )}
        </div>
      ) : (
        <>
      <div className="flex flex-wrap items-center gap-1.5 border-b border-border/40 p-2">
        <select
          value={typeFilter}
          onChange={(event) => setTypeFilter(event.target.value)}
          aria-label="按条约类型筛选"
          disabled={typeOptions.length === 0}
          className={`${fieldClass} w-28`}
        >
          <option value="">{typeOptions.length === 0 ? '还没有类型' : '全部类型'}</option>
          {typeOptions.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </select>

        <select
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value)}
          aria-label="按条约状态筛选"
          className={`${fieldClass} w-28`}
        >
          <option value="">全部状态</option>
          {(Object.keys(TREATY_STATUS_LABELS) as TreatyStatus[]).map((key) => (
            <option key={key} value={key}>
              {TREATY_STATUS_LABELS[key]}
            </option>
          ))}
        </select>

        <select
          value={partyFilter}
          onChange={(event) => setPartyFilter(event.target.value)}
          aria-label="按缔约方筛选"
          disabled={partyOptions.length === 0}
          className={`${fieldClass} w-36`}
        >
          <option value="">{partyOptions.length === 0 ? '还没有缔约方' : '全部缔约方'}</option>
          {partyOptions.map((option) => (
            <option key={refKey(option.ref)} value={refKey(option.ref)}>
              {option.label}
            </option>
          ))}
        </select>

        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="搜索名称 / 摘要 / 缔约方"
          aria-label="搜索条约"
          className={`${fieldClass} min-w-[10rem] flex-1`}
        />

        {filterActive && (
          <button
            type="button"
            onClick={clearFilters}
            className="rounded px-1.5 py-0.5 text-[10px] text-muted-foreground hover:text-foreground"
          >
            清除筛选
          </button>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-auto">
        {politics.rosterTreaties.length === 0 ? (
          <EmptyState
            compact
            icon={PenLine}
            title="还没有条约"
            description="条约是边载荷：先选缔约方（政权 / 组织），再写条款。"
            actions={politics.canWriteEntities ? [{ label: '发起第一个条约', onClick: onCreate }] : undefined}
          />
        ) : rows.length === 0 ? (
          <EmptyState
            compact
            icon={SearchX}
            title="没有符合条件的条约"
            description="清除筛选，或换个关键词。"
            actions={[{ label: '清除筛选', onClick: clearFilters, variant: 'secondary' }]}
          />
        ) : (
          <div className="min-w-[720px]">
            <div className="sticky top-0 z-10 flex items-center gap-2 border-b border-border/40 bg-card/95 px-2 py-1.5 text-[10px] font-medium text-muted-foreground backdrop-blur">
              <span className="min-w-0 flex-1">名称</span>
              <span className="w-20 shrink-0">类型</span>
              <span className="w-40 shrink-0">缔约方</span>
              <span className="w-24 shrink-0">生效</span>
              <span className="w-20 shrink-0">状态</span>
              <span className="w-10 shrink-0 text-right">条款</span>
              <span className="w-10 shrink-0 text-right">修订</span>
              <span className="w-16 shrink-0 text-right">关联</span>
              <span className="w-14 shrink-0 text-right">打开</span>
            </div>

            {rows.map((row) => {
              const meta = readTreatyMeta(row.treaty.meta);
              const typeLabel = meta.treatyTypeId
                ? politicsKindDef(politics.config, meta.treatyTypeId)?.label ?? meta.treatyTypeId
                : ORPHAN_LABEL;
              const effective =
                shortStamp(meta.effectiveAt ?? meta.time?.start) || ORPHAN_LABEL;
              return (
                <div
                  key={row.treaty.id}
                  data-testid="treaty-book-row"
                  data-entity-id={row.treaty.id}
                  className="flex items-center gap-2 border-b border-border/20 px-2 py-1.5 hover:bg-accent/20"
                >
                  <button
                    type="button"
                    onClick={() => onOpenTreaty(row.treaty.id)}
                    className="min-w-0 flex-1 truncate text-left text-[11px] font-medium text-foreground hover:text-primary"
                  >
                    {row.treaty.name}
                  </button>
                  <span className="w-20 shrink-0 truncate text-[10px] text-muted-foreground" title={typeLabel}>
                    {typeLabel}
                  </span>
                  <span className="flex w-40 shrink-0 flex-wrap items-center gap-0.5">
                    {row.parties.length === 0 ? (
                      <span className="text-[10px] text-muted-foreground">还没有缔约方</span>
                    ) : (
                      row.parties.map((party) => (
                        <button
                          key={refKey(party.ref)}
                          type="button"
                          onClick={() => onNavigateToEntity(party.ref)}
                          title={`${party.label}${party.role ? ` · ${party.role}` : ''}`}
                          className="max-w-full truncate rounded-full border border-border/60 px-1 text-[10px] text-foreground hover:border-primary/50 hover:text-primary"
                        >
                          {party.label}
                        </button>
                      ))
                    )}
                  </span>
                  <span className="w-24 shrink-0 truncate text-[10px] text-muted-foreground">
                    {effective}
                  </span>
                  <span className={`w-20 shrink-0 truncate text-[10px] ${statusTextClass(row.status)}`}>
                    {TREATY_STATUS_LABELS[row.status]}
                  </span>
                  <span className="w-10 shrink-0 text-right text-[10px] text-muted-foreground">
                    {row.termCount}
                  </span>
                  <span className="w-10 shrink-0 text-right text-[10px] text-muted-foreground">
                    {row.amendmentCount}
                  </span>
                  <span className="w-16 shrink-0 text-right text-[10px] text-muted-foreground">
                    出{row.counts.out}/入{row.counts.in}
                  </span>
                  <span className="flex w-14 shrink-0 justify-end">
                    <button
                      type="button"
                      onClick={() => onOpenTreaty(row.treaty.id)}
                      className="rounded border border-border px-1.5 py-0.5 text-[10px] text-foreground hover:bg-accent/30"
                    >
                      打开
                    </button>
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
        </>
      )}
    </div>
  );
};

export default TreatyBook;
