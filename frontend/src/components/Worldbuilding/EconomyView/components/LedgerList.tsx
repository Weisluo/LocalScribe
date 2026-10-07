/**
 * 经济账册 LedgerList（Phase 5 P5-T11；economy_ui_design §4.1/§4.5.3/§4.7.3）
 *
 * 画布的第二面孔：同一批数据、同一套筛选与选中，只换排版（不是另一份数据）。
 * - 列：名称 / 类型 / 阶段 / 等级 / 规模 / 出链 / 入链 / 状态 / 指标 / 最近更新；
 *   数字一律 `tabular-nums`，表头 `letter-spacing: 0.08em`；
 * - **「—」表示未填，不按 0 处理**（`scale` 的 `undefined` 与 `0` 必须可区分）；stub 名称后带「待补全」；
 * - 分组 [按阶段 / 按类型 / 按状态]、排序、密度都是本地视图状态，不写世界数据；
 * - 与画布共享选中：点行选中节点、选中行高亮，`onSelect` / `onOpenEntity` 上抛；
 * - 行 hover 显示对端预览（出链用注册表 label、入链用 reverseLabel）；跨模块对端优先用可选的
 *   `refs.resolveName` 解析真名，缺失时退回「模块名 + 短 id」，失效引用标「已失效」；
 * - 行数 > `ECONOMY_LEDGER_VIRTUAL_LIMIT`(200) 时用 `shared/useVirtualList` 的 `useVirtualGrid` 虚拟滚动，
 *   容器不可测量时（无布局的测试环境）自动退化为全量渲染，绝不裁成空列表。
 *
 * 接口说明：`EconomyGroupBy` 只有 stage | kind，所以「按状态」用本地扩展状态承载（不回写画布，
 * 画布泳道本来也只支持阶段 / 类型两种排列）。
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowUpDown, FilterX, ListFilter, Rows3, Rows4 } from 'lucide-react';

import { moduleLabel } from '@/components/Worldbuilding/types';
import type { EntityRef } from '@/services/worldbuildingApi';
import { useVirtualGrid } from '../../shared/useVirtualList';
import {
  ECONOMY_CONFIG_DEFAULTS,
  ECONOMY_LEDGER_VIRTUAL_LIMIT,
  ECONOMY_LINK_LABELS,
  ECONOMY_RECOMMENDED_KINDS,
  SURPLUS_LABELS,
  isCrosscut,
  stageLabel,
} from '../config';
import { compareLayoutNodes, matchesEconomyFilter } from '../graph/layout';
import type { EconomyNode, LedgerListProps } from '../types';

type LedgerGrouping = 'stage' | 'kind' | 'status';
type LedgerSort = 'default' | 'name' | 'outgoing' | 'incoming' | 'scale';
type Density = 'compact' | 'comfortable';

/** 表头（label + 固定宽度类；数字列右对齐 + tabular-nums） */
const COLUMNS: { key: string; label: string; className: string }[] = [
  { key: 'name', label: '名称', className: 'min-w-0 flex-1' },
  { key: 'kind', label: '类型', className: 'w-16 shrink-0' },
  { key: 'stage', label: '阶段', className: 'w-14 shrink-0' },
  { key: 'level', label: '等级', className: 'w-20 shrink-0' },
  { key: 'scale', label: '规模', className: 'w-20 shrink-0 text-right' },
  { key: 'outgoing', label: '出链', className: 'w-12 shrink-0 text-right' },
  { key: 'incoming', label: '入链', className: 'w-12 shrink-0 text-right' },
  { key: 'status', label: '状态', className: 'w-16 shrink-0' },
  { key: 'metrics', label: '指标', className: 'w-32 shrink-0' },
  { key: 'updated', label: '最近更新', className: 'w-20 shrink-0 text-right' },
];

const SIZE_WORD: Record<'sm' | 'md' | 'lg', string> = { sm: '小站', md: '中站', lg: '大站' };

