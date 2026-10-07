/**
 * 超阈值降级 DegradeLedgerMatrix（Phase 5 P5-T14；economy_ui_design §4.6.6、§11.1；
 * cross_module_link_design §5.4：实体超过性能阈值 -> 模块矩阵 + 推荐关联列表）
 *
 * 口径：
 * - 超过阈值是**唯一路径**：不为 800+ 节点做真实渲染优化，画布一律换成账册矩阵（§11.1 结论）；
 * - 矩阵是「按 kind × 阶段」的计数网格，下面的节点清单仍可点进实体、可跳转外站；
 * - 推荐关联来自 `recommendations`（`graph/guards.recommendationsOf`），**只推荐不写入**，
 *   不会因为推荐而创建任何实体或关联（§9.3）；
 * - 顶部说明真实原因与阈值，不隐藏降级事实。
 */

import { Grid3x3, Link2 } from 'lucide-react';
import { useMemo } from 'react';

import { lucideIcon } from '../../shared/lucideIcon';
import {
  ECONOMY_CONFIG_DEFAULTS,
  ECONOMY_LINK_LABELS,
  ECONOMY_MATRIX_THRESHOLD,
  ECONOMY_STAGES,
  stageOfKind,
} from '../config';
import type { DegradeLedgerMatrixProps, EconomyNode } from '../types';

const stageOf = (node: EconomyNode): string =>
  node.stage || stageOfKind(node.kind, ECONOMY_CONFIG_DEFAULTS);

interface KindRow {
  id: string;
  label: string;
  icon?: string | null;
}

