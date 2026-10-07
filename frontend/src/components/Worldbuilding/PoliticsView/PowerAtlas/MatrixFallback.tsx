/**
 * 版图矩阵降级 MatrixFallback（Phase 4 P4-T3；politics_ui_design §11.3）
 *
 * atlasMode === 'matrix'（政权 > 200 或边 > 2000）时画布不再铺开，改为
 * 「按等级分组的矩阵 + 关系列表」：等级分组来自 politics.levels（rank 降序），
 * 未分级政权单列一组；关系列表直接用 politics.aggregatedEdges（不再自行聚合）。
 *
 * 降级不是「绕过筛选」：activity 的等级 / 状态 / 搜索仍然生效（kind 维度按政权口径判定），
 * 关系列表只保留两端都还在矩阵里的政权关系（§11.3 语义不变，只是把同一套 filter 传下来）。
 */

import { Compass, Grid2x2, Plus } from 'lucide-react';
import { useMemo } from 'react';

import type { EntityRef } from '@/services/worldbuildingApi';
import { matchesFilter } from '../hooks';
import type { AtlasNodeView, PoliticsFilterState, UsePoliticsResult } from '../hooks/politicsTypes';
import { POLITY_KIND } from '../types';
import { chipClass, sectionTitleClass } from '../tone';

export interface MatrixFallbackProps {
  politics: UsePoliticsResult;
  /** 与 AtlasCanvas 同一套筛选状态：换视图不该让筛选静默失效 */
  filter: PoliticsFilterState;
  focusedId: string | null;
  onFocus: (entityId: string) => void;
  onOpenTreatyBook: () => void;
  onNavigateToEntity: (ref: EntityRef) => void;
  onCreateKind: (kind: string) => void;
}

interface LevelGroup {
  id: string;
  label: string;
  rank?: number;
  nodes: AtlasNodeView[];
}