interface LedgerEntry {
  type: 'group' | 'node';
  key: string;
  label?: string;
  count?: number;
  node?: EconomyNode;
}

export const LedgerList = ({
  nodes,
  edges,
  stages,
  kinds,
  levels,
  statuses,
  filters,
  groupBy,
  selectedId,
  visual,
  sandbox,
  onFiltersChange,
  onGroupByChange,
  onSelect,
  onOpenEntity,
  onResetFilter,
  refs,
}: LedgerListProps) => {
  const [group, setGroup] = useState<LedgerGrouping>(groupBy);
  const [sort, setSort] = useState<LedgerSort>('default');
  const [density, setDensity] = useState<Density>('comfortable');
  const [hoverId, setHoverId] = useState<string | null>(null);

  // 画布改了分组（阶段 / 类型）时账册跟随；「按状态」只属于账册，不写回画布
  useEffect(() => {
    setGroup(groupBy);
  }, [groupBy]);

  const rowHeight = density === 'compact' ? 28 : 36;

  const visibleNodes = useMemo(
    () => nodes.filter((node) => matchesEconomyFilter(node, filters)),
    [nodes, filters]
  );

  const { outgoingCount, incomingCount, nameById } = useMemo(() => {
    const out = new Map<string, number>();
    const inc = new Map<string, number>();
    const names = new Map<string, string>();
    for (const node of visibleNodes) names.set(node.id, node.name);
    for (const edge of edges) {
      out.set(edge.source.id, (out.get(edge.source.id) ?? 0) + 1);
      inc.set(edge.target.id, (inc.get(edge.target.id) ?? 0) + 1);
    }
    return { outgoingCount: out, incomingCount: inc, nameById: names };
  }, [edges, visibleNodes]);

  const outgoingOf = useCallback(
    (node: EconomyNode): number => node.counts?.outgoing ?? outgoingCount.get(node.id) ?? 0,
    [outgoingCount]
  );
  const incomingOf = useCallback(
    (node: EconomyNode): number => node.counts?.incoming ?? incomingCount.get(node.id) ?? 0,
    [incomingCount]
  );

  const kindLabelOf = useCallback(
    (node: EconomyNode): string =>
      kinds.find((bucket) => bucket.id === node.kind)?.label ??
      ECONOMY_RECOMMENDED_KINDS.find((def) => def.id === node.kind)?.label ??
      node.kind,
    [kinds]
  );

  const groups = useMemo(() => {
    const buckets: { key: string; label: string; order: number; nodes: EconomyNode[] }[] = [];
    const bucketOf = (key: string, label: string, order: number) => {
      const existing = buckets.find((item) => item.key === key);
      if (existing) return existing;
      const created = { key, label, order, nodes: [] as EconomyNode[] };
      buckets.push(created);
      return created;
    };

    if (group === 'status') {
      statuses.forEach((def, index) => bucketOf(def.id, def.label, index));
      const unset = bucketOf('__unset', '未标注', statuses.length);
      for (const node of visibleNodes) {
        if (node.status) bucketOf(node.status, node.status, statuses.length + 1).nodes.push(node);
        else unset.nodes.push(node);
      }
    } else if (group === 'kind') {
      // 推荐 kind 在前、custom_ 与未登记的 kind 在后
      const ordered = [...kinds].sort((a, b) => {
        const aCustom = a.id.startsWith('custom_') ? 1 : 0;
        const bCustom = b.id.startsWith('custom_') ? 1 : 0;
        return aCustom - bCustom;
      });
      ordered.forEach((bucket, index) => bucketOf(bucket.id, bucket.label, index));
      for (const node of visibleNodes) {
        const bucket = ordered.findIndex((item) => item.id === node.kind);
        bucketOf(
          node.kind,
          kindLabelOf(node),
          bucket >= 0 ? bucket : ordered.length + 1
        ).nodes.push(node);
      }
    } else {
      const ordered = [...stages].sort((a, b) => {
        const aCross = isCrosscut(a.id) ? 1 : 0;
        const bCross = isCrosscut(b.id) ? 1 : 0;
        return aCross - bCross;
      });
      ordered.forEach((bucket, index) => bucketOf(bucket.id, bucket.label, index));
      for (const node of visibleNodes) {
        const index = ordered.findIndex((item) => item.id === node.stage);
        const key = node.stage || '__unset';
        bucketOf(key, stageLabel(key, ECONOMY_CONFIG_DEFAULTS), index >= 0 ? index : ordered.length + 1)
          .nodes.push(node);
      }
    }

    const sorted = (list: EconomyNode[]): EconomyNode[] => {
      const copy = [...list];
      switch (sort) {
        case 'name':
          return copy.sort(
            (a, b) => a.name.localeCompare(b.name, 'zh-Hans-CN') || compareLayoutNodes(a, b)
          );
        case 'outgoing':
          return copy.sort((a, b) => outgoingOf(b) - outgoingOf(a) || compareLayoutNodes(a, b));
        case 'incoming':
          return copy.sort((a, b) => incomingOf(b) - incomingOf(a) || compareLayoutNodes(a, b));
        case 'scale':
          return copy.sort(
            (a, b) => (b.scale ?? -1) - (a.scale ?? -1) || compareLayoutNodes(a, b)
          );
        default:
          // 默认：分组顺序 + order_index（同阶段内不排成「重要度排行榜」）
          return copy.sort(compareLayoutNodes);
      }
    };

    return buckets
      .filter((bucket) => bucket.nodes.length > 0)
      .sort((a, b) => a.order - b.order || a.key.localeCompare(b.key))
      .map((bucket) => ({ ...bucket, nodes: sorted(bucket.nodes) }));
  }, [group, incomingOf, kindLabelOf, kinds, outgoingOf, sort, stages, statuses, visibleNodes]);

  const entries = useMemo<LedgerEntry[]>(
    () =>
      groups.flatMap((bucket) => [
        { type: 'group' as const, key: bucket.key, label: bucket.label, count: bucket.nodes.length },
        ...bucket.nodes.map((node) => ({ type: 'node' as const, key: node.id, node })),
      ]),
    [groups]
  );

  const virtualize = visibleNodes.length > ECONOMY_LEDGER_VIRTUAL_LIMIT;
  const grid = useVirtualGrid(entries, {
    itemHeight: rowHeight,
    threshold: virtualize ? 0 : Number.POSITIVE_INFINITY,
  });

  const filterActive =
    (filters.kinds?.length ?? 0) > 0 ||
    (filters.stages?.length ?? 0) > 0 ||
    (filters.levels?.length ?? 0) > 0 ||
    (filters.statuses?.length ?? 0) > 0 ||
    !!filters.search?.trim();

  const toggleKind = (kindId: string) => {
    const current = filters.kinds ?? [];
    onFiltersChange({
      ...filters,
      kinds: current.includes(kindId)
        ? current.filter((item) => item !== kindId)
        : [...current, kindId],
    });
  };

  const previewNode = hoverId ? visibleNodes.find((node) => node.id === hoverId) : undefined;
  const previewEdges = previewNode
    ? {
        out: edges.filter((edge) => edge.source.id === previewNode.id).slice(0, 4),
        in: edges.filter((edge) => edge.target.id === previewNode.id).slice(0, 4),
      }
    : null;

  /**
   * 对端名称：结果集内的经济节点直接用行数据；跨模块对端优先交给 `refs.resolveName`
   * （外壳已装配实体索引时能给出真名），缺失时退回「模块名 + 短 id」。
   */
  const counterpartLabel = (ref: EntityRef): string => {
    const local = nameById.get(ref.id);
    if (local) return local;
    const resolved = refs?.resolveName(ref);
    if (resolved) return resolved;
    return `${moduleLabel(ref.module)} ${ref.id.slice(-4)}`;
  };

  const counterpartInvalid = (ref: EntityRef): boolean =>
    !nameById.has(ref.id) && (refs?.isInvalid(ref) ?? false);

  return (
    <div
      data-testid="economy-ledger"
      role="table"
      aria-label="经济账册"
      className="flex h-full min-h-0 flex-col"
    >
      <div className="flex flex-wrap items-center gap-1.5 px-2 py-1.5">
        <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
          <ListFilter className="h-3.5 w-3.5" aria-hidden="true" />
          分组
        </span>
        <div
          role="group"
          aria-label="分组"
          data-testid="economy-ledger-groupby"
          className="flex items-center overflow-hidden rounded-md border border-border/50"
        >
          {(
            [
              { id: 'stage' as LedgerGrouping, label: '按阶段' },
              { id: 'kind' as LedgerGrouping, label: '按类型' },
              { id: 'status' as LedgerGrouping, label: '按状态' },
            ] satisfies { id: LedgerGrouping; label: string }[]
          ).map((option) => (
            <button
              key={option.id}
              type="button"
              aria-pressed={group === option.id}
              onClick={() => {
                setGroup(option.id);
                if (option.id !== 'status') onGroupByChange(option.id);
              }}
              className={`px-2 py-0.5 text-[11px] transition-colors motion-reduce:transition-none ${
                group === option.id
                  ? 'bg-primary/10 text-primary'
                  : 'text-muted-foreground hover:bg-accent/30'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>

        <label className="flex items-center gap-1 text-[11px] text-muted-foreground">
          <ArrowUpDown className="h-3.5 w-3.5" aria-hidden="true" />
          排序
          <select
            value={sort}
            data-testid="economy-ledger-sort"
            aria-label="排序"
            onChange={(event) => setSort(event.target.value as LedgerSort)}
            className="rounded-md border border-border/50 bg-background px-1 py-0.5 text-[11px] text-foreground focus:outline-none"
          >
            <option value="default">默认（分组顺序）</option>
            <option value="name">名称</option>
            <option value="outgoing">出链多优先</option>
            <option value="incoming">入链多优先</option>
            <option value="scale">规模大优先</option>
          </select>
        </label>

        <div
          role="group"
          aria-label="密度"
          data-testid="economy-ledger-density"
          className="flex items-center overflow-hidden rounded-md border border-border/50"
        >
          {(
            [
              { id: 'compact' as Density, label: '紧凑', Icon: Rows3 },
              { id: 'comfortable' as Density, label: '舒适', Icon: Rows4 },
            ] satisfies { id: Density; label: string; Icon: typeof Rows3 }[]
          ).map((option) => (
            <button
              key={option.id}
              type="button"
              aria-pressed={density === option.id}
              onClick={() => setDensity(option.id)}
              className={`flex items-center gap-1 px-2 py-0.5 text-[11px] transition-colors motion-reduce:transition-none ${
                density === option.id
                  ? 'bg-primary/10 text-primary'
                  : 'text-muted-foreground hover:bg-accent/30'
              }`}
            >
              <option.Icon className="h-3 w-3" aria-hidden="true" />
              {option.label}
            </button>
          ))}
        </div>

        <span className="ml-auto text-[10px] text-muted-foreground tabular-nums">
          行 {visibleNodes.length}/{nodes.length}
          {virtualize ? ` · 已虚拟滚动（>${ECONOMY_LEDGER_VIRTUAL_LIMIT}）` : ''}
        </span>
      </div>

      {kinds.length > 0 && (
        <div className="flex flex-wrap items-center gap-1 px-2 pb-1.5">
          <span className="text-[10px] text-muted-foreground">类型筛选</span>
          {kinds.slice(0, 10).map((bucket) => {
            const active = (filters.kinds ?? []).includes(bucket.id);
            return (
              <button
                key={bucket.id}
                type="button"
                aria-pressed={active}
                onClick={() => toggleKind(bucket.id)}
                className={`rounded-full border px-1.5 py-0.5 text-[10px] transition-colors motion-reduce:transition-none ${
                  active
                    ? 'border-primary/50 bg-primary/10 text-primary'
                    : 'border-border/50 text-muted-foreground hover:bg-accent/30'
                }`}
              >
                {bucket.label}
                <span className="ml-1 tabular-nums text-muted-foreground">{bucket.count}</span>
              </button>
            );
          })}
          {filterActive && (
            <button
              type="button"
              onClick={onResetFilter}
              data-testid="economy-ledger-reset"
              className="ml-1 flex items-center gap-1 rounded-full border border-border/50 px-1.5 py-0.5 text-[10px] text-primary transition-colors hover:bg-primary/10 motion-reduce:transition-none"
            >
              <FilterX className="h-3 w-3" aria-hidden="true" />
              清除筛选
            </button>
          )}
        </div>
      )}

      <div
        role="row"
        className="flex items-center gap-2 border-y border-border/40 px-2 py-1 text-[10px] tracking-[0.08em] text-muted-foreground"
      >
        {COLUMNS.map((column) => (
          <span
            key={column.key}
            role="columnheader"
            className={column.className}
            data-column={column.key}
          >
            {column.label}
          </span>
        ))}
      </div>

      <div ref={grid.containerRef} className="min-h-0 flex-1 overflow-auto">
        <div role="rowgroup" style={{ paddingTop: grid.paddingTop, paddingBottom: grid.paddingBottom }}>
          {grid.items.map((entry) =>
            entry.type === 'group' ? (
              <div
                key={`group-${entry.key}`}
                role="row"
                data-testid={`economy-ledger-group-${entry.key}`}
                className="flex items-center gap-2 border-b border-border/30 bg-muted/20 px-2 text-[10px] text-muted-foreground"
                style={{ height: rowHeight }}
              >
                <span className="font-medium">{entry.label}</span>
                <span className="tabular-nums">{entry.count}</span>
              </div>
            ) : (
              (() => {
                const node = entry.node as EconomyNode;
                const surplus = sandbox ? visual?.nodeSurplus[node.id] ?? 'unknown' : 'unknown';
                const size = sandbox ? visual?.nodeSize[node.id] : undefined;
                const metricCount = (node.metricIds ?? []).length;
                const selected = selectedId === node.id;
                return (
                  <div
                    key={node.id}
                    role="row"
                    tabIndex={0}
                    aria-selected={selected}
                    data-testid={`economy-ledger-row-${node.id}`}
                    data-selected={selected ? 'true' : 'false'}
                    data-stub={node.stub ? 'true' : 'false'}
                    onClick={() => onSelect(node.id)}
                    onDoubleClick={() => onOpenEntity(node.id)}
                    onKeyDown={(event) => {
                      if (event.key !== 'Enter') return;
                      event.preventDefault();
                      onOpenEntity(node.id);
                    }}
                    onPointerEnter={() => setHoverId(node.id)}
                    onPointerLeave={() =>
                      setHoverId((prev) => (prev === node.id ? null : prev))
                    }
                    className={`flex cursor-pointer items-center gap-2 border-b border-border/30 px-2 text-[11px] transition-colors motion-reduce:transition-none ${
                      selected ? 'bg-primary/10' : 'hover:bg-accent/20'
                    }`}
                    style={{ height: rowHeight }}
                  >
                    <span role="cell" className="flex min-w-0 flex-1 items-center gap-1">
                      <span className="truncate text-foreground">{node.name}</span>
                      {node.stub && (
                        <span className="shrink-0 rounded-full border border-dashed border-muted-foreground/60 px-1 text-[9px] text-muted-foreground">
                          待补全
                        </span>
                      )}
                      {node.external && (
                        <span className="shrink-0 rounded-full border border-border/60 px-1 text-[9px] text-muted-foreground">
                          外站
                        </span>
                      )}
                    </span>
                    <span role="cell" className={`truncate text-muted-foreground ${COLUMNS[1].className}`}>
                      {kindLabelOf(node)}
                    </span>
                    <span role="cell" className={`truncate text-muted-foreground ${COLUMNS[2].className}`}>
                      {stageLabel(node.stage, ECONOMY_CONFIG_DEFAULTS)}
                    </span>
                    <span role="cell" className={`truncate text-muted-foreground ${COLUMNS[3].className}`}>
                      {levels.find((def) => def.id === node.level)?.label ?? '—'}
                    </span>
                    <span
                      role="cell"
                      className={`text-muted-foreground tabular-nums ${COLUMNS[4].className}`}
                      data-scale={node.scale === undefined || node.scale === null ? 'unset' : 'set'}
                    >
                      {node.scale === undefined || node.scale === null
                        ? '—'
                        : `${node.scale}${node.unit ? ` ${node.unit}` : ''}`}
                    </span>
                    <span role="cell" className={`text-foreground tabular-nums ${COLUMNS[5].className}`}>
                      {outgoingOf(node)}
                    </span>
                    <span role="cell" className={`text-foreground tabular-nums ${COLUMNS[6].className}`}>
                      {incomingOf(node)}
                    </span>
                    <span role="cell" className={`truncate text-muted-foreground ${COLUMNS[7].className}`}>
                      {statuses.find((def) => def.id === node.status)?.label ?? '—'}
                    </span>
                    <span
                      role="cell"
                      className={`flex items-center gap-1 tabular-nums ${COLUMNS[8].className}`}
                      data-metric-trend={surplus}
                    >
                      <span className="text-muted-foreground">
                        {metricCount > 0 ? `${metricCount} 项` : '—'}
                      </span>
                      {sandbox && (
                        <>
                          <span
                            className={
                              surplus === 'surplus'
                                ? 'text-green-600 dark:text-green-400'
                                : surplus === 'balanced'
                                  ? 'text-cyan-600 dark:text-cyan-400'
                                  : surplus === 'deficit'
                                    ? 'text-amber-600 dark:text-amber-400'
                                    : 'text-muted-foreground'
                            }
                          >
                            {SURPLUS_LABELS[surplus]}
                          </span>
                          {size && (
                            <span className="text-muted-foreground">{SIZE_WORD[size]}</span>
                          )}
                        </>
                      )}
                    </span>
                    <span
                      role="cell"
                      className={`text-muted-foreground tabular-nums ${COLUMNS[9].className}`}
                      title="接口未提供更新时间字段"
                    >
                      —
                    </span>
                  </div>
                );
              })()
            )
          )}
        </div>
      </div>

      {previewNode && previewEdges && (
        <div
          data-testid="economy-ledger-preview"
          className="border-t border-border/40 bg-card/40 px-2 py-1 text-[10px] text-muted-foreground"
        >
          <div className="font-medium text-foreground">
            {previewNode.name} · {kindLabelOf(previewNode)} · 目标预览
          </div>
          <div className="flex flex-wrap gap-x-3 gap-y-0.5">
            {previewEdges.out.map((edge) => (
              <span key={edge.id}>
                {ECONOMY_LINK_LABELS[edge.linkType]?.label ?? edge.linkType}
                <span className="mx-1">·</span>
                {counterpartLabel(edge.target)}
                {counterpartInvalid(edge.target) && <span className="ml-1 text-destructive">已失效</span>}
              </span>
            ))}
            {previewEdges.in.map((edge) => (
              <span key={edge.id} className="text-muted-foreground/80">
                {ECONOMY_LINK_LABELS[edge.linkType]?.reverseLabel ?? edge.linkType}
                <span className="mx-1">·</span>
                {counterpartLabel(edge.source)}
                {counterpartInvalid(edge.source) && <span className="ml-1 text-destructive">已失效</span>}
              </span>
            ))}
            {previewEdges.out.length === 0 && previewEdges.in.length === 0 && (
              <span>该实体暂无关联</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default LedgerList;