export const DegradeLedgerMatrix = ({
  nodes,
  edges,
  counts,
  reason,
  nodeLimit,
  kinds,
  selectedId,
  onSelect,
  onOpenEntity,
  onNavigateToEntity,
  recommendations,
}: DegradeLedgerMatrixProps) => {
  const limit = nodeLimit > 0 ? nodeLimit : ECONOMY_MATRIX_THRESHOLD;
  const stages = ECONOMY_STAGES;

  // 降级载荷（>800 节点）只给 counts，`nodes` / `edges` 都是空数组：
  // 矩阵的类型行与每格计数必须能从 counts.byKindStage / counts.byKind 直接渲染。
  const byKindStage = counts?.byKindStage ?? null;
  const byKind = counts?.byKind ?? null;

  const kindRows = useMemo<KindRow[]>(() => {
    const rows: KindRow[] = [];
    const seen = new Set<string>();
    const push = (id: string | undefined, label: string, icon?: string | null) => {
      if (!id || seen.has(id)) return;
      seen.add(id);
      rows.push({ id, label, icon });
    };
    for (const bucket of kinds) push(bucket.id, bucket.label, bucket.icon);
    for (const id of Object.keys(byKind ?? {})) push(id, id, null);
    for (const key of Object.keys(byKindStage ?? {})) push(key.split('|')[0], key.split('|')[0], null);
    for (const node of nodes) push(node.kind, node.kind, node.icon);
    return rows;
  }, [byKind, byKindStage, kinds, nodes]);

  /** nodes 侧回退口径：没有 counts 时（未降级的调用）仍按当前结果集算 */
  const cellCounts = useMemo(() => {
    const map = new Map<string, number>();
    for (const node of nodes) {
      const key = `${node.kind}|${stageOf(node)}`;
      map.set(key, (map.get(key) ?? 0) + 1);
    }
    return map;
  }, [nodes]);

  const nodesByKind = useMemo(() => {
    const map = new Map<string, EconomyNode[]>();
    for (const node of nodes) {
      const list = map.get(node.kind) ?? [];
      list.push(node);
      map.set(node.kind, list);
    }
    return map;
  }, [nodes]);

  /** 每格计数：counts.byKindStage（键 `kind|stage`）优先，缺失才回退 nodes */
  const cellCount = (kind: string, stage: string): number => {
    const fromCounts = byKindStage?.[`${kind}|${stage}`];
    if (typeof fromCounts === 'number') return fromCounts;
    return cellCounts.get(`${kind}|${stage}`) ?? 0;
  };

  /** 合计列：counts.byKind 优先，缺失才回退 nodes */
  const kindTotal = (kind: string): number => {
    const fromCounts = byKind?.[kind];
    if (typeof fromCounts === 'number') return fromCounts;
    return (nodesByKind.get(kind) ?? []).length;
  };

  const reasonText = reason?.trim() ?? '';
  const extraReason = reasonText && !reasonText.includes('已切换为账册矩阵') ? reasonText : null;

  return (
    <div
      data-testid="economy-degrade-matrix"
      className="space-y-4 overflow-y-auto p-5"
    >
      <div
        data-testid="economy-degrade-reason"
        className="rounded-2xl border border-amber-600/40 bg-amber-500/10 px-4 py-3 shadow-sm"
      >
        <div className="flex flex-wrap items-center gap-2 text-sm text-foreground">
          <Grid3x3 className="h-4 w-4 text-amber-600 dark:text-amber-400" aria-hidden="true" />
          <span>
            {/* nodes 为空 = 降级载荷只给 counts：此处说的是全量节点数，不是当前筛选结果 */}
            {nodes.length > 0
              ? `当前 ${nodes.length} 个节点，超过 ${limit} 阈值；已切换为账册矩阵`
              : counts
                ? `全量 ${counts.nodes} 个节点，超过 ${limit} 阈值；已切换为账册矩阵`
                : `节点数超过 ${limit} 阈值；已切换为账册矩阵`}
          </span>
          <span className="text-xs text-muted-foreground">
            不再铺开画布；超过阈值不另造第二条路径
          </span>
        </div>
        {extraReason && <p className="mt-1 text-xs text-muted-foreground">原因：{extraReason}</p>}
        <p className="mt-1 text-xs text-muted-foreground">
          {nodes.length > 0
            ? `关联 ${edges.length} 条`
            : counts
              ? `全量节点 ${counts.nodes} / 关联 ${counts.edges}`
              : '明细已收起'}
          {nodes.length > 0 && counts ? ` · 全量节点 ${counts.nodes} / 关联 ${counts.edges}` : ''}
          {counts && counts.externalNodes > 0 ? ` · 外站 ${counts.externalNodes}` : ''}
          {counts && counts.stubNodes > 0 ? ` · 占位 ${counts.stubNodes}` : ''}
        </p>
      </div>

      <section className="rounded-2xl border border-border/50 bg-card/40 p-4 shadow-sm backdrop-blur-sm">
        <h3 className="text-sm font-semibold text-foreground">
          账册矩阵
          <span className="ml-1.5 text-xs font-normal text-muted-foreground">
            类型 × 阶段计数（{kindRows.length} 类 / {stages.length} 阶段）
          </span>
        </h3>
        <div className="mt-2 overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="text-left text-xs tracking-[0.08em] text-muted-foreground">
                <th scope="col" className="border-b border-border/40 px-3 py-2">类型</th>
                {stages.map((stage) => (
                  <th
                    key={stage.id}
                    scope="col"
                    className="border-b border-border/40 px-3 py-2 text-right"
                  >
                    {stage.label}
                  </th>
                ))}
                <th scope="col" className="border-b border-border/40 px-3 py-2 text-right">合计</th>
              </tr>
            </thead>
            <tbody>
              {kindRows.map((row) => {
                const Icon = lucideIcon(row.icon ?? undefined);
                return (
                  <tr
                    key={row.id}
                    data-testid={`economy-degrade-kind-${row.id}`}
                    className="transition-colors duration-200 hover:bg-accent/5"
                  >
                    <td className="border-b border-border/30 px-3 py-1.5 text-foreground">
                      <span className="flex items-center gap-1.5">
                        {Icon && <Icon className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />}
                        {row.label}
                      </span>
                    </td>
                    {stages.map((stage) => (
                      <td
                        key={stage.id}
                        data-testid={`economy-degrade-cell-${row.id}-${stage.id}`}
                        className="border-b border-border/30 px-3 py-1.5 text-right tabular-nums text-muted-foreground"
                      >
                        {cellCount(row.id, stage.id)}
                      </td>
                    ))}
                    <td
                      data-testid={`economy-degrade-total-${row.id}`}
                      className="border-b border-border/30 px-3 py-1.5 text-right tabular-nums font-medium text-foreground"
                    >
                      {kindTotal(row.id)}
                    </td>
                  </tr>
                );
              })}
              {kindRows.length === 0 && (
                <tr>
                  <td className="px-3 py-3 text-sm text-muted-foreground" colSpan={stages.length + 2}>
                    当前结果集没有实体：放宽筛选，或先添加实体。
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-2xl border border-border/50 bg-card/40 p-4 shadow-sm backdrop-blur-sm">
        <h3 className="text-sm font-semibold text-foreground">
          实体清单
          <span className="ml-1.5 text-xs font-normal text-muted-foreground">
            {nodes.length > 0 ? `${nodes.length} 项（按类型分组）` : '明细已收起'}
          </span>
        </h3>
        {nodes.length === 0 ? (
          // 降级载荷的 nodes 是空数组：这里没有可渲染的明细，也不谎称有明细
          <p className="mt-2 rounded-xl border-2 border-dashed border-border/40 px-4 py-6 text-center text-sm text-muted-foreground">
            已按降级策略收起明细：放宽筛选或减少节点后可回到画布。
            {counts ? '上方矩阵计数取自全量统计。' : ''}
          </p>
        ) : (
          <div className="mt-2 space-y-2">
            {kindRows.map((row) => {
              const list = nodesByKind.get(row.id) ?? [];
              if (list.length === 0) return null;
              return (
                <div key={row.id} className="space-y-1">
                  <div className="text-xs font-medium text-muted-foreground">
                    {row.label} · {list.length}
                  </div>
                  {list.map((node) => (
                    <div
                      key={node.id}
                      className={`flex flex-wrap items-center gap-2 rounded-xl border border-border/40 px-3 py-1.5 text-sm transition-colors duration-200 hover:bg-accent/5 ${
                        node.id === selectedId ? 'bg-primary/5 border-primary/25' : ''
                      }`}
                    >
                      <button
                        type="button"
                        data-testid={`economy-degrade-node-${node.id}`}
                        onClick={() => {
                          onSelect(node.id);
                          onOpenEntity(node.id);
                        }}
                        className="max-w-[40%] truncate text-left text-base font-semibold text-foreground transition-colors duration-200 hover:text-primary"
                      >
                        {node.name}
                      </button>
                      <span className="text-xs text-muted-foreground">
                        {stages.find((stage) => stage.id === stageOf(node))?.label ?? stageOf(node)}
                      </span>
                      {node.level && <span className="text-xs text-muted-foreground">{node.level}</span>}
                      {typeof node.scale === 'number' && (
                        <span className="text-xs tabular-nums text-muted-foreground">
                          规模 {node.scale}
                          {node.unit ? ` ${node.unit}` : ''}
                        </span>
                      )}
                      {typeof node.scale !== 'number' && (
                        <span className="text-xs text-muted-foreground">规模未填</span>
                      )}
                      {node.counts && (
                        <span className="text-xs text-muted-foreground">
                          出 {node.counts.outgoing} / 入 {node.counts.incoming}
                        </span>
                      )}
                      {node.stub && <span className="text-xs text-muted-foreground">占位</span>}
                      {!node.hasMetrics && <span className="text-xs text-muted-foreground">未填指标</span>}
                      {node.external && (
                        <button
                          type="button"
                          onClick={() => onNavigateToEntity(node.ref)}
                          className="ml-auto rounded-lg border border-border/50 bg-muted/40 px-2.5 py-1 text-xs font-medium text-muted-foreground transition-all duration-200 hover:border-accent/30 hover:bg-accent/10 hover:text-foreground motion-reduce:transition-none"
                        >
                          跳转外站
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section
        data-testid="economy-recommendations"
        className="space-y-2 rounded-2xl border border-border/50 bg-card/40 p-4 shadow-sm backdrop-blur-sm"
      >
        <h3 className="text-sm font-semibold text-foreground">
          推荐关联
          <span className="ml-1.5 text-xs font-normal text-muted-foreground">
            只推荐，不写入（{recommendations.length} 条）
          </span>
        </h3>
        {recommendations.length === 0 ? (
          <p className="rounded-xl border-2 border-dashed border-border/40 px-4 py-6 text-center text-sm text-muted-foreground">
            当前结果集里没有可推荐的同类 / 上下游节点对：两端都在结果集、尚无边、阶段相邻才会推荐。
          </p>
        ) : (
          <div className="space-y-1">
            {recommendations.map((item) => (
              <div
                key={`${item.source.id}|${item.target.id}|${item.linkType}`}
                className="flex flex-wrap items-center gap-2 rounded-xl border border-border/40 px-3 py-1.5 text-sm transition-colors duration-200 hover:bg-accent/5"
              >
                <button
                  type="button"
                  onClick={() => onSelect(item.source.id)}
                  className="max-w-[28%] truncate text-left text-foreground transition-colors duration-200 hover:text-primary"
                >
                  {item.source.name}
                </button>
                <span className="flex items-center gap-1 text-xs text-cyan-700 dark:text-cyan-300">
                  <Link2 className="h-3 w-3" aria-hidden="true" />
                  {ECONOMY_LINK_LABELS[item.linkType]?.label ?? item.linkType}
                </span>
                <button
                  type="button"
                  onClick={() => onSelect(item.target.id)}
                  className="max-w-[28%] truncate text-left text-foreground transition-colors duration-200 hover:text-primary"
                >
                  {item.target.name}
                </button>
                <span className="text-xs text-muted-foreground">{item.reason}</span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};

export default DegradeLedgerMatrix;