export const MatrixFallback = ({
  politics,
  filter,
  focusedId,
  onFocus,
  onOpenTreatyBook,
  onNavigateToEntity,
  onCreateKind,
}: MatrixFallbackProps) => {
  // kind 维度留给分组本身（矩阵只列政权），等级 / 状态 / 搜索照常过滤
  const visibleNodes = useMemo(() => {
    const entityFilter = { ...filter, kind: 'all' as const };
    return politics.atlasNodes.filter((node) => matchesFilter(node.polity, entityFilter));
  }, [filter, politics.atlasNodes]);

  const visibleIds = useMemo(
    () => new Set(visibleNodes.map((node) => node.polity.id)),
    [visibleNodes]
  );

  const visibleEdges = useMemo(
    () =>
      politics.aggregatedEdges.filter(
        (edge) => visibleIds.has(edge.from.id) || visibleIds.has(edge.to.id)
      ),
    [politics.aggregatedEdges, visibleIds]
  );

  const groups = useMemo<LevelGroup[]>(() => {
    const levelDefs = [...(politics.levels ?? [])].sort(
      (a, b) => (b.rank ?? 0) - (a.rank ?? 0) || a.label.localeCompare(b.label, 'zh-Hans-CN')
    );
    const known = new Set(levelDefs.map((def) => def.id));
    const rows: LevelGroup[] = levelDefs.map((def) => ({
      id: def.id,
      label: def.label,
      rank: def.rank,
      nodes: [],
    }));
    const ungraded: LevelGroup = { id: '__ungraded', label: '未分级', nodes: [] };
    for (const node of visibleNodes) {
      const level = node.polity.meta.level;
      const bucket = level && known.has(level) ? rows.find((row) => row.id === level) : undefined;
      (bucket ?? ungraded).nodes.push(node);
    }
    return [...rows, ungraded].filter((group) => group.nodes.length > 0);
  }, [politics.levels, visibleNodes]);

  const statusLabelOf = (status?: string): string => {
    if (!status) return '未标注';
    return (politics.statuses ?? []).find((def) => def.id === status)?.label ?? status;
  };

  return (
    <div className="space-y-4 overflow-y-auto px-6 py-6" data-testid="atlas-matrix-fallback">
      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-border/50 bg-card/40 px-4 py-3 shadow-sm backdrop-blur-sm">
        <Grid2x2 className="h-4 w-4 text-primary" aria-hidden="true" />
        <span className={sectionTitleClass}>规模过大：版图已降级为矩阵</span>
        <span className="text-xs text-muted-foreground">
          政权 {visibleNodes.length}/{politics.atlasNodes.length} · 关系 {visibleEdges.length}/
          {politics.aggregatedEdges.length} · 超过阈值后不再铺开画布（§11.3）
        </span>
        <button
          type="button"
          onClick={onOpenTreatyBook}
          className="ml-auto flex items-center gap-1.5 rounded-lg border border-border/50 bg-muted/40 px-3 py-1.5 text-xs font-medium text-muted-foreground transition-all duration-200 hover:border-accent/30 hover:bg-accent/10 hover:text-foreground motion-reduce:transition-none"
        >
          <Compass className="h-3.5 w-3.5" aria-hidden="true" />
          条约簿 {politics.treaties.length}
        </button>
        <button
          type="button"
          onClick={() => onCreateKind(POLITY_KIND)}
          className="flex items-center gap-1.5 rounded-lg bg-gradient-to-br from-primary to-primary/90 px-3 py-1.5 text-xs font-semibold text-primary-foreground shadow-sm transition-all duration-200 hover:shadow-md hover:shadow-primary/20"
        >
          <Plus className="h-3.5 w-3.5" aria-hidden="true" />
          新建政权
        </button>
      </div>

      {groups.map((group) => (
        <section key={group.id} className="space-y-2" data-testid={`atlas-matrix-group-${group.id}`}>
          <h3 className={sectionTitleClass}>
            {group.label}
            <span className="text-xs text-muted-foreground">
              {group.nodes.length} 个政权
              {group.rank !== undefined && ` · rank ${group.rank}`}
            </span>
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr className="text-left text-xs text-muted-foreground">
                  <th scope="col" className="border-b border-border/40 px-2 py-1.5">政权</th>
                  <th scope="col" className="border-b border-border/40 px-2 py-1.5">状态</th>
                  <th scope="col" className="border-b border-border/40 px-2 py-1.5">政体</th>
                  <th scope="col" className="border-b border-border/40 px-2 py-1.5">卫星</th>
                  <th scope="col" className="border-b border-border/40 px-2 py-1.5">人物</th>
                  <th scope="col" className="border-b border-border/40 px-2 py-1.5">条约</th>
                  <th scope="col" className="border-b border-border/40 px-2 py-1.5">关系（出/入）</th>
                </tr>
              </thead>
              <tbody>
                {group.nodes.map((node) => (
                  <tr
                    key={node.polity.id}
                    className={`transition-colors hover:bg-accent/20 motion-reduce:transition-none ${
                      node.polity.id === focusedId ? 'bg-primary/10' : ''
                    }`}
                  >
                    <td className="border-b border-border/30 px-2 py-1.5">
                      <button
                        type="button"
                        onClick={() => onFocus(node.polity.id)}
                        className="truncate text-left text-sm font-medium text-foreground transition-colors hover:text-primary"
                      >
                        {node.polity.name}
                      </button>
                      {node.terminal && (
                        <span className="ml-1 text-xs text-muted-foreground">终端状态</span>
                      )}
                    </td>
                    <td className="border-b border-border/30 px-2 py-1.5 text-muted-foreground">
                      {statusLabelOf(node.polity.meta.status)}
                    </td>
                    <td className="border-b border-border/30 px-2 py-1.5 text-muted-foreground">
                      {node.polity.meta.governmentFormLabel ?? '未标注'}
                    </td>
                    <td className="border-b border-border/30 px-2 py-1.5 text-muted-foreground">
                      {node.satellites.length}
                    </td>
                    <td className="border-b border-border/30 px-2 py-1.5 text-muted-foreground">
                      {node.figures.length}
                    </td>
                    <td className="border-b border-border/30 px-2 py-1.5 text-muted-foreground">
                      {node.ribbons.length}
                    </td>
                    <td className="border-b border-border/30 px-2 py-1.5 text-muted-foreground">
                      出 {node.relationCount.out} / 入 {node.relationCount.in}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ))}

      {visibleNodes.length === 0 && (
        <div className="text-sm text-muted-foreground/70" data-testid="atlas-matrix-empty">
          当前筛选下没有政权行：放宽等级 / 状态 / 搜索，或清除筛选。
        </div>
      )}

      <section className="space-y-2" data-testid="atlas-matrix-relations">
        <h3 className={sectionTitleClass}>
          关系列表
          <span className="text-xs text-muted-foreground">
            {visibleEdges.length} 条（按类型聚合，随筛选收敛）
          </span>
        </h3>
        {visibleEdges.length === 0 ? (
          <div className="text-sm text-muted-foreground/70">
            {politics.aggregatedEdges.length === 0 ? '还没有政治关系' : '当前筛选下没有可见的政治关系'}
          </div>
        ) : (
          <div className="space-y-1">
            {visibleEdges.map((edge) => (
              <div
                key={edge.key}
                className="flex flex-wrap items-center gap-2 rounded-xl border border-border/50 bg-card/50 px-3 py-2 text-xs shadow-sm"
              >
                <button
                  type="button"
                  onClick={() => onNavigateToEntity(edge.from)}
                  className="max-w-[30%] truncate text-foreground transition-colors hover:text-primary"
                >
                  {politics.refs.resolveName(edge.from)}
                </button>
                <span className={chipClass}>{edge.label}</span>
                <button
                  type="button"
                  onClick={() => onNavigateToEntity(edge.to)}
                  className="max-w-[30%] truncate text-foreground transition-colors hover:text-primary"
                >
                  {politics.refs.resolveName(edge.to)}
                </button>
                <span className="text-xs text-muted-foreground">
                  {edge.memberIds.length > 1 ? `同类 ${edge.memberIds.length} 条` : '1 条'}
                </span>
                {edge.dangling && (
                  <span className="text-xs text-destructive">失效引用</span>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};

export default MatrixFallback;
